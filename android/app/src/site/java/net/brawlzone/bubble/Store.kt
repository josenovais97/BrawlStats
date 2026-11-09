package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest

/**
 * The site build's half of Store (1.40): nothing. This APK is not installed
 * from Google Play, so Play's update and review flows have nothing to act on;
 * it updates through the panel's own download instead.
 */
object Store {
    @Suppress("UNUSED_PARAMETER")
    fun checkForUpdate(
        activity: Activity,
        launcher: ActivityResultLauncher<IntentSenderRequest>,
        onDownloaded: () -> Unit,
    ) = Unit

    fun completeUpdate() = Unit

    fun release() = Unit

    @Suppress("UNUSED_PARAMETER")
    fun maybeAskForReview(activity: Activity) = Unit

    @Suppress("UNUSED_PARAMETER")
    fun happyMoment(context: Context) = Unit
}
