package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/**
 * The player's own Ranked season, counted on the phone (1.40), for the Season
 * Wrapped card: games, wins, longest win streak, best brawler, peak rank and
 * the elo gained.
 *
 * Counted from the games Tally adds, inside the season's dates. The server
 * has the full season for players its sampler follows and uses whichever
 * count is larger; the streak, the elo gained and the peak come from here.
 * Elo gained is only claimed when counting began in the season's first two
 * days, because elo at the start cannot be known afterwards.
 *
 * When a new season starts the finished one is kept for a week, its Wrapped
 * notification goes out, and its card can still be shared.
 */
object Season {

    data class Stats(
        val number: Int,
        val from: String,
        val to: String?,
        val games: Int,
        val wins: Int,
        val longest: Int,
        val gain: Int?,
        val peak: Int,
        val best: String?,
        /** The top three by wins: name, games, wins. */
        val top: List<Triple<String, Int, Int>> = emptyList(),
    )

    private const val PREFS = "brawlzone-season"
    private const val KEY_NOW = "now"
    private const val KEY_LAST = "last"
    private const val KEEP_LAST_DAYS = 7L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun startMs(day: String): Long? =
        runCatching { LocalDate.parse(day).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()

    /** The hourly check. Off the main thread. */
    fun update(context: Context, me: Me.Data, alerts: Alerts.Data?, fresh: List<Tally.Battle>, post: Boolean) {
        if (alerts == null) return
        val season = alerts.season ?: return
        val p = prefs(context)
        val saved = p.getString(KEY_NOW, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
        val sameTag = saved?.optString("tag") == me.tag
        val now: JSONObject
        if (saved == null || !sameTag || saved.optInt("number") != season.number) {
            if (saved != null && sameTag && saved.optInt("number") < season.number && saved.optInt("games") > 0) {
                saved.put("ended", LocalDate.now(ZoneOffset.UTC).toString())
                p.edit().putString(KEY_LAST, saved.toString()).apply()
                if (post) Notify.postWrapped(context, saved.optInt("number"))
            }
            val start = runCatching { LocalDate.parse(season.startsOn) }.getOrNull()
            val fromStart = start != null && ChronoUnit.DAYS.between(start, LocalDate.now(ZoneOffset.UTC)) <= 1
            now = JSONObject()
                .put("tag", me.tag)
                .put("number", season.number)
                .put("from", season.startsOn)
                .put("to", season.endsOn ?: alerts.nextStartsOn ?: "")
                .put("games", 0).put("wins", 0).put("run", 0).put("longest", 0)
                .put("eloStart", if (fromStart && me.elo != null) me.elo else -1)
                .put("peak", me.rankIndex)
                .put("brawlers", JSONObject())
            // Everything already kept from this season counts, not only what is new.
            count(now, Tally.battles(context, me.tag))
        } else {
            now = saved
            count(now, fresh)
        }
        now.put("peak", maxOf(now.optInt("peak", -1), me.rankIndex))
        if (me.elo != null) now.put("eloLast", me.elo)
        p.edit().putString(KEY_NOW, now.toString()).apply()
    }

    private fun count(now: JSONObject, battles: List<Tally.Battle>) {
        val from = startMs(now.optString("from")) ?: return
        val to = startMs(now.optString("to"))
        val brawlers = now.optJSONObject("brawlers") ?: JSONObject()
        var games = now.optInt("games")
        var wins = now.optInt("wins")
        var run = now.optInt("run")
        var longest = now.optInt("longest")
        for (b in battles.sortedBy { it.at }) {
            if (b.at < from || (to != null && b.at >= to)) continue
            games += 1
            if (b.win) {
                wins += 1
                run += 1
                longest = maxOf(longest, run)
            } else {
                run = 0
            }
            b.brawler?.let { name ->
                val row = brawlers.optJSONArray(name) ?: JSONArray().put(0).put(0)
                row.put(0, row.optInt(0) + 1)
                if (b.win) row.put(1, row.optInt(1) + 1)
                brawlers.put(name, row)
            }
        }
        now.put("games", games).put("wins", wins).put("run", run).put("longest", longest).put("brawlers", brawlers)
    }

    private fun stats(j: JSONObject): Stats {
        val eloStart = j.optInt("eloStart", -1)
        val eloLast = if (j.has("eloLast")) j.optInt("eloLast") else null
        return Stats(
            number = j.optInt("number"),
            from = j.optString("from"),
            to = j.optString("to").takeIf { it.isNotEmpty() },
            games = j.optInt("games"),
            wins = j.optInt("wins"),
            longest = j.optInt("longest"),
            gain = if (eloStart >= 0 && eloLast != null) eloLast - eloStart else null,
            peak = j.optInt("peak", -1),
            best = best(j.optJSONObject("brawlers")),
            top = top(j.optJSONObject("brawlers")),
        )
    }

    fun current(context: Context, tag: String): Stats? {
        val j = prefs(context).getString(KEY_NOW, null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
        return if (j.optString("tag") == tag) stats(j) else null
    }

    /** The season that just ended, for a week after it did. */
    fun finished(context: Context, tag: String): Stats? {
        val j = prefs(context).getString(KEY_LAST, null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
        if (j.optString("tag") != tag) return null
        val ended = runCatching { LocalDate.parse(j.optString("ended")) }.getOrNull() ?: return null
        if (ChronoUnit.DAYS.between(ended, LocalDate.now(ZoneOffset.UTC)) > KEEP_LAST_DAYS) return null
        return stats(j)
    }

    /** What the Wrapped button shares: the finished season while the new one is barely started. */
    fun forCard(context: Context, tag: String): Stats? {
        val now = current(context, tag)
        val last = finished(context, tag)
        return if (last != null && (now == null || now.games < 10)) last else now
    }

    private fun best(brawlers: JSONObject?): String? {
        if (brawlers == null) return null
        var best: String? = null
        var bestWins = -1
        var bestGames = 0
        for (name in brawlers.keys()) {
            val row = brawlers.optJSONArray(name) ?: continue
            val games = row.optInt(0)
            val won = row.optInt(1)
            if (won > bestWins || (won == bestWins && games < bestGames)) {
                best = name
                bestWins = won
                bestGames = games
            }
        }
        return best
    }

    private fun top(brawlers: JSONObject?): List<Triple<String, Int, Int>> {
        if (brawlers == null) return emptyList()
        return brawlers.keys().asSequence().mapNotNull { name ->
            val row = brawlers.optJSONArray(name) ?: return@mapNotNull null
            Triple(name, row.optInt(0), row.optInt(1)).takeIf { it.second > 0 }
        }.sortedWith(compareByDescending<Triple<String, Int, Int>> { it.third }.thenByDescending { it.second })
            .take(3).toList()
    }

    /** The card's address, with what the phone counted for the server to merge. */
    fun cardUrl(context: Context, tag: String, s: Stats?): String {
        val b = Uri.parse("${Http.SITE}/api/bubble/card").buildUpon()
            .appendQueryParameter("kind", "season")
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
        if (s != null) {
            b.appendQueryParameter("n", s.number.toString())
            b.appendQueryParameter("from", s.from)
            s.to?.let { b.appendQueryParameter("to", it) }
            b.appendQueryParameter("g", s.games.toString())
            b.appendQueryParameter("w", s.wins.toString())
            if (s.longest > 0) b.appendQueryParameter("streak", s.longest.toString())
            s.gain?.let { b.appendQueryParameter("gain", it.toString()) }
            if (s.peak >= 0) b.appendQueryParameter("peak", s.peak.toString())
            s.best?.let { b.appendQueryParameter("best", it) }
            if (s.top.isNotEmpty()) {
                val top = JSONArray()
                for ((name, games, wins) in s.top) top.put(JSONArray().put(name).put(games).put(wins))
                b.appendQueryParameter("top", top.toString())
            }
        }
        return b.build().toString()
    }

    fun rankCardUrl(context: Context, tag: String): String =
        Uri.parse("${Http.SITE}/api/bubble/card").buildUpon()
            .appendQueryParameter("kind", "rank")
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
            .build().toString()
}
