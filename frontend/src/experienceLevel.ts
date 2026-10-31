// Single source of truth for the user's onboarding experience-level selection.
// Other screens (e.g. future Settings) should read/write via these exports only.
import { storage } from './utils/storage';
import { hasProAccess, loadProEntitlement, subscribeProEntitlement } from './proEntitlement';
import { resolveExperienceLevel } from './proBillingCore';

export type UserExperienceLevel = 'beginner' | 'pro';

const EXPERIENCE_LEVEL_KEY = 'userExperienceLevel';

function isValidLevel(value: unknown): value is UserExperienceLevel {
  return value === 'beginner' || value === 'pro';
}

// undefined = not loaded from storage yet, null = loaded but nothing (valid) stored
let cachedLevel: UserExperienceLevel | null | undefined;
const listeners = new Set<() => void>();

export function applyLoadedExperienceLevel(level: UserExperienceLevel | null): void {
  cachedLevel = level;
  listeners.forEach((listener) => listener());
}

export function getCachedExperienceLevel(): UserExperienceLevel | null | undefined {
  return resolveExperienceLevel(cachedLevel, hasProAccess());
}

export function subscribeExperienceLevel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

subscribeProEntitlement(() => listeners.forEach((listener) => listener()));

export async function loadExperienceLevel(): Promise<UserExperienceLevel | null> {
  await loadProEntitlement();
  const raw = await storage.getItem<string | null>(EXPERIENCE_LEVEL_KEY, null);
  const loadedLevel = isValidLevel(raw) ? raw : null;
  applyLoadedExperienceLevel(loadedLevel);
  return loadedLevel;
}

export async function setExperienceLevel(level: UserExperienceLevel): Promise<boolean> {
  if (level === 'pro' && !hasProAccess()) return false;
  const saved = await storage.setItem(EXPERIENCE_LEVEL_KEY, level);
  if (saved) {
    cachedLevel = level;
    listeners.forEach((listener) => listener());
  }
  return saved;
}
