package net.brawlzone.bubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/**
 * Free reward and Ranked season notifications (1.40).
 *
 * Two channels, so a player can keep one and mute the other in Android's own
 * settings. Both sit behind one switch on the app's screen.
 *
 * Quiet by construction: a reward is announced once, ever (ids are kept);
 * the first check after install only learns what already exists, so nobody
 * gets a burst of old rewards; and each season produces at most two
 * notifications, one when it starts and one two days before it ends.
 */
object Notify {

    private const val CH_REWARDS = "brawlzone-rewards"
    private const val CH_SEASON = "brawlzone-season"

    private const val KEY_SEEN = "seen_rewards"
    private const val KEY_SEASON_START = "season_start_sent"
    private const val KEY_SEASON_END = "season_end_sent"
    private const val MAX_SEEN = 60

    private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

    private fun channels(context: Context) {
        val local = AppLang.wrap(context)
        val m = manager(context) ?: return
        m.createNotificationChannel(
            NotificationChannel(CH_REWARDS, local.getString(R.string.channel_rewards), NotificationManager.IMPORTANCE_DEFAULT),
        )
        m.createNotificationChannel(
            NotificationChannel(CH_SEASON, local.getString(R.string.channel_season), NotificationManager.IMPORTANCE_DEFAULT),
        )
    }

    /** New rewards since the last check, at most three at once. Runs off the main thread. */
    fun rewards(context: Context, rewards: List<Alerts.Reward>, post: Boolean) {
        val prefs = Alerts.prefs(context)
        val stored = prefs.getStringSet(KEY_SEEN, null)
        val ids = rewards.map { it.id }
        if (stored == null) {
            // First check on this install: learn what exists, announce nothing.
            prefs.edit().putStringSet(KEY_SEEN, ids.toSet()).apply()
            return
        }
        val seen = HashSet(stored)
        val fresh = rewards.filter { it.id !in seen }
        if (fresh.isEmpty()) return
        prefs.edit().putStringSet(KEY_SEEN, (seen + fresh.map { it.id }).toList().takeLast(MAX_SEEN).toSet()).apply()
        if (!post || manager(context)?.areNotificationsEnabled() != true) return
        for (reward in fresh.take(3)) postReward(context, reward)
    }

    private fun postReward(context: Context, reward: Alerts.Reward) {
        channels(context)
        val local = AppLang.wrap(context)
        run {
            val open = PendingIntent.getActivity(
                context,
                reward.id.hashCode(),
                Intent(Intent.ACTION_VIEW, Uri.parse(reward.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val builder = Notification.Builder(context, CH_REWARDS)
                .setSmallIcon(R.drawable.bubble_glyph)
                .setColor(context.getColor(R.color.brand))
                .setContentTitle(local.getString(R.string.alert_reward_title))
                .setContentText(local.getString(R.string.alert_reward_text, reward.name))
                .setContentIntent(open)
                .setAutoCancel(true)
            picture(reward.image)?.let { bitmap ->
                builder.setLargeIcon(bitmap)
                builder.setStyle(Notification.BigPictureStyle().bigPicture(bitmap).bigLargeIcon(null as Bitmap?))
            }
            runCatching { manager(context)?.notify(reward.id.hashCode(), builder.build()) }
        }
    }

    /**
     * "Season N just started" in its first two days, and "ends in two days"
     * (or "tomorrow", if the check missed the day before) near its end. Each
     * at most once per season number.
     */
    fun season(context: Context, data: Alerts.Data, post: Boolean) {
        val season = data.season ?: return
        val today = LocalDate.now(ZoneOffset.UTC)
        val prefs = Alerts.prefs(context)
        val start = runCatching { LocalDate.parse(season.startsOn) }.getOrNull()
        val end = runCatching { LocalDate.parse(season.endsOn ?: data.nextStartsOn ?: "") }.getOrNull()

        val startDue = start != null && !today.isBefore(start) &&
            ChronoUnit.DAYS.between(start, today) <= 2 &&
            prefs.getInt(KEY_SEASON_START, 0) != season.number
        val daysLeft = end?.let { ChronoUnit.DAYS.between(today, it) }
        val endDue = daysLeft != null && daysLeft in 1..2 &&
            prefs.getInt(KEY_SEASON_END, 0) != season.number

        if (!startDue && !endDue) return
        // Mark first: a season is announced once even if posting is off or fails.
        prefs.edit().apply {
            if (startDue) putInt(KEY_SEASON_START, season.number)
            if (endDue) putInt(KEY_SEASON_END, season.number)
        }.apply()
        if (!post || manager(context)?.areNotificationsEnabled() != true) return
        postSeason(context, season.number, startDue, daysLeft)
    }

    private fun postSeason(context: Context, number: Int, start: Boolean, daysLeft: Long?) {
        channels(context)
        val local = AppLang.wrap(context)

        // Tapping either one starts the bubble and opens Brawl Stars.
        val play = PendingIntent.getActivity(
            context,
            7001,
            Intent(context, MainActivity::class.java)
                .setAction(Shortcuts.ACTION_PLAY)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val (title, text) = if (start) {
            local.getString(R.string.alert_season_start_title, number) to
                local.getString(R.string.alert_season_start_text)
        } else {
            local.getString(if (daysLeft == 1L) R.string.alert_season_end1_title else R.string.alert_season_end2_title) to
                local.getString(R.string.alert_season_end_text)
        }
        val notification = Notification.Builder(context, CH_SEASON)
            .setSmallIcon(R.drawable.bubble_glyph)
            .setColor(context.getColor(R.color.brand))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(play)
            .setAutoCancel(true)
            .build()
        runCatching { manager(context)?.notify(if (start) 7001 else 7002, notification) }
    }

    /**
     * The test build's "Send test notifications" (1.40, qa only): the newest
     * reward and both season notifications, posted now, through the same code
     * players get, without touching what has been announced. Off the main thread.
     */
    fun test(context: Context) {
        val data = Alerts.last(context) ?: runCatching { Alerts.parse(Http.text(Alerts.URL)) }.getOrNull()
        val reward = data?.rewards?.firstOrNull()
            ?: Alerts.Reward("test", "10x Gems", "${Http.SITE}/rewards", null)
        val number = data?.season?.number ?: 50
        postReward(context, reward.copy(id = "test-" + reward.id))
        postSeason(context, number + 1, start = true, daysLeft = null)
        postSeason(context, number, start = false, daysLeft = 2L)
    }

    private fun picture(url: String?): Bitmap? = url?.let {
        runCatching { Http.open(it).use { stream -> BitmapFactory.decodeStream(stream) } }.getOrNull()
    }
}
