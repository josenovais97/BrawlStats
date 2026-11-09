package net.brawlzone.bubble

import android.content.Context
import org.json.JSONArray
import java.text.NumberFormat

/**
 * Friends and rivals (1.40): up to five other player tags, looked up by the
 * hourly check through the same `/api/bubble/me` the player's own rank uses.
 *
 * The app screen and the Friends widget show a small ladder (the player and
 * their friends by elo, with each one's week); a friend passing their best
 * rank of the season posts one notification with the elo gap.
 */
object Friends {

    const val MAX = 5

    data class Row(val data: Me.Data, val you: Boolean, val weekWins: Int, val weekLosses: Int)

    private const val PREFS = "brawlzone-friends"
    private const val KEY_TAGS = "tags"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun tags(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_TAGS, null) ?: return emptyList()
        val a = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }
    }

    private fun writeTags(context: Context, list: List<String>) {
        prefs(context).edit().putString(KEY_TAGS, JSONArray(list).toString()).apply()
    }

    enum class AddResult { ADDED, NOT_FOUND, FULL, ALREADY, FAILED }

    /** Looks the tag up and adds it. Off the main thread. */
    fun add(context: Context, raw: String): AddResult {
        val tag = Account.normalise(raw)
        if (!Account.isValid(tag)) return AddResult.NOT_FOUND
        val list = tags(context)
        if (tag in list || tag == Account.tag(context)) return AddResult.ALREADY
        if (list.size >= MAX) return AddResult.FULL
        val body = try {
            Http.text(Me.url(context, tag))
        } catch (e: java.io.FileNotFoundException) {
            return AddResult.NOT_FOUND
        } catch (e: Exception) {
            return AddResult.FAILED
        }
        val data = runCatching { Me.parse(body) }.getOrNull() ?: return AddResult.FAILED
        prefs(context).edit().putString("me_$tag", body).putInt("best_$tag", data.rankIndex).apply()
        Tally.merge(context, tag, data.list)
        writeTags(context, list + tag)
        return AddResult.ADDED
    }

    fun remove(context: Context, tag: String) {
        writeTags(context, tags(context) - tag)
        prefs(context).edit().remove("me_$tag").remove("best_$tag").remove("season_$tag").apply()
        Tally.forget(context, tag)
    }

    fun last(context: Context, tag: String): Me.Data? =
        prefs(context).getString("me_$tag", null)?.let { runCatching { Me.parse(it) }.getOrNull() }

    /** Every friend, fresh, and their rank-ups. Off the main thread. */
    fun refresh(context: Context, me: Me.Data?, season: Int?, post: Boolean) {
        for (tag in tags(context)) {
            val body = runCatching { Http.text(Me.url(context, tag)) }.getOrNull() ?: continue
            val data = runCatching { Me.parse(body) }.getOrNull() ?: continue
            prefs(context).edit().putString("me_$tag", body).apply()
            Tally.merge(context, tag, data.list)
            rankUp(context, tag, data, me, season, post)
        }
    }

    private fun rankUp(context: Context, tag: String, friend: Me.Data, me: Me.Data?, season: Int?, post: Boolean) {
        if (friend.rankIndex < 0 || friend.rank == null) return
        val p = prefs(context)
        val sameSeason = season == null || p.getInt("season_$tag", -1) == season
        val best = if (sameSeason && p.contains("best_$tag")) p.getInt("best_$tag", -1) else -1
        if (best < 0 || !sameSeason) {
            p.edit().putInt("best_$tag", friend.rankIndex).putInt("season_$tag", season ?: -1).apply()
            return
        }
        if (friend.rankIndex <= best) return
        p.edit().putInt("best_$tag", friend.rankIndex).apply()
        if (!post) return
        val local = AppLang.wrap(context)
        val gap = if (me?.elo != null && friend.elo != null) me.elo - friend.elo else null
        val fmt = NumberFormat.getIntegerInstance()
        val text = when {
            gap == null -> local.getString(R.string.friend_rankup_plain)
            gap >= 0 -> local.getString(R.string.friend_ahead, fmt.format(gap))
            else -> local.getString(R.string.friend_behind, fmt.format(-gap))
        }
        Notify.postFriend(context, 7300 + (tag.hashCode() and 0xff), local.getString(R.string.friend_rankup_title, friend.name, friend.rank), text)
    }

    /** The ladder: the player and every friend, highest elo first. */
    fun ladder(context: Context): List<Row> {
        val rows = mutableListOf<Row>()
        Me.last(context)?.let { me ->
            val (w, l) = Tally.week(context, me.tag)
            rows += Row(me, true, w, l)
        }
        for (tag in tags(context)) {
            val data = last(context, tag) ?: continue
            val (w, l) = Tally.week(context, tag)
            rows += Row(data, false, w, l)
        }
        return rows.sortedByDescending { it.data.elo ?: -1 }
    }

    /** Samples for the test build's button. */
    fun test(context: Context) {
        val local = AppLang.wrap(context)
        val me = Me.last(context)
        Notify.postFriend(
            context,
            7300,
            local.getString(R.string.friend_rankup_title, "Alex", me?.next ?: "Mythic II"),
            local.getString(R.string.friend_ahead, NumberFormat.getIntegerInstance().format(140)),
        )
    }
}
