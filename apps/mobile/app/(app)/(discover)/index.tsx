import { useState } from 'react';
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
 * **The featured card is the first hospital, and the NEARBY list is the rest.** The
 * handoff drives it from a "selected hospital" the prototype keeps in memory and
 * marks VIEWING in the list below - which is a prototype affordance for demoing three
 * screens off one dataset, not a thing the product has. Showing the same hospital
 * twice to reproduce the marker would be a duplicate row that does nothing.
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
  const featured = searching ? undefined : items[0];
  const nearby = featured ? items.slice(1) : items;
  const openNow = items.filter((h) => h.todaySessionCount > 0).length;

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
          accessibilityLabel={`${featured.name}, ${featured.todaySessionCount} OPD today`}
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
              <View style={styles.heroPill}>
                {featured.todaySessionCount > 0 ? (
                  <Dot color={theme.color.success.onPhoto} />
                ) : null}
                <Text style={styles.heroPillText}>
                  {featured.todaySessionCount > 0
                    ? `${featured.todaySessionCount} OPD OPEN NOW`
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
        contentContainerStyle={styles.content}
        data={nearby}
        keyExtractor={(hospital) => hospital.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <Row
            photoUrl={item.photoUrl}
            avatar={item.name}
            title={item.name}
            subtitle={`${item.area ?? item.city} · ${
              item.todaySessionCount === 0 ? 'No OPD today' : `${item.todaySessionCount} OPD today`
            }`}
            onPress={() => router.push({ pathname: '/hospital/[id]', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={Hairline}
        ListEmptyComponent={
          <QueryState
            pending={!ready || hospitals.isPending}
            error={hospitals.error}
            // `featured` already showed the only hospital there is - an empty NEARBY
            // list under it is a correct, quiet outcome, not an empty screen.
            isEmpty={hospitals.isSuccess && featured === undefined}
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
