#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { addProNapolitanaDirectInitialPlannerSteps } = require(path.join(root, 'src', 'proNapolitanaDirectPlanner.ts'));
const plannerSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'planner.tsx'), 'utf8');
assert.match(plannerSource, /addProNapolitanaDirectInitialPlannerSteps/);
assert.match(plannerSource, /!isBeginner[\s\S]*method === 'direct'[\s\S]*effectiveStyle === 'neapolitan'[\s\S]*plannerDirectHomeSchedule\?\.fridgeHours/);
assert.match(plannerSource, /\(plannerDirectHomeSchedule\?\.ovenType as string \| undefined\) !== 'kamado'/);

const bakeAt = new Date('2026-11-18T19:00:00.000Z');
for (const selectedHours of [2, 4]) {
  const fridgeAt = new Date(bakeAt.getTime() - (24 + selectedHours) * 3600000);
  const removalAt = new Date(fridgeAt.getTime() + 24 * 3600000);
  const baseSteps = [
    { phaseId: 'direct.mix', at: fridgeAt, title: 'Mix dough', desc: '' },
    { phaseId: 'direct.fridge', at: fridgeAt, title: 'Refrigerate', desc: '' },
    { phaseId: 'direct.fridgeRemoval', at: removalAt, title: 'Remove from fridge', desc: '' },
    { phaseId: 'direct.preheat', at: new Date(bakeAt.getTime() - 60 * 60000), title: 'Preheat', desc: '' },
    { phaseId: 'direct.bake', at: bakeAt, title: 'Bake', desc: '' },
  ];
  const steps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, 'en');
  const indexOf = (phaseId) => steps.findIndex((step) => step.phaseId === phaseId);
  const mix = steps.find((step) => step.phaseId === 'direct.mix');
  const rest = steps.find((step) => step.phaseId === 'direct.initial.mix-rest');
  const balling = steps.find((step) => step.phaseId === 'direct.initial.balling');
  const fridge = steps.find((step) => step.phaseId === 'direct.fridge');
  const removal = steps.find((step) => step.phaseId === 'direct.fridgeRemoval');

  assert.equal(mix.at.getTime(), fridgeAt.getTime() - 5 * 60000);
  assert.equal(mix.title, 'Mixing complete');
  assert.equal(rest.at.getTime(), mix.at.getTime());
  assert.equal(rest.desc, 'Cover the dough and leave it to rest for 5 minutes.');
  assert.equal(balling.at.getTime(), fridgeAt.getTime());
  assert.ok(indexOf('direct.initial.balling') < indexOf('direct.fridge'));
  assert.equal(removal.at.getTime() - fridge.at.getTime(), 24 * 3600000);
  assert.equal(steps.find((step) => step.phaseId === 'direct.bake').at.getTime(), bakeAt.getTime());
}

const labels = {
  hr: ['Završetak zamjesa', 'Početni odmor tijesta', 'Podjela i oblikovanje kuglica'],
  en: ['Mixing complete', 'Initial dough rest', 'Divide and shape dough balls'],
  de: ['Ende des Knetens', 'Erste Teigruhe', 'Teig teilen und Teiglinge formen'],
  sl: ['Konec mešanja testa', 'Začetni počitek testa', 'Delitev in oblikovanje kroglic'],
};
const baseSteps = [
  { phaseId: 'direct.mix', at: new Date(bakeAt.getTime() - 3600000), title: 'Mix', desc: '' },
  { phaseId: 'direct.fridge', at: new Date(bakeAt.getTime() - 2 * 3600000), title: 'Fridge', desc: '' },
];
for (const [lang, expected] of Object.entries(labels)) {
  const steps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, lang);
  assert.deepEqual(
    ['direct.mix', 'direct.initial.mix-rest', 'direct.initial.balling'].map((phaseId) => steps.find((step) => step.phaseId === phaseId).title),
    expected,
    `${lang}: all inserted steps are localized`,
  );
}

const withoutFridge = [{ phaseId: 'direct.mix', at: bakeAt, title: 'Mix', desc: '' }];
assert.deepEqual(addProNapolitanaDirectInitialPlannerSteps(withoutFridge, 'en'), withoutFridge);

console.log('PRO Neapolitan Direct Planner timeline checks passed for durations and HR/EN/DE/SL.');