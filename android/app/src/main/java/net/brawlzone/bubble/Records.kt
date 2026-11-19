package net.brawlzone.bubble

import android.content.Context
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Personal records (1.42): the longest run of Ranked wins, the most Ranked
 * wins in a day, and the highest elo the app has seen. On My season, and one
 * notification when a record falls (at most one a day for each, so a long
 * climb is not a notification per win).
 *
 * The first look at a tag only learns: it seeds the records from what is
 * already known (Tally's eight days, the season's longest run) and says
 * nothing.
 */
object Records {

    data class Data(val streak: Int, val day: Int, val elo: Int)

    private const val PREFS = "brawlzone-records"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun get(context: Context, tag: String): Data {
        val p = prefs(context)
        return Data(p.getInt("streak_$tag", 0), p.getInt("day_$tag", 0), p.getInt("elo_$tag", 0))
    }

    private fun day(at: Long): LocalDate = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate()

    /** From the hourly check, with the games it just added. Off the main thread. */
    fun update(context: Context, me: Me.Data, fresh: List<Tally.Battle>, post: Boolean) {
        val tag = me.tag
        val p = prefs(context)
        val seeded = p.getBoolean("seeded_$tag", false)
        val all = Tally.battles(context, tag).sortedBy { it.at }
        var run = p.getInt("run_$tag", 0)
        var streak = p.getInt("streak_$tag", 0)
        if (!seeded) {
            run = 0
            for (b in all) {
                run = if (b.win) run + 1 else 0
                streak = maxOf(streak, run)
            }
            streak = maxOf(streak, Season.current(context, tag)?.longest ?: 0, Season.previous(context, tag)?.longest ?: 0)
        } else {
            for (b in fresh.sortedBy { it.at }) {
                run = if (b.win) run + 1 else 0
                streak = maxOf(streak, run)
            }
        }
        val bestDay = all.filter { it.win }.groupBy { day(it.at) }.maxOfOrNull { it.value.size } ?: 0
        val dayRecord = maxOf(p.getInt("day_$tag", 0), bestDay)
        val eloRecord = maxOf(p.getInt("elo_$tag", 0), me.elo ?: 0)

        val old = get(context, tag)
        val edit = p.edit()
            .putBoolean("seeded_$tag", true)
            .putInt("run_$tag", run)
            .putInt("streak_$tag", streak)
            .putInt("day_$tag", dayRecord)
            .putInt("elo_$tag", eloRecord)
        if (seeded && post) {
            val today = LocalDate.now().toString()
            val local = AppLang.wrap(context)
            fun once(kind: String, block: () -> Unit) {
                if (p.getString("told_${kind}_$tag", null) == today) return
                edit.putString("told_${kind}_$tag", today)
                block()
            }
            when {
                streak > old.streak && streak >= 3 -> once("streak") {
                    Notify.postProgress(context, 7701, local.getString(R.string.record_streak_title, streak), local.getString(R.string.record_text))
                }
                dayRecord > old.day && dayRecord >= 3 -> once("day") {
                    Notify.postProgress(context, 7702, local.getString(R.string.record_day_title, dayRecord), local.getString(R.string.record_text))
                }
                eloRecord > old.elo && old.elo > 0 -> once("elo") {
                    Notify.postProgress(context, 7703, local.getString(R.string.record_elo_title, NumberFormat.getIntegerInstance().format(eloRecord)), local.getString(R.string.record_text))
                }
            }
        }
        edit.apply()
    }
}
