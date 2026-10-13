// Safe wrapper around expo-notifications.
// In Expo Go on Android SDK 53+, the module fails at import time.
// We lazy-require and no-op everything if it fails to load.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const IS_UNSUPPORTED = IS_EXPO_GO && Platform.OS === 'android';

let mod: any = null;
if (!IS_UNSUPPORTED && Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications');
  } catch {
    mod = null;
  }
}

export const isPushSupported = () => !!mod && !IS_UNSUPPORTED;

// Keep cancellation and scheduling in one ordered transaction, including across
// component remounts. An older run must finish cleanup before a newer run starts.
let guidedNotificationSyncQueue: Promise<void> = Promise.resolve();
export function runGuidedNotificationSync(sync: () => Promise<void>): Promise<void> {
  const result = guidedNotificationSyncQueue.then(sync);
  guidedNotificationSyncQueue = result.catch(() => {});
  return result;
}

let startupPermissionRequest: Promise<boolean> | null = null;

export function requestStartupNotificationPermissionIfNeeded(
  alreadyRequested: boolean,
  markRequestAttempted: () => Promise<void>,
): Promise<boolean> {
  if (!isPushSupported() || alreadyRequested) return Promise.resolve(false);
  if (startupPermissionRequest) return startupPermissionRequest;

  const pendingRequest = (async () => {
    const permission = await getPermissionState();
    if (permission.status !== 'undetermined' || !permission.canAskAgain) return false;
    await markRequestAttempted();
    return requestNotificationPermissions();
  })().finally(() => {
    startupPermissionRequest = null;
  });
  startupPermissionRequest = pendingRequest;
  return pendingRequest;
}

export async function setupHandlerAndChannel() {
  if (!mod) return;
  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {}
  if (Platform.OS === 'android') {
    try {
      await mod.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: mod.AndroidImportance?.MAX ?? 5,
        sound: 'default',
      });
    } catch {}
  }
}

export function addTapListener(onTap: (data: any) => void) {
  if (!mod) return { remove: () => {} };
  try {
    return mod.addNotificationResponseReceivedListener((r: any) => {
      try { onTap(r?.notification?.request?.content?.data || {}); } catch {}
    });
  } catch {
    return { remove: () => {} };
  }
}

export async function getColdStartData(): Promise<any | null> {
  if (!mod) return null;
  try {
    const r = await mod.getLastNotificationResponseAsync();
    return r?.notification?.request?.content?.data || null;
  } catch {
    return null;
  }
}

export async function requestAndGetDeviceToken(): Promise<string | null> {
  if (!mod) return null;
  try {
    const { status } = await mod.getPermissionsAsync();
    if (status !== 'granted') return null;
    const t = await mod.getDevicePushTokenAsync();
    return t?.data ?? null;
  } catch (error) {
    console.error('Unable to read notification permission or device token:', error);
    return null;
  }
}

export async function getPermissionState(): Promise<{ status: string; canAskAgain: boolean }> {
  if (!mod) return { status: 'undetermined', canAskAgain: true };
  try {
    const r = await mod.getPermissionsAsync();
    return { status: r.status, canAskAgain: r.canAskAgain };
  } catch (error) {
    console.error('Unable to read notification permission:', error);
    return { status: 'unknown', canAskAgain: false };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!mod) return false;
  try {
    const { status } = await mod.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Unable to request notification permission:', error);
    return false;
  }
}

export async function scheduleLocal(title: string, body: string, seconds: number, data?: Record<string, string>): Promise<string | null> {
  if (!mod) return null;
  try {
    const delaySeconds = Math.max(1, Math.ceil(seconds));
    const id = await mod.scheduleNotificationAsync({
      content: { title, body, sound: 'default', channelId: 'default', ...(data ? { data } : {}) },
      trigger: {
        type: mod.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval',
        seconds: delaySeconds,
        repeats: false,
      },
    });
    return id ?? null;
  } catch {
    return null;
  }
}

export async function scheduleLocalAt(
  title: string,
  body: string,
  scheduledAt: Date,
  data: Record<string, string>,
): Promise<string | null> {
  if (!mod) return null;
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return null;
  return mod.scheduleNotificationAsync({
    content: { title, body, sound: 'default', channelId: 'default', data },
    trigger: {
      type: mod.SchedulableTriggerInputTypes?.DATE ?? 'date',
      date: scheduledAt,
      channelId: 'default',
    },
  });
}

export async function scheduleNotificationBatch<T>(
  items: readonly T[],
  schedule: (item: T) => Promise<string | null>,
  rollback: (identifier: string) => Promise<void>,
): Promise<string[]> {
  const scheduled: string[] = [];
  try {
    for (const item of items) {
      const identifier = await schedule(item);
      if (!identifier) throw new Error('The notification service did not return an identifier.');
      scheduled.push(identifier);
    }
    return scheduled;
  } catch (error) {
    const rollbackResults = await Promise.allSettled(scheduled.map(rollback));
    rollbackResults.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('Unable to roll back a partially scheduled notification:', result.reason);
      }
    });
    throw error;
  }
}

export async function cancelGuidedNotificationsForPlan(planId: string): Promise<void> {
  return cancelGuidedNotificationsForPlanExcept(planId, new Set());
}

export async function cancelGuidedNotificationsForPlanExcept(
  planId: string,
  keepIdentifiers: ReadonlySet<string>,
): Promise<void> {
  if (!mod || !planId) return;
  const scheduled = await mod.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((request: any) => {
    const data = request.content?.data ?? {};
    return data.source === 'pizza-guided-recipe'
      && data.planId === planId
      && !keepIdentifiers.has(request.identifier);
  });
  await Promise.all(matching.map((request: any) => mod.cancelScheduledNotificationAsync(request.identifier)));
}

export async function cancelGuidedNotificationForStep(planId: string, stepId: string): Promise<void> {
  if (!mod || !planId || !stepId) return;
  const scheduled = await mod.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((request: any) => {
    const data = request.content?.data ?? {};
    return data.source === 'pizza-guided-recipe' && data.planId === planId && (data.stepId === stepId || data.combinedStepId === stepId);
  });
  await Promise.all(matching.map((request: any) => mod.cancelScheduledNotificationAsync(request.identifier)));
}

export async function cancelPlannerNotificationsForMethods(methods: readonly string[]): Promise<void> {
  return cancelPlannerNotificationsForMethodsExcept(methods, new Set());
}

export async function cancelPlannerNotificationsForMethodsExcept(
  methods: readonly string[],
  keepIdentifiers: ReadonlySet<string>,
): Promise<void> {
  if (!mod || methods.length === 0) return;
  const scheduled = await mod.getAllScheduledNotificationsAsync();
  const cancellations = scheduled
    .filter((request: any) => {
      const content = request.content ?? {};
      const data = content.data ?? {};
      const taggedPlannerMethod = data.source === 'pizza-planner'
        && methods.includes(data.method)
        && !keepIdentifiers.has(request.identifier);
      const legacyPlannerAlarm = !data.source
        && typeof content.title === 'string'
        && content.title.startsWith('🍕 ')
        && !keepIdentifiers.has(request.identifier);
      return taggedPlannerMethod || legacyPlannerAlarm;
    })
    .map((request: any) => mod.cancelScheduledNotificationAsync(request.identifier));
  await Promise.all(cancellations);
}

export function isObsoletePlannerNotification(
  request: { content?: { title?: unknown; data?: Record<string, unknown> } },
  currentPlanId: string | null,
): boolean {
  const content = request.content ?? {};
  const data = content.data ?? {};
  if (data.source === 'pizza-planner') return currentPlanId === null || data.planId !== currentPlanId;
  return !data.source && typeof content.title === 'string' && content.title.startsWith('🍕 ');
}

export async function cancelObsoletePlannerNotifications(currentPlanId: string | null): Promise<void> {
  if (!mod) return;
  const scheduled = await mod.getAllScheduledNotificationsAsync();
  const cancellations = scheduled
    .filter((request: any) => {
      const data = request.content?.data ?? {};
      return data.source === 'pizza-planner'
        ? currentPlanId === null || data.planId !== currentPlanId
        : !data.source && typeof request.content?.title === 'string'
          && request.content.title.startsWith('🍕 ');
    })
    .map((request: any) => mod.cancelScheduledNotificationAsync(request.identifier));
  await Promise.all(cancellations);
}

export async function cancelLocal(id: string) {
  if (!mod || !id) return;
  try {
    await mod.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.error(`Unable to cancel notification "${id}":`, error);
  }
}
