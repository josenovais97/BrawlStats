package net.brawlzone.bubble

import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The floating bubble, and the panel it opens.
 *
 * Three windows, and the flags on each are the whole design.
 *
 * The bubble is `FLAG_NOT_FOCUSABLE`, so taps that miss it reach the game. The
 * close target is additionally `FLAG_NOT_TOUCHABLE` — it is feedback, never a
 * touch target. The panel is the subtle one: it must take focus so the WebView
 * scrolls and the back key closes it, but a focusable window is **touch-modal
 * by default**, which means it intercepts every touch on the screen rather than
 * only the ones inside its own bounds. Version 0.6 shipped without
 * `FLAG_NOT_TOUCH_MODAL` and the panel swallowed the bubble's own taps: the
 * bubble stopped responding, the drag stopped working, and revoking the overlay
 * permission was the only way out.
 */
class BubbleService : Service() {

    private lateinit var windows: WindowManager

    private var bubble: View? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var panel: View? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private var closeTarget: View? = null
    private var closeTargetArt: ImageView? = null

    /**
     * Where the user last put the panel, kept across open/close.
     *
     * A window that springs back to its anchor every time it reopens is not
     * really movable — the position has to outlive the window for dragging it
     * to mean anything.
     */
    private var panelX: Int? = null
    private var panelY: Int? = null

    /**
     * When an outside touch last closed the panel.
     *
     * A tap on the bubble while the panel is open is delivered to *both*
     * windows: the panel gets `ACTION_OUTSIDE` (because it asked to watch for
     * them) and the bubble gets the tap itself. The panel closed, then the
     * bubble's toggle found `panel == null` and opened a new one — so the panel
     * appeared to survive the tap, and the window was silently recreated each
     * time. Verified on an emulator: the window id changed on every tap.
     *
     * Handling the two events in the same gesture as one action is what makes
     * the tap collapse the panel and leave it collapsed.
     */
    private var outsideClosedAt = 0L

    // ------------------------------------------------------------------ scan

    /**
     * Reading the draft off the screen, when the user has allowed it.
     *
     * All of this is null until someone asks. The overlay is the feature; this
     * is an addition to it, and an app that holds a screen-capture session open
     * because it might be useful later is not one anybody should install.
     */
    private var scan: ScreenScan? = null
    private var vision: DraftVision? = null

    /**
     * The frame the last scan read, kept so a correction can be learned from
     * the pixels that produced it rather than from the next frame, which by
     * then shows a draft one pick further on.
     */
    private var lastFrame: Bitmap? = null

    private var scanning = false

    /** The panel's WebView, so a scan result has somewhere to go. */
    private var panelWeb: WebView? = null

    /** A result that arrived while the panel was shut. See `postToPanel`. */
    private var pendingScanJs: String? = null


    private val handler = Handler(Looper.getMainLooper())

    private val density get() = resources.displayMetrics.density

    /*
     * Read from the window manager, not from `displayMetrics`.
     *
     * A Service's `resources.displayMetrics` is not reliably updated when the
     * device rotates — it can keep reporting the orientation the service was
     * created in. Everything here positions windows in screen coordinates, so
     * stale metrics put the bubble off-screen and size the panel for the wrong
     * axis. `currentWindowMetrics` is the display's own answer, asked fresh.
     */
    private val screenW: Int
        get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            windows.currentWindowMetrics.bounds.width()
        } else {
            resources.displayMetrics.widthPixels
        }

    private val screenH: Int
        get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            windows.currentWindowMetrics.bounds.height()
        } else {
            resources.displayMetrics.heightPixels
        }

    private val landscape get() = screenW > screenH

    private fun dp(value: Number) = (value.toFloat() * density).roundToInt()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windows = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        enterForeground(withProjection = false)

        /*
         * The permission is re-checked here, not just in the activity.
         *
         * Without this the service would call `addView` regardless, and
         * `WindowManager` throws `BadTokenException` when the overlay
         * permission is absent — which killed the service, which the system
         * then restarted, which threw again.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }

        showBubble()
    }

    /**
     * Never resurrect on its own. The default `START_STICKY` tells Android to
     * restart a dead service, which for an overlay repeats whatever fault
     * killed it. An overlay should appear only when a person asks for it.
     */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopSelf()
            ScanContract.ACTION_GRANTED -> onScanGranted(intent)
            ScanContract.ACTION_DENIED -> postScanState("denied")
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scan?.release()
        scan = null
        lastFrame?.recycle()
        lastFrame = null
        removePanel()
        hideCloseTarget()
        bubble?.let { runCatching { windows.removeView(it) } }
        bubble = null
        super.onDestroy()
    }

    // ---------------------------------------------------------------- bubble

    private fun showBubble() {
        // One bubble, ever. A second `addView` on a restart would leave the
        // first orphaned on screen with nothing holding a reference to remove it.
        if (bubble != null) return

        val badge = dp(52)
        val pad = dp(6) // room inside the window for the drop shadow to render

        val art = ImageView(this).apply {
            setBackgroundResource(R.drawable.bubble_badge)
            setImageResource(R.drawable.bubble_glyph)
            val inset = dp(13)
            setPadding(inset, inset, inset, inset)
            elevation = dp(6).toFloat()
        }

        val host = FrameLayout(this).apply {
            setPadding(pad, pad, pad, pad)
            addView(art, FrameLayout.LayoutParams(badge, badge))
        }

        val params = WindowManager.LayoutParams(
            badge + pad * 2,
            badge + pad * 2,
            overlayType(),
            // Not focusable: taps that miss the bubble must reach the game.
            // LAYOUT_IN_SCREEN so x/y are screen-absolute — without it the y is
            // measured below the status bar while MotionEvent.rawY is not, and
            // the two disagree by the inset height wherever they are compared.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screenW - (badge + pad * 2)
            y = dp(160)
        }

        /*
         * Drag and tap on one view, separated by distance rather than by timing.
         * A time-based split makes a slow deliberate tap register as a drag,
         * which is exactly what happens when someone is concentrating on a match.
         */
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        var dragging = false
        val slop = dp(10)

        host.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startX = params.x
                    startY = params.y
                    dragging = false
                    art.animate().scaleX(0.90f).scaleY(0.90f).setDuration(90).start()
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!dragging && (abs(dx) > slop || abs(dy) > slop)) {
                        dragging = true
                        // Close the panel the moment a drag starts: a panel
                        // anchored to a bubble that is moving looks broken.
                        removePanel()
                        showCloseTarget()
                    }
                    if (dragging) {
                        params.x = (startX + dx).roundToInt()
                            .coerceIn(0, screenW - params.width)
                        params.y = (startY + dy).roundToInt()
                            .coerceIn(0, screenH - params.height)
                        runCatching { windows.updateViewLayout(host, params) }
                        setCloseTargetActive(overCloseTarget(params))
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    art.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    val onTarget = dragging && overCloseTarget(params)
                    hideCloseTarget()

                    when {
                        onTarget -> stopSelf()
                        dragging -> snapToEdge(host, params)
                        else -> togglePanel()
                    }
                    true
                }

                else -> false
            }
        }

        bubble = host
        bubbleParams = params
        runCatching { windows.addView(host, params) }
            .onFailure {
                bubble = null
                bubbleParams = null
                stopSelf()
            }
    }

    /** Rest against whichever side is nearer, the way every bubble on Android does. */
    private fun snapToEdge(view: View, params: WindowManager.LayoutParams) {
        val target = if (params.x + params.width / 2 < screenW / 2) 0 else screenW - params.width
        ValueAnimator.ofInt(params.x, target).apply {
            duration = 180
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                params.x = it.animatedValue as Int
                runCatching { windows.updateViewLayout(view, params) }
            }
        }.start()
    }

    // ---------------------------------------------------------- close target

    /**
     * A visible place to drop the bubble.
     *
     * Previously the dismiss gesture was "drag below 85% of the screen", which
     * is a rule the app knew and the user did not — so the only discoverable way
     * to close the bubble was to revoke its permission in Settings. A target
     * that appears when a drag begins makes the gesture teach itself.
     */
    private fun showCloseTarget() {
        if (closeTarget != null) return
        val size = dp(64)

        val art = ImageView(this).apply {
            setBackgroundResource(R.drawable.close_target)
            setImageResource(R.drawable.ic_close)
            val inset = dp(18)
            setPadding(inset, inset, inset, inset)
        }
        closeTargetArt = art

        val params = WindowManager.LayoutParams(
            size,
            size,
            overlayType(),
            // Feedback, never a touch target: the bubble under the finger owns
            // the gesture, so this window must not intercept any of it.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dp(72)
        }

        art.alpha = 0f
        closeTarget = art
        runCatching { windows.addView(art, params) }
            .onSuccess { art.animate().alpha(1f).setDuration(140).start() }
            .onFailure { closeTarget = null }
    }

    private fun hideCloseTarget() {
        closeTarget?.let { runCatching { windows.removeView(it) } }
        closeTarget = null
        closeTargetArt = null
    }

    private fun setCloseTargetActive(active: Boolean) {
        closeTargetArt?.setBackgroundResource(
            if (active) R.drawable.close_target_active else R.drawable.close_target,
        )
    }

    /** Whether the bubble's centre is inside the drop zone around the target. */
    private fun overCloseTarget(params: WindowManager.LayoutParams): Boolean {
        val cx = params.x + params.width / 2f
        val cy = params.y + params.height / 2f
        val targetX = screenW / 2f
        val targetY = screenH - dp(72) - dp(32)
        return abs(cx - targetX) < dp(80) && abs(cy - targetY) < dp(80)
    }

    // ----------------------------------------------------------------- panel

    /** Whether a screen coordinate falls inside the bubble's window. */
    private fun onBubble(x: Float, y: Float): Boolean {
        val bp = bubbleParams ?: return false
        return x >= bp.x && x <= bp.x + bp.width && y >= bp.y && y <= bp.y + bp.height
    }

    /**
     * How big the panel should be right now.
     *
     * Brawl Stars is played in landscape, which is where this is actually used
     * and the one case the first version got wrong: `screenH * 0.62` is 520dp
     * of a portrait phone but only 255dp of a landscape one, so the panel
     * arrived barely three tier rows tall with everything else below the fold.
     *
     * Landscape has height to spare nowhere and width to spare everywhere, so
     * it takes nearly the full height and grows sideways instead.
     */
    /**
     * Where the panel goes, given where the bubble is.
     *
     * Beside the bubble first, underneath only as a fallback. Anchoring below
     * works in portrait and is impossible in landscape: the panel is nearly the
     * full height of the screen, so "below the bubble" lands off-screen and the
     * clamp that pulls it back drops it squarely *on top of* the bubble. The
     * panel then swallowed the taps meant for the bubble, and the only way to
     * reopen it was to rotate back — measured on an emulator, bubble at
     * (0,420) under a panel occupying (0,95) to (1208,1080).
     *
     * Beside also reads better: the bubble stays visible as the thing the panel
     * belongs to, instead of being hidden by its own panel.
     */
    private fun placePanel(params: WindowManager.LayoutParams, w: Int, h: Int) {
        val bp = bubbleParams
        if (bp == null) {
            params.x = ((screenW - w) / 2).coerceAtLeast(0)
            params.y = ((screenH - h) / 2).coerceAtLeast(0)
            return
        }

        val gap = dp(8)
        val onLeft = bp.x + bp.width / 2 < screenW / 2
        val beside = if (onLeft) bp.x + bp.width + gap else bp.x - w - gap

        if (beside >= 0 && beside + w <= screenW) {
            params.x = beside
            // Centred on the bubble vertically, so the two read as one object.
            params.y = (bp.y + bp.height / 2 - h / 2).coerceIn(0, (screenH - h).coerceAtLeast(0))
            return
        }

        params.x = (bp.x + bp.width / 2 - w / 2).coerceIn(0, (screenW - w).coerceAtLeast(0))
        val below = bp.y + bp.height + gap
        params.y = if (below + h <= screenH) below else (bp.y - h - gap).coerceAtLeast(0)
    }

    private fun panelSize(): Pair<Int, Int> =
        if (landscape) {
            minOf(dp(460), screenW - dp(48)) to minOf(dp(520), screenH - dp(36))
        } else {
            minOf(dp(360), screenW - dp(24)) to minOf(dp(520), (screenH * 0.62f).roundToInt())
        }

    /**
     * Rotation. The game is landscape, so this fires in normal use, not as an
     * edge case.
     *
     * Both windows hold absolute coordinates that were valid for the previous
     * orientation: after a rotation the bubble's x can sit past the new width,
     * and the panel is sized for the wrong axis. Nothing recomputed either, so
     * turning the phone to play was enough to strand both off-screen.
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)

        bubbleParams?.let { params ->
            params.x = params.x.coerceIn(0, (screenW - params.width).coerceAtLeast(0))
            params.y = params.y.coerceIn(0, (screenH - params.height).coerceAtLeast(0))
            // Rest against whichever edge is now nearer, so it never lands
            // stranded in the middle of the play area.
            params.x = if (params.x + params.width / 2 < screenW / 2) 0 else screenW - params.width
            bubble?.let { runCatching { windows.updateViewLayout(it, params) } }
        }

        // The remembered position belongs to the orientation it was chosen in.
        panelX = null
        panelY = null

        panel?.let { view ->
            val params = panelParams ?: return@let
            val (w, h) = panelSize()
            params.width = w
            params.height = h
            placePanel(params, w, h)
            runCatching { windows.updateViewLayout(view, params) }
        }
    }

    private fun togglePanel() {
        Log.d(TAG, "togglePanel: panel=" + (panel != null) +
            " sinceOutside=" + (SystemClock.uptimeMillis() - outsideClosedAt))
        if (panel != null) {
            collapsePanel()
            return
        }
        // The outside-touch of this same gesture already closed it; opening now
        // would undo the close the user just asked for.
        if (SystemClock.uptimeMillis() - outsideClosedAt < SAME_GESTURE_MS) return
        showPanel()
    }

    /** Immediate teardown. Used where an animation would be wrong: the service
     *  shutting down, or a drag that has already started moving the anchor. */
    private fun removePanel() {
        panel?.let { runCatching { windows.removeView(it) } }
        panel = null
        panelWeb = null
        panelParams = null
    }

    /**
     * Collapse into the bubble rather than vanish.
     *
     * Scaling toward the bubble's own position is what makes the bubble read as
     * where the panel *went*, instead of two unrelated things one of which
     * disappeared. The pivot is the bubble's centre expressed in the panel's
     * coordinate space, so the panel converges on the bubble wherever either
     * one happens to be parked.
     *
     * `panel` is cleared before the animation runs, so a second tap during
     * those few frames opens a fresh panel instead of finding a stale one.
     */
    private fun collapsePanel() {
        val view = panel ?: return
        val params = panelParams
        panel = null
        panelWeb = null
        panelParams = null
        Log.d(TAG, "collapsePanel: animating out")

        val bp = bubbleParams
        if (params != null && bp != null) {
            view.pivotX = (bp.x + bp.width / 2 - params.x).toFloat()
            view.pivotY = (bp.y + bp.height / 2 - params.y).toFloat()
        }

        /*
         * The removal must not depend on the animation finishing.
         *
         * `withEndAction` never runs if the animation is cancelled or never
         * ticks — and a WebView stalling the render thread is enough to do
         * that. Measured on an emulator: the panel collapsed once, then its
         * window stayed on screen forever with `panel` already null, so every
         * later tap toggled a field that no longer matched what was displayed.
         *
         * So the animation is decoration and the delayed removal is the
         * contract. `drop` is idempotent, so whichever arrives first wins.
         */
        var dropped = false
        val drop = {
            if (!dropped) {
                dropped = true
                Log.d(TAG, "collapsePanel: removing window")
                runCatching { windows.removeView(view) }
            }
        }

        view.animate()
            .scaleX(0.12f)
            .scaleY(0.12f)
            .alpha(0f)
            .setDuration(COLLAPSE_MS)
            .setInterpolator(AccelerateInterpolator())
            .withEndAction(drop)
            .start()

        view.postDelayed(drop, COLLAPSE_MS + 60)
        handler.postDelayed(drop, COLLAPSE_MS + 120)
    }

    /**
     * The panel is a WebView pointed at the site's own compact view.
     *
     * Deliberately not a reimplementation of the picks in Kotlin. The numbers,
     * the sampling caveats and the wording all live in one place already, and a
     * second copy in an app that ships on its own schedule would drift from the
     * site within a patch or two.
     */
    private fun showPanel() {
        val params = bubbleParams ?: return

        val (width, height) = panelSize()

        val root = PanelFrame(this).apply {
            setBackgroundResource(R.drawable.panel_background)
            clipToOutline = true
            elevation = dp(12).toFloat()
        }

        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        /*
         * The grab area: a handle and the title row together.
         *
         * The handle is there to be seen rather than used — a bar at the top of
         * a floating window is the one shape people already read as "drag me",
         * and without it the panel looked fixed in place. The whole strip is the
         * touch target, so the affordance is smaller than the thing it advertises.
         */
        val grab = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        grab.addView(View(this).apply {
            setBackgroundResource(R.drawable.drag_handle)
        }, LinearLayout.LayoutParams(dp(36), dp(4)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(8)
        })

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(8), dp(8), dp(12))
        }
        header.addView(ImageView(this).apply {
            setBackgroundResource(R.drawable.bubble_badge)
            setImageResource(R.drawable.bubble_glyph)
            val inset = dp(5)
            setPadding(inset, inset, inset, inset)
        }, LinearLayout.LayoutParams(dp(26), dp(26)))

        header.addView(TextView(this).apply {
            text = "BrawlZone"
            textSize = 15f
            setTextColor(Color.parseColor("#F2F5FF"))
            setPadding(dp(10), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        header.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_close)
            imageAlpha = 150
            val inset = dp(10)
            setPadding(inset, inset, inset, inset)
            setOnClickListener { collapsePanel() }
        }, LinearLayout.LayoutParams(dp(42), dp(42)))

        grab.addView(header, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ))
        column.addView(grab, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ))

        column.addView(View(this).apply {
            setBackgroundColor(Color.parseColor("#22304A"))
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)))

        /* A spinner over the WebView, because a blank dark rectangle while the
           page loads is indistinguishable from a panel that failed to open. */
        val body = FrameLayout(this)
        val spinner = ProgressBar(this).apply {
            isIndeterminate = true
        }

        var failed = false

        /* Shown in place of the page when the load fails; tapping reloads. */
        val retry = TextView(this).apply {
            text = "Could not reach brawlzone.net.\n\nTap to try again."
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#98A3C4"))
            setPadding(dp(24), dp(24), dp(24), dp(24))
            visibility = View.GONE
        }
        val web = PanelWebView(this).apply {
            alpha = 0f
            setBackgroundColor(Color.parseColor("#0B0F1D"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    spinner.visibility = View.GONE
                    if (failed) return
                    view?.animate()?.alpha(1f)?.setDuration(160)?.start()
                    flushPendingScan()
                }

                /*
                 * A panel that cannot load has to say so.
                 *
                 * Without this the spinner turned forever: on a dropped
                 * connection — which is exactly what a phone does mid-match —
                 * the reader was left watching an animation with no way to tell
                 * whether it was slow or broken, and no way to retry short of
                 * closing the bubble and opening it again.
                 *
                 * Only the main document counts. A failed image is not a failed
                 * panel, and treating it as one would replace a working list
                 * with an error over one missing portrait.
                 */
                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    if (!request.isForMainFrame) return
                    failed = true
                    spinner.visibility = View.GONE
                    retry.visibility = View.VISIBLE
                    view.visibility = View.GONE
                }

                /*
                 * The panel stays in the panel; everything else goes to the
                 * browser. A 360dp overlay is the wrong place to read the site,
                 * and it is the wrong place to be sent an APK.
                 */
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val url = request.url
                    if (url.path?.startsWith("/bubble/panel") == true) return false
                    openExternally(url)
                    return true
                }
            }

            /*
             * Without this, a download link in a WebView does nothing at all.
             *
             * The WebView cannot render an APK, so it hands the URL to a
             * DownloadListener — and when none is set it discards it silently.
             * The update button on the panel would have looked like a dead
             * button, which is worse than not offering one.
             *
             * Handed to the browser rather than downloaded in-process on
             * purpose: installing an APK should go through the same visible
             * download-and-confirm path as any other, not happen quietly
             * inside an overlay the user opened to look at a tier list.
             */
            setDownloadListener { url, _, _, _, _ -> openExternally(Uri.parse(url)) }

            /*
             * Only the panel's own page ever sees this.
             *
             * `addJavascriptInterface` exposes Kotlin to any page the WebView
             * loads, which is why `shouldOverrideUrlLoading` above sends every
             * URL outside /bubble/panel to the browser instead of navigating
             * here. The bridge cannot read the screen on its own — it can ask
             * the service to, and the service still needs a consent the user
             * granted to a system dialog.
             */
            addJavascriptInterface(ScanBridge(), "BrawlZoneScan")

            loadUrl(PANEL_URL)
        }
        body.addView(web, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        body.addView(spinner, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER,
        ))
        body.addView(retry, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER,
        ))
        retry.setOnClickListener {
            failed = false
            retry.visibility = View.GONE
            web.visibility = View.VISIBLE
            web.alpha = 0f
            spinner.visibility = View.VISIBLE
            web.loadUrl(PANEL_URL)
        }
        column.addView(body, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f,
        ))

        root.addView(column, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))

        val panelParams = WindowManager.LayoutParams(
            width,
            height,
            overlayType(),
            /*
             * Focusable so the WebView scrolls and BACK reaches us, but NOT
             * touch-modal, so every touch outside these bounds still reaches the
             * bubble and the game beneath. WATCH_OUTSIDE_TOUCH turns those
             * outside touches into a dismiss.
             */
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            /*
             * Ask the system to make room rather than draw over us. On its own
             * this does nothing to a fixed-size overlay, but it is what makes
             * the window a participant in IME insets at all, which is how
             * `fitPanelAroundIme` ever hears that the keyboard opened.
             */
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        /*
         * A position the user dragged the panel to survives; otherwise it is
         * placed beside the bubble. Both go through the same clamp, so a spot
         * remembered from a previous orientation can never strand the panel
         * off-screen after a rotation.
         */
        val rememberedX = panelX
        val rememberedY = panelY
        if (rememberedX != null && rememberedY != null) {
            panelParams.x = rememberedX.coerceIn(0, (screenW - width).coerceAtLeast(0))
            panelParams.y = rememberedY.coerceIn(0, (screenH - height).coerceAtLeast(0))
        } else {
            placePanel(panelParams, width, height)
        }

        /*
         * Dragging the panel itself. Same distance-based split as the bubble, so
         * a press that drifts a couple of pixels still counts as a press on the
         * close button rather than becoming a drag.
         */
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        val slop = dp(8)
        var moving = false

        grab.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startX = panelParams.x
                    startY = panelParams.y
                    moving = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!moving && (abs(dx) > slop || abs(dy) > slop)) moving = true
                    if (moving) {
                        panelParams.x = (startX + dx).roundToInt()
                            .coerceIn(0, (screenW - panelParams.width).coerceAtLeast(0))
                        panelParams.y = (startY + dy).roundToInt()
                            .coerceIn(0, (screenH - panelParams.height).coerceAtLeast(0))
                        runCatching { windows.updateViewLayout(root, panelParams) }
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    // Remembered only when it actually moved, so a stray tap on
                    // the header does not pin the panel to its current spot.
                    if (moving) {
                        panelX = panelParams.x
                        panelY = panelParams.y
                        this@BubbleService.panelParams = panelParams
                    }
                    true
                }

                else -> false
            }
        }

        /*
         * Ask the window for the keyboard's height, and react when it changes.
         *
         * `ime()` insets are the only reliable answer: the older tricks measure
         * a *resizing* window against the screen, and this window never resizes
         * because its size is written into its LayoutParams. Below API 30 there
         * is no ime() type, and no repositioning happens — the keyboard covers
         * the panel there exactly as it did before, which is the same behaviour
         * those devices already had rather than a regression.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener { _, insets ->
                fitPanelAroundIme(insets.getInsets(WindowInsets.Type.ime()).bottom)
                insets
            }
        }

        root.alpha = 0f
        root.scaleX = 0.12f
        root.scaleY = 0.12f
        root.pivotX = (params.x + params.width / 2 - panelParams.x).toFloat()
        root.pivotY = (params.y + params.height / 2 - panelParams.y).toFloat()

        panel = root
        panelWeb = web
        this.panelParams = panelParams
        runCatching { windows.addView(root, panelParams) }
            .onSuccess {
                root.animate()
                    .alpha(1f).scaleX(1f).scaleY(1f)
                    .setDuration(180)
                    .setInterpolator(DecelerateInterpolator())
                    .start()
            }
            .onFailure {
                panel = null
                panelWeb = null
                this.panelParams = null
            }
    }

    /**
     * A WebView that will not let the keyboard take the screen.
     *
     * In landscape Android's IME defaults to "extract" mode: it covers the whole
     * display with its own full-width text field and its own editor, on the
     * reasonable assumption that a short screen has no room to show the app
     * behind it. For an app that is a 375dp-tall overlay over a game, that
     * assumption produces exactly the reported symptom — searching covers
     * everything.
     *
     * The two flags are the documented way to decline it, and they have to be
     * set on the editor rather than the window, which for a WebView means
     * overriding the input connection it hands the IME.
     */
    private inner class PanelWebView(context: Context) : WebView(context) {
        override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
            val connection = super.onCreateInputConnection(outAttrs)
            outAttrs.imeOptions =
                outAttrs.imeOptions or
                    EditorInfo.IME_FLAG_NO_EXTRACT_UI or
                    EditorInfo.IME_FLAG_NO_FULLSCREEN
            return connection
        }
    }

    /**
     * Moves the panel clear of the keyboard, and puts it back afterwards.
     *
     * An overlay window has a fixed size in its LayoutParams, so `adjust=resize`
     * has nothing to resize and `adjust=pan` has nothing to pan — the keyboard
     * simply draws over whatever the panel was showing. Nothing repositions it
     * but us.
     *
     * So when the IME appears the panel goes to the top of the screen and
     * shrinks to the gap above the keyboard, and when it goes it returns to
     * where the reader had put it. The remembered position is untouched
     * throughout: a keyboard is a temporary visitor, not a decision.
     */
    private fun fitPanelAroundIme(imeHeight: Int) {
        val view = panel ?: return
        val params = panelParams ?: return
        val (width, height) = panelSize()

        if (imeHeight <= 0) {
            params.width = width
            params.height = height
            placePanel(params, width, height)
        } else {
            val available = screenH - imeHeight - dp(8)
            // Never smaller than a couple of rows; below that the panel is not
            // showing anything and would be better closed than squeezed.
            params.height = height.coerceAtMost(available.coerceAtLeast(dp(140)))
            params.width = width
            params.x = params.x.coerceIn(0, (screenW - width).coerceAtLeast(0))
            params.y = 0
        }

        runCatching { windows.updateViewLayout(view, params) }
    }

    /**
     * Hands a URL to the browser and gets out of the way.
     *
     * The panel is collapsed first: the browser is about to come to the front,
     * and an overlay left floating over it is exactly the behaviour that makes
     * people uninstall this class of app.
     */
    private fun openExternally(uri: Uri) {
        collapsePanel()
        runCatching {
            startActivity(
                Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }.onFailure { Log.d(TAG, "no handler for " + uri) }
    }

    /**
     * The panel's root, which exists to handle the two ways out that a focusable
     * window makes available: the back key, and a touch landing outside it.
     */
    private inner class PanelFrame(context: Context) : FrameLayout(context) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
                collapsePanel()
                return true
            }
            return super.dispatchKeyEvent(event)
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            if (event.action == MotionEvent.ACTION_OUTSIDE) {
                /*
                 * A touch on the bubble belongs to the bubble.
                 *
                 * Both windows are notified of the same press, and closing here
                 * as well let the bubble's toggle find `panel` already null and
                 * open a fresh one — the panel appeared to ignore the tap. This
                 * was first guarded by "the two events are within 300ms", which
                 * is the wrong kind of rule: measured on a loaded device the gap
                 * reached 350ms and the panel reopened. Both windows now carry
                 * FLAG_LAYOUT_IN_SCREEN, so the question "did this land on the
                 * bubble" has an exact answer and does not need a stopwatch.
                 */
                if (onBubble(event.rawX, event.rawY)) return true

                outsideClosedAt = SystemClock.uptimeMillis()
                collapsePanel()
                return true
            }
            return super.onTouchEvent(event)
        }
    }

    // ---------------------------------------------------------- notification

    // ------------------------------------------------------------------ scan

    /**
     * The bridge the panel talks to.
     *
     * Every method here is called on a WebView worker thread, so nothing in it
     * touches a view directly — the handler is not a formality. The surface is
     * deliberately tiny: the page asks whether scanning exists, asks for it to
     * be turned on, asks for a scan, and reports corrections. Everything about
     * what a draft *means* stays on the web side, where the map list and the
     * numbers already live.
     */
    private inner class ScanBridge {

        /** "unsupported" on a build without capture, else idle/ready/busy. */
        @JavascriptInterface
        fun status(): String = when {
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q -> "unsupported"
            scanning -> "busy"
            scan?.live == true -> "ready"
            else -> "idle"
        }

        /** The roster, so the matcher knows which art to fetch. */
        @JavascriptInterface
        fun roster(json: String) {
            Thread {
                try {
                    val array = JSONArray(json)
                    val ids = ArrayList<Int>(array.length())
                    for (i in 0 until array.length()) ids.add(array.getInt(i))
                    val v = vision ?: DraftVision(this@BubbleService).also { vision = it }
                    v.prepare(ids)
                } catch (e: Throwable) {
                    Log.w(TAG, "roster rejected", e)
                }
            }.start()
        }

        @JavascriptInterface
        fun enable() = handler.post { requestScanConsent() }

        @JavascriptInterface
        fun scan() = handler.post { runScan() }

        /** Give the capture session back. Also what the recording chip does. */
        @JavascriptInterface
        fun stop() = handler.post {
            scan?.release()
            scan = null
            postScanState("idle")
        }

        /**
         * A correction. The frame that produced the misread is still in hand,
         * so the descriptor learned is the one that was actually on screen.
         */
        /**
         * Files the plate on screen under the map the reader just confirmed.
         *
         * The names come from the page, so what the app stores is keyed on the
         * site's own map list rather than on anything it tried to read — which
         * is why a learned plate can never disagree with the map it selects.
         */
        @JavascriptInterface
        fun learnPlate(modeKey: String?, mapName: String?) {
            val frame = lastFrame ?: return
            val v = vision ?: return
            Thread { runCatching { v.learnPlate(frame, modeKey, mapName) } }.start()
        }

        @JavascriptInterface
        fun learn(kind: String, index: Int, brawlerId: Int) {
            val frame = lastFrame ?: return
            val v = vision ?: return
            Thread { runCatching { v.learn(frame, kind, index, brawlerId) } }.start()
        }
    }

    /**
     * Asks for screen capture, having first got out of the way.
     *
     * Android disables the consent dialog's button while anything is drawn over
     * it — the same anti-tapjacking rule that makes the overlay permission
     * screen unusable with the bubble up — so the panel has to be gone before
     * the dialog appears, not after.
     */
    private fun requestScanConsent() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            postScanState("unsupported")
            return
        }
        /*
         * The panel is left open on purpose.
         *
         * Android applies FLAG_HIDE_NON_SYSTEM_OVERLAY_WINDOWS to its own
         * capture dialog, so every overlay is hidden for as long as it is up
         * without this service doing anything — and collapsing the panel by
         * hand would throw away the WebView the answer has to be delivered to.
         */
        runCatching {
            startActivity(
                Intent(this, ScanConsentActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    /**
     * Turns the granted token into a live session.
     *
     * `startForeground` is called again first, and that is not redundant.
     * Android 14 refuses `getMediaProjection` unless the calling service is
     * already in the foreground carrying the mediaProjection type, and it
     * refuses with a SecurityException rather than a null — so without this
     * line the app crashes at the moment the user says yes.
     */
    private fun onScanGranted(intent: Intent) {
        val code = intent.getIntExtra(ScanContract.EXTRA_RESULT_CODE, 0)
        val data: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(ScanContract.EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(ScanContract.EXTRA_RESULT_DATA)
        }
        if (data == null) {
            postScanState("denied")
            return
        }

        if (!enterForeground(withProjection = true)) {
            postScanState("failed")
            return
        }

        val session = ScreenScan(this, handler)
        session.onLost = {
            scan = null
            postScanState("idle")
        }
        val ok = session.start(code, data, screenW, screenH, resources.displayMetrics.densityDpi)
        if (!ok) {
            postScanState("failed")
            return
        }
        scan = session
        postScanState("ready")
        // Straight into a scan: the user asked for one, and the dialog was the
        // only thing between them and it.
        handler.postDelayed({ runScan() }, 250L)
    }

    /**
     * One scan: hide, capture, read, show, report.
     *
     * The overlay has to go first. MediaProjection captures the composited
     * display, so the bubble and the panel are *in* the frame — the panel sits
     * over the very strip the draft is read from, and the bubble parks on an
     * edge that can cover a ban. Hiding both for a couple of frames is the only
     * way to photograph the game rather than ourselves.
     */
    private fun runScan() {
        val session = scan
        if (session == null || !session.live) {
            requestScanConsent()
            return
        }
        if (scanning) return
        val v = vision
        if (v == null || !v.ready) {
            postScanState("preparing")
            return
        }

        scanning = true
        postScanState("busy")

        val hidden = panel
        hidden?.visibility = View.GONE
        bubble?.visibility = View.GONE

        handler.postDelayed({
            session.capture { frame ->
                hidden?.visibility = View.VISIBLE
                bubble?.visibility = View.VISIBLE

                if (frame == null) {
                    scanning = false
                    postScanState("failed")
                    return@capture
                }
                lastFrame?.recycle()
                lastFrame = frame

                Thread {
                    val reading = runCatching { v.read(frame) }.getOrNull()
                    handler.post { deliver(reading) }
                }.start()
            }
        }, HIDE_FOR_SCAN_MS)
    }

    private fun deliver(reading: DraftVision.Reading?) {
        scanning = false
        val payload = JSONObject()
        payload.put("ok", reading != null)
        if (reading != null) {
            payload.put("mode", reading.mode ?: JSONObject.NULL)
            payload.put("map", reading.map ?: JSONObject.NULL)
            payload.put("bans", slots(reading.bans))
            payload.put("allies", slots(reading.allies))
            payload.put("enemies", slots(reading.enemies))
        }
        postToPanel("window.brawlzone && window.brawlzone.scanResult($payload)")
        postScanState(if (scan?.live == true) "ready" else "idle")
    }

    /** `null` for an empty or uncertain slot, so the page can say which. */
    private fun slots(list: List<DraftVision.Slot>): JSONArray {
        val out = JSONArray()
        for (slot in list) {
            if (slot.brawlerId == null) out.put(JSONObject.NULL) else out.put(slot.brawlerId)
        }
        return out
    }

    private fun postScanState(state: String) {
        postToPanel("window.brawlzone && window.brawlzone.scanState(${JSONObject.quote(state)})")
    }

    /**
     * Delivers to the panel, or holds it until there is one.
     *
     * A scan takes a few hundred milliseconds and the reader may well have
     * tapped the bubble shut in the meantime — they asked a question and looked
     * back at their game, which is the correct way to use this. Holding the
     * last message means reopening the panel shows the answer instead of an
     * empty board and no explanation of what happened.
     */
    private fun postToPanel(js: String) {
        handler.post {
            val web = panelWeb
            if (web == null) {
                pendingScanJs = js
                return@post
            }
            runCatching { web.evaluateJavascript(js, null) }
        }
    }

    private fun flushPendingScan() {
        val js = pendingScanJs ?: return
        pendingScanJs = null
        runCatching { panelWeb?.evaluateJavascript(js, null) }
    }

    /**
     * Enters the foreground with exactly the service type that is legal *now*.
     *
     * The two-argument `startForeground` infers the type from the manifest, and
     * the manifest declares both — so the moment `mediaProjection` was added
     * there, every ordinary start of the bubble began asking Android for a
     * media-projection foreground service without holding a projection. API 34
     * refuses that with a SecurityException, which killed the service inside
     * the five seconds `startForegroundService` allows, which Android reports
     * as the app crashing. It shipped in 1.8 and made the app unusable: the
     * bubble could not start at all, whether or not anyone wanted to scan.
     *
     * So the type is always passed explicitly, and `mediaProjection` is only
     * ever claimed on the path where the user has just granted a capture token.
     * A declared type is permission to ask for it, not a description of what
     * the service is doing.
     */
    private fun enterForeground(withProjection: Boolean): Boolean {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return runCatching { startForeground(NOTIFICATION_ID, notification) }.isSuccess
        }

        var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        if (withProjection) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION

        val ok = runCatching { startForeground(NOTIFICATION_ID, notification, types) }
            .onFailure { Log.e(TAG, "startForeground(types=$types) refused", it) }
            .isSuccess
        if (ok || !withProjection) return ok

        /*
         * Promotion refused. Falling back to the plain type keeps the bubble
         * alive with scanning unavailable, which is the whole app minus one
         * feature — the alternative is the service dying and taking the overlay
         * with it.
         */
        return runCatching {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        }.isSuccess
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Bubble",
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) }
            (getSystemService(NotificationManager::class.java)).createNotificationChannel(channel)
        }

        /*
         * A Stop action, and it is not a nicety. While any app draws an overlay,
         * Android disables the permission toggles in Settings to prevent
         * tapjacking — so an overlay app can block the one screen that would
         * switch it off. The shade is the escape hatch that always works.
         */
        val stop = PendingIntent.getService(
            this,
            0,
            Intent(this, BubbleService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE,
        )

        val open = PendingIntent.getActivity(
            this,
            1,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("BrawlZone bubble")
            .setContentText("Tap the bubble for live picks · drag it down to close")
            .setSmallIcon(R.drawable.bubble_glyph)
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null as Icon?, "Stop", stop).build())
            .setOngoing(true)
            .build()
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private companion object {
        const val CHANNEL_ID = "brawlzone-bubble"
        const val NOTIFICATION_ID = 1
        const val ACTION_STOP = "net.brawlzone.bubble.STOP"

        /**
         * Backstop only. The coordinate test above is the real rule; this
         * catches a press whose ACTION_OUTSIDE carried no usable coordinates.
         * Generous on purpose: a stalled main thread stretched the gap between
         * the two events to 350ms on a device under load.
         */
        const val SAME_GESTURE_MS = 700L

        const val COLLAPSE_MS = 170L

        /**
         * How long the overlay stays hidden before the frame is grabbed.
         *
         * Two things have to finish: the window manager has to compose a frame
         * without our windows in it, and the virtual display has to hand that
         * frame to the reader. One vsync would be enough for the first and is
         * not reliably enough for the second, so this is four of them — still
         * a blink, and the capture retries anyway if the frame is not there.
         */
        const val HIDE_FOR_SCAN_MS = 70L
        const val TAG = "BrawlZoneBubble"

        /**
         * A view built for this window rather than a page borrowed from the
         * site: the Ranked tier list, filterable by mode.
         *
         * It previously loaded /events, which renders the full site — header,
         * hero, footer — into 360x520dp, so the panel opened on chrome and the
         * answer was below the fold. `?app=bubble` marks the traffic as coming
         * from the overlay rather than a browser.
         *
         * The version rides in the **hash**, and that placement is the whole
         * design. A hash is never sent to the server, so the page stays one
         * fully cached URL for every install; a query parameter would opt the
         * route out of caching entirely. The page compares it in the browser
         * and says so when a newer build exists — which is the only way an app
         * can be told about an update it does not contain.
         */
        val PANEL_URL =
            "https://brawlzone.net/bubble/panel?app=bubble#v=" + BuildConfig.VERSION_CODE
    }
}
