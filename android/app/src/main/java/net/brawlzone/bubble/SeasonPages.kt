package net.brawlzone.bubble

import android.content.Intent
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import net.brawlzone.bubble.Ui.below
import net.brawlzone.bubble.Ui.grow
import java.text.NumberFormat

/**
 * The Season tab's pages (1.45): which season (the running one or the last),
 * then Rank, Stats and Brawlers, changed by a tap or a swipe.
 *
 * Until 1.45 the tab was one long stack of cards about the running season
 * only. The Rank page is the cards it already had; Stats and Brawlers are the
 * site's reading of the season (SeasonData), and the last season has a Rank
 * page of its own because the cards above count on the phone.
 */
internal object SeasonPages {
    const val RANK = 0
    const val STATS = 1
    const val BRAWLERS = 2

    const val NOW = "now"
    const val LAST = "last"

    /** What is open, for as long as the app is. */
    var page = RANK
    var which = NOW
    var sort = 0
    var showAll = false
}

private fun MainActivity.percent(n: Double): String = NumberFormat.getPercentInstance(AppLang.locale(AppLang.current(this))).format(n)
private fun MainActivity.whole(n: Number): String = NumberFormat.getIntegerInstance(AppLang.locale(AppLang.current(this))).format(n)

/** Asks the site for the open season when what is kept is old, then draws again. */
internal fun MainActivity.refreshSeasonData(force: Boolean = false, done: () -> Unit = {}) {
    val which = SeasonPages.which
    if (Account.tag(this).isEmpty() || (!force && !SeasonData.isStale(this, which))) {
        done()
        return
    }
    val app = applicationContext
    Thread {
        SeasonData.fetch(app, which)
        // The last season's number is on the running one's answer: the switch needs both.
        if (which == SeasonPages.LAST && SeasonData.last(app, SeasonPages.NOW) == null) SeasonData.fetch(app, SeasonPages.NOW)
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            paintSeasonPages()
            paintHomeFight()
            done()
        }
    }.start()
}

internal fun MainActivity.openSeasonPage(page: Int) {
    if (page !in SeasonPages.RANK..SeasonPages.BRAWLERS || page == SeasonPages.page) return
    val right = page > SeasonPages.page
    SeasonPages.page = page
    Stats.event(this, "app_season_page", mapOf("page" to listOf("rank", "stats", "brawlers")[page]))
    paintSeasonPages()
    // The new page comes from the side it lives on.
    val shown = when (page) {
        SeasonPages.STATS -> R.id.season_stats_page
        SeasonPages.BRAWLERS -> R.id.season_brawlers_page
        else -> if (SeasonPages.which == SeasonPages.LAST) R.id.season_last_page else R.id.season_rank_page
    }
    findViewById<View>(shown).apply {
        translationX = (if (right) 1 else -1) * Ui.px(this@openSeasonPage, 60).toFloat()
        alpha = 0f
        animate().translationX(0f).alpha(1f).setDuration(190).start()
    }
}

internal fun MainActivity.openSeason(which: String) {
    if (which == SeasonPages.which) return
    SeasonPages.which = which
    SeasonPages.showAll = false
    Stats.event(this, "app_season_which", mapOf("which" to which))
    paintSeasonPages()
    refreshSeasonData()
}

/** The switch, the tabs and the open page. */
internal fun MainActivity.paintSeasonPages() {
    val tag = Account.tag(this)
    val top = findViewById<LinearLayout>(R.id.season_top)
    val rank = findViewById<View>(R.id.season_rank_page)
    val lastPage = findViewById<LinearLayout>(R.id.season_last_page)
    val stats = findViewById<LinearLayout>(R.id.season_stats_page)
    val brawlers = findViewById<LinearLayout>(R.id.season_brawlers_page)
    top.removeAllViews()
    if (tag.isEmpty()) {
        for (v in listOf<View>(top, rank, lastPage, stats, brawlers, findViewById(R.id.season_insights))) v.visibility = View.GONE
        paintExample()
        return
    }
    findViewById<LinearLayout>(R.id.season_example).visibility = View.GONE
    top.visibility = View.VISIBLE

    val now = SeasonData.last(this, SeasonPages.NOW)
    val number = now?.number ?: Season.current(this, tag)?.number ?: Alerts.last(this)?.season?.number
    val lastNumber = now?.lastNumber ?: number?.let { it - 1 }?.takeIf { it > 0 }
    if (number != null && lastNumber != null) {
        top.addView(
            Ui.row(this, 8).apply {
                addView(Ui.chip(this@paintSeasonPages, getString(R.string.season_n, number), SeasonPages.which == SeasonPages.NOW) { openSeason(SeasonPages.NOW) }.grow())
                addView(Ui.chip(this@paintSeasonPages, getString(R.string.season_n, lastNumber), SeasonPages.which == SeasonPages.LAST) { openSeason(SeasonPages.LAST) }.grow())
            },
        )
    }
    top.addView(
        Ui.row(this).apply {
            below(8)
            val labels = listOf(R.string.season_page_rank, R.string.season_page_stats, R.string.season_page_brawlers)
            for ((i, label) in labels.withIndex()) addView(pageTab(getString(label), i == SeasonPages.page) { openSeasonPage(i) }.grow())
        },
    )

    val last = SeasonPages.which == SeasonPages.LAST
    rank.visibility = if (SeasonPages.page == SeasonPages.RANK && !last) View.VISIBLE else View.GONE
    lastPage.visibility = if (SeasonPages.page == SeasonPages.RANK && last) View.VISIBLE else View.GONE
    stats.visibility = if (SeasonPages.page == SeasonPages.STATS) View.VISIBLE else View.GONE
    brawlers.visibility = if (SeasonPages.page == SeasonPages.BRAWLERS) View.VISIBLE else View.GONE

    val data = SeasonData.last(this, SeasonPages.which)
    when {
        SeasonPages.page == SeasonPages.STATS -> paintStats(stats, data)
        SeasonPages.page == SeasonPages.BRAWLERS -> paintBrawlers(brawlers, data)
        last -> paintLastRank(lastPage, data, lastNumber)
        else -> Unit
    }
    paintSeasonShare(number, lastNumber)
    findViewById<View>(R.id.season_insights).visibility = if (SeasonPages.page == SeasonPages.STATS && !last) View.VISIBLE else View.GONE
    gameType(top)
}

/** One of the three page names, a bar under the open one. */
private fun MainActivity.pageTab(label: String, on: Boolean, onTap: () -> Unit): View = Ui.column(this).apply {
    isClickable = true
    isFocusable = true
    isSelected = on
    setOnClickListener { onTap() }
    addView(
        Ui.text(this@pageTab, label, 15.5f, if (on) 0xFFEEF1FA.toInt() else getColor(R.color.muted), bold = true, lines = 1).apply {
            gravity = Gravity.CENTER
            minHeight = Ui.px(this@pageTab, 42)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        },
    )
    addView(
        View(this@pageTab).apply {
            background = Ui.rounded(this@pageTab, if (on) Ui.GOLD else getColor(R.color.surface_2), 3, 0)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@pageTab, if (on) 4 else 2))
        },
    )
}

/** The card buttons name the season they share. */
private fun MainActivity.paintSeasonShare(number: Int?, lastNumber: Int?) {
    val wrapped = findViewById<TextView>(R.id.share_wrapped)
    if (number != null) wrapped.text = getString(R.string.season_card_n, number)
    wrapped.setOnClickListener { Share.season(this, SeasonPages.NOW) { busy -> seasonCardBusy(wrapped, busy, number) } }
    findViewById<TextView>(R.id.share_last)?.apply {
        visibility = if (lastNumber != null) View.VISIBLE else View.GONE
        if (lastNumber != null) text = getString(R.string.season_card_n, lastNumber)
        setOnClickListener { Share.season(this@paintSeasonShare, SeasonPages.LAST) { busy -> seasonCardBusy(this, busy, lastNumber) } }
    }
}

private fun MainActivity.seasonCardBusy(button: TextView, busy: Boolean, number: Int?) {
    button.isEnabled = !busy
    button.alpha = if (busy) 0.6f else 1f
    button.text = if (busy || number == null) getString(R.string.share_making) else getString(R.string.season_card_n, number)
    findViewById<View>(R.id.share_progress).visibility = if (busy) View.VISIBLE else View.GONE
}

// ------------------------------------------------------------------- last season

private fun MainActivity.paintLastRank(box: LinearLayout, data: SeasonData.Data?, number: Int?) {
    box.removeAllViews()
    if (data == null) {
        box.addView(Ui.skeleton(this, listOf(150, 80, 56)))
        return
    }
    val versus = Versus.last(this)?.last?.takeIf { it.number == (data.number ?: number) }
    val (frame, body) = Ui.hero(this, Ui.rankColor(versus?.peak ?: -1))
    Ui.heroArt(this, frame, data.hero, 160)
    body.addView(Ui.text(this, getString(R.string.season_n, data.number ?: number ?: 0), 26f, bold = true))
    if (versus?.peakRank != null) {
        body.addView(
            Ui.row(this, 10).apply {
                val badge = Ui.image(this@paintLastRank, 54, 0)
                addView(badge)
                Ui.load(this@paintLastRank, badge, versus.peakIcon)
                addView(
                    Ui.column(this@paintLastRank).apply {
                        addView(Ui.text(this@paintLastRank, versus.peakRank, 21f, bold = true))
                        addView(Ui.text(this@paintLastRank, getString(R.string.season_best), 12.5f, 0xFFFFE0B0.toInt()))
                    },
                )
            },
        )
    }
    val top = data.brawlers.firstOrNull()
    if (top != null) body.addView(Ui.text(this, getString(R.string.season_most_played, top.name, top.games), 13.5f, 0xFFFFF0C2.toInt()))
    box.addView(frame)
    if (data.games == 0) {
        box.addView(Ui.text(this, getString(R.string.season_no_games), 14f, Ui.MUTED).below(12))
    } else {
        box.addView(
            Ui.row(this, 8).apply {
                below(12)
                addView(Ui.tile(this@paintLastRank, whole(data.games), getString(R.string.stat_games)).grow())
                addView(Ui.tile(this@paintLastRank, percent(data.wins.toDouble() / data.games), getString(R.string.stat_won), Ui.GOLD).grow())
                addView(Ui.tile(this@paintLastRank, "${whole(data.wins)}–${whole(data.games - data.wins)}", getString(R.string.stat_record)).grow())
            },
        )
        box.addView(Ui.winBar(this, data.wins, data.games, 10).below(10))
    }
    box.addView(
        Ui.button(this, getString(R.string.season_card_n, data.number ?: number ?: 0)) {
            Share.season(this, SeasonPages.LAST) { }
        }.below(14),
    )
    gameType(box)
}

// ------------------------------------------------------------------------- stats

private fun MainActivity.paintStats(box: LinearLayout, data: SeasonData.Data?) {
    box.removeAllViews()
    if (data == null) {
        box.addView(Ui.skeleton(this, listOf(150, 220, 180)))
        return
    }
    val mine = data.mine
    if (mine == null) {
        box.addView(
            Ui.card(this).apply {
                addView(Ui.text(this@paintStats, getString(R.string.kd_title), 19f, bold = true))
                addView(Ui.text(this@paintStats, getString(if (data.which == SeasonPages.LAST) R.string.kd_none_last else R.string.kd_soon), 14f, Ui.MUTED))
            },
        )
    } else {
        val others = data.others
        val (frame, body) = Ui.hero(this, if (mine.kd >= 1) 0xFF14603F.toInt() else 0xFF7A1A2C.toInt())
        Ui.heroArt(this, frame, data.hero, 168)
        body.addView(Ui.text(this, getString(R.string.kd_title), 14f, 0xFFE6FFF2.toInt(), bold = true))
        val big = Ui.text(this, "", 58f, bold = true).apply { includeFontPadding = false }
        body.addView(big)
        Ui.countTo(big, "kd_${data.which}", mine.kd) { Combat.ratio(it) }
        if (others != null) body.addView(Ui.text(this, getString(R.string.kd_others, Combat.ratio(others.kd)), 13.5f).apply { maxWidth = Ui.px(this@paintStats, 190) })
        body.addView(Ui.text(this, getString(R.string.kd_from, data.fought), 12f, 0xFFD6EFE2.toInt()))
        box.addView(frame)

        if (others != null) {
            box.addView(
                Ui.card(this, 13).apply {
                    below(12)
                    addView(
                        Ui.row(this@paintStats).apply {
                            addView(Ui.text(this@paintStats, getString(R.string.you_others), 17f, bold = true).grow())
                            addView(legend(Ui.GOLD, getString(R.string.you)))
                            addView(legend(Ui.OTHER, getString(R.string.others)))
                        },
                    )
                    addView(compare(getString(R.string.stat_kills), mine.kills, others.kills, false) { Combat.one(it) })
                    addView(compare(getString(R.string.stat_deaths), mine.deaths, others.deaths, true) { Combat.one(it) })
                    addView(compare(getString(R.string.stat_damage), mine.damage, others.damage, false) { whole(Math.round(it)) })
                    if (others.healing >= 30 || mine.healing >= 30) addView(compare(getString(R.string.stat_healing), mine.healing, others.healing, false) { whole(Math.round(it)) })
                    addView(compare(getString(R.string.stat_deathless), mine.deathless, others.deathless, false) { percent(it) })
                    addView(compare(getString(R.string.stat_star), mine.star, others.star, false) { percent(it) })
                },
            )
        }
    }

    val lines = coachLines(data)
    if (lines.isNotEmpty()) {
        box.addView(
            Ui.card(this, 12).apply {
                below(12)
                addView(Ui.text(this@paintStats, getString(R.string.coach_title), 17f, bold = true))
                for (line in lines) addView(coachRow(line.first, line.second, line.third))
            },
        )
    }

    val modes = data.modes.filter { it.games >= 2 }
    if (modes.isNotEmpty()) {
        box.addView(
            Ui.card(this, 0).apply {
                below(12)
                addView(modeRow(null, getString(R.string.by_mode), getString(R.string.kd), getString(R.string.stat_deaths_short), getString(R.string.stat_won), head = true))
                for (m in modes) {
                    addView(View(this@paintStats).apply {
                        setBackgroundColor(getColor(R.color.surface_3))
                        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@paintStats, 1))
                    })
                    addView(
                        modeRow(
                            m.icon, m.label,
                            m.mine?.let { Combat.ratio(it.kd) } ?: "–",
                            m.mine?.let { Combat.one(it.deaths) } ?: "–",
                            percent(m.wins.toDouble() / m.games),
                            kdColor = m.mine?.let { if (it.kd >= 1) Ui.VICTORY else Ui.LOSS },
                            deathColor = m.mine?.let { a -> m.others?.let { b -> if (a.deaths > b.deaths * 1.15) Ui.LOSS else if (a.deaths < b.deaths * 0.85) Ui.VICTORY else null } },
                            winColor = if (m.games >= 5) (if (m.wins * 2 >= m.games) Ui.VICTORY else Ui.LOSS) else null,
                        ),
                    )
                }
            },
        )
    }
    gameType(box)
}

private fun MainActivity.legend(color: Int, label: String): View = Ui.row(this, 6).apply {
    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart = Ui.px(this@legend, 12) }
    addView(View(this@legend).apply {
        background = Ui.rounded(this@legend, color, 3, 0)
        layoutParams = LinearLayout.LayoutParams(Ui.px(this@legend, 10), Ui.px(this@legend, 10))
    })
    addView(Ui.text(this@legend, label, 12f, Ui.MUTED))
}

/** A number of yours over the others' number, as two bars; green or red when they are a twentieth apart. */
private fun MainActivity.compare(label: String, mine: Double, others: Double, low: Boolean, show: (Double) -> String): View = Ui.column(this, 5).apply {
    val apart = Math.abs(mine - others) > Math.abs(others) * 0.05
    val good = (mine > others) != low
    val top = maxOf(mine, others, 0.0001) * 1.15
    addView(
        Ui.row(this@compare).apply {
            addView(Ui.text(this@compare, label, 14f).grow())
            addView(Ui.text(this@compare, show(mine), 15f, if (!apart) 0xFFEEF1FA.toInt() else if (good) Ui.VICTORY else Ui.LOSS, bold = true))
            addView(Ui.text(this@compare, "  ${show(others)}", 13f, getColor(R.color.muted)))
        },
    )
    addView(Ui.bar(this@compare, mine / top, Ui.GOLD, 8))
    addView(Ui.bar(this@compare, others / top, Ui.OTHER, 5))
}

private fun MainActivity.modeRow(
    icon: String?, label: String, kd: String, deaths: String, won: String, head: Boolean = false,
    kdColor: Int? = null, deathColor: Int? = null, winColor: Int? = null,
): View = Ui.row(this).apply {
    minimumHeight = Ui.px(this@modeRow, if (head) 30 else 42)
    if (icon != null) {
        val view = Ui.image(this@modeRow, 24, 0).apply { scaleType = android.widget.ImageView.ScaleType.FIT_CENTER }
        addView(view)
        Ui.load(this@modeRow, view, icon)
    }
    addView(Ui.text(this@modeRow, label, if (head) 17f else 15f, bold = head, lines = 1).apply { setPadding(if (icon != null) Ui.px(this@modeRow, 8) else 0, 0, 0, 0) }.grow())
    fun cell(value: String, color: Int?, width: Int) = addView(
        Ui.text(this@modeRow, value, if (head) 12f else 15f, if (head) Ui.MUTED else color ?: 0xFFEEF1FA.toInt(), bold = !head, lines = 1).apply {
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(Ui.px(this@modeRow, width), LinearLayout.LayoutParams.WRAP_CONTENT)
        },
    )
    cell(kd, kdColor, 54)
    cell(deaths, deathColor, 58)
    cell(won, winColor, 58)
}

/** What stands out, in words: (icon, text, good). */
internal fun MainActivity.coachLines(data: SeasonData.Data?): List<Triple<String?, String, Boolean>> = data?.coach.orEmpty().map { c ->
    if (c.kind == "deaths") Triple(c.icon, getString(R.string.coach_deaths, Combat.one(c.mine), c.label, Combat.one(c.others)), false)
    else Triple(c.icon, getString(R.string.coach_kd, Combat.ratio(c.mine), c.label, Combat.ratio(c.others)), true)
}

internal fun MainActivity.coachRow(icon: String?, line: String, good: Boolean): View = Ui.row(this, 12).apply {
    val holder = FrameLayout(this@coachRow).apply {
        background = Ui.rounded(this@coachRow, if (good) 0xFF0F4A30.toInt() else 0xFF4A1526.toInt(), 12, 0)
        layoutParams = LinearLayout.LayoutParams(Ui.px(this@coachRow, 42), Ui.px(this@coachRow, 42))
    }
    val view = Ui.image(this@coachRow, 26, 0).apply { scaleType = android.widget.ImageView.ScaleType.FIT_CENTER }
    holder.addView(view, FrameLayout.LayoutParams(Ui.px(this@coachRow, 26), Ui.px(this@coachRow, 26), Gravity.CENTER))
    Ui.load(this@coachRow, view, icon)
    addView(holder)
    addView(Ui.text(this@coachRow, line, 14f).grow())
}

// ---------------------------------------------------------------------- brawlers

private fun MainActivity.paintBrawlers(box: LinearLayout, data: SeasonData.Data?) {
    box.removeAllViews()
    if (data == null) {
        box.addView(Ui.skeleton(this, listOf(44, 170, 64, 64, 64, 64)))
        return
    }
    if (data.brawlers.isEmpty()) {
        box.addView(Ui.text(this, getString(R.string.season_no_games), 14f, Ui.MUTED))
        return
    }
    val labels = listOf(R.string.sort_played, R.string.sort_wins, R.string.sort_kd)
    box.addView(
        Ui.row(this, 8).apply {
            for ((i, label) in labels.withIndex()) addView(
                Ui.chip(this@paintBrawlers, getString(label), SeasonPages.sort == i) {
                    SeasonPages.sort = i
                    paintSeasonPages()
                }.grow(),
            )
        },
    )
    val list = when (SeasonPages.sort) {
        // Five games before a rate counts, or one lucky game tops the list.
        1 -> data.brawlers.filter { it.games >= 5 }.sortedWith(compareByDescending<SeasonData.Row> { it.rate }.thenByDescending { it.games })
        2 -> data.brawlers.filter { it.kd != null && it.games >= 5 }.sortedByDescending { it.kd }
        else -> data.brawlers
    }
    if (list.isEmpty()) {
        box.addView(Ui.text(this, getString(if (SeasonPages.sort == 2) R.string.kd_soon else R.string.season_few_games), 14f, Ui.MUTED).below(12))
        return
    }
    val top = list.first()
    val (frame, body) = Ui.hero(this, top.color?.let { darker(it) } ?: 0xFF3550B8.toInt())
    frame.below(12)
    // The site sends the most played brawler's art; any other leads with its face.
    if (top.id == data.brawlers.first().id) Ui.heroArt(this, frame, data.hero, 160)
    body.addView(Ui.text(this, getString(labels[SeasonPages.sort]), 13f, 0xFFFFF0C2.toInt(), bold = true))
    body.addView(Ui.text(this, top.name, 30f, bold = true, lines = 1))
    body.addView(
        Ui.row(this, 18).apply {
            fun stat(value: String, label: Int) = addView(
                Ui.column(this@paintBrawlers).apply {
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    addView(Ui.text(this@paintBrawlers, value, 20f, bold = true))
                    addView(Ui.text(this@paintBrawlers, getString(label), 12f, 0xFFFFF0C2.toInt()))
                },
            )
            stat(whole(top.games), R.string.stat_games)
            stat(percent(top.rate), R.string.stat_won)
            top.kd?.let { stat(Combat.ratio(it), R.string.kd) }
        },
    )
    top.ban?.takeIf { it >= 0.01 }?.let { body.addView(Ui.text(this, getString(R.string.ban_at_rank, percent(it)), 13f)) }
    box.addView(frame)

    val rest = list.drop(1)
    val shown = if (SeasonPages.showAll) rest else rest.take(9)
    for (row in shown) box.addView(brawlerRow(row).below(9))
    if (shown.size < rest.size) {
        box.addView(
            Ui.button(this, getString(R.string.show_all, list.size), gold = false) {
                SeasonPages.showAll = true
                paintSeasonPages()
            }.below(12),
        )
    }
    gameType(box)
}

private fun MainActivity.brawlerRow(b: SeasonData.Row): View = Ui.row(this, 12).apply {
    setBackgroundResource(R.drawable.card_surface)
    val p = Ui.px(this@brawlerRow, 9)
    setPadding(p, p, Ui.px(this@brawlerRow, 14), p)
    val face = Ui.image(this@brawlerRow, 48, 13)
    addView(face)
    Ui.load(this@brawlerRow, face, b.icon)
    addView(
        Ui.column(this@brawlerRow, 5).apply {
            addView(
                Ui.row(this@brawlerRow).apply {
                    addView(Ui.text(this@brawlerRow, b.name, 16f, bold = true, lines = 1).grow())
                    addView(Ui.text(this@brawlerRow, getString(R.string.games_n, b.games), 12f, Ui.MUTED))
                },
            )
            addView(Ui.winBar(this@brawlerRow, b.wins, b.games, 7))
        }.grow(),
    )
    addView(
        Ui.column(this@brawlerRow).apply {
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(Ui.px(this@brawlerRow, 74), LinearLayout.LayoutParams.WRAP_CONTENT)
            addView(Ui.text(this@brawlerRow, percent(b.rate), 18f, if (b.games < 5) 0xFFEEF1FA.toInt() else if (b.rate >= 0.5) Ui.VICTORY else Ui.LOSS, bold = true).apply { gravity = Gravity.END })
            b.kd?.let { addView(Ui.text(this@brawlerRow, "${getString(R.string.kd)} ${Combat.ratio(it)}", 12f, if (it >= 1) Ui.VICTORY else Ui.LOSS, bold = true).apply { gravity = Gravity.END }) }
        },
    )
}

private fun darker(color: Int): Int {
    fun c(shift: Int) = (((color shr shift) and 0xFF) * 0.52f).toInt()
    return (0xFF shl 24) or (c(16) shl 16) or (c(8) shl 8) or c(0)
}

// ------------------------------------------------------------------- no tag yet

/** What the tab looks like once a tag is in, so the empty one says something (1.45). */
private fun MainActivity.paintExample() {
    val box = findViewById<LinearLayout>(R.id.season_example)
    box.visibility = View.VISIBLE
    if (box.childCount > 0) return
    box.addView(Ui.caption(this, getString(R.string.example)))
    val (frame, body) = Ui.hero(this, 0xFF7A1A2C.toInt())
    frame.alpha = 0.92f
    body.addView(Ui.text(this, "${getString(R.string.rank_legendary)} III", 24f, bold = true))
    body.addView(Ui.text(this, getString(R.string.widget_elo, whole(7120)), 15f, 0xFFFFE0B0.toInt(), bold = true))
    body.addView(Ui.bar(this, 0.62, Ui.GOLD, 10))
    body.addView(
        Ui.row(this, 8).apply {
            below(4)
            addView(Ui.tile(this@paintExample, whole(212), getString(R.string.stat_games), filled = false).grow())
            addView(Ui.tile(this@paintExample, percent(0.57), getString(R.string.stat_won), filled = false).grow())
            addView(Ui.tile(this@paintExample, "1.14", getString(R.string.kd), filled = false).grow())
            addView(Ui.tile(this@paintExample, "9", getString(R.string.record_streak), filled = false).grow())
        },
    )
    box.addView(frame.below(6))
    gameType(box)
}

/** The whole season on the site (the profile's Ranked tab). */
internal fun MainActivity.openSiteSeason() {
    val tag = Account.tag(this)
    if (tag.isEmpty()) return
    val lang = AppLang.current(this).lowercase().substringBefore('-')
    val prefix = if (lang in setOf("es", "pt", "tr", "de", "ru", "fr")) "/$lang" else ""
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("${Http.SITE}$prefix/player/$tag#ranked"))) }
}
