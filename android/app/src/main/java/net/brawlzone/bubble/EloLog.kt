package net.brawlzone.bubble

import android.content.Context
import org.json.JSONArray
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * The player's elo through the season (1.42), for the season graph on My
 * season and the My rank widget.
 *
 * The hourly check writes a reading whenever the elo moved (or six hours
 * passed), per tag and season; the site adds one reading a day for players
 * its sampler follows (/api/bubble/seasons `series`, kept by Versus), which
 * covers the days before the app was installed or updated.
 */
object EloLog {

    private const val PREFS = "brawlzone-elo"
    private const val MAX_POINTS = 600
    private const val QUIET_MS = 6 * 60 * 60 * 1000L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun key(tag: String, season: Int) = "s_${tag}_$season"

    /** From the hourly check. */
    fun record(context: Context, tag: String, season: Int?, elo: Int?) {
        if (season == null || elo == null || elo < 0) return
        val p = prefs(context)
        val list = read(p.getString(key(tag, season), null))
        val now = System.currentTimeMillis()
        val last = list.lastOrNull()
        if (last != null && last.second == elo && now - last.first < QUIET_MS) return
        val next = (list + (now to elo)).takeLast(MAX_POINTS)
        val out = JSONArray()
        for ((t, e) in next) out.put(JSONArray().put(t).put(e))
        p.edit().putString(key(tag, season), out.toString()).apply()
    }

    private fun read(raw: String?): List<Pair<Long, Int>> {
        val a = raw?.let { runCatching { JSONArray(it) }.getOrNull() } ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val row = a.optJSONArray(i) ?: return@mapNotNull null
            row.optLong(0) to row.optInt(1)
        }
    }

    /** The phone's readings and the site's daily ones (at noon UTC), oldest first. */
    fun points(context: Context, tag: String, season: Int?): List<Pair<Long, Int>> {
        if (season == null) return emptyList()
        val local = read(prefs(context).getString(key(tag, season), null))
        val daily = Versus.series(context, season).mapNotNull { (day, elo) ->
            runCatching { LocalDate.parse(day).atTime(12, 0).toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull()?.let { it to elo }
        }
        // A daily reading only where the phone has nothing that day.
        val days = local.map { it.first / 86_400_000L }.toSet()
        return (local + daily.filter { it.first / 86_400_000L !in days }).sortedBy { it.first }
    }
}
