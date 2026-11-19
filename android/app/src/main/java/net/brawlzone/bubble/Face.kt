package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * The bubble's face (1.42): any brawler's portrait instead of the player's
 * icon. Stored in BubbleLook's preferences (KEY_FACE, the portrait's URL) so
 * the running bubble repaints at once; the portrait is downloaded when chosen
 * and read from Widgets' image cache after that, so drawing never waits on
 * the network.
 */
object Face {

    data class Option(val id: Int, val name: String, val icon: String)

    private const val KEY_NAME = "face_name"
    private val loader = Executors.newFixedThreadPool(3)

    fun url(context: Context): String? = BubbleLook.prefs(context).getString(BubbleLook.KEY_FACE, null)

    fun name(context: Context): String? = BubbleLook.prefs(context).getString(KEY_NAME, null)

    /** The chosen brawler if its portrait is saved, otherwise the player's icon (or null). */
    fun bitmap(context: Context): Bitmap? = url(context)?.let { Widgets.cachedImage(context, it) } ?: Account.savedIcon(context)

    /** Off the main thread. */
    private fun list(context: Context): List<Option> {
        val body = runCatching { Http.text("${Http.SITE}/api/bubble/brawlers?lang=${AppLang.current(context)}") }.getOrNull() ?: return emptyList()
        val a = runCatching { JSONObject(body).optJSONArray("brawlers") }.getOrNull() ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val icon = o.optString("icon").takeIf { it.startsWith("https://") } ?: return@mapNotNull null
            Option(o.optInt("id"), o.optString("name"), icon)
        }
    }

    /** The picker: "My player icon" first, then every brawler. */
    fun pick(activity: Activity, onChosen: () -> Unit) {
        val app = activity.applicationContext
        val d = activity.resources.displayMetrics.density
        fun px(dp: Int) = (dp * d).toInt()
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(px(16), px(8), px(16), 0)
        }
        val mine = TextView(activity).apply {
            text = activity.getString(R.string.look_face_player)
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(activity.getColor(R.color.foreground))
            setBackgroundResource(R.drawable.chip)
            gravity = Gravity.CENTER
            setPadding(px(12), px(12), px(12), px(12))
        }
        root.addView(mine, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        val spinner = ProgressBar(activity)
        root.addView(spinner, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(96)))
        val grid = GridView(activity).apply {
            numColumns = 5
            verticalSpacing = px(8)
            horizontalSpacing = px(6)
            visibility = View.GONE
        }
        root.addView(grid, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(380)).apply { topMargin = px(10) })
        val dialog = androidx.appcompat.app.AlertDialog.Builder(activity)
            .setTitle(R.string.look_face_title)
            .setView(root)
            .setNegativeButton(android.R.string.cancel, null)
            .show()
        mine.setOnClickListener {
            BubbleLook.prefs(app).edit().remove(BubbleLook.KEY_FACE).remove(KEY_NAME).apply()
            dialog.dismiss()
            onChosen()
        }
        Thread {
            val options = list(app)
            activity.runOnUiThread {
                if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                spinner.visibility = View.GONE
                grid.visibility = View.VISIBLE
                grid.adapter = Adapter(activity, options, px(52))
                grid.setOnItemClickListener { _, _, position, _ ->
                    val o = options[position]
                    grid.isEnabled = false
                    Thread {
                        // Saved to the cache first, so the bubble can draw it straight away.
                        val ok = Widgets.badge(app, o.icon) != null
                        activity.runOnUiThread {
                            if (ok) BubbleLook.prefs(app).edit().putString(BubbleLook.KEY_FACE, o.icon).putString(KEY_NAME, o.name).apply()
                            dialog.dismiss()
                            onChosen()
                        }
                    }.start()
                }
            }
        }.start()
    }

    private class Adapter(val activity: Activity, val options: List<Option>, val size: Int) : BaseAdapter() {
        override fun getCount() = options.size
        override fun getItem(position: Int) = options[position]
        override fun getItemId(position: Int) = options[position].id.toLong()
        override fun getView(position: Int, convert: View?, parent: ViewGroup?): View {
            val o = options[position]
            val cell = (convert as? LinearLayout) ?: LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                addView(ImageView(activity).apply { scaleType = ImageView.ScaleType.CENTER_CROP }, LinearLayout.LayoutParams(size, size))
                addView(TextView(activity).apply {
                    textSize = 10f
                    maxLines = 1
                    gravity = Gravity.CENTER
                    setTextColor(activity.getColor(R.color.muted))
                }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            }
            val image = cell.getChildAt(0) as ImageView
            (cell.getChildAt(1) as TextView).text = o.name
            image.tag = o.icon
            image.setImageDrawable(null)
            val app = activity.applicationContext
            val cached = Widgets.cachedImage(app, o.icon)
            if (cached != null) {
                image.setImageBitmap(cached)
            } else {
                loader.execute {
                    val bmp = Widgets.badge(app, o.icon)
                    activity.runOnUiThread { if (image.tag == o.icon && bmp != null) image.setImageBitmap(bmp) }
                }
            }
            return cell
        }
    }
}
