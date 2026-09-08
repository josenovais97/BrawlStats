package net.brawlzone.bubble

/**
 * The handshake between the consent dialog and the service.
 *
 * Its own file because two components share it and neither owns it: the
 * activity cannot hold the projection and the service cannot ask for it, so the
 * only thing they have in common is these four strings.
 */
object ScanContract {
    const val ACTION_GRANTED = "net.brawlzone.bubble.SCAN_GRANTED"
    const val ACTION_DENIED = "net.brawlzone.bubble.SCAN_DENIED"
    const val EXTRA_RESULT_CODE = "net.brawlzone.bubble.RESULT_CODE"
    const val EXTRA_RESULT_DATA = "net.brawlzone.bubble.RESULT_DATA"
}
