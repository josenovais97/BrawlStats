package net.brawlzone.bubble

import android.content.Context

/**
 * The handshake between the consent dialog and the service.
 *
 * Its own file because two components share it and neither owns it: the
 * activity cannot hold the projection and the service cannot ask for it, so the
 * only thing they have in common is these few strings.
 */
object ScanContract {
    const val ACTION_GRANTED = "net.brawlzone.bubble.SCAN_GRANTED"
    const val ACTION_DENIED = "net.brawlzone.bubble.SCAN_DENIED"
    const val EXTRA_RESULT_CODE = "net.brawlzone.bubble.RESULT_CODE"
    const val EXTRA_RESULT_DATA = "net.brawlzone.bubble.RESULT_DATA"

    private const val PREFS = "brawlzone.app"
    private const val KEY_WANTED = "scan.wanted"

    /**
     * Whether this reader uses scanning, so the next bubble start can get the
     * consent dialog out of the way before a match rather than during one.
     *
     * Android has no permission that skips that dialog — `CAPTURE_VIDEO_OUTPUT`
     * is signature-level and a sideloaded app can never hold it — and a
     * projection cannot outlive the app's process. What *is* free to choose is
     * when it appears. Asked on the first scan it lands mid-draft, pulls Brawl
     * Stars out of the foreground and costs the match; asked as the bubble
     * starts, the reader is already looking at this app and nothing is running.
     *
     * Set only after a grant, so a first-time reader who never scans is never
     * asked at all.
     */
    fun wanted(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_WANTED, false)

    fun rememberWanted(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_WANTED, true).apply()
    }
}
