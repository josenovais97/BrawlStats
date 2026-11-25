package net.brawlzone.bubble

import android.content.Context
import org.json.JSONArray
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Ranked games kept on the phone (1.40), per player tag.
 *
 * The battle log only ever holds the last 25 games, so each hourly look adds
 * the ones it has not seen and the app builds its own short history. That
 * history feeds the daily goal and streak (Goal), each friend's week
 * (Friends) and the season tally (Season).
 *
 * Thirty days are kept since 1.43 (eight before), enough for "today", "this
 * week" and the Season tab's insights. A game older than that is never
 * treated as new, so a player who stops for a while does not have the same
 * 25 games counted again on every check.
 */
object Tally {

    /** 1.42 adds the mode key and the star player flag, for the squad feed (older rows have neither). */
    data class Battle(
        val at: Long,
        val win: Boolean,
        val brawler: String?,
        val mode: String? = null,
        val star: Boolean = false,
        /** 1.45: the player's kills, deaths and damage in the game; -1 when the log had none. */
        val kills: Int = -1,
        val deaths: Int = -1,
        val damage: Int = -1,
        val bid: Int = 0,
        val map: String? = null,
    ) {
        /** Whether the game carries its numbers (the battle log does since November 2026). */
        val fought get() = kills >= 0 && deaths >= 0
    }

    private fun of(at: Long, g: Me.Game) =
        Battle(at, g.win, g.brawler, g.mode, g.star, g.kills, g.deaths, g.damage, g.bid, g.map)

    /** A game of the battle log as Tally keeps it, or null when its time cannot be read. */
    fun of(g: Me.Game): Battle? = time(g.time)?.let { of(it, g) }

    private const val PREFS = "brawlzone-tally"
    private const val DAY_MS = 24L * 60 * 60 * 1000
    private const val KEEP_MS = 30 * DAY_MS
    private val BATTLE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'")

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun time(raw: String): Long? =
        runCatching { LocalDateTime.parse(raw, BATTLE_TIME).toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull()

    /** The game's time as the site writes it ("20261109T151120.000Z"). */
    fun raw(at: Long): String = BATTLE_TIME.format(LocalDateTime.ofEpochSecond(at / 1000, ((at % 1000) * 1_000_000).toInt(), ZoneOffset.UTC))

    fun battles(context: Context, tag: String): List<Battle> {
        val raw = prefs(context).getString("b_$tag", null) ?: return emptyList()
        val a = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val row = a.optJSONArray(i) ?: return@mapNotNull null
            Battle(
                row.optLong(0),
                row.optInt(1) == 1,
                row.optString(2).takeIf { it.isNotEmpty() },
                row.optString(3).takeIf { it.isNotEmpty() },
                row.optInt(4) == 1,
                row.optInt(5, -1),
                row.optInt(6, -1),
                row.optInt(7, -1),
                row.optInt(8, 0),
                row.optString(9).takeIf { it.isNotEmpty() },
            )
        }
    }

    /** Whether this tag has been looked at before (its first look announces nothing). */
    fun known(context: Context, tag: String): Boolean = prefs(context).contains("b_$tag")

    /** Adds the games not seen before and returns only those, oldest first. */
    fun merge(context: Context, tag: String, games: List<Me.Game>): List<Battle> {
        val known = battles(context, tag)
        val seen = known.mapTo(HashSet()) { it.at }
        val cutoff = System.currentTimeMillis() - KEEP_MS
        val fresh = games
            .mapNotNull { g -> of(g) }
            .filter { it.at >= cutoff && it.at !in seen }
            .distinctBy { it.at }
            .sortedBy { it.at }
        // 1.44: rows saved before the bubble's poll carried the mode get it now.
        // 1.45: and rows saved before a site answer carried the numbers get those.
        val now = games.mapNotNull { g -> of(g)?.let { it.at to it } }.toMap()
        val filled = known.map { b ->
            val g = now[b.at] ?: return@map b
            b.copy(
                mode = b.mode ?: g.mode,
                kills = if (b.fought) b.kills else g.kills,
                deaths = if (b.fought) b.deaths else g.deaths,
                damage = if (b.damage >= 0) b.damage else g.damage,
                bid = if (b.bid != 0) b.bid else g.bid,
                map = b.map ?: g.map,
            )
        }
        val all = (filled + fresh).filter { it.at >= cutoff }.sortedBy { it.at }
        val out = JSONArray()
        for (b in all) {
            out.put(
                JSONArray().put(b.at).put(if (b.win) 1 else 0).put(b.brawler ?: "").put(b.mode ?: "").put(if (b.star) 1 else 0)
                    .put(b.kills).put(b.deaths).put(b.damage).put(b.bid).put(b.map ?: ""),
            )
        }
        prefs(context).edit().putString("b_$tag", out.toString()).apply()
        return fresh
    }

    /** Wins and losses this week, Monday to now (1.42: the weekly duel's week; was the last seven days). */
    fun week(context: Context, tag: String): Pair<Int, Int> {
        val since = Duel.weekStart().toInstant().toEpochMilli()
        val list = battles(context, tag).filter { it.at >= since }
        val wins = list.count { it.win }
        return wins to list.size - wins
    }

    fun forget(context: Context, tag: String) {
        prefs(context).edit().remove("b_$tag").apply()
    }
}
