package net.brawlzone.bubble

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * The app screen's pieces built in code (1.45): the Season pages, the last
 * games, the squad table and the settings menu are lists whose length and
 * parts depend on the player, so they are made here rather than inflated.
 * One place for the sizes and colours keeps them looking like the layouts.
 */
internal object Ui {
    const val VICTORY = 0xFF35D07F.toInt()
    const val LOSS = 0xFFFF7A8C.toInt()
    const val GOLD = 0xFFFFC53D.toInt()
    const val MUTED = 0xFFC3CDF0.toInt()
    const val OUTLINE = 0xFF050A1F.toInt()
    const val TRACK = 0xFF0A1233.toInt()
    const val OTHER = 0xFF6E82CC.toInt()

    private val loader = Executors.newFixedThreadPool(3)

    fun px(context: Context, dp: Number): Int = (dp.toFloat() * context.resources.displayMetrics.density + 0.5f).toInt()

    fun rounded(context: Context, color: Int, radius: Int = 14, stroke: Int = 2, strokeColor: Int = OUTLINE): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = px(context, radius).toFloat()
            if (stroke > 0) setStroke(px(context, stroke), strokeColor)
        }

    fun column(context: Context, gap: Int = 0): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        if (gap > 0) {
            showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
            dividerDrawable = space(context, 0, gap)
        }
    }

    fun row(context: Context, gap: Int = 0): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        if (gap > 0) {
            showDividers = LinearLayout.SHOW_DIVIDER_MIDDLE
            dividerDrawable = space(context, gap, 0)
        }
    }

    private fun space(context: Context, w: Int, h: Int) = GradientDrawable().apply { setSize(px(context, w), px(context, h)) }

    /** A card like the layouts' own (card_surface), with its padding. */
    fun card(context: Context, gap: Int = 10): LinearLayout = column(context, gap).apply {
        setBackgroundResource(R.drawable.card_surface)
        val p = px(context, 14)
        setPadding(p, p, p, p)
    }

    fun text(context: Context, value: CharSequence, size: Float = 14f, color: Int = 0xFFEEF1FA.toInt(), bold: Boolean = false, lines: Int = 0): TextView =
        TextView(context).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
            if (lines > 0) {
                maxLines = lines
                ellipsize = android.text.TextUtils.TruncateAt.END
            }
        }

    /** The small heading above a group of cards. */
    fun caption(context: Context, value: CharSequence): TextView =
        text(context, value.toString().uppercase(AppLang.locale(AppLang.current(context))), 12f, context.getColor(R.color.muted), bold = true).apply {
            letterSpacing = 0.06f
            setPadding(px(context, 4), px(context, 14), 0, px(context, 2))
        }

    fun View.grow(weight: Float = 1f): View = apply {
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, weight)
    }

    fun View.below(dp: Int): View = apply {
        val p = (layoutParams as? ViewGroup.MarginLayoutParams)
            ?: LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        p.topMargin = px(context, dp)
        layoutParams = p
    }

    /** A thin bar, `share` of it filled. */
    fun bar(context: Context, share: Double, color: Int, height: Int = 8): FrameLayout = FrameLayout(context).apply {
        background = rounded(context, TRACK, height, 0)
        clipToOutline = true
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(context, height))
        val fill = View(context).apply { background = rounded(context, color, height, 0) }
        addView(fill, FrameLayout.LayoutParams(0, FrameLayout.LayoutParams.MATCH_PARENT))
        // The width is known after layout; it grows into place.
        val part = share.coerceIn(0.0, 1.0)
        addOnLayoutChangeListener(object : View.OnLayoutChangeListener {
            override fun onLayoutChange(v: View, l: Int, t: Int, r: Int, b: Int, ol: Int, ot: Int, or: Int, ob: Int) {
                if (r - l <= 0) return
                v.removeOnLayoutChangeListener(this)
                val to = ((r - l) * part).toInt()
                ValueAnimator.ofInt(0, to).apply {
                    duration = 520
                    interpolator = android.view.animation.DecelerateInterpolator()
                    addUpdateListener { a ->
                        fill.layoutParams = fill.layoutParams.apply { width = a.animatedValue as Int }
                    }
                }.start()
            }
        })
    }

    /** Wins in green, losses in red, as one bar. */
    fun winBar(context: Context, wins: Int, games: Int, height: Int = 8): LinearLayout = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        background = rounded(context, TRACK, height, 0)
        clipToOutline = true
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(context, height))
        fun part(n: Int, color: Int) = addView(
            View(context).apply { setBackgroundColor(color) },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, n.toFloat()),
        )
        if (games > 0) {
            part(wins, VICTORY)
            part(games - wins, 0xFFFF5C72.toInt())
        }
    }

    /** A number over its label. */
    fun tile(context: Context, value: CharSequence, label: CharSequence, color: Int = 0xFFEEF1FA.toInt(), filled: Boolean = true): LinearLayout =
        column(context).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            if (filled) background = rounded(context, context.getColor(R.color.surface_2), 14)
            setPadding(px(context, 6), px(context, 9), px(context, 6), px(context, 9))
            addView(text(context, value, 21f, color, bold = true, lines = 1).apply { gravity = Gravity.CENTER })
            addView(text(context, label, 11.5f, MUTED, lines = 2).apply { gravity = Gravity.CENTER })
        }

    /** A choice in a row of choices. */
    fun chip(context: Context, label: CharSequence, on: Boolean, onTap: () -> Unit): TextView =
        text(context, label, 14f, if (on) context.getColor(R.color.brand_ink) else 0xFFEEF1FA.toInt(), bold = true, lines = 1).apply {
            gravity = Gravity.CENTER
            background = rounded(context, if (on) GOLD else context.getColor(R.color.surface_2), 12)
            minHeight = px(context, 44)
            setPadding(px(context, 12), 0, px(context, 12), 0)
            isSelected = on
            isClickable = true
            isFocusable = true
            setOnClickListener { onTap() }
        }

    /** The big gold button, or the blue one. */
    fun button(context: Context, label: CharSequence, gold: Boolean = true, onTap: () -> Unit): TextView =
        text(context, label, 15f, if (gold) context.getColor(R.color.brand_ink) else 0xFFFFFFFF.toInt(), bold = true, lines = 1).apply {
            gravity = Gravity.CENTER
            setBackgroundResource(if (gold) R.drawable.btn_gold else R.drawable.btn_outline)
            minHeight = px(context, 50)
            setPadding(px(context, 12), px(context, 8), px(context, 12), px(context, 10))
            isClickable = true
            isFocusable = true
            setOnClickListener { onTap() }
        }

    fun image(context: Context, size: Int, radius: Int = 10): ImageView = ImageView(context).apply {
        layoutParams = LinearLayout.LayoutParams(px(context, size), px(context, size))
        scaleType = ImageView.ScaleType.CENTER_CROP
        if (radius > 0) {
            background = rounded(context, context.getColor(R.color.surface_3), radius, 0)
            clipToOutline = true
        }
    }

    /** A picture from the site, kept on the phone (Widgets.badge), set when it is in. */
    fun load(activity: Activity, view: ImageView, url: String?, large: Boolean = false) {
        if (url == null) return
        view.tag = url
        val app = activity.applicationContext
        loader.execute {
            val bitmap = (if (large) Widgets.picture(app, url) else Widgets.badge(app, url)) ?: return@execute
            activity.runOnUiThread {
                if (!activity.isDestroyed && view.tag == url) {
                    view.alpha = 0f
                    view.setImageBitmap(bitmap)
                    view.animate().alpha(1f).setDuration(160).start()
                }
            }
        }
    }

    /** Placeholders that breathe while an answer is on its way. */
    fun skeleton(context: Context, heights: List<Int>): LinearLayout = column(context, 12).apply {
        for (h in heights) {
            addView(
                View(context).apply {
                    background = rounded(context, context.getColor(R.color.surface), 18, 0)
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(context, h))
                },
            )
        }
        val pulse = ValueAnimator.ofFloat(1f, 0.45f).apply {
            duration = 700
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener { alpha = it.animatedValue as Float }
        }
        addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) = pulse.start()
            override fun onViewDetachedFromWindow(v: View) = pulse.cancel()
        })
    }

    /** What each counting number last showed, so it only moves when it changed. */
    private val shown = HashMap<String, Double>()

    /** A number that counts from what it last showed to where it is now. */
    fun countTo(view: TextView, key: String, to: Double, show: (Double) -> CharSequence) {
        val from = shown[key] ?: 0.0
        shown[key] = to
        if (from == to) {
            view.text = show(to)
            return
        }
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 620
            interpolator = android.view.animation.DecelerateInterpolator(1.6f)
            addUpdateListener { a -> view.text = show(from + (to - from) * (a.animatedValue as Float)) }
        }.start()
    }

    /** The rank's own colour, for the cards that stand on it. */
    fun rankColor(rankIndex: Int): Int = when {
        rankIndex >= 21 -> 0xFF8A6A12.toInt() // Pro
        rankIndex >= 18 -> 0xFF7A3B12.toInt() // Masters
        rankIndex >= 15 -> 0xFF7A1A2C.toInt() // Legendary
        rankIndex >= 12 -> 0xFF5A1C7A.toInt() // Mythic
        rankIndex >= 9 -> 0xFF1C5A8A.toInt() // Diamond
        rankIndex >= 6 -> 0xFF7A5A12.toInt() // Gold
        rankIndex >= 3 -> 0xFF4A5676.toInt() // Silver
        rankIndex >= 0 -> 0xFF6A4426.toInt() // Bronze
        else -> 0xFF22316C.toInt()
    }

    /** A card in a colour, with room for a picture behind its right side. */
    fun hero(context: Context, color: Int): Pair<FrameLayout, LinearLayout> {
        val frame = FrameLayout(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(lighten(color, 1.18f), color, lighten(color, 0.62f)),
            ).apply {
                cornerRadius = px(context, 20).toFloat()
                setStroke(px(context, 3), OUTLINE)
            }
            clipToOutline = true
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        val body = column(context, 8).apply {
            val p = px(context, 16)
            setPadding(p, p, p, p)
        }
        frame.addView(body, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
        return frame to body
    }

    /** A brawler behind a hero card's text, bottom right. */
    fun heroArt(activity: Activity, frame: FrameLayout, url: String?, heightDp: Int = 170) {
        if (url == null) return
        val view = ImageView(activity).apply {
            scaleType = ImageView.ScaleType.FIT_END
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        frame.addView(
            view, 0,
            // A width of its own, so a wide brawler gets smaller instead of reaching the words.
            FrameLayout.LayoutParams(px(activity, ART_DP), px(activity, heightDp), Gravity.BOTTOM or Gravity.END).apply {
                marginEnd = -px(activity, 8)
                bottomMargin = -px(activity, 10)
            },
        )
        // The words keep to the other side of the card.
        (frame.getChildAt(frame.childCount - 1) as? LinearLayout)?.let {
            it.setPaddingRelative(it.paddingStart, it.paddingTop, px(activity, ART_DP), it.paddingBottom)
        }
        load(activity, view, url, large = true)
    }

    private const val ART_DP = 148

    private fun lighten(color: Int, k: Float): Int {
        fun c(shift: Int) = (((color shr shift) and 0xFF) * k).toInt().coerceIn(0, 255)
        return (0xFF shl 24) or (c(16) shl 16) or (c(8) shl 8) or c(0)
    }
}
