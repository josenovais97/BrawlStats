package net.brawlzone.bubble

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Switch
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat.Type

/**
 * Widget settings (1.40): opened by the launcher when a widget is placed (the
 * player can skip it) and from the widget's long-press menu afterwards.
 * Mode and the free reward apply to the medium and large widgets; the
 * background to all of them.
 */
class WidgetConfigActivity : AppCompatActivity() {

    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLang.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // Backing out of a first placement leaves no half-set widget behind.
        setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        setContentView(R.layout.activity_widget_config)
        GameType.apply(this, findViewById(R.id.wcfg_root))
        fitSystemBars()

        val kind = Widgets.kindOf(this, widgetId)
        val picks = kind == Widgets.Kind.MEDIUM || kind == Widgets.Kind.LARGE
        findViewById<View>(R.id.wcfg_mode_card).visibility = if (picks) View.VISIBLE else View.GONE
        findViewById<View>(R.id.wcfg_reward_card).visibility = if (picks) View.VISIBLE else View.GONE

        val current = Widgets.settings(this, widgetId)

        val modes = findViewById<RadioGroup>(R.id.wcfg_modes)
        val data = Alerts.last(this)
        if (data == null) AlertJob.runSoon(this, force = true)
        val options = listOf<Pair<String?, String>>(null to getString(R.string.wcfg_all_modes)) +
            data?.modes.orEmpty().map { it.key to it.label }
        for ((key, label) in options) {
            val button = RadioButton(this).apply {
                id = View.generateViewId()
                text = label
                tag = key
                textSize = 15f
                setTextColor(getColor(R.color.foreground))
                buttonTintList = ColorStateList.valueOf(getColor(R.color.brand))
                setPadding(paddingLeft, 14, paddingRight, 14)
            }
            modes.addView(button)
            if (key == current.mode || (key == null && options.none { it.first == current.mode })) {
                modes.check(button.id)
            }
        }

        val reward = findViewById<Switch>(R.id.wcfg_reward)
        reward.isChecked = current.reward

        val opacity = findViewById<RadioGroup>(R.id.wcfg_opacity)
        opacity.check(
            when {
                current.opacity <= 50 -> R.id.wcfg_op50
                current.opacity <= 80 -> R.id.wcfg_op80
                else -> R.id.wcfg_op100
            },
        )

        findViewById<Button>(R.id.wcfg_save).setOnClickListener {
            val chosen = modes.findViewById<RadioButton>(modes.checkedRadioButtonId)?.tag as? String
            val settings = Widgets.Settings(
                mode = chosen,
                reward = reward.isChecked,
                opacity = when (opacity.checkedRadioButtonId) {
                    R.id.wcfg_op50 -> 50
                    R.id.wcfg_op80 -> 80
                    else -> 100
                },
            )
            Widgets.save(this, widgetId, settings)
            Widgets.drawOne(this, widgetId)
            // Fetches the chosen mode's portraits and redraws with them.
            AlertJob.runSoon(this, force = true)
            AlertJob.schedule(this)
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
            finish()
        }
    }

    private fun fitSystemBars() {
        val scroll = findViewById<ScrollView>(R.id.wcfg_scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        scroll.clipToPadding = false
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(Type.systemBars() or Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
    }
}
