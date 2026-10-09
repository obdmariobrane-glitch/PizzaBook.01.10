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
  'buildNeapolitanDirectPhaseC',
  'buildBeginnerDirectHomeSteps',
  'buildBeginnerTegliaHomeSteps',
  'buildBeginnerTegliaPhaseC',
  'getBeginnerFridgeOutAt',
  'formatBeginnerScheduledTime',
  'buildBeginnerColdPhaseD',
  'buildBeginnerColdFinalStart',
  'buildBeginnerTegliaPreheat',
  'buildBeginnerFinalPhaseInfo',
  'getBeginnerRoomOnlyEnd',
  'formatBeginnerRoomRemaining',
  'getBeginnerRoomEndLabel',
  'buildBeginnerRoomOnlyPhaseCEnd',
  'buildBeginnerRoomOnlyFinalStart',
  'getBeginnerPhaseBTimers',
  'getBeginnerPhaseCTimers',
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
function getBeginnerPreheatMinutes(oven) { return oven === 'homeStone' ? 60 : 20; }
function formatBeginnerClockTime(at) { return at.toISOString().slice(11, 16); }
function formatTemperature(value) { return String(value) + '°C'; }
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

function schedule(fridgeHours, roomBeforeFridgeHours = 2, roomAfterFridgeHours = 1, oven = 'homeStone') {
  const bakeAt = new Date('2027-04-12T18:00:00');
  const startAt = new Date(bakeAt.getTime() - (roomBeforeFridgeHours + fridgeHours + roomAfterFridgeHours) * 3600000);
  const preheatMinutes = oven === 'homeStone' ? 60 : 20;
  return {
    fridgeHours,
    roomBeforeFridgeHours,
    roomAfterFridgeHours,
    startAt,
    bakeAt,
    preheatAt: new Date(bakeAt.getTime() - preheatMinutes * 60000),
    ovenType: oven,
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
              '1250 g',
              '250 g',
              5,
            );
            const phaseA = result[0];
            const phaseB = result[1];
            assertSingleDisplayPrefix(result, lang);
            const phaseC = result[2];

            assertSingleDisplayPrefix(result, lang);
            assert.deepEqual(Array.from(phaseA.timers, (timer) => timer.id), ['post-mix-rest']);
            if (style !== 'romana_teglia') {
              assert.equal(phaseC.steps.length, 6, 'Round Direct Phase C should render six focused steps');
              assert.equal(phaseC.stepInfo.length, 6);
              assert.match(phaseC.title, /Podjela|Dividing|Teilen|Delitev/i);
              assert.match(phaseC.steps[2], /1250|250|5/);
              if (flour === 'glutenFree') {
                assert.match(phaseC.steps[0], /bezglutenskim ili rižinim|gluten-free flour or certified gluten-free rice|glutenfreiem Mehl oder zertifiziert glutenfreiem Reismehl|brezglutensko moko ali certificirano brezglutensko riževo moko/i);
                assert.doesNotMatch(phaseC.steps[0], /regular wheat|običn|normales Weizen|navadn.*pšenič/i);
                assert.match(phaseC.steps[3], /mekanu kuglicu|soft dough ball|weichen Teigkugel|mehko kroglico/i);
                assert.match(phaseC.stepInfo[3].body, /ne pokušavajte razviti gluten|do not try to develop gluten|versuchen Sie nicht, Gluten|ne poskušajte razviti glutena/i);
              }
            } else {
              assert.equal(phaseC.steps.length, 4, 'Round-style Phase C should combine division, ball count, and balling without duplicates');
              assert.match(phaseC.steps.at(-2), /površinsku napetost|surface tension|Oberflächenspannung|površinsko napetost/i);
            }
            if (fridgeHours === 0) {
              assert.ok(!phaseC.steps.some((step) => /refrigerat|fridge|kühlschrank|hladilnik/i.test(step)));
            }
            assert.ok(result.every((phase) => (phase.timers ?? []).every((timer) => timer.seconds > 0)));
            assert.deepEqual(
              Array.from(phaseB.timers, (timer) => timer.id),
              roomBeforeFridgeHours === 0
                ? []
                : flour === 'glutenFree'
                ? ['beginner-phase-b-fermentation']
                : ['beginner-phase-b-rest-initial', 'beginner-phase-b-rest-between-1', 'beginner-phase-b-rest-final'],
            );
            if (roomBeforeFridgeHours === 2) {
              assert.deepEqual(
                Array.from(phaseB.timers, (timer) => timer.seconds),
                flour === 'glutenFree' ? [7200] : [1200, 1800, 4200],
              );
            }
            if (style === 'neapolitan') {
              assert.deepEqual(
                Array.from(result.at(-1).timers, (timer) => timer.id),
                roomAfterFridgeHours > 0
                  ? ['beginner-phase-c-tempering', 'beginner-phase-c-preheat']
                  : ['beginner-phase-c-preheat'],
                'scheduled Phase C should expose only tempering and preheat timers',
              );
            } else {
              assert.deepEqual(
                Array.from(result.at(-1).timers, (timer) => timer.id),
                roomAfterFridgeHours > 0
                  ? ['beginner-phase-c-tempering', 'beginner-phase-c-preheat']
                  : ['beginner-phase-c-preheat'],
                'all scheduled styles should expose only tempering and preheat timers',
              );
            }
            assert.deepEqual(
              Array.from(result.at(-1).timers, (timer) => timer.seconds),
              roomAfterFridgeHours > 0 ? [roomAfterFridgeHours * 3600, 3600] : [3600],
            );

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
    assert.deepEqual(Array.from(phaseB.timers, (timer) => timer.id), ['beginner-phase-b-fermentation']);
    assert.ok(phaseB.steps.some((step) => /120|2 hours|2 Stunden|2 ur|2 sati/i.test(step)));
    assert.ok(!phaseB.steps.some((step) => /stretch & fold|fold|preklapan|prepogn/i.test(step)));
    assert.ok(!phaseB.steps.some((step) => /gentle folds during this scheduled phase/i.test(step)));
    assert.ok(!result.some((phase) => phase.steps.some((step) => /\b(?:divide into balls|form dough balls|kugeln formen)\b/i.test(step))));
    assert.deepEqual(Array.from(result.at(-1).timers, (timer) => timer.id), ['beginner-phase-c-preheat']);
    assert.equal(result.at(-1).timers[0].seconds, 3600);
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

for (const lang of languages) {
  for (const style of styles) {
    for (const flour of [...flours, 'glutenFree']) {
      for (const oven of ['homePan', 'homeStone', 'ooni']) {
        const coldSchedule = schedule(8, 2, 3, oven);
        const originalBakeAt = coldSchedule.bakeAt.getTime();
        const cold = buildBeginnerDirectHomeSteps(
          roundPhases(flour, style), coldSchedule, phaseBPlanFor(flour, 2), 22, 4, 300,
          oven, '4–5 min', lang, 'fresh', style, 30, 70, 100, flour, '1250 g', '250 g', 5,
        );
        const coldPhaseD = cold[3];
        const coldPhaseE = cold[4];
        assert.match(coldPhaseD.steps[0], /8 hours/);
        assert.match(coldPhaseD.steps[0], /15:00/);
        assert.equal(coldPhaseD.stepInfo.length, coldPhaseD.steps.length);
        assert.equal(coldPhaseE.steps.length, 8);
        assert.equal(coldPhaseE.stepInfo.length, coldPhaseE.steps.length);
        assert.match(coldPhaseE.steps[0], /15:00/);
        assert.match(coldPhaseE.steps[1], oven === 'homeStone' ? /17:00/ : /17:40/);
        assert.equal(coldSchedule.bakeAt.getTime(), originalBakeAt);
        if (flour === 'glutenFree') assert.match(coldPhaseE.steps[2], /rice flour|Reismehl|rižinim|riževo/);
        assert.match(coldPhaseE.steps[5], /70 g|100 g/);

        const roomSchedule = schedule(0, 2, 3, oven);
        const roomBakeAt = roomSchedule.bakeAt.getTime();
        const room = buildBeginnerDirectHomeSteps(
          roundPhases(flour, style), roomSchedule, phaseBPlanFor(flour, 2), 22, 4, 300,
          oven, '4–5 min', lang, 'fresh', style, 30, 70, 100, flour, '1250 g', '250 g', 5,
        );
        assert.equal(room.length, 4);
        assert.equal(room.at(-1).steps.length, 8);
        assert.equal(room.at(-1).stepInfo.length, 8);
        assert.equal(roomSchedule.bakeAt.getTime(), roomBakeAt);
        assert.match(room.at(-1).steps[0], /sobnoj temperaturi|room temperature|Raumtemperatur|sobni temperaturi/i);
        assert.doesNotMatch(room.at(-1).steps[0], /fridge|Kühlschrank|hladnjaka|hladilnika/i);

        const noFridgeOutAlarmSchedule = schedule(8, 2, 0, oven);
        const noFridgeOutAlarm = buildBeginnerDirectHomeSteps(
          roundPhases('caputo00', style), noFridgeOutAlarmSchedule, phaseBPlanFor('caputo00', 2), 22, 4, 300,
          oven, '4–5 min', lang, 'fresh', style, 30, 70, 100, 'caputo00', '1250 g', '250 g', 5,
        );
        assert.ok(!noFridgeOutAlarm[3].steps[0].includes('Alarm'));
      }
    }
  }

  for (const flour of [...flours, 'glutenFree']) {
    for (const oven of ['homePan', 'homeStone', 'ooni']) {
      const coldSchedule = schedule(48, 2, 3, oven);
      const teglia = buildBeginnerTegliaHomeSteps(
        roundPhases(flour, 'romana'), coldSchedule, phaseBPlanFor(flour, 2, 'teglia'), 22,
        lang, 300, '4–5 min', { width: 30, length: 40 }, flour, 120, 180,
      );
      const phaseD = teglia[3];
      const phaseE = teglia[4];
      assert.match(phaseD.steps[0], /48 hours/);
      assert.match(phaseD.steps[0], /15:00/);
      assert.equal(phaseD.stepInfo.length, phaseD.steps.length);
      assert.equal(phaseE.steps.length, 8);
      assert.equal(phaseE.stepInfo.length, phaseE.steps.length);
      assert.match(phaseE.steps[0], /15:00/);
      assert.match(phaseE.steps[5], /120 g/);
      assert.match(phaseE.steps[5], /180 g/);
      assert.doesNotMatch(`${phaseD.steps.join(' ')} ${phaseE.steps.join(' ')}`, /dough balls|Teigkugeln|kroglice|kuglice/i);
      assert.match(phaseE.steps[1], oven === 'homeStone' ? /300°C/ : /300°C/);

      const roomSchedule = schedule(0, 2, 3, oven);
      const roomTeglia = buildBeginnerTegliaHomeSteps(
        roundPhases(flour, 'romana'), roomSchedule, phaseBPlanFor(flour, 2, 'teglia'), 22,
        lang, 300, '4–5 min', { width: 30, length: 40 }, flour, 120, 180,
      );
      assert.equal(roomTeglia.at(-1).steps.length, 8);
      assert.equal(roomTeglia.at(-1).stepInfo.length, 8);
      assert.match(roomTeglia.at(-1).steps[0], /sobnoj temperaturi|room temperature|Raumtemperatur|sobni temperaturi/i);
      assert.doesNotMatch(roomTeglia.at(-1).steps[0], /fridge|Kühlschrank|hladnjaka|hladilnika/i);
    }
  }
}

{
  const overnight = schedule(24, 2, 2, 'homeStone');
  overnight.bakeAt = new Date('2027-04-13T01:00:00');
  overnight.startAt = new Date(overnight.bakeAt.getTime() - 28 * 3600000);
  overnight.preheatAt = new Date(overnight.bakeAt.getTime() - 60 * 60000);
  const result = buildBeginnerDirectHomeSteps(
    roundPhases('caputo00', 'neapolitan'), overnight, phaseBPlanFor('caputo00', 2), 22, 4, 300,
    'homeStone', '4–5 min', 'hr', 'fresh', 'neapolitan', 30, 70, 100, 'caputo00', '1250 g', '250 g', 5,
  );
  assert.match(result[3].steps[0], /2027.*23:00/);
  assert.match(result[4].steps[0], /23:00/);
  assert.ok(!result[3].steps[0].includes('01:00'));
}

assert.match(source, /const customStepInfo = stepInfo\?\.\[i\]/);
assert.match(source, /Alert\.alert\(customStepInfo\.title, formatText\(customStepInfo\.body\)\)/);

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
assert.deepEqual(Array.from(scheduledOoni.at(-1).timers, (timer) => timer.id), ['beginner-phase-c-tempering', 'beginner-phase-c-preheat']);
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
assert.deepEqual(
  Array.from(scheduledRoomOnly.at(-1).timers, (timer) => timer.id),
  ['beginner-phase-c-tempering', 'beginner-phase-c-preheat'],
  'room-only round workflows should expose only room rest and preheat timers',
);
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
assert.equal(tegliaWithFridge[2].steps.length, 6);
assert.equal(tegliaWithFridge[2].stepInfo.length, 6);
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

for (const lang of languages) {
  const shortTeglia = buildBeginnerTegliaHomeSteps(
    roundPhases('caputo00', 'romana'),
    schedule(0, 0, 1),
    phaseBPlanFor('caputo00', 0, 'teglia'),
    22,
    lang,
    300,
    '4–5 min',
    { width: 30, length: 40 },
    'caputo00',
  );
  const prefix = lang === 'hr' || lang === 'sl' ? 'Faza' : 'Phase';
  assert.equal(shortTeglia.length, 3, `${lang} short Teglia workflow should omit empty Phase B`);
  shortTeglia.forEach((phase, index) => {
    assert.match(phase.title, new RegExp(`^${prefix} ${String.fromCharCode(65 + index)}: `));
    assert.ok(phase.steps.every((step) => !/\b0 (?:hours?|minutes?|Stunden|Minuten|ur|minuta)\b/i.test(step)));
  });
}

// Room-only Phase C -> final phase transition
{
  const bakeAt = new Date('2027-04-12T18:00:00');
  const clock = (at) => at.toISOString().slice(11, 16);
  const labels = { hr: 'Završetak sobne fermentacije', en: 'End of room-temperature fermentation', de: 'Ende der Raumtemperatur-Fermentation', sl: 'Konec fermentacije pri sobni temperaturi' };
  const cases = [
    { oven: 'ooni', preheatAt: new Date('2027-04-12T17:40:00'), duration: '2 h 40 min', endAt: new Date('2027-04-12T17:40:00') },
    { oven: 'homeStone', preheatAt: new Date('2027-04-12T17:00:00'), duration: '2 h', endAt: new Date('2027-04-12T17:00:00') },
  ];
  for (const lang of languages) {
    for (const { oven, preheatAt, duration, endAt } of cases) {
      const roomOnly = { fridgeHours: 0, roomBeforeFridgeHours: 2, roomAfterFridgeHours: 3, bakeAt, preheatAt };
      for (const flour of [...flours, 'glutenFree']) {
        for (const style of styles) {
          const result = buildBeginnerDirectHomeSteps(roundPhases(flour, style), roomOnly, phaseBPlanFor(flour, 2), 22, 4, 300, oven, '4–5 min', lang, 'fresh', style, 30, 70, 100, flour, '1250 g', '250 g', 5);
          const phaseC = result[2];
          assert.equal(phaseC.steps.length, 6);
          assert.equal(phaseC.stepInfo.length, 6);
          assert.ok(phaseC.steps[5].includes(duration), phaseC.steps[5]);
          assert.ok(phaseC.steps[5].endsWith(`\n${labels[lang]} — ${clock(endAt)}`), phaseC.steps[5]);
          assert.equal((phaseC.steps[5].match(/—/g) || []).length, 1);
          assert.ok(!/6 h|6 hours/.test(phaseC.steps[5]));
          assert.ok(phaseC.stepInfo[5].body.length > 0);
          const finalPhase = result.at(-1);
          assert.ok(finalPhase.stepInfo[0].body.length > 0);
          assert.ok(!/temper(?:ing|iert|iranje)|temperira/i.test(finalPhase.steps[0]), finalPhase.steps[0]);
          assert.equal(finalPhase.steps.length, 8);
        }
        const teglia = buildBeginnerTegliaHomeSteps(roundPhases(flour, 'romana'), roomOnly, phaseBPlanFor(flour, 2, 'teglia'), 22, lang, 300, '4–5 min', { width: 30, length: 40 }, flour);
        const tegliaC = teglia.find((phase) => /(?:Phase|Faza) C\b/.test(phase.title));
        assert.ok(tegliaC.steps[5].includes(duration), tegliaC.steps[5]);
        assert.ok(tegliaC.steps[5].endsWith(`${labels[lang]} — ${clock(endAt)}`));
        assert.ok(!/ball|kugel|kugl|kuglic/i.test(`${tegliaC.steps[5]} ${tegliaC.stepInfo[5].body}`));
        assert.ok(teglia.at(-1).stepInfo[1].body.length > 0);
        assert.ok(!/ball|kugel|kugl|kuglic/i.test(teglia.at(-1).steps[1]));
      }
    }
    // Zero-length interval: no alarm line, existing step text retained.
    const noGap = buildBeginnerDirectHomeSteps(roundPhases('caputo00', 'neapolitan'), schedule(0, 2, 1), phaseBPlanFor('caputo00', 2), 22, 4, 300, 'homeStone', '4–5 min', lang, 'fresh', 'neapolitan', 30, 70, 100, 'caputo00', '1250 g', '250 g', 5);
    assert.ok(!noGap[2].steps[5].includes(labels[lang]));
    // Fridge mode keeps its own Phase C step and final-phase tempering wording.
    const roomTimers = buildBeginnerDirectHomeSteps(roundPhases('caputo00', 'neapolitan'), schedule(0, 2, 1), phaseBPlanFor('caputo00', 2), 22, 4, 300, 'homeStone', '4–5 min', lang, 'fresh', 'neapolitan', 30, 70, 100, 'caputo00', '1250 g', '250 g', 5).at(-1).timers;
    assert.equal(roomTimers[0].kind, 'roomToBake');
    assert.equal(roomTimers[0].seconds, 3600);
    assert.equal(roomTimers[1].kind, 'preheat');
    const fridge = buildBeginnerDirectHomeSteps(roundPhases('caputo00', 'neapolitan'), schedule(8, 2, 3), phaseBPlanFor('caputo00', 2), 22, 4, 300, 'homeStone', '4–5 min', lang, 'fresh', 'neapolitan', 30, 70, 100, 'caputo00', '1250 g', '250 g', 5);
    assert.ok(!fridge[2].steps[5].includes(labels[lang]));
    assert.equal(fridge.at(-1).stepInfo.length, 8);
    assert.equal(fridge[3].stepInfo.length, 1);
    assert.match(fridge[3].steps[0], /Alarm/);
    assert.equal(fridge.at(-1).timers[0].kind, 'preBake');
  }
}

console.log('Beginner phase sequence and timer verification passed for HR/EN/DE/SL, styles, flour paths, and room/cold schedule variants.');
