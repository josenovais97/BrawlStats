package net.brawlzone.bubble

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * "Ask Bubble" on the home screen (1.42): the bar opens Ask in the panel,
 * the mic asks by voice first (Shortcuts.ACTION_ASK / ACTION_ASK_VOICE).
 */
class AskWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val v = RemoteViews(context.packageName, R.layout.widget_ask)
            fun open(action: String, code: Int) = PendingIntent.getActivity(
                context,
                code,
                Intent(context, MainActivity::class.java).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            v.setOnClickPendingIntent(R.id.widget_ask_root, open(Shortcuts.ACTION_ASK, 9100))
            v.setOnClickPendingIntent(R.id.widget_ask_mic, open(Shortcuts.ACTION_ASK_VOICE, 9101))
            manager.updateAppWidget(id, v)
        }
    }
}
