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
            runCatching {
                // 1.42: the 15-minute "playing now" look at the friends, or the hourly check.
                if (params.jobId == ONLINE_JOB_ID) {
                    val post = Alerts.enabled(applicationContext)
                    Online.check(applicationContext, post)
                    SessionRecap.quick(applicationContext, post)
                    Feed.pollAbout(applicationContext, post)
                } else {
                    run(applicationContext)
                }
            }.onFailure { Log.w(TAG, "check failed", it) }
            jobFinished(params, false)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        private const val TAG = "BrawlZoneAlerts"
        private const val JOB_ID = 4711
        /** "Playing now" (1.42, Online): friends' last games every 15 minutes, the shortest period Android allows. */
        const val ONLINE_JOB_ID = 4712
        private const val HOUR = 60 * 60 * 1000L
        private const val STALE_MS = 30 * 60 * 1000L

        /** Registers the hourly check once; later calls leave it alone. */
        fun schedule(context: Context) {
            scheduleOnline(context)
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (scheduler.getPendingJob(JOB_ID) != null) return
            val job = JobInfo.Builder(JOB_ID, ComponentName(context, AlertJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(HOUR, 15 * 60 * 1000L)
                .setPersisted(true)
                .build()
            runCatching { scheduler.schedule(job) }.onFailure { Log.w(TAG, "schedule refused", it) }
        }

        /** The 15-minute friends look (1.42), registered once like the hourly one. */
        fun scheduleOnline(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (scheduler.getPendingJob(ONLINE_JOB_ID) != null) return
            val job = JobInfo.Builder(ONLINE_JOB_ID, ComponentName(context, AlertJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(15 * 60 * 1000L)
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
            // 1.44: the reading from before this check, for where a new session began.
            val before = Me.last(context)
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
                // 1.44: the elo before a new session, and the recap alarm for when it ends.
                val prior = before?.takeIf { it.tag == me.tag }
                SessionRecap.noteGames(context, me.tag, fresh, prior?.elo, prior?.rank)
                Goal.record(context, me.tag, fresh, firstLook, post)
                Season.update(context, me, alerts, fresh, post)
                EloLog.record(context, me.tag, season, me.elo)
                // 1.42: personal records, and the recap once a session has ended.
                Records.update(context, me, fresh, post)
                SessionRecap.check(context, me, post)
            }
            Friends.refresh(context, me, season, post)
            // 1.42: invites both ways, Monday's duel verdict, this season vs last.
            Invite.finish(context)
            Invite.poll(context, post)
            Duel.settle(context, post)
            Online.check(context, post)
            // 1.42: the first week's tips for a new install.
            Welcome.check(context, post)
            // 1.42: the squad feed's new posts, and friends' reactions on posts about the player.
            Feed.observe(context, season)
            Feed.pollAbout(context, post)
            // 1.43: Bubble Pass quests, rings and the new week.
            runCatching { Pass.update(context, post) }
            if (me != null) Versus.fetch(context)
            Widgets.prefetch(context, alerts, me)
            Widgets.updateAll(context)
        }

        private fun run(context: Context) = runNow(context)
    }
}
