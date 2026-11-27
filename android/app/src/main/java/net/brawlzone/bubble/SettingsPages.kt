package net.brawlzone.bubble

import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import net.brawlzone.bubble.Ui.grow

/**
 * Settings as a short menu (1.45): Account, Notifications, Bubble look,
 * Widgets and App each open on their own, instead of one long page with a
 * dozen switches. The cards are the same views in the same order; a group is
 * what stands between one heading and the next, shown or hidden together.
 */
internal object SettingsPages {
    val CAPTIONS = intArrayOf(
        R.id.settings_account_caption, R.id.settings_alerts_caption, R.id.settings_look_caption,
        R.id.settings_widgets_caption, R.id.settings_app_caption,
    )
    val NAMES = arrayOf("account", "alerts", "look", "widgets", "app")
    val ICONS = arrayOf("👤", "🔔", "🫧", "🧱", "🌍")
    const val ACCOUNT = 0

    /** The open group, or -1 for the menu. */
    var open = -1
}

private fun MainActivity.settingsColumn(): LinearLayout = findViewById<TextView>(R.id.settings_title).parent as LinearLayout

/** Each child of the page and the group it belongs to (-1: above the first heading). */
private fun MainActivity.settingsGroups(): List<Pair<View, Int>> {
    val column = settingsColumn()
    var group = -1
    return (0 until column.childCount).map { i ->
        val child = column.getChildAt(i)
        val at = SettingsPages.CAPTIONS.indexOf(child.id)
        if (at >= 0) group = at
        child to group
    }
}

/** What was visible or hidden by its own rules before the groups took over, kept per view. */
private val ownVisibility = java.util.WeakHashMap<View, Int>()

internal fun MainActivity.wireSettingsPages() {
    paintSettingsPages()
    onBackPressedDispatcher.addCallback(
        this,
        object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    findViewById<ScrollView>(R.id.scroll_settings).visibility == View.VISIBLE && SettingsPages.open >= 0 -> openSettingsGroup(-1)
                    else -> {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        },
    )
}

internal fun MainActivity.openSettingsGroup(group: Int) {
    SettingsPages.open = group
    paintSettingsPages()
    findViewById<ScrollView>(R.id.scroll_settings).smoothScrollTo(0, 0)
}

/** Opens the group a view of the Settings page belongs to (Welcome's tips, the tag field). */
internal fun MainActivity.openSettingsGroupOf(target: View) {
    for ((view, group) in settingsGroups()) {
        if (group < 0) continue
        var v: View? = target
        while (v != null && v !== view) v = v.parent as? View
        if (v === view) {
            openSettingsGroup(group)
            return
        }
    }
}

internal fun MainActivity.paintSettingsPages() {
    val open = SettingsPages.open
    for ((view, group) in settingsGroups()) {
        if (group < 0) continue
        // A view its own code hides (the test button) stays hidden when its group opens.
        val hidden = ownVisibility[view] ?: view.visibility.also { ownVisibility[view] = it }
        view.visibility = if (group == open && view.id !in SettingsPages.CAPTIONS) hidden else View.GONE
    }
    val title = findViewById<TextView>(R.id.settings_title)
    title.text = if (open < 0) getString(R.string.tab_settings) else "‹  " + groupTitle(open)
    title.isClickable = open >= 0
    title.setOnClickListener(if (open >= 0) View.OnClickListener { openSettingsGroup(-1) } else null)
    val menu = findViewById<LinearLayout>(R.id.settings_menu)
    menu.removeAllViews()
    menu.visibility = if (open < 0) View.VISIBLE else View.GONE
    if (open >= 0) return
    menu.addView(
        Ui.card(this, 0).apply {
            setPadding(0, 0, 0, 0)
            for (i in SettingsPages.CAPTIONS.indices) {
                if (i > 0) addView(View(this@paintSettingsPages).apply {
                    setBackgroundColor(getColor(R.color.surface_3))
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@paintSettingsPages, 1))
                })
                addView(menuRow(i))
            }
        },
    )
    if (Ads.SOLD) menu.addView(adsCard())
    gameType(menu)
}

/**
 * "Remove ads forever" under the menu (1.46, Play build): the price and a
 * restore, or a thank-you once bought; and the way back to the EU consent
 * message, which Google asks for wherever that message was shown.
 */
private fun MainActivity.adsCard(): View = Ui.card(this, 0).apply {
    setPadding(0, 0, 0, 0)
    (layoutParams as LinearLayout.LayoutParams).topMargin = Ui.px(this@adsCard, 12)
    val rows = mutableListOf<View>()
    if (Ads.removed(this@adsCard)) {
        rows += plainRow("✨", getString(R.string.ads_removed_title), getString(R.string.ads_removed_sub), null)
    } else {
        val price = Ads.price()
        rows += plainRow(
            "⭐",
            getString(R.string.ads_remove_title),
            if (price != null) getString(R.string.ads_remove_price, price) else getString(R.string.ads_remove_once),
        ) { Ads.buy(this@adsCard) }
        rows += plainRow("↺", getString(R.string.ads_restore), "") { Ads.restore(this@adsCard) }
    }
    if (Ads.privacyChoicesNeeded(this@adsCard)) {
        rows += plainRow("🛡️", getString(R.string.ads_privacy), "") { Ads.showPrivacyChoices(this@adsCard) }
    }
    for ((i, row) in rows.withIndex()) {
        if (i > 0) addView(View(this@adsCard).apply {
            setBackgroundColor(getColor(R.color.surface_3))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@adsCard, 1))
        })
        addView(row)
    }
}

/** A row like the menu's own, for things that are not a group. */
private fun MainActivity.plainRow(icon: String, title: String, sub: String, onTap: (() -> Unit)?): View = Ui.row(this, 14).apply {
    minimumHeight = Ui.px(this@plainRow, 60)
    val p = Ui.px(this@plainRow, 16)
    setPadding(p, Ui.px(this@plainRow, 8), p, Ui.px(this@plainRow, 8))
    if (onTap != null) {
        isClickable = true
        isFocusable = true
        setOnClickListener { onTap() }
    }
    addView(
        Ui.text(this@plainRow, icon, 18f).apply {
            gravity = android.view.Gravity.CENTER
            background = Ui.rounded(this@plainRow, getColor(R.color.surface_3), 13, 0)
            layoutParams = LinearLayout.LayoutParams(Ui.px(this@plainRow, 42), Ui.px(this@plainRow, 42))
        },
    )
    addView(
        Ui.column(this@plainRow, 1).apply {
            addView(Ui.text(this@plainRow, title, 15f, bold = true, lines = 2))
            if (sub.isNotEmpty()) addView(Ui.text(this@plainRow, sub, 12.5f, Ui.MUTED, lines = 2))
        }.grow(),
    )
    if (onTap != null) addView(Ui.text(this@plainRow, "›", 22f, getColor(R.color.muted), bold = true))
}

private fun MainActivity.groupTitle(i: Int): String = getString(
    listOf(R.string.account_caption, R.string.alerts_caption, R.string.look_caption, R.string.widgets_caption, R.string.app_caption)[i],
).lowercase(AppLang.locale(AppLang.current(this))).replaceFirstChar { it.titlecase(AppLang.locale(AppLang.current(this))) }

private fun MainActivity.menuRow(i: Int): View = Ui.row(this, 14).apply {
    minimumHeight = Ui.px(this@menuRow, 68)
    val p = Ui.px(this@menuRow, 16)
    setPadding(p, Ui.px(this@menuRow, 8), p, Ui.px(this@menuRow, 8))
    isClickable = true
    isFocusable = true
    setOnClickListener { openSettingsGroup(i) }
    addView(
        Ui.text(this@menuRow, SettingsPages.ICONS[i], 20f).apply {
            gravity = android.view.Gravity.CENTER
            background = Ui.rounded(this@menuRow, getColor(R.color.surface_3), 13, 0)
            layoutParams = LinearLayout.LayoutParams(Ui.px(this@menuRow, 42), Ui.px(this@menuRow, 42))
        },
    )
    addView(
        Ui.column(this@menuRow, 1).apply {
            addView(Ui.text(this@menuRow, groupTitle(i), 16f, bold = true, lines = 1))
            val sub = summary(i)
            if (sub.isNotEmpty()) addView(Ui.text(this@menuRow, sub, 12.5f, Ui.MUTED, lines = 1))
        }.grow(),
    )
    addView(Ui.text(this@menuRow, "›", 22f, getColor(R.color.muted), bold = true))
}

/** One line of what is set in each group, from the settings themselves. */
private fun MainActivity.summary(i: Int): String = when (i) {
    0 -> Account.tag(this).let { tag -> if (tag.isEmpty()) "" else listOfNotNull(Me.last(this)?.name, "#$tag").joinToString(" · ") }
    1 -> {
        val kinds = NotifyPrefs.Kind.values()
        if (!Alerts.enabled(this)) getString(R.string.settings_off) else getString(R.string.settings_on_count, kinds.count { NotifyPrefs.on(this, it) }, kinds.size)
    }
    2 -> Rings.byId(BubbleLook.ring(this))?.let { getString(it.name) } ?: ""
    4 -> "v${BuildConfig.VERSION_NAME}"
    else -> ""
}

// ------------------------------------------------------------- pull and swipe

/** Pull down on any tab to look again (1.45). */
internal fun MainActivity.wireRefresh() {
    val pull = findViewById<SwipeRefreshLayout>(R.id.refresh)
    pull.setColorSchemeColors(getColor(R.color.brand_ink))
    pull.setProgressBackgroundColorSchemeColor(Ui.GOLD)
    // The pages are four scrolling views in one frame: only the open one counts.
    pull.setOnChildScrollUpCallback { _, _ ->
        Tabs.PAGES.map { findViewById<ScrollView>(it) }.firstOrNull { it.visibility == View.VISIBLE }?.canScrollVertically(-1) ?: false
    }
    pull.setOnRefreshListener {
        pullRefresh { pull.isRefreshing = false }
    }
    val density = resources.displayMetrics.density
    seasonSwipe = GestureDetector(
        this,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onFling(from: MotionEvent?, to: MotionEvent, vx: Float, vy: Float): Boolean {
                if (from == null || Account.tag(this@wireRefresh).isEmpty()) return false
                val dx = to.x - from.x
                val dy = to.y - from.y
                if (Math.abs(dx) < 70 * density || Math.abs(dx) < Math.abs(dy) * 1.8f || Math.abs(vx) < 260 * density) return false
                openSeasonPage(SeasonPages.page + if (dx < 0) 1 else -1)
                return false
            }
        },
    )
}
