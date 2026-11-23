package net.brawlzone.bubble

import android.content.Context
import android.os.Build
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * Anonymous usage events, into the site's own Umami (1.43).
 *
 * Play shows ~half of installs never opening the app and almost nobody back
 * after a week, and nothing said where people stop. These events answer that:
 * setup steps, the bubble starting, tabs, widgets, notifications sent. Each
 * carries a random install number made here (a new one after a reinstall),
 * the app version and where it was installed from. Never the player tag, a
 * name or a friend. The privacy page says so.
 *
 * Fire-and-forget on one background thread; a failure is dropped silently.
 */
object Stats {
    private const val URL_SEND = "https://analytics.brawlzone.net/api/send"
    private const val WEBSITE = "09f04c04-b76c-41a0-927e-a6c88041a4e3"
    private const val PREFS = "brawlzone-stats"
    private const val KEY_IID = "iid"
    private const val KEY_FIRST = "first_day"
    private const val KEY_OPEN_DAY = "open_day"

    private val worker = Executors.newSingleThreadExecutor()

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun installId(context: Context): String {
        val p = prefs(context)
        p.getString(KEY_IID, null)?.let { return it }
        val id = UUID.randomUUID().toString()
        p.edit().putString(KEY_IID, id).putString(KEY_FIRST, LocalDate.now().toString()).apply()
        return id
    }

    /** Days since this install's first event: 0 on the first day. */
    private fun dayIndex(context: Context): Long {
        installId(context)
        val first = runCatching { LocalDate.parse(prefs(context).getString(KEY_FIRST, null)) }.getOrNull() ?: return 0
        return java.time.temporal.ChronoUnit.DAYS.between(first, LocalDate.now()).coerceAtLeast(0)
    }

    fun event(context: Context, name: String, data: Map<String, Any> = emptyMap()) {
        val app = context.applicationContext
        val iid = installId(app)
        val day = dayIndex(app)
        val lang = AppLang.current(app)
        val metrics = app.resources.displayMetrics
        worker.execute {
            runCatching {
                val props = JSONObject()
                    .put("iid", iid)
                    .put("v", BuildConfig.VERSION_NAME)
                    .put("src", BuildConfig.FLAVOR)
                    .put("day", day)
                for ((k, v) in data) props.put(k, v)
                val body = JSONObject()
                    .put("type", "event")
                    .put(
                        "payload",
                        JSONObject()
                            .put("website", WEBSITE)
                            .put("hostname", "brawlzone.net")
                            .put("url", "/app")
                            .put("name", name)
                            .put("language", lang)
                            .put("screen", "${metrics.widthPixels}x${metrics.heightPixels}")
                            .put("data", props),
                    )
                val c = (URL(URL_SEND).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 10_000
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}) BrawlZoneBubble/${BuildConfig.VERSION_NAME}")
                }
                c.outputStream.use { it.write(body.toString().toByteArray()) }
                c.responseCode
                c.disconnect()
            }
        }
    }

    /** An event sent at most once per install (first open, setup steps). */
    fun once(context: Context, name: String, data: Map<String, Any> = emptyMap()) {
        val p = prefs(context)
        val key = "once_$name"
        if (p.getBoolean(key, false)) return
        p.edit().putBoolean(key, true).apply()
        event(context, name, data)
    }

    /** "The app was opened today", once a day, with the day number since install. */
    fun opened(context: Context, hasTag: Boolean) {
        val p = prefs(context)
        val today = LocalDate.now().toString()
        if (p.getString(KEY_OPEN_DAY, null) == today) return
        p.edit().putString(KEY_OPEN_DAY, today).apply()
        event(context, "app_open", mapOf("tag" to hasTag))
    }
}
