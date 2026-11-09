package net.brawlzone.bubble

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File

/**
 * One-tap share cards (1.40): "My rank" and "Season Wrapped", drawn by the
 * site as a story-sized PNG (`/api/bubble/card`), saved in the app's cache
 * and handed to Android's share sheet, so they go to TikTok, Instagram,
 * WhatsApp or anywhere else that takes a picture.
 */
object Share {

    const val ACTION_WRAPPED = "net.brawlzone.bubble.WRAPPED"

    private const val PNG_MAGIC = 0x89.toByte()

    fun rank(activity: Activity) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, Season.rankCardUrl(activity, tag), "my-rank")
    }

    fun wrapped(activity: Activity) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, Season.cardUrl(activity, tag, Season.forCard(activity, tag)), "season-wrapped")
    }

    private fun card(activity: Activity, url: String, name: String) {
        Toast.makeText(activity, R.string.share_making, Toast.LENGTH_SHORT).show()
        val app = activity.applicationContext
        Thread {
            val file = runCatching {
                val bytes = Http.bytes(url)
                require(bytes.size > 8 && bytes[0] == PNG_MAGIC)
                val dir = File(app.cacheDir, "share").apply { mkdirs() }
                File(dir, "$name.png").apply { writeBytes(bytes) }
            }.getOrNull()
            activity.runOnUiThread {
                if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                if (file == null) {
                    Toast.makeText(activity, R.string.share_failed, Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                val uri: Uri = FileProvider.getUriForFile(activity, "${activity.packageName}.share", file)
                val send = Intent(Intent.ACTION_SEND)
                    .setType("image/png")
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .putExtra(Intent.EXTRA_TEXT, activity.getString(R.string.share_text))
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                send.clipData = ClipData.newRawUri("", uri)
                runCatching { activity.startActivity(Intent.createChooser(send, null)) }
            }
        }.start()
    }
}
