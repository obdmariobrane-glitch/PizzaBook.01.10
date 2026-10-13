// Centralized, persisted, globally-readable user preferences (single source of truth).
// Reuses the same cache+subscribe+load+set shape as src/experienceLevel.ts.
import { storage } from './utils/storage';

export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type MeasurementSystem = 'metric' | 'us';
export type PreferredYeastType = 'fresh' | 'activeDry' | 'dry';

export function parsePreferredYeastType(value: unknown): PreferredYeastType | null {
  return value === 'fresh' || value === 'activeDry' || value === 'dry' ? value : null;
}

export type LoadedCalculatorPreferences = {
  temperatureUnit: TemperatureUnit;
  measurementSystem: MeasurementSystem;
  preferredYeastType: PreferredYeastType;
};

function createPreference<T extends string>(key: string, validValues: readonly T[], defaultValue: T) {
  let cached: T | undefined;
  const listeners = new Set<() => void>();
  const isValid = (value: unknown): value is T => validValues.includes(value as T);

  return {
    getCached: (): T | undefined => cached,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load: async (): Promise<T> => {
      const raw = await storage.getItem<string | null>(key, null);
      cached = isValid(raw) ? raw : defaultValue;
      listeners.forEach((listener) => listener());
      return cached;
    },
    apply: (value: T): void => {
      cached = value;
      listeners.forEach((listener) => listener());
    },
    set: async (value: T): Promise<boolean> => {
      cached = value;
      listeners.forEach((listener) => listener());
      return storage.setItem(key, value);
    },
  };
}

const temperatureUnitPref = createPreference<TemperatureUnit>('temperatureUnit', ['celsius', 'fahrenheit'], 'celsius');
const measurementSystemPref = createPreference<MeasurementSystem>('measurementSystem', ['metric', 'us'], 'metric');
const preferredYeastTypePref = createPreference<PreferredYeastType>('preferredYeastType', ['fresh', 'activeDry', 'dry'], 'fresh');

export const getCachedTemperatureUnit = temperatureUnitPref.getCached;
export const subscribeTemperatureUnit = temperatureUnitPref.subscribe;
export const loadTemperatureUnit = temperatureUnitPref.load;
export const setTemperatureUnit = temperatureUnitPref.set;

export const getCachedMeasurementSystem = measurementSystemPref.getCached;
export const subscribeMeasurementSystem = measurementSystemPref.subscribe;
export const loadMeasurementSystem = measurementSystemPref.load;
export const setMeasurementSystem = measurementSystemPref.set;

export const getCachedPreferredYeastType = preferredYeastTypePref.getCached;
export const subscribePreferredYeastType = preferredYeastTypePref.subscribe;
export const loadPreferredYeastType = preferredYeastTypePref.load;
export const setPreferredYeastType = preferredYeastTypePref.set;

export function applyLoadedCalculatorPreferences(preferences: LoadedCalculatorPreferences): void {
  temperatureUnitPref.apply(preferences.temperatureUnit);
  measurementSystemPref.apply(preferences.measurementSystem);
  preferredYeastTypePref.apply(preferences.preferredYeastType);
}
