// Single source of truth for the user's onboarding experience-level selection.
// Other screens (e.g. future Settings) should read/write via these exports only.
import { storage } from './utils/storage';

export type UserExperienceLevel = 'beginner' | 'pro';

const EXPERIENCE_LEVEL_KEY = 'userExperienceLevel';

function isValidLevel(value: unknown): value is UserExperienceLevel {
  return value === 'beginner' || value === 'pro';
}

// undefined = not loaded from storage yet, null = loaded but nothing (valid) stored
let cachedLevel: UserExperienceLevel | null | undefined;
const listeners = new Set<() => void>();

export function getCachedExperienceLevel(): UserExperienceLevel | null | undefined {
  return cachedLevel;
}

export function subscribeExperienceLevel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadExperienceLevel(): Promise<UserExperienceLevel | null> {
  const raw = await storage.getItem<string | null>(EXPERIENCE_LEVEL_KEY, null);
  cachedLevel = isValidLevel(raw) ? raw : null;
  listeners.forEach((listener) => listener());
  return cachedLevel;
}

export async function setExperienceLevel(level: UserExperienceLevel): Promise<boolean> {
  cachedLevel = level;
  listeners.forEach((listener) => listener());
  return storage.setItem(EXPERIENCE_LEVEL_KEY, level);
}
