package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONObject

/**
 * Balance changes to the brawlers this player plays most (1.41 patch-day
 * alerts), from `/api/bubble/patch`: the site picks the five mains from the
 * player's own games and reads each one's balance history from the Brawl
 * Stars Wiki, last two weeks. Fetched by the hourly check when a tag is set;
 * Notify.patch posts each change once.
 */
object Patch {

    data class Change(val id: String, val brawlerId: Int, val name: String, val kind: String, val url: String)

    /** Off the main thread. Null without a tag or when the check fails. */
    fun fetch(context: Context): List<Change>? {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return null
        val url = Uri.parse("${Http.SITE}/api/bubble/patch").buildUpon()
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("lang", AppLang.current(context))
            .build().toString()
        val body = runCatching { Http.text(url) }.getOrNull() ?: return null
        val list = runCatching { JSONObject(body).getJSONArray("changes") }.getOrNull() ?: return null
        return (0 until list.length()).mapNotNull { i ->
            val c = list.optJSONObject(i) ?: return@mapNotNull null
            val id = c.optString("id").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            Change(
                id = id,
                brawlerId = c.optInt("brawlerId"),
                name = c.optString("name"),
                kind = c.optString("kind", "change"),
                url = c.optString("url").takeIf { it.startsWith("https://") } ?: Http.SITE,
            )
        }
    }
}
