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

    fun open(url: String, readTimeoutMs: Int = 10_000): InputStream =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = readTimeoutMs
            setRequestProperty("User-Agent", "BrawlZoneBubble")
        }.inputStream

    fun text(url: String): String = open(url).use { it.readBytes().decodeToString() }

    /** A status and a body: what failed matters when a lookup fails (1.41). */
    data class Reply(val code: Int, val body: String?)

    /**
     * GET that tells "the server said no" (404 and friends, with the body)
     * from "could not ask" (no network, timeout: code -1). The account check
     * needs the difference: only a real 404 means the tag does not exist.
     */
    fun get(url: String): Reply = runCatching {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("User-Agent", "BrawlZoneBubble")
        }
        val code = c.responseCode
        val stream = if (code in 200..299) c.inputStream else c.errorStream
        Reply(code, stream?.use { it.readBytes().decodeToString() })
    }.getOrElse { Reply(-1, null) }

    /** A drawn share card can take several seconds on the server (1.40). */
    fun bytes(url: String): ByteArray = open(url, readTimeoutMs = 30_000).use { it.readBytes() }
}
