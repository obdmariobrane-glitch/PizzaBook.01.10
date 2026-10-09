// Pizza calculator logic
export type Method = 'direct' | 'biga' | 'poolish';
export type YeastType = 'fresh' | 'dry' | 'sourdough';
export type Mixing = 'hand' | 'home' | 'spiral';
export type Fermentation = 'sameDay' | 'coldLong';
export type OvenType = 'ooni' | 'homeStone' | 'homePan';
export type PizzaStyle = 'neapolitan' | 'romana' | 'ny_style';
export type BakingLanguage = 'hr' | 'en' | 'de' | 'sl';
export type BeginnerDirectDoughStyle = 'neapolitan' | 'newYork' | 'romanaTonda' | 'romanaTeglia';
export type BeginnerDirectMixing = 'hand' | 'home' | 'spiral';
export type BeginnerPhaseBFlourBehavior = 'standard' | 'gentle' | 'glutenFree';
export type BeginnerPhaseBWorkflow = 'round' | 'teglia';

export interface BeginnerPhaseBFold {
  index: 1 | 2;
  offsetMinutes: number;
}

export interface BeginnerPhaseBPlan {
  durationMinutes: number;
  foldCount: number;
  folds: BeginnerPhaseBFold[];
  finalRestMinutes: number;
  behavior: BeginnerPhaseBFlourBehavior;
  workflow: BeginnerPhaseBWorkflow;
}

export const BEGINNER_PHASE_B_MIN_FOLD_WINDOW_MINUTES = 45;
export const BEGINNER_PHASE_B_FIRST_FOLD_OFFSET_MINUTES = 20;
export const BEGINNER_PHASE_B_SECOND_FOLD_OFFSET_MINUTES = 50;
export const BEGINNER_PHASE_B_TWO_FOLD_WINDOW_MINUTES = 90;

export function calculateBeginnerPhaseBPlan(input: {
  durationMinutes: number;
  flourBehavior: BeginnerPhaseBFlourBehavior;
  workflow: BeginnerPhaseBWorkflow;
}): BeginnerPhaseBPlan {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0) {
    throw new RangeError('Beginner Phase-B duration must be a non-negative finite number.');
  }
  const durationMinutes = Math.max(0, Math.floor(input.durationMinutes));
  if (input.flourBehavior === 'glutenFree' || durationMinutes < BEGINNER_PHASE_B_MIN_FOLD_WINDOW_MINUTES) {
    return {
      durationMinutes,
      foldCount: 0,
      folds: [],
      finalRestMinutes: durationMinutes,
      behavior: input.flourBehavior,
      workflow: input.workflow,
    };
  }

  const folds: BeginnerPhaseBFold[] = durationMinutes >= BEGINNER_PHASE_B_TWO_FOLD_WINDOW_MINUTES
    ? [
      { index: 1, offsetMinutes: BEGINNER_PHASE_B_FIRST_FOLD_OFFSET_MINUTES },
      { index: 2, offsetMinutes: BEGINNER_PHASE_B_SECOND_FOLD_OFFSET_MINUTES },
    ]
    : [{ index: 1, offsetMinutes: BEGINNER_PHASE_B_FIRST_FOLD_OFFSET_MINUTES }];
  const finalRestMinutes = durationMinutes - folds[folds.length - 1].offsetMinutes;
  return {
    durationMinutes,
    foldCount: folds.length,
    folds,
    finalRestMinutes,
    behavior: input.flourBehavior,
    workflow: input.workflow,
  };
}

// Use current target ranges' midpoints; New York's 24°C target was explicitly selected for this model.
export const BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C: Record<BeginnerDirectDoughStyle, number> = {
  neapolitan: 24,
  newYork: 24,
  romanaTonda: 22,
  romanaTeglia: 22,
};

// Conservative starting assumptions for home mixing; calibrate with measured dough temperatures.
export const BEGINNER_DIRECT_MIXING_FRICTION_C: Record<BeginnerDirectMixing, number> = {
  hand: 2,
  home: 10,
  spiral: 7,
};

// Beginner recommendations stay within practical water temperatures; ice remains disabled.
export const BEGINNER_DIRECT_WATER_TEMP_LIMITS_C = { min: 2, max: 35 } as const;

export interface BeginnerDirectWaterTemperature {
  targetFinalDoughTemp: number;
  roomTemp: number;
  flourTemp: number;
  mixing: BeginnerDirectMixing;
  frictionFactor: number;
  calculatedWaterTemp: number;
  recommendedWaterTemp: number;
  minimumWaterTemp: number;
  maximumWaterTemp: number;
  wasClamped: boolean;
  appliedLimit: 'minimum' | 'maximum' | null;
}

export function calculateBeginnerDirectWaterTemperature(input: {
  style: BeginnerDirectDoughStyle;
  roomTemp: number;
  mixing: BeginnerDirectMixing;
  flourTemp?: number;
}): BeginnerDirectWaterTemperature {
  const flourTemp = input.flourTemp ?? input.roomTemp;
  if (!Number.isFinite(input.roomTemp) || !Number.isFinite(flourTemp)) {
    throw new RangeError('Room and flour temperatures must be finite numbers.');
  }

  const targetFinalDoughTemp = BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C[input.style];
  const frictionFactor = BEGINNER_DIRECT_MIXING_FRICTION_C[input.mixing];
  const calculatedWaterTemp = (targetFinalDoughTemp * 3) - input.roomTemp - flourTemp - frictionFactor;
  const { min, max } = BEGINNER_DIRECT_WATER_TEMP_LIMITS_C;
  const limitedWaterTemp = Math.max(min, Math.min(max, calculatedWaterTemp));
  const appliedLimit = calculatedWaterTemp < min
    ? 'minimum'
    : calculatedWaterTemp > max
      ? 'maximum'
      : null;

  return {
    targetFinalDoughTemp,
    roomTemp: input.roomTemp,
    flourTemp,
    mixing: input.mixing,
    frictionFactor,
    calculatedWaterTemp,
    recommendedWaterTemp: Math.round(limitedWaterTemp),
    minimumWaterTemp: min,
    maximumWaterTemp: max,
    wasClamped: appliedLimit !== null,
    appliedLimit,
  };
}

export interface BakingTimeRange {
  min: number;
  max: number;
}

const BAKING_TIME_POINTS: Record<OvenType, { temperature: number; min: number; max: number }[]> = {
  homePan: [{ temperature: 200, min: 15, max: 20 }, { temperature: 220, min: 13, max: 17 }, { temperature: 230, min: 12, max: 15 }, { temperature: 250, min: 10, max: 14 }, { temperature: 270, min: 8, max: 12 }, { temperature: 280, min: 7, max: 11 }, { temperature: 300, min: 6, max: 9 }],
  ooni: [{ temperature: 350, min: 3, max: 4 }, { temperature: 400, min: 2, max: 3 }, { temperature: 450, min: 1, max: 1.5 }, { temperature: 480, min: 0.75, max: 1.25 }],
  homeStone: [{ temperature: 200, min: 9, max: 13 }, { temperature: 220, min: 8, max: 11 }, { temperature: 230, min: 7, max: 10 }, { temperature: 250, min: 5, max: 8 }, { temperature: 270, min: 4, max: 6 }, { temperature: 280, min: 3.5, max: 5 }, { temperature: 300, min: 3, max: 4.5 }],
};

export function getBakingTimeRange(oven: OvenType, temperature: number): BakingTimeRange {
  const points = BAKING_TIME_POINTS[oven];
  const value = Math.max(points[0].temperature, Math.min(points[points.length - 1].temperature, temperature));
  const upperIndex = points.findIndex((point) => point.temperature >= value);
  if (upperIndex <= 0) return { min: points[0].min, max: points[0].max };
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const ratio = (value - lower.temperature) / (upper.temperature - lower.temperature);
  return {
    min: lower.min + (upper.min - lower.min) * ratio,
    max: lower.max + (upper.max - lower.max) * ratio,
  };
}

export function formatBakingTimeRange(oven: OvenType, temperature: number, lang: BakingLanguage): string {
  const range = getBakingTimeRange(oven, temperature);
  const format = (minutes: number) => {
    const rounded = Math.round(minutes * 4) / 4;
    const secondsUnit = lang === 'de' ? 'Sek.' : 's';
    const minutesUnit = lang === 'de' ? 'Min.' : 'min';
    if (rounded < 2) return `${Math.round(rounded * 60)} ${secondsUnit}`;
    const value = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false }).format(rounded);
    return `${value} ${minutesUnit}`;
  };
  return `${format(range.min)}–${format(range.max)}`;
}

export interface HomePizzaPlanInput {
  style: PizzaStyle;
  romanFormat?: 'tonda' | 'teglia';
  pizzas: number;
  ballWeight: number;
  method: Method;
  bakeAt: Date;
  roomTemp: number;
  fridgeTemp: number;
  ovenType: OvenType;
  ovenTemp?: number;
  flourType?: FlourType;
  mixing?: BeginnerDirectMixing;
  beginnerScheduleMode?: BeginnerDirectScheduleMode;
}

export type BeginnerDirectScheduleMode = 'roomOnly' | 'fridgeRoom';

export interface HomePizzaPlanSchedule {
  startAt: Date;
  bakeAt: Date;
  preheatAt?: Date;
  ballingAt?: Date;
  strategy?: HomeFermentationStrategy;
  style?: PizzaStyle;
  romanFormat?: 'tonda' | 'teglia';
  ovenType?: OvenType;
  ovenTemp?: number;
  roomTemp?: number;
  fridgeTemp?: number;
  ballWeight?: number;
  glutenFree?: boolean;
  roomBeforeFridgeHours: number;
  fridgeHours: number;
  roomAfterFridgeHours: number;
  prefermentHours: number;
  doughReadyAt?: Date;
  fridgeAt?: Date;
  phaseAMinutes?: number;
  phaseBMinutes?: number;
  phaseCMinutes?: number;
  thermalUncertainty?: string;
  limitations?: string[];
}

export interface HomePizzaPlan {
  input: HomePizzaPlanInput;
  schedule: HomePizzaPlanSchedule;
  selectedEvaluation: DirectHomeCandidateEvaluation;
  candidateEvaluations?: DirectHomeCandidateEvaluation[];
}

let sharedHomeBakeAt: Date | null = null;
const sharedHomeBakeAtListeners = new Set<() => void>();

export function getSharedHomeBakeAt(): Date | null {
  return sharedHomeBakeAt;
}

export function setSharedHomeBakeAt(bakeAt: Date | null): void {
  const next = bakeAt === null ? null : new Date(bakeAt.getTime());
  if (sharedHomeBakeAt?.getTime() === next?.getTime()) return;
  sharedHomeBakeAt = next;
  sharedHomeBakeAtListeners.forEach((listener) => listener());
}

let sharedHomeDirectSchedule: HomePizzaPlanSchedule | null = null;
const sharedHomeDirectScheduleListeners = new Set<() => void>();
let sharedHomeBigaSchedule: BigaHomePizzaSchedule | null = null;
const sharedHomeBigaScheduleListeners = new Set<() => void>();
let sharedHomePoolishSchedule: PoolishHomePizzaSchedule | null = null;
const sharedHomePoolishScheduleListeners = new Set<() => void>();

export function getSharedHomeDirectSchedule(): HomePizzaPlanSchedule | null {
  return sharedHomeDirectSchedule;
}

export function setSharedHomeDirectSchedule(schedule: HomePizzaPlanSchedule | null): void {
  if (sharedHomeDirectSchedule === schedule) return;
  sharedHomeDirectSchedule = schedule;
  sharedHomeDirectScheduleListeners.forEach((listener) => listener());
}

export function subscribeSharedHomeDirectSchedule(listener: () => void): () => void {
  sharedHomeDirectScheduleListeners.add(listener);
  return () => sharedHomeDirectScheduleListeners.delete(listener);
}

export function getSharedHomeBigaSchedule(): BigaHomePizzaSchedule | null {
  return sharedHomeBigaSchedule;
}

export function setSharedHomeBigaSchedule(schedule: BigaHomePizzaSchedule | null): void {
  if (sharedHomeBigaSchedule === schedule) return;
  sharedHomeBigaSchedule = schedule;
  sharedHomeBigaScheduleListeners.forEach((listener) => listener());
}

export function subscribeSharedHomeBigaSchedule(listener: () => void): () => void {
  sharedHomeBigaScheduleListeners.add(listener);
  return () => sharedHomeBigaScheduleListeners.delete(listener);
}

export function getSharedHomePoolishSchedule(): PoolishHomePizzaSchedule | null {
  return sharedHomePoolishSchedule;
}

export function setSharedHomePoolishSchedule(schedule: PoolishHomePizzaSchedule | null): void {
  if (sharedHomePoolishSchedule === schedule) return;
  sharedHomePoolishSchedule = schedule;
  sharedHomePoolishScheduleListeners.forEach((listener) => listener());
}

export function subscribeSharedHomePoolishSchedule(listener: () => void): () => void {
  sharedHomePoolishScheduleListeners.add(listener);
  return () => sharedHomePoolishScheduleListeners.delete(listener);
}

export function subscribeSharedHomeBakeAt(listener: () => void): () => void {
  sharedHomeBakeAtListeners.add(listener);
  return () => sharedHomeBakeAtListeners.delete(listener);
}

export function getHomePlanLegacyFermentationHours(
  plan: HomePizzaPlan | null,
  legacyRoomHours: number,
  legacyFridgeHours: number,
): { roomHours: number; fridgeHours: number } {
  if (!plan) return { roomHours: legacyRoomHours, fridgeHours: legacyFridgeHours };
  return {
    roomHours: plan.schedule.roomBeforeFridgeHours + plan.schedule.roomAfterFridgeHours,
    fridgeHours: plan.schedule.fridgeHours,
  };
}

export function getHomeScheduleDurationHours(schedule: HomePizzaPlanSchedule): number {
  return [
    schedule.prefermentHours,
    schedule.roomBeforeFridgeHours,
    schedule.fridgeHours,
    schedule.roomAfterFridgeHours,
  ].reduce((total, hours) => total + Math.max(0, hours), 0);
}

export function isHomeScheduleDurationValid(schedule: HomePizzaPlanSchedule): boolean {
  const durationHours = getHomeScheduleDurationHours(schedule);
  const intervalHours = (schedule.bakeAt.getTime() - schedule.startAt.getTime()) / (1000 * 60 * 60);
  if (schedule.ballingAt) {
    const expectedBallingAt = schedule.startAt.getTime() + schedule.roomBeforeFridgeHours * 3600000;
    if (Math.abs(schedule.ballingAt.getTime() - expectedBallingAt) > 1000) return false;
  }
  return Math.abs(durationHours - intervalHours) <= 1e-6;
}

export function getAvailableFermentationHours(bakeAt: Date, now: Date): number {
  return Math.max(0, (bakeAt.getTime() - now.getTime()) / (1000 * 60 * 60));
}

export type HomeFermentationWindow = 'invalid' | 'sameDay' | 'overnight' | 'long';

export function getHomeFermentationWindow(availableHours: number): HomeFermentationWindow {
  if (availableHours <= 0) return 'invalid';
  if (availableHours < 12) return 'sameDay';
  if (availableHours < 36) return 'overnight';
  return 'long';
}

export type BeginnerDirectHomeStrategy = 'roomOnly' | 'hybrid' | 'coldDominant';

export const BEGINNER_DIRECT_PHASE_A_MINUTES = 20;
export const BEGINNER_DIRECT_PHASE_C_MINUTES = 5;
export const BEGINNER_DIRECT_MIN_FRIDGE_HOURS = 3;

export function getBeginnerDirectFinalRoomTargetHours(roomTemp: number): number | null {
  if (!Number.isFinite(roomTemp) || roomTemp < 18 || roomTemp > 26) return null;
  if (roomTemp <= 22) return 3 - (roomTemp - 18) * 0.25;
  return 2 - (roomTemp - 22) * 0.125;
}

export interface BeginnerDirectScheduleCandidate extends DirectHomeFermentationCandidate {
  mode: BeginnerDirectScheduleMode;
  phaseAMinutes: number;
  phaseBMinutes: 0 | 60 | 90;
  phaseCMinutes: number;
  doughReadyAt?: Date;
  fridgeAt?: Date;
  thermalUncertainty?: string;
  limitations: string[];
  startAt: Date;
  ballingAt: Date;
}

function createBeginnerDirectScheduleCandidate(
  mode: BeginnerDirectScheduleMode,
  availableHours: number,
  roomTemp: number,
  bakeAt: Date,
): BeginnerDirectScheduleCandidate {
  const fixedHours = (BEGINNER_DIRECT_PHASE_A_MINUTES + BEGINNER_DIRECT_PHASE_C_MINUTES) / 60;
  const finalRoomTarget = getBeginnerDirectFinalRoomTargetHours(roomTemp);
  const limitations: string[] = [];
  let phaseBMinutes: 0 | 60 | 90 = availableHours >= 3 ? 90 : availableHours >= 2 ? 60 : 0;
  let fridgeHours = 0;
  let roomAfterFridgeHours = 0;

  if (mode === 'fridgeRoom') {
    if (finalRoomTarget === null) {
      limitations.push('Final room target is only defined provisionally for 18–26°C.');
    } else {
      const remaining = availableHours - fixedHours - phaseBMinutes / 60 - finalRoomTarget;
      if (remaining >= BEGINNER_DIRECT_MIN_FRIDGE_HOURS) {
        fridgeHours = remaining;
        roomAfterFridgeHours = finalRoomTarget;
      } else {
        phaseBMinutes = 0;
        const adjustedRemaining = availableHours - fixedHours - finalRoomTarget;
        if (adjustedRemaining >= BEGINNER_DIRECT_MIN_FRIDGE_HOURS) {
          fridgeHours = adjustedRemaining;
          roomAfterFridgeHours = finalRoomTarget;
        } else {
          limitations.push('Fridge + room requires at least 3 hours in the fridge plus the provisional final room target.');
        }
      }
    }
  }

  const roomBeforeFridgeHours = (BEGINNER_DIRECT_PHASE_A_MINUTES + phaseBMinutes + BEGINNER_DIRECT_PHASE_C_MINUTES) / 60;
  if (mode === 'roomOnly') roomAfterFridgeHours = Math.max(0, availableHours - roomBeforeFridgeHours);
  const thermalUncertainty = mode === 'fridgeRoom'
    ? 'Thermal uncertainty: dough cools and warms gradually; this schedule does not model core temperature.'
    : undefined;
  const totalHours = roomBeforeFridgeHours + fridgeHours + roomAfterFridgeHours;
  const startAt = new Date(bakeAt.getTime() - totalHours * 3600000);
  const ballingAt = new Date(startAt.getTime() + (BEGINNER_DIRECT_PHASE_A_MINUTES + phaseBMinutes) * 60000);
  const fridgeAt = new Date(ballingAt.getTime() + BEGINNER_DIRECT_PHASE_C_MINUTES * 60000);
  const doughReadyAt = new Date(bakeAt.getTime());

  if (availableHours < 2) limitations.push('Very short schedule: full fermentation is not promised.');
  if (phaseBMinutes === 0) limitations.push('Stretch & Fold skipped because the available window is too short.');
  if (mode === 'fridgeRoom' && finalRoomTarget === null) limitations.push('Room temperature is outside the provisional 18–26°C target range.');

  return {
    strategy: mode === 'roomOnly' ? 'roomOnly' : 'hybrid',
    mode,
    roomBeforeFridgeHours,
    fridgeHours,
    roomAfterFridgeHours,
    phaseAMinutes: BEGINNER_DIRECT_PHASE_A_MINUTES,
    phaseBMinutes,
    phaseCMinutes: BEGINNER_DIRECT_PHASE_C_MINUTES,
    status: limitations.length > 0 && (mode === 'fridgeRoom' && fridgeHours < BEGINNER_DIRECT_MIN_FRIDGE_HOURS) ? 'unsupported' : 'acceptable',
    warnings: limitations,
    limitations,
    startAt,
    ballingAt,
    fridgeAt,
    doughReadyAt,
    thermalUncertainty,
  } as BeginnerDirectScheduleCandidate;
}

export function generateBeginnerDirectScheduleCandidates(
  availableHours: number,
  roomTemp: number,
  bakeAt: Date,
): BeginnerDirectScheduleCandidate[] {
  if (!Number.isFinite(availableHours) || availableHours <= 0) return [];
  return [
    createBeginnerDirectScheduleCandidate('roomOnly', availableHours, roomTemp, bakeAt),
    createBeginnerDirectScheduleCandidate('fridgeRoom', availableHours, roomTemp, bakeAt),
  ];
}

export function selectBeginnerDirectHomeStrategy(
  availableHours: number,
  roomTemp: number,
): BeginnerDirectHomeStrategy {
  if (roomTemp >= 26 && availableHours >= 5) return 'coldDominant';
  if (availableHours <= 5) return 'roomOnly';
  if (roomTemp <= 20 && availableHours <= 12) return 'roomOnly';
  if (availableHours <= 18) return 'hybrid';
  return 'coldDominant';
}

export type HomeFermentationStrategy = 'roomOnly' | 'hybrid' | 'coldDominant' | 'extraCold' | 'controlled';

export type HomeFermentationWorkflow = 'ballsColdFermented';

export interface HomeFermentationPhasePolicy {
  workflow: HomeFermentationWorkflow;
  preferredRoomAfterHours: number;
  confidence: HomeDoughToleranceConfidence;
}

// Provisional V1 reference from a documented balls-before-cold New York workflow; not a hard maximum or universal optimum.
export const DIRECT_HOME_BALLS_COLD_FERMENTED_POLICY: HomeFermentationPhasePolicy = {
  workflow: 'ballsColdFermented',
  preferredRoomAfterHours: 3,
  confidence: 'low',
};

export type HomeFermentationStatus = 'optimal' | 'acceptable' | 'warning' | 'unsupported';

export interface DirectHomeFermentationCandidate {
  strategy: HomeFermentationStrategy;
  roomBeforeFridgeHours: number;
  fridgeHours: number;
  roomAfterFridgeHours: number;
  status: HomeFermentationStatus;
  warnings: string[];
}

export interface DirectHomeCandidateEvaluation {
  candidate: DirectHomeFermentationCandidate;
  stressSignal: HomeFermentationStressSignal;
  yeastRequirement: DirectHomeYeastRequirement;
  yeastMeasurement: HomeYeastMeasurementAssessment;
  baseResilience: HomeDoughBaseResilienceAssessment;
  domain: HomeDoughDomainValidationResult;
  selectable: boolean;
  rejectionReasons: string[];
  recommended?: boolean;
  recommendationReason?: string;
}

export interface DirectHomeFermentationExposure {
  roomBeforeExposure: number;
  fridgeExposure: number;
  roomAfterExposure: number;
  roomExposure: number;
  totalExposure: number;
}

export interface DirectHomeYeastRequirement {
  freshYeastPct: number;
  dryYeastPct: number;
  freshYeastGramsPer1000gFlour: number;
  dryYeastGramsPer1000gFlour: number;
}

export type HomeYeastMeasurementStatus = 'easy' | 'precisionScale' | 'dilutionRecommended';

export interface HomeYeastMeasurementAssessment {
  grams: number;
  status: HomeYeastMeasurementStatus;
}

export type HomeFlourTolerance = 'low' | 'medium' | 'high';

export interface HomeFlourToleranceAssessment {
  tolerance: HomeFlourTolerance;
}

export type HomeDoughTolerance = 'comfortable' | 'borderline' | 'overstressed';

export type HomeDoughToleranceConfidence = 'high' | 'medium' | 'low';

export interface HomeDoughToleranceAssessment {
  tolerance: HomeDoughTolerance;
  confidence: HomeDoughToleranceConfidence;
}

export type HomeFlourCapability = 'low' | 'medium' | 'high';

export type HomeHydrationLoad = 'low' | 'medium' | 'high';

export type HomeDoughBaseResilience = 'low' | 'medium' | 'high';

export interface HomeDoughBaseResilienceAssessment {
  flourCapability: HomeFlourCapability | null;
  hydrationLoad: HomeHydrationLoad | null;
  resilience: HomeDoughBaseResilience | null;
  confidence: HomeDoughToleranceConfidence;
}

export interface FlourStrengthMetadata {
  w?: number;
  proteinPct?: number;
}

export function calculateHomeFlourCapability(
  flour: NormalizedHomeFlourStrength,
): HomeFlourCapability | null {
  if (flour.source === 'w') {
    const w = flour.w;
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 160 || w > 450) return null;
    if (w < 220) return 'low';
    if (w < 360) return 'medium';
    return 'high';
  }

  if (flour.source === 'protein') {
    const proteinPct = flour.proteinPct;
    if (typeof proteinPct !== 'number' || !Number.isFinite(proteinPct) || proteinPct < 10 || proteinPct > 16) return null;
    if (proteinPct < 11.5) return 'low';
    return 'medium';
  }

  return null;
}

export function calculateHomeHydrationLoad(
  capability: HomeFlourCapability,
  hydrationPct: number,
): HomeHydrationLoad | null {
  if (!Number.isFinite(hydrationPct) || hydrationPct < 40 || hydrationPct > 85) return null;

  if (capability === 'low') {
    if (hydrationPct <= 55) return 'low';
    if (hydrationPct <= 65) return 'medium';
    return 'high';
  }

  if (capability === 'medium') {
    if (hydrationPct <= 65) return 'low';
    if (hydrationPct <= 75) return 'medium';
    return 'high';
  }

  if (hydrationPct <= 70) return 'low';
  if (hydrationPct <= 80) return 'medium';
  return 'high';
}

export function calculateHomeDoughBaseResilience(
  capability: HomeFlourCapability,
  hydrationLoad: HomeHydrationLoad,
): HomeDoughBaseResilience {
  if (capability === 'low') return hydrationLoad === 'low' ? 'medium' : 'low';
  if (capability === 'medium') {
    if (hydrationLoad === 'low') return 'high';
    return hydrationLoad === 'medium' ? 'medium' : 'low';
  }
  return hydrationLoad === 'high' ? 'medium' : 'high';
}

export function assessHomeDoughBaseResilience(
  input: NormalizedHomeDoughToleranceInput,
  conservativeUnknownFlour = false,
): HomeDoughBaseResilienceAssessment {
  const confidence = input.flour.source === 'w' ? 'medium' : 'low';
  const flourCapability = calculateHomeFlourCapability(input.flour)
    ?? (conservativeUnknownFlour && input.flour.source === 'unknown' ? 'low' : null);
  if (flourCapability === null) {
    return { flourCapability: null, hydrationLoad: null, resilience: null, confidence };
  }

  const hydrationLoad = calculateHomeHydrationLoad(flourCapability, input.hydrationPct);
  if (hydrationLoad === null) {
    return { flourCapability, hydrationLoad: null, resilience: null, confidence };
  }

  return {
    flourCapability,
    hydrationLoad,
    resilience: calculateHomeDoughBaseResilience(flourCapability, hydrationLoad),
    confidence,
  };
}

export type HomeFermentationPhaseStress = 'low' | 'medium' | 'high';

export type HomeFermentationStress = 'low' | 'medium' | 'high';

export interface HomeFermentationStressAssessment {
  warmBeforeStress: HomeFermentationPhaseStress;
  coldStress: HomeFermentationPhaseStress;
  warmAfterStress: HomeFermentationPhaseStress;
  stress: HomeFermentationStress;
  confidence: HomeDoughToleranceConfidence;
}

export interface HomeFermentationStressSignal {
  warmBefore: number;
  cold: number;
  warmAfter: number;
  total: number;
}

export type HomeDoughCalibrationOutcome = 'stable' | 'borderline' | 'failed';

export interface HomeDoughCalibrationFlour {
  w?: number;
  proteinPct?: number;
  pL?: number;
}

export interface HomeDoughCalibrationCase {
  flour: HomeDoughCalibrationFlour;
  hydrationPct: number;
  roomTemp: number;
  fridgeTemp: number;
  roomBeforeFridgeHours: number;
  fridgeHours: number;
  roomAfterFridgeHours: number;
  outcome: HomeDoughCalibrationOutcome;
}

export type HomeFlourStrengthSource = 'w' | 'protein' | 'unknown';

export interface HomeFlourStrengthInput {
  source: HomeFlourStrengthSource;
  w?: number;
  proteinPct?: number;
}

export interface HomeDoughToleranceInput {
  flour: HomeFlourStrengthInput;
  hydrationPct: number;
  roomTemp: number;
  fridgeTemp: number;
  roomBeforeFridgeHours: number;
  fridgeHours: number;
  roomAfterFridgeHours: number;
}

export interface NormalizedHomeDoughToleranceInput {
  flour: NormalizedHomeFlourStrength;
  hydrationPct: number;
  roomTemp: number;
  fridgeTemp: number;
  roomBeforeFridgeHours: number;
  fridgeHours: number;
  roomAfterFridgeHours: number;
}

export type HomeDoughToleranceValidationIssue =
  | 'missingFlourStrength'
  | 'missingHydration'
  | 'missingFermentationTime';

export interface HomeDoughToleranceValidationResult {
  valid: boolean;
  issues: HomeDoughToleranceValidationIssue[];
}

export type HomeDoughDomainStatus = 'supported' | 'unusual' | 'unsupported';

export type HomeDoughDomainIssue =
  | 'flourStrengthUnusual'
  | 'flourStrengthUnsupported'
  | 'proteinUnusual'
  | 'proteinUnsupported'
  | 'hydrationUnusual'
  | 'hydrationUnsupported'
  | 'roomTemperatureUnusual'
  | 'roomTemperatureUnsupported'
  | 'fridgeTemperatureUnusual'
  | 'fridgeTemperatureUnsupported'
  | 'totalDurationUnusual'
  | 'totalDurationUnsupported'
  | 'roomPhaseUnusual'
  | 'roomPhaseUnsupported'
  | 'coldPhaseUnusual'
  | 'coldPhaseUnsupported';

export interface HomeDoughDomainValidationResult {
  status: HomeDoughDomainStatus;
  issues: HomeDoughDomainIssue[];
}

export type NormalizedHomeFlourStrengthSource = 'w' | 'protein' | 'unknown';

export interface NormalizedHomeFlourStrength {
  source: NormalizedHomeFlourStrengthSource;
  w?: number;
  proteinPct?: number;
  confidence: HomeDoughToleranceConfidence;
}

export function normalizeHomeDoughToleranceInput(
  input: HomeDoughToleranceInput,
): NormalizedHomeDoughToleranceInput {
  const positiveFinite = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
  const finite = (value: number) => Number.isFinite(value) ? value : 0;

  return {
    flour: normalizeHomeFlourStrength(input.flour),
    hydrationPct: positiveFinite(input.hydrationPct),
    roomTemp: finite(input.roomTemp),
    fridgeTemp: finite(input.fridgeTemp),
    roomBeforeFridgeHours: positiveFinite(input.roomBeforeFridgeHours),
    fridgeHours: positiveFinite(input.fridgeHours),
    roomAfterFridgeHours: positiveFinite(input.roomAfterFridgeHours),
  };
}

export function validateHomeDoughToleranceInput(
  input: NormalizedHomeDoughToleranceInput,
): HomeDoughToleranceValidationResult {
  const issues: HomeDoughToleranceValidationIssue[] = [];
  if (input.flour.source === 'unknown') issues.push('missingFlourStrength');
  if (input.hydrationPct <= 0) issues.push('missingHydration');

  const totalHours = input.roomBeforeFridgeHours + input.fridgeHours + input.roomAfterFridgeHours;
  if (totalHours <= 0) issues.push('missingFermentationTime');

  return { valid: issues.length === 0, issues };
}

export function validateHomeDoughDomain(
  input: NormalizedHomeDoughToleranceInput,
): HomeDoughDomainValidationResult {
  const issues: HomeDoughDomainIssue[] = [];
  const addIssue = (issue: HomeDoughDomainIssue) => {
    if (!issues.includes(issue)) issues.push(issue);
  };

  if (input.flour.source === 'w') {
    const w = input.flour.w ?? 0;
    if (w < 160 || w > 450) addIssue('flourStrengthUnsupported');
    else if (w < 220 || w > 380) addIssue('flourStrengthUnusual');
  } else if (input.flour.source === 'protein') {
    const proteinPct = input.flour.proteinPct ?? 0;
    if (proteinPct < 10 || proteinPct > 16) addIssue('proteinUnsupported');
    else if (proteinPct < 11.5 || proteinPct > 14.5) addIssue('proteinUnusual');
  }

  if (input.hydrationPct < 40 || input.hydrationPct > 85) addIssue('hydrationUnsupported');
  else if (input.hydrationPct < 50 || input.hydrationPct > 80) addIssue('hydrationUnusual');

  if (input.roomTemp < 10 || input.roomTemp > 35) addIssue('roomTemperatureUnsupported');
  else if (input.roomTemp < 15 || input.roomTemp > 28) addIssue('roomTemperatureUnusual');

  if (input.fridgeTemp < 0 || input.fridgeTemp > 10) addIssue('fridgeTemperatureUnsupported');
  else if (input.fridgeTemp < 2 || input.fridgeTemp > 8) addIssue('fridgeTemperatureUnusual');

  const totalHours = input.roomBeforeFridgeHours + input.fridgeHours + input.roomAfterFridgeHours;
  if (totalHours < 1 || totalHours > 120) addIssue('totalDurationUnsupported');
  else if (totalHours < 2 || totalHours > 96) addIssue('totalDurationUnusual');

  const roomPhaseUnsupported = input.roomBeforeFridgeHours > 24 || input.roomAfterFridgeHours > 24;
  const roomPhaseUnusual = input.roomBeforeFridgeHours > 8 || input.roomAfterFridgeHours > 8;
  if (roomPhaseUnsupported) addIssue('roomPhaseUnsupported');
  else if (roomPhaseUnusual) addIssue('roomPhaseUnusual');

  if (input.fridgeHours > 120) addIssue('coldPhaseUnsupported');
  else if (input.fridgeHours > 72) addIssue('coldPhaseUnusual');

  const status = issues.some((issue) => issue.endsWith('Unsupported'))
    ? 'unsupported'
    : issues.length > 0
      ? 'unusual'
      : 'supported';

  return { status, issues };
}

export function normalizeHomeFlourStrength(
  input: HomeFlourStrengthInput,
): NormalizedHomeFlourStrength {
  const w = input.w;
  const proteinPct = input.proteinPct;
  const validW = input.source === 'w' && typeof w === 'number' && Number.isFinite(w) && w > 0;
  const validProtein = typeof proteinPct === 'number' && Number.isFinite(proteinPct) && proteinPct > 0;

  if (validW) {
    return { source: 'w', w, confidence: 'high' };
  }

  if ((input.source === 'w' || input.source === 'protein') && validProtein) {
    return { source: 'protein', proteinPct, confidence: 'medium' };
  }

  return { source: 'unknown', confidence: 'low' };
}

export function calculateDirectHomeCandidateExposure(
  candidate: DirectHomeFermentationCandidate,
  roomTemp: number,
  fridgeTemp: number,
): DirectHomeFermentationExposure {
  const signal = calculateLegacyEquivalentFermentationSignal(
    candidate.roomBeforeFridgeHours,
    candidate.fridgeHours,
    candidate.roomAfterFridgeHours,
    roomTemp,
    fridgeTemp,
  );

  return {
    roomBeforeExposure: signal.warmBefore,
    fridgeExposure: signal.cold,
    roomAfterExposure: signal.warmAfter,
    roomExposure: signal.warmBefore + signal.warmAfter,
    totalExposure: signal.total,
  };
}

// This is a legacy-equivalent relative fermentation signal, not an empirically calibrated dough-stress model.
export function calculateHomeFermentationStressSignal(
  input: NormalizedHomeDoughToleranceInput,
): HomeFermentationStressSignal {
  return calculateLegacyEquivalentFermentationSignal(
    input.roomBeforeFridgeHours,
    input.fridgeHours,
    input.roomAfterFridgeHours,
    input.roomTemp,
    input.fridgeTemp,
  );
}

function calculateLegacyEquivalentFermentationSignal(
  roomBeforeFridgeHours: number,
  fridgeHours: number,
  roomAfterFridgeHours: number,
  roomTemp: number,
  fridgeTemp: number,
): HomeFermentationStressSignal {
  const roomFactor = 1 + 0.08 * (roomTemp - 20);
  const fridgeFactor = 0.12 * (1 + 0.05 * (fridgeTemp - 4));
  const warmBefore = Math.max(0, roomBeforeFridgeHours) * roomFactor;
  const cold = Math.max(0, fridgeHours) * fridgeFactor;
  const warmAfter = Math.max(0, roomAfterFridgeHours) * roomFactor;

  return {
    warmBefore,
    cold,
    warmAfter,
    total: warmBefore + cold + warmAfter,
  };
}

export function calculateDirectHomeYeastRequirement(
  exposure: DirectHomeFermentationExposure,
): DirectHomeYeastRequirement {
  // Legacy-equivalent PizzaBook yeast relationship applied to Home candidate exposure.
  const effectiveExposure = Math.max(0.5, exposure.totalExposure);
  const freshYeastPct = 0.5 / effectiveExposure;
  const dryYeastPct = freshYeastPct / 3;

  return {
    freshYeastPct,
    dryYeastPct,
    freshYeastGramsPer1000gFlour: freshYeastPct * 10,
    dryYeastGramsPer1000gFlour: dryYeastPct * 10,
  };
}

export function assessHomeYeastMeasurement(grams: number): HomeYeastMeasurementAssessment {
  const normalizedGrams = Math.max(0, grams);
  const status = normalizedGrams >= 0.1
    ? 'easy'
    : normalizedGrams >= 0.05
      ? 'precisionScale'
      : 'dilutionRecommended';

  return { grams: normalizedGrams, status };
}

export function generateDirectHomeCandidates(
  availableHours: number,
  maxRoomBeforeFridgeHours?: number,
): DirectHomeFermentationCandidate[] {
  if (availableHours <= 0) return [];

  const candidate = (
    strategy: HomeFermentationStrategy,
    roomBeforeFridgeHours: number,
    fridgeHours: number,
    roomAfterFridgeHours: number,
  ): DirectHomeFermentationCandidate => ({
    strategy,
    roomBeforeFridgeHours,
    fridgeHours,
    roomAfterFridgeHours,
    status: 'acceptable',
    warnings: [],
  });

  const coldFermentedCandidate = (
    strategy: HomeFermentationStrategy,
    originalRoomBeforeShare: number,
    originalFridgeShare: number,
  ): DirectHomeFermentationCandidate => {
    const roomAfterFridgeHours = Math.min(
      DIRECT_HOME_BALLS_COLD_FERMENTED_POLICY.preferredRoomAfterHours,
      availableHours,
    );
    const remainingHours = availableHours - roomAfterFridgeHours;
    const originalRoomAndFridgeShare = originalRoomBeforeShare + originalFridgeShare;
    const proposedRoomBeforeFridgeHours = remainingHours * originalRoomBeforeShare / originalRoomAndFridgeShare;
    const roomBeforeFridgeHours = maxRoomBeforeFridgeHours === undefined
      ? proposedRoomBeforeFridgeHours
      : Math.min(proposedRoomBeforeFridgeHours, maxRoomBeforeFridgeHours);
    const fridgeHours = remainingHours - roomBeforeFridgeHours;

    return candidate(strategy, roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours);
  };

  const candidates = [
    candidate('roomOnly', availableHours, 0, 0),
    coldFermentedCandidate('hybrid', 1, 2),
    coldFermentedCandidate('coldDominant', 1, 5),
    coldFermentedCandidate('extraCold', 1, 8),
  ];
  if (maxRoomBeforeFridgeHours !== undefined) {
    const roomAfterFridgeHours = Math.min(
      DIRECT_HOME_BALLS_COLD_FERMENTED_POLICY.preferredRoomAfterHours,
      availableHours,
    );
    const remainingHours = availableHours - roomAfterFridgeHours;
    const roomBeforeFridgeHours = Math.min(remainingHours, maxRoomBeforeFridgeHours);
    candidates.push(candidate(
      'controlled',
      roomBeforeFridgeHours,
      remainingHours - roomBeforeFridgeHours,
      roomAfterFridgeHours,
    ));
  }
  return candidates;
}

export type FlourType = 'caputo00' | 'manitoba' | 'spelt' | 'wholeWheat' | 'glutenFree' | 'custom';

export type PizzaStyleProfile = {
  defaultDiameter: number;
  ballWeight: number;
  hydration: number;
  saltPct: number;
  oilPct: number;
  flourTypes: FlourType[];
  fermentation: 'sameDay' | 'coldLong';
  bakeTemp: string;
  bakeTime?: string;
  shaping: string;
};


export function evaluateDirectHomeCandidate(
  candidate: DirectHomeFermentationCandidate,
  input: HomeDoughToleranceInput,
  yeastType: Exclude<YeastType, 'sourdough'>,
  conservativeUnknownFlour = false,
): DirectHomeCandidateEvaluation {
  const normalizedInput = normalizeHomeDoughToleranceInput({
    ...input,
    roomBeforeFridgeHours: candidate.roomBeforeFridgeHours,
    fridgeHours: candidate.fridgeHours,
    roomAfterFridgeHours: candidate.roomAfterFridgeHours,
  });
  const stressSignal = calculateHomeFermentationStressSignal(normalizedInput);
  const exposureCandidate: DirectHomeFermentationCandidate = {
    ...candidate,
    roomBeforeFridgeHours: normalizedInput.roomBeforeFridgeHours,
    fridgeHours: normalizedInput.fridgeHours,
    roomAfterFridgeHours: normalizedInput.roomAfterFridgeHours,
  };
  const exposure = calculateDirectHomeCandidateExposure(
    exposureCandidate,
    normalizedInput.roomTemp,
    normalizedInput.fridgeTemp,
  );
  const yeastRequirement = calculateDirectHomeYeastRequirement(exposure);
  const yeastGrams = yeastType === 'fresh'
    ? yeastRequirement.freshYeastGramsPer1000gFlour
    : yeastRequirement.dryYeastGramsPer1000gFlour;
  const yeastMeasurement = assessHomeYeastMeasurement(yeastGrams);
  const baseResilience = normalizedInput.flour.source === 'unknown' && input.flour.source !== 'unknown'
    ? {
      flourCapability: null,
      hydrationLoad: null,
      resilience: null,
      confidence: normalizedInput.flour.confidence,
    }
    : assessHomeDoughBaseResilience(normalizedInput, conservativeUnknownFlour);
  const domain = validateHomeDoughDomain(normalizedInput);
  const rejectionReasons: string[] = domain.status === 'unsupported'
    ? domain.issues.filter((issue) => issue.endsWith('Unsupported'))
    : [];

  if (baseResilience.resilience === null) rejectionReasons.push('baseResilienceUnavailable');

  return {
    candidate,
    stressSignal,
    yeastRequirement,
    yeastMeasurement,
    baseResilience,
    domain,
    selectable: domain.status !== 'unsupported' && baseResilience.resilience !== null,
    rejectionReasons,
  };
}

export function selectDirectHomeCandidate(
  evaluations: DirectHomeCandidateEvaluation[],
): DirectHomeCandidateEvaluation | null {
  const domainRank: Record<HomeDoughDomainStatus, number> = {
    supported: 0,
    unusual: 1,
    unsupported: 2,
  };

  const ranked = evaluations
    .map((evaluation, index) => ({ evaluation, index }))
    .filter(({ evaluation }) => evaluation.selectable)
    .sort((left, right) => {
      const domainOrder = domainRank[left.evaluation.domain.status]
        - domainRank[right.evaluation.domain.status];
      if (domainOrder !== 0) return domainOrder;

      const roomBulkOrder = left.evaluation.candidate.roomBeforeFridgeHours
        - right.evaluation.candidate.roomBeforeFridgeHours;
      if (roomBulkOrder !== 0) return roomBulkOrder;

      const fermentationOrder = left.evaluation.stressSignal.total
        - right.evaluation.stressSignal.total;
      if (fermentationOrder !== 0) return fermentationOrder;

      return left.index - right.index;
    });

  return ranked[0]?.evaluation ?? null;
}

export const PIZZA_STYLE_PROFILES: Record<PizzaStyle, PizzaStyleProfile> = {
  neapolitan: {
    defaultDiameter: 30, ballWeight: 250, hydration: 62, saltPct: 2.9, oilPct: 2,
    flourTypes: ['caputo00'], fermentation: 'coldLong', bakeTemp: '450°C+', bakeTime: '60–90 s',
    shaping: 'Ručno širenje zraka prema rubu',
  },
  romana: {
    defaultDiameter: 33, ballWeight: 210, hydration: 59, saltPct: 2.8, oilPct: 4,
    flourTypes: ['caputo00', 'spelt'], fermentation: 'coldLong', bakeTemp: '250–300°C', bakeTime: '5–7 min',
    shaping: 'Razvlačenje valjkom za tanku, hrskavu koru',
  },
  ny_style: {
    defaultDiameter: 35, ballWeight: 375, hydration: 64, saltPct: 2.3, oilPct: 3,
    flourTypes: ['manitoba', 'caputo00'], fermentation: 'coldLong', bakeTemp: '280–350°C',
    shaping: 'Tanka sredina i ujednačena debljina za savitljivu krišku',
  },
};

// Beginner round-size relationship: each style keeps its own profile reference
// and scales dough by pizza area. Teglia uses its separate tray calculation.
export function beginnerBallWeightForDiameter(style: PizzaStyle, diameter: number): number {
  const profile = PIZZA_STYLE_PROFILES[style];
  const ratio = diameter / profile.defaultDiameter;
  return Math.round(profile.ballWeight * ratio * ratio);
}

export function beginnerDiameterForBallWeight(style: PizzaStyle, ballWeight: number): number {
  const profile = PIZZA_STYLE_PROFILES[style];
  return Math.round(profile.defaultDiameter * Math.sqrt(ballWeight / profile.ballWeight));
}

export function createDirectHomePizzaPlan(
  input: HomePizzaPlanInput,
  flour: HomeFlourStrengthInput,
  hydrationPct: number,
  yeastType: Exclude<YeastType, 'sourdough'>,
  now: Date,
  conservativeUnknownFlour = false,
): HomePizzaPlan | null {
  if (input.method !== 'direct') return null;

  const availableHours = getAvailableFermentationHours(input.bakeAt, now);
  if (availableHours <= 0) return null;

  const isBeginnerTipo00Target = conservativeUnknownFlour
    && input.style === 'neapolitan'
    && input.flourType === 'caputo00'
    && (input.mixing === 'hand' || input.mixing === 'home');
  if (isBeginnerTipo00Target) {
    const scheduleCandidates = generateBeginnerDirectScheduleCandidates(availableHours, input.roomTemp, input.bakeAt);
    const evaluationInput: HomeDoughToleranceInput = {
      flour,
      hydrationPct,
      roomTemp: input.roomTemp,
      fridgeTemp: input.fridgeTemp,
      roomBeforeFridgeHours: 0,
      fridgeHours: 0,
      roomAfterFridgeHours: 0,
    };
    const candidateEvaluations = scheduleCandidates.map((candidate) => {
      const evaluation = evaluateDirectHomeCandidate(candidate, evaluationInput, yeastType, true);
      return {
        ...evaluation,
        selectable: evaluation.selectable && candidate.status !== 'unsupported',
        rejectionReasons: candidate.status === 'unsupported'
          ? [...evaluation.rejectionReasons, ...candidate.limitations]
          : evaluation.rejectionReasons,
      };
    });
    const fridgeCandidate = candidateEvaluations.find((evaluation) => evaluation.selectable && (evaluation.candidate as BeginnerDirectScheduleCandidate).mode === 'fridgeRoom');
    const roomCandidate = candidateEvaluations.find((evaluation) => evaluation.selectable && (evaluation.candidate as BeginnerDirectScheduleCandidate).mode === 'roomOnly');
    // This is a transparent scheduling preference, not a readiness or safety score:
    // shorter windows stay room-only; longer windows use refrigeration when feasible.
    const preferred = availableHours >= 3 && fridgeCandidate ? fridgeCandidate : roomCandidate ?? fridgeCandidate;
    const recommendationReason = preferred && (preferred.candidate as BeginnerDirectScheduleCandidate).mode === 'fridgeRoom'
      ? 'The available time allows the minimum refrigeration window and a final room rest.'
      : 'The available time is shorter, so room-temperature fermentation keeps the schedule practical.';
    const annotatedCandidateEvaluations = candidateEvaluations.map((evaluation) => ({
      ...evaluation,
      recommended: evaluation === preferred,
      recommendationReason: evaluation === preferred ? recommendationReason : undefined,
    }));
    const requested = input.beginnerScheduleMode
      ? annotatedCandidateEvaluations.find((evaluation) => (evaluation.candidate as BeginnerDirectScheduleCandidate).mode === input.beginnerScheduleMode)
      : undefined;
    const recommended = annotatedCandidateEvaluations.find((evaluation) => evaluation.recommended)
      ?? annotatedCandidateEvaluations.find((evaluation) => evaluation.selectable)
      ?? null;
    const selectedEvaluation = requested?.selectable ? requested : recommended;
    if (!selectedEvaluation) return null;
    const selectedCandidate = selectedEvaluation.candidate as BeginnerDirectScheduleCandidate;
    const schedule: HomePizzaPlanSchedule = {
      startAt: selectedCandidate.startAt,
      bakeAt: input.bakeAt,
      ballingAt: selectedCandidate.ballingAt,
      fridgeAt: selectedCandidate.fridgeAt,
      doughReadyAt: selectedCandidate.doughReadyAt,
      preheatAt: new Date(input.bakeAt.getTime() - (input.ovenType === 'homeStone' ? 60 : 20) * 60000),
      strategy: selectedCandidate.strategy,
      style: input.style,
      ovenType: input.ovenType,
      ovenTemp: input.ovenTemp,
      roomTemp: input.roomTemp,
      fridgeTemp: input.fridgeTemp,
      ballWeight: input.ballWeight,
      prefermentHours: 0,
      roomBeforeFridgeHours: selectedCandidate.roomBeforeFridgeHours,
      fridgeHours: selectedCandidate.fridgeHours,
      roomAfterFridgeHours: selectedCandidate.roomAfterFridgeHours,
      phaseAMinutes: selectedCandidate.phaseAMinutes,
      phaseBMinutes: selectedCandidate.phaseBMinutes,
      phaseCMinutes: selectedCandidate.phaseCMinutes,
      thermalUncertainty: selectedCandidate.thermalUncertainty,
      limitations: selectedCandidate.limitations,
    };
    return { input, schedule, selectedEvaluation, candidateEvaluations: annotatedCandidateEvaluations };
  }

  const candidates = conservativeUnknownFlour
    ? (() => {
      const strategy = selectBeginnerDirectHomeStrategy(availableHours, input.roomTemp);
      const roomAfterFridgeHours = Math.min(
        DIRECT_HOME_BALLS_COLD_FERMENTED_POLICY.preferredRoomAfterHours,
        availableHours,
      );
      const remainingHours = availableHours - roomAfterFridgeHours;
      const roomBeforeFridgeHours = strategy === 'roomOnly'
        ? remainingHours
        : Math.min(strategy === 'hybrid' ? 2 : 1, remainingHours);
      const fridgeHours = strategy === 'roomOnly'
        ? 0
        : Math.min(
          MAX_BEGINNER_DIRECT_COLD_HOURS,
          Math.max(0, remainingHours - roomBeforeFridgeHours),
        );
      return [{
        strategy,
        roomBeforeFridgeHours,
        fridgeHours,
        roomAfterFridgeHours,
        status: 'acceptable' as const,
        warnings: [],
      }];
    })()
    : generateDirectHomeCandidates(availableHours);
  if (candidates.length === 0) return null;

  const evaluationInput: HomeDoughToleranceInput = {
    flour,
    hydrationPct,
    roomTemp: input.roomTemp,
    fridgeTemp: input.fridgeTemp,
    roomBeforeFridgeHours: 0,
    fridgeHours: 0,
    roomAfterFridgeHours: 0,
  };
  const evaluations = candidates.map((candidate) => (
    evaluateDirectHomeCandidate(candidate, evaluationInput, yeastType, conservativeUnknownFlour)
  ));
  const selectedEvaluation = selectDirectHomeCandidate(evaluations);
  if (!selectedEvaluation) return null;

  const workflowHours = selectedEvaluation.candidate.roomBeforeFridgeHours
    + selectedEvaluation.candidate.fridgeHours
    + selectedEvaluation.candidate.roomAfterFridgeHours;
  const startAt = conservativeUnknownFlour
    ? new Date(Math.max(now.getTime(), input.bakeAt.getTime() - workflowHours * 3600000))
    : now;
  const schedule: HomePizzaPlanSchedule = {
    startAt,
    bakeAt: input.bakeAt,
    ballingAt: new Date(startAt.getTime() + selectedEvaluation.candidate.roomBeforeFridgeHours * 3600000),
    preheatAt: conservativeUnknownFlour
      ? new Date(input.bakeAt.getTime() - (input.ovenType === 'homeStone' ? 60 : 20) * 60000)
      : undefined,
    strategy: conservativeUnknownFlour ? selectedEvaluation.candidate.strategy : undefined,
    style: conservativeUnknownFlour ? input.style : undefined,
    romanFormat: conservativeUnknownFlour ? input.romanFormat : undefined,
    ovenType: input.ovenType,
    ovenTemp: input.ovenTemp,
    roomTemp: conservativeUnknownFlour ? input.roomTemp : undefined,
    fridgeTemp: conservativeUnknownFlour ? input.fridgeTemp : undefined,
    ballWeight: conservativeUnknownFlour ? input.ballWeight : undefined,
    prefermentHours: 0,
    roomBeforeFridgeHours: selectedEvaluation.candidate.roomBeforeFridgeHours,
    fridgeHours: selectedEvaluation.candidate.fridgeHours,
    roomAfterFridgeHours: selectedEvaluation.candidate.roomAfterFridgeHours,
  };
  if (!isHomeScheduleDurationValid(schedule)) return null;

  return { input, schedule, selectedEvaluation };
}

// ===== Biga Home Engine V1 — scheduling foundation only (yeast formulas untouched) =====
export interface BigaHomePizzaPlanInput {
  style: PizzaStyle;
  pizzas: number;
  ballWeight: number;
  bakeAt: Date;
  roomTemp: number;
  fridgeTemp: number;
  ovenType: OvenType;
}

export interface BigaHomePizzaSchedule {
  bigaStartAt: Date;
  bigaRoomHours: number;
  bigaFridgeHours: number;
  finalMixAt: Date;
  finalDoughRoomHours: number;
  finalDoughFridgeHours: number;
  ballingAt: Date;
  finalBallRestHours: number;
  preheatAt?: Date;
  bakeAt: Date;
}

export interface BigaHomePizzaPlan {
  input: BigaHomePizzaPlanInput;
  schedule: BigaHomePizzaSchedule;
  maturationPolicy: BigaMaturationPolicyResult;
}

export type BigaHomeScheduleMilestone = {
  stage: 'bigaStart' | 'finalMix' | 'balling' | 'preheat' | 'bake';
  at: Date;
};

export function getBigaHomeScheduleMilestones(schedule: BigaHomePizzaSchedule): BigaHomeScheduleMilestone[] {
  return [
    { stage: 'bigaStart', at: schedule.bigaStartAt },
    { stage: 'finalMix', at: schedule.finalMixAt },
    { stage: 'balling', at: schedule.ballingAt },
    ...(schedule.preheatAt ? [{ stage: 'preheat' as const, at: schedule.preheatAt }] : []),
    { stage: 'bake', at: schedule.bakeAt },
  ];
}

// Reference condition only (NOT a universal schedule): a Biga matured ~16-18°C for ~16h is a
// commonly cited starting point. Real room temperature must still shorten/lengthen room exposure.
export const BIGA_MATURATION_REFERENCE = {
  referenceRoomTemp: 17,
  referenceRoomHours: 16,
  minRoomHours: 6,
  maxRoomHours: 18,
} as const;

export const MAX_BEGINNER_DIRECT_COLD_HOURS = 24;

// Provisional: ~12%/°C fermentation-activity scaling (roughly "doubles every ~6°C"), a commonly
// used rule-of-thumb heuristic, NOT an empirically validated coefficient for Biga specifically.
// Deliberately NOT reusing Direct's roomFactor/fridgeFactor, which are tied to Direct's yeast
// exposure model and are not declared as a generic temperature-duration conversion.
const BIGA_PROVISIONAL_ROOM_ACTIVITY_PER_DEGREE = 0.12;

export type BigaMaturationStrategy = 'roomOnly' | 'roomThenFridge';

export interface BigaMaturationPolicyResult {
  strategy: BigaMaturationStrategy;
  bigaRoomHours: number;
  bigaFridgeHours: number;
  confidence: HomeDoughToleranceConfidence;
  policyReason: string;
}

// Deterministic candidate policy: chooses room-only vs room+fridge Biga maturation from roomTemp,
// fridgeTemp and the total available window. Biga maturation is always bounded; it never silently
// consumes all available time (extra time is reserved for the final-dough/ball phase instead).
export function calculateBigaMaturationPolicy(
  roomTemp: number,
  fridgeTemp: number,
  availableHours: number,
): BigaMaturationPolicyResult {
  const { referenceRoomTemp, referenceRoomHours, minRoomHours, maxRoomHours } = BIGA_MATURATION_REFERENCE;
  const degreesAboveReference = roomTemp - referenceRoomTemp;
  const activityMultiplier = Math.pow(1 + BIGA_PROVISIONAL_ROOM_ACTIVITY_PER_DEGREE, degreesAboveReference);
  const scaledRoomHours = referenceRoomHours / Math.max(0.1, activityMultiplier);
  const round1 = (hours: number) => Math.round(Math.max(0, hours) * 10) / 10;

  // Continuous, deterministic room->fridge handoff: room hours are clamped to [min,max], and any
  // room-exposure "deficit" below minRoomHours (warmer rooms) is replaced 1:1 with fridge hours
  // instead of snapping to a fixed fridge block. This removes the prior abrupt discontinuity at
  // the minRoomHours boundary while keeping Biga maturation bounded. The 1:1 hour substitution is
  // provisional, not an empirically validated room<->fridge equivalence.
  const bigaRoomHours0 = round1(Math.min(maxRoomHours, Math.max(minRoomHours, scaledRoomHours)));
  const bigaFridgeHours0 = round1(Math.max(0, minRoomHours - scaledRoomHours));
  const strategy: BigaMaturationStrategy = bigaFridgeHours0 > 0 ? 'roomThenFridge' : 'roomOnly';
  let bigaRoomHours = bigaRoomHours0;
  let bigaFridgeHours = bigaFridgeHours0;
  let policyReason = bigaFridgeHours > 0 ? 'warmRoomShortenedWithFridge' : 'roomOnly';

  // Available-time guard: Biga maturation must never consume the whole window; always leave room
  // for final-dough/ball fermentation even if that means trimming the fridge phase first.
  const maxReservedForBiga = Math.max(0, availableHours - 1);
  if (bigaRoomHours + bigaFridgeHours > maxReservedForBiga) {
    bigaFridgeHours = round1(Math.max(0, maxReservedForBiga - bigaRoomHours));
    if (bigaRoomHours > maxReservedForBiga) bigaRoomHours = round1(maxReservedForBiga);
    policyReason = `${policyReason}+timeConstrained`;
  }

  const roomTempInProvisionalRange = roomTemp >= 16 && roomTemp <= 28;
  const fridgeTempInProvisionalRange = fridgeTemp >= 2 && fridgeTemp <= 8;
  const confidence: HomeDoughToleranceConfidence = roomTempInProvisionalRange
    && (bigaFridgeHours === 0 || fridgeTempInProvisionalRange)
    ? 'medium'
    : 'low';

  return { strategy, bigaRoomHours, bigaFridgeHours, confidence, policyReason };
}

// Non-maturation defaults; Biga room/fridge hours come from calculateBigaMaturationPolicy instead.
export const BIGA_HOME_V1_POLICY = {
  finalDoughRoomHoursCap: 3,
  finalBallRestHours: 3,
  preheatHoursBeforeBake: 1,
} as const;

export function getBigaHomeScheduleDurationHours(schedule: BigaHomePizzaSchedule): number {
  return [
    schedule.bigaRoomHours,
    schedule.bigaFridgeHours,
    schedule.finalDoughRoomHours,
    schedule.finalDoughFridgeHours,
    schedule.finalBallRestHours,
  ].reduce((total, hours) => total + Math.max(0, hours), 0);
}

export function isBigaHomeScheduleDurationValid(schedule: BigaHomePizzaSchedule): boolean {
  const fields = [
    schedule.bigaRoomHours, schedule.bigaFridgeHours,
    schedule.finalDoughRoomHours, schedule.finalDoughFridgeHours,
    schedule.finalBallRestHours,
  ];
  if (fields.some((hours) => !Number.isFinite(hours) || hours < 0)) return false;

  const durationHours = getBigaHomeScheduleDurationHours(schedule);
  const intervalHours = (schedule.bakeAt.getTime() - schedule.bigaStartAt.getTime()) / (1000 * 60 * 60);
  if (Math.abs(durationHours - intervalHours) > 1e-6) return false;

  const msPerHour = 3600000;
  const finalMixExpected = schedule.bigaStartAt.getTime() + (schedule.bigaRoomHours + schedule.bigaFridgeHours) * msPerHour;
  if (Math.abs(schedule.finalMixAt.getTime() - finalMixExpected) > 1000) return false;

  const ballingExpected = schedule.finalMixAt.getTime() + (schedule.finalDoughRoomHours + schedule.finalDoughFridgeHours) * msPerHour;
  if (Math.abs(schedule.ballingAt.getTime() - ballingExpected) > 1000) return false;

  const bakeExpected = schedule.ballingAt.getTime() + schedule.finalBallRestHours * msPerHour;
  if (Math.abs(schedule.bakeAt.getTime() - bakeExpected) > 1000) return false;

  if (schedule.preheatAt && schedule.preheatAt.getTime() > schedule.bakeAt.getTime()) return false;

  return true;
}

// Architecture-only V1: deterministic, does not vary by style/pizzas/ballWeight/oven yet.
// Returns null (legacy Biga fallback applies) when the policy cannot fit the available time.
export function createBigaHomePizzaPlan(
  input: BigaHomePizzaPlanInput,
  now: Date,
): BigaHomePizzaPlan | null {
  const availableHours = getAvailableFermentationHours(input.bakeAt, now);
  if (availableHours <= 0) return null;

  const { finalBallRestHours, finalDoughRoomHoursCap } = BIGA_HOME_V1_POLICY;
  const maturation = calculateBigaMaturationPolicy(input.roomTemp, input.fridgeTemp, availableHours);
  const { bigaRoomHours, bigaFridgeHours } = maturation;
  const reservedHours = bigaRoomHours + bigaFridgeHours + finalBallRestHours;
  const remainingHours = availableHours - reservedHours;
  if (remainingHours <= 0) return null;

  const finalDoughRoomHours = Math.min(finalDoughRoomHoursCap, remainingHours);
  const finalDoughFridgeHours = remainingHours - finalDoughRoomHours;

  const msPerHour = 3600000;
  const bigaStartAt = now;
  const finalMixAt = new Date(bigaStartAt.getTime() + (bigaRoomHours + bigaFridgeHours) * msPerHour);
  const ballingAt = new Date(finalMixAt.getTime() + (finalDoughRoomHours + finalDoughFridgeHours) * msPerHour);
  const preheatAt = new Date(input.bakeAt.getTime() - BIGA_HOME_V1_POLICY.preheatHoursBeforeBake * msPerHour);

  const schedule: BigaHomePizzaSchedule = {
    bigaStartAt,
    bigaRoomHours,
    bigaFridgeHours,
    finalMixAt,
    finalDoughRoomHours,
    finalDoughFridgeHours,
    ballingAt,
    finalBallRestHours,
    preheatAt,
    bakeAt: input.bakeAt,
  };
  if (!isBigaHomeScheduleDurationValid(schedule)) return null;

  return { input, schedule, maturationPolicy: maturation };
}

export interface PoolishHomePizzaPlanInput {
  style: PizzaStyle;
  pizzas: number;
  ballWeight: number;
  bakeAt: Date;
  roomTemp: number;
  fridgeTemp: number;
  ovenType: OvenType;
  poolishHours: number;
}

export interface PoolishHomePizzaSchedule {
  poolishStartAt: Date;
  poolishRoomHours: number;
  poolishFridgeHours: number;
  finalMixAt: Date;
  finalDoughRoomHours: number;
  finalDoughFridgeHours: number;
  ballingAt: Date;
  finalBallRestHours: number;
  preheatAt?: Date;
  bakeAt: Date;
}

export interface PoolishHomePizzaPlan {
  input: PoolishHomePizzaPlanInput;
  schedule: PoolishHomePizzaSchedule;
  maturationPolicy: { poolishRoomHours: number; poolishFridgeHours: number };
}

export type PoolishHomeScheduleMilestone = {
  stage: 'poolishStart' | 'finalMix' | 'balling' | 'preheat' | 'bake';
  at: Date;
};

export function getPoolishHomeScheduleMilestones(schedule: PoolishHomePizzaSchedule): PoolishHomeScheduleMilestone[] {
  return [
    { stage: 'poolishStart', at: schedule.poolishStartAt },
    { stage: 'finalMix', at: schedule.finalMixAt },
    { stage: 'balling', at: schedule.ballingAt },
    ...(schedule.preheatAt ? [{ stage: 'preheat' as const, at: schedule.preheatAt }] : []),
    { stage: 'bake', at: schedule.bakeAt },
  ];
}

export const POOLISH_HOME_V1_POLICY = {
  finalDoughRoomHoursCap: 3,
  finalBallRestHours: 3,
  preheatHoursBeforeBake: 1,
} as const;

export function getPoolishHomeScheduleDurationHours(schedule: PoolishHomePizzaSchedule): number {
  return [
    schedule.poolishRoomHours,
    schedule.poolishFridgeHours,
    schedule.finalDoughRoomHours,
    schedule.finalDoughFridgeHours,
    schedule.finalBallRestHours,
  ].reduce((total, hours) => total + Math.max(0, hours), 0);
}

export function isPoolishHomeScheduleDurationValid(schedule: PoolishHomePizzaSchedule): boolean {
  const fields = [
    schedule.poolishRoomHours, schedule.poolishFridgeHours,
    schedule.finalDoughRoomHours, schedule.finalDoughFridgeHours,
    schedule.finalBallRestHours,
  ];
  if (fields.some((hours) => !Number.isFinite(hours) || hours < 0)) return false;

  const durationHours = getPoolishHomeScheduleDurationHours(schedule);
  const intervalHours = (schedule.bakeAt.getTime() - schedule.poolishStartAt.getTime()) / (1000 * 60 * 60);
  if (Math.abs(durationHours - intervalHours) > 1e-6) return false;

  const msPerHour = 3600000;
  const finalMixExpected = schedule.poolishStartAt.getTime() + (schedule.poolishRoomHours + schedule.poolishFridgeHours) * msPerHour;
  if (Math.abs(schedule.finalMixAt.getTime() - finalMixExpected) > 1000) return false;

  const ballingExpected = schedule.finalMixAt.getTime() + (schedule.finalDoughRoomHours + schedule.finalDoughFridgeHours) * msPerHour;
  if (Math.abs(schedule.ballingAt.getTime() - ballingExpected) > 1000) return false;

  const bakeExpected = schedule.ballingAt.getTime() + schedule.finalBallRestHours * msPerHour;
  if (Math.abs(schedule.bakeAt.getTime() - bakeExpected) > 1000) return false;
  if (schedule.preheatAt && schedule.preheatAt.getTime() > schedule.bakeAt.getTime()) return false;
  return true;
}

export function createPoolishHomePizzaPlan(
  input: PoolishHomePizzaPlanInput,
  now: Date,
): PoolishHomePizzaPlan | null {
  const availableHours = getAvailableFermentationHours(input.bakeAt, now);
  if (availableHours <= 0 || !Number.isFinite(input.poolishHours) || input.poolishHours <= 0) return null;

  const poolishRoomHours = Math.min(1, input.poolishHours);
  const poolishFridgeHours = input.poolishHours - poolishRoomHours;
  const { finalBallRestHours, finalDoughRoomHoursCap, preheatHoursBeforeBake } = POOLISH_HOME_V1_POLICY;
  const remainingHours = availableHours - poolishRoomHours - poolishFridgeHours - finalBallRestHours;
  if (remainingHours <= 0) return null;

  const finalDoughRoomHours = Math.min(finalDoughRoomHoursCap, remainingHours);
  const finalDoughFridgeHours = remainingHours - finalDoughRoomHours;
  const msPerHour = 3600000;
  const poolishStartAt = now;
  const finalMixAt = new Date(poolishStartAt.getTime() + input.poolishHours * msPerHour);
  const ballingAt = new Date(finalMixAt.getTime() + (finalDoughRoomHours + finalDoughFridgeHours) * msPerHour);
  const preheatAt = new Date(input.bakeAt.getTime() - preheatHoursBeforeBake * msPerHour);
  const schedule: PoolishHomePizzaSchedule = {
    poolishStartAt,
    poolishRoomHours,
    poolishFridgeHours,
    finalMixAt,
    finalDoughRoomHours,
    finalDoughFridgeHours,
    ballingAt,
    finalBallRestHours,
    preheatAt,
    bakeAt: input.bakeAt,
  };
  if (!isPoolishHomeScheduleDurationValid(schedule)) return null;

  return {
    input,
    schedule,
    maturationPolicy: { poolishRoomHours, poolishFridgeHours },
  };
}

export const FLOUR_PROFILES: Record<FlourType, { label: string; ideal: number; min: number; max: number; strength?: FlourStrengthMetadata }> = {
  caputo00: { label: 'Tipo 0 / 00', ideal: 65, min: 60, max: 70 },
  manitoba: { label: 'Manitoba / Visoki W', ideal: 72, min: 70, max: 80 },
  spelt: { label: 'Pirovo brašno', ideal: 62, min: 60, max: 65 },
  wholeWheat: { label: 'Integralno brašno', ideal: 70, min: 68, max: 75 },
  glutenFree: { label: 'Bezglutensko brašno', ideal: 80, min: 75, max: 85 },
  custom: { label: 'Mješavina brašna', ideal: 68, min: 55, max: 90 },
};

export function beginnerHydrationFor(style: PizzaStyle, flour: FlourType): number {
  return flour === 'glutenFree' ? FLOUR_PROFILES.glutenFree.ideal : PIZZA_STYLE_PROFILES[style].hydration;
}

const ALL_FLOUR_IDS: FlourType[] = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];

export type BeginnerRestoredState = {
  flour: FlourType;
  blendA: Exclude<FlourType, 'custom'>;
  blendB: Exclude<FlourType, 'custom'>;
  blendPctA: number;
  pizzaStyle: PizzaStyle;
  romanFormat: 'tonda' | 'teglia';
  diameter: number;
  trayWidth: number;
  trayLength: number;
  customBallWeight: number | null;
  hydration: number;
  saltPct: number;
  oilPct: number;
  oven: OvenType;
  ovenTemp: number;
  method: 'direct';
  useIce: false;
};

const BEGINNER_OVEN_RANGES: Record<OvenType, { min: number; max: number; fallback: number }> = {
  ooni: { min: 350, max: 480, fallback: 450 },
  homeStone: { min: 200, max: 300, fallback: 300 },
  homePan: { min: 200, max: 300, fallback: 250 },
};

// Single Beginner restore path: keeps legitimate persisted choices, drops values that belong to another style.
export function normalizeBeginnerSavedState(saved: Record<string, any>): BeginnerRestoredState {
  const pizzaStyle: PizzaStyle = saved.pizzaStyle === 'romana' || saved.pizzaStyle === 'ny_style' ? saved.pizzaStyle : 'neapolitan';
  const profile = PIZZA_STYLE_PROFILES[pizzaStyle];
  const isTeglia = pizzaStyle === 'romana' && saved.romanFormat === 'teglia';
  const romanFormat = isTeglia ? 'teglia' : 'tonda';
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const validTray = (v: unknown) => isNum(v) && v >= 10 && v <= 80;
  const trayWidth = isTeglia && validTray(saved.trayWidth) && validTray(saved.trayLength) ? saved.trayWidth : 30;
  const trayLength = isTeglia && validTray(saved.trayWidth) && validTray(saved.trayLength) ? saved.trayLength : 40;
  const autoBall = isTeglia ? Math.round(trayWidth * trayLength * 0.4) : profile.ballWeight;
  const customOk = isNum(saved.customBallWeight) && saved.customBallWeight >= autoBall * 0.65 && saved.customBallWeight <= autoBall * 1.35;
  const ovenRange = BEGINNER_OVEN_RANGES[saved.oven as OvenType];
  const ovenOk = !!ovenRange && isNum(saved.ovenTemp) && saved.ovenTemp >= ovenRange.min && saved.ovenTemp <= ovenRange.max
    && (!isTeglia || saved.oven === 'homePan');
  const stale = (pizzaStyle !== 'romana' && saved.romanFormat === 'teglia')
    || (!isTeglia && isNum(saved.diameter) && saved.diameter !== profile.defaultDiameter)
    || (isNum(saved.customBallWeight) && !customOk)
    || !ovenOk;
  const defaultOven: OvenType = isTeglia ? 'homePan' : pizzaStyle === 'neapolitan' ? 'ooni' : 'homeStone';
  const oven: OvenType = stale ? defaultOven : saved.oven;
  const ovenTemp = stale ? BEGINNER_OVEN_RANGES[defaultOven].fallback : saved.ovenTemp;
  const flour: FlourType = ALL_FLOUR_IDS.includes(saved.flour) ? saved.flour : 'caputo00';
  const baseHydration = beginnerHydrationFor(pizzaStyle, flour);
  const hydrationOk = !stale && isNum(saved.hydration) && (flour === 'glutenFree'
    ? saved.hydration >= FLOUR_PROFILES.glutenFree.min && saved.hydration <= FLOUR_PROFILES.glutenFree.max
    : Math.abs(saved.hydration - baseHydration) <= 8);
  const blendOk = (v: unknown): v is Exclude<FlourType, 'custom'> => BASE_FLOURS.includes(v as Exclude<FlourType, 'custom'>) && v !== 'glutenFree';
  return {
    flour,
    blendA: blendOk(saved.blendA) ? saved.blendA : 'caputo00',
    blendB: blendOk(saved.blendB) ? saved.blendB : 'wholeWheat',
    blendPctA: isNum(saved.blendPctA) && saved.blendPctA >= 5 && saved.blendPctA <= 95 ? Math.round(saved.blendPctA) : 70,
    pizzaStyle,
    romanFormat,
    diameter: profile.defaultDiameter,
    trayWidth,
    trayLength,
    customBallWeight: !stale && customOk ? saved.customBallWeight : null,
    hydration: hydrationOk ? saved.hydration : baseHydration,
    saltPct: profile.saltPct,
    oilPct: profile.oilPct,
    oven,
    ovenTemp,
    method: 'direct',
    useIce: false,
  };
}

export function getHomeFlourStrengthInput(
  flour: FlourType,
  explicitStrength?: HomeFlourStrengthInput,
): HomeFlourStrengthInput {
  if (explicitStrength) return { ...explicitStrength };
  const strength = FLOUR_PROFILES[flour].strength;
  if (strength && typeof strength.w === 'number' && Number.isFinite(strength.w) && strength.w > 0) {
    return { source: 'w', w: strength.w };
  }
  if (strength && typeof strength.proteinPct === 'number' && Number.isFinite(strength.proteinPct) && strength.proteinPct > 0) {
    return { source: 'protein', proteinPct: strength.proteinPct };
  }
  return { source: 'unknown' };
}

// Base flours available for blending (excludes 'custom' itself)
export const BASE_FLOURS: Exclude<FlourType, 'custom'>[] = [
  'caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree',
];

export type FermentationPhase = {
  kind: 'preferment' | 'final';
  environment: 'room' | 'fridge';
  hours: number;
  temperature: number;
};

export type FermentationSchedule = {
  phases: FermentationPhase[];
  prefermentHours: number;
  prefermentRoomHours: number;
  prefermentFridgeHours: number;
};

type FermentationScheduleOptions = {
  method: Method;
  roomHours: number;
  roomTemp: number;
  fridgeHours: number;
  fridgeTemp: number;
  prefermentHours?: number;
  prefermentRoomHours?: number;
  prefermentFridgeHours?: number;
};

export function getFermentationSchedule(opts: FermentationScheduleOptions): FermentationSchedule {
  const roomHours = Math.max(0, opts.roomHours);
  const fridgeHours = Math.max(0, opts.fridgeHours);
  const phases: FermentationPhase[] = [];
  const addPhase = (phase: FermentationPhase) => {
    if (phase.hours > 0) phases.push(phase);
  };

  if (opts.method === 'direct') {
    addPhase({ kind: 'final', environment: 'room', hours: roomHours, temperature: opts.roomTemp });
    addPhase({ kind: 'final', environment: 'fridge', hours: fridgeHours, temperature: opts.fridgeTemp });
    return { phases, prefermentHours: 0, prefermentRoomHours: 0, prefermentFridgeHours: 0 };
  }

  const prefermentHours = Math.max(
    0,
    opts.prefermentHours ?? Math.max(0, opts.prefermentRoomHours ?? 0) + Math.max(0, opts.prefermentFridgeHours ?? 0),
  );
  const prefermentRoomHours = opts.method === 'biga'
    ? Math.min(8, prefermentHours)
    : Math.min(1, prefermentHours);
  const prefermentFridgeHours = Math.max(0, prefermentHours - prefermentRoomHours);

  addPhase({ kind: 'preferment', environment: 'room', hours: prefermentRoomHours, temperature: opts.roomTemp });
  addPhase({ kind: 'preferment', environment: 'fridge', hours: prefermentFridgeHours, temperature: opts.fridgeTemp });
  addPhase({ kind: 'final', environment: 'room', hours: roomHours, temperature: opts.roomTemp });
  addPhase({ kind: 'final', environment: 'fridge', hours: fridgeHours, temperature: opts.fridgeTemp });

  return { phases, prefermentHours, prefermentRoomHours, prefermentFridgeHours };
}

// Single source of truth for Biga Home timing: builds fermentation-exposure phases directly from a
// BigaHomePizzaSchedule instead of legacy roomHours/fridgeHours/prefermentHours inputs, so the same
// schedule that determines timestamps also determines yeast exposure (no second timing calculation).
export function getBigaHomeFermentationSchedule(
  schedule: BigaHomePizzaSchedule,
  roomTemp: number,
  fridgeTemp: number,
): FermentationSchedule {
  const phases: FermentationPhase[] = [];
  const addPhase = (phase: FermentationPhase) => {
    if (phase.hours > 0) phases.push(phase);
  };

  addPhase({ kind: 'preferment', environment: 'room', hours: schedule.bigaRoomHours, temperature: roomTemp });
  addPhase({ kind: 'preferment', environment: 'fridge', hours: schedule.bigaFridgeHours, temperature: fridgeTemp });
  addPhase({ kind: 'final', environment: 'room', hours: schedule.finalDoughRoomHours, temperature: roomTemp });
  addPhase({ kind: 'final', environment: 'fridge', hours: schedule.finalDoughFridgeHours, temperature: fridgeTemp });
  addPhase({ kind: 'final', environment: 'room', hours: schedule.finalBallRestHours, temperature: roomTemp });

  return {
    phases,
    prefermentHours: schedule.bigaRoomHours + schedule.bigaFridgeHours,
    prefermentRoomHours: schedule.bigaRoomHours,
    prefermentFridgeHours: schedule.bigaFridgeHours,
  };
}

export function getPoolishHomeFermentationSchedule(
  schedule: PoolishHomePizzaSchedule,
  roomTemp: number,
  fridgeTemp: number,
): FermentationSchedule {
  const phases: FermentationPhase[] = [];
  const addPhase = (phase: FermentationPhase) => {
    if (phase.hours > 0) phases.push(phase);
  };

  addPhase({ kind: 'preferment', environment: 'room', hours: schedule.poolishRoomHours, temperature: roomTemp });
  addPhase({ kind: 'preferment', environment: 'fridge', hours: schedule.poolishFridgeHours, temperature: fridgeTemp });
  addPhase({ kind: 'final', environment: 'room', hours: schedule.finalDoughRoomHours, temperature: roomTemp });
  addPhase({ kind: 'final', environment: 'fridge', hours: schedule.finalDoughFridgeHours, temperature: fridgeTemp });
  addPhase({ kind: 'final', environment: 'room', hours: schedule.finalBallRestHours, temperature: roomTemp });

  return {
    phases,
    prefermentHours: schedule.poolishRoomHours + schedule.poolishFridgeHours,
    prefermentRoomHours: schedule.poolishRoomHours,
    prefermentFridgeHours: schedule.poolishFridgeHours,
  };
}

export function blendIdealHydration(a: Exclude<FlourType, 'custom'>, b: Exclude<FlourType, 'custom'>, pctA: number) {
  const pctB = 100 - pctA;
  return Math.round((FLOUR_PROFILES[a].ideal * pctA + FLOUR_PROFILES[b].ideal * pctB) / 100);
}

// Exact normative table per pizza diameter (from spec)
const DIMENSION_TABLE: Record<number, { ball: number; sauce: number; cheese: number }> = {
  26: { ball: 220, sauce: 70, cheese: 75 },
  28: { ball: 240, sauce: 80, cheese: 85 },
  30: { ball: 260, sauce: 85, cheese: 90 },
  33: { ball: 280, sauce: 95, cheese: 100 },
  35: { ball: 310, sauce: 105, cheese: 110 },
  40: { ball: 380, sauce: 130, cheese: 140 },
};

export function dimensionsCalc(diameter: number, pizzas: number) {
  // Use exact table when known; otherwise scale from nearest entry
  const exact = DIMENSION_TABLE[diameter];
  if (exact) {
    return {
      doughBall: exact.ball,
      sauce: exact.sauce,
      cheese: exact.cheese,
      totalDough: exact.ball * pizzas,
    };
  }
  // Scale from 30cm as baseline
  const base = DIMENSION_TABLE[30];
  const area = Math.PI * (diameter / 2) ** 2;
  const baseArea = Math.PI * 15 * 15;
  const factor = area / baseArea;
  return {
    doughBall: Math.round(base.ball * factor),
    sauce: Math.round(base.sauce * factor),
    cheese: Math.round(base.cheese * factor),
    totalDough: Math.round(base.ball * factor) * pizzas,
  };
}

interface DoughCalculationResult {
  method: Method;
  preferment: { flour: number; water: number; yeast: number } | null;
  main: { flour: number; water: number; salt: number; oil: number; yeast: number; psyllium: number };
  total: { flour: number; water: number; salt: number; oil: number; yeast: number; psyllium: number };
  totalDough: number;
  waterTemp: number;
  waterTemperature?: BeginnerDirectWaterTemperature;
  yeastPct: number;
  eTotal: number;
}

export function doughCalc(opts: {
  pizzas: number; ballWeight: number; hydration: number; saltPct: number; oilPct: number;
  method: Method;
  bigaPct?: number;
  poolishPct?: number;
  roomHours: number; roomTemp: number;
  fridgeHours: number; fridgeTemp: number;
  prefermentHours?: number;
  prefermentRoomHours?: number;
  prefermentFridgeHours?: number;
  yeastType?: YeastType;
  mixing?: Mixing;
  flourType?: FlourType;
  beginnerDirectStyle?: BeginnerDirectDoughStyle;
  beginnerDirectMixing?: BeginnerDirectMixing;
  // When provided, the method's Home schedule replaces legacy timing inputs for yeast calculation.
  bigaHomeSchedule?: BigaHomePizzaSchedule;
  poolishHomeSchedule?: PoolishHomePizzaSchedule;
}): DoughCalculationResult {
  // === Fermentation math (dynamic yeast) ===
  const fermentation = opts.method === 'biga' && opts.bigaHomeSchedule
    ? getBigaHomeFermentationSchedule(opts.bigaHomeSchedule, opts.roomTemp, opts.fridgeTemp)
    : opts.method === 'poolish' && opts.poolishHomeSchedule
      ? getPoolishHomeFermentationSchedule(opts.poolishHomeSchedule, opts.roomTemp, opts.fridgeTemp)
      : getFermentationSchedule(opts);
  const eTotal = Math.max(0.5, fermentation.phases.reduce((total, phase) => {
    const rate = phase.environment === 'room'
      ? 1 + 0.08 * (phase.temperature - 20)
      : 0.12 * (1 + 0.05 * (phase.temperature - 4));
    return total + phase.hours * rate;
  }, 0)); // clamp min to avoid explosion
  // yeastPct = K / E_total (K = factor constant; 0.5 gives ~0.1% fresh yeast for 24h cold ferment @4°C + 2h RT @22°C)
  const K = 0.5;
  let yeastPct = K / eTotal;
  if (opts.yeastType === 'dry') yeastPct /= 3;
  const bigaPrefermentShare = 7 / 12;
  const poolishPrefermentShare = 5 / 12;
  const effectiveYeastPct = yeastPct;

  // === Baker's percentages ===
  const totalDough = opts.pizzas * opts.ballWeight;
  const psylliumPct = opts.flourType === 'glutenFree' ? 2 : 0;
  const totalPercent = 100 + opts.hydration + opts.saltPct + effectiveYeastPct + opts.oilPct + psylliumPct;
  const flour = (totalDough / totalPercent) * 100;
  const water = flour * (opts.hydration / 100);
  const salt = flour * (opts.saltPct / 100);
  const yeast = flour * (yeastPct / 100);
  const oil = flour * (opts.oilPct / 100);
  const psyllium = flour * (psylliumPct / 100);

  const beginnerDirectWaterTemperature = opts.method === 'direct'
    && opts.beginnerDirectStyle
    && opts.flourType !== 'glutenFree'
    ? calculateBeginnerDirectWaterTemperature({
      style: opts.beginnerDirectStyle,
      roomTemp: opts.roomTemp,
      mixing: opts.beginnerDirectMixing ?? opts.mixing ?? 'hand',
    })
    : null;

  let waterTemp: number;
  if (beginnerDirectWaterTemperature) {
    waterTemp = beginnerDirectWaterTemperature.recommendedWaterTemp;
  } else {
    // Keep the legacy rule for Pro, gluten-free, Biga, and Poolish calculations.
    const rule = opts.mixing === 'spiral' ? 55 : 60;
    waterTemp = rule - opts.roomTemp;
    const coldFermentHours = opts.method === 'biga' && opts.bigaHomeSchedule
      ? opts.bigaHomeSchedule.bigaFridgeHours + opts.bigaHomeSchedule.finalDoughFridgeHours
      : opts.method === 'poolish' && opts.poolishHomeSchedule
        ? opts.poolishHomeSchedule.poolishFridgeHours + opts.poolishHomeSchedule.finalDoughFridgeHours
        : opts.fridgeHours;
    if (coldFermentHours >= 12) waterTemp = Math.min(waterTemp, 10);
    waterTemp = Math.max(2, Math.min(30, waterTemp));
  }

  // Rounding helpers per spec
  const R0 = (n: number) => Math.round(n);
  const R1 = (n: number) => Math.round(n * 10) / 10;
  const R2 = (n: number) => Math.round(n * 100) / 100;

  const buildBlock = () => ({
    flour: R0(flour), water: R0(water),
    salt: R1(salt), oil: R0(oil), yeast: R2(yeast),
    psyllium: R0(psyllium),
  });

  if (opts.method === 'biga') {
    // Biga: configurable flour percentage and 45% hydration. Yeast quantity follows fermentation conditions.
    const bigaFlour = flour * (Math.max(20, Math.min(100, opts.bigaPct ?? 50)) / 100);
    const bigaWater = bigaFlour * 0.45;
    const bigaYeast = flour * (yeastPct * bigaPrefermentShare / 100);
    const mainYeast = flour * (yeastPct * (1 - bigaPrefermentShare) / 100);
    return {
      method: 'biga' as const,
      preferment: { flour: R0(bigaFlour), water: R0(bigaWater), yeast: R2(bigaYeast) },
      main: {
        flour: R0(flour - bigaFlour), water: R0(water - bigaWater),
        salt: R1(salt), oil: R0(oil), yeast: R2(mainYeast),
        psyllium: R0(psyllium),
      },
      total: { ...buildBlock(), yeast: R2(bigaYeast + mainYeast) },
      totalDough: R0(totalDough),
      waterTemp: R0(waterTemp),
      yeastPct: R2(effectiveYeastPct),
      eTotal: R1(eTotal),
    };
  }

  if (opts.method === 'poolish') {
    // Poolish: configurable flour percentage and 100% hydration. Yeast quantity follows fermentation conditions.
    const pFlour = flour * (Math.max(20, Math.min(100, opts.poolishPct ?? 35)) / 100);
    const pWater = pFlour * 1.0;
    const pYeast = flour * (yeastPct * poolishPrefermentShare / 100);
    const mainYeast = flour * (yeastPct * (1 - poolishPrefermentShare) / 100);
    return {
      method: 'poolish' as const,
      preferment: { flour: R0(pFlour), water: R0(pWater), yeast: R2(pYeast) },
      main: {
        flour: R0(flour - pFlour), water: R0(water - pWater),
        salt: R1(salt), oil: R0(oil), yeast: R2(mainYeast),
        psyllium: R0(psyllium),
      },
      total: { ...buildBlock(), yeast: R2(pYeast + mainYeast) },
      totalDough: R0(totalDough),
      waterTemp: R0(waterTemp),
      yeastPct: R2(effectiveYeastPct),
      eTotal: R1(eTotal),
    };
  }

  // Direct
  return {
    method: 'direct' as const,
    preferment: null,
    main: buildBlock(),
    total: buildBlock(),
    totalDough: R0(totalDough),
    waterTemp: R0(waterTemp),
    ...(beginnerDirectWaterTemperature ? { waterTemperature: beginnerDirectWaterTemperature } : {}),
    yeastPct: R2(yeastPct),
    eTotal: R1(eTotal),
  };
}

export function bakingCalc(oven: OvenType) {
  if (oven === 'ooni') {
    return {
      temp: '430–500°C',
      time: '60–90 s',
      steps: [
        'Zagrij peć min 20 minuta na max.',
        'Stavi pizzu i rotiraj svakih 20-30 sekundi.',
        'Vadi kad je rub zapečen i s tamnim mrljama (leopardiranje).',
      ],
    };
  }
  if (oven === 'homeStone') {
    return {
      temp: '300°C + grill',
      time: '4–6 min',
      steps: [
        'Postavi kamen ili čelik dvije rešetke ispod gornjeg grijača i zagrij ga 45–60 min na max uz uključen grill.',
        'Uključi gornji grill 5 min prije stavljanja pizze.',
        'Pizza ide na kamen 4-6 minuta.',
        'Zadnjih 30-60 s pod grillom da se sir zapeče.',
      ],
    };
  }
  return {
    temp: '250–280°C',
    time: '8–10 min',
    steps: [
      'Zagrij pećnicu na max s ventilacijom.',
      'Peci pizzu na SAMOM DNU pećnice (u protvanu) 5-7 min da dno bude hrskavo.',
      'Prebaci na gornju rešetku pod grill 2-3 min da se sir i rub zapeku.',
      'ZLATNO PRAVILO: Ne skreći pogled dok je pizza u pećnici!',
    ],
  };
}

export function iceCalc(totalWater: number, tapTemp: number, targetTemp: number) {
  // simple energy balance: ice at 0°C, water at tap.
  // (mIce * 80 + mIce * (0 - target)) = mWater * (tap - target)
  // Using L=80 cal/g latent heat of ice.
  const q = totalWater * (tapTemp - targetTemp);
  const iceCap = 80 + (targetTemp - 0);
  const ice = Math.max(0, Math.min(totalWater * 0.5, q / iceCap));
  return {
    ice: Math.round(ice),
    water: Math.round(totalWater - ice),
  };
}

export type PlannerStepCopy = {
  fold1Title?: string;
  fold2Title?: string;
  ovenTitle: string;
  ovenDesc: string;
  bakeTitle?: string;
  bakeDesc?: string;
  ovenRomanDesc: string;
  ovenNyDesc: string;
  warmTitle: string;
  warmDesc: string;
  coldTitle: string;
  coldDesc: string;
  bulkTitle: string;
  bulkDesc: string;
  directMixTitle: string;
  directRomanDesc: string;
  directNyDesc: string;
  directNyBakeDesc: string;
  finalBulkTitle: string;
  finalBulkDesc: string;
  finalMixTitle: string;
  bigaName: string;
  poolishName: string;
  finalBigaDesc: string;
  finalPoolishDesc: string;
  bigaTitle: string;
  bigaDesc: string;
  poolishTitle: string;
  poolishDesc: string;
  ballsTitle: string;
  ballsDesc: string;
  refreshTitle: string;
  refreshDesc: string;
  bigaMixTitle: string;
  bigaMixDesc: string;
  bigaHomeCopy?: {
    bigaStart: string;
    finalMix: string;
    balling: string;
    preheat: string;
    bake: string;
  };
  poolishMixTitle: string;
  poolishMixDesc: string;
  directTitle: string;
  directDesc: string;
  directHomeCopy?: DirectHomePlannerCopy;
  directHomeTegliaCopy?: DirectHomePlannerCopy;
};

type DirectHomePlannerCopy = {
  start: string;
  ballingFridge: string;
  ballingTitle?: string;
  roomOnlyBalling: string;
  roomOnlyTitle?: string;
  finalRoom: string;
  finalRoomTitle?: string;
  preheat: string;
  preheatTitle?: string;
  shapingTitle: string;
  shaping: string;
  shapingGlutenFree?: string;
  bake: string;
};

function fillPlannerCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

// Human-readable hour duration, e.g. 7.5 -> "7 h 30 min" (mirrors formatDuration in i18n/prefermentSteps.ts).
function formatHoursLabel(hoursValue: number): string {
  const totalMinutes = Math.round(hoursValue * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function reversePlan(
  bakeAt: Date,
  method: Method,
  style: PizzaStyle = 'neapolitan',
  copy: PlannerStepCopy,
  homeSchedule?: HomePizzaPlanSchedule | null,
  bigaHomeSchedule?: BigaHomePizzaSchedule | null,
  poolishHomeSchedule?: PoolishHomePizzaSchedule | null,
  bakingLanguage: BakingLanguage = 'en',
  bakingTemperatureLabel?: string,
) {
  const steps: { at: Date; title: string; desc: string }[] = [];
  const push = (offsetMin: number, title: string, desc: string) => {
    const at = new Date(bakeAt.getTime() - offsetMin * 60000);
    steps.push({ at, title, desc });
  };

  const usePoolishHomeSchedule = method === 'poolish'
    && !!poolishHomeSchedule
    && poolishHomeSchedule.bakeAt.getTime() === bakeAt.getTime();
  if (usePoolishHomeSchedule) {
    const copyByStage = {
      poolishStart: [copy.poolishMixTitle, copy.poolishMixDesc],
      finalMix: [fillPlannerCopy(copy.finalMixTitle, { PREFERMENT: copy.poolishName }), copy.finalPoolishDesc],
      balling: [copy.ballsTitle, copy.ballsDesc],
      preheat: [copy.ovenTitle, copy.ovenDesc],
      bake: [copy.ovenTitle, copy.ovenDesc],
    } as const;
    return getPoolishHomeScheduleMilestones(poolishHomeSchedule!).map(({ stage, at }) => ({
      at,
      title: copyByStage[stage][0],
      desc: copyByStage[stage][1],
    }));
  }

  const useBigaHomeSchedule = method === 'biga'
    && !!bigaHomeSchedule
    && bigaHomeSchedule.bakeAt.getTime() === bakeAt.getTime();
  if (useBigaHomeSchedule) {
    const homeCopy = style === 'neapolitan' ? copy.bigaHomeCopy : undefined;
    const homeDurations = {
      BIGA_ROOM: formatHoursLabel(bigaHomeSchedule!.bigaRoomHours),
      BIGA_FRIDGE: formatHoursLabel(bigaHomeSchedule!.bigaFridgeHours),
      FINAL_ROOM: formatHoursLabel(bigaHomeSchedule!.finalDoughRoomHours),
      FINAL_FRIDGE: formatHoursLabel(bigaHomeSchedule!.finalDoughFridgeHours),
      BALL_REST: formatHoursLabel(bigaHomeSchedule!.finalBallRestHours),
    };
    const copyByStage = {
      bigaStart: [copy.bigaMixTitle, fillPlannerCopy(homeCopy?.bigaStart ?? copy.bigaMixDesc, homeDurations)],
      finalMix: [fillPlannerCopy(copy.finalMixTitle, { PREFERMENT: copy.bigaName }), fillPlannerCopy(homeCopy?.finalMix ?? copy.finalBigaDesc, homeDurations)],
      balling: [copy.ballsTitle, fillPlannerCopy(homeCopy?.balling ?? copy.ballsDesc, homeDurations)],
      preheat: [copy.ovenTitle, homeCopy?.preheat ?? copy.ovenDesc],
      bake: [copy.ovenTitle, homeCopy?.bake ?? copy.ovenDesc],
    } as const;
    return getBigaHomeScheduleMilestones(bigaHomeSchedule!).map(({ stage, at }) => ({
      at,
      title: copyByStage[stage][0],
      desc: copyByStage[stage][1],
    }));
  }

  // Single source of truth for all Direct styles: when a valid Home schedule exists for this bakeAt,
  // build milestones from it instead of any style-specific fixed Direct timing.
  const useHomeSchedule = method === 'direct'
    && !!homeSchedule
    && homeSchedule.bakeAt.getTime() === bakeAt.getTime()
    && homeSchedule.roomBeforeFridgeHours + homeSchedule.fridgeHours + homeSchedule.roomAfterFridgeHours > 0;

  if (useHomeSchedule) {
    const { roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours } = homeSchedule!;
    const isRoman = style === 'romana';
    const isNy = style === 'ny_style';
    const styleName = isRoman ? 'Romana' : isNy ? 'New York Style' : 'Napolitana';
    const directTitle = isRoman || isNy ? copy.directMixTitle : copy.directTitle;
    const directDesc = isRoman ? copy.directRomanDesc : isNy ? copy.directNyDesc : copy.directDesc;
    const homeCopy = isRoman && homeSchedule!.romanFormat === 'teglia'
      ? copy.directHomeTegliaCopy
      : copy.directHomeCopy;
    if (!homeSchedule!.strategy) {
      const ovenDesc = isRoman ? copy.ovenRomanDesc : isNy ? copy.ovenNyDesc : copy.ovenDesc;
      push(60, copy.ovenTitle, ovenDesc);
      push(roomAfterFridgeHours * 60, copy.warmTitle, fillPlannerCopy(copy.warmDesc, { STYLE: styleName }));
      push((roomAfterFridgeHours + fridgeHours) * 60, copy.coldTitle, fillPlannerCopy(copy.coldDesc, { HOURS: formatHoursLabel(fridgeHours), STYLE: styleName }));
      push((roomAfterFridgeHours + fridgeHours + roomBeforeFridgeHours) * 60, directTitle, directDesc);
      if (isNy) {
        const bakeValues = {
          BAKE_TIME: formatBakingTimeRange(homeSchedule!.ovenType ?? 'homeStone', homeSchedule!.ovenTemp ?? 250, bakingLanguage),
          OVEN_TEMP_DISPLAY: bakingTemperatureLabel ?? `${homeSchedule!.ovenTemp ?? 250}°C`,
        };
        push(0, copy.bakeTitle ?? copy.ovenTitle, fillPlannerCopy(copy.directNyBakeDesc ?? copy.bakeDesc ?? copy.ovenDesc, bakeValues));
      }
      return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
    }
    const preheatAt = homeSchedule!.preheatAt ?? new Date(bakeAt.getTime() - 60 * 60000);
    const ballingAt = homeSchedule!.ballingAt
      ?? new Date(homeSchedule!.startAt.getTime() + roomBeforeFridgeHours * 3600000);
    const finalRoomAt = new Date(ballingAt.getTime() + fridgeHours * 3600000);
    if (homeCopy) {
      const phaseBStart = new Date(
        homeSchedule!.startAt.getTime() + (homeSchedule!.phaseAMinutes ?? 0) * 60000,
      );
      const phaseBFolds = calculateBeginnerPhaseBPlan({
        durationMinutes: homeSchedule!.phaseBMinutes ?? homeSchedule!.roomBeforeFridgeHours * 60,
        flourBehavior: homeSchedule!.glutenFree ? 'glutenFree' : 'standard',
        workflow: style === 'romana' && homeSchedule!.romanFormat === 'teglia' ? 'teglia' : 'round',
      }).folds;
      phaseBFolds.forEach((fold) => {
        const title = fold.index === 1 ? copy.fold1Title : copy.fold2Title;
        if (title) {
          steps.push({
            at: new Date(phaseBStart.getTime() + fold.offsetMinutes * 60000),
            title,
            desc: title,
          });
        }
      });
    }
    const values = {
      STYLE: styleName,
      HOURS: formatHoursLabel(fridgeHours),
      ROOM_BEFORE: formatHoursLabel(roomBeforeFridgeHours),
      ROOM_AFTER: formatHoursLabel(roomAfterFridgeHours),
      ROOM_TEMP: `${homeSchedule!.roomTemp ?? ''}°C`,
      FRIDGE_TEMP: `${homeSchedule!.fridgeTemp ?? ''}°C`,
      WEIGHT: homeSchedule!.ballWeight ?? PIZZA_STYLE_PROFILES[style].ballWeight,
      PREHEAT_MINUTES: Math.round((bakeAt.getTime() - preheatAt.getTime()) / 60000),
      OVEN_TEMP: `${homeSchedule!.ovenTemp ?? 250}°C`,
      OVEN_TEMP_DISPLAY: bakingTemperatureLabel ?? `${homeSchedule!.ovenTemp ?? 250}°C`,
      BAKE_TIME: formatBakingTimeRange(homeSchedule!.ovenType ?? 'homeStone', homeSchedule!.ovenTemp ?? 250, bakingLanguage),
    };
    steps.push({ at: preheatAt, title: homeCopy?.preheatTitle ?? copy.ovenTitle, desc: fillPlannerCopy(homeCopy?.preheat ?? copy.ovenDesc, values) });
    if (fridgeHours > 0) {
      steps.push({ at: finalRoomAt, title: homeCopy?.finalRoomTitle ?? copy.warmTitle, desc: fillPlannerCopy(homeCopy?.finalRoom ?? copy.warmDesc, values) });
      steps.push({
        at: ballingAt,
        title: homeCopy?.ballingTitle ?? copy.ballsTitle,
        desc: fillPlannerCopy(homeCopy?.ballingFridge ?? copy.coldDesc, values),
      });
    } else {
      steps.push({ at: ballingAt, title: homeCopy?.roomOnlyTitle ?? copy.ballsTitle, desc: fillPlannerCopy(homeCopy?.roomOnlyBalling ?? copy.ballsDesc, values) });
    }
    steps.push({ at: homeSchedule!.startAt, title: directTitle, desc: fillPlannerCopy(homeCopy?.start ?? directDesc, values) });
    if (homeCopy && homeSchedule!.phaseAMinutes === undefined) {
      steps.push({
        at: new Date(homeSchedule!.bakeAt.getTime() - 15 * 60000),
        title: homeCopy.shapingTitle,
        desc: fillPlannerCopy(homeSchedule?.glutenFree && homeCopy.shapingGlutenFree ? homeCopy.shapingGlutenFree : homeCopy.shaping, values),
      });
    }
    const bakeDesc = isNy
      ? copy.directNyBakeDesc ?? copy.bakeDesc ?? copy.ovenDesc
      : homeCopy?.bake ?? copy.bakeDesc ?? copy.ovenDesc;
    steps.push({ at: homeSchedule!.bakeAt, title: copy.bakeTitle ?? copy.ovenTitle, desc: fillPlannerCopy(bakeDesc, values) });
    return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  if (style !== 'neapolitan') {
    const isRoman = style === 'romana';
    const styleName = isRoman ? 'Romana' : 'New York Style';
    const warmBeforeBake = isRoman ? 75 : 75;
    const ballsColdHours = 24;
    const bulkMinutes = method === 'direct' ? 60 : method === 'biga' ? 60 : 60;
    const finalMixHours = method === 'direct' ? 0 : method === 'biga' ? 18 : 16;

    push(60, copy.ovenTitle, isRoman ? copy.ovenRomanDesc : copy.ovenNyDesc);
    push(warmBeforeBake, copy.warmTitle, fillPlannerCopy(copy.warmDesc, { STYLE: styleName }));
    push(warmBeforeBake + ballsColdHours * 60, copy.coldTitle, fillPlannerCopy(copy.coldDesc, { HOURS: ballsColdHours, STYLE: styleName }));

    if (method === 'direct') {
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, copy.bulkTitle, fillPlannerCopy(copy.bulkDesc, { STYLE: styleName }));
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, copy.directMixTitle, isRoman ? copy.directRomanDesc : copy.directNyDesc);
    } else {
      const prefermentName = method === 'biga' ? copy.bigaName : copy.poolishName;
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, copy.finalBulkTitle, copy.finalBulkDesc);
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes + finalMixHours * 60, fillPlannerCopy(copy.finalMixTitle, { PREFERMENT: prefermentName }), method === 'biga' ? copy.finalBigaDesc : copy.finalPoolishDesc);
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes + finalMixHours * 60 + (method === 'biga' ? 16 * 60 : 16 * 60), method === 'biga' ? copy.bigaTitle : copy.poolishTitle, method === 'biga' ? copy.bigaDesc : copy.poolishDesc);
    }
    return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  // reverse order
  push(60, copy.ovenTitle, copy.ovenDesc);
  const profile = PIZZA_STYLE_PROFILES[style];
  push(60 * 5, copy.ballsTitle, fillPlannerCopy(copy.ballsDesc, { WEIGHT: profile.ballWeight }));
  if (method === 'biga') {
    push(60 * 24, copy.refreshTitle, copy.refreshDesc);
    push(60 * 24 + 60 * 18, copy.bigaMixTitle, copy.bigaMixDesc);
  } else if (method === 'poolish') {
    push(60 * 24, copy.refreshTitle, copy.refreshDesc);
    push(60 * 24 + 60 * 14, copy.poolishMixTitle, copy.poolishMixDesc);
  } else {
    const directHours = style === 'neapolitan' ? 8 : 24;
    push(60 * directHours, copy.directTitle, copy.directDesc);
  }
  return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
}
