import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { distanceMeters, formatDistance, isInLot, polygonCenter } from '../../logic/geo';
import type { Car } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Bouncy, glassFx, isGlass, PopIn, radius } from '../../ui/bubble';
import CarMap from '../../ui/CarMap';
import { colors, fmtAgo, Muted } from '../../ui/components';
import { matchesQuery } from '../../ui/filters';
import { NoSwipeZone } from '../../ui/motion';
import { isLightLook, theme } from '../../ui/theme';

type Where = 'lot' | 'driving' | 'away';
const WHERE: { key: Where; label: string }[] = [
  { key: 'lot', label: 'In lot' },
  { key: 'driving', label: 'Driving' },
  { key: 'away', label: 'Parked away' },
];

/**
 * Map tab (layout 1A): the map with a floating "Find a car or plate" search and a Filter button on top,
 * cars as dots, and below it a checklist: tick a car to show or hide it, tap a row to zoom to it
 * (tap the selected row again to open the car). Built for a growing fleet: no sideways car slider.
 */
export default function MapScreen() {
  const { cars, telemetry, settings } = useStore();
  const now = useNow(30_000);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [show, setShow] = useState<Where[]>(['lot', 'driving', 'away']);
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const lot = polygonCenter(settings.homeLot.polygon);

  const whereOf = (c: Car): Where | null => {
    const t = telemetry[c.id];
    if (!t) return null;
    if (t.moving) return 'driving';
    return isInLot(t.position, settings.homeLot) ? 'lot' : 'away';
  };
  const statusText = (c: Car) => {
    const t = telemetry[c.id];
    const w = whereOf(c);
    if (!t || !w) return { text: 'No location yet', color: colors.muted };
    const lock = t.lockState === 'unlocked' ? 'Unlocked' : 'Locked';
    const dist = formatDistance(distanceMeters(t.position, lot));
    if (w === 'driving') return { text: `Driving · ${dist} out`, color: t.lockState === 'unlocked' ? colors.unlocked : colors.primary };
    if (w === 'lot') return { text: `In ${settings.homeLot.name} · ${lock}`, color: t.lockState === 'unlocked' ? colors.unlocked : colors.locked };
    return { text: `${dist} away · parked ${fmtAgo(t.parkedSince, now)} · ${lock}`, color: t.lockState === 'unlocked' ? colors.unlocked : colors.muted };
  };

  // The filter (status) and the search pick which cars are listed; the checkboxes hide listed cars from the map.
  const listed = cars.filter((c) => {
    const w = whereOf(c);
    if (w && !show.includes(w)) return false;
    if (unlockedOnly && telemetry[c.id]?.lockState !== 'unlocked') return false;
    return matchesQuery(query, c.plate, carName(c), c.make, c.model, c.year);
  });
  const visible = listed.filter((c) => !hidden.includes(c.id)).map((c) => c.id);
  const filterCount = (show.length < WHERE.length ? 1 : 0) + (unlockedOnly ? 1 : 0);

  const pick = (carId: string | null) => {
    setSelected(carId);
    scroller.current?.scrollTo({ y: 0, animated: true });
  };
  const toggleHidden = (carId: string) => {
    setHidden((h) => (h.includes(carId) ? h.filter((x) => x !== carId) : [...h, carId]));
    if (selected === carId) setSelected(null);
  };
  const showAll = () => {
    setHidden([]);
    setShow(['lot', 'driving', 'away']);
    setUnlockedOnly(false);
    setQuery('');
    setSelected(null);
    setFitNonce((n) => n + 1);
  };
  // Controls floating over the map stay solid enough to read against the map in every look.
  const overlay: ViewStyle = {
    backgroundColor: isGlass() ? (isLightLook() ? 'rgba(255,255,255,0.94)' : 'rgba(36,16,79,0.92)') : colors.card,
    ...(isGlass() ? glassFx() : {}),
  };
  const floatShadow: ViewStyle = { shadowColor: '#1E0E45', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {/* The map, with the search + Filter floating on top */}
        <View style={{ height: Math.max(320, Math.round(height * 0.46)) }}>
          <NoSwipeZone style={{ flex: 1 }}>
            <CarMap selectedCarId={selected} onSelectCar={(id) => setSelected((s) => (s === id ? null : id))} visibleCarIds={visible} fitNonce={fitNonce} />
          </NoSwipeZone>

          <NoSwipeZone style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: 999, borderWidth: isGlass() ? 1 : 0, borderColor: colors.border },
                  overlay,
                  floatShadow,
                ]}
              >
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Find a car or plate"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Find a car or plate"
                  autoCorrect={false}
                  autoCapitalize="characters"
                  style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0, outlineStyle: 'none' } as object}
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Bouncy
                onPress={() => setFilterOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Filter which cars show${filterCount ? `, ${filterCount} on` : ''}`}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary }, floatShadow]}
              >
                <Ionicons name="options" size={17} color={colors.primaryText} />
                <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '800' }}>Filter</Text>
                {filterCount ? (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primaryDark }}>{filterCount}</Text>
                  </View>
                ) : null}
              </Bouncy>
            </View>
          </NoSwipeZone>

          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1000, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 999 }, overlay, floatShadow]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                Showing {visible.length} of {cars.length}
              </Text>
            </View>
            <Bouncy
              onPress={() => {
                setSelected(null);
                setFitNonce((n) => n + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel="Fit all shown cars"
              style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, overlay, floatShadow]}
            >
              <Ionicons name="scan-outline" size={19} color={colors.primary} />
            </Bouncy>
          </View>
        </View>

        {/* The checklist */}
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.muted }}>
              ON THE MAP · {visible.length} OF {cars.length}
            </Text>
            {visible.length < cars.length ? (
              <Pressable onPress={showAll} accessibilityRole="button" hitSlop={8}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Show all</Text>
              </Pressable>
            ) : null}
          </View>

          {listed.length ? (
            <PopIn>
              <View style={[{ backgroundColor: colors.card, borderRadius: radius() + 2, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, glassFx()]}>
                {listed.map((c, i) => {
                  const shownOnMap = !hidden.includes(c.id);
                  const isSel = selected === c.id;
                  const st = statusText(c);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => (isSel ? router.push(`/car/${c.id}`) : shownOnMap ? pick(c.id) : toggleHidden(c.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.plate ? `Plate ${c.plate}, ` : ''}${carName(c)}. ${st.text}.${isSel ? ' Selected. Tap again to open the car.' : ''}`}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor: isSel ? getSelectedBg() : pressed ? colors.neutralBg : 'transparent',
                        borderTopWidth: i ? 1 : 0,
                        borderTopColor: colors.border,
                        opacity: shownOnMap ? 1 : 0.55,
                      })}
                    >
                      <Pressable
                        onPress={() => toggleHidden(c.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: shownOnMap }}
                        accessibilityLabel={`Show ${c.plate ?? carName(c)} on the map`}
                        hitSlop={8}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 7,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: shownOnMap ? colors.primary : 'transparent',
                          borderWidth: shownOnMap ? 0 : 2,
                          borderColor: colors.secondary,
                        }}
                      >
                        {shownOnMap ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
                      </Pressable>
                      <PlateBadge plate={c.plate} dim={!shownOnMap} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {c.plate ? `${c.make} ${c.model}` : carName(c)}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: shownOnMap ? st.color : colors.muted }} numberOfLines={1}>
                          {shownOnMap ? st.text : 'Hidden from map'}
                        </Text>
                      </View>
                      {isSel ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.accent }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primaryDark }}>OPEN</Text>
                          <Ionicons name="chevron-forward" size={12} color={theme.primaryDark} />
                        </View>
                      ) : shownOnMap ? (
                        <Pressable
                          onPress={() => pick(c.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Zoom to ${c.plate ?? carName(c)}`}
                          hitSlop={6}
                          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="locate" size={17} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </PopIn>
          ) : (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 20 }}>
              <Muted>No cars match.</Muted>
              <Pressable onPress={showAll} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Show all cars</Text>
              </Pressable>
            </View>
          )}
          <Muted style={{ fontSize: 12, textAlign: 'center' }}>Tick a car to show or hide it · tap a row to zoom to it, tap again to open it</Muted>
        </View>
      </ScrollView>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        show={show}
        setShow={setShow}
        unlockedOnly={unlockedOnly}
        setUnlockedOnly={setUnlockedOnly}
        counts={{
          lot: cars.filter((c) => whereOf(c) === 'lot').length,
          driving: cars.filter((c) => whereOf(c) === 'driving').length,
          away: cars.filter((c) => whereOf(c) === 'away').length,
          unlocked: cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked').length,
        }}
        onReset={showAll}
      />
    </View>
  );
}

const getSelectedBg = () => (isLightLook() && !isGlass() ? '#FBF7EA' : 'rgba(212,175,55,0.16)');

/** The plate in a small outlined box, like a real license plate. */
function PlateBadge({ plate, dim }: { plate?: string; dim?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1.5, borderColor: dim ? colors.muted : colors.text, minWidth: 74, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, color: dim ? colors.muted : colors.text }} numberOfLines={1}>
        {plate || 'NO PLATE'}
      </Text>
    </View>
  );
}

/** "Show on the map": which kinds of car to show (in lot / driving / parked away), and unlocked only. */
function FilterSheet({
  open,
  onClose,
  show,
  setShow,
  unlockedOnly,
  setUnlockedOnly,
  counts,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  show: Where[];
  setShow: (w: Where[]) => void;
  unlockedOnly: boolean;
  setUnlockedOnly: (v: boolean) => void;
  counts: Record<Where | 'unlocked', number>;
  onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toggle = (w: Where) => setShow(show.includes(w) ? show.filter((x) => x !== w) : [...show, w]);
  const sheetBg = isGlass() ? (isLightLook() ? 'rgba(248,245,255,0.97)' : 'rgba(36,16,79,0.97)') : colors.bg;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Close filters" style={{ flex: 1, backgroundColor: 'rgba(20,10,50,0.38)' }} />
      <View style={{ backgroundColor: sheetBg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: insets.bottom + 20, gap: 14 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.secondary, opacity: 0.6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Show on the map</Text>
          <Pressable onPress={onReset} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>Reset</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.muted }}>WHERE THEY ARE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WHERE.map((w) => (
            <ToggleChip key={w.key} label={`${w.label} · ${counts[w.key]}`} on={show.includes(w.key)} onPress={() => toggle(w.key)} />
          ))}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.muted }}>LOCKS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ToggleChip label={`Unlocked only · ${counts.unlocked}`} on={unlockedOnly} onPress={() => setUnlockedOnly(!unlockedOnly)} />
        </View>
        <Bouncy
          onPress={onClose}
          accessibilityRole="button"
          style={{ height: 50, borderRadius: isGlass() ? 999 : 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '800' }}>Done</Text>
        </Bouncy>
      </View>
    </Modal>
  );
}

function ToggleChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Bouncy
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: on ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: on ? colors.primary : colors.border,
      }}
    >
      {on ? <Ionicons name="checkmark" size={15} color={colors.primaryText} /> : null}
      <Text style={{ fontSize: 14, fontWeight: '700', color: on ? colors.primaryText : colors.text }}>{label}</Text>
    </Bouncy>
  );
}
