import type { BigaPoolishCalculationResult } from './bigaPoolish';

export type PrefermentSide = 'biga' | 'poolish';
export type PrefermentAdjustmentReason = 'flour' | 'water' | null;

export type CombinedFlourDisplayAllocation = {
  totalFlourGrams: number;
  bigaFlourGrams: number;
  poolishFlourGrams: number;
  finalFlourGrams: number;
  displayUnit: 'g' | 'oz' | 'lb';
};

export function splitCombinedFlourForDisplay(
  totalFlourGrams: number,
  firstPercent: number,
  displayUnit: CombinedFlourDisplayAllocation['displayUnit'],
): { first: number; second: number } | null {
  if (!Number.isFinite(totalFlourGrams) || totalFlourGrams < 0 || !Number.isFinite(firstPercent) || firstPercent < 0 || firstPercent > 100) return null;
  const displayStepGrams = displayUnit === 'g' ? 1 : displayUnit === 'oz' ? 2.83495 : 4.53592;
  const totalDisplaySteps = Math.round(totalFlourGrams / displayStepGrams);
  const firstDisplaySteps = Math.round(totalDisplaySteps * firstPercent / 100);
  return {
    first: firstDisplaySteps * displayStepGrams,
    second: (totalDisplaySteps - firstDisplaySteps) * displayStepGrams,
  };
}

export type PrefermentAlignmentInput = {
  bigaPct: number;
  poolishPct: number;
  totalHydrationPct: number;
  bigaHydrationPct: number;
  poolishHydrationPct: number;
  changedSide: PrefermentSide;
  requestedPct: number;
};

export type PrefermentAlignmentResult = {
  bigaPct: number;
  poolishPct: number;
  adjustedSide: PrefermentSide | null;
  reason: PrefermentAdjustmentReason;
  maximumReached: boolean;
  blocked: boolean;
};

export type PrefermentHydrationRepairInput = Omit<PrefermentAlignmentInput, 'changedSide' | 'requestedPct'>;

export function allocateCombinedFlourForDisplay(
  model: BigaPoolishCalculationResult | undefined,
  displayedTotalFlourGrams: number,
  measurementSystem: 'metric' | 'us' = 'metric',
): CombinedFlourDisplayAllocation | null {
  if (
    !model
    || model.mathStatus !== 'valid'
    || !Number.isInteger(displayedTotalFlourGrams)
    || displayedTotalFlourGrams < 0
    || Math.round(model.total.flourGrams) !== displayedTotalFlourGrams
  ) return null;

  const rawAmounts = [model.biga.flourGrams, model.poolish.flourGrams, model.final.flourGrams];
  if (!rawAmounts.every((amount) => Number.isFinite(amount) && amount >= 0)) return null;

  const displayUnit = measurementSystem === 'us'
    ? displayedTotalFlourGrams >= 453.592 ? 'lb' : 'oz'
    : 'g';
  const displayStepGrams = displayUnit === 'g' ? 1 : displayUnit === 'oz' ? 2.83495 : 4.53592;
  const targetDisplaySteps = Math.round(displayedTotalFlourGrams / displayStepGrams);
  const rawDisplaySteps = rawAmounts.map((amount) => amount / displayStepGrams);
  const standardRounded = rawDisplaySteps.map(Math.round);
  let allocated = standardRounded;
  if (standardRounded.reduce((sum, amount) => sum + amount, 0) !== targetDisplaySteps) {
    allocated = rawDisplaySteps.map(Math.floor);
    let remainingSteps = targetDisplaySteps - allocated.reduce((sum, amount) => sum + amount, 0);
    if (!Number.isInteger(remainingSteps) || remainingSteps < 0 || remainingSteps > allocated.length) return null;

    const largestRemainders = rawDisplaySteps
      .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
    for (const { index } of largestRemainders) {
      if (remainingSteps <= 0) break;
      allocated[index] += 1;
      remainingSteps -= 1;
    }
  }

  if (allocated.some((amount) => !Number.isFinite(amount) || amount < 0)
    || allocated.reduce((sum, amount) => sum + amount, 0) !== targetDisplaySteps) return null;

  return {
    totalFlourGrams: targetDisplaySteps * displayStepGrams,
    bigaFlourGrams: allocated[0] * displayStepGrams,
    poolishFlourGrams: allocated[1] * displayStepGrams,
    finalFlourGrams: allocated[2] * displayStepGrams,
    displayUnit,
  };
}

const MIN_SHARE_PCT = 20;
const MAX_SHARE_PCT = 80;
const SHARE_STEP_PCT = 5;
export const MIN_PRO_BIGA_HYDRATION_PCT = 45;
export const MAX_PRO_BIGA_HYDRATION_PCT = 55;
export const DEFAULT_PRO_BIGA_HYDRATION_PCT = 50;

export function normalizeProBigaHydrationPct(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PRO_BIGA_HYDRATION_PCT;
  return Math.min(MAX_PRO_BIGA_HYDRATION_PCT, Math.max(MIN_PRO_BIGA_HYDRATION_PCT, value));
}

function isFinitePercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function clampShare(value: number): number {
  return Math.min(MAX_SHARE_PCT, Math.max(MIN_SHARE_PCT, value));
}

export function normalizeComplementaryPrefermentShares(
  requestedPct: number,
  changedSide: PrefermentSide,
): { bigaPct: number; poolishPct: number } {
  const selectedPct = clampShare(Number.isFinite(requestedPct) ? requestedPct : 50);
  return changedSide === 'biga'
    ? { bigaPct: selectedPct, poolishPct: 100 - selectedPct }
    : { bigaPct: 100 - selectedPct, poolishPct: selectedPct };
}

function roundDownToStep(value: number): number {
  return Math.floor(value / SHARE_STEP_PCT) * SHARE_STEP_PCT;
}

export function prefermentWaterDemand(
  bigaPct: number,
  poolishPct: number,
  bigaHydrationPct: number,
  poolishHydrationPct: number,
): number {
  return bigaPct * bigaHydrationPct + poolishPct * poolishHydrationPct;
}

export function getMinimumTotalHydrationPct(
  bigaPct: number,
  poolishPct: number,
  bigaHydrationPct: number,
  poolishHydrationPct: number,
): number {
  return Math.ceil(prefermentWaterDemand(bigaPct, poolishPct, bigaHydrationPct, poolishHydrationPct) / 100);
}

function isFeasible(
  bigaPct: number,
  poolishPct: number,
  totalHydrationPct: number,
  bigaHydrationPct: number,
  poolishHydrationPct: number,
): boolean {
  return bigaPct + poolishPct <= 100
    && prefermentWaterDemand(bigaPct, poolishPct, bigaHydrationPct, poolishHydrationPct) <= totalHydrationPct * 100;
}

function validInput(input: PrefermentAlignmentInput | PrefermentHydrationRepairInput): boolean {
  return [
    input.bigaPct,
    input.poolishPct,
    input.totalHydrationPct,
    input.bigaHydrationPct,
    input.poolishHydrationPct,
  ].every(isFinitePercentage);
}

function adjustmentReason(
  bigaPct: number,
  poolishPct: number,
  totalHydrationPct: number,
  bigaHydrationPct: number,
  poolishHydrationPct: number,
): PrefermentAdjustmentReason {
  if (bigaPct + poolishPct > 100) return 'flour';
  if (prefermentWaterDemand(bigaPct, poolishPct, bigaHydrationPct, poolishHydrationPct) > totalHydrationPct * 100) return 'water';
  return null;
}

export function alignPrefermentShare(input: PrefermentAlignmentInput): PrefermentAlignmentResult {
  if (!validInput(input)) {
    return {
      bigaPct: input.bigaPct,
      poolishPct: input.poolishPct,
      adjustedSide: null,
      reason: null,
      maximumReached: false,
      blocked: true,
    };
  }

  const requestedPct = clampShare(input.requestedPct);
  const currentOtherPct = input.changedSide === 'biga' ? input.poolishPct : input.bigaPct;
  const changedHydrationPct = input.changedSide === 'biga' ? input.bigaHydrationPct : input.poolishHydrationPct;
  const otherHydrationPct = input.changedSide === 'biga' ? input.poolishHydrationPct : input.bigaHydrationPct;
  const candidateBigaPct = input.changedSide === 'biga' ? requestedPct : input.bigaPct;
  const candidatePoolishPct = input.changedSide === 'poolish' ? requestedPct : input.poolishPct;

  if (isFeasible(candidateBigaPct, candidatePoolishPct, input.totalHydrationPct, input.bigaHydrationPct, input.poolishHydrationPct)) {
    return {
      bigaPct: candidateBigaPct,
      poolishPct: candidatePoolishPct,
      adjustedSide: null,
      reason: null,
      maximumReached: false,
      blocked: false,
    };
  }

  const availableWater = input.totalHydrationPct * 100 - requestedPct * changedHydrationPct;
  const maxOtherByWater = otherHydrationPct > 0 ? availableWater / otherHydrationPct : 100;
  const maxOtherByFlour = 100 - requestedPct;
  const maxOtherPct = Math.min(currentOtherPct, maxOtherByFlour, maxOtherByWater);
  const reason = maxOtherByWater < maxOtherByFlour ? 'water' : 'flour';

  if (maxOtherPct >= MIN_SHARE_PCT) {
    const adjustedOtherPct = Math.max(MIN_SHARE_PCT, roundDownToStep(maxOtherPct));
    return {
      bigaPct: input.changedSide === 'biga' ? requestedPct : adjustedOtherPct,
      poolishPct: input.changedSide === 'poolish' ? requestedPct : adjustedOtherPct,
      adjustedSide: input.changedSide === 'biga' ? 'poolish' : 'biga',
      reason,
      maximumReached: false,
      blocked: false,
    };
  }

  const availableWaterWithMinimumOther = input.totalHydrationPct * 100 - MIN_SHARE_PCT * otherHydrationPct;
  const maxChangedByWater = changedHydrationPct > 0 ? availableWaterWithMinimumOther / changedHydrationPct : 100;
  const maxChangedPct = Math.min(100 - MIN_SHARE_PCT, maxChangedByWater);
  const steppedChangedPct = roundDownToStep(maxChangedPct);
  if (steppedChangedPct >= MIN_SHARE_PCT) {
    return {
      bigaPct: input.changedSide === 'biga' ? steppedChangedPct : MIN_SHARE_PCT,
      poolishPct: input.changedSide === 'poolish' ? steppedChangedPct : MIN_SHARE_PCT,
      adjustedSide: input.changedSide === 'biga' ? 'biga' : 'poolish',
      reason: 'water',
      maximumReached: true,
      blocked: false,
    };
  }

  return {
    bigaPct: MIN_SHARE_PCT,
    poolishPct: MIN_SHARE_PCT,
    adjustedSide: input.changedSide,
    reason: 'water',
    maximumReached: true,
    blocked: true,
  };
}

export function repairPrefermentHydration(input: PrefermentHydrationRepairInput): PrefermentAlignmentResult {
  if (!validInput(input)) {
    return {
      bigaPct: input.bigaPct,
      poolishPct: input.poolishPct,
      adjustedSide: null,
      reason: null,
      maximumReached: false,
      blocked: true,
    };
  }

  let bigaPct = clampShare(input.bigaPct);
  let poolishPct = clampShare(input.poolishPct);
  const order: PrefermentSide[] = input.bigaHydrationPct > input.poolishHydrationPct
    ? ['biga', 'poolish']
    : input.bigaHydrationPct < input.poolishHydrationPct
      ? ['poolish', 'biga']
      : ['poolish', 'biga'];
  let adjustedSide: PrefermentSide | null = null;

  for (const side of order) {
    while (!isFeasible(bigaPct, poolishPct, input.totalHydrationPct, input.bigaHydrationPct, input.poolishHydrationPct)) {
      if (side === 'biga' && bigaPct > MIN_SHARE_PCT) {
        bigaPct = Math.max(MIN_SHARE_PCT, bigaPct - SHARE_STEP_PCT);
        adjustedSide = side;
      } else if (side === 'poolish' && poolishPct > MIN_SHARE_PCT) {
        poolishPct = Math.max(MIN_SHARE_PCT, poolishPct - SHARE_STEP_PCT);
        adjustedSide = side;
      } else {
        break;
      }
    }
    if (isFeasible(bigaPct, poolishPct, input.totalHydrationPct, input.bigaHydrationPct, input.poolishHydrationPct)) break;
  }

  return {
    bigaPct,
    poolishPct,
    adjustedSide,
    reason: adjustedSide ? adjustmentReason(input.bigaPct, input.poolishPct, input.totalHydrationPct, input.bigaHydrationPct, input.poolishHydrationPct) ?? 'water' : null,
    maximumReached: false,
    blocked: !isFeasible(bigaPct, poolishPct, input.totalHydrationPct, input.bigaHydrationPct, input.poolishHydrationPct),
  };
}
