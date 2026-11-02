import type { TaskWithState } from '../logic/tasks';
import { useNow, useTasks } from '../state/AppStore';
import { Card, Muted, Screen, SectionTitle } from '../ui/components';
import { TaskRow } from '../ui/TaskRow';

/** Everything that needs doing: automatic trip checklists plus pending claims. */
export default function TasksScreen() {
  const tasks = useTasks();
  const now = useNow(30_000);
  const groups: { title: string; list: TaskWithState[] }[] = [
    { title: 'Overdue', list: tasks.filter((t) => t.status === 'overdue') },
    { title: 'Due soon', list: tasks.filter((t) => t.status === 'due_soon') },
    { title: 'Upcoming', list: tasks.filter((t) => t.status === 'upcoming') },
    {
      title: 'Done (last 7 days)',
      list: tasks.filter((t) => t.doneAt && now.getTime() - Date.parse(t.doneAt) < 7 * 24 * 3600_000).reverse(),
    },
  ];
  return (
    <Screen>
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
              <TaskRow key={t.id} t={t} now={now} />
            ))}
          </Card>
        ) : null,
      )}
      {!tasks.some((t) => !t.doneAt) ? <Muted>No open tasks. 🎉</Muted> : null}
    </Screen>
  );
}
