# Handoff: OPD Queue — hospital discovery & live queue (iOS)

## Overview
A mobile app that lets a patient find a nearby hospital, browse its OPD departments, see the
live queue for a doctor, and join that queue from the phone instead of waiting in a room.
Three screens are designed: **Discover**, **Hospital**, **Department queue** (+ a
confirmation sheet).

## About the design files
The files in this bundle are **design references written in HTML** — prototypes that show the
intended look, hierarchy and behaviour. They are **not production code to copy**.
The task is to **recreate these screens in the target codebase's own environment** (SwiftUI,
React Native, Flutter, React web…) using its established components, navigation and styling
patterns. If no app codebase exists yet, pick the most appropriate framework for the product
(these designs assume iOS-native conventions) and build the screens there.

The HTML uses a small in-house component runtime (`.dc.html`, `x-import`, `sc-for`, `sc-if`).
Ignore that runtime — read the markup for layout, values and copy only.

## Fidelity
**High fidelity.** Colors, type sizes, weights, letter-spacing, radii, and spacing are final
and should be matched. Layout follows Apple HIG conventions (44/49pt bars, hairline
separators, blurred bar materials, grouped white cards on a light system background).

---

## Design tokens

### Color
| Token | Value | Use |
|---|---|---|
| ink | `#0B0B0C` | primary text, primary buttons, active tab |
| ink-secondary | `#48484A` | secondary body text |
| ink-tertiary | `#8A8A8E` | labels, captions, inactive tab items |
| ink-quaternary | `#C6C6CA` | chevrons, dividing dots |
| surface | `#FFFFFF` | cards, sheets, list groups |
| background | `#F7F7F8` | screen background |
| fill-subtle | `rgba(10,10,12,0.045)` | search field |
| fill-secondary | `rgba(10,10,12,0.06)` | secondary buttons |
| separator | `rgba(10,10,12,0.07–0.09)` | hairlines (0.5px) |
| bar-material | `rgba(247,247,248,0.86)` + `blur(24px)` | tab bar / nav bar |
| success | `#1F9D62` (dot), `#1F7A4D` (text), `#5DD39E` (on photo) | open / live status |
| scrim | `linear-gradient(to top, rgba(8,10,12,.74), rgba(8,10,12,.30) 42%, rgba(8,10,12,.02) 74%)` | text over imagery |
| showcase-bg | `#0B0C0D` | the dark page the three phones sit on (presentation only) |

### Typography
Family: `-apple-system, "SF Pro Text", "SF Pro Display", Geist, "Helvetica Neue", sans-serif`
(real SF Pro on Apple platforms; **Geist** is the web fallback).

| Role | Size / weight / tracking |
|---|---|
| Large title | 34px / 600 / -1.2px, line-height 39px |
| Card title (hospital name, screen 2) | 28px / 600 / -0.9px, lh 33px |
| Hero title on photo | 25px / 600 / -0.7px, lh 30px |
| Token numerals (your token) | 46px / 600 / -2.2px |
| Token numerals (now serving) | 32px / 600 / -1.3px, tertiary color |
| Sheet token | 64px / 600 / -3px |
| Stat figure | 20–21px / 600 / -0.5px |
| Row title | 16–17px / 550 / -0.4px |
| Body | 15px / 400 / -0.3px |
| Row subtitle / caption | 13px / 400 / -0.1px |
| Eyebrow (all-caps label) | 11px / 600 / +1.4px letter-spacing, tertiary |
| Micro label (inside strip / stats) | 10–11px / 600 / +0.6–1.2px |
| Tab label | 10px / 600 (active) or 400 |

### Spacing / geometry
Screen gutter **24px**. Section gap 24–32px. Card padding 20–26px.
Radii: hero card **26**, place card top corners **30**, primary card **28**, list group **22**,
sheet **30 top**, thumbnail **15**, search field **15**, buttons **14** (rect) / pill (height/2),
avatar circle.
Shadows: card `0 1px 2px rgba(11,12,13,.05), 0 14px 36px rgba(11,12,13,.05)`;
hero `0 12px 30px rgba(11,12,13,.12)`.
Hairlines are 0.5px. Tab bar 82px tall (49pt bar + home-indicator inset), content padded above it.

---

## Screens

### 1 · Discover
**Purpose:** pick a hospital.

Layout, top → bottom (all inside a scroll view, 24px gutters):
1. **Header row** — left: `MUMBAI` eyebrow + 8×5 chevron (location picker). Right: 30px circular
   avatar, `#E6E6E8` fill, initials `PS` 12px/600, `#48484A`.
2. **Large title** `Hospitals` (34/600/-1.2). Subtitle `15 open near you right now`
   (15px, tertiary), 6px below.
3. **Search field** — 46px tall, radius 15, fill `rgba(10,10,12,.045)`, 15px magnifier glyph
   (tertiary stroke), placeholder `Hospitals, doctors, specialities` 15px. Typing filters the
   nearby list by hospital name or area; empty result shows `Nothing matches "<query>"`
   centered, 14px tertiary, 44px vertical padding.
4. **Featured hospital card** — 236px tall, radius 26, full-bleed photo of the *selected*
   hospital, bottom scrim, `box-shadow` hero. Overlaid bottom-left (20px inset, 18px from
   bottom):
   - glass pill: `rgba(255,255,255,.20)` + blur(8), radius 9, padding 5/10, 6px `#5DD39E` dot,
     text `4 OPD OPEN NOW` 11px/600/+0.6px white.
   - hospital name 25px/600/-0.7 white, 10px below.
   - `Andheri West · 18m average wait` 13px `rgba(255,255,255,.82)`.
5. **`NEARBY` eyebrow**, then 4 **hospital rows** (no card, hairline between rows, 14px vertical
   padding): 52×52 photo thumb radius 15 · name 16/550 · `Andheri West · 1.2 km` 13px tertiary ·
   right side either `VIEWING` (11px/600/+0.8px, ink — the currently selected one) or the average
   wait (`18m`, 13px tertiary). Tapping a row selects that hospital (updates the featured card
   and screen 2/3).
6. **Tab bar** — Discover (active, ink) / Visits / Profile, 22px line glyphs, 10px labels,
   inactive `#8A8A8E`, blurred material with a 0.5px top hairline.

### 2 · Hospital
**Purpose:** understand the hospital, then pick a department.

1. **Photo header** 300px, full-bleed hospital image, light top-and-bottom scrim.
   Floating 36px circular glass buttons (`rgba(255,255,255,.22)` + blur 12): back chevron
   top-left (18px inset, 58px from top), save/pin top-right.
2. **Place card** — white, radius 30 on top corners, pulled up **-34px** over the photo,
   padding 26/24:
   - eyebrow `MULTISPECIALITY · ANDHERI WEST`
   - name 28/600/-0.9
   - status line: 6px `#1F9D62` dot + `Open until 8 PM` + `·` + `1.2 km away` (14px, `#48484A`)
   - **actions row** (gap 10, both 46px tall, radius 14): primary `Call` (ink fill, white label,
     14px phone glyph) and secondary `Directions` (`rgba(10,10,12,.05)` fill, ink label, arrow glyph)
   - hairline, then **stats trio** (equal thirds, left-aligned): `4.6 / RATING`,
     `4 / OPD TODAY`, `18m / AVG WAIT` — figure 20/600/-0.5, label 11px/+0.6px tertiary.
3. **`DEPARTMENTS`** eyebrow, then 6 rows on white, 66px min-height, hairline inset 24px left:
   title 17px ink + subtitle `Next token 11:20 AM · 2 doctors` 13px tertiary; right side a
   7px ink dot when that department is selected, otherwise a 7px chevron `#C6C6CA`.
   Departments: Cardiology (11:20 AM, 2), Orthopaedics (10:40 AM, 1), General Medicine
   (11:55 AM, 3), Paediatrics (12:30 PM, 1), Dermatology (12:45 PM, 2), ENT (11:35 AM, 1).
   Tapping a row selects it and drives screen 3.
4. Same tab bar.

### 3 · Department queue
**Purpose:** see the live queue and join it.

1. **Nav bar** — 44pt over a 56px status inset, blurred material, 0.5px bottom hairline.
   Left: back chevron + hospital short name (`Sunrise`, 15px ink). Center: department name
   16px/600/-0.4.
2. **Lead doctor card** — white, radius 28, padding 24/22/22, card shadow:
   - **doctor row**: 42px circular initials avatar (`#F0F0F2` fill, 14px/600 `#48484A`) ·
     name 17/550 · hours `10 AM – 1 PM` 13px tertiary · right: 6px `#1F9D62` dot + `Live`
     12px/600 `#1F7A4D`.
   - **token pair** (26px below, space-between): left `NOW SERVING` eyebrow + token
     32px/600/-1.3 in tertiary; right, right-aligned, `YOUR TOKEN` eyebrow + token
     46px/600/-2.2 in ink. (Deliberate hierarchy: the user's own token is the loudest number.)
   - **queue strip** (24px below): a left-aligned row of 6px-wide bars, gap 5, aligned to a
     30px baseline — 4 bars of `rgba(10,10,12,.78)` 15px tall for recently seen, then **one
     11px bar of `rgba(10,10,12,.14)` per person ahead** (cap 14), then a final 30px ink bar =
     the user. The light-bar count must always equal the stated ahead count.
   - **strip legend** (12px below, space-between): `<n> ahead of you` and
     `Seen 11:20 – 11:50 AM` — 13px tertiary with the number/time in ink 550.
   - **primary button**: full width, 52px, pill, ink fill, `Join queue · ₹500`
     (16px/550; the fee segment is hidden when fees are off). Hover `#26262A`.
   - caption `Free to cancel until your token is called`, 12px tertiary, centered.
3. **`ALSO IN CARDIOLOGY`** eyebrow + a white group (radius 22) of the remaining doctors:
   36px initials avatar · name 15/550 · `2 – 5 PM · 8 waiting` 12.5px tertiary · trailing
   `Join` ghost pill (32px, radius 16, `rgba(10,10,12,.06)`, ink 14/550; hover `.11`).
   Hidden when the department has only one doctor.
4. Same tab bar.

### Confirmation sheet (over screen 3)
Triggered by any Join. Scrim `rgba(8,10,12,.36)` (fade-in 220ms). Sheet: white, radius 30 top,
padding 12/24/46, slides up `translateY(101%) → 0` over **360ms `cubic-bezier(.32,.72,0,1)`**.
Content: 36×5 grabber · `YOU'RE IN THE QUEUE` eyebrow · token **64px/600/-3px** ·
`Dr Anjali Rao · Cardiology` 16px `#48484A` · two hairline rows (`Expected` → `11:20 – 11:50 AM`,
`Reach hospital by` → `11:10 AM`, 15px) · ink `Done` button 52px pill ·
`We'll notify you when two tokens remain` 12px tertiary centered. Tapping the scrim or Done closes.

---

## Interactions & behaviour
- **Hospital select** (screen 1 row tap) → sets `hospital`; updates featured card, screen 2
  photo/name/stats, screen 3 back label. Clears any join state.
- **Department select** (screen 2 row tap) → sets `dept`; replaces screen 3's doctor list.
  Clears join state.
- **Search** → live substring filter on hospital name + area (case-insensitive).
- **Join** (primary or ghost) → opens the confirmation sheet for that doctor.
- **Live queue tick** → every **4500ms** the now-serving token advances and the ahead count
  decreases (cycles over 5 steps in the prototype; in production drive this from the server /
  websocket). The queue strip re-renders from the same numbers.
- **Hover** states only apply on web; on device use standard press opacity/scale.
- Inactive tab items are not wired in the prototype.

## State
```
hospital: number        // index into hospitals
dept: number            // index into departments
query: string           // search text
joined: number | null   // index of the doctor whose sheet is open
tick: number            // live-queue heartbeat (replace with real data)
```
Derived: selected hospital object, department name, doctor list for that department,
`lead` (first doctor) + `others`, per-doctor `token`, `yours`, `ahead`, `bars`.

Data the real app needs per doctor: name, hours, live/open flag, token prefix, currently served
number, checked-in count, booked count, expected window, "reach by" time, consultation fee.

## Assets
- `img/sunrise.png`, `img/lotus.png`, `img/greenvalley.png`, `img/nirmal.png` — **placeholder
  hospital images**, generated for this mock (1600×1000). Replace with real photography of each
  hospital; the layouts assume a landscape crop with sky in the upper third so the scrimmed text
  stays legible.
- All icons are simple inline SVG stand-ins (search, chevrons, phone, arrow, compass, clipboard,
  person). In the app use **SF Symbols** (`magnifyingglass`, `chevron.left`, `chevron.right`,
  `phone.fill`, `location.fill` / `paperplane.fill`, `safari`, `list.clipboard`, `person.crop.circle`)
  or the codebase's icon set.
- Fonts: SF Pro (system) with Geist as the web fallback (Google Fonts).

## Files
- `Hospital Queue v2.dc.html` — the three screens + sheet (this is the design of record).
- `ios-frame.jsx` — device bezel/status bar used for presentation only; **not** part of the app.
- `image-slot.js` — drag-and-drop image placeholder used by the mock; **not** part of the app.
- `img/*.png` — placeholder hospital imagery.
