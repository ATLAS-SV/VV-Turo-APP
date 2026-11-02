import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TaskWithState } from '../logic/tasks';
import { carName, useNow, useStore, useTasks } from '../state/AppStore';
import { isGlass, PopIn, prefersReducedMotion } from '../ui/bubble';
import { Card, colors, Muted } from '../ui/components';
import { Engine } from '../ui/Engine';
import { FilterChips, matchesQuery, NoMatches, SearchBar } from '../ui/filters';
import { LOGO } from '../ui/logoColors';
import { shortDue, taskSubtitle, TaskRow } from '../ui/TaskRow';
import { getAppearance, isLightLook } from '../ui/theme';

type Show = 'all' | 'Overdue' | 'Due soon' | 'Upcoming' | 'Done (last 7 days)';

/**
 * Everything that needs doing (layout C1): the engine up top shows today's progress and carries the
 * single most urgent task (Up next) with Mark done; below it, search, filters and the rest of the
 * tasks grouped by Overdue / Due soon / Upcoming / Done.
 */
export default function TasksScreen() {
  const allTasks = useTasks();
  const { cars, bookings, currentUser, completeTask } = useStore();
  const now = useNow(30_000);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');
  const isExec = currentUser?.role === 'executive';

  const open = allTasks.filter((t) => !t.doneAt);
  const overdue = open.filter((t) => t.status === 'overdue').length;
  // Tasks come sorted by due time, so the first open one is the most urgent (overdue ones are earliest).
  const next = open[0];
  // Today's progress: tasks due today (plus anything still overdue), and how many of those are done.
  const today = allTasks.filter((t) => new Date(t.dueAt).toDateString() === now.toDateString() || t.status === 'overdue');
  const todayDone = today.filter((t) => t.doneAt).length;
  const todayLeft = today.length - todayDone;

  // Search by task, car or guest. Lists get long as the fleet grows (every booking adds a checklist).
  const tasks = allTasks.filter((t) =>
      matchesQuery(query, t.title, t.detail, t.carId ? carName(cars.find((c) => c.id === t.carId)) : null, bookings.find((b) => b.id === t.bookingId)?.guestFirstName),
    );
  const allGroups: { title: Show; list: TaskWithState[] }[] = [
    { title: 'Overdue', list: tasks.filter((t) => t.status === 'overdue') },
    { title: 'Due soon', list: tasks.filter((t) => t.status === 'due_soon') },
    { title: 'Upcoming', list: tasks.filter((t) => t.status === 'upcoming') },
    {
      title: 'Done (last 7 days)',
      list: tasks.filter((t) => t.doneAt && now.getTime() - Date.parse(t.doneAt) < 7 * 24 * 3600_000).reverse(),
    },
  ];
  // Up next is already in the engine, so the full list skips it (it still counts, and shows when filtered or searched).
  const hideNext = (list: TaskWithState[]) => (show === 'all' && !query ? list.filter((t) => t.id !== next?.id) : list);
  const groups = allGroups.filter((g) => show === 'all' || g.title === show).map((g) => ({ ...g, list: hideNext(g.list) }));
  const band = getAppearance() === 'light';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: insets.bottom + 24, gap: 12 }}>
      {/* Purple band behind the engine (Light only), like the Cars tab. */}
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      <PopIn>
        <Engine>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: LOGO.gold }}>TODAY</Text>
              <Text style={{ fontSize: 21, fontWeight: '800', color: '#FFFFFF' }}>
                {todayLeft ? `${todayLeft} to do${overdue ? ` · ${overdue} overdue` : ''}` : open.length ? 'Done for today' : 'All caught up'}
              </Text>
            </View>
            {today.length ? (
              <Text style={{ fontSize: 13, fontWeight: '800', color: LOGO.gold }}>
                {todayDone} of {today.length} done
              </Text>
            ) : null}
          </View>
          {today.length ? <ProgressBar value={todayDone / today.length} /> : null}
          {next ? (
            <UpNext
              key={next.id}
              t={next}
              now={now}
              sub={taskSubtitle(next, bookings, cars, isExec)}
              onDone={() => completeTask(next.id, true)}
              onOpen={isExec && next.bookingId ? () => router.push(`/booking/${next.bookingId}`) : null}
            />
          ) : (
            <Text style={{ fontSize: 13, color: '#E6DCFA' }}>Nothing to do right now.</Text>
          )}
        </Engine>
      </PopIn>

      <SearchBar value={query} onChange={setQuery} placeholder="Search tasks, cars or guests" />
      <FilterChips
        options={[
          { key: 'all' as const, label: 'All' },
          ...allGroups.map((g) => ({ key: g.title, label: g.title.replace(' (last 7 days)', ''), count: g.list.length, tone: g.title === 'Overdue' ? ('warn' as const) : undefined })),
        ]}
        value={show}
        onChange={setShow}
      />

      {groups.map((g) =>
        g.list.length ? (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: g.title === 'Overdue' ? colors.danger : colors.muted }}>
              {g.title.toUpperCase()} · {g.list.length}
            </Text>
            <Card style={{ gap: 0, paddingVertical: 2, ...(g.title === 'Overdue' ? { borderWidth: 1.5, borderColor: colors.danger } : {}) }}>
              {g.list.map((t, i) => (
                <TaskRow key={t.id} t={t} now={now} vanish divider={i < g.list.length - 1} />
              ))}
            </Card>
          </View>
        ) : null,
      )}
      {query && !groups.some((g) => g.list.length) ? (
        <NoMatches
          what="tasks"
          onClear={() => {
            setQuery('');
            setShow('all');
          }}
        />
      ) : null}
      <Muted style={{ fontSize: 12 }}>
        Every booking gets a checklist automatically: confirm license, check-in photos and dash photo before pickup; check-out photos and dash
        photo after return. Pending claims show up here too. You get a reminder before each task is due and an alert if it’s overdue.
      </Muted>
    </ScrollView>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: LOGO.gold }} />
    </View>
  );
}

/**
 * The most urgent task, inside the engine. Mark done slides it out to the left, then the task is marked
 * done and the next one pops in (it's keyed by task, so a fresh one mounts with PopIn).
 */
function UpNext({ t, now, sub, onDone, onOpen }: { t: TaskWithState; now: Date; sub: string; onDone: () => void; onOpen: (() => void) | null }) {
  const [v] = useState(() => new Animated.Value(0));
  const [leaving, setLeaving] = useState(false);
  const light = isLightLook();
  const late = t.status === 'overdue';
  const fg = light ? colors.text : '#FFFFFF';
  const muted = light ? colors.muted : '#D9CCF7';

  const done = () => {
    if (leaving) return;
    setLeaving(true);
    if (prefersReducedMotion()) return onDone();
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(() => onDone());
  };

  return (
    <PopIn>
      <Animated.View
        style={{
          backgroundColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
          borderRadius: isGlass() ? 18 : 14,
          padding: 12,
          gap: 10,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: light ? colors.primary : LOGO.gold }}>UP NEXT</Text>
          <View style={{ backgroundColor: late ? colors.danger : light ? colors.unlockedBg : 'rgba(255,255,255,0.16)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: late ? '#FFFFFF' : light ? colors.unlocked : '#FFFFFF' }}>{late ? 'Overdue' : shortDue(t, now)}</Text>
          </View>
        </View>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: fg }}>{t.title}</Text>
          <Text style={{ fontSize: 13, color: muted }}>
            {sub}
            {sub && late ? ' · ' : ''}
            {late ? shortDue(t, now) : ''}
          </Text>
          {t.detail ? <Text style={{ fontSize: 12, color: muted, marginTop: 2 }}>{t.detail}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={done}
            disabled={leaving}
            accessibilityRole="button"
            accessibilityLabel={`Mark done: ${t.title}`}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 12,
              backgroundColor: light ? colors.primary : LOGO.gold,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="checkmark" size={18} color={light ? '#FFFFFF' : LOGO.to} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: light ? '#FFFFFF' : LOGO.to }}>Mark done</Text>
          </Pressable>
          {onOpen ? (
            <Pressable
              onPress={onOpen}
              accessibilityRole="button"
              style={({ pressed }) => ({
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: light ? colors.primary : 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: light ? colors.primary : '#FFFFFF' }}>Open trip</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </PopIn>
  );
}
