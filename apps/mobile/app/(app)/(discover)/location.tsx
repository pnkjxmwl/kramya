import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { City, Paginated } from '@opd/contracts';
import { useApi } from '../../../lib/api';
import { useCity } from '../../../lib/city';
import { Icon } from '../../../lib/icon';
import { MoreNote, PAGE, QueryState, Row } from '../../../lib/discovery';
import { ListGroup, pressable } from '../../../lib/ui';
import { theme } from '../../../theme';

/**
 * Pick the city to browse. Reached on first run and from the eyebrow on home.
 *
 * The list is server-derived (GET /cities counts only listable hospitals), so a city
 * with nothing to show never appears and the choice can never be a dead end.
 *
 * **It is a modal, and that is what fixed how it looked.** It went through two wrong
 * shapes first. As a pushed screen with a small nav title it read as a sub-page of
 * nothing; given a 34pt title in the content instead, the back chevron sat in a bar
 * directly above it and the two stacked into separate zones - a title that looked
 * dropped below the chrome rather than owning the screen.
 *
 * `headerLargeTitle` is the native answer to exactly that and is **iOS-only**, so on
 * Android - the device this is being built against - it does nothing at all.
 *
 * The real problem was the shape, not the type size: picking a city is a
 * self-contained task, not a destination in a hierarchy. A modal has no back chevron
 * to compete with, so the title has the bar to itself, and Done/Cancel say plainly
 * that the screen is a decision you finish rather than a place you are in.
 */
export default function Location() {
  const router = useRouter();
  const { city, setCity } = useCity();
  const [q, setQ] = useState('');
  const cities = useApi<Paginated<City>>(`/cities?limit=${PAGE}`);

  async function choose(name: string) {
    await setCity(name);
    close();
  }

  function close() {
    // back(), not push('/'): home is already underneath, and pushing would leave a
    // second copy of it on the stack.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  /*
    Filtered here, not on the server.

    `GET /cities` takes PageQuery and nothing else - no `q`. Adding one would mean
    changing packages/contracts mid-stream, which docs/CLAUDE.md 11 rules out, and it
    would buy nothing: the endpoint groups every listable hospital into one row per
    city and returns the whole set in a single page, so the full list is already in
    memory. Filtering a list you already hold is not a shortcut, it is the only place
    the work can happen. `MoreNote` below still reports the true total honestly if the
    platform ever outgrows one page - that is the signal to move this server-side.
  */
  const all = cities.data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const items = needle === '' ? all : all.filter((c) => c.name.toLowerCase().includes(needle));

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Your city',
          headerLeft: () =>
            // Nothing to go back to on first run - a Cancel that strands someone on a
            // city-less app is worse than no Cancel at all.
            city === null ? null : (
              <Pressable onPress={close} hitSlop={12} {...pressable(theme.radius.sm)}>
                <Text style={styles.headerAction}>Cancel</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          {city === null
            ? 'Choose where you want to be seen. We will show the hospitals running OPD there today.'
            : 'You can change this any time from the home screen.'}
        </Text>

        {/* The same search well as Discover - 46pt, radius 15, the subtle fill. One
            search control in the app, not two that merely resemble each other. */}
        <View style={styles.search}>
          <Icon name="search" size={15} color={theme.color.inkTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search cities"
            placeholderTextColor={theme.color.inkTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel="Search cities"
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ('')} hitSlop={14} accessibilityLabel="Clear search">
              <Icon name="x" size={16} color={theme.color.inkTertiary} />
            </Pressable>
          ) : null}
        </View>

        {items.length > 0 ? (
          <>
            <ListGroup inset={theme.gutter}>
              {items.map((item) => {
                const selected = item.name === city;
                return (
                  <Row
                    key={item.name}
                    title={item.name}
                    subtitle={`${item.hospitalCount} hospital${
                      item.hospitalCount === 1 ? '' : 's'
                    } listed`}
                    padH={theme.gutter}
                    trailing={
                      <View style={styles.tick}>
                        {selected ? (
                          <View style={styles.tickOn}>
                            <Icon name="check" size={13} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </View>
                    }
                    onPress={() => void choose(item.name)}
                  />
                );
              })}
            </ListGroup>

            <Text style={styles.footnote}>
              Only cities with a hospital already on the platform are listed. More are
              being added.
            </Text>
          </>
        ) : (
          <QueryState
            pending={cities.isPending}
            error={cities.error}
            isEmpty={cities.isSuccess}
            // Two different emptinesses. "Nothing matched what you typed" is a
            // recoverable state you fix by typing less; "nothing is listed" is the
            // platform having no cities at all. One message for both would tell a
            // searching user the product is empty.
            emptyText={
              needle === ''
                ? 'No hospitals are listed yet. Please check back soon.'
                : `No city matches “${q.trim()}”`
            }
            onRetry={() => void cities.refetch()}
          />
        )}

        {/* Counted against the unfiltered list: MoreNote reports what the SERVER
            truncated, and a local filter is not truncation. */}
        {cities.data ? <MoreNote shown={all.length} total={cities.data.total} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.color.canvas },
  content: {
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space[5],
    paddingBottom: theme.space[8],
  },

  headerAction: {
    fontSize: 16,
    letterSpacing: -0.3,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.ink,
  },

  intro: {
    ...theme.font.body,
    color: theme.color.inkTertiary,
    marginBottom: theme.space[5],
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 46,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.fillSubtle,
    paddingHorizontal: 14,
    marginBottom: theme.space[5],
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

  // A fixed 22pt slot on every row, filled only on the chosen one. Holding the width
  // is what stops the list shifting sideways when the selection moves.
  tick: { width: 22, alignItems: 'flex-end' },
  tickOn: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footnote: {
    ...theme.font.caption,
    fontSize: 12,
    color: theme.color.inkTertiary,
    marginTop: theme.space[4],
    paddingHorizontal: 4,
  },
});
