import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { CancelEntryResponse, MyQueueEntry, Paginated } from '@opd/contracts';
import { useApi, useApiPost } from '../../../../lib/api';
import { LiveState, QueryState, QueueStrip } from '../../../../lib/discovery';
import {
  EntryStatusPill,
  MY_ACTIVE_ENTRIES,
  holdRemaining,
  nextStepFor,
} from '../../../../lib/visits';
import { Button, Card, ErrorNote, Hairline, KeyValue, SectionLabel } from '../../../../lib/ui';
import { useLiveSession } from '../../../../lib/realtime';
import { calendarDate, istClock, istRange, rupees } from '../../../../lib/format';
import { theme } from '../../../../theme';

/**
 * The token card - the hero after joining, and the screen the handoff draws as its
 * confirmation sheet.
 *
 * That sheet is the model for the top of this screen, laid out exactly as it is
 * there: the eyebrow, the token at 64pt, who it is for, then hairline rows for the
 * two facts a patient actually came back to check. This app has no sheet, and does
 * not need one - our join flow ends at a payment the server has to confirm, so the
 * confirmation IS a screen you can return to rather than a panel that slides away.
 *
 * Every number on it comes from the server. The two "ahead" counts are the honest
 * two-number model: people physically here and ahead of you, and people booked ahead
 * who may or may not turn up. Nothing here recomputes a queue position.
 *
 * `entry.updated` arrives on this account's own private room the instant their
 * booking moves - called, skipped, cancelled - and `useLiveSession` keeps the queue
 * numbers and the ETA window moving with the room they are waiting in. The poll below
 * is only the safety net for a socket that died without saying so.
 */
const FALLBACK_POLL_MS = 90_000;

export default function TokenCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // There is no GET /me/queue-entries/:id: the active list is small and already
  // carries every field this screen needs, so one cached request serves both screens
  // rather than adding an endpoint for a single reader.
  const query = useApi<Paginated<MyQueueEntry>>(MY_ACTIVE_ENTRIES, true, FALLBACK_POLL_MS);
  const past = useApi<Paginated<MyQueueEntry>>('/me/queue-entries?scope=past&limit=50');
  const entry =
    query.data?.items.find((e) => e.id === id) ?? past.data?.items.find((e) => e.id === id) ?? null;

  // Watch the queue this token is in, so the ETA and "ahead of you" move with it.
  const { connected } = useLiveSession(entry?.sessionId);

  const cancel = useApiPost<{ reason?: string }, CancelEntryResponse>(`/queue-entries/${id}/cancel`);

  // A ticking clock for the hold countdown. One second is the smallest unit shown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (entry?.reservationExpiresAt == null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [entry?.reservationExpiresAt]);

  const onCancel = () => {
    if (entry === null) return;
    Alert.alert(
      'Cancel this booking?',
      entry.refundPctIfCancelledNow > 0
        ? `You will be refunded ${entry.refundPctIfCancelledNow}% of ${rupees(entry.feePaise)}. Refunds take a few working days.`
        : 'This booking is past the free cancellation window, so no refund is due.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(
              {},
              {
                onSuccess: () => {
                  void query.refetch();
                  void past.refetch();
                  router.back();
                },
              },
            ),
        },
      ],
    );
  };

  const hold = entry ? holdRemaining(entry.reservationExpiresAt, now) : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: entry?.tokenLabel ?? 'Your token' }} />
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
          isEmpty={!query.isPending && entry === null}
          emptyText="This booking is no longer available."
        />

        {entry !== null && (
          <>
            {/* ------------------------------------------------------------
                1. The handoff's sheet: the eyebrow, the token, who it is for,
                and the two facts underneath it on hairline rows.
            ------------------------------------------------------------- */}
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>YOU&apos;RE IN THE QUEUE</Text>
              <Text style={styles.token}>{entry.tokenLabel}</Text>
              <Text style={styles.who}>
                {entry.patientName} · {entry.doctorName}
              </Text>
              <View style={styles.pills}>
                <EntryStatusPill status={entry.status} />
                {/*
                  The most important place in the app for this. Every number below -
                  both "ahead" counts and the ETA window - is only true while updates
                  are arriving. A dropped socket freezes them rather than clearing
                  them, so a patient reading "2 checked in ahead" on a phone that lost
                  signal will sit down and wait for a turn that has already passed.
                  Nothing is rendered while connected.
                */}
                <LiveState connected={connected} />
              </View>

              {/*
                The same strip the department screen draws, from the same numbers.
                A patient who joined from that card should recognise their place in
                the queue here without having to re-read it.
              */}
              <QueueStrip
                ahead={entry.checkedInAheadCount}
                started={entry.nowServingToken !== null}
              />

              <Hairline style={styles.rule} />
              <View style={styles.rows}>
                <KeyValue
                  label="Expected"
                  // Saying nothing is better than a guess: the ETA is the server's.
                  value={
                    entry.etaFrom !== null && entry.etaTo !== null
                      ? `~${istRange(entry.etaFrom, entry.etaTo)}`
                      : 'Not available yet'
                  }
                  emphasis
                />
                <Hairline />
                <KeyValue label="Now serving" value={entry.nowServingToken ?? 'Not started'} />
                <Hairline />
                <KeyValue
                  label="Ahead of you"
                  // docs/PRD.md: the two counts stay separate and stay labelled.
                  // Collapsing them into one number is the lie that makes an ETA feel
                  // arbitrary.
                  value={`${entry.checkedInAheadCount} here · ${entry.bookedAheadCount} booked`}
                />
              </View>

              <Text style={styles.nextStep}>{nextStepFor(entry)}</Text>
            </View>

            {/* ------------------------------------------------------------
                2. The QR, sized to be scanned across a reception desk.
            ------------------------------------------------------------- */}
            <View style={styles.label}>
              <SectionLabel>Checking in</SectionLabel>
            </View>
            <Card>
              {entry.checkInCode !== null ? (
                <View style={styles.qrWrap}>
                  <View style={styles.qr}>
                    <QRCode
                      value={entry.checkInCode}
                      size={172}
                      color={theme.color.ink}
                      backgroundColor="white"
                    />
                  </View>
                  <Text style={styles.qrHint}>Show this at reception to check in</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>
                  {hold !== null
                    ? `Your place is held for ${hold}. Your QR code appears once payment is confirmed.`
                    : 'Your QR code appears once payment is confirmed.'}
                </Text>
              )}
            </Card>

            {/* ------------------------------------------------------------
                3. Everything that does not change, last, and quietly.
            ------------------------------------------------------------- */}
            <View style={styles.label}>
              <SectionLabel>Appointment</SectionLabel>
            </View>
            <Card>
              <KeyValue label="Department" value={entry.departmentName} />
              <KeyValue label="Hospital" value={entry.hospitalName} />
              <KeyValue label="Date" value={calendarDate(entry.scheduledStart)} />
              <KeyValue label="Session starts" value={istClock(entry.scheduledStart)} />
              <KeyValue label="Fee" value={rupees(entry.feePaise)} />
            </Card>

            {cancel.error !== null && <ErrorNote message={cancel.error.message} />}

            {entry.cancellable && (
              <View style={styles.cancel}>
                <Button
                  title="Cancel booking"
                  onPress={onCancel}
                  pending={cancel.isPending}
                  variant="ghost"
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: 22,
    paddingBottom: theme.space[10],
  },

  /*
    White, not a filled brand surface.

    The teal system painted this card teal-50 on the argument that the token is the
    one object the whole product hands over and should be the thing your eye lands
    on. That argument was right and the fill was the wrong way to serve it: in the
    ink system the token is SIXTY-FOUR POINTS of ink on white, which is louder than
    any tint, and a tinted card would only dilute it.
  */
  hero: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[5],
    ...theme.elevation.card,
  },
  eyebrow: { ...theme.font.overline, color: theme.color.inkTertiary },
  token: {
    ...theme.font.tokenXl,
    color: theme.color.ink,
    marginTop: 10,
    // The number must not shift as it changes.
    fontVariant: ['tabular-nums'],
  },
  who: { ...theme.font.bodyLg, color: theme.color.inkSecondary, marginTop: 6 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    marginTop: theme.space[4],
  },
  rule: { marginTop: theme.space[5] },
  rows: { gap: theme.space[3], paddingTop: theme.space[3] },
  nextStep: {
    ...theme.font.caption,
    color: theme.color.inkSecondary,
    marginTop: theme.space[5],
  },

  label: { paddingTop: 30, paddingBottom: 10 },

  qrWrap: { alignItems: 'center', gap: theme.space[3] },
  qr: {
    padding: theme.space[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
  },
  qrHint: { ...theme.font.caption, color: theme.color.inkTertiary, textAlign: 'center' },
  pendingText: { ...theme.font.caption, color: theme.color.warning.fg },

  cancel: { marginTop: theme.space[5] },
});
