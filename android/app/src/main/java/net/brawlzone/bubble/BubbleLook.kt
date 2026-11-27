package net.brawlzone.bubble

import android.content.Context
import android.graphics.drawable.GradientDrawable

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
    /** The break card after a losing streak (1.42: "never show it again"); on by default. */
    const val KEY_TILT = "tilt"
    /** The bubble's colours (1.42), which the panel's accent follows. */
    const val KEY_THEME = "theme"
    /** A brawler portrait as the bubble's face (1.42, Face): its URL, or unset for the player's icon. */
    const val KEY_FACE = "face_url"
    /** A Bubble Pass ring around the bubble (1.43, Rings), or unset for none. */
    const val KEY_RING = "ring"

    /**
     * A theme: the ring's gradient (top to bottom) and its outline, and the
     * swatch's name. Gold is the bubble every earlier version wore. The panel
     * side lives in the site's components/bubble/panel-theme.ts; keep the two
     * lists in step.
     */
    data class Theme(
        val id: String,
        val top: Int,
        val bottom: Int,
        val edge: Int,
        val label: Int,
        /** More than two colours, top to bottom (Holo). */
        val stops: IntArray? = null,
        /** Bubble Supporter only (1.46). */
        val supporter: Boolean = false,
    )

    val THEMES = listOf(
        Theme("gold", 0xFFFFD96B.toInt(), 0xFFF2A81C.toInt(), 0xFF6B4A00.toInt(), R.string.theme_gold),
        Theme("diamond", 0xFFA6F4FF.toInt(), 0xFF1FB4E6.toInt(), 0xFF0B4F6B.toInt(), R.string.theme_diamond),
        Theme("mythic", 0xFFECC2FF.toInt(), 0xFFA64DF0.toInt(), 0xFF4B1680.toInt(), R.string.theme_mythic),
        Theme("legendary", 0xFFFFC0A8.toInt(), 0xFFF0523C.toInt(), 0xFF6E1A0E.toInt(), R.string.theme_legendary),
        Theme("masters", 0xFFFFD0E8.toInt(), 0xFFFF4FA3.toInt(), 0xFF6B0F3D.toInt(), R.string.theme_masters),
        Theme("emerald", 0xFFB4F7CC.toInt(), 0xFF26C26A.toInt(), 0xFF0D5A2C.toInt(), R.string.theme_emerald),
        Theme("frost", 0xFFFFFFFF.toInt(), 0xFFB7C3E6.toInt(), 0xFF3C4766.toInt(), R.string.theme_frost),
        Theme("midnight", 0xFF6F86F0.toInt(), 0xFF1A2350.toInt(), 0xFF9FB0FF.toInt(), R.string.theme_midnight),
        // 1.46, Bubble Supporter: dark stone with a gold rim, and a holographic shimmer.
        Theme("obsidian", 0xFF9A90AD.toInt(), 0xFF2E2938.toInt(), 0xFFFFC53D.toInt(), R.string.theme_obsidian, supporter = true),
        Theme(
            "holo", 0xFFFFB3E6.toInt(), 0xFFB8FFD9.toInt(), 0xFF4B3A78.toInt(), R.string.theme_holo,
            stops = intArrayOf(0xFFFFB3E6.toInt(), 0xFFC7A8FF.toInt(), 0xFF8FE3FF.toInt(), 0xFFB8FFD9.toInt()),
            supporter = true,
        ),
    )

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

    fun tilt(context: Context): Boolean = prefs(context).getBoolean(KEY_TILT, true)

    fun theme(context: Context): Theme {
        val id = prefs(context).getString(KEY_THEME, null)
        // A supporter theme only while the purchase stands (a refund puts gold back).
        return THEMES.firstOrNull { it.id == id && (!it.supporter || Supporter.active(context)) } ?: THEMES[0]
    }

    /** The ring behind the bubble's face, in the chosen theme (was drawable/bubble_badge). */
    fun badge(context: Context, theme: Theme = theme(context)): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, theme.stops ?: intArrayOf(theme.top, theme.bottom)).apply {
            shape = GradientDrawable.OVAL
            setStroke((2 * context.resources.displayMetrics.density).toInt(), theme.edge)
        }

    fun setSize(context: Context, size: String) {
        prefs(context).edit().putString(KEY_SIZE, size).apply()
    }

    fun setIdle(context: Context, percent: Int) {
        prefs(context).edit().putInt(KEY_IDLE, percent).apply()
    }

    fun setTuck(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_TUCK, on).apply()
    }

    fun setTilt(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_TILT, on).apply()
    }

    /** The ring the bubble wears (1.43): only one the player owns. */
    fun ring(context: Context): String? =
        prefs(context).getString(KEY_RING, null)?.takeIf {
            it in Pass.owned(context) || (it == Rings.SUPPORTER.id && Supporter.active(context))
        }

    fun setRing(context: Context, id: String?) {
        prefs(context).edit().apply { if (id == null) remove(KEY_RING) else putString(KEY_RING, id) }.apply()
    }

    fun setTheme(context: Context, id: String) {
        prefs(context).edit().putString(KEY_THEME, id).apply()
    }
}
