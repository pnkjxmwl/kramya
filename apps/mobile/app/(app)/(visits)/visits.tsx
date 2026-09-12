import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyQueueEntry, Paginated } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { QueryState } from '../../../lib/discovery';
import { EntryStatusPill } from '../../../lib/visits';
import { calendarDate, istClock } from '../../../lib/format';
import { Segmented, pressable } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * My Visits - the third tab.
 *
 * **`visits.tsx`, not `index.tsx`.** Every segment above this is a route GROUP, so an
 * `index` here resolves to `/` - which `(discover)/index.tsx` already owns. Two
 * screens claiming one path is the same class of mistake as the bare `[id]` that
 * became a root catch-all.
 *
 * This is also the crash-recovery screen (docs/Architecture.md 12 case B): if the app
 * died between paying and seeing the token, the server still issued it from the
 * webhook, and opening this tab is how the patient finds it.
 *
 * Each row is the handoff's confirmation sheet in miniature - the eyebrow, then the
 * token as the largest thing in the card, then who it is for. A patient scanning this
 * list is looking for a number, and the number is what they find first.
 */

/** Active visits move on their own, so this screen polls like the session screen. */
const LIVE_POLL_MS = 15_000;

export default function MyVisits() {
  const [scope, setScope] = useState<'active' | 'past'>('active');
  const query = useApi<Paginated<MyQueueEntry>>(
    `/me/queue-entries?scope=${scope}&limit=50`,
    true,
    scope === 'active' ? LIVE_POLL_MS : undefined,
  );

  const items = query.data?.items ?? [];

  return (
    <View style={styles.screen}>
      {/*
        One control with two halves, not two loose pills. The pills read as two
        independent buttons, so it was never obvious that choosing one deselected the
        other - and the unselected half looked disabled rather than available.
      */}
      <View style={styles.tabs}>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isPending}
            onRefresh={() => void query.refetch()}
            tintColor={theme.color.inkTertiary}
            colors={[theme.color.ink]}
          />
        }
      >
        <QueryState
          pending={query.isPending}
          error={query.error}
          isEmpty={items.length === 0}
          emptyText={
            scope === 'active'
              ? 'No upcoming visits. Find a doctor from the Discover tab to book one.'
              : 'No past visits yet.'
          }
        />

        {items.map((entry) => (
          <Link key={entry.id} href={`/visit/${entry.id}`} asChild>
            <Pressable accessibilityRole="button" android_ripple={pressable().android_ripple}>
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.eyebrow}>
                    {scope === 'active' ? 'YOUR TOKEN' : 'TOKEN'}
                  </Text>
                  <EntryStatusPill status={entry.status} />
                </View>
                <Text style={styles.token}>{entry.tokenLabel}</Text>
                {/*
                  WHO the booking is for, first and labelled.

                  An account holds a whole family (docs/PRD.md 3.1), so two bookings
                  can share a token label, a doctor, a department and a date and
                  differ only in this. Without it they are indistinguishable, which is
                  exactly how a father gets taken to his daughter's appointment.

                  "For " is not decoration: the patient and the doctor are both
                  people's names, stacked, and the label is what says which is which.
                */}
                <Text style={styles.patient}>For {entry.patientName}</Text>
                <Text style={styles.meta}>
                  {entry.doctorName} · {entry.departmentName}
                </Text>
                <Text style={styles.meta}>
                  {entry.hospitalName} · {calendarDate(entry.scheduledStart)}
                  {'  ·  '}
                  {istClock(entry.scheduledStart)}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  tabs: {
    paddingHorizontal: theme.gutter,
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.bar,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: 22,
    gap: theme.space[3],
    paddingBottom: theme.space[10],
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.group,
    padding: theme.space[5],
    ...theme.elevation.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...theme.font.micro, letterSpacing: 1.2, color: theme.color.inkTertiary },
  // Tabular numerals so a column of token numbers does not jitter.
  token: {
    ...theme.font.tokenSm,
    color: theme.color.ink,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  // The patient reads BEFORE the doctor: when a family has several bookings it is the
  // only thing that tells them apart.
  patient: { ...theme.font.h3, color: theme.color.ink, marginTop: theme.space[3] },
  meta: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: 2 },
});
