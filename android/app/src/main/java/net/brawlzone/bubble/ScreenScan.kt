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
     * Makes the capture match the screen as it is *now*.
     *
     * The virtual display is created once, sized from whatever the screen was
     * when consent was granted — and consent arrives through an Activity, which
     * can bring its own orientation with it. Grant it from a portrait screen and
     * the display stays portrait: a landscape game is then mirrored, scaled and
     * letterboxed into a portrait buffer, so every region reads somewhere other
     * than where it should. That is not a subtle drift. It reads the match timer
     * where the map name is, and puts the first player's pick in the third
     * slot — which is exactly what a scan came back with.
     *
     * Checked before every capture rather than on rotation callbacks, because
     * the only moment the answer has to be right is the moment a frame is taken.
     */
    fun ensureSize(w: Int, h: Int, dpi: Int) {
        if (w <= 0 || h <= 0) return
        if (w == width && h == height) return
        val d = display ?: return
        runCatching {
            val fresh = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            d.resize(w, h, dpi)
            d.surface = fresh.surface
            reader?.close()
            reader = fresh
            width = w
            height = h
            Log.i(TAG, "capture resized to ${w}x$h")
        }.onFailure { Log.w(TAG, "could not resize capture", it) }
    }

    /** The size frames are currently produced at, for diagnostics. */
    val size: String get() = "${width}x$height"

    /**
     * Throws away every frame the display has already produced.
     *
     * The caller hides its own windows before scanning, and this is what makes
     * that mean anything. `acquireLatestImage` returns the newest frame the
     * reader is *holding*, not the newest the screen has shown — so a capture
     * taken shortly after hiding an overlay happily returns a frame from before
     * it was hidden, with the overlay still in it.
     *
     * That is not a subtle degradation. The panel covers the right-hand half of
     * a landscape screen, which is exactly where the enemy picks and one team's
     * bans are, so a stale frame reads the left half of the draft and reports
     * the rest as empty — indistinguishable from "the matcher did not recognise
     * them", which is what made this look like a recognition problem.
     */
    private fun discardPending(r: ImageReader) {
        while (true) {
            val image = try {
                r.acquireLatestImage()
            } catch (e: Throwable) {
                null
            } ?: return
            image.close()
        }
    }

    /**
     * Grabs a frame produced *after* this call.
     *
     * Drains first, then waits for the display to hand over something new, so
     * what comes back is always the screen as it is now rather than as it was
     * when the panel was still up. Retried on a delay because a virtual display
     * answers null rather than blocking, and because the first scan after
     * consent has no frames at all yet.
     */
    fun capture(onFrame: (Bitmap?) -> Unit) {
        val r = reader
        if (r == null || projection == null) {
            onFrame(null)
            return
        }
        discardPending(r)
        awaitFresh(0, onFrame)
    }

    private fun awaitFresh(attempt: Int, onFrame: (Bitmap?) -> Unit) {
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
        handler.postDelayed({ awaitFresh(attempt + 1, onFrame) }, RETRY_MS)
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
        /** ~1.2s of waiting for a fresh frame, which is far more than it takes. */
        const val MAX_ATTEMPTS = 20
        const val RETRY_MS = 60L
    }
}
