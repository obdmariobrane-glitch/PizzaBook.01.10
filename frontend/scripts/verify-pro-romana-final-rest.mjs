#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const calculatorPath = path.join(frontendRoot, 'src', 'calculator.ts');
const calculatorSource = await readFile(calculatorPath, 'utf8');
const calculatorFile = ts.createSourceFile(calculatorPath, calculatorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function extractFunction(sourceFile, name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `production function ${name} must exist`);
  return declaration.getText(sourceFile);
}

function compileFunctions(source, exportNames, globals = {}) {
  const output = ts.transpileModule(
    `${source}\nmodule.exports = { ${exportNames.join(', ')} };`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, ...globals });
  return module.exports;
}

const { getTemperingWindow, getPlannerRoomAfterFridgeHours, getProFermentationPresentationSchedule } = compileFunctions(
  [
    extractFunction(calculatorFile, 'getTemperingWindow'),
    extractFunction(calculatorFile, 'getPlannerRoomAfterFridgeHours'),
    extractFunction(calculatorFile, 'getProFermentationPresentationSchedule'),
  ].join('\n'),
  ['getTemperingWindow', 'getPlannerRoomAfterFridgeHours', 'getProFermentationPresentationSchedule'],
);

const scenarios = [
  { roomHours: 3, fridgeHours: 24 },
  { roomHours: 2, fridgeHours: 24 },
  { roomHours: 4, fridgeHours: 48 },
  { roomHours: 3, fridgeHours: 0 },
];
const methods = ['direct', 'biga', 'poolish', 'sponge'];
const formats = ['tonda', 'teglia'];
const roomTemp = 22;

function makeSchedule(method, roomHours, fridgeHours) {
  return {
    phases: [
      ...(method === 'direct' ? [] : [{ kind: 'preferment', environment: 'room', hours: 8, temperature: roomTemp }]),
      ...(roomHours > 0 ? [{ kind: 'final', environment: 'room', hours: roomHours, temperature: roomTemp }] : []),
      ...(fridgeHours > 0 ? [{ kind: 'final', environment: 'fridge', hours: fridgeHours, temperature: 4 }] : []),
      ...((method === 'poolish' || method === 'sponge') && fridgeHours > 0 && roomHours > 0
        ? [{ kind: 'final-rest', environment: 'room', hours: roomHours, temperature: roomTemp }]
        : []),
    ],
  };
}

for (const scenario of scenarios) {
  for (const method of methods) {
    for (const romanFormat of formats) {
      const schedule = makeSchedule(method, scenario.roomHours, scenario.fridgeHours);
      const presentation = getProFermentationPresentationSchedule(
        schedule,
        method,
        'romana',
        scenario.roomHours,
        scenario.fridgeHours,
        roomTemp,
      );
      const finalRestHours = presentation.phases
        .filter((phase) => phase.kind === 'final-rest' && phase.environment === 'room')
        .reduce((total, phase) => total + phase.hours, 0);
      const finalRoomHours = presentation.phases
        .filter((phase) => phase.kind === 'final' && phase.environment === 'room')
        .reduce((total, phase) => total + phase.hours, 0);

      if (scenario.fridgeHours > 0) {
        assert.equal(finalRestHours, scenario.roomHours, `${method}/${romanFormat}: selected post-fridge rest`);
        assert.equal(finalRoomHours, 0, `${method}/${romanFormat}: no duplicate pre-fridge room duration`);
        const fridgeIndex = presentation.phases.findIndex((phase) => phase.kind === 'final' && phase.environment === 'fridge');
        const restIndex = presentation.phases.findIndex((phase) => phase.kind === 'final-rest' && phase.environment === 'room');
        assert.ok(restIndex > fridgeIndex, `${method}/${romanFormat}: final rest follows cold fermentation`);
      } else if (method === 'direct') {
        assert.equal(finalRestHours, scenario.roomHours, `${method}/${romanFormat}: one room-only final window`);
      } else {
        assert.equal(finalRoomHours, scenario.roomHours, `${method}/${romanFormat}: room-only fermentation is unchanged`);
        assert.equal(finalRestHours, 0, `${method}/${romanFormat}: no added post-fridge rest without a fridge`);
      }

      assert.equal(
        getPlannerRoomAfterFridgeHours(method, 'romana', romanFormat, scenario.roomHours, scenario.fridgeHours, roomTemp),
        scenario.fridgeHours > 0 ? scenario.roomHours : 0,
        `${method}/${romanFormat}/${scenario.roomHours}+${scenario.fridgeHours}: Planner and alarm rest duration`,
      );
    }
  }
}

for (const scenario of scenarios.filter((item) => item.fridgeHours > 0)) {
  for (const romanFormat of formats) {
    for (const method of ['biga', 'poolish']) {
      const combinedBranch = getProFermentationPresentationSchedule(
        makeSchedule(method, scenario.roomHours, scenario.fridgeHours),
        method,
        'romana',
        scenario.roomHours,
        scenario.fridgeHours,
        roomTemp,
      );
      assert.equal(
        combinedBranch.phases.filter((phase) => phase.kind === 'final-rest' && phase.environment === 'room')
          .reduce((total, phase) => total + phase.hours, 0),
        scenario.roomHours,
        `combined Biga + Poolish/${romanFormat}/${method}: selected final room phase`,
      );
    }
  }
}

for (const method of methods) {
  assert.equal(
    getPlannerRoomAfterFridgeHours(method, 'neapolitan', 'tonda', 3, 24, roomTemp),
    getTemperingWindow(roomTemp).initialMinutes / 60,
    `${method}: Napolitana keeps its existing tempering behavior`,
  );
  assert.equal(
    getPlannerRoomAfterFridgeHours(method, 'ny_style', 'tonda', 3, 24, roomTemp),
    getTemperingWindow(roomTemp).initialMinutes / 60,
    `${method}: NY Style keeps its existing tempering behavior`,
  );
}

const appPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const appSource = await readFile(appPath, 'utf8');
const appFile = ts.createSourceFile(appPath, appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const replacePhaseFunction = extractFunction(appFile, 'replaceProPhaseE');
const pressRestTimerFunction = extractFunction(appFile, 'getRomanTegliaPressRestTimer');
const replaceProPhaseE = compileFunctions(
  `${pressRestTimerFunction}\n${replacePhaseFunction}\nfunction formatDuration(seconds) { return String(Math.round(seconds / 60)) + ' min'; }\nfunction usesPizzaOvenBehavior(oven) { return oven === 'ooni' || oven === 'kamado'; }\nfunction getBeginnerPreheatMinutes() { return 20; }\nfunction getTegliaFinalProofPlan(minutes) { return { proofMinutes: Math.max(0, Math.min(120, minutes - 15)), pressRelaxationMinutes: Math.min(15, minutes), totalMinutes: minutes }; }\nfunction getKamadoBakeBlockedText() { return 'Bake settings unavailable'; }`,
  ['replaceProPhaseE', 'getRomanTegliaPressRestTimer'],
).replaceProPhaseE;

for (const scenario of scenarios) {
  for (const romanFormat of formats) {
    for (const lang of ['hr', 'en', 'de', 'sl']) {
      const finalRestMinutes = scenario.fridgeHours > 0 || romanFormat === 'tonda'
        ? scenario.roomHours * 60
        : 0;
      const phases = replaceProPhaseE(
        [{ title: 'Phase D: Existing phase', steps: ['Existing phase'] }],
        {
          direct: true,
          lang,
          variant: romanFormat === 'tonda' ? 'romanaTonda' : 'romanaTeglia',
          glutenFree: false,
          oven: 'homeStone',
          ovenTemp: 280,
          fridgeHours: scenario.fridgeHours,
          finalRestMinutes,
          diameter: 30,
          sauceAmount: 100,
          cheeseAmount: 100,
          trayCount: 1,
          bakingTimeRange: '20–25 min',
          trayDimensions: { width: 30, length: 40 },
        },
      );
      const finalPhase = phases.at(-1);
      const timer = finalPhase.timers.find((item) => item.id === 'tempering');
      assert.equal(timer?.seconds ?? 0, finalRestMinutes * 60, `${lang}/${romanFormat}/${scenario.roomHours}+${scenario.fridgeHours}: actual final timer`);
      assert.equal(finalPhase.timers.filter((item) => item.id === 'tempering').length, finalRestMinutes > 0 ? 1 : 0);
      if (finalRestMinutes > 0) {
        assert.ok(finalPhase.steps.some((step) => step.includes(`${finalRestMinutes} min`)), `${lang}/${romanFormat}: instruction includes selected final-rest duration`);
        assert.equal(finalPhase.steps.filter((step) => /38 min|38 Minuten|38 minut/i.test(step)).length, 0, `${lang}/${romanFormat}: no automatic 38-minute rest`);
      }
    }
  }
}

const bulkPath = path.join(frontendRoot, 'src', 'i18n', 'proDirectBulk.ts');
const bulkSource = await readFile(bulkPath, 'utf8');
const bulkFile = ts.createSourceFile(bulkPath, bulkSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const adaptRomanBulk = compileFunctions(
  extractFunction(bulkFile, 'adaptProRomanDirectBulkPhase'),
  ['adaptProRomanDirectBulkPhase'],
).adaptProRomanDirectBulkPhase;
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const adapted = adaptRomanBulk({
    title: 'Bulk',
    steps: ['Rest', 'Stretch & Fold 1', 'Rest', 'Stretch & Fold 2'],
    timers: [{ id: 'bulk-rest-1', seconds: 7200, kind: 'rt' }],
  }, lang);
  assert.equal(adapted.steps.filter((step) => /stretch\s*&\s*fold/i.test(step)).length, 2, `${lang}: preserve Direct Romana fold order`);
  assert.equal(adapted.timers.length, 0, `${lang}: selected room hours are not duplicated in the bulk timer`);
  assert.ok(adapted.steps.every((step) => !/\b(?:2|3|4)\s*(?:hours?|hrs?|Stunden|sati|ur)\b/i.test(step)), `${lang}: bulk does not reuse selected room duration`);
}

assert.match(appSource, /getProFermentationPresentationSchedule\(/, 'PRO presentation schedule is used by recipe instructions and Planner state');
assert.match(appSource, /pizzaStyle === 'romana'\) return adaptProRomanDirectBulkPhase\(phase, lang\)/, 'Direct Romana bulk does not duplicate its selected final rest');
assert.match(appSource, /fermentationSchedule: proCalculationFermentationSchedule/, 'doughCalc retains the unchanged calculation schedule');
const plannerPath = path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx');
const plannerSource = await readFile(plannerPath, 'utf8');
assert.match(plannerSource, /getPlannerRoomAfterFridgeHours\(/, 'Planner uses the selected Romana room interval for fallback and alarm schedules');
assert.match(plannerSource, /reversePlan\([\s\S]*?plannerFermentationSchedule/, 'Planner timeline is built from the aligned fermentation schedule');
assert.match(plannerSource, /const futureSteps = steps\.filter\(/, 'Planner alarms are derived from the generated timeline');
assert.match(plannerSource, /scheduleNotificationBatch\(\s*futureSteps/, 'Planner alarm notifications use the generated timeline steps');

console.log('PASS: PRO Romana final-rest schedules, instructions, timers, Planner durations, and alarm input across all scenarios, formats, and languages.');
