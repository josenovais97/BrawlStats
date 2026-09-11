package net.brawlzone.bubble

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The two control-flow defects from the September review, as sequences.
 *
 * Neither needs a phone. The service's job is to follow these rules; these
 * tests are what the rules are.
 */
class ScanFlowTest {

    @Test
    fun `a request that timed out cannot speak after a newer one starts`() {
        val flow = ScanFlow()
        val a = flow.begin(sessionId = 1)
        assertTrue("A times out before its vision pass reports", flow.timedOut(a))
        val b = flow.begin(sessionId = 1)

        // A's vision pass and recogniser both come back late.
        assertFalse("A's reading must be dropped", flow.visionDone(a))
        assertFalse("A's plate must be dropped", flow.plateDone(a))
        assertEquals(ScanFlow.Phase.INVALID, a.phase)

        // B is untouched by any of that.
        assertTrue(flow.visionDone(b))
        assertTrue(flow.plateDone(b))
        assertEquals(ScanFlow.Phase.DONE, b.phase)
    }

    @Test
    fun `starting a request retires the previous one`() {
        val flow = ScanFlow()
        val a = flow.begin(1)
        val b = flow.begin(1)
        assertEquals(ScanFlow.Phase.INVALID, a.phase)
        assertEquals("replaced", a.invalidReason)
        assertFalse(flow.visionDone(a))
        assertTrue(flow.visionDone(b))
    }

    @Test
    fun `the plate only attaches to a reading that was delivered`() {
        val flow = ScanFlow()
        val a = flow.begin(1)
        assertFalse("no brawlers yet, so nothing to attach to", flow.plateDone(a))
        assertTrue(flow.visionDone(a))
        assertTrue(flow.plateDone(a))
        assertFalse("a second answer is ignored", flow.plateDone(a))
    }

    @Test
    fun `a timeout after the brawlers went out is a quiet close`() {
        val flow = ScanFlow()
        val a = flow.begin(1)
        assertTrue(flow.visionDone(a))
        assertFalse("nothing to deliver: the page has the brawlers", flow.timedOut(a))
        assertEquals(ScanFlow.Phase.DONE, a.phase)
        assertFalse("and the late plate is dropped", flow.plateDone(a))
    }

    @Test
    fun `ending the session ends its request and nobody else's`() {
        val flow = ScanFlow()
        val a = flow.begin(sessionId = 7)
        flow.sessionEnded(8)
        assertTrue(a.alive)
        flow.sessionEnded(7)
        assertFalse(a.alive)
        assertEquals("session ended", a.invalidReason)
        assertFalse(flow.busy)
    }

    // ---- the outbox --------------------------------------------------------

    private fun sends(list: List<ScanOutbox.Send>) = list.map {
        when (it) {
            is ScanOutbox.Send.Result -> "result:${it.id}"
            is ScanOutbox.Send.State -> "state:${it.state}"
        }
    }

    @Test
    fun `a result followed by a state with no page is not lost`() {
        // The review's deterministic case: pendingScanJs held one string, and
        // scanState("ready") overwrote scanResult(...) while the panel was shut.
        var t = 0L
        val box = ScanOutbox { t }
        assertTrue(box.result(1, "{}").isEmpty())
        assertTrue(box.state("ready").isEmpty())
        assertEquals(listOf("result:1", "state:ready"), sends(box.pageReady()))
    }

    @Test
    fun `a result is replayed exactly once`() {
        var t = 0L
        val box = ScanOutbox { t }
        box.pageReady()
        assertEquals(listOf("result:1"), sends(box.result(1, "{}")))
        // The page reloads before acknowledging.
        box.pageGone()
        assertEquals(listOf("result:1"), sends(box.pageReady()))
        box.ack(1)
        box.pageGone()
        assertEquals("acknowledged: nothing to replay", emptyList<String>(), sends(box.pageReady()))
    }

    @Test
    fun `nothing is sent to a page that has not said it is ready`() {
        val box = ScanOutbox { 0L }
        assertTrue(box.state("busy").isEmpty())
        assertTrue(box.result(3, "{}").isEmpty())
        assertEquals(listOf("result:3", "state:busy"), sends(box.pageReady()))
    }

    @Test
    fun `an update replaces the retained result under the same id`() {
        val box = ScanOutbox { 0L }
        box.result(4, "{\"ocr\":\"pending\"}")
        assertTrue(box.update(4, "{\"ocr\":\"done\"}").isEmpty())
        assertTrue("an update for a different id is dropped", box.update(3, "{}").isEmpty())
        val out = box.pageReady()
        assertEquals(1, out.size)
        assertEquals("{\"ocr\":\"done\"}", (out[0] as ScanOutbox.Send.Result).json)
    }

    @Test
    fun `a stale result is not replayed into a new draft`() {
        var t = 0L
        val box = ScanOutbox { t }
        box.result(5, "{}")
        t = ScanOutbox.RESULT_TTL_MS + 1
        assertTrue(sends(box.pageReady()).none { it.startsWith("result") })
        assertNull(box.pending)
    }
}
