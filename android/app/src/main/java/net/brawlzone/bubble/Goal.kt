package net.brawlzone.bubble

import android.content.Context
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * The daily goal and streak (1.40): win N Ranked games a day (2, 3 or 5;
 * 3 unless changed; off is a choice), and a streak of days in a row that met it.
 *
 * Wins are counted per local day from the games Tally adds, so a day played
 * with the phone off still counts when the next check sees those games. A day
 * is marked done when it reaches the goal set at the time, so changing the
 * goal later does not rewrite the streak.
 *
 * Notifications, each at most once a day: the goal reached (a milestone title
 * on 3, 7, 14, 30, 50 and 100 days), and from 19:00 a reminder, only for a
 * streak of three days or more that today's games have not kept yet.
 */
object Goal {

    val CHOICES = intArrayOf(2, 3, 5, 0)
    private val MILESTONES = setOf(3, 7, 14, 30, 50, 100)

    private const val PREFS = "brawlzone-goal"
    private const val KEY_GOAL = "goal"
    private const val KEY_DONE_SENT = "done_sent"
    private const val KEY_REMIND_SENT = "remind_sent"
    private const val KEEP_DAYS = 120L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun zone() = ZoneId.systemDefault()
    private fun today() = LocalDate.now(zone())

    fun goal(context: Context): Int = prefs(context).getInt(KEY_GOAL, 3)

    fun setGoal(context: Context, wins: Int) {
        prefs(context).edit().putInt(KEY_GOAL, wins).apply()
        val tag = Account.tag(context)
        if (tag.isNotEmpty() && wins > 0 && winsOn(context, tag, today()) >= wins) markDone(context, tag, today())
    }

    private fun days(context: Context, tag: String): JSONObject =
        runCatching { JSONObject(prefs(context).getString("days_$tag", "{}") ?: "{}") }.getOrDefault(JSONObject())

    private fun done(context: Context, tag: String): Set<String> =
        prefs(context).getStringSet("done_$tag", emptySet()) ?: emptySet()

    private fun markDone(context: Context, tag: String, day: LocalDate) {
        val set = HashSet(done(context, tag))
        if (!set.add(day.toString())) return
        val oldest = today().minusDays(KEEP_DAYS).toString()
        prefs(context).edit().putStringSet("done_$tag", set.filter { it >= oldest }.toSet()).apply()
    }

    fun winsOn(context: Context, tag: String, day: LocalDate): Int = days(context, tag).optInt(day.toString(), 0)

    fun todayWins(context: Context, tag: String): Int = winsOn(context, tag, today())

    fun doneToday(context: Context, tag: String): Boolean = today().toString() in done(context, tag)

    /** Days in a row that met the goal, ending today, or yesterday while today is still open. */
    fun streak(context: Context, tag: String): Int {
        val set = done(context, tag)
        var day = today()
        if (day.toString() !in set) day = day.minusDays(1)
        var n = 0
        while (day.toString() in set) {
            n += 1
            day = day.minusDays(1)
        }
        return n
    }

    /** The hourly check: count new wins, mark days, maybe notify. Off the main thread. */
    fun record(context: Context, tag: String, fresh: List<Tally.Battle>, firstLook: Boolean, post: Boolean) {
        val goal = goal(context)
        val days = days(context, tag)
        val touched = HashSet<LocalDate>()
        for (b in fresh) {
            if (!b.win) continue
            val day = Instant.ofEpochMilli(b.at).atZone(zone()).toLocalDate()
            days.put(day.toString(), days.optInt(day.toString(), 0) + 1)
            touched += day
        }
        if (touched.isNotEmpty()) {
            val oldest = today().minusDays(KEEP_DAYS).toString()
            val keys = days.keys().asSequence().toList()
            for (k in keys) if (k < oldest) days.remove(k)
            prefs(context).edit().putString("days_$tag", days.toString()).apply()
        }
        if (goal <= 0) return
        val wasDone = doneToday(context, tag)
        for (day in touched) if (days.optInt(day.toString(), 0) >= goal) markDone(context, tag, day)

        val p = prefs(context)
        val todayKey = today().toString()
        if (!wasDone && doneToday(context, tag) && !firstLook && p.getString(KEY_DONE_SENT, null) != todayKey) {
            p.edit().putString(KEY_DONE_SENT, todayKey).apply()
            if (post) postDone(context, todayWins(context, tag), streak(context, tag))
            Store.happyMoment(context)
            return
        }
        val evening = LocalTime.now(zone()).hour >= 19
        val streak = streak(context, tag)
        if (evening && !doneToday(context, tag) && streak >= 3 && p.getString(KEY_REMIND_SENT, null) != todayKey) {
            p.edit().putString(KEY_REMIND_SENT, todayKey).apply()
            if (post) postRemind(context, goal - todayWins(context, tag), streak)
        }
    }

    private fun postDone(context: Context, wins: Int, streak: Int) {
        val local = AppLang.wrap(context)
        val title = if (streak in MILESTONES) local.getString(R.string.goal_milestone_title, streak)
        else local.getString(R.string.goal_done_title)
        Notify.postGoal(context, 7201, title, local.getString(R.string.goal_done_text, wins, streak))
    }

    private fun postRemind(context: Context, left: Int, streak: Int) {
        val local = AppLang.wrap(context)
        Notify.postGoal(
            context,
            7202,
            local.getString(R.string.goal_remind_title),
            local.getString(R.string.goal_remind_text, left.coerceAtLeast(1), streak),
        )
    }

    /** Samples for the test build's button. */
    fun test(context: Context) {
        postDone(context, 3, 7)
        postRemind(context, 1, 5)
    }
}
