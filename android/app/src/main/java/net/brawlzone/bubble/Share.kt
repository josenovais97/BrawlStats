package net.brawlzone.bubble

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Share cards (1.40): "My rank", "Season Wrapped" and this season vs last,
 * drawn by the site as a story-sized PNG (`/api/bubble/card`) and kept in the
 * app's cache. A tap shows the card first (1.44; it used to open the share
 * sheet straight away, so the only way to see a card was to share it), with
 * Share under it for TikTok, Instagram, WhatsApp or anywhere that takes a
 * picture.
 *
 * A card takes a few seconds to draw, so the app screen asks for both in the
 * background while the season card is on screen and keeps them for half an
 * hour: a tap then usually opens it at once. When it has to wait, the caller
 * is told (`onBusy`) so the button can say so.
 */
object Share {

    const val ACTION_WRAPPED = "net.brawlzone.bubble.WRAPPED"

    private const val PNG_MAGIC = 0x89.toByte()
    private const val FRESH_MS = 30 * 60 * 1000L
    private val prefetching = AtomicBoolean(false)
    /** A card on its way to the screen, so a double tap opens one. */
    private val opening = AtomicBoolean(false)

    private fun rankUrl(context: Context, tag: String) = Season.rankCardUrl(context, tag)

    private fun wrappedUrl(context: Context, tag: String) = Season.cardUrl(context, tag, Season.forCard(context, tag))

    fun rank(activity: Activity, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, rankUrl(activity, tag), "my-rank", R.string.share_rank, onBusy)
    }

    fun wrapped(activity: Activity, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, wrappedUrl(activity, tag), "season-wrapped", R.string.share_wrapped, onBusy)
    }

    /** One season's card (1.45): the running one ("so far") or the last ("wrapped"). */
    fun season(activity: Activity, which: String, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        card(activity, Season.cardUrlFor(activity, tag, which), if (which == SeasonPages.LAST) "season-last" else "season", R.string.share_wrapped, onBusy)
    }

    /** This season against the last one (1.42, Versus). */
    fun versus(activity: Activity, onBusy: (Boolean) -> Unit = {}) {
        val tag = Account.tag(activity).ifEmpty { return }
        val data = Versus.last(activity) ?: return
        card(activity, Versus.cardUrl(activity, tag, data), "season-vs", R.string.versus_share, onBusy)
    }

    /** Both cards for the current tag, drawn ahead of a tap. Off the main thread. */
    fun prefetch(context: Context) {
        val tag = Account.tag(context)
        if (tag.isEmpty() || !Account.isValid(tag)) return
        if (!prefetching.compareAndSet(false, true)) return
        val app = context.applicationContext
        Thread {
            try {
                for (url in listOf(rankUrl(app, tag), Season.cardUrlFor(app, tag, SeasonPages.NOW))) {
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

    /** A card from the cache when fresh, else drawn now (Roast). Off the main thread. */
    fun fetch(context: Context, url: String): File? {
        val ready = cached(context, url)
        return if (fresh(ready)) ready else download(context, url)
    }

    /** The share sheet for a card already on disk (Roast), with its own line of text. */
    fun sendFile(activity: Activity, file: File, name: String, text: String) = send(activity, file, name, text)

    private fun download(context: Context, url: String): File? = runCatching {
        val bytes = Http.bytes(url)
        require(bytes.size > 8 && bytes[0] == PNG_MAGIC)
        val target = cached(context, url)
        val part = File(target.path + ".part")
        part.writeBytes(bytes)
        require(part.renameTo(target))
        target
    }.getOrNull()

    /** The card, from the cache or drawn now, then on screen. */
    private fun card(activity: Activity, url: String, name: String, label: Int, onBusy: (Boolean) -> Unit) {
        if (!opening.compareAndSet(false, true)) return
        val app = activity.applicationContext
        val wait = !fresh(cached(app, url))
        if (wait) onBusy(true)
        val width = activity.resources.displayMetrics.widthPixels
        Thread {
            val file = fetch(app, url)
            val bitmap = file?.let { decode(it, width) }
            activity.runOnUiThread {
                opening.set(false)
                if (wait) onBusy(false)
                if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
                if (file == null || bitmap == null) {
                    Toast.makeText(activity, R.string.share_failed, Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                preview(activity, file, bitmap, name, label)
            }
        }.start()
    }

    /** Decoded no larger than the screen needs: a story is 1080x1920. */
    private fun decode(file: File, width: Int): Bitmap? = runCatching {
        val size = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, size)
        var sample = 1
        while (size.outWidth / (sample * 2) >= width) sample *= 2
        BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }.getOrNull()

    /** The card on screen (1.44), with Share and Close under it. It stays up after sharing. */
    private fun preview(activity: Activity, file: File, bitmap: Bitmap, name: String, label: Int) {
        val metrics = activity.resources.displayMetrics
        fun px(dp: Int) = (dp * metrics.density).toInt()
        val image = ImageView(activity).apply {
            setImageBitmap(bitmap)
            adjustViewBounds = true
            maxHeight = (metrics.heightPixels * 0.68f).toInt()
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = activity.getString(label)
            clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(view: View, outline: Outline) =
                    outline.setRoundRect(0, 0, view.width, view.height, px(14).toFloat())
            }
        }
        val share = TextView(activity).apply {
            setText(R.string.roast_share)
            setBackgroundResource(R.drawable.btn_gold)
            setTextColor(activity.getColor(R.color.brand_ink))
            textSize = 17f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(px(24), px(13), px(24), px(15))
        }
        val close = TextView(activity).apply {
            setText(R.string.roast_close)
            setTextColor(activity.getColor(R.color.muted))
            textSize = 15f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setPadding(px(24), px(14), px(24), px(6))
        }
        val content = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundResource(R.drawable.card_surface)
            setPadding(px(14), px(14), px(14), px(10))
            addView(image, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            addView(
                share,
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = px(12) },
            )
            addView(close, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        GameType.apply(activity, content)
        val dialog = AlertDialog.Builder(activity).setView(content).create()
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        share.setOnClickListener { send(activity, file, name) }
        close.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    /** A copy under a readable name ("season-wrapped.png"), then the share sheet. */
    private fun send(activity: Activity, source: File, name: String, text: String = activity.getString(R.string.share_text)) {
        val file = runCatching { source.copyTo(File(dir(activity), "$name.png"), overwrite = true) }.getOrNull() ?: return
        val uri: Uri = FileProvider.getUriForFile(activity, "${activity.packageName}.share", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, text)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        send.clipData = ClipData.newRawUri("", uri)
        runCatching { activity.startActivity(Intent.createChooser(send, null)) }
    }
}
