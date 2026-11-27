package net.brawlzone.bubble

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * The Supporter ring (1.46), worn by players who bought Bubble Supporter.
 *
 * Five layers, each a still picture moved on its own: a gold halo that
 * breathes, the metallic gold band turning slowly, a glint of light running
 * round the band faster, a thin rainbow line turning the other way, and three
 * four-point stars circling and twinkling. Every motion is a property
 * animation (rotation, alpha, scale) on a hardware layer, so the GPU moves
 * cached pictures and nothing is redrawn frame by frame: over the game it
 * costs what a legendary ring costs.
 *
 * The geometry matches RingView: the band's centre sits [band] * 1.5 inside
 * the frame's edge, which is where the badge's rim is in both the bubble and
 * the previews.
 */
class SupporterRingView(context: Context, private val ring: Rings.Ring, private val band: Float) :
    FrameLayout(context), Spinner {

    private val animators = mutableListOf<ValueAnimator>()

    private val halo = Layer { c, cx, cy, size ->
        val outer = size / 2f
        val r = radius(size)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                cx, cy, outer,
                intArrayOf(0x00FFC53D, 0x00FFC53D, 0x99FFC53D.toInt(), 0x55FFE9A8, 0x00FFE9A8),
                floatArrayOf(0f, (r - band) / outer, r / outer, (r + band * 0.9f) / outer, 1f),
                Shader.TileMode.CLAMP,
            )
        }
        c.drawCircle(cx, cy, outer, p)
    }

    private val gold = Layer { c, cx, cy, size ->
        val r = radius(size)
        val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = band * 0.22f
            color = 0xCC050A1F.toInt()
        }
        val metal = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = band
            shader = SweepGradient(cx, cy, ring.colors, null)
        }
        // A pale line along the band's outer half reads as polished metal.
        val sheen = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = band * 0.18f
            color = 0x80FFFFFF.toInt()
        }
        c.drawCircle(cx, cy, r + band / 2f + edge.strokeWidth / 2f, edge)
        c.drawCircle(cx, cy, r, metal)
        c.drawCircle(cx, cy, r + band * 0.22f, sheen)
        c.drawCircle(cx, cy, r - band / 2f - edge.strokeWidth / 2f, edge)
    }

    private val glint = Layer { c, cx, cy, size ->
        val r = radius(size)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = band * 0.86f
            strokeCap = Paint.Cap.ROUND
            shader = SweepGradient(
                cx, cy,
                intArrayOf(0x00FFFFFF, 0x00FFFFFF, 0x66FFFFFF, 0x00FFFFFF, 0x00FFFFFF, 0xF0FFFFFF.toInt(), 0x00FFFFFF),
                floatArrayOf(0f, 0.36f, 0.40f, 0.44f, 0.86f, 0.93f, 1f),
            )
        }
        c.drawCircle(cx, cy, r, p)
    }

    private val prism = Layer { c, cx, cy, size ->
        val r = radius(size) + band * 0.78f
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = band * 0.2f
            shader = SweepGradient(
                cx, cy,
                intArrayOf(0xE6FF7AC8.toInt(), 0xE6FFC53D.toInt(), 0xE67CFFB2.toInt(), 0xE64FD8FF.toInt(), 0xE6B47CFF.toInt(), 0xE6FF7AC8.toInt()),
                null,
            )
        }
        c.drawCircle(cx, cy, r, p)
    }

    private val stars = Layer { c, cx, cy, size ->
        val r = radius(size)
        val s = band * 0.62f
        val glow = Paint(Paint.ANTI_ALIAS_FLAG)
        val white = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
        val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xCCFFF6D8.toInt() }
        for (i in 0 until ring.sparks.coerceAtLeast(1)) {
            val a = Math.toRadians(360.0 * i / ring.sparks.coerceAtLeast(1) - 90.0)
            val x = cx + (r * cos(a)).toFloat()
            val y = cy + (r * sin(a)).toFloat()
            glow.shader = RadialGradient(x, y, s * 1.6f, intArrayOf(0xCCFFE08A.toInt(), 0x00FFE08A), null, Shader.TileMode.CLAMP)
            c.drawCircle(x, y, s * 1.6f, glow)
            c.drawPath(star(x, y, s), white)
            // A small dot between each pair of stars, out on the rainbow line.
            val b = a + Math.PI / ring.sparks.coerceAtLeast(1)
            val r2 = r + band * 0.78f
            c.drawCircle(cx + (r2 * cos(b)).toFloat(), cy + (r2 * sin(b)).toFloat(), band * 0.14f, dot)
        }
    }

    init {
        clipChildren = false
        for (layer in listOf(halo, gold, glint, prism, stars)) {
            addView(layer, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        }
    }

    /** The band's centre line, as in RingView. */
    private fun radius(size: Float) = size / 2f - band * 1.5f

    override fun spin() {
        if (animators.isNotEmpty()) return
        fun turn(view: View, ms: Long, clockwise: Boolean) =
            ObjectAnimator.ofFloat(view, View.ROTATION, 0f, if (clockwise) 360f else -360f).apply {
                duration = ms
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
            }
        fun pulse(view: View, property: android.util.Property<View, Float>, from: Float, to: Float, ms: Long) =
            ObjectAnimator.ofFloat(view, property, from, to).apply {
                duration = ms
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.REVERSE
                interpolator = AccelerateDecelerateInterpolator()
            }
        animators += turn(gold, 9000L, clockwise = true)
        animators += turn(glint, 2600L, clockwise = true)
        animators += turn(prism, 6000L, clockwise = false)
        animators += turn(stars, 4800L, clockwise = false)
        animators += pulse(halo, View.ALPHA, 0.45f, 1f, 1600L)
        animators += pulse(halo, View.SCALE_X, 0.94f, 1f, 1600L)
        animators += pulse(halo, View.SCALE_Y, 0.94f, 1f, 1600L)
        animators += pulse(stars, View.ALPHA, 0.65f, 1f, 700L)
        animators.forEach { it.start() }
    }

    override fun stop() {
        animators.forEach { it.cancel() }
        animators.clear()
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }

    /** One still picture on its own hardware layer, drawn once per size. */
    private inner class Layer(private val picture: (Canvas, Float, Float, Float) -> Unit) : View(this@SupporterRingView.context) {
        init {
            setLayerType(LAYER_TYPE_HARDWARE, null)
        }

        override fun onDraw(canvas: Canvas) {
            picture(canvas, width / 2f, height / 2f, min(width, height).toFloat())
        }
    }

    private fun star(x: Float, y: Float, s: Float): Path = Path().apply {
        val k = s * 0.3f
        moveTo(x, y - s)
        lineTo(x + k, y - k)
        lineTo(x + s, y)
        lineTo(x + k, y + k)
        lineTo(x, y + s)
        lineTo(x - k, y + k)
        lineTo(x - s, y)
        lineTo(x - k, y - k)
        close()
    }
}
