package net.brawlzone.bubble

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Reading a Brawl Stars draft screen.
 *
 * Two different jobs, and they are not equally hard. The mode and the map are
 * *printed* on the screen as text, so those are OCR and they are close to free.
 * The brawlers are only ever pictures, so those are template matching against
 * the game's own art — which works, but not uniformly, and the difference
 * matters enough that the two are reported separately.
 *
 * Everything here is measured rather than assumed. The regions below came off
 * four real captures at 1560x720 and are stored as fractions of the frame,
 * because the game lays its draft screen out proportionally: the ban strip is
 * always the same fraction down the screen whatever the device is. That is a
 * reasonable belief, not a verified one — it has been checked on one phone —
 * so every region is also allowed to come back empty rather than wrong.
 *
 * The confidence gate is the whole design. A draft helper that fills a slot
 * with the wrong brawler is worse than one that leaves it blank: blank is one
 * tap to fix and obviously unfinished, whereas wrong is silently plausible and
 * changes the advice underneath it. So a match is only reported when it beats
 * the runner-up by a clear margin, and everything else is left for the reader.
 * On the sample captures that gate accepted six brawlers and got none wrong.
 *
 * And it learns. When the reader corrects a slot, the descriptor that was
 * actually on screen is stored against the brawler they chose — the exact crop,
 * from the real UI, at the real size. Those beat the downloaded art every time,
 * so the cold start is the worst this ever performs.
 */
class DraftVision(private val context: Context) {

    /** A rectangle as fractions of the captured frame. */
    data class Region(val x: Float, val y: Float, val w: Float, val h: Float)

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

    /**
     * Where things are, as fractions of a landscape frame.
     *
     * Measured on 1560x720 captures of the ban screen and three stages of the
     * pick screen. The bottom strip is what gets read, never the roster grid
     * above it: the grid scrolls horizontally and shows about fourteen of
     * ninety brawlers, so a pick on anything scrolled off-screen simply has no
     * marker to find. The strip always shows all six bans and all six picks.
     */
    companion object {
        /**
         * The two lines of the mode plate, top left.
         *
         * Split rather than read as one box, because they are worth different
         * amounts. There are eight Ranked modes and twenty-odd maps, so the
         * mode line is learned eight times and then always known — which means
         * even a map the reader has never scanned before arrives with its mode
         * already selected and two or three maps to choose between instead of
         * twenty.
         *
         * Both crops run to the plate's right edge. Map names differ in length
         * and the text is left-aligned, so a crop sized to the name would be a
         * different crop per map; a fixed one is the same pixels every time,
         * which is the entire requirement for matching a picture to itself.
         */
        val PLATE_MODE = Region(0.1006f, 0.0306f, 0.1654f, 0.0500f)
        val PLATE_MAP = Region(0.1006f, 0.0833f, 0.1654f, 0.0389f)

        /** Ban portraits: three down each flank of the team strip. */
        val BAN_X = floatArrayOf(0.1500f, 0.8641f)
        const val BAN_Y = 0.7222f
        const val BAN_PITCH = 0.0833f
        const val BAN_SIZE_X = 0.0308f
        const val BAN_SIZE_Y = 0.0667f

        /** Player cards: three a side, art above the name. */
        val ALLY_X = floatArrayOf(0.2205f, 0.3205f, 0.4205f)
        val ENEMY_X = floatArrayOf(0.5744f, 0.6609f, 0.7500f)
        const val CARD_Y = 0.7375f
        const val CARD_W = 0.0801f
        const val CARD_H = 0.1486f

        /** Descriptor side. 32 is where accuracy stopped improving. */
        const val N = 32

        /*
         * Query crops.
         *
         * A card is not matched whole: the level badge sits over its top-left
         * corner and a tick or a skull over the others, so the crop is pulled
         * down and right of centre, away from all three. These numbers are the
         * ones that scored 0.88 on a known card against a 0.23 runner-up; a
         * wider search was tried and made things *worse*, because searching a
         * large space over ninety candidates finds coincidences.
         */
        val CARD_ZOOMS = floatArrayOf(0.60f, 0.65f, 0.70f, 0.75f)
        const val CARD_FX = 0.55f
        const val CARD_FY = 0.65f

        /** A ban icon is already a tight head crop, so it is matched nearly whole. */
        val BAN_ZOOMS = floatArrayOf(1.0f, 0.85f)
        const val BAN_FX = 0.5f
        const val BAN_FY = 0.5f

        /** Reference zooms, because the downloaded art is not framed uniformly. */
        val REF_ZOOMS = floatArrayOf(1.0f, 0.85f, 0.72f)

        /** Accept a match only this far clear of the field. */
        const val MIN_SCORE = 0.40f
        const val MIN_MARGIN = 0.10f

        /** A learned crop is the same UI at the same size, so it should score high. */
        const val MIN_SCORE_LEARNED = 0.55f

        /**
         * Below this much variation a region is the empty "?" placeholder.
         *
         * An unpicked card is a flat dark rectangle with a grey silhouette. It
         * correlates weakly with everything, so the gate would reject it anyway
         * — but naming it means an empty slot reads as "nobody has picked yet"
         * rather than "we could not tell", which is a different message.
         */
        const val MIN_DETAIL = 14.0

        /** Prefix under which a learned mode / map plate is filed. */
        const val PLATE_MODE_KEY = "mode"
        const val PLATE_MAP_KEY = "map"

        /**
         * A plate is text rendered by the game at a fixed size, so a true match
         * is the same pixels twice and scores near one. The bar is high on
         * purpose: two map names of similar length on the same lilac ground
         * correlate well just by being text, and a *wrong* map silently changes
         * every number underneath it.
         */
        const val MIN_PLATE_SCORE = 0.86f
        const val MIN_PLATE_MARGIN = 0.05f

        private const val TAG = "BrawlZoneScan"
        private const val PREFS = "brawlzone.vision"
        private const val ART = "https://cdn.brawlify.com/brawlers/borderless/%d.png"
    }

    /** brawler id -> descriptors: downloaded art first, learned crops appended. */
    private val refs = HashMap<Int, MutableList<FloatArray>>()
    private var rosterIds: List<Int> = emptyList()

    val ready: Boolean get() = refs.isNotEmpty()

    // ---- reference table ----------------------------------------------------

    /**
     * Builds the table from the roster the panel already knows about.
     *
     * The ids come from the page rather than being compiled in, so a brawler
     * released next month is matchable the day the site knows about it without
     * shipping an APK. The art is cached on disk after the first run; the
     * download is about a megabyte and a half, once.
     */
    fun prepare(ids: List<Int>) {
        rosterIds = ids
        val dir = File(context.filesDir, "art").apply { mkdirs() }
        for (id in ids) {
            if (refs.containsKey(id)) continue
            val file = File(dir, "$id.png")
            val bitmap = readArt(file, id) ?: continue
            val variants = ArrayList<FloatArray>(REF_ZOOMS.size)
            for (z in REF_ZOOMS) variants.add(describe(bitmap, centred(bitmap, z)))
            refs[id] = variants
            bitmap.recycle()
        }
        loadLearned()
        loadPlates()
        Log.i(TAG, "reference table ready: ${refs.size} brawlers, ${plates.values.sumOf { it.size }} plates")
    }

    private fun readArt(file: File, id: Int): Bitmap? {
        if (!file.exists() || file.length() < 500) {
            try {
                val url = URL(String.format(ART, id))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 8000
                    // The CDN refuses requests with no user agent.
                    setRequestProperty("User-Agent", "BrawlZone/${BuildConfig.VERSION_CODE}")
                }
                conn.inputStream.use { input ->
                    file.outputStream().use { output -> input.copyTo(output) }
                }
            } catch (e: Throwable) {
                Log.w(TAG, "art $id unavailable", e)
                file.delete()
                return null
            }
        }
        return try {
            BitmapFactory.decodeFile(file.absolutePath)
        } catch (e: Throwable) {
            null
        }
    }

    private fun centred(bitmap: Bitmap, zoom: Float): android.graphics.Rect {
        val side = (min(bitmap.width, bitmap.height) * zoom).roundToInt()
        val cx = bitmap.width / 2
        val cy = bitmap.height / 2
        return android.graphics.Rect(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)
    }

    // ---- descriptors --------------------------------------------------------

    /**
     * A 32x32 colour descriptor, mean-removed and scaled to unit variation.
     *
     * Normalising is what makes the score a correlation rather than a
     * brightness comparison: the same brawler over a blue team panel and over a
     * red one differs by a constant the subtraction removes, and the game's own
     * gradients differ by a factor the division removes. Without it every match
     * is decided by the team colour, which is the one thing in the frame that
     * says nothing about which brawler it is.
     */
    private fun describe(source: Bitmap, rect: android.graphics.Rect): FloatArray {
        val w = max(1, rect.width())
        val h = max(1, rect.height())
        val x0 = rect.left.coerceIn(0, source.width - 1)
        val y0 = rect.top.coerceIn(0, source.height - 1)
        val cw = min(w, source.width - x0)
        val ch = min(h, source.height - y0)

        val crop = Bitmap.createBitmap(source, x0, y0, max(1, cw), max(1, ch))
        val small = Bitmap.createScaledBitmap(crop, N, N, true)
        if (crop !== source) crop.recycle()

        val pixels = IntArray(N * N)
        small.getPixels(pixels, 0, N, 0, 0, N, N)
        small.recycle()

        val out = FloatArray(N * N * 3)
        var i = 0
        var sumR = 0.0
        var sumG = 0.0
        var sumB = 0.0
        for (p in pixels) {
            val r = ((p shr 16) and 0xFF).toFloat()
            val g = ((p shr 8) and 0xFF).toFloat()
            val b = (p and 0xFF).toFloat()
            out[i++] = r; out[i++] = g; out[i++] = b
            sumR += r; sumG += g; sumB += b
        }
        val n = pixels.size
        val mr = (sumR / n).toFloat()
        val mg = (sumG / n).toFloat()
        val mb = (sumB / n).toFloat()
        var sq = 0.0
        i = 0
        while (i < out.size) {
            out[i] -= mr; out[i + 1] -= mg; out[i + 2] -= mb
            sq += out[i] * out[i] + out[i + 1] * out[i + 1] + out[i + 2] * out[i + 2]
            i += 3
        }
        val sd = Math.sqrt(sq / out.size).toFloat()
        if (sd > 1e-4f) for (k in out.indices) out[k] /= sd
        return out
    }

    /** How much variation a descriptor has before normalising, i.e. is it blank. */
    private fun detail(source: Bitmap, rect: android.graphics.Rect): Double {
        val x0 = rect.left.coerceIn(0, source.width - 1)
        val y0 = rect.top.coerceIn(0, source.height - 1)
        val cw = min(rect.width(), source.width - x0).coerceAtLeast(1)
        val ch = min(rect.height(), source.height - y0).coerceAtLeast(1)
        val crop = Bitmap.createBitmap(source, x0, y0, cw, ch)
        val small = Bitmap.createScaledBitmap(crop, 16, 16, true)
        crop.recycle()
        val px = IntArray(256)
        small.getPixels(px, 0, 16, 0, 0, 16, 16)
        small.recycle()
        var sum = 0.0
        var sq = 0.0
        for (p in px) {
            val v = (((p shr 16) and 0xFF) + ((p shr 8) and 0xFF) + (p and 0xFF)) / 3.0
            sum += v; sq += v * v
        }
        val mean = sum / px.size
        return Math.sqrt(max(0.0, sq / px.size - mean * mean))
    }

    private fun score(a: FloatArray, b: FloatArray): Float {
        var s = 0.0
        for (i in a.indices) s += a[i] * b[i]
        return (s / a.size).toFloat()
    }

    // ---- reading a frame ----------------------------------------------------

    private fun rect(frame: Bitmap, r: Region) = android.graphics.Rect(
        (r.x * frame.width).roundToInt(),
        (r.y * frame.height).roundToInt(),
        ((r.x + r.w) * frame.width).roundToInt(),
        ((r.y + r.h) * frame.height).roundToInt(),
    )

    /**
     * Reads the six bans and the six picks. Text is handled by the caller,
     * because OCR is asynchronous and this is not.
     */
    fun read(frame: Bitmap): Reading {
        val bans = ArrayList<Slot>(6)
        for (side in BAN_X) {
            for (i in 0 until 3) {
                val r = Region(side, BAN_Y + i * BAN_PITCH, BAN_SIZE_X, BAN_SIZE_Y)
                bans.add(identify(frame, rect(frame, r), BAN_ZOOMS, BAN_FX, BAN_FY))
            }
        }
        val allies = ALLY_X.map { x ->
            identify(frame, rect(frame, Region(x, CARD_Y, CARD_W, CARD_H)), CARD_ZOOMS, CARD_FX, CARD_FY)
        }
        val enemies = ENEMY_X.map { x ->
            identify(frame, rect(frame, Region(x, CARD_Y, CARD_W, CARD_H)), CARD_ZOOMS, CARD_FX, CARD_FY)
        }
        return Reading(
            recall(frame, PLATE_MODE, PLATE_MODE_KEY),
            recall(frame, PLATE_MAP, PLATE_MAP_KEY),
            bans,
            allies,
            enemies,
        )
    }

    /**
     * One region against the whole roster.
     *
     * The runner-up is what decides this, not the winner. A best score of 0.45
     * means nothing on its own — some brawler always comes top of ninety — but
     * 0.45 against a second place of 0.30 is a different claim from 0.45
     * against 0.44, and only the first is worth putting on the board.
     */
    private fun identify(
        frame: Bitmap,
        region: android.graphics.Rect,
        zooms: FloatArray,
        fx: Float,
        fy: Float,
    ): Slot {
        if (region.width() < 8 || region.height() < 8) return Slot(null, 0f)
        if (detail(frame, region) < MIN_DETAIL) return Slot(null, 0f)

        val queries = ArrayList<FloatArray>(zooms.size)
        for (z in zooms) queries.add(describe(frame, crop(region, z, fx, fy)))

        var bestId = -1
        var best = -2f
        var second = -2f
        var bestLearned = false
        for ((id, variants) in refs) {
            var s = -2f
            var learned = false
            for ((index, v) in variants.withIndex()) {
                val value = queries.maxOf { score(it, v) }
                if (value > s) {
                    s = value
                    learned = index >= REF_ZOOMS.size
                }
            }
            if (s > best) {
                second = best; best = s; bestId = id; bestLearned = learned
            } else if (s > second) {
                second = s
            }
        }
        val floor = if (bestLearned) MIN_SCORE_LEARNED else MIN_SCORE
        val ok = bestId > 0 && best >= floor && (best - second) >= MIN_MARGIN
        return Slot(if (ok) bestId else null, best)
    }

    private fun crop(region: android.graphics.Rect, zoom: Float, fx: Float, fy: Float): android.graphics.Rect {
        val side = (min(region.width(), region.height()) * zoom).roundToInt().coerceAtLeast(8)
        val cx = region.left + (region.width() * fx).roundToInt()
        val cy = region.top + (region.height() * fy).roundToInt()
        return android.graphics.Rect(
            max(region.left, cx - side / 2),
            max(region.top, cy - side / 2),
            min(region.right, cx + side / 2),
            min(region.bottom, cy + side / 2),
        )
    }

    // ---- the mode plate -----------------------------------------------------

    /**
     * Plates the reader has confirmed, by kind then by name.
     *
     * Nothing is shipped here and nothing can be: the plate is text drawn by
     * the game, and there is no asset anywhere that renders "Spiraling Out" in
     * the game's own font at the game's own size on this phone's own screen.
     * What there is, once, is the reader telling us which map they are on while
     * that text is on the screen — so the first confirmation of a map is what
     * makes every later scan of it free.
     *
     * The mode line pays for itself fastest. Eight modes cover every Ranked map
     * there will ever be, so after a week of use a map never seen before still
     * arrives with its mode filled in and three maps to choose from.
     */
    private val plates = HashMap<String, HashMap<String, FloatArray>>()

    private fun recall(frame: Bitmap, region: Region, kind: String): String? {
        val table = plates[kind] ?: return null
        if (table.isEmpty()) return null
        val r = rect(frame, region)
        if (r.width() < 8 || r.height() < 6) return null
        if (detail(frame, r) < MIN_DETAIL) return null

        val q = describe(frame, r)
        var bestName: String? = null
        var best = -2f
        var second = -2f
        for ((name, d) in table) {
            val v = score(q, d)
            if (v > best) {
                second = best; best = v; bestName = name
            } else if (v > second) {
                second = v
            }
        }
        val clear = table.size == 1 || (best - second) >= MIN_PLATE_MARGIN
        return if (best >= MIN_PLATE_SCORE && clear) bestName else null
    }

    /**
     * Files the plate currently on screen under the names the reader chose.
     *
     * Called after a scan, from the panel, when the reader picks or confirms a
     * map — so the pixels stored are the ones that were on screen for that map,
     * not a re-render of them.
     */
    fun learnPlate(frame: Bitmap, modeKey: String?, mapName: String?) {
        if (modeKey != null) store(frame, PLATE_MODE, PLATE_MODE_KEY, modeKey)
        if (mapName != null) store(frame, PLATE_MAP, PLATE_MAP_KEY, mapName)
    }

    private fun store(frame: Bitmap, region: Region, kind: String, name: String) {
        val r = rect(frame, region)
        if (r.width() < 8 || r.height() < 6) return
        if (detail(frame, r) < MIN_DETAIL) return
        val d = describe(frame, r)
        plates.getOrPut(kind) { HashMap() }[name] = d

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString("plate.$kind.$name", encode(d)).apply()
    }

    private fun loadPlates() {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for ((key, value) in prefs.all) {
            if (!key.startsWith("plate.")) continue
            val rest = key.removePrefix("plate.")
            val split = rest.indexOf('.')
            if (split <= 0) continue
            val kind = rest.substring(0, split)
            val name = rest.substring(split + 1)
            val d = decode(value as? String ?: continue) ?: continue
            plates.getOrPut(kind) { HashMap() }[name] = d
        }
    }

    /**
     * Descriptors are quantised to bytes before storage.
     *
     * A float array of 3,072 entries is a quarter of a megabyte of text in
     * shared preferences; the same thing at one byte a value is three kilobytes
     * and agrees to three decimal places, which is well inside the margin any
     * of this is decided by.
     */
    private fun encode(d: FloatArray): String {
        val bytes = ByteArray(d.size)
        for (i in d.indices) bytes[i] = (d[i] * 32f).coerceIn(-127f, 127f).roundToInt().toByte()
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun decode(blob: String): FloatArray? {
        val bytes = try {
            Base64.decode(blob, Base64.NO_WRAP)
        } catch (e: Throwable) {
            return null
        }
        if (bytes.size != N * N * 3) return null
        val out = FloatArray(bytes.size)
        for (i in bytes.indices) out[i] = bytes[i] / 32f
        return out
    }

    // ---- learning from corrections -----------------------------------------

    /**
     * Remembers what was actually on screen when the reader fixed a slot.
     *
     * This is the part that makes the feature get better instead of staying at
     * whatever the downloaded art happens to support. A learned descriptor is
     * the same UI element, at the same size, cropped the same way, so it scores
     * far higher than the CDN render it replaces — and it is per-device, which
     * quietly absorbs whatever this phone's aspect ratio does to the layout.
     *
     * Capped, and oldest-first, because a table that only grows would eventually
     * make every scan slower than the draft timer it is meant to beat.
     */
    fun learn(frame: Bitmap, kind: String, index: Int, brawlerId: Int) {
        val region = when (kind) {
            "bans" -> {
                val side = if (index < 3) BAN_X[0] else BAN_X[1]
                Region(side, BAN_Y + (index % 3) * BAN_PITCH, BAN_SIZE_X, BAN_SIZE_Y)
            }
            "allies" -> Region(ALLY_X.getOrElse(index) { return }, CARD_Y, CARD_W, CARD_H)
            "enemies" -> Region(ENEMY_X.getOrElse(index) { return }, CARD_Y, CARD_W, CARD_H)
            else -> return
        }
        val zooms = if (kind == "bans") BAN_ZOOMS else CARD_ZOOMS
        val fx = if (kind == "bans") BAN_FX else CARD_FX
        val fy = if (kind == "bans") BAN_FY else CARD_FY
        val r = rect(frame, region)
        if (detail(frame, r) < MIN_DETAIL) return

        val d = describe(frame, crop(r, zooms[0], fx, fy))
        val list = refs.getOrPut(brawlerId) { ArrayList() }
        list.add(d)
        while (list.size > REF_ZOOMS.size + MAX_LEARNED) list.removeAt(REF_ZOOMS.size)
        saveLearned(brawlerId, d)
    }

    private fun saveLearned(brawlerId: Int, d: FloatArray) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = "learned.$brawlerId"
        val existing = prefs.getStringSet(key, null)?.toMutableSet() ?: LinkedHashSet()
        existing.add(encode(d))
        while (existing.size > MAX_LEARNED) existing.remove(existing.first())
        prefs.edit().putStringSet(key, existing).apply()
    }

    private fun loadLearned() {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for ((key, value) in prefs.all) {
            if (!key.startsWith("learned.")) continue
            val id = key.removePrefix("learned.").toIntOrNull() ?: continue
            @Suppress("UNCHECKED_CAST")
            val blobs = value as? Set<String> ?: continue
            val list = refs.getOrPut(id) { ArrayList() }
            for (blob in blobs) list.add(decode(blob) ?: continue)
        }
    }

    private val MAX_LEARNED = 3
}
