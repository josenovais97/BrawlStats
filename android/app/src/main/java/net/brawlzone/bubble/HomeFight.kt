package net.brawlzone.bubble

import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import net.brawlzone.bubble.Ui.below
import net.brawlzone.bubble.Ui.grow
import org.json.JSONObject

/**
 * Home's new parts (1.45): today as one card on the rank's colour with the
 * player's most played brawler behind it, the last five games, what stands
 * out (Coach), and the pass's next quests.
 */

/** Today: record, elo, kills and deaths, the goal. Replaces the three small boxes. */
internal fun MainActivity.paintHomeFight() {
    val tag = Account.tag(this)
    val box = findViewById<LinearLayout>(R.id.home_fight)
    findViewById<View>(R.id.today_row).visibility = View.GONE
    box.removeAllViews()
    if (tag.isEmpty()) {
        box.visibility = View.GONE
        findViewById<View>(R.id.home_games).visibility = View.GONE
        findViewById<View>(R.id.home_coach).visibility = View.GONE
        return
    }
    box.visibility = View.VISIBLE
    val me = Me.last(this)
    val session = Review.session(this)
    val season = SeasonData.last(this, SeasonPages.NOW)
    val (frame, body) = Ui.hero(this, Ui.rankColor(me?.rankIndex ?: -1))
    frame.minimumHeight = Ui.px(this, 168)
    Ui.heroArt(this, frame, season?.hero, 158)

    body.addView(
        Ui.row(this, 12).apply {
            val record = Ui.text(this@paintHomeFight, "", 42f, bold = true).apply { includeFontPadding = false }
            record.text = SpannableStringBuilder()
                .append(tinted((session?.wins ?: 0).toString(), 0xFF7CF0B1.toInt()))
                .append("–")
                .append(tinted((session?.losses ?: 0).toString(), 0xFFFF9AA8.toInt()))
            addView(record)
            session?.elo?.let { moved ->
                if (moved != 0) addView(
                    Ui.text(this@paintHomeFight, if (moved > 0) "+$moved" else "−${-moved}", 21f, if (moved > 0) 0xFF7CF0B1.toInt() else 0xFFFF9AA8.toInt(), bold = true),
                )
            }
        },
    )
    val fight = Combat.today(this, tag)
    if (fight.games > 0) {
        body.addView(
            Ui.row(this, 18).apply {
                fun stat(key: String, to: Double, label: Int, show: (Double) -> String) = addView(
                    Ui.column(this@paintHomeFight).apply {
                        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                        val number = Ui.text(this@paintHomeFight, show(to), 21f, bold = true)
                        addView(number)
                        Ui.countTo(number, key, to) { show(it) }
                        addView(Ui.text(this@paintHomeFight, getString(label), 12f, 0xFFFFE6C8.toInt()))
                    },
                )
                stat("home_kd", fight.kd, R.string.kd) { Combat.ratio(it) }
                stat("home_kills", fight.killsPerGame, R.string.stat_kills) { Combat.one(it) }
            },
        )
    }
    val goal = Goal.goal(this)
    if (goal > 0) {
        val wins = Goal.todayWins(this, tag).coerceAtMost(goal)
        body.addView(
            Ui.row(this, 10).apply {
                below(4)
                val bar = Ui.bar(this@paintHomeFight, wins.toDouble() / goal, Ui.GOLD, 10)
                bar.layoutParams = LinearLayout.LayoutParams(Ui.px(this@paintHomeFight, 132), Ui.px(this@paintHomeFight, 10))
                addView(bar)
                addView(Ui.text(this@paintHomeFight, getString(R.string.home_goal, wins, goal), 13f, bold = true))
            },
        )
    }
    frame.setOnClickListener { selectTab(Tabs.SEASON) }
    box.addView(frame)
    gameType(box)
    paintHomeGames(tag, me)
    paintHomeCoach(season, tag)
}

private fun tinted(text: String, color: Int): CharSequence =
    SpannableStringBuilder(text).apply { setSpan(ForegroundColorSpan(color), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }

/** The last five Ranked games, newest first; a tap opens that game's review over the game. */
private fun MainActivity.paintHomeGames(tag: String, me: Me.Data?) {
    val box = findViewById<LinearLayout>(R.id.home_games)
    box.removeAllViews()
    val games = Tally.battles(this, tag).sortedByDescending { it.at }.take(5)
    if (games.isEmpty()) {
        box.visibility = View.GONE
        return
    }
    box.visibility = View.VISIBLE
    box.addView(
        Ui.row(this).apply {
            addView(Ui.text(this@paintHomeGames, getString(R.string.home_last_games), 17f, bold = true).grow())
            addView(
                Ui.text(this@paintHomeGames, getString(R.string.home_all_games), 13f, Ui.GOLD, bold = true).apply {
                    val p = Ui.px(this@paintHomeGames, 8)
                    setPadding(p, p, 0, p)
                    setOnClickListener {
                        Stats.event(this@paintHomeGames, "app_last_history")
                        if (Shortcuts.startBubble(this@paintHomeGames, "history")) moveTaskToBack(true)
                        else Toast.makeText(this@paintHomeGames, R.string.status_perm, Toast.LENGTH_SHORT).show()
                    }
                },
            )
        },
    )
    val strip = Ui.row(this, 8).apply { below(4) }
    for (i in 0 until 5) {
        val g = games.getOrNull(i)
        strip.addView(if (g == null) View(this).grow() else gameTile(g, me).grow())
    }
    box.addView(strip)
    gameType(box)
}

private fun MainActivity.gameTile(g: Tally.Battle, me: Me.Data?): View = Ui.column(this, 4).apply {
    background = Ui.rounded(this@gameTile, getColor(R.color.surface), 14)
    clipToOutline = true
    gravity = Gravity.CENTER_HORIZONTAL
    setPadding(0, 0, 0, Ui.px(this@gameTile, 8))
    isClickable = true
    isFocusable = true
    contentDescription = listOfNotNull(
        getString(if (g.win) R.string.last_victory else R.string.last_defeat), g.brawler,
        if (g.fought) "${g.kills}/${g.deaths}" else null,
    ).joinToString(", ")
    addView(View(this@gameTile).apply {
        setBackgroundColor(if (g.win) Ui.VICTORY else 0xFFFF5C72.toInt())
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@gameTile, 6))
    })
    val face = Ui.image(this@gameTile, 42, 10)
    addView(face)
    Ui.load(this@gameTile, face, me?.icons?.get(g.bid))
    addView(
        Ui.text(this@gameTile, if (g.fought) "${g.kills}/${g.deaths}" else "–", 14.5f, if (!g.fought || g.kills == g.deaths) 0xFFEEF1FA.toInt() else if (g.kills > g.deaths) Ui.VICTORY else Ui.LOSS, bold = true, lines = 1).apply { gravity = Gravity.CENTER },
    )
    val mode = ImageView(this@gameTile).apply {
        layoutParams = LinearLayout.LayoutParams(Ui.px(this@gameTile, 18), Ui.px(this@gameTile, 18))
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    addView(mode)
    Ui.load(this@gameTile, mode, g.mode?.let { me?.modeIcons?.get(it) })
    setOnClickListener { openReview(g) }
}

/** One game's full review in the bubble, read from the site first. */
private fun MainActivity.openReview(g: Tally.Battle) {
    val tag = Account.tag(this).ifEmpty { return }
    if (!Shortcuts.startBubble(this, null)) {
        Toast.makeText(this, R.string.status_perm, Toast.LENGTH_SHORT).show()
        return
    }
    val app = applicationContext
    Thread {
        val game = runCatching {
            JSONObject(Http.text("${Http.SITE}/api/bubble/review?tag=$tag&lang=${AppLang.current(app)}&game=${Tally.raw(g.at)}")).optJSONObject("game")
        }.getOrNull()
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            if (game == null) {
                // Gone from the battle log: the history says what is still there.
                Shortcuts.startBubble(this, "history")
                moveTaskToBack(true)
                return@runOnUiThread
            }
            runCatching {
                startService(
                    Intent(this, BubbleService::class.java)
                        .setAction(BubbleService.ACTION_SHOW_REVIEW)
                        .putExtra(BubbleService.EXTRA_TEXT, game.toString()),
                )
            }
            moveTaskToBack(true)
        }
    }.start()
}

/** What stands out: the site's reading against others first, then the phone's own. */
private fun MainActivity.paintHomeCoach(season: SeasonData.Data?, tag: String) {
    val box = findViewById<LinearLayout>(R.id.home_coach)
    box.removeAllViews()
    val lines = coachLines(season).toMutableList()
    val read = Insights.read(this, tag)
    for (line in read.lines) {
        if (lines.size >= 2) break
        if (line is Insights.Line.Brawler) {
            val icon = season?.brawlers?.firstOrNull { it.name.equals(line.name, ignoreCase = true) }?.icon
            lines += Triple(icon, getString(if (line.up) R.string.ins_brawler_up else R.string.ins_brawler_down, line.name, line.pct, line.games), line.up)
        }
    }
    if (lines.isEmpty()) {
        box.visibility = View.GONE
        return
    }
    box.visibility = View.VISIBLE
    box.addView(
        Ui.card(this, 12).apply {
            addView(Ui.text(this@paintHomeCoach, getString(R.string.coach_title), 17f, bold = true))
            for (line in lines) addView(coachRow(line.first, line.second, line.third))
            setOnClickListener {
                selectTab(Tabs.SEASON)
                openSeasonPage(SeasonPages.STATS)
            }
        },
    )
    gameType(box)
}

/** The next quests under the pass card: what is closest to done, three at most. */
internal fun MainActivity.paintPassQuests(week: Pass.Week) {
    val box = findViewById<LinearLayout>(R.id.pass_card_quests)
    box.removeAllViews()
    val next = week.quests.filter { !it.done }.sortedByDescending { it.progress.toDouble() / it.kind.target }.take(3)
    if (next.isEmpty()) {
        box.visibility = View.GONE
        return
    }
    box.visibility = View.VISIBLE
    box.addView(
        Ui.card(this, 10).apply {
            for (q in next) {
                addView(
                    Ui.column(this@paintPassQuests, 5).apply {
                        addView(
                            Ui.row(this@paintPassQuests, 8).apply {
                                addView(Ui.text(this@paintPassQuests, PassText.title(this@paintPassQuests, q), 14f, lines = 2).grow())
                                addView(Ui.text(this@paintPassQuests, "${q.progress.coerceAtMost(q.kind.target)}/${q.kind.target}", 14f, 0xFFC9B8FF.toInt(), bold = true))
                            },
                        )
                        addView(Ui.bar(this@paintPassQuests, q.progress.toDouble() / q.kind.target, 0xFF8B6BFF.toInt(), 7))
                    },
                )
            }
            setOnClickListener { startActivity(Intent(this@paintPassQuests, PassActivity::class.java)) }
        },
    )
    gameType(box)
}

/** The most kills and the most damage in one game, as a second row of records. */
internal fun MainActivity.paintFightRecords(records: Records.Data) {
    val first = findViewById<LinearLayout>(R.id.season_records)
    val parent = first.parent as? LinearLayout ?: return
    parent.findViewWithTag<View>("fight_records")?.let { parent.removeView(it) }
    if (records.kills <= 0) return
    val row = Ui.row(this, 8).apply {
        tag = "fight_records"
        below(8)
        addView(Ui.tile(this@paintFightRecords, records.kills.toString(), getString(R.string.record_kills), Ui.GOLD).grow())
        if (records.damage > 0) addView(Ui.tile(this@paintFightRecords, Combat.short(records.damage), getString(R.string.record_damage), Ui.GOLD).grow())
    }
    parent.addView(row, parent.indexOfChild(first) + 1)
    gameType(row)
}

/** My season stands on its rank's colour, fading into the card. */
internal fun MainActivity.tintSeasonCard(rankIndex: Int) {
    findViewById<View>(R.id.season_card).background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Ui.rankColor(rankIndex), getColor(R.color.surface), getColor(R.color.surface)),
    ).apply {
        cornerRadius = Ui.px(this@tintSeasonCard, 20).toFloat()
        setStroke(Ui.px(this@tintSeasonCard, 3), Ui.OUTLINE)
    }
}

/** A quest in words and its emoji, for the pass screen and Home. */
internal object PassText {
    fun title(activity: android.content.Context, q: Pass.Quest): String = with(activity) {
        when (q.kind) {
            Pass.Kind.PLAY -> getString(R.string.q_play)
            Pass.Kind.WIN, Pass.Kind.WIN_BIG -> getString(R.string.q_win)
            Pass.Kind.STREAK -> getString(R.string.q_streak)
            Pass.Kind.STAR -> getString(R.string.q_star)
            Pass.Kind.BRAWLERS -> getString(R.string.q_brawlers)
            Pass.Kind.MODES -> getString(R.string.q_modes)
            Pass.Kind.GOAL -> getString(R.string.q_goal)
            Pass.Kind.MODE_WIN -> getString(R.string.q_mode_win, Me.last(this)?.modes?.get(q.mode ?: "") ?: q.mode ?: "")
            Pass.Kind.MAIN -> getString(R.string.q_main)
            Pass.Kind.CLEAN_WIN -> getString(R.string.q_clean_win)
            Pass.Kind.KILLS -> getString(R.string.q_kills)
            Pass.Kind.KD_DAY -> getString(R.string.q_kd_day)
            Pass.Kind.DRAFT -> getString(R.string.q_draft)
            Pass.Kind.ASK -> getString(R.string.q_ask)
            Pass.Kind.COUNTERS -> getString(R.string.q_counters)
            Pass.Kind.REVIEW -> getString(R.string.q_review)
            Pass.Kind.REACT -> getString(R.string.q_react)
        }
    }

    fun icon(k: Pass.Kind): String = when (k) {
        Pass.Kind.PLAY -> "🎮"
        Pass.Kind.WIN, Pass.Kind.WIN_BIG -> "🏆"
        Pass.Kind.STREAK -> "🔥"
        Pass.Kind.STAR -> "⭐"
        Pass.Kind.BRAWLERS -> "🧩"
        Pass.Kind.MODES -> "🗺️"
        Pass.Kind.GOAL -> "🎯"
        Pass.Kind.MODE_WIN -> "⚔️"
        Pass.Kind.MAIN -> "💪"
        Pass.Kind.CLEAN_WIN -> "🛡️"
        Pass.Kind.KILLS -> "💥"
        Pass.Kind.KD_DAY -> "⚔️"
        Pass.Kind.DRAFT -> "🧠"
        Pass.Kind.ASK -> "✨"
        Pass.Kind.COUNTERS -> "🛡️"
        Pass.Kind.REVIEW -> "🔍"
        Pass.Kind.REACT -> "👏"
    }
}
