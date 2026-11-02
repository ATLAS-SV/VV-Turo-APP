import type { Booking, Settings, Task, TaskKind } from './types';

const MIN = 60_000;

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  confirm_license: 'Confirm guest’s license',
  checkin_photos: 'Take check-in photos',
  checkin_dash_photo: 'Submit dash photo (fuel & mileage)',
  checkout_photos: 'Take check-out photos',
  checkout_dash_photo: 'Submit return dash photo (fuel & mileage)',
  claim: 'Pending claim',
  custom: 'Task',
};

/** Tasks only Executives see (they involve money or claims). */
export const EXEC_ONLY_KINDS: TaskKind[] = ['claim'];

/**
 * Checklist every booking gets automatically.
 * Before pickup: confirm license, check-in photos, dash photo. After return: check-out photos, dash photo.
 * Ids are stable (booking id + kind), so "done" marks survive booking updates.
 */
export function tasksForBooking(b: Booking, settings: Settings): Task[] {
  if (b.canceled) return [];
  const start = Date.parse(b.tripStart);
  const end = Date.parse(b.tripEnd);
  const mk = (kind: TaskKind, due: number): Task => ({
    id: `${b.id}:${kind}`,
    kind,
    title: TASK_KIND_LABELS[kind],
    bookingId: b.id,
    carId: b.carId,
    dueAt: new Date(due).toISOString(),
    source: 'auto',
  });
  return [
    mk('confirm_license', start - settings.licenseDueMinutesBefore * MIN),
    mk('checkin_photos', start),
    mk('checkin_dash_photo', start),
    mk('checkout_photos', end + settings.checkoutPhotosDueMinutesAfter * MIN),
    mk('checkout_dash_photo', end + settings.checkoutPhotosDueMinutesAfter * MIN),
  ];
}

export interface TaskWithState extends Task {
  doneAt: string | null;
  doneBy?: string;
  status: 'done' | 'overdue' | 'due_soon' | 'upcoming';
}

export type TaskDoneMap = Record<string, { at: string; by: string }>;

/**
 * All tasks: automatic booking checklists (for trips that ended within the last week or are still ahead)
 * plus extra tasks such as pending claims from Turo emails.
 */
export function allTasks(
  bookings: Booking[],
  extra: Task[],
  done: TaskDoneMap,
  settings: Settings,
  now: Date,
): TaskWithState[] {
  const weekAgo = now.getTime() - 7 * 24 * 60 * MIN;
  const auto = bookings.filter((b) => Date.parse(b.tripEnd) >= weekAgo).flatMap((b) => tasksForBooking(b, settings));
  return [...auto, ...extra]
    .map((t) => {
      const d = done[t.id];
      return { ...t, doneAt: d?.at ?? null, doneBy: d?.by, status: taskStatus(t, d?.at ?? null, settings, now) };
    })
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function taskStatus(t: Task, doneAt: string | null, settings: Settings, now: Date): TaskWithState['status'] {
  if (doneAt) return 'done';
  const due = Date.parse(t.dueAt);
  if (now.getTime() > due) return 'overdue';
  if (now.getTime() >= due - settings.taskReminderMinutes * MIN) return 'due_soon';
  return 'upcoming';
}

/** When to remind: the "due soon" heads-up, then the "overdue" alert at the due time. */
export function reminderTimes(t: Task, settings: Settings): { kind: 'soon' | 'overdue'; at: Date }[] {
  const due = Date.parse(t.dueAt);
  return [
    { kind: 'soon', at: new Date(due - settings.taskReminderMinutes * MIN) },
    { kind: 'overdue', at: new Date(due + MIN) },
  ];
}

export function canSeeTask(t: Task, isExec: boolean): boolean {
  return isExec || !EXEC_ONLY_KINDS.includes(t.kind);
}

/**
 * Which reminders to send now: a "due soon" heads-up and an "overdue" alert, once each per task.
 * Tasks that were already overdue for over a day when first seen are marked as sent silently (no nagging).
 */
export function planTaskAlerts(
  tasks: TaskWithState[],
  alreadySent: string[],
  now: Date,
): { send: { task: TaskWithState; kind: 'soon' | 'overdue' }[]; markSent: string[] } {
  const send: { task: TaskWithState; kind: 'soon' | 'overdue' }[] = [];
  const markSent: string[] = [];
  for (const t of tasks) {
    if (t.status !== 'due_soon' && t.status !== 'overdue') continue;
    const kind = t.status === 'overdue' ? 'overdue' : 'soon';
    const key = `${t.id}:${kind}`;
    if (alreadySent.includes(key)) continue;
    markSent.push(key);
    if (kind === 'overdue' && now.getTime() - Date.parse(t.dueAt) > 24 * 60 * MIN) continue;
    send.push({ task: t, kind });
  }
  return { send, markSent };
}
