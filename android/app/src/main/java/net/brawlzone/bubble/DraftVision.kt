package net.brawlzone.bubble

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt
import org.json.JSONObject

/**
 * Reading a Brawl Stars draft screen, on Android.
 *
 * All the arithmetic lives in [DraftCore], which has no Android in it and is
 * tested against real captures of an actual draft. This file is the part that
 * cannot be: downloading the reference art, caching it, turning a screen frame
 * into pixels, and remembering what the reader corrected.
 *
 * Three things are read, and they are not equally easy.
 *
 * **The picks** are matched against the game's own portrait art. Measured on
 * real captures: 0.93 and 0.83 against runners-up of 0.57 and 0.45.
 *
 * **The bans** are drawn in a different, pixel-art style, and matching them
 * against the portraits failed for weeks — best 0.47 at a 0.01 margin, which is
 * noise. They are the *emoji* asset, and against that they match at 0.70 to
 * 0.90 with margins from 0.20 to 0.33. Two reference sets, because the game
 * uses two.
 *
 * **The mode and map** are printed as text, so they are read by the recogniser
 * in [BubbleService], with plates the reader has confirmed as a faster path
 * that needs no model at all.
 *
 * Nothing is guessed. A slot that does not beat the field by a clear margin
 * comes back without a brawler — and says whether that is because it is empty,
 * unreadable, or under our own panel, because those are different facts.
 *
 * The reference tables are an immutable snapshot, replaced whole. Recognition
 * iterates a table on one thread while a correction adds to it on another,
 * and a `HashMap` being iterated and modified at once throws — which was
 * caught by a `runCatching` and became a scan that quietly returned nothing.
 * A snapshot cannot be modified, only succeeded.
 */
class DraftVision(private val context: Context) {

    /** Everything the matcher compares against, frozen. */
    class Tables(
        val portraits: Map<Int, List<FloatArray>>,
        val icons: Map<Int, List<FloatArray>>,
        /** Plates the reader has confirmed, by kind then by name. */
        val plates: Map<String, Map<String, FloatArray>>,
    ) {
        companion object {
            val EMPTY = Tables(emptyMap(), emptyMap(), emptyMap())
        }
    }

    /** What the reference tables cover, per capability. */
    class Coverage(
        val expected: Int,
        val portraits: Int,
        val icons: Int,
        val missingPortraits: List<Int>,
        val missingIcons: List<Int>,
        /** Ids that failed to decode after a refetch; the cache gave up on them. */
        val corrupt: List<Int>,
    ) {
        /** Picks can be read. The main capability; the app refuses without it. */
        val picksReady: Boolean get() = expected > 0 && portraits >= expected - MISSING_ALLOWANCE

        /**
         * Bans can be read *with normal confidence*. Below this a margin
         * against the icon table is misleading — the right answer may simply
         * be absent — so bans are reported unknown rather than matched.
         */
        val bansReady: Boolean get() = expected > 0 && icons * 10 >= expected * 9

        fun toJson(): JSONObject = JSONObject()
            .put("expected", expected)
            .put("portraits", portraits)
            .put("icons", icons)
            .put("picksReady", picksReady)
            .put("bansReady", bansReady)
            .put("missingPortraits", org.json.JSONArray(missingPortraits))
            .put("missingIcons", org.json.JSONArray(missingIcons))
            .put("corrupt", org.json.JSONArray(corrupt))
    }

    data class Reading(
        val layout: DraftLayout.Located,
        /** Which ally card is the reader's own, when the label says. */
        val self: Int?,
        /** A mode key the reader has confirmed before, or null. */
        val mode: String?,
        /** A map name the reader has confirmed before, or null. */
        val map: String?,
        val bans: List<DraftCore.Match>,
        val allies: List<DraftCore.Match>,
        val enemies: List<DraftCore.Match>,
    )

    companion object {
        const val PLATE_MODE_KEY = "mode"
        const val PLATE_MAP_KEY = "map"

        private const val TAG = "BrawlZoneScan"
        private const val PREFS = "brawlzone.vision"
        private const val PORTRAIT_URL = "https://cdn.brawlify.com/brawlers/borderless/%d.png"
        private const val ICON_URL = "https://cdn.brawlify.com/brawlers/emoji/%d.png"
        private const val MAX_LEARNED = 3

        /**
         * The learned store's format. Bumped whenever the descriptor, the
         * layout it was cut from, or the way it is keyed changes, because a
         * descriptor learned under the old geometry describes the wrong
         * pixels and would match them confidently.
         */
        private const val LEARNED_VERSION = 2
        private const val LEARNED_PREFIX = "learned.v$LEARNED_VERSION."
        private const val PLATE_PREFIX = "plate.v$LEARNED_VERSION."

        /** Enough to saturate a phone's link without hammering the CDN. */
        private const val FETCH_THREADS = 8
        private const val PREPARE_TIMEOUT_MINUTES = 3L

        /** The CDN is missing art for a brawler or two at any given time. */
        private const val MISSING_ALLOWANCE = 4

        /** A cached file that fails to decode is fetched again this many times. */
        private const val DECODE_RETRIES = 2
    }

    @Volatile
    var tables: Tables = Tables.EMPTY
        private set

    @Volatile
    var coverage: Coverage = Coverage(0, 0, 0, emptyList(), emptyList(), emptyList())
        private set

    /** The roster the tables were built for, so a changed one rebuilds them. */
    @Volatile
    private var preparedFor: Set<Int> = emptySet()

    /** Whether the tables are complete enough to scan picks against. */
    val ready: Boolean get() = coverage.picksReady

    /** How far through building the tables, 0..100, for the panel to show. */
    @Volatile
    var progress: Int = 0
        private set

    /** Whether `prepare` would do anything for this roster. */
    fun needsPrepare(ids: Collection<Int>): Boolean = canonical(ids) != preparedFor || !ready

    /**
     * The roster as the matcher understands it: valid ids, once each, in order.
     * Brawler ids are 16000000 + a small number; anything else is a bug on the
     * page, and a table keyed on it would count toward "expected" forever.
     */
    private fun canonical(ids: Collection<Int>): Set<Int> =
        ids.filter { it in 16_000_000..16_999_999 }.toSortedSet()

    // ---- reference tables ---------------------------------------------------

    /**
     * Builds both tables from the roster the panel already knows about.
     *
     * The ids come from the page rather than being compiled in, so a brawler
     * released next month is matchable the day the site knows about it. The art
     * is cached on disk after the first run, so this is slow exactly once.
     *
     * Downloaded in parallel, which is not a micro-optimisation: two hundred and
     * fourteen files fetched one after another over mobile data is minutes of
     * "Loading portraits…" during which the feature does not work and nothing
     * says why. Eight at a time turns that into seconds, and the work is all
     * waiting on a network rather than on this phone.
     *
     * Resumable and re-runnable: anything already in the current tables is
     * kept, so a second call after a partial failure only fetches what is
     * missing, and a roster that grew only fetches the new ids.
     */
    fun prepare(ids: List<Int>, onProgress: (Int) -> Unit = {}) {
        val roster = canonical(ids)
        val dir = File(context.filesDir, "art").apply { mkdirs() }
        val done = java.util.concurrent.atomic.AtomicInteger(0)
        val before = tables

        // Seeded with the CDN entries already built, minus the learned ones,
        // which are appended again at the end from their own store.
        val portraitOut = ConcurrentHashMap<Int, List<FloatArray>>(strip(before.portraits, "p"))
        val iconOut = ConcurrentHashMap<Int, List<FloatArray>>(strip(before.icons, "i"))
        val corrupt = ConcurrentHashMap.newKeySet<Int>()

        val pool = Executors.newFixedThreadPool(FETCH_THREADS)
        try {
            for (id in roster) {
                pool.execute {
                    runCatching {
                        if (!portraitOut.containsKey(id)) {
                            when (val got = fetch(File(dir, "p$id.png"), PORTRAIT_URL, id)) {
                                is Fetched.Ok -> portraitOut[id] = DraftCore.variants(
                                    got.image,
                                    DraftLayout.PORTRAIT_ZOOMS,
                                    DraftLayout.PORTRAIT_FX,
                                    DraftLayout.PORTRAIT_FY,
                                )
                                Fetched.Corrupt -> corrupt += id
                                Fetched.Missing -> {}
                            }
                        }
                        if (!iconOut.containsKey(id)) {
                            when (val got = fetch(File(dir, "i$id.png"), ICON_URL, id)) {
                                is Fetched.Ok -> {
                                    val v = ArrayList<FloatArray>()
                                    for (bg in intArrayOf(DraftLayout.TEAM_BLUE, DraftLayout.TEAM_RED)) {
                                        v += DraftCore.variants(
                                            DraftLayout.over(got.image, bg),
                                            DraftLayout.ICON_ZOOMS,
                                            DraftLayout.ICON_FX,
                                            DraftLayout.ICON_FY,
                                            DraftLayout.ICON_N,
                                        )
                                    }
                                    iconOut[id] = v
                                }
                                Fetched.Corrupt -> corrupt += id
                                Fetched.Missing -> {}
                            }
                        }
                    }.onFailure { Log.w(TAG, "reference $id failed", it) }
                    val n = done.incrementAndGet()
                    progress = n * 100 / roster.size.coerceAtLeast(1)
                    onProgress(progress)
                }
            }
            pool.shutdown()
            pool.awaitTermination(PREPARE_TIMEOUT_MINUTES, TimeUnit.MINUTES)
        } finally {
            pool.shutdownNow()
        }

        /*
         * Published in one go, at the end.
         *
         * The tables are read by the scan thread, and a half-filled one is
         * exactly the bug this method used to have. Building into separate maps
         * and swapping them in once means `ready` and the contents change
         * together, so there is no window where the matcher can see part of a
         * roster and believe it is looking at all of it.
         */
        val learned = loadLearned()
        publish(
            Tables(
                portraits = merge(portraitOut, learned.portraits),
                icons = merge(iconOut, learned.icons),
                plates = loadPlates(),
            ),
        )
        preparedFor = roster
        coverage = Coverage(
            expected = roster.size,
            portraits = portraitOut.size,
            icons = iconOut.size,
            missingPortraits = roster.filter { !portraitOut.containsKey(it) },
            missingIcons = roster.filter { !iconOut.containsKey(it) },
            corrupt = corrupt.toList().sorted(),
        )
        progress = 100
        Log.i(TAG, "tables: ${portraitOut.size} portraits, ${iconOut.size} icons of ${roster.size}; corrupt ${corrupt.size}")
        if (!coverage.bansReady) {
            // Bans read this table and nothing else. Short is worth saying out
            // loud: it presents as the matcher failing on bans alone.
            Log.w(TAG, "icon table short (${iconOut.size}/${roster.size}) — bans will not match")
        }
    }

    private fun merge(
        base: Map<Int, List<FloatArray>>,
        learned: Map<Int, List<FloatArray>>,
    ): Map<Int, List<FloatArray>> {
        if (learned.isEmpty()) return HashMap(base)
        val out = HashMap<Int, List<FloatArray>>(base)
        for ((id, list) in learned) out[id] = (out[id] ?: emptyList()) + list
        return out
    }

    @Synchronized
    private fun publish(next: Tables) {
        tables = next
    }

    private sealed class Fetched {
        class Ok(val image: DraftCore.Image) : Fetched()
        /** The CDN has no such file; nothing to retry. */
        object Missing : Fetched()
        /** Downloaded, twice, and neither copy decodes. */
        object Corrupt : Fetched()
    }

    /**
     * One reference image, from the cache or the CDN.
     *
     * Decoded *before* it is trusted. A file that exists and is long enough
     * used to be accepted on those grounds alone, so a truncated download or a
     * CDN error page saved under a .png name sat in the cache being refused by
     * the decoder on every start, forever, and the id it stood for was simply
     * never matchable. Now a download lands in a temporary file, is decoded,
     * and only then takes the cache's name; a cached file that fails to decode
     * is deleted and fetched again, a bounded number of times.
     */
    private fun fetch(file: File, template: String, id: Int): Fetched {
        var attempts = 0
        while (true) {
            if (file.exists() && file.length() >= 300) {
                decode(file)?.let { return Fetched.Ok(it) }
                Log.w(TAG, "${file.name} does not decode; refetching")
                file.delete()
            }
            if (attempts++ >= DECODE_RETRIES) return Fetched.Corrupt
            val tmp = File(file.parentFile, file.name + ".part")
            try {
                val conn = (URL(String.format(template, id)).openConnection() as HttpURLConnection)
                    .apply {
                        connectTimeout = 8000
                        readTimeout = 8000
                        // The CDN refuses requests with no user agent.
                        setRequestProperty("User-Agent", "BrawlZone/${BuildConfig.VERSION_CODE}")
                    }
                if (conn.responseCode == 404) return Fetched.Missing
                conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            } catch (e: Throwable) {
                tmp.delete()
                return Fetched.Missing
            }
            val image = decode(tmp)
            if (image == null) {
                tmp.delete()
                continue
            }
            if (!tmp.renameTo(file)) {
                tmp.delete()
                return Fetched.Ok(image)
            }
            return Fetched.Ok(image)
        }
    }

    /**
     * Decodes cached art, preferring straight alpha but never depending on it.
     *
     * The ban icons are composited onto a team colour, so premultiplied alpha
     * darkens their edges twice — hence the request for straight alpha. But
     * `inPremultiplied = false` is a *hint*: some decoders refuse it and return
     * null, and a null here means the icon table never builds and every ban
     * silently comes back empty. Asking for the better decode and falling back
     * to the ordinary one costs a second attempt on the rare device that
     * refuses, and removes a way for this to fail completely.
     */
    private fun decode(file: File): DraftCore.Image? {
        val straight = BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
            inPremultiplied = false
        }
        val bitmap = runCatching { BitmapFactory.decodeFile(file.absolutePath, straight) }
            .getOrNull()
            ?: runCatching {
                BitmapFactory.decodeFile(
                    file.absolutePath,
                    BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 },
                )
            }.getOrNull()
            ?: return null
        if (bitmap.width < 8 || bitmap.height < 8) {
            bitmap.recycle()
            return null
        }

        val image = toImage(bitmap)
        bitmap.recycle()
        return image
    }

    /** The one place a platform Bitmap becomes something testable. */
    fun toImage(bitmap: Bitmap): DraftCore.Image {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        return DraftCore.Image(pixels, bitmap.width, bitmap.height)
    }

    // ---- reading a frame ----------------------------------------------------

    /** Whether the draft screen's own layout could be found in this frame. */
    fun located(frame: DraftCore.Image) = DraftLayout.locate(frame)

    /**
     * Reads one frame against the current snapshot.
     *
     * Returns null when the frame is not a draft screen — the layout could
     * not be verified — because a reading of unverified rectangles is worse
     * than none. The caller reports the layout's own reasons instead.
     */
    fun read(frame: DraftCore.Image): Reading? {
        val at = DraftLayout.locate(frame)
        if (!at.detected) return null
        val t = tables
        val c = coverage

        val bans = at.bans.map { rect ->
            if (!c.bansReady) {
                DraftCore.Match(null, 0f, 0f, DraftCore.Status.UNKNOWN, reason = "icons ${c.icons}/${c.expected}")
            } else {
                DraftCore.identify(
                    frame, rect, DraftLayout.BAN_QUERIES, t.icons,
                    DraftLayout.BAN_MIN_SCORE, DraftLayout.BAN_MIN_MARGIN, DraftLayout.ICON_N,
                )
            }
        }
        val allies = at.allies.map { card(frame, it, t) }
        val enemies = at.enemies.map { card(frame, it, t) }
        return Reading(
            layout = at,
            self = DraftLayout.selfIndex(frame, at),
            mode = recall(frame, at.plateMode, PLATE_MODE_KEY, t),
            map = recall(frame, at.plateMap, PLATE_MAP_KEY, t),
            bans = bans,
            allies = allies,
            enemies = enemies,
        )
    }

    private fun card(frame: DraftCore.Image, rect: DraftCore.Rect, t: Tables): DraftCore.Match =
        DraftCore.identify(
            frame, rect, DraftLayout.CARD_QUERIES, t.portraits,
            DraftLayout.CARD_MIN_SCORE, DraftLayout.CARD_MIN_MARGIN,
        )

    // ---- the mode plate -----------------------------------------------------

    private fun recall(frame: DraftCore.Image, r: DraftCore.Rect, kind: String, t: Tables): String? {
        val table = t.plates[kind] ?: return null
        if (table.isEmpty()) return null
        if (r.width < 8 || r.height < 6) return null
        if (DraftCore.detail(frame, r) < DraftCore.MIN_DETAIL) return null

        val q = DraftCore.describe(frame, r)
        var bestName: String? = null
        var best = -2f
        var second = -2f
        for ((name, d) in table) {
            val v = DraftCore.score(q, d)
            if (v > best) { second = best; best = v; bestName = name } else if (v > second) second = v
        }
        val clear = table.size == 1 || (best - second) >= DraftLayout.PLATE_MIN_MARGIN
        return if (best >= DraftLayout.PLATE_MIN_SCORE && clear) bestName else null
    }

    /**
     * Files the plate in `frame` under the names the page confirmed.
     *
     * Only when the plate was found on its own colour: a plate positioned by
     * guesswork is the wrong pixels filed under the right name, and a learned
     * descriptor matches confidently by construction.
     */
    @Synchronized
    fun learnPlate(frame: DraftCore.Image, modeKey: String?, mapName: String?): Boolean {
        val at = DraftLayout.locate(frame)
        if (!at.detected || !at.plateFound) return false
        var any = false
        val plates = HashMap<String, HashMap<String, FloatArray>>()
        for ((k, v) in tables.plates) plates[k] = HashMap(v)
        if (modeKey != null && storePlate(frame, at.plateMode, PLATE_MODE_KEY, modeKey, plates)) any = true
        if (mapName != null && storePlate(frame, at.plateMap, PLATE_MAP_KEY, mapName, plates)) any = true
        if (any) publish(Tables(tables.portraits, tables.icons, plates))
        return any
    }

    private fun storePlate(
        frame: DraftCore.Image,
        r: DraftCore.Rect,
        kind: String,
        name: String,
        into: HashMap<String, HashMap<String, FloatArray>>,
    ): Boolean {
        if (r.width < 8 || r.height < 6) return false
        if (DraftCore.detail(frame, r) < DraftCore.MIN_DETAIL) return false
        val d = DraftCore.describe(frame, r)
        into.getOrPut(kind) { HashMap() }[name] = d
        prefs().edit().putString("$PLATE_PREFIX$kind.$name", encode(d)).apply()
        return true
    }

    private fun loadPlates(): Map<String, Map<String, FloatArray>> {
        val out = HashMap<String, HashMap<String, FloatArray>>()
        for ((key, value) in prefs().all) {
            if (!key.startsWith(PLATE_PREFIX)) continue
            val rest = key.removePrefix(PLATE_PREFIX)
            val split = rest.indexOf('.')
            if (split <= 0) continue
            val d = decodeDescriptor(value as? String ?: continue) ?: continue
            out.getOrPut(rest.substring(0, split)) { HashMap() }[rest.substring(split + 1)] = d
        }
        return out
    }

    // ---- learning from corrections -----------------------------------------

    /**
     * Remembers what was on screen when the reader fixed a slot.
     *
     * A learned descriptor is this phone's own pixels at the real size, so it
     * beats a CDN render every time — which means the cold start is the worst
     * this ever performs.
     *
     * The sample is refused when it cannot be right: the layout was not
     * verified, or the slot was under the panel. Learning the panel's pixels
     * as a brawler is how a correction could make every later scan worse.
     * Returns what was stored, or null with the reason logged.
     */
    @Synchronized
    fun learn(
        frame: DraftCore.Image,
        kind: String,
        index: Int,
        brawlerId: Int,
        scanId: Long,
    ): Boolean {
        val bans = kind == "bans"
        val at = DraftLayout.locate(frame)
        if (!at.detected) {
            Log.w(TAG, "learn refused: layout not verified (${at.reasons})")
            return false
        }
        val r = when (kind) {
            "bans" -> at.bans.getOrNull(index) ?: return false
            "allies" -> at.allies.getOrNull(index) ?: return false
            "enemies" -> at.enemies.getOrNull(index) ?: return false
            else -> return false
        }
        if (DraftCore.darkFraction(frame, r) >= DraftCore.OCCLUDED_MIN_DARK) {
            Log.w(TAG, "learn refused: $kind[$index] is occluded")
            return false
        }
        if (DraftCore.detail(frame, r) < DraftCore.MIN_DETAIL) {
            Log.w(TAG, "learn refused: $kind[$index] is flat")
            return false
        }
        if (DraftCore.saturatedFraction(frame, r) < DraftCore.EMPTY_MAX_SATURATED) {
            Log.w(TAG, "learn refused: $kind[$index] looks like the empty placeholder")
            return false
        }

        val queries = if (bans) DraftLayout.BAN_QUERIES else DraftLayout.CARD_QUERIES
        val n = if (bans) DraftLayout.ICON_N else DraftCore.N
        val d = DraftCore.describe(frame, DraftCore.crop(r, queries[0]), n)

        val current = tables
        val source = if (bans) current.icons else current.portraits
        val next = HashMap(source)
        val base = if (bans) DraftLayout.ICON_ZOOMS.size * DraftLayout.ICON_FX.size * DraftLayout.ICON_FY.size * 2
        else DraftLayout.PORTRAIT_ZOOMS.size * DraftLayout.PORTRAIT_FX.size * DraftLayout.PORTRAIT_FY.size
        val list = ArrayList(next[brawlerId] ?: emptyList())
        list.add(d)
        while (list.size > base + MAX_LEARNED) list.removeAt(base)
        next[brawlerId] = list
        publish(
            if (bans) Tables(current.portraits, next, current.plates)
            else Tables(next, current.icons, current.plates),
        )
        saveLearned(if (bans) "i" else "p", brawlerId, d, kind, index, scanId)
        return true
    }

    /** Forgets every correction. The CDN tables are untouched. */
    @Synchronized
    fun resetLearned(): Int {
        val editor = prefs().edit()
        var n = 0
        for (key in prefs().all.keys) {
            if (key.startsWith("learned.") || key.startsWith("plate.")) {
                editor.remove(key)
                n++
            }
        }
        editor.apply()
        // Rebuild without the learned entries: the CDN tables are what remain.
        val t = tables
        publish(Tables(strip(t.portraits, "p"), strip(t.icons, "i"), emptyMap()))
        return n
    }

    /** Drops the trailing learned entries from every list. */
    private fun strip(table: Map<Int, List<FloatArray>>, kind: String): Map<Int, List<FloatArray>> {
        val base = if (kind == "i") DraftLayout.ICON_ZOOMS.size * DraftLayout.ICON_FX.size * DraftLayout.ICON_FY.size * 2
        else DraftLayout.PORTRAIT_ZOOMS.size * DraftLayout.PORTRAIT_FX.size * DraftLayout.PORTRAIT_FY.size
        val out = HashMap<Int, List<FloatArray>>()
        for ((id, list) in table) {
            val kept = list.take(base)
            if (kept.isNotEmpty()) out[id] = kept
        }
        return out
    }

    /**
     * One learned sample: the descriptor plus where it came from, so a bad
     * one can be traced to the scan that produced it and the store can be
     * reasoned about later rather than only wiped.
     */
    private fun saveLearned(kind: String, brawlerId: Int, d: FloatArray, slot: String, index: Int, scanId: Long) {
        val key = "$LEARNED_PREFIX$kind.$brawlerId"
        val existing = prefs().getStringSet(key, null)?.toMutableList() ?: ArrayList()
        val entry = JSONObject()
            .put("d", encode(d))
            .put("slot", slot)
            .put("index", index)
            .put("scan", scanId)
            .put("at", System.currentTimeMillis())
            .toString()
        existing.add(entry)
        while (existing.size > MAX_LEARNED) existing.removeAt(0)
        prefs().edit().putStringSet(key, LinkedHashSet(existing)).apply()
    }

    private class Learned(
        val portraits: Map<Int, List<FloatArray>>,
        val icons: Map<Int, List<FloatArray>>,
    )

    private fun loadLearned(): Learned {
        val portraits = HashMap<Int, MutableList<FloatArray>>()
        val icons = HashMap<Int, MutableList<FloatArray>>()
        val stale = ArrayList<String>()
        for ((key, value) in prefs().all) {
            // Anything from an earlier format describes the old geometry.
            if ((key.startsWith("learned.") && !key.startsWith(LEARNED_PREFIX)) ||
                (key.startsWith("plate.") && !key.startsWith(PLATE_PREFIX))
            ) {
                stale += key
                continue
            }
            if (!key.startsWith(LEARNED_PREFIX)) continue
            val rest = key.removePrefix(LEARNED_PREFIX)
            val kind = rest.substringBefore('.')
            val id = rest.substringAfter('.').toIntOrNull() ?: continue
            @Suppress("UNCHECKED_CAST")
            val blobs = value as? Set<String> ?: continue
            val table = if (kind == "i") icons else portraits
            val list = table.getOrPut(id) { ArrayList() }
            for (blob in blobs) {
                val d = runCatching { JSONObject(blob).getString("d") }.getOrNull()
                    ?.let { decodeDescriptor(it) } ?: continue
                list.add(d)
            }
        }
        if (stale.isNotEmpty()) {
            Log.i(TAG, "dropping ${stale.size} learned entries from an older format")
            prefs().edit().apply { for (k in stale) remove(k) }.apply()
        }
        return Learned(portraits, icons)
    }

    /** How many corrections are stored, for diagnostics. */
    fun learnedCount(): Int = prefs().all.keys.count { it.startsWith(LEARNED_PREFIX) || it.startsWith(PLATE_PREFIX) }

    // ---- storage ------------------------------------------------------------

    private fun prefs() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Descriptors are quantised to bytes before storage. A float array of 768
     * entries is a quarter of a megabyte of text in shared preferences; the
     * same thing at a byte a value is under a kilobyte and agrees to three
     * decimal places, which is inside the margin any of this is decided by.
     */
    private fun encode(d: FloatArray): String {
        val bytes = ByteArray(d.size)
        for (i in d.indices) bytes[i] = (d[i] * 32f).coerceIn(-127f, 127f).roundToInt().toByte()
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun decodeDescriptor(blob: String): FloatArray? {
        val bytes = try {
            Base64.decode(blob, Base64.NO_WRAP)
        } catch (e: Throwable) {
            return null
        }
        if (bytes.size != DraftCore.N * DraftCore.N * 3) return null
        return FloatArray(bytes.size) { bytes[it] / 32f }
    }
}
