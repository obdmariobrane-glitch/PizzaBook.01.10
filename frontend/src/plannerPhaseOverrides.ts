export type PlannerPhaseOverrides = Record<string, number>;
export type PlannerExperienceScope = 'beginner' | 'pro';

export type PlannerPhaseStep = {
  phaseKey: string;
  at: Date;
  title: string;
  desc: string;
};

export const PLANNER_PHASE_OVERRIDES_STORAGE_KEY = 'plannerPhaseOverrides';
export const PRO_PLANNER_BAKE_TARGET_STORAGE_KEY = 'proPlannerBakeAt';

export function parseProPlannerBakeTarget(serialized: string | null): Date | null {
  if (serialized === null) return null;
  const target = new Date(serialized);
  if (Number.isNaN(target.getTime()) || target.toISOString() !== serialized) return null;
  return target;
}

export function getPlannerPhaseOverridesStorageKey(
  scope: PlannerExperienceScope,
  scheduleIdentity?: string,
): string {
  const key = `${PLANNER_PHASE_OVERRIDES_STORAGE_KEY}:${scope}`;
  return scope === 'pro' && scheduleIdentity
    ? `${key}:${encodeURIComponent(scheduleIdentity)}`
    : key;
}

export function assignPlannerPhaseKeys<T extends { title: string }>(
  steps: T[],
  stableScope?: string,
  stableFallback = false,
): (T & { phaseKey: string })[] {
  const occurrences = new Map<string, number>();
  return steps.map((step, index) => {
    const stableId = 'phaseId' in step && typeof step.phaseId === 'string' ? step.phaseId : null;
    if (stableScope && stableId) {
      return { ...step, phaseKey: `${stableScope}:${stableId}` };
    }
    const occurrence = occurrences.get(step.title) ?? 0;
    occurrences.set(step.title, occurrence + 1);
    const fallbackKey = stableScope && stableFallback
      ? `${stableScope}:step:${index}:${occurrence}`
      : `${step.title}\u001f${occurrence}${stableScope ? `:${index}` : ''}`;
    return { ...step, phaseKey: fallbackKey };
  });
}

export function parsePlannerPhaseOverrides(serialized: string | null): PlannerPhaseOverrides {
  if (!serialized) return {};
  const parsed: unknown = JSON.parse(serialized);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('Saved Planner phase overrides must be an object.');
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(([key, at]) => key.length > 0 && typeof at === 'number' && Number.isFinite(at)),
  );
}

export function applyPlannerPhaseOverrides<T extends { phaseKey: string; at: Date }>(
  steps: T[],
  overrides: PlannerPhaseOverrides,
): T[] {
  return steps
    .map((step) => {
      const overriddenAt = overrides[step.phaseKey];
      return typeof overriddenAt === 'number' && Number.isFinite(overriddenAt)
        ? { ...step, at: new Date(overriddenAt) }
        : step;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function retainCurrentPlannerPhaseOverrides(
  overrides: PlannerPhaseOverrides,
  steps: { phaseKey: string }[],
): PlannerPhaseOverrides {
  const currentKeys = new Set(steps.map((step) => step.phaseKey));
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => currentKeys.has(key)));
}
