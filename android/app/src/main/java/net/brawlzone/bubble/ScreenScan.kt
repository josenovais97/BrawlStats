package net.brawlzone.bubble

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.util.Log

/**
 * One screen-capture session, held open for as long as the user is playing.
 *
 * The consent dialog is per *session*, not per frame — Android 14 will not let
 * an app silently reuse a token across sessions — so the whole design hangs on
 * keeping one projection alive and grabbing frames from it on demand. Asking
 * again on every scan would put a system dialog in front of a draft with
 * seconds on the clock, which is worse than not having the feature.
 *
 * Nothing here writes a frame anywhere. The bitmap is read, measured and
 * dropped inside one call; there is no file, no upload and no copy that
 * outlives the scan. That is a promise the app makes next to a permanent
 * recording indicator, so it is worth keeping in one small class where it can
 * be checked by reading it.
 */
class ScreenScan(
    private val context: Context,
    private val handler: Handler,
) {

    private var projection: MediaProjection? = null
    private var display: android.hardware.display.VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var width = 0
    private var height = 0

    /** Whether a frame can be grabbed right now without asking the user again. */
    val live: Boolean get() = projection != null

    /**
     * Called when the system tears the projection down — the user pressed stop
     * on the recording chip, or another app took the display. The service uses
     * it to put the button back to "allow screen reading" rather than leaving
     * a Scan button that silently does nothing.
     */
    var onLost: (() -> Unit)? = null

    private val callback = object : MediaProjection.Callback() {
        override fun onStop() {
            handler.post {
                release()
                onLost?.invoke()
            }
        }
    }

    /**
     * Turns a granted consent result into a live session.
     *
     * The caller must already have re-entered the foreground with the
     * mediaProjection service type; on Android 14 `getMediaProjection` throws
     * a SecurityException otherwise, and it does so for the *whole* app rather
     * than returning null.
     */
    fun start(resultCode: Int, data: Intent, w: Int, h: Int, dpi: Int): Boolean {
        release()
        return try {
            val manager = context.getSystemService(MediaProjectionManager::class.java)
                ?: return false
            val p = manager.getMediaProjection(resultCode, data) ?: return false

            // Registered BEFORE createVirtualDisplay: API 34 rejects the display
            // outright if the projection has no callback attached.
            p.registerCallback(callback, handler)

            width = w
            height = h
            val r = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            display = p.createVirtualDisplay(
                "brawlzone-scan",
                w,
                h,
                dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                r.surface,
                null,
                handler,
            )
            projection = p
            reader = r
            true
        } catch (e: Throwable) {
            Log.w(TAG, "could not start screen capture", e)
            release()
            false
        }
    }

    /**
     * Grabs the most recent frame.
     *
     * Retried on a delay rather than returned immediately, because a virtual
     * display that was created moments ago has not necessarily produced a frame
     * yet and `acquireLatestImage` answers null rather than waiting. The first
     * scan after granting consent is exactly that case.
     */
    fun capture(attempt: Int = 0, onFrame: (Bitmap?) -> Unit) {
        val r = reader
        if (r == null || projection == null) {
            onFrame(null)
            return
        }
        val bitmap = grab(r)
        if (bitmap != null) {
            onFrame(bitmap)
            return
        }
        if (attempt >= MAX_ATTEMPTS) {
            onFrame(null)
            return
        }
        handler.postDelayed({ capture(attempt + 1, onFrame) }, RETRY_MS)
    }

    private fun grab(r: ImageReader): Bitmap? {
        val image = try {
            r.acquireLatestImage()
        } catch (e: Throwable) {
            Log.w(TAG, "acquireLatestImage failed", e)
            null
        } ?: return null

        return try {
            val plane = image.planes[0]
            val pixelStride = plane.pixelStride
            val rowStride = plane.rowStride
            /*
             * The buffer is row-padded to a hardware-friendly stride, so it is
             * wider than the screen. Copying it into a bitmap of the padded
             * width and then cropping is the only way to read it correctly —
             * copying straight into a `width`-wide bitmap shears the image by a
             * few pixels per row, which looks like a working capture until you
             * try to match anything in it.
             */
            val padded = width + (rowStride - pixelStride * width) / pixelStride
            val full = Bitmap.createBitmap(padded, height, Bitmap.Config.ARGB_8888)
            full.copyPixelsFromBuffer(plane.buffer)
            val out = if (padded == width) full else Bitmap.createBitmap(full, 0, 0, width, height)
            if (out !== full) full.recycle()
            out
        } catch (e: Throwable) {
            Log.w(TAG, "could not read frame", e)
            null
        } finally {
            image.close()
        }
    }

    fun release() {
        try {
            display?.release()
        } catch (_: Throwable) {
        }
        try {
            projection?.unregisterCallback(callback)
            projection?.stop()
        } catch (_: Throwable) {
        }
        try {
            reader?.close()
        } catch (_: Throwable) {
        }
        display = null
        projection = null
        reader = null
    }

    private companion object {
        const val TAG = "BrawlZoneScan"
        const val MAX_ATTEMPTS = 8
        const val RETRY_MS = 60L
    }
}
