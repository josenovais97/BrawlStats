package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Google Play's in-app update and in-app review (1.40, Play build only; the
 * site build has an empty twin in src/site).
 *
 * Updates are offered as a flexible download: the app keeps working while it
 * downloads, and a "Restart" card finishes the install. Asked at most once per
 * new version, so declining is respected.
 *
 * The review is asked for at most three times, at least two months apart,
 * with a player tag set, after three drafts played with the bubble or a good
 * moment (a rank-up or the daily goal reached, 1.40), on the next visit to
 * the app screen. Google decides whether the dialog actually shows and never
 * says, and its own limit stops it from repeating sooner, so one ask could
 * simply be one nobody saw. The test build shows a toast when it was asked
 * for, because a test install from outside Play never shows the dialog.
 */
object Store {

    private const val PREFS = "brawlzone-store"
    private const val KEY_ASKED_VERSION = "update_asked_version"
    private const val KEY_REVIEWED = "review_asked"
    private const val KEY_HAPPY = "happy_moment"
    private const val KEY_ASKS = "review_asks"
    private const val KEY_ASKED_AT = "review_asked_at"
    private const val MAX_ASKS = 3
    private const val ASK_GAP_MS = 60L * 24 * 60 * 60 * 1000
    private const val DRAFTS_BEFORE_REVIEW = 3

    private var manager: AppUpdateManager? = null
    private var listener: InstallStateUpdatedListener? = null

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun checkForUpdate(
        activity: Activity,
        launcher: ActivityResultLauncher<IntentSenderRequest>,
        onDownloaded: () -> Unit,
    ) {
        val m = manager ?: AppUpdateManagerFactory.create(activity.applicationContext).also { manager = it }
        if (listener == null) {
            val l = InstallStateUpdatedListener { state ->
                if (state.installStatus() == InstallStatus.DOWNLOADED) activity.runOnUiThread(onDownloaded)
            }
            listener = l
            m.registerListener(l)
        }
        m.appUpdateInfo.addOnSuccessListener { info ->
            if (info.installStatus() == InstallStatus.DOWNLOADED) {
                onDownloaded()
                return@addOnSuccessListener
            }
            val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
            val p = prefs(activity)
            if (!available || p.getInt(KEY_ASKED_VERSION, 0) == info.availableVersionCode()) return@addOnSuccessListener
            p.edit().putInt(KEY_ASKED_VERSION, info.availableVersionCode()).apply()
            runCatching {
                m.startUpdateFlowForResult(info, launcher, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
            }
        }
    }

    fun completeUpdate() {
        manager?.completeUpdate()
    }

    fun release() {
        listener?.let { manager?.unregisterListener(it) }
        listener = null
    }

    /** A rank-up or the daily goal reached: the next app visit may ask for a review. */
    fun happyMoment(context: Context) {
        prefs(context).edit().putBoolean(KEY_HAPPY, true).apply()
    }

    fun maybeAskForReview(activity: Activity) {
        val p = prefs(activity)
        // The earlier one-ask flag counts as one ask, made now.
        if (p.getBoolean(KEY_REVIEWED, false) && !p.contains(KEY_ASKS)) {
            p.edit().putInt(KEY_ASKS, 1).putLong(KEY_ASKED_AT, System.currentTimeMillis()).apply()
        }
        val asks = p.getInt(KEY_ASKS, 0)
        if (asks >= MAX_ASKS) return
        if (asks > 0 && System.currentTimeMillis() - p.getLong(KEY_ASKED_AT, 0L) < ASK_GAP_MS) return
        val ready = Alerts.drafts(activity) >= DRAFTS_BEFORE_REVIEW || p.getBoolean(KEY_HAPPY, false)
        if (!ready || Account.tag(activity).isEmpty()) return
        val qa = BuildConfig.BUILD_TYPE == "qa"
        val reviews = ReviewManagerFactory.create(activity)
        reviews.requestReviewFlow().addOnCompleteListener { request ->
            if (activity.isFinishing || activity.isDestroyed) return@addOnCompleteListener
            if (!request.isSuccessful) {
                if (qa) toast(activity, "Review prompt: Google Play refused (normal outside a Play install)")
                return@addOnCompleteListener
            }
            if (qa) toast(activity, "Review prompt requested. Google Play shows it only for Play installs.")
            reviews.launchReviewFlow(activity, request.result).addOnCompleteListener {
                p.edit()
                    .putInt(KEY_ASKS, p.getInt(KEY_ASKS, 0) + 1)
                    .putLong(KEY_ASKED_AT, System.currentTimeMillis())
                    .putBoolean(KEY_HAPPY, false)
                    .apply()
            }
        }
    }

    private fun toast(activity: Activity, text: String) =
        android.widget.Toast.makeText(activity, text, android.widget.Toast.LENGTH_LONG).show()
}
