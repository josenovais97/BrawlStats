package net.brawlzone.bubble

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.FrameLayout
import android.widget.Toast
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.lang.ref.WeakReference

/**
 * The banner and "Remove ads forever" (1.46, Play build only; the site build
 * has an empty twin in src/site).
 *
 * One AdMob banner sits above the bottom bar of the app screen, so it shows on
 * Home, Season, Squad and Settings and nowhere else: never in the bubble, the
 * panel or the widgets, which Google Play's ads policy treats as ads outside
 * the app. It is asked for only after Google's consent message (UMP) says ads
 * may be requested, which in the EU means after the player has answered it.
 *
 * "Remove ads forever" is the one-time Play product `remove_ads`. The answer
 * is kept on the phone, so the banner never flashes in for someone who paid,
 * and checked with Play on every visit: a refund brings the ads back, and a
 * reinstall or a new phone on the same Google account gets the purchase back
 * without asking. A purchase is acknowledged as soon as Play reports it, and
 * again on the next visit if that failed, because Play refunds any purchase
 * left unacknowledged for three days.
 *
 * The test build (qa) uses Google's sample ad unit, so testing never shows or
 * clicks a real ad, and it cannot buy: its package is not on Play.
 */
object Ads {

    /** The site build sells nothing; this one sells the removal. */
    const val SOLD = true
    const val PRODUCT = "remove_ads"

    private const val PREFS = "brawlzone-ads"
    private const val KEY_REMOVED = "removed"
    private const val KEY_AD_DAYS = "ad_days"
    private const val KEY_AD_DAY = "ad_day"

    private val main = Handler(Looper.getMainLooper())
    private var screen: WeakReference<Activity>? = null
    private var slot: FrameLayout? = null
    private var banner: AdView? = null
    private var changed: (() -> Unit)? = null
    private var initialized = false

    private var billing: BillingClient? = null
    private var connecting = false
    private val waiting = mutableListOf<Pair<() -> Unit, () -> Unit>>()
    private var product: ProductDetails? = null

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Bought, as far as this phone knows. */
    fun removed(context: Context): Boolean = prefs(context).getBoolean(KEY_REMOVED, false)

    /** How many different days a banner has been on screen (Home offers the removal from 3). */
    fun adDays(context: Context): Int = prefs(context).getInt(KEY_AD_DAYS, 0)

    private fun adShown(context: Context) {
        val today = System.currentTimeMillis() / 86_400_000L
        val p = prefs(context)
        if (p.getLong(KEY_AD_DAY, -1L) == today) return
        p.edit().putLong(KEY_AD_DAY, today).putInt(KEY_AD_DAYS, p.getInt(KEY_AD_DAYS, 0) + 1).apply()
    }

    /** The price in the player's own currency, once Play has said it. */
    fun price(): String? = product?.oneTimePurchaseOfferDetails?.formattedPrice

    /**
     * The app screen opened: check the purchase, then the consent, then the
     * banner. [onChange] repaints whatever shows the purchase or the privacy
     * choices (the Settings menu).
     */
    fun start(activity: Activity, adSlot: FrameLayout, onChange: () -> Unit) {
        screen = WeakReference(activity)
        slot = adSlot
        changed = onChange
        val app = activity.applicationContext
        connect(app, then = {
            checkOwned(app)
            loadProduct(null)
        })
        if (!removed(app)) askConsent(activity)
    }

    fun resume() {
        banner?.resume()
        val app = screen?.get()?.applicationContext ?: return
        if (billing?.isReady == true) checkOwned(app)
    }

    fun pause() {
        banner?.pause()
    }

    fun release() {
        banner?.destroy()
        banner = null
        slot = null
        changed = null
        screen = null
        billing?.endConnection()
        billing = null
        connecting = false
        waiting.clear()
        product = null
    }

    // ------------------------------------------------------------ consent

    private fun askConsent(activity: Activity) {
        val info = UserMessagingPlatform.getConsentInformation(activity)
        info.requestConsentInfoUpdate(
            activity,
            ConsentRequestParameters.Builder().build(),
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { _ ->
                    if (info.canRequestAds()) showBanner(activity)
                    changed?.invoke()
                }
            },
            { _ -> if (info.canRequestAds()) showBanner(activity) },
        )
        // An answer given on an earlier visit counts straight away.
        if (info.canRequestAds()) showBanner(activity)
    }

    /** The EU consent message asks for a way back to it; Settings shows one when it applies. */
    fun privacyChoicesNeeded(context: Context): Boolean =
        UserMessagingPlatform.getConsentInformation(context).privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    fun showPrivacyChoices(activity: Activity) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { _ -> changed?.invoke() }
    }

    // ------------------------------------------------------------- banner

    private fun showBanner(activity: Activity) {
        val holder = slot ?: return
        if (banner != null || removed(activity) || activity.isFinishing || activity.isDestroyed) return
        if (!initialized) {
            initialized = true
            /*
             * Rated for a general audience: the people who open this are
             * Brawl Stars players, and plenty of them are young.
             */
            MobileAds.setRequestConfiguration(
                RequestConfiguration.Builder()
                    .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG)
                    .build(),
            )
            val app = activity.applicationContext
            Thread { MobileAds.initialize(app) {} }.start()
        }
        holder.post {
            if (banner != null || slot !== holder || removed(activity) || activity.isDestroyed) return@post
            val metrics = activity.resources.displayMetrics
            val width = if (holder.width > 0) holder.width else metrics.widthPixels
            val view = AdView(activity)
            view.setAdUnitId(BuildConfig.BANNER_UNIT)
            view.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, (width / metrics.density).toInt()))
            // The slot stays closed until an ad has arrived, so a failed load leaves no empty strip.
            view.setAdListener(object : AdListener() {
                override fun onAdLoaded() {
                    if (slot === holder && !removed(activity)) {
                        holder.visibility = View.VISIBLE
                        adShown(activity)
                    }
                }
            })
            holder.removeAllViews()
            holder.addView(view)
            banner = view
            view.loadAd(AdRequest.Builder().build())
        }
    }

    private fun hideBanner() {
        banner?.destroy()
        banner = null
        slot?.removeAllViews()
        slot?.visibility = View.GONE
    }

    // ------------------------------------------------------------ billing

    private val purchases = PurchasesUpdatedListener { result, bought ->
        main.post {
            val app = screen?.get()?.applicationContext ?: return@post
            when (result.responseCode) {
                BillingResponseCode.OK -> bought?.forEach { handle(app, it, announce = true) }
                BillingResponseCode.ITEM_ALREADY_OWNED -> checkOwned(app) { owned -> if (owned == true) say(R.string.ads_restored) }
                BillingResponseCode.USER_CANCELED -> Unit
                else -> say(R.string.ads_unavailable)
            }
        }
    }

    private fun connect(app: Context, then: () -> Unit, failed: () -> Unit = {}) {
        val client = billing ?: BillingClient.newBuilder(app)
            .setListener(purchases)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
            .also { billing = it }
        if (client.isReady) {
            then()
            return
        }
        waiting += then to failed
        if (connecting) return
        connecting = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                main.post {
                    connecting = false
                    val ok = result.responseCode == BillingResponseCode.OK
                    val calls = waiting.toList()
                    waiting.clear()
                    for ((done, fail) in calls) if (ok) done() else fail()
                }
            }

            override fun onBillingServiceDisconnected() {
                main.post { connecting = false }
            }
        })
    }

    private fun loadProduct(then: (() -> Unit)?) {
        val client = billing ?: return
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build(),
                ),
            )
            .build()
        client.queryProductDetailsAsync(params) { result, found ->
            main.post {
                if (result.responseCode == BillingResponseCode.OK) {
                    product = found.productDetailsList.firstOrNull { it.productId == PRODUCT }
                    changed?.invoke()
                }
                then?.invoke()
            }
        }
    }

    /**
     * Asks Play what this Google account owns. [done] gets true or false, or
     * null when Play did not answer (nothing changes then).
     */
    private fun checkOwned(app: Context, done: ((Boolean?) -> Unit)? = null) {
        val client = billing
        if (client == null || !client.isReady) {
            done?.invoke(null)
            return
        }
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
        ) { result, list ->
            main.post {
                if (result.responseCode != BillingResponseCode.OK) {
                    done?.invoke(null)
                    return@post
                }
                val mine = list.filter { PRODUCT in it.products }
                mine.forEach { handle(app, it, announce = false) }
                val owned = mine.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                // Refunded, or a different Google account on this phone: the ads come back next visit.
                if (!owned && removed(app)) setRemoved(app, false)
                done?.invoke(owned)
            }
        }
    }

    private fun handle(app: Context, purchase: Purchase, announce: Boolean) {
        if (PRODUCT !in purchase.products) return
        when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> {
                val fresh = !removed(app)
                setRemoved(app, true)
                // The ring is part of what was bought: worn straight away unless another is on.
                if (fresh && BubbleLook.ring(app) == null) BubbleLook.setRing(app, Rings.SUPPORTER.id)
                if (!purchase.isAcknowledged) {
                    billing?.acknowledgePurchase(
                        AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build(),
                    ) { }
                }
                if (announce || fresh) say(R.string.ads_removed_sub)
            }
            Purchase.PurchaseState.PENDING -> if (announce) say(R.string.ads_pending)
            else -> Unit
        }
    }

    private fun setRemoved(app: Context, value: Boolean) {
        if (removed(app) == value) return
        prefs(app).edit().putBoolean(KEY_REMOVED, value).apply()
        if (value) hideBanner()
        changed?.invoke()
    }

    /** "Remove ads forever": Play's own purchase sheet. */
    fun buy(activity: Activity) {
        screen = WeakReference(activity)
        if (BuildConfig.BUILD_TYPE == "qa") {
            Toast.makeText(activity, "Test build: buying works only in the app from Google Play", Toast.LENGTH_LONG).show()
            return
        }
        val app = activity.applicationContext
        connect(app, then = {
            val launch = launch@{
                val details = product ?: return@launch say(R.string.ads_unavailable)
                if (activity.isFinishing || activity.isDestroyed) return@launch
                val params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(
                        listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()),
                    )
                    .build()
                val result = billing?.launchBillingFlow(activity, params)
                when (result?.responseCode) {
                    BillingResponseCode.OK -> Unit
                    BillingResponseCode.ITEM_ALREADY_OWNED -> checkOwned(app) { owned -> if (owned == true) say(R.string.ads_restored) }
                    else -> say(R.string.ads_unavailable)
                }
            }
            if (product != null) launch() else loadProduct(launch)
        }, failed = { say(R.string.ads_unavailable) })
    }

    /** "Restore purchase": the same check every visit makes, with an answer. */
    fun restore(activity: Activity) {
        screen = WeakReference(activity)
        val app = activity.applicationContext
        connect(app, then = {
            checkOwned(app) { owned ->
                say(
                    when (owned) {
                        true -> R.string.ads_restored
                        false -> R.string.ads_restore_none
                        null -> R.string.ads_unavailable
                    },
                )
            }
        }, failed = { say(R.string.ads_unavailable) })
    }

    /** A short message in the app's language (the screen's context carries it). */
    private fun say(text: Int) {
        val context = screen?.get()?.takeUnless { it.isFinishing || it.isDestroyed } ?: return
        Toast.makeText(context, context.getString(text), Toast.LENGTH_LONG).show()
    }
}
