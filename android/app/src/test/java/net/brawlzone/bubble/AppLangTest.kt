package net.brawlzone.bubble

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/**
 * The app has to land on the same language the panel picks for the same
 * phone, or a player who never opens either picker sees two languages. These
 * mirror `detectBubbleLang` in src/lib/bubble-langs.ts.
 */
class AppLangTest {

    @Test
    fun followsThePhone() {
        assertEquals("fr", AppLang.detect(listOf("fr-FR")))
        assertEquals("pt", AppLang.detect(listOf("pt-PT")))
        assertEquals("en", AppLang.detect(listOf("en-US")))
    }

    @Test
    fun skipsLanguagesTheGameDoesNotShip() {
        assertEquals("de", AppLang.detect(listOf("sv-SE", "de-DE")))
        assertEquals("en", AppLang.detect(listOf("nb-NO")))
        assertEquals("en", AppLang.detect(emptyList()))
    }

    @Test
    fun chineseScriptFromScriptOrRegion() {
        assertEquals("zh-Hans", AppLang.detect(listOf("zh-CN")))
        assertEquals("zh-Hans", AppLang.detect(listOf("zh-Hans-CN")))
        assertEquals("zh-Hant", AppLang.detect(listOf("zh-TW")))
        assertEquals("zh-Hant", AppLang.detect(listOf("zh-Hant-HK")))
    }

    @Test
    fun spainGetsCastilianEveryoneElseLatinAmerican() {
        assertEquals("es", AppLang.detect(listOf("es-ES")))
        assertEquals("es", AppLang.detect(listOf("es")))
        assertEquals("es-419", AppLang.detect(listOf("es-MX")))
        assertEquals("es-419", AppLang.detect(listOf("es-419")))
    }

    @Test
    fun legacyCodes() {
        assertEquals("he", AppLang.detect(listOf("iw-IL")))
        assertEquals("id", AppLang.detect(listOf("in-ID")))
    }

    @Test
    fun everyCodeIsKnownAndTheListMatchesTheGame() {
        assertEquals(22, AppLang.ALL.size)
        assertEquals(22, AppLang.ALL.map { it.code }.toSet().size)
        for (code in listOf("en", "es-419", "zh-Hant", "ar", "he")) assertNotNull(AppLang.byCode(code))
    }
}
