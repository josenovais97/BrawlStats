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
 * comes back empty, because a draft board quietly holding the wrong brawler is
 * worse than one holding nothing.
 */
class DraftVision(private val context: Context) {

    data class Slot(val brawlerId: Int?, val score: Float)

    data class Reading(
        /** A mode key the reader has confirmed before, or null. */
        val mode: String?,
        /** A map name the reader has confirmed before, or null. */
        val map: String?,
        val bans: List<Slot>,
        val allies: List<Slot>,
        val enemies: List<Slot>,
    )

    companion object {
        /*
         * The layout, the crops and the thresholds all live in DraftLayout,
         * in the `core` module, because they are the recognition rather than
         * the plumbing — and because that is where they can be tested against
         * real captures. What is left here is only what needs a device.
         */
        const val PLATE_MODE_KEY = "mode"
        const val PLATE_MAP_KEY = "map"

        private const val TAG = "BrawlZoneScan"
        private const val PREFS = "brawlzone.vision"
        private const val PORTRAIT_URL = "https://cdn.brawlify.com/brawlers/borderless/%d.png"
        private const val ICON_URL = "https://cdn.brawlify.com/brawlers/emoji/%d.png"
        private const val MAX_LEARNED = 3

        /** Enough to saturate a phone's link without hammering the CDN. */
        private const val FETCH_THREADS = 8
        private const val PREPARE_TIMEOUT_MINUTES = 3L

        /** The CDN is missing art for a brawler or two at any given time. */
        private const val MISSING_ALLOWANCE = 4
    }

    /** brawler id -> portrait descriptors, for the player cards. */
    private val portraits = HashMap<Int, MutableList<FloatArray>>()

    /** brawler id -> emoji descriptors, for the ban icons. */
    private val icons = HashMap<Int, MutableList<FloatArray>>()

    /** Plates the reader has confirmed, by kind then by name. */
    private val plates = HashMap<String, HashMap<String, FloatArray>>()

    /**
     * Whether the tables are complete enough to scan against.
     *
     * "Complete", not "started". This used to be `portraits.isNotEmpty()`,
     * which goes true the moment the *first* of two hundred and fourteen
     * downloads lands — so a scan a second later ran against a table holding
     * one brawler and confidently found nothing, or found the wrong thing
     * because the right one had not arrived yet. That is indistinguishable from
     * a matcher that does not work, and it is what a reader saw as recognition
     * being unreliable.
     *
     * A small shortfall is tolerated because the CDN is missing art for a
     * couple of brawlers at any time and waiting for them would mean never
     * being ready. Missing *most* of the roster is a different thing and is not
     * something to scan against.
     */
    val ready: Boolean
        get() = expected > 0 &&
            portraits.size >= expected - MISSING_ALLOWANCE &&
            icons.size >= expected - MISSING_ALLOWANCE

    /** Table sizes, for the panel's diagnostics. Bans read the second one. */
    val portraitCount: Int get() = portraits.size
    val iconCount: Int get() = icons.size
    val expectedCount: Int get() = expected

    /** How far through building the tables, 0..100, for the panel to show. */
    @Volatile
    var progress: Int = 0
        private set

    private var expected = 0

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
     */
    fun prepare(ids: List<Int>, onProgress: (Int) -> Unit = {}) {
        val dir = File(context.filesDir, "art").apply { mkdirs() }
        expected = ids.size
        val done = java.util.concurrent.atomic.AtomicInteger(0)

        val portraitOut = ConcurrentHashMap<Int, MutableList<FloatArray>>()
        val iconOut = ConcurrentHashMap<Int, MutableList<FloatArray>>()

        val pool = Executors.newFixedThreadPool(FETCH_THREADS)
        try {
            for (id in ids) {
                pool.execute {
                    runCatching {
                        if (!portraits.containsKey(id)) {
                            fetch(File(dir, "p$id.png"), PORTRAIT_URL, id)?.let { image ->
                                portraitOut[id] = DraftCore.variants(
                                    image,
                                    DraftLayout.PORTRAIT_ZOOMS,
                                    DraftLayout.PORTRAIT_FX,
                                    DraftLayout.PORTRAIT_FY,
                                ).toMutableList()
                            }
                        }
                        if (!icons.containsKey(id)) {
                            fetch(File(dir, "i$id.png"), ICON_URL, id)?.let { image ->
                                val v = ArrayList<FloatArray>()
                                for (bg in intArrayOf(DraftLayout.TEAM_BLUE, DraftLayout.TEAM_RED)) {
                                    v += DraftCore.variants(
                                        DraftLayout.over(image, bg),
                                        DraftLayout.ICON_ZOOMS,
                                        DraftLayout.ICON_FX,
                                        DraftLayout.ICON_FY,
                                        DraftLayout.ICON_N,
                                    )
                                }
                                iconOut[id] = v
                            }
                        }
                    }
                    val n = done.incrementAndGet()
                    progress = n * 100 / ids.size.coerceAtLeast(1)
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
        portraits.putAll(portraitOut)
        icons.putAll(iconOut)

        loadLearned()
        loadPlates()
        progress = 100
        Log.i(TAG, "tables: ${portraits.size} portraits, ${icons.size} icons of ${ids.size}")
        if (icons.size < ids.size - MISSING_ALLOWANCE) {
            // Bans read this table and nothing else. Short is worth saying out
            // loud: it presents as the matcher failing on bans alone.
            Log.w(TAG, "icon table short — bans will not match")
        }
    }

    /** Replaces transparency with a flat colour. See DraftLayout.TEAM_BLUE. */
    private fun fetch(file: File, template: String, id: Int): DraftCore.Image? {
        if (!file.exists() || file.length() < 300) {
            try {
                val conn = (URL(String.format(template, id)).openConnection() as HttpURLConnection)
                    .apply {
                        connectTimeout = 8000
                        readTimeout = 8000
                        // The CDN refuses requests with no user agent.
                        setRequestProperty("User-Agent", "BrawlZone/${BuildConfig.VERSION_CODE}")
                    }
                conn.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
            } catch (e: Throwable) {
                file.delete()
                return null
            }
        }
        return decode(file)
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
                Log.w(TAG, "straight-alpha decode refused for ${file.name}; using default")
                BitmapFactory.decodeFile(
                    file.absolutePath,
                    BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 },
                )
            }.getOrNull()
            ?: return null

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

    fun plateRect(frame: DraftCore.Image) = DraftLayout.locate(frame).plateText

    /** Whether the draft screen's own layout could be found in this frame. */
    fun located(frame: DraftCore.Image) = DraftLayout.locate(frame)

    fun read(frame: DraftCore.Image): Reading {
        /*
         * The layout is found in the frame, not assumed from its size.
         *
         * Regions written as fractions of the whole frame are only right at the
         * aspect ratio they were measured on, and a capture at another shape
         * read the match timer where the map name is. Everything is now
         * measured against the team strip, whose height is the game's own unit
         * of scale — so it holds at any resolution and any aspect.
         */
        val at = DraftLayout.locate(frame)

        val bans = at.bans.map { rect ->
            match(
                frame, rect, DraftLayout.BAN_QUERIES, icons,
                DraftLayout.BAN_MIN_SCORE, DraftLayout.BAN_MIN_MARGIN, DraftLayout.ICON_N,
            )
        }
        val allies = at.allies.map { card(frame, it) }
        val enemies = at.enemies.map { card(frame, it) }
        return Reading(
            recall(frame, at.plateMode, PLATE_MODE_KEY),
            recall(frame, at.plateMap, PLATE_MAP_KEY),
            bans,
            allies,
            enemies,
        )
    }

    private fun card(frame: DraftCore.Image, rect: DraftCore.Rect): Slot = match(
        frame, rect, DraftLayout.CARD_QUERIES, portraits,
        DraftLayout.CARD_MIN_SCORE, DraftLayout.CARD_MIN_MARGIN,
    )

    private fun match(
        frame: DraftCore.Image,
        rect: DraftCore.Rect,
        queries: Array<DraftCore.Crop>,
        table: Map<Int, List<FloatArray>>,
        minScore: Float,
        minMargin: Float,
        n: Int = DraftCore.N,
    ): Slot {
        if (table.isEmpty()) return Slot(null, 0f)
        val m = DraftCore.identify(frame, rect, queries, table, minScore, minMargin, n)
        return Slot(m.id, m.best)
    }

    // ---- the mode plate -----------------------------------------------------

    private fun recall(frame: DraftCore.Image, r: DraftCore.Rect, kind: String): String? {
        val table = plates[kind] ?: return null
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

    fun learnPlate(frame: DraftCore.Image, modeKey: String?, mapName: String?) {
        val at = DraftLayout.locate(frame)
        if (modeKey != null) storePlate(frame, at.plateMode, PLATE_MODE_KEY, modeKey)
        if (mapName != null) storePlate(frame, at.plateMap, PLATE_MAP_KEY, mapName)
    }

    private fun storePlate(frame: DraftCore.Image, r: DraftCore.Rect, kind: String, name: String) {
        if (r.width < 8 || r.height < 6) return
        if (DraftCore.detail(frame, r) < DraftCore.MIN_DETAIL) return
        val d = DraftCore.describe(frame, r)
        plates.getOrPut(kind) { HashMap() }[name] = d
        prefs().edit().putString("plate.$kind.$name", encode(d)).apply()
    }

    private fun loadPlates() {
        for ((key, value) in prefs().all) {
            if (!key.startsWith("plate.")) continue
            val rest = key.removePrefix("plate.")
            val split = rest.indexOf('.')
            if (split <= 0) continue
            val d = decodeDescriptor(value as? String ?: continue) ?: continue
            plates.getOrPut(rest.substring(0, split)) { HashMap() }[rest.substring(split + 1)] = d
        }
    }

    // ---- learning from corrections -----------------------------------------

    /**
     * Remembers what was on screen when the reader fixed a slot.
     *
     * A learned descriptor is this phone's own pixels at the real size, so it
     * beats a CDN render every time — which means the cold start is the worst
     * this ever performs.
     */
    fun learn(frame: DraftCore.Image, kind: String, index: Int, brawlerId: Int) {
        val bans = kind == "bans"
        val at = DraftLayout.locate(frame)
        val r = when (kind) {
            "bans" -> at.bans.getOrNull(index) ?: return
            "allies" -> at.allies.getOrNull(index) ?: return
            "enemies" -> at.enemies.getOrNull(index) ?: return
            else -> return
        }
        if (DraftCore.detail(frame, r) < DraftCore.MIN_DETAIL) return

        val queries = if (bans) DraftLayout.BAN_QUERIES else DraftLayout.CARD_QUERIES
        val n = if (bans) DraftLayout.ICON_N else DraftCore.N
        val d = DraftCore.describe(frame, DraftCore.crop(r, queries[0]), n)
        val table = if (bans) icons else portraits
        val list = table.getOrPut(brawlerId) { ArrayList() }
        list.add(d)
        val base = if (bans) DraftLayout.ICON_ZOOMS.size * DraftLayout.ICON_FX.size * DraftLayout.ICON_FY.size * 2
        else DraftLayout.PORTRAIT_ZOOMS.size * DraftLayout.PORTRAIT_FX.size * DraftLayout.PORTRAIT_FY.size
        while (list.size > base + MAX_LEARNED) list.removeAt(base)
        saveLearned(if (bans) "i" else "p", brawlerId, d)
    }

    private fun saveLearned(kind: String, brawlerId: Int, d: FloatArray) {
        val key = "learned.$kind.$brawlerId"
        val existing = prefs().getStringSet(key, null)?.toMutableSet() ?: LinkedHashSet()
        existing.add(encode(d))
        while (existing.size > MAX_LEARNED) existing.remove(existing.first())
        prefs().edit().putStringSet(key, existing).apply()
    }

    private fun loadLearned() {
        for ((key, value) in prefs().all) {
            if (!key.startsWith("learned.")) continue
            val rest = key.removePrefix("learned.")
            val kind = rest.substringBefore('.')
            val id = rest.substringAfter('.').toIntOrNull() ?: continue
            @Suppress("UNCHECKED_CAST")
            val blobs = value as? Set<String> ?: continue
            val table = if (kind == "i") icons else portraits
            val list = table.getOrPut(id) { ArrayList() }
            for (blob in blobs) list.add(decodeDescriptor(blob) ?: continue)
        }
    }

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
