package net.brawlzone.bubble

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat.Type

/**
 * First-run setup (1.40): allow the bubble, add a tag, open Brawl Stars.
 *
 * Before this the first screen was the whole settings page, and most installs
 * never got the bubble on screen (Play: 34 installs, 8 first opens). Three
 * steps in order, each one button, with the next step lit. Any step can be done
 * out of order, the tag can be skipped, and the whole thing can be skipped.
 */
class OnboardingActivity : AppCompatActivity() {

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLang.wrap(newBase))
    }

    private var tagSkipped = false
    private var tagSaved = false
    private lateinit var tagField: EditText
    private lateinit var tagStatus: TextView
    private lateinit var clip: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)
        GameType.apply(this, findViewById(R.id.onb_root))
        fitSystemBars()

        tagField = findViewById(R.id.onb_tag)
        tagStatus = findViewById(R.id.onb_tag_status)
        clip = findViewById(R.id.onb_clip)
        listOf(R.id.onb_img1, R.id.onb_img3).forEach { findViewById<View>(it).clipToOutline = true }

        tagSaved = Account.tag(this).isNotEmpty()
        if (tagSaved) tagField.setText("#" + Account.tag(this))

        findViewById<Button>(R.id.onb_allow).setOnClickListener {
            // Overlay toggles are disabled while anything draws over the screen.
            stopService(Intent(this, BubbleService::class.java))
            runCatching {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            }
        }
        findViewById<Button>(R.id.onb_save_tag).setOnClickListener { saveTag(tagField.text.toString()) }
        findViewById<Button>(R.id.onb_skip_tag).setOnClickListener {
            tagSkipped = true
            paint()
        }
        clip.setOnClickListener {
            val tag = clip.tag as? String ?: return@setOnClickListener
            tagField.setText("#$tag")
            saveTag(tag)
        }
        findViewById<Button>(R.id.onb_play).setOnClickListener {
            if (!overlayGranted()) {
                findViewById<ScrollView>(R.id.onb_scroll).smoothScrollTo(0, findViewById<View>(R.id.onb_step1).top)
                findViewById<View>(R.id.onb_step1).animate().scaleX(1.03f).scaleY(1.03f).setDuration(120)
                    .withEndAction { findViewById<View>(R.id.onb_step1).animate().scaleX(1f).scaleY(1f).setDuration(120).start() }
                    .start()
                return@setOnClickListener
            }
            Onboarding.markDone(this)
            Shortcuts.startBubble(this, null)
            Shortcuts.openGame(this)
            finish()
        }
        findViewById<TextView>(R.id.onb_skip_all).setOnClickListener {
            Onboarding.markDone(this)
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
        AlertJob.schedule(this)
    }

    override fun onResume() {
        super.onResume()
        paint()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Android lets an app read the clipboard only while it has focus.
        if (!hasFocus || tagSaved || tagField.text.isNotBlank()) return
        val found = ClipTag.find(this) ?: return
        clip.tag = found
        clip.text = getString(R.string.onb_paste, "#$found")
        clip.visibility = View.VISIBLE
    }

    private fun saveTag(raw: String) {
        if (!Account.isValid(raw)) {
            tagStatus.visibility = View.VISIBLE
            tagStatus.setTextColor(getColor(R.color.muted))
            tagStatus.text = getString(R.string.tag_invalid)
            return
        }
        val tag = Account.normalise(raw)
        tagStatus.visibility = View.VISIBLE
        tagStatus.setTextColor(getColor(R.color.muted))
        tagStatus.text = getString(R.string.tag_checking)
        AccountLookup.lookup(tag) { result ->
            if (result == null) {
                tagStatus.text = getString(R.string.tag_not_found)
                return@lookup
            }
            Account.save(this, tag, Account.filter(this), Account.hide(this))
            Account.rememberAccount(this, tag, result.name)
            if (result.iconUrl.isNotEmpty()) AccountLookup.icon(result.iconUrl) { bmp -> bmp?.let { Account.saveIcon(this, it) } }
            tagStatus.setTextColor(getColor(R.color.victory))
            tagStatus.text = "✓ " + result.name
            clip.visibility = View.GONE
            tagSaved = true
            paint()
        }
    }

    private fun overlayGranted() =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    /** Badges turn green when done; the next step to do is fully lit, the rest dimmed. */
    private fun paint() {
        val one = overlayGranted()
        val two = tagSaved || tagSkipped
        badge(R.id.onb_badge1, "1", one)
        badge(R.id.onb_badge2, "2", tagSaved)
        badge(R.id.onb_badge3, "3", false)
        findViewById<Button>(R.id.onb_allow).visibility = if (one) View.GONE else View.VISIBLE
        val current = when {
            !one -> R.id.onb_step1
            !two -> R.id.onb_step2
            else -> R.id.onb_step3
        }
        for (id in listOf(R.id.onb_step1, R.id.onb_step2, R.id.onb_step3)) {
            findViewById<View>(id).alpha = if (id == current) 1f else 0.6f
        }
    }

    private fun badge(id: Int, number: String, done: Boolean) {
        val view = findViewById<TextView>(id)
        view.setBackgroundResource(if (done) R.drawable.step_badge_done else R.drawable.step_badge)
        view.text = if (done) "✓" else number
    }

    private fun fitSystemBars() {
        val scroll = findViewById<ScrollView>(R.id.onb_scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        scroll.clipToPadding = false
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(Type.systemBars() or Type.displayCutout())
            val ime = insets.getInsets(Type.ime()).bottom
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime))
            insets
        }
    }
}

/** Whether to show the setup screen. Installs that already allowed the bubble skip it. */
object Onboarding {
    private const val PREFS = "brawlzone-onboarding"
    private const val KEY_DONE = "done"

    fun needed(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_DONE, false)) return false
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        return !granted
    }

    fun markDone(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_DONE, true).apply()
    }
}
