import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinutes, minutesInRange, openShift, shiftMinutes, startOfWeek } from '../logic/hours';
import { carAccessOf } from '../logic/permissions';
import { defaultHomePage, type Car, type HomePage, type Role, type Shift, type User } from '../logic/types';
import { useNow, useStore } from '../state/AppStore';
import { Bouncy, glassFx, PopIn, radius } from '../ui/bubble';
import { Button, Card, colors, fmtClock, Muted, Row, SectionTitle } from '../ui/components';
import { Engine } from '../ui/Engine';
import { LOGO } from '../ui/logoColors';
import { getAppearance } from '../ui/theme';

const HOME_PAGES: { key: HomePage; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cars', label: 'Cars' },
  { key: 'map', label: 'Map' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'money', label: 'Money' },
  { key: 'hours', label: 'Hours' },
];

/**
 * Team & hours (Executives, layout E4). The engine sums up the crew this week; each person's card
 * shows whether they're on the clock, their hours this week, and their cars as plate chips: tap a
 * plate to give or take away access to that car. Tap a card for their shifts, PIN and settings.
 */
export default function TeamScreen() {
  const { users, currentUser, shifts, cars, toggleClock } = useStore();
  const now = useNow(15_000);
  const insets = useSafeAreaInsets();
  const weekStart = startOfWeek(now);
  const weekOf = (u: User) => minutesInRange(shifts.filter((s) => s.userId === u.id), weekStart, now, now);
  const onClock = users.filter((u) => openShift(shifts, u.id));
  const crewWeek = users.reduce((sum, u) => sum + weekOf(u), 0);
  const maxWeek = Math.max(60, ...users.map(weekOf));
  // Employees first (on the clock first), executives after; you last.
  const people = [...users].sort(
    (a, b) =>
      Number(a.id === currentUser?.id) - Number(b.id === currentUser?.id) ||
      Number(a.role === 'executive') - Number(b.role === 'executive') ||
      Number(!!openShift(shifts, b.id)) - Number(!!openShift(shifts, a.id)) ||
      a.name.localeCompare(b.name),
  );
  const band = getAppearance() === 'light';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: insets.bottom + 24, gap: 12 }}>
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      <PopIn>
        <Engine>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: LOGO.gold }}>YOUR CREW · THIS WEEK</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', color: '#FFFFFF' }}>
              {onClock.length ? `${onClock.length} on the clock now` : 'Nobody on the clock'}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <EngineStat label="HOURS" value={formatMinutes(crewWeek)} />
            <EngineStat label="PEOPLE" value={String(users.length)} />
            <EngineStat label="ON NOW" value={onClock.length ? onClock.map((u) => u.name.split(' ')[0]).join(', ') : '—'} />
          </View>
        </Engine>
      </PopIn>

      <Muted style={{ fontSize: 12 }}>Tap a plate to give or take away access to that car. Tap a person for their shifts and PIN.</Muted>

      {people.map((u, i) => (
        <PopIn key={u.id} delay={Math.min(i + 1, 6) * 50}>
          <PersonCard
            user={u}
            isMe={u.id === currentUser?.id}
            cars={cars}
            shifts={shifts.filter((s) => s.userId === u.id)}
            week={weekOf(u)}
            maxWeek={maxWeek}
            now={now}
            onClockMe={toggleClock}
          />
        </PopIn>
      ))}

      <SectionTitle>Add a person</SectionTitle>
      <AddPerson />
    </ScrollView>
  );
}

function EngineStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#D9CCF7' }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PersonCard({
  user,
  isMe,
  cars,
  shifts,
  week,
  maxWeek,
  now,
  onClockMe,
}: {
  user: User;
  isMe: boolean;
  cars: Car[];
  shifts: Shift[];
  week: number;
  maxWeek: number;
  now: Date;
  onClockMe: () => void;
}) {
  const { settings, setCarAccess } = useStore();
  const [open, setOpen] = useState(false);
  const exec = user.role === 'executive';
  const live = openShift(shifts, user.id);
  const last = shifts.filter((s) => s.clockOut).sort((a, b) => Date.parse(b.clockIn) - Date.parse(a.clockIn))[0];
  const status = live ? `On the clock · ${formatMinutes(shiftMinutes(live, now))}` : last ? `Off · last shift ${dayName(last.clockIn, now)}` : 'Off · no shifts yet';
  const access = carAccessOf(user, settings);
  const picked = access === 'all' ? cars.map((c) => c.id) : user.assignedCarIds;
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const toggleCar = (carId: string) => {
    if (access === 'all') setCarAccess(user.id, 'picked', cars.map((c) => c.id).filter((id) => id !== carId));
    else setCarAccess(user.id, 'picked', picked.includes(carId) ? picked.filter((id) => id !== carId) : [...picked, carId]);
  };
  const toggleAll = () => (access === 'all' ? setCarAccess(user.id, 'picked', picked) : setCarAccess(user.id, 'all', user.assignedCarIds));

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius() + 4, padding: 14, gap: 10, borderWidth: 1, borderColor: live ? '#9BD8B2' : colors.border }, glassFx()]}>
      <Bouncy onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={`${user.name}. ${status}. ${formatMinutes(week)} this week.`} accessibilityState={{ expanded: open }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: live ? colors.primary : colors.neutralBg,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: live ? LOGO.gold : colors.primary }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>
              {user.name}
              {isMe ? ' (you)' : ''}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: live ? colors.locked : colors.muted }} numberOfLines={1}>
              {status}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{formatMinutes(week)}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>this week</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </View>
      </Bouncy>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.neutralBg, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.secondary, width: `${Math.round((week / maxWeek) * 100)}%` }} />
      </View>

      {exec ? (
        <Text style={{ fontSize: 12, color: colors.muted }}>Executive · can unlock every car</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <PlateChip label="All cars" on={access === 'all'} onPress={toggleAll} a11y={access === 'all' ? `Limit ${user.name} to picked cars` : `Let ${user.name} unlock all cars`} />
          {cars.map((c) => {
            const on = picked.includes(c.id);
            const label = c.plate?.trim() || `${c.make} ${c.model}`;
            return (
              <PlateChip key={c.id} label={label} on={on} onPress={() => toggleCar(c.id)} a11y={`${on ? 'Take away' : 'Give'} ${user.name} access to ${label}`} />
            );
          })}
        </View>
      )}

      {isMe ? (
        <Button variant={live ? 'danger' : 'secondary'} icon={live ? 'stop-circle' : 'play-circle'} label={live ? 'Clock out' : 'Clock in'} onPress={onClockMe} />
      ) : null}

      {open ? <PersonDetails user={user} isMe={isMe} shifts={shifts} now={now} /> : null}
    </View>
  );
}

function PlateChip({ label, on, onPress, a11y }: { label: string; on: boolean; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={a11y}
      hitSlop={4}
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: 10,
        borderRadius: 10,
        justifyContent: 'center',
        borderWidth: 1.5,
        borderStyle: on ? 'solid' : 'dashed',
        borderColor: on ? colors.primary : colors.border,
        backgroundColor: on ? colors.primary : 'transparent',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: on ? colors.primaryText : colors.muted, textDecorationLine: on ? 'none' : 'line-through' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Opened card: recent shifts, which page their PIN opens to, Change PIN and Remove. */
function PersonDetails({ user, isMe, shifts, now }: { user: User; isMe: boolean; shifts: Shift[]; now: Date }) {
  const { changePin, removeUser, setHomePage } = useStore();
  const [newPin, setNewPin] = useState('');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const recent = [...shifts].sort((a, b) => Date.parse(b.clockIn) - Date.parse(a.clockIn)).slice(0, 6);

  return (
    <View style={{ gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.muted, marginTop: 6 }}>RECENT SHIFTS</Text>
      {recent.length ? (
        recent.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{dayName(s.clockIn, now)}</Text>
              <Text style={{ fontSize: 12, color: s.clockOut ? colors.muted : colors.locked, fontWeight: s.clockOut ? '400' : '700' }}>
                {fmtClock(s.clockIn)} → {s.clockOut ? fmtClock(s.clockOut) : 'still on'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{formatMinutes(shiftMinutes(s, now))}</Text>
          </Row>
        ))
      ) : (
        <Muted>No shifts yet.</Muted>
      )}

      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.muted, marginTop: 4 }}>THEIR PIN OPENS TO</Text>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {HOME_PAGES.filter((p) => p.key !== 'money' || user.role === 'executive').map((p) => (
          <Button
            key={p.key}
            label={p.label}
            variant={(user.homePage ?? defaultHomePage(user.role)) === p.key ? 'primary' : 'secondary'}
            onPress={() => setHomePage(user.id, p.key)}
            style={{ paddingVertical: 6, paddingHorizontal: 12, minHeight: 34 }}
          />
        ))}
      </Row>

      {editing ? (
        <>
          <TextInput
            value={newPin}
            onChangeText={(t) => setNewPin(t.replace(/\D/g, ''))}
            placeholder="New PIN (4 digits)"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={inputStyle()}
          />
          <Row>
            <Button
              style={{ flex: 1 }}
              variant="secondary"
              label="Cancel"
              onPress={() => {
                setEditing(false);
                setNewPin('');
                setMsg(null);
              }}
            />
            <Button
              style={{ flex: 1 }}
              label="Save PIN"
              onPress={async () => {
                const r = await changePin(user.id, newPin);
                setMsg(r.ok ? 'PIN changed.' : r.error);
                if (r.ok) {
                  setEditing(false);
                  setNewPin('');
                }
              }}
            />
          </Row>
        </>
      ) : (
        <Row>
          <Button style={{ flex: 1 }} variant="secondary" icon="key" label="Change PIN" onPress={() => setEditing(true)} />
          {!isMe ? (
            <Button
              style={{ flex: 1 }}
              variant="danger"
              icon="trash"
              label="Remove"
              onPress={() => {
                const r = removeUser(user.id);
                if (!r.ok) setMsg(r.error);
              }}
            />
          ) : null}
        </Row>
      )}
      {msg ? <Muted>{msg}</Muted> : null}
    </View>
  );
}

function AddPerson() {
  const { addUser } = useStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.muted} style={inputStyle()} />
      <TextInput
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
        placeholder="Their PIN (4 digits)"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        style={inputStyle()}
      />
      <Row>
        <Button style={{ flex: 1 }} label="Employee" variant={role === 'employee' ? 'primary' : 'secondary'} onPress={() => setRole('employee')} />
        <Button style={{ flex: 1 }} label="Executive" variant={role === 'executive' ? 'primary' : 'secondary'} onPress={() => setRole('executive')} />
      </Row>
      <Button
        icon="person-add"
        label="Add person"
        onPress={async () => {
          const r = await addUser(name, role, pin);
          setMsg(r.ok ? `${name} added. Give them their PIN in person, then tap their plates to pick their cars.` : r.error);
          if (r.ok) {
            setName('');
            setPin('');
            setRole('employee');
          }
        }}
      />
      {msg ? <Muted>{msg}</Muted> : null}
      <Muted style={{ fontSize: 12 }}>Everyone gets their own PIN, so hours and unlocks are tied to a person. PINs must be unique.</Muted>
    </Card>
  );
}

/** "Today", "Yesterday", or the weekday and date. */
function dayName(iso: string, now: Date) {
  const d = new Date(iso);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const inputStyle = () => ({ backgroundColor: colors.bg, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border, color: colors.text });
