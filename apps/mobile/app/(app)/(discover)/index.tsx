import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HospitalCard, Paginated, Patient, PublicDoctor } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useCity } from '../../../lib/city';
import { Icon } from '../../../lib/icon';
import { MoreNote, PAGE, QueryState, Row } from '../../../lib/discovery';
import {
  Avatar,
  Button,
  Dot,
  Hairline,
  ListGroup,
  Photo,
  Screen,
  Scrim,
  SectionLabel,
  pressable,
} from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * Discover - screen 1 of docs/design_handoff_opd_queue.
 *
 * Top to bottom: the city eyebrow and the account avatar, the large title, the
 * search well, one featured hospital as a full-bleed photo card, and then NEARBY as
 * hairline-separated rows on the bare background.
 *
 * The city is remembered (lib/city.tsx), so this opens straight onto the hospitals in
 * it rather than asking again every visit.
 *
 * **The featured card is the SELECTED hospital, and NEARBY lists them all.** Tapping a
 * row selects it - the card above swaps to that hospital and the row marks itself
 * VIEWING. The card is the way in: tapping it opens the hospital.
 *
 * This reverses the first version, which made the card `items[0]` and had every row
 * navigate. That read the handoff's selection state as a prototype affordance for
 * demoing three screens off one dataset. It is not: the README's Interactions section
 * names "Hospital select (screen 1 row tap) -> sets hospital; updates featured card"
 * as behaviour, and the markup carries a VIEWING marker on each of the four rows,
 * which only means something if a row can change which one is selected.
 *
 * **Selecting scrolls back to the top**, because the card is 236pt tall and sits under
 * a header - by the time a row is in reach the thing it updates is off-screen, and an
 * interaction whose only feedback is invisible is indistinguishable from a dead tap.
 * The handoff is a showcase where all of it is visible at once; a phone is not.
 *
 * While searching there is no featured card at all: the handoff is explicit that
 * typing filters the list, and promoting whichever result sorted first to a 236pt
 * photograph would be the screen picking a favourite out of a set the user is still
 * narrowing.
 *
 * The search box searches BOTH doctors and hospitals. A box that only filtered
 * hospitals would return nothing for "Sharma" and read as broken; both endpoints
 * already take `city` and `q`.
 */
export default function Home() {
  const router = useRouter();
  const { city, ready } = useCity();
  const [q, setQ] = useState('');
  // Which hospital the featured card is showing. Null until a row is tapped, which is
  // the first hospital - deliberately not seeded with an id, because the list has not
  // loaded yet and seeding it would mean tracking every way that list can change.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useRef<FlatList<HospitalCard>>(null);
  const query = q.trim();
  const searching = query.length > 0;

  // The SELF profile is where a real name lives; it also supplies the avatar
  // initials. One query, one cache key, shared with the Profile tab.
  const patients = useApi<Patient[]>('/patients');
  const self = patients.data?.find((p) => p.relation === 'SELF');

  const scope = city ? `city=${encodeURIComponent(city)}` : '';
  const search = searching ? `&q=${encodeURIComponent(query)}` : '';

  const hospitals = useApi<Paginated<HospitalCard>>(
    `/hospitals?${scope}&limit=${PAGE}${search}`,
    ready && city !== null,
  );
  // Only fetched while searching - an empty box is a hospital list, not a doctor list.
  const doctors = useApi<Paginated<PublicDoctor>>(
    `/doctors?${scope}&limit=3${search}`,
    ready && city !== null && searching,
  );

  const items = hospitals.data?.items ?? [];
  /*
    Before anything is tapped, lead with a hospital that is actually running OPD today.

    The list arrives in the server's order, which is alphabetical - so the card was
    whichever clinic sorted first, open or not. In Mumbai that is a leftover called
    "Demo Hospital" with no photograph and no sessions, and the app opened on a 236pt
    initials block advertising NO OPD TODAY. That is the worst possible first frame and
    it was not a data accident: any city can have a closed clinic sort first.

    "Open today" and not "has a photo", because the reason to lead with a hospital is
    that a patient can do something there. A real clinic with no photo is an ordinary
    state and the initials fallback is built for it.
  */
  const featured = searching
    ? undefined
    : (items.find((hospital) => hospital.id === selectedId) ??
      items.find((hospital) => hospital.openSessionCount > 0) ??
      items[0]);
  // Every hospital, including the featured one. It is not a duplicate: it is the
  // control that changes the card, and the handoff marks it VIEWING for that reason.
  const nearby = items;
  // Hospitals you could book into right now, not hospitals with a programme today.
  const openNow = items.filter((h) => h.openSessionCount > 0).length;

  const select = (id: string) => {
    setSelectedId(id);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const header = (
    <View>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.push('/location')}
          accessibilityRole="button"
          accessibilityLabel={city ? `Change city, currently ${city}` : 'Choose your city'}
          // The eyebrow is 14pt of type. hitSlop plus the row's own padding is what
          // takes it past the 44x44 floor in docs/Design.md 8 - the handoff draws
          // this control at label size and says nothing about its target.
          hitSlop={10}
          {...pressable(theme.radius.sm)}
        >
          <View style={styles.cityRow}>
            <Text style={styles.cityText}>{(city ?? 'Choose city').toUpperCase()}</Text>
            <Icon name="chevron-down" size={13} color={theme.color.inkTertiary} />
          </View>
        </Pressable>
        {/* Crossing to the Profile TAB, not pushing a screen onto this stack:
            expo-router switches tabs for a route that belongs to another one. */}
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={10}
          {...pressable(theme.radius.full)}
        >
          <Avatar name={self?.name ?? '?'} size={30} />
        </Pressable>
      </View>

      <Text style={styles.title}>Hospitals</Text>
      <Text style={styles.subtitle}>
        {searching
          ? `${hospitals.data?.total ?? 0} matching “${query}”`
          : `${openNow} open near you right now`}
      </Text>

      <View style={styles.search}>
        <Icon name="search" size={15} color={theme.color.inkTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Hospitals, doctors, specialities"
          placeholderTextColor={theme.color.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Search doctors and hospitals"
        />
        {searching ? (
          <Pressable onPress={() => setQ('')} hitSlop={14} accessibilityLabel="Clear search">
            <Icon name="x" size={16} color={theme.color.inkTertiary} />
          </Pressable>
        ) : null}
      </View>

      {featured ? (
        <Pressable
          onPress={() => router.push({ pathname: '/hospital/[id]', params: { id: featured.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${featured.name}, ${featured.openSessionCount} OPD open now`}
          {...pressable(theme.radius.hero)}
        >
          <View style={styles.hero}>
            <Photo
              uri={featured.photoUrl}
              name={featured.name}
              style={StyleSheet.absoluteFill}
              radius={theme.radius.hero}
              initialsSize={44}
            />
            <Scrim />
            <View style={styles.heroText}>
              {/*
                Three states, because there are three - and the middle one is the
                reason this changed. "8 OPD OPEN NOW" was `todaySessionCount`, which
                counts today's PROGRAMME including finished clinics, so the hero card
                was measured advertising eight open sessions at a hospital where every
                one had ended. A hospital whose day is over is not the same as a
                hospital with no OPD, and neither is "open now".
              */}
              <View style={styles.heroPill}>
                {featured.openSessionCount > 0 ? (
                  <Dot color={theme.color.success.onPhoto} />
                ) : null}
                <Text style={styles.heroPillText}>
                  {featured.openSessionCount > 0
                    ? `${featured.openSessionCount} OPD OPEN NOW`
                    : featured.todaySessionCount > 0
                      ? `${featured.todaySessionCount} OPD TODAY · CLOSED`
                      : 'NO OPD TODAY'}
                </Text>
              </View>
              <Text style={styles.heroName} numberOfLines={2}>
                {featured.name}
              </Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {featured.area ?? featured.city}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      {searching && doctors.data && doctors.data.total > 0 ? (
        <View style={styles.block}>
          <SectionLabel>Doctors</SectionLabel>
          <ListGroup inset={66}>
            {doctors.data.items.map((doctor) => (
              <Row
                key={doctor.id}
                avatar={doctor.name}
                title={doctor.name}
                subtitle={`${doctor.specialization ?? doctor.departmentName} · ${doctor.hospitalName}`}
                padH={18}
                onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: doctor.id } })}
              />
            ))}
            {doctors.data.total > doctors.data.items.length ? (
              <Row
                icon="users"
                title={`See all ${doctors.data.total} doctors`}
                padH={18}
                onPress={() => router.push({ pathname: '/doctors', params: { q: query } })}
              />
            ) : null}
          </ListGroup>
        </View>
      ) : null}

      {nearby.length > 0 || hospitals.isPending ? (
        <View style={styles.nearbyLabel}>
          <SectionLabel>{searching ? 'Hospitals' : 'Nearby'}</SectionLabel>
        </View>
      ) : null}
    </View>
  );

  // First run: no city stored. A prompt, deliberately NOT an automatic redirect - the
  // root layout's auth gate already redirects in an effect and a second one is how a
  // navigation loop starts.
  if (ready && city === null) {
    return (
      <Screen style={styles.prompt}>
        <Text style={styles.promptTitle}>Choose your city</Text>
        <Text style={styles.promptBody}>
          We&apos;ll show the hospitals running OPD near you today.
        </Text>
        <View style={styles.promptButton}>
          <Button title="Select city" onPress={() => router.push('/location')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        ref={list}
        contentContainerStyle={styles.content}
        data={nearby}
        keyExtractor={(hospital) => hospital.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const viewing = item.id === featured?.id;
          return (
            <Row
              photoUrl={item.photoUrl}
              avatar={item.name}
              title={item.name}
              subtitle={`${item.area ?? item.city} · ${
                item.openSessionCount > 0
                  ? `${item.openSessionCount} open now`
                  : item.todaySessionCount > 0
                    ? 'Closed for today'
                    : 'No OPD today'
              }`}
              trailing={viewing ? <Text style={styles.viewing}>VIEWING</Text> : undefined}
              /*
                Selecting, not navigating - but only while there is a card to update.
                A search hides the featured card, so a row tap there has nothing to
                change and must still lead somewhere.
              */
              onPress={
                searching
                  ? () => router.push({ pathname: '/hospital/[id]', params: { id: item.id } })
                  : () => select(item.id)
              }
            />
          );
        }}
        ItemSeparatorComponent={Hairline}
        ListEmptyComponent={
          <QueryState
            pending={!ready || hospitals.isPending}
            error={hospitals.error}
            // NEARBY now lists every hospital, so an empty list means there are none.
            isEmpty={hospitals.isSuccess && items.length === 0}
            emptyText={
              searching
                ? `Nothing matches “${query}”`
                : `No hospitals are listed in ${city} yet.`
            }
            // Four, because Mumbai has four - the placeholder should be the shape of
            // the answer, not an arbitrary count that makes the page resize.
            skeletonRows={4}
            onRetry={() => void hospitals.refetch()}
          />
        }
        ListFooterComponent={
          hospitals.data ? (
            <MoreNote shown={hospitals.data.items.length} total={hospitals.data.total} />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: theme.space[8] },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.space[2],
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  cityText: { ...theme.font.overline, color: theme.color.inkTertiary },

  title: { ...theme.font.display, color: theme.color.ink, marginTop: theme.space[6] },
  subtitle: { ...theme.font.body, color: theme.color.inkTertiary, marginTop: 6 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 46,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.fillSubtle,
    paddingHorizontal: 14,
    marginTop: theme.space[5],
  },
  searchInput: {
    flex: 1,
    alignSelf: 'stretch',
    fontSize: 15,
    letterSpacing: -0.3,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.ink,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },

  hero: {
    height: 236,
    borderRadius: theme.radius.hero,
    overflow: 'hidden',
    backgroundColor: theme.color.fillPhoto,
    marginTop: theme.space[6],
    ...theme.elevation.lg,
  },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 18 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    // The handoff blurs what is behind this pill. With no blur available the tint
    // has to carry it alone, so it sits a little heavier than the specified 20% -
    // at 20% flat, white 11px type over a bright sky is unreadable.
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  heroPillText: { ...theme.font.micro, color: '#FFFFFF' },
  heroName: { ...theme.font.h2, color: '#FFFFFF', marginTop: 10 },
  heroMeta: { ...theme.font.caption, color: 'rgba(255,255,255,0.82)', marginTop: 3 },

  block: { marginTop: theme.space[8], gap: theme.space[3] },
  nearbyLabel: { paddingTop: theme.space[8], paddingBottom: theme.space[1] },
  // The handoff's marker on the selected row: 11/600/+0.8 in ink, where the chevron
  // would be. Ink rather than tertiary on purpose - it is the one row that is not
  // "tap me to go somewhere", so it should not look like the others.
  viewing: { ...theme.font.micro, color: theme.color.ink },

  prompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
    gap: theme.space[2],
  },
  promptTitle: { ...theme.font.h1, color: theme.color.ink, textAlign: 'center' },
  promptBody: { ...theme.font.body, color: theme.color.inkTertiary, textAlign: 'center' },
  promptButton: { alignSelf: 'stretch', marginTop: theme.space[4] },
});
