import { useState } from 'react';
import { Switch, Text, TextInput } from 'react-native';
import { defaultHomePage, type HomePage, type Role, type User } from '../logic/types';
import { carName, useStore } from '../state/AppStore';
import { Button, Card, Chip, colors, Muted, Row, Screen, SectionTitle, Title } from '../ui/components';

const HOME_PAGES: { key: HomePage; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cars', label: 'Cars' },
  { key: 'map', label: 'Map' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'money', label: 'Money' },
  { key: 'hours', label: 'Hours' },
];

/** Executives add/remove people and set their personal PINs. */
export default function TeamScreen() {
  const { users, currentUser, settings } = useStore();
  return (
    <Screen>
      <Muted>Everyone gets their own PIN, so hours and unlocks are tied to a person. PINs must be unique. Each PIN opens the app to that person’s page.</Muted>
      {users.map((u) => (
        <PersonCard key={u.id} user={u} isMe={u.id === currentUser?.id} showCars={settings.employeeUnlockScope === 'assigned'} />
      ))}
      <SectionTitle>Add a person</SectionTitle>
      <AddPerson />
    </Screen>
  );
}

function PersonCard({ user, isMe, showCars }: { user: User; isMe: boolean; showCars: boolean }) {
  const { changePin, removeUser, cars, setAssignedCars, setHomePage } = useStore();
  const [newPin, setNewPin] = useState('');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>
          {user.name}
          {isMe ? ' (you)' : ''}
        </Title>
        <Chip label={user.role === 'executive' ? 'Executive' : 'Employee'} tone={user.role === 'executive' ? 'info' : 'neutral'} />
      </Row>
      <Muted>Their PIN opens to</Muted>
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
      {showCars && user.role === 'employee' ? (
        <>
          <Muted>Cars they can unlock</Muted>
          {cars.map((c) => (
            <Row key={c.id} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text }}>{carName(c)}</Text>
              <Switch
                value={user.assignedCarIds.includes(c.id)}
                onValueChange={(on) =>
                  setAssignedCars(user.id, on ? [...user.assignedCarIds, c.id] : user.assignedCarIds.filter((x) => x !== c.id))
                }
              />
            </Row>
          ))}
        </>
      ) : null}
      {editing ? (
        <>
          <TextInput
            value={newPin}
            onChangeText={(t) => setNewPin(t.replace(/\D/g, ''))}
            placeholder="New PIN (4 digits)"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={inputStyle()}
          />
          <Row>
            <Button style={{ flex: 1 }} variant="secondary" label="Cancel" onPress={() => { setEditing(false); setNewPin(''); setMsg(null); }} />
            <Button
              style={{ flex: 1 }}
              label="Save PIN"
              onPress={async () => {
                const r = await changePin(user.id, newPin);
                setMsg(r.ok ? 'PIN changed.' : r.error);
                if (r.ok) { setEditing(false); setNewPin(''); }
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
    </Card>
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
      <TextInput value={name} onChangeText={setName} placeholder="Name" style={inputStyle()} />
      <TextInput
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
        placeholder="Their PIN (4 digits)"
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
          setMsg(r.ok ? `${name} added. Give them their PIN in person.` : r.error);
          if (r.ok) { setName(''); setPin(''); setRole('employee'); }
        }}
      />
      {msg ? <Muted>{msg}</Muted> : null}
    </Card>
  );
}

const inputStyle = () => ({ backgroundColor: colors.bg, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border, color: colors.text });
