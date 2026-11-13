package net.brawlzone.bubble

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

/**
 * The home-screen widgets (1.40). Drawing lives in Widgets; each provider is
 * one kind. A launcher update redraws from saved data and asks for a fresh
 * check if the last one is old; the refresh button runs a check right away.
 */
abstract class BubbleWidget(private val kind: Widgets.Kind) : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val alerts = Alerts.last(context)
        val me = Me.last(context)
        for (id in ids) Widgets.draw(context, manager, id, kind, alerts, me)
        AlertJob.schedule(context)
        AlertJob.runSoon(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Widgets.ACTION_REFRESH) {
            val pending = goAsync()
            val app = context.applicationContext
            Thread {
                try {
                    AlertJob.runNow(app)
                } finally {
                    pending.finish()
                }
            }.start()
            return
        }
        super.onReceive(context, intent)
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        Widgets.forget(context, ids)
    }
}

/** Small: the free reward and Claim. */
class SmallRewardWidget : BubbleWidget(Widgets.Kind.SMALL)

/** Medium: the free reward and the top pick (the 1.40 original). */
class RewardsWidget : BubbleWidget(Widgets.Kind.MEDIUM)

/** Large: Ranked meta, the top five, the reward and the season countdown. */
class MetaWidget : BubbleWidget(Widgets.Kind.LARGE)

/** "My rank": rank, elo, progress and recent record. */
class RankWidget : BubbleWidget(Widgets.Kind.RANK)

/** Friends (1.40): the player and up to five friends by elo, with this week's record. */
class FriendsWidget : BubbleWidget(Widgets.Kind.FRIENDS)
class TrophiesWidget : BubbleWidget(Widgets.Kind.TROPHIES)
