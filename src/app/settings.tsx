import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { DEFAULT_SETTINGS } from '../data/seed';
import { DEFAULT_CHECK_IN_TEMPLATE } from '../logic/checkInMessage';
import type { Settings } from '../logic/types';
import { useStore } from '../state/AppStore';
import { Button, Card, colors, Muted, Row, Screen, SectionTitle } from '../ui/components';

type NumKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

/** Every rule here is adjustable; nothing is hard-coded. */
export default function SettingsScreen() {
  const { settings, updateSettings, resetDemoData } = useStore();

  const num = (key: NumKey, label: string, help: string, unit: string, min: number, max: number, step = 1) => (
    <Stepper
      label={label}
      help={help}
      unit={unit}
      value={settings[key]}
      min={min}
      max={max}
      step={step}
      onChange={(v) => updateSettings({ [key]: v } as Partial<Settings>, `${label}: ${v} ${unit}`)}
    />
  );

  return (
    <Screen>
      <SectionTitle>Auto-lock (home lot only)</SectionTitle>
      <Card>
        {num('autoLockParkedMinutes', 'Parked time before auto-lock', 'Car must be parked (engine off) and unlocked in the home lot this long. Never fires anywhere else.', 'min', 1, 120)}
      </Card>

      <SectionTitle>Guest check-in link</SectionTitle>
      <Card>
        {num('guestCountdownMinutes', 'Countdown after guest unlock', 'If the car doesn’t start moving in time, it relocks.', 'min', 1, 60)}
        {num('pickupWindowBeforeMinutes', 'Pickup window opens', 'Minutes before trip start.', 'min before', 0, 240, 5)}
        {num('pickupWindowAfterMinutes', 'Pickup window closes', 'Minutes after trip start.', 'min after', 15, 720, 15)}
        {num('guestUnlockRetries', '“Unlock again” retries', 'After these, the guest has to contact you.', 'retries', 0, 10)}
      </Card>

      <SectionTitle>Check-in message (sent in Turo)</SectionTitle>
      <MessageTemplateEditor />

      <SectionTitle>Tasks & reminders</SectionTitle>
      <Card>
        {num('licenseDueMinutesBefore', 'Confirm license by', 'Minutes before trip start.', 'min before', 0, 1440, 15)}
        {num('checkoutPhotosDueMinutesAfter', 'Check-out photos by', 'Minutes after trip end.', 'min after', 15, 1440, 15)}
        {num('taskReminderMinutes', 'Remind me', 'Minutes before a task is due. You also get an alert when it’s overdue.', 'min before', 5, 720, 5)}
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Phone notifications</Text>
            <Muted>Reminders arrive on this phone even when the app is closed.</Muted>
          </View>
          <Switch
            value={settings.taskPhoneNotifications}
            onValueChange={(v) => updateSettings({ taskPhoneNotifications: v }, `Task phone notifications ${v ? 'on' : 'off'}`)}
          />
        </Row>
      </Card>

      <SectionTitle>Alerts</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Late-return alert</Text>
            <Muted>Alert if a car isn’t back at the lot after trip end.</Muted>
          </View>
          <Switch
            value={settings.lateReturnAlertEnabled}
            onValueChange={(v) => updateSettings({ lateReturnAlertEnabled: v }, `Late-return alert ${v ? 'on' : 'off'}`)}
          />
        </Row>
        {settings.lateReturnAlertEnabled
          ? num('lateReturnAlertMinutes', 'Alert after', 'Minutes after trip end.', 'min', 15, 480, 15)
          : null}
      </Card>

      <SectionTitle>Employees & security</SectionTitle>
      <Card>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Employees can unlock</Text>
        <Row>
          <Button
            style={{ flex: 1 }}
            label="All cars"
            variant={settings.employeeUnlockScope === 'all' ? 'primary' : 'secondary'}
            onPress={() => updateSettings({ employeeUnlockScope: 'all' }, 'Employees can unlock all cars')}
          />
          <Button
            style={{ flex: 1 }}
            label="Assigned only"
            variant={settings.employeeUnlockScope === 'assigned' ? 'primary' : 'secondary'}
            onPress={() => updateSettings({ employeeUnlockScope: 'assigned' }, 'Employees can unlock assigned cars only')}
          />
        </Row>
        <Muted>Assign cars to each person under Team & PINs. Locking is always allowed.</Muted>
        {num('appRelockMinutes', 'Ask for PIN again after', 'Time the app can sit in the background.', 'min', 1, 60)}
      </Card>

      <SectionTitle>Home lot</SectionTitle>
      <HomeLotEditor />

      <SectionTitle>Pretend data</SectionTitle>
      <Card>
        <Button variant="secondary" label="Restore default settings" onPress={() => updateSettings({ ...DEFAULT_SETTINGS, homeLot: settings.homeLot, checkInMessageTemplate: settings.checkInMessageTemplate }, 'Restored default settings')} />
        <Button variant="danger" label="Reset pretend cars, bookings & activity" onPress={resetDemoData} />
      </Card>
    </Screen>
  );
}

function MessageTemplateEditor() {
  const { settings, updateSettings } = useStore();
  const [text, setText] = useState(settings.checkInMessageTemplate);
  const dirty = text !== settings.checkInMessageTemplate;
  return (
    <Card>
      <Muted>Fill-ins: {'{guest}'} {'{car}'} {'{link}'} {'{window}'} {'{countdown}'}</Muted>
      <TextInput value={text} onChangeText={setText} multiline style={[inputStyle(), { minHeight: 160, textAlignVertical: 'top' }]} />
      {!text.includes('{link}') ? <Muted style={{ color: colors.danger }}>The message needs {'{link}'} so the guest gets their link.</Muted> : null}
      <Row>
        <Button style={{ flex: 1 }} variant="secondary" label="Default" onPress={() => setText(DEFAULT_CHECK_IN_TEMPLATE)} />
        <Button style={{ flex: 1 }} label="Save" disabled={!dirty || !text.includes('{link}')} onPress={() => updateSettings({ checkInMessageTemplate: text }, 'Check-in message updated')} />
      </Row>
    </Card>
  );
}

function HomeLotEditor() {
  const { settings, updateSettings } = useStore();
  const [name, setName] = useState(settings.homeLot.name);
  const [address, setAddress] = useState(settings.homeLot.address);
  const dirty = name !== settings.homeLot.name || address !== settings.homeLot.address;
  return (
    <Card>
      <Muted>Name</Muted>
      <TextInput value={name} onChangeText={setName} style={inputStyle()} />
      <Muted>Address</Muted>
      <TextInput value={address} onChangeText={setAddress} style={inputStyle()} />
      <Muted>
        Boundary: {settings.homeLot.polygon.length}-point outline. The current outline is a placeholder near LAX; it will be
        redrawn around the real lot once the address is confirmed.
      </Muted>
      <Button
        label="Save"
        disabled={!dirty}
        onPress={() => updateSettings({ homeLot: { ...settings.homeLot, name: name.trim() || 'Home lot', address } }, `Home lot renamed to ${name}`)}
      />
    </Card>
  );
}

const inputStyle = () => ({ backgroundColor: colors.bg, borderRadius: 8, padding: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text });

function Stepper({ label, help, unit, value, min, max, step, onChange }: { label: string; help: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const btn = (icon: 'remove' | 'add', next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'add' ? 'Increase' : 'Decrease'} ${label}`}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ gap: 4, paddingVertical: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 }}>{label}</Text>
        {btn('remove', Math.max(min, value - step), value <= min)}
        <Text style={{ minWidth: 64, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>
          {value} <Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}>{unit}</Text>
        </Text>
        {btn('add', Math.min(max, value + step), value >= max)}
      </Row>
      <Muted>{help}</Muted>
    </View>
  );
}
