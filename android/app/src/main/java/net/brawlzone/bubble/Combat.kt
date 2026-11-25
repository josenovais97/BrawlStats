package net.brawlzone.bubble

import android.content.Context
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

/**
 * Kills and deaths (1.45), summed from the games the phone keeps (Tally).
 *
 * The battle log carries them since November 2026, so older games simply do
 * not count here: every figure is over the games that have numbers, and says
 * nothing until there are a few.
 */
object Combat {

    /** Fewer games with numbers than this and no K/D is shown. */
    const val MIN_GAMES = 3

    data class Sum(val games: Int, val kills: Int, val deaths: Int, val damage: Long) {
        /** Kills per death; with no death at all, the kills. */
        val kd get() = kills.toDouble() / maxOf(1, deaths)
        val killsPerGame get() = if (games == 0) 0.0 else kills.toDouble() / games
        val deathsPerGame get() = if (games == 0) 0.0 else deaths.toDouble() / games
    }

    fun of(games: List<Tally.Battle>): Sum {
        val with = games.filter { it.fought }
        return Sum(with.size, with.sumOf { it.kills }, with.sumOf { it.deaths }, with.sumOf { maxOf(0, it.damage).toLong() })
    }

    fun between(context: Context, tag: String, from: Long, to: Long = Long.MAX_VALUE): Sum =
        of(Tally.battles(context, tag).filter { it.at in from until to })

    fun today(context: Context, tag: String): Sum {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        return of(Tally.battles(context, tag).filter { Instant.ofEpochMilli(it.at).atZone(zone).toLocalDate() == today })
    }

    fun thisWeek(context: Context, tag: String): Sum = between(context, tag, Duel.weekStart().toInstant().toEpochMilli())

    /** "1.23", always with a point, the way the game's community writes it. */
    fun ratio(kd: Double): String = DecimalFormat("0.00", DecimalFormatSymbols(Locale.US)).format(kd)

    /** "2.4": kills or deaths a game. */
    fun one(n: Double): String = DecimalFormat("0.0", DecimalFormatSymbols(Locale.US)).format(n)

    /** "38.2k" from 38214. */
    fun short(n: Int): String =
        if (n >= 1000) DecimalFormat(if (n >= 100_000) "0" else "0.0", DecimalFormatSymbols(Locale.US)).format(n / 1000.0) + "k" else n.toString()
}
