package net.brawlzone.bubble

import android.content.Context
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.random.Random

/**
 * Bubble Pass (1.43): a free weekly pass, Monday to Sunday.
 *
 * Seven quests a week, picked for this player and this week: five about
 * their Ranked games, read from the games the phone keeps (Tally), and two
 * about using the bubble (the draft board, Ask, counters, post-game reviews),
 * plus a friend reaction as a bonus eighth once they have friends. Each quest gives XP; every 100
 * XP is a tier, up to 10. Tiers 2, 4, 6 and 8 give the common rings, kept for
 * good; tier 10 gives the week's legendary ring (Rings.legendaryFor). Reaching
 * tier 10 in consecutive weeks builds a streak.
 *
 * Game quests are recomputed from Tally every time, so they can never drift
 * from the games themselves; the app quests are counters for the week.
 * Nothing is bought and nothing leaves the phone except the anonymous
 * "quest done" and "tier reached" events (Stats).
 */
object Pass {
    const val ACTION_OPEN = "net.brawlzone.bubble.PASS"
    const val XP_PER_TIER = 100
    const val TIERS = 10
    val REWARD_TIERS = listOf(2, 4, 6, 8, 10)
    /**
     * The seven base quests' XP, scaled to this every week. At 1,200 every mix
     * of quests reaches tier 10 (1,000) with its smallest quest skipped; at
     * 1,100 about one mix in eight did not.
     */
    const val WEEK_XP = 1200

    private const val PREFS = "brawlzone-pass"
    private const val KEY_OWNED = "owned"
    private const val KEY_REVEAL = "reveal"
    private const val KEY_WEEK = "week"
    private const val KEY_WEEK_TIER = "week_tier"
    private const val KEY_STREAK = "streak"
    private const val KEY_DONE = "done"
    private const val KEY_SEEN_XP = "seen_xp"
    private const val KEY_NEW_WEEK_SENT = "new_week_sent"
    private const val KEY_LAST_WEEK_QUESTS = "last_week_quests"

    /** App events the panel and the app report (BubbleService.AppBridge.quest, reviewSeen, FeedView). */
    val APP_EVENTS = setOf("draft", "ask", "counters", "review", "react")

    private val RANKED_MODES = listOf("knockout", "bounty", "brawlBall", "gemGrab", "heist", "hotZone")

    enum class Kind(val key: String, val xp: Int, val target: Int, val app: Boolean = false) {
        PLAY("play", 150, 10),
        WIN("win", 150, 5),
        WIN_BIG("win_big", 250, 10),
        STREAK("streak", 200, 3),
        STAR("star", 150, 3),
        BRAWLERS("brawlers", 150, 3),
        MODES("modes", 150, 3),
        GOAL("goal", 200, 3),
        MODE_WIN("mode_win", 100, 2),
        MAIN("main", 100, 5),
        /** 1.45: the numbers the battle log carries since November. */
        CLEAN_WIN("clean_win", 150, 1),
        KILLS("kills", 150, 30),
        KD_DAY("kd_day", 150, 2),
        DRAFT("draft", 100, 1, true),
        ASK("ask", 75, 1, true),
        COUNTERS("counters", 75, 1, true),
        REVIEW("review", 100, 2, true),
        REACT("react", 100, 1, true),
    }

    /** `xp` is the week's share: the seven base quests always add up to [WEEK_XP]. */
    data class Quest(val kind: Kind, val progress: Int, val mode: String? = null, val xp: Int = kind.xp) {
        val done get() = progress >= kind.target
    }

    data class Week(
        val start: ZonedDateTime,
        val quests: List<Quest>,
        val xp: Int,
        val tier: Int,
        val legendary: Rings.Ring,
        val streak: Int,
    ) {
        val left get() = quests.count { !it.done }
        val xpInTier get() = if (tier >= TIERS) XP_PER_TIER else xp - tier * XP_PER_TIER
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun weekStart(): ZonedDateTime = Duel.weekStart()

    private fun weekId(start: ZonedDateTime) = start.toLocalDate().toString()

    /**
     * This week's quests for this tag: the same seven all week, different next
     * week. The pools are fixed so a setting changed mid-week cannot reshuffle
     * them; a friend reaction joins as an eighth, bonus quest once there are
     * friends, and the daily-goal quest gives way when the goal is off.
     */
    private fun pick(context: Context, tag: String, start: ZonedDateTime): List<Pair<Kind, String?>> {
        val random = Random((weekId(start) + tag).hashCode())
        val win = if (random.nextBoolean()) Kind.WIN else Kind.WIN_BIG
        val pool = listOf(Kind.PLAY, win, Kind.STREAK, Kind.STAR, Kind.BRAWLERS, Kind.MODES, Kind.GOAL, Kind.MODE_WIN, Kind.MAIN) +
            (if (combatWeek(start)) listOf(Kind.CLEAN_WIN, Kind.KILLS, Kind.KD_DAY) else emptyList())
        val order = pool.shuffled(random)
        val chosen = order.take(5).toMutableList()
        if (Kind.GOAL in chosen && Goal.goal(context) <= 0) {
            chosen[chosen.indexOf(Kind.GOAL)] = order.drop(5).first { it != Kind.GOAL }
        }
        val apps = listOf(Kind.DRAFT, Kind.ASK, Kind.COUNTERS, Kind.REVIEW).shuffled(random).take(2).toMutableList()
        if (Friends.tags(context).isNotEmpty()) apps += Kind.REACT
        val mode = RANKED_MODES[random.nextInt(RANKED_MODES.size)]
        return (chosen + apps).map { it to if (it == Kind.MODE_WIN) mode else null }
    }

    /**
     * Whether a week has the kill quests (1.45): weeks from Monday 7 December
     * 2026 on, so the quests of a week already under way are never reshuffled
     * by updating the app in the middle of it.
     */
    private fun combatWeek(start: ZonedDateTime): Boolean = !start.toLocalDate().isBefore(COMBAT_FROM)
    private val COMBAT_FROM: LocalDate = LocalDate.of(2026, 12, 7)

    private fun count(context: Context, week: String, key: String): Int = prefs(context).getInt("c_${week}_$key", 0)

    /** Counts an app event toward this week's quests (any thread). */
    fun event(context: Context, key: String) {
        if (key !in APP_EVENTS) return
        val p = prefs(context)
        val week = weekId(weekStart())
        p.edit().putInt("c_${week}_$key", p.getInt("c_${week}_$key", 0) + 1).apply()
        update(context, post = true)
    }

    private fun progress(context: Context, tag: String, start: ZonedDateTime, games: List<Tally.Battle>, kind: Kind, mode: String?): Int {
        val wins = games.filter { it.win }
        val week = weekId(start)
        return when (kind) {
            Kind.PLAY -> games.size
            Kind.WIN, Kind.WIN_BIG -> wins.size
            Kind.STREAK -> {
                var best = 0
                var run = 0
                for (g in games) {
                    run = if (g.win) run + 1 else 0
                    if (run > best) best = run
                }
                best
            }
            Kind.STAR -> games.count { it.star }
            Kind.BRAWLERS -> wins.mapNotNull { it.brawler }.toSet().size
            Kind.MODES -> wins.mapNotNull { it.mode }.toSet().size
            Kind.GOAL -> {
                val goal = Goal.goal(context)
                if (goal <= 0) 0 else {
                    val zone = ZoneId.systemDefault()
                    val today = LocalDate.now(zone)
                    var d = start.toLocalDate()
                    var n = 0
                    while (!d.isAfter(today)) {
                        if (Goal.winsOn(context, tag, d) >= goal) n++
                        d = d.plusDays(1)
                    }
                    n
                }
            }
            Kind.MODE_WIN -> wins.count { it.mode.equals(mode, ignoreCase = true) }
            Kind.MAIN -> games.mapNotNull { it.brawler }.groupingBy { it }.eachCount().values.maxOrNull() ?: 0
            Kind.CLEAN_WIN -> wins.count { it.fought && it.deaths == 0 }
            Kind.KILLS -> games.sumOf { maxOf(0, it.kills) }
            // A day of three games or more with more kills than deaths.
            Kind.KD_DAY -> {
                val zone = ZoneId.systemDefault()
                games.filter { it.fought }
                    .groupBy { java.time.Instant.ofEpochMilli(it.at).atZone(zone).toLocalDate() }
                    .count { (_, list) -> list.size >= 3 && list.sumOf { it.kills } > list.sumOf { it.deaths } }
            }
            Kind.DRAFT, Kind.ASK, Kind.COUNTERS, Kind.REVIEW, Kind.REACT -> count(context, week, kind.key)
        }
    }

    /** The week as it stands, without side effects. Null without a tag. */
    fun week(context: Context): Week? {
        val tag = Account.tag(context).ifEmpty { return null }
        val start = weekStart()
        val picked = pick(context, tag, start)
        // Scaled so every week is worth the same: the kinds' XP sets the split, WEEK_XP the total.
        val factor = WEEK_XP.toDouble() / picked.take(7).sumOf { it.first.xp }
        // The week's games, read once for all seven quests (this runs on the main thread).
        val since = start.toInstant().toEpochMilli()
        val games = Tally.battles(context, tag).filter { it.at >= since }.sortedBy { it.at }
        // Bubble Supporter (1.46): every quest is worth double.
        val boost = if (Supporter.active(context)) 2 else 1
        val quests = picked.map { (kind, mode) ->
            Quest(kind, progress(context, tag, start, games, kind, mode), mode, (Math.round(kind.xp * factor / 25.0) * 25).toInt() * boost)
        }
        val xp = quests.filter { it.done }.sumOf { it.xp }
        val tier = (xp / XP_PER_TIER).coerceAtMost(TIERS)
        return Week(start, quests, xp, tier, Rings.legendaryFor(start.toLocalDate().toEpochDay()), prefs(context).getInt(KEY_STREAK, 0))
    }

    fun owned(context: Context): Set<String> = prefs(context).getStringSet(KEY_OWNED, null) ?: emptySet()

    /** Rings unlocked since the pass screen last showed them, oldest first. */
    fun pendingReveals(context: Context): List<String> =
        prefs(context).getString(KEY_REVEAL, null)?.split(',')?.filter { it.isNotEmpty() } ?: emptyList()

    fun clearReveals(context: Context) = prefs(context).edit().remove(KEY_REVEAL).apply()

    /** The XP the pass screen last showed, so its bar can fill from there. */
    fun seenXp(context: Context, week: Week): Int {
        val p = prefs(context)
        return if (p.getString("${KEY_SEEN_XP}_week", null) == weekId(week.start)) p.getInt(KEY_SEEN_XP, 0) else 0
    }

    fun markSeen(context: Context, week: Week) {
        prefs(context).edit().putString("${KEY_SEEN_XP}_week", weekId(week.start)).putInt(KEY_SEEN_XP, week.xp).apply()
    }

    /**
     * Brings the pass up to date (any thread): closes last week (the streak),
     * unlocks rings for tiers reached, records quests newly done, and posts
     * at most one notification for a ring and one for a new week.
     */
    @Synchronized
    fun update(context: Context, post: Boolean) {
        val week = week(context) ?: return
        val p = prefs(context)
        val id = weekId(week.start)
        val edit = p.edit()

        // A new week: settle the streak from the week that ended.
        val last = p.getString(KEY_WEEK, null)
        var lastQuests = p.getInt(KEY_LAST_WEEK_QUESTS, 0)
        if (last != null && last != id) {
            val lastTier = p.getInt(KEY_WEEK_TIER, 0)
            val wasPrevious = runCatching { LocalDate.parse(last).plusDays(7) == week.start.toLocalDate() }.getOrDefault(false)
            val streak = if (lastTier >= TIERS && wasPrevious) p.getInt(KEY_STREAK, 0) + 1 else 0
            edit.putInt(KEY_STREAK, streak)
            lastQuests = p.getStringSet(KEY_DONE, null)?.size ?: 0
            edit.putInt(KEY_LAST_WEEK_QUESTS, lastQuests)
            edit.putStringSet(KEY_DONE, emptySet())
        }
        edit.putString(KEY_WEEK, id).putInt(KEY_WEEK_TIER, week.tier)

        // Quests newly done this week (counted once each, anonymously).
        val done = HashSet(if (last == id) p.getStringSet(KEY_DONE, null) ?: emptySet() else emptySet())
        for (q in week.quests.filter { it.done }) {
            if (done.add(q.kind.key)) Stats.event(context, "app_quest_done", mapOf("quest" to q.kind.key))
        }
        edit.putStringSet(KEY_DONE, done)

        // Rings for every reward tier reached.
        val owned = HashSet(owned(context))
        val reveal = pendingReveals(context).toMutableList()
        var newest: Rings.Ring? = null
        for (t in REWARD_TIERS.filter { it <= week.tier }) {
            val ring = if (t == TIERS) week.legendary else Rings.COMMON.first { Rings.COMMON_TIER[it.id] == t }
            if (owned.add(ring.id)) {
                reveal += ring.id
                newest = ring
                Stats.event(context, "app_pass_tier", mapOf("tier" to t, "ring" to ring.id))
            }
        }
        edit.putStringSet(KEY_OWNED, owned).putString(KEY_REVEAL, reveal.joinToString(","))
        edit.apply()

        if (post && newest != null) {
            val local = AppLang.wrap(context)
            Notify.postPass(
                context,
                7400,
                local.getString(R.string.pass_notif_ring, local.getString(newest.name)),
                local.getString(R.string.pass_notif_ring_body, week.tier),
            )
        }

        // Monday, from 09:00: a new week, only for someone who played last week's.
        val now = ZonedDateTime.now()
        if (post && lastQuests > 0 && now.hour >= 9 && p.getString(KEY_NEW_WEEK_SENT, null) != id && week.xp == 0) {
            p.edit().putString(KEY_NEW_WEEK_SENT, id).apply()
            val local = AppLang.wrap(context)
            Notify.postPass(
                context,
                7401,
                local.getString(R.string.pass_notif_week),
                local.getString(R.string.pass_notif_week_body, week.quests.size, local.getString(week.legendary.name)),
            )
        }
    }

    /**
     * The test build's "Send test notifications" (qa only): this week's
     * legendary ring and Spark unlocked as if earned, revealed on the next
     * visit to the pass, with the ring notification.
     */
    fun test(context: Context) {
        val week = week(context) ?: return
        val p = prefs(context)
        val owned = HashSet(owned(context)) + listOf("spark", week.legendary.id)
        val reveal = (pendingReveals(context) + listOf("spark", week.legendary.id)).distinct()
        p.edit().putStringSet(KEY_OWNED, owned).putString(KEY_REVEAL, reveal.joinToString(",")).apply()
        val local = AppLang.wrap(context)
        Notify.postPass(
            context,
            7400,
            local.getString(R.string.pass_notif_ring, local.getString(week.legendary.name)),
            local.getString(R.string.pass_notif_ring_body, Pass.TIERS),
        )
    }

    /** When the week ends, in the phone's own words: "Monday". */
    fun resetsOn(context: Context, week: Week): String =
        week.start.plusDays(7).format(
            java.time.format.DateTimeFormatter.ofPattern("EEEE", AppLang.locale(AppLang.current(context))),
        ).replaceFirstChar { it.titlecase(AppLang.locale(AppLang.current(context))) }
}
