#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(appPath, 'utf8');
const sourceFile = ts.createSourceFile(appPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const requestedFunctions = new Set([
  'buildBeginnerPhaseBSteps',
  'buildBeginnerDirectHomeSteps',
  'buildBeginnerTegliaHomeSteps',
  'addSequentialBeginnerPhaseLetters',
  'getBeginnerOvenTimers',
]);
const functionSources = [];

for (const statement of sourceFile.statements) {
  if (ts.isFunctionDeclaration(statement) && statement.name && requestedFunctions.has(statement.name.text)) {
    functionSources.push(statement.getText(sourceFile));
  }

  function assertSingleDisplayPrefix(phases, lang) {
    const prefix = lang === 'hr' || lang === 'sl' ? 'Faza' : 'Phase';
    phases.forEach((phase, index) => {
      const expected = `${prefix} ${String.fromCharCode(65 + index)}:`;
      assert.match(phase.title, new RegExp(`^${prefix} ${String.fromCharCode(65 + index)}: `));
      assert.equal((phase.title.match(new RegExp(`\\b${prefix}\\b`, 'g')) || []).length, 1, phase.title);
      assert.equal((phase.title.match(/[A-Z]:/g) || []).length, 1, phase.title);
      assert.ok(!new RegExp(`${prefix} [A-Z]: ${prefix} [A-Z]:`).test(phase.title));
      assert.ok(phase.title.startsWith(expected));
    });
  }
}

assert.equal(functionSources.length, requestedFunctions.size, 'all phase adapter and timer functions must be found');

const runtimeSource = `
function formatDuration(seconds) {
  return seconds === 0 ? '0 hours' : \`\${seconds / 3600} hours\`;
}
function labelSelectedYeast(text) { return text; }
${functionSources.join('\n')}
module.exports = { buildBeginnerDirectHomeSteps, buildBeginnerTegliaHomeSteps, getBeginnerOvenTimers };
`;
const compiled = ts.transpileModule(runtimeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  exports: moduleRef.exports,
  getBakingTimeRange: () => ({ min: 1, max: 3 }),
}, { filename: 'beginnerPhaseAdapters.ts' });

const { buildBeginnerDirectHomeSteps, buildBeginnerTegliaHomeSteps, getBeginnerOvenTimers } = moduleRef.exports;
const languages = ['hr', 'en', 'de', 'sl'];
const styles = ['neapolitan', 'ny_style', 'romana'];
const flours = ['caputo00', 'manitoba', 'custom', 'spelt', 'wholeWheat'];

function schedule(fridgeHours, roomBeforeFridgeHours = 2, roomAfterFridgeHours = 1) {
  return {
    fridgeHours,
    roomBeforeFridgeHours,
    roomAfterFridgeHours,
    bakeAt: new Date('2027-04-12T18:00:00'),
    preheatAt: new Date('2027-04-12T17:00:00'),
  };
}

function phaseBPlanFor(flour, roomBeforeFridgeHours, workflow = 'round') {
  const durationMinutes = roomBeforeFridgeHours * 60;
  const behavior = flour === 'glutenFree' ? 'glutenFree' : flour === 'spelt' || flour === 'wholeWheat' ? 'gentle' : 'standard';
  const folds = behavior === 'glutenFree'
    ? []
    : durationMinutes >= 90
      ? [{ index: 1, offsetMinutes: 20 }, { index: 2, offsetMinutes: 50 }]
      : durationMinutes >= 45
        ? [{ index: 1, offsetMinutes: 20 }]
        : [];
  return {
    durationMinutes,
    foldCount: folds.length,
    folds,
    finalRestMinutes: folds.length > 0 ? durationMinutes - folds.at(-1).offsetMinutes : durationMinutes,
    behavior,
    workflow,
  };
}

function roundPhases(flour, style) {
  const glutenFree = flour === 'glutenFree';
  const bulkSteps = glutenFree
    ? style === 'neapolitan'
      ? ['Transfer the mixture.', 'Continue fermenting the mixture for 90 minutes at room temperature.', 'Do not do Stretch & Fold.']
      : ['Transfer the mixture.', 'Cover and let the mixture rest for 15 minutes at room temperature before dividing. Do not do Stretch & Fold.']
    : ['Transfer the dough.', 'Rest for 30 minutes.', 'Perform the first Stretch & Fold.', 'Rest for 30 minutes.', 'Perform the second Stretch & Fold.', 'Check fermentation signs.'];
  return [
    { title: 'Phase A', steps: ['Mix the dough.'], timers: [{ id: 'post-mix-rest', seconds: 300, kind: 'rest' }] },
    {
      title: 'Phase B',
      steps: bulkSteps,
      timers: [{
        id: style === 'neapolitan' && glutenFree ? 'gluten-free-napolitana-rest' : 'gluten-free-short-rest',
        seconds: 900,
        kind: 'rt',
      }],
      fermentationInfo: flour === 'spelt' || flour === 'wholeWheat' ? 'Use gentle folds.' : undefined,
    },
    { title: 'Phase C: Divide and shape dough balls', steps: ['Divide the dough into balls.', 'Shape each ball.'] },
    { title: 'Phase D: Cold Fermentation', steps: ['Refrigerate the dough.'], timers: [{ id: 'cold-fermentation', seconds: 3600, kind: 'fridge' }] },
    { title: 'Phase E', steps: ['Preheat', 'Temper', 'Shape', 'Bake'], timers: [{ id: 'tempering', seconds: 900, kind: 'preBake' }] },
  ];
}

for (const lang of languages) {
  for (const style of styles) {
    for (const flour of [...flours, 'glutenFree']) {
      for (const fridgeHours of [0, 1, 8]) {
        for (const roomBeforeFridgeHours of [0, 2]) {
          for (const roomAfterFridgeHours of [0, 1]) {
            const phases = roundPhases(flour, style);
            const result = buildBeginnerDirectHomeSteps(
              phases,
              schedule(fridgeHours, roomBeforeFridgeHours, roomAfterFridgeHours),
              phaseBPlanFor(flour, roomBeforeFridgeHours),
              22,
              4,
              300,
              'homeStone',
              '4–5 min',
              lang,
              'fresh',
              style,
              30,
              70,
              100,
              flour,
            );
            const phaseA = result[0];
            const phaseB = result[1];
            assertSingleDisplayPrefix(result, lang);
            const phaseC = result[2];

            assertSingleDisplayPrefix(result, lang);
            assert.deepEqual(Array.from(phaseA.timers, (timer) => timer.id), ['post-mix-rest']);
            if (style === 'neapolitan') {
              assert.equal(phaseC.steps.length, phases[2].steps.length + 1, 'Neapolitan Phase C should add one container-transition step without duplicating division/balling');
              assert.match(phaseC.steps.at(-2), /površinsku napetost|surface tension|Oberflächenspannung|površinsko napetost/i);
            } else {
              assert.deepEqual(phaseC.steps, phases[2].steps, 'Phase C should remain the single round-style division/balling phase');
            }
            if (style !== 'neapolitan') {
              assert.ok(!phaseC.steps.some((step) => /refrigerat|fridge|kühlschrank|hladilnik/i.test(step)));
            }
            assert.ok(result.every((phase) => (phase.timers ?? []).every((timer) => timer.seconds > 0)));
            assert.deepEqual(Array.from(phaseB.timers, (timer) => timer.id), []);
            if (style === 'neapolitan') {
              assert.deepEqual(
                Array.from(result.at(-1).timers, (timer) => timer.id),
                ['tempering', 'preheat', 'bake'],
                'Neapolitan final phase should expose tempering, preheat, and bake timers',
              );
            } else {
              assert.deepEqual(Array.from(result.at(-1).timers), [], 'scheduled preheat, tempering, and bake are controlled by the schedule');
            }

            if (flour === 'glutenFree') {
              assert.ok(!phaseB.steps.some((step) => /stretch & fold|fold|preklapan|prepogn/i.test(step)));
            }
            if (flour === 'spelt' || flour === 'wholeWheat') {
              assert.equal(phaseB.fermentationInfo, 'Use gentle folds.');
            }

            const cold = result.find((phase) => /cold fermentation/i.test(phase.title));
            assert.equal(!!cold, fridgeHours > 0, 'only strategies with refrigeration should retain Phase D');
            if (cold) {
              assert.equal(cold.steps.length, 1);
              assert.deepEqual(Array.from(cold.timers), []);
            }
          }
        }
      }
    }
  }
}

for (const lang of languages) {
  for (const fridgeHours of [0, 1, 8]) {
    const glutenFreePhases = [
      { title: 'Phase A', steps: ['Mix the dough.'], timers: [{ id: 'post-mix-rest', seconds: 300, kind: 'rest' }] },
      {
        title: 'Phase B: Short Rest',
        steps: ['Transfer the mixture.', 'Cover and let the mixture rest for 15 minutes at room temperature.'],
        timers: [{ id: 'gluten-free-teglia-rest', seconds: 900, kind: 'rt' }],
      },
      { title: 'Phase D: Cold Fermentation', steps: ['Refrigerate the single dough mass.'], timers: [{ id: 'cold-fermentation', seconds: 3600, kind: 'fridge' }] },
      { title: 'Phase E', steps: ['Preheat', 'Temper', 'Press', 'Bake'], timers: [{ id: 'tempering', seconds: 900, kind: 'preBake' }] },
    ];
    const result = buildBeginnerTegliaHomeSteps(
      glutenFreePhases,
      schedule(fridgeHours, 2, 0),
      phaseBPlanFor('glutenFree', 2, 'teglia'),
      22,
      lang,
      300,
      '4–5 min',
      { width: 30, length: 40 },
      'glutenFree',
    );
    const phaseB = result[1];
    assert.deepEqual(Array.from(phaseB.timers, (timer) => timer.id), []);
    assert.ok(phaseB.steps.some((step) => /120|2 hours|2 Stunden|2 ur|2 sati/i.test(step)));
    assert.ok(!phaseB.steps.some((step) => /stretch & fold|fold|preklapan|prepogn/i.test(step)));
    assert.ok(!phaseB.steps.some((step) => /gentle folds during this scheduled phase/i.test(step)));
    assert.ok(!result.some((phase) => phase.steps.some((step) => /\b(?:divide into balls|form dough balls|kugeln formen)\b/i.test(step))));
    assert.deepEqual(Array.from(result.at(-1).timers), []);
  }
}

const stoneTimers = getBeginnerOvenTimers('homeStone', 300, false);
assert.equal(stoneTimers.find((timer) => timer.id === 'preheat').seconds, 52.5 * 60);
assert.equal(stoneTimers.find((timer) => timer.id === 'bake').seconds, 270);
const estimatedTimers = getBeginnerOvenTimers('ooni', 450, true);
assert.equal(estimatedTimers.find((timer) => timer.id === 'bake').seconds, 120, 'bake timer should use the midpoint of the existing baking range');
assert.equal(estimatedTimers.find((timer) => timer.id === 'rotate').seconds, 25, 'rotation timer should use the midpoint of the 20–30 second instruction');
const panTimers = getBeginnerOvenTimers('homePan', 250, false);
assert.equal(panTimers.find((timer) => timer.id === 'bake').seconds, 6 * 60);
assert.equal(panTimers.find((timer) => timer.id === 'bake-finish').seconds, 150);
assert.deepEqual(
  Array.from(getBeginnerOvenTimers('homeStone', 300, false, true), (timer) => timer.id),
  ['preheat'],
  'Teglia has a defined preheat duration but its bake instruction is doneness-led, not time-led',
);
const scheduledOoni = buildBeginnerDirectHomeSteps(
  roundPhases('caputo00', 'neapolitan'),
  schedule(1),
  phaseBPlanFor('caputo00', 2),
  22,
  4,
  450,
  'ooni',
  '60–90 s',
  'en',
  'fresh',
  'neapolitan',
  30,
  70,
  100,
  'caputo00',
);
assert.deepEqual(Array.from(scheduledOoni.at(-1).timers, (timer) => timer.id), ['tempering', 'preheat', 'bake', 'rotate']);
assert.deepEqual(
  Array.from(scheduledOoni, (phase) => phase.title.match(/(?:Phase|Faza) ([A-E]):/)?.[1]),
  ['A', 'B', 'C', 'D', 'E'],
  'round workflows with refrigeration must have continuous visible letters',
);
const scheduledRoomOnly = buildBeginnerDirectHomeSteps(
  roundPhases('caputo00', 'neapolitan'),
  schedule(0, 2, 1),
  phaseBPlanFor('caputo00', 2),
  22,
  4,
  450,
  'ooni',
  '60–90 s',
  'en',
  'fresh',
  'neapolitan',
  30,
  70,
  100,
  'caputo00',
);
assert.deepEqual(
  Array.from(scheduledRoomOnly, (phase) => phase.title.match(/(?:Phase|Faza) ([A-D]):/)?.[1]),
  ['A', 'B', 'C', 'D'],
  'room-only workflows must shift phases after removing refrigeration',
);
assert.ok(!scheduledRoomOnly.some((phase) => /cold fermentation/i.test(phase.title)));
const gfRoomOnly = buildBeginnerDirectHomeSteps(
  roundPhases('glutenFree', 'neapolitan'),
  schedule(0, 2, 1),
  phaseBPlanFor('glutenFree', 2),
  22,
  4,
  450,
  'ooni',
  '60–90 s',
  'en',
  'fresh',
  'neapolitan',
  30,
  70,
  100,
  'glutenFree',
);
assert.ok(gfRoomOnly.every((phase) => !phase.steps.some((step) => /stretch & fold|fold|gluten development|elastic/i.test(step))));
assert.deepEqual(
  Array.from(gfRoomOnly, (phase) => phase.title.match(/(?:Phase|Faza) ([A-E]):/)?.[1]),
  ['A', 'B', 'C', 'D'],
);
const tegliaWithFridge = buildBeginnerTegliaHomeSteps(
  [
    { title: 'Phase A', steps: ['Mix'] },
    { title: 'Phase B', steps: ['First fermentation'] },
    { title: 'Phase C', steps: ['One mass'] },
    { title: 'Phase D: Cold Fermentation', steps: ['Cold'] },
    { title: 'Phase E', steps: ['Preheat', 'Rest', 'Oil', 'Press', 'Top', 'Bake'] },
  ],
  schedule(1, 2, 1),
  phaseBPlanFor('caputo00', 2, 'teglia'),
  22,
  'en',
  250,
  '10–14 min',
  { width: 30, length: 40 },
  'caputo00',
);
assert.deepEqual(
  Array.from(tegliaWithFridge, (phase) => phase.title.match(/(?:Phase|Faza) ([A-E]):/)?.[1]),
  ['A', 'B', 'C', 'D', 'E'],
);
assert.ok(!tegliaWithFridge.some((phase) => phase.steps.some((step) => /ball|kugli|kroglic/i.test(step))));

assert.match(source, /timers=\{beginnerDirectHomeSteps \? phase\.timers : directHomeSchedule \? \[\] : phase\.timers\}/);
assert.match(source, /scheduleLocalAt\(copy\.title, notificationBody, event\.at/);
assert.match(source, /const mixRestMinutes = isTegliaCustomBeginnerHand \|\| isTegliaCustomBeginnerMixer \|\| isTegliaTipo00BeginnerHand \|\| isTegliaTipo00BeginnerMixer \|\| isTegliaManitobaBeginnerHand \|\| isTegliaManitobaBeginnerMixer \|\| isTegliaSpeltBeginnerHand \|\| isTegliaSpeltBeginnerMixer \|\| isTegliaWholeWheatBeginnerHand \|\| isTegliaWholeWheatBeginnerMixer \|\| isNeapolitanTipo00BeginnerHand \|\| isNeapolitanTipo00BeginnerMixer/);
assert.match(source, /timer\(hand && !isGlutenFree \? 'post-mix-rest15m' : 'post-mix-rest', mixRestMinutes \* 60, 'rest'\)/);
assert.match(source, /const mixRestMinutes = isGlutenFree \? 5 : isNeapolitanBeginner \|\| isTegliaCustomBeginnerHand \|\| isTegliaCustomBeginnerMixer \|\| isTegliaTipo00BeginnerHand \|\| isTegliaTipo00BeginnerMixer \|\| isTegliaManitobaBeginnerHand \|\| isTegliaManitobaBeginnerMixer \|\| isTegliaSpeltBeginnerHand \|\| isTegliaSpeltBeginnerMixer \|\| isTegliaWholeWheatBeginnerHand \|\| isTegliaWholeWheatBeginnerMixer \? 5 : beginnerMode \? 5\.5 : 5/);
assert.doesNotMatch(source, /timer\('hand-knead'|timer\('mixer-low'|timer\('mixer-develop'/);
assert.doesNotMatch(source, /\b2 minutes\b|\b2 Minuten\b|\b2 minuti\b/);
assert.doesNotMatch(source, /4 minutes|4 Minuten|4 minuti|4 minuti/);
assert.match(source, /timer\('post-mix-rest', Math\.round\(mixRestMinutes \* 60\), 'rest'\)/);
assert.match(source, /napolitanaGlutenFreeRemainingMinutes > 0\s*\?\s*\[timer\('gluten-free-napolitana-rest'/);
assert.match(source, /getBeginnerOvenTimers\(oven, ovenTemp, useBakeEstimate, isRomanTeglia\)/);

console.log('Beginner phase sequence and timer verification passed for HR/EN/DE/SL, styles, flour paths, and room/cold schedule variants.');
