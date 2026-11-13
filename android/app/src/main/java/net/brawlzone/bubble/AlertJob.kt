package net.brawlzone.bubble

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.util.Log

/**
 * The hourly check (1.40): one request to `/api/bubble/alerts`, then any new
 * free reward or season notification, then a widget refresh.
 *
 * The platform's JobScheduler rather than a library: it batches the work with
 * everything else the phone is doing, waits for a network, and survives a
 * restart, which is all an hourly look at one small JSON file needs.
 */
class AlertJob : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        Thread {
            runCatching { run(applicationContext) }.onFailure { Log.w(TAG, "check failed", it) }
            jobFinished(params, false)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        private const val TAG = "BrawlZoneAlerts"
        private const val JOB_ID = 4711
        private const val HOUR = 60 * 60 * 1000L
        private const val STALE_MS = 30 * 60 * 1000L

        /** Registers the hourly check once; later calls leave it alone. */
        fun schedule(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (scheduler.getPendingJob(JOB_ID) != null) return
            val job = JobInfo.Builder(JOB_ID, ComponentName(context, AlertJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(HOUR, 15 * 60 * 1000L)
                .setPersisted(true)
                .build()
            runCatching { scheduler.schedule(job) }.onFailure { Log.w(TAG, "schedule refused", it) }
        }

        /** Whether the saved answers are older than half an hour (1.40, the app screen). */
        fun isStale(context: Context): Boolean =
            System.currentTimeMillis() - Alerts.lastFetchedAt(context) >= STALE_MS

        /** A check now, off the main thread, unless one ran in the last half hour. */
        fun runSoon(context: Context, force: Boolean = false) {
            val app = context.applicationContext
            if (!force && System.currentTimeMillis() - Alerts.lastFetchedAt(app) < STALE_MS) return
            Thread { runCatching { run(app) } }.start()
        }

        /**
         * The check itself, on the calling thread (never the main one): the
         * shared alerts, the player's own standing when a tag is set, the
         * friends (1.40), then notifications and every widget.
         */
        fun runNow(context: Context) {
            val body = runCatching { Http.text(Alerts.url(context)) }.getOrNull()
            val data = body?.let { runCatching { Alerts.parse(it) }.getOrNull() }
            if (body != null && data != null) Alerts.remember(context, body)
            val me = Me.fetch(context) ?: Me.last(context)
            val post = Alerts.enabled(context)
            if (data != null) {
                Notify.rewards(context, data.rewards, post)
                Notify.season(context, data, post)
            }
            // Balance changes to the player's mains (1.41).
            Patch.fetch(context)?.let { Notify.patch(context, it, post) }
            // Live trophy maps for the Trophies widget, and the prestige heads-up (1.41).
            Notify.prestige(context, Trophy.fetch(context) ?: Trophy.last(context), post)
            val alerts = data ?: Alerts.last(context)
            val season = alerts?.season?.number
            if (me != null) {
                Progress.check(context, me, season, post)
                // 1.40: the player's own games, then the goal, the season and the friends.
                val firstLook = !Tally.known(context, me.tag)
                val fresh = Tally.merge(context, me.tag, me.list)
                Goal.record(context, me.tag, fresh, firstLook, post)
                Season.update(context, me, alerts, fresh, post)
            }
            Friends.refresh(context, me, season, post)
            Widgets.prefetch(context, alerts, me)
            Widgets.updateAll(context)
        }

        private fun run(context: Context) = runNow(context)
    }
}
