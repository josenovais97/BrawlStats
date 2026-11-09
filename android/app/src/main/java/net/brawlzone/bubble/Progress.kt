package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject
import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

/**
 * Rank-ups and the Sunday recap (1.40), from the player's own Ranked games.
 *
 * Rank-up: only when the player passes the best rank they have held this
 * season, so winning and losing around a boundary cannot announce the same
 * rank twice; the best resets when a new season starts.
 *
 * Recap: every hourly check adds the Ranked games still in the battle log to
 * this week's tally (each counted once), and on Sunday from 18:00, if at
 * least three games were played, one notification sums the week up.
 */
object Progress {

    private const val KEY_BEST = "rank_best"
    private const val KEY_BEST_TAG = "rank_best_tag"
    private const val KEY_BEST_SEASON = "rank_best_season"

    private const val KEY_WEEK = "week_key"
    private const val KEY_WEEK_TAG = "week_tag"
    private const val KEY_WEEK_SEEN = "week_seen"
    private const val KEY_WEEK_WINS = "week_wins"
    private const val KEY_WEEK_LOSSES = "week_losses"
    private const val KEY_WEEK_ELO = "week_elo_start"
    private const val KEY_WEEK_BRAWLERS = "week_brawlers"
    private const val KEY_WEEK_SENT = "week_sent"

    private val BATTLE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'")

    fun check(context: Context, me: Me.Data, season: Int?, post: Boolean) {
        rankUp(context, me, season, post)
        week(context, me, post)
    }

    private fun rankUp(context: Context, me: Me.Data, season: Int?, post: Boolean) {
        if (me.rankIndex < 0 || me.rank == null) return
        val p = Alerts.prefs(context)
        val sameTag = p.getString(KEY_BEST_TAG, null) == me.tag
        val sameSeason = season == null || p.getInt(KEY_BEST_SEASON, -1) == season
        val best = if (sameTag && sameSeason) p.getInt(KEY_BEST, -1) else -1
        if (best < 0) {
            // First look for this tag or season: remember, announce nothing.
            p.edit().putInt(KEY_BEST, me.rankIndex).putString(KEY_BEST_TAG, me.tag)
                .putInt(KEY_BEST_SEASON, season ?: -1).apply()
            return
        }
        if (me.rankIndex <= best) return
        p.edit().putInt(KEY_BEST, me.rankIndex).apply()
        Store.happyMoment(context)
        if (!post) return
        val local = AppLang.wrap(context)
        val wins = me.winsToNext
        val text = if (wins != null && wins >= 2 && me.next != null) {
            local.getString(R.string.alert_rankup_text, wins, me.next)
        } else {
            local.getString(R.string.alert_rankup_plain)
        }
        Notify.postProgress(context, 7101, local.getString(R.string.alert_rankup_title, me.rank), text)
    }

    private fun week(context: Context, me: Me.Data, post: Boolean) {
        val zone = ZoneId.systemDefault()
        val now = LocalDateTime.now(zone)
        val monday = now.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val weekKey = monday.toString()
        val p = Alerts.prefs(context)
        if (p.getString(KEY_WEEK, null) != weekKey || p.getString(KEY_WEEK_TAG, null) != me.tag) {
            p.edit()
                .putString(KEY_WEEK, weekKey)
                .putString(KEY_WEEK_TAG, me.tag)
                .putStringSet(KEY_WEEK_SEEN, emptySet())
                .putInt(KEY_WEEK_WINS, 0)
                .putInt(KEY_WEEK_LOSSES, 0)
                .putInt(KEY_WEEK_ELO, me.elo ?: -1)
                .putString(KEY_WEEK_BRAWLERS, "{}")
                .putBoolean(KEY_WEEK_SENT, false)
                .apply()
        }
        val weekStart = monday.atStartOfDay(zone).toInstant()
        val seen = HashSet(p.getStringSet(KEY_WEEK_SEEN, emptySet()) ?: emptySet())
        var wins = p.getInt(KEY_WEEK_WINS, 0)
        var losses = p.getInt(KEY_WEEK_LOSSES, 0)
        val brawlers = runCatching { JSONObject(p.getString(KEY_WEEK_BRAWLERS, "{}") ?: "{}") }.getOrDefault(JSONObject())
        var changed = false
        for (game in me.list) {
            val at = runCatching { LocalDateTime.parse(game.time, BATTLE_TIME).toInstant(ZoneOffset.UTC) }.getOrNull() ?: continue
            if (at.isBefore(weekStart) || game.time in seen) continue
            seen += game.time
            if (game.win) wins += 1 else losses += 1
            game.brawler?.let { name ->
                val row = brawlers.optJSONArray(name) ?: org.json.JSONArray().put(0).put(0)
                row.put(0, row.optInt(0) + 1)
                if (game.win) row.put(1, row.optInt(1) + 1)
                brawlers.put(name, row)
            }
            changed = true
        }
        if (changed) {
            p.edit()
                .putStringSet(KEY_WEEK_SEEN, seen.toList().takeLast(200).toSet())
                .putInt(KEY_WEEK_WINS, wins)
                .putInt(KEY_WEEK_LOSSES, losses)
                .putString(KEY_WEEK_BRAWLERS, brawlers.toString())
                .apply()
        }

        val sundayEvening = now.dayOfWeek == DayOfWeek.SUNDAY && now.hour >= 18
        if (!sundayEvening || p.getBoolean(KEY_WEEK_SENT, false) || wins + losses < 3) return
        p.edit().putBoolean(KEY_WEEK_SENT, true).apply()
        if (!post) return
        val eloStart = p.getInt(KEY_WEEK_ELO, -1)
        val delta = if (eloStart >= 0 && me.elo != null) me.elo - eloStart else null
        postRecap(context, wins, losses, delta, best(brawlers))
    }

    private fun best(brawlers: JSONObject): String? {
        var best: String? = null
        var bestWins = -1
        var bestRate = -1.0
        for (name in brawlers.keys()) {
            val row = brawlers.optJSONArray(name) ?: continue
            val games = row.optInt(0)
            val won = row.optInt(1)
            if (games < 2) continue
            val rate = won.toDouble() / games
            if (won > bestWins || (won == bestWins && rate > bestRate)) {
                best = name
                bestWins = won
                bestRate = rate
            }
        }
        return best
    }

    private fun postRecap(context: Context, wins: Int, losses: Int, delta: Int?, best: String?) {
        val local = AppLang.wrap(context)
        val elo = when {
            delta == null -> "±0"
            delta > 0 -> "+" + NumberFormat.getIntegerInstance().format(delta)
            delta < 0 -> "−" + NumberFormat.getIntegerInstance().format(-delta)
            else -> "±0"
        }
        val text = if (best != null) {
            local.getString(R.string.alert_week_full, wins, losses, elo, best)
        } else {
            local.getString(R.string.alert_week_short, wins, losses, elo)
        }
        Notify.postProgress(context, 7102, local.getString(R.string.alert_week_title), text)
    }

    /** Samples for the test build's button. */
    fun test(context: Context) {
        val local = AppLang.wrap(context)
        val me = Me.last(context)
        val rank = me?.rank ?: "Mythic III"
        val next = me?.next ?: "Legendary I"
        Notify.postProgress(
            context,
            7101,
            local.getString(R.string.alert_rankup_title, rank),
            local.getString(R.string.alert_rankup_text, 18, next),
        )
        postRecap(context, 41, 29, 260, me?.list?.firstOrNull()?.brawler ?: "Stu")
    }
}
