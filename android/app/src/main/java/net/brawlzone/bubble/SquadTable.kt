package net.brawlzone.bubble

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import net.brawlzone.bubble.Ui.below
import net.brawlzone.bubble.Ui.grow
import java.io.File
import java.text.NumberFormat

/**
 * The squad's week as a table (1.45): wins, K/D and kills from Monday, for
 * the player and each friend, sorted by any of the three, and the player
 * against one friend side by side. All from the games the phone keeps
 * (Tally), so it sends nothing and works for every friend alike.
 */
internal object SquadTable {
    const val WINS = 0
    const val KD = 1
    const val KILLS = 2
    var sort = WINS
    var against: String? = null

    data class Row(val data: Me.Data, val you: Boolean, val wins: Int, val games: Int, val fight: Combat.Sum)

    fun rows(activity: MainActivity): List<Row> {
        val from = Duel.weekStart().toInstant().toEpochMilli()
        fun row(d: Me.Data, you: Boolean): Row {
            val games = Tally.battles(activity, d.tag).filter { it.at >= from }
            return Row(d, you, games.count { it.win }, games.size, Combat.of(games))
        }
        val list = mutableListOf<Row>()
        Me.last(activity)?.let { list += row(it, true) }
        for (tag in Friends.tags(activity)) Friends.last(activity, tag)?.let { list += row(it, false) }
        return when (sort) {
            KD -> list.sortedWith(compareByDescending<Row> { if (it.fight.games >= Combat.MIN_GAMES) it.fight.kd else -1.0 }.thenByDescending { it.wins })
            KILLS -> list.sortedWith(compareByDescending<Row> { it.fight.kills }.thenByDescending { it.wins })
            else -> list.sortedWith(compareByDescending<Row> { it.wins }.thenBy { it.games })
        }
    }
}

internal fun MainActivity.paintSquadTable() {
    val box = findViewById<LinearLayout>(R.id.squad_table)
    val versus = findViewById<LinearLayout>(R.id.squad_versus)
    box.removeAllViews()
    versus.removeAllViews()
    val rows = if (Account.tag(this).isEmpty() || Friends.tags(this).isEmpty()) emptyList() else SquadTable.rows(this)
    if (rows.none { !it.you } || rows.none { it.you }) {
        box.visibility = View.GONE
        versus.visibility = View.GONE
        return
    }
    box.visibility = View.VISIBLE
    val kills = NumberFormat.getIntegerInstance(AppLang.locale(AppLang.current(this)))
    box.addView(
        Ui.card(this, 0).apply {
            setPadding(Ui.px(this@paintSquadTable, 14), Ui.px(this@paintSquadTable, 10), Ui.px(this@paintSquadTable, 14), Ui.px(this@paintSquadTable, 6))
            addView(
                Ui.row(this@paintSquadTable).apply {
                    minimumHeight = Ui.px(this@paintSquadTable, 40)
                    addView(Ui.text(this@paintSquadTable, getString(R.string.squad_week), 17f, bold = true).grow())
                    for ((i, label) in listOf(R.string.squad_wins, R.string.kd, R.string.squad_kills).withIndex()) {
                        addView(
                            Ui.text(this@paintSquadTable, getString(label), 12.5f, if (SquadTable.sort == i) Ui.GOLD else Ui.MUTED, bold = SquadTable.sort == i, lines = 1).apply {
                                gravity = Gravity.END or Gravity.CENTER_VERTICAL
                                layoutParams = LinearLayout.LayoutParams(Ui.px(this@paintSquadTable, 58), Ui.px(this@paintSquadTable, 40))
                                setOnClickListener {
                                    SquadTable.sort = i
                                    paintSquadTable()
                                }
                            },
                        )
                    }
                },
            )
            for ((i, r) in rows.withIndex()) {
                addView(View(this@paintSquadTable).apply {
                    setBackgroundColor(getColor(R.color.surface_3))
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@paintSquadTable, 1))
                })
                addView(
                    Ui.row(this@paintSquadTable, 9).apply {
                        minimumHeight = Ui.px(this@paintSquadTable, 52)
                        if (r.you) background = Ui.rounded(this@paintSquadTable, 0x33FFC53D, 12, 0)
                        val leads = i == 0 && (if (SquadTable.sort == SquadTable.WINS) r.wins > 0 else r.fight.games > 0)
                        addView(
                            Ui.text(this@paintSquadTable, if (leads) "👑" else (i + 1).toString(), 14f, Ui.GOLD, bold = true).apply {
                                gravity = Gravity.CENTER
                                layoutParams = LinearLayout.LayoutParams(Ui.px(this@paintSquadTable, 26), LinearLayout.LayoutParams.WRAP_CONTENT)
                            },
                        )
                        val icon = Ui.image(this@paintSquadTable, 34, 10)
                        addView(icon)
                        Ui.load(this@paintSquadTable, icon, r.data.iconUrl)
                        addView(Ui.text(this@paintSquadTable, if (r.you) getString(R.string.you) else r.data.name, 15f, if (r.you) Ui.GOLD else 0xFFEEF1FA.toInt(), bold = true, lines = 1).grow())
                        fun cell(value: String, on: Boolean, color: Int = 0xFFEEF1FA.toInt()) = addView(
                            Ui.text(this@paintSquadTable, value, 15f, color, bold = on, lines = 1).apply {
                                gravity = Gravity.END
                                layoutParams = LinearLayout.LayoutParams(Ui.px(this@paintSquadTable, 49), LinearLayout.LayoutParams.WRAP_CONTENT)
                            },
                        )
                        cell(r.wins.toString(), SquadTable.sort == SquadTable.WINS)
                        val known = r.fight.games >= Combat.MIN_GAMES
                        cell(if (known) Combat.ratio(r.fight.kd) else "–", SquadTable.sort == SquadTable.KD, if (!known) Ui.MUTED else if (r.fight.kd >= 1) Ui.VICTORY else Ui.LOSS)
                        cell(if (r.fight.games > 0) kills.format(r.fight.kills) else "–", SquadTable.sort == SquadTable.KILLS)
                        if (!r.you) {
                            isClickable = true
                            isFocusable = true
                            setOnClickListener {
                                SquadTable.against = r.data.tag
                                Stats.event(this@paintSquadTable, "app_squad_versus")
                                paintSquadTable()
                            }
                        }
                    },
                )
            }
        },
    )
    gameType(box)

    val me = rows.first { it.you }
    val friend = rows.firstOrNull { !it.you && it.data.tag == SquadTable.against } ?: rows.first { !it.you }
    versus.visibility = View.VISIBLE
    val card = versusCard(me, friend)
    versus.addView(card)
    versus.addView(Ui.button(this, getString(R.string.squad_share)) { shareVersus(card) }.below(10))
    gameType(versus)
}

/** You and a friend, number by number. */
private fun MainActivity.versusCard(me: SquadTable.Row, friend: SquadTable.Row): LinearLayout = Ui.card(this, 12).apply {
    val fmt = NumberFormat.getIntegerInstance(AppLang.locale(AppLang.current(this@versusCard)))
    val pct = NumberFormat.getPercentInstance(AppLang.locale(AppLang.current(this@versusCard)))
    addView(
        Ui.row(this@versusCard, 8).apply {
            val a = Ui.image(this@versusCard, 46, 13)
            addView(a)
            Ui.load(this@versusCard, a, me.data.iconUrl)
            addView(Ui.text(this@versusCard, getString(R.string.you), 16f, Ui.GOLD, bold = true, lines = 1).grow())
            addView(Ui.text(this@versusCard, "VS", 18f, Ui.MUTED, bold = true))
            addView(Ui.text(this@versusCard, friend.data.name, 16f, bold = true, lines = 1).apply { gravity = Gravity.END }.grow())
            val b = Ui.image(this@versusCard, 46, 13)
            addView(b)
            Ui.load(this@versusCard, b, friend.data.iconUrl)
        },
    )
    fun line(label: String, a: Double?, b: Double?, show: (Double) -> String) {
        if (a == null || b == null) return
        addView(
            Ui.column(this@versusCard, 5).apply {
                addView(
                    Ui.row(this@versusCard).apply {
                        addView(Ui.text(this@versusCard, show(a), 15.5f, if (a > b) Ui.VICTORY else 0xFFEEF1FA.toInt(), bold = true).grow())
                        addView(Ui.text(this@versusCard, label, 12.5f, Ui.MUTED))
                        addView(Ui.text(this@versusCard, show(b), 15.5f, if (b > a) Ui.VICTORY else 0xFFEEF1FA.toInt(), bold = true).apply { gravity = Gravity.END }.grow())
                    },
                )
                addView(
                    LinearLayout(this@versusCard).apply {
                        orientation = LinearLayout.HORIZONTAL
                        background = Ui.rounded(this@versusCard, Ui.TRACK, 8, 0)
                        clipToOutline = true
                        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Ui.px(this@versusCard, 8))
                        val total = (a + b).takeIf { it > 0 } ?: 1.0
                        fun part(n: Double, color: Int) = addView(
                            View(this@versusCard).apply { setBackgroundColor(color) },
                            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, (n / total).toFloat().coerceAtLeast(0.02f)),
                        )
                        part(a, Ui.GOLD)
                        part(b, Ui.OTHER)
                    },
                )
            },
        )
    }
    val known = me.fight.games >= Combat.MIN_GAMES && friend.fight.games >= Combat.MIN_GAMES
    line(getString(R.string.today_elo), me.data.elo?.toDouble(), friend.data.elo?.toDouble()) { fmt.format(it.toInt()) }
    line(getString(R.string.squad_wins), me.wins.toDouble(), friend.wins.toDouble()) { fmt.format(it.toInt()) }
    if (me.games >= 3 && friend.games >= 3) line(getString(R.string.stat_won), me.wins.toDouble() / me.games, friend.wins.toDouble() / friend.games) { pct.format(it) }
    if (known) {
        line(getString(R.string.kd), me.fight.kd, friend.fight.kd) { Combat.ratio(it) }
        line(getString(R.string.stat_kills), me.fight.killsPerGame, friend.fight.killsPerGame) { Combat.one(it) }
        line(getString(R.string.stat_damage_game), me.fight.damage.toDouble() / me.fight.games, friend.fight.damage.toDouble() / friend.fight.games) { Combat.short(it.toInt()) }
    }
    addView(Ui.text(this@versusCard, getString(R.string.squad_since_monday), 11.5f, Ui.MUTED))
}

/** The card as a picture, through the same share sheet as the others. */
private fun MainActivity.shareVersus(card: View) {
    if (card.width == 0 || card.height == 0) return
    val pad = Ui.px(this, 18)
    val bitmap = Bitmap.createBitmap(card.width + pad * 2, card.height + pad * 2, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(getColor(R.color.background))
    canvas.translate(pad.toFloat(), pad.toFloat())
    card.draw(canvas)
    val app = applicationContext
    Thread {
        val file = runCatching {
            val dir = File(app.cacheDir, "share").apply { mkdirs() }
            File(dir, "duel.png").also { f -> f.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } }
        }.getOrNull()
        runOnUiThread {
            if (file == null || isFinishing || isDestroyed) return@runOnUiThread
            Stats.event(this, "app_squad_share")
            Share.sendFile(this, file, "duel", getString(R.string.share_text))
        }
    }.start()
}
