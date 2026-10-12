package net.brawlzone.bubble

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import java.util.Locale

/**
 * The app's language, which is also the panel's.
 *
 * One setting, not two. The panel has had a language picker since 1.27, and an
 * app screen in Portuguese next to a panel in English would be the kind of
 * seam that makes people think one half is broken. So whichever side the
 * player changes it on, the other follows: the app seeds the panel's storage
 * when it loads (`Account.bootstrapScript`), and the panel reports a choice
 * back over the bridge.
 *
 * The codes and the order are the site's `BUBBLE_LANGS` -- the languages Brawl
 * Stars ships -- because a player's question is "the game's language", never
 * "a language". The flag sits beside every name for the same reason it does in
 * the panel: the player who needs this list most is the one who cannot read
 * the language it is currently in.
 *
 * Applied per context rather than through `AppCompatDelegate`: the service and
 * the Quick Settings tile draw text too, and the delegate only reaches
 * activities.
 */
object AppLang {

    data class Lang(
        val code: String,
        val flag: String,
        val label: String,
        val english: String,
        /** Whether Lilita One has the letters, see `MainActivity.gameType`. */
        val latin: Boolean = true,
    )

    val ALL = listOf(
        Lang("en", "🇬🇧", "English", "English"),
        Lang("fr", "🇫🇷", "Français", "French"),
        Lang("de", "🇩🇪", "Deutsch", "German"),
        Lang("es", "🇪🇸", "Español", "Spanish"),
        Lang("es-419", "🇲🇽", "Español (Latinoamérica)", "Spanish (Latin America)"),
        Lang("it", "🇮🇹", "Italiano", "Italian"),
        Lang("pt", "🇧🇷", "Português", "Portuguese"),
        Lang("nl", "🇳🇱", "Nederlands", "Dutch"),
        Lang("pl", "🇵🇱", "Polski", "Polish"),
        Lang("tr", "🇹🇷", "Türkçe", "Turkish"),
        Lang("fi", "🇫🇮", "Suomi", "Finnish"),
        Lang("ru", "🇷🇺", "Русский", "Russian", latin = false),
        Lang("zh-Hans", "🇨🇳", "简体中文", "Chinese (Simplified)", latin = false),
        Lang("zh-Hant", "🇹🇼", "繁體中文", "Chinese (Traditional)", latin = false),
        Lang("ja", "🇯🇵", "日本語", "Japanese", latin = false),
        Lang("ko", "🇰🇷", "한국어", "Korean", latin = false),
        Lang("ms", "🇲🇾", "Bahasa Melayu", "Malay"),
        Lang("id", "🇮🇩", "Bahasa Indonesia", "Indonesian"),
        // Latin letters, but Lilita One has no Vietnamese stacked accents.
        Lang("vi", "🇻🇳", "Tiếng Việt", "Vietnamese", latin = false),
        Lang("th", "🇹🇭", "ภาษาไทย", "Thai", latin = false),
        Lang("ar", "🇸🇦", "العربية", "Arabic", latin = false),
        Lang("he", "🇮🇱", "עברית", "Hebrew", latin = false),
    )

    private const val PREFS = "brawlzone-lang"
    const val KEY = "lang"

    fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun byCode(code: String?): Lang? = ALL.firstOrNull { it.code == code }

    /** What the player picked, on either side; null until they pick. */
    fun chosen(context: Context): String? =
        byCode(prefs(context).getString(KEY, null))?.code

    /** The language in use: the choice, else the phone's. */
    fun current(context: Context): String = chosen(context) ?: detect(systemTags())

    fun set(context: Context, code: String): Boolean {
        if (byCode(code) == null || chosen(context) == code) return false
        prefs(context).edit().putString(KEY, code).apply()
        return true
    }

    /*
     * The phone's languages, read from the system rather than from `context`:
     * a wrapped context already answers in the chosen language, which would
     * make "follow the phone" follow itself.
     */
    private fun systemTags(): List<String> {
        val list = Resources.getSystem().configuration.locales
        return (0 until list.size()).map { list[it].toLanguageTag() }
    }

    /**
     * The same rules as the site's `detectBubbleLang`, so a player who never
     * opens either picker sees the app and the panel agree.
     */
    fun detect(tags: List<String>): String {
        for (raw in tags) {
            val tag = raw.lowercase()
            val parts = tag.split('-')
            val base = parts[0]
            if (base == "zh") {
                return if (Regex("hant|tw|hk|mo").containsMatchIn(tag)) "zh-Hant" else "zh-Hans"
            }
            if (base == "es") {
                // Spain gets Castilian; every other region the game's Latin
                // American Spanish.
                val region = parts.getOrNull(1).orEmpty()
                return if (region == "" || region == "es") "es" else "es-419"
            }
            // Older Android still reports the pre-1989 codes for these two.
            val mapped = when (base) {
                "iw" -> "he"
                "in" -> "id"
                else -> base
            }
            if (byCode(mapped) != null) return mapped
        }
        return "en"
    }

    fun locale(code: String): Locale = Locale.forLanguageTag(code)

    /** A context whose resources answer in the app's language. */
    fun wrap(base: Context): Context {
        val locale = locale(current(base))
        val config = Configuration(base.resources.configuration)
        config.setLocale(locale)
        config.setLayoutDirection(locale)
        return base.createConfigurationContext(config)
    }
}
