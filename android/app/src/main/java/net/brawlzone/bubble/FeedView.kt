package net.brawlzone.bubble

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.text.format.DateUtils
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Draws one squad feed post (1.42) into `row_post`, for the app screen's
 * newest three and the whole feed: a card tinted by the kind of post, the
 * player's icon with the post's emoji, the headline, and the reaction bar.
 * A tap on an emoji reacts at once (with a little bounce and a tick) and the
 * site is told in the background.
 */
object FeedView {

    fun inflate(activity: Activity, parent: ViewGroup, post: Feed.Post): View {
        val view = LayoutInflater.from(activity).inflate(R.layout.row_post, parent, false)
        bind(activity, view, post)
        gameType(activity, view)
        return view
    }

    fun bind(activity: Activity, view: View, post: Feed.Post) {
        val app = activity.applicationContext
        val density = activity.resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val me = Account.tag(app)
        val (headline, sub) = Feed.text(activity, post)

        view.background = card(activity, Feed.color(post))
        val avatar = view.findViewById<ImageView>(R.id.post_avatar)
        val emoji = view.findViewById<TextView>(R.id.post_emoji)
        emoji.text = Feed.emoji(post)
        val name = view.findViewById<TextView>(R.id.post_name)
        if (post.kind == "awards") {
            // Squad awards are about everyone: the medal stands in for a face.
            name.text = activity.getString(R.string.feed_title)
            avatar.setImageDrawable(null)
            emoji.visibility = View.GONE
            avatar.setImageBitmap(null)
            avatar.scaleType = ImageView.ScaleType.CENTER
            avatar.setImageDrawable(EmojiDrawable(Feed.emoji(post), px(26).toFloat()))
        } else {
            name.text = post.name
            name.setTextColor(activity.getColor(if (post.tag == me) R.color.brand else R.color.foreground))
            avatar.scaleType = ImageView.ScaleType.CENTER_CROP
            avatar.setImageDrawable(null)
            emoji.visibility = View.VISIBLE
            load(activity, avatar, post.icon)
        }
        view.findViewById<TextView>(R.id.post_time).text =
            DateUtils.getRelativeTimeSpanString(post.at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS, DateUtils.FORMAT_ABBREV_RELATIVE)
        val badge = view.findViewById<ImageView>(R.id.post_badge)
        val badgeUrl = post.args.optString("badge").takeIf { it.isNotEmpty() }
        badge.visibility = if (badgeUrl != null) View.VISIBLE else View.GONE
        if (badgeUrl != null) load(activity, badge, badgeUrl)

        view.findViewById<TextView>(R.id.post_headline).text = headline
        view.findViewById<TextView>(R.id.post_sub).apply {
            text = sub ?: ""
            visibility = if (sub.isNullOrEmpty()) View.GONE else View.VISIBLE
        }

        // Squad awards: one line per award.
        val rows = view.findViewById<LinearLayout>(R.id.post_rows)
        rows.removeAllViews()
        val awards = post.args.optJSONArray("rows")
        rows.visibility = if (awards != null && awards.length() > 0) View.VISIBLE else View.GONE
        if (awards != null) {
            for (i in 0 until awards.length()) {
                val o = awards.optJSONObject(i) ?: continue
                val (label, value) = Feed.awardRow(activity, o)
                val line = LinearLayout(activity).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundResource(R.drawable.chip)
                    setPadding(px(12), px(8), px(12), px(10))
                }
                line.addView(TextView(activity).apply {
                    text = label
                    textSize = 11f
                    setTextColor(activity.getColor(R.color.muted))
                })
                line.addView(TextView(activity).apply {
                    text = value
                    textSize = 14f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(activity.getColor(if (o.optString("tag") == me) R.color.brand else R.color.foreground))
                })
                rows.addView(line, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = px(6) })
            }
        }

        paintReactions(activity, view, post)
    }

    private fun paintReactions(activity: Activity, view: View, post: Feed.Post) {
        val app = activity.applicationContext
        val density = activity.resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val all = Feed.reactions(app, post.id)
        val mine = Feed.mine(app, post.id)
        val bar = view.findViewById<LinearLayout>(R.id.post_bar)
        bar.removeAllViews()
        for ((key, glyph) in Feed.REACTIONS) {
            val count = all.count { it.r == key }
            val chip = TextView(activity).apply {
                text = if (count > 0) "$glyph $count" else glyph
                textSize = 15f
                gravity = Gravity.CENTER
                setTextColor(activity.getColor(R.color.foreground))
                setBackgroundResource(if (mine == key) R.drawable.chip_active else R.drawable.chip)
                setPadding(px(9), px(5), px(9), px(8))
                alpha = if (mine != null && mine != key && count == 0) 0.6f else 1f
            }
            chip.setOnClickListener {
                val next = if (mine == key) null else key
                if (!Feed.reactLocal(app, post.id, next)) return@setOnClickListener
                chip.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                chip.animate().scaleX(1.4f).scaleY(1.4f).setDuration(110).withEndAction {
                    chip.animate().scaleX(1f).scaleY(1f).setDuration(160).start()
                    paintReactions(activity, view, post)
                }.start()
                Thread {
                    Feed.send(app, post.id, next)
                    // 1.43: a reaction counts toward Bubble Pass.
                    if (next != null) runCatching { Pass.event(app, "react") }
                    activity.runOnUiThread {
                        if (!activity.isFinishing && !activity.isDestroyed) paintReactions(activity, view, post)
                    }
                }.start()
            }
            bar.addView(chip, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = px(5) })
        }
        val who = view.findViewById<TextView>(R.id.post_who)
        val names = all.map { if (it.tag == Account.tag(app)) activity.getString(R.string.duel_you) else it.name }.filter { it.isNotEmpty() }
        who.visibility = if (names.isEmpty()) View.GONE else View.VISIBLE
        who.text = when {
            names.isEmpty() -> ""
            names.size <= 2 -> activity.getString(R.string.feed_reacted, names.joinToString(", "))
            else -> activity.getString(R.string.feed_reacted_more, names.take(2).joinToString(", "), names.size - 2)
        }
    }

    private fun load(activity: Activity, into: ImageView, url: String?) {
        if (url == null) return
        val app = activity.applicationContext
        into.tag = url
        Thread {
            val bitmap = Widgets.badge(app, url)
            activity.runOnUiThread { if (bitmap != null && into.tag == url) into.setImageBitmap(bitmap) }
        }.start()
    }

    /** The card: the standard dark outline, with a face that glows in the kind's colour at the top. */
    private fun card(activity: Activity, color: Int): Drawable {
        val density = activity.resources.displayMetrics.density
        val outline = GradientDrawable().apply {
            setColor(activity.getColor(R.color.outline))
            cornerRadius = 18 * density
        }
        val glow = (color and 0x00FFFFFF) or (0x55 shl 24)
        val face = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(glow, activity.getColor(R.color.surface), activity.getColor(R.color.surface))).apply {
            cornerRadius = 16 * density
            setStroke((1.5f * density).toInt(), (color and 0x00FFFFFF) or (0x99 shl 24))
        }
        return LayerDrawable(arrayOf(outline, face)).apply {
            val two = (2 * density).toInt()
            setLayerInset(1, two, two, two, (3 * density).toInt())
        }
    }

    /** The app's display face on bold Latin text, as on the app screen. */
    fun gameType(activity: Activity, root: View) {
        if (AppLang.byCode(AppLang.current(activity))?.latin == false) return
        val display = androidx.core.content.res.ResourcesCompat.getFont(activity, R.font.lilita_one) ?: return
        val large = 15f * activity.resources.displayMetrics.scaledDensity
        val drop = 2f * activity.resources.displayMetrics.density
        fun walk(view: View) {
            if (view is ViewGroup) for (i in 0 until view.childCount) walk(view.getChildAt(i))
            if (view is TextView && view !is EditText && view.typeface?.isBold == true) {
                view.typeface = display
                if (view.textSize >= large) view.setShadowLayer(1f, 0f, drop, Color.parseColor("#CC050A1F"))
            }
        }
        walk(root)
    }

    /** An emoji as a drawable, for the awards card's "face". */
    private class EmojiDrawable(private val glyph: String, size: Float) : Drawable() {
        private val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            textAlign = android.graphics.Paint.Align.CENTER
        }
        override fun draw(canvas: android.graphics.Canvas) {
            val b = bounds
            val y = b.exactCenterY() - (paint.descent() + paint.ascent()) / 2
            canvas.drawText(glyph, b.exactCenterX(), y, paint)
        }
        override fun setAlpha(alpha: Int) { paint.alpha = alpha }
        override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) { paint.colorFilter = colorFilter }
        @Deprecated("Deprecated in Java")
        override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT
    }
}
