import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ActivityAction } from '../logic/types';
import { ACTION_LABELS, actorLabel, carName, useStore } from '../state/AppStore';
import { Button, Card, colors, fmtTime, type IconName, Muted, Row, Screen } from '../ui/components';

const ICONS: Record<ActivityAction, IconName> = {
  lock: 'lock-closed',
  unlock: 'lock-open',
  auto_lock: 'shield-checkmark',
  guest_unlock: 'person',
  guest_relock: 'timer',
  guest_failed: 'alert-circle',
  trip_started: 'navigate',
  link_sent: 'paper-plane',
  late_return: 'warning',
  clock_in: 'play-circle',
  clock_out: 'stop-circle',
  pin_lockout: 'key',
  settings_changed: 'options',
  team_changed: 'people',
  booking_received: 'calendar',
  booking_canceled: 'close-circle',
  guest_message: 'chatbubble',
  task_done: 'checkbox',
  task_reminder: 'alarm',
  task_overdue: 'alarm',
};

const FILTERS: { key: string; label: string; match: (a: ActivityAction) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'locks', label: 'Locks', match: (a) => ['lock', 'unlock', 'auto_lock', 'guest_unlock', 'guest_relock'].includes(a) },
  { key: 'alerts', label: 'Alerts', match: (a) => ['guest_failed', 'late_return', 'pin_lockout', 'task_overdue', 'task_reminder'].includes(a) },
  { key: 'hours', label: 'Hours', match: (a) => a === 'clock_in' || a === 'clock_out' },
];

export default function ActivityLog() {
  const { activity, cars } = useStore();
  const [filter, setFilter] = useState('all');
  const f = FILTERS.find((x) => x.key === filter)!;
  const list = activity.filter((e) => f.match(e.action)).slice(0, 300);

  return (
    <Screen>
      <Row style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((x) => (
          <Button key={x.key} label={x.label} variant={filter === x.key ? 'primary' : 'secondary'} onPress={() => setFilter(x.key)} style={{ paddingVertical: 6, minHeight: 34 }} />
        ))}
      </Row>
      {list.length ? (
        list.map((e) => (
          <Card key={e.id}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Ionicons name={ICONS[e.action]} size={20} color={e.notify ? colors.unlocked : colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '600', color: colors.text, fontSize: 15 }}>
                  {ACTION_LABELS[e.action]}
                  {e.carId ? ` · ${carName(cars.find((c) => c.id === e.carId))}` : ''}
                </Text>
                <Muted>{actorLabel(e.actor, e.action)} · {fmtTime(e.at)}</Muted>
                {e.detail ? <Muted>{e.detail}</Muted> : null}
              </View>
            </Row>
          </Card>
        ))
      ) : (
        <Muted>Nothing logged yet.</Muted>
      )}
    </Screen>
  );
}
