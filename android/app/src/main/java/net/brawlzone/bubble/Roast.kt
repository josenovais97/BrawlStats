package net.brawlzone.bubble

import android.app.Activity
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast

/**
 * Roast My Account in the app (1.42): today's roast of the player's own
 * account, or a friend's, as the site's story image (`/roast/<tag>/story/<lang>`,
 * the same one /roast shares), shown in a dialog with a Share button. The
 * share text carries the Bubble link, so every roast posted is an invite.
 *
 * The roast changes once a day (the site seeds it with the tag and the UTC
 * date) and the image is kept for half an hour like the other cards. It is
 * written in seven languages; the others get English. Players who opted out
 * of the site get nothing (the site answers 404, the dialog says so).
 */
object Roast {

    /** The languages the roast jokes are written in (src/lib/i18n INTL_LOCALES + en). */
    private val LANGS = setOf("en", "es", "pt", "tr", "de", "ru", "fr")

    private fun url(activity: Activity, tag: String): String {
        val lang = AppLang.current(activity).lowercase().substringBefore('-').let { if (it in LANGS) it else "en" }
        // 1.44: the API copy of /roast/<tag>/story/<lang>; Cloudflare challenges /roast/ and the app cannot pass it.
        return "${Http.SITE}/api/bubble/roast/${Uri.encode(tag.removePrefix("#").uppercase())}/$lang"
    }

    fun show(activity: Activity, tag: String) {
        if (tag.isEmpty()) return
        val app = activity.applicationContext
        val density = activity.resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(px(16), px(8), px(16), 0)
        }
        val spinner = ProgressBar(activity)
        root.addView(spinner, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(72)))
        val wait = TextView(activity).apply {
            setText(R.string.roast_loading)
            gravity = Gravity.CENTER
            textSize = 14f
            setTextColor(activity.getColor(R.color.muted))
        }
        root.addView(wait, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        // A story is 9:16; most of the screen's height, the dialog's width decides the rest.
        val image = ImageView(activity).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            visibility = View.GONE
            contentDescription = activity.getString(R.string.roast_title)
        }
        root.addView(image, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (activity.resources.displayMetrics.heightPixels * 0.6).toInt()))
        val dialog = androidx.appcompat.app.AlertDialog.Builder(activity)
            .setTitle(R.string.roast_title)
            .setView(root)
            .setPositiveButton(R.string.roast_share, null)
            .setNegativeButton(R.string.roast_close, null)
            .show()
        val share = dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE)
        share.isEnabled = false
        Thread {
            val file = Share.fetch(app, url(activity, tag))
            val bitmap = file?.let {
                runCatching { BitmapFactory.decodeFile(it.path, BitmapFactory.Options().apply { inSampleSize = 2 }) }.getOrNull()
            }
            activity.runOnUiThread {
                if (activity.isFinishing || activity.isDestroyed || !dialog.isShowing) return@runOnUiThread
                if (file == null || bitmap == null) {
                    dialog.dismiss()
                    Toast.makeText(activity, R.string.roast_failed, Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                spinner.visibility = View.GONE
                wait.visibility = View.GONE
                image.setImageBitmap(bitmap)
                image.visibility = View.VISIBLE
                share.isEnabled = true
                share.setOnClickListener {
                    Share.sendFile(activity, file, "brawlzone-roast", activity.getString(R.string.roast_share_text))
                }
            }
        }.start()
    }
}
