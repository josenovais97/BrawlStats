import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

/*
 * Release signing, read from a file that is never committed.
 *
 * The keystore and its passwords live in `keystore/`, mode 600, outside version
 * control. Losing that file means every future build is a *different* app as
 * far as Android is concerned — it cannot be installed as an update over this
 * one, and on Play it cannot be published to the same listing at all. Back it
 * up somewhere other than this machine.
 *
 * The block is conditional so a checkout without the keystore still builds a
 * debug APK rather than failing to configure.
 */
val keystoreProps = Properties().apply {
  val f = rootProject.file("keystore/keystore.properties")
  if (f.exists()) f.inputStream().use { load(it) }
}
val hasSigning = keystoreProps.getProperty("storeFile") != null

android {
  namespace = "net.brawlzone.bubble"
  compileSdk = 36

  defaultConfig {
    applicationId = "net.brawlzone.bubble"
    minSdk = 26
    /*
     * Android 16. Google Play refuses new apps and updates that target less
     * since 2026-08-31. Targeting 35+ also makes the launcher screen draw edge
     * to edge (see MainActivity.fitSystemBars).
     */
    targetSdk = 36
    versionCode = 53
    versionName = "1.40"

    // The launcher name. The test build (qa, below) overrides it so it can sit
    // next to the real app on the same phone without looking identical.
    manifestPlaceholders["appLabel"] = "@string/app_name"

    /*
     * Where the panel is served from. The site, always, in a release; a
     * debug build accepts `-PpanelOrigin=http://10.0.2.2:3000` so the panel
     * running on a laptop's `next dev` can be driven from an emulator before
     * anything is deployed. The bridge is the only contract between the two
     * halves, and this is the only way to test both halves of a change to it
     * without shipping one of them first.
     */
    buildConfigField("String", "PANEL_ORIGIN", "\"https://brawlzone.net\"")
  }

  /*
   * Two builds of the same app, same package and same key, so either one
   * installs as an update over the other (1.30).
   *
   * `site` is the APK served from brawlzone.net: it fetches its own updates,
   * because nothing else will tell a sideloaded install a new version exists.
   * `play` is what goes to Google Play, whose policy forbids an app updating
   * itself by any route but Play's -- so it has no updater and does not ask
   * for REQUEST_INSTALL_PACKAGES (removed in src/play/AndroidManifest.xml),
   * and it tells the panel so, which then leaves updates to Play.
   *
   *   ./gradlew assembleSiteRelease   # the APK for the site
   *   ./gradlew bundlePlayRelease     # the .aab for Google Play
   */
  flavorDimensions += "store"
  productFlavors {
    create("site") {
      dimension = "store"
      buildConfigField("String", "STORE", "\"site\"")
    }
    create("play") {
      dimension = "store"
      buildConfigField("String", "STORE", "\"play\"")
    }
  }

  buildTypes {
    debug {
      val origin = (project.findProperty("panelOrigin") as String?) ?: "https://brawlzone.net"
      buildConfigField("String", "PANEL_ORIGIN", "\"$origin\"")
    }
  }

  signingConfigs {
    /*
     * The side-by-side test build (1.40). Its keystore is committed on
     * purpose: it signs nothing but `net.brawlzone.bubble.test`, which can
     * never update or impersonate the real app, and a fixed key is what lets
     * one test build install over the previous one.
     */
    create("qa") {
      storeFile = rootProject.file("qa.keystore")
      storePassword = "bubbletest"
      keyAlias = "qa"
      keyPassword = "bubbletest"
    }
    if (hasSigning) {
      create("release") {
        storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
        storePassword = keystoreProps.getProperty("storePassword")
        keyAlias = keystoreProps.getProperty("keyAlias")
        keyPassword = keystoreProps.getProperty("keyPassword")
      }
    }
  }

  buildTypes {
    release {
      /*
       * Shrinking left off deliberately. It would save under a megabyte on a
       * three-megabyte app, and the things R8 breaks — reflection into the
       * WebView, the manifest's service property — fail at runtime rather than
       * at build time, which is the worst place to discover them for a build
       * that ships to a phone by sideload with no crash reporting behind it.
       */
      isMinifyEnabled = false
      if (hasSigning) signingConfig = signingConfigs.getByName("release")
    }
    /*
     * "Bubble Test" (1.40): a release build under its own package and name,
     * built by GitHub Actions (.github/workflows/bubble-test-apk.yml) so a
     * change can be tried on a phone without uninstalling the real app.
     *
     *   ./gradlew assemblePlayQa   # what the workflow builds
     */
    create("qa") {
      initWith(getByName("release"))
      applicationIdSuffix = ".test"
      versionNameSuffix = "-test"
      signingConfig = signingConfigs.getByName("qa")
      manifestPlaceholders["appLabel"] = "Bubble Test"
      matchingFallbacks += listOf("release")
    }
  }
  /*
   * Every language in every APK. The app switches language itself (AppLang),
   * so a bundle split by the device locale would ship without the one the
   * player picks. Only matters if this is ever uploaded as an app bundle.
   */
  bundle { language { enableSplit = false } }

  // BuildConfig.VERSION_CODE is how the panel learns which build is asking.
  buildFeatures { buildConfig = true }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }

  // Unit tests run on the JVM; this keeps the stubbed android.jar from
  // throwing on the handful of platform calls a test touches indirectly.
  testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
  testImplementation("junit:junit:4.13.2")
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  /*
   * Google Play's in-app review and in-app update (1.40). Play build only:
   * the site APK is not installed from Play, and both would do nothing there
   * but add Google's libraries to an app that promises not to need them.
   */
  "playImplementation"("com.google.android.play:review:2.0.2")
  "playImplementation"("com.google.android.play:app-update:2.1.0")
}
