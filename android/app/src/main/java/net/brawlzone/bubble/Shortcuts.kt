package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Long-press the app icon (1.40): Show bubble, Counters, Free rewards.
 *
 * Dynamic shortcuts rather than a static XML file: a static shortcut names its
 * target package, and the side-by-side test build has a different one. They
 * are published from the app screen, in the app's language, and published
 * again whenever that screen is drawn so a language change reaches them.
 */
object Shortcuts {

    /** Starts the bubble and opens Brawl Stars. */
    const val ACTION_PLAY = "net.brawlzone.bubble.PLAY"

    /** Starts the bubble with the panel open on the Counters tab. */
    const val ACTION_COUNTERS = "net.brawlzone.bubble.COUNTERS"
    /** The panel on its Trophies tab (1.41): the Trophies widget and the prestige heads-up. */
    const val ACTION_TROPHIES = "net.brawlzone.bubble.TROPHIES"

    /** With ACTION_COUNTERS: open that brawler's counters (a widget tap). */
    const val EXTRA_BRAWLER = "brawler"

    private const val BRAWL_STARS = "com.supercell.brawlstars"

    fun publish(context: Context) {
        val local = AppLang.wrap(context)
        fun app(id: String, action: String, label: Int, icon: Int, rank: Int) =
            ShortcutInfoCompat.Builder(context, id)
                .setShortLabel(local.getString(label))
                .setIcon(IconCompat.createWithResource(context, icon))
                .setIntent(Intent(context, MainActivity::class.java).setAction(action))
                .setRank(rank)
                .build()
        val list = listOf(
            app("bubble", ACTION_PLAY, R.string.shortcut_bubble, R.drawable.shortcut_bubble, 0),
            app("counters", ACTION_COUNTERS, R.string.shortcut_counters, R.drawable.shortcut_counters, 1),
            ShortcutInfoCompat.Builder(context, "rewards")
                .setShortLabel(local.getString(R.string.shortcut_rewards))
                .setIcon(IconCompat.createWithResource(context, R.drawable.shortcut_rewards))
                .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse("${Http.SITE}/rewards")))
                .setRank(2)
                .build(),
        )
        runCatching { ShortcutManagerCompat.setDynamicShortcuts(context, list) }
    }

    /**
     * Handles the app's own actions. Returns true when the screen has nothing
     * left to show and should get out of the way.
     */
    fun handle(activity: Activity, intent: Intent?): Boolean = when (intent?.action) {
        ACTION_PLAY -> {
            if (startBubble(activity, null)) {
                openGame(activity)
                true
            } else false
        }
        ACTION_COUNTERS -> startBubble(activity, "counters", intent?.getIntExtra(EXTRA_BRAWLER, 0)?.takeIf { it > 0 })
        ACTION_TROPHIES -> startBubble(activity, "trophies")
        else -> false
    }

    /**
     * Starts the bubble, optionally with the panel open on a tab. Returns false
     * (and leaves the app screen up) when the overlay permission is missing,
     * because that screen is where the player can grant it.
     */
    fun startBubble(activity: Activity, tab: String?, brawler: Int? = null): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(activity)) return false
        val intent = Intent(activity, BubbleService::class.java)
        if (tab != null) {
            intent.action = BubbleService.ACTION_OPEN_PANEL
            intent.putExtra(BubbleService.EXTRA_TAB, tab)
            if (brawler != null) intent.putExtra(BubbleService.EXTRA_BRAWLER, brawler)
        }
        return runCatching { activity.startForegroundService(intent) }.isSuccess
    }

    /** Opens Brawl Stars, or its Play page when it is not installed. */
    fun openGame(activity: Activity) {
        val launch = activity.packageManager.getLaunchIntentForPackage(BRAWL_STARS)
        if (launch != null) {
            runCatching { activity.startActivity(launch) }
            return
        }
        Toast.makeText(activity, R.string.onb_no_game, Toast.LENGTH_LONG).show()
        runCatching {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$BRAWL_STARS")),
            )
        }
    }
}
