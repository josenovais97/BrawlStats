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

        /** A check now, off the main thread, unless one ran in the last half hour. */
        fun runSoon(context: Context, force: Boolean = false) {
            val app = context.applicationContext
            if (!force && System.currentTimeMillis() - Alerts.lastFetchedAt(app) < STALE_MS) return
            Thread { runCatching { run(app) } }.start()
        }

        private fun run(context: Context) {
            val body = runCatching { Http.text(Alerts.URL) }.getOrNull() ?: return
            val data = runCatching { Alerts.parse(body) }.getOrNull() ?: return
            Alerts.remember(context, body)
            val post = Alerts.enabled(context)
            Notify.rewards(context, data.rewards, post)
            Notify.season(context, data, post)
            RewardsWidget.update(context, data)
        }
    }
}
