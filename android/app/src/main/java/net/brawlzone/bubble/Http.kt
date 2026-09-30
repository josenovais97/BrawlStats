package net.brawlzone.bubble

import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * The one place the site's address and the request shape live.
 *
 * Two callers now read from it, and a second copy of "which host, which user
 * agent, how long to wait" is a copy that will eventually disagree with the
 * first — which here would mean one of them quietly talking to a stale origin.
 *
 * Hand-rolled rather than adding an HTTP library. The app is 2.8 MB and this
 * is two GETs and a bitmap; OkHttp would be a larger addition than everything
 * it is used for.
 */
object Http {

    const val SITE = "https://brawlzone.net"

    fun open(url: String): InputStream =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("User-Agent", "BrawlZoneBubble")
        }.inputStream

    fun text(url: String): String = open(url).use { it.readBytes().decodeToString() }
}
