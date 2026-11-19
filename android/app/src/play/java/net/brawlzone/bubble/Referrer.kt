package net.brawlzone.bubble

import android.content.Context
import android.net.Uri
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener

/**
 * Friend invites (1.42), Play build: someone who installed from an invite
 * link reached Google Play with `referrer=invite=CODE`, and Play hands that
 * back to the app once. The code then waits in Invite until the app screen
 * asks "add them to your friends?".
 */
object Referrer {

    private const val PREFS = "brawlzone-referrer"

    fun check(context: Context) {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean("done", false)) return
        val client = runCatching { InstallReferrerClient.newBuilder(app).build() }.getOrNull() ?: return
        runCatching {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(code: Int) {
                    when (code) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            val raw = runCatching { client.installReferrer.installReferrer }.getOrNull().orEmpty()
                            Uri.decode(raw).split('&')
                                .map { it.split('=', limit = 2) }
                                .firstOrNull { it.size == 2 && it[0] == "invite" }
                                ?.let { Invite.receive(app, it[1]) }
                            prefs.edit().putBoolean("done", true).apply()
                        }
                        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED ->
                            prefs.edit().putBoolean("done", true).apply()
                        else -> Unit // try again on the next open
                    }
                    runCatching { client.endConnection() }
                }

                override fun onInstallReferrerServiceDisconnected() = Unit
            })
        }
    }
}
