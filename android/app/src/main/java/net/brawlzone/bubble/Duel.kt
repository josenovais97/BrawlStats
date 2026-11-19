package net.brawlzone.bubble

import android.content.Context
import java.time.DayOfWeek
import java.time.ZonedDateTime
import java.time.temporal.TemporalAdjusters

/**
 * The weekly duel (1.42): the player and their friends, by Ranked wins from
 * Monday to Sunday. The Friends card shows the week so far with a crown on
 * the leader; on Monday one notification settles last week ("You won the
 * week!", a tie, or who beat you and by how much).
 *
 * Counted from Tally, which keeps eight days of games for the player and for
 * every friend, so Monday can still see all of last week. The duel is only
 * settled on Monday itself: by Tuesday the first day of last week is gone.
 */
object Duel {

    data class Entry(val tag: String, val name: String, val you: Boolean, val wins: Int, val games: Int)

    private const val PREFS = "brawlzone-duel"
    private const val KEY_SETTLED = "settled"
    /** Not before this hour on Monday, so it lands with the morning rather than at midnight. */
    private const val SETTLE_HOUR = 9

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** This week's Monday, 00:00 on the phone's clock. */
    fun weekStart(now: ZonedDateTime = ZonedDateTime.now()): ZonedDateTime =
        now.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay(now.zone)

    /** Everyone's wins between two instants, most wins first (fewer games breaks a tie). */
    fun standings(context: Context, from: Long, to: Long): List<Entry> {
        val rows = mutableListOf<Entry>()
        Me.last(context)?.let { rows += entry(context, it.tag, it.name, true, from, to) }
        for (tag in Friends.tags(context)) {
            val friend = Friends.last(context, tag) ?: continue
            rows += entry(context, tag, friend.name, false, from, to)
        }
        return rows.sortedWith(compareByDescending<Entry> { it.wins }.thenBy { it.games }.thenBy { !it.you })
    }

    private fun entry(context: Context, tag: String, name: String, you: Boolean, from: Long, to: Long): Entry {
        val games = Tally.battles(context, tag).filter { it.at in from until to }
        return Entry(tag, name, you, games.count { it.win }, games.size)
    }

    /** The week so far, for the Friends card. */
    fun thisWeek(context: Context): List<Entry> =
        standings(context, weekStart().toInstant().toEpochMilli(), Long.MAX_VALUE)

    /** Whose row gets the crown: the one player ahead on wins, if anyone is. */
    fun leader(list: List<Entry>): String? {
        val top = list.firstOrNull() ?: return null
        if (top.wins == 0) return null
        return top.tag.takeIf { list.count { it.wins == top.wins } == 1 }
    }

    /** "👑 Leo 7 · You 5 · Maya 2": the line on the Friends card. */
    fun line(context: Context, list: List<Entry> = thisWeek(context)): String {
        val local = AppLang.wrap(context)
        val crown = leader(list)
        return list.take(4).joinToString(" · ") { e ->
            (if (e.tag == crown) "👑 " else "") + (if (e.you) local.getString(R.string.duel_you) else e.name) + " " + e.wins
        }
    }

    /** Monday's verdict on last week, once. Off the main thread, from the hourly check. */
    fun settle(context: Context, post: Boolean) {
        val now = ZonedDateTime.now()
        if (now.dayOfWeek != DayOfWeek.MONDAY || now.hour < SETTLE_HOUR) return
        val start = weekStart(now)
        val last = start.minusWeeks(1)
        val key = last.toLocalDate().toString()
        val p = prefs(context)
        if (p.getString(KEY_SETTLED, null) == key) return
        p.edit().putString(KEY_SETTLED, key).apply()
        if (!post || Friends.tags(context).isEmpty()) return
        val list = standings(context, last.toInstant().toEpochMilli(), start.toInstant().toEpochMilli())
        val me = list.firstOrNull { it.you } ?: return
        if (list.none { !it.you } || list.first().wins == 0) return
        val local = AppLang.wrap(context)
        val top = list.first()
        val tied = list.filter { it.wins == top.wins }
        val (title, text) = when {
            me.wins == top.wins && tied.size == 1 ->
                local.getString(R.string.duel_won_title) to line(context, list)
            me.wins == top.wins ->
                local.getString(R.string.duel_tie_title) to line(context, list)
            else ->
                local.getString(R.string.duel_lost_title, top.name) to local.getString(R.string.duel_lost_text, top.wins, me.wins)
        }
        Notify.postFriend(context, 7350, title, text)
    }
}
