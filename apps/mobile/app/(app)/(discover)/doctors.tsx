import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Paginated, PublicDoctor } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useCity } from '../../../lib/city';
import { Icon } from '../../../lib/icon';
import { MoreNote, PAGE, QueryState, Row } from '../../../lib/discovery';
import { ListGroup } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * Doctor search - the secondary browse path (docs/PRD.md 5.1). It exists to lead back
 * to a session, which is the only joinable unit, so every result navigates to that
 * doctor's profile and their sessions.
 *
 * Scoped to the chosen city, like home: a patient in Mumbai searching "Sharma" means a
 * Sharma they can actually reach today.
 *
 * The search control is the handoff's recessed well, the same one Discover uses -
 * not the labelled `Field` this screen used to render. Two different search boxes one
 * navigation step apart is the kind of seam that makes an app feel assembled.
 */
export default function Doctors() {
  const params = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  const { city } = useCity();
  const [q, setQ] = useState(params.q ?? '');
  const query = q.trim();

  const scope = city ? `city=${encodeURIComponent(city)}&` : '';
  const search = query ? `&q=${encodeURIComponent(query)}` : '';
  const doctors = useApi<Paginated<PublicDoctor>>(`/doctors?${scope}limit=${PAGE}${search}`);

  const items = doctors.data?.items ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Doctors' }} />

      <View style={styles.search}>
        <Icon name="search" size={15} color={theme.color.inkTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Name or speciality"
          placeholderTextColor={theme.color.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Search doctors"
        />
        {query ? (
          <Pressable onPress={() => setQ('')} hitSlop={14} accessibilityLabel="Clear search">
            <Icon name="x" size={16} color={theme.color.inkTertiary} />
          </Pressable>
        ) : null}
      </View>
      {city ? <Text style={styles.scope}>Searching in {city}</Text> : null}

      {items.length > 0 ? (
        <ListGroup inset={66} style={styles.group}>
          {items.map((item) => (
            <Row
              key={item.id}
              avatar={item.name}
              title={item.name}
              subtitle={[item.specialization ?? item.departmentName, item.hospitalName].join(' · ')}
              padH={18}
              onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: item.id } })}
            />
          ))}
        </ListGroup>
      ) : (
        <QueryState
          pending={doctors.isPending}
          error={doctors.error}
          isEmpty={doctors.isSuccess}
          emptyText={
            query ? `Nothing matches “${query}”` : 'No doctors are listed here yet.'
          }
          onRetry={() => void doctors.refetch()}
        />
      )}

      {doctors.data ? (
        <MoreNote shown={doctors.data.items.length} total={doctors.data.total} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: { paddingHorizontal: theme.gutter, paddingTop: 22, paddingBottom: theme.space[8] },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 46,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.fillSubtle,
    paddingHorizontal: 14,
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
  scope: { ...theme.font.caption, color: theme.color.inkTertiary, marginTop: theme.space[3] },
  group: { marginTop: theme.space[5] },
});
