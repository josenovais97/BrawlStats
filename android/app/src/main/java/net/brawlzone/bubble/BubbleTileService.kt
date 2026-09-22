package net.brawlzone.bubble

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * A Quick Settings tile that puts the bubble up or takes it down.
 *
 * The bubble exists for the seconds between "draft starts" and "draft ends",
 * and the app's own screen is the wrong place to reach it from: opening an
 * activity over a running game is the thing the overlay was built to avoid.
 * The shade is one swipe from any screen, including the game, and the tile
 * is the same toggle the app's Start button is — without leaving the match.
 *
 * Starting a foreground service from a tile is one of the cases Android 14
 * still permits from the background, because a tile tap is a user action. The
 * overlay permission is different: nothing can grant it but Settings, so a tap
 * without it opens the app's own screen, which explains what to do and where.
 */
class BubbleTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        render()
    }

    override fun onClick() {
        super.onClick()
        if (BubbleService.running) {
            startService(Intent(this, BubbleService::class.java).setAction(BubbleService.ACTION_STOP))
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            val intent = Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            @Suppress("DEPRECATION")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startActivityAndCollapse(
                    android.app.PendingIntent.getActivity(
                        this, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE,
                    ),
                )
            } else {
                startActivityAndCollapse(intent)
            }
            return
        }

        startForegroundService(Intent(this, BubbleService::class.java))
        // The service sets `running` and asks for a refresh once the overlay is
        // actually up; this is the immediate answer so the tile does not sit
        // inactive for the half second in between.
        qsTile?.apply { state = Tile.STATE_ACTIVE; updateTile() }
    }

    private fun render() {
        val tile = qsTile ?: return
        tile.state = if (BubbleService.running) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = "BrawlZone"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (BubbleService.running) "Bubble on" else "Bubble off"
        }
        tile.updateTile()
    }

    companion object {
        /** Ask the system to re-read the tile's state; a no-op if it is not added. */
        fun refresh(context: Context) {
            runCatching {
                requestListeningState(context, ComponentName(context, BubbleTileService::class.java))
            }
        }
    }
}
