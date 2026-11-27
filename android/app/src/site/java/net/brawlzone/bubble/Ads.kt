package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import android.widget.FrameLayout

/**
 * The site build's half of Ads (1.46): nothing. Ads and their removal are in
 * the Google Play build only; the site stopped serving this APK on 2026-11-26.
 */
object Ads {
    const val SOLD = false

    @Suppress("UNUSED_PARAMETER")
    fun removed(context: Context): Boolean = true

    fun price(): String? = null

    @Suppress("UNUSED_PARAMETER")
    fun adDays(context: Context): Int = 0

    @Suppress("UNUSED_PARAMETER")
    fun start(activity: Activity, adSlot: FrameLayout, onChange: () -> Unit) = Unit

    fun resume() = Unit

    fun pause() = Unit

    fun release() = Unit

    @Suppress("UNUSED_PARAMETER")
    fun privacyChoicesNeeded(context: Context): Boolean = false

    @Suppress("UNUSED_PARAMETER")
    fun showPrivacyChoices(activity: Activity) = Unit

    @Suppress("UNUSED_PARAMETER")
    fun buy(activity: Activity) = Unit

    @Suppress("UNUSED_PARAMETER")
    fun restore(activity: Activity) = Unit
}
