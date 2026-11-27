package net.brawlzone.bubble

import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Bubble Pass (1.43, Pass): the week's tier with the legendary ring turning
 * around the player's own bubble, the ten-tier reward track, this week's
 * quests and the ring collection. A ring unlocked since the last visit is
 * revealed first, with Equip one tap away.
 */
class PassActivity : AppCompatActivity() {

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLang.wrap(newBase))
    }

    private val density by lazy { resources.displayMetrics.density }
    private fun px(dp: Int) = (dp * density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pass)
        val scroll = findViewById<ScrollView>(R.id.pass_scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        scroll.clipToPadding = false
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        findViewById<View>(R.id.pass_back).setOnClickListener { finish() }
        Stats.event(this, "app_pass_open")
    }

    override fun onResume() {
        super.onResume()
        paint(animate = true)
        val app = applicationContext
        Thread {
            Pass.update(app, post = false)
            runOnUiThread { if (!isFinishing && !isDestroyed) paint(animate = false) }
        }.start()
    }

    private fun paint(animate: Boolean) {
        val week = Pass.week(this)
        findViewById<View>(R.id.pass_needs_tag).visibility = if (week == null) View.VISIBLE else View.GONE
        findViewById<View>(R.id.pass_body).visibility = if (week == null) View.GONE else View.VISIBLE
        if (week == null) return
        paintHero(week, animate)
        paintTrack(week)
        paintQuests(week)
        paintRings()
        GameType.apply(this, findViewById(R.id.pass_root))
        if (animate) Pass.markSeen(this, week)
        revealNext()
    }

    private fun paintHero(week: Pass.Week, animate: Boolean) {
        val holder = findViewById<FrameLayout>(R.id.pass_hero_ring)
        holder.removeAllViews()
        holder.addView(Rings.preview(this, week.legendary, px(64), spin = true))
        findViewById<TextView>(R.id.pass_tier).text = getString(R.string.pass_tier, week.tier)
        val bar = findViewById<ProgressBar>(R.id.pass_bar)
        val target = if (week.tier >= Pass.TIERS) 1000 else week.xpInTier * 10
        if (animate) {
            val seen = Pass.seenXp(this, week)
            val seenTier = (seen / Pass.XP_PER_TIER).coerceAtMost(Pass.TIERS)
            val from = if (seenTier == week.tier) (seen - seenTier * Pass.XP_PER_TIER) * 10 else 0
            bar.progress = from
            ObjectAnimator.ofInt(bar, "progress", from, target).apply {
                duration = 900
                startDelay = 250
                interpolator = DecelerateInterpolator()
                start()
            }
        } else {
            bar.progress = target
        }
        findViewById<TextView>(R.id.pass_xp).text =
            if (week.tier >= Pass.TIERS) getString(R.string.pass_max)
            else getString(R.string.pass_xp, week.xpInTier, Pass.XP_PER_TIER, week.tier + 1) +
                // Bubble Supporter (1.46): the doubled XP says so.
                if (Supporter.active(this)) "  ·  ⭐ 2× XP" else ""
        findViewById<TextView>(R.id.pass_resets).text = getString(R.string.pass_resets, Pass.resetsOn(this, week))
        val streak = findViewById<TextView>(R.id.pass_streak)
        streak.visibility = if (week.streak > 0) View.VISIBLE else View.GONE
        streak.text = "🔥 " + getString(R.string.pass_streak, week.streak)
        findViewById<TextView>(R.id.pass_legend).text =
            getString(R.string.pass_legend, getString(week.legendary.name))
    }

    /** Ten tiers on a line: reward tiers show their ring, the rest a numbered dot. */
    private fun paintTrack(week: Pass.Week) {
        val track = findViewById<LinearLayout>(R.id.pass_track)
        track.removeAllViews()
        val owned = Pass.owned(this)
        for (t in 1..Pass.TIERS) {
            if (t > 1) {
                track.addView(View(this).apply {
                    setBackgroundColor(if (t <= week.tier) getColor(R.color.brand) else 0x553D4F99)
                    layoutParams = LinearLayout.LayoutParams(px(14), px(4))
                })
            }
            val reached = t <= week.tier
            val node = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
            }
            val ring = when {
                t == Pass.TIERS -> week.legendary
                t in Pass.REWARD_TIERS -> Rings.COMMON.first { Rings.COMMON_TIER[it.id] == t }
                else -> null
            }
            if (ring != null) {
                node.addView(Rings.preview(this, ring, px(if (t == Pass.TIERS) 40 else 32), spin = t == Pass.TIERS && reached, locked = !reached))
            } else {
                node.addView(TextView(this).apply {
                    text = t.toString()
                    gravity = Gravity.CENTER
                    setTextColor(if (reached) getColor(R.color.brand_ink) else getColor(R.color.muted))
                    textSize = 14f
                    setTypeface(typeface, Typeface.BOLD)
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(if (reached) getColor(R.color.brand) else 0xFF1A2759.toInt())
                        setStroke(px(2), if (reached) 0xFFB86A00.toInt() else 0xFF33468F.toInt())
                    }
                    layoutParams = LinearLayout.LayoutParams(px(30), px(30))
                })
            }
            node.addView(TextView(this).apply {
                text = when {
                    ring != null && ring.id in owned && reached -> "✓ " + getString(R.string.pass_tier, t)
                    else -> getString(R.string.pass_tier, t)
                }
                setTextColor(if (reached) getColor(R.color.foreground) else getColor(R.color.muted))
                textSize = 11f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, px(4), 0, 0)
            })
            track.addView(node)
        }
        // The current tier in view.
        val scroll = findViewById<HorizontalScrollView>(R.id.pass_track_scroll)
        scroll.post {
            val index = ((week.tier.coerceAtLeast(1) - 1) * 2).coerceAtMost(track.childCount - 1)
            track.getChildAt(index)?.let { scroll.smoothScrollTo((it.left - px(60)).coerceAtLeast(0), 0) }
        }
    }

    private fun questTitle(q: Pass.Quest): String = PassText.title(this, q)

    private fun questIcon(k: Pass.Kind): String = PassText.icon(k)

    /** Quests to do first, done ones after, each with its bar and XP. */
    private fun paintQuests(week: Pass.Week) {
        val box = findViewById<LinearLayout>(R.id.pass_quests)
        box.removeAllViews()
        val ordered = week.quests.sortedBy { it.done }
        for ((i, q) in ordered.withIndex()) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, px(10), 0, px(10))
                if (q.done) alpha = 0.6f
            }
            row.addView(TextView(this).apply {
                text = if (q.done) "✅" else questIcon(q.kind)
                textSize = 22f
                layoutParams = LinearLayout.LayoutParams(px(38), LinearLayout.LayoutParams.WRAP_CONTENT)
            })
            val mid = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            mid.addView(TextView(this).apply {
                text = questTitle(q)
                setTextColor(getColor(R.color.foreground))
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
            })
            val line = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, px(5), 0, 0)
            }
            line.addView(ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = q.kind.target
                progress = q.progress.coerceAtMost(q.kind.target)
                progressDrawable = getDrawable(R.drawable.widget_progress)
                layoutParams = LinearLayout.LayoutParams(0, px(7), 1f)
            })
            line.addView(TextView(this).apply {
                text = "${q.progress.coerceAtMost(q.kind.target)}/${q.kind.target}"
                setTextColor(getColor(R.color.muted))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(px(8), 0, 0, 0)
            })
            mid.addView(line)
            row.addView(mid)
            row.addView(TextView(this).apply {
                text = getString(R.string.pass_xp_chip, q.xp)
                setTextColor(if (q.done) getColor(R.color.victory) else getColor(R.color.brand))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                setBackgroundResource(R.drawable.chip)
                setPadding(px(9), px(4), px(9), px(5))
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    marginStart = px(10)
                }
            })
            box.addView(row)
            if (i < ordered.size - 1) {
                box.addView(View(this).apply {
                    setBackgroundColor(0xFF22316C.toInt())
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(1))
                })
            }
        }
    }

    /** Every ring, four to a row: owned ones equip on a tap, the rest say where they come from. */
    private fun paintRings() {
        val box = findViewById<LinearLayout>(R.id.pass_rings)
        box.removeAllViews()
        val owned = Pass.owned(this)
        val equipped = BubbleLook.ring(this)
        val cells = listOf<Rings.Ring?>(null) + Rings.ALL
        for (chunk in cells.chunked(4)) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
            }
            for (ring in chunk) {
                val have = ring == null || ring.id in owned || (ring.supporter && Supporter.active(this))
                // 1.46: the Supporter ring shows itself turning even before it is bought.
                val showOff = ring?.supporter == true && !have && Ads.SOLD
                val on = ring?.id == equipped
                val cell = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER_HORIZONTAL
                    setPadding(px(4), px(8), px(4), px(8))
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    if (on) setBackgroundResource(R.drawable.chip_active)
                }
                cell.addView(Rings.preview(this, ring, px(34), spin = showOff, locked = !have && !showOff))
                cell.addView(TextView(this).apply {
                    text = if (ring == null) getString(R.string.ring_none) else getString(ring.name)
                    setTextColor(if (have) getColor(R.color.foreground) else getColor(R.color.muted))
                    textSize = 12f
                    gravity = Gravity.CENTER
                    maxLines = 1
                    setTypeface(typeface, Typeface.BOLD)
                    setPadding(0, px(4), 0, 0)
                })
                cell.addView(TextView(this).apply {
                    text = when {
                        on -> getString(R.string.ring_equipped)
                        have -> getString(R.string.ring_equip)
                        ring!!.supporter -> getString(R.string.ring_supporters_only)
                        ring.legendary -> getString(R.string.ring_legendary)
                        else -> getString(R.string.pass_tier, Rings.COMMON_TIER[ring?.id ?: ""] ?: 0)
                    }
                    setTextColor(
                        when {
                            on -> getColor(R.color.victory)
                            have -> getColor(R.color.brand)
                            showOff -> getColor(R.color.brand)
                            else -> getColor(R.color.muted)
                        },
                    )
                    textSize = 11f
                    gravity = Gravity.CENTER
                })
                if (showOff) cell.setOnClickListener { Ads.buy(this) }
                if (have && !on) {
                    cell.setOnClickListener {
                        BubbleLook.setRing(this, ring?.id)
                        Stats.event(this, "app_ring_equip", mapOf("ring" to (ring?.id ?: "none")))
                        paintRings()
                        GameType.apply(this, box)
                    }
                }
                row.addView(cell)
            }
            repeat(4 - chunk.size) {
                row.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
            }
            box.addView(row)
        }
    }

    private var revealing = false

    /** A ring unlocked since the last visit: shown big, turning, with Equip. */
    private fun revealNext() {
        if (revealing) return
        val id = Pass.pendingReveals(this).lastOrNull() ?: return
        val ring = Rings.byId(id) ?: run {
            Pass.clearReveals(this)
            return
        }
        Pass.clearReveals(this)
        revealing = true
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(px(24), px(26), px(24), px(18))
            setBackgroundResource(R.drawable.card_cta)
        }
        content.addView(TextView(this).apply {
            text = getString(R.string.pass_unlocked)
            setTextColor(getColor(R.color.brand))
            textSize = 13f
            letterSpacing = 0.12f
            setTypeface(typeface, Typeface.BOLD)
        })
        val preview = Rings.preview(this, ring, px(96), spin = true)
        preview.scaleX = 0.3f
        preview.scaleY = 0.3f
        val holder = FrameLayout(this).apply { setPadding(0, px(18), 0, px(14)) }
        holder.addView(preview, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        content.addView(holder)
        content.addView(TextView(this).apply {
            text = getString(ring.name)
            setTextColor(getColor(R.color.foreground))
            textSize = 26f
            setTypeface(typeface, Typeface.BOLD)
        })
        content.addView(TextView(this).apply {
            text = getString(if (ring.legendary) R.string.pass_unlocked_legendary else R.string.pass_unlocked_body)
            setTextColor(getColor(R.color.muted))
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, px(6), 0, px(16))
        })
        val equip = TextView(this).apply {
            text = getString(R.string.ring_equip)
            setBackgroundResource(R.drawable.btn_gold)
            setTextColor(getColor(R.color.brand_ink))
            textSize = 16f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(px(30), px(12), px(30), px(14))
        }
        content.addView(equip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        val later = TextView(this).apply {
            text = getString(R.string.pin_later)
            setTextColor(getColor(R.color.muted))
            textSize = 13f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, px(12), 0, px(2))
        }
        content.addView(later)
        GameType.apply(this, content)
        val dialog = AlertDialog.Builder(this).setView(content).create()
        dialog.window?.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
        equip.setOnClickListener {
            BubbleLook.setRing(this, ring.id)
            Stats.event(this, "app_ring_equip", mapOf("ring" to ring.id, "from" to "reveal"))
            dialog.dismiss()
        }
        later.setOnClickListener { dialog.dismiss() }
        dialog.setOnDismissListener {
            revealing = false
            if (!isFinishing && !isDestroyed) paintRings()
        }
        dialog.show()
        preview.animate().scaleX(1f).scaleY(1f).setDuration(520).setInterpolator(OvershootInterpolator(1.6f)).start()
        findViewById<View>(R.id.pass_root).performHapticFeedback(
            if (android.os.Build.VERSION.SDK_INT >= 30) android.view.HapticFeedbackConstants.CONFIRM
            else android.view.HapticFeedbackConstants.VIRTUAL_KEY,
        )
    }
}
