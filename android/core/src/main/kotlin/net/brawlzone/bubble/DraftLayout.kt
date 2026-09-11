package net.brawlzone.bubble

/**
 * Where things are on a Brawl Stars draft screen, and how confident a match has
 * to be before it is believed.
 *
 * In `core` rather than beside the Android code because these numbers *are* the
 * recognition: a region a few percent out reads the wrong pixels, and a
 * threshold set optimistically puts a brawler nobody picked onto the board.
 * Both are things a test on real captures can catch, and neither is something
 * anyone can check by reading.
 *
 * Measured on 1560x720 captures of a real Ranked draft and verified by drawing
 * the regions back over one. They are fractions, so they hold at any
 * resolution — the game lays this screen out proportionally.
 */
object DraftLayout {

    /**
     * Only the bottom strip is read, never the roster grid above it.
     *
     * The grid scrolls and shows about fourteen of ninety brawlers, so a pick
     * on anything scrolled off-screen has no marker to find. The strip always
     * carries all six bans and all six picks.
     */
    val BAN_X = floatArrayOf(0.1500f, 0.8641f)
    const val BAN_Y = 0.7222f
    const val BAN_PITCH = 0.0833f
    const val BAN_SIZE_X = 0.0308f
    const val BAN_SIZE_Y = 0.0667f

    val ALLY_X = floatArrayOf(0.2205f, 0.3205f, 0.4205f)
    val ENEMY_X = floatArrayOf(0.5744f, 0.6609f, 0.7500f)
    const val CARD_Y = 0.7375f
    const val CARD_W = 0.0801f
    const val CARD_H = 0.1486f

    /** The two lines of the mode plate, and both together for the recogniser. */
    val PLATE_MODE = DraftCore.Region(0.1006f, 0.0306f, 0.1654f, 0.0500f)
    val PLATE_MAP = DraftCore.Region(0.1006f, 0.0833f, 0.1654f, 0.0389f)
    val PLATE_TEXT = DraftCore.Region(0.0950f, 0.0250f, 0.1850f, 0.1000f)

    /**
     * How a player card is sampled.
     *
     * Not whole: the level badge sits over its top-left corner and a tick or a
     * skull over the others, so the crops are pulled down and right, away from
     * all three.
     */
    val CARD_QUERIES = arrayOf(
        DraftCore.Crop(0.60f, 0.65f, 0.65f),
        DraftCore.Crop(0.60f, 0.50f, 0.55f),
        DraftCore.Crop(0.75f, 0.55f, 0.60f),
        DraftCore.Crop(0.90f, 0.50f, 0.50f),
    )

    /** A ban icon is already a tight head, so it is matched nearly whole. */
    val BAN_QUERIES = arrayOf(
        DraftCore.Crop(1.00f, 0.50f, 0.50f),
        DraftCore.Crop(0.92f, 0.50f, 0.47f),
        DraftCore.Crop(0.84f, 0.50f, 0.45f),
    )

    /**
     * Reference crops for the portraits, which are framed per brawler.
     *
     * The downloaded art is not consistent between brawlers — the best match
     * for one card sits at 70% zoom around a centre at x=0.65, not in the
     * middle — so a single fixed crop fits one brawler and mis-frames the rest.
     * That is not a theory: with one crop, a real draft read one brawler out of
     * six.
     */
    val PORTRAIT_ZOOMS = floatArrayOf(0.55f, 0.70f, 0.85f, 1.0f)
    val PORTRAIT_FX = floatArrayOf(0.40f, 0.50f, 0.65f)
    val PORTRAIT_FY = floatArrayOf(0.40f, 0.50f)

    /**
     * Ban icons are described at a finer grid than the cards.
     *
     * They are pixel art at about 48 screen pixels, so their identity is
     * carried by hard edges — an eye, a tooth, the line of a fringe. Averaged
     * down to 16 cells those edges dissolve into their neighbours and two
     * different brawlers become two similar smudges: measured on a real
     * capture, one ban went from a confident 0.90 to a refused 0.56 purely from
     * the coarser grid, while the cards, which are smooth artwork, did not move
     * at all. The finer grid is paid for by using far fewer reference crops.
     */
    const val ICON_N = 16

    /** The emoji art is framed consistently, so it needs far less spread. */
    val ICON_ZOOMS = floatArrayOf(0.80f, 0.90f, 1.0f)
    val ICON_FX = floatArrayOf(0.44f, 0.50f, 0.56f)
    val ICON_FY = floatArrayOf(0.44f, 0.50f, 0.56f)

    /**
     * The two team colours a ban icon is drawn on.
     *
     * The emoji art has a transparent background, and a transparent pixel
     * decoded straight is black — nothing like the blue or red panel the icon
     * sits on, and the flat background is a large enough share of the crop to
     * dominate the descriptor. So each icon is filed twice, once per side.
     */
    const val TEAM_BLUE = 0xFF3B71F7.toInt()
    const val TEAM_RED = 0xFFAF2D47.toInt()

    /**
     * Accept only this far clear of the field. Measured, not guessed.
     *
     * On real captures the right answers land at 0.83 to 0.93 for cards and
     * 0.70 to 0.90 for bans, with margins from 0.20 to 0.38; an empty card and
     * a card the panel was covering sit under a 0.10 margin. The gates are set
     * between those two populations, and `DraftCoreTest` asserts both sides of
     * it — that the right ones are found *and* that the wrong ones are refused.
     */
    const val CARD_MIN_SCORE = 0.60f
    const val CARD_MIN_MARGIN = 0.15f
    const val BAN_MIN_SCORE = 0.62f
    const val BAN_MIN_MARGIN = 0.15f

    /** A learned crop is the same UI at the same size, so it should score high. */
    const val LEARNED_MIN_SCORE = 0.70f

    /** The mode plate is text rendered at a fixed size: a true match is exact. */
    const val PLATE_MIN_SCORE = 0.86f
    const val PLATE_MIN_MARGIN = 0.05f

    fun banRegion(index: Int) = DraftCore.Region(
        if (index < 3) BAN_X[0] else BAN_X[1],
        BAN_Y + (index % 3) * BAN_PITCH,
        BAN_SIZE_X,
        BAN_SIZE_Y,
    )

    fun allyRegion(index: Int) = DraftCore.Region(ALLY_X[index], CARD_Y, CARD_W, CARD_H)

    fun enemyRegion(index: Int) = DraftCore.Region(ENEMY_X[index], CARD_Y, CARD_W, CARD_H)

    /** Transparency composited onto a flat colour. See TEAM_BLUE. */
    fun over(image: DraftCore.Image, background: Int): DraftCore.Image {
        val out = IntArray(image.pixels.size)
        val br = (background shr 16) and 0xFF
        val bg = (background shr 8) and 0xFF
        val bb = background and 0xFF
        for (i in image.pixels.indices) {
            val p = image.pixels[i]
            val a = (p ushr 24) and 0xFF
            if (a == 255) { out[i] = p; continue }
            val r = (((p shr 16) and 0xFF) * a + br * (255 - a)) / 255
            val g = (((p shr 8) and 0xFF) * a + bg * (255 - a)) / 255
            val b = ((p and 0xFF) * a + bb * (255 - a)) / 255
            out[i] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
        }
        return DraftCore.Image(out, image.width, image.height)
    }

    // ---- finding the layout instead of assuming it -------------------------

    /**
     * Everything the reader needs from one frame, in pixels.
     *
     * Derived from the frame rather than fixed, because a fraction of the whole
     * frame is only correct at the aspect ratio it was measured on. Calibrated
     * on a 1560x720 capture, those fractions read the match timer where the map
     * name is on a 2400x1080 one — which is exactly what a scan came back with.
     *
     * Every rectangle here is positioned from the *content* rectangle — the
     * game's own viewport inside the frame — not from the frame's corner. A
     * capture can carry black bars (a virtual display letterboxing a screen of
     * another shape), a navigation bar, or a cutout inset, and none of those
     * move the game; they move where the game is in the frame. The bottom
     * strip was already measured that way. The mode plate was not, and on a
     * frame with 200 black rows above the game its crop stayed at the frame's
     * top, 200 pixels above the text it was meant to read.
     */
    class Located(
        val bans: List<DraftCore.Rect>,
        val allies: List<DraftCore.Rect>,
        val enemies: List<DraftCore.Rect>,
        /** Where each ally's name label is drawn, for telling the reader's own card. */
        val allyLabels: List<DraftCore.Rect>,
        val plateText: DraftCore.Rect,
        val plateMode: DraftCore.Rect,
        val plateMap: DraftCore.Rect,
        /** The game's viewport inside the frame. */
        val content: DraftCore.Rect,
        /** The team strip's height, which is the game's own unit of scale. */
        val unit: Int,
        /** Where the blue panel meets the red one, in frame pixels. */
        val seam: Int,
        /** Whether the mode plate was found on its own colour. */
        val plateFound: Boolean,
        val detected: Boolean,
        /** 0..1: how many of the anchor checks passed, weighted. */
        val confidence: Float,
        /** Every check that did not pass, in words. Empty when detected. */
        val reasons: List<String>,
    )

    /** Team panel colours, matched with a tolerance for compression. */
    private const val TOLERANCE = 96

    private fun near(pixel: Int, r: Int, g: Int, b: Int, tolerance: Int = TOLERANCE): Boolean {
        val dr = ((pixel shr 16) and 0xFF) - r
        val dg = ((pixel shr 8) and 0xFF) - g
        val db = (pixel and 0xFF) - b
        return Math.abs(dr) + Math.abs(dg) + Math.abs(db) < tolerance
    }

    private fun blue(p: Int) = near(p, 59, 113, 247)
    private fun red(p: Int) = near(p, 175, 45, 71)

    /** The lavender of the mode plate, measured at (137, 152, 211). */
    private fun plate(p: Int) = near(p, 137, 152, 211, 60)

    /** Anything under this is a black bar rather than the game. */
    private const val BAR_MAX = 18

    /**
     * The game's viewport: the frame with its black bars trimmed.
     *
     * A row or column is a bar when every sample on it is near-black. The game
     * itself draws a dark band along its top edge, so this can shave a few
     * rows of real content there — which costs nothing, because nothing is
     * anchored to the content's top: the plate is found on its own colour and
     * everything else hangs off the strip at the bottom.
     */
    fun contentRect(frame: DraftCore.Image): DraftCore.Rect {
        val w = frame.width
        val h = frame.height
        val stepX = (w / 64).coerceAtLeast(1)
        val stepY = (h / 64).coerceAtLeast(1)

        fun rowIsBar(y: Int): Boolean {
            var x = 0
            while (x < w) {
                if (!dark(frame.pixels[y * w + x])) return false
                x += stepX
            }
            return true
        }

        fun colIsBar(x: Int): Boolean {
            var y = 0
            while (y < h) {
                if (!dark(frame.pixels[y * w + x])) return false
                y += stepY
            }
            return true
        }

        var top = 0
        while (top < h - 1 && rowIsBar(top)) top++
        var bottom = h
        while (bottom > top + 1 && rowIsBar(bottom - 1)) bottom--
        var left = 0
        while (left < w - 1 && colIsBar(left)) left++
        var right = w
        while (right > left + 1 && colIsBar(right - 1)) right--
        return DraftCore.Rect(left, top, right, bottom)
    }

    private fun dark(p: Int): Boolean =
        ((p shr 16) and 0xFF) < BAR_MAX && ((p shr 8) and 0xFF) < BAR_MAX && (p and 0xFF) < BAR_MAX

    /**
     * The rows of the team strip inside the content rectangle, or null.
     *
     * The strip is two large areas of flat, saturated colour across the bottom —
     * the easiest thing in the frame to find, and the thing every ban and every
     * pick is positioned against. Its height is the game's unit of scale: the
     * UI grows and shrinks with it, so measuring everything in those units
     * makes the layout independent of both resolution and aspect ratio.
     *
     * Found from the bottom of the *content* upward, and allowed to start a
     * little above it: a system bar, a rounded corner or one stray dark row at
     * the bottom of the frame is not the strip's edge, and the old detector —
     * which began at the frame's last row and gave up the moment that row was
     * not blue or red — failed on exactly one appended black row.
     */
    private fun stripRows(frame: DraftCore.Image, content: DraftCore.Rect): IntRange? {
        val w = frame.width
        val step = (content.width / 160).coerceAtLeast(1)
        val half = (content.width / 2 / step).coerceAtLeast(1)

        fun isStrip(y: Int): Boolean {
            var b = 0
            var r = 0
            var x = content.left
            val mid = content.left + content.width / 2
            while (x < content.right) {
                val p = frame.pixels[y * w + x]
                if (x < mid) { if (blue(p)) b++ } else if (red(p)) r++
                x += step
            }
            return b * 100 / half >= 30 || r * 100 / half >= 30
        }

        // The strip's bottom edge: the first strip row found searching up from
        // the content's bottom, within the slack a system bar could occupy.
        val slack = content.height / 6
        var bottom = -1
        var y = content.bottom - 1
        while (y >= content.bottom - slack && y > content.top) {
            if (isStrip(y)) { bottom = y; break }
            y--
        }
        if (bottom < 0) return null

        var top = bottom
        val limit = content.top + content.height / 2
        while (top - 1 > limit && isStrip(top - 1)) top--
        return top..bottom
    }

    /**
     * Where the blue panel ends and the red one begins, read off the lowest
     * rows of the strip — the part of the screen the panel never covers.
     * Returns the content's horizontal extent as well, since the strip runs
     * the full width of the game.
     */
    private class Seam(val left: Int, val right: Int, val seam: Int)

    private fun seam(frame: DraftCore.Image, content: DraftCore.Rect, rows: IntRange): Seam? {
        val w = frame.width
        val from = (rows.last - (rows.last - rows.first) / 8).coerceAtLeast(rows.first)
        val ys = (from..rows.last).step(((rows.last - from) / 8).coerceAtLeast(1)).toList()
        var firstBlue = -1
        var lastBlue = -1
        var firstRed = -1
        var lastRed = -1
        for (x in content.left until content.right) {
            var b = 0
            var r = 0
            for (y in ys) {
                val p = frame.pixels[y * w + x]
                if (blue(p)) b++ else if (red(p)) r++
            }
            if (b * 2 > ys.size) { if (firstBlue < 0) firstBlue = x; lastBlue = x }
            if (r * 2 > ys.size) { if (firstRed < 0) firstRed = x; lastRed = x }
        }
        if (firstBlue < 0 || firstRed < 0 || firstRed <= lastBlue) return null
        return Seam(firstBlue, lastRed + 1, (lastBlue + firstRed) / 2)
    }

    /**
     * The mode plate, found on its own colour.
     *
     * It is a lavender box in the top-left of the game with the mode on its
     * first line and the map on its second, and nothing else on the draft
     * screen is that colour. Searched for in the top-left of the *content*,
     * above the strip, so black bars and insets cannot displace it; sized in
     * strip units, so a box the wrong size — a chip of the same colour, a
     * fragment behind a dialog — is refused rather than read.
     */
    private fun plateBox(
        frame: DraftCore.Image,
        content: DraftCore.Rect,
        stripTop: Int,
        s: Float,
    ): DraftCore.Rect? {
        val w = frame.width
        val x0 = content.left
        val x1 = (content.left + (3.5f * s).toInt()).coerceAtMost(content.right)
        val y0 = content.top
        val y1 = (content.top + (1.5f * s).toInt()).coerceAtMost(stripTop)
        if (x1 - x0 < 8 || y1 - y0 < 8) return null

        val rows = IntArray(y1 - y0)
        val cols = IntArray(x1 - x0)
        for (y in y0 until y1) {
            val row = y * w
            for (x in x0 until x1) {
                if (plate(frame.pixels[row + x])) { rows[y - y0]++; cols[x - x0]++ }
            }
        }
        /*
         * The box is a run of rows each carrying a share of its width, and
         * the thresholds are low on purpose: the mode line is large white
         * text that leaves a third of its rows lavender, and the icon on the
         * left leaves a tenth of its columns. Measured on the fixtures — the
         * text rows bottom out at 83 of 334 pixels — so the gap tolerance is
         * what stops the text from splitting the box in two.
         */
        val gap = (0.2f * s).toInt()
        val minRow = (0.3f * s).toInt()
        val band = longestRun(rows, gap) { it >= minRow } ?: return null
        val minCol = ((band.last - band.first) * 0.1f).toInt().coerceAtLeast(2)
        // Recount columns inside the band only, so a lavender chip elsewhere
        // in the search area cannot stretch the box sideways.
        for (x in x0 until x1) {
            var n = 0
            for (y in (y0 + band.first)..(y0 + band.last)) if (plate(frame.pixels[y * w + x])) n++
            cols[x - x0] = n
        }
        val span = longestRun(cols, gap) { it >= minCol } ?: return null
        val box = DraftCore.Rect(x0 + span.first, y0 + band.first, x0 + span.last + 1, y0 + band.last + 1)
        val okW = box.width in (0.9f * s).toInt()..(2.4f * s).toInt()
        val okH = box.height in (0.22f * s).toInt()..(0.55f * s).toInt()
        return if (okW && okH) box else null
    }

    /** The longest run of kept indices, bridging holes up to `gap` wide. */
    private inline fun longestRun(values: IntArray, gap: Int, keep: (Int) -> Boolean): IntRange? {
        var best: IntRange? = null
        var start = -1
        var lastKept = -1
        for (i in values.indices) {
            if (keep(values[i])) {
                if (start < 0) start = i
                lastKept = i
            } else if (start >= 0 && i - lastKept > gap) {
                if (best == null || lastKept - start > best.last - best.first) best = start..lastKept
                start = -1
            }
        }
        if (start >= 0 && (best == null || lastKept - start > best.last - best.first)) {
            best = start..lastKept
        }
        return best
    }

    /**
     * Finds the top of the team strip in a frame. Kept for callers that only
     * want the one number; `locate` is the full answer.
     */
    fun stripTop(frame: DraftCore.Image): Int {
        if (frame.width < 64 || frame.height < 64) return -1
        val content = contentRect(frame)
        val rows = stripRows(frame, content) ?: return -1
        return if (rows.last - rows.first + 1 >= content.height / 6) rows.first else -1
    }

    /**
     * The layout for one frame, measured from the frame.
     *
     * There is no fallback. The previous version fell back to whole-frame
     * fractions when the strip was not found, which are only right at one
     * aspect ratio and were being applied precisely when something about the
     * frame was unusual. A layout that could not be verified now says so, with
     * reasons, and the caller reports "not a draft screen" instead of reading
     * a brawler out of the wrong pixels.
     *
     * Detection is the strip plus a set of anchor checks. Two flat panels of
     * the right colours are enough to be a strip; they are not enough to be a
     * draft, and a synthetic frame of exactly that passed the old detector.
     */
    fun locate(frame: DraftCore.Image): Located {
        val reasons = ArrayList<String>()
        val w = frame.width
        if (w < 64 || frame.height < 64) return notFound(frame, listOf("frame too small"))

        val content = contentRect(frame)
        if (content.width * 2 < w || content.height * 2 < frame.height) {
            return notFound(frame, listOf("content ${content.width}x${content.height} is under half the frame"))
        }

        val rows = stripRows(frame, content) ?: return notFound(frame, listOf("no team strip"))
        val top = rows.first
        val s = (rows.last - top + 1).toFloat()
        if (s < content.height / 6f) reasons += "strip ${s.toInt()}px is under a sixth of ${content.height}"
        if (s > content.height / 2f) reasons += "strip ${s.toInt()}px is over half of ${content.height}"

        val edges = seam(frame, content, rows)
        if (edges == null) {
            reasons += "no blue/red seam"
            return notFound(frame, reasons)
        }
        // The strip spans the game's width: its edges are better content edges
        // than the black-bar trim, which cannot see a dark game edge.
        val left = edges.left
        val right = edges.right
        val width = (right - left).toFloat()

        // Measured 0.146 at 16:9; the UI scales with height, so a wider phone
        // is lower and a tablet higher. Outside this the strip is not a strip.
        val ratio = s / width
        if (ratio < 0.09f || ratio > 0.26f) reasons += "strip/width %.3f".format(ratio)
        // Measured at 0.538 of the width: the divider leans right of centre.
        val seamAt = (edges.seam - left) / width
        if (seamAt < 0.40f || seamAt > 0.66f) reasons += "seam at %.2f".format(seamAt)

        fun r(xLeft: Float, yTop: Float, rw: Float, rh: Float) = DraftCore.Rect(
            Math.round(xLeft), Math.round(yTop), Math.round(xLeft + rw), Math.round(yTop + rh),
        )

        val banSize = 0.211f * s
        val bans = ArrayList<DraftCore.Rect>(6)
        for (side in 0 until 2) {
            val x = if (side == 0) left + 1.026f * s else right - 0.719f * s - banSize
            for (i in 0 until 3) {
                bans.add(r(x, top + (0.123f + i * 0.263f) * s, banSize, banSize))
            }
        }

        val cardW = 0.548f * s
        val cardH = 0.469f * s
        val cardY = top + 0.171f * s
        val allyX = floatArrayOf(1.509f, 2.193f, 2.877f)
        val allies = allyX.map { r(left + it * s, cardY, cardW, cardH) }
        val enemies = floatArrayOf(2.364f, 1.772f, 1.162f)
            .map { r(right - it * s - cardW, cardY, cardW, cardH) }
        // The name sits just under the card: measured at 0.60-0.70 units.
        val labels = allyX.map { r(left + it * s, top + 0.596f * s, cardW, 0.105f * s) }

        /*
         * A draft has cards in it. Six flat rectangles of team colour do not:
         * the placeholder is a grey "?" with a name, a pick is artwork, and
         * both carry detail. A frame whose card zone is uniform is a colour
         * chart, a loading screen, or a strip found somewhere it is not.
         */
        var textured = 0
        for (rect in allies + enemies) if (DraftCore.detail(frame, rect) >= DraftCore.MIN_DETAIL) textured++
        if (textured < 2) reasons += "card zone is flat ($textured/6 textured)"

        val box = plateBox(frame, content, top, s)
        val plateText: DraftCore.Rect
        val plateMode: DraftCore.Rect
        val plateMap: DraftCore.Rect
        if (box != null) {
            // The icon takes the left quarter of the box; the two lines split
            // the rest, mode above map. Measured on the fixtures.
            val textLeft = box.left + (box.width * 0.24f).toInt()
            plateText = DraftCore.Rect(textLeft, box.top, box.right, box.bottom)
            val split = box.top + (box.height * 0.56f).toInt()
            plateMode = DraftCore.Rect(textLeft, box.top, box.right, split)
            plateMap = DraftCore.Rect(textLeft, split, box.right, box.bottom)
        } else {
            // Positioned from the content's corner in strip units, which is
            // the best available guess and is reported as one: `plateFound`
            // is false, and the recogniser's result is treated accordingly.
            plateText = r(left + 0.649f * s, content.top + 0.079f * s, 1.268f * s, 0.316f * s)
            plateMode = r(left + 0.689f * s, content.top + 0.118f * s, 1.132f * s, 0.123f * s)
            plateMap = r(left + 0.689f * s, content.top + 0.285f * s, 1.132f * s, 0.088f * s)
        }

        val checks = 5
        val confidence = (checks - reasons.size).toFloat() / checks
        return Located(
            bans = bans,
            allies = allies,
            enemies = enemies,
            allyLabels = labels,
            plateText = plateText,
            plateMode = plateMode,
            plateMap = plateMap,
            content = DraftCore.Rect(left, content.top, right, rows.last + 1),
            unit = s.toInt(),
            seam = edges.seam,
            plateFound = box != null,
            detected = reasons.isEmpty(),
            confidence = confidence,
            reasons = reasons,
        )
    }

    private fun notFound(frame: DraftCore.Image, reasons: List<String>): Located {
        val none = DraftCore.Rect(0, 0, 0, 0)
        return Located(
            bans = List(6) { none },
            allies = List(3) { none },
            enemies = List(3) { none },
            allyLabels = List(3) { none },
            plateText = none,
            plateMode = none,
            plateMap = none,
            content = DraftCore.whole(frame),
            unit = 0,
            seam = -1,
            plateFound = false,
            detected = false,
            confidence = 0f,
            reasons = reasons,
        )
    }

    /**
     * Which ally card is the reader's own, or null.
     *
     * The game colours the name under each card: the reader's own name is
     * cream, a team-mate who has picked is green, and a team-mate who has not
     * is grey. Measured on the fixtures — (235, 222, 204) under the reader's
     * card in both, (141, 197, 167) under the team-mate's. Only ally cards are
     * asked, so a cream enemy name cannot confuse it.
     *
     * Why it matters: the board takes two team-mates, and the reader's own
     * pick is not one of them. Fed in as an ally it takes a slot and skews the
     * scoring toward what the reader already has.
     */
    fun selfIndex(frame: DraftCore.Image, at: Located): Int? {
        if (!at.detected) return null
        var found: Int? = null
        for ((i, label) in at.allyLabels.withIndex()) {
            var bright = 0
            var cream = 0
            val x0 = label.left.coerceIn(0, frame.width - 1)
            val x1 = label.right.coerceIn(x0 + 1, frame.width)
            val y0 = label.top.coerceIn(0, frame.height - 1)
            val y1 = label.bottom.coerceIn(y0 + 1, frame.height)
            for (y in y0 until y1) for (x in x0 until x1) {
                val p = frame.pixels[y * frame.width + x]
                val r = (p shr 16) and 0xFF
                val g = (p shr 8) and 0xFF
                val b = p and 0xFF
                if (r + g + b < 450) continue
                bright++
                if (r >= 200 && g >= 195 && b >= 160 && g < r + 20) cream++
            }
            // A label is a few hundred bright pixels at the fixture's size;
            // scaled to the strip so a bigger screen is not a stricter test.
            val minBright = (at.unit * at.unit / 260).coerceAtLeast(40)
            if (bright < minBright || cream * 10 < bright * 6) continue
            if (found != null) return null // two cream names: say nothing
            found = i
        }
        return found
    }
}
