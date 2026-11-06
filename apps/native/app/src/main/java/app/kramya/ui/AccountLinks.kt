package app.kramya.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import app.kramya.BuildConfig

@Composable
fun AccountWebLink(title: String, path: String) {
    val context = LocalContext.current
    Button(title = title, variant = ButtonVariant.Ghost, onClick = {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_URL + path))
        try { context.startActivity(intent) }
        catch (_: android.content.ActivityNotFoundException) {
            android.widget.Toast.makeText(context, "Open ${BuildConfig.WEB_URL}$path in a browser", android.widget.Toast.LENGTH_LONG).show()
        }
    })
}

/** Opens the dialer/mail composer only after a patient taps. Never calls/sends. */
@Composable
fun ReceptionContacts(phone: String?, email: String?) {
    val context = LocalContext.current
    fun open(scheme: String, address: String) {
        val intent = Intent(if (scheme == "tel") Intent.ACTION_DIAL else Intent.ACTION_SENDTO, Uri.fromParts(scheme, address, null))
        try { context.startActivity(intent) }
        catch (_: android.content.ActivityNotFoundException) {
            android.widget.Toast.makeText(context, "Reception: $address", android.widget.Toast.LENGTH_LONG).show()
        }
    }
    phone?.takeIf { it.isNotBlank() }?.let { Button("Call reception", variant = ButtonVariant.Ghost, onClick = { open("tel", it) }) }
    email?.takeIf { it.isNotBlank() }?.let { Button("Email reception", variant = ButtonVariant.Ghost, onClick = { open("mailto", it) }) }
}
