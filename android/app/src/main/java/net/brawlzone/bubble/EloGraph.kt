package net.brawlzone.bubble

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader

/**
 * Draws the season graph (1.42): elo across the season, the season's whole
 * width on the x axis so the line grows as the weeks go by, dashed lines at
 * the rank boundaries it crosses, a gold dot on the peak and the latest elo
 * at the end. One bitmap for both places it appears: the My season card and
 * the My rank widget (RemoteViews can only show a picture).
 */
object EloGraph {

    /** Where each rank starts (lib/ranked-elo RANK_ELO_FLOORS on the site). */
    private val FLOORS = intArrayOf(
        0, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 3500, 4000, 4500,
        5000, 5500, 6000, 6750, 7500, 8250, 9250, 10250, 11250,
    )

    fun bitmap(context: Context, width: Int, height: Int, points: List<Pair<Long, Int>>, from: Long, to: Long): Bitmap? {
        if (width <= 0 || height <= 0 || points.size < 2 || to <= from) return null
        val d = context.resources.displayMetrics.density
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val padL = 4 * d
        val padR = 46 * d // room for the latest elo
        val padT = 10 * d
        val padB = 8 * d
        val lo0 = points.minOf { it.second }
        val hi0 = points.maxOf { it.second }
        val span = maxOf(hi0 - lo0, 200)
        val lo = lo0 - span * 0.15f
        val hi = hi0 + span * 0.15f
        fun x(t: Long) = padL + (width - padL - padR) * ((t - from).toFloat() / (to - from)).coerceIn(0f, 1f)
        fun y(e: Float) = padT + (height - padT - padB) * (1f - (e - lo) / (hi - lo))

        val brand = context.getColor(R.color.brand)
        val muted = context.getColor(R.color.muted)
        // Rank boundaries inside the range.
        val dash = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = muted
            alpha = 90
            strokeWidth = 1 * d
            style = Paint.Style.STROKE
            pathEffect = DashPathEffect(floatArrayOf(4 * d, 4 * d), 0f)
        }
        for (f in FLOORS) if (f > lo && f < hi) c.drawLine(padL, y(f.toFloat()), width - padR, y(f.toFloat()), dash)

        val path = Path()
        points.forEachIndexed { i, (t, e) -> if (i == 0) path.moveTo(x(t), y(e.toFloat())) else path.lineTo(x(t), y(e.toFloat())) }
        val fill = Path(path).apply {
            lineTo(x(points.last().first), height - padB)
            lineTo(x(points.first().first), height - padB)
            close()
        }
        c.drawPath(fill, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, padT, 0f, height.toFloat(), (brand and 0x00FFFFFF) or 0x55000000, brand and 0x00FFFFFF, Shader.TileMode.CLAMP)
        })
        c.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = brand
            strokeWidth = 2.5f * d
            style = Paint.Style.STROKE
            strokeJoin = Paint.Join.ROUND
            strokeCap = Paint.Cap.ROUND
        })
        val dot = Paint(Paint.ANTI_ALIAS_FLAG)
        val peak = points.maxBy { it.second }
        dot.color = 0xFFFFFFFF.toInt()
        c.drawCircle(x(peak.first), y(peak.second.toFloat()), 4.5f * d, dot)
        dot.color = brand
        c.drawCircle(x(peak.first), y(peak.second.toFloat()), 3f * d, dot)
        val last = points.last()
        dot.color = brand
        c.drawCircle(x(last.first), y(last.second.toFloat()), 4f * d, dot)
        c.drawText(
            java.text.NumberFormat.getIntegerInstance().format(last.second),
            x(last.first) + 7 * d,
            y(last.second.toFloat()) + 4 * d,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = context.getColor(R.color.foreground)
                textSize = 12 * d
                isFakeBoldText = true
            },
        )
        return bmp
    }

    /** The current season's window in milliseconds, from Season, or null. */
    fun window(context: Context, tag: String): Pair<Long, Long>? {
        val s = Season.current(context, tag) ?: return null
        val day = { iso: String -> runCatching { java.time.LocalDate.parse(iso).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull() }
        val from = day(s.from) ?: return null
        val to = s.to?.let(day) ?: (from + 28L * 86_400_000L)
        return from to to
    }
}
