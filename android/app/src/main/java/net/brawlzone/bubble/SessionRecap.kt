package net.brawlzone.bubble

import android.content.Context
import java.text.NumberFormat

/**
 * The end-of-session recap (1.42): when the player stops (45 minutes without
 * a Ranked game after at least three), one notification with the session's
 * record, the elo it earned when the readings allow, its MVP (the brawler
 * with the most wins) and its best run of wins.
 *
 * Read from Tally's games plus the battle log's newest ones: the 15-minute
 * job looks at the log while the player has been playing recently, so the
 * recap lands soon after the last game, without saving those games itself
 * (the hourly check owns Tally, and the daily goal counts on its "new" ones).
 */
object SessionRecap {

    private const val PREFS = "brawlzone-session"
    private const val GAP_MS = 45 * 60 * 1000L
    private const val MIN_GAMES = 3
    private const val STALE_MS = 6 * 60 * 60 * 1000L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** The 15-minute look: only while the player has played in the last three hours. Off the main thread. */
    fun quick(context: Context, post: Boolean) {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return
        val last = Tally.battles(context, tag).maxOfOrNull { it.at } ?: return
        if (System.currentTimeMillis() - last > 3 * 60 * 60 * 1000L) return
        val me = Me.fetch(context) ?: return
        check(context, me, post)
    }

    fun check(context: Context, me: Me.Data, post: Boolean) {
        val known = Tally.battles(context, me.tag)
        val seen = known.mapTo(HashSet()) { it.at }
        val extra = me.list.mapNotNull { g -> Tally.time(g.time)?.let { Tally.Battle(it, g.win, g.brawler) } }.filter { it.at !in seen }
        val battles = (known + extra).sortedBy { it.at }
        if (battles.isEmpty()) return
        var start = battles.size - 1
        while (start > 0 && battles[start].at - battles[start - 1].at < GAP_MS) start--
        val session = battles.subList(start, battles.size)
        val end = session.last().at
        val now = System.currentTimeMillis()
        if (now - end < GAP_MS || session.size < MIN_GAMES) return
        val p = prefs(context)
        if (p.getLong("done_${me.tag}", 0L) >= end) return
        p.edit().putLong("done_${me.tag}", end).apply()
        if (!post || now - end > STALE_MS) return

        val wins = session.count { it.win }
        var run = 0
        var best = 0
        for (b in session) {
            run = if (b.win) run + 1 else 0
            best = maxOf(best, run)
        }
        val mvp = session.filter { it.win && it.brawler != null }.groupBy { it.brawler!! }.maxByOrNull { it.value.size }?.key
        val elo = eloChange(context, me, session.first().at)
        val local = AppLang.wrap(context)
        val parts = mutableListOf<String>()
        elo?.let { parts += local.getString(R.string.session_elo, (if (it > 0) "+" else if (it < 0) "−" else "±") + NumberFormat.getIntegerInstance().format(kotlin.math.abs(it))) }
        mvp?.let { parts += local.getString(R.string.session_mvp, it) }
        if (best >= 3) parts += local.getString(R.string.session_streak, best)
        val title = local.getString(R.string.session_title, wins, session.size - wins) + if (wins > session.size - wins) " 🔥" else ""
        Notify.postProgress(context, 7600, title, parts.joinToString(" · ").ifEmpty { local.getString(R.string.record_text) })
    }

    /** Elo now against the last reading from before the session began, when there is one. */
    private fun eloChange(context: Context, me: Me.Data, start: Long): Int? {
        val now = me.elo ?: return null
        val season = Alerts.last(context)?.season?.number
        val before = EloLog.points(context, me.tag, season).lastOrNull { it.first < start } ?: return null
        return (now - before.second).takeIf { kotlin.math.abs(it) < 1000 }
    }
}
