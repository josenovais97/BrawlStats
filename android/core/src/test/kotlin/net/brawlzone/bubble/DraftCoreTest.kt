package net.brawlzone.bubble

import java.io.File
import java.net.URL
import javax.imageio.ImageIO
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test

/**
 * The draft matcher, run against real captures of a real draft.
 *
 * This test is the reason to believe anything about this feature. Recognition
 * used to be verifiable only by installing the app, opening a match and
 * looking, so four releases of "fixes" went out on reasoning alone — and the
 * two that were wrong were wrong in ways a second of this would have caught.
 *
 * The frames in `resources/` are screenshots of an actual Ranked draft on
 * Spiraling Out, with the expectations below read off them by eye. The
 * reference art is downloaded to the build directory rather than committed:
 * it is what the app itself fetches at runtime, so using anything else would
 * be testing a different input than production sees.
 */
class DraftCoreTest {

    companion object {
        /**
         * Ids from the game's own catalogue, checked against it rather than
         * remembered. Three of these were wrong on the first run and the test
         * blamed the matcher for finding the right brawler.
         */
        const val RICO = 16000004
        const val GRIFF = 16000050
        const val BULL = 16000002
        const val SURGE = 16000038
        const val NORI = 16000107

        private const val PORTRAIT = "https://cdn.brawlify.com/brawlers/borderless/%d.png"
        private const val ICON = "https://cdn.brawlify.com/brawlers/emoji/%d.png"

        private lateinit var portraits: Map<Int, List<FloatArray>>
        private lateinit var icons: Map<Int, List<FloatArray>>
        private lateinit var roster: List<Int>

        /**
         * The whole roster, because the margin is the point.
         *
         * Matching against five candidates proves nothing: the claim under test
         * is that the right brawler beats *every other one* by a clear distance,
         * and that only means something with all of them present.
         */
        @BeforeClass
        @JvmStatic
        fun buildTables() {
            val cache = File("build/vision-refs").apply { mkdirs() }
            roster = fetchRoster(cache)
            assertTrue("roster looks too small: ${roster.size}", roster.size > 80)

            val p = HashMap<Int, List<FloatArray>>()
            val i = HashMap<Int, List<FloatArray>>()
            for (id in roster) {
                download(File(cache, "p$id.png"), PORTRAIT, id)?.let {
                    p[id] = DraftCore.variants(
                        it,
                        DraftLayout.PORTRAIT_ZOOMS,
                        DraftLayout.PORTRAIT_FX,
                        DraftLayout.PORTRAIT_FY,
                    )
                }
                download(File(cache, "i$id.png"), ICON, id)?.let { art ->
                    val v = ArrayList<FloatArray>()
                    for (bg in intArrayOf(DraftLayout.TEAM_BLUE, DraftLayout.TEAM_RED)) {
                        v += DraftCore.variants(
                            over(art, bg),
                            DraftLayout.ICON_ZOOMS,
                            DraftLayout.ICON_FX,
                            DraftLayout.ICON_FY,
                            DraftLayout.ICON_N,
                        )
                    }
                    i[id] = v
                }
            }
            portraits = p
            icons = i
            assertTrue("portraits: ${p.size}", p.size > 80)
            assertTrue("icons: ${i.size}", i.size > 80)
        }

        private fun fetchRoster(cache: File): List<Int> {
            val file = File(cache, "brawlers.json")
            if (!file.exists() || file.length() < 500) {
                URL("https://api.brawlapi.com/v1/brawlers").openStream()
                    .use { input -> file.outputStream().use { input.copyTo(it) } }
            }
            // 16000\d{3}, not 160000\d\d: the narrower pattern silently drops
            // every brawler from 16000100 up, which is the newest ones — and a
            // brawler missing from the table cannot be matched, so the failure
            // reads as "the matcher did not recognise it".
            return Regex("\"id\":(16000\\d{3})").findAll(file.readText())
                .map { it.groupValues[1].toInt() }
                .distinct()
                .toList()
        }

        private fun download(file: File, template: String, id: Int): DraftCore.Image? {
            if (!file.exists() || file.length() < 300) {
                try {
                    val conn = URL(String.format(template, id)).openConnection()
                    conn.setRequestProperty("User-Agent", "BrawlZone-test")
                    conn.getInputStream().use { input ->
                        file.outputStream().use { input.copyTo(it) }
                    }
                } catch (e: Exception) {
                    file.delete()
                    return null
                }
            }
            return read(file)
        }

        private fun read(file: File): DraftCore.Image? {
            val img = try {
                ImageIO.read(file)
            } catch (e: Exception) {
                null
            } ?: return null
            val pixels = IntArray(img.width * img.height)
            img.getRGB(0, 0, img.width, img.height, pixels, 0, img.width)
            return DraftCore.Image(pixels, img.width, img.height)
        }

        /** Mirrors DraftVision.over — transparency onto a flat team colour. */
        private fun over(image: DraftCore.Image, background: Int): DraftCore.Image {
            val out = IntArray(image.pixels.size)
            val br = (background shr 16) and 0xFF
            val bg = (background shr 8) and 0xFF
            val bb = background and 0xFF
            for (k in image.pixels.indices) {
                val px = image.pixels[k]
                val a = (px ushr 24) and 0xFF
                if (a == 255) { out[k] = px; continue }
                val r = (((px shr 16) and 0xFF) * a + br * (255 - a)) / 255
                val g = (((px shr 8) and 0xFF) * a + bg * (255 - a)) / 255
                val b = ((px and 0xFF) * a + bb * (255 - a)) / 255
                out[k] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
            return DraftCore.Image(out, image.width, image.height)
        }

        fun icons() = icons
        fun portraits() = portraits

        fun names(): Map<Int, String> {
            val file = File("build/vision-refs/brawlers.json")
            return Regex("\"id\":(160000\\d\\d),\"avatarId\":\\d+,\"name\":\"([^\"]+)\"")
                .findAll(file.readText())
                .associate { it.groupValues[1].toInt() to it.groupValues[2] }
        }

        /** Top three, for tuning. */
        fun top(
            frame: DraftCore.Image,
            rect: DraftCore.Rect,
            queries: Array<DraftCore.Crop>,
            table: Map<Int, List<FloatArray>>,
            names: Map<Int, String>,
            nn: Int = DraftCore.N,
        ): String {
            val qs = queries.map { DraftCore.describe(frame, DraftCore.crop(rect, it), nn) }
            val scored = table.map { (id, vs) ->
                var s = -2f
                for (v in vs) for (q in qs) { val x = DraftCore.score(q, v); if (x > s) s = x }
                id to s
            }.sortedByDescending { it.second }
            return scored.take(3).joinToString(" | ") { "${names[it.first] ?: it.first} %.2f".format(it.second) }
        }

        fun frame(name: String): DraftCore.Image {
            val stream = DraftCoreTest::class.java.classLoader!!.getResourceAsStream(name)
                ?: error("missing test frame $name")
            val img = stream.use { ImageIO.read(it) }
            val pixels = IntArray(img.width * img.height)
            img.getRGB(0, 0, img.width, img.height, pixels, 0, img.width)
            return DraftCore.Image(pixels, img.width, img.height)
        }
    }

    private fun ban(frame: DraftCore.Image, index: Int): DraftCore.Match {
        val side = if (index < 3) DraftLayout.BAN_X[0] else DraftLayout.BAN_X[1]
        val r = DraftCore.Region(
            side,
            DraftLayout.BAN_Y + (index % 3) * DraftLayout.BAN_PITCH,
            DraftLayout.BAN_SIZE_X,
            DraftLayout.BAN_SIZE_Y,
        )
        return DraftCore.identify(
            frame, DraftCore.rectOf(frame, r), DraftLayout.BAN_QUERIES, icons,
            DraftLayout.BAN_MIN_SCORE, DraftLayout.BAN_MIN_MARGIN, DraftLayout.ICON_N,
        )
    }

    private fun ally(frame: DraftCore.Image, index: Int): DraftCore.Match {
        val r = DraftCore.Region(
            DraftLayout.ALLY_X[index], DraftLayout.CARD_Y, DraftLayout.CARD_W, DraftLayout.CARD_H,
        )
        return DraftCore.identify(
            frame, DraftCore.rectOf(frame, r), DraftLayout.CARD_QUERIES, portraits,
            DraftLayout.CARD_MIN_SCORE, DraftLayout.CARD_MIN_MARGIN,
        )
    }

    @Test
    fun `reads the picks off a real draft`() {
        val f = frame("draft-picked.jpg")
        val first = ally(f, 0)
        val second = ally(f, 1)
        assertEquals("first pick", RICO, first.id)
        assertEquals("second pick", GRIFF, second.id)
        assertTrue("Rico margin ${first.margin}", first.margin > 0.25f)
        assertTrue("Griff margin ${second.margin}", second.margin > 0.25f)
    }

    @Test
    fun `reads the bans off a real draft`() {
        val f = frame("draft-picked.jpg")
        assertEquals("ban 1", BULL, ban(f, 0).id)
        assertEquals("ban 2", SURGE, ban(f, 1).id)
        assertEquals("ban 3", NORI, ban(f, 2).id)
    }

    @Test
    fun `an unpicked card is reported empty, not guessed`() {
        // In this frame the second player has not picked: the card is the grey
        // "?" placeholder. A guess here is worse than a gap, because the board
        // would hold a brawler nobody chose.
        val f = frame("draft-partial.jpg")
        assertEquals(RICO, ally(f, 0).id)
        assertNull("second card should be empty", ally(f, 1).id)
    }

    @Test
    fun `a slot the panel is covering is refused`() {
        // The overlay sits over the right-hand half of the screen in this
        // capture. Whatever is under it must not become a confident answer.
        val f = frame("draft-partial.jpg")
        assertNull("covered card should be refused", ally(f, 2).id)
    }

    @Test
    fun `bans are matched against the icon art, not the portraits`() {
        // The two reference sets are not interchangeable, and the whole ban
        // feature failed for weeks against the wrong one. If someone points
        // bans at the portrait table again, this catches it.
        val f = frame("draft-picked.jpg")
        val wrong = DraftCore.identify(
            f,
            DraftCore.rectOf(
                f,
                DraftCore.Region(
                    DraftLayout.BAN_X[0], DraftLayout.BAN_Y,
                    DraftLayout.BAN_SIZE_X, DraftLayout.BAN_SIZE_Y,
                ),
            ),
            DraftLayout.BAN_QUERIES, portraits,
            DraftLayout.BAN_MIN_SCORE, DraftLayout.BAN_MIN_MARGIN,
        )
        assertNull("portraits must not answer a ban icon", wrong.id)
    }
}
