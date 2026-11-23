package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import org.json.JSONObject

/**
 * People this account queues with (1.43): players on its team twice or more
 * in the last 25 battles (/api/bubble/teammates), offered on the Squad tab as
 * one-tap friends. Kept for 30 minutes so switching tabs does not re-ask.
 */
object Teammates {
    data class Mate(val tag: String, val name: String, val games: Int, val wins: Int, val icon: String?)

    private const val PREFS = "brawlzone-mates"
    private const val FRESH_MS = 30 * 60 * 1000L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun last(context: Context): List<Mate> {
        val tag = Account.tag(context).ifEmpty { return emptyList() }
        val raw = prefs(context).getString("m_$tag", null) ?: return emptyList()
        val skip = Friends.tags(context).toSet()
        return parse(raw).filter { it.tag !in skip }
    }

    fun isStale(context: Context): Boolean {
        val tag = Account.tag(context).ifEmpty { return false }
        return System.currentTimeMillis() - prefs(context).getLong("at_$tag", 0L) > FRESH_MS
    }

    /** One look, off the main thread. */
    fun fetch(context: Context): List<Mate> {
        val tag = Account.tag(context).ifEmpty { return emptyList() }
        val url = Uri.parse("${Http.SITE}/api/bubble/teammates").buildUpon()
            .appendQueryParameter("tag", tag)
            .appendQueryParameter("skip", Friends.tags(context).joinToString(","))
            .build().toString()
        val reply = Http.get(url)
        if (reply.code !in 200..299 || reply.body == null) return last(context)
        prefs(context).edit().putString("m_$tag", reply.body).putLong("at_$tag", System.currentTimeMillis()).apply()
        return last(context)
    }

    private fun parse(body: String): List<Mate> = runCatching {
        val a = JSONObject(body).optJSONArray("players") ?: return emptyList()
        (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            Mate(
                o.optString("tag"),
                o.optString("name"),
                o.optInt("games"),
                o.optInt("wins"),
                o.optString("icon").takeIf { it.isNotEmpty() && it != "null" },
            )
        }.filter { it.tag.isNotEmpty() }
    }.getOrDefault(emptyList())
}
