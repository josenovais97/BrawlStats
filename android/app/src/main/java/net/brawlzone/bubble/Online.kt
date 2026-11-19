package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject

/**
 * "Playing now" (1.42): which friends finished a game in the last 20
 * minutes, for a green dot on the friends ladder, and one notification when
 * a friend starts a Ranked session ("Leo is playing Ranked now"), so the
 * player can jump in. From `/api/bubble/activity`, asked by a 15-minute job
 * (AlertJob.ONLINE_JOB_ID) and when the app screen opens.
 *
 * Kept quiet on purpose: only a Ranked game after at least 45 minutes of
 * nothing counts as starting, at most one alert per friend every four hours
 * and four a day, its own channel, and a switch on the Friends card.
 */
object Online {

    const val ACTIVE_MS = 20 * 60 * 1000L
    private const val SESSION_GAP_MS = 45 * 60 * 1000L
    private const val PER_FRIEND_MS = 4 * 60 * 60 * 1000L
    private const val MAX_PER_DAY = 4
    private const val FRESH_MS = 3 * 60 * 1000L

    private const val PREFS = "brawlzone-online"
    private const val KEY_ALERTS = "alerts"
    private const val KEY_CHECKED = "checked"
    private const val KEY_DAY = "day"
    private const val KEY_DAY_COUNT = "day_count"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun alerts(context: Context): Boolean = prefs(context).getBoolean(KEY_ALERTS, true)

    fun setAlerts(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_ALERTS, on).apply()
    }

    fun playingNow(context: Context, tag: String): Boolean {
        val last = prefs(context).getLong("last_$tag", 0L)
        return last > 0 && System.currentTimeMillis() - last < ACTIVE_MS
    }

    fun isStale(context: Context): Boolean =
        System.currentTimeMillis() - prefs(context).getLong(KEY_CHECKED, 0L) > FRESH_MS

    /** Off the main thread. `post` is whether notifications are allowed at all. */
    fun check(context: Context, post: Boolean) {
        val tags = Friends.tags(context)
        if (tags.isEmpty()) return
        val body = runCatching { Http.text("${Http.SITE}/api/bubble/activity?tags=${tags.joinToString(",")}") }.getOrNull() ?: return
        val all = runCatching { JSONObject(body).optJSONObject("tags") }.getOrNull() ?: return
        val p = prefs(context)
        val now = System.currentTimeMillis()
        val edit = p.edit().putLong(KEY_CHECKED, now)
        val today = java.time.LocalDate.now().toString()
        var count = if (p.getString(KEY_DAY, null) == today) p.getInt(KEY_DAY_COUNT, 0) else 0
        val local = AppLang.wrap(context)
        for (tag in tags) {
            val o = all.optJSONObject(tag) ?: continue
            val last = o.optString("last").takeIf { it.isNotEmpty() && it != "null" }?.let { Tally.time(it) } ?: continue
            val ranked = o.optString("ranked").takeIf { it.isNotEmpty() && it != "null" }?.let { Tally.time(it) }
            val before = p.getLong("last_$tag", 0L)
            edit.putLong("last_$tag", last)
            // The first look at a friend only learns when they last played.
            if (before == 0L || !post || !alerts(context) || ranked == null) continue
            val started = now - ranked < ACTIVE_MS && ranked > before && ranked - before >= SESSION_GAP_MS
            if (!started || count >= MAX_PER_DAY) continue
            if (now - p.getLong("told_$tag", 0L) < PER_FRIEND_MS) continue
            val name = Friends.last(context, tag)?.name ?: "#$tag"
            Notify.postOnline(
                context,
                7500 + (tag.hashCode() and 0xff),
                local.getString(R.string.online_alert_title, name),
                local.getString(R.string.online_alert_text),
            )
            edit.putLong("told_$tag", now)
            count += 1
        }
        edit.putString(KEY_DAY, today).putInt(KEY_DAY_COUNT, count).apply()
    }
}
