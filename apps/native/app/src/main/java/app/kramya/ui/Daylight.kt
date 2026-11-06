package app.kramya.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.R
import app.kramya.core.Theme

/** Original ticket identity, shared with the web console. Decorative mark, spoken wordmark. */
@Composable
fun BrandLockup(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Image(painterResource(R.drawable.kramya_mark), contentDescription = null, modifier = Modifier.size(36.dp))
        BasicText("Kramya", style = Theme.Font.H2.copy(color=Theme.Colors.Ink, fontSize=26.sp))
    }
}

/** Concave sides at the ticket seam; geometry scales with the actual content height. */
object TicketShape : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val radius=with(density){16.dp.toPx()}
        val notch=with(density){10.dp.toPx()}
        val body=Path().apply { addRoundRect(RoundRect(Rect(0f,0f,size.width,size.height),CornerRadius(radius))) }
        val seam=size.height*.55f
        val cuts=Path().apply {
            addOval(Rect(-notch,seam-notch,notch,seam+notch))
            addOval(Rect(size.width-notch,seam-notch,size.width+notch,seam+notch))
        }
        return Outline.Generic(Path.combine(PathOperation.Difference,body,cuts))
    }
}

@Composable
fun BookingSteps() {
    Row(Modifier.fillMaxWidth().padding(bottom=16.dp),
        horizontalArrangement=Arrangement.SpaceBetween, verticalAlignment=Alignment.CenterVertically) {
        listOf("1  Details","2  Payment","3  Token").forEachIndexed { index, text ->
            BasicText(text,style=Theme.Font.Micro.copy(
                color=if(index==0) Theme.Colors.Primary else Theme.Colors.InkTertiary))
        }
    }
}

@Composable
fun QueueNumbers(here: Int, booked: Int, serving: String?) {
    Row(Modifier.fillMaxWidth().background(Theme.Colors.Surface,RoundedCornerShape(12.dp))
        .border(1.dp,Theme.Colors.Border,RoundedCornerShape(12.dp)).padding(vertical=16.dp)) {
        listOf(here.toString() to "checked in ahead",booked.toString() to "booked ahead",
            (serving ?: "—") to "now serving").forEach { (value,label) ->
            Column(Modifier.weight(1f).padding(horizontal=4.dp),
                horizontalAlignment=Alignment.CenterHorizontally,
                verticalArrangement=Arrangement.spacedBy(6.dp)) {
                BasicText(value,style=Theme.Font.Stat.copy(color=Theme.Colors.Ink,fontFeatureSettings="tnum"))
                BasicText(label,style=Theme.Font.Caption.copy(fontSize=11.sp,
                    color=Theme.Colors.InkTertiary,textAlign=androidx.compose.ui.text.style.TextAlign.Center))
            }
        }
    }
}
