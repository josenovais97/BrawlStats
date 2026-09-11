package net.brawlzone.bubble

/**
 * Who owns a scan, and who a result belongs to. No Android in it, on purpose.
 *
 * The service used to gate every callback on one boolean, `scanning`, which
 * says "a scan is running" and nothing about *which*. So when scan A's text
 * recogniser answered late — after A's watchdog had given up and scan B had
 * started — A's callback found `scanning == true`, delivered A's stale reading
 * as though it were B's, cleared the flag, and B's real answer was thrown away
 * at the door. That is a control-flow defect, not a recognition one, and it
 * fits an intermittent "the second scan does nothing" exactly.
 *
 * Every request now has an identity. A callback carries the request it was
 * started for and asks [ScanFlow] whether that request may still speak; a
 * request stops being able to the moment it times out, is replaced, or the
 * session that produced its frame goes away. The rules are small enough to
 * test in a few lines each, and `ScanFlowTest` runs the sequence above and
 * asserts that A cannot touch B.
 */
class ScanFlow {

    /** Where one request is in its life. */
    enum class Phase {
        /** Frame captured; the vision pass has not reported yet. */
        READING,
        /** Brawlers delivered; the plate is still with the recogniser. */
        AWAITING_PLATE,
        /** Everything this request will ever say has been said. */
        DONE,
        /** Superseded, timed out, or its session ended. Says nothing more. */
        INVALID,
    }

    class Request internal constructor(val id: Long, val sessionId: Long) {
        @Volatile
        var phase: Phase = Phase.READING
            internal set

        /** Why it went invalid, for the diagnostics record. */
        @Volatile
        var invalidReason: String? = null
            internal set

        val alive: Boolean get() = phase != Phase.INVALID && phase != Phase.DONE
    }

    private var nextId = 1L

    /** The one request that may still change what the reader sees. */
    var current: Request? = null
        private set

    /**
     * Starts a request for a frame from `sessionId`, retiring whatever was
     * current. Retiring is what makes a late callback harmless: it checks its
     * own request and finds it invalid, whatever the newer one is doing.
     */
    fun begin(sessionId: Long): Request {
        current?.let { invalidate(it, "replaced") }
        val r = Request(nextId++, sessionId)
        current = r
        return r
    }

    /** The vision pass finished for `r`. True if its reading may be delivered. */
    fun visionDone(r: Request): Boolean {
        if (r !== current || r.phase != Phase.READING) return false
        r.phase = Phase.AWAITING_PLATE
        return true
    }

    /**
     * The recogniser answered for `r`. True if the answer may be attached to
     * the reading already delivered — which it only can be if `r` is still the
     * current request and its brawlers went out first.
     */
    fun plateDone(r: Request): Boolean {
        if (r !== current || r.phase != Phase.AWAITING_PLATE) return false
        r.phase = Phase.DONE
        return true
    }

    /**
     * `r` ran out of time. True if the caller should deliver what it has:
     * a reading that never reached the page is worth more than a clean state.
     *
     * A request that already delivered its brawlers and is only waiting on the
     * plate is closed quietly — the page has what it needs and a timeout there
     * is a plate that will not be read, not a scan that failed.
     */
    fun timedOut(r: Request): Boolean {
        if (r !== current) return false
        return when (r.phase) {
            Phase.READING -> { r.phase = Phase.INVALID; r.invalidReason = "timeout"; true }
            Phase.AWAITING_PLATE -> { r.phase = Phase.DONE; false }
            else -> false
        }
    }

    /** Ends the current request for a reason that is not its own completion. */
    fun invalidateCurrent(reason: String) {
        current?.let { invalidate(it, reason) }
    }

    /** Ends every request that was reading from `sessionId`. */
    fun sessionEnded(sessionId: Long) {
        val r = current ?: return
        if (r.sessionId == sessionId) invalidate(r, "session ended")
    }

    private fun invalidate(r: Request, reason: String) {
        if (r.phase == Phase.INVALID) return
        r.phase = Phase.INVALID
        r.invalidReason = reason
    }

    /** Whether a scan is in progress, for the button's label. */
    val busy: Boolean get() = current?.phase == Phase.READING
}

/**
 * What the page has been told, and what it still has to be told.
 *
 * The service's previous version held one string, `pendingScanJs`, for
 * whatever it last failed to deliver — and a scan's delivery is two messages,
 * the result and then a status. With the panel shut, the second overwrote the
 * first, so reopening the panel replayed `scanState("ready")` and the reading
 * that recognition had produced correctly was gone. That is a deterministic
 * loss of a successful scan, and it happens on the ordinary path: tap Scan,
 * close the panel, look at the game, reopen it.
 *
 * Results and status are now different things. A result is retained until the
 * page acknowledges it by id; status is only ever the latest word. And nothing
 * is sent until the page says it is ready — `onPageFinished` says the document
 * loaded, not that the handlers exist, and a call into a handler that is not
 * there yet is silently nothing.
 */
class ScanOutbox(private val now: () -> Long) {

    /** One retained result: what to send, and when it was produced. */
    class Result(val id: Long, val json: String, val at: Long)

    /** Something to evaluate in the page. */
    sealed class Send {
        data class Result(val id: Long, val json: String) : Send()
        data class State(val state: String) : Send()
    }

    private var ready = false
    private var unacked: Result? = null
    private var lastState: String? = null

    /** The page is up and its handlers are installed. Replays what it missed. */
    fun pageReady(): List<Send> {
        ready = true
        return flush()
    }

    /** The page went away; anything from now on is held. */
    fun pageGone() {
        ready = false
    }

    /**
     * A result to deliver. Held until acknowledged, so a page that is not
     * there gets it when it is, and a page that is there but loses it — a
     * reload mid-scan — gets it again on its next `pageReady`.
     */
    fun result(id: Long, json: String): List<Send> {
        unacked = Result(id, json, now())
        return flush()
    }

    /** A later message about the same result replaces the retained one. */
    fun update(id: Long, json: String): List<Send> {
        val held = unacked
        if (held != null && held.id != id) return emptyList()
        unacked = Result(id, json, held?.at ?: now())
        return flush()
    }

    fun state(state: String): List<Send> {
        lastState = state
        return if (ready) listOf(Send.State(state)) else emptyList()
    }

    /** The page has applied result `id`. Anything older is also done with. */
    fun ack(id: Long) {
        val held = unacked ?: return
        if (held.id <= id) unacked = null
    }

    /** Whether a result is still waiting for the page. For diagnostics. */
    val pending: Long? get() = unacked?.id

    private fun flush(): List<Send> {
        if (!ready) return emptyList()
        val out = ArrayList<Send>(2)
        unacked?.let {
            if (now() - it.at > RESULT_TTL_MS) {
                // A draft has moved on by now; an old board is worse than none.
                unacked = null
            } else {
                out += Send.Result(it.id, it.json)
            }
        }
        lastState?.let { out += Send.State(it) }
        return out
    }

    companion object {
        /**
         * How long a reading stays worth showing. A draft phase is under a
         * minute; a reading older than this describes a board that is gone.
         */
        const val RESULT_TTL_MS = 120_000L
    }
}
