package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject

/**
 * One Ranked season of the player, from `/api/bubble/season` (1.45): the
 * running one or the last. Games and wins, kills and deaths against what
 * others at the player's rank do with the same brawlers, mode by mode, and
 * the brawlers. Kept per tag, season and language, so the Season tab draws at
 * once and refreshes behind.
 */
object SeasonData {

    data class Rates(
        val kd: Double,
        val kills: Double,
        val deaths: Double,
        val damage: Double,
        val healing: Double,
        val star: Double,
        val deathless: Double,
    )

    data class Mode(
        val key: String,
        val label: String,
        val icon: String?,
        val games: Int,
        val wins: Int,
        val mine: Rates?,
        val others: Rates?,
    )

    /** Something that stands out against others in a mode: deaths ("deaths") or K/D ("kd"). */
    data class Coach(val kind: String, val label: String, val icon: String?, val mine: Double, val others: Double, val games: Int)

    data class Row(
        val id: Int,
        val name: String,
        val icon: String?,
        val color: Int?,
        val games: Int,
        val wins: Int,
        val kd: Double?,
        val ban: Double?,
    ) {
        val rate get() = if (games == 0) 0.0 else wins.toDouble() / games
    }

    data class Data(
        val which: String,
        val number: Int?,
        val from: String?,
        val to: String?,
        val daysLeft: Int?,
        val lastNumber: Int?,
        val games: Int,
        val wins: Int,
        val streak: Int?,
        val fought: Int,
        val mine: Rates?,
        val others: Rates?,
        val modes: List<Mode>,
        val coach: List<Coach>,
        val brawlers: List<Row>,
        val hero: String?,
    )

    private const val PREFS = "brawlzone-season-page"
    private const val STALE_MS = 10 * 60 * 1000L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun key(context: Context, tag: String, which: String) = "${tag}_${which}_${AppLang.current(context)}"

    fun last(context: Context, which: String): Data? {
        val tag = Account.tag(context).ifEmpty { return null }
        return prefs(context).getString(key(context, tag, which), null)?.let { runCatching { parse(it) }.getOrNull() }
    }

    fun isStale(context: Context, which: String): Boolean {
        val tag = Account.tag(context).ifEmpty { return false }
        return System.currentTimeMillis() - prefs(context).getLong("at_${key(context, tag, which)}", 0L) > STALE_MS
    }

    /** Off the main thread. Null when there is no tag or the site did not answer. */
    fun fetch(context: Context, which: String): Data? {
        val tag = Account.tag(context).ifEmpty { return null }
        val body = runCatching {
            Http.text("${Http.SITE}/api/bubble/season?tag=$tag&which=$which&lang=${AppLang.current(context)}")
        }.getOrNull() ?: return null
        val data = runCatching { parse(body) }.getOrNull() ?: return null
        val k = key(context, tag, which)
        prefs(context).edit().putString(k, body).putLong("at_$k", System.currentTimeMillis()).apply()
        return data
    }

    private fun https(o: JSONObject, name: String): String? = o.optString(name).takeIf { it.startsWith("https://") }

    private fun rates(o: JSONObject?): Rates? = o?.let {
        Rates(
            it.optDouble("kd"), it.optDouble("kills"), it.optDouble("deaths"), it.optDouble("damage"),
            it.optDouble("healing"), it.optDouble("star"), it.optDouble("deathless"),
        )
    }

    fun parse(body: String): Data {
        val j = JSONObject(body)
        val season = j.optJSONObject("season")
        fun <T> list(name: String, read: (JSONObject) -> T?): List<T> = j.optJSONArray(name)?.let { a ->
            (0 until a.length()).mapNotNull { i -> a.optJSONObject(i)?.let(read) }
        }.orEmpty()
        return Data(
            which = j.optString("which"),
            number = season?.optInt("number")?.takeIf { it > 0 },
            from = season?.optString("from")?.takeIf { it.isNotEmpty() && it != "null" },
            to = season?.optString("to")?.takeIf { it.isNotEmpty() && it != "null" },
            daysLeft = season?.takeIf { !it.isNull("daysLeft") }?.optInt("daysLeft"),
            lastNumber = j.optJSONObject("last")?.optInt("number")?.takeIf { it > 0 },
            games = j.optInt("games"),
            wins = j.optInt("wins"),
            streak = if (j.isNull("streak")) null else j.optInt("streak"),
            fought = j.optInt("fought"),
            mine = rates(j.optJSONObject("mine")),
            others = rates(j.optJSONObject("others")),
            modes = list("modes") { m ->
                Mode(m.optString("key"), m.optString("label"), https(m, "icon"), m.optInt("games"), m.optInt("wins"), rates(m.optJSONObject("mine")), rates(m.optJSONObject("others")))
            },
            coach = list("coach") { c ->
                Coach(c.optString("kind"), c.optString("label"), https(c, "icon"), c.optDouble("mine"), c.optDouble("others"), c.optInt("games"))
            },
            brawlers = list("brawlers") { b ->
                Row(
                    b.optInt("id"), b.optString("name"), https(b, "icon"),
                    b.optString("color").takeIf { it.startsWith("#") }?.let { runCatching { android.graphics.Color.parseColor(it) }.getOrNull() },
                    b.optInt("games"), b.optInt("wins"),
                    if (b.isNull("kd")) null else b.optDouble("kd"),
                    if (b.isNull("ban")) null else b.optDouble("ban"),
                )
            },
            hero = https(j, "hero"),
        )
    }
}
