package net.brawlzone.bubble

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.content.res.ColorStateList
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import org.json.JSONObject

/**
 * The app screen's four tabs (1.43): Home, Season, Squad, Settings.
 *
 * Before 1.43 the screen was one 17-section scroll, with the squad feed and
 * the friends ladder in the middle of it for everyone, though almost nobody
 * had a friend in the app. Every card kept its id when it moved to a tab, so
 * the code that fills them (MainActivity) is unchanged; this file holds the
 * tab switching and the cards that are new: Play, Today, Last game, the rank
 * row, the Play shortcut offer, insights, teammates, notification switches
 * and the widget list.
 */
internal object Tabs {
    const val HOME = 0
    const val SEASON = 1
    const val SQUAD = 2
    const val SETTINGS = 3
    val PAGES = intArrayOf(R.id.scroll, R.id.scroll_season, R.id.scroll_squad, R.id.scroll_settings)
    val NAV = intArrayOf(R.id.nav_home, R.id.nav_season, R.id.nav_squad, R.id.nav_settings)
    val ICONS = intArrayOf(R.id.nav_home_icon, R.id.nav_season_icon, R.id.nav_squad_icon, R.id.nav_settings_icon)
    val LABELS = intArrayOf(R.id.nav_home_label, R.id.nav_season_label, R.id.nav_squad_label, R.id.nav_settings_label)
    val NAMES = arrayOf("home", "season", "squad", "settings")

    const val PREFS = "brawlzone-home"

    /*
     * Where a notification lands (1.44). Until 1.43 the rank-up, goal, record,
     * season, recap and friend-playing notifications all used the Play
     * shortcut, so a tap started the bubble and opened Brawl Stars instead of
     * the thing the notification was about.
     */
    const val ACTION_OPEN_HOME = "net.brawlzone.bubble.OPEN_HOME"
    const val ACTION_OPEN_SEASON = "net.brawlzone.bubble.OPEN_SEASON"
    const val ACTION_OPEN_SQUAD = "net.brawlzone.bubble.OPEN_SQUAD"

    /** The tab an OPEN_* action asks for, or null for any other intent. */
    fun forAction(action: String?): Int? = when (action) {
        ACTION_OPEN_HOME -> HOME
        ACTION_OPEN_SEASON -> SEASON
        ACTION_OPEN_SQUAD -> SQUAD
        else -> null
    }
    const val KEY_PIN_DONE = "pin_done"
    const val KEY_ADS_OFFER_UNTIL = "ads_offer_until"
}

/** Shows one page and lights its tab. */
internal fun MainActivity.paintTabs(selected: Int) {
    for (i in Tabs.PAGES.indices) {
        findViewById<View>(Tabs.PAGES[i]).visibility = if (i == selected) View.VISIBLE else View.GONE
        val on = i == selected
        val color = getColor(if (on) R.color.brand else R.color.muted)
        findViewById<ImageView>(Tabs.ICONS[i]).imageTintList = ColorStateList.valueOf(color)
        findViewById<TextView>(Tabs.LABELS[i]).setTextColor(color)
        findViewById<View>(Tabs.NAV[i]).isSelected = on
    }
}

// ------------------------------------------------------------------ Home

internal fun MainActivity.paintHome() {
    val me = Me.last(this)
    val tag = Account.tag(this)
    findViewById<TextView>(R.id.home_greeting).text = when {
        tag.isNotEmpty() && me != null && me.rank != null -> getString(R.string.home_hi_rank, me.name, me.rank)
        tag.isNotEmpty() && me != null -> getString(R.string.home_hi, me.name)
        else -> getString(R.string.tagline_short)
    }
    findViewById<View>(R.id.first_run).visibility = if (Welcome.wasBubbleUsed(this)) View.GONE else View.VISIBLE
    paintToday(tag)
    paintHomeFight()
    paintPassCard()
    paintLastGame(me, tag)
    paintHomeRank(me, tag)
    paintPin()
    paintAdsOffer()
}

private fun MainActivity.colored(text: String, color: Int): CharSequence =
    SpannableStringBuilder(text).apply { setSpan(ForegroundColorSpan(color), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }

/**
 * Bubble Pass on Home (1.43): the week's legendary ring turning around the
 * player's bubble, the tier, the bar to the next one and what is left.
 */
private fun MainActivity.paintPassCard() {
    val card = findViewById<View>(R.id.pass_card)
    val week = Pass.week(this)
    if (week == null) {
        card.visibility = View.GONE
        findViewById<View>(R.id.pass_card_quests).visibility = View.GONE
        return
    }
    card.visibility = View.VISIBLE
    val holder = findViewById<android.widget.FrameLayout>(R.id.pass_card_ring)
    if (holder.tag != week.legendary.id) {
        holder.removeAllViews()
        holder.addView(Rings.preview(this, week.legendary, (40 * resources.displayMetrics.density).toInt(), spin = true))
        holder.tag = week.legendary.id
    }
    findViewById<TextView>(R.id.pass_card_tier).text =
        if (week.left == 0) getString(R.string.pass_card_done, week.tier)
        else getString(R.string.pass_card_tier, week.tier, week.left)
    findViewById<ProgressBar>(R.id.pass_card_bar).progress =
        if (week.tier >= Pass.TIERS) 100 else week.xpInTier * 100 / Pass.XP_PER_TIER
    findViewById<TextView>(R.id.pass_card_line).text =
        getString(R.string.pass_card_line, getString(week.legendary.name), Pass.resetsOn(this, week))
    paintPassQuests(week)
    card.setOnClickListener { startActivity(Intent(this, PassActivity::class.java)) }
}

/** The ring row under the bubble look (1.43): what the bubble wears; the pass picks it. */
internal fun MainActivity.paintRingRow() {
    val row = findViewById<TextView>(R.id.look_ring)
    val ring = Rings.byId(BubbleLook.ring(this))
    row.text = getString(R.string.look_ring, ring?.let { getString(it.name) } ?: getString(R.string.ring_none))
    row.setOnClickListener { startActivity(Intent(this, PassActivity::class.java)) }
}

/** Today: Ranked wins–losses on this phone, elo moved since the day began, the daily goal. */
private fun MainActivity.paintToday(tag: String) {
    val caption = findViewById<View>(R.id.today_caption)
    val row = findViewById<View>(R.id.today_row)
    if (tag.isEmpty()) {
        caption.visibility = View.GONE
        row.visibility = View.GONE
        return
    }
    caption.visibility = View.VISIBLE
    row.visibility = View.VISIBLE
    val session = Review.session(this)
    val record = findViewById<TextView>(R.id.today_record)
    if (session == null) {
        record.text = "0–0"
    } else {
        record.text = SpannableStringBuilder()
            .append(colored(session.wins.toString(), getColor(R.color.victory)))
            .append("–")
            .append(colored(session.losses.toString(), 0xFFFF7A8C.toInt()))
    }
    val elo = findViewById<TextView>(R.id.today_elo)
    val moved = session?.elo
    elo.text = when {
        moved == null -> "–"
        moved > 0 -> "+$moved"
        moved < 0 -> "−${-moved}"
        else -> "0"
    }
    elo.setTextColor(
        when {
            moved == null || moved == 0 -> getColor(R.color.foreground)
            moved > 0 -> getColor(R.color.victory)
            else -> 0xFFFF7A8C.toInt()
        },
    )
    val goal = Goal.goal(this)
    val wins = Goal.todayWins(this, tag)
    val goalText = findViewById<TextView>(R.id.today_goal)
    val bar = findViewById<ProgressBar>(R.id.today_goal_bar)
    if (goal > 0) {
        goalText.text = "${wins.coerceAtMost(goal)}/$goal"
        bar.visibility = View.VISIBLE
        bar.progress = (wins.coerceAtMost(goal) * 100 / goal)
    } else {
        goalText.text = getString(R.string.goal_off)
        bar.visibility = View.GONE
    }
}

/**
 * The newest Ranked game the bubble reviewed, if it was today or yesterday;
 * otherwise today's newest game from the phone's own list, without a review.
 */
private fun MainActivity.paintLastGame(me: Me.Data?, tag: String) {
    val card = findViewById<View>(R.id.last_card)
    if (tag.isEmpty()) {
        card.visibility = View.GONE
        return
    }
    val game = Review.lastGame(this)
    val gameAt = game?.optString("battleTime")?.let { Tally.time(it) }
    val dayMs = 24L * 60 * 60 * 1000
    val time = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(AppLang.locale(AppLang.current(this)))
    fun clock(at: Long) = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).format(time)
    val result = findViewById<TextView>(R.id.last_result)
    val review = findViewById<View>(R.id.last_review)
    val line = findViewById<TextView>(R.id.last_line)

    if (game != null && gameAt != null && System.currentTimeMillis() - gameAt < dayMs) {
        card.visibility = View.VISIBLE
        val won = game.optString("result") == "victory"
        findViewById<TextView>(R.id.last_caption).text = getString(R.string.last_caption, clock(gameAt)).uppercase()
        val elo = if (game.isNull("eloChange")) null else game.optInt("eloChange")
        val word = getString(if (won) R.string.last_victory else R.string.last_defeat)
        result.text = when {
            elo == null -> word
            elo >= 0 -> "$word +$elo"
            else -> "$word −${-elo}"
        }
        result.setTextColor(if (won) getColor(R.color.victory) else 0xFFFF7A8C.toInt())
        val mode = game.optString("mode").takeIf { it.isNotEmpty() && it != "null" }
        val modeName = mode?.let { me?.modes?.get(it) ?: me?.modes?.get(it.lowercase()) }
        val map = game.optString("mapName").takeIf { it.isNotEmpty() && it != "null" }
        findViewById<TextView>(R.id.last_map).text = listOfNotNull(map, modeName).joinToString(" · ")
        val verdict = when (game.optString("verdict")) {
            "draftWon" -> R.string.last_v_draftWon
            "upset" -> R.string.last_v_upset
            "even" -> R.string.last_v_even
            "draftLost" -> R.string.last_v_draftLost
            "playLost" -> R.string.last_v_playLost
            else -> null
        }
        line.visibility = if (verdict != null) View.VISIBLE else View.GONE
        if (verdict != null) line.setText(verdict)
        review.visibility = View.VISIBLE
        review.setOnClickListener {
            Stats.event(this, "app_last_review")
            if (Shortcuts.startBubble(this, null)) {
                runCatching {
                    startService(
                        Intent(this, BubbleService::class.java)
                            .setAction(BubbleService.ACTION_SHOW_REVIEW)
                            .putExtra(BubbleService.EXTRA_TEXT, game.toString()),
                    )
                }
                moveTaskToBack(true)
            } else {
                Toast.makeText(this, R.string.status_perm, Toast.LENGTH_SHORT).show()
            }
        }
    } else {
        val newest = Tally.battles(this, tag).maxByOrNull { it.at }
        if (newest == null || System.currentTimeMillis() - newest.at >= dayMs) {
            card.visibility = View.GONE
            return
        }
        card.visibility = View.VISIBLE
        findViewById<TextView>(R.id.last_caption).text = getString(R.string.last_caption, clock(newest.at)).uppercase()
        result.text = getString(if (newest.win) R.string.last_victory else R.string.last_defeat)
        result.setTextColor(if (newest.win) getColor(R.color.victory) else 0xFFFF7A8C.toInt())
        val modeName = newest.mode?.let { me?.modes?.get(it) }
        findViewById<TextView>(R.id.last_map).text = listOfNotNull(newest.brawler, modeName).joinToString(" · ")
        line.visibility = View.GONE
        review.visibility = View.GONE
    }
    findViewById<View>(R.id.last_history).setOnClickListener {
        Stats.event(this, "app_last_history")
        if (Shortcuts.startBubble(this, "history")) moveTaskToBack(true)
        else Toast.makeText(this, R.string.status_perm, Toast.LENGTH_SHORT).show()
    }
}

/** The rank in one row; the full season is a tab away. */
private fun MainActivity.paintHomeRank(me: Me.Data?, tag: String) {
    val card = findViewById<View>(R.id.home_rank)
    if (tag.isEmpty() || me == null || me.rank == null) {
        card.visibility = View.GONE
        return
    }
    card.visibility = View.VISIBLE
    val fmt = java.text.NumberFormat.getIntegerInstance()
    findViewById<TextView>(R.id.home_rank_name).text = me.rank
    findViewById<TextView>(R.id.home_rank_elo).text = me.elo?.let { fmt.format(it) } ?: ""
    findViewById<ProgressBar>(R.id.home_rank_bar).progress = ((me.share ?: 1.0) * 100).toInt().coerceIn(0, 100)
    findViewById<TextView>(R.id.home_rank_next).text = when {
        me.next == null -> getString(R.string.widget_rank_top)
        me.winsToNext != null && me.winsToNext >= 2 -> getString(R.string.widget_rank_wins, me.winsToNext, me.next)
        me.toNext != null -> getString(R.string.widget_rank_elo_to, fmt.format(me.toNext), me.next)
        else -> ""
    }
    val badge = findViewById<ImageView>(R.id.home_rank_badge)
    val app = applicationContext
    Thread {
        val bitmap = Widgets.badge(app, me.rankIcon)
        runOnUiThread { if (bitmap != null && !isDestroyed) badge.setImageBitmap(bitmap) }
    }.start()
    card.setOnClickListener { selectTab(Tabs.SEASON) }
}

/**
 * After the bubble has been used once: offer "Play with Bubble" as a home
 * screen icon, which starts the bubble and opens the game in one tap. Asked
 * once; "Not now" or a pin both end it.
 */
private fun MainActivity.paintPin() {
    val card = findViewById<View>(R.id.pin_card)
    val prefs = getSharedPreferences(Tabs.PREFS, android.content.Context.MODE_PRIVATE)
    val show = Welcome.wasBubbleUsed(this) &&
        !prefs.getBoolean(Tabs.KEY_PIN_DONE, false) &&
        ShortcutManagerCompat.isRequestPinShortcutSupported(this)
    card.visibility = if (show) View.VISIBLE else View.GONE
    if (!show) return
    findViewById<View>(R.id.pin_later).setOnClickListener {
        prefs.edit().putBoolean(Tabs.KEY_PIN_DONE, true).apply()
        card.visibility = View.GONE
        Stats.event(this, "app_pin", mapOf("ok" to false))
    }
    findViewById<View>(R.id.pin_add).setOnClickListener {
        val info = ShortcutInfoCompat.Builder(this, "play_pinned")
            .setShortLabel(getString(R.string.pin_label))
            .setIcon(IconCompat.createWithResource(this, R.drawable.shortcut_bubble))
            .setIntent(Intent(this, MainActivity::class.java).setAction(Shortcuts.ACTION_PLAY))
            .build()
        runCatching { ShortcutManagerCompat.requestPinShortcut(this, info, null) }
        prefs.edit().putBoolean(Tabs.KEY_PIN_DONE, true).apply()
        card.visibility = View.GONE
        Stats.event(this, "app_pin", mapOf("ok" to true))
    }
}

/**
 * "Remove ads forever" on Home (1.46, Play build): once the banner has shown
 * on three different days, so a first visit is not greeted by a sales card.
 * "Not now" puts it away for two weeks; buying puts it away for good.
 */
internal fun MainActivity.paintAdsOffer() {
    val card = findViewById<View>(R.id.ads_offer) ?: return
    val prefs = getSharedPreferences(Tabs.PREFS, android.content.Context.MODE_PRIVATE)
    // The test build offers it from the first day, so it can be looked at straight away.
    val days = if (BuildConfig.BUILD_TYPE == "qa") 1 else 3
    val show = Ads.SOLD && !Ads.removed(this) && Ads.adDays(this) >= days &&
        System.currentTimeMillis() >= prefs.getLong(Tabs.KEY_ADS_OFFER_UNTIL, 0L)
    card.visibility = if (show) View.VISIBLE else View.GONE
    if (!show) return
    val holder = findViewById<android.widget.FrameLayout>(R.id.ads_offer_ring)
    if (holder.childCount == 0) {
        holder.addView(Rings.preview(this, Rings.SUPPORTER, (40 * resources.displayMetrics.density).toInt(), spin = true))
    }
    val price = Ads.price()
    findViewById<TextView>(R.id.ads_offer_body).text =
        if (price != null) getString(R.string.ads_offer_body, price) else getString(R.string.ads_offer_body_noprice)
    findViewById<View>(R.id.ads_offer_later).setOnClickListener {
        prefs.edit().putLong(Tabs.KEY_ADS_OFFER_UNTIL, System.currentTimeMillis() + 14L * 24 * 60 * 60 * 1000).apply()
        card.visibility = View.GONE
    }
    findViewById<View>(R.id.ads_offer_buy).setOnClickListener { Ads.buy(this) }
}

// ------------------------------------------------------------------ Season

internal fun MainActivity.paintSeasonPage() {
    val tag = Account.tag(this)
    findViewById<View>(R.id.season_empty).visibility = if (tag.isEmpty()) View.VISIBLE else View.GONE
    paintInsights(tag)
    paintSeasonPages()
    // The phone's own reading of the running season sits under the site's numbers.
    findViewById<View>(R.id.season_insights).visibility =
        if (tag.isNotEmpty() && SeasonPages.page == SeasonPages.STATS && SeasonPages.which == SeasonPages.NOW) View.VISIBLE else View.GONE
}

private fun MainActivity.paintInsights(tag: String) {
    val caption = findViewById<View>(R.id.insights_caption)
    val card = findViewById<View>(R.id.insights_card)
    if (tag.isEmpty()) {
        caption.visibility = View.GONE
        card.visibility = View.GONE
        return
    }
    caption.visibility = View.VISIBLE
    card.visibility = View.VISIBLE
    val read = Insights.read(this, tag)
    val rows = findViewById<LinearLayout>(R.id.insights_rows)
    rows.removeAllViews()
    val note = findViewById<TextView>(R.id.insights_note)
    val density = resources.displayMetrics.density
    fun add(icon: String, text: String) {
        val view = TextView(this).apply {
            this.text = "$icon  $text"
            setTextColor(getColor(R.color.foreground))
            textSize = 14f
            setPadding(0, (5 * density).toInt(), 0, (5 * density).toInt())
        }
        rows.addView(view)
    }
    if (read.lines.isEmpty()) {
        add("⏳", if (read.games < Insights.MIN_GAMES) getString(R.string.ins_empty, Insights.MIN_GAMES - read.games) else getString(R.string.ins_flat))
        note.visibility = View.GONE
        return
    }
    val modes = Me.last(this)?.modes.orEmpty()
    for (line in read.lines) {
        when (line) {
            is Insights.Line.Hours -> add(
                if (line.best) "⏰" else "🌙",
                getString(
                    if (line.best) R.string.ins_time_best else R.string.ins_time_worst,
                    Insights.hour(this, line.from), Insights.hour(this, line.to), line.pct,
                ),
            )
            is Insights.Line.Brawler -> add(
                if (line.up) "📈" else "📉",
                getString(if (line.up) R.string.ins_brawler_up else R.string.ins_brawler_down, line.name, line.pct, line.games),
            )
            is Insights.Line.Mode -> add("🏆", getString(R.string.ins_mode, modes[line.key] ?: line.key, line.pct))
        }
    }
    note.visibility = View.VISIBLE
    note.text = getString(R.string.ins_note, read.games)
}

// ------------------------------------------------------------------ Squad

/** After paintFriends: the empty state, the feed only with friends, and teammates to add. */
internal fun MainActivity.paintSquad() {
    val tag = Account.tag(this)
    findViewById<View>(R.id.squad_no_tag).visibility = if (tag.isEmpty()) View.VISIBLE else View.GONE
    val hasFriends = Friends.tags(this).isNotEmpty()
    findViewById<View>(R.id.squad_empty_head).visibility = if (tag.isNotEmpty() && !hasFriends) View.VISIBLE else View.GONE
    paintSquadTable()
    paintMates()
    if (tag.isNotEmpty() && Teammates.isStale(this) && Friends.tags(this).size < Friends.max(this)) {
        val app = applicationContext
        Thread {
            Teammates.fetch(app)
            runOnUiThread { if (!isFinishing && !isDestroyed) paintMates() }
        }.start()
    }
}

private fun MainActivity.paintMates() {
    val caption = findViewById<View>(R.id.mates_caption)
    val card = findViewById<View>(R.id.mates_card)
    val mates = if (Account.tag(this).isEmpty() || Friends.tags(this).size >= Friends.max(this)) emptyList() else Teammates.last(this)
    if (mates.isEmpty()) {
        caption.visibility = View.GONE
        card.visibility = View.GONE
        return
    }
    caption.visibility = View.VISIBLE
    card.visibility = View.VISIBLE
    val rows = findViewById<LinearLayout>(R.id.mates_rows)
    rows.removeAllViews()
    val density = resources.displayMetrics.density
    fun px(dp: Int) = (dp * density).toInt()
    val app = applicationContext
    for (mate in mates) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, px(8), 0, px(8))
        }
        val icon = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(px(40), px(40))
            setBackgroundResource(R.drawable.avatar_frame)
            setPadding(px(2), px(2), px(2), px(2))
        }
        row.addView(icon)
        val text = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = px(12) }
        }
        text.addView(TextView(this).apply {
            this.text = mate.name
            setTextColor(getColor(R.color.foreground))
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        text.addView(TextView(this).apply {
            this.text = getString(R.string.mates_line, mate.games, mate.wins)
            setTextColor(getColor(R.color.muted))
            textSize = 12f
        })
        row.addView(text)
        val add = TextView(this).apply {
            this.text = getString(R.string.mates_add)
            setBackgroundResource(R.drawable.btn_outline)
            setTextColor(getColor(R.color.foreground))
            textSize = 13f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(px(14), px(8), px(14), px(9))
        }
        add.setOnClickListener {
            add.isEnabled = false
            add.text = getString(R.string.friends_checking)
            Thread {
                val result = Friends.add(app, mate.tag)
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    val message = when (result) {
                        Friends.AddResult.ADDED -> null
                        Friends.AddResult.NOT_FOUND -> getString(R.string.friends_not_found)
                        Friends.AddResult.FULL -> getString(R.string.friends_full, Friends.max(this))
                        Friends.AddResult.ALREADY -> getString(R.string.friends_already)
                        Friends.AddResult.FAILED -> getString(R.string.friends_failed)
                    }
                    if (message != null) {
                        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
                        add.isEnabled = true
                        add.text = getString(R.string.mates_add)
                        return@runOnUiThread
                    }
                    Stats.event(this, "app_friend_add", mapOf("from" to "teammates"))
                    refreshAfterFriends()
                    Thread { Widgets.updateAll(app) }.start()
                }
            }.start()
        }
        row.addView(add)
        rows.addView(row)
        gameType(row)
        Thread {
            Widgets.badge(app, mate.icon)?.let { bitmap -> runOnUiThread { if (!isDestroyed) icon.setImageBitmap(bitmap) } }
        }.start()
    }
}

// ------------------------------------------------------------------ Settings

/** One switch per kind of notification, quiet hours and the daily limit (NotifyPrefs). */
internal fun MainActivity.wireNotifications() {
    val kinds = listOf(
        R.id.notif_rewards to NotifyPrefs.Kind.REWARDS,
        R.id.notif_season to NotifyPrefs.Kind.SEASON,
        R.id.notif_patch to NotifyPrefs.Kind.PATCH,
        R.id.notif_progress to NotifyPrefs.Kind.PROGRESS,
        R.id.notif_friends to NotifyPrefs.Kind.FRIENDS,
    )
    for ((id, kind) in kinds) {
        val s = findViewById<Switch>(id)
        s.isChecked = NotifyPrefs.on(this, kind)
        s.setOnCheckedChangeListener { _, on ->
            NotifyPrefs.set(this, kind, on)
            Stats.event(this, "app_notify_setting", mapOf("kind" to kind.name.lowercase(), "on" to on))
        }
    }
    findViewById<Switch>(R.id.notif_quiet).apply {
        isChecked = NotifyPrefs.quietHours(this@wireNotifications)
        setOnCheckedChangeListener { _, on -> NotifyPrefs.setQuietHours(this@wireNotifications, on) }
    }
    findViewById<Switch>(R.id.notif_limit).apply {
        isChecked = NotifyPrefs.dailyLimit(this@wireNotifications)
        setOnCheckedChangeListener { _, on -> NotifyPrefs.setDailyLimit(this@wireNotifications, on) }
    }
    paintNotificationRows()
    findViewById<Switch>(R.id.alerts_switch).setOnCheckedChangeListener { _, on ->
        Alerts.setEnabled(this, on)
        paintNotificationRows()
        if (on) requestNotifications()
    }
}

/** The kinds dim while "All notifications" is off. */
private fun MainActivity.paintNotificationRows() {
    val all = Alerts.enabled(this)
    for (id in listOf(R.id.notif_rewards, R.id.notif_season, R.id.notif_patch, R.id.notif_progress, R.id.notif_friends, R.id.notif_quiet, R.id.notif_limit)) {
        findViewById<Switch>(id).isEnabled = all
        (findViewById<View>(id).parent as? View)?.alpha = if (all) 1f else 0.45f
    }
}

/** Every widget, with Android's own "add this widget?" sheet behind each Add. */
internal fun MainActivity.paintWidgets() {
    val rows = findViewById<LinearLayout>(R.id.widgets_rows)
    rows.removeAllViews()
    val manager = AppWidgetManager.getInstance(this)
    val canPin = manager.isRequestPinAppWidgetSupported
    val density = resources.displayMetrics.density
    fun px(dp: Int) = (dp * density).toInt()
    val list = listOf(
        R.string.widget_rank_name to RankWidget::class.java,
        R.string.widget_goal_name to GoalWidget::class.java,
        R.string.widget_meta_name to MetaWidget::class.java,
        R.string.widget_name to RewardsWidget::class.java,
        R.string.widget_small_name to SmallRewardWidget::class.java,
        R.string.widget_trophies_name to TrophiesWidget::class.java,
        R.string.widget_friends_name to FriendsWidget::class.java,
        R.string.widget_ask_name to AskWidget::class.java,
    )
    for ((label, provider) in list) {
        val have = runCatching { manager.getAppWidgetIds(ComponentName(this, provider)).isNotEmpty() }.getOrDefault(false)
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, px(9), 0, px(9))
        }
        row.addView(TextView(this).apply {
            setText(label)
            setTextColor(getColor(R.color.foreground))
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        val button = TextView(this).apply {
            text = getString(if (have) R.string.widgets_added else R.string.widgets_add)
            setTextColor(getColor(if (have) R.color.victory else R.color.foreground))
            textSize = 13f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            if (!have && canPin) setBackgroundResource(R.drawable.btn_outline)
            setPadding(px(14), px(7), px(14), px(8))
        }
        if (!have && canPin) {
            button.setOnClickListener {
                runCatching { manager.requestPinAppWidget(ComponentName(this, provider), null, null) }
                Stats.event(this, "app_widget_add", mapOf("widget" to provider.simpleName))
            }
        } else if (!canPin) {
            button.text = ""
        }
        row.addView(button)
        rows.addView(row)
    }
    if (!canPin) {
        rows.addView(TextView(this).apply {
            setText(R.string.widgets_hint)
            setTextColor(getColor(R.color.muted))
            textSize = 12f
            setPadding(0, px(6), 0, 0)
        })
    }
    // Lilita One on the new labels, like the rest of the screen.
    gameType(rows)
}
