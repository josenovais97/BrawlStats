package net.brawlzone.bubble

import android.content.Context

/**
 * The account the panel filters for, and the two switches beside it.
 *
 * Stored here and injected into the panel's WebView storage on load, rather
 * than appended to the panel URL. That is not a style preference: a query
 * parameter opts the panel page out of caching on the server, and the panel is
 * the one page on the site that gets opened over and over in a hurry.
 *
 * Nothing here is required. With no tag the panel behaves exactly as it always
 * has, showing the global list.
 */
object Account {

    private const val PREFS = "brawlzone-account"
    private const val KEY_TAG = "tag"
    private const val KEY_FILTER = "filter"
    private const val KEY_HIDE = "hide"

    /** Matches `OwnedFilter` in src/lib/bubble-account.ts. */
    const val FILTER_ALL = "all"
    const val FILTER_POWER_11 = "power11"
    const val FILTER_HYPERCHARGE = "hypercharge"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun tag(context: Context): String = prefs(context).getString(KEY_TAG, "").orEmpty()

    fun filter(context: Context): String =
        prefs(context).getString(KEY_FILTER, FILTER_ALL) ?: FILTER_ALL

    fun hide(context: Context): Boolean = prefs(context).getBoolean(KEY_HIDE, false)

    fun save(context: Context, tag: String, filter: String, hide: Boolean) {
        prefs(context).edit()
            .putString(KEY_TAG, normalise(tag))
            .putString(KEY_FILTER, filter)
            .putBoolean(KEY_HIDE, hide)
            .apply()
    }

    /**
     * What the site's `normalizeTag` accepts.
     *
     * People paste the tag with the hash, with a lowercase letter, or with a
     * stray space from the clipboard. Rejecting any of those would be a
     * pointless argument with the reader — and the game shows the tag with a
     * `#`, so typing it is the expected behaviour rather than a mistake.
     *
     * The letter O is not in the game's alphabet; a zero is what is meant
     * every time, so it is corrected rather than refused.
     */
    fun normalise(raw: String): String =
        raw.trim()
            .removePrefix("#")
            .uppercase()
            .replace(" ", "")
            .replace('O', '0')

    /** The game's tag alphabet. Anything else cannot be a real account. */
    private val VALID = Regex("^[0289PYLQGRJCUV]{3,15}$")

    fun isValid(tag: String): Boolean = VALID.matches(normalise(tag))

    /**
     * The JavaScript that seeds the panel's own storage.
     *
     * Written before the page's scripts run, so the panel reads settled values
     * on its first render rather than flashing the unfiltered list and then
     * correcting itself.
     *
     * The tag is quoted through `JSONObject.quote` rather than string
     * concatenation: it is user input on its way into an `evaluateJavascript`
     * call, and building that by hand is how an injection bug gets written.
     */
    fun bootstrapScript(context: Context): String {
        val tag = org.json.JSONObject.quote(tag(context))
        val filter = org.json.JSONObject.quote(filter(context))
        val hide = if (hide(context)) "'1'" else "'0'"
        return """
            (function () {
              try {
                localStorage.setItem('brawlzone-bubble-tag', $tag);
                localStorage.setItem('brawlzone-bubble-filter', $filter);
                localStorage.setItem('brawlzone-bubble-hide', $hide);
              } catch (e) {}
            })();
        """.trimIndent()
    }
}
