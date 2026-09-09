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
  compileSdk = 34

  defaultConfig {
    applicationId = "net.brawlzone.bubble"
    minSdk = 26
    targetSdk = 34
    versionCode = 21
    versionName = "1.8.3"
  }

  signingConfigs {
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
  }
  // BuildConfig.VERSION_CODE is how the panel learns which build is asking.
  buildFeatures { buildConfig = true }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")

  /*
   * No OCR engine, deliberately.
   *
   * The mode and map ARE printed on the draft screen, and reading them with
   * ML Kit worked — at 11 MB of native pipeline per ABI, which took a 2.6 MB
   * app to 46 MB. That is an absurd price for two words, on an app people
   * download over mobile data from a page that calls it small.
   *
   * The plate is matched as a picture instead, against crops learned the first
   * time the reader confirms a map. See DraftVision.
   */
}
