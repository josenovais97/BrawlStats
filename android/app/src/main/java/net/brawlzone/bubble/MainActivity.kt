package net.brawlzone.bubble

import android.Manifest
import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.graphics.drawable.Icon
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowInsetsCompat.Type

/**
 * The launcher screen, which exists to do one thing: get the overlay permission
 * and start the bubble.
 *
 * Deliberately not a wrapper around the website. brawlzone.net is a good site in
 * a browser and re-hosting it in a WebView would add nothing except a worse back
 * button — the only thing a native app can do that the web cannot is draw over
 * another app, so that is all this does.
 *
 * The screen itself is `activity_main.xml`. It used to be assembled here in
 * Kotlin, which is how it ended up passing raw pixels to `setPadding`: the
 * margins were a third of their intended size on any modern display.
 */
class MainActivity : AppCompatActivity() {

    private companion object {
        const val NOTIFICATIONS = 4210
        private const val KEY_TAB = "tab"
    }


    private lateinit var statusText: TextView
    private lateinit var statusDot: View
    private lateinit var restricted: TextView

    /**
     * Whether the user has been sent to Settings yet.
     *
     * The restricted-settings hint is offered in response to a failure rather
     * than pre-emptively — before an attempt it is noise, and after one it is
     * the only thing on screen that matters.
     */
    private var asked = false

    /** Google Play's update dialog reports back here (1.40, Play build only). */
    private val updateLauncher =
        registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { }

    /** Every string on this screen in the app's language, not the phone's. */
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLang.wrap(newBase))
    }

    /*
     * The language this screen was drawn in. A choice made in the panel while
     * the screen sat in the background is picked up on return.
     */
    private var drawnIn: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 1.42: an invite link, or an install that came from one, waits for
        // the app screen (after the setup, on a first run) to ask about it.
        Invite.fromIntent(intent)?.let { Invite.receive(this, it) }
        Referrer.check(this)
        /*
         * A shortcut, the widget or a season notification asked for the bubble
         * (1.40). When it could start, there is nothing to show here.
         */
        if (Shortcuts.handle(this, intent)) {
            finish()
            return
        }
        // First run: the three-step setup instead of this whole screen.
        if (Onboarding.needed(this)) {
            startActivity(Intent(this, OnboardingActivity::class.java))
            finish()
            return
        }
        setContentView(R.layout.activity_main)
        gameType(findViewById(R.id.root))
        fitSystemBars()
        // 1.43: four tabs over a bottom bar.
        for ((index, id) in Tabs.NAV.withIndex()) findViewById<View>(id).setOnClickListener { selectTab(index) }
        selectTab(savedInstanceState?.getInt(KEY_TAB, Tabs.HOME) ?: Tabs.HOME, track = false)
        Stats.once(this, "app_first_open")

        statusText = findViewById(R.id.status_text)
        statusDot = findViewById(R.id.status_dot)
        restricted = findViewById(R.id.restricted)

        restricted.text = getString(R.string.restricted_title) + "\n\n" +
            getString(R.string.restricted_body)
        drawnIn = AppLang.current(this)

        askForNotifications()

        findViewById<TextView>(R.id.version_chip).text = "BrawlZone Bubble v${BuildConfig.VERSION_NAME}"
        findViewById<TextView>(R.id.footer_link).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://brawlzone.net/bubble")))
        }
        findViewById<TextView>(R.id.privacy_link).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://brawlzone.net/privacy")))
        }

        wireAccount()
        wireLook()
        wireLanguage()
        wireAlerts()
        wireNotifications()
        findViewById<View>(R.id.lang_row).setOnClickListener { showLanguagePicker() }
        findViewById<View>(R.id.season_empty_cta).setOnClickListener { findViewById<View>(R.id.setup_cta).performClick() }
        findViewById<View>(R.id.squad_no_tag_cta).setOnClickListener { findViewById<View>(R.id.setup_cta).performClick() }
        wireFollow()
        wireSeason()
        wireFriends()
        wireVersus()
        // 1.42: a welcome-week tip that lands here (the Friends card, or adding a widget).
        Welcome.handle(this, intent)
        // 1.42: the squad feed, and a reaction notification opening it.
        findViewById<View>(R.id.feed_all).setOnClickListener { startActivity(Intent(this, FeedActivity::class.java)) }
        findViewById<View>(R.id.feed_caption).setOnClickListener { startActivity(Intent(this, FeedActivity::class.java)) }
        if (intent?.action == Feed.ACTION_OPEN) startActivity(Intent(this, FeedActivity::class.java))
        findViewById<View>(R.id.rate_button).setOnClickListener { Rate.open(this) }
        // 1.40: the Season Wrapped notification makes the card straight away.
        if (intent?.action == Share.ACTION_WRAPPED) Share.wrapped(this) { busy -> shareBusy(null, busy) }

        findViewById<TextView>(R.id.update_restart).setOnClickListener { Store.completeUpdate() }
        Shortcuts.publish(this)
        AlertJob.schedule(this)

        findViewById<Button>(R.id.start).setOnClickListener { startBubble() }
        findViewById<Button>(R.id.stop).setOnClickListener {
            stopService(Intent(this, BubbleService::class.java))
            findViewById<View>(R.id.stop).postDelayed({ if (!isDestroyed) paintStatus() }, 300)
        }
        offerTile()
    }

    /**
     * Keeps the screen clear of the status bar, navigation bar, cutouts and
     * keyboard (1.30).
     *
     * Targeting Android 15+ draws every activity edge to edge whether it asks
     * or not, so without this the hero sat under the clock and the last card
     * under the gesture bar. Opting in on every version makes older phones
     * behave the same way rather than keeping two layouts. The padding goes on
     * the scroll view with clipToPadding off, so the page still scrolls under
     * the bars but always comes to rest clear of them; the keyboard takes the
     * bottom when it is up, and the focused field (the tag) is scrolled back
     * into view above it.
     */
    private fun fitSystemBars() {
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        // 1.43: four scrolling pages over a bottom bar. The pages take the top
        // and sides; the bar takes the gesture area; with the keyboard up the
        // bar steps aside and the open page scrolls the field into view.
        val pages = Tabs.PAGES.map { findViewById<android.widget.ScrollView>(it) }
        val nav = findViewById<View>(R.id.bottom_nav)
        for (page in pages) page.clipToPadding = false
        val gap = (16 * resources.displayMetrics.density).toInt()
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { _, insets ->
            val bars = insets.getInsets(Type.systemBars() or Type.displayCutout())
            val ime = insets.getInsets(Type.ime()).bottom
            nav.visibility = if (ime > 0) View.GONE else View.VISIBLE
            nav.setPadding(bars.left, 0, bars.right, bars.bottom)
            for (page in pages) page.setPadding(bars.left, bars.top, bars.right, if (ime > 0) ime else 0)
            if (ime > 0) {
                val scroll = pages.firstOrNull { it.visibility == View.VISIBLE }
                scroll?.findFocus()?.let { focused ->
                    scroll.post {
                        val box = android.graphics.Rect()
                        focused.getDrawingRect(box)
                        scroll.offsetDescendantRectToMyCoords(focused, box)
                        val visibleBottom = scroll.scrollY + scroll.height - scroll.paddingBottom
                        if (box.bottom + gap > visibleBottom) {
                            scroll.smoothScrollBy(0, box.bottom + gap - visibleBottom)
                        }
                    }
                }
            }
            insets
        }
    }

    /**
     * Offers the Quick Settings tile, where Android lets an app do that.
     *
     * The tile is the better Start button — one swipe from inside the game —
     * and nobody finds a tile by scrolling the shade's edit sheet. From API 33
     * `StatusBarManager.requestAddTileService` shows a system dialog asking to
     * add it, which is the one honest way to make the tile discoverable. Below
     * that the button stays hidden and the "how it works" step names it.
     */
    private fun offerTile() {
        val button = findViewById<Button>(R.id.add_tile)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val bar = getSystemService(StatusBarManager::class.java) ?: return
        button.visibility = View.VISIBLE
        button.setOnClickListener {
            bar.requestAddTileService(
                ComponentName(this, BubbleTileService::class.java),
                "BrawlZone",
                Icon.createWithResource(this, R.drawable.ic_bubble_mono),
                mainExecutor,
            ) { result ->
                if (result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED ||
                    result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED
                ) {
                    button.visibility = View.GONE
                }
            }
        }
    }

    /**
     * Asks for notifications, which this app needs more than it looks.
     *
     * Declared in the manifest since the beginning and never actually
     * requested — and on Android 13 and up that means never granted, because it
     * became a runtime permission. Two things break silently as a result, and
     * both were reported as something else:
     *
     * The update download completes and shows nothing. DownloadManager delivers
     * its progress and its "tap to install" through a notification, so with the
     * permission missing the APK lands in Downloads and the reader sees no
     * trace of it — which is indistinguishable from a button that did nothing,
     * and was reported as exactly that.
     *
     * And the bubble's own ongoing notification is hidden, which is where the
     * Stop control lives.
     *
     * Asked here rather than at first download: this screen is the one place
     * the app is in the foreground with the reader's attention, and a
     * permission prompt appearing over a game is the thing this app has spent
     * several releases learning not to do.
     */
    /** For MainTabs (1.43): the notification permission, asked from the Settings tab. */
    internal fun requestNotifications() = askForNotifications()

    private fun askForNotifications() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (granted) return
        runCatching {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATIONS)
        }
    }

    /**
     * Re-read the permission every time the screen comes forward, because the
     * only way it changes is the user leaving for Settings and coming back.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Invite.fromIntent(intent)?.let {
            Invite.receive(this, it)
            askInvite()
            return
        }
        if (intent.action == Share.ACTION_WRAPPED) {
            Share.wrapped(this) { busy -> shareBusy(null, busy) }
            return
        }
        if (Welcome.handle(this, intent)) return
        if (intent.action == Feed.ACTION_OPEN) {
            startActivity(Intent(this, FeedActivity::class.java))
            return
        }
        if (Shortcuts.handle(this, intent)) moveTaskToBack(true)
    }

    override fun onDestroy() {
        Store.release()
        super.onDestroy()
    }

    /**
     * A tag copied in Brawl Stars, offered above an empty tag field (1.40).
     * Android allows reading the clipboard only while the window has focus.
     */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) return
        val chip = findViewById<TextView>(R.id.clip_chip) ?: return
        val field = findViewById<EditText>(R.id.tag) ?: return
        if (Account.tag(this).isNotEmpty() || field.text.isNotBlank()) {
            chip.visibility = View.GONE
            return
        }
        val found = ClipTag.find(this) ?: return
        chip.text = getString(R.string.clip_chip, "#$found")
        chip.visibility = View.VISIBLE
        chip.setOnClickListener {
            field.setText("#$found")
            chip.visibility = View.GONE
        }
    }

    /** Follow BrawlZone (1.40): each button opens the profile in its own app or the browser. */
    private fun wireFollow() {
        val links = mapOf(
            R.id.follow_tiktok to "https://www.tiktok.com/@brawlzone.net",
            // Opens YouTube's subscribe dialog straight away.
            R.id.follow_youtube to "https://www.youtube.com/@brawlzonenet?sub_confirmation=1",
            R.id.follow_instagram to "https://www.instagram.com/brawlzonenet",
            R.id.follow_discord to "https://discord.gg/964EMQBBUJ",
        )
        for ((id, url) in links) {
            findViewById<View>(id)?.setOnClickListener {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            }
        }
    }

    /** One switch for free reward and season notifications (1.40). */
    private fun wireAlerts() {
        val toggle = findViewById<Switch>(R.id.alerts_switch)
        toggle.isChecked = Alerts.enabled(this)
        // The test build only: show every notification now, to check how they look.
        val test = findViewById<TextView>(R.id.alerts_test)
        if (BuildConfig.BUILD_TYPE == "qa") {
            test.visibility = View.VISIBLE
            test.setOnClickListener {
                askForNotifications()
                Thread { Notify.test(applicationContext) }.start()
                // With the bubble up: the newest Ranked game as a post-game review (pulse, badge, panel).
                if (BubbleService.running) {
                    runCatching { startService(Intent(this, BubbleService::class.java).setAction(BubbleService.ACTION_TEST_REVIEW)) }
                }
                android.widget.Toast.makeText(
                    this,
                    if (BubbleService.running) "Sending test notifications and a test post-game review…" else "Sending test notifications… (start the bubble to test the post-game review)",
                    android.widget.Toast.LENGTH_LONG,
                ).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (drawnIn != null && drawnIn != AppLang.current(this)) {
            recreate()
            return
        }
        // Play build: offer a waiting update, and the one-time review ask.
        Store.checkForUpdate(this, updateLauncher) {
            findViewById<View>(R.id.update_card)?.visibility = View.VISIBLE
        }
        Store.maybeAskForReview(this)
        refreshStanding()
        askInvite()
        val granted = paintStatus()
        restricted.visibility = if (!granted && asked) View.VISIBLE else View.GONE
        paintWidgets()
        Stats.opened(this, Account.tag(this).isNotEmpty())
    }

    /**
     * The pill in Home's corner (1.43): the bubble on, off, or waiting for
     * the overlay permission. Returns whether the permission is granted.
     */
    private fun paintStatus(): Boolean {
        val granted =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
        val on = granted && BubbleService.running
        statusText.text = getString(
            when {
                !granted -> R.string.status_perm
                on -> R.string.status_on
                else -> R.string.status_off
            },
        )
        val color = if (on) getColor(R.color.victory) else getColor(R.color.muted)
        statusText.setTextColor(color)
        tintDot(color)
        return granted
    }

    // ---------------------------------------------------------- 1.43: tabs

    private var tab = Tabs.HOME

    /** Shows a tab; counted (anonymously) when a person taps it. */
    internal fun selectTab(index: Int, track: Boolean = true) {
        val next = index.coerceIn(0, Tabs.PAGES.size - 1)
        if (track && next != tab) Stats.event(this, "app_tab", mapOf("tab" to Tabs.NAMES[next]))
        tab = next
        paintTabs(next)
        if (next == Tabs.SQUAD) paintSquad()
    }

    /** The tab holding a view, shown and scrolled to it (Welcome's tips, the tag field). */
    internal fun reveal(id: Int) {
        val target = findViewById<View>(id) ?: return
        var page: View? = target
        while (page != null && page.id !in Tabs.PAGES) page = page.parent as? View
        val index = Tabs.PAGES.indexOf(page?.id ?: return)
        if (index < 0) return
        selectTab(index, track = false)
        val scroll = page as android.widget.ScrollView
        scroll.post {
            val box = android.graphics.Rect()
            target.getDrawingRect(box)
            scroll.offsetDescendantRectToMyCoords(target, box)
            scroll.smoothScrollTo(0, (box.top - (24 * resources.displayMetrics.density).toInt()).coerceAtLeast(0))
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(KEY_TAB, tab)
    }

    /** After a friend is added or removed (1.43: the Squad tab's teammates too). */
    internal fun refreshAfterFriends() {
        paintFriends()
        paintFeed()
    }

    // ---------------------------------------------------------- 1.40: season, goal, friends

    private val standingAfterTag = Runnable { refreshStanding(force = true) }

    /**
     * Draws the season and friends cards from saved answers at once, then
     * again after a fresh check when the saved one is old.
     */
    private fun refreshStanding(force: Boolean = false) {
        paintSeason()
        paintVersus()
        paintFriends()
        paintFeed()
        paintHome()
        paintSeasonPage()
        // 1.42: friends' reactions on the newest posts.
        if (Feed.posts(this).isNotEmpty()) {
            val app = applicationContext
            Thread {
                Feed.syncReactions(app)
                runOnUiThread { if (!isFinishing && !isDestroyed) paintFeed() }
            }.start()
        }
        // 1.42: who is playing now, if the last look is more than a few minutes old.
        if (Friends.tags(this).isNotEmpty() && Online.isStale(this)) {
            val app = applicationContext
            Thread {
                Online.check(app, post = false)
                runOnUiThread { if (!isFinishing && !isDestroyed) paintFriends() }
            }.start()
        }
        if (!force && !AlertJob.isStale(this)) return
        val app = applicationContext
        Thread {
            runCatching { AlertJob.runNow(app) }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                paintSeason()
                paintVersus()
                paintFriends()
                paintFeed()
                paintHome()
                paintSeasonPage()
            }
        }.start()
    }

    /**
     * While a card is being drawn: the tapped button says so, both are
     * disabled, and a bar runs under them until the share sheet opens.
     */
    private fun shareBusy(tapped: TextView?, busy: Boolean) {
        val buttons = listOf(
            findViewById<TextView>(R.id.share_rank) to R.string.share_rank,
            findViewById<TextView>(R.id.share_wrapped) to R.string.share_wrapped,
        )
        for ((button, label) in buttons) {
            button.isEnabled = !busy
            button.alpha = if (busy && button !== tapped) 0.5f else 1f
            button.setText(if (busy && button === tapped) R.string.share_making else label)
        }
        findViewById<View>(R.id.share_progress).visibility = if (busy) View.VISIBLE else View.GONE
        if (busy && tapped == null) {
            android.widget.Toast.makeText(this, R.string.share_making, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun wireSeason() {
        val rank = findViewById<TextView>(R.id.share_rank)
        val wrapped = findViewById<TextView>(R.id.share_wrapped)
        rank.setOnClickListener { Share.rank(this) { busy -> shareBusy(rank, busy) } }
        wrapped.setOnClickListener { Share.wrapped(this) { busy -> shareBusy(wrapped, busy) } }
        // 1.42: today's roast of this account.
        findViewById<TextView>(R.id.roast_me).setOnClickListener { Roast.show(this, Account.tag(this)) }
        // The whole season on brawlzone.net (1.41): the profile's Ranked tab.
        findViewById<TextView>(R.id.open_site_season).setOnClickListener {
            val tag = Account.tag(this)
            if (tag.isEmpty()) return@setOnClickListener
            val lang = AppLang.current(this).lowercase().substringBefore('-')
            val prefix = if (lang in setOf("es", "pt", "tr", "de", "ru", "fr")) "/$lang" else ""
            runCatching {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${Http.SITE}$prefix/player/$tag#ranked")))
            }
        }
        findViewById<View>(R.id.season_goal_row).setOnClickListener {
            val choices = Goal.CHOICES
            val labels = choices.map { if (it == 0) getString(R.string.goal_off) else it.toString() }.toTypedArray()
            val current = choices.indexOf(Goal.goal(this))
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle(R.string.goal_pick_title)
                .setSingleChoiceItems(labels, current) { dialog, which ->
                    Goal.setGoal(this, choices[which])
                    dialog.dismiss()
                    paintSeason()
                    Thread { Widgets.updateAll(applicationContext) }.start()
                }
                .show()
        }
    }

    private fun paintSeason() {
        val caption = findViewById<View>(R.id.season_caption)
        val card = findViewById<View>(R.id.season_card)
        val me = Me.last(this)
        if (me == null || me.rank == null) {
            caption.visibility = View.GONE
            card.visibility = View.GONE
            return
        }
        caption.visibility = View.VISIBLE
        card.visibility = View.VISIBLE
        // Both share cards drawn ahead of a tap, so Share usually opens at once.
        Share.prefetch(this)
        // 1.42: personal records.
        val records = Records.get(this, me.tag)
        findViewById<View>(R.id.season_records).visibility =
            if (records.streak + records.day + records.elo > 0) View.VISIBLE else View.GONE
        fun tile(id: Int, icon: String, value: String, label: Int) {
            val text = android.text.SpannableString("$icon $value\n${getString(label)}")
            text.setSpan(android.text.style.StyleSpan(android.graphics.Typeface.BOLD), 0, icon.length + 1 + value.length, 0)
            text.setSpan(android.text.style.RelativeSizeSpan(1.35f), 0, icon.length + 1 + value.length, 0)
            findViewById<TextView>(id).text = text
        }
        tile(R.id.record_streak_tile, "\uD83D\uDD25", records.streak.toString(), R.string.record_streak)
        tile(R.id.record_day_tile, "\uD83D\uDCC5", records.day.toString(), R.string.record_day)
        tile(R.id.record_elo_tile, "\u2B50", if (records.elo > 0) java.text.NumberFormat.getIntegerInstance().format(records.elo) else "–", R.string.record_elo)
        // 1.42: elo through the season, drawn once the card has its width.
        val graph = findViewById<ImageView>(R.id.season_graph)
        val points = EloLog.points(this, me.tag, Alerts.last(this)?.season?.number)
        val window = EloGraph.window(this, me.tag)
        if (points.size >= 2 && window != null) {
            graph.visibility = View.VISIBLE
            graph.post {
                EloGraph.bitmap(this, graph.width, graph.height, points, window.first, window.second)?.let { graph.setImageBitmap(it) }
            }
        } else {
            graph.visibility = View.GONE
        }
        val fmt = java.text.NumberFormat.getIntegerInstance()
        findViewById<TextView>(R.id.season_rank).text = me.rank
        findViewById<TextView>(R.id.season_elo).text = me.elo?.let { getString(R.string.widget_elo, fmt.format(it)) } ?: ""
        findViewById<android.widget.ProgressBar>(R.id.season_bar).progress =
            ((me.share ?: 1.0) * 100).toInt().coerceIn(0, 100)
        findViewById<TextView>(R.id.season_next).text = when {
            me.next == null -> getString(R.string.widget_rank_top)
            me.winsToNext != null && me.winsToNext >= 2 -> getString(R.string.widget_rank_wins, me.winsToNext, me.next)
            me.toNext != null -> getString(R.string.widget_rank_elo_to, fmt.format(me.toNext), me.next)
            else -> ""
        }
        val badge = findViewById<ImageView>(R.id.season_badge)
        val app = applicationContext
        Thread {
            val bitmap = Widgets.badge(app, me.rankIcon)
            runOnUiThread { if (bitmap != null) badge.setImageBitmap(bitmap) }
        }.start()

        val goal = Goal.goal(this)
        val wins = Goal.todayWins(this, me.tag)
        val streakBox = findViewById<View>(R.id.season_streak_box)
        val count = findViewById<TextView>(R.id.season_goal_count)
        val line = findViewById<TextView>(R.id.season_goal_line)
        if (goal > 0) {
            streakBox.visibility = View.VISIBLE
            findViewById<TextView>(R.id.season_streak).text = "\uD83D\uDD25 " + Goal.streak(this, me.tag)
            count.visibility = View.VISIBLE
            count.text = "${wins.coerceAtMost(goal)}/$goal"
            line.text = if (Goal.doneToday(this, me.tag)) getString(R.string.goal_line_done)
            else getString(R.string.goal_line, goal)
        } else {
            streakBox.visibility = View.GONE
            count.visibility = View.GONE
            line.text = getString(R.string.goal_line_off)
        }

        val stats = Season.current(this, me.tag)
        val number = stats?.number ?: Alerts.last(this)?.season?.number
        val seasonLine = findViewById<TextView>(R.id.season_line)
        seasonLine.text = when {
            number == null -> ""
            stats == null || stats.games == 0 -> getString(R.string.season_line_empty, number)
            stats.best != null -> getString(
                R.string.season_line_best, number, stats.wins, stats.games - stats.wins,
                "${Math.round(stats.wins * 100.0 / stats.games)}%", stats.best,
            )
            else -> getString(
                R.string.season_line, number, stats.wins, stats.games - stats.wins,
                "${Math.round(stats.wins * 100.0 / stats.games)}%",
            )
        }
        seasonLine.visibility = if (seasonLine.text.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun wireFriends() {
        val online = findViewById<Switch>(R.id.friends_online)
        online.isChecked = Online.alerts(this)
        online.setOnCheckedChangeListener { _, on -> Online.setAlerts(this, on) }
        val invite = findViewById<TextView>(R.id.friends_invite)
        invite.setOnClickListener {
            Invite.share(this) { busy ->
                invite.isEnabled = !busy
                invite.setText(if (busy) R.string.invite_making else R.string.invite_button)
            }
        }
        val editor = findViewById<View>(R.id.friends_editor)
        val add = findViewById<TextView>(R.id.friends_add)
        val field = findViewById<EditText>(R.id.friends_field)
        val go = findViewById<TextView>(R.id.friends_go)
        add.setOnClickListener {
            if (Friends.tags(this).size >= Friends.MAX) {
                android.widget.Toast.makeText(this, R.string.friends_full, android.widget.Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            editor.visibility = View.VISIBLE
            add.visibility = View.GONE
            field.requestFocus()
            getSystemService(android.view.inputmethod.InputMethodManager::class.java)
                ?.showSoftInput(field, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
        }
        fun submit() {
            val raw = field.text.toString()
            if (raw.isBlank()) return
            if (!Account.isValid(raw)) {
                android.widget.Toast.makeText(this, R.string.name_pick_friend, android.widget.Toast.LENGTH_SHORT).show()
                return
            }
            go.isEnabled = false
            go.text = getString(R.string.friends_checking)
            val app = applicationContext
            Thread {
                val result = Friends.add(app, raw)
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    go.isEnabled = true
                    go.text = getString(R.string.friends_add_button)
                    val message = when (result) {
                        Friends.AddResult.ADDED -> null
                        Friends.AddResult.NOT_FOUND -> R.string.friends_not_found
                        Friends.AddResult.FULL -> R.string.friends_full
                        Friends.AddResult.ALREADY -> R.string.friends_already
                        Friends.AddResult.FAILED -> R.string.friends_failed
                    }
                    if (message != null) {
                        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show()
                        return@runOnUiThread
                    }
                    field.setText("")
                    editor.visibility = View.GONE
                    add.visibility = View.VISIBLE
                    getSystemService(android.view.inputmethod.InputMethodManager::class.java)
                        ?.hideSoftInputFromWindow(field.windowToken, 0)
                    paintFriends()
                    Thread { Widgets.updateAll(app) }.start()
                }
            }.start()
        }
        // Find by name (1.40): the same search as the tag field; tapping a player adds them.
        val friendSearch = NameSearch(
            this,
            findViewById(R.id.friends_matches),
            onPick = { picked, _ ->
                field.setText("#$picked")
                submit()
            },
            emptyText = getString(R.string.friends_none),
        )
        field.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) {
                val raw = s?.toString().orEmpty()
                if (raw.trim().startsWith("#")) friendSearch.clear() else friendSearch.query(raw)
            }
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })
        go.setOnClickListener { submit() }
        field.setOnEditorActionListener { _, _, _ ->
            submit()
            true
        }
    }

    // ---------------------------------------------------------- 1.42: invites, season vs last

    private var inviteAsking = false

    /** An invite waiting (a link or the install referrer): "add them to your friends?" once. */
    private fun askInvite() {
        val code = Invite.toAsk(this) ?: return
        if (inviteAsking) return
        inviteAsking = true
        val app = applicationContext
        Thread {
            val from = Invite.lookup(app, code)
            runOnUiThread {
                inviteAsking = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                Invite.markAsked(app, code)
                if (from == null || from.tag == Account.tag(app)) {
                    Invite.drop(app)
                    return@runOnUiThread
                }
                val name = from.name ?: "#${from.tag}"
                androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle(getString(R.string.invite_add_title, name))
                    .setMessage(getString(R.string.invite_add_body, name))
                    .setPositiveButton(R.string.invite_add) { _, _ ->
                        Thread {
                            val result = Invite.accept(app, code, from)
                            runOnUiThread {
                                if (isFinishing || isDestroyed) return@runOnUiThread
                                val message = when (result) {
                                    Friends.AddResult.ADDED, Friends.AddResult.ALREADY -> getString(R.string.invite_added, name)
                                    Friends.AddResult.FULL -> getString(R.string.friends_full)
                                    else -> getString(R.string.friends_failed)
                                }
                                android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_LONG).show()
                                paintFriends()
                                Thread { Widgets.updateAll(app) }.start()
                            }
                        }.start()
                    }
                    .setNegativeButton(R.string.invite_later) { _, _ -> Invite.drop(app) }
                    .show()
            }
        }.start()
    }

    private fun wireVersus() {
        val share = findViewById<TextView>(R.id.versus_share)
        share.setOnClickListener {
            Share.versus(this) { busy ->
                share.isEnabled = !busy
                share.setText(if (busy) R.string.share_making else R.string.versus_share)
            }
        }
    }

    /** This season against the last one, once there is a last one to beat. */
    private fun paintVersus() {
        val caption = findViewById<View>(R.id.versus_caption)
        val card = findViewById<View>(R.id.versus_card)
        val data = Versus.last(this)
        if (Account.tag(this).isEmpty() || data == null || !Versus.worthShowing(data)) {
            caption.visibility = View.GONE
            card.visibility = View.GONE
            return
        }
        val last = data.last ?: return
        caption.visibility = View.VISIBLE
        card.visibility = View.VISIBLE
        val density = resources.displayMetrics.density
        val app = applicationContext
        val columns = findViewById<LinearLayout>(R.id.versus_columns)
        columns.removeAllViews()
        fun column(s: Versus.Side, lit: Boolean): View {
            val v = layoutInflater.inflate(R.layout.versus_side, columns, false)
            v.findViewById<TextView>(R.id.versus_season).apply {
                text = getString(R.string.versus_season, s.number)
                setTextColor(getColor(if (lit) R.color.brand else R.color.muted))
            }
            v.findViewById<TextView>(R.id.versus_rank).text = s.peakRank ?: "–"
            v.findViewById<TextView>(R.id.versus_games).text = getString(R.string.versus_games, s.games)
            v.findViewById<TextView>(R.id.versus_rate).text =
                if (s.games > 0) getString(R.string.versus_rate, Math.round(s.wins * 100f / s.games)) else "–"
            v.findViewById<TextView>(R.id.versus_best).apply {
                text = s.best?.let { getString(R.string.versus_best, it) } ?: ""
                visibility = if (s.best == null) View.INVISIBLE else View.VISIBLE
            }
            if (lit) v.setBackgroundResource(R.drawable.chip_active)
            val badge = v.findViewById<ImageView>(R.id.versus_badge)
            Thread {
                val bitmap = Widgets.badge(app, s.peakIcon)
                runOnUiThread { if (bitmap != null) badge.setImageBitmap(bitmap) }
            }.start()
            return v
        }
        columns.addView(column(last, false))
        columns.addView(TextView(this).apply {
            text = "VS"
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(getColor(R.color.brand))
            val pad = (8 * density).toInt()
            setPadding(pad, 0, pad, 0)
        })
        columns.addView(column(data.now, true))
        findViewById<TextView>(R.id.versus_verdict).text = when {
            data.now.peak >= 0 && last.peak >= 0 && data.now.peak > last.peak -> getString(R.string.versus_new_best)
            data.now.peak >= 0 && data.now.peak == last.peak -> getString(R.string.versus_level)
            data.now.peak >= 0 && last.peakRank != null -> getString(R.string.versus_pass, last.peakRank)
            last.peakRank != null -> getString(R.string.versus_challenge, last.peakRank)
            else -> ""
        }
        gameType(card)
    }

    /** The squad feed's newest three posts (1.42); the rest are a tap away. */
    private fun paintFeed() {
        val caption = findViewById<TextView>(R.id.feed_caption)
        val box = findViewById<LinearLayout>(R.id.feed_box)
        // 1.43: the feed lives on the Squad tab and shows once a friend is in.
        if (Account.tag(this).isEmpty() || Friends.tags(this).isEmpty()) {
            caption.visibility = View.GONE
            box.visibility = View.GONE
            return
        }
        caption.visibility = View.VISIBLE
        box.visibility = View.VISIBLE
        val fresh = Feed.unseen(this)
        caption.text = getString(R.string.feed_caption) +
            if (fresh > 0) "  \u00B7  " + getString(R.string.feed_new, fresh).uppercase() else ""
        caption.setTextColor(getColor(if (fresh > 0) R.color.brand else R.color.muted))
        val rows = findViewById<LinearLayout>(R.id.feed_rows)
        rows.removeAllViews()
        val posts = Feed.posts(this)
        for (post in posts.take(3)) rows.addView(FeedView.inflate(this, rows, post))
        findViewById<View>(R.id.feed_empty).visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
        findViewById<View>(R.id.feed_all).visibility = if (posts.size > 3) View.VISIBLE else View.GONE
    }

    private fun paintFriends() {
        paintSquad()
        val caption = findViewById<View>(R.id.friends_caption)
        val card = findViewById<View>(R.id.friends_card)
        if (Account.tag(this).isEmpty()) {
            caption.visibility = View.GONE
            card.visibility = View.GONE
            return
        }
        caption.visibility = View.VISIBLE
        card.visibility = View.VISIBLE
        val rows = findViewById<LinearLayout>(R.id.friends_rows)
        rows.removeAllViews()
        val ladder = Friends.ladder(this)
        val hasFriends = ladder.any { !it.you }
        findViewById<View>(R.id.friends_body).visibility = if (hasFriends) View.GONE else View.VISIBLE
        // 1.43: no caption over the empty state, which has its own title.
        caption.visibility = if (hasFriends) View.VISIBLE else View.GONE
        if (!hasFriends) findViewById<TextView>(R.id.friends_body).setText(R.string.squad_body)
        findViewById<View>(R.id.friends_remove_hint).visibility = if (hasFriends) View.VISIBLE else View.GONE
        findViewById<View>(R.id.friends_add).visibility =
            if (Friends.tags(this).size >= Friends.MAX) View.GONE
            else if (findViewById<View>(R.id.friends_editor).visibility == View.VISIBLE) View.GONE
            else View.VISIBLE
        // 1.42: invite while there is room; the weekly duel once there are friends.
        findViewById<View>(R.id.friends_invite).visibility =
            if (Friends.tags(this).size >= Friends.MAX) View.GONE else View.VISIBLE
        val duel = findViewById<TextView>(R.id.friends_duel)
        val week = if (hasFriends) Duel.thisWeek(this) else emptyList()
        duel.visibility = if (hasFriends) View.VISIBLE else View.GONE
        if (hasFriends) duel.text = getString(R.string.duel_week, Duel.line(this, week))
        val crown = Duel.leader(week)
        findViewById<View>(R.id.friends_online).visibility = if (hasFriends) View.VISIBLE else View.GONE
        if (!hasFriends) return
        val fmt = java.text.NumberFormat.getIntegerInstance()
        val app = applicationContext
        for ((index, row) in ladder.withIndex()) {
            val view = layoutInflater.inflate(R.layout.row_friend, rows, false)
            view.findViewById<TextView>(R.id.friend_pos).text = (index + 1).toString()
            val name = view.findViewById<TextView>(R.id.friend_name)
            name.text = (if (row.data.tag == crown) "\uD83D\uDC51 " else "") +
                if (row.you) getString(R.string.friends_you, row.data.name) else row.data.name
            if (row.you) name.setTextColor(getColor(R.color.brand))
            view.findViewById<TextView>(R.id.friend_rank).text = row.data.rank ?: ""
            view.findViewById<TextView>(R.id.friend_elo).text = row.data.elo?.let { fmt.format(it) } ?: "–"
            // 1.42: a game in the last 20 minutes beats the week's record on the right.
            val playing = !row.you && Online.playingNow(this, row.data.tag)
            view.findViewById<TextView>(R.id.friend_week).apply {
                text = when {
                    playing -> getString(R.string.online_now)
                    row.weekWins + row.weekLosses > 0 -> getString(R.string.friends_week, row.weekWins, row.weekLosses)
                    else -> ""
                }
                if (playing) {
                    setTextColor(getColor(R.color.victory))
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }
            }
            val badge = view.findViewById<ImageView>(R.id.friend_badge)
            Thread {
                val bitmap = Widgets.badge(app, row.data.rankIcon)
                runOnUiThread { if (bitmap != null) badge.setImageBitmap(bitmap) }
            }.start()
            if (!row.you) {
                // 1.42: the flame (or a tap on the row) roasts the friend.
                val roast = view.findViewById<TextView>(R.id.friend_roast)
                roast.visibility = View.VISIBLE
                roast.contentDescription = getString(R.string.roast_friend, row.data.name)
                roast.setOnClickListener { Roast.show(this, row.data.tag) }
                view.setOnClickListener { Roast.show(this, row.data.tag) }
                view.setOnLongClickListener {
                    androidx.appcompat.app.AlertDialog.Builder(this)
                        .setMessage(getString(R.string.friends_remove_confirm, row.data.name))
                        .setPositiveButton(R.string.friends_remove) { _, _ ->
                            Friends.remove(this, row.data.tag)
                            paintFriends()
                            Thread { Widgets.updateAll(app) }.start()
                        }
                        .setNegativeButton(android.R.string.cancel, null)
                        .show()
                    true
                }
            }
            rows.addView(view)
            gameType(view)
        }
    }

    /** The dot is a shared drawable, so it is mutated rather than restyled. */
    private fun tintDot(color: Int) {
        (statusDot.background?.mutate() as? GradientDrawable)?.setColor(color)
            ?: statusDot.setBackgroundColor(Color.TRANSPARENT)
    }

    /**
     * Android will not grant the overlay permission from code; it has to be
     * given in Settings, per app. So this sends the user there rather than
     * failing silently, which is what a `checkSelfPermission` call would do.
     */
    private fun startBubble() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            /*
             * Take every overlay down before opening Settings.
             *
             * Android disables permission toggles while anything is drawn over
             * the screen — anti-tapjacking, and correct — so an overlay app that
             * leaves its window up while sending the user to the permission
             * screen makes that screen useless.
             */
            asked = true
            stopService(Intent(this, BubbleService::class.java))
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName"),
                ),
            )
            return
        }
        startForegroundService(Intent(this, BubbleService::class.java))
        // 1.43: the button is "Play Brawl Stars": the bubble, then the game.
        Stats.event(this, "app_play", mapOf("from" to "home"))
        Shortcuts.openGame(this)
    }

    /**
     * The account card.
     *
     * Saved as it is typed rather than behind a Save button: there is nothing
     * to submit — the panel reads these on its next open — and a button that
     * has to be remembered is a button people forget, leaving them with a
     * setting they believe they made.
     *
     * The lookup is what makes the card worth having. A tag is a string nobody
     * can check by reading it, and one wrong character is a valid tag
     * belonging to a stranger whose only symptom is that the panel's filters
     * look broken. A name and a face settle that at a glance, and the three
     * counts show exactly what each choice will do to this roster.
     *
     * The three tiles *are* the filter rather than a readout beside one. Two
     * switches encoded three states, so one of the four combinations had to be
     * silently rewritten — "hypercharge" with "power 11" off is not a narrower
     * filter, it is an empty one, because a hypercharge cannot be unlocked
     * below power 11. Three mutually exclusive tiles cannot express the
     * impossible state at all, and each one shows the count it will produce.
     */
    private fun wireAccount() {
        val tag = findViewById<EditText>(R.id.tag)
        val status = findViewById<TextView>(R.id.tag_status)
        val hide = findViewById<Switch>(R.id.hide_unusable)
        val editor = findViewById<LinearLayout>(R.id.tag_editor)
        val change = findViewById<TextView>(R.id.change_tag)

        val planCaption = findViewById<TextView>(R.id.plan_caption)
        val planCard = findViewById<LinearLayout>(R.id.plan_card)
        val planHeadline = findViewById<TextView>(R.id.plan_headline)
        val planNote = findViewById<TextView>(R.id.plan_note)
        val planSteps = findViewById<LinearLayout>(R.id.plan_steps)

        val identity = findViewById<LinearLayout>(R.id.account_identity)
        val chips = findViewById<LinearLayout>(R.id.account_chips)
        val chipsCaption = findViewById<TextView>(R.id.chips_caption)
        val filterLabel = findViewById<TextView>(R.id.filter_label)
        val icon = findViewById<ImageView>(R.id.account_icon)
        val name = findViewById<TextView>(R.id.account_name)
        val meta = findViewById<TextView>(R.id.account_meta)
        val tagLine = findViewById<TextView>(R.id.account_tag)
        val chipOwned = findViewById<TextView>(R.id.chip_owned)
        val chipEleven = findViewById<TextView>(R.id.chip_eleven)
        val chipHyper = findViewById<TextView>(R.id.chip_hyper)

        /** Each filter, its row, and the radio ring that shows it is chosen. */
        val tiles = listOf(
            Triple(Account.FILTER_ALL, R.id.tile_owned, R.id.radio_owned),
            Triple(Account.FILTER_POWER_11, R.id.tile_eleven, R.id.radio_eleven),
            Triple(Account.FILTER_HYPERCHARGE, R.id.tile_hyper, R.id.radio_hyper),
        )
        val savedCaption = findViewById<TextView>(R.id.saved_caption)
        val savedScroll = findViewById<View>(R.id.saved_scroll)
        val savedRow = findViewById<LinearLayout>(R.id.saved_row)
        val setupPrompt = findViewById<LinearLayout>(R.id.setup_prompt)
        val scroll = findViewById<android.widget.ScrollView>(R.id.scroll_settings)

        /*
         * Find by name (1.40): typing a name instead of a tag lists matching
         * players, like the website's search; tapping one fills in its tag.
         */
        val nameSearch = NameSearch(
            this,
            findViewById(R.id.tag_matches),
            onPick = { picked, _ ->
                tag.setText("#$picked")
                tag.setSelection(tag.text.length)
            },
            onState = { state ->
                when (state) {
                    NameSearch.State.SEARCHING -> status.setText(R.string.name_searching)
                    NameSearch.State.FOUND -> status.setText(R.string.name_pick)
                    NameSearch.State.NONE -> status.setText(R.string.name_none)
                    NameSearch.State.IDLE -> Unit
                }
            },
        )

        var filter = Account.filter(this)
        /* The tag the plan on screen belongs to, so it is fetched once. */
        var plannedFor: String? = null
        var editing = true

        tag.setText(Account.tag(this))
        hide.isChecked = Account.hide(this)

        /**
         * Show the field, or the Change chip that brings it back.
         *
         * Collapsed is the state this card is in nearly all of its life — the
         * tag is set once and then read forever, and it is already on screen in
         * the line under the name. An open box below a settled account makes a
         * finished card look like an unfinished form.
         */
        fun setEditing(on: Boolean) {
            editing = on
            editor.visibility = if (on) View.VISIBLE else View.GONE
            change.visibility = if (on) View.GONE else View.VISIBLE
        }

        fun showPlan(plan: PlanLookup.Plan?) {
            planSteps.removeAllViews()
            if (plan == null) {
                planCaption.visibility = View.GONE
                planCard.visibility = View.GONE
                return
            }
            planHeadline.text = plan.headline
            planNote.text = plan.note

            val inflater = layoutInflater
            for ((index, step) in plan.steps.withIndex()) {
                val row = inflater.inflate(R.layout.row_plan_step, planSteps, false)
                // Between the rows, not above the first — a rule under the note
                // would read as the end of the card rather than the start of a
                // list.
                row.findViewById<View>(R.id.step_divider).visibility =
                    if (index == 0) View.GONE else View.VISIBLE
                row.findViewById<TextView>(R.id.step_name).text = step.name
                row.findViewById<TextView>(R.id.step_detail).text = step.detail
                val gain = row.findViewById<TextView>(R.id.step_gain)
                gain.text = step.gain
                gain.visibility = if (step.gain.isEmpty()) View.GONE else View.VISIBLE

                val art = row.findViewById<ImageView>(R.id.step_icon)
                if (step.icon.isNotEmpty()) {
                    PlanLookup.icon(step.icon) { bitmap ->
                        if (bitmap != null) art.setImageBitmap(bitmap)
                    }
                }
                planSteps.addView(row)
                gameType(row)
            }

            planCaption.visibility = View.VISIBLE
            planCard.visibility = View.VISIBLE
        }

        /**
         * Fetched once the account has settled, never while it is being typed.
         *
         * A tag is entered a character at a time and a short prefix can be a
         * real account, so resolving on every keystroke would send a live
         * upstream player fetch per letter to build a plan nobody asked for.
         * Waiting for the field to fold costs nothing: the plan is about what
         * to buy before the next session, not about this second.
         */
        fun loadPlan(tag: String) {
            if (editing || tag == plannedFor) return
            plannedFor = tag
            PlanLookup.load(tag, AppLang.current(this)) { plan ->
                // A failed fetch hides the card rather than leaving the previous
                // account's plan under a new name.
                if (plan == null) plannedFor = null
                showPlan(plan)
            }
        }

        /**
         * The other saved accounts as chips: tap to switch, long-press to forget
         * (1.29). Switching sets the field, so it runs exactly what typing the
         * tag does -- lookup, name, icon, counts, plan -- and the panel reloads
         * for the new account the next time it opens.
         */
        fun paintSaved() {
            // Named apart: inside a view's apply block `tag` is the view's own.
            val field = tag
            val current = Account.normalise(field.text.toString())
            val others = Account.savedAccounts(this).filter { it.tag != current }
            savedRow.removeAllViews()
            val visible = if (others.isEmpty()) View.GONE else View.VISIBLE
            savedCaption.visibility = visible
            savedScroll.visibility = visible
            val density = resources.displayMetrics.density
            for (account in others) {
                val chip = TextView(this).apply {
                    text = if (account.name.isNotBlank()) "${account.name}  #${account.tag}" else "#${account.tag}"
                    setBackgroundResource(R.drawable.chip)
                    setTextColor(getColor(R.color.muted))
                    textSize = 13f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    val h = (14 * density).toInt()
                    val v = (8 * density).toInt()
                    setPadding(h, v, h, v)
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        field.setText(account.tag)
                        setEditing(false)
                        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                            .hideSoftInputFromWindow(field.windowToken, 0)
                    }
                    setOnLongClickListener {
                        Account.forgetAccount(this@MainActivity, account.tag)
                        android.widget.Toast.makeText(
                            this@MainActivity,
                            getString(R.string.account_forgotten, account.name.ifBlank { "#${account.tag}" }),
                            android.widget.Toast.LENGTH_SHORT,
                        ).show()
                        paintSaved()
                        true
                    }
                }
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { marginEnd = (8 * density).toInt() }
                savedRow.addView(chip, params)
            }
        }

        fun paintFilter() {
            for ((value, row, radio) in tiles) {
                val active = value == filter
                findViewById<LinearLayout>(row).setBackgroundResource(
                    if (active) R.drawable.filter_row_active else R.drawable.filter_row,
                )
                findViewById<ImageView>(radio).setImageResource(
                    if (active) R.drawable.radio_on else R.drawable.radio_off,
                )
            }
        }

        fun showAccount(result: AccountLookup.Result?) {
            if (result == null) {
                identity.visibility = View.GONE
                chips.visibility = View.GONE
                chipsCaption.visibility = View.GONE
                filterLabel.visibility = View.GONE
                // No resolved account: the panel is running its generic
                // version, so the prompt saying what a tag unlocks comes back.
                setupPrompt.visibility = View.VISIBLE
                // And the bubble goes back to the BrawlZone mark: the icon it
                // wore belonged to an account that is no longer set.
                Account.clearIcon(this)
                PlanLookup.cancel()
                plannedFor = null
                showPlan(null)
                paintSaved()
                return
            }
            name.text = result.name
            // Remembered for the switch row, then the row redrawn without it.
            Account.rememberAccount(this, result.tag, result.name)
            paintSaved()
            // The label under each tile is in the layout now, beside its icon,
            // so these carry only the number.
            tagLine.text = "#${result.tag}"
            meta.text = java.text.NumberFormat.getIntegerInstance(
                AppLang.locale(AppLang.current(this)),
            ).format(result.trophies)
            chipOwned.text = result.owned.toString()
            chipEleven.text = result.powerEleven.toString()
            chipHyper.text = result.hypercharged.toString()
            identity.visibility = View.VISIBLE
            chips.visibility = View.VISIBLE
            chipsCaption.visibility = View.VISIBLE
            // The rows say what each choice does; a line repeating the lit one
            // under them was a second answer to a question already answered.
            filterLabel.visibility = View.GONE
            setupPrompt.visibility = View.GONE
            icon.setImageDrawable(null)
            if (result.iconUrl.isNotEmpty()) {
                AccountLookup.icon(result.iconUrl) { bitmap ->
                    if (bitmap != null) {
                        icon.setImageBitmap(bitmap)
                        // The same picture, saved for the bubble to wear.
                        Account.saveIcon(this, bitmap)
                    }
                }
            }
            loadPlan(result.tag)
        }

        fun persist() {
            val raw = tag.text.toString()
            Account.save(this, raw, filter, hide.isChecked)

            when {
                raw.isBlank() -> {
                    AccountLookup.cancel()
                    showAccount(null)
                    nameSearch.clear()
                    status.setText(R.string.tag_optional)
                }
                !Account.isValid(raw) -> {
                    AccountLookup.cancel()
                    showAccount(null)
                    // Not a tag: a name, unless it was typed as one.
                    if (raw.trim().startsWith("#") || raw.trim().length < 2) {
                        nameSearch.clear()
                        status.setText(R.string.tag_invalid)
                    } else {
                        status.setText(R.string.name_searching)
                        nameSearch.query(raw)
                    }
                }
                else -> {
                    status.setText(R.string.tag_checking)
                    AccountLookup.lookupStatus(Account.normalise(raw)) { result, unavailable ->
                        // Could not check (offline, a game API outage): keep
                        // the card as it is and say so, rather than calling a
                        // saved tag wrong (1.41).
                        if (result == null && unavailable) {
                            status.setText(R.string.tag_unavailable)
                            return@lookupStatus
                        }
                        showAccount(result)
                        // A name that happens to look like a tag: search by name when no account has it.
                        if (result == null && !raw.trim().startsWith("#")) nameSearch.query(raw) else nameSearch.clear()
                        status.text = if (result == null) {
                            /*
                             * A saved tag that does not resolve reopens the
                             * field. Otherwise the card folds to a Change chip
                             * over nothing, and the one line explaining why is
                             * inside the part that just folded away.
                             */
                            setEditing(true)
                            getString(R.string.tag_not_found)
                        } else {
                            // 1.40: a new tag's rank and friends card, once typing settles.
                            if (Me.last(this) == null) {
                                window.decorView.removeCallbacks(standingAfterTag)
                                window.decorView.postDelayed(standingAfterTag, 1500)
                            }
                            getString(R.string.tag_ok)
                        }
                    }
                }
            }
        }

        change.setOnClickListener {
            setEditing(true)
            tag.requestFocus()
            tag.setSelection(tag.text.length)
            (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                .showSoftInput(tag, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
        }

        /*
         * Done folds the field away, and only if the tag resolved. Collapsing
         * the moment a lookup succeeds would take the box away mid-word from
         * someone whose own tag is a prefix of a stranger's.
         */
        tag.setOnEditorActionListener { _, _, _ ->
            if (identity.visibility == View.VISIBLE) {
                setEditing(false)
                (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                    .hideSoftInputFromWindow(tag.windowToken, 0)
                loadPlan(Account.normalise(tag.text.toString()))
            }
            // False: this is a fold, not a submit, and the field keeps whatever
            // the platform would do with the key otherwise.
            false
        }

        tag.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) = persist()
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })

        /*
         * The prompt's button goes to the field rather than opening a dialog
         * of its own: one place to enter a tag, so the card below is never out
         * of step with what was typed.
         */
        findViewById<TextView>(R.id.setup_cta).setOnClickListener {
            selectTab(Tabs.SETTINGS, track = false)
            setEditing(true)
            tag.requestFocus()
            scroll.post {
                val box = android.graphics.Rect()
                tag.getDrawingRect(box)
                scroll.offsetDescendantRectToMyCoords(tag, box)
                // A little above the field, so its label and the line under it
                // are on screen with it, not just the box.
                scroll.smoothScrollTo(0, (box.top - (96 * resources.displayMetrics.density).toInt()).coerceAtLeast(0))
            }
            (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                .showSoftInput(tag, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
        }

        for ((value, id, _) in tiles) {
            findViewById<LinearLayout>(id).setOnClickListener {
                filter = value
                paintFilter()
                // Only the stored filter changed, so the tag does not need
                // resolving again — persist without re-running the lookup.
                Account.save(this, tag.text.toString(), filter, hide.isChecked)
            }
        }
        hide.setOnCheckedChangeListener { _, _ -> persist() }

        paintFilter()
        paintSaved()

        // Resolve whatever was already saved, so the card is populated on open
        // rather than only after the field is touched — and open folded, since
        // a tag that is already there is not what the reader came to change.
        val saved = Account.isValid(tag.text.toString())
        setEditing(!saved)
        // Hidden in the layout so a saved account never flashes the prompt;
        // shown here only when there is nothing to resolve.
        setupPrompt.visibility = if (saved) View.GONE else View.VISIBLE
        if (saved) persist()
    }

    /**
     * The bubble's look: size, idle opacity and tuck (1.28).
     *
     * Saved on tap, like the account card. The service listens to the same
     * preferences, so a bubble already over the game changes as the option is
     * chosen -- the quickest way to judge a size is to see it there.
     */
    private fun wireLook() {
        val sizeRow = findViewById<LinearLayout>(R.id.look_size)
        val idleRow = findViewById<LinearLayout>(R.id.look_idle)
        val tuck = findViewById<Switch>(R.id.look_tuck)
        val touched = findViewById<ImageView>(R.id.preview_touched)
        val idle = findViewById<ImageView>(R.id.preview_idle)
        val idleFrame = findViewById<android.widget.FrameLayout>(R.id.preview_idle_frame)
        val density = resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()

        // The bubble's face (1.42: a chosen brawler, else the player's icon), as the bubble wears it.
        var icon = Face.bitmap(this)
        fun paintFace() {
            icon = Face.bitmap(this)
            for (view in listOf(touched, idle)) {
                val face = icon
                if (face != null) {
                    view.setImageDrawable(
                        androidx.core.graphics.drawable.RoundedBitmapDrawableFactory
                            .create(resources, face)
                            .apply { isCircular = true },
                    )
                    view.scaleType = ImageView.ScaleType.CENTER_CROP
                } else {
                    view.setImageResource(R.drawable.bubble_glyph)
                    view.scaleType = ImageView.ScaleType.FIT_CENTER
                }
            }
        }
        paintFace()

        fun paintPreview() {
            val badge = px(BubbleLook.badgeDp(BubbleLook.size(this)))
            for (view in listOf(touched, idle)) {
                view.background = BubbleLook.badge(this) // 1.42: in the chosen theme
                val inset = if (icon != null) px(4) else badge / 4
                view.setPadding(inset, inset, inset, inset)
                view.layoutParams = (view.layoutParams as android.widget.FrameLayout.LayoutParams).apply {
                    width = badge
                    height = badge
                }
            }
            idle.alpha = BubbleLook.idle(this) / 100f
            // Tucked: half the badge past the frame's edge, clipped the way
            // the screen edge clips it. The frame matches the badge so the
            // cut lands through its middle.
            val tucked = BubbleLook.tuck(this)
            idleFrame.layoutParams = idleFrame.layoutParams.apply {
                width = if (tucked) badge else px(64)
            }
            val end = if (resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL) -1 else 1
            idle.translationX = if (tucked) end * badge / 2f else 0f
            idleFrame.requestLayout()
        }

        /** A row of pill options, one lit. */
        fun <T> options(
            row: LinearLayout,
            values: List<T>,
            label: (T) -> String,
            current: () -> T,
            choose: (T) -> Unit,
        ) {
            row.removeAllViews()
            val views = values.map { value ->
                TextView(this).apply {
                    text = label(value)
                    textSize = 14f
                    gravity = android.view.Gravity.CENTER
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setPadding(px(6), px(10), px(6), px(12))
                    isClickable = true
                    isFocusable = true
                }
            }
            fun paint() {
                val now = current()
                for ((i, view) in views.withIndex()) {
                    val on = values[i] == now
                    view.setBackgroundResource(if (on) R.drawable.chip_active else R.drawable.chip)
                    view.setTextColor(getColor(if (on) R.color.brand else R.color.foreground))
                }
            }
            for ((i, view) in views.withIndex()) {
                view.setOnClickListener {
                    choose(values[i])
                    paint()
                    paintPreview()
                }
                row.addView(view, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (i > 0) marginStart = px(8)
                })
            }
            paint()
        }

        options(
            sizeRow,
            BubbleLook.SIZES,
            {
                getString(
                    when (it) {
                        BubbleLook.SIZE_SMALL -> R.string.size_small
                        BubbleLook.SIZE_LARGE -> R.string.size_large
                        else -> R.string.size_normal
                    },
                )
            },
            { BubbleLook.size(this) },
            { BubbleLook.setSize(this, it) },
        )

        val percent = java.text.NumberFormat.getPercentInstance(AppLang.locale(AppLang.current(this)))
        options(
            idleRow,
            BubbleLook.IDLE_LEVELS,
            { if (it >= 100) getString(R.string.idle_solid) else percent.format(it / 100.0) },
            { BubbleLook.idle(this) },
            { BubbleLook.setIdle(this, it) },
        )

        // 1.42: the bubble's face, any brawler or the player's own icon.
        val faceRow = findViewById<TextView>(R.id.look_face)
        fun paintFaceLabel() {
            faceRow.text = getString(R.string.look_face_named, Face.name(this) ?: getString(R.string.look_face_player)) + "  ›"
        }
        paintFaceLabel()
        faceRow.setOnClickListener {
            Face.pick(this) {
                paintFace()
                paintFaceLabel()
                paintPreview()
            }
        }

        // 1.42: themes, a swatch each, the chosen one ringed and named.
        val themeRow = findViewById<LinearLayout>(R.id.look_theme)
        val themeLabel = findViewById<TextView>(R.id.look_theme_label)
        fun paintThemes() {
            themeRow.removeAllViews()
            val chosen = BubbleLook.theme(this)
            themeLabel.text = getString(R.string.look_theme_named, getString(chosen.label))
            for (theme in BubbleLook.THEMES) {
                val on = theme.id == chosen.id
                val ring = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL
                    setColor(android.graphics.Color.TRANSPARENT)
                    setStroke(px(3), if (on) getColor(R.color.foreground) else android.graphics.Color.TRANSPARENT)
                }
                val layers = android.graphics.drawable.LayerDrawable(arrayOf(ring, BubbleLook.badge(this, theme))).apply {
                    setLayerInset(1, px(6), px(6), px(6), px(6))
                }
                val swatch = View(this).apply {
                    background = layers
                    contentDescription = getString(theme.label)
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        BubbleLook.setTheme(this@MainActivity, theme.id)
                        paintThemes()
                        paintPreview()
                    }
                }
                themeRow.addView(swatch, LinearLayout.LayoutParams(px(48), px(48)).apply { marginEnd = px(6) })
            }
        }
        paintThemes()

        tuck.isChecked = BubbleLook.tuck(this)
        tuck.setOnCheckedChangeListener { _, on ->
            BubbleLook.setTuck(this, on)
            paintPreview()
        }

        // The break card after three losses in a row (1.42): off here, or by
        // "Don't show again" on the card itself; this is the way back on.
        val tilt = findViewById<Switch>(R.id.look_tilt)
        tilt.isChecked = BubbleLook.tilt(this)
        tilt.setOnCheckedChangeListener { _, on -> BubbleLook.setTilt(this, on) }

        idleFrame.post { paintPreview() }
        gameType(sizeRow)
        gameType(idleRow)
    }

    /**
     * The language chip and its picker.
     *
     * A flag and a short code in the header, because the person who needs to
     * change the language is the one who cannot read the screen it is in. The
     * list shows each language in its own name with the flag and the English
     * name beside it -- the same three ways in that the panel's picker offers.
     */
    private fun wireLanguage() {
        val chip = findViewById<TextView>(R.id.lang_chip)
        val current = AppLang.byCode(AppLang.current(this)) ?: AppLang.ALL.first()
        chip.text = current.flag + "  " + current.code.substringBefore('-').uppercase()
        chip.contentDescription = getString(R.string.lang_title) + ": " + current.label
        chip.setOnClickListener { showLanguagePicker() }
    }

    private fun showLanguagePicker() {
        val density = resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val current = AppLang.current(this)

        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(px(18), px(18), px(18), px(12))
        }
        list.addView(TextView(this).apply {
            setText(R.string.lang_title)
            textSize = 20f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(getColor(R.color.foreground))
        })
        list.addView(TextView(this).apply {
            setText(R.string.lang_hint)
            textSize = 13f
            setLineSpacing(0f, 1.25f)
            setTextColor(getColor(R.color.muted))
            setPadding(0, px(4), 0, px(12))
        })

        val dialog = android.app.AlertDialog.Builder(this).create()

        for (lang in AppLang.ALL) {
            val chosen = lang.code == current
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setBackgroundResource(if (chosen) R.drawable.filter_row_active else R.drawable.filter_row)
                setPadding(px(14), px(10), px(14), px(12))
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    dialog.dismiss()
                    if (AppLang.set(this@MainActivity, lang.code)) recreate()
                }
            }
            row.addView(TextView(this).apply {
                text = lang.flag
                textSize = 24f
            })
            val names = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(px(12), 0, px(8), 0)
            }
            names.addView(TextView(this).apply {
                text = lang.label
                textSize = 16f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(getColor(if (chosen) R.color.brand else R.color.foreground))
            })
            names.addView(TextView(this).apply {
                text = lang.english
                textSize = 12f
                setTextColor(getColor(R.color.muted))
            })
            row.addView(names, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            if (chosen) {
                row.addView(TextView(this).apply {
                    text = "✓"
                    textSize = 18f
                    setTextColor(getColor(R.color.brand))
                })
            }
            list.addView(row, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = px(6) })
        }

        val scroll = android.widget.ScrollView(this).apply {
            setBackgroundResource(R.drawable.card_surface)
            addView(list)
        }
        dialog.setView(scroll)
        dialog.setOnShowListener {
            dialog.window?.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
            // The current language in view, not the top of a 22-row list.
            val index = AppLang.ALL.indexOfFirst { it.code == current }
            scroll.post { list.getChildAt(index + 2)?.let { scroll.scrollTo(0, (it.top - px(80)).coerceAtLeast(0)) } }
        }
        dialog.show()
    }

    /**
     * Game-style type: every bold label on the screen in Lilita One.
     *
     * The chunky rounded display face the website already uses, under the
     * SIL Open Font License, bundled in res/font. Bold in the layout means
     * "this is a title, a button, a number" -- exactly the text a game draws in
     * its display face -- so one pass over the view tree applies it, rather
     * than a fontFamily on two hundred TextViews that the next layout edit
     * would forget. Body copy stays in the system face, for reading.
     *
     * The larger labels also get a hard dark drop shadow, offset straight
     * down: the way game UI sets type on bright surfaces. Text fields are left
     * alone; a tag is typed, not read as a title.
     */
    internal fun gameType(root: View) {
        /*
         * Lilita One has Latin letters only. A Russian or Thai title set in it
         * would come out in whatever the system substitutes glyph by glyph,
         * so those languages keep the system's own bold, which is drawn for
         * their script.
         */
        if (AppLang.byCode(AppLang.current(this))?.latin == false) return
        val display = androidx.core.content.res.ResourcesCompat.getFont(this, R.font.lilita_one) ?: return
        val metrics = resources.displayMetrics
        val large = android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_SP, 15f, metrics,
        )
        val drop = 2f * metrics.density

        fun walk(view: View) {
            if (view is android.view.ViewGroup) {
                for (i in 0 until view.childCount) walk(view.getChildAt(i))
            }
            if (view is TextView && view !is EditText && view.typeface?.isBold == true) {
                view.typeface = display
                if (view.textSize >= large) {
                    view.setShadowLayer(1f, 0f, drop, Color.parseColor("#CC050A1F"))
                }
            }
        }
        walk(root)
    }
}
