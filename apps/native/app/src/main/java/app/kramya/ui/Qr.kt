package app.kramya.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * The check-in QR, drawn.
 *
 * apps/mobile uses `react-native-qrcode-svg`; this uses ZXing's encoder and paints the
 * modules onto a Compose canvas. Same matrix, same appearance - and drawing it directly
 * rather than rasterising to a Bitmap means it stays crisp at any size, which matters for
 * something scanned across a reception desk.
 *
 * **The value is rendered verbatim and never parsed.** `checkInCode` is
 * `v1.<opaque ref>.<hmac>`: the reference is what the server stores, the signature is
 * recomputed on every read, and the client is not meant to be able to tell the parts
 * apart. It carries no PII and no id (docs/Rules.md 10).
 */
@Composable
fun QrCode(
    value: String,
    size: Dp,
    color: Color,
    background: Color,
    modifier: Modifier = Modifier,
) {
    // Encoding is pure and cheap for a string this short, but it is not free, and this
    // screen polls every 90 seconds - so it is keyed on the value rather than redone on
    // every recomposition.
    val matrix: BitMatrix? = remember(value) {
        runCatching {
            QRCodeWriter().encode(
                value,
                BarcodeFormat.QR_CODE,
                // 0x0 asks ZXing for the raw module matrix rather than a scaled bitmap.
                // Scaling here instead means one rect per module - a few hundred - rather
                // than a quarter of a million pixels to walk.
                0,
                0,
                mapOf(
                    // M is react-native-qrcode-svg's default, so both apps encode the same
                    // payload to the same matrix size.
                    EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
                    // No quiet zone inside the matrix: the white card around it already
                    // provides one, exactly as the RN component's `quietZone={0}` assumes.
                    EncodeHintType.MARGIN to 0,
                    EncodeHintType.CHARACTER_SET to "UTF-8",
                ),
            )
        }.getOrNull()
    }

    Canvas(
        modifier
            .size(size)
            // A QR code announced to a screen reader is a wall of base64. The hint beneath
            // it is what carries the meaning.
            .clearAndSetSemantics { },
    ) {
        if (matrix == null) return@Canvas

        drawRect(color = background, size = this.size)

        val modules = matrix.width
        // Floor the module size, then centre the remainder. Rounding up instead leaves the
        // last column clipped, which is exactly the kind of damage a scanner will not
        // forgive.
        val module = kotlin.math.floor(this.size.minDimension / modules)
        val drawn = module * modules
        val originX = (this.size.width - drawn) / 2f
        val originY = (this.size.height - drawn) / 2f

        for (y in 0 until matrix.height) {
            for (x in 0 until modules) {
                if (!matrix.get(x, y)) continue
                drawRect(
                    color = color,
                    topLeft = Offset(originX + x * module, originY + y * module),
                    size = Size(module, module),
                )
            }
        }
    }
}
