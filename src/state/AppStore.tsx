import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_SETTINGS, SEED_CARS, seedBookings, seedMoney, seedTasks } from '../data/seed';
import { allTasks, canSeeTask, planTaskAlerts, type TaskDoneMap, type TaskWithState } from '../logic/tasks';
import { syncTaskNotifications } from '../services/notifications';
import { planAutomation } from '../logic/automation';
import { evaluateCheckIn, REFUSAL_MESSAGES } from '../logic/guestCheckIn';
import { canUnlockCar } from '../logic/permissions';
import { NO_LOCKOUT, lockedUntil, registerFailure, validatePinFormat, type PinLockout } from '../logic/pin';
import { openShift } from '../logic/hours';
import type {
  ActivityAction,
  ActivityEntry,
  Actor,
  Booking,
  Car,
  CarTelemetry,
  EarningItem,
  HomePage,
  LatLng,
  Payout,
  Role,
  Settings,
  Shift,
  Task,
  Trip,
  User,
} from '../logic/types';
import { mockFleet, tracker, vehicleControl } from '../services/mockFleet';

const STORAGE_KEY = 'turo-app/v1';

/** Demo build (EXPO_PUBLIC_DEMO=1): starts with two people and shows their PINs on the sign-in screen. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';
export const DEMO_PINS = { executive: '135790', employee: '246800' };
const AUTOMATION_INTERVAL_MS = 15_000;

interface Persisted {
  users: User[];
  settings: Settings;
  cars: Car[];
  bookings: Booking[];
  activity: ActivityEntry[];
  shifts: Shift[];
  pinLockout: PinLockout;
  lateAlertsSent: string[];
  /** Money lines that aren't a booking's trip earnings (incentives, claims, reimbursements, past trips). */
  earningExtras: EarningItem[];
  payouts: Payout[];
  /** Tasks not tied to a booking checklist, e.g. pending claims from Turo emails. */
  extraTasks: Task[];
  taskDone: TaskDoneMap;
  /** Reminders already shown, as "taskId:soon" / "taskId:overdue". */
  taskAlertsSent: string[];
  mockTelemetry: CarTelemetry[] | null;
  mockTrips: Trip[] | null;
}

export interface Toast {
  id: string;
  text: string;
}

interface State extends Persisted {
  loaded: boolean;
  currentUserId: string | null;
  telemetry: Record<string, CarTelemetry>;
  busyCars: Record<string, 'locking' | 'unlocking'>;
  toasts: Toast[];
}

export type Result = { ok: true } | { ok: false; error: string };

const newId = () => Crypto.randomUUID();

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

async function makePinRecord(pin: string) {
  const salt = newId();
  return { pinSalt: salt, pinHash: await hashPin(pin, salt) };
}

async function findUserByPin(users: User[], pin: string): Promise<User | undefined> {
  for (const u of users) {
    if ((await hashPin(pin, u.pinSalt)) === u.pinHash) return u;
  }
  return undefined;
}

function initialPersisted(): Persisted {
  const money = seedMoney(Date.now());
  const tasks = seedTasks(Date.now());
  return {
    extraTasks: tasks.extra,
    taskDone: tasks.done,
    taskAlertsSent: [],
    earningExtras: money.extras,
    payouts: money.payouts,
    users: [],
    settings: DEFAULT_SETTINGS,
    cars: SEED_CARS,
    bookings: seedBookings(Date.now()),
    activity: [],
    shifts: [],
    pinLockout: NO_LOCKOUT,
    lateAlertsSent: [],
    mockTelemetry: null,
    mockTrips: null,
  };
}

function useAppStoreValue() {
  const [state, setState] = useState<State>({
    ...initialPersisted(),
    loaded: false,
    currentUserId: null,
    telemetry: {},
    busyCars: {},
    toasts: [],
  });
  // `ref` is the source of truth so async actions always see the latest state;
  // every change goes through `update`, which also re-renders.
  const ref = useRef(state);

  const update = useCallback((fn: (s: State) => State) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
  }, []);

  // ---------- load & save ----------
  useEffect(() => {
    (async () => {
      let saved: Partial<Persisted> = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch {
        // Corrupt or unavailable storage: start fresh.
      }
      const merged = { ...initialPersisted(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
      // Demo build: ready-made people so anyone can try both views without setting up PINs.
      if (DEMO_MODE && !merged.users.length) {
        const now = new Date().toISOString();
        merged.users = [
          { id: 'demo-exec', name: 'Sebastian', role: 'executive', assignedCarIds: [], createdAt: now, ...(await makePinRecord(DEMO_PINS.executive)) },
          { id: 'demo-emp', name: 'Helper', role: 'employee', assignedCarIds: [], createdAt: now, ...(await makePinRecord(DEMO_PINS.employee)) },
        ];
      }
      mockFleet.load(merged.mockTelemetry, merged.mockTrips);
      update((s) => ({ ...s, ...merged, loaded: true }));
    })();
  }, [update]);

  useEffect(() => {
    if (!state.loaded) return;
    const fleet = mockFleet.snapshot();
    const data: Persisted = {
      users: state.users,
      settings: state.settings,
      cars: state.cars,
      bookings: state.bookings,
      activity: state.activity.slice(0, 1000),
      shifts: state.shifts,
      pinLockout: state.pinLockout,
      lateAlertsSent: state.lateAlertsSent,
      earningExtras: state.earningExtras,
      extraTasks: state.extraTasks,
      taskDone: state.taskDone,
      taskAlertsSent: state.taskAlertsSent.slice(-500),
      payouts: state.payouts,
      mockTelemetry: fleet.telemetry,
      mockTrips: fleet.trips,
    };
    const t = setTimeout(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [state]);

  // ---------- helpers ----------
  const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? null;

  const actorFor = (u: User): Actor => ({ kind: 'user', userId: u.id, name: u.name });

  const log = useCallback(
    (action: ActivityAction, actor: Actor, opts: { carId?: string; detail?: string; notify?: boolean } = {}) => {
      const entry: ActivityEntry = {
        id: newId(),
        at: new Date().toISOString(),
        action,
        actor,
        carId: opts.carId,
        detail: opts.detail,
        notify: !!opts.notify,
      };
      update((s) => {
        const viewer = s.users.find((u) => u.id === s.currentUserId);
        // Owner notifications: shown in-app to executives for now (push notifications come with the backend).
        const toasts =
          entry.notify && viewer?.role === 'executive'
            ? [...s.toasts, { id: entry.id, text: describeEntry(entry, s.cars) }].slice(-3)
            : s.toasts;
        return { ...s, activity: [entry, ...s.activity], toasts };
      });
      if (entry.notify) {
        setTimeout(() => update((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== entry.id) })), 6000);
      }
    },
    [update],
  );

  const refreshTelemetry = useCallback(async () => {
    const list = await tracker.getTelemetry(ref.current.cars);
    update((s) => ({ ...s, telemetry: Object.fromEntries(list.map((t) => [t.carId, { ...t }])) }));
  }, [update]);

  const patchBooking = useCallback(
    (id: string, fn: (b: Booking) => Booking) =>
      update((s) => ({ ...s, bookings: s.bookings.map((b) => (b.id === id ? fn(b) : b)) })),
    [update],
  );

  // ---------- automation loop ----------
  const running = useRef(false);
  const runAutomation = useCallback(async () => {
    if (running.current || !ref.current.loaded) return;
    running.current = true;
    try {
      await refreshTelemetry();
      const s = ref.current;
      const actions = planAutomation({
        cars: s.cars,
        telemetry: s.telemetry,
        bookings: s.bookings,
        settings: s.settings,
        lateAlertsSent: s.lateAlertsSent,
        now: new Date(),
      });
      const carById = (id: string) => s.cars.find((c) => c.id === id)!;
      const bookingById = (id: string) => s.bookings.find((b) => b.id === id)!;
      for (const a of actions) {
        switch (a.type) {
          case 'auto_lock':
            await vehicleControl.lock(carById(a.carId));
            log('auto_lock', { kind: 'system' }, { carId: a.carId, detail: a.reason, notify: true });
            break;
          case 'guest_relock': {
            const b = bookingById(a.bookingId);
            await vehicleControl.lock(carById(a.carId));
            patchBooking(b.id, (x) => ({ ...x, checkIn: { ...x.checkIn, state: 'relocked' } }));
            log('guest_relock', { kind: 'guest', bookingId: b.id, name: b.guestFirstName }, {
              carId: a.carId,
              detail: `Countdown ran out (${s.settings.guestCountdownMinutes} min) before the car moved`,
              notify: true,
            });
            break;
          }
          case 'trip_started': {
            const b = bookingById(a.bookingId);
            patchBooking(b.id, (x) => ({ ...x, checkIn: { ...x.checkIn, state: 'started' } }));
            log('trip_started', { kind: 'guest', bookingId: b.id, name: b.guestFirstName }, {
              carId: a.carId,
              detail: 'Car left the lot. Check-in link expired.',
            });
            break;
          }
          case 'expire_link':
            patchBooking(a.bookingId, (x) => ({ ...x, checkIn: { ...x.checkIn, state: 'expired' } }));
            break;
          case 'late_return': {
            const b = bookingById(a.bookingId);
            update((st) => ({ ...st, lateAlertsSent: [...st.lateAlertsSent, b.id] }));
            log('late_return', { kind: 'system' }, {
              carId: a.carId,
              detail: `${b.guestFirstName}'s trip ended over ${s.settings.lateReturnAlertMinutes} min ago and the car isn't back at the lot`,
              notify: true,
            });
            break;
          }
        }
      }
      // Task reminders: "due soon" heads-up and "overdue" alert, once each.
      const st = ref.current;
      const tasks = allTasks(st.bookings, st.extraTasks, st.taskDone, st.settings, new Date());
      const plan = planTaskAlerts(tasks, st.taskAlertsSent, new Date());
      const newlySent = plan.markSent;
      for (const { task: t, kind } of plan.send) {
        log(kind === 'overdue' ? 'task_overdue' : 'task_reminder', { kind: 'system' }, {
          carId: t.carId,
          detail: describeTask(t, st.bookings, st.cars, true),
          notify: true,
        });
      }
      if (newlySent.length) update((x) => ({ ...x, taskAlertsSent: [...x.taskAlertsSent, ...newlySent] }));
      if (actions.length) await refreshTelemetry();
    } finally {
      running.current = false;
    }
  }, [refreshTelemetry, log, patchBooking, update]);

  useEffect(() => {
    if (!state.loaded) return;
    runAutomation();
    const t = setInterval(runAutomation, AUTOMATION_INTERVAL_MS);
    return () => clearInterval(t);
  }, [state.loaded, runAutomation]);

  // ---------- phone reminders for tasks ----------
  const isExecSignedIn = state.users.find((u) => u.id === state.currentUserId)?.role === 'executive';
  useEffect(() => {
    if (!state.loaded || !isExecSignedIn) return;
    const t = setTimeout(() => {
      const s = ref.current;
      const tasks = allTasks(s.bookings, s.extraTasks, s.taskDone, s.settings, new Date());
      syncTaskNotifications(tasks, s.settings, (x) => describeTask(x, s.bookings, s.cars, true));
    }, 1500);
    return () => clearTimeout(t);
  }, [state.loaded, isExecSignedIn, state.bookings, state.extraTasks, state.taskDone, state.settings]);

  // ---------- re-ask for PIN after time in background ----------
  useEffect(() => {
    let backgroundAt: number | null = null;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') backgroundAt = Date.now();
      if (st === 'active' && backgroundAt) {
        const away = Date.now() - backgroundAt;
        backgroundAt = null;
        if (away > ref.current.settings.appRelockMinutes * 60_000) {
          update((s) => ({ ...s, currentUserId: null }));
        }
        runAutomation();
      }
    });
    return () => sub.remove();
  }, [update, runAutomation]);

  // ---------- sign-in ----------
  const pinFailure = useCallback(
    (userForLog: User | null) => {
      const now = new Date();
      const next = registerFailure(ref.current.pinLockout, now);
      const until = lockedUntil(next, now);
      update((s) => ({ ...s, pinLockout: next, ...(until ? { currentUserId: null } : {}) }));
      if (until) {
        log('pin_lockout', userForLog ? actorFor(userForLog) : { kind: 'system' }, {
          detail: `Too many wrong PINs. App locked until ${until.toLocaleTimeString()}`,
          notify: true,
        });
      }
      return until;
    },
    [update, log],
  );

  /** `switchWith` lets the sign-in screen run its transition before the app appears. */
  const signIn = useCallback(
    async (pin: string, switchWith?: (switchToApp: () => void) => void): Promise<Result> => {
      const until = lockedUntil(ref.current.pinLockout, new Date());
      if (until) return { ok: false, error: `Locked. Try again at ${until.toLocaleTimeString()}.` };
      const user = await findUserByPin(ref.current.users, pin);
      if (!user) {
        const lock = pinFailure(null);
        return { ok: false, error: lock ? `Too many attempts. Locked until ${lock.toLocaleTimeString()}.` : 'Wrong PIN.' };
      }
      const switchToApp = () => update((s) => ({ ...s, currentUserId: user.id, pinLockout: NO_LOCKOUT }));
      if (switchWith) switchWith(switchToApp);
      else switchToApp();
      return { ok: true };
    },
    [update, pinFailure],
  );

  const signOut = useCallback(() => update((s) => ({ ...s, currentUserId: null, toasts: [] })), [update]);

  const pinInUse = async (pin: string, exceptUserId?: string) =>
    !!(await findUserByPin(ref.current.users.filter((u) => u.id !== exceptUserId), pin));

  const createFirstExecutive = useCallback(
    async (name: string, pin: string, switchWith?: (switchToApp: () => void) => void): Promise<Result> => {
      if (ref.current.users.length) return { ok: false, error: 'Already set up.' };
      const err = validatePinFormat(pin);
      if (err) return { ok: false, error: err };
      const user: User = {
        id: newId(),
        name: name.trim() || 'Sebastian',
        role: 'executive',
        assignedCarIds: [],
        createdAt: new Date().toISOString(),
        ...(await makePinRecord(pin)),
      };
      const switchToApp = () => update((s) => ({ ...s, users: [user], currentUserId: user.id }));
      if (switchWith) switchWith(switchToApp);
      else switchToApp();
      return { ok: true };
    },
    [update],
  );

  // ---------- car control ----------
  const lockCar = useCallback(
    async (carId: string): Promise<Result> => {
      const user = ref.current.users.find((u) => u.id === ref.current.currentUserId);
      const car = ref.current.cars.find((c) => c.id === carId);
      if (!user || !car) return { ok: false, error: 'Not signed in.' };
      update((s) => ({ ...s, busyCars: { ...s.busyCars, [carId]: 'locking' } }));
      try {
        await vehicleControl.lock(car);
        log('lock', actorFor(user), { carId });
        await refreshTelemetry();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `Couldn't lock: ${String(e)}` };
      } finally {
        update((s) => {
          const { [carId]: _, ...rest } = s.busyCars;
          return { ...s, busyCars: rest };
        });
      }
    },
    [update, log, refreshTelemetry],
  );

  /** Unlock always needs the PIN of the person who is signed in. */
  const unlockCar = useCallback(
    async (carId: string, pin: string): Promise<Result> => {
      const s0 = ref.current;
      const user = s0.users.find((u) => u.id === s0.currentUserId);
      const car = s0.cars.find((c) => c.id === carId);
      if (!user || !car) return { ok: false, error: 'Not signed in.' };
      if (!canUnlockCar(user, carId, s0.settings)) return { ok: false, error: 'This car isn’t assigned to you.' };
      if ((await hashPin(pin, user.pinSalt)) !== user.pinHash) {
        const lock = pinFailure(user);
        return { ok: false, error: lock ? 'Too many wrong PINs. App locked.' : 'Wrong PIN.' };
      }
      update((s) => ({ ...s, pinLockout: NO_LOCKOUT, busyCars: { ...s.busyCars, [carId]: 'unlocking' } }));
      try {
        await vehicleControl.unlock(car);
        log('unlock', actorFor(user), { carId });
        await refreshTelemetry();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `Couldn't unlock: ${String(e)}` };
      } finally {
        update((s) => {
          const { [carId]: _, ...rest } = s.busyCars;
          return { ...s, busyCars: rest };
        });
      }
    },
    [update, log, refreshTelemetry, pinFailure],
  );

  // ---------- hours ----------
  const toggleClock = useCallback(() => {
    const s = ref.current;
    const user = s.users.find((u) => u.id === s.currentUserId);
    if (!user) return;
    const open = openShift(s.shifts, user.id);
    const now = new Date().toISOString();
    if (open) {
      update((st) => ({ ...st, shifts: st.shifts.map((x) => (x.id === open.id ? { ...x, clockOut: now } : x)) }));
      log('clock_out', actorFor(user));
    } else {
      update((st) => ({ ...st, shifts: [{ id: newId(), userId: user.id, clockIn: now, clockOut: null }, ...st.shifts] }));
      log('clock_in', actorFor(user));
    }
  }, [update, log]);

  // ---------- executive: settings, team, cars ----------
  const requireExec = () => {
    const u = ref.current.users.find((x) => x.id === ref.current.currentUserId);
    return u?.role === 'executive' ? u : null;
  };

  const updateSettings = useCallback(
    (patch: Partial<Settings>, description: string) => {
      const exec = requireExec();
      if (!exec) return;
      update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      log('settings_changed', actorFor(exec), { detail: description });
    },
    [update, log],
  );

  const addUser = useCallback(
    async (name: string, role: Role, pin: string): Promise<Result> => {
      const exec = requireExec();
      if (!exec) return { ok: false, error: 'Executives only.' };
      if (!name.trim()) return { ok: false, error: 'Enter a name.' };
      const err = validatePinFormat(pin);
      if (err) return { ok: false, error: err };
      if (await pinInUse(pin)) return { ok: false, error: 'That PIN is already taken. Each person needs their own PIN.' };
      const user: User = {
        id: newId(),
        name: name.trim(),
        role,
        assignedCarIds: [],
        createdAt: new Date().toISOString(),
        ...(await makePinRecord(pin)),
      };
      update((s) => ({ ...s, users: [...s.users, user] }));
      log('team_changed', actorFor(exec), { detail: `Added ${user.name} (${role})` });
      return { ok: true };
    },
    [update, log],
  );

  const changePin = useCallback(
    async (userId: string, pin: string): Promise<Result> => {
      const exec = requireExec();
      if (!exec) return { ok: false, error: 'Executives only.' };
      const err = validatePinFormat(pin);
      if (err) return { ok: false, error: err };
      if (await pinInUse(pin, userId)) return { ok: false, error: 'That PIN is already taken.' };
      const rec = await makePinRecord(pin);
      update((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, ...rec } : u)) }));
      const name = ref.current.users.find((u) => u.id === userId)?.name;
      log('team_changed', actorFor(exec), { detail: `Changed PIN for ${name}` });
      return { ok: true };
    },
    [update, log],
  );

  const removeUser = useCallback(
    (userId: string): Result => {
      const exec = requireExec();
      if (!exec) return { ok: false, error: 'Executives only.' };
      const s = ref.current;
      const target = s.users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'Not found.' };
      if (target.role === 'executive' && s.users.filter((u) => u.role === 'executive').length === 1) {
        return { ok: false, error: 'Can’t remove the last executive.' };
      }
      if (target.id === exec.id) return { ok: false, error: 'You can’t remove yourself.' };
      update((st) => ({ ...st, users: st.users.filter((u) => u.id !== userId) }));
      log('team_changed', actorFor(exec), { detail: `Removed ${target.name}` });
      return { ok: true };
    },
    [update, log],
  );

  const setAssignedCars = useCallback(
    (userId: string, carIds: string[]) => {
      if (!requireExec()) return;
      update((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, assignedCarIds: carIds } : u)) }));
    },
    [update],
  );

  const completeTask = useCallback(
    (taskId: string, done: boolean) => {
      const s = ref.current;
      const user = s.users.find((u) => u.id === s.currentUserId);
      if (!user) return;
      update((x) => {
        const taskDone = { ...x.taskDone };
        if (done) taskDone[taskId] = { at: new Date().toISOString(), by: user.name };
        else delete taskDone[taskId];
        return { ...x, taskDone };
      });
      if (done) {
        const t = allTasks(s.bookings, s.extraTasks, s.taskDone, s.settings, new Date()).find((x) => x.id === taskId);
        if (t) log('task_done', actorFor(user), { carId: t.carId, detail: describeTask(t, s.bookings, s.cars, true) });
      }
    },
    [update, log],
  );

  const setHomePage = useCallback(
    (userId: string, homePage: HomePage) => {
      if (!requireExec()) return;
      update((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, homePage } : u)) }));
    },
    [update],
  );

  const saveCar = useCallback(
    (car: Car) => {
      if (!requireExec()) return;
      update((s) => ({
        ...s,
        cars: s.cars.some((c) => c.id === car.id) ? s.cars.map((c) => (c.id === car.id ? car : c)) : [...s.cars, car],
      }));
      refreshTelemetry();
    },
    [update, refreshTelemetry],
  );

  // ---------- pretend-data simulation (until real services are connected) ----------
  const simulateGuestArrival = useCallback(
    async (bookingId: string, position: LatLng): Promise<Result> => {
      await refreshTelemetry();
      const s = ref.current;
      const b = s.bookings.find((x) => x.id === bookingId);
      if (!b) return { ok: false, error: 'Booking not found.' };
      const car = s.cars.find((c) => c.id === b.carId)!;
      const guest: Actor = { kind: 'guest', bookingId: b.id, name: b.guestFirstName };
      const d = evaluateCheckIn(b, { position, accuracyM: 15 }, s.telemetry[b.carId], s.settings, new Date());
      if (!d.ok) {
        log('guest_failed', guest, { carId: b.carId, detail: REFUSAL_MESSAGES[d.reason], notify: true });
        return { ok: false, error: REFUSAL_MESSAGES[d.reason] };
      }
      await vehicleControl.unlock(car);
      const now = new Date().toISOString();
      patchBooking(b.id, (x) => ({
        ...x,
        checkIn: { state: 'unlocked', unlockCount: x.checkIn.unlockCount + 1, lastUnlockAt: now },
      }));
      log('guest_unlock', guest, {
        carId: b.carId,
        detail: d.isRetry ? 'Unlocked again from check-in link' : 'Unlocked from check-in link',
        notify: true,
      });
      await refreshTelemetry();
      return { ok: true };
    },
    [refreshTelemetry, log, patchBooking],
  );

  /** Record that the check-in message was sent to the guest in Turo. */
  const markLinkSent = useCallback(
    (bookingId: string) => {
      const s = ref.current;
      const user = s.users.find((u) => u.id === s.currentUserId);
      const b = s.bookings.find((x) => x.id === bookingId);
      if (!user || !b) return;
      patchBooking(bookingId, (x) => ({ ...x, linkSentAt: new Date().toISOString() }));
      log('link_sent', actorFor(user), { carId: b.carId, detail: `To ${b.guestFirstName} via Turo messages` });
    },
    [patchBooking, log],
  );

  const simulateDriveOff = useCallback(
    async (carId: string) => {
      mockFleet.simulateDriveOff(carId);
      await runAutomation();
    },
    [runAutomation],
  );

  const simulateReturn = useCallback(
    async (carId: string, leaveUnlocked: boolean) => {
      mockFleet.simulateReturnToLot(carId, leaveUnlocked);
      await runAutomation();
    },
    [runAutomation],
  );

  const resetDemoData = useCallback(() => {
    if (!requireExec()) return;
    const fresh = initialPersisted();
    mockFleet.load(null, null);
    update((s) => ({ ...s, bookings: fresh.bookings, cars: fresh.cars, earningExtras: fresh.earningExtras, payouts: fresh.payouts, extraTasks: fresh.extraTasks, taskDone: fresh.taskDone, taskAlertsSent: [], activity: [], lateAlertsSent: [], toasts: [] }));
    runAutomation();
  }, [update, runAutomation]);

  const dismissToast = useCallback(
    (id: string) => update((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })),
    [update],
  );

  return {
    ...state,
    currentUser,
    signIn,
    signOut,
    createFirstExecutive,
    lockCar,
    unlockCar,
    toggleClock,
    updateSettings,
    addUser,
    changePin,
    removeUser,
    setAssignedCars,
    setHomePage,
    completeTask,
    saveCar,
    getTrips: (carId: string) => tracker.getTrips(carId),
    markLinkSent,
    simulateGuestArrival,
    simulateDriveOff,
    simulateReturn,
    resetDemoData,
    dismissToast,
    refresh: runAutomation,
  };
}

export type AppStore = ReturnType<typeof useAppStoreValue>;
const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const value = useAppStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside AppStoreProvider');
  return v;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---------- display helpers ----------
export function carName(car: Car | undefined) {
  if (!car) return 'Unknown car';
  return `${car.year ? `${car.year} ` : ''}${car.make} ${car.model}`;
}

export const ACTION_LABELS: Record<ActivityAction, string> = {
  lock: 'Locked',
  unlock: 'Unlocked',
  auto_lock: 'Auto-locked',
  guest_unlock: 'Guest unlocked',
  guest_relock: 'Guest countdown relocked',
  guest_failed: 'Guest check-in failed',
  trip_started: 'Trip started',
  link_sent: 'Check-in link sent in Turo',
  late_return: 'Late return',
  clock_in: 'Clocked in',
  clock_out: 'Clocked out',
  pin_lockout: 'App locked (wrong PINs)',
  settings_changed: 'Settings changed',
  team_changed: 'Team changed',
  booking_received: 'New booking',
  booking_canceled: 'Booking canceled',
  guest_message: 'Guest message',
  task_done: 'Task done',
  task_reminder: 'Task due soon',
  task_overdue: 'Task overdue',
};

export function actorLabel(a: Actor, action?: ActivityAction) {
  if (a.kind === 'user') return a.name;
  if (a.kind === 'guest') return `${a.name} (guest link)`;
  return action === 'auto_lock' ? 'Auto-lock' : 'System';
}

export function describeEntry(e: ActivityEntry, cars: Car[]) {
  const car = e.carId ? ` · ${carName(cars.find((c) => c.id === e.carId))}` : '';
  return `${ACTION_LABELS[e.action]}${car}${e.detail ? ` — ${e.detail}` : ''}`;
}

/** "Confirm guest’s license · Maria · 2026 Genesis GV70" (guest name only for Executives). */
export function describeTask(t: TaskWithState | Task, bookings: Booking[], cars: Car[], showGuest: boolean) {
  const b = t.bookingId ? bookings.find((x) => x.id === t.bookingId) : undefined;
  const parts = [t.title];
  if (b && showGuest) parts.push(b.guestFirstName);
  if (t.carId) parts.push(carName(cars.find((c) => c.id === t.carId)));
  return parts.join(' · ');
}

export function useTasks() {
  const s = useStore();
  const now = useNow(30_000);
  const isExec = s.currentUser?.role === 'executive';
  return allTasks(s.bookings, s.extraTasks, s.taskDone, s.settings, now).filter((t) => canSeeTask(t, isExec));
}
