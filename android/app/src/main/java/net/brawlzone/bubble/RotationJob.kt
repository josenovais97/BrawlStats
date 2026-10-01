package net.brawlzone.bubble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Tells you when the Ranked rotation turns over, and what of it you can play.
 *
 * This is the one thing the app can do that the overlay cannot. The bubble
 * answers a question you are already asking, mid-draft, with the game open;
 * this is the only part of the product that reaches somebody who is not
 * currently thinking about Brawl Stars.
 *
 * **The server does not know this is running.** The endpoint it polls is the
 * same bytes for every install — one cached ISR entry — and the part that makes
 * it about *you*, which of those picks your account can actually field, happens
 * here on the phone against the roster snapshot the app screen already took.
 * Ten installs and ten thousand cost the box the same, which is the only shape
 * a free tier can carry. A per-player endpoint behind a timer on every device
 * would be the read pattern this project has twice been broken by.
 *
 * `JobScheduler` rather than WorkManager: it is in the framework at minSdk 26,
 * and the dependency would be a larger addition than the feature. The job is
 * periodic and persisted, so it survives a reboot without the app being opened.
 */
class RotationJob : android.app.job.JobService() {

    private val pool = Executors.newSingleThreadExecutor()

    override fun onStartJob(params: JobParameters?): Boolean {
        pool.execute {
            runCatching { check(applicationContext) }
            // Never reschedule on failure. The next period is at most a few
            // hours away and a rotation nobody was told about is a missed
            // notification, not an incident — retrying a dead network in a
            // loop would cost battery to tell somebody something slightly
            // sooner.
            jobFinished(params, false)
        }
        return true
    }

    override fun onStopJob(params: JobParameters?): Boolean = false

    companion object {

        private const val JOB_ID = 4201
        private const val CHANNEL = "rotation"

        /** Three hours, give or take whatever Doze decides. */
        private const val PERIOD_MS = 3 * 60 * 60 * 1000L

        /** More than this in one notification is a list nobody reads. */
        private const val MAX_LINES = 4

        /**
         * Scheduled on every app open, and cancelled the moment it is switched
         * off.
         *
         * Rescheduling an identical job is free — `JobScheduler` replaces the
         * one with the same id — and doing it on open is what repairs the
         * schedule after the one case `setPersisted` does not cover, which is
         * the app being force-stopped.
         */
        fun sync(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (!Account.alerts(context)) {
                scheduler.cancel(JOB_ID)
                return
            }
            scheduler.schedule(
                JobInfo.Builder(JOB_ID, ComponentName(context, RotationJob::class.java))
                    .setPeriodic(PERIOD_MS)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPersisted(true)
                    .build(),
            )
        }

        /**
         * One poll, one comparison, and usually nothing at all.
         *
         * The revision covers the set of live maps and not their picks, so this
         * stays quiet through the several times a day the numbers underneath it
         * move. "The rotation changed" is the event; the request is not.
         */
        fun check(context: Context) {
            if (!Account.alerts(context)) return

            val json = JSONObject(Http.text("${Http.SITE}/api/bubble/rotation"))
            val revision = json.optString("revision", "")
            if (revision.isEmpty() || revision == Account.seenRevision(context)) return

            val maps = json.getJSONArray("maps")
            val lines = ArrayList<String>()
            for (i in 0 until maps.length()) {
                if (lines.size >= MAX_LINES) break
                val map = maps.getJSONObject(i)
                val picks = map.getJSONArray("picks")

                /*
                 * The best pick this account can actually take, which is the
                 * entire point. Falling back to the global best when nothing is
                 * ownable would quietly turn the feature back into the tier
                 * list it exists to personalise, so a map with no answer for
                 * this roster is left out instead.
                 */
                var mine: String? = null
                for (p in 0 until picks.length()) {
                    val pick = picks.getJSONObject(p)
                    if (Account.canField(context, pick.getInt("id"))) {
                        mine = pick.getString("name")
                        break
                    }
                }
                if (mine != null) {
                    lines.add("${map.getString("map")} · ${map.getString("modeLabel")} → $mine")
                }
            }

            /*
             * The revision is recorded whether or not anything was worth
             * saying. Otherwise a rotation this account has nothing to play
             * stays "new" forever, and every single run would re-examine it.
             */
            Account.setSeenRevision(context, revision)
            if (lines.isEmpty()) return

            notify(context, lines)
        }

        private fun notify(context: Context, lines: List<String>) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL,
                    "Map rotation",
                    // Not HIGH. This is worth a line in the shade, never an
                    // interruption of whatever is on screen -- which might be a
                    // match.
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = "When the Ranked maps change, and what you can field on them"
                },
            )

            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE,
            )

            val body = lines.joinToString("\n")
            manager.notify(
                JOB_ID,
                Notification.Builder(context, CHANNEL)
                    .setSmallIcon(R.drawable.bubble_glyph)
                    .setContentTitle("New Ranked maps")
                    // Collapsed, the shade shows one line. Leading with the
                    // first map rather than "3 maps changed" means the
                    // collapsed form is already an answer.
                    .setContentText(lines[0])
                    .setStyle(Notification.BigTextStyle().bigText(body))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }
}
