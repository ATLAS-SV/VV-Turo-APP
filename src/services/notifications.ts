// Phone reminders for tasks, scheduled on this device so they arrive even when the app is closed.
// Once the backend exists, it will send push notifications instead (so reminders follow new emails too).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { reminderTimes, type TaskWithState } from '../logic/tasks';
import type { Settings } from '../logic/types';

const CHANNEL = 'task-reminders';
const MAX_SCHEDULED = 50; // iOS keeps at most 64 scheduled notifications per app
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let permission: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  if (permission !== null) return permission;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Task reminders',
      // eslint-disable-next-line import/namespace -- re-exported enum the lint resolver can't follow
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  permission = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  return permission;
}

/** Replace all scheduled reminders with the current list of open tasks. */
export async function syncTaskNotifications(
  tasks: TaskWithState[],
  settings: Settings,
  describe: (t: TaskWithState) => string,
): Promise<void> {
  if (!supported) return;
  try {
    if (!settings.taskPhoneNotifications) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    if (!(await ensurePermission())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    const upcoming = tasks
      .filter((t) => !t.doneAt)
      .flatMap((t) => reminderTimes(t, settings).map((r) => ({ t, ...r })))
      .filter((r) => r.at.getTime() > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MAX_SCHEDULED);
    for (const r of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.kind === 'overdue' ? 'Task overdue' : `Due in ${settings.taskReminderMinutes} min`,
          body: describe(r.t),
          data: { taskId: r.t.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
  } catch {
    // Notifications are a convenience; never let them break the app.
  }
}
