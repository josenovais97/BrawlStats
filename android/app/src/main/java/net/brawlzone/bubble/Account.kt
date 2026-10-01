package net.brawlzone.bubble

import android.content.Context

/**
 * The account the panel filters for, and how much of it it will show.
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
    private const val KEY_ROSTER = "roster"
    private const val KEY_ALERTS = "alerts"
    private const val KEY_SEEN = "seen_revision"
    private const val KEY_SEEN_MAPS = "seen_maps"

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

    /**
     * Whether to say anything when the Ranked rotation turns over.
     *
     * Off until asked for. The app has held `POST_NOTIFICATIONS` since the
     * overlay needed a foreground service, so the permission is already
     * granted and nothing would stop this defaulting to on — which is exactly
     * why it must not. A permission taken for one purpose is not consent for
     * another.
     */
    fun alerts(context: Context): Boolean = prefs(context).getBoolean(KEY_ALERTS, false)

    fun setAlerts(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_ALERTS, on).apply()
    }

    /** The rotation this account has already been told about. */
    fun seenRevision(context: Context): String =
        prefs(context).getString(KEY_SEEN, "").orEmpty()

    /**
     * The maps that were live last time, so the next check can say which ones
     * are *new*.
     *
     * The revision alone is not enough. Around twenty-six Ranked maps are live
     * at once and they do not all turn over together, so a revision that moved
     * means "something changed", not "all of this is new" — and a notification
     * headed "new maps" listing four that have been there a fortnight is a
     * notification people switch off.
     *
     * Empty is its own case and is handled at the call site: on a first run
     * everything looks new, and announcing all twenty-six is the worst possible
     * introduction to a feature somebody just enabled.
     */
    fun seenMaps(context: Context): Set<String> =
        prefs(context).getString(KEY_SEEN_MAPS, "").orEmpty()
            .split('\n')
            .filter { it.isNotEmpty() }
            .toSet()

    fun setSeen(context: Context, revision: String, maps: Set<String>) {
        prefs(context).edit()
            .putString(KEY_SEEN, revision)
            .putString(KEY_SEEN_MAPS, maps.joinToString("\n"))
            .apply()
    }

    /**
     * The roster, natively, as `id.power.hyper` rows.
     *
     * The panel keeps its own copy in WebView storage, which Kotlin cannot
     * read — and the background check must not be the reason an upstream player
     * fetch happens on a timer on every install. A snapshot taken the last time
     * the app screen resolved the tag costs nothing and is as fresh as the
     * panel's own day-old cache.
     *
     * Deliberately not JSON. A hundred rows of three small numbers is a
     * kilobyte this way and four as objects, and nothing here needs a parser.
     */
    fun saveRoster(context: Context, roster: String) {
        prefs(context).edit().putString(KEY_ROSTER, roster).apply()
    }

    fun roster(context: Context): List<Triple<Int, Int, Boolean>> =
        prefs(context).getString(KEY_ROSTER, "").orEmpty()
            .split(',')
            .mapNotNull { row ->
                val parts = row.split('.')
                if (parts.size != 3) return@mapNotNull null
                val id = parts[0].toIntOrNull() ?: return@mapNotNull null
                val power = parts[1].toIntOrNull() ?: return@mapNotNull null
                Triple(id, power, parts[2] == "1")
            }

    /**
     * Whether this account can take that brawler under the current filter.
     *
     * The same three cases as `canField` in src/lib/bubble-account.ts, and they
     * have to stay the same: the overlay dims a brawler by one rule and a
     * notification would be naming a pick by another.
     */
    fun canField(context: Context, brawlerId: Int): Boolean {
        val mine = roster(context).firstOrNull { it.first == brawlerId } ?: return false
        return when (filter(context)) {
            FILTER_POWER_11 -> mine.second >= 11
            FILTER_HYPERCHARGE -> mine.second >= 11 && mine.third
            else -> true
        }
    }

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
