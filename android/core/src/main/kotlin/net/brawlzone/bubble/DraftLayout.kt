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
}
