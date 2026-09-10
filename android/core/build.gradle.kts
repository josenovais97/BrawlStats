/*
 * The recognition maths, with no Android in it.
 *
 * Its own module so it can be *tested*. Inside the app module a unit test
 * compiles against Android's stubbed android.jar, which has no `javax.imageio`
 * — so a test cannot even open the screenshot it is meant to check. Here it is
 * an ordinary JVM library, and `./gradlew :core:test` runs the real matcher
 * against real captures of a real draft in a couple of seconds.
 *
 * That is not a tidiness argument. Recognition used to be verifiable only by
 * installing the app and opening a match, and several releases shipped on
 * reasoning that turned out to be wrong. This module is what replaces the
 * reasoning with evidence.
 */
plugins {
  id("org.jetbrains.kotlin.jvm")
}

kotlin { jvmToolchain(17) }

dependencies {
  testImplementation("junit:junit:4.13.2")
}

tasks.test { testLogging { showStandardStreams = true } }
