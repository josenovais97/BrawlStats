package net.brawlzone.bubble

import android.content.Context

/** The site APK is not installed from Google Play: no install referrer (see the Play build's Referrer). */
object Referrer {
    @Suppress("UNUSED_PARAMETER")
    fun check(context: Context) = Unit
}
