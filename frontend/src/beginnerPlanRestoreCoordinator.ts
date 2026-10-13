import { parsePreferredYeastType } from './preferences';
import type { MeasurementSystem, PreferredYeastType, TemperatureUnit } from './preferences';
import type { UserExperienceLevel } from './experienceLevel';

export const EXPERIENCE_LEVEL_STORAGE_KEY = 'userExperienceLevel';
export const TEMPERATURE_UNIT_STORAGE_KEY = 'temperatureUnit';
export const MEASUREMENT_SYSTEM_STORAGE_KEY = 'measurementSystem';
export const PREFERRED_YEAST_TYPE_STORAGE_KEY = 'preferredYeastType';
export const CALCULATOR_SETTINGS_STORAGE_KEY = 'calculatorSettings';
export const BEGINNER_BAKE_AT_STORAGE_KEY = 'beginnerBakeAt';
export const BEGINNER_PLAN_SNAPSHOT_STORAGE_KEY = 'beginnerPlanSnapshot';

export type BeginnerRestorePreferences = {
  temperatureUnit: TemperatureUnit;
  measurementSystem: MeasurementSystem;
  preferredYeastType: PreferredYeastType;
};

export type BeginnerRestoreData = {
  experienceLevel: UserExperienceLevel | null;
  preferences: BeginnerRestorePreferences;
  calculatorSettings: string | null;
  legacyBakeAt: string | null;
  beginnerPlanSnapshot: string | null;
};

export type BeginnerRestoreStorage = {
  getItem: (key: string) => Promise<string | null>;
};

export type BeginnerRestoreLoaders = {
  load: () => Promise<BeginnerRestoreData>;
};

export type PlannerNotificationRestoreStatus = 'pending' | 'ready' | 'unavailable';

type RestoreSchedule = { parsedSchedule: { bakeAt: Date } };

let plannerNotificationRestoreStatus: PlannerNotificationRestoreStatus = 'pending';
const plannerNotificationRestoreListeners = new Set<() => void>();

export function getPlannerNotificationRestoreStatus(): PlannerNotificationRestoreStatus {
  return plannerNotificationRestoreStatus;
}

export function subscribePlannerNotificationRestoreStatus(listener: () => void): () => void {
  plannerNotificationRestoreListeners.add(listener);
  return () => plannerNotificationRestoreListeners.delete(listener);
}

export function setPlannerNotificationRestoreStatus(status: PlannerNotificationRestoreStatus): void {
  if (plannerNotificationRestoreStatus === status) return;
  plannerNotificationRestoreStatus = status;
  plannerNotificationRestoreListeners.forEach((listener) => listener());
}

export function shouldReconcilePlannerNotifications(
  status: PlannerNotificationRestoreStatus,
  isBeginner: boolean,
  hasBakeAt: boolean,
  hasCurrentPlan: boolean,
): boolean {
  if (status === 'pending') return false;
  if (!hasBakeAt) return status === 'ready';
  if (isBeginner && status !== 'ready') return false;
  return hasCurrentPlan;
}

function decodeStoredScalar(value: string | null): string | null {
  if (value === null) return null;
  try {
    const decoded = JSON.parse(value);
    return typeof decoded === 'string' ? decoded : null;
  } catch {
    return value;
  }
}

function readExperienceLevel(value: string | null): UserExperienceLevel | null {
  const decoded = decodeStoredScalar(value);
  return decoded === 'beginner' || decoded === 'pro' ? decoded : null;
}

function readTemperatureUnit(value: string | null): TemperatureUnit {
  return decodeStoredScalar(value) === 'fahrenheit' ? 'fahrenheit' : 'celsius';
}

function readMeasurementSystem(value: string | null): MeasurementSystem {
  return decodeStoredScalar(value) === 'us' ? 'us' : 'metric';
}

function readPreferredYeastType(value: string | null): PreferredYeastType {
  return parsePreferredYeastType(decodeStoredScalar(value)) ?? 'fresh';
}

export function createBeginnerPlanRestoreLoaders(storage: BeginnerRestoreStorage): BeginnerRestoreLoaders {
  return {
    async load(): Promise<BeginnerRestoreData> {
      const [experienceLevel, temperatureUnit, measurementSystem, preferredYeastType, calculatorSettings, legacyBakeAt, beginnerPlanSnapshot] = await Promise.all([
        storage.getItem(EXPERIENCE_LEVEL_STORAGE_KEY),
        storage.getItem(TEMPERATURE_UNIT_STORAGE_KEY),
        storage.getItem(MEASUREMENT_SYSTEM_STORAGE_KEY),
        storage.getItem(PREFERRED_YEAST_TYPE_STORAGE_KEY),
        storage.getItem(CALCULATOR_SETTINGS_STORAGE_KEY),
        storage.getItem(BEGINNER_BAKE_AT_STORAGE_KEY),
        storage.getItem(BEGINNER_PLAN_SNAPSHOT_STORAGE_KEY),
      ]);
      return {
        experienceLevel: readExperienceLevel(experienceLevel),
        preferences: {
          temperatureUnit: readTemperatureUnit(temperatureUnit),
          measurementSystem: readMeasurementSystem(measurementSystem),
          preferredYeastType: readPreferredYeastType(preferredYeastType),
        },
        calculatorSettings,
        legacyBakeAt,
        beginnerPlanSnapshot,
      };
    },
  };
}

export function resolveBeginnerRestoreBakeAt(
  data: BeginnerRestoreData,
  storedPlan: RestoreSchedule | null,
  now: Date,
): Date | null | undefined {
  if (data.experienceLevel === 'pro') return undefined;
  let legacyBakeAt: Date | undefined;
  if (data.legacyBakeAt) {
    const parsedBakeAt = new Date(data.legacyBakeAt);
    const availableHours = (parsedBakeAt.getTime() - now.getTime()) / 3600000;
    if (Number.isFinite(parsedBakeAt.getTime()) && parsedBakeAt.getTime() > now.getTime() && availableHours >= 1) {
      legacyBakeAt = parsedBakeAt;
    }
  }
  if (legacyBakeAt && (!storedPlan || legacyBakeAt.getTime() !== storedPlan.parsedSchedule.bakeAt.getTime())) return legacyBakeAt;
  if (storedPlan && storedPlan.parsedSchedule.bakeAt.getTime() > now.getTime()) {
    return storedPlan.parsedSchedule.bakeAt;
  }
  if (storedPlan && storedPlan.parsedSchedule.bakeAt.getTime() <= now.getTime()) return null;
  return undefined;
}

export function createBeginnerPlanRestoreCoordinator() {
  let generation = 0;
  let mounted = true;

  return {
    activate(): void {
      mounted = true;
    },
    begin(): number {
      generation += 1;
      return generation;
    },
    invalidate(activeGeneration: number): void {
      if (generation === activeGeneration) generation += 1;
    },
    dispose(): void {
      mounted = false;
      generation += 1;
    },
    isCurrent(activeGeneration: number): boolean {
      return mounted && generation === activeGeneration;
    },
    async load(activeGeneration: number, loaders: BeginnerRestoreLoaders): Promise<BeginnerRestoreData | null> {
      const data = await loaders.load();
      return mounted && generation === activeGeneration ? data : null;
    },
  };
}
