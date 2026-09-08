package net.brawlzone.bubble

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle

/**
 * The screen-capture consent dialog, and nothing else.
 *
 * Android will not hand a `MediaProjection` to a service. The token comes back
 * as an activity result and only an activity can ask for it, so this exists
 * purely to be started, show the system dialog, and pass the answer to the
 * service before finishing.
 *
 * It has no layout and a transparent theme: the user is in a draft with twenty
 * seconds on the clock, and a full-screen app window flashing over the game on
 * the way to the dialog would be worse than the dialog itself.
 *
 * `startActivityForResult` rather than the AndroidX result API on purpose. The
 * registration contract has to be set up before `onCreate` returns, which for a
 * single-shot activity whose whole job is one dialog buys nothing but a
 * lifecycle to get wrong.
 */
class ScanConsentActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) return

        val manager = getSystemService(MediaProjectionManager::class.java)
        if (manager == null) {
            deny()
            return
        }
        @Suppress("DEPRECATION")
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST)
    }

    @Deprecated("Single-shot consent; see the class comment.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST) return

        if (resultCode == RESULT_OK && data != null) {
            /*
             * `startForegroundService`, not `startService`. Granting capture is
             * the one moment the service is guaranteed to be running already —
             * the bubble is on screen — but the projection cannot be created
             * until the service has re-entered the foreground carrying the
             * mediaProjection type, and that has to happen on this path.
             */
            startForegroundService(
                Intent(this, BubbleService::class.java)
                    .setAction(ScanContract.ACTION_GRANTED)
                    .putExtra(ScanContract.EXTRA_RESULT_CODE, resultCode)
                    .putExtra(ScanContract.EXTRA_RESULT_DATA, data),
            )
        } else {
            deny()
            return
        }
        finish()
        overridePendingTransition(0, 0)
    }

    private fun deny() {
        startService(
            Intent(this, BubbleService::class.java).setAction(ScanContract.ACTION_DENIED),
        )
        finish()
        overridePendingTransition(0, 0)
    }

    private companion object {
        const val REQUEST = 7301
    }
}
