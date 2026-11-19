export type BigaPoolishAllocationMode = 'automatic' | 'manual';

export type BigaPoolishMathStatus = 'valid' | 'negative-remainder';
export type BigaPoolishApplicationStatus = 'accepted' | 'final-flour-required' | 'invalid';

export type BigaPoolishIngredientBlock = {
  flourGrams: number;
  waterGrams: number;
  saltGrams: number;
};

export type BigaPoolishCalculationInput = {
  totalFlourGrams: number;
  totalHydrationPct: number;
  totalSaltPct: number;
  allocationMode: BigaPoolishAllocationMode;
  prefermentFlourPct?: number;
  bigaShareOfPrefermentPct?: number;
  bigaFlourPct?: number;
  poolishFlourPct?: number;
  bigaHydrationPct: number;
  poolishHydrationPct: number;
  requirePositiveFinalFlour?: boolean;
  toleranceGrams?: number;
};

export type BigaPoolishCalculationResult = {
  allocationMode: BigaPoolishAllocationMode;
  total: BigaPoolishIngredientBlock;
  biga: BigaPoolishIngredientBlock;
  poolish: BigaPoolishIngredientBlock;
  final: BigaPoolishIngredientBlock;
  prefermentFlourPct: number;
  bigaFlourPct: number;
  poolishFlourPct: number;
  mathStatus: BigaPoolishMathStatus;
  applicationStatus: BigaPoolishApplicationStatus;
  mathematicallyBalanced: boolean;
  finalFlourPositive: boolean;
};

const DEFAULT_TOLERANCE_GRAMS = 1e-9;

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

function assertNonnegative(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0) throw new RangeError(`${name} must be nonnegative.`);
}

function assertPercentage(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0 || value > 100) throw new RangeError(`${name} must be between 0 and 100.`);
}

function normalizeNearZero(value: number, tolerance: number): number {
  return Math.abs(value) <= tolerance ? 0 : value;
}

function assertHydration(name: string, value: number): void {
  assertNonnegative(name, value);
}

export function calculateBigaPoolishIngredients(
  input: BigaPoolishCalculationInput,
): BigaPoolishCalculationResult {
  assertFinite('totalFlourGrams', input.totalFlourGrams);
  if (input.totalFlourGrams <= 0) throw new RangeError('Total flour must be positive.');
  assertHydration('totalHydrationPct', input.totalHydrationPct);
  assertPercentage('totalSaltPct', input.totalSaltPct);
  assertHydration('bigaHydrationPct', input.bigaHydrationPct);
  assertHydration('poolishHydrationPct', input.poolishHydrationPct);

  const tolerance = input.toleranceGrams ?? DEFAULT_TOLERANCE_GRAMS;
  assertFinite('toleranceGrams', tolerance);
  if (tolerance < 0) throw new RangeError('Tolerance must be nonnegative.');

  let prefermentFlourPct: number;
  let bigaFlourPct: number;
  let poolishFlourPct: number;
  if (input.allocationMode === 'automatic') {
    if (input.prefermentFlourPct === undefined || input.bigaShareOfPrefermentPct === undefined) {
      throw new RangeError('Automatic allocation requires preferment and Biga percentages.');
    }
    assertPercentage('prefermentFlourPct', input.prefermentFlourPct);
    assertPercentage('bigaShareOfPrefermentPct', input.bigaShareOfPrefermentPct);
    prefermentFlourPct = input.prefermentFlourPct;
    bigaFlourPct = prefermentFlourPct * input.bigaShareOfPrefermentPct / 100;
    poolishFlourPct = prefermentFlourPct - bigaFlourPct;
  } else if (input.allocationMode === 'manual') {
    if (input.bigaFlourPct === undefined || input.poolishFlourPct === undefined) {
      throw new RangeError('Manual allocation requires Biga and Poolish percentages.');
    }
    assertPercentage('bigaFlourPct', input.bigaFlourPct);
    assertPercentage('poolishFlourPct', input.poolishFlourPct);
    if (input.bigaFlourPct + input.poolishFlourPct > 100) {
      throw new RangeError('Manual preferment flour percentages cannot exceed 100.');
    }
    bigaFlourPct = input.bigaFlourPct;
    poolishFlourPct = input.poolishFlourPct;
    prefermentFlourPct = bigaFlourPct + poolishFlourPct;
  } else {
    throw new RangeError('Allocation mode is invalid.');
  }

  const totalFlourGrams = input.totalFlourGrams;
  const totalWaterGrams = totalFlourGrams * input.totalHydrationPct / 100;
  const totalSaltGrams = totalFlourGrams * input.totalSaltPct / 100;
  const bigaFlourGrams = totalFlourGrams * bigaFlourPct / 100;
  const poolishFlourGrams = totalFlourGrams * poolishFlourPct / 100;
  const finalFlourGrams = totalFlourGrams - bigaFlourGrams - poolishFlourGrams;
  const bigaWaterGrams = bigaFlourGrams * input.bigaHydrationPct / 100;
  const poolishWaterGrams = poolishFlourGrams * input.poolishHydrationPct / 100;
  const finalWaterGrams = totalWaterGrams - bigaWaterGrams - poolishWaterGrams;

  const finalFlour = normalizeNearZero(finalFlourGrams, tolerance);
  const finalWater = normalizeNearZero(finalWaterGrams, tolerance);
  const negativeRemainder = finalFlour < -tolerance || finalWater < -tolerance;
  const mathStatus: BigaPoolishMathStatus = negativeRemainder ? 'negative-remainder' : 'valid';
  const mathematicallyBalanced = mathStatus === 'valid';
  const finalFlourPositive = finalFlour > tolerance;
  const requirePositiveFinalFlour = input.requirePositiveFinalFlour ?? true;
  const applicationStatus: BigaPoolishApplicationStatus = negativeRemainder
    ? 'invalid'
    : requirePositiveFinalFlour && !finalFlourPositive
      ? 'final-flour-required'
      : 'accepted';

  return {
    allocationMode: input.allocationMode,
    total: { flourGrams: totalFlourGrams, waterGrams: totalWaterGrams, saltGrams: totalSaltGrams },
    biga: { flourGrams: bigaFlourGrams, waterGrams: bigaWaterGrams, saltGrams: 0 },
    poolish: { flourGrams: poolishFlourGrams, waterGrams: poolishWaterGrams, saltGrams: 0 },
    final: { flourGrams: finalFlour, waterGrams: finalWater, saltGrams: totalSaltGrams },
    prefermentFlourPct,
    bigaFlourPct,
    poolishFlourPct,
    mathStatus,
    applicationStatus,
    mathematicallyBalanced,
    finalFlourPositive,
  };
}
