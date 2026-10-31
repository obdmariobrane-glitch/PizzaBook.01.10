#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const calculatorSource = fs.readFileSync(path.join(root, 'src', 'calculator.ts'), 'utf8');
const output = ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleValue = { exports: {} };
new Function('module', 'exports', 'require', `${output}\nreturn module.exports;`)(moduleValue, moduleValue.exports, require);
const { getFermentationSchedule } = moduleValue.exports;

const plannerSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const plannerStorageSource = fs.readFileSync(path.join(root, 'src', 'plannerPhaseOverrides.ts'), 'utf8');
assert.match(plannerSource, /sharedCalculatorPlanSettings\.proFermentationSchedule/);
assert.match(plannerSource, /subscribeSharedCalculatorPlanSettings/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.roomHours/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.fridgeHours/);
assert.match(plannerSource, /AsyncStorage\.getItem\(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY\)/);
assert.match(plannerSource, /AsyncStorage\.setItem\(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY, d\.toISOString\(\)\)/);
assert.match(plannerSource, /if \(!isBeginner && !plannerBakeTargetReady\) return false;/);
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
