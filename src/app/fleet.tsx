import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { TextInput } from 'react-native';
import type { Car } from '../logic/types';
import { carName, useStore } from '../state/AppStore';
import { Button, Card, colors, Muted, Row, Screen, SectionTitle, Title } from '../ui/components';
import { matchesQuery, SearchBar } from '../ui/filters';

/** Add cars and fill in missing details (e.g. BMW and Rogue years). */
export default function FleetScreen() {
  const { cars, saveCar } = useStore();
  const [query, setQuery] = useState('');
  const found = cars.filter((c) => matchesQuery(query, carName(c), c.plate));
  return (
    <Screen>
      <SectionTitle>Add a car</SectionTitle>
      <CarEditor car={null} onSave={saveCar} />
      <SectionTitle>Your cars · {cars.length}</SectionTitle>
      {cars.length > 1 ? <SearchBar value={query} onChange={setQuery} placeholder="Search by make, model, year or plate" /> : null}
      {found.map((c) => (
        <CarEditor key={c.id} car={c} onSave={saveCar} />
      ))}
      {query && !found.length ? <Muted>No cars match “{query}”.</Muted> : null}
    </Screen>
  );
}

function CarEditor({ car, onSave }: { car: Car | null; onSave: (c: Car) => void }) {
  const [year, setYear] = useState(car?.year ? String(car.year) : '');
  const [make, setMake] = useState(car?.make ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [plate, setPlate] = useState(car?.plate ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const yearNum = year ? Number(year) : null;
  const yearOk = yearNum === null || (yearNum >= 1990 && yearNum <= 2030);
  const dirty = !car || year !== (car.year ? String(car.year) : '') || make !== car.make || model !== car.model || plate !== (car.plate ?? '');

  return (
    <Card>
      {car ? <Title>{carName(car)}</Title> : null}
      <Row>
        <TextInput value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="Year" keyboardType="number-pad" style={[inputStyle(), { width: 80 }]} />
        <TextInput value={make} onChangeText={setMake} placeholder="Make" style={[inputStyle(), { flex: 1 }]} />
        <TextInput value={model} onChangeText={setModel} placeholder="Model" style={[inputStyle(), { flex: 1 }]} />
      </Row>
      <TextInput value={plate} onChangeText={(t) => setPlate(t.toUpperCase().slice(0, 10))} placeholder="License plate (optional)" autoCapitalize="characters" style={inputStyle()} />
      {!yearOk ? <Muted>Year looks wrong.</Muted> : null}
      <Button
        label={car ? 'Save' : 'Add car'}
        variant={car ? 'secondary' : 'primary'}
        disabled={!dirty || !make.trim() || !model.trim() || !yearOk}
        onPress={() => {
          onSave({ ...(car ?? { id: Crypto.randomUUID() }), year: yearNum, make: make.trim(), model: model.trim(), plate: plate.trim() || undefined });
          if (!car) { setYear(''); setMake(''); setModel(''); setPlate(''); }
          setMsg(car ? 'Saved.' : 'Car added (pretend location: home lot).');
        }}
      />
      {msg ? <Muted>{msg}</Muted> : null}
    </Card>
  );
}

const inputStyle = () => ({ backgroundColor: colors.bg, borderRadius: 8, padding: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text });
