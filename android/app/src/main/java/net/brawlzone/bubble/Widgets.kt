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
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.io.File
import java.security.MessageDigest
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

/**
 * Every home-screen widget (1.40), drawn from the hourly check's saved answers.
 *
 * Four kinds share one renderer: small (free reward), medium (reward and the
 * top pick), large (Ranked meta: the top five for all modes or one mode, the
 * reward and the season countdown) and "My rank". Each widget keeps its own
 * settings (mode, reward on/off, background opacity), set when it is placed.
 *
 * Pictures are downloaded by the check, off the main thread, and kept in files
 * named after their URL, so a widget never fetches anything while drawing.
 */
object Widgets {

    const val ACTION_REFRESH = "net.brawlzone.bubble.WIDGET_REFRESH"

    enum class Kind { SMALL, MEDIUM, LARGE, RANK }

    data class Settings(val mode: String?, val reward: Boolean, val opacity: Int)

    private const val PREFS = "brawlzone-widgets"
    private const val IMAGES = "widget-images"

    private val PROVIDERS: List<Pair<Class<out AppWidgetProvider>, Kind>> = listOf(
        SmallRewardWidget::class.java to Kind.SMALL,
        RewardsWidget::class.java to Kind.MEDIUM,
        MetaWidget::class.java to Kind.LARGE,
        RankWidget::class.java to Kind.RANK,
    )

    private val TIER_COLORS = mapOf(
        "S" to Color.parseColor("#FF5C7A"),
        "A" to Color.parseColor("#FF9F43"),
        "B" to Color.parseColor("#FFD43B"),
        "C" to Color.parseColor("#69DB7C"),
        "D" to Color.parseColor("#4DABF7"),
    )

    // ------------------------------------------------------------ settings

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun settings(context: Context, id: Int): Settings {
        val p = prefs(context)
        return Settings(
            mode = p.getString("mode_$id", null),
            reward = p.getBoolean("reward_$id", true),
            opacity = p.getInt("opacity_$id", 100),
        )
    }

    fun save(context: Context, id: Int, settings: Settings) {
        prefs(context).edit()
            .putString("mode_$id", settings.mode)
            .putBoolean("reward_$id", settings.reward)
            .putInt("opacity_$id", settings.opacity)
            .apply()
    }

    fun forget(context: Context, ids: IntArray) {
        val e = prefs(context).edit()
        for (id in ids) e.remove("mode_$id").remove("reward_$id").remove("opacity_$id")
        e.apply()
    }

    fun kindOf(context: Context, id: Int): Kind? {
        val provider = AppWidgetManager.getInstance(context)?.getAppWidgetInfo(id)?.provider?.className ?: return null
        return PROVIDERS.firstOrNull { it.first.name == provider }?.second
    }

    // ------------------------------------------------------------- drawing

    /** Redraws every placed widget from saved data. Safe off the main thread. */
    fun updateAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val alerts = Alerts.last(context)
        val me = Me.last(context)
        for ((cls, kind) in PROVIDERS) {
            for (id in manager.getAppWidgetIds(ComponentName(context, cls))) {
                draw(context, manager, id, kind, alerts, me)
            }
        }
    }

    fun draw(context: Context, manager: AppWidgetManager, id: Int, kind: Kind, alerts: Alerts.Data?, me: Me.Data?) {
        val views = when (kind) {
            Kind.SMALL -> small(context, id, alerts)
            Kind.MEDIUM -> medium(context, id, alerts)
            Kind.LARGE -> large(context, id, alerts)
            Kind.RANK -> rank(context, id, me)
        }
        runCatching { manager.updateAppWidget(id, views) }
    }

    fun drawOne(context: Context, id: Int) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val kind = kindOf(context, id) ?: return
        draw(context, manager, id, kind, Alerts.last(context), Me.last(context))
    }

    private fun small(context: Context, id: Int, data: Alerts.Data?): RemoteViews {
        val local = AppLang.wrap(context)
        val v = RemoteViews(context.packageName, R.layout.widget_small)
        background(v, settings(context, id))
        v.setOnClickPendingIntent(R.id.widget_root, openApp(context, id))
        v.setTextViewText(R.id.widget_reward_label, local.getString(R.string.widget_reward_label))
        reward(context, v, id, data, local)
        return v
    }

    private fun medium(context: Context, id: Int, data: Alerts.Data?): RemoteViews {
        val local = AppLang.wrap(context)
        val s = settings(context, id)
        val v = RemoteViews(context.packageName, R.layout.widget_rewards)
        background(v, s)
        header(context, v, id, RewardsWidget::class.java, local)
        v.setOnClickPendingIntent(R.id.widget_root, openApp(context, id))
        v.setViewVisibility(R.id.widget_reward_block, if (s.reward) View.VISIBLE else View.GONE)
        v.setTextViewText(R.id.widget_reward_label, local.getString(R.string.widget_reward_label))
        reward(context, v, id, data, local)

        val mode = data?.mode(s.mode)
        val pick = if (mode != null) mode.top.firstOrNull() else data?.topPick
        v.setTextViewText(
            R.id.widget_pick_label,
            if (mode != null) local.getString(R.string.widget_mode_pick_label, mode.label.uppercase())
            else local.getString(R.string.widget_pick_label),
        )
        if (pick != null) {
            v.setTextViewText(R.id.widget_pick_name, pick.name)
            v.setTextViewText(R.id.widget_pick_line, local.getString(R.string.widget_pick_line, pick.tier, percent(pick.winRate)))
            portrait(context, v, R.id.widget_pick_icon, pick.imageUrl)
            v.setOnClickPendingIntent(R.id.widget_pick_row, counters(context, pick.brawlerId, id * 10 + 1))
        } else {
            v.setTextViewText(R.id.widget_pick_name, local.getString(R.string.widget_loading))
            v.setTextViewText(R.id.widget_pick_line, "")
            v.setViewVisibility(R.id.widget_pick_icon, View.GONE)
        }
        return v
    }

    private fun large(context: Context, id: Int, data: Alerts.Data?): RemoteViews {
        val local = AppLang.wrap(context)
        val s = settings(context, id)
        val v = RemoteViews(context.packageName, R.layout.widget_meta)
        background(v, s)
        header(context, v, id, MetaWidget::class.java, local)
        v.setOnClickPendingIntent(R.id.widget_root, openApp(context, id))
        v.setViewVisibility(R.id.widget_reward_block, if (s.reward) View.VISIBLE else View.GONE)
        v.setTextViewText(R.id.widget_reward_label, local.getString(R.string.widget_reward_label))
        reward(context, v, id, data, local)

        val mode = data?.mode(s.mode)
        val list = mode?.top ?: data?.metaAll.orEmpty()
        v.setTextViewText(
            R.id.widget_meta_label,
            if (mode != null) local.getString(R.string.widget_mode_label, mode.label.uppercase())
            else local.getString(R.string.widget_meta_label),
        )
        val rows = listOf(
            Row(R.id.widget_row_1, R.id.widget_row_icon_1, R.id.widget_row_name_1, R.id.widget_row_tier_1, R.id.widget_row_wr_1),
            Row(R.id.widget_row_2, R.id.widget_row_icon_2, R.id.widget_row_name_2, R.id.widget_row_tier_2, R.id.widget_row_wr_2),
            Row(R.id.widget_row_3, R.id.widget_row_icon_3, R.id.widget_row_name_3, R.id.widget_row_tier_3, R.id.widget_row_wr_3),
            Row(R.id.widget_row_4, R.id.widget_row_icon_4, R.id.widget_row_name_4, R.id.widget_row_tier_4, R.id.widget_row_wr_4),
            Row(R.id.widget_row_5, R.id.widget_row_icon_5, R.id.widget_row_name_5, R.id.widget_row_tier_5, R.id.widget_row_wr_5),
        )
        rows.forEachIndexed { i, row ->
            val pick = list.getOrNull(i)
            if (pick == null) {
                v.setViewVisibility(row.root, if (i == 0) View.VISIBLE else View.GONE)
                if (i == 0) v.setTextViewText(row.name, local.getString(R.string.widget_loading))
                return@forEachIndexed
            }
            v.setViewVisibility(row.root, View.VISIBLE)
            v.setTextViewText(row.name, pick.name)
            v.setTextViewText(row.tier, pick.tier)
            v.setTextColor(row.tier, TIER_COLORS[pick.tier] ?: Color.parseColor("#A9B6E0"))
            v.setTextViewText(row.rate, percent(pick.winRate))
            portrait(context, v, row.icon, pick.imageUrl, hideWhenMissing = false)
            v.setOnClickPendingIntent(row.root, counters(context, pick.brawlerId, id * 10 + 2 + i))
        }
        v.setTextViewText(R.id.widget_season, seasonLine(context, data, local))
        return v
    }

    private fun rank(context: Context, id: Int, me: Me.Data?): RemoteViews {
        val local = AppLang.wrap(context)
        val v = RemoteViews(context.packageName, R.layout.widget_rank)
        background(v, settings(context, id))
        header(context, v, id, RankWidget::class.java, local)
        v.setOnClickPendingIntent(R.id.widget_root, openApp(context, id))
        if (me == null || me.rank == null) {
            v.setViewVisibility(R.id.widget_rank_body, View.GONE)
            v.setViewVisibility(R.id.widget_rank_empty, View.VISIBLE)
            v.setTextViewText(R.id.widget_rank_empty, local.getString(R.string.widget_rank_none))
            return v
        }
        v.setViewVisibility(R.id.widget_rank_body, View.VISIBLE)
        v.setViewVisibility(R.id.widget_rank_empty, View.GONE)
        v.setTextViewText(R.id.widget_rank_player, me.name)
        v.setTextViewText(R.id.widget_rank_name, me.rank)
        val eloText = me.elo?.let { local.getString(R.string.widget_elo, NumberFormat.getIntegerInstance().format(it)) } ?: ""
        v.setTextViewText(R.id.widget_rank_elo, eloText)
        cached(context, me.rankIcon)?.let { v.setImageViewBitmap(R.id.widget_rank_badge, it) }
        v.setProgressBar(R.id.widget_rank_bar, 100, ((me.share ?: 1.0) * 100).toInt().coerceIn(0, 100), false)
        val next = when {
            me.next == null -> local.getString(R.string.widget_rank_top)
            me.winsToNext != null && me.winsToNext >= 2 -> local.getString(R.string.widget_rank_wins, me.winsToNext, me.next)
            me.toNext != null -> local.getString(R.string.widget_rank_elo_to, NumberFormat.getIntegerInstance().format(me.toNext), me.next)
            else -> ""
        }
        v.setTextViewText(R.id.widget_rank_next, next)
        v.setTextViewText(
            R.id.widget_rank_last,
            if (me.games > 0) local.getString(R.string.widget_rank_last, me.games, me.wins, me.losses, me.stars) else "",
        )
        return v
    }

    private data class Row(val root: Int, val icon: Int, val name: Int, val tier: Int, val rate: Int)

    private fun reward(context: Context, v: RemoteViews, id: Int, data: Alerts.Data?, local: Context) {
        val reward = data?.rewards?.firstOrNull()
        if (reward != null) {
            v.setTextViewText(R.id.widget_reward_name, reward.name)
            v.setTextViewText(R.id.widget_claim, local.getString(R.string.widget_claim))
            v.setOnClickPendingIntent(R.id.widget_claim, view(context, id * 10 + 8, reward.url))
        } else {
            v.setTextViewText(R.id.widget_reward_name, local.getString(R.string.widget_no_reward))
            v.setTextViewText(R.id.widget_claim, local.getString(R.string.widget_rewards_link))
            v.setOnClickPendingIntent(R.id.widget_claim, view(context, id * 10 + 8, "${Http.SITE}/rewards"))
        }
    }

    private fun header(context: Context, v: RemoteViews, id: Int, provider: Class<out AppWidgetProvider>, local: Context) {
        val at = Alerts.lastFetchedAt(context)
        v.setTextViewText(
            R.id.widget_updated,
            if (at > 0) local.getString(R.string.widget_updated, android.text.format.DateFormat.getTimeFormat(context).format(Date(at))) else "",
        )
        val refresh = PendingIntent.getBroadcast(
            context,
            id,
            Intent(context, provider).setAction(ACTION_REFRESH).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        v.setOnClickPendingIntent(R.id.widget_refresh, refresh)
    }

    private fun background(v: RemoteViews, s: Settings) {
        val res = when {
            s.opacity <= 50 -> R.drawable.widget_background_50
            s.opacity <= 80 -> R.drawable.widget_background_80
            else -> R.drawable.widget_background
        }
        v.setInt(R.id.widget_root, "setBackgroundResource", res)
    }

    private fun seasonLine(context: Context, data: Alerts.Data?, local: Context): String {
        val season = data?.season ?: return ""
        val end = runCatching { LocalDate.parse(season.endsOn ?: data.nextStartsOn ?: "") }.getOrNull() ?: return ""
        val locale = local.resources.configuration.locales[0] ?: Locale.getDefault()
        val pattern = android.text.format.DateFormat.getBestDateTimePattern(locale, "MMMd")
        return local.getString(R.string.widget_season_ends, season.number, end.format(DateTimeFormatter.ofPattern(pattern, locale)))
    }

    private fun percent(rate: Double) = String.format(Locale.getDefault(), "%.1f%%", rate * 100)

    // ------------------------------------------------------------- intents

    private fun openApp(context: Context, id: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            id * 10,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    private fun view(context: Context, code: Int, url: String): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    /** A brawler tap: the bubble opens on Counters with that brawler (1.40). */
    private fun counters(context: Context, brawlerId: Int, code: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(context, MainActivity::class.java)
                .setAction(Shortcuts.ACTION_COUNTERS)
                .putExtra(Shortcuts.EXTRA_BRAWLER, brawlerId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    // -------------------------------------------------------------- images

    /** Downloads every picture the placed widgets need. Off the main thread. */
    fun prefetch(context: Context, alerts: Alerts.Data?, me: Me.Data?) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val urls = mutableSetOf<String>()
        for ((cls, kind) in PROVIDERS) {
            for (id in manager.getAppWidgetIds(ComponentName(context, cls))) {
                val s = settings(context, id)
                when (kind) {
                    Kind.MEDIUM -> (alerts?.mode(s.mode)?.top?.firstOrNull() ?: alerts?.topPick)?.imageUrl?.let(urls::add)
                    Kind.LARGE -> (alerts?.mode(s.mode)?.top ?: alerts?.metaAll.orEmpty()).mapNotNullTo(urls) { it.imageUrl }
                    Kind.RANK -> me?.rankIcon?.let(urls::add)
                    Kind.SMALL -> Unit
                }
            }
        }
        for (url in urls) download(context, url, round = url != me?.rankIcon)
    }

    private fun file(context: Context, url: String): File {
        val dir = File(context.filesDir, IMAGES).apply { mkdirs() }
        val hash = MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(dir, "$hash.png")
    }

    private fun download(context: Context, url: String, round: Boolean) {
        val target = file(context, url)
        if (target.exists()) return
        val bitmap = runCatching { Http.open(url).use { BitmapFactory.decodeStream(it) } }.getOrNull() ?: return
        val out = if (round) rounded(bitmap) else Bitmap.createScaledBitmap(bitmap, 160, 160, true)
        runCatching { target.outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }

    private fun cached(context: Context, url: String?): Bitmap? = url?.let {
        runCatching {
            val f = file(context, it)
            if (f.exists()) BitmapFactory.decodeFile(f.path) else null
        }.getOrNull()
    }

    private fun portrait(context: Context, v: RemoteViews, viewId: Int, url: String?, hideWhenMissing: Boolean = true) {
        val bitmap = cached(context, url)
        if (bitmap != null) {
            v.setImageViewBitmap(viewId, bitmap)
            v.setViewVisibility(viewId, View.VISIBLE)
        } else {
            v.setViewVisibility(viewId, if (hideWhenMissing) View.GONE else View.INVISIBLE)
        }
    }

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
