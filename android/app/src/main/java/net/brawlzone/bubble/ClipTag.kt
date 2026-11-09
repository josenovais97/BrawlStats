package net.brawlzone.bubble

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context

/**
 * A player tag on the clipboard (1.40).
 *
 * Brawl Stars copies the tag when you tap it on your profile, so the most
 * likely thing on the clipboard of someone setting up this app is exactly the
 * string they would otherwise type. Read only when the tag field is empty and
 * the screen has focus (Android allows nothing else), and only offered as a
 * one-tap suggestion: nothing is saved until the player taps it.
 */
object ClipTag {

    private val SHAPE = Regex("^#?([0-9A-Za-z]{3,15})$")

    fun find(context: Context): String? = runCatching {
        val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return null
        if (!clipboard.hasPrimaryClip()) return null
        val description = clipboard.primaryClipDescription ?: return null
        if (!description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) &&
            !description.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML)
        ) return null
        val text = clipboard.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString()?.trim()
            ?: return null
        if (text.length > 20) return null
        val match = SHAPE.find(text.replace(" ", "")) ?: return null
        val tag = Account.normalise(match.groupValues[1])
        if (Account.isValid(tag)) tag else null
    }.getOrNull()
}
