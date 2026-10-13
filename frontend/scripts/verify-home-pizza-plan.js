#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const preferencesSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preferences.ts'), 'utf8');
const translationsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');
const bigaUiSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const prefermentStepsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'prefermentSteps.ts'), 'utf8');
const plannerUiSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'planner.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledTranslations = ts.transpileModule(translationsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledPreferences = ts.transpileModule(preferencesSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });
const translationsModule = { exports: {} };
vm.runInNewContext(compiledTranslations, { module: translationsModule, exports: translationsModule.exports }, { filename: 'translations.ts' });
const productionTranslations = translationsModule.exports.translations;
const preferencesModule = { exports: {} };
vm.runInNewContext(compiledPreferences, {
  module: preferencesModule,
  exports: preferencesModule.exports,
  require: (specifier) => {
    if (specifier === './utils/storage') return { storage: {} };
    throw new Error(`Unexpected preferences dependency: ${specifier}`);
  },
}, { filename: 'preferences.ts' });
const { parsePreferredYeastType } = preferencesModule.exports;
assert.equal(parsePreferredYeastType('fresh'), 'fresh');
assert.equal(parsePreferredYeastType('activeDry'), 'activeDry');
assert.equal(parsePreferredYeastType('dry'), 'dry');
assert.equal(parsePreferredYeastType('unknown'), null);
assert.equal(parsePreferredYeastType(null), null);

const {
  getAvailableFermentationHours,
  getHomeFermentationWindow,
  getHomeScheduleDurationHours,
  isHomeScheduleDurationValid,
  getBigaHomeScheduleDurationHours,
  isBigaHomeScheduleDurationValid,
  getBigaHomeScheduleMilestones,
  getBigaHomeFermentationSchedule,
  getPoolishHomeFermentationSchedule,
  getPoolishHomeScheduleDurationHours,
  isPoolishHomeScheduleDurationValid,
  getPoolishHomeScheduleMilestones,
  reversePlan,
  getSharedHomeBakeAt,
  setSharedHomeBakeAt,
  subscribeSharedHomeBakeAt,
  selectPlannerHomeSchedules,
  getHomeFlourStrengthInput,
  getHomePlanLegacyFermentationHours,
  FLOUR_PROFILES,
  generateDirectHomeCandidates,
  calculateDirectHomeCandidateExposure,
  calculateHomeFermentationStressSignal,
  calculateDirectHomeYeastRequirement,
  assessHomeYeastMeasurement,
  normalizeHomeFlourStrength,
  normalizeHomeDoughToleranceInput,
  validateHomeDoughToleranceInput,
  validateHomeDoughDomain,
  calculateHomeFlourCapability,
  calculateHomeHydrationLoad,
  calculateHomeDoughBaseResilience,
  assessHomeDoughBaseResilience,
  evaluateDirectHomeCandidate,
  selectDirectHomeCandidate,
  createDirectHomePizzaPlan,
  selectBeginnerDirectHomeStrategy,
  createBigaHomePizzaPlan,
  createPoolishHomePizzaPlan,
  PIZZA_STYLE_PROFILES,
  splitFlourBlend,
  doughCalc,
} = moduleRef.exports;
const roundedBlend = splitFlourBlend(531, 50);
assert.deepEqual([roundedBlend.first, roundedBlend.second], [266, 265]);
assert.equal(roundedBlend.first + roundedBlend.second, 531);
assert.throws(() => splitFlourBlend(Number.NaN, 50), (error) => error.name === 'RangeError');
assert.match(bigaUiSource, /splitFlourBlend\(dough\.main\.flour, blendPctA\)/);
assert.match(bigaUiSource, /blendFlourAmounts\.first/);
assert.match(bigaUiSource, /blendFlourAmounts\.second/);
assert.match(bigaUiSource, /const method: Method = isBeginner \? 'direct' : selectedMethod/);
assert.match(bigaUiSource, /ovenTemp, mixing,\s*preferredYeastType,/);
assert.match(bigaUiSource, /steps: phase\.steps\.map\(\(step\) => adaptDirectYeastStep\(step, lang, preferredYeastType\)\)/);
assert.match(bigaUiSource, /parsePreferredYeastType\(settings\.preferredYeastType\)/);
assert.match(bigaUiSource, /preferredYeastType,\s*\},\s*pizzas,/);
assert.match(bigaUiSource, /^\s+adaptDirectMixingSteps,/m);
assert.match(prefermentStepsSource, /export function adaptDirectMixingSteps\(/);
assert.match(bigaUiSource, /getYeastAwarePrefermentSteps\(lang, 'biga', mixingForExperience, preferredYeastType, isRomanTeglia, dough\.main\.oil > 0\)/);
assert.match(bigaUiSource, /getYeastAwarePrefermentSteps\(lang, 'poolish', mixingForExperience, preferredYeastType, isRomanTeglia, dough\.main\.oil > 0\)/);
assert.match(plannerUiSource, /plannerStepCopy\.yeastHandling\[preferredYeastType\]/);
assert.match(bigaUiSource, /const savedMixing = parseMixingSelection\(saved\.mixing\);[\s\S]*loadedIsBeginner && savedMixing === 'spiral' \? 'mixer' : savedMixing/);
assert.match(bigaUiSource, /isBeginner \? m\.k === 'direct'/);
assert.match(bigaUiSource, /setMixing\('hand'\)/);
assert.match(bigaUiSource, /setMixing\('mixer'\)/);
assert.match(bigaUiSource, /roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing,\s*preferredYeastType/);
assert.match(bigaUiSource, /const beginnerDirectHome = isBeginner && method === 'direct' && !!directHomeSchedule/);
assert.doesNotMatch(bigaUiSource, /isPremiumUnlocked|FREE_PIZZA_STYLE|FREE_FLOUR_TYPES|lock-closed|Pizzabook Premium|Otključaj Premium/);
assert.match(plannerUiSource, /\(\['neapolitan', 'romana', 'ny_style'\] as PizzaStyle\[\]\)\.map/);
assert.match(plannerUiSource, /\]\.filter\(\(m\) => isBeginner \? m\.key === 'direct' : true\)\.map/);
assert.match(bigaUiSource, /!isBeginner \? \(/);
assert.match(bigaUiSource, /isBeginner && index === 0 \? beginnerWaterInfo/);
assert.match(bigaUiSource, /if \(index === 3 && schedule\.fridgeHours > 0\)/);
assert.match(bigaUiSource, /const activePhases = schedule\.fridgeHours > 0\s*\?\s*phases\s*:\s*phases\.filter/);
assert.match(bigaUiSource, /buildBeginnerRoomOnlyFinalStart\(lang, false\)/);
assert.match(bigaUiSource, /const coldFinalStart = schedule\.fridgeHours > 0 \? buildBeginnerColdFinalStart\(schedule, lang, false\) : null/);
assert.match(bigaUiSource, /function getBeginnerFridgeOutAt\(schedule: HomePizzaPlanSchedule\)/);
assert.match(bigaUiSource, /const fridgeOutAt = getBeginnerFridgeOutAt\(schedule\);/);
assert.match(bigaUiSource, /const fridgeAt = directHomeSchedule\.fridgeAt;/);
assert.match(bigaUiSource, /fridgeAt && fridgeAt\.getTime\(\) > ballingAt\.getTime\(\)/);
assert.match(bigaUiSource, /at: fridgeAt/);
assert.match(source, /fridgeAt && fridgeAt\.getTime\(\) > ballingAt\.getTime\(\) && homeCopy\?\.fridgeIn/);
assert.match(bigaUiSource, /coldFinalStart!\.step/);
assert.match(bigaUiSource, /:\s*roomFinalStart!\.step/);
assert.match(bigaUiSource, /if \(fridgeHours > 0\)[\s\S]*isRomanTeglia/);
assert.match(bigaUiSource, /isBeginner && \/\^\(biga\|poolish\)\[-_\]\//);
assert.match(bigaUiSource, /formatTemperature\(dough\.waterTemp, temperatureUnit\)/);
assert.match(bigaUiSource, /mix by hand until no dry flour remains/);
assert.match(bigaUiSource, /mix on low speed until no dry flour remains/);
assert.match(plannerUiSource, /reversePlan\(bakeAt, method, effectiveStyle, plannerStepCopy, plannerDirectHomeSchedule, plannerBigaHomeSchedule, plannerPoolishHomeSchedule, lang, formatTemperature\(plannerDirectHomeSchedule\?\.ovenTemp/);
assert.match(plannerUiSource, /hasCurrentBeginnerDirectSchedule/);
assert.match(plannerUiSource, /isBeginner \? m\.key === 'direct'/);
assert.match(plannerUiSource, /const displayedBakeAt = bakeAt \?\? initial/);
assert.match(plannerUiSource, /webDateDraft\s*\?\? `\$\{displayedBakeAt\.getFullYear\(\)\}/);
assert.match(plannerUiSource, /webTimeDraft\s*\?\? `\$\{pad\(displayedBakeAt\.getHours\(\)\)\}/);
assert.match(plannerUiSource, /setSharedHomeBakeAt\(d\);\s*setWebDateDraft\(null\);\s*setWebTimeDraft\(null\)/);
assert.match(plannerUiSource, /isBeginner && bakeAt \? t\.planner\.beginnerScheduleUnavailable : t\.planner\.empty/);
assert.match(plannerUiSource, /cancelPlannerNotificationsForMethods\(\['biga', 'poolish'\]\)/);
assert.match(plannerUiSource, /scheduleLocal\(`🍕 \$\{s\.title\}`, s\.desc, Math\.round\(trigger \/ 1000\), \{\s*source: 'pizza-planner',\s*method,\s*planId: planKey,/);
assert.match(plannerUiSource, /cancelObsoletePlannerNotifications\(planKey \|\| null\)/);
const tegliaTranslationBlocks = [...translationsSource.matchAll(/directHomeTegliaCopy:\s*\{([\s\S]*?)\n\s*\},/g)].map((match) => match[1]);
assert.equal(tegliaTranslationBlocks.length, 4);
assert.equal([...translationsSource.matchAll(/beginnerScheduleUnavailable:/g)].length, 4);
for (const block of tegliaTranslationBlocks) {
  assert.doesNotMatch(block, /kuglice|kroglice|balls\b|Kugeln/i);
  assert.match(block, /one mass|eine Masse|ena masa|jednu masu/i);
}
assert.match(bigaUiSource, /const finalMixSteps = mixingForExperience === 'spiral'\s*\?\s*getSpiralMixingSteps\(lang, preferredYeastType, \{ method: 'biga', hasOil: dough\.main\.oil > 0 \}\)\s*:\s*mixingForExperience === 'mixer'/);
assert.match(bigaUiSource, /fit the dough hook, and start on speed 1/);
assert.match(bigaUiSource, /switch the mixer to speed 2/);
assert.match(bigaUiSource, /stop the mixer as soon as the dough absorbs it/);
assert.match(bigaUiSource, /copy\.finalMixStart, copy\.flourAndYeast, remainingWater, copy\.salt, copy\.oil/);
assert.match(bigaUiSource, /weight\(dough\.preferment\?\.yeast \?\? 0, true\)/);
assert.match(bigaUiSource, /weight\(dough\.main\.yeast, true\)/);
assert.match(bigaUiSource, /weight\(dims\.sauce\)/);
assert.match(bigaUiSource, /weight\(dims\.cheese\)/);
assert.match(bigaUiSource, /preheatMinutes = oven === 'homeStone' \? 60 : 20/);
const now = new Date('2026-09-25T12:00:00.000Z');
const hoursFromNow = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);

assert.equal(getSharedHomeBakeAt(), null);
let bakeAtNotifications = 0;
const unsubscribeBakeAt = subscribeSharedHomeBakeAt(() => { bakeAtNotifications += 1; });
const selectedBakeAt = new Date('2026-09-29T18:00:00.000Z');
setSharedHomeBakeAt(selectedBakeAt);
assert.equal(getSharedHomeBakeAt().getTime(), selectedBakeAt.getTime());
assert.equal(bakeAtNotifications, 1);
setSharedHomeBakeAt(null);
assert.equal(getSharedHomeBakeAt(), null);
assert.equal(bakeAtNotifications, 2);
unsubscribeBakeAt();

for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom']) {
  assert.equal(getHomeFlourStrengthInput(flour).source, 'unknown');
}
assert.equal(JSON.stringify(getHomeFlourStrengthInput('caputo00', { source: 'w', w: 280 })), JSON.stringify({ source: 'w', w: 280 }));
assert.equal(JSON.stringify(getHomeFlourStrengthInput('caputo00', { source: 'protein', proteinPct: 12.5 })), JSON.stringify({ source: 'protein', proteinPct: 12.5 }));
assert.equal(JSON.stringify(getHomeFlourStrengthInput('caputo00', { source: 'unknown' })), JSON.stringify({ source: 'unknown' }));
assert.equal(getHomeFlourStrengthInput('caputo00', { source: 'w', w: Number.NaN }).source, 'w');
const caputoProfileBefore = JSON.stringify(FLOUR_PROFILES.caputo00);
getHomeFlourStrengthInput('caputo00');
assert.equal(JSON.stringify(FLOUR_PROFILES.caputo00), caputoProfileBefore);

const planForBridge = {
  schedule: {
    startAt: now,
    bakeAt: hoursFromNow(24),
    prefermentHours: 0,
    roomBeforeFridgeHours: 6,
    fridgeHours: 12,
    roomAfterFridgeHours: 6,
  },
};
assert.equal(JSON.stringify(getHomePlanLegacyFermentationHours(planForBridge, 2, 24)), JSON.stringify({ roomHours: 12, fridgeHours: 12 }));
assert.equal(JSON.stringify(getHomePlanLegacyFermentationHours(null, 2, 24)), JSON.stringify({ roomHours: 2, fridgeHours: 24 }));

assert.equal(getAvailableFermentationHours(hoursFromNow(24), now), 24);
assert.equal(getAvailableFermentationHours(hoursFromNow(48), now), 48);
assert.equal(getAvailableFermentationHours(hoursFromNow(5.5), now), 5.5);

// Past and present bake times safely report no available fermentation time.
assert.equal(getAvailableFermentationHours(now, now), 0);
assert.equal(getAvailableFermentationHours(hoursFromNow(-1), now), 0);

assert.equal(getHomeFermentationWindow(-1), 'invalid');
assert.equal(getHomeFermentationWindow(0), 'invalid');
assert.equal(getHomeFermentationWindow(0.5), 'sameDay');
assert.equal(getHomeFermentationWindow(11.99), 'sameDay');
assert.equal(getHomeFermentationWindow(12), 'overnight');
assert.equal(getHomeFermentationWindow(24), 'overnight');
assert.equal(getHomeFermentationWindow(35.99), 'overnight');
assert.equal(getHomeFermentationWindow(36), 'long');
assert.equal(getHomeFermentationWindow(72), 'long');

const schedule = (startAt, duration, phases) => ({
  startAt,
  bakeAt: new Date(startAt.getTime() + duration * 60 * 60 * 1000),
  ...phases,
});

const direct = schedule(now, 24, {
  prefermentHours: 0,
  roomBeforeFridgeHours: 2,
  fridgeHours: 20,
  roomAfterFridgeHours: 2,
});
assert.equal(getHomeScheduleDurationHours(direct), 24);
assert.equal(isHomeScheduleDurationValid(direct), true);

const directMismatch = { ...direct, bakeAt: hoursFromNow(24) };
directMismatch.fridgeHours = 19;
assert.equal(getHomeScheduleDurationHours(directMismatch), 23);
assert.equal(isHomeScheduleDurationValid(directMismatch), false);

const prefermentSchedule = schedule(now, 48, {
  prefermentHours: 18,
  roomBeforeFridgeHours: 1,
  fridgeHours: 24,
  roomAfterFridgeHours: 5,
});
assert.equal(getHomeScheduleDurationHours(prefermentSchedule), 48);
assert.equal(isHomeScheduleDurationValid(prefermentSchedule), true);

const decimalSchedule = schedule(now, 24.5, {
  prefermentHours: 0,
  roomBeforeFridgeHours: 1.5,
  fridgeHours: 20,
  roomAfterFridgeHours: 3,
});
assert.equal(getHomeScheduleDurationHours(decimalSchedule), 24.5);
assert.equal(isHomeScheduleDurationValid(decimalSchedule), true);

const negativePhaseSchedule = schedule(now, 5, {
  prefermentHours: -2,
  roomBeforeFridgeHours: 2,
  fridgeHours: 4,
  roomAfterFridgeHours: 1,
});
assert.equal(getHomeScheduleDurationHours(negativePhaseSchedule), 7);
assert.equal(isHomeScheduleDurationValid(negativePhaseSchedule), false);

const candidates24 = generateDirectHomeCandidates(24);
assert.equal(candidates24.length, 4);
const expected24 = [
  ['roomOnly', 24, 0, 0],
  ['hybrid', 7, 14, 3],
  ['coldDominant', 3.5, 17.5, 3],
  ['extraCold', 21 / 9, 21 * 8 / 9, 3],
];
candidates24.forEach(({ strategy, roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours }, index) => {
  const [expectedStrategy, expectedBefore, expectedFridge, expectedAfter] = expected24[index];
  assert.equal(strategy, expectedStrategy);
  assert.ok(Math.abs(roomBeforeFridgeHours - expectedBefore) <= 1e-6);
  assert.ok(Math.abs(fridgeHours - expectedFridge) <= 1e-6);
  assert.ok(Math.abs(roomAfterFridgeHours - expectedAfter) <= 1e-6);
});
assert.ok(candidates24.every(({ status, warnings }) => status === 'acceptable' && warnings.length === 0));

const candidates25 = generateDirectHomeCandidates(25);
assert.equal(candidates25.length, 4);
assert.ok(candidates25.every(({ roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours }) => (
  roomBeforeFridgeHours >= 0
  && fridgeHours >= 0
  && roomAfterFridgeHours >= 0
  && Math.abs(roomBeforeFridgeHours + fridgeHours + roomAfterFridgeHours - 25) <= 1e-6
)));
for (const hours of [24, 48, 72]) {
  const candidates = generateDirectHomeCandidates(hours);
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0].roomBeforeFridgeHours, hours);
  assert.equal(candidates[0].fridgeHours, 0);
  assert.equal(candidates[0].roomAfterFridgeHours, 0);
  assert.ok(candidates.slice(1).every(({ roomAfterFridgeHours }) => Math.abs(roomAfterFridgeHours - 3) <= 1e-6));
  const uniqueSchedules = new Set(candidates.map(({ roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours }) => (
    [roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours].map((value) => value.toFixed(8)).join('/')
  )));
  assert.equal(uniqueSchedules.size, 4);
}
const shortCandidates = generateDirectHomeCandidates(2);
assert.ok(shortCandidates.every(({ roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours }) => (
  roomBeforeFridgeHours >= 0 && fridgeHours >= 0 && roomAfterFridgeHours >= 0
  && Math.abs(roomBeforeFridgeHours + fridgeHours + roomAfterFridgeHours - 2) <= 1e-6
)));

assert.equal(generateDirectHomeCandidates(0).length, 0);
assert.equal(generateDirectHomeCandidates(-5).length, 0);

const roomOnly24 = candidates24[0];
const roomOnlyExposure = calculateDirectHomeCandidateExposure(roomOnly24, 20, 4);
assert.deepEqual({
  roomBeforeExposure: roomOnlyExposure.roomBeforeExposure,
  roomAfterExposure: roomOnlyExposure.roomAfterExposure,
  fridgeExposure: roomOnlyExposure.fridgeExposure,
  roomExposure: roomOnlyExposure.roomExposure,
  totalExposure: roomOnlyExposure.totalExposure,
}, {
  roomBeforeExposure: 24,
  roomAfterExposure: 0,
  fridgeExposure: 0,
  roomExposure: 24,
  totalExposure: 24,
});

const hybridH2 = {
  ...candidates24[2],
  roomBeforeFridgeHours: 6,
  fridgeHours: 12,
  roomAfterFridgeHours: 6,
};
const hybridH2Exposure = calculateDirectHomeCandidateExposure(hybridH2, 20, 4);
assert.ok(Math.abs(hybridH2Exposure.roomBeforeExposure - 6) <= 1e-6);
assert.ok(Math.abs(hybridH2Exposure.roomAfterExposure - 6) <= 1e-6);
assert.ok(Math.abs(hybridH2Exposure.fridgeExposure - 1.44) <= 1e-6);
assert.ok(Math.abs(hybridH2Exposure.roomExposure - 12) <= 1e-6);
assert.ok(Math.abs(hybridH2Exposure.totalExposure - 13.44) <= 1e-6);

const warmHybridExposure = calculateDirectHomeCandidateExposure(hybridH2, 26, 8);
assert.ok(Math.abs(warmHybridExposure.roomBeforeExposure - 8.88) <= 1e-6);
assert.ok(Math.abs(warmHybridExposure.roomAfterExposure - 8.88) <= 1e-6);
assert.ok(Math.abs(warmHybridExposure.fridgeExposure - 1.728) <= 1e-6);
assert.ok(Math.abs(warmHybridExposure.roomExposure - 17.76) <= 1e-6);
assert.ok(Math.abs(warmHybridExposure.totalExposure - 19.488) <= 1e-6);

const beforeHeavy = { ...hybridH2, roomBeforeFridgeHours: 9, roomAfterFridgeHours: 3 };
const afterHeavy = { ...hybridH2, roomBeforeFridgeHours: 3, roomAfterFridgeHours: 9 };
const beforeExposure = calculateDirectHomeCandidateExposure(beforeHeavy, 22, 5);
const afterExposure = calculateDirectHomeCandidateExposure(afterHeavy, 22, 5);
assert.ok(Math.abs(beforeExposure.totalExposure - afterExposure.totalExposure) <= 1e-6);

const negativePhaseCandidate = { ...hybridH2, roomBeforeFridgeHours: -3 };
const negativePhaseExposure = calculateDirectHomeCandidateExposure(negativePhaseCandidate, 20, 4);
assert.equal(negativePhaseExposure.roomBeforeExposure, 0);
assert.equal(negativePhaseCandidate.roomBeforeFridgeHours, -3);

const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-6);
const stressInput = (before, cold, after, roomTemp, fridgeTemp) => ({
  flour: { source: 'w', w: 280, confidence: 'high' },
  hydrationPct: 65,
  roomTemp,
  fridgeTemp,
  roomBeforeFridgeHours: before,
  fridgeHours: cold,
  roomAfterFridgeHours: after,
});
const zeroStress = calculateHomeFermentationStressSignal(stressInput(0, 0, 0, 20, 4));
assert.deepEqual({ ...zeroStress }, { warmBefore: 0, cold: 0, warmAfter: 0, total: 0 });

const balancedStress = calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 4));
assertClose(balancedStress.warmBefore, 6);
assertClose(balancedStress.cold, 1.44);
assertClose(balancedStress.warmAfter, 6);
assertClose(balancedStress.total, 13.44);

const warmStress = calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 26, 8));
assertClose(warmStress.warmBefore, 8.88);
assertClose(warmStress.cold, 1.728);
assertClose(warmStress.warmAfter, 8.88);
assertClose(warmStress.total, 19.488);

const beforeWeightedStress = calculateHomeFermentationStressSignal(stressInput(9, 12, 3, 20, 4));
const afterWeightedStress = calculateHomeFermentationStressSignal(stressInput(3, 12, 9, 20, 4));
assertClose(beforeWeightedStress.total, afterWeightedStress.total);
assert.notEqual(beforeWeightedStress.warmBefore, afterWeightedStress.warmBefore);
assert.notEqual(beforeWeightedStress.warmAfter, afterWeightedStress.warmAfter);

const negativeStress = calculateHomeFermentationStressSignal(stressInput(-2, -12, -3, 20, 4));
assert.deepEqual({ ...negativeStress }, { warmBefore: 0, cold: 0, warmAfter: 0, total: 0 });

assert.ok(calculateHomeFermentationStressSignal(stressInput(8, 12, 6, 20, 4)).warmBefore
  >= calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 4)).warmBefore);
assert.ok(calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 26, 4)).warmBefore
  >= calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 4)).warmBefore);
assert.ok(calculateHomeFermentationStressSignal(stressInput(6, 14, 6, 20, 4)).cold
  >= calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 4)).cold);
assert.ok(calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 8)).cold
  >= calculateHomeFermentationStressSignal(stressInput(6, 12, 6, 20, 4)).cold);

const requirement24 = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure: 24 });
assertClose(requirement24.freshYeastPct, 0.5 / 24);
assertClose(requirement24.activeDryYeastPct, (0.5 / 24) * 0.4);
assertClose(requirement24.dryYeastPct, (0.5 / 24) / 3);
assertClose(requirement24.freshYeastGramsPer1000gFlour, (0.5 / 24) * 10);
assertClose(requirement24.activeDryYeastGramsPer1000gFlour, ((0.5 / 24) * 0.4) * 10);
assertClose(requirement24.dryYeastGramsPer1000gFlour, ((0.5 / 24) / 3) * 10);

const requirementH2 = calculateDirectHomeYeastRequirement(hybridH2Exposure);
assertClose(requirementH2.freshYeastPct, 0.5 / 13.44);
assertClose(requirementH2.activeDryYeastPct, (0.5 / 13.44) * 0.4);
assertClose(requirementH2.dryYeastPct, (0.5 / 13.44) / 3);
assertClose(requirementH2.freshYeastGramsPer1000gFlour, (0.5 / 13.44) * 10);
assertClose(requirementH2.activeDryYeastGramsPer1000gFlour, ((0.5 / 13.44) * 0.4) * 10);
assertClose(requirementH2.dryYeastGramsPer1000gFlour, ((0.5 / 13.44) / 3) * 10);

const requirementWarmH2 = calculateDirectHomeYeastRequirement(warmHybridExposure);
assertClose(requirementWarmH2.freshYeastPct, 0.5 / 19.488);
assertClose(requirementWarmH2.activeDryYeastPct, (0.5 / 19.488) * 0.4);
assertClose(requirementWarmH2.dryYeastPct, (0.5 / 19.488) / 3);
assertClose(requirementWarmH2.freshYeastGramsPer1000gFlour, (0.5 / 19.488) * 10);
assertClose(requirementWarmH2.activeDryYeastGramsPer1000gFlour, ((0.5 / 19.488) * 0.4) * 10);
assertClose(requirementWarmH2.dryYeastGramsPer1000gFlour, ((0.5 / 19.488) / 3) * 10);

for (const totalExposure of [0, -5]) {
  const requirement = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure });
  assertClose(requirement.freshYeastPct, 1);
  assertClose(requirement.activeDryYeastPct, 0.4);
  assertClose(requirement.dryYeastPct, 1 / 3);
  assertClose(requirement.freshYeastGramsPer1000gFlour, 10);
  assertClose(requirement.activeDryYeastGramsPer1000gFlour, 4);
  assertClose(requirement.dryYeastGramsPer1000gFlour, 10 / 3);
}

const requirement10 = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure: 10 });
const requirement20 = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure: 20 });
const requirement40 = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure: 40 });
assert.ok(requirement10.freshYeastPct > requirement20.freshYeastPct);
assert.ok(requirement20.freshYeastPct > requirement40.freshYeastPct);
assert.ok(requirement10.dryYeastPct > requirement20.dryYeastPct);
assert.ok(requirement20.dryYeastPct > requirement40.dryYeastPct);

const measurementBoundaries = [
  [0.2, 'easy'],
  [0.1, 'easy'],
  [0.099, 'precisionScale'],
  [0.05, 'precisionScale'],
  [0.049, 'dilutionRecommended'],
  [0.03, 'dilutionRecommended'],
  [0, 'dilutionRecommended'],
];
for (const [grams, status] of measurementBoundaries) {
  const assessment = assessHomeYeastMeasurement(grams);
  assert.equal(assessment.grams, grams);
  assert.equal(assessment.status, status);
}
const negativeMeasurement = assessHomeYeastMeasurement(-1);
assert.equal(negativeMeasurement.grams, 0);
assert.equal(negativeMeasurement.status, 'dilutionRecommended');

const fresh24Assessment = assessHomeYeastMeasurement(requirement24.freshYeastGramsPer1000gFlour);
const dry24Assessment = assessHomeYeastMeasurement(requirement24.dryYeastGramsPer1000gFlour);
assert.equal(fresh24Assessment.status, 'easy');
assert.equal(dry24Assessment.status, 'precisionScale');

const requirement72 = calculateDirectHomeYeastRequirement({ ...roomOnlyExposure, totalExposure: 72 });
assertClose(requirement72.freshYeastGramsPer1000gFlour, (0.5 / 72) * 10);
assertClose(requirement72.dryYeastGramsPer1000gFlour, ((0.5 / 72) / 3) * 10);
assert.equal(assessHomeYeastMeasurement(requirement72.freshYeastGramsPer1000gFlour).status, 'precisionScale');
assert.equal(assessHomeYeastMeasurement(requirement72.dryYeastGramsPer1000gFlour).status, 'dilutionRecommended');

const assertNormalized = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

assertNormalized(normalizeHomeFlourStrength({ source: 'w', w: 270 }), {
  source: 'w',
  w: 270,
  confidence: 'high',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'w', w: 320, proteinPct: 13 }), {
  source: 'w',
  w: 320,
  confidence: 'high',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'w', proteinPct: 12.5 }), {
  source: 'protein',
  proteinPct: 12.5,
  confidence: 'medium',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'w', w: 0, proteinPct: 12.5 }), {
  source: 'protein',
  proteinPct: 12.5,
  confidence: 'medium',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'w', w: Number.NaN, proteinPct: 12.5 }), {
  source: 'protein',
  proteinPct: 12.5,
  confidence: 'medium',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'w', w: Number.POSITIVE_INFINITY, proteinPct: 12.5 }), {
  source: 'protein',
  proteinPct: 12.5,
  confidence: 'medium',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'protein', proteinPct: 11.5 }), {
  source: 'protein',
  proteinPct: 11.5,
  confidence: 'medium',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'protein', proteinPct: 0 }), {
  source: 'unknown',
  confidence: 'low',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'protein', proteinPct: -5 }), {
  source: 'unknown',
  confidence: 'low',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'unknown' }), {
  source: 'unknown',
  confidence: 'low',
});
assertNormalized(normalizeHomeFlourStrength({ source: 'unknown', w: 300, proteinPct: 13 }), {
  source: 'unknown',
  confidence: 'low',
});

const normalizationInput = { source: 'w', w: 320, proteinPct: 13 };
const normalizationInputBefore = { ...normalizationInput };
normalizeHomeFlourStrength(normalizationInput);
assert.deepEqual(normalizationInput, normalizationInputBefore);

const normalToleranceInput = {
  flour: { source: 'w', w: 280 },
  hydrationPct: 65,
  roomTemp: 22,
  fridgeTemp: 4,
  roomBeforeFridgeHours: 2,
  fridgeHours: 44,
  roomAfterFridgeHours: 2,
};
const normalizedToleranceInput = normalizeHomeDoughToleranceInput(normalToleranceInput);
assert.equal(normalizedToleranceInput.flour.source, 'w');
assert.equal(normalizedToleranceInput.flour.w, 280);
assert.equal(normalizedToleranceInput.flour.confidence, 'high');
assert.equal(normalizedToleranceInput.hydrationPct, 65);
assert.equal(normalizedToleranceInput.roomTemp, 22);
assert.equal(normalizedToleranceInput.fridgeTemp, 4);
assert.equal(normalizedToleranceInput.roomBeforeFridgeHours, 2);
assert.equal(normalizedToleranceInput.fridgeHours, 44);
assert.equal(normalizedToleranceInput.roomAfterFridgeHours, 2);
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(normalizedToleranceInput)), JSON.stringify({ valid: true, issues: [] }));

const proteinToleranceInput = {
  ...normalToleranceInput,
  flour: { source: 'w', proteinPct: 12.5 },
};
const normalizedProteinInput = normalizeHomeDoughToleranceInput(proteinToleranceInput);
assert.equal(normalizedProteinInput.flour.source, 'protein');
assert.equal(normalizedProteinInput.flour.proteinPct, 12.5);
assert.equal(normalizedProteinInput.flour.confidence, 'medium');
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(normalizedProteinInput)), JSON.stringify({ valid: true, issues: [] }));

const unknownFlourInput = { ...normalizedToleranceInput, flour: { source: 'unknown', confidence: 'low' } };
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(unknownFlourInput)), JSON.stringify({
  valid: false,
  issues: ['missingFlourStrength'],
}));

const missingHydrationInput = { ...normalizedToleranceInput, hydrationPct: 0 };
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(missingHydrationInput)), JSON.stringify({
  valid: false,
  issues: ['missingHydration'],
}));

const missingFermentationInput = {
  ...normalizedToleranceInput,
  roomBeforeFridgeHours: 0,
  fridgeHours: 0,
  roomAfterFridgeHours: 0,
};
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(missingFermentationInput)), JSON.stringify({
  valid: false,
  issues: ['missingFermentationTime'],
}));

const multipleIssuesInput = {
  ...missingFermentationInput,
  flour: { source: 'unknown', confidence: 'low' },
  hydrationPct: 0,
};
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(multipleIssuesInput)), JSON.stringify({
  valid: false,
  issues: ['missingFlourStrength', 'missingHydration', 'missingFermentationTime'],
}));

const extremeInput = {
  ...normalizedToleranceInput,
  flour: { source: 'w', w: 900, confidence: 'high' },
  hydrationPct: 150,
  roomTemp: -10,
  fridgeTemp: 40,
};
assert.equal(JSON.stringify(validateHomeDoughToleranceInput(extremeInput)), JSON.stringify({ valid: true, issues: [] }));

const invalidPhasesInput = {
  ...normalToleranceInput,
  roomBeforeFridgeHours: -2,
  fridgeHours: Number.NaN,
  roomAfterFridgeHours: Number.POSITIVE_INFINITY,
};
const normalizedInvalidPhases = normalizeHomeDoughToleranceInput(invalidPhasesInput);
assert.equal(normalizedInvalidPhases.roomBeforeFridgeHours, 0);
assert.equal(normalizedInvalidPhases.fridgeHours, 0);
assert.equal(normalizedInvalidPhases.roomAfterFridgeHours, 0);

const temperatureInput = {
  ...normalToleranceInput,
  roomTemp: -2,
  fridgeTemp: 0,
};
const normalizedTemperatures = normalizeHomeDoughToleranceInput(temperatureInput);
assert.equal(normalizedTemperatures.roomTemp, -2);
assert.equal(normalizedTemperatures.fridgeTemp, 0);
const invalidTemperatureInput = { ...normalToleranceInput, roomTemp: Number.NaN, fridgeTemp: Number.POSITIVE_INFINITY };
const normalizedInvalidTemperatures = normalizeHomeDoughToleranceInput(invalidTemperatureInput);
assert.equal(normalizedInvalidTemperatures.roomTemp, 0);
assert.equal(normalizedInvalidTemperatures.fridgeTemp, 0);

const hydrationInput = { ...normalToleranceInput, hydrationPct: 72.5 };
assert.equal(normalizeHomeDoughToleranceInput(hydrationInput).hydrationPct, 72.5);
for (const hydrationPct of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.equal(normalizeHomeDoughToleranceInput({ ...normalToleranceInput, hydrationPct }).hydrationPct, 0);
}

const nestedInputBefore = JSON.stringify(normalToleranceInput);
normalizeHomeDoughToleranceInput(normalToleranceInput);
assert.equal(JSON.stringify(normalToleranceInput), nestedInputBefore);
assert.equal(normalToleranceInput.flour.w, 280);

const validationInput = normalizeHomeDoughToleranceInput(normalToleranceInput);
const validationInputBefore = JSON.stringify(validationInput);
const validationFlourBefore = JSON.stringify(validationInput.flour);
validateHomeDoughToleranceInput(validationInput);
assert.equal(JSON.stringify(validationInput), validationInputBefore);
assert.equal(JSON.stringify(validationInput.flour), validationFlourBefore);

const domainInput = {
  flour: { source: 'w', w: 280, confidence: 'high' },
  hydrationPct: 65,
  roomTemp: 22,
  fridgeTemp: 4,
  roomBeforeFridgeHours: 2,
  fridgeHours: 44,
  roomAfterFridgeHours: 2,
};
const assertDomain = (input, expected) => assert.equal(JSON.stringify(validateHomeDoughDomain(input)), JSON.stringify(expected));
const assertDomainContains = (input, issue, status) => {
  const result = validateHomeDoughDomain(input);
  assert.equal(result.status, status);
  assert.ok(result.issues.includes(issue));
};
assertDomain(domainInput, { status: 'supported', issues: [] });

const boundaryCases = [
  ['w', 'w', 159.99, 'flourStrengthUnsupported'],
  ['w', 'w', 160, 'flourStrengthUnusual'],
  ['w', 'w', 219.99, 'flourStrengthUnusual'],
  ['w', 'w', 220, null],
  ['w', 'w', 380, null],
  ['w', 'w', 380.01, 'flourStrengthUnusual'],
  ['w', 'w', 450, 'flourStrengthUnusual'],
  ['w', 'w', 450.01, 'flourStrengthUnsupported'],
  ['protein', 'protein', 9.99, 'proteinUnsupported'],
  ['protein', 'protein', 10, 'proteinUnusual'],
  ['protein', 'protein', 11.49, 'proteinUnusual'],
  ['protein', 'protein', 11.5, null],
  ['protein', 'protein', 14.5, null],
  ['protein', 'protein', 14.51, 'proteinUnusual'],
  ['protein', 'protein', 16, 'proteinUnusual'],
  ['protein', 'protein', 16.01, 'proteinUnsupported'],
];
for (const [, source, value, issue] of boundaryCases) {
  const flour = source === 'w'
    ? { source, w: value, confidence: 'high' }
    : { source, proteinPct: value, confidence: 'medium' };
  const input = { ...domainInput, flour };
  assertDomain(input, issue ? { status: issue.endsWith('Unsupported') ? 'unsupported' : 'unusual', issues: [issue] } : { status: 'supported', issues: [] });
}

const scalarBoundaryCases = [
  ['hydrationPct', 39.99, 'hydrationUnsupported'], ['hydrationPct', 40, 'hydrationUnusual'],
  ['hydrationPct', 49.99, 'hydrationUnusual'], ['hydrationPct', 50, null],
  ['hydrationPct', 80, null], ['hydrationPct', 80.01, 'hydrationUnusual'],
  ['hydrationPct', 85, 'hydrationUnusual'], ['hydrationPct', 85.01, 'hydrationUnsupported'],
  ['roomTemp', 9.99, 'roomTemperatureUnsupported'], ['roomTemp', 10, 'roomTemperatureUnusual'],
  ['roomTemp', 14.99, 'roomTemperatureUnusual'], ['roomTemp', 15, null],
  ['roomTemp', 28, null], ['roomTemp', 28.01, 'roomTemperatureUnusual'],
  ['roomTemp', 35, 'roomTemperatureUnusual'], ['roomTemp', 35.01, 'roomTemperatureUnsupported'],
  ['fridgeTemp', -0.01, 'fridgeTemperatureUnsupported'], ['fridgeTemp', 0, 'fridgeTemperatureUnusual'],
  ['fridgeTemp', 1.99, 'fridgeTemperatureUnusual'], ['fridgeTemp', 2, null],
  ['fridgeTemp', 8, null], ['fridgeTemp', 8.01, 'fridgeTemperatureUnusual'],
  ['fridgeTemp', 10, 'fridgeTemperatureUnusual'], ['fridgeTemp', 10.01, 'fridgeTemperatureUnsupported'],
];
for (const [field, value, issue] of scalarBoundaryCases) {
  const input = { ...domainInput, [field]: value };
  assertDomain(input, issue ? { status: issue.endsWith('Unsupported') ? 'unsupported' : 'unusual', issues: [issue] } : { status: 'supported', issues: [] });
}

const durationBoundaryCases = [
  [0.99, 'totalDurationUnsupported'], [1, 'totalDurationUnusual'], [1.99, 'totalDurationUnusual'],
  [2, null], [96, null], [96.01, 'totalDurationUnusual'], [120, 'totalDurationUnusual'], [120.01, 'totalDurationUnsupported'],
];
for (const [hours, issue] of durationBoundaryCases) {
  const roomBeforeFridgeHours = hours >= 2 ? 2 : 0;
  const input = { ...domainInput, roomBeforeFridgeHours, fridgeHours: hours - roomBeforeFridgeHours, roomAfterFridgeHours: 0 };
  const result = validateHomeDoughDomain(input);
  if (issue) {
    assert.equal(result.status, issue.endsWith('Unsupported') ? 'unsupported' : 'unusual');
    assert.ok(result.issues.includes(issue));
  } else {
    assert.ok(!result.issues.includes('totalDurationUnusual'));
    assert.ok(!result.issues.includes('totalDurationUnsupported'));
  }
}

const roomPhaseBoundaryCases = [
  [0, null], [8, null], [8.01, 'roomPhaseUnusual'], [24, 'roomPhaseUnusual'], [24.01, 'roomPhaseUnsupported'],
];
for (const [hours, issue] of roomPhaseBoundaryCases) {
  const input = { ...domainInput, roomBeforeFridgeHours: hours, fridgeHours: 44, roomAfterFridgeHours: 0 };
  assertDomain(input, issue ? { status: issue.endsWith('Unsupported') ? 'unsupported' : 'unusual', issues: [issue] } : { status: 'supported', issues: [] });
}
assertDomain({ ...domainInput, roomBeforeFridgeHours: 6, roomAfterFridgeHours: 6 }, { status: 'supported', issues: [] });
assertDomain({ ...domainInput, roomBeforeFridgeHours: 10, roomAfterFridgeHours: 12 }, { status: 'unusual', issues: ['roomPhaseUnusual'] });

const coldPhaseBoundaryCases = [
  [0, null], [72, null], [72.01, 'coldPhaseUnusual'], [120, 'coldPhaseUnusual'], [120.01, 'coldPhaseUnsupported'],
];
for (const [hours, issue] of coldPhaseBoundaryCases) {
  const input = { ...domainInput, roomBeforeFridgeHours: 2, fridgeHours: hours, roomAfterFridgeHours: 2 };
  if (issue) {
    const expectedStatus = hours >= 120 ? 'unsupported' : 'unusual';
    assertDomainContains(input, issue, expectedStatus);
  }
  else assertDomain(input, { status: 'supported', issues: [] });
}

assertDomain({ ...domainInput, flour: { source: 'w', w: 200, confidence: 'high' }, hydrationPct: 82, roomTemp: 30 }, {
  status: 'unusual',
  issues: ['flourStrengthUnusual', 'hydrationUnusual', 'roomTemperatureUnusual'],
});
assertDomain({ ...domainInput, flour: { source: 'w', w: 200, confidence: 'high' }, hydrationPct: 90, roomTemp: 30 }, {
  status: 'unsupported',
  issues: ['flourStrengthUnusual', 'hydrationUnsupported', 'roomTemperatureUnusual'],
});
assertDomain({ ...domainInput, flour: { source: 'unknown', confidence: 'low' } }, { status: 'supported', issues: [] });

const domainInputBefore = JSON.stringify(domainInput);
const domainFlourBefore = JSON.stringify(domainInput.flour);
validateHomeDoughDomain(domainInput);
assert.equal(JSON.stringify(domainInput), domainInputBefore);
assert.equal(JSON.stringify(domainInput.flour), domainFlourBefore);

const capabilityFromW = (w) => calculateHomeFlourCapability({ source: 'w', w, confidence: 'high' });
assert.equal(capabilityFromW(219.99), 'low');
assert.equal(capabilityFromW(220), 'medium');
assert.equal(capabilityFromW(359.99), 'medium');
assert.equal(capabilityFromW(360), 'high');

const capabilityFromProtein = (proteinPct) => calculateHomeFlourCapability({ source: 'protein', proteinPct, confidence: 'medium' });
assert.equal(capabilityFromProtein(10), 'low');
assert.equal(capabilityFromProtein(11.49), 'low');
assert.equal(capabilityFromProtein(11.5), 'medium');
assert.equal(capabilityFromProtein(16), 'medium');
assert.equal(calculateHomeFlourCapability({ source: 'unknown', confidence: 'low' }), null);
assert.equal(capabilityFromW(900), null);

const hydrationBoundaryCases = [
  ['low', 55, 'low'], ['low', 55.01, 'medium'], ['low', 65, 'medium'], ['low', 65.01, 'high'],
  ['medium', 65, 'low'], ['medium', 65.01, 'medium'], ['medium', 75, 'medium'], ['medium', 75.01, 'high'],
  ['high', 70, 'low'], ['high', 70.01, 'medium'], ['high', 80, 'medium'], ['high', 80.01, 'high'],
];
for (const [capability, hydrationPct, expectedLoad] of hydrationBoundaryCases) {
  assert.equal(calculateHomeHydrationLoad(capability, hydrationPct), expectedLoad);
}
assert.equal(calculateHomeHydrationLoad('medium', 39.99), null);
assert.equal(calculateHomeHydrationLoad('medium', 85.01), null);

const expectedResilience = [
  ['low', 'low', 'medium'], ['low', 'medium', 'low'], ['low', 'high', 'low'],
  ['medium', 'low', 'high'], ['medium', 'medium', 'medium'], ['medium', 'high', 'low'],
  ['high', 'low', 'high'], ['high', 'medium', 'high'], ['high', 'high', 'medium'],
];
for (const [capability, load, resilience] of expectedResilience) {
  assert.equal(calculateHomeDoughBaseResilience(capability, load), resilience);
}

const capabilityRank = { low: 0, medium: 1, high: 2 };
let previousCapability = -1;
for (const w of [160, 219.99, 220, 359.99, 360, 450]) {
  const capability = capabilityFromW(w);
  assert.ok(capabilityRank[capability] >= previousCapability);
  previousCapability = capabilityRank[capability];
}

const loadRank = { low: 0, medium: 1, high: 2 };
for (const capability of ['low', 'medium', 'high']) {
  let previousLoad = -1;
  for (const hydrationPct of [40, 55, 55.01, 65, 65.01, 70, 70.01, 75, 75.01, 80, 80.01, 85]) {
    const load = calculateHomeHydrationLoad(capability, hydrationPct);
    assert.ok(loadRank[load] >= previousLoad);
    previousLoad = loadRank[load];
  }
}

const resilienceRank = { low: 0, medium: 1, high: 2 };
for (const load of ['low', 'medium', 'high']) {
  let previousResilience = -1;
  for (const capability of ['low', 'medium', 'high']) {
    const resilience = calculateHomeDoughBaseResilience(capability, load);
    assert.ok(resilienceRank[resilience] >= previousResilience);
    previousResilience = resilienceRank[resilience];
  }
}
for (const capability of ['low', 'medium', 'high']) {
  let previousResilience = Infinity;
  for (const load of ['low', 'medium', 'high']) {
    const resilience = calculateHomeDoughBaseResilience(capability, load);
    assert.ok(resilienceRank[resilience] <= previousResilience);
    previousResilience = resilienceRank[resilience];
  }
}

const baseAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'w', w: 280, confidence: 'high' },
  hydrationPct: 65,
});
assert.equal(JSON.stringify(baseAssessment), JSON.stringify({
  flourCapability: 'medium', hydrationLoad: 'low', resilience: 'high', confidence: 'medium',
}));
const proteinBaseAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'protein', proteinPct: 12.5, confidence: 'medium' },
  hydrationPct: 65,
});
assert.equal(JSON.stringify(proteinBaseAssessment), JSON.stringify({
  flourCapability: 'medium', hydrationLoad: 'low', resilience: 'high', confidence: 'low',
}));
const unknownBaseAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'unknown', confidence: 'low' },
});
assert.equal(JSON.stringify(unknownBaseAssessment), JSON.stringify({
  flourCapability: null, hydrationLoad: null, resilience: null, confidence: 'low',
}));
const conservativeUnknownAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'unknown', confidence: 'low' },
}, true);
assert.equal(conservativeUnknownAssessment.flourCapability, 'low');
assert.equal(conservativeUnknownAssessment.resilience, 'low');
const invalidWBaseAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'w', w: 900, confidence: 'high' },
});
assert.equal(invalidWBaseAssessment.flourCapability, null);
assert.equal(invalidWBaseAssessment.hydrationLoad, null);
assert.equal(invalidWBaseAssessment.resilience, null);
const invalidHydrationBaseAssessment = assessHomeDoughBaseResilience({
  ...normalizedToleranceInput,
  flour: { source: 'w', w: 280, confidence: 'high' },
  hydrationPct: 150,
});
assert.equal(invalidHydrationBaseAssessment.flourCapability, 'medium');
assert.equal(invalidHydrationBaseAssessment.hydrationLoad, null);
assert.equal(invalidHydrationBaseAssessment.resilience, null);

const evaluateCandidate = (candidate, input = normalToleranceInput, yeastType = 'fresh', conservativeUnknownFlour = false) => (
  evaluateDirectHomeCandidate(candidate, input, yeastType, conservativeUnknownFlour)
);
const evaluations24 = candidates24.map((candidate) => evaluateCandidate(candidate));
assert.equal(evaluations24.length, 4);
assert.ok(evaluations24.every((evaluation) => evaluation.selectable));

const candidateForMutationCheck = { ...candidates24[1], warnings: ['keep'] };
const candidateBeforeEvaluation = JSON.stringify(candidateForMutationCheck);
evaluateCandidate(candidateForMutationCheck);
assert.equal(JSON.stringify(candidateForMutationCheck), candidateBeforeEvaluation);

const unsupportedEvaluation = evaluateCandidate(candidates24[2], {
  ...normalToleranceInput,
  flour: { source: 'w', w: 500 },
});
assert.equal(unsupportedEvaluation.domain.status, 'unsupported');
assert.equal(unsupportedEvaluation.selectable, false);

const nullResilienceEvaluation = evaluateCandidate(candidates24[2], {
  ...normalToleranceInput,
  flour: { source: 'unknown' },
});
assert.equal(nullResilienceEvaluation.domain.status, 'supported');
assert.equal(nullResilienceEvaluation.baseResilience.resilience, null);
assert.equal(nullResilienceEvaluation.selectable, false);
const conservativeUnknownEvaluation = evaluateCandidate(candidates24[2], {
  ...normalToleranceInput,
  flour: { source: 'unknown' },
}, 'fresh', true);
assert.equal(conservativeUnknownEvaluation.baseResilience.resilience, 'low');
assert.equal(conservativeUnknownEvaluation.selectable, true);

const unusualEvaluation = evaluateCandidate(candidates24[2], {
  ...normalToleranceInput,
  hydrationPct: 82,
});
assert.equal(unusualEvaluation.domain.status, 'unusual');
assert.equal(unusualEvaluation.selectable, true);

const roomOnlyCandidate = candidates24[0];
const easyDoseCandidate = { ...candidates24[2], roomBeforeFridgeHours: 2, fridgeHours: 20, roomAfterFridgeHours: 2 };
const precisionDoseCandidate = { ...candidates24[2], roomBeforeFridgeHours: 8, fridgeHours: 8, roomAfterFridgeHours: 8 };
const easyYeastEvaluation = evaluateCandidate(easyDoseCandidate, normalToleranceInput, 'dry');
const precisionYeastEvaluation = evaluateCandidate(precisionDoseCandidate, normalToleranceInput, 'dry');
assert.equal(easyYeastEvaluation.yeastMeasurement.status, 'easy');
assert.equal(precisionYeastEvaluation.yeastMeasurement.status, 'precisionScale');
assert.equal(easyYeastEvaluation.domain.status, precisionYeastEvaluation.domain.status);
assert.equal(selectDirectHomeCandidate([precisionYeastEvaluation, easyYeastEvaluation]), easyYeastEvaluation);
assert.equal(selectDirectHomeCandidate([easyYeastEvaluation, precisionYeastEvaluation]), easyYeastEvaluation);

const precisionSchedule = {
  ...roomOnlyCandidate,
  roomBeforeFridgeHours: 8,
  fridgeHours: 100,
  roomAfterFridgeHours: 8,
};
const dilutionSchedule = {
  ...roomOnlyCandidate,
  roomBeforeFridgeHours: 20,
  fridgeHours: 80,
  roomAfterFridgeHours: 20,
};
const precisionScheduleEvaluation = evaluateCandidate(precisionSchedule, normalToleranceInput, 'dry');
const dilutionScheduleEvaluation = evaluateCandidate(dilutionSchedule, normalToleranceInput, 'dry');
assert.equal(precisionScheduleEvaluation.yeastMeasurement.status, 'precisionScale');
assert.equal(dilutionScheduleEvaluation.yeastMeasurement.status, 'dilutionRecommended');
assert.equal(precisionScheduleEvaluation.domain.status, dilutionScheduleEvaluation.domain.status);
assert.equal(selectDirectHomeCandidate([dilutionScheduleEvaluation, precisionScheduleEvaluation]), precisionScheduleEvaluation);

const unusualDomainEvaluation = evaluateCandidate(candidates24[2], {
  ...normalToleranceInput,
  hydrationPct: 82,
}, 'fresh');
const supportedDomainEvaluation = evaluateCandidate(candidates24[2], normalToleranceInput, 'fresh');
assert.equal(unusualDomainEvaluation.yeastMeasurement.status, supportedDomainEvaluation.yeastMeasurement.status);
assert.equal(selectDirectHomeCandidate([unusualDomainEvaluation, supportedDomainEvaluation]), supportedDomainEvaluation);

const highSignalCandidate = { ...candidates24[2], roomBeforeFridgeHours: 8, fridgeHours: 8, roomAfterFridgeHours: 8 };
const lowSignalCandidate = { ...candidates24[2], roomBeforeFridgeHours: 6, fridgeHours: 12, roomAfterFridgeHours: 6 };
const highSignalEvaluation = evaluateCandidate(highSignalCandidate, normalToleranceInput, 'fresh');
const lowSignalEvaluation = evaluateCandidate(lowSignalCandidate, normalToleranceInput, 'fresh');
assert.equal(highSignalEvaluation.yeastMeasurement.status, lowSignalEvaluation.yeastMeasurement.status);
assert.equal(highSignalEvaluation.domain.status, lowSignalEvaluation.domain.status);
assert.ok(lowSignalEvaluation.stressSignal.total < highSignalEvaluation.stressSignal.total);
assert.equal(selectDirectHomeCandidate([highSignalEvaluation, lowSignalEvaluation]), lowSignalEvaluation);

const tiedFirstCandidate = { ...roomOnlyCandidate, status: 'warning' };
const tiedSecondCandidate = { ...roomOnlyCandidate, status: 'optimal' };
const tiedFirstEvaluation = evaluateCandidate(tiedFirstCandidate, normalToleranceInput, 'fresh');
const tiedSecondEvaluation = evaluateCandidate(tiedSecondCandidate, normalToleranceInput, 'fresh');
const tiedEvaluations = [tiedFirstEvaluation, tiedSecondEvaluation];
const tiedEvaluationsBefore = tiedEvaluations.slice();
assert.equal(selectDirectHomeCandidate(tiedEvaluations), tiedFirstEvaluation);
assert.deepEqual(tiedEvaluations, tiedEvaluationsBefore);

const coldDominantEvaluation = evaluateCandidate(candidates24[2], normalToleranceInput, 'fresh');
const extraColdEvaluation = evaluateCandidate(candidates24[3], normalToleranceInput, 'fresh');
assert.ok(extraColdEvaluation.stressSignal.total < coldDominantEvaluation.stressSignal.total);
assert.equal(selectDirectHomeCandidate([coldDominantEvaluation, extraColdEvaluation]), extraColdEvaluation);

const stressClearlyLower = {
  ...coldDominantEvaluation,
  stressSignal: { ...coldDominantEvaluation.stressSignal, total: 10 },
};
const stressClearlyHigher = {
  ...extraColdEvaluation,
  stressSignal: { ...extraColdEvaluation.stressSignal, total: 10 + 2e-9 },
};
assert.equal(selectDirectHomeCandidate([stressClearlyHigher, stressClearlyLower]), stressClearlyHigher);

assert.equal(selectDirectHomeCandidate([unsupportedEvaluation, nullResilienceEvaluation]), null);
const evaluatedCandidates24 = candidates24.map((candidate) => evaluateCandidate(candidate));
assert.equal(evaluatedCandidates24.length, 4);
assert.ok(selectDirectHomeCandidate(evaluatedCandidates24));

const directPlanInput = (bakeAt) => ({
  style: 'neapolitan',
  pizzas: 2,
  ballWeight: 250,
  method: 'direct',
  bakeAt,
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
});
const assertPlanMatchesSelectedCandidate = (plan, bakeAt, startAt) => {
  assert.ok(plan);
  assert.equal(plan.selectedEvaluation.selectable, true);
  assert.equal(plan.schedule.startAt.getTime(), startAt.getTime());
  assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
  assert.equal(plan.schedule.prefermentHours, 0);
  assert.equal(plan.schedule.roomBeforeFridgeHours, plan.selectedEvaluation.candidate.roomBeforeFridgeHours);
  assert.equal(plan.schedule.fridgeHours, plan.selectedEvaluation.candidate.fridgeHours);
  assert.equal(plan.schedule.roomAfterFridgeHours, plan.selectedEvaluation.candidate.roomAfterFridgeHours);
  assert.equal(isHomeScheduleDurationValid(plan.schedule), true);
};

const planNow = new Date('2026-09-28T10:00:00.000Z');
const roomOnlyBakeAt = new Date(planNow.getTime() + 4 * 60 * 60 * 1000);
const roomOnlyPlan = createDirectHomePizzaPlan(
  { ...directPlanInput(roomOnlyBakeAt), mixing: 'hand', beginnerScheduleMode: 'roomOnly' },
  { source: 'unknown' },
  62,
  'fresh',
  planNow,
  true,
);
assert.ok(roomOnlyPlan);
assert.equal(roomOnlyPlan.schedule.phaseCMinutes, 5);
assert.equal(
  roomOnlyPlan.schedule.ballingAt.getTime(),
  roomOnlyPlan.schedule.startAt.getTime()
    + (roomOnlyPlan.schedule.phaseAMinutes + roomOnlyPlan.schedule.phaseBMinutes) * 60000,
);
assert.equal(isHomeScheduleDurationValid(roomOnlyPlan.schedule), true);
assert.equal(selectPlannerHomeSchedules({
  isBeginner: true,
  bakeAt: roomOnlyBakeAt,
  directSchedule: roomOnlyPlan.schedule,
  directScheduleMode: 'beginner',
  bigaSchedule: null,
  poolishSchedule: null,
}).direct, roomOnlyPlan.schedule);
for (const availableHours of [24, 48, 72]) {
  const bakeAt = new Date(planNow.getTime() + availableHours * 60 * 60 * 1000);
  const planInput = { ...directPlanInput(bakeAt), pizzas: 6, ballWeight: 280 };
  const freshPlan = createDirectHomePizzaPlan(planInput, { source: 'unknown' }, 70, 'fresh', planNow, true);
  const dryPlan = createDirectHomePizzaPlan(planInput, { source: 'unknown' }, 70, 'dry', planNow, true);
  assert.ok(freshPlan);
  assert.ok(dryPlan);
  assert.deepEqual(freshPlan.schedule, dryPlan.schedule);
  assert.equal(freshPlan.schedule.strategy, 'coldDominant');
  assert.equal(freshPlan.schedule.roomBeforeFridgeHours, 1);
  assert.equal(freshPlan.schedule.fridgeHours, Math.min(availableHours - 4, 24));
  assert.equal(freshPlan.schedule.roomAfterFridgeHours, 3);
  const workflowHours = freshPlan.schedule.roomBeforeFridgeHours
    + freshPlan.schedule.fridgeHours
    + freshPlan.schedule.roomAfterFridgeHours;
  assert.equal(workflowHours, Math.min(availableHours, 28));
  assert.equal(
    freshPlan.schedule.startAt.getTime(),
    bakeAt.getTime() - workflowHours * 3600000,
  );
  assert.equal(
    freshPlan.schedule.ballingAt.getTime(),
    bakeAt.getTime() - (freshPlan.schedule.fridgeHours + freshPlan.schedule.roomAfterFridgeHours) * 3600000,
  );
  assert.equal(freshPlan.schedule.preheatAt.getTime(), bakeAt.getTime() - 60 * 60000);
  assert.equal(getHomeScheduleDurationHours(freshPlan.schedule), workflowHours);
}

for (const availableHours of [24, 48, 24.5]) {
  const bakeAt = new Date(planNow.getTime() + availableHours * 60 * 60 * 1000);
  const planInput = directPlanInput(bakeAt);
  const flourInput = { source: 'w', w: 280 };
  const rawSnapshot = JSON.stringify({ planInput, flourInput, hydrationPct: 65 });
  const plan = createDirectHomePizzaPlan(planInput, flourInput, 65, 'fresh', planNow);
  assertPlanMatchesSelectedCandidate(plan, bakeAt, planNow);
  assertClose(getHomeScheduleDurationHours(plan.schedule), availableHours);
  assert.equal(JSON.stringify({ planInput, flourInput, hydrationPct: 65 }), rawSnapshot);
}

let evaluatedCandidateCount = 0;
const countedFlourInput = {
  source: 'w',
  get w() {
    evaluatedCandidateCount += 1;
    return 280;
  },
};
const countedPlan = createDirectHomePizzaPlan(
  directPlanInput(new Date(planNow.getTime() + 24 * 60 * 60 * 1000)),
  countedFlourInput,
  65,
  'fresh',
  planNow,
);
assert.ok(countedPlan);
assert.equal(evaluatedCandidateCount, 4);

assert.equal(createDirectHomePizzaPlan(directPlanInput(planNow), { source: 'w', w: 280 }, 65, 'fresh', planNow), null);
assert.equal(createDirectHomePizzaPlan(directPlanInput(new Date(planNow.getTime() - 1000)), { source: 'w', w: 280 }, 65, 'fresh', planNow), null);
const unknownStrengthPlan = createDirectHomePizzaPlan(
  directPlanInput(new Date(planNow.getTime() + 24 * 60 * 60 * 1000)),
  { source: 'unknown' },
  65,
  'fresh',
  planNow,
  true,
);
assert.ok(unknownStrengthPlan);
assert.equal(unknownStrengthPlan.selectedEvaluation.baseResilience.resilience, 'low');
const homePlanInputForStrength = directPlanInput(new Date(planNow.getTime() + 24 * 60 * 60 * 1000));
const validWHomePlan = createDirectHomePizzaPlan(homePlanInputForStrength, getHomeFlourStrengthInput('caputo00', { source: 'w', w: 280 }), 65, 'fresh', planNow);
assert.ok(validWHomePlan);
assert.equal(validWHomePlan.selectedEvaluation.selectable, true);
const validProteinHomePlan = createDirectHomePizzaPlan(homePlanInputForStrength, getHomeFlourStrengthInput('caputo00', { source: 'protein', proteinPct: 12.5 }), 65, 'fresh', planNow);
assert.ok(validProteinHomePlan);
const invalidNumericHomePlan = createDirectHomePizzaPlan(homePlanInputForStrength, getHomeFlourStrengthInput('caputo00', { source: 'w', w: Number.NaN }), 65, 'fresh', planNow);
assert.equal(invalidNumericHomePlan, null);
assert.equal(JSON.stringify(getHomePlanLegacyFermentationHours(invalidNumericHomePlan, 2, 24)), JSON.stringify({ roomHours: 2, fridgeHours: 24 }));

const deterministicBakeAt = new Date(planNow.getTime() + 24 * 60 * 60 * 1000);
const deterministicInput = directPlanInput(deterministicBakeAt);
const deterministicPlanA = createDirectHomePizzaPlan(deterministicInput, { source: 'w', w: 280 }, 65, 'fresh', planNow);
const deterministicPlanB = createDirectHomePizzaPlan(deterministicInput, { source: 'w', w: 280 }, 65, 'fresh', planNow);
assert.equal(JSON.stringify(deterministicPlanA.schedule), JSON.stringify(deterministicPlanB.schedule));
assert.equal(JSON.stringify(deterministicPlanA.selectedEvaluation.candidate), JSON.stringify(deterministicPlanB.selectedEvaluation.candidate));

const fourGenerated = generateDirectHomeCandidates(24);
const fourEvaluated = fourGenerated.map((candidate) => evaluateDirectHomeCandidate(candidate, {
  ...normalToleranceInput,
  roomBeforeFridgeHours: 0,
  fridgeHours: 0,
  roomAfterFridgeHours: 0,
}, 'fresh'));
assert.equal(fourGenerated.length, 4);
assert.equal(fourEvaluated.length, 4);

const plannerCopy = {
  bigaMixTitle: 'Start Biga', bigaMixDesc: 'Prepare the biga',
  finalMixTitle: 'Mix {PREFERMENT}', finalBigaDesc: 'Combine the biga with the dough',
  poolishName: 'Poolish', poolishMixTitle: 'Start Poolish', poolishMixDesc: 'Prepare the Poolish',
  finalPoolishDesc: 'Combine the Poolish with the dough',
  ballsTitle: 'Ball dough', ballsDesc: 'Divide and shape the dough',
  ovenTitle: 'Preheat oven', ovenDesc: 'Prepare the oven',
  bakeTitle: 'Bake pizza', bakeDesc: 'Launch at T',
  ovenRomanDesc: 'Prepare the Roman oven', ovenNyDesc: 'Prepare the New York oven',
  warmTitle: 'Warm dough', warmDesc: '{STYLE} final rest',
  coldTitle: 'Refrigerate dough', coldDesc: '{STYLE} cold for {HOURS}',
  bulkTitle: 'Bulk', bulkDesc: 'Bulk {STYLE}',
  directMixTitle: 'Mix Direct', directRomanDesc: 'Roman Direct', directNyDesc: 'New York Direct',
  finalBulkTitle: 'Final bulk', finalBulkDesc: 'Final bulk',
  directTitle: 'Mix Neapolitan', directDesc: 'Neapolitan Direct',
  directHomeCopy: {
    start: '{STRATEGY} bulk {ROOM_BEFORE}h at {ROOM_TEMP}C',
    ballingFridge: 'Ball now and refrigerate {HOURS}h at {FRIDGE_TEMP}C',
    ballingTitle: 'Shape dough balls',
    balling: 'Divide and shape {WEIGHT} g dough balls.',
    fridgeInTitle: 'Refrigerate dough balls',
    fridgeIn: 'Refrigerate the shaped dough balls for {HOURS} at {FRIDGE_TEMP}.',
    roomOnlyBalling: 'Ball now and room proof {ROOM_AFTER}h at {ROOM_TEMP}C',
    finalRoom: 'Room proof {ROOM_AFTER}h at {ROOM_TEMP}C',
    preheat: 'Preheat for {PREHEAT_MINUTES} min',
    shapingTitle: 'Shape and top',
    shaping: 'Shape and top during final 15 minutes',
    bake: 'Launch at T',
  },
};
plannerCopy.directHomeTegliaCopy = {
  ...plannerCopy.directHomeCopy,
  ballingTitle: 'Prepare tray dough mass',
  balling: 'Transfer the dough mass to its covered container.',
  fridgeInTitle: 'Refrigerate the dough mass',
  fridgeIn: 'Refrigerate the covered dough mass for {HOURS} at {FRIDGE_TEMP}.',
};
const styles = ['neapolitan', 'romana', 'ny_style'];

const b2FridgeSchedule = {
  startAt: new Date('2027-04-12T07:05:00.000Z'),
  bakeAt: new Date('2027-04-12T19:00:00.000Z'),
  ballingAt: new Date('2027-04-12T08:55:00.000Z'),
  fridgeAt: new Date('2027-04-12T09:00:00.000Z'),
  preheatAt: new Date('2027-04-12T18:00:00.000Z'),
  roomBeforeFridgeHours: 115 / 60,
  fridgeHours: 8,
  roomAfterFridgeHours: 2,
  phaseAMinutes: 20,
  phaseBMinutes: 90,
  phaseCMinutes: 5,
  prefermentHours: 0,
  strategy: 'hybrid',
  style: 'neapolitan',
  ovenType: 'homeStone',
  roomTemp: 22,
  fridgeTemp: 4,
};
const beginnerFridgeOutAt = new Date(
  b2FridgeSchedule.startAt.getTime()
    + (b2FridgeSchedule.roomBeforeFridgeHours + b2FridgeSchedule.fridgeHours) * 3600000,
);
const legacyPlannerFridgeOutAt = new Date(
  b2FridgeSchedule.ballingAt.getTime() + b2FridgeSchedule.fridgeHours * 3600000,
);
assert.equal(beginnerFridgeOutAt.toISOString(), '2027-04-12T17:00:00.000Z');
assert.equal(legacyPlannerFridgeOutAt.toISOString(), '2027-04-12T16:55:00.000Z');
assert.equal(
  b2FridgeSchedule.fridgeAt.getTime(),
  b2FridgeSchedule.startAt.getTime() + b2FridgeSchedule.roomBeforeFridgeHours * 3600000,
);
assert.equal(
  b2FridgeSchedule.fridgeAt.getTime() - b2FridgeSchedule.ballingAt.getTime(),
  b2FridgeSchedule.phaseCMinutes * 60000,
);
const b2PlannerSteps = reversePlan(
  b2FridgeSchedule.bakeAt,
  'direct',
  'neapolitan',
  plannerCopy,
  b2FridgeSchedule,
);
assert.equal(
  b2PlannerSteps.find((step) => step.title === plannerCopy.warmTitle).at.toISOString(),
  '2027-04-12T17:00:00.000Z',
);
assert.equal(
  b2PlannerSteps.find((step) => step.title === 'Shape dough balls').at.toISOString(),
  b2FridgeSchedule.ballingAt.toISOString(),
);
assert.equal(
  b2PlannerSteps.find((step) => step.title === 'Refrigerate dough balls').at.toISOString(),
  b2FridgeSchedule.fridgeAt.toISOString(),
);
assert.match(
  b2PlannerSteps.find((step) => step.title === 'Refrigerate dough balls').desc,
  /shaped dough balls/,
);
const teglia17Schedule = {
  ...b2FridgeSchedule,
  startAt: new Date('2027-04-12T14:00:00.000Z'),
  bakeAt: new Date('2027-04-12T20:00:00.000Z'),
  ballingAt: new Date('2027-04-12T14:55:00.000Z'),
  fridgeAt: new Date('2027-04-12T15:00:00.000Z'),
  preheatAt: new Date('2027-04-12T19:00:00.000Z'),
  roomBeforeFridgeHours: 1,
  fridgeHours: 4,
  roomAfterFridgeHours: 1,
  phaseAMinutes: 20,
  phaseBMinutes: 30,
  phaseCMinutes: 5,
  style: 'romana',
  romanFormat: 'teglia',
};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  assert.match(productionTranslations[lang].calc.activeDryYeast, /active|aktiv/i);
  assert.match(productionTranslations[lang].profile.preferences.activeDry, /active|aktiv/i);
  assert.match(productionTranslations[lang].planner.stepCopy.yeastHandling.activeDry, /active|aktiv/i);
  assert.notEqual(
    productionTranslations[lang].profile.preferences.activeDry,
    productionTranslations[lang].profile.preferences.dry,
    `${lang}: active dry and instant dry must have distinct setting labels`,
  );
  const productionCopy = productionTranslations[lang].planner.stepCopy;
  const tegliaSteps = reversePlan(
    teglia17Schedule.bakeAt,
    'direct',
    'romana',
    productionCopy,
    teglia17Schedule,
    null,
    null,
    lang,
  );
  const fridgeInSteps = tegliaSteps.filter((step) => step.title === productionCopy.directHomeTegliaCopy.fridgeInTitle);
  assert.equal(fridgeInSteps.length, 1, `${lang} production Teglia copy should render one fridge-in step`);
  assert.equal(fridgeInSteps[0].at.getTime(), teglia17Schedule.fridgeAt.getTime(), `${lang} Planner fridge-in should use fridgeAt`);
  assert.equal(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' }).format(fridgeInSteps[0].at),
    '17:00',
    `${lang} production Teglia fridge-in should display at 17:00 Europe/Vienna`,
  );
  assert.match(fridgeInSteps[0].desc, /mass|Masse|masu|maso/i, `${lang} production Teglia copy should refer to the dough mass`);
}
const romanBlendPlannerSteps = reversePlan(
  b2FridgeSchedule.bakeAt,
  'direct',
  'romana',
  plannerCopy,
  { ...b2FridgeSchedule, style: 'romana', romanFormat: 'tonda' },
);
assert.equal(
  romanBlendPlannerSteps.find((step) => step.title === 'Shape dough balls').at.toISOString(),
  b2FridgeSchedule.ballingAt.toISOString(),
);
assert.equal(
  romanBlendPlannerSteps.find((step) => step.title === 'Refrigerate dough balls').at.toISOString(),
  b2FridgeSchedule.fridgeAt.toISOString(),
);
const generatedB2Plan = createDirectHomePizzaPlan({
  style: 'neapolitan',
  pizzas: 1,
  ballWeight: 250,
  method: 'direct',
  mixing: 'hand',
  beginnerScheduleMode: 'fridgeRoom',
  bakeAt: b2FridgeSchedule.bakeAt,
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
  ovenTemp: 300,
}, { source: 'unknown' }, 62, 'fresh', b2FridgeSchedule.startAt, true);
assert.ok(generatedB2Plan, 'production Beginner plan should be generated');
const generatedB2Schedule = generatedB2Plan.schedule;
assert.deepEqual(
  [generatedB2Schedule.phaseAMinutes, generatedB2Schedule.phaseBMinutes, generatedB2Schedule.phaseCMinutes],
  [20, 90, 5],
);
assert.equal(generatedB2Schedule.bakeAt.getTime(), b2FridgeSchedule.bakeAt.getTime());
assert.equal(generatedB2Schedule.ballingAt.toISOString(), b2FridgeSchedule.ballingAt.toISOString());
assert.equal(generatedB2Schedule.fridgeAt.toISOString(), b2FridgeSchedule.fridgeAt.toISOString());
const generatedB2PlannerSteps = reversePlan(
  generatedB2Schedule.bakeAt,
  'direct',
  'neapolitan',
  plannerCopy,
  generatedB2Schedule,
);
assert.equal(
  generatedB2PlannerSteps.find((step) => step.title === plannerCopy.warmTitle).at.toISOString(),
  beginnerFridgeOutAt.toISOString(),
);
const viennaMidnightBakeAt = new Date('2027-04-13T00:30:00.000Z');
const viennaMidnightNow = new Date('2027-04-12T12:35:00.000Z');
const viennaMidnightPlan = createDirectHomePizzaPlan({
  style: 'neapolitan',
  pizzas: 1,
  ballWeight: 250,
  method: 'direct',
  mixing: 'hand',
  beginnerScheduleMode: 'fridgeRoom',
  bakeAt: viennaMidnightBakeAt,
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
  ovenTemp: 300,
}, { source: 'unknown' }, 62, 'fresh', viennaMidnightNow, true);
assert.ok(viennaMidnightPlan, 'production Beginner plan should cross local midnight');
const viennaMidnightSchedule = viennaMidnightPlan.schedule;
const viennaTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna',
  dateStyle: 'short',
  timeStyle: 'short',
});
const viennaFridgeOutAt = new Date(
  viennaMidnightSchedule.startAt.getTime()
    + (viennaMidnightSchedule.roomBeforeFridgeHours + viennaMidnightSchedule.fridgeHours) * 3600000,
);
assert.equal(viennaTime.format(viennaFridgeOutAt), '13/04/2027, 00:30');
const viennaPlannerSteps = reversePlan(
  viennaMidnightSchedule.bakeAt,
  'direct',
  'neapolitan',
  plannerCopy,
  viennaMidnightSchedule,
);
assert.equal(
  viennaPlannerSteps.find((step) => step.title === plannerCopy.warmTitle).at.getTime(),
  viennaFridgeOutAt.getTime(),
);
const beginnerStrategyTable = {
  18: ['roomOnly', 'roomOnly', 'roomOnly', 'hybrid', 'coldDominant', 'coldDominant', 'coldDominant'],
  22: ['hybrid', 'hybrid', 'hybrid', 'hybrid', 'coldDominant', 'coldDominant', 'coldDominant'],
  28: ['coldDominant', 'coldDominant', 'coldDominant', 'coldDominant', 'coldDominant', 'coldDominant', 'coldDominant'],
};
const beginnerStrategyHours = [6, 8, 12, 18, 24, 48, 72];
for (const [roomTempText, expectedStrategies] of Object.entries(beginnerStrategyTable)) {
  const roomTemp = Number(roomTempText);
  beginnerStrategyHours.forEach((hours, index) => {
    const strategy = selectBeginnerDirectHomeStrategy(hours, roomTemp);
    assert.equal(strategy, expectedStrategies[index], `${roomTemp}C/${hours}h strategy`);
    const bakeAt = new Date(planNow.getTime() + hours * 3600000);
    const plan = createDirectHomePizzaPlan({
      style: 'neapolitan', pizzas: 6, ballWeight: 250, method: 'direct', bakeAt,
      roomTemp, fridgeTemp: 4, ovenType: 'homeStone',
    }, { source: 'unknown' }, 62, 'fresh', planNow, true);
    assert.ok(plan);
    assert.equal(plan.schedule.strategy, strategy);
    if (strategy === 'roomOnly') {
      assert.equal(plan.schedule.fridgeHours, 0);
      assert.equal(plan.schedule.roomAfterFridgeHours, 3);
      assert.equal(plan.schedule.ballingAt.getTime(), bakeAt.getTime() - 3 * 3600000);
      const roomOnlyPlannerSteps = reversePlan(bakeAt, 'direct', 'neapolitan', {
        ...plannerCopy,
        directHomeCopy: {
          start: 'Mix Direct, room {ROOM_BEFORE} at {ROOM_TEMP}',
          ballingFridge: 'Ball and refrigerate {HOURS}',
          roomOnlyBalling: 'Ball {WEIGHT}g, then room proof {ROOM_AFTER} at {ROOM_TEMP}',
          finalRoom: 'Take out of fridge for {ROOM_AFTER}',
          preheat: 'Preheat for {PREHEAT_MINUTES}',
          shapingTitle: 'Shape and top',
          shaping: 'Shape and top at T-15, launch at T',
          bake: 'Launch at T',
        },
      }, plan.schedule);
      assert.equal(roomOnlyPlannerSteps.at(-1).at.getTime(), bakeAt.getTime());
      assert.equal(roomOnlyPlannerSteps.find((step) => step.title === plannerCopy.ballsTitle).at.getTime(), bakeAt.getTime() - 3 * 3600000);
      assert.equal(roomOnlyPlannerSteps.find((step) => step.title === plannerCopy.ovenTitle).at.getTime(), bakeAt.getTime() - 60 * 60000);
      assert.equal(roomOnlyPlannerSteps.find((step) => step.title === 'Shape and top').at.getTime(), bakeAt.getTime() - 15 * 60000);
      assert.ok(roomOnlyPlannerSteps.every((step) => !/refrigerat|fridge|cold fermentation|kühlschrank|hladilnik|hladnjak/i.test(`${step.title} ${step.desc}`)));
    }
  });
}
assert.equal(selectBeginnerDirectHomeStrategy(5, 22), 'roomOnly');
assert.equal(selectBeginnerDirectHomeStrategy(5, 28), 'coldDominant');
const directFlourStrengths = [
  { source: 'unknown' },
  { source: 'w', w: 280 },
  { source: 'protein', proteinPct: 12.5 },
];
for (const hours of [24, 48, 72]) {
  for (const style of styles) {
    const bakeAt = new Date(planNow.getTime() + hours * 60 * 60 * 1000);
    for (const flour of directFlourStrengths) {
      const plan = createDirectHomePizzaPlan(
        { ...directPlanInput(bakeAt), style }, flour, 70, 'fresh', planNow, flour.source === 'unknown',
      );
      assert.ok(plan, `${hours}h ${style} Direct Home plan should support ${flour.source} flour strength`);
      assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
      assert.equal(
        getHomeScheduleDurationHours(plan.schedule),
        flour.source === 'unknown' ? Math.min(hours, 28) : hours,
      );
      assert.equal(JSON.stringify(getHomePlanLegacyFermentationHours(plan, 2, 24)), JSON.stringify({
        roomHours: plan.schedule.roomBeforeFridgeHours + plan.schedule.roomAfterFridgeHours,
        fridgeHours: plan.schedule.fridgeHours,
      }));
    }
  }
}

for (const style of styles) {
  const profile = PIZZA_STYLE_PROFILES[style];
  for (const hours of [24, 48, 72]) {
    const bakeAt = new Date(planNow.getTime() + hours * 60 * 60 * 1000);
    const schedules = [];
    const totalsByMixingAndYeast = new Map();
    for (const mixing of ['hand', 'mixer']) {
      for (const yeastType of ['fresh', 'activeDry', 'dry']) {
        const plan = createDirectHomePizzaPlan({
          style, pizzas: 6, ballWeight: profile.ballWeight, method: 'direct', bakeAt,
          roomTemp: 22, fridgeTemp: 4, ovenType: 'homeStone',
        }, { source: 'unknown' }, profile.hydration, yeastType, planNow, true);
        assert.ok(plan, `${style} ${mixing} ${hours}h ${yeastType} Beginner plan should be valid`);
        assert.equal(plan.input.method, 'direct');
        assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
        assert.equal(getHomeScheduleDurationHours(plan.schedule), Math.min(hours, 28));
        assert.equal(plan.schedule.ballingAt.getTime(), plan.schedule.startAt.getTime() + plan.schedule.roomBeforeFridgeHours * 3600000);
        assert.equal(plan.schedule.preheatAt.getTime(), bakeAt.getTime() - 3600000);
        schedules.push(plan.schedule);
        const legacyHours = getHomePlanLegacyFermentationHours(plan, 2, 24);
        const result = doughCalc({
          pizzas: 6, ballWeight: profile.ballWeight,
          hydration: profile.hydration, saltPct: profile.saltPct, oilPct: profile.oilPct,
          method: 'direct', roomHours: legacyHours.roomHours, roomTemp: 22,
          fridgeHours: legacyHours.fridgeHours, fridgeTemp: 4, yeastType,
          mixing: mixing === 'mixer' ? 'spiral' : 'hand', flourType: 'caputo00',
        });
        assert.equal(result.totalDough, 6 * profile.ballWeight);
        const coldHours = legacyHours.fridgeHours;
        const mixingRule = mixing === 'mixer' ? 55 : 60;
        const expectedWaterTemp = Math.max(2, Math.min(30, coldHours >= 12
          ? Math.min(mixingRule - 22, 10)
          : mixingRule - 22));
        assert.equal(result.waterTemp, expectedWaterTemp);
        const displayFlour = Math.round((result.totalDough - result.total.water - result.total.salt - result.total.oil - result.total.yeast) * 100) / 100;
        const displayedTotal = displayFlour + result.total.water + result.total.salt + result.total.oil + result.total.yeast;
        assert.ok(Math.abs(displayedTotal - result.totalDough) < 1e-9);
        totalsByMixingAndYeast.set(`${mixing}/${yeastType}`, result);

        const plannerSteps = reversePlan(bakeAt, 'direct', style, plannerCopy, plan.schedule);
        assert.equal(plannerSteps.at(-1).at.getTime(), bakeAt.getTime());
        assert.equal(plannerSteps.at(-1).title, 'Bake pizza');
        assert.equal(plannerSteps.at(-1).desc, 'Launch at T');
        const directMixTitle = style === 'neapolitan' ? plannerCopy.directTitle : plannerCopy.directMixTitle;
        assert.equal(plannerSteps.find((step) => step.title === directMixTitle).at.getTime(), plan.schedule.startAt.getTime());
        const separateFridgeIn = plan.schedule.fridgeAt
          && plan.schedule.fridgeAt.getTime() > plan.schedule.ballingAt.getTime();
        const selectedHomeCopy = style === 'romana' && plan.schedule.romanFormat === 'teglia'
          ? plannerCopy.directHomeTegliaCopy
          : plannerCopy.directHomeCopy;
        const ballingTitle = selectedHomeCopy.ballingTitle ?? plannerCopy.ballsTitle;
        const ballingStep = plannerSteps.find((step) => step.title === ballingTitle);
        assert.ok(ballingStep, JSON.stringify({
          style,
          hours,
          ballingTitle,
          ballingAt: plan.schedule.ballingAt,
          fridgeAt: plan.schedule.fridgeAt,
          plannerSteps: plannerSteps.map((step) => step.title),
        }));
        assert.equal(ballingStep.at.getTime(), plan.schedule.ballingAt.getTime());
        if (separateFridgeIn) {
          assert.equal(
            plannerSteps.find((step) => step.title === selectedHomeCopy.fridgeInTitle).at.getTime(),
            plan.schedule.fridgeAt.getTime(),
          );
        }
        assert.equal(plannerSteps.find((step) => step.title === plannerCopy.ovenTitle).at.getTime(), plan.schedule.preheatAt.getTime());
        assert.equal(plannerSteps.find((step) => step.title === 'Shape and top').at.getTime(), bakeAt.getTime() - 15 * 60000);
        assert.equal(plan.schedule.ballingAt.getTime(), plan.schedule.startAt.getTime() + plan.schedule.roomBeforeFridgeHours * 3600000);
        if (plan.schedule.fridgeHours > 0) {
          assert.equal(plannerSteps.find((step) => step.title === plannerCopy.warmTitle).at.getTime(), bakeAt.getTime() - plan.schedule.roomAfterFridgeHours * 3600000);
        }
      }
    }
    assert.deepEqual(schedules[0], schedules[1]);
    assert.deepEqual(schedules[0], schedules[2]);
    assert.deepEqual(schedules[0], schedules[3]);
    assert.deepEqual(schedules[0], schedules[4]);
    assert.deepEqual(schedules[0], schedules[5]);
    const handFresh = totalsByMixingAndYeast.get('hand/fresh');
    const mixerFresh = totalsByMixingAndYeast.get('mixer/fresh');
    const handActiveDry = totalsByMixingAndYeast.get('hand/activeDry');
    const mixerActiveDry = totalsByMixingAndYeast.get('mixer/activeDry');
    const handDry = totalsByMixingAndYeast.get('hand/dry');
    const mixerDry = totalsByMixingAndYeast.get('mixer/dry');
    assert.equal(handFresh.eTotal, mixerFresh.eTotal);
    assert.equal(handFresh.eTotal, handActiveDry.eTotal);
    assert.equal(handFresh.eTotal, mixerActiveDry.eTotal);
    assert.equal(handFresh.eTotal, handDry.eTotal);
    assert.equal(handFresh.eTotal, mixerDry.eTotal);
    assert.ok(Math.abs(handFresh.yeastPct * 0.4 - handActiveDry.yeastPct) <= 0.01);
    assert.ok(Math.abs(mixerFresh.yeastPct * 0.4 - mixerActiveDry.yeastPct) <= 0.01);
    assert.ok(Math.abs(handFresh.yeastPct / 3 - handDry.yeastPct) <= 0.01);
    assert.ok(Math.abs(mixerFresh.yeastPct / 3 - mixerDry.yeastPct) <= 0.01);
  }
}

for (const hours of [24, 48, 72]) {
  const bakeAt = new Date(planNow.getTime() + hours * 60 * 60 * 1000);
  const schedules = [];
  for (const mixing of ['hand', 'mixer']) {
    for (const yeastType of ['fresh', 'activeDry', 'dry']) {
      const plan = createBigaHomePizzaPlan({
        style: 'neapolitan', pizzas: 6, ballWeight: 280, bakeAt,
        roomTemp: 22, fridgeTemp: 4, ovenType: 'homeStone',
      }, planNow);
      assert.ok(plan, `${hours}h Biga Home plan should support ${mixing}/${yeastType}`);
      const schedule = plan.schedule;
      schedules.push(schedule);
      assert.equal(isBigaHomeScheduleDurationValid(schedule), true);
      assert.equal(getBigaHomeScheduleDurationHours(schedule), hours);
      assert.equal(schedule.bigaRoomHours, 9.1);
      assert.equal(schedule.bigaFridgeHours, 0);
      assert.equal(schedule.finalDoughRoomHours, 3);
      assert.ok(Math.abs(schedule.finalDoughFridgeHours - (hours - 15.1)) < 1e-9);
      assert.equal(schedule.finalBallRestHours, 3);
      assert.equal(schedule.ballingAt.getTime(), bakeAt.getTime() - 3 * 3600000);
      assert.equal(schedule.preheatAt.getTime(), bakeAt.getTime() - 3600000);
      assert.equal(schedule.bakeAt.getTime(), bakeAt.getTime());

      const result = doughCalc({
        pizzas: 6, ballWeight: 280, hydration: 70, saltPct: 2.9, oilPct: 2,
        method: 'biga', bigaPct: 50, roomHours: 0, roomTemp: 22,
        fridgeHours: 0, fridgeTemp: 4, prefermentHours: 24, yeastType,
        mixing: mixing === 'mixer' ? 'spiral' : 'hand', flourType: 'caputo00',
        bigaHomeSchedule: schedule,
      });
      assert.equal(result.totalDough, 1680);
      assert.equal(result.preferment.flour, 480);
      assert.equal(result.preferment.water, 216);
      assert.ok(Math.abs(result.preferment.water / result.preferment.flour - 0.45) < 0.002);
      assert.ok(Math.abs(result.preferment.yeast + result.main.yeast - result.total.yeast) <= 0.01);
      assert.ok(Math.abs(
        result.preferment.yeast - result.total.yeast * result.preferment.flour / result.total.flour,
      ) <= 0.02);
      assert.ok(Math.abs(result.main.yeast + result.preferment.yeast - result.total.yeast) <= 0.01);
      assert.ok(result.main.yeast > 0, 'Biga final dough must include its calculated yeast portion');

      const displayedMainFlour = Math.round((result.totalDough
        - result.preferment.flour - result.preferment.water - result.preferment.yeast
        - result.main.water - result.main.salt - result.main.oil - result.main.yeast) * 100) / 100;
      const displayedTotal = result.preferment.flour + result.preferment.water + result.preferment.yeast
        + displayedMainFlour + result.main.water + result.main.salt + result.main.oil + result.main.yeast;
      assert.ok(Math.abs(displayedTotal - 1680) < 0.001);
    }
  }
  assert.deepEqual(schedules[0], schedules[1]);
  assert.deepEqual(schedules[0], schedules[2]);
  assert.deepEqual(schedules[0], schedules[3]);
}

for (const hours of [24, 48, 72]) {
  for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    const bakeAt = new Date(planNow.getTime() + hours * 60 * 60 * 1000);
    const input = {
      style: 'neapolitan', pizzas: 6, ballWeight: 280, method: 'direct', bakeAt,
      roomTemp: 22, fridgeTemp: 4, ovenType: 'homeStone',
    };
    const plan = createDirectHomePizzaPlan(input, { source: 'unknown' }, 70, yeastType, planNow, true);
    assert.ok(plan, `${hours}h Direct Home plan should be valid for ${yeastType} yeast`);
    assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
    const legacyHours = getHomePlanLegacyFermentationHours(plan, 2, 24);
    assert.equal(JSON.stringify(legacyHours), JSON.stringify({
      roomHours: plan.schedule.roomBeforeFridgeHours + plan.schedule.roomAfterFridgeHours,
      fridgeHours: plan.schedule.fridgeHours,
    }));
    const result = doughCalc({
      pizzas: 6, ballWeight: 280, hydration: 70, saltPct: 2.9, oilPct: 2,
      method: 'direct', roomHours: legacyHours.roomHours, roomTemp: 22,
      fridgeHours: legacyHours.fridgeHours, fridgeTemp: 4, yeastType,
      mixing: 'hand', flourType: 'caputo00',
    });
    assert.equal(result.totalDough, 1680);
    assert.equal(result.total.flour, result.main.flour);
    assert.equal(result.total.water, result.main.water);
    assert.equal(result.total.yeast, result.main.yeast);
  }
}

for (const style of styles) {
  const bakeAt = new Date(planNow.getTime() + 48 * 60 * 60 * 1000);
  const plan = createDirectHomePizzaPlan(
    { ...directPlanInput(bakeAt), style },
    { source: 'w', w: 280 },
    65,
    'fresh',
    planNow,
  );
  assertPlanMatchesSelectedCandidate(plan, bakeAt, planNow);
}

for (const hours of [24, 48, 72]) {
  for (const style of styles) {
    const bakeAt = new Date(planNow.getTime() + hours * 60 * 60 * 1000);
    const plan = createBigaHomePizzaPlan({
      style, pizzas: 2, ballWeight: 250, bakeAt, roomTemp: 21, fridgeTemp: 4, ovenType: 'homeStone',
    }, planNow);
    assert.ok(plan, `${hours}h ${style} Biga Home plan should be valid`);
    assert.equal(isBigaHomeScheduleDurationValid(plan.schedule), true);
    const milestones = getBigaHomeScheduleMilestones(plan.schedule);
    const plannerAndAlarmSteps = reversePlan(bakeAt, 'biga', style, plannerCopy, null, plan.schedule);
    assert.deepEqual(
      plannerAndAlarmSteps.map(({ at }) => at.getTime()),
      milestones.map(({ at }) => at.getTime()),
    );
    assert.ok(plannerAndAlarmSteps.every(({ at }, index) => at === milestones[index].at));
    if (hours === 48 && style === 'neapolitan') {
      const calculatorPhases = getBigaHomeFermentationSchedule(plan.schedule, 21, 4);
      assert.equal(calculatorPhases.prefermentRoomHours, plan.schedule.bigaRoomHours);
      assert.equal(calculatorPhases.prefermentFridgeHours, plan.schedule.bigaFridgeHours);
      assert.equal(plannerAndAlarmSteps.at(-1).at, plan.schedule.bakeAt);
      const homePlannerCopy = {
        ...plannerCopy,
        bigaHomeCopy: {
          bigaStart: 'Biga {BIGA_ROOM} room + {BIGA_FRIDGE} fridge',
          finalMix: 'Add remaining flour, water, final yeast, salt and oil',
          balling: 'Ball now; final rest {BALL_REST}',
          preheat: 'Preheat at this alert',
          bake: 'Launch at bake time',
        },
      };
      const homePlannerSteps = reversePlan(bakeAt, 'biga', style, homePlannerCopy, null, plan.schedule);
      assert.equal(homePlannerSteps[0].desc, 'Biga 10 h 12 min room + 0 h fridge');
      assert.match(homePlannerSteps[1].desc, /final yeast/);
      assert.equal(homePlannerSteps[2].desc, 'Ball now; final rest 3 h');
      assert.equal(homePlannerSteps[3].desc, 'Preheat at this alert');
      assert.equal(homePlannerSteps[4].desc, 'Launch at bake time');
    }
  }
}

for (const availableHours of [24, 48, 72]) {
  const poolishHours = Math.min(24, availableHours - 6);
  for (const style of styles) {
    const bakeAt = new Date(planNow.getTime() + availableHours * 60 * 60 * 1000);
    const plan = createPoolishHomePizzaPlan({
      style, pizzas: 2, ballWeight: 250, bakeAt, roomTemp: 22, fridgeTemp: 4,
      ovenType: 'homeStone', poolishHours,
    }, planNow);
    assert.ok(plan, `${availableHours}h ${style} Poolish Home plan should be valid`);
    assert.equal(isPoolishHomeScheduleDurationValid(plan.schedule), true);
    assert.equal(getPoolishHomeScheduleDurationHours(plan.schedule), availableHours);
    assert.equal(plan.schedule.poolishRoomHours, 1);
    assert.equal(plan.schedule.poolishFridgeHours, poolishHours - 1);
    assert.equal(plan.schedule.finalMixAt.getTime(), planNow.getTime() + poolishHours * 3600000);
    const milestones = getPoolishHomeScheduleMilestones(plan.schedule);
    const plannerAndAlarmSteps = reversePlan(bakeAt, 'poolish', style, plannerCopy, null, null, plan.schedule);
    assert.deepEqual(
      plannerAndAlarmSteps.map(({ at }) => at.getTime()),
      milestones.map(({ at }) => at.getTime()),
    );
    assert.ok(plannerAndAlarmSteps.every(({ at }, index) => at === milestones[index].at));

    const fermentation = getPoolishHomeFermentationSchedule(plan.schedule, 22, 4);
    const expectedExposure = Math.max(0.5, fermentation.phases.reduce((total, phase) => {
      const rate = phase.environment === 'room'
        ? 1 + 0.08 * (phase.temperature - 20)
        : 0.12 * (1 + 0.05 * (phase.temperature - 4));
      return total + phase.hours * rate;
    }, 0));
    for (const yeastType of ['fresh', 'activeDry', 'dry']) {
      const result = doughCalc({
        pizzas: 2, ballWeight: 250, hydration: 65, saltPct: 2.9, oilPct: 2,
        method: 'poolish', poolishPct: 35, roomHours: 2, roomTemp: 22,
        fridgeHours: 24, fridgeTemp: 4, prefermentHours: poolishHours,
        yeastType, mixing: 'home', poolishHomeSchedule: plan.schedule,
      });
      assert.equal(result.eTotal, Math.round(expectedExposure * 10) / 10);
      assert.ok(Math.abs(result.preferment.water - result.preferment.flour) <= 1);
      assert.ok(Math.abs(
        result.preferment.yeast - result.total.yeast * result.preferment.flour / result.total.flour,
      ) <= 0.02);
      assert.ok(Math.abs(result.main.yeast + result.preferment.yeast - result.total.yeast) <= 0.01);
      assert.ok(result.main.yeast > 0, 'Poolish final dough must include its calculated yeast portion');
    }
  }
}

console.log('Home Pizza schedule and fermentation window checks passed.');
