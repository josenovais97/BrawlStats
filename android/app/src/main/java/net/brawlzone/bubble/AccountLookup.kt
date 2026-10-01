package net.brawlzone.bubble

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Resolves a tag to a name, a face and three counts.
 *
 * A tag is a string of characters nobody can check by looking at it. One wrong
 * letter is a valid-looking tag belonging to a stranger, and the only symptom
 * is that every filter in the panel seems broken. A name and an icon make that
 * mistake visible in the half-second it takes to read them.
 *
 * Hand-rolled rather than adding an HTTP or image library. The app is 2.6 MB
 * and this is one GET and one bitmap; Glide or Coil would be a larger addition
 * than the feature.
 */
object AccountLookup {

    data class Result(
        val tag: String,
        val name: String,
        val iconUrl: String,
        val trophies: Int,
        val owned: Int,
        val powerEleven: Int,
        val hypercharged: Int,
    )

    /**
     * One thread, and the newest request wins.
     *
     * The field fires a lookup as it is typed, so a tag typed at speed queues
     * several — and they can finish out of order, leaving the card showing the
     * account for a prefix of what is in the box. The token check at the end
     * drops anything that is no longer the current request.
     */
    private val pool = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var token = 0

    fun cancel() {
        token += 1
    }

    fun lookup(tag: String, onResult: (Result?) -> Unit) {
        val mine = ++token
        pool.execute {
            val result = runCatching { fetch(tag) }.getOrNull()
            main.post { if (mine == token) onResult(result) }
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

    private fun fetch(tag: String): Result? {
        val body = Http.text("${Http.SITE}/api/bubble/roster?tag=$tag")
        val json = JSONObject(body)
        if (json.has("error")) return null

        val brawlers = json.getJSONArray("brawlers")
        var eleven = 0
        var hyper = 0
        for (i in 0 until brawlers.length()) {
            val b = brawlers.getJSONObject(i)
            if (b.getInt("power") >= 11) {
                eleven += 1
                if (b.getBoolean("hypercharge")) hyper += 1
            }
        }

        return Result(
            tag = json.getString("tag"),
            name = json.getString("name"),
            iconUrl = json.optString("iconUrl", ""),
            trophies = json.optInt("trophies", 0),
            owned = brawlers.length(),
            powerEleven = eleven,
            hypercharged = hyper,
        )
    }
}
