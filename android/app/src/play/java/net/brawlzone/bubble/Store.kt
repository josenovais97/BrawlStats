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
 * The review is asked for once, ever, after three drafts played with the
 * bubble and a player tag set: by then the player knows whether it helps.
 * Google decides whether the dialog actually shows, and it never says.
 */
object Store {

    private const val PREFS = "brawlzone-store"
    private const val KEY_ASKED_VERSION = "update_asked_version"
    private const val KEY_REVIEWED = "review_asked"
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

    fun maybeAskForReview(activity: Activity) {
        val p = prefs(activity)
        if (p.getBoolean(KEY_REVIEWED, false)) return
        if (Alerts.drafts(activity) < DRAFTS_BEFORE_REVIEW || Account.tag(activity).isEmpty()) return
        val reviews = ReviewManagerFactory.create(activity)
        reviews.requestReviewFlow().addOnCompleteListener { request ->
            if (!request.isSuccessful) return@addOnCompleteListener
            if (activity.isFinishing || activity.isDestroyed) return@addOnCompleteListener
            reviews.launchReviewFlow(activity, request.result).addOnCompleteListener {
                p.edit().putBoolean(KEY_REVIEWED, true).apply()
            }
        }
    }
}
