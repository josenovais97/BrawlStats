package net.brawlzone.bubble

import android.Manifest
import android.app.StatusBarManager
import android.content.ComponentName
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
import androidx.appcompat.app.AppCompatActivity

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status_text)
        statusDot = findViewById(R.id.status_dot)
        restricted = findViewById(R.id.restricted)

        restricted.text = buildString {
            append("The toggle is greyed out?\n\n")
            append("Android blocks this permission for apps installed outside a store. ")
            append("Open Settings › Apps › BrawlZone, tap the ⋮ menu at the top right, ")
            append("choose \"Allow restricted settings\", then try again.")
        }

        askForNotifications()

        findViewById<TextView>(R.id.version_chip).text = "v${BuildConfig.VERSION_NAME}"
        findViewById<TextView>(R.id.footer_link).setOnClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://brawlzone.net/bubble")))
        }

        wireAccount()

        findViewById<Button>(R.id.start).setOnClickListener { startBubble() }
        findViewById<Button>(R.id.stop).setOnClickListener {
            stopService(Intent(this, BubbleService::class.java))
        }
        offerTile()
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
                Icon.createWithResource(this, R.drawable.bubble_glyph),
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
    override fun onResume() {
        super.onResume()
        val granted =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

        statusText.text =
            if (granted) "Ready — it will float over the game" else "Permission needed to draw over apps"
        statusText.setTextColor(
            if (granted) getColor(R.color.victory) else getColor(R.color.muted),
        )
        tintDot(if (granted) getColor(R.color.victory) else getColor(R.color.muted))

        restricted.visibility = if (!granted && asked) View.VISIBLE else View.GONE
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

        moveTaskToBack(true)
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
        val setupPrompt = findViewById<LinearLayout>(R.id.setup_prompt)
        val scroll = findViewById<android.widget.ScrollView>(R.id.scroll)

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
            PlanLookup.load(tag) { plan ->
                // A failed fetch hides the card rather than leaving the previous
                // account's plan under a new name.
                if (plan == null) plannedFor = null
                showPlan(plan)
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
                return
            }
            name.text = result.name
            // The label under each tile is in the layout now, beside its icon,
            // so these carry only the number.
            tagLine.text = "#${result.tag}"
            meta.text = "%,d".format(result.trophies)
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
                    status.text = "Optional. Add your tag and the panel marks the picks you can actually take."
                }
                !Account.isValid(raw) -> {
                    AccountLookup.cancel()
                    showAccount(null)
                    status.text = "That does not look like a tag yet."
                }
                else -> {
                    status.text = "Checking…"
                    AccountLookup.lookup(Account.normalise(raw)) { result ->
                        showAccount(result)
                        status.text = if (result == null) {
                            /*
                             * A saved tag that does not resolve reopens the
                             * field. Otherwise the card folds to a Change chip
                             * over nothing, and the one line explaining why is
                             * inside the part that just folded away.
                             */
                            setEditing(true)
                            "No account with that tag. Check it in game under your profile."
                        } else {
                            "The panel will mark what you can field."
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
}
