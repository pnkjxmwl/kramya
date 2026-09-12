import { Children, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icon';
import { theme } from '../theme';

/**
 * The app's primitives, rebuilt on the ink system in
 * docs/design_handoff_opd_queue/README.md.
 *
 * Nothing here is new API - every export kept its signature, so the screens that
 * were not redrawn still compile and simply come out looking like the handoff. That
 * was the point of doing the palette and the primitives first: most of "make every
 * screen look like this" is one layer, not fifteen.
 */

/**
 * Press feedback that matches the platform.
 *
 * Android users expect a ripple; iOS users expect a subtle opacity fade. Using one
 * model on both is a large part of why a React Native app reads as "not quite
 * native" - so every pressable in this app goes through here.
 */
export const pressable = (
  // Annotated `number`: `theme` is `as const`, so an inferred default would narrow
  // this to a literal and reject every other radius in the scale.
  radius: number = theme.radius.control,
): Pick<PressableProps, 'android_ripple' | 'style'> => ({
  // Ink at 8%, not a grey: on the near-white surfaces this system uses, a grey
  // ripple reads as a dirty smear and an ink one reads as pressure.
  android_ripple: { color: theme.color.fillSecondary, borderless: false, foreground: true },
  style: ({ pressed }) =>
    ({ opacity: Platform.OS === 'ios' && pressed ? 0.7 : 1, borderRadius: radius }) as ViewStyle,
});

/** Screen background + safe area. Every screen sits inside one of these. */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top }, style]}>{children}</View>;
}

/**
 * The gradient that keeps white text legible over a photograph.
 *
 * handoff: `linear-gradient(to top, rgba(8,10,12,.74), rgba(8,10,12,.30) 42%,
 * rgba(8,10,12,.02) 74%)`.
 *
 * **react-native-svg, not a stack of translucent Views.** RN has no gradient, and
 * the four-band approximation banded visibly against a sky - which is precisely the
 * upper third of every hospital photo the handoff assumes. react-native-svg is
 * already a dependency (react-native-qrcode-svg draws with it), so the exact
 * gradient costs nothing that is not already in the bundle.
 *
 * `pointerEvents="none"` so it never eats a tap meant for the card underneath.
 */
export function Scrim({
  /** `up` darkens the bottom (text sits low); `down` darkens the top (a back button sits high). */
  direction = 'up',
  style,
}: {
  direction?: 'up' | 'down';
  style?: StyleProp<ViewStyle>;
}) {
  const up = direction === 'up';
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1={up ? '1' : '0'} x2="0" y2={up ? '0' : '1'}>
            <Stop offset="0" stopColor="#080A0C" stopOpacity={up ? 0.74 : 0.5} />
            <Stop offset="0.42" stopColor="#080A0C" stopOpacity={0.3} />
            <Stop offset="0.74" stopColor="#080A0C" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#080A0C" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
      </Svg>
    </View>
  );
}

/**
 * A status dot. Six pixels, and never on its own.
 *
 * docs/Design.md 8 and the handoff agree: colour is never the whole message. Every
 * call site pairs this with a word - "Live", "Open until 8 PM", "4 OPD OPEN NOW" -
 * so the dot is emphasis rather than information, and a colour-blind reader loses
 * nothing.
 */
export function Dot({ color = theme.color.success.dot, size = 6 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** A 0.5px separator. The handoff's only line. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

/**
 * Initials on the neutral fill - the stand-in for a photo we do not have for
 * doctors, hospitals or family members.
 */
function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = initialsOf(name);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: theme.radius.full }]}>
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.34) }]}>{initials || '?'}</Text>
    </View>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words';
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
  icon?: IconName;
  helper?: string;
}) {
  const { label, icon, helper, ...input } = props;
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
        {icon ? <Icon name={icon} size={17} color={theme.color.inkTertiary} /> : null}
        <TextInput
          {...input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          placeholderTextColor={theme.color.inkTertiary}
          autoCorrect={false}
        />
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  pending,
  disabled,
  variant = 'primary',
  icon,
}: {
  title: string;
  onPress: () => void;
  /** Busy: shows a spinner and blocks taps. */
  pending?: boolean;
  /**
   * Not ready: blocks taps and LOOKS blocked, with no spinner.
   *
   * Distinct from `pending` because they mean different things to the person looking
   * at it - "wait" versus "you still have to do something".
   */
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
}) {
  const inert = pending === true || disabled === true;
  const fill =
    variant === 'primary'
      ? theme.color.ink
      : variant === 'danger'
        ? theme.color.danger.bg
        : variant === 'ghost'
          ? 'transparent'
          : theme.color.fillSecondary;

  const fg =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
        ? theme.color.danger.fg
        : theme.color.ink;

  return (
    // A pill, because in this system the full-width primary action always is
    // (handoff: 52px, radius height/2). Rectangular 14pt buttons exist in the
    // handoff only in the paired Call/Directions row, which this app has no data for.
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert }}
      {...pressable(theme.radius.full)}
    >
      <View
        style={[
          styles.button,
          // Disabled is the neutral fill, never a faded ink - a 40%-opacity black
          // pill still reads as "press me", just badly printed.
          { backgroundColor: inert ? theme.color.fillSecondary : fill },
        ]}
      >
        {pending === true ? (
          <ActivityIndicator color={theme.color.inkTertiary} />
        ) : (
          <>
            {icon ? (
              <Icon name={icon} size={17} color={inert ? theme.color.inkTertiary : fg} />
            ) : null}
            <Text style={[styles.buttonText, { color: inert ? theme.color.inkTertiary : fg }]}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Icon name="alert-circle" size={17} color={theme.color.danger.fg} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/**
 * A section heading - the handoff's **eyebrow**: 11px, 600, tracked +1.4, uppercase,
 * tertiary.
 *
 * **Uppercased here rather than at the call site**, so every existing caller -
 * "Departments", "Your profiles", "Where you are" - became an eyebrow without being
 * touched. That is also the guard: a screen cannot accidentally ship a
 * sentence-case section heading in a system that has none.
 *
 * This reverses the last redesign, which moved these from tracked caps to bold
 * sentence case on the argument that caps cost legibility for older patients. That
 * argument is still true of BODY copy and is not true of a four-word label whose job
 * is to separate two groups without competing with either - which is exactly what
 * the handoff uses it for, and what it is used for here.
 */
export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

/**
 * A photograph from the API, with the initials fallback built in.
 *
 * **The fallback lives here, not at each call site.** `photoUrl` is nullable by
 * design - most clinics at pilot will never upload one - and a remote image can also
 * simply fail on a hospital's wifi. Both are ordinary states, so every screen gets
 * the same graceful answer without having to remember.
 *
 * **React Native's `Image`, deliberately, not `expo-image`.** expo-image is the
 * better library and it is a NATIVE module - a dev client built before it was
 * installed throws at runtime, and the only fix is a fresh APK. RN's own Image is
 * already in every build, and Android backs it with Fresco's disk cache.
 *
 * The initials sit UNDERNEATH the image rather than instead of it, and the photo
 * fades in over them. The loading state, the null state and the error state are all
 * the same thing, and it is a thing that looks deliberate.
 */
export function Photo({
  uri,
  name,
  style,
  radius = theme.radius.lg,
  initialsSize = 16,
}: {
  uri: string | null;
  /** Used for the initials shown while loading, and kept if there is no image. */
  name: string;
  /** Sets the box. Width and height, or a flex, live here. */
  style?: StyleProp<ViewStyle>;
  radius?: number;
  initialsSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // A FlatList reuses row views, so without this a recycled row keeps the previous
  // photo's faded-in opacity - and a stale `failed` would hide a perfectly good
  // image for the next hospital that happens to land in that slot.
  useEffect(() => {
    setFailed(false);
    fade.setValue(0);
  }, [uri, fade]);

  const usable = uri !== null && uri !== '' && !failed;

  return (
    <View style={[styles.photo, { borderRadius: radius }, style]}>
      <Text style={[styles.photoInitials, { fontSize: initialsSize }]}>
        {initialsOf(name) || '?'}
      </Text>
      {usable ? (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="cover"
          onLoad={() =>
            Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
          }
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

/**
 * A pulsing placeholder block.
 *
 * **This exists to kill the centred spinner**, which is the most reliable "hobby app"
 * signal a screen can send. A spinner says "something is happening somewhere"; a
 * skeleton says "a list of hospitals is arriving, and it will be shaped like this".
 * It also removes the layout jump.
 */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.skeleton, style, { opacity: pulse }]} />;
}

/**
 * A placeholder shaped like a hospital row.
 *
 * Redrawn with the row: the handoff's list rows are a 52pt thumbnail and two lines
 * on the bare background, with a hairline between - not the bordered 112pt card the
 * teal system used. A skeleton that holds the wrong geometry reintroduces exactly
 * the layout jump it exists to remove.
 */
export function RowSkeleton() {
  return (
    <View style={styles.rowSkeleton}>
      <Skeleton style={styles.rowSkeletonThumb} />
      <View style={styles.rowSkeletonText}>
        <Skeleton style={{ height: 16, width: '62%', borderRadius: 5 }} />
        <Skeleton style={{ height: 13, width: '38%', borderRadius: 5 }} />
      </View>
    </View>
  );
}

/**
 * The standard surface: white, a 22pt group radius, and the handoff's soft card
 * shadow.
 *
 * **The hairline border is gone.** The teal system paired a border with the shadow
 * because its shadow was too faint to hold an edge against its canvas. The handoff's
 * shadow is wider and darker and does hold, and a border on top of it draws a
 * visible ring around every card - which on a grouped iOS screen reads as a web
 * component that wandered in.
 */
export function Card({
  title,
  children,
  style,
}: {
  /** Optional section heading, rendered with the app's one section treatment. */
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title !== undefined ? <SectionLabel>{title}</SectionLabel> : null}
      {children}
    </View>
  );
}

/**
 * A white grouped list, hairline-separated, with the separator inset past the
 * leading edge - the iOS grouped-table shape the handoff uses for departments, for
 * "also in cardiology", and for every settings-like list in the app.
 *
 * It takes rows rather than children so the separators can go BETWEEN them: a
 * trailing hairline under the last row is the single most common way a grouped list
 * gives itself away as hand-rolled.
 */
export function ListGroup({
  children,
  /** How far the separator is inset from the left, past an avatar or an icon. */
  inset = theme.gutter,
  style,
}: {
  children: React.ReactNode;
  inset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  /*
    `Children.toArray`, not `Array.isArray(children)`.

    A caller that writes `{items.map(...)}` next to a conditional `<Row/>` hands this
    a NESTED array - and the naive check treats that whole inner array as one row, so
    a five-item list draws one hairline and the group collapses. toArray flattens
    fragments and nested arrays, drops null and false, and assigns stable keys, which
    is exactly the job.
  */
  const rows = Children.toArray(children);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, i) => (
        <View key={(row as { key?: string | null }).key ?? i}>
          {i > 0 ? <Hairline style={{ marginLeft: inset }} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

/**
 * A label and its value on one line - the shape of every detail list in the app, and
 * of the two rows in the handoff's confirmation sheet.
 *
 * `emphasis` is what the flat version was missing: "Fee" and "Seen by" were the same
 * size and weight, so the number a patient actually opened the app for sat in a
 * column of things they did not.
 */
export function KeyValue({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, emphasis && styles.kvValueStrong]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * A two-or-three-way switch between views of the same list.
 *
 * A recessed track with a raised white thumb - iOS's segmented control, and the same
 * `fill-subtle` well the handoff's search field uses.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && styles.segmentItemOn]}
            android_ripple={{ color: theme.color.fillSecondary, borderless: false }}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },

  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.separator },

  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.group,
    padding: theme.space[5],
    gap: theme.space[3],
    ...theme.elevation.card,
  },

  group: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.group,
    overflow: 'hidden',
    ...theme.elevation.sm,
  },

  kv: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.space[4],
  },
  kvLabel: { ...theme.font.body, color: theme.color.inkTertiary, flexShrink: 1 },
  kvValue: {
    ...theme.font.body,
    color: theme.color.ink,
    fontFamily: theme.fontFamily.medium,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  kvValueStrong: {
    ...theme.font.h3,
    color: theme.color.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  segment: {
    flexDirection: 'row',
    gap: theme.space[1],
    padding: 3,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.fillSubtle,
  },
  segmentItem: {
    flex: 1,
    // 44 is the floor in docs/Design.md 8; the track's own padding takes it past it.
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  segmentItemOn: { backgroundColor: theme.color.surface, ...theme.elevation.sm },
  segmentText: { ...theme.font.label, color: theme.color.inkTertiary },
  segmentTextOn: {
    color: theme.color.ink,
    fontFamily: theme.fontFamily.semibold,
    fontWeight: '600',
  },

  avatar: {
    backgroundColor: theme.color.fillAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.color.inkSecondary,
    fontFamily: theme.fontFamily.semibold,
    fontWeight: '600',
    // Two capitals alone in a circle read as one glyph without this.
    letterSpacing: 0.3,
  },

  field: { gap: theme.space[2] },
  fieldLabel: { ...theme.font.overline, color: theme.color.inkTertiary, textTransform: 'uppercase' },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 50,
    borderRadius: theme.radius.control,
    // A recessed well, not a bordered box - the handoff's search field, at form size.
    backgroundColor: theme.color.fillSubtle,
    paddingHorizontal: theme.space[4],
  },
  /**
   * **Colour only.** No width, no elevation, no background swap that changes
   * geometry, and above all no border appearing.
   *
   * Both fancier versions of this broke the auth screens on a real phone. An
   * `elevation` made Android rebuild the shadow layer under a focused TextInput,
   * which drops focus, which fires `onBlur`, which removes the elevation, which
   * rebuilds again - the keyboard opened and shut and every field looked like it had
   * a caret in it. Even a `borderWidth: 0 -> 1` is suspect, because these screens
   * centre their content in a ScrollView: the keyboard resizes the window, the
   * content re-centres, and a field that also changes height re-centres twice.
   */
  inputShellFocused: { backgroundColor: theme.color.fillSecondary },
  /**
   * Deliberately NOT `...theme.font.*`.
   *
   * Every font token carries a `lineHeight`, and `lineHeight` on an Android
   * TextInput is documented as unreliable - it clips glyphs and offsets the caret
   * from the box you can see.
   *
   * `alignSelf: 'stretch'` with `paddingVertical: 0` is the tap-target fix: in a row
   * with `alignItems: 'center'` the input is only as tall as its text, so the live
   * strip was about 19px inside a box that LOOKS tappable for its full height.
   */
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontSize: 16,
    letterSpacing: -0.3,
    fontFamily: theme.fontFamily.regular,
    color: theme.color.ink,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  helper: { ...theme.font.caption, color: theme.color.inkTertiary },

  button: {
    // 52, the handoff's primary action height, comfortably past the 44x44 minimum.
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
  },
  buttonText: {
    ...theme.font.label,
    fontSize: 16,
    letterSpacing: -0.2,
  },

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space[2],
    backgroundColor: theme.color.danger.bg,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
  },
  errorText: { ...theme.font.caption, color: theme.color.danger.fg, flex: 1 },

  section: {
    ...theme.font.overline,
    color: theme.color.inkTertiary,
    textTransform: 'uppercase',
  },

  photo: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Neutral, and never a hole: the initials sit on it until the photo lands.
    backgroundColor: theme.color.fillPhoto,
  },
  photoInitials: {
    color: theme.color.inkSecondary,
    fontFamily: theme.fontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  skeleton: { backgroundColor: theme.color.fillSecondary, borderRadius: theme.radius.sm },
  rowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  rowSkeletonThumb: { width: 52, height: 52, borderRadius: theme.radius.lg },
  rowSkeletonText: { flex: 1, gap: theme.space[2] },
});
