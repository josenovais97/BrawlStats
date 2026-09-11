package net.brawlzone.bubble

import android.app.Activity
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.View
import android.widget.ImageView

/**
 * Shows one image full-screen, and nothing else. Debug builds only.
 *
 * An emulator has no Brawl Stars, so this is how a real draft capture gets in
 * front of the scanner there: push the fixture, open it here, start the
 * bubble, scan. The frame the projection captures is then the fixture at the
 * emulator's own resolution, with the bubble and panel composited over it
 * exactly as they would be on a phone — which is the whole path the JVM tests
 * cannot cover.
 *
 *     adb shell am start -n net.brawlzone.bubble/.FixtureActivity \
 *         --es path /sdcard/Download/draft-picked.jpg
 */
class FixtureActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val path = intent.getStringExtra("path") ?: return finish()
        val view = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_XY
            setImageBitmap(BitmapFactory.decodeFile(path))
            setBackgroundColor(0xFF000000.toInt())
        }
        setContentView(view)
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
    }
}
