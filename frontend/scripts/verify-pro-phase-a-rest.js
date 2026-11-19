#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const sourceFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const bulkSourcePath = path.join(frontendRoot, 'src', 'i18n', 'proDirectBulk.ts');
const bulkSource = fs.readFileSync(bulkSourcePath, 'utf8');
const bulkRestModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(bulkSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: bulkRestModule,
  exports: bulkRestModule.exports,
  require: (specifier) => {
    assert.equal(specifier, './prefermentSteps');
    return { formatDuration: (seconds) => `${Math.round(seconds / 60)} min` };
  },
});
assert.equal(typeof bulkRestModule.exports.getProNapolitanaBulkRestSeconds, 'function');

function loadGenerator(name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `production generator ${name} must be present`);
  const compiled = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const context = vm.createContext({
    croatianHours: (hours) => `${hours} sati`,
    croatianMinutes: (minutes) => `${minutes} minuta`,
    formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
    formatTemperature: (temperature) => `${temperature} °C`,
    getProNapolitanaBulkRestSeconds: bulkRestModule.exports.getProNapolitanaBulkRestSeconds,
    PRO_NAPOLITANA_MIX_REST_SECONDS: bulkRestModule.exports.PRO_NAPOLITANA_MIX_REST_SECONDS,
    getBeginnerNewYorkInstantMixerInstructions: () => undefined,
    getBeginnerOvenTimers: () => [],
    getTegliaFinalProofPlan: () => ({ totalMinutes: 0, proofMinutes: 0, pressRelaxationMinutes: 0 }),
    getTemperingWindow: () => ({ minimumMinutes: 15, maximumMinutes: 30, initialMinutes: 15 }),
    phaseBBulkRestMinutes: () => 30,
    getOvenBehaviorType: (oven) => oven,
    usesPizzaOvenBehavior: () => false,
  });
  vm.runInContext(`${compiled}\nglobalThis.generator = ${name};`, context);
  return context.generator;
}

const generateHr = loadGenerator('getDetailedDirectSteps');
const generateLocalized = loadGenerator('getDetailedDirectStepsLocalized');
const ingredients = { flour: 1000, water: 700, salt: 20, oil: 20, yeast: 2 };
const styles = [
  ['napolitana', false, false, false, true],
  ['romanaTonda', true, false, false, false],
  ['romanaTeglia', false, true, false, false],
  ['newYork', false, false, true, false],
];

function makePhase(generate, lang, style, mixing, flour, beginner = false) {
  const [, romanTonda, romanTeglia, newYork, napolitana] = style;
  const common = [
    mixing,
    ingredients,
    1742,
    2,
    300,
    30,
    0,
    4,
  ];
  if (lang === 'hr') {
    return generate(
      ...common,
      'ooni',
      450,
      21,
      60,
      80,
      undefined,
      undefined,
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
      'fresh',
      4,
    )[0];
  }
  return generate(
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
    style[0] === 'napolitana' ? 'neapolitan' : style[0],
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

function assertRestMatches(phase, minutes, label) {
  const restStep = phase.steps.findLast((step) =>
    /(?:psyllium|gluten|rest|ruh|odmor|počiv|ruhen)/i.test(step)
    && /\d+(?:\s*[–-]\s*\d+)?\s*(?:minutes?|minuta|minut|Minuten)/i.test(step));
  assert.ok(restStep, `${label}: generated Phase A instruction has a rest duration`);
  const duration = restStep.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:minutes?|minuta|minut|Minuten)/i);
  assert.ok(duration, `${label}: rest instruction states a duration`);
  const timer = phase.timers?.find((entry) => entry.kind === 'rest');
  assert.ok(timer, `${label}: Phase A has a rest timer`);
  assert.ok(
    minutes >= Number(duration[1]) && minutes <= Number(duration[2] ?? duration[1]),
    `${label}: instruction agrees with the expected ${minutes}-minute duration (${restStep})`,
  );
  assert.equal(timer.seconds, minutes * 60, `${label}: timer agrees with the instruction`);
}

for (const [styleName, ...style] of styles) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    assertRestMatches(
      makePhase(generateHr, 'hr', [styleName, ...style], mixing, 'glutenFree'),
      5,
      `PRO/HR/${styleName}/glutenFree/${mixing}`,
    );
  }
}

for (const lang of ['en', 'de', 'sl']) {
  for (const [styleName, ...style] of styles) {
    for (const mixing of ['hand', 'mixer', 'spiral']) {
      assertRestMatches(
        makePhase(generateLocalized, lang, [styleName, ...style], mixing, 'glutenFree'),
        5,
        `PRO/${lang}/${styleName}/glutenFree/${mixing}`,
      );
    }
  }
}

assertRestMatches(
  makePhase(generateHr, 'hr', styles[0], 'hand', 'caputo00'),
  5,
  'PRO/HR/napolitana/caputo00/hand control',
);
assertRestMatches(
  makePhase(generateHr, 'hr', styles[2], 'hand', 'caputo00'),
  5,
  'PRO/HR/romanaTeglia/caputo00/hand control',
);
assertRestMatches(
  makePhase(generateHr, 'hr', styles[0], 'hand', 'glutenFree', true),
  5,
  'Beginner/HR/napolitana/glutenFree/hand remains unchanged',
);
assertRestMatches(
  makePhase(generateHr, 'hr', styles[3], 'mixer', 'caputo00', true),
  6,
  'Beginner/HR/newYork/caputo00/mixer remains unchanged',
);

console.log('PRO Phase A rest behavior passed for GF styles, methods, and HR/EN/DE/SL; non-GF and Beginner controls passed.');
