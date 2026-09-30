package net.brawlzone.bubble

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * What this account should upgrade next.
 *
 * The answer is computed on the server by the same optimiser the profile page
 * runs, and arrives as finished sentences rather than numbers. That is
 * deliberate: an installed APK is the one version of this product that cannot
 * be told it is wrong, so the wording, the pluralisation and the coin format
 * are not compiled into it. This class draws what it is given.
 */
object PlanLookup {

    data class Step(
        val name: String,
        val icon: String,
        val detail: String,
        val gain: String,
    )

    data class Plan(
        val headline: String,
        val note: String,
        val steps: List<Step>,
    )

    /**
     * Its own executor and its own token, rather than sharing the account's.
     *
     * The two requests are started by the same events and a shared token would
     * mean a returning plan cancelling a returning icon, or the reverse —
     * whichever lost would simply never draw, with nothing on screen to say a
     * request had been dropped.
     */
    private val pool = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var token = 0

    fun cancel() {
        token += 1
    }

    fun load(tag: String, onResult: (Plan?) -> Unit) {
        val mine = ++token
        pool.execute {
            val plan = runCatching { fetch(tag) }.getOrNull()
            main.post { if (mine == token) onResult(plan) }
        }
    }

    fun icon(url: String, onResult: (Bitmap?) -> Unit) {
        val mine = token
        pool.execute {
            val bitmap = runCatching {
                Http.open(url).use { BitmapFactory.decodeStream(it) }
            }.getOrNull()
            main.post { if (mine == token) onResult(bitmap) }
        }
    }

    private fun fetch(tag: String): Plan? {
        val json = JSONObject(Http.text("${Http.SITE}/api/bubble/plan?tag=$tag"))
        if (json.has("error")) return null

        val array = json.getJSONArray("steps")
        val steps = (0 until array.length()).map { i ->
            val s = array.getJSONObject(i)
            Step(
                name = s.getString("name"),
                icon = s.optString("icon", ""),
                detail = s.getString("detail"),
                gain = s.optString("gain", ""),
            )
        }

        return Plan(
            headline = json.getString("headline"),
            note = json.getString("note"),
            steps = steps,
        )
    }
}
