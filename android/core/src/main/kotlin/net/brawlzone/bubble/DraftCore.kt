package net.brawlzone.bubble

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Recognising a Brawl Stars draft, with no Android in it.
 *
 * Everything here works on a plain array of ARGB pixels, and that is the whole
 * point of the file existing. The previous version did its arithmetic through
 * `Bitmap` and `Bitmap.createScaledBitmap`, which meant the only way to find
 * out what it recognised was to install it on a phone, open a draft, and look —
 * so four releases of "fixes" shipped on reasoning rather than evidence, and
 * several of them were wrong in ways a test would have caught in a second.
 *
 * With the maths here instead, the same code that runs on the phone runs
 * against real screenshots on a laptop. `DraftCoreTest` reads three captures of
 * an actual draft and asserts the names that come back. That test is the reason
 * to trust any of this, and it is the thing that was missing.
 *
 * The resize is deliberately ours rather than the platform's, for the same
 * reason: a box filter written here behaves identically in both places, whereas
 * `createScaledBitmap` is a device-dependent answer that cannot be reproduced
 * off-device.
 */
object DraftCore {

    /** A rectangle as fractions of the frame, so it survives any resolution. */
    data class Region(val x: Float, val y: Float, val w: Float, val h: Float)

    /** A crop, as (zoom, centre x, centre y) fractions of whatever it cuts. */
    class Crop(val zoom: Float, val fx: Float, val fy: Float)

    data class Rect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
        val width get() = right - left
        val height get() = bottom - top
    }

    /** A frame, or a reference image: ARGB pixels and their dimensions. */
    class Image(val pixels: IntArray, val width: Int, val height: Int)

    /** Descriptor side. 16 and 32 rank identically on real captures. */
    const val N = 16

    /**
     * Below this much variation a region is a placeholder rather than a
     * brawler — the empty "?" card, or a slot the panel was covering. Naming it
     * separately means "nobody has picked yet" does not have to be inferred
     * from a weak match.
     */
    const val MIN_DETAIL = 14.0

    fun rectOf(image: Image, r: Region) = Rect(
        (r.x * image.width).roundToInt(),
        (r.y * image.height).roundToInt(),
        ((r.x + r.w) * image.width).roundToInt(),
        ((r.y + r.h) * image.height).roundToInt(),
    )

    /** A sub-rectangle of a rectangle, by zoom and centre. */
    fun crop(r: Rect, c: Crop): Rect {
        val side = (min(r.width, r.height) * c.zoom).roundToInt().coerceAtLeast(4)
        val cx = r.left + (r.width * c.fx).roundToInt()
        val cy = r.top + (r.height * c.fy).roundToInt()
        return Rect(
            max(r.left, cx - side / 2),
            max(r.top, cy - side / 2),
            min(r.right, cx + side / 2),
            min(r.bottom, cy + side / 2),
        )
    }

    /** The whole of an image, as a rectangle. */
    fun whole(image: Image) = Rect(0, 0, image.width, image.height)

    /**
     * A colour descriptor of one rectangle: N×N, mean-removed per channel and
     * scaled to unit variation.
     *
     * Normalising is what makes the score a correlation rather than a
     * brightness comparison. The same brawler over a blue team panel and a red
     * one differs by a constant the subtraction removes, and the game's own
     * gradients differ by a factor the division removes — without it every
     * match is decided by the team colour, which is the one thing in the frame
     * that says nothing about which brawler it is.
     */
    fun describe(image: Image, rect: Rect, n: Int = N): FloatArray {
        val x0 = rect.left.coerceIn(0, max(0, image.width - 1))
        val y0 = rect.top.coerceIn(0, max(0, image.height - 1))
        val x1 = rect.right.coerceIn(x0 + 1, image.width)
        val y1 = rect.bottom.coerceIn(y0 + 1, image.height)

        val out = resample(image, x0, y0, x1 - x0, y1 - y0, n)

        var sumR = 0.0
        var sumG = 0.0
        var sumB = 0.0
        var i = 0
        while (i < out.size) {
            sumR += out[i]; sumG += out[i + 1]; sumB += out[i + 2]
            i += 3
        }
        val cells = (n * n).toDouble()
        val mr = (sumR / cells).toFloat()
        val mg = (sumG / cells).toFloat()
        val mb = (sumB / cells).toFloat()
        var sq = 0.0
        i = 0
        while (i < out.size) {
            out[i] -= mr; out[i + 1] -= mg; out[i + 2] -= mb
            sq += out[i] * out[i] + out[i + 1] * out[i + 1] + out[i + 2] * out[i + 2]
            i += 3
        }
        val sd = sqrt(sq / out.size).toFloat()
        if (sd > 1e-4f) for (k in out.indices) out[k] /= sd
        return out
    }

    /**
     * Separable Lanczos-3 downsample of one rectangle to n×n RGB.
     *
     * A plain box average was tried first and is not good enough here, which is
     * only obvious with a test to show it. Averaging over integer blocks blurs
     * by however much the source is being reduced, and the two things being
     * compared are reduced by wildly different amounts — a 48-pixel ban icon
     * shrinks by 3, its reference art by 18. The icon keeps sharp edges the
     * reference has already lost, so a true match correlates far worse than it
     * should: measured on a real capture, one ban fell from 0.90 to 0.56 and
     * another stopped being found at all.
     *
     * Lanczos brings both to the same bandwidth regardless of the reduction,
     * which is exactly the property needed. The filter is applied horizontally
     * then vertically, and the window scales with the reduction factor so a
     * downsample genuinely integrates every source pixel rather than sampling
     * a few of them.
     */
    private fun resample(image: Image, sx: Int, sy: Int, sw: Int, sh: Int, n: Int): FloatArray {
        val rows = FloatArray(sh * n * 3)
        horizontal(image, sx, sy, sw, sh, n, rows)

        val out = FloatArray(n * n * 3)
        val scale = sh.toDouble() / n
        val support = max(1.0, scale) * LOBES
        for (dy in 0 until n) {
            val centre = (dy + 0.5) * scale
            var from = Math.floor(centre - support).toInt()
            var to = Math.ceil(centre + support).toInt()
            if (from < 0) from = 0
            if (to > sh) to = sh
            var weight = 0.0
            var r = 0.0
            var g = 0.0
            var b = 0.0
            for (y in from until to) {
                val w = lanczos((y + 0.5 - centre) / max(1.0, scale))
                if (w == 0.0) continue
                val base = (y * n + 0) * 3
                weight += w
                for (dx in 0 until n) {
                    // accumulated below; inner loop handled after weight pass
                }
                var k = base
                var dx = 0
                while (dx < n) {
                    val o = (dx * 3)
                    out[dy * n * 3 + o] += (rows[k] * w).toFloat()
                    out[dy * n * 3 + o + 1] += (rows[k + 1] * w).toFloat()
                    out[dy * n * 3 + o + 2] += (rows[k + 2] * w).toFloat()
                    k += 3
                    dx++
                }
                r += 0.0; g += 0.0; b += 0.0
            }
            if (weight != 0.0) {
                val inv = (1.0 / weight).toFloat()
                for (dx in 0 until n * 3) out[dy * n * 3 + dx] *= inv
            }
        }
        return out
    }

    /** Horizontal pass: sh rows of n RGB samples. */
    private fun horizontal(
        image: Image,
        sx: Int,
        sy: Int,
        sw: Int,
        sh: Int,
        n: Int,
        rows: FloatArray,
    ) {
        val scale = sw.toDouble() / n
        val support = max(1.0, scale) * LOBES
        for (dx in 0 until n) {
            val centre = (dx + 0.5) * scale
            var from = Math.floor(centre - support).toInt()
            var to = Math.ceil(centre + support).toInt()
            if (from < 0) from = 0
            if (to > sw) to = sw
            for (y in 0 until sh) {
                var weight = 0.0
                var r = 0.0
                var g = 0.0
                var b = 0.0
                val row = (sy + y) * image.width + sx
                for (x in from until to) {
                    val w = lanczos((x + 0.5 - centre) / max(1.0, scale))
                    if (w == 0.0) continue
                    val p = image.pixels[row + x]
                    r += ((p shr 16) and 0xFF) * w
                    g += ((p shr 8) and 0xFF) * w
                    b += (p and 0xFF) * w
                    weight += w
                }
                val o = (y * n + dx) * 3
                if (weight != 0.0) {
                    rows[o] = (r / weight).toFloat()
                    rows[o + 1] = (g / weight).toFloat()
                    rows[o + 2] = (b / weight).toFloat()
                }
            }
        }
    }

    private const val LOBES = 3.0

    private fun lanczos(x: Double): Double {
        val a = Math.abs(x)
        if (a < 1e-9) return 1.0
        if (a >= LOBES) return 0.0
        val px = Math.PI * x
        return LOBES * Math.sin(px) * Math.sin(px / LOBES) / (px * px)
    }

    /** How much a rectangle varies in brightness, before normalising. */
    fun detail(image: Image, rect: Rect): Double {
        val d = describeRaw(image, rect)
        return d
    }

    private fun describeRaw(image: Image, rect: Rect): Double {
        val x0 = rect.left.coerceIn(0, max(0, image.width - 1))
        val y0 = rect.top.coerceIn(0, max(0, image.height - 1))
        val x1 = rect.right.coerceIn(x0 + 1, image.width)
        val y1 = rect.bottom.coerceIn(y0 + 1, image.height)
        var sum = 0.0
        var sq = 0.0
        var n = 0
        var y = y0
        val stepY = max(1, (y1 - y0) / 16)
        val stepX = max(1, (x1 - x0) / 16)
        while (y < y1) {
            val row = y * image.width
            var x = x0
            while (x < x1) {
                val p = image.pixels[row + x]
                val v = (((p shr 16) and 0xFF) + ((p shr 8) and 0xFF) + (p and 0xFF)) / 3.0
                sum += v; sq += v * v; n++
                x += stepX
            }
            y += stepY
        }
        if (n == 0) return 0.0
        val mean = sum / n
        return sqrt(max(0.0, sq / n - mean * mean))
    }

    fun score(a: FloatArray, b: FloatArray): Float {
        var s = 0.0
        for (i in a.indices) s += a[i] * b[i]
        return (s / a.size).toFloat()
    }

    /**
     * Why a slot has the answer it has.
     *
     * Four answers, not two, because "nothing" was hiding three different
     * facts. An empty placeholder means nobody has picked yet; an unknown means
     * something is there and the matcher could not name it; occluded means our
     * own panel was in the frame and there is nothing to read. The page treats
     * them differently — an empty slot that used to hold a pick is evidence of
     * a new draft, an unknown one is not — so they have to arrive as different
     * words rather than the same null.
     */
    enum class Status { RECOGNIZED, EMPTY, UNKNOWN, OCCLUDED }

    /** One runner-up, kept so a misread can be diagnosed from the payload. */
    data class Candidate(val id: Int, val score: Float)

    /** What one slot came to: a brawler, or nothing, and how sure. */
    data class Match(
        val id: Int?,
        val best: Float,
        val margin: Float,
        val status: Status,
        val candidates: List<Candidate> = emptyList(),
        /** Why it is not a recognition, for the diagnostics export. */
        val reason: String? = null,
    ) {
        val empty: Boolean get() = status == Status.EMPTY
    }

    /**
     * How much of a rectangle is near-black.
     *
     * The overlay this app draws is #0B0F1D, and a stale capture that still
     * has it in the frame reads as a slot full of that. Measured on captures
     * with the panel up: 89-97% of a covered slot is under 40 brightness,
     * against 8-21% of any real card and 16% of the empty placeholder.
     */
    fun darkFraction(image: Image, rect: Rect, limit: Int = 40): Float {
        var dark = 0
        var n = 0
        sample(image, rect) { p ->
            val r = (p shr 16) and 0xFF
            val g = (p shr 8) and 0xFF
            val b = p and 0xFF
            if (max(r, max(g, b)) < limit) dark++
            n++
        }
        return if (n == 0) 0f else dark.toFloat() / n
    }

    /**
     * How much of a rectangle is coloured rather than grey.
     *
     * The unpicked card is a grey "?" placeholder: 9% of its pixels have a
     * channel spread over 60, against 45-68% of every real card and ban on
     * the same captures. This is what says "empty" rather than a weak match.
     */
    fun saturatedFraction(image: Image, rect: Rect, spread: Int = 60): Float {
        var sat = 0
        var n = 0
        sample(image, rect) { p ->
            val r = (p shr 16) and 0xFF
            val g = (p shr 8) and 0xFF
            val b = p and 0xFF
            if (max(r, max(g, b)) - min(r, min(g, b)) > spread) sat++
            n++
        }
        return if (n == 0) 0f else sat.toFloat() / n
    }

    /** Visits a grid of at most ~32x32 samples of a rectangle. */
    private inline fun sample(image: Image, rect: Rect, visit: (Int) -> Unit) {
        val x0 = rect.left.coerceIn(0, max(0, image.width - 1))
        val y0 = rect.top.coerceIn(0, max(0, image.height - 1))
        val x1 = rect.right.coerceIn(x0 + 1, image.width)
        val y1 = rect.bottom.coerceIn(y0 + 1, image.height)
        val stepY = max(1, (y1 - y0) / 32)
        val stepX = max(1, (x1 - x0) / 32)
        var y = y0
        while (y < y1) {
            val row = y * image.width
            var x = x0
            while (x < x1) {
                visit(image.pixels[row + x])
                x += stepX
            }
            y += stepY
        }
    }

    /** Below this share of coloured pixels a card is the grey placeholder. */
    const val EMPTY_MAX_SATURATED = 0.20f

    /** Above this share of near-black a slot is under our own overlay. */
    const val OCCLUDED_MIN_DARK = 0.55f

    /**
     * One region against a whole reference table.
     *
     * The runner-up decides this, not the winner. A best score of 0.45 means
     * nothing on its own — some brawler always comes top of a hundred — but
     * 0.45 against a second place of 0.30 is a different claim from 0.45
     * against 0.44, and only the first is worth putting on a draft board.
     */
    fun identify(
        frame: Image,
        region: Rect,
        queries: Array<Crop>,
        table: Map<Int, List<FloatArray>>,
        minScore: Float,
        minMargin: Float,
        n: Int = N,
    ): Match {
        if (region.width < 6 || region.height < 6) {
            return Match(null, 0f, 0f, Status.UNKNOWN, reason = "region too small")
        }
        /*
         * Occlusion is decided before anything is matched, because a slot
         * under the panel matches nothing and the *reason* it matches nothing
         * is the fact worth reporting: it says the capture was stale, not that
         * the matcher failed.
         */
        val dark = darkFraction(frame, region)
        if (dark >= OCCLUDED_MIN_DARK) {
            return Match(null, 0f, 0f, Status.OCCLUDED, reason = "dark %.2f".format(dark))
        }
        if (detail(frame, region) < MIN_DETAIL) {
            return Match(null, 0f, 0f, Status.EMPTY, reason = "flat")
        }
        if (table.isEmpty()) return Match(null, 0f, 0f, Status.UNKNOWN, reason = "no references")

        val qs = queries.map { describe(frame, crop(region, it), n) }

        val scored = ArrayList<Candidate>(table.size)
        for ((id, variants) in table) {
            var s = -2f
            for (v in variants) {
                for (q in qs) {
                    val x = score(q, v)
                    if (x > s) s = x
                }
            }
            scored.add(Candidate(id, s))
        }
        scored.sortByDescending { it.score }
        val top = scored.take(TOP_CANDIDATES)
        val best = top.firstOrNull()?.score ?: -2f
        val second = top.getOrNull(1)?.score ?: -2f
        val bestId = top.firstOrNull()?.id ?: -1
        val margin = best - second
        val ok = bestId > 0 && best >= minScore && margin >= minMargin
        if (ok) return Match(bestId, best, margin, Status.RECOGNIZED, top)

        /*
         * Not a brawler the table knows. Whether that is "nobody yet" or
         * "somebody we cannot name" is decided by colour: the placeholder is
         * grey, and every brawler is not.
         */
        val saturated = saturatedFraction(frame, region)
        val status = if (saturated < EMPTY_MAX_SATURATED) Status.EMPTY else Status.UNKNOWN
        val reason = if (best < minScore) "score %.2f".format(best) else "margin %.2f".format(margin)
        return Match(null, best, margin, status, top, reason)
    }

    /** Runner-ups kept per slot. Three is enough to see what it confused. */
    const val TOP_CANDIDATES = 3

    /**
     * Every crop of a reference image the matcher will compare against.
     *
     * The downloaded art is not framed consistently between brawlers — the best
     * match for Rico's card sits at 70% zoom around a centre at x=0.65, not in
     * the middle — so one fixed crop fits one brawler and mis-frames the rest.
     * Sampling a spread lets each be matched on the framing that suits it,
     * which is what took real cards from one recognised in six to all of them.
     */
    /**
     * Reduces an image once, so the variants can be cut from something small.
     *
     * Reference art is up to 332 pixels square and every variant is a Lanczos
     * resample of it — with a window that scales with the reduction, one
     * descriptor integrates a few million weighted samples, and there are
     * dozens of variants for each of a hundred brawlers. Done straight that is
     * billions of operations at startup, which is fine on a laptop and minutes
     * on a phone.
     *
     * Reducing to a working size first costs one resample per brawler and
     * leaves the crops to work on something 96 pixels wide. The result is
     * indistinguishable — everything ends at 16 cells either way — and the
     * test on real captures is what says so rather than the argument.
     */
    fun reduce(image: Image, size: Int = WORKING): Image {
        if (max(image.width, image.height) <= size) return image
        val d = describeRawPixels(image, whole(image), size)
        return Image(d, size, size)
    }

    const val WORKING = 96

    private fun describeRawPixels(image: Image, rect: Rect, n: Int): IntArray {
        val f = resample(image, rect.left, rect.top, rect.width, rect.height, n)
        val out = IntArray(n * n)
        var i = 0
        for (k in out.indices) {
            val r = f[i].toInt().coerceIn(0, 255)
            val g = f[i + 1].toInt().coerceIn(0, 255)
            val b = f[i + 2].toInt().coerceIn(0, 255)
            out[k] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            i += 3
        }
        return out
    }

    fun variants(
        image: Image,
        zooms: FloatArray,
        fxs: FloatArray,
        fys: FloatArray,
        n: Int = N,
    ): List<FloatArray> {
        val small = reduce(image)
        val out = ArrayList<FloatArray>(zooms.size * fxs.size * fys.size)
        val all = whole(small)
        for (z in zooms) for (fx in fxs) for (fy in fys) {
            out.add(describe(small, crop(all, Crop(z, fx, fy)), n))
        }
        return out
    }
}
