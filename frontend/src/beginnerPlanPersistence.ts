export type BeginnerPlanMode = 'roomOnly' | 'fridgeRoom';

export type BeginnerPlanSnapshot = {
  version: 1;
  inputKey: string;
  bakeAt: string;
  calculationNow: string;
  mode: BeginnerPlanMode;
  schedule: Record<string, unknown>;
};

export const BEGINNER_PLAN_STORAGE_KEY = 'beginnerPlanSnapshot';
export const BEGINNER_PLAN_STORAGE_VERSION = 1;

const scheduleDateFields = ['startAt', 'bakeAt', 'preheatAt', 'ballingAt', 'doughReadyAt', 'fridgeAt'] as const;

export function serializeBeginnerSchedule<T extends object>(schedule: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schedule).map(([key, value]) => [
    key,
    value instanceof Date ? value.toISOString() : value,
  ]));
}

export function parseBeginnerSchedule<T>(
  value: unknown,
  isValidSchedule: (schedule: T) => boolean,
): T | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = { ...(value as Record<string, unknown>) } as Record<string, unknown>;
  for (const field of scheduleDateFields) {
    if (candidate[field] === undefined) continue;
    if (typeof candidate[field] !== 'string') return null;
    const parsed = new Date(candidate[field]);
    if (!Number.isFinite(parsed.getTime())) return null;
    candidate[field] = parsed;
  }
  if (!(candidate.startAt instanceof Date) || !(candidate.bakeAt instanceof Date)
    || typeof candidate.roomBeforeFridgeHours !== 'number'
    || typeof candidate.fridgeHours !== 'number'
    || typeof candidate.roomAfterFridgeHours !== 'number'
    || !isValidSchedule(candidate as unknown as T)) return null;
  return candidate as unknown as T;
}

export function parseBeginnerPlanSnapshot<T>(
  value: string | null,
  isValidSchedule: (schedule: T) => boolean,
): BeginnerPlanSnapshot & { parsedSchedule: T; parsedCalculationNow: Date } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BeginnerPlanSnapshot>;
    if (parsed.version !== BEGINNER_PLAN_STORAGE_VERSION || typeof parsed.inputKey !== 'string'
      || (parsed.mode !== 'roomOnly' && parsed.mode !== 'fridgeRoom')
      || typeof parsed.bakeAt !== 'string' || typeof parsed.calculationNow !== 'string') return null;
    const bakeAt = new Date(parsed.bakeAt);
    const calculationNow = new Date(parsed.calculationNow);
    const schedule = parseBeginnerSchedule(parsed.schedule, isValidSchedule);
    if (!Number.isFinite(bakeAt.getTime()) || !Number.isFinite(calculationNow.getTime()) || !schedule) return null;
    return {
      ...parsed,
      version: 1,
      mode: parsed.mode,
      inputKey: parsed.inputKey,
      bakeAt: parsed.bakeAt,
      calculationNow: parsed.calculationNow,
      schedule: parsed.schedule as Record<string, unknown>,
      parsedSchedule: schedule,
      parsedCalculationNow: calculationNow,
    };
  } catch {
    return null;
  }
}

export function isBeginnerPlanActive<T extends { bakeAt: Date }>(snapshot: { parsedSchedule: T }, now: Date): boolean {
  return snapshot.parsedSchedule.bakeAt.getTime() > now.getTime();
}

export function createBeginnerPlanInputKey(identity: readonly unknown[]): string {
  return JSON.stringify(identity);
}

export type BeginnerPlanIdentityInput = {
  bakeAt: number | null;
  pizzaStyle: string;
  romanFormat: string;
  pizzas: number;
  effectiveBall: number;
  roomTemp: number;
  fridgeTemp: number;
  oven: string;
  ovenTemp: number;
  flour: string;
  blendA: string | null;
  blendB: string | null;
  blendPctA: number | null;
  mixing: string;
  explicitFlourStrength: unknown;
  hydration: number;
  preferredYeastType: string;
  beginnerScheduleMode: string | undefined;
  diameter: number;
  isRomanTeglia: boolean;
  trayWidth: number;
  trayLength: number;
};

export function createBeginnerPlanInputKeyFromState(input: BeginnerPlanIdentityInput): string {
  return createBeginnerPlanInputKey([
    input.bakeAt,
    input.pizzaStyle,
    input.pizzaStyle === 'romana' ? input.romanFormat : null,
    input.pizzas,
    input.effectiveBall,
    input.roomTemp,
    input.fridgeTemp,
    input.oven,
    input.ovenTemp,
    input.flour,
    input.blendA,
    input.blendB,
    input.blendPctA,
    input.mixing,
    input.explicitFlourStrength,
    input.hydration,
    input.preferredYeastType,
    input.beginnerScheduleMode,
    input.diameter,
    input.isRomanTeglia ? input.trayWidth : null,
    input.isRomanTeglia ? input.trayLength : null,
  ]);
}
