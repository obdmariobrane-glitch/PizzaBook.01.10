import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};
const { adaptProGlutenFreeMixingPhaseA } = require('../src/i18n/proGlutenFreeBulk.ts');
const source = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function loadGenerator(name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `production generator ${name} must be found`);

  const code = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const runtime = vm.createContext({
    croatianHours: (hours) => `${hours} sati`,
    croatianMinutes: (minutes) => `${minutes} minuta`,
    formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
    formatTemperature: (temperature) => `${temperature} °C`,
    getBeginnerNewYorkInstantMixerInstructions: () => undefined,
    getBeginnerOvenTimers: () => [],
    getTegliaFinalProofPlan: () => ({ totalMinutes: 0, proofMinutes: 0, pressRelaxationMinutes: 0 }),
    getTemperingWindow: () => ({ minimumMinutes: 15, maximumMinutes: 30, initialMinutes: 15 }),
    phaseBBulkRestMinutes: () => 30,
  });
  vm.runInContext(`${code}\nglobalThis.generator = ${name};`, runtime);
  return runtime.generator;
}

const generateHr = loadGenerator('getDetailedDirectSteps');
const generateLocalized = loadGenerator('getDetailedDirectStepsLocalized');
const ingredients = { flour: 1000, water: 700, salt: 20, oil: 20, yeast: 2 };
const styleVariants = [
  ['napolitana', false, false, false, true],
  ['romanaTonda', true, false, false, false],
  ['romanaTeglia', false, true, false, false],
  ['newYork', false, false, true, false],
];

function makePreferment(method) {
  return method === 'biga'
    ? { flour: 100, water: 45, yeast: 0.1, remainingFlour: 900, remainingWater: 455, pct: 10 }
    : method === 'poolish'
      ? { flour: 100, water: 100, yeast: 0.1, remainingFlour: 900, remainingWater: 400, pct: 10 }
      : undefined;
}

function generateHrPhase({ style, mixing, flour, method = 'direct', beginner = false, fridgeHours = 0, yeast = 'fresh' }) {
  const variant = styleVariants.find(([name]) => name === style);
  const [ , romanTonda, romanTeglia, newYork, napolitana] = variant;
  const phase = generateHr(
    mixing,
    ingredients,
    1742,
    2,
    300,
    30,
    fridgeHours,
    4,
    'ooni',
    450,
    21,
    60,
    80,
    method === 'biga' ? makePreferment(method) : undefined,
    method === 'poolish' ? makePreferment(method) : undefined,
    flour,
    romanTonda,
    romanTeglia,
    newYork,
    napolitana,
    { width: 30, length: 40 },
    '5–7 min',
    21,
    beginner,
    undefined,
    undefined,
    0,
    yeast,
    4,
  )[0];
  return phase;
}

function generateLocalizedPhase({ lang, style, mixing, flour, beginner = false }) {
  const variant = styleVariants.find(([name]) => name === style)[0];
  return generateLocalized(
    lang,
    ingredients,
    1742,
    2,
    300,
    30,
    0,
    4,
    21,
    4,
    60,
    80,
    'ooni',
    450,
    '5–7 min',
    mixing,
    variant,
    flour,
    { width: 30, length: 40 },
    21,
    beginner,
    undefined,
    undefined,
    0,
    'fresh',
  )[0];
}

function assertRestMatchesTimer(phase, expectedMinutes, context) {
  const restStep = phase.steps.findLast((step) =>
    /(?:psyllium|gluten|rest|ruh|odmor|počiv|ruhen)/i.test(step)
    && /\d+(?:\s*[–-]\s*\d+)?\s*(?:minutes?|minuta|minut|Minuten)/i.test(step));
  assert.ok(restStep, `${context}: generated rest instruction must be present`);
  const duration = restStep.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:minutes?|minuta|minut|Minuten)/i);
  assert.ok(duration, `${context}: rest instruction must state a duration`);
  const lowMinutes = Number(duration[1]);
  const highMinutes = Number(duration[2] ?? duration[1]);
  const restTimer = phase.timers?.find((timer) => timer.kind === 'rest');
  assert.ok(restTimer, `${context}: generated rest timer must be present`);
  assert.ok(
    expectedMinutes >= lowMinutes && expectedMinutes <= highMinutes,
    `${context}: instruction says ${lowMinutes}–${highMinutes} minutes, expected ${expectedMinutes}`,
  );
  assert.equal(restTimer.seconds, expectedMinutes * 60, `${context}: timer duration must match instruction`);
  return restStep;
}

function assertNoSeparateHydrationRest(phase, context) {
  assert.equal(
    phase.timers?.some((timer) => timer.id.startsWith('post-mix-rest')),
    false,
    `${context}: PRO Phase A has no separate post-mix hydration timer`,
  );
  assert.doesNotMatch(
    phase.steps.join(' '),
    /\b5\s*(?:minutes?|minuta|minut|Minuten)\b/i,
    `${context}: PRO Phase A has no separate five-minute hydration instruction`,
  );
}

for (const [style] of styleVariants) {
  for (const fridgeHours of [0, 24]) {
    for (const yeast of ['fresh', 'activeDry', 'dry']) {
      for (const mixing of ['hand', 'mixer']) {
        const phase = generateHrPhase({ style, mixing, flour: 'glutenFree', fridgeHours, yeast });
        assertRestMatchesTimer(phase, 5, `hr/direct/${style}/glutenFree/${mixing}/${fridgeHours}h/${yeast} before PRO phase adaptation`);
        assertNoSeparateHydrationRest(
          adaptProGlutenFreeMixingPhaseA(phase, mixing),
          `hr/direct/${style}/glutenFree/${mixing}/${fridgeHours}h/${yeast}`,
        );
      }
    }
  }
}

for (const style of ['napolitana', 'romanaTonda', 'newYork']) {
  assertRestMatchesTimer(
    generateHrPhase({ style, mixing: 'hand', flour: 'caputo00' }),
    15,
    `hr/direct/${style}/caputo00/hand control`,
  );
}
assertRestMatchesTimer(
  generateHrPhase({ style: 'romanaTeglia', mixing: 'hand', flour: 'caputo00' }),
  5,
  'hr/direct/romanaTeglia/caputo00/hand control',
);

const nonGlutenFreeFlours = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'custom'];
for (const [style] of styleVariants) {
  for (const flour of nonGlutenFreeFlours) {
    for (const mixing of ['hand', 'mixer']) {
      const expectedMinutes = style === 'romanaTeglia' || mixing === 'mixer' ? 5 : 15;
      assertRestMatchesTimer(
        generateHrPhase({ style, mixing, flour }),
        expectedMinutes,
        `hr/direct/${style}/${flour}/${mixing} control`,
      );
    }
  }
}

for (const style of ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork']) {
  for (const method of ['biga', 'poolish']) {
    for (const flour of ['glutenFree', ...nonGlutenFreeFlours]) {
      for (const mixing of ['hand', 'mixer']) {
        const expectedMinutes = style !== 'romanaTeglia' && mixing === 'hand' ? 15 : 5;
        assertRestMatchesTimer(
          generateHrPhase({ style, mixing, flour, method }),
          expectedMinutes,
          `hr/${method}/${style}/${flour}/${mixing}`,
        );
      }
    }
  }
}

for (const lang of ['en', 'de', 'sl']) {
  for (const [style] of styleVariants) {
    for (const mixing of ['hand', 'mixer']) {
      const phase = generateLocalizedPhase({ lang, style, mixing, flour: 'glutenFree' });
      assertRestMatchesTimer(phase, 5, `${lang}/direct/${style}/glutenFree/${mixing} before PRO phase adaptation`);
      assertNoSeparateHydrationRest(
        adaptProGlutenFreeMixingPhaseA(phase, mixing),
        `${lang}/direct/${style}/glutenFree/${mixing}`,
      );
    }
  }
  for (const [style] of styleVariants) {
    for (const flour of nonGlutenFreeFlours) {
      for (const mixing of ['hand', 'mixer']) {
        assertRestMatchesTimer(
          generateLocalizedPhase({ lang, style, mixing, flour }),
          5,
          `${lang}/direct/${style}/${flour}/${mixing} control`,
        );
      }
    }
  }
}

assertRestMatchesTimer(
  generateHrPhase({ style: 'napolitana', mixing: 'hand', flour: 'glutenFree', beginner: true }),
  5,
  'beginner/direct/napolitana/glutenFree/hand',
);
assertRestMatchesTimer(
  generateHrPhase({ style: 'newYork', mixing: 'mixer', flour: 'glutenFree', beginner: true, yeast: 'dry' }),
  5,
  'beginner/direct/newYork/glutenFree/mixer',
);
for (const lang of ['en', 'de', 'sl']) {
  assertRestMatchesTimer(
    generateLocalizedPhase({ lang, style: 'newYork', mixing: 'mixer', flour: 'glutenFree', beginner: true }),
    5,
    `beginner/${lang}/direct/newYork/glutenFree/mixer`,
  );
}
assertRestMatchesTimer(
  generateHrPhase({ style: 'newYork', mixing: 'mixer', flour: 'caputo00', beginner: true, yeast: 'dry' }),
  6,
  'beginner/direct/newYork/caputo00/mixer',
);

console.log('PRO mixing rest text/timer regression passed');
