package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.LocalCity
import app.kramya.core.*
import app.kramya.net.*
import app.kramya.ui.*
import app.kramya.ui.Row

/** Direct, search-first discovery. Every clinic/provider and count comes from the API. */
@Composable
fun DiscoverScreen(
    onOpenHospital: (String)->Unit,
    onOpenDoctor: (String)->Unit,
    onOpenAllDoctors: (String)->Unit,
    onChangeCity: ()->Unit,
    onOpenProfile: ()->Unit,
    onOpenVisit: (String)->Unit,
) {
    val store=LocalCity.current
    val city by store.city.collectAsStateWithLifecycle()
    var q by remember { mutableStateOf("") }
    val query=q.trim()
    val scope=city?.let { "city=${encodeQuery(it)}&" }.orEmpty()
    val term=if(query.isEmpty()) "" else "&q=${encodeQuery(query)}"
    val hospitals=useApi<Paginated<HospitalCard>>("/hospitals?${scope}limit=$PAGE$term",enabled=store.ready&&city!=null)
    val doctors=useApi<Paginated<PublicDoctor>>("/doctors?${scope}limit=${if(query.isEmpty()) 4 else 10}$term",enabled=store.ready&&city!=null)
    val patients=useApi<List<Patient>>("/patients")
    val self=patients.data?.firstOrNull { it.relation==PatientRelation.SELF }
    val visits=useApi<Paginated<MyQueueEntry>>(MY_ACTIVE_ENTRIES)
    val next=visits.data?.items?.firstOrNull()
    val clinics=hospitals.data?.items.orEmpty()
    val providers=doctors.data?.items.orEmpty()
    Screen {
        LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(start=Theme.Gutter,end=Theme.Gutter,bottom=32.dp)) {
            item("brand") {
                Row(Modifier.fillMaxWidth().padding(top=12.dp),verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.SpaceBetween) {
                    BrandLockup()
                    Box(Modifier.minTouchTarget().pressable(label="Your account",onClick=onOpenProfile),contentAlignment=Alignment.Center) {
                        Avatar(self?.name ?: "You",32.dp)
                    }
                }
                Row(Modifier.fillMaxWidth().heightIn(min=48.dp).pressable(label="Choose city",onClick=onChangeCity),
                    verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.MAP_PIN,size=18.dp,tint=Theme.Colors.Primary)
                    BasicText(city ?: "Choose your city",Modifier.weight(1f),style=Theme.Font.Label.copy(color=Theme.Colors.Ink))
                    BasicText("Change",style=Theme.Font.Caption.copy(color=Theme.Colors.InkTertiary))
                    Icon(Icons.CHEVRON_DOWN,size=14.dp,tint=Theme.Colors.InkTertiary)
                }
                Hairline()
                BasicText(self?.name?.substringBefore(' ')?.let { "Hello, $it" } ?: "Welcome to Kramya",
                    Modifier.padding(top=20.dp),style=Theme.Font.Caption.copy(color=Theme.Colors.InkSecondary))
                BasicText("Find your doctor",Modifier.padding(top=8.dp),style=Theme.Font.Display.copy(color=Theme.Colors.Ink))
                SearchWell(q,{q=it},"Doctor, clinic or specialty","Search care",Modifier.padding(top=20.dp))
                BasicText("Queue estimates from your clinic. Times can change.",Modifier.padding(top=12.dp),style=Theme.Font.Caption.copy(color=Theme.Colors.InkTertiary))
                if(store.ready&&city==null) {
                    Box(Modifier.padding(top=20.dp)) { Button("Choose a city",onChangeCity) }
                }
            }
            if(next!=null&&query.isEmpty()) item("visit") {
                val reserved=next.status==QueueEntryStatus.RESERVED
                Column(Modifier.fillMaxWidth().padding(top=20.dp).clip(RoundedCornerShape(14.dp))
                    .background(Theme.Colors.PrimarySoft).pressable(onClick={onOpenVisit(next.id)}).padding(16.dp),
                    verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    SectionLabel(if(reserved) "Your booking" else "Your upcoming visit")
                    BasicText(next.doctorName,style=Theme.Font.H3.copy(color=Theme.Colors.Ink))
                    BasicText(next.patientName+" · "+next.hospitalName,style=Theme.Font.Caption.copy(color=Theme.Colors.InkSecondary))
                    EntryStatusPill(next.status)
                    BasicText(if(reserved) "Check payment status →" else "Open token ${next.tokenLabel} →",
                        style=Theme.Font.Label.copy(color=Theme.Colors.Primary))
                }
            }
            if(providers.isNotEmpty()&&query.isEmpty()) item("specialties") {
                BasicText("Browse by specialty",Modifier.padding(top=24.dp,bottom=12.dp),style=Theme.Font.H2.copy(color=Theme.Colors.Ink))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    providers.map { it.departmentName }.distinct().forEach { name ->
                        Box(Modifier.heightIn(min=48.dp).clip(RoundedCornerShape(10.dp)).background(Theme.Colors.PrimarySoft)
                            .pressable(onClick={onOpenAllDoctors(name)}).padding(12.dp),contentAlignment=Alignment.Center) {
                            BasicText(name,style=Theme.Font.Caption.copy(color=Theme.Colors.Primary))
                        }
                    }
                }
            }
            item("clinics-heading") {
                BasicText(if(query.isEmpty()) "Clinics in ${city ?: "your city"}" else "Matching clinics",
                    Modifier.padding(top=24.dp,bottom=12.dp),style=Theme.Font.H2.copy(color=Theme.Colors.Ink))
                QueryState(pending=hospitals.isPending,error=hospitals.error,isEmpty=hospitals.isSuccess&&clinics.isEmpty(),
                    emptyText=if(query.isEmpty()) "No clinics are listed here yet." else "No clinics match “$query”. Try another name or clear your search.",
                    onRetry=hospitals.refetch)
            }
            itemsIndexed(clinics,key={_,c->c.id}) { index,c ->
                if(index>0) Hairline()
                Row(title=c.name,avatar=c.name,hasPhoto=true,photoUrl=c.photoUrl,
                    subtitle="${c.area ?: c.city} · "+when {
                        c.openSessionCount>0 -> "${c.openSessionCount} sessions open"
                        c.todaySessionCount>0 -> "Booking closed today"
                        else -> "No sessions today"
                    },onClick={onOpenHospital(c.id)})
            }
            item("providers-heading") {
                Row(Modifier.fillMaxWidth().padding(top=24.dp),horizontalArrangement=Arrangement.SpaceBetween,
                    verticalAlignment=Alignment.CenterVertically) {
                    BasicText("Find a doctor",Modifier.weight(1f),style=Theme.Font.H2.copy(color=Theme.Colors.Ink))
                    Box(Modifier.minTouchTarget().pressable(onClick={onOpenAllDoctors(query)}),contentAlignment=Alignment.Center) {
                        BasicText("See all",style=Theme.Font.Caption.copy(color=Theme.Colors.Primary))
                    }
                }
                QueryState(pending=doctors.isPending,error=doctors.error,isEmpty=doctors.isSuccess&&providers.isEmpty(),
                    emptyText=if(query.isEmpty()) "No doctors are listed here yet." else "No doctors match “$query”.",
                    onRetry=doctors.refetch)
            }
            itemsIndexed(providers,key={_,d->d.id}) { index,d ->
                if(index>0) Hairline()
                Row(title=d.name,avatar=d.name,subtitle="${d.specialization ?: d.departmentName} · ${d.hospitalName}",
                    onClick={onOpenDoctor(d.id)})
            }
            item("more") {
                hospitals.data?.let { MoreNote(it.items.size,it.total) }
                BasicText("For urgent care, contact a clinic or local emergency services directly.",Modifier.padding(top=20.dp),
                    style=Theme.Font.Caption.copy(color=Theme.Colors.InkTertiary))
            }
        }
    }
}

@Composable
fun SearchWell(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    label: String,
    modifier: Modifier = Modifier,
    capitalize: Boolean = false,
) {
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min=56.dp)
            .clip(RoundedCornerShape(Theme.Radius.Lg))
            .border(1.dp,Theme.Colors.Border,RoundedCornerShape(Theme.Radius.Lg))
            .background(Theme.Colors.Surface)
            .padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.SEARCH, size = 15.dp, tint = Theme.Colors.InkTertiary)
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                BasicText(
                    placeholder,
                    style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = label },
                singleLine = true,
                textStyle = Theme.Font.Body.copy(color = Theme.Colors.Ink),
                cursorBrush = SolidColor(Theme.Colors.Ink),
                keyboardOptions = KeyboardOptions(
                    capitalization = if (capitalize) {
                        androidx.compose.ui.text.input.KeyboardCapitalization.Words
                    } else {
                        androidx.compose.ui.text.input.KeyboardCapitalization.None
                    },
                    autoCorrectEnabled = false,
                ),
            )
        }
        if (value.isNotEmpty()) {
            Box(
                Modifier
                    .minTouchTarget()
                    .pressable(
                        radius = Theme.Radius.Full,
                        label = "Clear search",
                        onClick = { onValueChange("") },
                    ),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.X, size = 16.dp, tint = Theme.Colors.InkTertiary) }
        }
    }
}

