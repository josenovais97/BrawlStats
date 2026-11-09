package net.brawlzone.bubble

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.io.File
import java.util.Locale

/**
 * The home-screen widget (1.40): the newest free reward with a Claim button,
 * and today's top Ranked pick.
 *
 * Drawn from the hourly check's saved answer, so it shows something the moment
 * it is placed and never fetches on the launcher's thread. The pick's portrait
 * is downloaded by the check and kept in a file for the same reason.
 */
class RewardsWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        draw(context, manager, ids, Alerts.last(context))
        AlertJob.schedule(context)
        AlertJob.runSoon(context)
    }

    companion object {
        private const val PORTRAIT = "widget_pick.png"
        private const val PORTRAIT_URL_KEY = "widget_pick_url"

        /** New data from the hourly check. Called off the main thread. */
        fun update(context: Context, data: Alerts.Data) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, RewardsWidget::class.java))
            if (ids.isEmpty()) return
            data.topPick?.imageUrl?.let { url -> cachePortrait(context, url) }
            draw(context, manager, ids, data)
        }

        private fun draw(context: Context, manager: AppWidgetManager, ids: IntArray, data: Alerts.Data?) {
            val local = AppLang.wrap(context)
            val views = RemoteViews(context.packageName, R.layout.widget_rewards)

            // The whole card opens the app.
            views.setOnClickPendingIntent(R.id.widget_root, activity(context, 8100, Intent(context, MainActivity::class.java)))

            views.setTextViewText(R.id.widget_reward_label, local.getString(R.string.widget_reward_label))
            views.setTextViewText(R.id.widget_pick_label, local.getString(R.string.widget_pick_label))

            val reward = data?.rewards?.firstOrNull()
            if (reward != null) {
                views.setTextViewText(R.id.widget_reward_name, reward.name)
                views.setTextViewText(R.id.widget_claim, local.getString(R.string.widget_claim))
                views.setOnClickPendingIntent(
                    R.id.widget_claim,
                    activity(context, 8101, Intent(Intent.ACTION_VIEW, Uri.parse(reward.url))),
                )
            } else {
                views.setTextViewText(R.id.widget_reward_name, local.getString(R.string.widget_no_reward))
                views.setTextViewText(R.id.widget_claim, local.getString(R.string.widget_rewards_link))
                views.setOnClickPendingIntent(
                    R.id.widget_claim,
                    activity(context, 8101, Intent(Intent.ACTION_VIEW, Uri.parse("${Http.SITE}/rewards"))),
                )
            }

            val pick = data?.topPick
            if (pick != null) {
                views.setTextViewText(R.id.widget_pick_name, prettyName(pick.name))
                val rate = String.format(Locale.getDefault(), "%.1f%%", pick.winRate * 100)
                views.setTextViewText(R.id.widget_pick_line, local.getString(R.string.widget_pick_line, pick.tier, rate))
                val portrait = savedPortrait(context)
                if (portrait != null) {
                    views.setImageViewBitmap(R.id.widget_pick_icon, portrait)
                    views.setViewVisibility(R.id.widget_pick_icon, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_pick_icon, View.GONE)
                }
            } else {
                views.setTextViewText(R.id.widget_pick_name, local.getString(R.string.widget_loading))
                views.setTextViewText(R.id.widget_pick_line, "")
                views.setViewVisibility(R.id.widget_pick_icon, View.GONE)
            }
            // The pick starts the bubble and opens the game: that is where it is useful.
            views.setOnClickPendingIntent(
                R.id.widget_pick_row,
                activity(context, 8102, Intent(context, MainActivity::class.java).setAction(Shortcuts.ACTION_PLAY)),
            )

            runCatching { manager.updateAppWidget(ids, views) }
        }

        private fun activity(context: Context, code: Int, intent: Intent): PendingIntent =
            PendingIntent.getActivity(
                context,
                code,
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        /** "MR. P" stays, "STU" becomes "Stu": the API shouts every name. */
        private fun prettyName(name: String): String =
            name.split(" ").joinToString(" ") { word ->
                if (word.length <= 2 || word.contains('.')) word
                else word.lowercase(Locale.ROOT).replaceFirstChar { it.titlecase(Locale.ROOT) }
            }

        private fun cachePortrait(context: Context, url: String) {
            val prefs = Alerts.prefs(context)
            val file = File(context.filesDir, PORTRAIT)
            if (prefs.getString(PORTRAIT_URL_KEY, null) == url && file.exists()) return
            val bitmap = runCatching { Http.open(url).use { BitmapFactory.decodeStream(it) } }.getOrNull() ?: return
            val rounded = rounded(bitmap)
            runCatching {
                file.outputStream().use { rounded.compress(Bitmap.CompressFormat.PNG, 100, it) }
                prefs.edit().putString(PORTRAIT_URL_KEY, url).apply()
            }
        }

        private fun savedPortrait(context: Context): Bitmap? = runCatching {
            val file = File(context.filesDir, PORTRAIT)
            if (file.exists()) BitmapFactory.decodeFile(file.path) else null
        }.getOrNull()

        /** Rounded corners drawn into the bitmap, since a widget cannot clip a view. */
        private fun rounded(source: Bitmap): Bitmap {
            val size = 160
            val scaled = Bitmap.createScaledBitmap(source, size, size, true)
            val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(out)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            canvas.drawRoundRect(RectF(0f, 0f, size.toFloat(), size.toFloat()), 32f, 32f, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(scaled, 0f, 0f, paint)
            return out
        }
    }
}
