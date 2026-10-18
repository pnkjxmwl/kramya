package app.kramya

import app.kramya.screens.isCheckoutReturn
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutReturnTest {
    private val callback = "https://api.example.com/webhooks/checkout-complete"

    @Test
    fun `accepts gateway return endpoint with query or fragment data`() {
        assertTrue(isCheckoutReturn(callback, callback))
        assertTrue(isCheckoutReturn("$callback?error=declined", callback))
        assertTrue(isCheckoutReturn("$callback#result", callback))
    }

    @Test
    fun `rejects prefix matches and unrelated endpoints`() {
        assertFalse(isCheckoutReturn("$callback-extra", callback))
        assertFalse(isCheckoutReturn("https://api.example.com/webhooks/razorpay", callback))
    }

    @Test
    fun `rejects changed origins credentials and malformed addresses`() {
        assertFalse(isCheckoutReturn("https://api.example.com.attacker.test/webhooks/checkout-complete", callback))
        assertFalse(isCheckoutReturn("http://api.example.com/webhooks/checkout-complete", callback))
        assertFalse(isCheckoutReturn("https://api.example.com:444/webhooks/checkout-complete", callback))
        assertFalse(isCheckoutReturn("https://user@api.example.com/webhooks/checkout-complete", callback))
        assertFalse(isCheckoutReturn("not a valid URL", callback))
    }
}
