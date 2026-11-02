import { router } from 'expo-router';
import { View } from 'react-native';
import { can } from '../../logic/permissions';
import { useStore } from '../../state/AppStore';
import { Button, Card, colors, ListItem, Muted, Screen, SectionTitle, Title } from '../../ui/components';

export default function MoreScreen() {
  const { currentUser, signOut } = useStore();
  if (!currentUser) return null;
  const isExec = currentUser.role === 'executive';
  return (
    <Screen>
      <Card>
        <Title>{currentUser.name}</Title>
        <Muted>{isExec ? 'Executive' : 'Employee'}</Muted>
      </Card>
      {isExec ? (
        <>
          <SectionTitle>Executive</SectionTitle>
          <Card style={{ paddingVertical: 2 }}>
            {can(currentUser, 'viewActivityLog') ? (
              <ListItem icon="list" label="Activity log" sub="Who locked/unlocked which car and when" onPress={() => router.push('/activity')} />
            ) : null}
            <Divider />
            <ListItem icon="options" label="Settings" sub="Auto-lock, guest link, home lot" onPress={() => router.push('/settings')} />
            <Divider />
            <ListItem icon="people" label="Team & PINs" sub="Add or remove people, change PINs" onPress={() => router.push('/team')} />
            <Divider />
            <ListItem icon="car" label="Cars" sub="Add cars, fill in years" onPress={() => router.push('/fleet')} />
          </Card>
        </>
      ) : null}
      <Button variant="danger" icon="log-out" label="Sign out" onPress={signOut} style={{ marginTop: 12 }} />
    </Screen>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
