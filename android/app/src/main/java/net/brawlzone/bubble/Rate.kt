package net.brawlzone.bubble

import android.app.Activity
import android.content.Intent
import android.net.Uri

/**
 * "Rate it on Google Play" (1.40): the app's Play page, in the Play Store app
 * when there is one. A button opens the page rather than Google's in-app
 * review dialog, because Google may silently decline to show that dialog and
 * a button that does nothing reads as broken; the dialog is asked for on its
 * own at a good moment (Store).
 */
object Rate {

    /** The real app's id, also from the side-by-side test build. */
    private const val PACKAGE = "net.brawlzone.bubble"

    fun open(activity: Activity) {
        val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$PACKAGE"))
            .setPackage("com.android.vending")
        val opened = runCatching { activity.startActivity(market) }.isSuccess
        if (!opened) {
            runCatching {
                activity.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PACKAGE")),
                )
            }
        }
    }
}
