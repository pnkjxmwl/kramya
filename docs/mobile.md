# The mobile app, explained from zero

**What this is.** A start-to-finish walkthrough of `apps/mobile` — the Expo / React
Native app patients hold in their hands. Companion to `docs/api.md`, same assumptions:
you know nothing about React, React Native, Expo Router or TanStack Query, and each is
explained as it comes up.

**It is written for someone who wants to change the UI.** Parts 3, 4 and 5 are the
design system and the component library — the files you will actually edit — and
**Part 12 is a set of recipes** for making specific changes, plus the seven traps that
have already cost this project time on a real device.

**Read `docs/api.md` first if you have not.** This app is a screen onto that server. It
decides almost nothing, and the parts where it *appears* to decide something are the
parts worth being careful about.

**Size:** 5,317 lines across 31 files. About a third the size of the API, and most of
it is layout.

---

## Table of contents

| Part | Subject |
|---|---|
| 0 | [The 5-minute map](#part-0--the-5-minute-map) |
| 1 | [React and React Native from zero](#part-1--react-and-react-native-from-zero) |
| 2 | [Expo Router: the file *is* the route](#part-2--expo-router-the-file-is-the-route) |
| 3 | [`theme.ts` — the design system](#part-3--themets--the-design-system) |
| 4 | [`lib/ui.tsx` — the component library](#part-4--libuitsx--the-component-library) |
| 5 | [`lib/discovery.tsx` — the product components](#part-5--libdiscoverytsx--the-product-components) |
| 6 | [Data: TanStack Query, `useApi`, auth](#part-6--data-tanstack-query-useapi-auth) |
| 7 | [Realtime](#part-7--realtime) |
| 8 | [Push notifications](#part-8--push-notifications) |
| 9 | [The screens, one by one](#part-9--the-screens-one-by-one) |
| 10 | [The payment screen](#part-10--the-payment-screen) |
| 11 | [Formatting: time and money](#part-11--formatting-time-and-money) |
| 12 | [**How to change the UI**](#part-12--how-to-change-the-ui) |
| 13 | [Two end-to-end traces](#part-13--two-end-to-end-traces) |
| 14 | [Running and shipping it](#part-14--running-and-shipping-it) |
| — | [Exercises](#exercises) |

---

# Part 0 — The 5-minute map

## What the app does

Sign in → pick a city → browse hospitals → pick a department → see today's session
cards → tap **Join** → choose which family member → pay → **get a token**. Then watch
the queue live and walk in when told.

The token screen is the product. Everything else exists to reach it.

## The files

```
app/                        ← every file here is a SCREEN and a URL
  _layout.tsx               the root: providers, fonts, the auth gate
  (auth)/
    login.tsx  signup.tsx
  (app)/
    _layout.tsx             the bottom tab bar
    (discover)/             TAB 1
      _layout.tsx           this tab's header styling
      index.tsx             home: city chip, search, hospitals
      location.tsx          city picker
      hospital/[id].tsx     one hospital → its departments
      department/[id].tsx   → today's session cards
      doctor/[id].tsx       one doctor → their sessions
      doctors.tsx           doctor search
      session/[id].tsx      one session in full
    (visits)/               TAB 2
      _layout.tsx
      visits.tsx            list of your bookings
      join.tsx              choose patient + pay
      visit/[id].tsx        ★ THE TOKEN SCREEN
    profile/                TAB 3
      index.tsx  patients.tsx

lib/                        ← everything that is not a screen
  ui.tsx                    Button, Card, Field, Photo, Skeleton...  (592 lines)
  discovery.tsx             Pill, Row, SessionCardView, QueryState   (611 lines)
  api.ts                    useApi / useApiPost
  auth.tsx                  tokens, sign-in, authedFetch
  realtime.tsx              the socket
  push.tsx                  notifications
  visits.tsx                "my bookings" helpers + status wording
  city.tsx                  remembered city
  format.ts                 IST clock, rupees
  icon.tsx                  the one icon import

theme.ts                    ★ EVERY COLOUR, SIZE, FONT AND SHADOW
```

**If you are here to change how things look, you will spend your time in `theme.ts`,
`lib/ui.tsx`, `lib/discovery.tsx`, and one screen file.** That is genuinely it.

## The ten ideas

1. **The server decides; this app renders.** Queue position, prices, whether Join is
   allowed — all server answers. The app never computes them.
2. **No colour, size, radius or font is written in a screen.** They all come from
   `theme.ts`.
3. **Every screen owes four states**: loading, empty, error, offline. `QueryState`
   provides all four in one place so none goes missing.
4. **Status is never colour alone** — always a label *and* an icon. For colour-blind
   users and for sunlight outside a clinic.
5. **Server state lives in TanStack Query**, never in component state.
6. **A realtime event invalidates a query. It never carries data into one.**
7. **Skeletons, not spinners.** A spinner says "something is happening somewhere"; a
   skeleton says what is arriving and holds its shape so nothing jumps.
8. **Tokens go in the OS keychain**, never plain storage.
9. **A disabled control must mean "not now", never "not built"** — and it must say
   which.
10. **Styles do not cascade.** There is no CSS. Every element gets its own style
    object, explicitly.

---

# Part 1 — React and React Native from zero

Skip if you write React daily. Otherwise this part is the whole foundation.

## 1.1 The three layers

- **React** — the idea: describe what the screen should look like for the current
  data, and let the library work out what to change.
- **React Native** — React that draws *real native views* instead of HTML. A `<View>`
  becomes an Android `ViewGroup` / iOS `UIView`. There is no browser and no DOM.
- **Expo** — the toolkit around React Native: the build service, the dev client, and
  the libraries (`expo-secure-store`, `expo-notifications`, `expo-router`).

**There is no HTML and no CSS.** This is the single biggest adjustment. `<div>` is
`<View>`, text must be inside `<Text>`, and styles are JavaScript objects.

## 1.2 A component

```tsx
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = initialsOf(name);

  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}
```

A component is **a function that returns markup**. It takes one argument — an object
of "props" — and here it is destructured inline into `name` and `size`, with `size`
defaulting to 40. Used as:

```tsx
<Avatar name="Dr Sharma" size={64} />
```

Capital letter = your component. Lowercase = not a thing in React Native (there are no
built-in lowercase elements).

That is the entire model. `Button`, `Card`, `Row`, and every screen are functions like
this one.

## 1.3 JSX

The HTML-looking syntax is **JSX**, and it compiles to function calls.

```tsx
<Text style={styles.title}>Hello</Text>
```

Curly braces mean "JavaScript goes here":

```tsx
<Text>{entry.tokenLabel}</Text>                        {/* a value */}
<Text style={styles.token}>Token {entry.tokenLabel}</Text>
<View style={[styles.row, isOn && styles.rowOn]} />    {/* an array of styles */}
```

### Conditional rendering — three patterns, all used in this codebase

```tsx
{error && <ErrorNote message={error} />}
```
"If `error` is truthy, render this." Careful: `{count && <X/>}` with `count === 0`
renders the number 0. The codebase uses explicit comparisons where that matters.

```tsx
{helper ? <Text style={styles.helper}>{helper}</Text> : null}
```
The safe form, and the one used most often here.

```tsx
{pending ? <ActivityIndicator /> : <Text>{title}</Text>}
```
Either/or.

### Lists

```tsx
{items.map((entry) => (
  <Link key={entry.id} href={`/visit/${entry.id}`} asChild>
    ...
  </Link>
))}
```

`.map()` turns an array of data into an array of elements. **`key` is required** and
must be stable and unique — React uses it to tell rows apart when the list changes.
Using an array index as a key causes real bugs on reordering lists.

### Fragments

```tsx
<>
  <Card>...</Card>
  <Card>...</Card>
</>
```

`<>...</>` groups elements without adding a wrapper view. Used all over the token
screen.

## 1.4 State and hooks

A component redraws when its **state** changes.

```tsx
const [q, setQ] = useState('');
```

`useState` returns the current value and a function to change it. Calling `setQ('abc')`
re-runs the component function and redraws.

Anything starting with `use` is a **hook**. Two rules, both enforced by the linter:

- Only call hooks at the top level of a component — never inside `if`, a loop, or a
  nested function.
- Only call them from components or other hooks.

### The hooks in this app

| Hook | Does |
|---|---|
| `useState` | a value that changes and redraws |
| `useEffect` | run something *after* rendering — timers, subscriptions |
| `useRef` | a value that survives redraws but does **not** cause one |
| `useMemo` | cache an expensive calculation |
| `useCallback` | cache a function so it is not rebuilt every render |
| `useContext` | read a value shared by the whole app |

**`useEffect`** is the one to understand:

```tsx
useEffect(() => {
  if (entry?.reservationExpiresAt == null) return;
  const timer = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(timer);              // ← cleanup
}, [entry?.reservationExpiresAt]);
```

Three parts: what to run, an optional **cleanup** function it returns, and the
**dependency array** at the end. The effect re-runs whenever anything in that array
changes; the cleanup runs first. The array `[]` means "once, on mount."

Getting the dependency array wrong is the most common React bug. This codebase has a
good example of the *subtle* version, in `lib/realtime.tsx`:

```tsx
const key = sessionIds.join(',');

useEffect(() => {
  if (key === '') return;
  const leave = key.split(',').map((sessionId) => watch(sessionId));
  return () => { for (const stop of leave) stop(); };
}, [key, watch]);
```

> The ids are joined into a string for the dependency. The array is rebuilt on every
> render by `.map()`, so depending on it directly would unsubscribe and resubscribe the
> whole list each time — which is both a wasted round trip and a window where an event
> is missed.

**`useRef`** holds a value without redrawing. In `lib/auth.tsx` that distinction is
load-bearing:

```tsx
const tokensRef = useRef<AuthTokens | null>(null);
```

> `authedFetch` is captured by every screen's queries, and a request that has been in
> flight for a second must not decide what to do about a 401 using the tokens that were
> current when its closure was built. **State is for rendering; this is what the network
> path reads.**

## 1.5 Styling — this is not CSS

```tsx
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space[4],
    gap: theme.space[3],
  },
});
```

Property names are camelCase (`backgroundColor`, not `background-color`). Numbers are
**density-independent pixels**, not `px` strings.

Four things that will catch you:

**1. Styles do not cascade.** Setting a colour on a `<View>` does nothing to the
`<Text>` inside it. Every `<Text>` needs its own colour. There is no inheritance, no
selectors, no `!important`, no stylesheet order.

**2. Combine with an array.** Later entries win:

```tsx
<View style={[styles.button, { backgroundColor: inert ? theme.color.border : fill }]} />
<Text style={[styles.kvValue, emphasis && styles.kvValueStrong]} />
```

A `false` in that array is skipped, which is why `emphasis && style` works.

**3. Everything is flexbox, and the default direction is `column`.** On the web the
default is `row`; here a `<View>` stacks its children vertically unless you say
otherwise.

```tsx
{ flexDirection: 'row', alignItems: 'center', gap: 12 }
```

- `flexDirection` — `'column'` (default) or `'row'`
- `justifyContent` — spacing along that direction
- `alignItems` — alignment across it
- `flex: 1` — "take all the remaining space"
- `gap` — space between children (much cleaner than margins, used throughout here)

**4. Only `<Text>` renders text.** A bare string inside a `<View>` crashes.

## 1.6 The core elements

| Element | Is |
|---|---|
| `View` | a box |
| `Text` | the only thing that displays text |
| `Pressable` | anything tappable |
| `ScrollView` | scrolls; renders **all** children immediately |
| `FlatList` | scrolls; renders only what is visible — for long lists |
| `TextInput` | a text field |
| `Modal` | a full-screen overlay |
| `ActivityIndicator` | a spinner |
| `Image` / `Animated.Image` | a picture |

**`ScrollView` versus `FlatList`** is a real decision. `ScrollView` builds every child
up front; with 500 rows the screen janks. `FlatList` recycles views as you scroll. This
app uses `FlatList` for hospitals, cities and doctors, and `ScrollView` for detail
screens with a known, small number of children.

FlatList recycling has a consequence, and `Photo` in `lib/ui.tsx` handles it:

```tsx
useEffect(() => {
  setFailed(false);
  fade.setValue(0);
}, [uri, fade]);
```

> A FlatList reuses row views, so without this a recycled row keeps the previous
> photo's faded-in opacity — and a stale `failed` would hide a perfectly good image for
> the next hospital that happens to land in that slot.

## 1.7 Context — app-wide values

Passing a value down through six layers of components is miserable. Context skips the
chain.

```tsx
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ...builds `value`
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

Any component under the provider calls `useAuth()` and gets the value. `children` is
the special prop holding whatever was nested inside the component.

This app has five providers, nested in `app/_layout.tsx` in an order that matters
(Part 2.5): `SafeAreaProvider` → `QueryClientProvider` → `AuthProvider` →
`RealtimeProvider` → `CityProvider`.
---

# Part 2 — Expo Router: the file *is* the route

## 2.1 The rule

Every file under `app/` is a screen, and its **path on disk is its URL**.

```
app/(app)/(discover)/location.tsx        →  /location
app/(app)/(discover)/hospital/[id].tsx   →  /hospital/abc-123
app/(app)/(visits)/visit/[id].tsx        →  /visit/xyz-789
```

The default export of the file is the screen. There is no route table to maintain.

## 2.2 Three kinds of name

**`(parentheses)` — a group.** Organises files and lets a folder have its own layout,
but **contributes nothing to the URL**. `(app)/(discover)/location.tsx` is `/location`,
not `/app/discover/location`.

Groups are what create the tabs here: `(discover)`, `(visits)` and `profile` are three
tabs, and nothing in the URL mentions them.

**`[brackets]` — a parameter.** `[id].tsx` matches any single segment, read inside the
screen with:

```tsx
const { id } = useLocalSearchParams<{ id: string }>();
```

**`_layout.tsx` — a layout, not a screen.** It wraps every route in its folder. This is
where navigators (tabs, stacks) and providers live.

## 2.3 Two naming traps this project hit

Both are recorded in the code, and both produce confusing symptoms.

**`visit/[id].tsx`, not `[id].tsx`:**

> A bare `[id]` in a route GROUP sits at the root of the URL space and becomes a
> catch-all that shadows every other top-level path — `/location` and `/doctors` among
> them. The extra segment keeps it addressable and harmless.

**`visits.tsx`, not `index.tsx`:**

> Every segment above this is a route GROUP, so an `index` here resolves to `/` — which
> `(discover)/index.tsx` already owns. Two screens claiming one path is the same class
> of mistake as the bare `[id]`; the generated route table is where it shows up, because
> only ONE `/` ever appears in it.

## 2.4 Navigating

```tsx
const router = useRouter();

router.push('/location');                                        // add a screen
router.push({ pathname: '/hospital/[id]', params: { id } });      // typed form
router.push(`/join?sessionId=${id}`);                             // query string
router.replace(`/visit/${entry.id}`);                             // swap, no back
router.back();                                                    // pop
router.navigate('/visits');                                       // pop back to it if present
```

`push` versus `replace` versus `navigate` is a real UX decision here. After paying,
`join.tsx` uses **`replace`** so the back button does not return the patient to a
checkout for a booking they have already completed.

Or declaratively:

```tsx
<Link href={`/visit/${entry.id}`} asChild>
  <Pressable style={styles.card}>...</Pressable>
</Link>
```

`asChild` means "do not render your own element, make the child the link" — so the
`Pressable` keeps its own styling and press behaviour.

### Typed routes

`app.json` sets `"experiments": { "typedRoutes": true }`, so a mistyped path is a
compile error rather than a dead tap. That only works if the generated declaration
exists — and `.expo/` is gitignored, so on a fresh checkout (every CI run) it does not.
Hence `scripts/generate-router-types.cjs`:

> `Href` degrades to `string` and `router.push('/dpeartment/[id]')` typechecks
> perfectly. The mobile typecheck was silently not checking the one thing typed routes
> are for.

It runs as part of `pnpm --filter @opd/mobile typecheck`.

## 2.5 The root layout

`app/_layout.tsx` does four things.

**1. The provider stack**, and the nesting order is load-bearing:

```tsx
<SafeAreaProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RealtimeProvider>          {/* needs the token AND invalidates queries */}
        <CityProvider>
          <StatusBar style="dark" />
          <Gate />
        </CityProvider>
      </RealtimeProvider>
    </AuthProvider>
  </QueryClientProvider>
</SafeAreaProvider>
```

`RealtimeProvider` sits inside both `AuthProvider` (it needs the access token) and
`QueryClientProvider` (it invalidates queries). One socket for the whole app — a patient
flicking between a session card and their token must not reconnect on every navigation.

**2. Fonts:**

```tsx
const [fontsLoaded, fontError] = useFonts({
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
});
const fontsSettled = fontsLoaded || fontError !== null;
```

Inter is bundled rather than fetched, "so it is there on a cold start in a hospital
basement with no signal." And note `|| fontError`:

> so a font that fails to decode degrades to the system face instead of leaving the app
> on its splash forever. A missing typeface is a cosmetic problem; a patient who cannot
> reach their token is not.

**3. Query defaults:**

```tsx
const queryDefaults = { queries: { staleTime: 30_000, retry: 1 } } as const;
```

> A bare `new QueryClient()` leaves `staleTime` at 0, so every screen mount, every
> back-navigation and every return to the foreground refires the request — and on a
> phone that is not just load, it is a skeleton flashing over data the user was already
> looking at.

It explicitly does **not** make the live screens stale: anything that must keep moving
passes its own `refetchInterval`, and the socket invalidates directly. Neither path is
gated by `staleTime`.

One retry, not three, "because a patient on a hospital's wi-fi would otherwise wait
through three silent backoffs before being told anything is wrong."

**4. The auth gate:**

```tsx
useEffect(() => {
  if (!ready) return;
  const inAuthGroup = segments[0] === '(auth)';
  if (!signedIn && !inAuthGroup) router.replace('/(auth)/login');
  if (signedIn && inAuthGroup) router.replace('/');
}, [ready, signedIn, segments, router]);

if (!ready || !fontsSettled) {
  return <View style={styles.splash}><ActivityIndicator /></View>;
}
```

`!ready` is why the splash exists: reading the keychain is async, and showing the login
screen first would flash it at users who are already signed in. The font load joins the
same wait rather than adding a second one.

## 2.6 Tabs and stacks

`app/(app)/_layout.tsx` renders the bottom tab bar, and each tab owns **its own stack**:

> That is the whole point: without it, a patient five screens deep into
> city → hospital → department → session has no way back to the top but to press back
> five times.

The tab bar styling is worth reading if you plan to touch it:

```tsx
tabBarStyle: {
  backgroundColor: theme.color.surface,
  borderTopColor: theme.color.border,
  borderTopWidth: StyleSheet.hairlineWidth,
  height: Platform.OS === 'ios' ? 88 : 64,
  paddingTop: 6,
  paddingBottom: Platform.OS === 'ios' ? 28 : 8,
},
```

> The default bar sat 49pt tall with a 1px `#000`-ish divider, which is the one piece of
> chrome on every screen and the fastest way to make a considered app look like a
> default one.

`StyleSheet.hairlineWidth` is the thinnest line the device can draw — it varies by
screen density, which is why it is a constant rather than `1`.

There is also a tab listener worth knowing about:

```tsx
listeners={{ tabPress: () => router.navigate('/visits') }}
```

> Booking pushes `join` onto THIS tab's stack and then replaces it with the token, so
> after paying the tab was left parked on a single token card — tapping My Visits showed
> that one token instead of the list. A tab called "My Visits" has to show the visits.

And deliberately *not* `preventDefault`, so if the navigate ever breaks the tab still
opens rather than becoming a tab that does nothing.

## 2.7 Header styling — the inheritance trap

`app/(app)/(discover)/_layout.tsx`:

```tsx
export const stackOptions = {
  headerStyle: { backgroundColor: theme.color.surface },
  headerTintColor: theme.color.primary,
  headerTitleStyle: { ...theme.font.h3, color: theme.color.text },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.color.canvas },
} as const;
```

> These screenOptions are the ones that were missing. The root layout sets the same
> options on the ROOT stack, whose only children are the route groups — so they never
> reached a screen, and every screen in the app was rendering React Navigation's stock
> default header. **A nested navigator inherits nothing.**

The visits and profile layouts *import* this object rather than copying it, "because two
copies of the same styling drift the moment one is edited."

To change one screen's header, set it from inside the screen:

```tsx
<Stack.Screen options={{ title: entry?.tokenLabel ?? 'Your token' }} />
```

That is how the token screen puts the live token number in the title bar.

---

# Part 3 — `theme.ts` — the design system

**This is the most important file in the app for your purposes.** 168 lines, and it is
the entire visual language. Nothing else in the app may hardcode a colour, a radius, a
spacing or a font.

Its twin is `apps/web/tailwind.config.ts`. **Change both together** — the file says so
at the top.

## 3.1 Colour

```ts
color: {
  primary: '#0E7C7B',       // teal — the brand
  accent:  '#14B8A6',
  canvas:  '#F7FAFC',       // the page behind everything
  surface: '#FFFFFF',       // cards, inputs, the tab bar
  text:    '#0F172A',
  textMuted:    '#64748B',
  textDisabled: '#94A3B8',
  border:  '#E2E8F0',
  success: { fg: '#16A34A', bg: '#DCFCE7' },
  warning: { fg: '#D97706', bg: '#FEF3C7' },
  danger:  { fg: '#DC2626', bg: '#FEE2E2' },
  info:    { fg: '#2563EB', bg: '#DBEAFE' },
  teal:  { 50: '#F0FDFA', 100: '#CCFBF1', ..., 900: '#134E4A' },
  slate: { 50: '#F8FAFC',  100: '#F1F5F9',  ..., 900: '#0F172A' },
}
```

The **named roles** at the top are what screens normally reach for. The full **ramps**
exist for the handful of places the design calls out a specific step: teal-50 search
fill, teal-100 avatars, teal-800 pressed states, slate-100 neutral pill backgrounds.

Status colours come in `fg`/`bg` pairs because every status is drawn as a tinted pill
with matching text.

> **`canvas` and `surface` are the pair that makes the app read as layered.** Cards are
> white on a very slightly blue-grey page. Make them the same colour and the whole app
> flattens.

## 3.2 Spacing

```ts
space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 }
```

A 4pt scale. The keys are multiples of 4 — `space[4]` is 16, `space[8]` is 32. Screen
padding is almost always `space[4]`; gaps inside a card `space[3]` or `space[2]`.

**Use the scale, not raw numbers.** A stray `padding: 15` is invisible on its own and
obvious in a stack of cards.

## 3.3 Radius

```ts
radius: { sm: 6, md: 8, control: 12, lg: 14, xl: 20, full: 9999 }
```

`full: 9999` is the pill/circle trick — a radius larger than the box gives a perfect
capsule.

Two of these have stories:

**`control: 12`** exists because it already did, implicitly:

> Every button and every input in `lib/ui.tsx` hardcoded `borderRadius: 12` — a value
> that was in no token table — while `pressable()` defaulted its ripple mask to `md`. So
> on Android the ripple was clipped to a 10px corner inside a 12px button, which is the
> kind of half-pixel wrongness nobody can name and everybody can see.

**`lg` came down from 16 to 14**:

> on a 390pt phone a 16pt corner on a full-bleed card is most of the way to a lozenge,
> and the tighter radius is what makes a stack of cards read as a list rather than as a
> pile of pills.

## 3.4 Type

```ts
font: {
  display:  { fontSize: 40, lineHeight: 48, fontFamily: 'Inter_700Bold',     fontWeight: '700', letterSpacing: -1.2 },
  h1:       { fontSize: 28, lineHeight: 36, fontFamily: 'Inter_700Bold',     fontWeight: '700', letterSpacing: -0.6 },
  h2:       { fontSize: 22, lineHeight: 30, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: -0.4 },
  h3:       { fontSize: 18, lineHeight: 26, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: -0.2 },
  bodyLg:   { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular',  fontWeight: '400' },
  body:     { fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular',  fontWeight: '400' },
  label:    { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium',   fontWeight: '500' },
  caption:  { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium',   fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: 0.44 },
}
```

Used by spreading:

```tsx
title: { ...theme.font.h3, color: theme.color.text },
```

The spread copies every property in; you then add or override what you need.

### Two font rules that will bite you

**1. `fontWeight` alone does nothing once a real family is named.**

```ts
fontFamily: { regular: 'Inter_400Regular', medium: 'Inter_500Medium',
              semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' }
```

> React Native has no `fontWeight` once a real family is named. Each weight is a
> separate loaded face, so `fontFamily: 'Inter_400Regular'` with `fontWeight: '700'`
> does not give you bold Inter — Android synthesises a smeared faux-bold and iOS ignores
> it.

**So to make something bolder, change `fontFamily`, not `fontWeight`:**

```tsx
segmentTextOn: { color: theme.color.text, fontFamily: theme.fontFamily.semibold, fontWeight: '600' },
```

**2. `fontWeight` is nevertheless set on every token — deliberately.** This is a good
piece of reasoning to read in full:

> The refresh first dropped `fontWeight` on the reasoning that a named face like
> `Inter_700Bold` already IS the bold. That reasoning is correct and the decision was
> still wrong, because it ignored what happens when the face is missing.
>
> If Inter fails to load for any reason, Android falls back to the system font. With no
> `fontWeight`, that fallback is REGULAR WEIGHT EVERYWHERE: no bold headings, no
> semibold buttons, no weight on a token number. The whole app goes flat and looks
> broken, and nothing in the code says why.
>
> The failure mode of a redundant weight is a slightly heavy glyph; the failure mode of
> a missing one is an app with no typographic hierarchy at all. **Always take the first.**

## 3.5 Shadows

```ts
elevation: {
  sm:   { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.06, shadowRadius: 2,  elevation: 1 },
  card: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },  shadowOpacity: 0.05, shadowRadius: 8,  elevation: 2 },
  md:   { ... elevation: 3 },
  lg:   { ... elevation: 8 },
}
```

> Both families are set on every level on purpose: iOS reads
> shadowColor/Offset/Opacity/Radius and ignores `elevation`; Android reads only
> `elevation` and ignores the rest. **Setting one gives a card that is raised on one
> platform and flat on the other**, which is the "looks off on Android" bug in miniature.

And the pairing rule, which every card in the app follows:

> Always paired with a 1px `border` — never the shadow alone. A shadow this soft
> vanishes against `canvas` on a cheap LCD in daylight, and a border alone reads as a
> wireframe. Together they hold an edge in both conditions, which is the entire job of a
> card on a phone used outdoors outside a clinic.

## 3.6 `as const`

The whole object ends with `as const`, which makes every value a literal type. That is
why `pressable()` has to annotate its parameter:

```ts
export const pressable = (radius: number = theme.radius.control) => ...
```

> Annotated `number`: `theme` is `as const`, so an inferred default would narrow this to
> a literal and reject every other radius in the scale.
---

# Part 4 — `lib/ui.tsx` — the component library

Twelve components plus one helper, 592 lines. These are the pieces every screen is
built from. If a screen needs something that is not here, the question to ask first is whether it should
be here instead.

## 4.1 `pressable()` — press feedback

```tsx
export const pressable = (radius: number = theme.radius.control) => ({
  android_ripple: { color: theme.color.slate[200], borderless: false, foreground: true },
  style: ({ pressed }) =>
    ({ opacity: Platform.OS === 'ios' && pressed ? 0.7 : 1, borderRadius: radius }),
});
```

> Android users expect a ripple; iOS users expect a subtle opacity fade. Using one model
> on both is a large part of why a React Native app reads as "not quite native" — so
> every pressable in this app goes through here.

Used by spreading:

```tsx
<Pressable onPress={...} accessibilityRole="button" {...pressable(theme.radius.lg)}>
```

**⚠ This is trap #1 of Part 12.** `pressable()` returns its own `style`. If you put a
`style` prop on the same element, one of them is silently discarded. There is a lint
script that fails the build on it.

## 4.2 `Screen`

```tsx
export function Screen({ children, style }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top }, style]}>{children}</View>;
}
```

Canvas background plus the safe area — the notch, the status bar, the home indicator.
Every screen that draws its own header sits inside one.

## 4.3 `Button`

Four variants (`primary`, `secondary`, `ghost`, `danger`) and — importantly — **two
different kinds of "off":**

```tsx
pending?: boolean;   // busy: spinner, blocks taps
disabled?: boolean;  // not ready: looks blocked, no spinner
```

> Distinct from `pending` because they mean different things to the person looking at it
> — "wait" versus "you still have to do something". Without this, a screen's only options
> were a button that lies about being busy or one that looks live and silently does
> nothing when tapped.

And the disabled treatment:

```tsx
{ backgroundColor: inert ? theme.color.border : fill }
```

> docs/Design.md 5.1: **disabled is a slate fill, not a faded primary.**

Height is 52, "comfortably past the 44×44 minimum."

## 4.4 `Field`

A labelled text input with an optional icon and helper text. Three details in it are
each a fixed bug.

**The focus ring is colour only:**

```tsx
inputShellFocused: { borderColor: theme.color.primary },
```

> **Colour only.** No width, no elevation, no background — nothing that changes geometry
> or makes Android rebuild the view's layer.
>
> An `elevation` made Android rebuild the shadow layer under a focused TextInput, which
> drops focus, which fires `onBlur`, which removes the elevation, which rebuilds again —
> the keyboard opened and shut and every field looked like it had a caret in it. Even the
> original `borderWidth: 1 → 2` is suspect, because these screens centre their content in
> a ScrollView: the keyboard resizes the window, the content re-centres, and a field that
> also changes height re-centres twice.

**The input style deliberately avoids the font tokens:**

```tsx
input: {
  flex: 1,
  alignSelf: 'stretch',
  fontSize: 16,
  fontFamily: theme.fontFamily.regular,
  paddingVertical: 0,
  textAlignVertical: 'center',
},
```

> Every font token carries a `lineHeight`, and `lineHeight` on an Android TextInput is
> documented as unreliable — it clips glyphs and offsets the caret from the box you can
> see.
>
> `alignSelf: 'stretch'` with `paddingVertical: 0` is the tap-target fix. In a row with
> `alignItems: 'center'` the input is only as tall as its text, so the live strip was
> about 19px inside a box that LOOKS tappable for its full height.

## 4.5 `Photo` — and why it is not `expo-image`

The initials sit *underneath* the image and the photo fades in over them:

```tsx
<View style={[styles.photo, { borderRadius: radius }, style]}>
  <Text style={[styles.photoInitials, { fontSize: initialsSize }]}>{initialsOf(name) || '?'}</Text>
  {usable ? <Animated.Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: fade }]} ... /> : null}
</View>
```

> There is never a grey box or an empty hole: the loading state, the null state and the
> error state are all the same thing, and it is a thing that looks deliberate.

And the library choice, which is a genuinely useful lesson about Expo:

> **React Native's `Image`, deliberately, not `expo-image`.** expo-image is the better
> library and it is a NATIVE module — it ships `android/` and `ios/` source. A dev client
> built before it was installed does not contain that native code, so requiring it throws
> at runtime and **the only fix is a fresh APK**. On a free tier with a build budget that
> is a real cost to pay for a fade.

Remember this before you add any dependency: **a JS-only library is a reload; a native
module is a rebuild.**

## 4.6 `Skeleton` and `RowSkeleton`

```tsx
const pulse = useRef(new Animated.Value(0.5)).current;
Animated.loop(Animated.sequence([
  Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
  Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
])).start();
```

> **This exists to kill the centred spinner**, which is the most reliable "hobby app"
> signal a screen can send. A spinner says "something is happening somewhere"; a skeleton
> says "a list of hospitals is arriving, and it will be shaped like this". It also removes
> the layout jump: the placeholder occupies the geometry the real content will.

`useNativeDriver: true` runs the animation on the UI thread, so it stays smooth even
while JavaScript is busy parsing the response.

## 4.7 `Card`, `SectionLabel`, `KeyValue`, `Segmented`, `Avatar`, `ErrorNote`

**`Card`** — the standard surface. Its comment is a good argument for extracting
components at all:

> **It existed nine times before it existed once.** The token screen, the visits list,
> the profile and the session detail each declared their own `card` style, and they had
> drifted to three different paddings and two different radii.

**`SectionLabel`** — a heading. It used to render an uppercase tracked overline:

> **Bold sentence case, not the uppercase tracked overline this used to render.**
> UPPERCASE costs legibility for the older patients this app is largely for, and tracked
> 11px grey caps read as fine print rather than as the start of something.

**`KeyValue`** — a label and value on one line, with an `emphasis` flag:

> on the token screen "Fee" and "Seen by" were the same size and weight, so the number a
> patient actually opened the app for sat in a column of things they did not.

**`Segmented`** — the Upcoming/Past switch:

> A track with a raised thumb, rather than two loose pills: the pills gave no sense of
> being two halves of one control, so it was never obvious that picking one deselected
> the other.

---

# Part 5 — `lib/discovery.tsx` — the product components

611 lines. `ui.tsx` is generic; this file knows about hospitals, sessions and queues.

## 5.1 `Pill` and the status maps

```tsx
export function Pill({ label, tone, icon }: { label: string; tone: Tone; icon: IconName }) {
```

> docs/Design.md 5.3 and 8: **status is NEVER colour alone.** Every pill carries an icon
> AND a written label, so it still reads for a colour-blind user or in bright sunlight
> outside a hospital.

Three maps across two files turn a server enum into human words. They are `Record<Enum, ...>`, so
**TypeScript forces them to be exhaustive** — add a status to the contract and the app
will not compile until you have written its wording.

```tsx
const SESSION_LABEL: Record<SessionStatus, {...}> = {
  OPEN_FOR_REGISTRATION: { label: 'Open',        tone: 'success', icon: 'check-circle' },
  ACTIVE:                { label: 'In progress', tone: 'success', icon: 'activity' },
  ENDED_EARLY:           { label: 'Ended early', tone: 'warning', icon: 'alert-triangle' },
  // ...
};
```

The patient-facing one lives in `lib/visits.tsx` and is where the app's voice is
clearest:

```tsx
SKIPPED: { label: 'Missed - see reception', tone: 'warning', icon: 'alert-triangle' },
CALLED:  { label: 'Your turn - go in',      tone: 'success', icon: 'bell' },
```

> The wording is the PATIENT's, not the system's. "SKIPPED" is a state machine value;
> "Missed — see reception" is what a person needs to be told, and it says what to do
> rather than what happened.

**This map is the first place to look if you want to reword the app.**

## 5.2 `LiveState` — the honesty component

```tsx
export function LiveState({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <Pill label="Not live - reconnecting" tone="warning" icon="wifi-off" />;
}
```

Small, and the reasoning behind it is the best argument in the file:

> **The one thing a live screen owes the person reading it.** A dropped socket does not
> blank the screen — it freezes it, and a frozen queue position is indistinguishable from
> a true one. A patient reading "3 ahead of you" while the phone has been out of signal in
> a hospital basement will sit down and wait, and miss the turn that has already passed.
> Saying so is the difference between a stale number and a lie.
>
> Renders nothing while connected: a permanent green "Live" badge trains people to stop
> seeing it, and then it cannot warn them.

## 5.3 `QueryState` — loading, error and empty in one place

```tsx
export function QueryState({ pending, error, isEmpty, emptyText, emptyIcon, onRetry, skeletonRows = 3 }) {
  if (pending) return <View style={styles.skeletons}>{Array.from({ length: skeletonRows }, (_, i) => <RowSkeleton key={i} />)}</View>;
  if (error)   return <View style={styles.state}>...<ErrorNote message={error.message} />{onRetry ? <Button title="Try again" .../> : null}</View>;
  if (isEmpty) return <View style={styles.state}>...<Text style={styles.empty}>{emptyText}</Text></View>;
  return null;
}
```

> Every screen owes all three and writing them per screen is how one of them goes missing.

It returns `null` once there is data, so a screen renders it unconditionally above its
list and lets it decide.

`skeletonRows` is worth setting per screen: "Four, because Mumbai has four — the
placeholder should be the shape of the answer, not an arbitrary count that makes the
page resize."

## 5.4 `Row` — the list unit

One component covers hospitals, departments, doctors, cities and profile links. The
thumbnail is chosen by which prop you pass:

```tsx
photoUrl → an 88px photograph and a taller card
avatar   → initials in a teal circle
icon     → a small icon in a teal-50 circle
```

Note the check:

```tsx
const withPhoto = photoUrl !== undefined;
```

**`undefined` and `null` mean different things here.** `undefined` means "this kind of
row has no photo"; `null` means "the server had no photo for this one," and still gets
the taller layout with the initials fallback, so the list stays even.

## 5.5 `SessionCardView` — the shop window

The card is the product's most important list item. Its anatomy:

```
[avatar]  Dr Sharma                          [ Open ]
          Cardiology · 10 AM–1 PM
──────────────────────────────────────────────────────
Now serving   Checked in   Booked
   A007            3           5
🕐 Join now → seen ~11:20–11:50 AM
₹500                                        [  Join  ]
```

Two things to notice in the code.

**Live numbers use tabular figures:**

```tsx
statValue: { ...theme.font.h3, color: theme.color.text, fontVariant: ['tabular-nums'] },
```

Every digit occupies the same width, so a number changing live does not shift the
layout. Used on every live figure in the app.

**The ETA says nothing rather than guessing:**

```tsx
{snapshot.joinNowEtaFrom && snapshot.joinNowEtaTo
  ? `Join now → seen ~${istRange(snapshot.joinNowEtaFrom, snapshot.joinNowEtaTo)}`
  : 'Live wait times arrive with the queue engine.'}
```

## 5.6 `JoinButton` — a control with four states

This one small component is the best single example of the app's design philosophy.

```tsx
if (booking.kind !== 'none') {
  // "Finish payment" (warning tone) or "Booked · A007" (teal tone)
}
const live = registrationOpen && onJoin !== undefined;
// live → teal "Join";  not live → slate "Closed" + a reason underneath
```

Four states, each saying something different:

| State | Looks | Says |
|---|---|---|
| joinable | teal fill, `log-in` icon | **Join** |
| closed | slate fill, `lock` icon | **Closed** + "Registration closed" |
| held, unpaid | warning tint, `clock` | **Finish payment** |
| booked | teal-100 tint, `check-circle` | **Booked · A007** |

The reasoning, from the file:

> Before Phase 5 this card carried a Join button that was disabled ALWAYS, because
> joining did not exist. Once it did, that button stayed grey on a session the server was
> happily accepting bookings for — so the control read as broken rather than as
> unavailable. **A disabled button must mean "not now", never "not built".**

And why `booking` changes what the control *is*:

> Once the account holds a place here, offering a bare "Join" is a lie the server then
> rejects with ALREADY_IN_QUEUE — so the button becomes the way back to that token, or
> the way to finish paying for it.

Also note that `registrationOpen` is the **server's** answer, and is still only
advisory:

> the button being live does not mean the join will succeed. The last slot can go while
> this screen is open, so the join screen surfaces the server's rejection rather than
> assuming this was still true.

### The bug inside this component

```tsx
{...(live ? pressable(theme.radius.md) : {})}
```

> `pressable()` returns a `style` prop of its own. Spreading it onto a Pressable that
> ALSO has `style` means the later one wins and the earlier is silently discarded — which
> is exactly what happened here: the live button lost its height, width and fill and
> rendered as an invisible sliver, while every disabled button (spreading nothing) looked
> fine. **The button disappeared precisely when it became tappable.**

The fix, and the pattern the whole codebase now follows: **press feedback on the
`Pressable`, visual styling on a child `View`.**

---

# Part 6 — Data: TanStack Query, `useApi`, auth

## 6.1 Why not `useState` + `useEffect`

Fetching by hand means writing loading, error, caching, refetching, deduplication and
invalidation in every screen. **TanStack Query** does all of it, and `docs/Rules.md` §9
requires it: server state lives there, never in component state.

## 6.2 `useApi`

```tsx
export function useApi<T>(path: string, enabled = true, refetchMs?: number) {
  const { authedFetch } = useAuth();

  return useQuery({
    queryKey: [path],
    enabled,
    refetchInterval: refetchMs,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<T> => { ... },
  });
}
```

Used as:

```tsx
const hospitals = useApi<Paginated<HospitalCard>>(`/hospitals?city=${c}&limit=50`);

hospitals.data       // the result, or undefined
hospitals.isPending  // first load
hospitals.isFetching // any load, including a background refetch
hospitals.error      // an Error, or null
hospitals.refetch()  // ask again
```

**The path IS the cache key.** Two screens asking for the same URL share one fetch and
one cache entry. That is why `lib/visits.tsx` exports a constant:

```tsx
export const MY_ACTIVE_ENTRIES = '/me/queue-entries?scope=active&limit=50';
```

> A constant rather than a literal per screen, because the path IS the TanStack cache
> key: **a single character of drift silently becomes a second cache entry and a second
> poller for the same data.**

`enabled` defers a query until it makes sense:

```tsx
const doctors = useApi<Paginated<PublicDoctor>>(
  `/doctors?${scope}&limit=3${search}`,
  ready && city !== null && query.length > 0,   // ← only while searching
);
```

`refetchIntervalInBackground: false` is stated explicitly even though it is the default:
"a phone in someone's pocket must not poll a hospital API every few seconds for a screen
nobody is looking at."

### Errors a patient can read

```tsx
try {
  res = await authedFetch(path);
} catch {
  throw new Error('You appear to be offline. Check your connection and try again.');
}

if (!res.ok) {
  const body = await res.json().catch(() => null) as ApiError | null;
  throw withRequestId(new Error(body?.error.message ?? 'Something went wrong. Please try again.'), res, body);
}
```

`fetch()` rejects only on a transport failure, which on a phone almost always means no
signal — so "You appear to be offline" beats React Native's "Network request failed."

Everything else uses **the server's own message**, which `docs/Rules.md` §7 already
requires to be safe to show a human.

And the request id is carried onto the Error:

> The API already stamps every response with `x-request-id`; nothing on the phone was
> reading it. Without it a patient's "it said something went wrong" is unmatchable
> against the logs. Attached to the Error rather than shown in the message: a patient does
> not need a UUID, and a support conversation does.

## 6.3 `useApiPost`

```tsx
const cancel = useApiPost<{ reason?: string }, CancelEntryResponse>(`/queue-entries/${id}/cancel`);

cancel.mutate({}, { onSuccess: () => { ... } });
cancel.isPending
cancel.error
```

It attaches the server's error **code** as well as the message:

```tsx
(error as Error & { code?: string }).code = parsed?.error.code;
```

> The CODE is what a screen should branch on, never the message.

And the rule the whole file exists to enforce:

> A rejected command must be SURFACED, never swallowed — the server is the only thing
> that decides whether a join or a cancel is allowed, and a screen that silently ignores
> its answer is the failure docs/CLAUDE.md §9 names.

## 6.4 `lib/auth.tsx` — and the bug that signed patients out every 15 minutes

Tokens go in `expo-secure-store` — the iOS keychain and the Android keystore — never
plain storage.

The interesting part is refresh. Recall from `docs/api.md` that refresh tokens rotate and
the API revokes the **whole family** when one is presented twice. Correct, and it broke
this app:

> This app issues several requests at once as a matter of course — Home alone asks for
> patients, hospitals and doctors together, and the token screen polls — so when the
> access token expires they all get a 401 in the same instant. Before this ref, each one
> independently posted the SAME refresh token: the first rotated it, the rest were read as
> replay, and the family died. **The patient was thrown back to the sign-in screen while
> watching their place in a queue.**

The fix is one shared promise:

```tsx
const refreshing = useRef<Promise<AuthTokens> | null>(null);

const refreshOnce = useCallback((): Promise<AuthTokens> => {
  if (refreshing.current !== null) return refreshing.current;   // everyone waits on the same one
  const attempt = (async () => { ... })();
  refreshing.current = attempt;
  return attempt;
}, [persist, post]);
```

And `authedFetch` has a second guard for the request that was already on the wire:

```tsx
const sent = tokensRef.current?.accessToken;
const first = await call(sent);
if (first.status !== 401 || tokensRef.current === null) return first;

const current = tokensRef.current.accessToken;
if (current !== sent) return call(current);      // somebody else already rotated
```

> Somebody else already rotated while this request was on the wire, so the token it used
> is simply out of date. Retry with the current one — asking for another rotation here
> would present a refresh token that has been consumed and would be read, correctly, as
> replay.

**This is the same lesson as the API's own `SELECT ... FOR UPDATE` on the token family,
seen from the client side.** Both halves of that feature had to learn about concurrency
independently.
---

# Part 7 — Realtime

`lib/realtime.tsx`, 183 lines. One socket for the whole app, held at the root.

## 7.1 The rule

> **An event invalidates a query. It never carries state into one.**

```tsx
socket.on(REALTIME_EVENT.entryUpdated, () => {
  void queryClient.invalidateQueries({ queryKey: [MY_ACTIVE_ENTRIES] });
});
```

The event does not say *what* changed. It says "this is stale," and the query refetches
the truth over REST.

> A dropped event costs a stale second; **a dropped event in a delta-applying client
> costs correctness, silently.**

That is `docs/Rules.md` §8 — clients reconcile against a snapshot and never replay
events — applied to the steady state, so there is exactly one path by which a screen
learns anything, whether it has been open for a second or an hour.

## 7.2 Connecting

```tsx
const socket = io(API_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10_000,
});
```

The token goes in `auth`, not a query string (matching the server's expectation from
`docs/api.md` Part 10.3 — query strings end up in proxy logs).

> A phone loses signal in a lift and in a hospital basement. Reconnecting is the normal
> case here, not the exception.

## 7.3 The reconnect contract

```tsx
socket.on('connect', () => {
  setConnected(true);
  for (const sessionId of watched.current) {
    void socket.emitWithAck('subscribe', { sessionId });
  }
  void queryClient.invalidateQueries();
});
```

> Re-join every room, **then refetch everything on screen. In that order**: a change that
> happened while the socket was down would otherwise sit on the screen until the next
> navigation. This IS the reconnect contract.

## 7.4 Invalidation by prediction

```tsx
socket.on(REALTIME_EVENT.sessionUpdated, (event: SessionUpdatedEvent) => {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = String(query.queryKey[0] ?? '');
      return (
        key.startsWith(`/sessions/${event.sessionId}`) ||
        key.startsWith('/departments/') ||
        key.startsWith('/doctors/') ||
        key === MY_ACTIVE_ENTRIES
      );
    },
  });
});
```

A `predicate` matches many cache entries at once. The department and doctor lists are
included because "the card lists carry this session's live numbers too."

## 7.5 Foreground

```tsx
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void queryClient.invalidateQueries();
  });
  return () => subscription.remove();
}, [queryClient]);
```

> A phone that has been in a pocket for an hour comes back with a socket that may or may
> not still be alive, and a screen full of numbers that are certainly wrong. Refetch on
> foreground regardless — this is the one moment a patient is definitely about to read it.

## 7.6 Two hooks for screens

```tsx
const { connected } = useLiveSession(id);              // one session
const { connected } = useLiveSessions(sessionIds);     // a whole list of cards
```

The second exists because of a bug a tester found:

> A subscription is per session room, so a screen showing a dozen session cards was
> subscribed to none of them: the numbers on those cards — now serving, checked in, booked
> — sat frozen until the patient navigated away and back. The provider was already
> invalidating these queries on `session.updated`; **nothing was ever sending one, because
> nobody had joined the rooms.**

Both return `connected`, which every live screen passes to `<LiveState>`.

## 7.7 Polling is still there, as a net

Even with the socket, three screens poll:

| Constant | Value | Where |
|---|---|---|
| `FALLBACK_POLL_MS` | 90 s | session detail, token card |
| `LIVE_POLL_MS` | 15 s | the visits list |
| `CONFIRM_POLL_MS` | 2 s | while waiting for a payment webhook |

> A phone's socket dies in ways a phone does not notice — a lift, a hospital basement, an
> OS that suspended the app. Ninety seconds is invisible when the socket is healthy and is
> the difference between "briefly stale" and "silently wrong" when it is not.

---

# Part 8 — Push notifications

`lib/push.tsx`. Three jobs, and deliberately only three:

1. ask for permission, once, and take no for an answer
2. register the device's Expo token with the API
3. open the right screen when a notification is tapped

```tsx
const data = response.notification.request.content.data as { entryId?: string } | undefined;
if (typeof data?.entryId === 'string') router.push(`/visit/${data.entryId}`);
```

> **It reads nothing from the payload except where to navigate.** The push says
> "something changed, here is which booking"; the token screen then fetches the truth over
> REST like every other screen. A notification that carried status would be a third source
> of it, arriving out of order, on a device that may have been asleep for an hour.

Two subtleties worth knowing:

**Both tap paths are handled:**

```tsx
const subscription = Notifications.addNotificationResponseReceivedListener(open);
void Notifications.getLastNotificationResponseAsync().then((last) => { if (last !== null) open(last); });
```

> the app was already running, or it was cold and the tap is what started it. Missing the
> second means a patient who taps "you are being called" from a locked phone lands on the
> home screen.

**Declining is a supported outcome, not an error:**

> A patient who says no to notifications still has a live queue on screen and a working
> app. Nothing here blocks, retries or nags.

Failures are never shown to the patient — but they *are* logged, and the comment explains
the correction:

> swallowing it entirely made this undiagnosable: push silently did nothing for a whole
> testing session, and the only evidence anywhere was `no registered device` on the
> server, which names the symptom rather than the cause.

The warning it prints even tells you the likely fix, including that **Expo Go cannot
receive remote push at all** — you need a development or preview build.

---

# Part 9 — The screens, one by one

| Screen | File | Reads | Notes |
|---|---|---|---|
| Login / Signup | `(auth)/login.tsx`, `signup.tsx` | — | No navigation on success; the gate redirects |
| Home | `(discover)/index.tsx` | `/patients`, `/hospitals`, `/doctors` | City chip, greeting, search |
| City picker | `(discover)/location.tsx` | `/cities` | |
| Hospital | `(discover)/hospital/[id].tsx` | `/hospitals/:id`, `/departments?hospitalId=` | 16:9 photo header |
| Department | `(discover)/department/[id].tsx` | `/departments/:id/sessions` | Session cards; today only |
| Doctor | `(discover)/doctor/[id].tsx` | `/doctors/:id`, `/doctors/:id/sessions` | |
| Doctor search | `(discover)/doctors.tsx` | `/doctors?q=` | |
| Session | `(discover)/session/[id].tsx` | `/sessions/:id` | Live; sticky action bar |
| My Visits | `(visits)/visits.tsx` | `/me/queue-entries` | Upcoming / Past |
| Join | `(visits)/join.tsx` | several | Part 10 |
| **Token** | `(visits)/visit/[id].tsx` | `/me/queue-entries` | ★ the hero |
| Profile | `profile/index.tsx` | `/me`, `/patients` | |
| Family profiles | `profile/patients.tsx` | `/patients` | Add and remove |

## 9.1 Home

The header is built as a variable and handed to `FlatList`:

```tsx
<FlatList
  data={hospitals.data?.items ?? []}
  keyExtractor={(hospital) => hospital.id}
  ListHeaderComponent={header}
  renderItem={({ item }) => <Row ... />}
  ItemSeparatorComponent={Gap}
  ListEmptyComponent={<QueryState ... />}
  ListFooterComponent={<MoreNote ... />}
/>
```

Those four `List*` props are the FlatList idiom, and they are where the loading, empty
and truncation states live.

Two decisions to notice:

**The search box searches both doctors and hospitals** — "a box that only filtered
hospitals would return nothing for 'Sharma' and read as broken."

**The first-run city prompt is a screen, not a redirect:**

> A prompt, deliberately NOT an automatic redirect — the root layout's auth gate already
> redirects in an effect and a second one is how a navigation loop starts.

## 9.2 The token screen — the app's most considered layout

`(visits)/visit/[id].tsx`, 375 lines. Its header comment states the design in full:

> This screen answers three questions in a fixed order — *what is my token*, *when will I
> be seen*, *what do I do now* — and it used to answer them at the same weight as "Fee"
> and "Department". Seven label/value rows in a flat list, with the ETA fourth. Now:
>
> 1. the token, its status and whether the screen is still live;
> 2. the two numbers that change — the ETA window and who is being seen — as figures
>    rather than as rows;
> 3. the instruction, in a box, because it is the only sentence on the screen that tells
>    the patient to do something;
> 4. the QR, sized to be scanned across a reception desk;
> 5. everything that never changes, last.

**That ordering is the transferable lesson.** If you redesign a screen in this app, ask
what question it answers first, and put that thing first and largest.

The hero is the one filled brand surface in the app, and it is argued for:

> docs/Design.md 2.5 rules out gradients and decorative colour, and this is not that: the
> token is the single object the whole product exists to hand over, and a patient holding
> a phone up at a reception desk needs it to be the thing their eye lands on. **Colour
> here marks the object**, which is exactly the job §2.5 leaves it.

```tsx
token: {
  ...theme.font.display,
  fontSize: 52, lineHeight: 58,
  color: theme.color.teal[800],
  textAlign: 'center',
  fontVariant: ['tabular-nums'],
},
```

Note it overrides `display`'s 40pt to 52 — a deliberate, local exception on the one
element that earns it.

There is also no `GET /me/queue-entries/:id`:

> the active list is small and already carries every field this screen needs, so one
> cached request serves both screens rather than adding an endpoint for a single reader.

And the two "ahead" counts stay separate:

> docs/PRD.md is explicit that a patient is told how many are physically here AND how
> many merely booked, because **collapsing them into one number is the lie that makes an
> ETA feel arbitrary.**

## 9.3 The visits list

One detail worth copying:

```tsx
<Text style={styles.patient}>For {entry.patientName}</Text>
<Text style={styles.doctor}>{entry.doctorName}</Text>
```

> An account holds a whole family, so two bookings can share a token label, a doctor, a
> department and a date and differ only in this. Without it they are indistinguishable,
> which is exactly how a father gets taken to his daughter's appointment.
>
> "For " is not decoration: the patient and the doctor are both people's names, stacked,
> and the label is what says which is which.

## 9.4 Session detail — a deliberate leaf

> This screen is a LEAF: it links nowhere. It briefly carried a "see this doctor's other
> sessions" link back to /doctor/[id], which made session ↔ doctor the only cycle in the
> app — every round trip pushed two more screens, so a user who followed it a few times
> needed a dozen taps to get back out.
>
> Deleted rather than bounded, because the link was also redundant: a Doctor has exactly
> one departmentId, and a session's department is copied from its doctor, so that doctor's
> sessions are always a SUBSET of the department list the user came from. It offered a
> cycle and no information. **The navigation graph is now a DAG.**

Its action bar is one container for every state, after a bug where "book for someone
else" sat in a second `View` and read as two disconnected strips.

---

# Part 10 — The payment screen

`(visits)/join.tsx`, 536 lines — the hardest file in the app, and the one where the
client is most tempted to decide something it must not.

## 10.1 The rule

> **The client never creates the token, and never decides that a payment happened.**
> Only the signature-verified webhook issues a token, so this screen's job is to open
> Checkout and then keep asking the SERVER whether the token exists yet.

## 10.2 A state machine, as a type

```tsx
type Phase =
  | { name: 'choosing' }
  | { name: 'checkout'; order: JoinResponse }
  | { name: 'confirming'; entryId: string };
```

A **discriminated union**: once you check `phase.name === 'checkout'`, TypeScript knows
`phase.order` exists. This is the idiomatic way to model screen states, and it makes
impossible combinations unrepresentable — there is no way to be "confirming" without an
`entryId`.

## 10.3 Polling starts when checkout *opens*

```tsx
const watching = phase.name === 'checkout' || phase.name === 'confirming';
const active = useApi<Paginated<MyQueueEntry>>(MY_ACTIVE_ENTRIES, watching, watching ? CONFIRM_POLL_MS : undefined);

useEffect(() => {
  const entry = active.data?.items.find((e) => e.id === entryId);
  if (entry !== undefined && entry.status !== 'RESERVED') {
    router.replace(`/visit/${entry.id}`);
  }
}, [watching, entryId, active.data, router]);
```

> That is also why polling starts when checkout OPENS rather than when Checkout says
> "paid". A card payment finishes inside the page and calls `handler`; **netbanking and
> UPI-intent do not** — they navigate away to a bank, or hand off to another app, and the
> callback that would have told us goes with the page that owned it. Waiting for a message
> that never arrives is what made netbanking look like a failure when the money had
> actually moved. Asking the server works for every method, including ones Razorpay adds
> later.

`RESERVED` means the hold exists but nothing is paid for. Anything else and the server
has decided — the only opinion that counts.

## 10.4 Four payment-integration bugs, all fixed in this file

**1. `redirect: true`** — the one that made netbanking work at all:

> By default Checkout sends the patient to their bank through `window.open`. React
> Native's WebView returns NULL from that call even with `setSupportMultipleWindows={false}`
> — it navigates, but JavaScript gets null back — and Checkout reads null as "popup
> blocked" and aborts with "payment failed, please use another method". Razorpay's own API
> told us so: every netbanking and wallet attempt sat at status `created`, never reaching
> the bank, while card — the one method that completes in-page — was `captured`.

**2. `setSupportMultipleWindows={false}`** — on Android the default creates a window
that is never displayed, so the sheet just sits there.

**3. Custom schemes for UPI:**

```tsx
if (!/^https?:/i.test(request.url)) {
  void Linking.openURL(request.url).catch(() => undefined);
  leftOurPage.current = true;
  return false;
}
```

> UPI-intent hands off to GPay/PhonePe through a custom scheme. A WebView cannot load
> those; the OS can.

**4. `baseUrl`** — "Checkout refuses to run from about:blank, which is what a bare `html`
source gives it on Android."

## 10.5 Closing the sheet is not cancelling

```tsx
const leftOurPage = useRef(false);

const closeCheckout = useCallback((reason?: string) => {
  setPhase((current) => {
    if (current.name !== 'checkout') return current;
    if (leftOurPage.current) {
      return { name: 'confirming', entryId: current.order.entry.id };
    }
    if (reason !== undefined) setNotice(reason);
    return { name: 'choosing' };
  });
}, []);
```

> They reached a bank or a payment app. Do NOT call this a cancellation — ask the server,
> which is the only thing that knows.

And giving up is worded carefully:

> Giving up is not failure: if the payment succeeded the webhook will land, so the honest
> message is "still confirming", never "payment failed".

## 10.6 Making a server error unreachable

```tsx
const bookedPatientIds = useMemo(() =>
  new Set((myBookings.bySession.get(sessionId) ?? [])
    .filter((entry) => entry.status !== 'RESERVED')
    .map((entry) => entry.patientId)),
  [myBookings.bySession, sessionId]);
```

> The server allows a second patient here — its check is scoped to (session, patient) —
> but it refuses the SAME patient twice with ALREADY_IN_QUEUE. Marking them unselectable
> makes that 409 **unreachable rather than merely handled**, which is the difference
> between a picker that teaches the rule and one that punishes you for not knowing it.

Note that a `RESERVED` hold is excluded: re-picking that patient *resumes* their unpaid
checkout, which is exactly what they want.

And one small fix worth remembering when you build any form:

> It used to fire only when there was EXACTLY one, which left `patientId` null for an
> account with two — and `startPayment` begins `if (patientId === null) return`, **so the
> Pay button looked live and silently did nothing.**

---

# Part 11 — Formatting: time and money

`lib/format.ts`. The server sends UTC instants and integer paise; converting for display
is the client's job.

```ts
const IST_OFFSET_MS = 330 * 60_000;
```

> IST is UTC+05:30 with no DST, ever, so the offset is arithmetic rather than a timezone
> database lookup. This deliberately mirrors `apps/api/src/common/ist.ts`: both ends do the
> same fixed-offset maths, and neither needs `Intl` with a `timeZone` option — **which is
> the part of Intl that Hermes cannot be relied on to ship.** A hospital in Mumbai must
> read 10:00 on a phone set to London.

Hermes is the JavaScript engine React Native uses. Its `Intl` support is partial, which
is why this is arithmetic.

```ts
istClock('2026-09-08T05:30:00Z')  // "11 AM"
istRange(start, end)              // "10 AM–1 PM"  or  "10–11:30 AM"
calendarDate(iso)                 // "Sun 30 Aug"
rupees(50000)                     // "₹500"
```

**12-hour, and `:00` is dropped on the hour:**

> Clinics run on whole and half hours, and "7 PM" is what a receptionist says to a
> patient — "19:00" is what a server log says.

`istRange` collapses a repeated AM/PM "because on a session card every character competes
with the doctor's name for the same line."

And `calendarDate` carries a lesson about defensive formatters:

> It used to take only the date-only form, and passing an instant produced the string
> `"2026-08-31T11:27:30.000ZT00:00:00.000Z"` — an Invalid Date whose parts render as
> **"undefined NaN undefined"** rather than throwing. That reached a device. A formatter
> that silently prints `undefined` for a plausible input is a trap, and the fix belongs
> here rather than at each caller.

It also converts to IST *before* reading the date, because "a session at 19:30 UTC is the
next day in Mumbai, and showing the UTC day would be off by one all evening — every
evening, which is exactly when an OPD clinic runs."
---

# Part 12 — How to change the UI

This is the part you came for. Recipes first, then the traps, then the rules that are
not yours to break.

## 12.0 See your change

```bash
cd apps/mobile
pnpm dev                 # expo start
```

Then press `a` for Android, or scan the QR with your dev build.

**Fast Refresh** applies most edits in under a second while keeping screen state. If a
change does not appear, press `r` in the terminal to reload.

| You changed | You need |
|---|---|
| a colour, a style, JSX, a component, a hook | nothing — Fast Refresh |
| `app.json`, a plugin, a native dependency | **a new build** (`eas build`) |
| `theme.ts` | Fast Refresh, but check the web twin too |

Before calling anything done:

```bash
pnpm --filter @opd/mobile lint        # includes the pressable/style check
pnpm --filter @opd/mobile typecheck   # regenerates route types first
```

## 12.1 Change a colour

**Always in `theme.ts`.** Never in a screen.

```ts
// theme.ts
primary: '#0E7C7B',   →   primary: '#1D4ED8',
```

That one line changes: every primary button, the Join button, the focus ring, the tab
bar's active tint, the header tint, every icon that uses `theme.color.primary`, and the
pull-to-refresh spinner.

**Two things to remember.**

1. `apps/web/tailwind.config.ts` is the twin. `theme.ts` says so in its first comment:
   *"change both together."*
2. `primary` is `teal[700]`. If you change the brand, change the `teal` ramp too, or the
   avatars (teal-100), the search chip (teal-50) and the token hero (teal-50 / teal-800)
   will still be the old colour.

## 12.2 Change spacing, radius or type

Same file, same rule.

```ts
space:  { 1: 4, 2: 8, 3: 12, 4: 16, ... }    // the 4pt grid
radius: { sm: 6, md: 8, control: 12, lg: 14, xl: 20, full: 9999 }
```

To make every card rounder: `lg: 14 → 18`. To make the app airier: bump `space[4]`, since
that is the standard screen padding.

For type, edit `theme.font.*`. **To change weight, change `fontFamily`** — see 3.4 —
and keep the matching `fontWeight` beside it.

## 12.3 Restyle one component everywhere

Say every card should have a stronger shadow.

```tsx
// lib/ui.tsx
card: {
  ...
  ...theme.elevation.card,     →     ...theme.elevation.md,
}
```

One edit, every card. That is what `Card` is for. If you find yourself making the same
change in three screens, the change belongs in `lib/ui.tsx` instead.

## 12.4 Rewrite the app's words

Two maps hold nearly all the status wording:

```tsx
// lib/visits.tsx — what the patient sees about their own booking
SKIPPED: { label: 'Missed - see reception', tone: 'warning', icon: 'alert-triangle' },

// lib/discovery.tsx — what they see about a session
OPEN_FOR_REGISTRATION: { label: 'Open', tone: 'success', icon: 'check-circle' },
```

And the instruction line is one function:

```tsx
// lib/visits.tsx
export function nextStepFor(entry: MyQueueEntry): string { ... }
```

Both are `Record<Enum, ...>` or exhaustive `switch`, so **TypeScript will not let you
forget a case**.

## 12.5 Change a screen's layout

Open the screen file. Its `StyleSheet.create({...})` is at the bottom, and the JSX above
it is the structure. Move blocks, change styles, and remember the four flexbox facts
from 1.5.

To reorder sections on the token screen, move the `<Card>` blocks — they are already
numbered in comments:

```tsx
{/* 1. The token. */}       <View style={styles.hero}>...</View>
{/* 2. The figures. */}     <Card title="Where you are">...</Card>
{/* 3. The QR. */}          <Card title="Checking in">...</Card>
{/* 4. Static detail. */}   <Card title="Appointment">...</Card>
```

## 12.6 Add a new screen

1. Create the file — the path is the route:
   `app/(app)/(discover)/about.tsx` → `/about`
2. Default-export a component.
3. Give it a title: `<Stack.Screen options={{ title: 'About' }} />`
4. Navigate to it: `router.push('/about')`
5. Run `pnpm --filter @opd/mobile typecheck` so the route types regenerate.

Start from the shape every screen here uses:

```tsx
export default function About() {
  const data = useApi<Thing>('/things');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'About' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <QueryState
          pending={data.isPending}
          error={data.error}
          isEmpty={data.isSuccess && data.data.items.length === 0}
          emptyText="Nothing here yet."
          onRetry={() => void data.refetch()}
        />
        {data.data ? <Card title="Section">...</Card> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: theme.space[4], gap: theme.space[3], paddingBottom: theme.space[10] },
});
```

## 12.7 Add a component to the library

Put it in `lib/ui.tsx` if it is generic (a badge, a divider, a bottom sheet); in
`lib/discovery.tsx` if it knows about hospitals or queues.

Follow the house style:

- props typed inline
- all values from `theme`
- press feedback via `{...pressable()}` on a `Pressable`, visuals on a child `View`
- an `accessibilityRole` and, where the label is not obvious, an `accessibilityLabel`
- a doc comment saying *why*, not what

## 12.8 Change an icon

Every icon in the app goes through `lib/icon.tsx`, which wraps Feather.

```tsx
<Icon name="clock" size={16} color={theme.color.primary} />
```

Browse the set at [feathericons.com](https://feathericons.com). The name is the type, so
a wrong one is a compile error.

> Every screen imports Icon, never Feather, so the set can be swapped in one file.

## 12.9 The seven traps

Each of these has already cost this project time on a real device.

### 1. `style` next to a spread `pressable()`

```tsx
{/* ✗ the style is silently discarded */}
<Pressable {...pressable()} style={styles.button}>

{/* ✓ */}
<Pressable {...pressable()}>
  <View style={styles.button}>...</View>
</Pressable>
```

> The button disappeared precisely when it became tappable.

There is a lint script for exactly this — `scripts/check-pressable-style.cjs` — because
"typecheck and eslint are both perfectly happy with it, and it shipped to a device twice
in one day."

### 2. `fontWeight` without `fontFamily`

```tsx
{ ...theme.font.body, fontWeight: '700' }                              // ✗ no effect (or faux-bold)
{ ...theme.font.body, fontFamily: theme.fontFamily.bold, fontWeight: '700' }  // ✓
```

### 3. A shadow on only one platform

Always spread a whole `theme.elevation.*` — it sets the iOS properties *and* Android's
`elevation`. Setting `shadowOpacity` alone gives you a card that is flat on Android.

### 4. `lineHeight` on a `TextInput`

Android clips glyphs and offsets the caret. Do not spread a font token into a
`TextInput` style; set `fontSize` and `fontFamily` individually, as `Field` does.

### 5. Anything that changes a focused input's geometry

No `elevation`, no border-width change, no height change on focus. Colour only. See 4.4
for the keyboard-flicker loop it caused.

### 6. Adding a native module

A JS-only library is a reload. A **native** module (`expo-image`, `react-native-razorpay`,
anything shipping `android/` or `ios/`) needs a fresh build before it will even load, and
Expo Go cannot load one at all. Check before you install.

### 7. Route-name collisions

`[id].tsx` directly inside a route group becomes a catch-all that shadows every
top-level path. `index.tsx` inside a group claims `/`. Always add a segment:
`visit/[id].tsx`, `session/[id].tsx`, `visits.tsx`.

## 12.10 What is not yours to change

The app is a screen onto a server. These belong to the API, and changing them here means
the phone and the server disagree — which the server always wins, usually in front of a
patient.

| Do not | Because |
|---|---|
| compute queue position | `checkedInAheadCount` is the server's |
| decide whether Join is allowed | `registrationOpen` is the server's |
| calculate a fee or send an amount | Razorpay takes it from the order |
| treat "Checkout said success" as booked | only the webhook issues a token |
| hide an error instead of showing it | a rejected command must be surfaced |
| add a status label by hand | extend the contract, then the map |

The rule from `docs/CLAUDE.md` §9: **never reimplement queue logic in the frontend.**
Surface the server's rejection clearly instead of failing silently.

Rewording, restyling, reordering and re-laying-out are all entirely yours.

## 12.11 A worked example

*"The Join button should be bigger and say 'Book now'."*

1. Find it — `JoinButton` in `lib/discovery.tsx`.
2. The label:
   ```tsx
   {registrationOpen ? 'Join' : 'Closed'}   →   {registrationOpen ? 'Book now' : 'Closed'}
   ```
3. The size, in the same file's `StyleSheet`:
   ```tsx
   joinButton: { height: 44, minWidth: 104, ... }   →   { height: 52, minWidth: 132, ... }
   ```
4. Save. Fast Refresh shows it on the department screen and the session screen at once,
   because both use the same component.
5. `pnpm --filter @opd/mobile lint && pnpm --filter @opd/mobile typecheck`.

**Two minutes, one file, two screens updated.** That is the payoff for the component
library — and the reason not to style buttons inside screens.

---

# Part 13 — Two end-to-end traces

## Trace 1 — Cold start to a booked token

```
app launches → app/_layout.tsx
  SafeAreaProvider → QueryClientProvider → AuthProvider → RealtimeProvider → CityProvider
  Gate:
    useFonts(Inter ×4)                    ─┐ both awaited behind
    AuthProvider reads the keychain       ─┘ ONE splash spinner
    signed in? no  → router.replace('/(auth)/login')

login.tsx  →  signIn(email, password)
  POST /auth/login → { accessToken, refreshToken }
  persist(): tokensRef FIRST (sync), then setTokens, then SecureStore
  signedIn flips → the Gate redirects to '/'
  RealtimeProvider sees a token → io(API_URL, { auth: { token } })

(discover)/index.tsx
  useCity() → 'Mumbai' from SecureStore
  useApi('/patients')                       → greeting + avatar
  useApi('/hospitals?city=Mumbai&limit=50') → the list
  while pending: 4 RowSkeletons, sized like the answer

tap a hospital → /hospital/abc
  useApi('/hospitals/abc') + useApi('/departments?hospitalId=abc&limit=50')

tap a department → /department/xyz
  useApi('/departments/xyz/sessions')
  useLiveSessions([...sessionIds])          ← subscribe to EVERY card's room
  each card: SessionCardView + JoinButton(registrationOpen from the SERVER)

tap Join → /join?sessionId=s1
  useApi('/sessions/s1')  useApi('/patients')  useMyActiveEntries()
  patients already booked here are unselectable → ALREADY_IN_QUEUE unreachable
  tap "Pay ₹500"
    POST /sessions/s1/join { patientId }
    ← { entry: RESERVED, razorpayOrderId, razorpayKeyId, callbackUrl }
    phase = { name: 'checkout', order }
    → polling MY_ACTIVE_ENTRIES every 2s STARTS NOW, not after payment

  <Modal> <WebView html={checkoutHtml(order)} baseUrl="https://opd-queue.local">
    redirect: true                          ← netbanking works because of this
    UPI scheme → Linking.openURL, leftOurPage = true
    bank URL   → leftOurPage = true
    callbackUrl hit → return false, phase = 'confirming'

  meanwhile, server-side: Razorpay → POST /webhooks/razorpay → entry CONFIRMED

  the 2s poll sees status !== 'RESERVED'
    → router.replace('/visit/e1')           ← replace, so back does not return to checkout

visit/[id].tsx
  useLiveSession(entry.sessionId)
  hero: A007 on teal, status pill, LiveState (renders nothing while connected)
  figures: ETA window · now serving
  ahead: 2 checked in · 5 also booked
  instruction: nextStepFor(entry)
  QR: signCheckInCode value from the server, 172px
```

## Trace 2 — The doctor calls the next patient

```
SERVER: reception presses Call next
  → runCommand → COMMIT → emitSessionUpdate(sessionId, version)
                        → emitEntryUpdate(accountId, entryId, ...)

PHONE, socket is up:
  entryUpdated  → invalidateQueries([MY_ACTIVE_ENTRIES])
  sessionUpdated→ invalidate anything matching /sessions/s1, /departments/, /doctors/
  TanStack refetches → the token screen redraws:
      status pill: "Booked" → "Your turn - go in"
      nextStepFor: "You have been called. Please go in now."
      ahead counts drop
  (no navigation, no animation, no manual state — the query changed)

PHONE, socket is down (a lift):
  LiveState renders "Not live - reconnecting"      ← the numbers are frozen and SAY so
  FALLBACK_POLL_MS (90s) still fires
  signal returns → socket 'connect'
      re-subscribe every watched room
      invalidateQueries()                          ← the reconnect contract

PHONE, backgrounded:
  EventNotifier → DispatchSweeper → Expo → the phone buzzes: "A007 - you are being called"
  tap → addNotificationResponseReceivedListener → router.push('/visit/e1')
        (or getLastNotificationResponseAsync, if the tap is what started the app)
  the screen fetches the truth over REST. The push carried only an entryId.
```

---

# Part 14 — Running and shipping it

## Local development

```bash
cd apps/mobile
pnpm dev
```

`EXPO_PUBLIC_API_URL` picks the backend:

```
http://localhost:3000    a simulator on this machine
http://10.0.2.2:3000     an Android emulator (localhost is the emulator itself)
http://192.168.x.x:3000  a real phone on the same wifi
https://opd-api-koes.onrender.com   staging
```

Anything prefixed `EXPO_PUBLIC_` is **inlined at build time**, not read at runtime. A
built APK has the value baked in.

## Monorepo plumbing

`metro.config.js` exists because Metro does not follow workspace packages by default:

```js
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
```

> **NOT `disableHierarchicalLookup`**: that is advice for HOISTED monorepos. Under pnpm's
> isolated layout, transitive deps live only in their parent's nested `node_modules`, and
> Metro must be allowed to walk up into them or the bundle fails to resolve.

## Builds

```bash
pnpm exec eas build --profile preview --platform android    # installable APK
```

`eas.json` has three profiles:

| Profile | `developmentClient` | JS comes from |
|---|---|---|
| `development` | true | Metro, on your laptop |
| `preview` | — | **bundled into the APK** |
| `production` | — | bundled; app bundle for Play |

That distinction is why `preview` and `production` set `EXPO_PUBLIC_API_URL` in `env`
and `development` does not: a standalone build has no `.env` to read, and without it
`localhost` would be baked in — an app that shows a spinner forever on a real phone.

And one line in `package.json` that took a failed build to find:

```json
"eas-build-post-install": "cd ../.. && pnpm --filter @opd/contracts build"
```

**EAS installs the workspace but never builds it.** `@opd/contracts` compiles to
`dist/`, which does not exist on a fresh clone, so the bundle failed to resolve it.
Development builds never hit this, because Metro served the JS from a laptop where
`dist/` already existed.

This is the same lesson as Render and Vercel, learned a third time: **a workspace package
that compiles is not installed, it is built, and every deploy target must be told
separately.**

---

# Exercises

### Reading

1. **Trace one tap.** Follow "tap a hospital on Home" from `index.tsx` to the rendered
   department list. Name every file.

2. Answer from the code: **why does `theme.font.h3` set both `fontFamily` and
   `fontWeight` when the comment admits it is redundant?**

3. Find every use of `fontVariant: ['tabular-nums']` (`grep -rn tabular-nums apps/mobile`).
   Explain what they have in common.

4. Read `JoinButton` in `lib/discovery.tsx` end to end. List its four states and what
   each tells the patient.

### Changing

5. Change `theme.color.primary` to any other colour, run the app, and list everything
   that changed. Then find what did *not* change and explain why (hint: the `teal` ramp).

6. Make every `Card` corner rounder in one edit.

7. Reword `SKIPPED` in `lib/visits.tsx` and find both screens where it appears.

8. Give the "now serving" figure on the token screen its own colour. Do it without
   touching any other figure.

### Building

9. **Add a "Nearby" section to Home** listing the three hospitals with the most OPD
   sessions today. Reuse `Row` and `SectionLabel`. No new endpoint — sort what
   `/hospitals` already returns.

10. **Add an empty-state illustration** to `QueryState` — an optional prop, defaulting to
    the current icon circle, so no existing call site changes.

11. **Break trap #1 on purpose**: add `style={styles.card}` to a `Pressable` that already
    spreads `pressable()`, then run `pnpm --filter @opd/mobile lint`. Read the error.
    Revert.

12. **The hard one.** Add a **"Directions" card** to the token screen showing the
    hospital's address with a tap that opens Maps (`Linking.openURL`). You will need to
    check whether `MyQueueEntry` carries an address — and if it does not, that is a
    `packages/contracts` change first, then the API, then here. *If you can work out why
    it has to happen in that order, you have understood both documents.*

---

## Where to look when you are stuck

| Question | File |
|---|---|
| "What colour/size/font is this?" | `theme.ts` |
| "Is there already a component for this?" | `lib/ui.tsx`, then `lib/discovery.tsx` |
| "Where does this screen live?" | the path *is* the route — `app/…` |
| "Where does this number come from?" | the `useApi` call at the top of the screen |
| "Why is this like this?" | the comment above it |
| "What should it look like?" | `docs/Design.md`, `docs/ui-screens/` |
| "What is the API sending?" | `packages/contracts/src/**`, and `docs/api.md` |

## A closing note

The API earns its complexity: money, concurrency, and a queue that must never lie. **This
app is mostly layout**, and that is by design — every hard decision was made on the
server so that this side could stay a screen.

Which means you can change how it looks quite freely. The three things to hold onto:

- **Tokens, not literals.** If you type a hex code into a screen file, it will be wrong
  the next time the brand moves.
- **Components, not copies.** The `Card` comment — *"it existed nine times before it
  existed once"* — is the warning.
- **Never decide what the server decides.** Restyle the Join button however you like;
  do not teach it to work out for itself whether joining is allowed.

Start with exercise 5. Changing one colour and watching twelve screens move is the
fastest way to feel how the design system is wired.
