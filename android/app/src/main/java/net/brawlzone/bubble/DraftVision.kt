package net.brawlzone.bubble

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
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
    }

    /** brawler id -> portrait descriptors, for the player cards. */
    private val portraits = HashMap<Int, MutableList<FloatArray>>()

    /** brawler id -> emoji descriptors, for the ban icons. */
    private val icons = HashMap<Int, MutableList<FloatArray>>()

    /** Plates the reader has confirmed, by kind then by name. */
    private val plates = HashMap<String, HashMap<String, FloatArray>>()

    val ready: Boolean get() = portraits.isNotEmpty()

    // ---- reference tables ---------------------------------------------------

    /**
     * Builds both tables from the roster the panel already knows about.
     *
     * The ids come from the page rather than being compiled in, so a brawler
     * released next month is matchable the day the site knows about it. The art
     * is cached on disk after the first run.
     */
    fun prepare(ids: List<Int>) {
        val dir = File(context.filesDir, "art").apply { mkdirs() }
        for (id in ids) {
            if (!portraits.containsKey(id)) {
                fetch(File(dir, "p$id.png"), PORTRAIT_URL, id)?.let { image ->
                    portraits[id] = DraftCore
                        .variants(image, DraftLayout.PORTRAIT_ZOOMS, DraftLayout.PORTRAIT_FX, DraftLayout.PORTRAIT_FY)
                        .toMutableList()
                }
            }
            if (!icons.containsKey(id)) {
                fetch(File(dir, "i$id.png"), ICON_URL, id)?.let { image ->
                    val v = ArrayList<FloatArray>()
                    for (bg in intArrayOf(DraftLayout.TEAM_BLUE, DraftLayout.TEAM_RED)) {
                        v += DraftCore.variants(
                            DraftLayout.over(image, bg),
                            DraftLayout.ICON_ZOOMS, DraftLayout.ICON_FX, DraftLayout.ICON_FY,
                            DraftLayout.ICON_N,
                        )
                    }
                    icons[id] = v
                }
            }
        }
        loadLearned()
        loadPlates()
        Log.i(TAG, "tables ready: ${portraits.size} portraits, ${icons.size} icons")
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

    private fun decode(file: File): DraftCore.Image? = try {
        val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
        BitmapFactory.decodeFile(file.absolutePath, options)?.let { bitmap ->
            val image = toImage(bitmap)
            bitmap.recycle()
            image
        }
    } catch (e: Throwable) {
        null
    }

    /** The one place a platform Bitmap becomes something testable. */
    fun toImage(bitmap: Bitmap): DraftCore.Image {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        return DraftCore.Image(pixels, bitmap.width, bitmap.height)
    }

    // ---- reading a frame ----------------------------------------------------

    fun plateRect(frame: DraftCore.Image) = DraftCore.rectOf(frame, DraftLayout.PLATE_TEXT)

    fun read(frame: DraftCore.Image): Reading {
        val bans = (0 until 6).map { i ->
            match(
                frame, DraftCore.rectOf(frame, DraftLayout.banRegion(i)),
                DraftLayout.BAN_QUERIES, icons,
                DraftLayout.BAN_MIN_SCORE, DraftLayout.BAN_MIN_MARGIN, DraftLayout.ICON_N,
            )
        }
        val allies = (0 until 3).map { card(frame, DraftLayout.allyRegion(it)) }
        val enemies = (0 until 3).map { card(frame, DraftLayout.enemyRegion(it)) }
        return Reading(
            recall(frame, DraftLayout.PLATE_MODE, PLATE_MODE_KEY),
            recall(frame, DraftLayout.PLATE_MAP, PLATE_MAP_KEY),
            bans,
            allies,
            enemies,
        )
    }

    private fun card(frame: DraftCore.Image, region: DraftCore.Region): Slot = match(
        frame, DraftCore.rectOf(frame, region), DraftLayout.CARD_QUERIES, portraits,
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

    private fun recall(frame: DraftCore.Image, region: DraftCore.Region, kind: String): String? {
        val table = plates[kind] ?: return null
        if (table.isEmpty()) return null
        val r = DraftCore.rectOf(frame, region)
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
        if (modeKey != null) storePlate(frame, DraftLayout.PLATE_MODE, PLATE_MODE_KEY, modeKey)
        if (mapName != null) storePlate(frame, DraftLayout.PLATE_MAP, PLATE_MAP_KEY, mapName)
    }

    private fun storePlate(frame: DraftCore.Image, region: DraftCore.Region, kind: String, name: String) {
        val r = DraftCore.rectOf(frame, region)
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
        val region = when (kind) {
            "bans" -> if (index in 0 until 6) DraftLayout.banRegion(index) else return
            "allies" -> if (index in DraftLayout.ALLY_X.indices) DraftLayout.allyRegion(index) else return
            "enemies" -> if (index in DraftLayout.ENEMY_X.indices) DraftLayout.enemyRegion(index) else return
            else -> return
        }
        val r = DraftCore.rectOf(frame, region)
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
