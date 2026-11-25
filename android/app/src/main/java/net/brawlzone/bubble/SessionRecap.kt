package net.brawlzone.bubble

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.text.NumberFormat
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The end-of-session recap (1.42, rebuilt in 1.44): when the player stops
 * (45 minutes without a Ranked game after at least three), one notification
 * with the whole session: the record and win rate, elo gained or lost, rank
 * before and after, Star Player count, the MVP brawler, the best run of wins
 * and how long it lasted.
 *
 * 1.42 waited for the background jobs to notice the break, and Android holds
 * those back for hours on many phones; a recap found more than six hours late
 * was dropped, so most never arrived. Since 1.44 every new game re-arms an
 * alarm for 46 minutes after it (inexact, allowed while idle, no special
 * permission), which runs the check right when the break begins. The elo
 * gained is measured from the reading taken just before the session's first
 * game (kept when that game is saved), instead of an hourly log that the same
 * delays left with gaps.
 */
object SessionRecap {

    const val ACTION = "net.brawlzone.bubble.RECAP"
    private const val PREFS = "brawlzone-session"
    private const val GAP_MS = 45 * 60 * 1000L
    private const val MIN_GAMES = 3
    private const val STALE_MS = 12 * 60 * 60 * 1000L
    private const val ALARM_ID = 7601

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * After new games are saved (the hourly check, the bubble's 2-minute look):
     * when they open a new session, keep the elo and rank from just before it;
     * either way, arm the recap for 46 minutes after the newest one.
     */
    fun noteGames(context: Context, tag: String, fresh: List<Tally.Battle>, eloBefore: Int?, rankBefore: String?) {
        if (fresh.isEmpty() || tag.isEmpty()) return
        val first = fresh.minOf { it.at }
        val prev = Tally.battles(context, tag).filter { it.at < first }.maxOfOrNull { it.at }
        if (prev == null || first - prev >= GAP_MS) {
            prefs(context).edit().apply {
                putLong("start_$tag", first)
                if (eloBefore != null && eloBefore > 0) putInt("start_elo_$tag", eloBefore) else remove("start_elo_$tag")
                if (rankBefore != null) putString("start_rank_$tag", rankBefore) else remove("start_rank_$tag")
            }.apply()
        }
        arm(context, fresh.maxOf { it.at } + GAP_MS + 60_000L)
    }

    /** The alarm that looks again when the break should have begun (replaces any earlier one). */
    private fun arm(context: Context, at: Long) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = PendingIntent.getBroadcast(
            context,
            ALARM_ID,
            Intent(context, RecapReceiver::class.java).setAction(ACTION),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val time = at.coerceAtLeast(System.currentTimeMillis() + 60_000L)
        runCatching { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, intent) }
    }

    /** A look now (the 15-minute job and the alarm): only while the player has played in the last three hours. Off the main thread. */
    fun quick(context: Context, post: Boolean) {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return
        val last = Tally.battles(context, tag).maxOfOrNull { it.at } ?: return
        if (System.currentTimeMillis() - last > 3 * 60 * 60 * 1000L) return
        val me = Me.fetch(context) ?: return
        check(context, me, post)
    }

    private data class Session(val games: List<Tally.Battle>)

    /** The newest session in Tally plus the battle log's newest games, or null. */
    private fun latest(context: Context, me: Me.Data): Session? {
        val known = Tally.battles(context, me.tag)
        val seen = known.mapTo(HashSet()) { it.at }
        val extra = me.list.mapNotNull { g -> Tally.of(g) }
            .filter { it.at !in seen }
        val battles = (known + extra).sortedBy { it.at }
        if (battles.isEmpty()) return null
        var start = battles.size - 1
        while (start > 0 && battles[start].at - battles[start - 1].at < GAP_MS) start--
        return Session(battles.subList(start, battles.size))
    }

    fun check(context: Context, me: Me.Data, post: Boolean) {
        val session = latest(context, me)?.games ?: return
        val end = session.last().at
        val now = System.currentTimeMillis()
        if (now - end < GAP_MS) {
            // Still playing: look again when this game's break would begin.
            arm(context, end + GAP_MS + 60_000L)
            return
        }
        if (session.size < MIN_GAMES) return
        val p = prefs(context)
        if (p.getLong("done_${me.tag}", 0L) >= end) return
        p.edit().putLong("done_${me.tag}", end).apply()
        if (!post || now - end > STALE_MS) return
        val (title, text) = compose(context, me, session)
        Notify.postRecap(context, title, text)
        Stats.event(context, "app_recap", mapOf("games" to session.size))
    }

    /** Title and lines: record, elo, rank, Star Player, MVP, best run, time. */
    private fun compose(context: Context, me: Me.Data, session: List<Tally.Battle>): Pair<String, String> {
        val local = AppLang.wrap(context)
        val fmt = NumberFormat.getIntegerInstance(AppLang.locale(AppLang.current(context)))
        val wins = session.count { it.win }
        val losses = session.size - wins
        val p = prefs(context)
        val first = session.first().at
        val sameStart = p.getLong("start_${me.tag}", -1L) == first
        val startElo = if (sameStart && p.contains("start_elo_${me.tag}")) p.getInt("start_elo_${me.tag}", 0) else null
        val elo = when {
            me.elo != null && startElo != null -> (me.elo - startElo).takeIf { abs(it) < 1000 }
            else -> fromLog(context, me, first)
        }
        val signed = elo?.let { (if (it > 0) "+" else if (it < 0) "−" else "±") + fmt.format(abs(it)) }
        val title = (
            if (signed != null) local.getString(R.string.recap_title_elo, wins, losses, signed)
            else local.getString(R.string.recap_title, wins, losses)
            ) + if (wins > losses) " 🔥" else ""

        val lines = mutableListOf<String>()
        lines += "✅ " + local.getString(R.string.recap_record, wins, losses, (wins * 100.0 / session.size).roundToInt())
        val startRank = if (sameStart) p.getString("start_rank_${me.tag}", null) else null
        if (startRank != null && me.rank != null && startRank != me.rank) lines += "📈 $startRank → ${me.rank}"
        val stars = session.count { it.star }
        if (stars > 0) lines += "⭐ " + local.getString(R.string.recap_stars, stars)
        session.filter { it.win && it.brawler != null }.groupBy { it.brawler!! }.maxByOrNull { it.value.size }?.let { (name, list) ->
            lines += "🏆 " + local.getString(R.string.recap_mvp, name, list.size)
        }
        // 1.45: kills and deaths, and the game with the most kills over deaths.
        val fight = Combat.of(session)
        if (fight.games >= 2) {
            lines += "⚔️ " + local.getString(R.string.recap_kd, Combat.ratio(fight.kd), fight.kills, fight.deaths)
            session.filter { it.fought }.maxByOrNull { (it.kills - it.deaths) * 100 + it.kills }?.takeIf { it.kills >= 3 && it.kills > it.deaths }?.let { b ->
                lines += "💥 " + (
                    if (b.deaths == 0) local.getString(R.string.recap_best_clean, b.kills, b.brawler ?: "")
                    else local.getString(R.string.recap_best, b.kills, b.deaths, b.brawler ?: "")
                    ).trim()
            }
        }
        var run = 0
        var best = 0
        for (b in session) {
            run = if (b.win) run + 1 else 0
            best = maxOf(best, run)
        }
        if (best >= 2) lines += "🔥 " + local.getString(R.string.recap_streak, best)
        // A game is about three minutes; the last one's length is added on.
        val minutes = ((session.last().at - first) / 60_000L + 3).toInt()
        lines += "⏱ " + local.getString(R.string.recap_time, minutes)
        return title to lines.joinToString("\n")
    }

    /** 1.42's reading: elo now against the last hourly reading from before the session. */
    private fun fromLog(context: Context, me: Me.Data, start: Long): Int? {
        val now = me.elo ?: return null
        val season = Alerts.last(context)?.season?.number
        val before = EloLog.points(context, me.tag, season).lastOrNull { it.first < start } ?: return null
        return (now - before.second).takeIf { abs(it) < 1000 }
    }

    /**
     * The test build's "Send test notifications" (qa only): the newest games
     * on the phone (up to eight) as a session, posted now with the same lines.
     */
    fun test(context: Context) {
        val me = Me.last(context) ?: return
        val games = Tally.battles(context, me.tag).sortedBy { it.at }.takeLast(8)
        if (games.isEmpty()) return
        val (title, text) = compose(context, me, games)
        Notify.postRecap(context, title, text)
    }
}

/** The recap alarm (1.44): a look at the battle log when the break should have begun. */
class RecapReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SessionRecap.ACTION) return
        val pending = goAsync()
        val app = context.applicationContext
        Thread {
            try {
                runCatching { SessionRecap.quick(app, Alerts.enabled(app)) }
            } finally {
                pending.finish()
            }
        }.start()
    }
}
