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
            if (granted) "Ready — tap Start bubble" else "Permission needed to draw over apps"
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
     * counts show exactly what each switch will do to this roster.
     */
    private fun wireAccount() {
        val tag = findViewById<EditText>(R.id.tag)
        val status = findViewById<TextView>(R.id.tag_status)
        val eleven = findViewById<Switch>(R.id.only_eleven)
        val hyper = findViewById<Switch>(R.id.only_hypercharge)
        val hide = findViewById<Switch>(R.id.hide_unusable)

        val identity = findViewById<LinearLayout>(R.id.account_identity)
        val chips = findViewById<LinearLayout>(R.id.account_chips)
        val icon = findViewById<ImageView>(R.id.account_icon)
        val name = findViewById<TextView>(R.id.account_name)
        val meta = findViewById<TextView>(R.id.account_meta)
        val chipOwned = findViewById<TextView>(R.id.chip_owned)
        val chipEleven = findViewById<TextView>(R.id.chip_eleven)
        val chipHyper = findViewById<TextView>(R.id.chip_hyper)

        tag.setText(Account.tag(this))
        hide.isChecked = Account.hide(this)
        when (Account.filter(this)) {
            Account.FILTER_HYPERCHARGE -> { eleven.isChecked = true; hyper.isChecked = true }
            Account.FILTER_POWER_11 -> eleven.isChecked = true
        }

        fun currentFilter(): String = when {
            hyper.isChecked -> Account.FILTER_HYPERCHARGE
            eleven.isChecked -> Account.FILTER_POWER_11
            else -> Account.FILTER_ALL
        }

        fun showAccount(result: AccountLookup.Result?) {
            if (result == null) {
                identity.visibility = View.GONE
                chips.visibility = View.GONE
                return
            }
            name.text = result.name
            meta.text = "#${result.tag} · ${"%,d".format(result.trophies)} trophies"
            chipOwned.text = "${result.owned}\nowned"
            chipEleven.text = "${result.powerEleven}\npower 11"
            chipHyper.text = "${result.hypercharged}\nhyper"
            identity.visibility = View.VISIBLE
            chips.visibility = View.VISIBLE
            icon.setImageDrawable(null)
            if (result.iconUrl.isNotEmpty()) {
                AccountLookup.icon(result.iconUrl) { bitmap ->
                    if (bitmap != null) icon.setImageBitmap(bitmap)
                }
            }
        }

        fun persist() {
            val raw = tag.text.toString()
            Account.save(this, raw, currentFilter(), hide.isChecked)

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
                            "No account with that tag. Check it in game under your profile."
                        } else {
                            "The panel will mark what you can field."
                        }
                    }
                }
            }
        }

        tag.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) = persist()
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })

        eleven.setOnCheckedChangeListener { _, on ->
            // Clearing power 11 cannot leave the narrower filter set.
            if (!on && hyper.isChecked) hyper.isChecked = false
            persist()
        }
        hyper.setOnCheckedChangeListener { _, on ->
            if (on && !eleven.isChecked) eleven.isChecked = true
            persist()
        }
        hide.setOnCheckedChangeListener { _, _ -> persist() }

        // Resolve whatever was already saved, so the card is populated on open
        // rather than only after the field is touched.
        if (Account.isValid(tag.text.toString())) persist()
    }
}
