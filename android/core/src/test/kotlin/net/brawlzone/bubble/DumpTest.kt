package net.brawlzone.bubble

import org.junit.Test

/** Prints what every slot actually scores, to tune against. */
class DumpTest {
    @Test
    fun dump() {
        DraftCoreTest.buildTables()
        val names = DraftCoreTest.names()
        for (file in listOf("draft-picked.jpg", "draft-partial.jpg")) {
            val f = DraftCoreTest.frame(file)
            val at = DraftLayout.locate(f)
            println("$file: detected=${at.detected} unit=${at.unit} seam=${at.seam} plate=${at.plateFound} content=${at.content} reasons=${at.reasons}")
            for (i in 0 until 6) {
                val r = at.bans[i]
                println("  ban $i dark=%.2f sat=%.2f -> ".format(DraftCore.darkFraction(f, r), DraftCore.saturatedFraction(f, r)) +
                    DraftCoreTest.top(f, r, DraftLayout.BAN_QUERIES, DraftCoreTest.icons(), names, DraftLayout.ICON_N))
            }
            for ((label, rects) in listOf("ally" to at.allies, "enemy" to at.enemies)) {
                for ((i, r) in rects.withIndex()) {
                    println("  $label $i dark=%.2f sat=%.2f -> ".format(DraftCore.darkFraction(f, r), DraftCore.saturatedFraction(f, r)) +
                        DraftCoreTest.top(f, r, DraftLayout.CARD_QUERIES, DraftCoreTest.portraits(), names))
                }
            }
            println("  self=${DraftLayout.selfIndex(f, at)}")
        }
    }
}
