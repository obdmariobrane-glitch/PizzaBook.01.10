import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyPlannerPhaseOverrides,
  assignPlannerPhaseKeys,
  getPlannerPhaseOverridesStorageKey,
  parsePlannerPhaseOverrides,
  retainCurrentPlannerPhaseOverrides,
} from '../src/plannerPhaseOverrides.ts';

const initialSteps = assignPlannerPhaseKeys([
  { at: new Date('2026-10-12T08:00:00'), title: 'Mix dough', desc: 'Mix.' },
  { at: new Date('2026-10-12T10:00:00'), title: 'Cold fermentation', desc: 'Refrigerate.' },
  { at: new Date('2026-10-12T17:00:00'), title: 'Bake', desc: 'Bake.' },
]);
const editKey = initialSteps[0].phaseKey;
const coldKey = initialSteps[1].phaseKey;
const editedAt = new Date('2026-10-12T09:15:00').getTime();
const savedOverrides = JSON.stringify({ [editKey]: editedAt, [coldKey]: 1791828000000 });
const reopenedOverrides = parsePlannerPhaseOverrides(savedOverrides);
const recalculatedSteps = assignPlannerPhaseKeys([
  { at: new Date('2026-10-12T07:30:00'), title: 'Mix dough', desc: 'Updated mix.' },
  { at: new Date('2026-10-12T11:00:00'), title: 'Cold fermentation', desc: 'Updated cold phase.' },
  { at: new Date('2026-10-12T18:00:00'), title: 'Bake', desc: 'Updated bake.' },
]);
const recalculatedAndEdited = applyPlannerPhaseOverrides(recalculatedSteps, reopenedOverrides);
assert.equal(recalculatedAndEdited.find((step) => step.phaseKey === editKey)?.at.getTime(), editedAt,
  'manual phase time remains after calculator recalculation and saved-state reload');

const noColdSteps = assignPlannerPhaseKeys([
  { at: new Date('2026-10-12T07:30:00'), title: 'Mix dough', desc: 'Updated mix.' },
  { at: new Date('2026-10-12T18:00:00'), title: 'Bake', desc: 'Updated bake.' },
]);
const prunedOverrides = retainCurrentPlannerPhaseOverrides(reopenedOverrides, noColdSteps);
assert.equal(coldKey in prunedOverrides, false, 'removed phases do not retain stale manual edits');
assert.equal(applyPlannerPhaseOverrides(noColdSteps, prunedOverrides).some((step) => step.title === 'Cold fermentation'), false,
  'removed phases do not reappear after recalculation');

const restoredColdSteps = assignPlannerPhaseKeys([
  { at: new Date('2026-10-12T07:30:00'), title: 'Mix dough', desc: 'Updated mix.' },
  { at: new Date('2026-10-12T12:00:00'), title: 'Cold fermentation', desc: 'New cold phase.' },
  { at: new Date('2026-10-12T18:00:00'), title: 'Bake', desc: 'Updated bake.' },
]);
assert.equal(
  applyPlannerPhaseOverrides(restoredColdSteps, prunedOverrides).find((step) => step.phaseKey === coldKey)?.at.getTime(),
  restoredColdSteps.find((step) => step.phaseKey === coldKey)?.at.getTime(),
  'a later phase does not inherit an obsolete manual edit',
);

const duplicateTitles = assignPlannerPhaseKeys([
  { title: 'Preheat' },
  { title: 'Preheat' },
]);
assert.notEqual(duplicateTitles[0].phaseKey, duplicateTitles[1].phaseKey);
assert.throws(() => parsePlannerPhaseOverrides('[]'), /must be an object/);

const beginnerScope = JSON.stringify(['beginner', 'neapolitan', 'tonda', 'direct', 'hand']);
const beginnerHr = assignPlannerPhaseKeys([
  { phaseId: 'direct.preheat', title: 'Vorheizen' },
], beginnerScope);
const beginnerEn = assignPlannerPhaseKeys([
  { phaseId: 'direct.preheat', title: 'Preheat' },
], beginnerScope);
const proSteps = assignPlannerPhaseKeys([
  { phaseId: 'direct.preheat', title: 'Preheat' },
]);
const beginnerEdit = { [beginnerHr[0].phaseKey]: editedAt };
assert.equal(beginnerHr[0].phaseKey, beginnerEn[0].phaseKey,
  'Beginner phase identifiers must survive a locale change');
assert.equal(applyPlannerPhaseOverrides(beginnerEn, beginnerEdit)[0].at.getTime(), editedAt,
  'a Beginner manual phase edit must survive translated titles');
assert.notEqual(beginnerEn[0].phaseKey, proSteps[0].phaseKey,
  'a Pro phase edit must not match the corresponding Beginner phase');
assert.notEqual(
  getPlannerPhaseOverridesStorageKey('beginner'),
  getPlannerPhaseOverridesStorageKey('pro'),
  'saved phase edits must be stored separately by experience',
);

const plannerSource = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
const translationsSource = await readFile(new URL('../src/i18n/translations.ts', import.meta.url), 'utf8');
assert.match(plannerSource, /testID=\{`edit-phase-\$\{i\}`\}/);
assert.match(plannerSource, /getPlannerPhaseOverridesStorageKey/);
assert.match(plannerSource, /assignPlannerPhaseKeys\([\s\S]*JSON\.stringify\(\['beginner'/);
assert.doesNotMatch(plannerSource, /AsyncStorage\.getItem\(PLANNER_PHASE_OVERRIDES_STORAGE_KEY\)/,
  'ambiguous legacy global phase overrides must not be loaded into either experience');
assert.match(plannerSource, /AsyncStorage\.setItem\(/);
assert.equal((translationsSource.match(/editPhase:/g) ?? []).length, 4, 'phase edit label exists in all four locales');

console.log('Planner phase override checks passed: save/reopen, locale-stable Beginner keys, experience isolation, calculator changes, and stale-phase pruning.');
