package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONObject

/**
 * Live trophy maps with the player's own best brawler for each, and the
 * brawlers closest to their next prestige (1.41), from `/api/bubble/push`:
 * the same data as the panel's Trophies tab. Fetched by the hourly check and
 * kept for the Trophies widget and the prestige heads-up.
 */
object Trophy {

    data class Pick(val brawlerId: Int, val name: String, val icon: String?, val trophies: Int?)

    data class Event(val map: String, val mode: String, val endsAt: String, val best: Pick?, val yours: Pick?)

    data class Prestige(val brawlerId: Int, val name: String, val icon: String?, val trophies: Int, val toNext: Int)

    data class Data(val events: List<Event>, val prestige: List<Prestige>)

    private const val KEY = "push"

    private fun url(context: Context): String = Uri.parse("${Http.SITE}/api/bubble/push").buildUpon()
        .apply { Account.tag(context).takeIf { it.isNotEmpty() }?.let { appendQueryParameter("tag", it) } }
        .appendQueryParameter("lang", AppLang.current(context))
        .build().toString()

    /** Off the main thread. Null when the check fails. */
    fun fetch(context: Context): Data? {
        val body = runCatching { Http.text(url(context)) }.getOrNull() ?: return null
        val data = runCatching { parse(body) }.getOrNull() ?: return null
        Alerts.prefs(context).edit().putString(KEY, body).apply()
        return data
    }

    fun last(context: Context): Data? =
        Alerts.prefs(context).getString(KEY, null)?.let { runCatching { parse(it) }.getOrNull() }

    private fun pick(o: JSONObject?): Pick? {
        o ?: return null
        return Pick(
            brawlerId = o.optInt("brawlerId"),
            name = o.optString("name"),
            icon = o.optString("icon").takeIf { it.startsWith("https://") },
            trophies = if (o.isNull("trophies") || !o.has("trophies")) null else o.optInt("trophies"),
        )
    }

    fun parse(body: String): Data {
        val j = JSONObject(body)
        val events = j.optJSONArray("events")?.let { a ->
            (0 until a.length()).mapNotNull { i ->
                val e = a.optJSONObject(i) ?: return@mapNotNull null
                Event(
                    map = e.optString("map"),
                    mode = e.optString("mode"),
                    endsAt = e.optString("endsAt"),
                    best = pick(e.optJSONArray("best")?.optJSONObject(0)),
                    yours = pick(e.optJSONArray("yours")?.optJSONObject(0)),
                )
            }
        }.orEmpty()
        val prestige = j.optJSONArray("prestige")?.let { a ->
            (0 until a.length()).mapNotNull { i ->
                val p = a.optJSONObject(i) ?: return@mapNotNull null
                Prestige(p.optInt("brawlerId"), p.optString("name"), p.optString("icon").takeIf { it.startsWith("https://") }, p.optInt("trophies"), p.optInt("toNext"))
            }
        }.orEmpty()
        return Data(events, prestige)
    }

    /** "20261113T080000.000Z" -> epoch ms. */
    fun endsAtMs(value: String): Long? {
        val m = Regex("""^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})""").find(value) ?: return null
        val (y, mo, d, h, mi, s) = m.destructured
        return runCatching {
            java.time.LocalDateTime.of(y.toInt(), mo.toInt(), d.toInt(), h.toInt(), mi.toInt(), s.toInt())
                .toInstant(java.time.ZoneOffset.UTC).toEpochMilli()
        }.getOrNull()
    }
}
