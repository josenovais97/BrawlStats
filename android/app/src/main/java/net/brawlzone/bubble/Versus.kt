package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONObject

/**
 * This season against the last one (1.42): the card under My season and its
 * share image (`/api/bubble/card?kind=versus`).
 *
 * From `/api/bubble/seasons`, which has both seasons for players the sampler
 * follows; the app sends what it counted itself (Season: this one, and the
 * last one if the app was installed then) and the site keeps whichever count
 * is larger, the way the Wrapped card does. Fetched by the hourly check and
 * kept for the screen.
 */
object Versus {

    data class Side(
        val number: Int,
        val games: Int,
        val wins: Int,
        val peak: Int,
        val peakRank: String?,
        val peakIcon: String?,
        val best: String?,
        val bestId: Int?,
    )

    data class Data(val now: Side, val last: Side?)

    private const val PREFS = "brawlzone-versus"
    private const val KEY = "body"
    private const val KEY_TAG = "tag"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun url(context: Context, tag: String): String {
        val b = Uri.parse("${Http.SITE}/api/bubble/seasons").buildUpon()
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
        fun add(prefix: String, s: Season.Stats?) {
            if (s == null) return
            b.appendQueryParameter("${prefix}g", s.games.toString())
            b.appendQueryParameter("${prefix}w", s.wins.toString())
            if (s.peak >= 0) b.appendQueryParameter("${prefix}pk", s.peak.toString())
            s.best?.let { b.appendQueryParameter("${prefix}b", it) }
        }
        add("", Season.current(context, tag))
        add("l", Season.previous(context, tag))
        return b.build().toString()
    }

    /** Off the main thread. */
    fun fetch(context: Context): Data? {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return null
        val body = runCatching { Http.text(url(context, tag)) }.getOrNull() ?: return null
        val data = parse(body) ?: return null
        prefs(context).edit().putString(KEY, body).putString(KEY_TAG, tag).apply()
        return data
    }

    fun last(context: Context): Data? {
        val p = prefs(context)
        if (p.getString(KEY_TAG, null) != Account.tag(context)) return null
        return p.getString(KEY, null)?.let { parse(it) }
    }

    private fun parse(body: String): Data? = runCatching {
        val j = JSONObject(body)
        fun side(o: JSONObject?): Side? {
            if (o == null) return null
            val best = o.optJSONObject("best")
            fun str(src: JSONObject?, key: String) = if (src == null || src.isNull(key)) null else src.optString(key).takeIf { it.isNotEmpty() }
            return Side(
                number = o.optInt("number"),
                games = o.optInt("games"),
                wins = o.optInt("wins"),
                peak = o.optInt("peakIndex", -1),
                peakRank = str(o, "peakRank"),
                peakIcon = str(o, "peakIcon"),
                best = str(best, "name"),
                bestId = if (best == null || best.isNull("id")) null else best.optInt("id"),
            )
        }
        val now = side(j.optJSONObject("now")) ?: return null
        Data(now, side(j.optJSONObject("last")))
    }.getOrNull()

    /** The site's daily elo readings for this season (1.42, the season graph): (day, elo). */
    fun series(context: Context, season: Int): List<Pair<String, Int>> {
        val p = prefs(context)
        if (p.getString(KEY_TAG, null) != Account.tag(context)) return emptyList()
        val now = p.getString(KEY, null)?.let { runCatching { JSONObject(it).optJSONObject("now") }.getOrNull() } ?: return emptyList()
        if (now.optInt("number") != season) return emptyList()
        val a = now.optJSONArray("series") ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val row = a.optJSONArray(i) ?: return@mapNotNull null
            row.optString(0).takeIf { it.isNotEmpty() }?.let { it to row.optInt(1) }
        }
    }

    /** Whether there is anything to compare: a last season with games or a rank. */
    fun worthShowing(d: Data?): Boolean = d?.last != null && (d.last.games > 0 || d.last.peak >= 0)

    /** The share image's address, with the merged numbers. */
    fun cardUrl(context: Context, tag: String, d: Data): String {
        val b = Uri.parse("${Http.SITE}/api/bubble/card").buildUpon()
            .appendQueryParameter("kind", "versus")
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
        fun add(prefix: String, s: Side?) {
            if (s == null) return
            b.appendQueryParameter("${prefix}n", s.number.toString())
            b.appendQueryParameter("${prefix}g", s.games.toString())
            b.appendQueryParameter("${prefix}w", s.wins.toString())
            if (s.peak >= 0) b.appendQueryParameter("${prefix}pk", s.peak.toString())
            s.best?.let { b.appendQueryParameter("${prefix}b", it) }
            s.bestId?.let { b.appendQueryParameter("${prefix}bid", it.toString()) }
        }
        add("", d.now)
        add("l", d.last)
        return b.build().toString()
    }
}
