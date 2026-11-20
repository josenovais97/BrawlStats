package net.brawlzone.bubble

import android.content.Context
import org.json.JSONArray
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Ranked games kept on the phone (1.40), per player tag.
 *
 * The battle log only ever holds the last 25 games, so each hourly look adds
 * the ones it has not seen and the app builds its own short history. That
 * history feeds the daily goal and streak (Goal), each friend's week
 * (Friends) and the season tally (Season).
 *
 * Eight days are kept, enough for "today" and "this week". A game older than
 * that is never treated as new, so a player who stops for a fortnight does
 * not have the same 25 games counted again on every check.
 */
object Tally {

    /** 1.42 adds the mode key and the star player flag, for the squad feed (older rows have neither). */
    data class Battle(val at: Long, val win: Boolean, val brawler: String?, val mode: String? = null, val star: Boolean = false)

    private const val PREFS = "brawlzone-tally"
    private const val DAY_MS = 24L * 60 * 60 * 1000
    private const val KEEP_MS = 8 * DAY_MS
    private val BATTLE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'")

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun time(raw: String): Long? =
        runCatching { LocalDateTime.parse(raw, BATTLE_TIME).toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull()

    fun battles(context: Context, tag: String): List<Battle> {
        val raw = prefs(context).getString("b_$tag", null) ?: return emptyList()
        val a = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val row = a.optJSONArray(i) ?: return@mapNotNull null
            Battle(
                row.optLong(0),
                row.optInt(1) == 1,
                row.optString(2).takeIf { it.isNotEmpty() },
                row.optString(3).takeIf { it.isNotEmpty() },
                row.optInt(4) == 1,
            )
        }
    }

    /** Whether this tag has been looked at before (its first look announces nothing). */
    fun known(context: Context, tag: String): Boolean = prefs(context).contains("b_$tag")

    /** Adds the games not seen before and returns only those, oldest first. */
    fun merge(context: Context, tag: String, games: List<Me.Game>): List<Battle> {
        val known = battles(context, tag)
        val seen = known.mapTo(HashSet()) { it.at }
        val cutoff = System.currentTimeMillis() - KEEP_MS
        val fresh = games
            .mapNotNull { g -> time(g.time)?.let { Battle(it, g.win, g.brawler, g.mode, g.star) } }
            .filter { it.at >= cutoff && it.at !in seen }
            .distinctBy { it.at }
            .sortedBy { it.at }
        val all = (known + fresh).filter { it.at >= cutoff }.sortedBy { it.at }
        val out = JSONArray()
        for (b in all) {
            out.put(JSONArray().put(b.at).put(if (b.win) 1 else 0).put(b.brawler ?: "").put(b.mode ?: "").put(if (b.star) 1 else 0))
        }
        prefs(context).edit().putString("b_$tag", out.toString()).apply()
        return fresh
    }

    /** Wins and losses this week, Monday to now (1.42: the weekly duel's week; was the last seven days). */
    fun week(context: Context, tag: String): Pair<Int, Int> {
        val since = Duel.weekStart().toInstant().toEpochMilli()
        val list = battles(context, tag).filter { it.at >= since }
        val wins = list.count { it.win }
        return wins to list.size - wins
    }

    fun forget(context: Context, tag: String) {
        prefs(context).edit().remove("b_$tag").apply()
    }
}
