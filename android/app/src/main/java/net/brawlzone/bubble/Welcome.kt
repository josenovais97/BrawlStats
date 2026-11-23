package net.brawlzone.bubble

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.ScrollView
import java.time.LocalDate
import java.time.LocalTime

/**
 * The welcome week (1.42): a new install's first seven days, one short
 * notification a day at most, each showing one thing the player has not
 * tried yet: the tag, the bubble in a draft, a friend, a widget, Ask Bubble.
 * Anything already done is skipped, and nothing is sent once all of it is.
 *
 * Play's numbers were the reason: about half of the installs never opened
 * the app twice, and almost nobody was still there after a week.
 *
 * Only for installs under a week old (the package's first install time, so an
 * update to 1.42 is not a new player), from the second day, in the evening
 * when people play (17:00-21:00 on the phone's clock), behind the same
 * notification switch as every other alert and on its own channel.
 */
object Welcome {

    const val ACTION_FRIENDS = "net.brawlzone.bubble.WELCOME_FRIENDS"
    const val ACTION_WIDGET = "net.brawlzone.bubble.WELCOME_WIDGET"

    private enum class Step(val key: String, val title: Int, val text: Int, val action: String?) {
        TAG("tag", R.string.welcome_tag_title, R.string.welcome_tag_text, null),
        // 1.44: Home, where the Play button is (it used to open the game straight away).
        BUBBLE("bubble", R.string.welcome_bubble_title, R.string.welcome_bubble_text, Tabs.ACTION_OPEN_HOME),
        FRIEND("friend", R.string.welcome_friend_title, R.string.welcome_friend_text, ACTION_FRIENDS),
        WIDGET("widget", R.string.welcome_widget_title, R.string.welcome_widget_text, ACTION_WIDGET),
        ASK("ask", R.string.welcome_ask_title, R.string.welcome_ask_text, Shortcuts.ACTION_ASK),
    }

    private const val PREFS = "brawlzone-welcome"
    private const val KEY_SENT = "sent"
    private const val KEY_DAY = "day"
    private const val KEY_BUBBLE = "bubble_used"
    private const val DAY_MS = 24 * 60 * 60 * 1000L
    private const val FIRST_MS = 20 * 60 * 60 * 1000L
    private const val WEEK_MS = 7 * DAY_MS
    private const val FROM_HOUR = 17
    private const val TO_HOUR = 21

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Whether the bubble has ever come up on this install (1.43: Home's first-run cards). */
    fun wasBubbleUsed(context: Context): Boolean = prefs(context).getBoolean(KEY_BUBBLE, false)

    /** The bubble came up at least once (BubbleService.onCreate). */
    fun bubbleUsed(context: Context) {
        val p = prefs(context)
        if (!p.getBoolean(KEY_BUBBLE, false)) p.edit().putBoolean(KEY_BUBBLE, true).apply()
    }

    private fun done(context: Context, step: Step): Boolean = when (step) {
        Step.TAG -> Account.tag(context).isNotEmpty()
        Step.BUBBLE -> prefs(context).getBoolean(KEY_BUBBLE, false)
        Step.FRIEND -> Friends.tags(context).isNotEmpty()
        Step.WIDGET -> hasWidget(context)
        // The panel is a web page and does not tell the app; asked about once.
        Step.ASK -> false
    }

    private fun hasWidget(context: Context): Boolean = runCatching {
        val m = AppWidgetManager.getInstance(context)
        m.getInstalledProvidersForPackage(context.packageName, null).any { m.getAppWidgetIds(it.provider).isNotEmpty() }
    }.getOrDefault(false)

    /** From the hourly check, off the main thread. */
    fun check(context: Context, post: Boolean) {
        if (!post) return
        val installed = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).firstInstallTime }.getOrNull() ?: return
        val age = System.currentTimeMillis() - installed
        if (age < FIRST_MS || age > WEEK_MS) return
        if (LocalTime.now().hour !in FROM_HOUR until TO_HOUR) return
        val p = prefs(context)
        val today = LocalDate.now().toString()
        if (p.getString(KEY_DAY, null) == today) return
        val sent = p.getStringSet(KEY_SENT, null) ?: emptySet()
        val step = Step.values().firstOrNull { it.key !in sent && !done(context, it) } ?: return
        p.edit().putStringSet(KEY_SENT, sent + step.key).putString(KEY_DAY, today).apply()
        val local = AppLang.wrap(context)
        Notify.postWelcome(context, 7400 + step.ordinal, local.getString(step.title), local.getString(step.text), step.action)
    }

    /** The two taps that land on the app screen itself. True when handled. */
    fun handle(activity: Activity, intent: Intent?): Boolean = when (intent?.action) {
        ACTION_FRIENDS -> {
            scrollTo(activity, R.id.friends_caption)
            true
        }
        ACTION_WIDGET -> {
            pinWidget(activity)
            true
        }
        else -> false
    }

    private fun scrollTo(activity: Activity, id: Int) {
        // 1.43: the app screen has tabs; it shows the one holding the view.
        if (activity is MainActivity) {
            activity.reveal(id)
            return
        }
        val scroll = activity.findViewById<ScrollView>(R.id.scroll) ?: return
        val target = activity.findViewById<View>(id) ?: return
        scroll.post {
            val box = android.graphics.Rect()
            target.getDrawingRect(box)
            scroll.offsetDescendantRectToMyCoords(target, box)
            scroll.smoothScrollTo(0, (box.top - scroll.paddingTop).coerceAtLeast(0))
        }
    }

    /** Android's own "add this widget?" sheet, for My rank; the launcher decides where it goes. */
    private fun pinWidget(activity: Activity) {
        val m = AppWidgetManager.getInstance(activity)
        if (m.isRequestPinAppWidgetSupported) {
            runCatching { m.requestPinAppWidget(ComponentName(activity, RankWidget::class.java), null, null) }
        }
    }
}
