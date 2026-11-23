package net.brawlzone.bubble

import android.content.Context
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlin.math.roundToInt

/**
 * "Your Ranked, read" (1.43): what wins for this player, from the Ranked games
 * this phone has kept (Tally, 30 days). Nothing is sent anywhere.
 *
 * Four kinds of line, each only when the numbers carry it: the best and worst
 * part of the day (6-hour blocks, 8+ games each, 10+ points apart), the
 * brawler winning most and the one losing most (6+ games, at least 55% /
 * at most 45%), and the best mode (6+ games). Below 15 games it says how many
 * more it needs instead.
 */
object Insights {
    const val MIN_GAMES = 15
    private const val MIN_BLOCK = 8
    private const val MIN_PICK = 6

    sealed class Line {
        data class Hours(val best: Boolean, val from: Int, val to: Int, val pct: Int) : Line()
        data class Brawler(val up: Boolean, val name: String, val pct: Int, val games: Int) : Line()
        data class Mode(val key: String, val pct: Int) : Line()
    }

    data class Read(val games: Int, val lines: List<Line>)

    private fun pct(wins: Int, games: Int) = (wins * 100.0 / games).roundToInt()

    fun read(context: Context, tag: String): Read {
        val games = Tally.battles(context, tag)
        if (games.size < MIN_GAMES) return Read(games.size, emptyList())
        val zone = ZoneId.systemDefault()
        val lines = mutableListOf<Line>()

        val blocks = games.groupBy { Instant.ofEpochMilli(it.at).atZone(zone).hour / 6 }
            .filterValues { it.size >= MIN_BLOCK }
            .mapValues { (_, list) -> pct(list.count { it.win }, list.size) }
        if (blocks.size >= 2) {
            val best = blocks.maxByOrNull { it.value }!!
            val worst = blocks.minByOrNull { it.value }!!
            if (best.value - worst.value >= 10) {
                lines += Line.Hours(true, best.key * 6, best.key * 6 + 6, best.value)
                lines += Line.Hours(false, worst.key * 6, worst.key * 6 + 6, worst.value)
            }
        }

        val picks = games.filter { it.brawler != null }.groupBy { it.brawler!! }
            .filterValues { it.size >= MIN_PICK }
            .map { (name, list) -> Triple(name, pct(list.count { it.win }, list.size), list.size) }
        picks.maxByOrNull { it.second }?.takeIf { it.second >= 55 }?.let { lines += Line.Brawler(true, it.first, it.second, it.third) }
        picks.minByOrNull { it.second }?.takeIf { it.second <= 45 }?.let { lines += Line.Brawler(false, it.first, it.second, it.third) }

        games.filter { it.mode != null }.groupBy { it.mode!! }
            .filterValues { it.size >= MIN_PICK }
            .maxByOrNull { (_, list) -> list.count { it.win } * 1.0 / list.size }
            ?.let { (key, list) -> lines += Line.Mode(key, pct(list.count { it.win }, list.size)) }

        return Read(games.size, lines)
    }

    /** "18:00" or "6:00 PM", as the phone writes times. */
    fun hour(context: Context, h: Int): String =
        LocalTime.of(h % 24, 0).format(
            DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(AppLang.locale(AppLang.current(context))),
        )
}
