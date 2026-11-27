package net.brawlzone.bubble

import android.content.Context

/**
 * Bubble Supporter (1.46): the one-time Play purchase (`remove_ads`) that
 * takes the ads away and unlocks the Supporter ring and two themes. The Play
 * build sells it (Ads); the site build has nothing to sell, so nobody there
 * is a supporter.
 */
object Supporter {
    fun active(context: Context): Boolean = Ads.SOLD && Ads.removed(context)
}
