import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { TaskWithState } from '../logic/tasks';
import type { TaskKind } from '../logic/types';
import { useStore } from '../state/AppStore';
import { Bouncy } from './bubble';
import { colors, type IconName } from './components';
import { dueLabel } from './TaskRow';
import { theme } from './theme';

/** The trip checklist tasks that show as stamps, in order. Anything else stays a normal task row. */
export const STAMP_KINDS: Partial<Record<TaskKind, { icon: IconName; label: string; after: boolean }>> = {
  confirm_license: { icon: 'id-card-outline', label: 'License', after: false },
  checkin_photos: { icon: 'camera-outline', label: 'Photos', after: false },
  checkin_dash_photo: { icon: 'speedometer-outline', label: 'Dash', after: false },
  checkout_photos: { icon: 'camera-outline', label: 'Out photos', after: true },
  checkout_dash_photo: { icon: 'speedometer-outline', label: 'Return dash', after: true },
};

const SIZE = 44;

function Stamp({ t, isNext }: { t: TaskWithState; isNext: boolean }) {
  const { completeTask } = useStore();
  const meta = STAMP_KINDS[t.kind]!;
  const done = !!t.doneAt;
  const overdue = !done && t.status === 'overdue';

  const circle = done
    ? { backgroundColor: theme.accent, borderWidth: 0 }
    : overdue
      ? { backgroundColor: colors.dangerBg, borderWidth: 3, borderColor: colors.danger }
      : isNext
        ? { backgroundColor: colors.card, borderWidth: 3, borderColor: theme.accent }
        : { backgroundColor: colors.neutralBg, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' as const };
  const iconColor = done ? theme.primaryDark : overdue ? colors.danger : isNext ? colors.primary : colors.muted;
  const labelColor = done ? colors.text : overdue ? colors.danger : isNext ? colors.primary : colors.muted;

  return (
    <Bouncy
      onPress={() => completeTask(t.id, !done)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${t.title}, ${dueLabel(t, new Date())}`}
      hitSlop={4}
      style={{ width: 58, alignItems: 'center', gap: 5 }}
    >
      <View
        style={[
          { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
          circle,
          isNext && !done && !overdue ? { shadowColor: theme.accent, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : null,
        ]}
      >
        <Ionicons name={done ? 'checkmark' : meta.icon} size={done ? 24 : 21} color={iconColor} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: labelColor, textAlign: 'center', lineHeight: 13 }} numberOfLines={2}>
        {meta.label}
      </Text>
    </Bouncy>
  );
}

/**
 * Trip checklist as stamps on the ticket stub: gold check = done, gold ring = do next,
 * red ring = overdue, dashed = later. Tap a stamp to mark it done (tap again to undo).
 */
export function ChecklistStamps({ tasks, now }: { tasks: TaskWithState[]; now: Date }) {
  const sorted = [...tasks].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const before = sorted.filter((t) => !STAMP_KINDS[t.kind]!.after);
  const after = sorted.filter((t) => STAMP_KINDS[t.kind]!.after);
  const next = sorted.find((t) => !t.doneAt);
  const doneCount = sorted.filter((t) => t.doneAt).length;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>
          CHECKLIST · {doneCount} OF {sorted.length}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Tap a stamp</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {before.map((t) => (
          <Stamp key={t.id} t={t} isNext={t.id === next?.id} />
        ))}
        {before.length && after.length ? <View style={{ width: 1, height: SIZE, backgroundColor: colors.border }} /> : null}
        {after.map((t) => (
          <Stamp key={t.id} t={t} isNext={t.id === next?.id} />
        ))}
      </View>
      {before.length && after.length ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>BEFORE PICKUP</Text>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>AFTER RETURN</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 13, color: next ? colors.text : colors.locked, fontWeight: '600' }}>
        {next ? `Next: ${next.title} · ${dueLabel(next, now)}` : 'All done ✓'}
      </Text>
    </View>
  );
}

