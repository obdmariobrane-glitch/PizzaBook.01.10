import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './spiralMixing' && context.parentURL?.endsWith('/src/i18n/prefermentSteps.ts')) {
      return nextResolve('./spiralMixing.ts', context);
    }
    if (specifier === './proIceWaterInstructions' && context.parentURL?.endsWith('/src/i18n/spiralMixing.ts')) {
      return nextResolve('./proIceWaterInstructions.ts', context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  doughCalc,
  isValidProTrayDimension,
  normalizeBeginnerSavedState,
  parseProTrayDimensionInput,
  reversePlan,
} = await import('../src/calculator.ts');
const calculatorUi = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const planner = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
const calculator = await readFile(new URL('../src/calculator.ts', import.meta.url), 'utf8');

for (const value of [20, 30, 60]) assert.equal(isValidProTrayDimension(value), true);
for (const value of [0, -1, 19, 61, 20.5, Number.NaN, Number.POSITIVE_INFINITY, '30', null]) {
  assert.equal(isValidProTrayDimension(value), false, `${String(value)} must not be a valid PRO dimension`);
}
for (const [input, expected] of [['20', 20], ['30', 30], ['60', 60], ['', null], ['0', null], ['19', null], ['61', null], ['-20', null], ['abc', null], ['20.5', null]]) {
  assert.equal(parseProTrayDimensionInput(input), expected, `parse tray dimension "${input}"`);
}

const defaultAreaDough = Math.round(30 * 40 * 0.4);
assert.equal(defaultAreaDough, 480);
const ingredients = doughCalc({
  pizzas: 4,
  ballWeight: defaultAreaDough,
  hydration: 59,
  saltPct: 2.8,
  oilPct: 4,
  method: 'direct',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
});
assert.equal(ingredients.totalDough, 1920, 'four 30×40 cm trays yield 1,920 g at 0.4 g/cm²');
assert.deepEqual(
  [ingredients.total.flour, ingredients.total.water, ingredients.total.salt, ingredients.total.oil, ingredients.total.yeast],
  [1157, 683, 32.4, 46, 1.11],
  'valid Teglia dimensions preserve the expected ingredient quantities',
);

const plannerSteps = reversePlan(
  new Date('2026-10-14T18:00:00.000Z'),
  'direct',
  'romana',
  {
    ovenTitle: 'Preheat',
    ovenDesc: 'Preheat oven.',
    ovenRomanDesc: 'Preheat oven.',
    directMixTitle: 'Mix dough',
    directRomanDesc: 'Mix dough.',
    warmTitle: 'Warm',
    warmDesc: 'Warm.',
    coldTitle: 'Cold',
    coldDesc: 'Cold.',
    directHomeTegliaCopy: {
      trayPrepareTitle: 'Prepare tray',
      trayPrepare: 'Divide {TOTAL_DOUGH} into {TRAY_COUNT} portions of {DOUGH_PER_TRAY}, one per {TRAY_DIMENSIONS} tray.',
      finalProofTitle: 'Final proof',
      finalProof: 'Proof for {PROOF_MINUTES}.',
      proofUnavailable: 'Insufficient time.',
    },
  },
  null,
  null,
  null,
  'en',
  undefined,
  22,
  { phases: [{ kind: 'final-rest', environment: 'room', hours: 3, temperature: 22 }] },
  { romanFormat: 'teglia', trayCount: 4, doughPerTray: 0, trayWidth: 0, trayLength: 40 },
);
assert.match(
  plannerSteps.find((step) => step.title === 'Prepare tray')?.desc ?? '',
  /1920 g into 4 portions of 480 g, one per 30 × 40 cm tray/,
  'invalid zero dimensions and zero mass cannot enter generated Planner instructions',
);

const beginnerTray = normalizeBeginnerSavedState({
  pizzaStyle: 'romana',
  romanFormat: 'teglia',
  trayWidth: 15,
  trayLength: 15,
  oven: 'homePan',
  ovenTemp: 250,
});
assert.deepEqual([beginnerTray.trayWidth, beginnerTray.trayLength], [15, 15], 'F42 must not alter Beginner tray normalization');

assert.match(calculatorUi, /setTrayWidthInput\(value\);[\s\S]{0,180}parseProTrayDimensionInput\(value\)/);
assert.match(calculatorUi, /if \(isBeginner\) \{\s*const clean = value\.replace\(\/\[\^0-9\]\/g, ''\)\.slice\(0, 2\);\s*setTrayWidthInput\(clean\)/, 'Beginner width input keeps its original behavior');
assert.match(calculatorUi, /else if \(parseProTrayDimensionInput\(trayWidthInput\) === null\) setTrayWidthInput\(String\(trayWidth\)\)/);
assert.match(calculatorUi, /setTrayLengthInput\(value\);[\s\S]{0,180}parseProTrayDimensionInput\(value\)/);
assert.match(calculatorUi, /if \(isBeginner\) \{\s*const clean = value\.replace\(\/\[\^0-9\]\/g, ''\)\.slice\(0, 2\);\s*setTrayLengthInput\(clean\)/, 'Beginner length input keeps its original behavior');
assert.match(calculatorUi, /else if \(parseProTrayDimensionInput\(trayLengthInput\) === null\) setTrayLengthInput\(String\(trayLength\)\)/);
assert.match(calculatorUi, /isValidProTrayDimension\(saved\.trayWidth\)/, 'invalid stored PRO width is not restored');
assert.match(calculatorUi, /isValidProTrayDimension\(saved\.trayLength\)/, 'invalid stored PRO length is not restored');
assert.match(calculatorUi, /isValidProTrayDimension\(settings\.trayWidth\)/, 'invalid saved recipe width is not applied in PRO');
assert.match(calculatorUi, /isValidProTrayDimension\(settings\.trayLength\)/, 'invalid saved recipe length is not applied in PRO');
assert.match(calculatorUi, /Math\.round\(trayWidth \* trayLength \* 0\.4\)/, 'tray dough mass uses committed dimensions');
assert.match(planner, /const trayWidth = readTrayDimension\('trayWidth', DEFAULT_PLANNER_TEGLIA_SETTINGS\.trayWidth\)/);
assert.match(planner, /const trayLength = readTrayDimension\('trayLength', DEFAULT_PLANNER_TEGLIA_SETTINGS\.trayLength\)/);
assert.match(planner, /if \(isBeginner\) return readPositiveSetting\(key, fallback\)/, 'Beginner Planner restore remains unchanged');
assert.match(planner, /if \(isValidProTrayDimension\(saved\)\) return saved/);
assert.match(calculator, /const trayWidth = positiveSetting\(tegliaSettings\?\.trayWidth, 30\)/);
assert.match(calculator, /const trayLength = positiveSetting\(tegliaSettings\?\.trayLength, 40\)/);
assert.match(calculator, /const positiveSetting = \(value: number \| undefined, fallback: number\) =>\s*value !== undefined && Number\.isFinite\(value\) && value > 0 \? value : fallback/);

console.log('F42 PRO tray-dimension regression passed: draft, range, saved state, Beginner isolation, area mass, and Planner defaults.');
