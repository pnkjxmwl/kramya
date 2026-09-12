import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DoctorPresence, SessionCard, SessionStatus } from '@opd/contracts';
// TYPE ONLY, and that is load-bearing: lib/visits.tsx imports Pill from THIS module,
// so a value import here would be a genuine runtime cycle. Type imports are erased at
// compile time, so this one costs nothing. The card therefore receives a resolved
// BookingState rather than computing one - which also keeps it presentational.
import type { BookingState } from './visits';
import { Avatar, Button, Dot, ErrorNote, Photo, RowSkeleton, pressable } from './ui';
import { Icon, type IconName } from './icon';
import { istRange, rupees } from './format';
import { theme } from '../theme';

/**
 * Shared discovery UI, rebuilt on docs/design_handoff_opd_queue.
 *
 * The two shapes this file owns are the handoff's two ways of listing things:
 * `Row` - a bare list row, either hairline-separated on the background (Discover's
 * NEARBY list) or stacked inside a white `ListGroup` (departments, cities, profile) -
 * and `SessionCardView`, the handoff's **primary card**: the doctor, the two tokens,
 * the queue strip and the join action.
 */

/**
 * How many rows a discovery screen asks for. The API caps a page at 100
 * (docs/Rules.md 6); we fetch one large page and say so when it truncates, rather
 * than shipping infinite scroll for lists that hold two hospitals today.
 */
export const PAGE = 50;

type Tone = 'success' | 'info' | 'warning' | 'neutral';

/**
 * docs/Design.md 8 and the handoff agree: status is NEVER colour alone. Every pill
 * carries an icon AND a written label, so it still reads for a colour-blind user or
 * in bright sunlight outside a hospital.
 *
 * Restyled to the ink system: a low-contrast tinted ground with the label in the
 * tone's own colour, rather than the saturated chip the teal system used. Success is
 * the only one that keeps a real colour, because "open" is the only status this
 * product wants to shout.
 */
export function Pill({ label, tone, icon }: { label: string; tone: Tone; icon: IconName }) {
  const palette =
    tone === 'success'
      ? theme.color.success
      : tone === 'warning'
        ? theme.color.warning
        : theme.color.info;

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Icon name={icon} size={11} color={palette.fg} />
      <Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const SESSION_LABEL: Record<SessionStatus, { label: string; tone: Tone; icon: IconName }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'info', icon: 'clock' },
  OPEN_FOR_REGISTRATION: { label: 'Open', tone: 'success', icon: 'check-circle' },
  ACTIVE: { label: 'In progress', tone: 'success', icon: 'activity' },
  COMPLETED: { label: 'Finished', tone: 'neutral', icon: 'check' },
  ENDED_EARLY: { label: 'Ended early', tone: 'warning', icon: 'alert-triangle' },
  // Never listed by the API, but the map has to be total for the type to hold.
  CANCELLED: { label: 'Cancelled', tone: 'warning', icon: 'slash' },
};

/** docs/PRD.md 8.10 - presence is a separate fact from the session's status. */
const PRESENCE_LABEL: Record<DoctorPresence, { label: string; tone: Tone; icon: IconName }> = {
  NOT_PRESENT: { label: 'Doctor not arrived', tone: 'neutral', icon: 'user-x' },
  PRESENT: { label: 'Doctor in', tone: 'success', icon: 'user-check' },
  ON_BREAK: { label: 'On a break', tone: 'warning', icon: 'coffee' },
  LEFT: { label: 'Doctor has left', tone: 'warning', icon: 'log-out' },
};

export function SessionStatusPill({ status }: { status: SessionStatus }) {
  return <Pill {...SESSION_LABEL[status]} />;
}

export function PresencePill({ presence }: { presence: DoctorPresence }) {
  return <Pill {...PRESENCE_LABEL[presence]} />;
}

/**
 * The handoff's live marker: a 6px dot and the word "Live".
 *
 * Only for a session that is genuinely running. Everything else falls back to the
 * pill, which spells the state out - "Scheduled", "Ended early" - because those are
 * states a patient has to read rather than glance at.
 */
export function LiveMark({ status }: { status: SessionStatus }) {
  if (status !== 'ACTIVE') return <SessionStatusPill status={status} />;
  return (
    <View style={styles.live}>
      <Dot />
      <Text style={styles.liveText}>Live</Text>
    </View>
  );
}

/**
 * Whether the numbers on this screen are still arriving.
 *
 * **The one thing a live screen owes the person reading it.** A dropped socket does
 * not blank the screen - it freezes it, and a frozen queue position is
 * indistinguishable from a true one. A patient reading "3 ahead of you" while the
 * phone has been out of signal in a hospital basement will sit down and wait, and
 * miss the turn that has already passed. Saying so is the difference between a stale
 * number and a lie.
 *
 * Renders nothing while connected: a permanent green "Live" badge trains people to
 * stop seeing it, and then it cannot warn them.
 */
export function LiveState({ connected }: { connected: boolean }) {
  if (connected) return null;
  return <Pill label="Not live - reconnecting" tone="warning" icon="wifi-off" />;
}

/**
 * Loading, error and empty in one place, because every screen owes all three and
 * writing them per screen is how one of them goes missing.
 *
 * **The empty state lost its decorated circle.** The handoff's own empty state is
 * one line of tertiary text with 44pt of air above and below - and a 56px tinted
 * disc with an icon in it was a teal-system flourish that, restyled to grey, read as
 * a broken image rather than as a friendly nudge.
 */
export function QueryState({
  pending,
  error,
  isEmpty,
  emptyText,
  onRetry,
  skeletonRows = 3,
}: {
  pending: boolean;
  error: Error | null;
  isEmpty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  /**
   * How many placeholder rows to draw while loading. Set it to the number the screen
   * usually shows, so the page does not visibly grow as data lands.
   */
  skeletonRows?: number;
}) {
  if (pending) {
    /*
      A skeleton, not a spinner. A centred ActivityIndicator says "something is
      happening somewhere" and reserves no space, so the whole screen jumps when the
      list arrives. Placeholders shaped like the rows that are coming say what is
      arriving AND hold its geometry.
    */
    return (
      <View>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state}>
        <ErrorNote message={error.message} />
        {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyText ?? 'Nothing here yet.'}</Text>
      </View>
    );
  }

  return null;
}

/**
 * Honest note when a page was truncated. We fetch one large page rather than paging -
 * the API paginates (docs/Rules.md 6), so saying so beats silently hiding rows.
 *
 * ponytail: swap for useInfiniteQuery the first time a real city has more than a page
 * of hospitals.
 */
export function MoreNote({ shown, total }: { shown: number; total: number }) {
  if (shown >= total) return null;
  return (
    <Text style={styles.more}>
      Showing {shown} of {total}. Narrow your search to see more.
    </Text>
  );
}

/**
 * A tappable list row - the hospital / department / doctor / city unit.
 *
 * **It carries no background, no border and no radius of its own.** That is the
 * change that made one component cover every list in the handoff: a row is bare, and
 * its CONTAINER decides what kind of list it is. Dropped onto the canvas with
 * `Hairline` between rows it is Discover's NEARBY list; stacked inside `ListGroup` it
 * is the departments table. The teal system baked a bordered white card into the row
 * itself, so a grouped list was impossible without a second component.
 *
 * `padH` exists because those two containers differ by exactly one thing: a bare row
 * is already inside the screen gutter, and a grouped row has to pad itself.
 */
export function Row({
  title,
  subtitle,
  meta,
  icon,
  avatar,
  photoUrl,
  trailing,
  padH = 0,
  onPress,
}: {
  title: string;
  subtitle?: string;
  /** A short right-aligned value before the chevron. */
  meta?: string;
  icon?: IconName;
  /** Name to derive initials from. Takes precedence over `icon`. */
  avatar?: string;
  /**
   * A photograph for this row. Passing it (even as null) opts the row into the 52pt
   * thumbnail the handoff uses for a hospital.
   *
   * `null` is a real value here, not "not set": it means the server had no photo, and
   * `Photo` draws the initials fallback at the same size so the list stays even.
   */
  photoUrl?: string | null;
  /** Replaces the chevron - a status dot, a ghost pill, a word. */
  trailing?: React.ReactNode;
  /** Horizontal padding. 0 on the canvas (the screen gutter has it), 18 in a group. */
  padH?: number;
  onPress: () => void;
}) {
  const withPhoto = photoUrl !== undefined;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" {...pressable(0)}>
      <View style={[styles.row, { paddingHorizontal: padH }]}>
        {withPhoto ? (
          <Photo
            uri={photoUrl ?? null}
            name={avatar ?? title}
            style={styles.rowPhoto}
            radius={theme.radius.lg}
            initialsSize={17}
          />
        ) : avatar ? (
          <Avatar name={avatar} size={36} />
        ) : icon ? (
          <View style={styles.rowIcon}>
            <Icon name={icon} size={17} color={theme.color.inkSecondary} />
          </View>
        ) : null}

        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
        {trailing ?? <Icon name="chevron-right" size={17} color={theme.color.chevron} />}
      </View>
    </Pressable>
  );
}

/**
 * The queue, drawn.
 *
 * The handoff's strip, exactly: four 15pt ink bars for people recently seen, one 11pt
 * pale bar per person waiting ahead, and a 30pt ink bar at the end that is you.
 * Six wide, five apart, sitting on a 30pt baseline.
 *
 * **The pale bars are the ahead count, not a decoration** - the handoff is explicit
 * that the bar count and the stated number must agree, which is the whole reason the
 * strip is trustworthy at a glance rather than being a sparkline.
 *
 * ponytail: capped at 14 bars, because a 40-person queue would otherwise run off the
 * card. Past the cap the strip stops being a count and becomes "a lot", while the
 * legend beneath it still states the true number. Swap for a two-row wrap if real
 * OPD queues turn out to sit above 14 routinely.
 */
const AHEAD_BAR_CAP = 14;

export function QueueStrip({ ahead, started }: { ahead: number; started: boolean }) {
  const waiting = Math.max(0, Math.min(ahead, AHEAD_BAR_CAP));
  return (
    <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Nobody has been seen yet in a session that has not started - so no history. */}
      {started
        ? Array.from({ length: 4 }, (_, i) => <View key={`seen${i}`} style={styles.barSeen} />)
        : null}
      {Array.from({ length: waiting }, (_, i) => (
        <View key={`wait${i}`} style={styles.barWaiting} />
      ))}
      <View style={styles.barYou} />
    </View>
  );
}

/**
 * The handoff's primary card: one doctor's live queue, and the way into it.
 *
 * The layout is the handoff's, top to bottom - doctor row, the token pair, the strip,
 * the legend, the action - and the hierarchy is the point of it. The reader's own
 * number is 46px and ink; the number being served is 32px and tertiary. A patient
 * scanning this card in a corridor should find their own token first and everything
 * else second.
 *
 * **What the right-hand figure is when you have not joined.** The handoff assumes a
 * token you already hold. Before you have one there is no such number - and inventing
 * "your token would be 25" would be the client predicting queue state, which
 * docs/Rules.md 1 forbids outright. So the slot holds the number that actually drives
 * the decision to join: how many people are checked in and waiting.
 */
export function SessionCardView({
  card,
  onPress,
  onJoin,
  onOpenToken,
  booking = { kind: 'none' },
}: {
  card: SessionCard;
  /**
   * Where the card leads. **Omitted on the session screen**, which IS that
   * destination - a card that is visibly tappable and goes nowhere is worse than one
   * that is plainly not.
   */
  onPress?: () => void;
  /**
   * Book straight from the card. Optional only so a caller can render a read-only
   * list; every real list passes it.
   */
  onJoin?: () => void;
  /** Open the token this account already holds here. Needed only when `booking` is not 'none'. */
  onOpenToken?: (entryId: string) => void;
  /**
   * What this account holds in THIS session, resolved by the list screen with
   * `bookingStateFor(useMyActiveEntries().bySession.get(id))`.
   *
   * Passed in rather than derived here so the card stays presentational and the list
   * fetches once instead of once per card.
   */
  booking?: BookingState;
}) {
  const { snapshot } = card;
  const booked = booking.kind === 'booked';
  const reserved = booking.kind === 'reserved';
  const started = snapshot.nowServingToken !== null;

  const body = (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Avatar name={card.doctorName} size={42} />
        <View style={styles.cardHeadText}>
          <Text style={styles.doctor} numberOfLines={1}>
            {card.doctorName}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {istRange(card.scheduledStart, card.scheduledEnd)}
          </Text>
        </View>
        <LiveMark status={card.status} />
      </View>

      {card.isSubstitute ? (
        <Text style={styles.substitute}>Covering for the booked doctor</Text>
      ) : null}

      <View style={styles.tokens}>
        <View>
          <Text style={styles.tokenLabel}>NOW SERVING</Text>
          <Text style={styles.tokenServing}>{snapshot.nowServingToken ?? '—'}</Text>
        </View>
        <View style={styles.tokenRight}>
          <Text style={styles.tokenLabel}>{booked ? 'YOUR TOKEN' : 'WAITING'}</Text>
          <Text style={styles.tokenYours} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {booked ? booking.entry.tokenLabel : String(snapshot.checkedInCount)}
          </Text>
        </View>
      </View>

      <QueueStrip ahead={snapshot.checkedInCount} started={started} />

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          <Text style={styles.legendStrong}>{snapshot.checkedInCount}</Text> ahead of you
        </Text>
        {snapshot.joinNowEtaFrom && snapshot.joinNowEtaTo ? (
          <Text style={styles.legendText}>
            Seen{' '}
            <Text style={styles.legendStrong}>
              {istRange(snapshot.joinNowEtaFrom, snapshot.joinNowEtaTo)}
            </Text>
          </Text>
        ) : null}
      </View>

      {/*
        Nested inside the card's own Pressable on purpose: a nested Pressable
        captures its own touch, so tapping the action joins and tapping anywhere
        else opens the session.
      */}
      <View style={styles.action}>
        <Button
          title={
            reserved
              ? 'Finish payment'
              : booked
                ? `View your token · ${booking.entry.tokenLabel}`
                : snapshot.registrationOpen
                  ? `Join queue · ${rupees(card.feePaise)}`
                  : 'Registration closed'
          }
          /*
            `registrationOpen` is the SERVER's answer (docs/PRD.md 8.12) - the
            client never works it out for itself. Advisory, though: the last slot
            can go while this screen is open, so the join screen surfaces the
            server's rejection rather than assuming this was still true.
          */
          disabled={!snapshot.registrationOpen && booking.kind === 'none'}
          onPress={() => {
            if (booking.kind === 'none') onJoin?.();
            else if (reserved) onJoin?.();
            else onOpenToken?.(booking.entry.id);
          }}
        />
      </View>
    </View>
  );

  if (onPress === undefined) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" {...pressable(theme.radius.card)}>
      {body}
    </Pressable>
  );
}

/**
 * A doctor in the same department, compactly - the handoff's "ALSO IN CARDIOLOGY"
 * group.
 *
 * The trailing control is a ghost pill rather than a filled one: there is already a
 * filled ink button on this screen, and two of them would leave the reader with no
 * idea which one the screen wants.
 */
export function DoctorQueueRow({
  card,
  onPress,
  onJoin,
  onOpenToken,
  booking = { kind: 'none' },
}: {
  card: SessionCard;
  onPress: () => void;
  onJoin: () => void;
  /** Open the token this account already holds here. */
  onOpenToken?: (entryId: string) => void;
  booking?: BookingState;
}) {
  const booked = booking.kind === 'booked';
  const reserved = booking.kind === 'reserved';
  const open = card.snapshot.registrationOpen;
  const label = booked ? booking.entry.tokenLabel : reserved ? 'Pay' : open ? 'Join' : 'Closed';

  /*
    The pill goes where the label promises.

    It used to fall back to `onPress` - the session screen - whenever the account
    already held a token here, so tapping a pill that reads "T-12" took you to a page
    about the doctor rather than to T-12. A control labelled with a token has exactly
    one correct destination.
  */
  const act = booked
    ? () => onOpenToken?.(booking.entry.id)
    : reserved || open
      ? onJoin
      : onPress;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" {...pressable(0)}>
      <View style={styles.otherRow}>
        <Avatar name={card.doctorName} size={36} />
        <View style={styles.rowText}>
          <Text style={styles.otherName} numberOfLines={1}>
            {card.doctorName}
          </Text>
          <Text style={styles.otherMeta} numberOfLines={1}>
            {istRange(card.scheduledStart, card.scheduledEnd)} · {card.snapshot.checkedInCount} waiting
          </Text>
        </View>
        <Pressable
          onPress={act}
          // The handoff draws this pill 32pt tall. hitSlop is what keeps it a legal
          // target without changing a specified dimension.
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            booked
              ? `Your token ${booking.entry.tokenLabel}`
              : reserved
                ? `Finish paying for ${card.doctorName}`
                : open
                  ? `Join ${card.doctorName}`
                  : `Registration closed for ${card.doctorName}`
          }
          {...pressable(16)}
        >
          <View style={[styles.ghostPill, !open && !booked && !reserved && styles.ghostPillOff]}>
            <Text style={[styles.ghostPillText, !open && !booked && !reserved && styles.ghostPillTextOff]}>
              {label}
            </Text>
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: { paddingVertical: theme.space[6], gap: theme.space[3] },
  empty: { paddingVertical: 44, paddingHorizontal: theme.space[6] },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.2,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.inkTertiary,
    textAlign: 'center',
  },
  more: {
    ...theme.font.caption,
    color: theme.color.inkTertiary,
    textAlign: 'center',
    paddingVertical: theme.space[4],
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: { ...theme.font.micro, letterSpacing: 0.3 },

  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontFamily: theme.fontFamily.semibold,
    fontWeight: '600',
    color: theme.color.success.fg,
  },

  // 14pt of air top and bottom around a 52pt thumbnail is the handoff's NEARBY row;
  // with a 36pt avatar it is the grouped table row, and both clear 44x44.
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 14 },
  rowPhoto: { width: 52, height: 52 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.fillSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.4,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
  },
  rowSubtitle: { ...theme.font.caption, color: theme.color.inkTertiary },
  rowMeta: { ...theme.font.caption, color: theme.color.inkTertiary, fontVariant: ['tabular-nums'] },

  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    paddingTop: theme.space[6],
    paddingHorizontal: 22,
    paddingBottom: 22,
    ...theme.elevation.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  cardHeadText: { flex: 1, gap: 1 },
  doctor: { ...theme.font.h3, color: theme.color.ink },
  caption: { ...theme.font.caption, color: theme.color.inkTertiary },
  substitute: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: theme.space[2] },

  tokens: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space[4],
    marginTop: 26,
  },
  tokenRight: { alignItems: 'flex-end', flexShrink: 1 },
  tokenLabel: { ...theme.font.micro, letterSpacing: 1.2, color: theme.color.inkTertiary },
  // Tabular figures throughout: these numbers change live and must not jitter.
  tokenServing: {
    ...theme.font.tokenSm,
    color: theme.color.inkTertiary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  tokenYours: {
    ...theme.font.tokenLg,
    color: theme.color.ink,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 30, marginTop: theme.space[6] },
  barSeen: { width: 6, height: 15, borderRadius: 3, backgroundColor: 'rgba(10,10,12,0.78)' },
  barWaiting: { width: 6, height: 11, borderRadius: 3, backgroundColor: 'rgba(10,10,12,0.14)' },
  barYou: { width: 6, height: 30, borderRadius: 3, backgroundColor: theme.color.ink },

  legend: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.space[3],
    marginTop: theme.space[3],
  },
  legendText: { ...theme.font.caption, color: theme.color.inkTertiary },
  legendStrong: {
    color: theme.color.ink,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

  action: { marginTop: theme.space[6] },

  otherRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], paddingVertical: 15, paddingHorizontal: 18 },
  otherName: {
    ...theme.font.body,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
  },
  otherMeta: { fontSize: 12.5, lineHeight: 17, letterSpacing: -0.1, fontFamily: theme.fontFamily.regular, color: theme.color.inkTertiary },
  ghostPill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: theme.color.fillSecondary,
  },
  ghostPillOff: { backgroundColor: 'transparent' },
  ghostPillText: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    color: theme.color.ink,
  },
  ghostPillTextOff: { color: theme.color.inkTertiary },
});
