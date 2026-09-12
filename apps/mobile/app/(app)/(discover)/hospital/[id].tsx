import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HospitalDetail, Paginated, PublicDepartment } from '@opd/contracts';
import { useApi } from '../../../../lib/api';
import { Icon } from '../../../../lib/icon';
import { MoreNote, PAGE, QueryState, Row } from '../../../../lib/discovery';
import { Dot, Hairline, ListGroup, Photo, Scrim, SectionLabel } from '../../../../lib/ui';
import { theme } from '../../../../theme';

/**
 * Hospital - screen 2 of docs/design_handoff_opd_queue.
 *
 * A 300pt photograph bleeding under the status bar, a floating glass back button over
 * it, and a white place card pulled 34pt up over the photo's bottom edge. Then the
 * departments as a grouped table.
 *
 * **No nav bar** - it is switched off for this route in the stack layout, because the
 * photograph IS the header. The back button below replaces it; the platform's swipe
 * gesture is untouched.
 *
 * **What the handoff has and this does not: the Call and Directions buttons, the
 * rating, the distance and the average wait.** Every one of them needs a field that
 * does not exist in packages/contracts - no phone number, no coordinates, no reviews,
 * no historical wait. Inventing them here would put a number on screen that no server
 * ever sent, which is the one thing docs/CLAUDE.md 1 rules out. The stats row instead
 * carries the two figures this app genuinely knows.
 */
export default function Hospital() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const hospital = useApi<HospitalDetail>(`/hospitals/${id}`);
  const departments = useApi<Paginated<PublicDepartment>>(
    `/departments?hospitalId=${id}&limit=${PAGE}`,
  );

  const data = hospital.data;
  const openToday = data?.todaySessionCount ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.photoWrap}>
          <Photo
            uri={data?.photoUrl ?? null}
            name={data?.name ?? ''}
            style={StyleSheet.absoluteFill}
            radius={0}
            initialsSize={54}
          />
          {/* Only the top band is darkened - so the glass back button holds against a
              bright sky. The bottom of the photograph needs no scrim: the place card
              is pulled up over it. */}
          <View style={styles.scrimTop}>
            <Scrim direction="down" />
          </View>
        </View>

        <View style={styles.place}>
          {data ? (
            <>
              <Text style={styles.eyebrow}>{(data.area ?? data.city).toUpperCase()}</Text>
              <Text style={styles.name}>{data.name}</Text>

              <View style={styles.statusLine}>
                {openToday > 0 ? <Dot /> : null}
                <Text style={styles.status}>
                  {openToday === 0 ? 'No OPD today' : `${openToday} OPD today`}
                  {'  ·  '}
                  {data.city}
                </Text>
              </View>

              {data.address ? (
                <Text style={styles.address} numberOfLines={2}>
                  {data.address}
                </Text>
              ) : null}

              <Hairline style={styles.rule} />

              <View style={styles.stats}>
                <Stat figure={String(openToday)} label="OPD TODAY" />
                <Stat figure={String(departments.data?.total ?? 0)} label="DEPARTMENTS" />
              </View>
            </>
          ) : (
            <QueryState
              pending={hospital.isPending}
              error={hospital.error}
              onRetry={() => void hospital.refetch()}
              skeletonRows={2}
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>Departments</SectionLabel>
        </View>

        <View style={styles.gutter}>
          {departments.data && departments.data.items.length > 0 ? (
            <ListGroup inset={theme.gutter}>
              {departments.data.items.map((item) => (
                <Row
                  key={item.id}
                  title={item.name}
                  subtitle={
                    item.todaySessionCount === 0
                      ? 'No OPD today'
                      : `${item.todaySessionCount} OPD today`
                  }
                  padH={theme.gutter}
                  onPress={() =>
                    router.push({ pathname: '/department/[id]', params: { id: item.id } })
                  }
                />
              ))}
            </ListGroup>
          ) : (
            <QueryState
              pending={departments.isPending}
              error={departments.error}
              isEmpty={departments.isSuccess}
              emptyText="This hospital has no departments listed yet."
              onRetry={() => void departments.refetch()}
            />
          )}
          {departments.data ? (
            <MoreNote shown={departments.data.items.length} total={departments.data.total} />
          ) : null}
        </View>
      </ScrollView>

      {/*
        Outside the ScrollView so it stays put while the photograph scrolls away -
        the handoff floats it, and a back button that scrolls off the top is a back
        button you cannot reach from the bottom of a long department list.
      */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={[styles.backHit, { top: insets.top + 8 }]}
        android_ripple={{ color: theme.color.fillSecondary, borderless: true }}
      >
        <View style={styles.back}>
          <Icon name="chevron-left" size={20} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

/** One figure and its tracked caps label. The handoff's stats trio, minus the data. */
function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statFigure}>{figure}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  content: { paddingBottom: theme.space[8] },

  photoWrap: { height: 300, backgroundColor: theme.color.fillPhoto },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },

  place: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    // Pulled up over the photograph. The handoff's -34.
    marginTop: -34,
    paddingTop: 26,
    paddingHorizontal: theme.gutter,
    paddingBottom: 24,
  },
  eyebrow: { ...theme.font.overline, color: theme.color.inkTertiary },
  name: { ...theme.font.h1, color: theme.color.ink, marginTop: theme.space[2] },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.space[3] },
  status: { fontSize: 14, lineHeight: 19, letterSpacing: -0.2, fontFamily: theme.fontFamily.regular, color: theme.color.inkSecondary },
  address: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: 6 },

  rule: { marginTop: 20 },
  stats: { flexDirection: 'row', marginTop: 20 },
  stat: { flex: 1, gap: 3 },
  statFigure: { ...theme.font.stat, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  statLabel: { ...theme.font.micro, color: theme.color.inkTertiary },

  section: { paddingHorizontal: theme.gutter, paddingTop: theme.space[8], paddingBottom: theme.space[3] },
  gutter: { paddingHorizontal: theme.gutter },

  // The tap target is 44; the visible glass circle inside it is the handoff's 36.
  backHit: {
    position: 'absolute',
    left: 18,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // The handoff blurs behind this. With no blur, the tint has to hold the glyph on
    // its own, so it sits heavier than the specified 22%.
    backgroundColor: 'rgba(20,22,26,0.36)',
  },
});
