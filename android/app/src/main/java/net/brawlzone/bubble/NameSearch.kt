package net.brawlzone.bubble

import android.app.Activity
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.URLEncoder
import java.text.NumberFormat

/**
 * Find a player by name (1.40), the website's search (`/api/players/search`):
 * players the site has seen, by name, exact matches first. Used by the tag
 * field and by "Add a friend", so nobody has to dig out a tag.
 *
 * Shows up to eight matches under a field; tapping one hands back its tag.
 * Typing is debounced, and an answer that arrives after the text changed
 * again is dropped.
 */
class NameSearch(
    private val activity: Activity,
    private val list: LinearLayout,
    private val onPick: (tag: String, name: String) -> Unit,
    private val onState: (State) -> Unit = {},
    /** Shown in the list when nothing matches; null leaves the list empty. */
    private val emptyText: String? = null,
) {
    enum class State { IDLE, SEARCHING, FOUND, NONE }

    data class Match(val tag: String, val name: String, val trophies: Int?, val iconUrl: String?)

    private var wanted: String? = null
    private val run = Runnable { search() }

    /** A query to look up, or null to clear the list. */
    fun query(text: String?) {
        list.removeCallbacks(run)
        val q = text?.trim().orEmpty()
        if (q.length < 2 || q.startsWith("#")) {
            wanted = null
            show(emptyList())
            onState(State.IDLE)
            return
        }
        wanted = q
        list.postDelayed(run, 450)
    }

    fun clear() = query(null)

    private fun search() {
        val q = wanted ?: return
        onState(State.SEARCHING)
        Thread {
            val found = runCatching { fetch(q) }.getOrNull()
            activity.runOnUiThread {
                if (activity.isFinishing || activity.isDestroyed || wanted != q) return@runOnUiThread
                val matches = found.orEmpty()
                show(matches)
                if (matches.isEmpty() && emptyText != null) {
                    list.visibility = View.VISIBLE
                    list.addView(TextView(activity).apply {
                        text = emptyText
                        setTextColor(activity.getColor(R.color.muted))
                        textSize = 12f
                        val pad = (6 * activity.resources.displayMetrics.density).toInt()
                        setPadding(pad, pad, pad, pad)
                    })
                }
                onState(if (matches.isEmpty()) State.NONE else State.FOUND)
            }
        }.start()
    }

    private fun fetch(q: String): List<Match> {
        val body = Http.text("${Http.SITE}/api/players/search?q=" + URLEncoder.encode(q, "UTF-8"))
        val a = JSONObject(body).optJSONArray("players") ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val tag = Account.normalise(o.optString("tag"))
            if (!Account.isValid(tag)) return@mapNotNull null
            Match(
                tag = tag,
                name = o.optString("name"),
                trophies = if (o.isNull("trophies")) null else o.optInt("trophies"),
                iconUrl = o.optString("iconUrl").takeIf { it.startsWith("https://") },
            )
        }
    }

    private fun show(matches: List<Match>) {
        list.removeAllViews()
        list.visibility = if (matches.isEmpty()) View.GONE else View.VISIBLE
        val density = activity.resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val fmt = NumberFormat.getIntegerInstance()
        for ((index, m) in matches.withIndex()) {
            val row = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(px(4), px(9), px(4), px(9))
                isClickable = true
                isFocusable = true
                val ripple = android.util.TypedValue()
                activity.theme.resolveAttribute(android.R.attr.selectableItemBackground, ripple, true)
                setBackgroundResource(ripple.resourceId)
                setOnClickListener { onPick(m.tag, m.name) }
            }
            val icon = ImageView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(px(34), px(34))
                setBackgroundResource(R.drawable.avatar_frame)
                scaleType = ImageView.ScaleType.CENTER_CROP
            }
            row.addView(icon)
            val texts = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = px(12) }
            }
            texts.addView(TextView(activity).apply {
                text = m.name
                setTextColor(activity.getColor(R.color.foreground))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
            texts.addView(TextView(activity).apply {
                text = "#" + m.tag + (m.trophies?.let { " · 🏆 " + fmt.format(it) } ?: "")
                setTextColor(activity.getColor(R.color.muted))
                textSize = 12f
                maxLines = 1
            })
            row.addView(texts)
            if (index > 0) {
                list.addView(View(activity).apply {
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(1))
                    setBackgroundColor(activity.getColor(R.color.border))
                })
            }
            list.addView(row)
            m.iconUrl?.let { url ->
                Thread {
                    val bitmap = runCatching { Http.open(url).use { android.graphics.BitmapFactory.decodeStream(it) } }.getOrNull()
                    if (bitmap != null) activity.runOnUiThread { icon.setImageBitmap(bitmap) }
                }.start()
            }
        }
    }
}
