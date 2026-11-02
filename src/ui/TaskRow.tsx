import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View, type HostInstance } from 'react-native';
import type { TaskWithState } from '../logic/tasks';
import { carName, useStore } from '../state/AppStore';
import { PopAway } from './bubble';
import { colors, fmtAgo, fmtTime } from './components';
import { useExpand } from './expandContext';

export function dueLabel(t: TaskWithState, now: Date) {
  if (t.doneAt) return `Done ${fmtAgo(t.doneAt, now)}${t.doneBy ? ` by ${t.doneBy}` : ''}`;
  const mins = Math.round((Date.parse(t.dueAt) - now.getTime()) / 60_000);
  if (mins < 0) return `Overdue · was due ${fmtTime(t.dueAt)}`;
  if (mins < 60) return `Due in ${mins} min`;
  return `Due ${fmtTime(t.dueAt)}`;
}

/**
 * Checkbox + task. Tapping the text opens the booking (Executives); tapping the box marks it done.
 * With `vanish` (lists where a finished task moves elsewhere, like the Tasks page) the row swells,
 * shows the tick, then shrinks away before it's marked done.
 */
export function TaskRow({ t, now, vanish = false }: { t: TaskWithState; now: Date; vanish?: boolean }) {
  // Popping away from this done-state; once the change lands (doneAt differs) the row is back to normal.
  const [leavingFrom, setLeavingFrom] = useState<string | null | undefined>(undefined);
  const leaving = leavingFrom !== undefined && leavingFrom === (t.doneAt ?? null);
  const { completeTask, bookings, cars, currentUser } = useStore();
  const rowRef = useRef<HostInstance>(null);
  const expand = useExpand();
  const isExec = currentUser?.role === 'executive';
  const b = t.bookingId ? bookings.find((x) => x.id === t.bookingId) : undefined;
  // While popping away, show the box already flipped.
  const done = !!t.doneAt !== leaving;
  const tone = done ? colors.muted : t.status === 'overdue' ? colors.danger : t.status === 'due_soon' ? colors.unlocked : colors.muted;
  const sub = [isExec && b ? b.guestFirstName : null, t.carId ? carName(cars.find((c) => c.id === t.carId)) : null].filter(Boolean).join(' · ');
  const openTo = isExec && b ? `/booking/${b.id}` : null;

  const toggle = () => {
    if (leaving) return;
    if (vanish) setLeavingFrom(t.doneAt ?? null);
    else completeTask(t.id, !t.doneAt);
  };

  return (
    <PopAway leaving={leaving} onGone={() => completeTask(t.id, !t.doneAt)}>
      <View ref={rowRef} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
        <Pressable
          onPress={toggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${t.title}${sub ? `, ${sub}` : ''}`}
          hitSlop={10}
          style={{ paddingTop: 1 }}
        >
          <Ionicons name={done ? 'checkbox' : 'square-outline'} size={24} color={done ? colors.locked : colors.primary} />
        </Pressable>
        <Pressable
          style={{ flex: 1 }}
          disabled={!openTo}
          onPress={() => openTo && expand(rowRef.current, () => router.push(openTo as `/booking/${string}`), { radius: 8 })}
        >
          <Text style={{ fontSize: 15, color: done ? colors.muted : colors.text, textDecorationLine: done ? 'line-through' : 'none', fontWeight: '500' }}>
            {t.title}
          </Text>
          {sub ? <Text style={{ fontSize: 13, color: colors.muted }}>{sub}</Text> : null}
          {t.detail && !done ? <Text style={{ fontSize: 13, color: colors.muted }}>{t.detail}</Text> : null}
          <Text style={{ fontSize: 12, color: tone, fontWeight: t.status === 'overdue' && !done ? '700' : '400' }}>{dueLabel(t, now)}</Text>
        </Pressable>
      </View>
    </PopAway>
  );
}
