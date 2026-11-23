package net.brawlzone.bubble

import android.content.Context
import java.time.LocalDate
import java.time.LocalTime

/**
 * Which notifications the player wants, and how loud (1.43).
 *
 * One switch per kind on the Settings tab, plus two calm-down rules that are
 * on by default: quiet hours (no sound from 23:00 to 09:00) and a daily limit
 * (three with sound a day, the rest arrive silently in the shade). Before
 * 1.43 there were eight kinds of notification behind a single switch, and the
 * only way to quiet one kind was Android's channel settings.
 *
 * Nothing is dropped by the calm-down rules: a quiet notification still shows,
 * on the low-importance channel, so a reward code posted at 02:00 is there in
 * the morning.
 */
object NotifyPrefs {
    enum class Kind(val key: String) {
        REWARDS("n_rewards"),
        SEASON("n_season"),
        PATCH("n_patch"),
        PROGRESS("n_progress"),
        FRIENDS("n_friends"),
    }

    private const val PREFS = "brawlzone-notify"
    private const val KEY_QUIET = "quiet_hours"
    private const val KEY_LIMIT = "daily_limit"
    private const val KEY_LOUD_DAY = "loud_day"
    private const val KEY_LOUD_COUNT = "loud_count"
    const val DAILY_LOUD = 3
    private val QUIET_FROM: LocalTime = LocalTime.of(23, 0)
    private val QUIET_TO: LocalTime = LocalTime.of(9, 0)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun on(context: Context, kind: Kind): Boolean = prefs(context).getBoolean(kind.key, true)

    fun set(context: Context, kind: Kind, on: Boolean) {
        prefs(context).edit().putBoolean(kind.key, on).apply()
    }

    fun quietHours(context: Context): Boolean = prefs(context).getBoolean(KEY_QUIET, true)
    fun setQuietHours(context: Context, on: Boolean) = prefs(context).edit().putBoolean(KEY_QUIET, on).apply()
    fun dailyLimit(context: Context): Boolean = prefs(context).getBoolean(KEY_LIMIT, true)
    fun setDailyLimit(context: Context, on: Boolean) = prefs(context).edit().putBoolean(KEY_LIMIT, on).apply()

    fun inQuietHours(now: LocalTime = LocalTime.now()): Boolean =
        !now.isBefore(QUIET_FROM) || now.isBefore(QUIET_TO)

    /**
     * Whether the next notification may make a sound, counting it if so.
     * False inside quiet hours, or once today's loud ones are used up.
     */
    @Synchronized
    fun takeLoud(context: Context): Boolean {
        if (quietHours(context) && inQuietHours()) return false
        if (!dailyLimit(context)) return true
        val p = prefs(context)
        val today = LocalDate.now().toString()
        val count = if (p.getString(KEY_LOUD_DAY, null) == today) p.getInt(KEY_LOUD_COUNT, 0) else 0
        if (count >= DAILY_LOUD) return false
        p.edit().putString(KEY_LOUD_DAY, today).putInt(KEY_LOUD_COUNT, count + 1).apply()
        return true
    }
}
