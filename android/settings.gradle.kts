/*
 * Google's mirror of Maven Central first (1.46). Maven Central answers
 * "429 Too Many Requests" to GitHub's shared runners at busy times, which
 * failed a test build before any code compiled; the mirror serves the same
 * files. Maven Central stays as the fallback.
 */
val centralMirror = "https://maven-central.storage-download.googleapis.com/maven2/"

pluginManagement {
  repositories {
    google()
    maven("https://maven-central.storage-download.googleapis.com/maven2/")
    mavenCentral()
    gradlePluginPortal()
  }
}
dependencyResolutionManagement {
  repositories {
    google()
    maven(centralMirror)
    mavenCentral()
  }
}
rootProject.name = "BrawlZone"
include(":app")
