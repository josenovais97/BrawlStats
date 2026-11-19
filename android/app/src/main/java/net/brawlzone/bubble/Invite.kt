package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.widget.Toast
import org.json.JSONObject

/**
 * Friend invites (1.42): the Friends card's "Invite a friend" shares
 * brawlzone.net/bubble/invite#c=CODE. The page sends the friend into this
 * app (brawlzonebubble://invite/CODE), or to Google Play with the code as
 * the install referrer (Referrer, Play build). Either way the code waits
 * here until the app screen asks "add them to your friends?"; saying yes
 * adds the inviter and tells the site who opened it, and the inviter's
 * hourly check adds the friend back (poll). Nobody types a tag.
 *
 * The site keeps one code per inviting tag (lib/bubble-invite), so a link
 * shared last month still works.
 */
object Invite {

    private const val PREFS = "brawlzone-invite"
    private const val KEY_CODE = "code"
    private const val KEY_CODE_TAG = "code_tag"
    private const val KEY_PENDING = "pending"
    private const val KEY_ASKED = "asked"
    private const val KEY_SEEN = "seen"
    private val CODE = Regex("^[2-9A-HJKMNP-Z]{8}$")

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // ------------------------------------------------------------ inviting

    /** The player's own code, asked of the site once per tag. Off the main thread. */
    fun code(context: Context): String? {
        val tag = Account.tag(context)
        if (tag.isEmpty()) return null
        val p = prefs(context)
        if (p.getString(KEY_CODE_TAG, null) == tag) p.getString(KEY_CODE, null)?.let { return it }
        val reply = Http.postJson("${Http.SITE}/api/bubble/invite", JSONObject().put("tag", tag).toString())
        val code = reply.body?.let { runCatching { JSONObject(it).optString("code") }.getOrNull() }
            ?.takeIf { reply.code in 200..299 && CODE.matches(it) } ?: return null
        p.edit().putString(KEY_CODE, code).putString(KEY_CODE_TAG, tag).apply()
        return code
    }

    /** The link, with the app's language so the page greets the friend in it. */
    fun link(context: Context, code: String): String =
        "${Http.SITE}/bubble/invite#c=$code&l=${AppLang.current(context).substringBefore('-').lowercase()}"

    /** Makes (or reuses) the link and opens the share sheet. */
    fun share(activity: Activity, onBusy: (Boolean) -> Unit) {
        val app = activity.applicationContext
        onBusy(true)
        Thread {
            val code = code(app)
            activity.runOnUiThread {
                onBusy(false)
                if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                if (code == null) {
                    Toast.makeText(activity, R.string.invite_failed, Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                val send = Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, activity.getString(R.string.invite_text, link(app, code)))
                runCatching { activity.startActivity(Intent.createChooser(send, activity.getString(R.string.invite_button))) }
            }
        }.start()
    }

    /**
     * The inviter's side, from the hourly check: everyone who opened this
     * player's link joins their friends, with one notification each.
     */
    fun poll(context: Context, post: Boolean) {
        val tag = Account.tag(context)
        val p = prefs(context)
        val code = p.getString(KEY_CODE, null)?.takeIf { p.getString(KEY_CODE_TAG, null) == tag } ?: return
        val body = runCatching { Http.text("${Http.SITE}/api/bubble/invite/accepted?c=$code") }.getOrNull() ?: return
        val list = runCatching { JSONObject(body).optJSONArray("tags") }.getOrNull() ?: return
        val seen = p.getStringSet(KEY_SEEN, emptySet())!!.toMutableSet()
        val local = AppLang.wrap(context)
        for (i in 0 until list.length()) {
            val friend = list.optJSONObject(i)?.optString("tag")?.takeIf { it.isNotEmpty() } ?: continue
            if (!seen.add(friend)) continue
            if (friend == tag || friend in Friends.tags(context)) continue
            if (Friends.add(context, friend) != Friends.AddResult.ADDED) continue
            val name = Friends.last(context, friend)?.name ?: "#$friend"
            if (post) {
                Notify.postFriend(
                    context,
                    7400 + (friend.hashCode() and 0xff),
                    local.getString(R.string.invite_joined_title, name),
                    local.getString(R.string.invite_joined_text),
                )
            }
        }
        p.edit().putStringSet(KEY_SEEN, seen).apply()
    }

    // ------------------------------------------------------------ invited

    /** The code in an invite link that opened the app, if this is one. */
    fun fromIntent(intent: Intent?): String? {
        val data = intent?.data ?: return null
        val raw = when {
            data.scheme == "brawlzonebubble" && data.host == "invite" -> data.lastPathSegment
            data.host == "brawlzone.net" && data.path?.startsWith("/bubble/invite") == true ->
                data.fragment?.split('&')?.map { it.split('=', limit = 2) }?.firstOrNull { it[0] == "c" }?.getOrNull(1)
            else -> null
        }
        return raw?.uppercase()?.takeIf { CODE.matches(it) }
    }

    /** A code from a link or the install referrer, kept until it is used. */
    fun receive(context: Context, raw: String) {
        val code = raw.trim().uppercase()
        if (!CODE.matches(code)) return
        prefs(context).edit().putString(KEY_PENDING, code).remove(KEY_ASKED).apply()
    }

    /** A code the app screen has not asked about yet. */
    fun toAsk(context: Context): String? {
        val p = prefs(context)
        val code = p.getString(KEY_PENDING, null) ?: return null
        return code.takeIf { p.getString(KEY_ASKED, null) != it }
    }

    fun markAsked(context: Context, code: String) {
        prefs(context).edit().putString(KEY_ASKED, code).apply()
    }

    fun drop(context: Context) {
        prefs(context).edit().remove(KEY_PENDING).remove(KEY_ASKED).apply()
    }

    data class From(val tag: String, val name: String?)

    /** Who a code belongs to. Off the main thread. */
    fun lookup(context: Context, code: String): From? {
        val reply = Http.get("${Http.SITE}/api/bubble/invite?c=$code&lang=${AppLang.current(context)}")
        if (reply.code !in 200..299) return null
        val j = runCatching { JSONObject(reply.body ?: return null) }.getOrNull() ?: return null
        val tag = j.optString("tag").takeIf { it.isNotEmpty() } ?: return null
        return From(tag, if (j.isNull("name")) null else j.optString("name"))
    }

    /**
     * Yes on the prompt: the inviter joins this player's friends, and the
     * site hears who opened the link. Without a tag of our own yet, the code
     * stays pending and finish() sends the accept once one is set.
     */
    fun accept(context: Context, code: String, from: From): Friends.AddResult {
        val result = if (from.tag == Account.tag(context)) Friends.AddResult.ALREADY else Friends.add(context, from.tag)
        finish(context, code)
        return result
    }

    /** Sends the accept for a pending code once this player has a tag. Off the main thread. */
    fun finish(context: Context, code: String? = prefs(context).getString(KEY_PENDING, null)) {
        if (code == null) return
        val tag = Account.tag(context)
        if (tag.isEmpty()) return
        val reply = Http.postJson("${Http.SITE}/api/bubble/invite/accept", JSONObject().put("c", code).put("tag", tag).toString())
        if (reply.code in 200..299 || reply.code == 404) drop(context)
    }
}
