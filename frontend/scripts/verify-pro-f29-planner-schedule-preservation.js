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
const { getFermentationSchedule } = require(path.join(root, 'src', 'calculator.ts'));

const plannerSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const plannerStorageSource = fs.readFileSync(path.join(root, 'src', 'plannerPhaseOverrides.ts'), 'utf8');
assert.match(plannerSource, /sharedCalculatorPlanSettings\.proFermentationSchedule/);
assert.match(plannerSource, /subscribeSharedCalculatorPlanSettings/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.roomHours/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.fridgeHours/);
assert.match(plannerSource, /AsyncStorage\.getItem\(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY\)/);
assert.match(plannerSource, /AsyncStorage\.setItem\(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY, d\.toISOString\(\)\)/);
assert.match(plannerSource, /if \(!plannerBakeTargetReady\) return false;|if \(!isBeginner && !plannerBakeTargetReady\) return false;/);
assert.match(plannerSource, /addProNapolitanaDirectInitialPlannerSteps/);
assert.match(plannerSource, /if \(isBeginner\) \{\s*AsyncStorage\.setItem\('beginnerBakeAt'/);
assert.match(plannerSource, /plannerPhaseOverrideScheduleIdentity/);
assert.match(plannerSource, /AsyncStorage\.getAllKeys\(\)/);
assert.match(plannerSource, /AsyncStorage\.multiGet\(previousKeys\)/);
assert.match(plannerSource, /Alert\.alert\(t\.planner\.stalePhaseOverridesNotApplied\)/);
assert.match(plannerSource, /testID="stale-pro-phase-override-warning"/);
assert.match(plannerSource, /staleProOverridesWarningFor === plannerPhaseOverridesStorageKey/);
assert.match(plannerStorageSource, /PRO_PLANNER_BAKE_TARGET_STORAGE_KEY = 'proPlannerBakeAt'/);
assert.match(plannerStorageSource, /target\.toISOString\(\) !== serialized/);

const storageOutput = ts.transpileModule(plannerStorageSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const storageModule = { exports: {} };
new Function('module', 'exports', 'require', `${storageOutput}\nreturn module.exports;`)(
  storageModule,
  storageModule.exports,
  require,
);
const {
  applyPlannerPhaseOverrides,
  assignPlannerPhaseKeys,
  getPlannerPhaseOverridesStorageKey,
  parsePlannerPhaseOverrides,
  parseProPlannerBakeTarget,
} = storageModule.exports;
for (const serialized of ['2026-10-15T19:00:00.000Z', '2026-10-20T18:30:00.000Z']) {
  assert.equal(parseProPlannerBakeTarget(serialized)?.toISOString(), serialized);
}
assert.equal(parseProPlannerBakeTarget(null), null);
assert.equal(parseProPlannerBakeTarget('2026-10-15'), null, 'date-only values must not drop the selected time');
const originalScheduleIdentity = JSON.stringify(['2026-10-15T19:00:00.000Z', 'direct', 'romana', 'teglia']);
const otherTargetIdentity = JSON.stringify(['2026-10-20T18:30:00.000Z', 'direct', 'romana', 'teglia']);
const otherRecipeIdentity = JSON.stringify(['2026-10-15T19:00:00.000Z', 'biga', 'romana', 'teglia']);
const originalScheduleOverridesKey = getPlannerPhaseOverridesStorageKey('pro', originalScheduleIdentity);
assert.equal(
  getPlannerPhaseOverridesStorageKey('pro', originalScheduleIdentity),
  originalScheduleOverridesKey,
  'the same bake target and recipe identity must reopen the same manual edits',
);
assert.notEqual(
  getPlannerPhaseOverridesStorageKey('pro', otherTargetIdentity),
  originalScheduleOverridesKey,
  'a changed bake target must not load old absolute phase times',
);
assert.notEqual(
  getPlannerPhaseOverridesStorageKey('pro', otherRecipeIdentity),
  originalScheduleOverridesKey,
  'a changed method must not load old absolute phase times',
);
assert.equal(
  getPlannerPhaseOverridesStorageKey('pro'),
  'plannerPhaseOverrides:pro',
  'unscoped legacy Pro edits remain in place and are not deleted',
);
assert.equal(
  getPlannerPhaseOverridesStorageKey('beginner'),
  'plannerPhaseOverrides:beginner',
  'Beginner keeps its existing storage key',
);
const originalPhase = assignPlannerPhaseKeys([
  { title: 'Izvadi masu tijesta iz hladnjaka', at: new Date('2026-10-15T17:00:00.000Z') },
], 'pro', true);
const translatedPhase = assignPlannerPhaseKeys([
  { title: 'Take the dough mass out of the refrigerator', at: new Date('2026-10-15T17:00:00.000Z') },
], 'pro', true);
assert.equal(originalPhase[0].phaseKey, translatedPhase[0].phaseKey,
  'PRO manual edits must remain attached to the phase across locale changes');
const editedRemovalAt = new Date('2026-10-15T17:01:00.000Z').getTime();
const sameTargetOverrides = parsePlannerPhaseOverrides(JSON.stringify({
  [originalPhase[0].phaseKey]: editedRemovalAt,
}));
assert.equal(
  applyPlannerPhaseOverrides(originalPhase, sameTargetOverrides)[0].at.getTime(),
  editedRemovalAt,
  'manual edits remain available for the same target after reload',
);
const changedTargetPhase = assignPlannerPhaseKeys([
  { title: 'Take the dough mass out of the refrigerator', at: new Date('2026-10-20T16:30:00.000Z') },
], 'pro', true);
assert.equal(
  applyPlannerPhaseOverrides(changedTargetPhase, parsePlannerPhaseOverrides(null))[0].at.toISOString(),
  '2026-10-20T16:30:00.000Z',
  'a different target starts from canonical schedule times, not the old absolute edit',
);
assert.equal(
  getPlannerPhaseOverridesStorageKey('pro', originalScheduleIdentity),
  originalScheduleOverridesKey,
  'switching back to the original target selects its preserved override storage',
);
const translations = fs.readFileSync(path.join(root, 'src', 'i18n', 'translations.ts'), 'utf8');
const localizedWarnings = [...translations.matchAll(/stalePhaseOverridesNotApplied:\s*'([^']+)'/g)];
assert.equal(localizedWarnings.length, 4, 'the stale-edit warning is translated in HR, EN, DE and SL');
assert.ok(localizedWarnings.every(([, message]) => message.length > 0));

const directLocalizedLabels = {
  hr: ['Završetak zamjesa', 'Početni odmor tijesta', 'Podjela i oblikovanje kuglica'],
  en: ['Mixing complete', 'Initial dough rest', 'Divide and shape dough balls'],
  de: ['Ende des Knetens', 'Erste Teigruhe', 'Teig teilen und Teiglinge formen'],
  sl: ['Konec mešanja testa', 'Začetni počitek testa', 'Delitev in oblikovanje kroglic'],
};
const directBakeAt = new Date(2026, 10, 18, 19, 0, 0, 0);
const plannerLocalDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
for (const selectedHours of [2, 4]) {
  const fridgeAt = new Date(directBakeAt.getTime() - (24 + selectedHours) * 3600000);
  const fridgeRemovalAt = new Date(fridgeAt.getTime() + 24 * 3600000);
  const baseSteps = [
    { phaseId: 'direct.mix', at: fridgeAt, title: 'Mix dough', desc: '' },
    { phaseId: 'direct.fridge', at: fridgeAt, title: 'Refrigerate', desc: '' },
    { phaseId: 'direct.fridgeRemoval', at: fridgeRemovalAt, title: 'Remove from fridge', desc: '' },
    { phaseId: 'direct.preheat', at: new Date(directBakeAt.getTime() - 60 * 60000), title: 'Preheat', desc: '' },
    { phaseId: 'direct.bake', at: directBakeAt, title: 'Bake', desc: '' },
  ];
  const alignedSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, 'hr');
  const keyedSteps = assignPlannerPhaseKeys(alignedSteps, 'pro', true);
  const preheatStep = keyedSteps.find((step) => step.phaseId === 'direct.preheat');
  const finalSteps = applyPlannerPhaseOverrides(keyedSteps, {
    [preheatStep.phaseKey]: preheatStep.at.getTime(),
  });
  const stepById = new Map(finalSteps.map((step) => [step.phaseId, step]));
  const mixStep = stepById.get('direct.mix');
  const restStep = stepById.get('direct.initial.mix-rest');
  const ballingStep = stepById.get('direct.initial.balling');
  const fridgeStep = stepById.get('direct.fridge');
  const removalStep = stepById.get('direct.fridgeRemoval');
  assert.equal(plannerLocalDateTime(fridgeStep.at), `2026-11-17 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(plannerLocalDateTime(removalStep.at), `2026-11-18 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(removalStep.at.getTime() - fridgeStep.at.getTime(), 24 * 3600000);
  assert.equal(mixStep.title, directLocalizedLabels.hr[0]);
  assert.equal(mixStep.at.getTime(), fridgeAt.getTime() - 5 * 60000);
  assert.match(mixStep.desc, /ne procjenjuje njegovo trajanje/);
  assert.equal(restStep.at.getTime(), mixStep.at.getTime());
  assert.equal(restStep.desc, 'Pokrijte tijesto i ostavite ga da odmori 5 minuta.');
  assert.equal(ballingStep.at.getTime(), fridgeStep.at.getTime());
  assert.ok(finalSteps.indexOf(ballingStep) < finalSteps.indexOf(fridgeStep));
  assert.equal(plannerLocalDateTime(stepById.get('direct.preheat').at), '2026-11-18 18:00');
  assert.equal(plannerLocalDateTime(stepById.get('direct.bake').at), '2026-11-18 19:00');
  assert.equal(finalSteps.some((step) => step.phaseId === 'direct.bulk'), false);

  for (const [lang, labels] of Object.entries(directLocalizedLabels)) {
    const localizedSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, lang);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.mix' && step.title === labels[0]), `${lang}: mix completion localization`);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.initial.mix-rest' && step.title === labels[1]), `${lang}: initial rest localization`);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.initial.balling' && step.title === labels[2]), `${lang}: shaping localization`);
  }
}

for (const method of ['direct', 'biga', 'poolish']) {
  const selected = {
    method,
    roomHours: method === 'direct' ? 5 : 3,
    fridgeHours: method === 'direct' ? 19 : 11,
    prefermentHours: method === 'biga' ? 24 : method === 'poolish' ? 18 : undefined,
    roomTemp: 21,
    fridgeTemp: 4,
  };
  const schedule = getFermentationSchedule(selected);
  assert.equal(schedule.phases.reduce((sum, phase) => sum + phase.hours, 0),
    selected.roomHours + selected.fridgeHours + (selected.prefermentHours ?? 0));
  assert.equal(schedule.phases.at(-1)?.temperature, 4);
}

console.log('F29 Planner schedule preservation regression passed.');
