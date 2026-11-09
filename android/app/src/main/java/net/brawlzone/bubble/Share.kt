package net.brawlzone.bubble

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * One-tap share cards (1.40): "My rank" and "Season Wrapped", drawn by the
 * site as a story-sized PNG (`/api/bubble/card`), saved in the app's cache
 * and handed to Android's share sheet, so they go to TikTok, Instagram,
 * WhatsApp or anywhere else that takes a picture.
 *
 * A card takes a few seconds to draw, so the app screen asks for both in the
 * background while the season card is on screen and keeps them for half an
 * hour: a tap then usually opens the share sheet at once. When it has to wait,
 * the caller is told (`onBusy`) so the button can say so.
 */
object Share {

    const val ACTION_WRAPPED = "net.brawlzone.bubble.WRAPPED"

    private const val PNG_MAGIC = 0x89.toByte()
    private const val FRESH_MS = 30 * 60 * 1000L
    private val prefetching = AtomicBoolean(false)

    private fun rankUrl(context: Context, tag: String) = Season.rankCardUrl(context, tag)

    private fun wrappedUrl(context: Context, tag: String) = Season.cardUrl(context, tag, Season.forCard(context, tag))

    fun rank(activity: Activity, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, rankUrl(activity, tag), "my-rank", onBusy)
    }

    fun wrapped(activity: Activity, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, wrappedUrl(activity, tag), "season-wrapped", onBusy)
    }

    /** Both cards for the current tag, drawn ahead of a tap. Off the main thread. */
    fun prefetch(context: Context) {
        val tag = Account.tag(context)
        if (tag.isEmpty() || !Account.isValid(tag)) return
        if (!prefetching.compareAndSet(false, true)) return
        val app = context.applicationContext
        Thread {
            try {
                for (url in listOf(rankUrl(app, tag), wrappedUrl(app, tag))) {
                    if (!fresh(cached(app, url))) download(app, url)
                }
            } finally {
                prefetching.set(false)
            }
        }.start()
    }

    private fun dir(context: Context) = File(context.cacheDir, "share").apply { mkdirs() }

    private fun cached(context: Context, url: String): File {
        val hash = MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(dir(context), "card-$hash.png")
    }

    private fun fresh(file: File) = file.exists() && System.currentTimeMillis() - file.lastModified() < FRESH_MS

    private fun download(context: Context, url: String): File? = runCatching {
        val bytes = Http.bytes(url)
        require(bytes.size > 8 && bytes[0] == PNG_MAGIC)
        val target = cached(context, url)
        val part = File(target.path + ".part")
        part.writeBytes(bytes)
        require(part.renameTo(target))
        target
    }.getOrNull()

    private fun card(activity: Activity, url: String, name: String, onBusy: (Boolean) -> Unit) {
        val app = activity.applicationContext
        val ready = cached(app, url)
        if (fresh(ready)) {
            send(activity, ready, name)
            return
        }
        onBusy(true)
        Thread {
            val file = download(app, url)
            activity.runOnUiThread {
                onBusy(false)
                if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                if (file == null) {
                    Toast.makeText(activity, R.string.share_failed, Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                send(activity, file, name)
            }
        }.start()
    }

    /** A copy under a readable name ("season-wrapped.png"), then the share sheet. */
    private fun send(activity: Activity, source: File, name: String) {
        val file = runCatching { source.copyTo(File(dir(activity), "$name.png"), overwrite = true) }.getOrNull() ?: return
        val uri: Uri = FileProvider.getUriForFile(activity, "${activity.packageName}.share", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, activity.getString(R.string.share_text))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        send.clipData = ClipData.newRawUri("", uri)
        runCatching { activity.startActivity(Intent.createChooser(send, null)) }
    }
}
