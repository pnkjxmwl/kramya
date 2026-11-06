package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.kramya.core.Theme
import app.kramya.nav.NavBar
import app.kramya.net.*
import app.kramya.ui.*
import app.kramya.ui.Row

/** Actual clinic details with a compact cover and direct department entry. */
@Composable
fun HospitalScreen(hospitalId:String,onBack:()->Unit,onOpenDepartment:(String)->Unit) {
    val hospital=useApi<HospitalDetail>("/hospitals/$hospitalId")
    val departments=useApi<Paginated<PublicDepartment>>("/hospitals/$hospitalId/departments?limit=$PAGE")
    val data=hospital.data
    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar("Clinic details",onBack=onBack)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Theme.Gutter),
            verticalArrangement=Arrangement.spacedBy(20.dp)) {
            QueryState(pending=hospital.isPending,error=hospital.error,onRetry=hospital.refetch)
            if(data!=null) {
                Photo(data.photoUrl,data.name,Modifier.fillMaxWidth().height(140.dp),radius=Theme.Radius.Card,initialsSize=38.dp)
                Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    SectionLabel("${data.area ?: data.city} · ${data.city}")
                    BasicText(data.name,style=Theme.Font.H1.copy(color=Theme.Colors.Ink))
                    BasicText(when {
                        data.openSessionCount>0 -> "${data.openSessionCount} sessions open for booking"
                        data.todaySessionCount>0 -> "Booking closed for today"
                        else -> "No sessions today"
                    },style=Theme.Font.Caption.copy(color=if(data.openSessionCount>0) Theme.Colors.Primary else Theme.Colors.InkTertiary))
                }
                data.address?.takeIf { it.isNotBlank() }?.let {
                    Card { BasicText(it,style=Theme.Font.Body.copy(color=Theme.Colors.InkSecondary)) }
                }
            }
            BasicText("Choose a department",style=Theme.Font.H2.copy(color=Theme.Colors.Ink))
            val page=departments.data
            if(page!=null&&page.items.isNotEmpty()) {
                ListGroup {
                    page.items.forEach { d -> row {
                        Row(title=d.name,subtitle=if(d.todaySessionCount==0) "No sessions today" else "${d.todaySessionCount} sessions today",
                            padH=16.dp,onClick={onOpenDepartment(d.id)})
                    } }
                }
                MoreNote(page.items.size,page.total)
            } else QueryState(pending=departments.isPending,error=departments.error,isEmpty=departments.isSuccess,
                emptyText="No departments are listed for this clinic yet.",onRetry=departments.refetch)
        }
    }
}
