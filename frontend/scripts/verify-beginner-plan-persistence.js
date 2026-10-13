#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: (specifier) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, specifier)) return dependencies[specifier];
      throw new Error(`Unexpected dependency ${specifier} in ${relativePath}`);
    },
  }, { filename: relativePath });
  return moduleRef.exports;
}

const persistence = loadTypeScriptModule('src/beginnerPlanPersistence.ts');
const calculator = loadTypeScriptModule('src/calculator.ts');
const guidedRecipe = loadTypeScriptModule('src/guidedRecipe.ts');
const preferenceValues = new Map();
const preferenceStorage = {
  getItem: async (key) => preferenceValues.get(key) ?? null,
  setItem: async (key, value) => {
    preferenceValues.set(key, value);
    return true;
  },
};
const preferences = loadTypeScriptModule('src/preferences.ts', { './utils/storage': { storage: preferenceStorage } });
const restoreCoordinator = loadTypeScriptModule('src/beginnerPlanRestoreCoordinator.ts', { './preferences': preferences });
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'planner.tsx'), 'utf8');

assert.match(appSource, /preferredYeastType,\s*\},\s*pizzas,/);
assert.match(appSource, /parsePreferredYeastType\(settings\.preferredYeastType\)/);
assert.match(plannerSource, /useSyncExternalStore\(subscribePreferredYeastType,\s*getCachedPreferredYeastType/);
assert.match(plannerSource, /plannerStepCopy\.yeastHandling\[preferredYeastType\]/);

function makeSchedule(bakeAt, mode) {
  const roomBeforeFridgeHours = (20 + 90 + 5) / 60;
  const fridgeHours = mode === 'fridgeRoom' ? 4 : 0;
  const roomAfterFridgeHours = mode === 'fridgeRoom' ? 3 : 0;
  const startAt = new Date(bakeAt.getTime() - (roomBeforeFridgeHours + fridgeHours + roomAfterFridgeHours) * 3600000);
  return {
    startAt,
    bakeAt,
    preheatAt: new Date(bakeAt.getTime() - 45 * 60000),
    ballingAt: new Date(startAt.getTime() + (20 + 90) * 60000),
    fridgeAt: mode === 'fridgeRoom' ? new Date(startAt.getTime() + (20 + 90 + 5) * 60000) : undefined,
    roomBeforeFridgeHours,
    fridgeHours,
    roomAfterFridgeHours,
    prefermentHours: 0,
    phaseAMinutes: 20,
    phaseBMinutes: 90,
    phaseCMinutes: 5,
  };
}

function encodeSnapshot(schedule, mode, inputKey) {
  return JSON.stringify({
    version: persistence.BEGINNER_PLAN_STORAGE_VERSION,
    inputKey,
    bakeAt: schedule.bakeAt.toISOString(),
    calculationNow: new Date(schedule.bakeAt.getTime() - 10 * 3600000).toISOString(),
    mode,
    schedule: persistence.serializeBeginnerSchedule(schedule),
  });
}

function parseSnapshot(raw) {
  return persistence.parseBeginnerPlanSnapshot(raw, calculator.isHomeScheduleDurationValid);
}

function assertSourceContract() {
  assert.ok(appSource.includes('createBeginnerPlanRestoreCoordinator'));
  assert.ok(appSource.includes('createBeginnerPlanRestoreLoaders'));
  assert.ok(appSource.includes('applyLoadedCalculatorPreferences'));
  assert.ok(appSource.includes('createBeginnerPlanInputKeyFromState'));
  assert.ok(appSource.includes('createGuidedPlanId([beginnerPlanInputKey])'));
  assert.ok(appSource.includes('return () => beginnerRestoreCoordinator.current.invalidate(generation);'));
}

assertSourceContract();

function createAppIdentity(overrides = {}) {
  return persistence.createBeginnerPlanInputKeyFromState({
    bakeAt: 1791745200000,
    pizzaStyle: 'romana',
    romanFormat: 'teglia',
    pizzas: 1,
    effectiveBall: 1000,
    roomTemp: 22,
    fridgeTemp: 4,
    oven: 'homePan',
    ovenTemp: 250,
    flour: 'caputo00',
    blendA: null,
    blendB: null,
    blendPctA: null,
    mixing: 'hand',
    explicitFlourStrength: { source: 'unknown' },
    hydration: 70,
    preferredYeastType: 'fresh',
    beginnerScheduleMode: 'fridgeRoom',
    diameter: 30,
    isRomanTeglia: true,
    trayWidth: 30,
    trayLength: 40,
    ...overrides,
  });
}

const teglia30x40Key = createAppIdentity();
const teglia20x60Key = createAppIdentity({ trayWidth: 20, trayLength: 60 });
assert.notEqual(teglia30x40Key, teglia20x60Key, 'Teglia dimensions must reset progress even with equal dough mass');
assert.equal(createAppIdentity({ isRomanTeglia: false, trayWidth: 30, trayLength: 40 }), createAppIdentity({ isRomanTeglia: false, trayWidth: 20, trayLength: 60 }), 'non-Teglia tray dimensions must not affect identity');
assert.notEqual(createAppIdentity({ diameter: 30, isRomanTeglia: false }), createAppIdentity({ diameter: 33, isRomanTeglia: false }), 'round pizza diameter must reset progress');
assert.equal(
  createAppIdentity({ pizzaStyle: 'ny_style', romanFormat: 'tonda', isRomanTeglia: false }),
  createAppIdentity({ pizzaStyle: 'ny_style', romanFormat: 'teglia', isRomanTeglia: false }),
  'stale Roman format must not reset non-Romana Beginner progress',
);

const initialNow = new Date('2026-10-10T08:00:00.000Z');
const laterNow = new Date('2026-10-10T10:00:00.000Z');
const thirtyMinutesBeforeBake = new Date('2026-10-10T10:00:00.000Z');
for (const mode of ['roomOnly', 'fridgeRoom']) {
  const bakeAt = mode === 'roomOnly'
    ? new Date('2026-10-10T10:30:00.000Z')
    : new Date('2026-10-11T18:00:00.000Z');
  const schedule = makeSchedule(bakeAt, mode);
  const inputKey = persistence.createBeginnerPlanInputKey([
    bakeAt.getTime(), 'neapolitan', 'tonda', 4, 250, 22, 4, 'homeStone', 300, 'caputo00', 'hand', 'dry', mode,
  ]);
  assert.equal(calculator.isHomeScheduleDurationValid(schedule), true, `${mode}: fixture schedule must be valid`);

  const restored = parseSnapshot(encodeSnapshot(schedule, mode, inputKey));
  assert.ok(restored, `${mode}: production parser must restore the snapshot`);
  assert.equal(persistence.isBeginnerPlanActive(restored, mode === 'roomOnly' ? thirtyMinutesBeforeBake : laterNow), true);
  assert.equal(restored.mode, mode, `${mode}: fermentation mode must survive restore`);
  assert.equal(restored.inputKey, inputKey, `${mode}: plan input identity must survive restore`);
  assert.equal(JSON.stringify(restored.parsedSchedule), JSON.stringify(schedule), `${mode}: all schedule dates and durations must survive restore`);
  assert.equal(restored.parsedCalculationNow.toISOString(), new Date(schedule.bakeAt.getTime() - 10 * 3600000).toISOString());

  const completedAt = { mix: 1_000, ...(mode === 'fridgeRoom' ? { fridgeIn: 2_000 } : { balling: 2_000 }) };
  const guidedPlanId = guidedRecipe.createGuidedPlanId([
    restored.parsedSchedule.bakeAt.getTime(), restored.parsedSchedule.startAt.getTime(),
    restored.parsedSchedule.roomBeforeFridgeHours, restored.parsedSchedule.fridgeHours,
    restored.parsedSchedule.roomAfterFridgeHours, mode,
  ]);
  const progressStorageKey = `beginnerGuidedProgress:${guidedPlanId}`;
  const progressRecord = { planId: guidedPlanId, completedAt };
  assert.equal(JSON.parse(JSON.stringify({ key: progressStorageKey, ...progressRecord })).planId, guidedPlanId);
  assert.deepEqual(progressRecord.completedAt, completedAt, `${mode}: guided progress remains separate and intact`);
}

const sameDisplayKey = persistence.createBeginnerPlanInputKey([new Date('2026-10-11T18:00:00Z').getTime(), 'neapolitan', 'tonda', 'caputo00', 'hand']);
const changedDateKey = persistence.createBeginnerPlanInputKey([new Date('2026-10-12T18:00:00Z').getTime(), 'neapolitan', 'tonda', 'caputo00', 'hand']);
const changedInputKey = persistence.createBeginnerPlanInputKey([new Date('2026-10-11T18:00:00Z').getTime(), 'neapolitan', 'tonda', 'manitoba', 'hand']);
assert.equal(sameDisplayKey, persistence.createBeginnerPlanInputKey([new Date('2026-10-11T18:00:00Z').getTime(), 'neapolitan', 'tonda', 'caputo00', 'hand']), 'language/unit display changes must not change identity inputs');
assert.notEqual(sameDisplayKey, changedDateKey, 'new Planner date must create a new plan key');
assert.notEqual(sameDisplayKey, changedInputKey, 'relevant input must create a new plan key');

for (const style of ['neapolitan', 'romana-tonda', 'romana-teglia', 'ny_style']) {
  for (const mode of ['roomOnly', 'fridgeRoom']) {
    for (const mixing of ['hand', 'mixer']) {
      for (const yeast of ['fresh', 'activeDry', 'dry']) {
        for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom']) {
          const identity = createAppIdentity({
            pizzaStyle: style,
            romanFormat: style === 'romana-teglia' ? 'teglia' : 'tonda',
            beginnerScheduleMode: mode,
            mixing,
            preferredYeastType: yeast,
            flour,
            isRomanTeglia: style === 'romana-teglia',
          });
          const guidedId = guidedRecipe.createGuidedPlanId([identity]);
          assert.equal(guidedId, guidedRecipe.createGuidedPlanId([identity]), `${style}/${mode}/${mixing}/${yeast}/${flour}: identity must be stable`);
          assert.notEqual(guidedId, guidedRecipe.createGuidedPlanId([createAppIdentity({
            pizzaStyle: style,
            romanFormat: style === 'romana-teglia' ? 'teglia' : 'tonda',
            bakeAt: 1791831600000,
            beginnerScheduleMode: mode,
            mixing,
            preferredYeastType: yeast,
            flour,
            isRomanTeglia: style === 'romana-teglia',
          })]), `${style}/${mode}/${mixing}/${yeast}/${flour}: changed plan must reset progress`);
        }
      }
    }
  }
}

const expired = parseSnapshot(encodeSnapshot(makeSchedule(new Date('2026-10-09T18:00:00Z'), 'roomOnly'), 'roomOnly', sameDisplayKey));
assert.equal(persistence.isBeginnerPlanActive(expired, initialNow), false, 'expired plan must not become a new plan');
assert.equal(parseSnapshot(null), null, 'absent legacy snapshot must remain compatible');
assert.equal(parseSnapshot('{"version":1'), null, 'invalid JSON must be ignored');
assert.equal(parseSnapshot(JSON.stringify({ version: 1, inputKey: sameDisplayKey, bakeAt: '2026-10-11T18:00:00Z', calculationNow: initialNow.toISOString(), mode: 'roomOnly', schedule: {} })), null, 'structurally invalid snapshot must be ignored');

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

async function assertRestoreCoordinatorFlow() {
  for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    assert.equal(await preferences.setPreferredYeastType(yeastType), true);
    assert.equal(await preferences.loadPreferredYeastType(), yeastType, `${yeastType} preference must persist and reload`);
  }
  preferenceValues.set('preferredYeastType', 'dry');
  assert.equal(await preferences.loadPreferredYeastType(), 'dry', 'legacy dry must still load as instant dry');

  const dryPreference = deferred();
  const requestedKeys = [];
  const dryBakeAt = new Date('2026-10-11T18:00:00.000Z');
  const drySchedule = makeSchedule(dryBakeAt, 'roomOnly');
  const dryInputKey = persistence.createBeginnerPlanInputKey([dryBakeAt.getTime(), 'neapolitan', 'tonda', 'caputo00', 'hand', 'dry', 'roomOnly']);
  const storageValues = {
    [restoreCoordinator.EXPERIENCE_LEVEL_STORAGE_KEY]: JSON.stringify('beginner'),
    [restoreCoordinator.TEMPERATURE_UNIT_STORAGE_KEY]: JSON.stringify('fahrenheit'),
    [restoreCoordinator.MEASUREMENT_SYSTEM_STORAGE_KEY]: JSON.stringify('us'),
    [restoreCoordinator.PREFERRED_YEAST_TYPE_STORAGE_KEY]: null,
    [restoreCoordinator.CALCULATOR_SETTINGS_STORAGE_KEY]: JSON.stringify({ pizzaStyle: 'neapolitan' }),
    [restoreCoordinator.BEGINNER_BAKE_AT_STORAGE_KEY]: '2026-10-11T18:00:00.000Z',
    [restoreCoordinator.BEGINNER_PLAN_SNAPSHOT_STORAGE_KEY]: encodeSnapshot(drySchedule, 'roomOnly', dryInputKey),
  };
  const storage = {
    getItem: async (key) => {
      requestedKeys.push(key);
      if (key === restoreCoordinator.PREFERRED_YEAST_TYPE_STORAGE_KEY) return dryPreference.promise;
      return storageValues[key] ?? null;
    },
  };
  const loaders = restoreCoordinator.createBeginnerPlanRestoreLoaders(storage);
  const coordinator = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  const generation = coordinator.begin();
  let committed = null;
  let saveCalls = 0;
  let notificationSyncCalls = 0;
  const restorePromise = coordinator.load(generation, loaders).then((data) => {
    if (!data || !coordinator.isCurrent(generation)) return;
    committed = data;
    saveCalls += 1;
    notificationSyncCalls += 1;
  });
  await Promise.resolve();
  assert.equal(committed, null, 'temporary defaults must not commit before dry preference loads');
  assert.equal(saveCalls, 0, 'temporary defaults must not save a snapshot');
  assert.equal(notificationSyncCalls, 0, 'temporary defaults must not sync alarms');
  assert.deepEqual(new Set(requestedKeys), new Set([
    restoreCoordinator.EXPERIENCE_LEVEL_STORAGE_KEY,
    restoreCoordinator.TEMPERATURE_UNIT_STORAGE_KEY,
    restoreCoordinator.MEASUREMENT_SYSTEM_STORAGE_KEY,
    restoreCoordinator.PREFERRED_YEAST_TYPE_STORAGE_KEY,
    restoreCoordinator.CALCULATOR_SETTINGS_STORAGE_KEY,
    restoreCoordinator.BEGINNER_BAKE_AT_STORAGE_KEY,
    restoreCoordinator.BEGINNER_PLAN_SNAPSHOT_STORAGE_KEY,
  ]), 'restore must read the real identity and snapshot keys');
  dryPreference.resolve(JSON.stringify('dry'));
  await restorePromise;
  assert.equal(committed.experienceLevel, 'beginner', 'JSON-encoded experience must decode to beginner');
  assert.equal(committed.preferences.temperatureUnit, 'fahrenheit', 'JSON-encoded temperature unit must decode');
  assert.equal(committed.preferences.measurementSystem, 'us', 'JSON-encoded measurement system must decode');
  assert.equal(committed.preferences.preferredYeastType, 'dry', 'saved dry preference must win over the fresh default');
  const restoredDryPlan = parseSnapshot(committed.beginnerPlanSnapshot);
  assert.ok(restoredDryPlan, 'the raw snapshot JSON must remain available to the snapshot parser');
  assert.equal(restoredDryPlan.inputKey, dryInputKey, 'the decoded dry preference must restore the dry plan identity');
  assert.equal(restoreCoordinator.resolveBeginnerRestoreBakeAt(committed, restoredDryPlan, new Date('2026-10-10T08:00:00.000Z')).getTime(), dryBakeAt.getTime(), 'the active dry plan must restore its bake date');
  const activeDryLoaded = await restoreCoordinator.createBeginnerPlanRestoreLoaders({
    getItem: async (key) => key === restoreCoordinator.PREFERRED_YEAST_TYPE_STORAGE_KEY
      ? JSON.stringify('activeDry')
      : null,
  }).load();
  assert.equal(activeDryLoaded.preferences.preferredYeastType, 'activeDry', 'saved active-dry preference must restore');
  const proStorage = {
    ...storage,
    getItem: async (key) => key === restoreCoordinator.EXPERIENCE_LEVEL_STORAGE_KEY
      ? JSON.stringify('pro')
      : storage.getItem(key),
  };
  const proDecoded = await restoreCoordinator.createBeginnerPlanRestoreLoaders(proStorage).load();
  assert.equal(proDecoded.experienceLevel, 'pro', 'JSON-encoded pro experience must decode correctly');
  assert.equal(saveCalls, 1, 'save is enabled only after the complete restore');
  assert.equal(notificationSyncCalls, 1, 'alarm sync is enabled only after the complete restore');
}

async function assertGenerationProtection() {
  const coordinator = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  const oldLoad = deferred();
  const newLoad = deferred();
  const oldGeneration = coordinator.begin();
  const oldPromise = coordinator.load(oldGeneration, { load: () => oldLoad.promise });
  const newGeneration = coordinator.begin();
  const newPromise = coordinator.load(newGeneration, { load: () => newLoad.promise });
  let sharedBakeAt = new Date('2026-10-12T18:00:00.000Z');

  const proData = { experienceLevel: 'pro', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'fresh' }, calculatorSettings: null, legacyBakeAt: null, beginnerPlanSnapshot: null };
  newLoad.resolve(proData);
  assert.deepEqual(await newPromise, proData, 'newest load must commit when it finishes first');
  assert.equal(restoreCoordinator.resolveBeginnerRestoreBakeAt(proData, null, new Date()), undefined, 'Pro restore must preserve the existing shared date');
  oldLoad.resolve({ experienceLevel: 'beginner', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'dry' }, calculatorSettings: null, legacyBakeAt: '2026-10-11T18:00:00.000Z', beginnerPlanSnapshot: 'stale' });
  assert.equal(await oldPromise, null, 'older load must be discarded when it finishes last');
  assert.equal(sharedBakeAt.getTime(), new Date('2026-10-12T18:00:00.000Z').getTime(), 'stale response must preserve the existing shared date');

  const rejected = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  const rejectedGeneration = rejected.begin();
  await assert.rejects(rejected.load(rejectedGeneration, { load: () => Promise.reject(new Error('read failed')) }));
  assert.equal(sharedBakeAt.getTime(), new Date('2026-10-12T18:00:00.000Z').getTime(), 'rejected read must preserve the existing shared date');

  const plannerReturn = { experienceLevel: 'beginner', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'dry' }, calculatorSettings: null, legacyBakeAt: '2026-10-13T18:00:00.000Z', beginnerPlanSnapshot: null };
  const plannerBakeAt = restoreCoordinator.resolveBeginnerRestoreBakeAt(plannerReturn, null, new Date('2026-10-10T08:00:00.000Z'));
  assert.equal(plannerBakeAt.toISOString(), '2026-10-13T18:00:00.000Z', 'return from Planner must restore its legacy bake date');
  const priorPlan = parseSnapshot(encodeSnapshot(makeSchedule(new Date('2026-10-11T18:00:00.000Z'), 'roomOnly'), 'roomOnly', 'prior-plan'));
  const plannerReturnWithPriorSnapshot = { ...plannerReturn, legacyBakeAt: '2026-10-14T18:00:00.000Z' };
  const changedPlannerBakeAt = restoreCoordinator.resolveBeginnerRestoreBakeAt(plannerReturnWithPriorSnapshot, priorPlan, new Date('2026-10-10T08:00:00.000Z'));
  assert.equal(changedPlannerBakeAt.toISOString(), '2026-10-14T18:00:00.000Z', 'a new Planner date must supersede an older active snapshot date');
  sharedBakeAt = plannerBakeAt;

  const modeChange = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  const beginnerLoad = deferred();
  const proLoad = deferred();
  const beginnerGeneration = modeChange.begin();
  const beginnerPromise = modeChange.load(beginnerGeneration, { load: () => beginnerLoad.promise });
  const proGeneration = modeChange.begin();
  const proPromise = modeChange.load(proGeneration, { load: () => proLoad.promise });
  proLoad.resolve({ experienceLevel: 'pro', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'fresh' }, calculatorSettings: null, legacyBakeAt: null, beginnerPlanSnapshot: null });
  assert.equal((await proPromise).experienceLevel, 'pro', 'Pro mode must win when mode changes during reading');
  beginnerLoad.resolve({ experienceLevel: 'beginner', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'dry' }, calculatorSettings: null, legacyBakeAt: '2026-10-11T18:00:00.000Z', beginnerPlanSnapshot: 'stale' });
  assert.equal(await beginnerPromise, null, 'Beginner response must not restore a plan after switching to Pro');

  const unmounted = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  const unmountedLoad = deferred();
  const unmountedGeneration = unmounted.begin();
  const unmountedPromise = unmounted.load(unmountedGeneration, { load: () => unmountedLoad.promise });
  unmounted.dispose();
  unmountedLoad.resolve({ experienceLevel: 'beginner', preferences: { temperatureUnit: 'celsius', measurementSystem: 'metric', preferredYeastType: 'dry' }, calculatorSettings: null, legacyBakeAt: '2026-10-11T18:00:00.000Z', beginnerPlanSnapshot: 'stale' });
  assert.equal(await unmountedPromise, null, 'unmounted response must not apply state or shared date');
  assert.equal(sharedBakeAt.toISOString(), '2026-10-13T18:00:00.000Z', 'unmounted response must preserve the existing shared date');

  const strictMode = restoreCoordinator.createBeginnerPlanRestoreCoordinator();
  strictMode.activate();
  const firstSetupGeneration = strictMode.begin();
  strictMode.invalidate(firstSetupGeneration);
  strictMode.activate();
  const secondSetupGeneration = strictMode.begin();
  assert.equal(strictMode.isCurrent(secondSetupGeneration), true, 'Strict Mode setup-cleanup-setup must reactivate the coordinator');
  strictMode.dispose();
  assert.equal(strictMode.isCurrent(secondSetupGeneration), false, 'dispose must invalidate the coordinator');
}

assertSourceContract();
assertRestoreCoordinatorFlow().then(assertGenerationProtection).then(() => {
  console.log('Beginner plan persistence and async restore checks passed using production persistence, calculator, guided-plan, and restore-coordinator functions.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
