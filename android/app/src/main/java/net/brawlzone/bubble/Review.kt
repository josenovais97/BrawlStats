package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * The post-game review (1.40): while the bubble is on screen, a look at the
 * battle log every two minutes (`/api/bubble/review`). A Ranked game that
 * ended since the last look makes the bubble pulse; tapping it opens the
 * panel on the review.
 *
 * The first look only learns where things stand, and a game older than a
 * quarter of an hour is never announced, so starting the bubble after a
 * session does not replay it. Each look also hands the battle log's Ranked
 * games to the daily goal, so "Daily goal done" arrives the minute the
 * winning game ends rather than at the next hourly check.
 */
object Review {

    const val POLL_MS = 2 * 60 * 1000L

    private const val PREFS = "brawlzone-review"
    private const val KEY_TAG = "tag"
    private const val KEY_SINCE = "since"
    private const val KEY_ELO = "elo"
    private const val FRESH_MS = 15 * 60 * 1000L

    data class Found(val json: JSONObject, val win: Boolean)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun fetch(context: Context, tag: String, since: String, elo: Int): JSONObject? {
        val url = Uri.parse("${Http.SITE}/api/bubble/review").buildUpon()
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
            .apply {
                if (since.isNotEmpty()) appendQueryParameter("since", since)
                if (elo > 0) appendQueryParameter("elo", elo.toString())
            }
            .build().toString()
        val body = runCatching { Http.text(url) }.getOrNull() ?: return null
        return runCatching { JSONObject(body) }.getOrNull()
    }

    /** One look, on the calling thread (never the main one). A review to show, or null. */
    fun poll(context: Context): Found? {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return null
        val p = prefs(context)
        val sameTag = p.getString(KEY_TAG, null) == tag
        val since = if (sameTag) p.getString(KEY_SINCE, "").orEmpty() else ""
        val elo = if (sameTag) p.getInt(KEY_ELO, 0) else 0
        val j = fetch(context, tag, since, elo) ?: return null

        val latest = j.optString("latest").takeIf { it.isNotEmpty() && it != "null" }
        val edit = p.edit().putString(KEY_TAG, tag)
        if (latest != null) edit.putString(KEY_SINCE, latest)
        if (!j.isNull("elo") && j.optInt("elo") > 0) edit.putInt(KEY_ELO, j.optInt("elo"))
        edit.apply()

        // The daily goal and the season, straight away.
        val games = j.optJSONArray("games")?.let { a ->
            (0 until a.length()).mapNotNull { i ->
                val g = a.optJSONObject(i) ?: return@mapNotNull null
                Me.Game(g.optString("t"), g.optBoolean("win"), g.optBoolean("star"), g.optString("brawler").takeIf { it.isNotEmpty() && it != "null" })
            }
        }.orEmpty()
        if (games.isNotEmpty()) {
            val firstLook = !Tally.known(context, tag)
            val fresh = Tally.merge(context, tag, games)
            val post = Alerts.enabled(context)
            Goal.record(context, tag, fresh, firstLook, post)
            Me.last(context)?.let { me -> Season.update(context, me, Alerts.last(context), fresh, post) }
        }

        val game = j.optJSONObject("game") ?: return null
        if (since.isEmpty()) return null
        val at = Tally.time(game.optString("battleTime")) ?: return null
        if (System.currentTimeMillis() - at > FRESH_MS) return null
        return decorate(context, tag, game, j.optInt("newGames", 1))
    }

    /**
     * The test build's button: the newest Ranked game, reviewed as if it had
     * just ended, whenever it was played. The elo shown is a stand-in.
     */
    fun test(context: Context): Found? {
        val tag = Account.tag(context).ifEmpty { return null }
        val base = fetch(context, tag, "", 0) ?: return null
        val games = base.optJSONArray("games") ?: return null
        if (games.length() == 0) return null
        val since = games.optJSONObject(1)?.optString("t")?.takeIf { it.isNotEmpty() } ?: "20200101T000000.000Z"
        val won = games.optJSONObject(0)?.optBoolean("win") == true
        val elo = base.optInt("elo")
        val j = fetch(context, tag, since, if (elo > 0) (if (won) elo - 38 else elo + 38) else 0) ?: return null
        val game = j.optJSONObject("game") ?: return null
        return decorate(context, tag, game, 1)
    }

    /** What the panel cannot know: how many games, today's record, the goal. */
    private fun decorate(context: Context, tag: String, game: JSONObject, newGames: Int): Found {
        game.put("newGames", newGames)
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val todays = Tally.battles(context, tag).filter { Instant.ofEpochMilli(it.at).atZone(zone).toLocalDate() == today }
        if (todays.isNotEmpty()) {
            game.put("today", JSONObject().put("wins", todays.count { it.win }).put("losses", todays.count { !it.win }))
        }
        val goal = Goal.goal(context)
        if (goal > 0) {
            game.put(
                "goal",
                JSONObject()
                    .put("wins", Goal.todayWins(context, tag).coerceAtMost(goal))
                    .put("target", goal)
                    .put("streak", Goal.streak(context, tag)),
            )
        }
        return Found(game, game.optString("result") == "victory")
    }
}
