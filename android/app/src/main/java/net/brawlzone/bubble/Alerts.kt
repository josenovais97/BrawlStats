package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject

/**
 * What the hourly check knows (1.40): the newest free rewards, the Ranked
 * season's dates and today's top Ranked pick, all from one cached endpoint
 * on the site (`/api/bubble/alerts`).
 *
 * The last answer is kept, so the home-screen widget can draw itself the
 * moment the launcher asks, offline or not, and only the hourly job touches
 * the network.
 */
object Alerts {

    data class Reward(val id: String, val name: String, val url: String, val image: String?)

    data class Season(val number: Int, val startsOn: String, val endsOn: String?)

    /** A brawler in a top list: the medium widget's pick, the large widget's five. */
    data class TopPick(val brawlerId: Int, val name: String, val tier: String, val winRate: Double, val imageUrl: String?)

    /** One Ranked mode's top five, for a widget set to that mode. */
    data class ModeTop(val key: String, val label: String, val icon: String?, val top: List<TopPick>)

    data class Data(
        val rewards: List<Reward>,
        val season: Season?,
        val nextStartsOn: String?,
        val topPick: TopPick?,
        /** Top five over the panel's window, all modes. */
        val metaAll: List<TopPick> = emptyList(),
        val modes: List<ModeTop> = emptyList(),
    ) {
        fun mode(key: String?): ModeTop? = key?.let { k -> modes.firstOrNull { it.key == k } }
    }

    private const val PREFS = "brawlzone-alerts"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_LAST = "last"
    private const val KEY_LAST_AT = "last_at"

    const val URL = "${Http.SITE}/api/bubble/alerts"

    /** With the app's language, so brawler and mode names read like the panel. */
    fun url(context: Context): String = URL + "?lang=" + AppLang.current(context)

    fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Reward and season notifications. On unless the player turns them off. */
    fun enabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, true)

    fun setEnabled(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, on).apply()
    }

    /** The raw answer and when it arrived, so the widget can draw without the network. */
    fun remember(context: Context, body: String) {
        prefs(context).edit()
            .putString(KEY_LAST, body)
            .putLong(KEY_LAST_AT, System.currentTimeMillis())
            .apply()
    }

    fun last(context: Context): Data? =
        prefs(context).getString(KEY_LAST, null)?.let { runCatching { parse(it) }.getOrNull() }

    fun lastFetchedAt(context: Context): Long = prefs(context).getLong(KEY_LAST_AT, 0L)

    fun parse(body: String): Data {
        val json = JSONObject(body)
        val rewards = json.optJSONArray("rewards")?.let { array ->
            (0 until array.length()).mapNotNull { i ->
                val o = array.optJSONObject(i) ?: return@mapNotNull null
                val url = o.optString("url")
                // The site lists only Supercell's own links; refuse anything else
                // rather than trust a feed to put a notification on someone's phone.
                if (!url.startsWith("https://link.brawlstars.com/") &&
                    !url.startsWith("https://store.supercell.com/")
                ) return@mapNotNull null
                Reward(
                    id = o.optString("id").ifEmpty { url },
                    name = o.optString("name"),
                    url = url,
                    image = o.optString("image").takeIf { it.startsWith("https://") },
                )
            }
        }.orEmpty()
        val season = json.optJSONObject("season")?.let {
            Season(
                number = it.optInt("number"),
                startsOn = it.optString("startsOn"),
                endsOn = it.optString("endsOn").takeIf { e -> e.isNotEmpty() && e != "null" },
            )
        }
        val nextStartsOn = json.optJSONObject("nextSeason")?.optString("startsOn")
            ?.takeIf { it.isNotEmpty() && it != "null" }
        val top = json.optJSONObject("topPick")?.let(::pick)
        val meta = json.optJSONObject("meta")
        val all = meta?.optJSONArray("all")?.let(::picks).orEmpty()
        val modes = meta?.optJSONArray("modes")?.let { array ->
            (0 until array.length()).mapNotNull { i ->
                val o = array.optJSONObject(i) ?: return@mapNotNull null
                ModeTop(
                    key = o.optString("key"),
                    label = o.optString("label"),
                    icon = o.optString("icon").takeIf { it.startsWith("https://") },
                    top = o.optJSONArray("top")?.let(::picks).orEmpty(),
                )
            }
        }.orEmpty()
        return Data(rewards, season, nextStartsOn, top, all, modes)
    }

    private fun pick(o: JSONObject) = TopPick(
        brawlerId = o.optInt("brawlerId"),
        name = o.optString("name"),
        tier = o.optString("tier"),
        winRate = o.optDouble("winRate", 0.0),
        imageUrl = o.optString("imageUrl").takeIf { it.startsWith("https://") },
    )

    private fun picks(array: org.json.JSONArray): List<TopPick> =
        (0 until array.length()).mapNotNull { i -> array.optJSONObject(i)?.let(::pick) }

    // ------------------------------------------------------------- reviews

    private const val KEY_DRAFTS = "drafts"
    private const val KEY_DRAFT_AT = "draft_at"
    private const val DRAFT_GAP_MS = 10 * 60 * 1000L

    /**
     * One more draft played with the bubble, for the review prompt (1.40).
     *
     * Counted when the panel opens with a player tag set, at most once per ten
     * minutes, so opening and closing the panel through one draft counts once.
     */
    fun countDraft(context: Context) {
        if (Account.tag(context).isEmpty()) return
        val p = prefs(context)
        val now = System.currentTimeMillis()
        if (now - p.getLong(KEY_DRAFT_AT, 0L) < DRAFT_GAP_MS) return
        p.edit().putInt(KEY_DRAFTS, p.getInt(KEY_DRAFTS, 0) + 1).putLong(KEY_DRAFT_AT, now).apply()
    }

    fun drafts(context: Context): Int = prefs(context).getInt(KEY_DRAFTS, 0)
}
