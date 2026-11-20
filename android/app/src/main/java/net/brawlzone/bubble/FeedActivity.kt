package net.brawlzone.bubble

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * The whole squad feed (1.42, Feed): every post on the phone, newest first,
 * with everyone's reactions fetched fresh when it opens.
 */
class FeedActivity : AppCompatActivity() {

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLang.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_feed)
        val scroll = findViewById<ScrollView>(R.id.feed_scroll)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        scroll.clipToPadding = false
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        findViewById<View>(R.id.feed_back).setOnClickListener { finish() }
        FeedView.gameType(this, scroll)
    }

    override fun onResume() {
        super.onResume()
        paint()
        Feed.markSeen(this)
        val app = applicationContext
        Thread {
            Feed.syncReactions(app)
            runOnUiThread { if (!isFinishing && !isDestroyed) paint() }
        }.start()
    }

    private fun paint() {
        val list = findViewById<LinearLayout>(R.id.feed_list)
        val posts = Feed.posts(this)
        list.removeAllViews()
        for (post in posts) list.addView(FeedView.inflate(this, list, post))
        findViewById<TextView>(R.id.feed_none).visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
    }
}
