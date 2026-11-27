package net.brawlzone.bubble

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Bubble Pass rings (1.43): the cosmetics the pass unlocks, worn around the
 * bubble over the game.
 *
 * Four common rings come from tiers 2, 4, 6 and 8 and are kept for good once
 * earned. Tier 10 gives the week's legendary ring, one of eight in turn, so a
 * week missed comes round again eight weeks later. Legendary rings turn
 * slowly, carry a soft halo and orbiting sparks. They turn on a hardware
 * layer (the view rotates, nothing is redrawn), which costs the game nothing.
 */
object Rings {
    data class Ring(
        val id: String,
        val name: Int,
        val colors: IntArray,
        val legendary: Boolean = false,
        val sparks: Int = 0,
        /** Bubble Supporter's own ring (1.46): never in the pass, worn by those who bought it. */
        val supporter: Boolean = false,
    )

    /**
     * The Supporter ring (1.46): metallic gold, a glint running round it, a
     * rainbow line turning the other way, a breathing halo and three twinkling
     * stars. Drawn by SupporterRingView, not RingView.
     */
    val SUPPORTER = Ring(
        "supporter",
        R.string.ring_supporter,
        intArrayOf(0xFFFFE9A8.toInt(), 0xFFFFC53D.toInt(), 0xFFB8860B.toInt(), 0xFFFFF6D8.toInt(), 0xFFFFC53D.toInt(), 0xFF8A5A00.toInt(), 0xFFFFE08A.toInt(), 0xFFFFE9A8.toInt()),
        legendary = true,
        sparks = 3,
        supporter = true,
    )

    val COMMON = listOf(
        Ring("spark", R.string.ring_spark, intArrayOf(0xFFFFE37A.toInt(), 0xFFFFFFFF.toInt(), 0xFFFFC53D.toInt(), 0xFFFFFFFF.toInt()), sparks = 2),
        Ring("ember", R.string.ring_ember, intArrayOf(0xFFFF5C2A.toInt(), 0xFFFFB13D.toInt(), 0xFFFF2E63.toInt(), 0xFFFFB13D.toInt())),
        Ring("frost", R.string.ring_frost, intArrayOf(0xFF9BE8FF.toInt(), 0xFFFFFFFF.toInt(), 0xFF4FB8FF.toInt(), 0xFFFFFFFF.toInt()), sparks = 2),
        Ring("toxic", R.string.ring_toxic, intArrayOf(0xFF7CFF4F.toInt(), 0xFFB44DFF.toInt(), 0xFF7CFF4F.toInt(), 0xFFB44DFF.toInt())),
    )

    val LEGENDARY = listOf(
        Ring("galaxy", R.string.ring_galaxy, intArrayOf(0xFF7A5CFF.toInt(), 0xFFFF5CE1.toInt(), 0xFF4FD8FF.toInt(), 0xFF7A5CFF.toInt()), true, 3),
        Ring("rainbow", R.string.ring_rainbow, intArrayOf(0xFFFF5C5C.toInt(), 0xFFFFC53D.toInt(), 0xFF5CFF8A.toInt(), 0xFF4FB8FF.toInt(), 0xFFB45CFF.toInt(), 0xFFFF5C5C.toInt()), true, 3),
        Ring("lava", R.string.ring_lava, intArrayOf(0xFFFF3D00.toInt(), 0xFFFFB300.toInt(), 0xFFFF1744.toInt(), 0xFFFF3D00.toInt()), true, 3),
        Ring("neon", R.string.ring_neon, intArrayOf(0xFF00F5FF.toInt(), 0xFFFF00E5.toInt(), 0xFF00F5FF.toInt()), true, 3),
        Ring("royal", R.string.ring_royal, intArrayOf(0xFFFFD700.toInt(), 0xFFFFF6C2.toInt(), 0xFFB8860B.toInt(), 0xFFFFD700.toInt()), true, 4),
        Ring("aurora", R.string.ring_aurora, intArrayOf(0xFF3DFFB4.toInt(), 0xFF3DA9FF.toInt(), 0xFFB47CFF.toInt(), 0xFF3DFFB4.toInt()), true, 3),
        Ring("storm", R.string.ring_storm, intArrayOf(0xFFB0C4FF.toInt(), 0xFF5A6BFF.toInt(), 0xFFFFFFFF.toInt(), 0xFFB0C4FF.toInt()), true, 3),
        Ring("candy", R.string.ring_candy, intArrayOf(0xFFFF7AC8.toInt(), 0xFFFFFFFF.toInt(), 0xFF7AE1FF.toInt(), 0xFFFF7AC8.toInt()), true, 3),
    )

    val ALL = listOf(SUPPORTER) + COMMON + LEGENDARY

    /** The tier each common ring comes from. */
    val COMMON_TIER = mapOf("spark" to 2, "ember" to 4, "frost" to 6, "toxic" to 8)

    fun byId(id: String?): Ring? = ALL.firstOrNull { it.id == id }

    /** The view that draws a ring: the Supporter ring has its own (1.46). Both are a [Spinner]. */
    fun view(context: Context, ring: Ring, band: Float): View =
        if (ring.supporter) SupporterRingView(context, ring, band) else RingView(context, ring, band)

    /** The legendary ring for the week starting on `weekStartEpochDay`. */
    fun legendaryFor(weekStartEpochDay: Long): Ring =
        LEGENDARY[Math.floorMod(weekStartEpochDay / 7, LEGENDARY.size.toLong()).toInt()]

    /**
     * A bubble wearing a ring, for the pass and the settings: the theme's badge
     * with the player's face (or the mark), the ring around it. `size` is the
     * badge's side in px; the frame is a little larger to hold the ring.
     */
    fun preview(context: Context, ring: Ring?, size: Int, spin: Boolean = false, locked: Boolean = false): FrameLayout {
        val density = context.resources.displayMetrics.density
        val band = (size * 0.12f).toInt().coerceAtLeast((3 * density).toInt())
        val frame = FrameLayout(context)
        val outer = size + band * 4
        val face = Face.bitmap(context)
        val art = ImageView(context).apply {
            background = BubbleLook.badge(context)
            if (face != null) {
                setImageDrawable(
                    androidx.core.graphics.drawable.RoundedBitmapDrawableFactory.create(context.resources, face).apply { isCircular = true },
                )
                scaleType = ImageView.ScaleType.CENTER_CROP
                val p = (size * 0.08f).toInt()
                setPadding(p, p, p, p)
            } else {
                setImageResource(R.drawable.bubble_glyph)
                val p = size / 4
                setPadding(p, p, p, p)
            }
            if (locked) alpha = 0.35f
        }
        frame.addView(art, FrameLayout.LayoutParams(size, size, android.view.Gravity.CENTER))
        if (ring != null) {
            val view = view(context, ring, band.toFloat()).apply { if (locked) alpha = 0.35f }
            frame.addView(view, FrameLayout.LayoutParams(outer, outer, android.view.Gravity.CENTER))
            if (spin && !locked) (view as Spinner).spin()
        }
        frame.layoutParams = FrameLayout.LayoutParams(outer, outer)
        frame.minimumWidth = outer
        frame.minimumHeight = outer
        return frame
    }
}

/**
 * One ring: a gradient band around the badge, a thin dark edge so it reads on
 * any game background, and for legendary rings a halo and sparks.
 */
/** A ring that can turn: RingView and SupporterRingView. */
interface Spinner {
    fun spin()
    fun stop()
}

class RingView(context: Context, private val ring: Rings.Ring, private val band: Float) : View(context), Spinner {
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = 0xCC050A1F.toInt()
    }
    private val halo = Paint(Paint.ANTI_ALIAS_FLAG)
    private val spark = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private var spinner: ValueAnimator? = null

    init {
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val cx = w / 2f
        val cy = h / 2f
        stroke.shader = SweepGradient(cx, cy, ring.colors, null)
        stroke.strokeWidth = band
        edge.strokeWidth = band * 0.22f
        if (ring.legendary) {
            val glow = ring.colors[0] and 0x00FFFFFF
            halo.shader = RadialGradient(
                cx, cy, min(w, h) / 2f,
                intArrayOf(glow or 0x00000000, glow or 0x66000000, glow or 0x00000000),
                floatArrayOf(0.55f, 0.78f, 1f),
                Shader.TileMode.CLAMP,
            )
        }
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        // The band sits just outside the badge: the frame is badge + 4 bands.
        val r = min(width, height) / 2f - band * 1.5f
        if (ring.legendary) canvas.drawCircle(cx, cy, min(width, height) / 2f, halo)
        canvas.drawCircle(cx, cy, r + band / 2f + edge.strokeWidth / 2f, edge)
        canvas.drawCircle(cx, cy, r, stroke)
        canvas.drawCircle(cx, cy, r - band / 2f - edge.strokeWidth / 2f, edge)
        if (ring.sparks > 0) {
            val dot = band * 0.42f
            for (i in 0 until ring.sparks) {
                val a = Math.toRadians(360.0 * i / ring.sparks - 60.0)
                canvas.drawCircle(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat(), dot, spark)
            }
        }
    }

    /** A slow turn, forever, for legendary rings (and the pass's big preview). */
    override fun spin() {
        if (spinner != null) return
        spinner = ObjectAnimator.ofFloat(this, ROTATION, 0f, 360f).apply {
            duration = if (ring.legendary) 6000L else 9000L
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            start()
        }
    }

    override fun stop() {
        spinner?.cancel()
        spinner = null
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }
}
