package net.brawlzone.bubble

import org.junit.Test

/** Temporary: prints what every slot actually scores, to tune against. */
class DumpTest {
    @Test
    fun dump() {
        DraftCoreTest.buildTables()
        val f = DraftCoreTest.frame("draft-picked.jpg")
        val names = DraftCoreTest.names()
        for (i in 0 until 3) {
            val r = DraftCore.rectOf(f, DraftLayout.banRegion(i))
            println("ban $i -> " + DraftCoreTest.top(f, r, DraftLayout.BAN_QUERIES, DraftCoreTest.icons(), names, DraftLayout.ICON_N))
        }
        for (i in 0 until 3) {
            val r = DraftCore.rectOf(f, DraftLayout.allyRegion(i))
            println("ally $i -> " + DraftCoreTest.top(f, r, DraftLayout.CARD_QUERIES, DraftCoreTest.portraits(), names))
        }
    }
}
