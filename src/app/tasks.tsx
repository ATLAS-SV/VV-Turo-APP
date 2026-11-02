import type { TaskWithState } from '../logic/tasks';
import { useState } from 'react';
import { carName, useNow, useStore, useTasks } from '../state/AppStore';
import { Card, Muted, Screen, SectionTitle } from '../ui/components';
import { FilterChips, matchesQuery, NoMatches, SearchBar } from '../ui/filters';
import { TaskRow } from '../ui/TaskRow';

/** Everything that needs doing: automatic trip checklists plus pending claims. */
export default function TasksScreen() {
  const allTasks = useTasks();
  const { cars, bookings } = useStore();
  const now = useNow(30_000);
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'Overdue' | 'Due soon' | 'Upcoming' | 'Done (last 7 days)'>('all');
  // Search by task, car or guest — lists get long as the fleet grows (every booking adds a checklist).
  const tasks = allTasks.filter((t) =>
    matchesQuery(query, t.title, t.detail, t.carId ? carName(cars.find((c) => c.id === t.carId)) : null, bookings.find((b) => b.id === t.bookingId)?.guestFirstName),
  );
  const allGroups: { title: string; list: TaskWithState[] }[] = [
    { title: 'Overdue', list: tasks.filter((t) => t.status === 'overdue') },
    { title: 'Due soon', list: tasks.filter((t) => t.status === 'due_soon') },
    { title: 'Upcoming', list: tasks.filter((t) => t.status === 'upcoming') },
    {
      title: 'Done (last 7 days)',
      list: tasks.filter((t) => t.doneAt && now.getTime() - Date.parse(t.doneAt) < 7 * 24 * 3600_000).reverse(),
    },
  ];
  const groups = allGroups.filter((g) => show === 'all' || g.title === show);
  return (
    <Screen>
      <SearchBar value={query} onChange={setQuery} placeholder="Search tasks, cars or guests" />
      <FilterChips
        options={[
          { key: 'all' as const, label: 'All' },
          ...allGroups.map((g) => ({ key: g.title as typeof show, label: g.title.replace(' (last 7 days)', ''), count: g.list.length, tone: g.title === 'Overdue' ? ('warn' as const) : undefined })),
        ]}
        value={show}
        onChange={setShow}
      />
      <Muted>
        Every booking gets a checklist automatically: confirm license, check-in photos and dash photo before pickup;
        check-out photos and dash photo after return. Pending claims show up here too (pretend for now; later read from Turo
        emails in Gmail). You get a reminder before each task is due and an alert if it’s overdue.
      </Muted>
      {groups.map((g) =>
        g.list.length ? (
          <Card key={g.title} style={{ gap: 0 }}>
            <SectionTitle>
              {g.title} ({g.list.length})
            </SectionTitle>
            {g.list.map((t) => (
              <TaskRow key={t.id} t={t} now={now} vanish />
            ))}
          </Card>
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
      {!query && !allTasks.some((t) => !t.doneAt) ? <Muted>No open tasks. 🎉</Muted> : null}
    </Screen>
  );
}
