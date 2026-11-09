package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject

/**
 * The player's own Ranked standing (1.40), from `/api/bubble/me`: the
 * "My rank" widget, the rank-up notification and the Sunday recap. Fetched by
 * the hourly check only when a player tag is set, and kept for the widget.
 */
object Me {

    data class Game(val time: String, val win: Boolean, val star: Boolean, val brawler: String?)

    data class Data(
        val tag: String,
        val name: String,
        val iconUrl: String?,
        val elo: Int?,
        val rank: String?,
        val rankIndex: Int,
        val rankIcon: String?,
        val next: String?,
        val toNext: Int?,
        val share: Double?,
        val winsToNext: Int?,
        val games: Int,
        val wins: Int,
        val losses: Int,
        val stars: Int,
        val list: List<Game>,
    )

    private const val KEY = "me"

    fun url(context: Context, tag: String) =
        "${Http.SITE}/api/bubble/me?tag=$tag&lang=${AppLang.current(context)}"

    /** Off the main thread. Null without a tag or when the lookup fails. */
    fun fetch(context: Context): Data? {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return null
        val body = runCatching { Http.text(url(context, tag)) }.getOrNull() ?: return null
        val data = runCatching { parse(body) }.getOrNull() ?: return null
        Alerts.prefs(context).edit().putString(KEY, body).apply()
        return data
    }

    /** The last answer, for the current tag only. */
    fun last(context: Context): Data? {
        val body = Alerts.prefs(context).getString(KEY, null) ?: return null
        val data = runCatching { parse(body) }.getOrNull() ?: return null
        return data.takeIf { it.tag == Account.tag(context) }
    }

    fun parse(body: String): Data {
        val j = JSONObject(body)
        val recent = j.optJSONObject("recent")
        val list = j.optJSONArray("games")?.let { a ->
            (0 until a.length()).mapNotNull { i ->
                val g = a.optJSONObject(i) ?: return@mapNotNull null
                Game(
                    time = g.optString("t"),
                    win = g.optBoolean("win"),
                    star = g.optBoolean("star"),
                    brawler = g.optString("brawler").takeIf { it.isNotEmpty() && it != "null" },
                )
            }
        }.orEmpty()
        fun optInt(key: String): Int? = if (j.isNull(key) || !j.has(key)) null else j.optInt(key)
        fun optStr(key: String): String? = if (j.isNull(key)) null else j.optString(key).takeIf { it.isNotEmpty() }
        return Data(
            tag = j.optString("tag"),
            name = j.optString("name"),
            iconUrl = optStr("iconUrl"),
            elo = optInt("elo"),
            rank = optStr("rank"),
            rankIndex = j.optInt("rankIndex", -1),
            rankIcon = optStr("rankIcon"),
            next = optStr("next"),
            toNext = optInt("toNext"),
            share = if (j.isNull("share")) null else j.optDouble("share"),
            winsToNext = optInt("winsToNext"),
            games = recent?.optInt("games") ?: 0,
            wins = recent?.optInt("wins") ?: 0,
            losses = recent?.optInt("losses") ?: 0,
            stars = recent?.optInt("stars") ?: 0,
            list = list,
        )
    }
}
