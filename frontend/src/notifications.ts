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
    const { status } = await mod.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const t = await mod.getDevicePushTokenAsync();
    return t?.data ?? null;
  } catch {
    return null;
  }
}

export async function getPermissionState(): Promise<{ status: string; canAskAgain: boolean }> {
  if (!mod) return { status: 'undetermined', canAskAgain: true };
  try {
    const r = await mod.getPermissionsAsync();
    return { status: r.status, canAskAgain: r.canAskAgain };
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!mod) return false;
  try {
    const { status } = await mod.requestPermissionsAsync();
    return status === 'granted';
  } catch {
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

export async function cancelPlannerNotificationsForMethods(methods: readonly string[]): Promise<void> {
  if (!mod || methods.length === 0) return;
  try {
    const scheduled = await mod.getAllScheduledNotificationsAsync();
    const cancellations = scheduled
      .filter((request: any) => {
        const content = request.content ?? {};
        const data = content.data ?? {};
        const taggedPlannerMethod = data.source === 'pizza-planner' && methods.includes(data.method);
        const legacyPlannerAlarm = !data.source && typeof content.title === 'string' && content.title.startsWith('🍕 ');
        return taggedPlannerMethod || legacyPlannerAlarm;
      })
      .map((request: any) => mod.cancelScheduledNotificationAsync(request.identifier));
    await Promise.all(cancellations);
  } catch {}
}

export async function cancelLocal(id: string) {
  if (!mod || !id) return;
  try {
    await mod.cancelScheduledNotificationAsync(id);
  } catch {}
}
