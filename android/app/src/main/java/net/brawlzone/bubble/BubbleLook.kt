package net.brawlzone.bubble

import android.content.Context

/**
 * How the bubble looks over the game: its size, how far it fades when left
 * alone, and whether it tucks half off the edge.
 *
 * The bubble sits over a match for its whole length, and a full-strength 52dp
 * badge is a lot of screen to give up on a small phone -- over the joystick on
 * one side or the gadget on the other, whichever edge it rests on. These are
 * the three ways to make it take less.
 *
 * Only the resting state changes. A touch brings the bubble back to full size
 * and strength at once, and a faded bubble still owns its own taps: a
 * see-through button that let presses through to the game would be a gadget
 * fired by accident.
 *
 * The service listens to these preferences, so a change in the app shows on a
 * bubble that is already up.
 */
object BubbleLook {

    private const val PREFS = "brawlzone-bubble-look"
    const val KEY_SIZE = "size"
    const val KEY_IDLE = "idle"
    const val KEY_TUCK = "tuck"

    const val SIZE_SMALL = "s"
    const val SIZE_NORMAL = "m"
    const val SIZE_LARGE = "l"

    val SIZES = listOf(SIZE_SMALL, SIZE_NORMAL, SIZE_LARGE)

    /** Opacity while idle, in percent. 100 is "never fades". */
    val IDLE_LEVELS = listOf(100, 70, 50, 30)

    /** How long after the last touch the bubble rests. */
    const val IDLE_AFTER_MS = 3000L

    fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun size(context: Context): String =
        prefs(context).getString(KEY_SIZE, SIZE_NORMAL).takeIf { it in SIZES } ?: SIZE_NORMAL

    /** The badge's side in dp. Normal is the size every earlier version used. */
    fun badgeDp(size: String): Int = when (size) {
        SIZE_SMALL -> 40
        SIZE_LARGE -> 64
        else -> 52
    }

    fun idle(context: Context): Int =
        prefs(context).getInt(KEY_IDLE, 100).takeIf { it in IDLE_LEVELS } ?: 100

    fun tuck(context: Context): Boolean = prefs(context).getBoolean(KEY_TUCK, false)

    fun setSize(context: Context, size: String) {
        prefs(context).edit().putString(KEY_SIZE, size).apply()
    }

    fun setIdle(context: Context, percent: Int) {
        prefs(context).edit().putInt(KEY_IDLE, percent).apply()
    }

    fun setTuck(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_TUCK, on).apply()
    }
}
