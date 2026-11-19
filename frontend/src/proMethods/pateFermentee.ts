export type PateFermenteeInputMode = 'mass' | 'flour';
export type PateFermenteeComposition = 'modeled-only' | 'known-additions' | 'unknown-additions';
export type PateFermenteeStatus = 'valid' | 'incomplete-data' | 'negative-remainder';

export type PateFermenteeIngredientBlock = {
  flourGrams: number;
  waterGrams: number;
  saltGrams: number;
  yeastGrams: number;
};

export type PateFermenteeCalculationInput = {
  inputMode: PateFermenteeInputMode;
  totalFlourGrams: number;
  totalHydrationPct: number;
  totalSaltPct: number;
  targetYeastGrams: number;
  oldDoughMassGrams?: number;
  oldFlourGrams?: number;
  oldHydrationPct?: number;
  oldSaltPct?: number;
  oldYeastPct?: number;
  composition: PateFermenteeComposition;
  knownAdditionalMassGrams?: number;
  toleranceGrams?: number;
};

export type PateFermenteeCalculationResult = {
  status: PateFermenteeStatus;
  total: PateFermenteeIngredientBlock;
  // Additional mass is included in old dough mass but is outside the modeled F/W/S/Y ledger.
  old: PateFermenteeIngredientBlock & { totalMassGrams: number; additionalMassGrams: number };
  remaining: PateFermenteeIngredientBlock;
  oldFlourPctBasis: true;
  yeastBalanced: boolean;
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

function incompleteResult(
  input: PateFermenteeCalculationInput,
  tolerance: number,
): PateFermenteeCalculationResult {
  const total = {
    flourGrams: input.totalFlourGrams,
    waterGrams: input.totalFlourGrams * input.totalHydrationPct / 100,
    saltGrams: input.totalFlourGrams * input.totalSaltPct / 100,
    yeastGrams: input.targetYeastGrams,
  };
  const empty = { flourGrams: 0, waterGrams: 0, saltGrams: 0, yeastGrams: 0 };
  return {
    status: 'incomplete-data',
    total,
    old: { ...empty, totalMassGrams: 0, additionalMassGrams: 0 },
    remaining: { ...empty },
    oldFlourPctBasis: true,
    yeastBalanced: Math.abs(total.yeastGrams) <= tolerance,
  };
}

function validateCommonInput(input: PateFermenteeCalculationInput): number {
  assertFinite('totalFlourGrams', input.totalFlourGrams);
  if (input.totalFlourGrams <= 0) throw new RangeError('Total flour must be positive.');
  assertNonnegative('totalHydrationPct', input.totalHydrationPct);
  assertPercentage('totalSaltPct', input.totalSaltPct);
  assertNonnegative('targetYeastGrams', input.targetYeastGrams);
  const tolerance = input.toleranceGrams ?? DEFAULT_TOLERANCE_GRAMS;
  assertNonnegative('toleranceGrams', tolerance);
  return tolerance;
}

export function calculatePateFermentee(
  input: PateFermenteeCalculationInput,
): PateFermenteeCalculationResult {
  const tolerance = validateCommonInput(input);
  if (input.inputMode !== 'mass' && input.inputMode !== 'flour') {
    throw new RangeError('Pâte Fermentée input mode is invalid.');
  }
  if (!['modeled-only', 'known-additions', 'unknown-additions'].includes(input.composition)) {
    throw new RangeError('Pâte Fermentée composition mode is invalid.');
  }
  if (input.composition === 'unknown-additions') return incompleteResult(input, tolerance);
  if (input.composition === 'known-additions') {
    if (input.knownAdditionalMassGrams === undefined) return incompleteResult(input, tolerance);
    assertNonnegative('knownAdditionalMassGrams', input.knownAdditionalMassGrams);
  }
  if (input.oldHydrationPct === undefined || input.oldSaltPct === undefined || input.oldYeastPct === undefined) {
    return incompleteResult(input, tolerance);
  }
  assertNonnegative('oldHydrationPct', input.oldHydrationPct);
  assertPercentage('oldSaltPct', input.oldSaltPct);
  assertNonnegative('oldYeastPct', input.oldYeastPct);

  const additionalMassGrams = input.knownAdditionalMassGrams ?? 0;
  let oldFlourGrams: number;
  if (input.inputMode === 'mass') {
    if (input.oldDoughMassGrams === undefined) return incompleteResult(input, tolerance);
    assertNonnegative('oldDoughMassGrams', input.oldDoughMassGrams);
    if (input.oldDoughMassGrams <= 0) {
      throw new RangeError('Old dough mass must be positive.');
    }
    if (input.oldDoughMassGrams - additionalMassGrams < -tolerance) {
      throw new RangeError('Known additional mass cannot exceed old dough mass.');
    }
    const compositionFactor = 1
      + input.oldHydrationPct / 100
      + input.oldSaltPct / 100
      + input.oldYeastPct / 100;
    oldFlourGrams = (input.oldDoughMassGrams - additionalMassGrams) / compositionFactor;
    if (oldFlourGrams <= tolerance) {
      throw new RangeError('Derived old flour must be greater than tolerance.');
    }
  } else {
    if (input.oldFlourGrams === undefined) return incompleteResult(input, tolerance);
    assertNonnegative('oldFlourGrams', input.oldFlourGrams);
    if (input.oldFlourGrams <= 0) {
      throw new RangeError('Old flour must be positive.');
    }
    oldFlourGrams = input.oldFlourGrams;
  }

  const oldWaterGrams = oldFlourGrams * input.oldHydrationPct / 100;
  const oldSaltGrams = oldFlourGrams * input.oldSaltPct / 100;
  const oldYeastGrams = oldFlourGrams * input.oldYeastPct / 100;
  const oldTotalMassGrams = oldFlourGrams + oldWaterGrams + oldSaltGrams + oldYeastGrams + additionalMassGrams;
  const total = {
    flourGrams: input.totalFlourGrams,
    waterGrams: input.totalFlourGrams * input.totalHydrationPct / 100,
    saltGrams: input.totalFlourGrams * input.totalSaltPct / 100,
    yeastGrams: input.targetYeastGrams,
  };
  const remaining = {
    flourGrams: normalizeNearZero(total.flourGrams - oldFlourGrams, tolerance),
    waterGrams: normalizeNearZero(total.waterGrams - oldWaterGrams, tolerance),
    saltGrams: normalizeNearZero(total.saltGrams - oldSaltGrams, tolerance),
    yeastGrams: normalizeNearZero(total.yeastGrams - oldYeastGrams, tolerance),
  };
  const hasNegativeRemainder = Object.values(remaining).some((value) => value < -tolerance);
  return {
    status: hasNegativeRemainder ? 'negative-remainder' : 'valid',
    total,
    old: {
      flourGrams: oldFlourGrams,
      waterGrams: oldWaterGrams,
      saltGrams: oldSaltGrams,
      yeastGrams: oldYeastGrams,
      totalMassGrams: oldTotalMassGrams,
      additionalMassGrams,
    },
    remaining,
    oldFlourPctBasis: true,
    yeastBalanced: Math.abs(oldYeastGrams + remaining.yeastGrams - total.yeastGrams) <= tolerance,
  };
}
