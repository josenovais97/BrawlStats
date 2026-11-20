package net.brawlzone.bubble

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * The squad feed (1.42): posts about the player and their friends, written by
 * the app from the games it already follows, and emoji reactions between
 * friends.
 *
 * Every post is a fact: a rank-up, one friend passing another on the ladder,
 * a win streak (or a losing one, gently), a big session, the weekly duel's
 * lead and winner, yesterday's MVP, and Sunday's squad awards (best with a
 * brawler, best in a mode, most games, one-trick, night owl, star player).
 * Nobody writes anything, so there is nothing to moderate.
 *
 * A post's id is built from the facts behind it (`rank.TAG.season.rank`), so
 * two friends' phones give the same post the same id, and a reaction sent from
 * one (`/api/bubble/react`) shows on the other. A reaction on a post about
 * you comes back as a notification ("Leo reacted 🔥").
 *
 * Posts are kept on the phone (the newest 80); the first look at a player
 * only records where they stand, so installing does not invent rank-ups.
 */
object Feed {

    const val ACTION_OPEN = "net.brawlzone.bubble.FEED"

    /** The six reactions, in the order the bar shows them; keys as the site stores them. */
    val REACTIONS = listOf("fire" to "🔥", "lol" to "😂", "crown" to "👑", "wow" to "😱", "dead" to "💀", "clap" to "👏")

    data class Post(val id: String, val at: Long, val kind: String, val tag: String, val name: String, val icon: String?, val args: JSONObject)

    data class Reaction(val tag: String, val name: String, val r: String)

    private data class Member(val tag: String, val data: Me.Data, val you: Boolean)

    private const val PREFS = "brawlzone-feed"
    private const val KEY_POSTS = "posts"
    private const val KEY_SNAP = "snap"
    private const val KEY_SEEN = "seen"
    private const val KEY_RX = "rx"
    private const val KEY_MINE = "mine"
    private const val KEY_MODES = "modes"
    private const val KEY_ABOUT = "about_since"
    private const val KEY_MVP = "mvp_day"
    private const val KEY_AWARDS = "awards_week"
    private const val KEY_DUEL = "duel_week"
    private const val KEY_LEAD = "lead"
    private const val MAX_POSTS = 80
    private const val MIN = 60 * 1000L
    private const val HOUR = 60 * MIN
    private const val SESSION_GAP = 45 * MIN
    private val DAY = DateTimeFormatter.ofPattern("yyyyMMdd")

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // ------------------------------------------------------------------ posts

    fun posts(context: Context): List<Post> {
        val raw = prefs(context).getString(KEY_POSTS, null) ?: return emptyList()
        val a = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            Post(
                id = o.optString("id"),
                at = o.optLong("at"),
                kind = o.optString("kind"),
                tag = o.optString("tag"),
                name = o.optString("name"),
                icon = o.optString("icon").takeIf { it.isNotEmpty() },
                args = o.optJSONObject("args") ?: JSONObject(),
            )
        }.sortedByDescending { it.at }
    }

    private fun write(context: Context, list: List<Post>) {
        val a = JSONArray()
        for (p in list.sortedByDescending { it.at }.take(MAX_POSTS)) {
            a.put(
                JSONObject().put("id", p.id).put("at", p.at).put("kind", p.kind).put("tag", p.tag)
                    .put("name", p.name).put("icon", p.icon ?: "").put("args", p.args),
            )
        }
        prefs(context).edit().putString(KEY_POSTS, a.toString()).apply()
    }

    /** Posts not seen on the feed yet (the caption's "3 new"). */
    fun unseen(context: Context): Int {
        val seen = prefs(context).getLong(KEY_SEEN, 0L)
        return posts(context).count { it.at > seen }
    }

    fun markSeen(context: Context) {
        prefs(context).edit().putLong(KEY_SEEN, System.currentTimeMillis()).apply()
    }

    /** A mode key's name in the app's language, as the site last sent it. */
    fun modeName(context: Context, key: String): String =
        runCatching { JSONObject(prefs(context).getString(KEY_MODES, "{}")!!).optString(key) }.getOrNull()?.takeIf { it.isNotEmpty() }
            ?: key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }

    // ---------------------------------------------------------------- writing

    private fun squad(context: Context): List<Member> {
        val out = mutableListOf<Member>()
        Me.last(context)?.let { out += Member(it.tag, it, true) }
        for (tag in Friends.tags(context)) Friends.last(context, tag)?.let { out += Member(tag, it, false) }
        return out
    }

    private fun post(id: String, at: Long, kind: String, m: Member, args: JSONObject) =
        Post(id, at, kind, m.tag, m.data.name, m.data.iconUrl, args)

    /**
     * From the hourly check, after the friends are refreshed: everything new
     * since the last look. Off the main thread.
     */
    fun observe(context: Context, season: Int?) {
        val squad = squad(context)
        if (squad.isEmpty()) return
        val p = prefs(context)
        val now = System.currentTimeMillis()
        val list = posts(context).associateBy { it.id }.toMutableMap()
        fun add(post: Post, replace: Boolean = false) {
            if (replace || post.id !in list) list[post.id] = post
        }

        // The modes' names, for the awards.
        val modes = runCatching { JSONObject(p.getString(KEY_MODES, "{}")!!) }.getOrDefault(JSONObject())
        for (m in squad) for ((k, v) in m.data.modes) modes.put(k, v)

        // Rank-ups and passes, against where everyone stood last time.
        val snap = runCatching { JSONObject(p.getString(KEY_SNAP, "{}")!!) }.getOrDefault(JSONObject())
        val today = LocalDate.now().format(DAY)
        for (m in squad) {
            val before = snap.optJSONObject(m.tag) ?: continue
            val sameSeason = season != null && before.optInt("s", -1) == season
            if (sameSeason && m.data.rankIndex >= 0 && m.data.rankIndex > before.optInt("r", -1) && m.data.rank != null) {
                add(post("rank.${m.tag}.$season.${m.data.rankIndex}", now, "rank", m,
                    JSONObject().put("rank", m.data.rank).put("badge", m.data.rankIcon ?: "").put("elo", m.data.elo ?: 0)))
            }
        }
        var passes = 0
        for (a in squad) for (b in squad) {
            if (a.tag == b.tag || passes >= 3) continue
            val ea = a.data.elo ?: continue
            val eb = b.data.elo ?: continue
            val pa = snap.optJSONObject(a.tag)?.takeIf { it.has("e") }?.optInt("e") ?: continue
            val pb = snap.optJSONObject(b.tag)?.takeIf { it.has("e") }?.optInt("e") ?: continue
            if (pa < pb && ea > eb) {
                add(post("pass.${a.tag}.${b.tag}.$today", now, "pass", a, JSONObject().put("other", b.data.name).put("gap", ea - eb)))
                passes++
            }
        }
        val nextSnap = JSONObject()
        for (m in squad) {
            val o = JSONObject().put("s", season ?: snap.optJSONObject(m.tag)?.optInt("s", -1) ?: -1).put("r", m.data.rankIndex)
            m.data.elo?.let { o.put("e", it) }
            nextSnap.put(m.tag, o)
        }

        // Streaks and sessions, from each player's own games.
        for (m in squad) {
            val games = Tally.battles(context, m.tag).sortedBy { it.at }
            val last = games.lastOrNull() ?: continue
            if (now - last.at < 3 * HOUR) {
                val run = games.takeLastWhile { it.win == last.win }
                if (run.size >= 5) {
                    val kind = if (last.win) "streak" else "tilt"
                    val id = "$kind.${m.tag}.${run.first().at / 1000}"
                    // A growing streak moves back to the top with its new length; an unchanged one stays put.
                    if (list[id]?.args?.optInt("n") != run.size) add(post(id, now, kind, m, JSONObject().put("n", run.size)), replace = true)
                }
            }
            // The newest finished session: 45 minutes without a game ends it.
            if (now - last.at in SESSION_GAP..12 * HOUR) {
                var start = games.size - 1
                while (start > 0 && games[start].at - games[start - 1].at < SESSION_GAP) start--
                val session = games.subList(start, games.size)
                val w = session.count { it.win }
                val l = session.size - w
                if (session.size >= 6 && (w >= session.size * 0.7 || w <= session.size * 0.3)) {
                    add(post("session.${m.tag}.${session.first().at / 1000}", last.at + SESSION_GAP, "session", m,
                        JSONObject().put("w", w).put("l", l).put("hot", w > l)))
                }
            }
        }

        // The weekly duel: who took the lead, and Monday's winner.
        if (squad.size >= 2) {
            val week = Duel.weekStart().toLocalDate().format(DAY)
            val leader = Duel.leader(Duel.thisWeek(context))
            val before = p.getString(KEY_LEAD, null)
            val leaderKey = leader?.let { "$week:$it" }
            if (leader != null && before != null && before.startsWith("$week:") && before != leaderKey) {
                squad.firstOrNull { it.tag == leader }?.let { m ->
                    val wins = Duel.thisWeek(context).firstOrNull { it.tag == leader }?.wins ?: 0
                    add(post("lead.${m.tag}.$week.${wins}", now, "lead", m, JSONObject().put("w", wins)))
                }
            }
            if (leaderKey != null) p.edit().putString(KEY_LEAD, leaderKey).apply()

            val start = Duel.weekStart()
            val lastWeek = start.minusWeeks(1)
            val lastKey = lastWeek.toLocalDate().format(DAY)
            if (p.getString(KEY_DUEL, null) != lastKey && ZonedDateTime.now().dayOfWeek == DayOfWeek.MONDAY) {
                p.edit().putString(KEY_DUEL, lastKey).apply()
                val standings = Duel.standings(context, lastWeek.toInstant().toEpochMilli(), start.toInstant().toEpochMilli())
                Duel.leader(standings)?.let { tag ->
                    val e = standings.first { it.tag == tag }
                    squad.firstOrNull { it.tag == tag }?.let { m ->
                        add(post("duel.${m.tag}.$lastKey", now, "duel", m, JSONObject().put("w", e.wins)))
                    }
                }
            }

            // Yesterday's MVP, once a day from 6 in the morning.
            val yesterday = LocalDate.now().minusDays(1)
            val yKey = yesterday.format(DAY)
            if (p.getString(KEY_MVP, null) != yKey && ZonedDateTime.now().hour >= 6) {
                p.edit().putString(KEY_MVP, yKey).apply()
                val zone = ZoneId.systemDefault()
                val from = yesterday.atStartOfDay(zone).toInstant().toEpochMilli()
                val to = LocalDate.now().atStartOfDay(zone).toInstant().toEpochMilli()
                val best = squad.map { m ->
                    val day = Tally.battles(context, m.tag).filter { it.at in from until to }
                    val w = day.count { it.win }
                    Triple(m, w, day.size - w)
                }.filter { it.second + it.third >= 3 && it.second > it.third }
                    .maxWithOrNull(compareBy<Triple<Member, Int, Int>> { it.second - it.third }.thenBy { it.second })
                if (best != null) {
                    add(post("mvp.${best.first.tag}.$yKey", now, "mvp", best.first, JSONObject().put("w", best.second).put("l", best.third)))
                }
            }

            // Squad awards, for the week that ends this Sunday (posted from 18:00, or Monday if missed).
            val nowZ = ZonedDateTime.now()
            val awardWeek = when {
                nowZ.dayOfWeek == DayOfWeek.SUNDAY && nowZ.hour >= 18 -> start
                nowZ.dayOfWeek == DayOfWeek.MONDAY -> lastWeek
                else -> null
            }
            val awardKey = awardWeek?.toLocalDate()?.format(DAY)
            if (awardWeek != null && awardKey != null && p.getString(KEY_AWARDS, null) != awardKey) {
                p.edit().putString(KEY_AWARDS, awardKey).apply()
                awards(context, squad, awardWeek.toInstant().toEpochMilli(), awardWeek.plusWeeks(1).toInstant().toEpochMilli())?.let { rows ->
                    val first = rows.getJSONObject(0).optString("tag")
                    val hash = (squad.map { it.tag }.sorted().joinToString(",").hashCode() and 0x7fffffff).toString(36)
                    val owner = squad.firstOrNull { it.tag == first } ?: squad.first()
                    add(Post("awards.${owner.tag}.$awardKey.$hash", now, "awards", owner.tag, "", null,
                        JSONObject().put("rows", rows).put("week", awardKey)))
                }
            }
        }

        p.edit().putString(KEY_SNAP, nextSnap.toString()).putString(KEY_MODES, modes.toString()).apply()
        write(context, list.values.toList())
    }

    /** The week's awards, best first; null when fewer than two can be given. */
    private fun awards(context: Context, squad: List<Member>, from: Long, to: Long): JSONArray? {
        val games = squad.associateWith { m -> Tally.battles(context, m.tag).filter { it.at in from until to } }
        val rows = JSONArray()
        fun row(kind: String, m: Member) = JSONObject().put("k", kind).put("tag", m.tag).put("name", m.data.name)

        // Best with one brawler, and best in one mode: win rate over at least six games.
        data class Best(val m: Member, val what: String, val wins: Int, val n: Int)
        fun best(key: (Tally.Battle) -> String?): Best? = games.flatMap { (m, list) ->
            list.groupBy(key).filterKeys { it != null }.map { (k, g) -> Best(m, k!!, g.count { it.win }, g.size) }
        }.filter { it.n >= 6 }.maxWithOrNull(compareBy<Best> { it.wins.toDouble() / it.n }.thenBy { it.n })
        best { it.brawler }?.let { rows.put(row("brawler", it.m).put("b", it.what).put("wr", it.wins * 100 / it.n).put("g", it.n)) }
        best { it.mode }?.let { rows.put(row("mode", it.m).put("m", it.what).put("wr", it.wins * 100 / it.n).put("g", it.n)) }

        games.maxByOrNull { it.value.size }?.takeIf { it.value.size >= 10 }?.let { rows.put(row("grind", it.key).put("g", it.value.size)) }

        games.mapNotNull { (m, list) ->
            if (list.size < 15) return@mapNotNull null
            val top = list.groupingBy { it.brawler }.eachCount().filterKeys { it != null }.maxByOrNull { it.value } ?: return@mapNotNull null
            Triple(m, top.key!!, top.value * 100 / list.size)
        }.filter { it.third >= 60 }.maxByOrNull { it.third }?.let { rows.put(row("one", it.first).put("b", it.second).put("p", it.third)) }

        val zone = ZoneId.systemDefault()
        games.map { (m, list) -> m to list.count { Instant.ofEpochMilli(it.at).atZone(zone).hour < 5 } }
            .filter { it.second >= 5 }.maxByOrNull { it.second }?.let { rows.put(row("owl", it.first).put("g", it.second)) }

        games.map { (m, list) -> m to list.count { it.star } }
            .filter { it.second >= 3 }.maxByOrNull { it.second }?.let { rows.put(row("star", it.first).put("g", it.second)) }

        return rows.takeIf { it.length() >= 2 }
    }

    // ---------------------------------------------------------------- reading

    /** Headline and second line, in the app's language. */
    fun text(context: Context, p: Post): Pair<String, String?> {
        val local = AppLang.wrap(context)
        val a = p.args
        val fmt = NumberFormat.getIntegerInstance()
        return when (p.kind) {
            "rank" -> local.getString(R.string.friend_rankup_title, p.name, a.optString("rank")) to
                (if (a.optInt("elo") > 0) "${fmt.format(a.optInt("elo"))} elo" else null)
            "pass" -> local.getString(R.string.feed_pass, p.name, a.optString("other")) to
                local.getString(R.string.feed_pass_sub, fmt.format(a.optInt("gap")))
            "streak" -> local.getString(R.string.feed_streak, p.name, a.optInt("n")) to local.getString(R.string.feed_streak_sub)
            "tilt" -> local.getString(R.string.feed_tilt, p.name, a.optInt("n")) to local.getString(R.string.feed_tilt_sub)
            "session" -> local.getString(R.string.feed_session, p.name, a.optInt("w"), a.optInt("l")) to
                local.getString(if (a.optBoolean("hot")) R.string.feed_session_hot else R.string.feed_session_cold)
            "lead" -> local.getString(R.string.feed_lead, p.name) to local.getString(R.string.feed_wins_week, a.optInt("w"))
            "duel" -> local.getString(R.string.feed_duel, p.name) to local.getString(R.string.feed_duel_sub, a.optInt("w"))
            "mvp" -> local.getString(R.string.feed_mvp, p.name) to "${a.optInt("w")}–${a.optInt("l")}"
            "awards" -> {
                val week = runCatching {
                    LocalDate.parse(a.optString("week"), DAY).format(DateTimeFormatter.ofPattern("d MMM", java.util.Locale.forLanguageTag(AppLang.current(context))))
                }.getOrNull() ?: ""
                local.getString(R.string.feed_awards) to local.getString(R.string.feed_awards_sub, week)
            }
            else -> p.name to null
        }
    }

    /** One awards line: label and value. */
    fun awardRow(context: Context, o: JSONObject): Pair<String, String> {
        val local = AppLang.wrap(context)
        val name = o.optString("name")
        return when (o.optString("k")) {
            "brawler" -> local.getString(R.string.feed_award_brawler, o.optString("b")) to
                local.getString(R.string.feed_award_wr, name, o.optInt("wr"), o.optInt("g"))
            "mode" -> local.getString(R.string.feed_award_mode, modeName(context, o.optString("m"))) to
                local.getString(R.string.feed_award_wr, name, o.optInt("wr"), o.optInt("g"))
            "grind" -> local.getString(R.string.feed_award_grind) to local.getString(R.string.feed_award_games, name, o.optInt("g"))
            "one" -> local.getString(R.string.feed_award_one) to local.getString(R.string.feed_award_one_v, name, o.optString("b"), o.optInt("p"))
            "owl" -> local.getString(R.string.feed_award_owl) to local.getString(R.string.feed_award_owl_v, name, o.optInt("g"))
            "star" -> local.getString(R.string.feed_award_star) to local.getString(R.string.feed_award_star_v, name, o.optInt("g"))
            else -> "" to name
        }
    }

    /** The emoji that marks each kind of post. */
    fun emoji(p: Post): String = when (p.kind) {
        "rank" -> "🎉"
        "pass" -> "👀"
        "streak" -> "🔥"
        "tilt" -> "🫠"
        "session" -> if (p.args.optBoolean("hot")) "📈" else "😵"
        "lead" -> "👑"
        "duel" -> "🏆"
        "mvp" -> "⭐"
        "awards" -> "🏅"
        else -> "✨"
    }

    /** Each kind's colour, for the card's glow. */
    fun color(p: Post): Int = when (p.kind) {
        "rank", "lead", "duel", "mvp" -> 0xFFFFC53D.toInt()
        "pass", "awards" -> 0xFF8B6BFF.toInt()
        "streak" -> 0xFFFF7A2B.toInt()
        "tilt" -> 0xFF4A9BFF.toInt()
        "session" -> if (p.args.optBoolean("hot")) 0xFF35D07F.toInt() else 0xFF4A9BFF.toInt()
        else -> 0xFF8B6BFF.toInt()
    }

    // -------------------------------------------------------------- reactions

    fun reactions(context: Context, id: String): List<Reaction> {
        val o = runCatching { JSONObject(prefs(context).getString(KEY_RX, "{}")!!) }.getOrNull() ?: return emptyList()
        val a = o.optJSONArray(id) ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val r = a.optJSONObject(i) ?: return@mapNotNull null
            Reaction(r.optString("tag"), r.optString("name"), r.optString("r"))
        }
    }

    private fun storeReactions(context: Context, id: String, a: JSONArray) {
        val p = prefs(context)
        val o = runCatching { JSONObject(p.getString(KEY_RX, "{}")!!) }.getOrDefault(JSONObject())
        o.put(id, a)
        // Only the posts still on the phone.
        val keep = posts(context).mapTo(HashSet()) { it.id }
        val stale = o.keys().asSequence().filter { it !in keep }.toList()
        for (k in stale) o.remove(k)
        p.edit().putString(KEY_RX, o.toString()).apply()
    }

    /** The player's own reaction on a post, or null. */
    fun mine(context: Context, id: String): String? {
        val tag = Account.tag(context)
        return reactions(context, id).firstOrNull { it.tag == tag }?.r
    }

    /** Everyone's reactions on the newest posts. Off the main thread. */
    fun syncReactions(context: Context) {
        val ids = posts(context).take(40).map { it.id }
        if (ids.isEmpty()) return
        val body = runCatching { Http.text("${Http.SITE}/api/bubble/react?posts=${ids.joinToString(",")}") }.getOrNull() ?: return
        val all = runCatching { JSONObject(body).optJSONObject("reactions") }.getOrNull() ?: return
        val p = prefs(context)
        val o = JSONObject()
        for (id in ids) all.optJSONArray(id)?.let { o.put(id, it) }
        p.edit().putString(KEY_RX, o.toString()).apply()
    }

    /**
     * Sets the player's reaction on the phone at once (or removes it, tapping
     * the same one again); `send` then tells the site, whose answer replaces it.
     */
    fun reactLocal(context: Context, id: String, r: String?): Boolean {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return false
        val name = Me.last(context)?.name ?: ""
        val current = reactions(context, id).filter { it.tag != tag }.toMutableList()
        if (r != null) current += Reaction(tag, name, r)
        val local = JSONArray()
        for (x in current) local.put(JSONObject().put("tag", x.tag).put("name", x.name).put("r", x.r))
        storeReactions(context, id, local)
        return true
    }

    /** Off the main thread. */
    fun send(context: Context, id: String, r: String?): Boolean {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return false
        val body = JSONObject().put("tag", tag).put("post", id).put("r", r ?: "")
        val answer = Http.postJson("${Http.SITE}/api/bubble/react", body.toString())
        if (answer.code !in 200..299) return false
        runCatching { JSONObject(answer.body ?: "").optJSONArray("reactions") }.getOrNull()?.let { storeReactions(context, id, it) }
        return true
    }

    /**
     * Friends' reactions on posts about the player, since the last look: one
     * notification however many there are. Off the main thread.
     */
    fun pollAbout(context: Context, post: Boolean) {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return
        val p = prefs(context)
        val since = p.getLong(KEY_ABOUT, 0L)
        if (since == 0L) {
            // The first look only starts the clock.
            p.edit().putLong(KEY_ABOUT, System.currentTimeMillis()).apply()
            return
        }
        val body = runCatching { Http.text("${Http.SITE}/api/bubble/react?about=$tag&since=$since") }.getOrNull() ?: return
        val a = runCatching { JSONObject(body).optJSONArray("about") }.getOrNull() ?: return
        if (a.length() == 0) return
        var newest = since
        val rows = (0 until a.length()).mapNotNull { a.optJSONObject(it) }
        for (r in rows) newest = maxOf(newest, r.optLong("at"))
        p.edit().putLong(KEY_ABOUT, newest).apply()
        if (!post) return
        val local = AppLang.wrap(context)
        val first = rows.first()
        val emoji = REACTIONS.firstOrNull { it.first == first.optString("r") }?.second ?: ""
        val known = posts(context).firstOrNull { it.id == first.optString("post") }
        val title = if (rows.size == 1) {
            local.getString(R.string.feed_react_title, first.optString("name"), emoji)
        } else {
            local.getString(R.string.feed_react_many, rows.size)
        }
        val text = if (rows.size == 1) {
            known?.let { text(context, it).first } ?: local.getString(R.string.feed_title)
        } else {
            rows.take(4).joinToString(" · ") { r ->
                r.optString("name") + " " + (REACTIONS.firstOrNull { it.first == r.optString("r") }?.second ?: "")
            }
        }
        Notify.postReaction(context, title, text)
    }

    /** Samples for the test build: a few posts of each kind about the player. */
    fun sample(context: Context) {
        val me = Me.last(context) ?: return
        val m = Member(me.tag, me, true)
        val now = System.currentTimeMillis()
        val week = Duel.weekStart().toLocalDate().format(DAY)
        val list = posts(context).associateBy { it.id }.toMutableMap()
        fun add(p: Post) { list[p.id] = p }
        add(post("streak.${me.tag}.${now / 1000}", now, "streak", m, JSONObject().put("n", 7)))
        add(post("session.${me.tag}.${now / 1000 - 1}", now - 20 * MIN, "session", m, JSONObject().put("w", 8).put("l", 2).put("hot", true)))
        add(post("lead.${me.tag}.$week.9", now - 2 * HOUR, "lead", m, JSONObject().put("w", 9)))
        if (me.rank != null) {
            add(post("rank.${me.tag}.0.${me.rankIndex}", now - 5 * HOUR, "rank", m,
                JSONObject().put("rank", me.rank).put("badge", me.rankIcon ?: "").put("elo", me.elo ?: 0)))
        }
        val rows = JSONArray()
            .put(JSONObject().put("k", "brawler").put("tag", me.tag).put("name", me.name).put("b", me.list.firstOrNull()?.brawler ?: "Spike").put("wr", 70).put("g", 10))
            .put(JSONObject().put("k", "grind").put("tag", me.tag).put("name", me.name).put("g", 87))
            .put(JSONObject().put("k", "owl").put("tag", me.tag).put("name", me.name).put("g", 12))
        add(Post("awards.${me.tag}.$week.test", now - 26 * HOUR, "awards", me.tag, "", null, JSONObject().put("rows", rows).put("week", week)))
        write(context, list.values.toList())
    }
}
