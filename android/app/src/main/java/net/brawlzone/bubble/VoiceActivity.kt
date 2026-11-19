package net.brawlzone.bubble

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast

/**
 * Ask Bubble by voice (1.42): a see-through screen that opens the phone's own
 * speech input (Google's, on device where it can), and hands what was said to
 * the bubble, which opens Ask with it. No microphone permission for this app:
 * the system's voice input does the listening.
 */
class VoiceActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) return
        val lang = intent.getStringExtra(EXTRA_LANG) ?: AppLang.current(this)
        val listen = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, AppLang.locale(lang).toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_PROMPT, AppLang.wrap(this).getString(R.string.ask_voice_prompt))
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(listen, REQUEST)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.ask_voice_missing, Toast.LENGTH_LONG).show()
            deliver(null)
        }
    }

    @Deprecated("startActivityForResult is enough for one system screen")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        val heard = if (resultCode == RESULT_OK) data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() else null
        deliver(heard)
    }

    private fun deliver(text: String?) {
        // Back to the bubble either way: with the question, or just Ask open again.
        val intent = Intent(this, BubbleService::class.java)
            .setAction(BubbleService.ACTION_ASK_HEARD)
            .putExtra(BubbleService.EXTRA_TEXT, text.orEmpty())
        runCatching { startForegroundService(intent) }
        finish()
    }

    companion object {
        private const val REQUEST = 1
        private const val EXTRA_LANG = "lang"

        fun start(context: Context, lang: String) {
            val intent = Intent(context, VoiceActivity::class.java)
                .putExtra(EXTRA_LANG, lang)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            runCatching { context.startActivity(intent) }
        }
    }
}
