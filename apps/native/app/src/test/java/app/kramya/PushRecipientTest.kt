package app.kramya

import app.kramya.push.matchesPushRecipient
import app.kramya.push.matchesPushEnvironment
import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PushRecipientTest {
    @Test fun `production never displays a staging or untagged push`() {
        assertFalse(matchesPushEnvironment(null, "PRODUCTION"))
        assertFalse(matchesPushEnvironment("STAGING", "PRODUCTION"))
        assertTrue(matchesPushEnvironment("PRODUCTION", "PRODUCTION"))
        assertTrue(matchesPushEnvironment(null, "STAGING"))
    }
    private fun token(account: String) = "header." +
        Base64.getUrlEncoder().withoutPadding().encodeToString("""{"sub":"$account"}""".toByteArray()) + ".signature"

    @Test fun `only the currently signed in recipient can display a push`() {
        assertTrue(matchesPushRecipient(token("alice"), "alice"))
        assertFalse(matchesPushRecipient(token("bob"), "alice"))
        assertFalse(matchesPushRecipient(null, "alice"))
        assertFalse(matchesPushRecipient(token("alice"), null))
    }

    @Test fun `malformed or unbound payloads fail closed`() {
        assertFalse(matchesPushRecipient("not-a-jwt", "alice"))
        assertFalse(matchesPushRecipient("header.@@@.signature", "alice"))
        assertFalse(matchesPushRecipient("header.e30.signature", "alice"))
    }
}
