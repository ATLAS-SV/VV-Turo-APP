import { Text } from 'react-native';
import { formatMinutes, minutesInRange, openShift, shiftMinutes, startOfWeek } from '../../logic/hours';
import { can } from '../../logic/permissions';
import { useNow, useStore } from '../../state/AppStore';
import { Button, Card, colors, fmtClock, fmtTime, KeyValue, Muted, Screen, SectionTitle } from '../../ui/components';

/** Clock in/out. Executives see everyone's hours; employees see only their own. */
export default function HoursScreen() {
  const { currentUser, shifts, users, toggleClock } = useStore();
  const now = useNow(15_000);
  if (!currentUser) return null;
  const open = openShift(shifts, currentUser.id);
  const weekStart = startOfWeek(now);
  const seeAll = can(currentUser, 'viewAllHours');
  const visibleShifts = shifts.filter((s) => seeAll || s.userId === currentUser.id).slice(0, 30);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Former team member';

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Muted>{currentUser.name}</Muted>
        <Text style={{ fontSize: 34, fontWeight: '800', color: open ? colors.locked : colors.text }}>
          {open ? formatMinutes(shiftMinutes(open, now)) : 'Off the clock'}
        </Text>
        {open ? <Muted>Clocked in at {fmtClock(open.clockIn)}</Muted> : null}
        <Button
          style={{ alignSelf: 'stretch', marginTop: 8 }}
          variant={open ? 'danger' : 'primary'}
          icon={open ? 'stop-circle' : 'play-circle'}
          label={open ? 'Clock out' : 'Clock in'}
          onPress={toggleClock}
        />
      </Card>

      <SectionTitle>This week (since Monday)</SectionTitle>
      <Card>
        {(seeAll ? users : [currentUser]).map((u) => (
          <KeyValue key={u.id} k={u.name} v={formatMinutes(minutesInRange(shifts.filter((s) => s.userId === u.id), weekStart, now, now))} />
        ))}
      </Card>

      <SectionTitle>Recent shifts</SectionTitle>
      {visibleShifts.length ? (
        <Card>
          {visibleShifts.map((s) => (
            <KeyValue
              key={s.id}
              k={`${seeAll ? `${nameOf(s.userId)} · ` : ''}${fmtTime(s.clockIn)}`}
              v={s.clockOut ? formatMinutes(shiftMinutes(s, now)) : 'In progress'}
            />
          ))}
        </Card>
      ) : (
        <Muted>No shifts yet.</Muted>
      )}
    </Screen>
  );
}
