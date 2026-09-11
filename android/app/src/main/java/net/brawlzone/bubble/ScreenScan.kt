package net.brawlzone.bubble

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
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
 * outlives the scan unless the reader explicitly exports a diagnostic. That is
 * a promise the app makes next to a permanent recording indicator, so it is
 * worth keeping in one small class where it can be checked by reading it.
 *
 * Every session has an id and every frame says which surface produced it.
 * Those are not decoration: the service uses the session id to ignore a
 * callback from a session it has already replaced, and the surface generation
 * to tell a frame from before a resize from one after it.
 */
class ScreenScan(
    private val context: Context,
    private val handler: Handler,
    val id: Long,
) {

    /** One captured frame, with enough about its origin to be argued about. */
    class Frame(
        val bitmap: Bitmap,
        /** Which surface produced it; changes on every resize. */
        val generation: Int,
        /** How many frames this session had handed over before this one. */
        val sequence: Int,
        /** The producer's own timestamp, ns. Only comparable to its siblings. */
        val timestamp: Long,
    )

    private var projection: MediaProjection? = null
    private var display: android.hardware.display.VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var width = 0
    private var height = 0
    private var retired = false

    /** Bumped every time frames start coming from a new surface. */
    var generation = 0
        private set

    private var sequence = 0

    /** What the system says it is actually capturing, on API 34+. */
    @Volatile
    var contentSize: String? = null
        private set

    /** Whether a frame can be grabbed right now without asking the user again. */
    val live: Boolean get() = projection != null && !retired

    /**
     * Called when the system tears the projection down — the user pressed stop
     * on the recording chip, or another app took the display. The service uses
     * it to put the button back to "allow screen reading" rather than leaving
     * a Scan button that silently does nothing.
     *
     * Never called for a session the service retired itself: that is not a
     * loss, and treating it as one is how a replacement session got cleared
     * by its predecessor's stop callback.
     */
    var onLost: ((ScreenScan) -> Unit)? = null

    private val callback = object : MediaProjection.Callback() {
        override fun onStop() {
            handler.post {
                if (retired) return@post
                release()
                onLost?.invoke(this@ScreenScan)
            }
        }

        /*
         * Android 14 reports when the captured content changes size — a
         * rotation, a fold — and documents that frames may be letterboxed
         * until the surface is resized to match. Recorded rather than acted
         * on: the service resizes before every capture from the window
         * metrics it trusts, and this is the second opinion the diagnostics
         * carry so a mismatch is a fact rather than a theory.
         */
        override fun onCapturedContentResize(w: Int, h: Int) {
            contentSize = "${w}x$h"
            Log.i(TAG, "captured content is now ${w}x$h (surface ${width}x$height)")
        }
    }

    /**
     * Turns a granted consent result into a live session.
     *
     * The caller must already have re-entered the foreground with the
     * mediaProjection service type; on Android 14 `getMediaProjection` throws
     * a SecurityException otherwise, and it does so for the *whole* app rather
     * than returning null.
     *
     * Fields are assigned as each resource is created, not after the last
     * one, so a failure in `createVirtualDisplay` still leaves `release` with
     * a projection and a reader to close. The previous version assigned them
     * at the end and leaked both on that path.
     */
    fun start(resultCode: Int, data: Intent, w: Int, h: Int, dpi: Int): Boolean {
        release()
        return try {
            val manager = context.getSystemService(MediaProjectionManager::class.java)
                ?: return false
            val p = manager.getMediaProjection(resultCode, data) ?: return false
            projection = p

            // Registered BEFORE createVirtualDisplay: API 34 rejects the display
            // outright if the projection has no callback attached.
            p.registerCallback(callback, handler)

            width = w
            height = h
            val r = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            reader = r
            generation++
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
     * One virtual display for the life of the session, resized in place. The
     * consent token is single-use on Android 14, so a second display would
     * mean a second dialog.
     *
     * Checked before every capture rather than on rotation callbacks, because
     * the only moment the answer has to be right is the moment a frame is taken.
     * Returns whether the surface changed, so the caller knows to wait for a
     * frame from the new one.
     */
    fun ensureSize(w: Int, h: Int, dpi: Int): Boolean {
        if (w <= 0 || h <= 0) return false
        if (w == width && h == height) return false
        val d = display ?: return false
        return runCatching {
            val fresh = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
            d.resize(w, h, dpi)
            d.surface = fresh.surface
            reader?.close()
            reader = fresh
            width = w
            height = h
            generation++
            Log.i(TAG, "capture resized to ${w}x$h (surface generation $generation)")
            true
        }.getOrElse {
            Log.w(TAG, "could not resize capture", it)
            false
        }
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
     * Bounded by the reader's own queue depth (two), so this cannot spin.
     */
    private fun discardPending(r: ImageReader) {
        repeat(4) {
            val image = try {
                r.acquireLatestImage()
            } catch (e: Throwable) {
                null
            } ?: return
            image.close()
        }
    }

    /**
     * Grabs a frame produced *after* this call, from the current surface.
     *
     * Drains first, then waits for the display to hand over something new, so
     * what comes back is always the screen as it is now rather than as it was
     * when the panel was still up. Retried on a delay because a virtual display
     * answers null rather than blocking, and because the first scan after
     * consent has no frames at all yet.
     *
     * The frame is checked against the surface size the session believes it
     * has: a frame of another size is one from a surface that has since been
     * replaced, and is dropped rather than read.
     */
    fun capture(onFrame: (Frame?) -> Unit) {
        val r = reader
        if (r == null || !live) {
            onFrame(null)
            return
        }
        discardPending(r)
        awaitFresh(generation, 0, onFrame)
    }

    private fun awaitFresh(wanted: Int, attempt: Int, onFrame: (Frame?) -> Unit) {
        val r = reader
        if (r == null || !live || generation != wanted) {
            onFrame(null)
            return
        }
        val frame = grab(r)
        if (frame != null) {
            onFrame(frame)
            return
        }
        if (attempt >= MAX_ATTEMPTS) {
            Log.w(TAG, "no frame from surface generation $wanted after ${MAX_ATTEMPTS * RETRY_MS}ms")
            onFrame(null)
            return
        }
        handler.postDelayed({ awaitFresh(wanted, attempt + 1, onFrame) }, RETRY_MS)
    }

    private fun grab(r: ImageReader): Frame? {
        val image = try {
            r.acquireLatestImage()
        } catch (e: Throwable) {
            Log.w(TAG, "acquireLatestImage failed", e)
            null
        } ?: return null

        return try {
            if (image.width != width || image.height != height) {
                Log.w(TAG, "dropped a ${image.width}x${image.height} frame; surface is ${width}x$height")
                return null
            }
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
            sequence++
            Frame(out, generation, sequence, image.timestamp)
        } catch (e: Throwable) {
            Log.w(TAG, "could not read frame", e)
            null
        } finally {
            image.close()
        }
    }

    /**
     * Ends the session on the service's own initiative — a replacement, a
     * stop, destruction. After this `onLost` will never fire for it.
     */
    fun retire() {
        retired = true
        release()
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
