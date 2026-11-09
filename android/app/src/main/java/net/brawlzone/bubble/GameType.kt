package net.brawlzone.bubble

import android.content.Context
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat

/**
 * The game's display face on every bold text of a screen (1.40), shared by the
 * setup screen; the main screen has its own copy of the same rule.
 *
 * Lilita One has Latin letters only, so languages in other scripts keep the
 * system's bold, which is drawn for them.
 */
object GameType {
    fun apply(context: Context, root: View) {
        if (AppLang.byCode(AppLang.current(context))?.latin == false) return
        val display = ResourcesCompat.getFont(context, R.font.lilita_one) ?: return
        val metrics = context.resources.displayMetrics
        val large = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_SP, 15f, metrics)
        val drop = 2f * metrics.density
        fun walk(view: View) {
            if (view is ViewGroup) for (i in 0 until view.childCount) walk(view.getChildAt(i))
            if (view is TextView && view !is EditText && view.typeface?.isBold == true) {
                view.typeface = display
                if (view.textSize >= large) view.setShadowLayer(1f, 0f, drop, Color.parseColor("#CC050A1F"))
            }
        }
        walk(root)
    }
}
