import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const calculatorSource = fs.readFileSync(path.join(root, 'src/calculator.ts'), 'utf8');
const translationsSource = fs.readFileSync(path.join(root, 'src/i18n/translations.ts'), 'utf8');
const loadTypeScriptModule = (source, filename) => {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const require = (specifier) => {
    if (filename === 'prefermentSteps.ts' && specifier === './spiralMixing') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/i18n/spiralMixing.ts'), 'utf8'),
        'spiralMixing.ts',
      );
    }
    throw new Error(`Unexpected dependency "${specifier}" in ${filename}.`);
  };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, require }, { filename });
  return moduleRef.exports;
};
const calculator = loadTypeScriptModule(calculatorSource, 'calculator.ts');
const translations = loadTypeScriptModule(translationsSource, 'translations.ts').translations;
const prefermentSteps = loadTypeScriptModule(
  fs.readFileSync(path.join(root, 'src/i18n/prefermentSteps.ts'), 'utf8'),
  'prefermentSteps.ts',
);

const {
  createDirectHomePizzaPlan,
  createBigaHomePizzaPlan,
  createPoolishHomePizzaPlan,
  doughCalc,
  getDirectHomeFermentationSchedule,
  getFermentationSchedule,
  getHomeFlourStrengthInput,
  getTemperingWindow,
  isHomeScheduleDurationValid,
  reversePlan,
  selectPlannerHomeSchedules,
  YEAST_MASS_FACTORS,
} = calculator;

assert.deepEqual({ ...YEAST_MASS_FACTORS }, { fresh: 1, activeDry: 0.4, dry: 1 / 3 });

for (const lang of ['hr', 'en', 'de', 'sl']) {
  assert.match(translations[lang].calc.dryYeast, /instant/i);
  assert.match(translations[lang].calc.activeDryYeast, /active|aktiv/i);
  assert.match(translations[lang].profile.preferences.dry, /instant/i);
  assert.match(translations[lang].profile.preferences.activeDry, /active|aktiv/i);
  assert.match(translations[lang].planner.stepCopy.yeastHandling.dry, /instant/i);
  assert.match(translations[lang].planner.stepCopy.yeastHandling.activeDry, /active|aktiv/i);

  const handSteps = translations[lang].calc.handMixSteps.A.steps;
  const mixerSteps = translations[lang].calc.mixerSteps.A.steps;
  const activeDryHand = prefermentSteps.adaptDirectMixingSteps(handSteps, lang, 'activeDry', 'hand');
  const dryHand = prefermentSteps.adaptDirectMixingSteps(handSteps, lang, 'dry', 'hand');
  const freshHand = prefermentSteps.adaptDirectMixingSteps(handSteps, lang, 'fresh', 'hand');
  const activeDryMixer = prefermentSteps.adaptDirectMixingSteps(mixerSteps, lang, 'activeDry', 'mixer');
  const dryMixer = prefermentSteps.adaptDirectMixingSteps(mixerSteps, lang, 'dry', 'mixer');
  const freshMixer = prefermentSteps.adaptDirectMixingSteps(mixerSteps, lang, 'fresh', 'mixer');
  assert.match(activeDryHand[0], /active|aktiv/i);
  assert.match(activeDryMixer[2], /active|aktiv/i);
  assert.match(dryHand[0], /instant/i);
  assert.match(dryHand[1], /instant/i);
  assert.match(dryMixer[2], /instant/i);
  assert.match(dryMixer[3], /instant/i);
  assert.notEqual(freshHand[0], dryHand[0]);
  assert.notEqual(freshMixer[2], dryMixer[2]);

  for (const method of ['biga', 'poolish']) {
    for (const mixing of ['hand', 'mixer']) {
      const activePath = prefermentSteps.getYeastAwarePrefermentSteps(lang, method, mixing, 'activeDry');
      const activeText = JSON.stringify(activePath);
      const activeMentions = activeText.match(/active|aktiv/gi) ?? [];
      assert.ok(activeMentions.length >= 2, `${lang} ${method}/${mixing} must explain active dry yeast in both phases`);
      assert.doesNotMatch(activeText, /instant|instant/i, `${lang} ${method}/${mixing} active-dry instructions must not call it instant`);
    }
  }
}

assert.deepEqual({ ...getTemperingWindow(22) }, {
  minimumMinutes: 30,
  maximumMinutes: 45,
  initialMinutes: 38,
});
assert.equal(getTemperingWindow(18).initialMinutes, 68);
assert.equal(getTemperingWindow(26).initialMinutes, 23);

const bakeAt = new Date('2026-10-20T18:00:00.000Z');
const restMinutes = getTemperingWindow(22).initialMinutes;
const settings = {
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  bigaHours: 24,
  poolishHours: 24,
};

function makeSchedule(method, selected = settings, includeFinish = selected.fridgeHours > 0) {
  return getFermentationSchedule({
    method,
    roomHours: selected.roomHours,
    roomTemp: selected.roomTemp,
    fridgeHours: selected.fridgeHours,
    fridgeTemp: selected.fridgeTemp,
    ...(method === 'biga' ? { prefermentHours: selected.bigaHours } : {}),
    ...(method === 'poolish' ? { prefermentHours: selected.poolishHours } : {}),
    roomAfterFridgeHours: includeFinish ? getTemperingWindow(selected.roomTemp).initialMinutes / 60 : 0,
  });
}

function doughFor(
  method,
  schedule,
  yeastType = 'fresh',
  flourType = 'caputo00',
  mixing = 'hand',
  bigaPct = 50,
  poolishPct = 35,
  beginnerDirectStyle,
) {
  return doughCalc({
    pizzas: 4,
    ballWeight: 260,
    hydration: flourType === 'glutenFree' ? 75 : 63,
    saltPct: 2.8,
    oilPct: 2,
    method,
    bigaPct,
    poolishPct,
    roomHours: settings.roomHours,
    roomTemp: settings.roomTemp,
    fridgeHours: settings.fridgeHours,
    fridgeTemp: settings.fridgeTemp,
    prefermentHours: method === 'biga' ? settings.bigaHours : method === 'poolish' ? settings.poolishHours : 0,
    yeastType,
    flourType,
    mixing: mixing === 'mixer' ? 'home' : mixing,
    ...(beginnerDirectStyle ? { beginnerDirectStyle } : {}),
    fermentationSchedule: schedule,
  });
}

function rawExposure(schedule) {
  return schedule.phases.reduce((total, phase) => {
    const rate = phase.environment === 'room'
      ? 1 + 0.08 * (phase.temperature - 20)
      : 0.12 * (1 + 0.05 * (phase.temperature - 4));
    return total + phase.hours * rate;
  }, 0);
}

function assertCalcUsesSchedule(method, schedule, yeastType, flour, mixing, bigaPct = 50, poolishPct = 35) {
  const calc = doughFor(method, schedule, yeastType, flour, mixing, bigaPct, poolishPct);
  const expectedExposure = Math.max(0.5, rawExposure(schedule));
  const expectedYeastPct = (0.5 / expectedExposure) * YEAST_MASS_FACTORS[yeastType];
  assert.equal(calc.eTotal, Math.round(expectedExposure * 10) / 10);
  assert.equal(calc.yeastPct, Math.round(expectedYeastPct * 100) / 100);
  if (method !== 'direct') {
    assert.ok(calc.preferment, `${method} keeps its preferment`);
    const prefermentFlourShare = calc.preferment.flour / calc.total.flour;
    assert.ok(Math.abs(calc.preferment.yeast - calc.total.yeast * prefermentFlourShare) <= 0.02);
    assert.ok(Math.abs(calc.preferment.yeast + calc.main.yeast - calc.total.yeast) <= 0.01);
  }
  return calc;
}

function sumHours(schedule, kind, environment) {
  return schedule.phases
    .filter((phase) => phase.kind === kind && phase.environment === environment)
    .reduce((total, phase) => total + phase.hours, 0);
}

for (const style of ['neapolitan', 'romana', 'ny_style']) {
  for (const method of ['direct', 'biga', 'poolish']) {
    for (const lang of ['hr', 'en', 'de', 'sl']) {
      const copy = translations[lang].planner.stepCopy;
      const coldSchedule = makeSchedule(method);
      assert.equal(sumHours(coldSchedule, 'final-rest', 'room'), restMinutes / 60);
      assert.equal(coldSchedule.phases.filter((phase) => phase.kind === 'final-rest').length, 1);
      assertCalcUsesSchedule(method, coldSchedule, 'fresh', 'caputo00', 'hand');

      const coldSteps = reversePlan(
        bakeAt,
        method,
        style,
        copy,
        null,
        null,
        null,
        lang,
        undefined,
        settings.roomTemp,
        coldSchedule,
      );
      const warm = coldSteps.find((step) => step.title === copy.warmTitle);
      const cold = coldSteps.find((step) => step.title === copy.coldTitle);
      const bulkTitle = method === 'direct' ? copy.bulkTitle : copy.finalBulkTitle;
      const bulk = coldSteps.find((step) => step.title === bulkTitle);
      assert.ok(warm, `${style}/${method}/${lang}: Pro cold schedule has a final-rest event`);
      assert.equal((bakeAt.getTime() - warm.at.getTime()) / 60000, restMinutes);
      assert.ok(cold, `${style}/${method}/${lang}: selected fridge phase reaches Planner`);
      assert.equal((bakeAt.getTime() - cold.at.getTime()) / 60000, restMinutes + settings.fridgeHours * 60);
      assert.ok(bulk, `${style}/${method}/${lang}: selected room phase reaches Planner`);
      assert.equal(
        (bakeAt.getTime() - bulk.at.getTime()) / 60000,
        restMinutes + (settings.fridgeHours + settings.roomHours) * 60,
      );

      const roomOnlySettings = { ...settings, roomHours: 3, fridgeHours: 0 };
      const roomOnlySchedule = makeSchedule(method, roomOnlySettings, false);
      assert.equal(sumHours(roomOnlySchedule, 'final-rest', 'room'), 0);
      assert.equal(sumHours(roomOnlySchedule, 'final', 'room'), 3);
      assert.equal(roomOnlySchedule.phases.some((phase) => phase.hours === 0), false);
      assertCalcUsesSchedule(method, roomOnlySchedule, 'fresh', 'caputo00', 'hand');
      const roomOnlySteps = reversePlan(
        bakeAt,
        method,
        style,
        copy,
        null,
        null,
        null,
        lang,
        undefined,
        settings.roomTemp,
        roomOnlySchedule,
      );
      assert.equal(roomOnlySteps.some((step) => step.title === copy.warmTitle), false);
      assert.equal(roomOnlySteps.some((step) => step.title === copy.coldTitle), false);
      const roomOnlyBulk = roomOnlySteps.find((step) => step.title === bulkTitle);
      assert.ok(roomOnlyBulk, `${style}/${method}/${lang}: existing room-only fermentation remains`);
      assert.equal((bakeAt.getTime() - roomOnlyBulk.at.getTime()) / 60000, 3 * 60);
    }
  }
}

for (const method of ['direct', 'biga', 'poolish']) {
  const coldSchedule = makeSchedule(method);
  const roomOnlySchedule = makeSchedule(method, { ...settings, roomHours: 3, fridgeHours: 0 }, false);
  for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'custom', 'glutenFree']) {
      for (const mixing of ['hand', 'home', 'spiral']) {
        const withFinish = assertCalcUsesSchedule(method, coldSchedule, yeastType, flour, mixing);
        const withoutFinish = doughFor(method, getFermentationSchedule({
          method,
          roomHours: settings.roomHours,
          roomTemp: settings.roomTemp,
          fridgeHours: settings.fridgeHours,
          fridgeTemp: settings.fridgeTemp,
          ...(method === 'biga' ? { prefermentHours: settings.bigaHours } : {}),
          ...(method === 'poolish' ? { prefermentHours: settings.poolishHours } : {}),
        }), yeastType, flour, mixing);
        assert.ok(withFinish.eTotal > withoutFinish.eTotal);
        assert.ok(withFinish.yeastPct <= withoutFinish.yeastPct);
        assertCalcUsesSchedule(method, roomOnlySchedule, yeastType, flour, mixing);
      }

      for (const style of ['neapolitan', 'newYork', 'romanaTonda', 'romanaTeglia']) {
        for (const yeastType of ['fresh', 'activeDry', 'dry']) {
          const calc = doughFor('direct', makeSchedule('direct'), yeastType, 'caputo00', 'hand', 50, 35, style);
          const expectedYeastPct = (0.5 / Math.max(0.5, rawExposure(makeSchedule('direct')))) * YEAST_MASS_FACTORS[yeastType];
          assert.equal(calc.yeastPct, Math.round(expectedYeastPct * 100) / 100);
        }
      }
    }

    for (const method of ['biga', 'poolish']) {
      for (const pct of [20, 35, 50, 80, 100]) {
        for (const yeastType of ['fresh', 'activeDry', 'dry']) {
          const calc = assertCalcUsesSchedule(
            method,
            makeSchedule(method),
            yeastType,
            'caputo00',
            'hand',
            method === 'biga' ? pct : 50,
            method === 'poolish' ? pct : 35,
          );
          const share = calc.preferment.flour / calc.total.flour;
          assert.ok(Math.abs(calc.preferment.yeast - calc.total.yeast * share) <= 0.011);
          if (share < 1) assert.ok(calc.main.yeast > 0, `${method}/${pct}%/${yeastType}: final-dough yeast must be included`);
        }
      }
    }

    for (const lang of ['hr', 'en', 'de', 'sl']) {
      for (const method of ['biga', 'poolish']) {
        for (const mixing of ['hand', 'mixer']) {
          const fresh = prefermentSteps.getYeastAwarePrefermentSteps(lang, method, mixing, 'fresh');
          const dry = prefermentSteps.getYeastAwarePrefermentSteps(lang, method, mixing, 'dry');
          assert.notEqual(fresh.p1.steps[0], dry.p1.steps[0]);
          assert.notEqual(fresh.p2.steps[1], dry.p2.steps[1]);
        }
      }
    }
  }
}

const beforeExampleSchedule = getFermentationSchedule({
  method: 'direct',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
});
const afterExampleSchedule = makeSchedule('direct');
const beforeExample = doughFor('direct', beforeExampleSchedule);
const afterExample = doughFor('direct', afterExampleSchedule);
assert.equal(beforeExample.eTotal, 5.2);
assert.equal(afterExample.eTotal, 5.9);
assert.ok(afterExample.total.yeast < beforeExample.total.yeast);

const homeNow = new Date('2026-10-18T12:00:00.000Z');
function makeActualDirectHomePlan(availableHours, style = 'romana') {
  const bake = new Date(homeNow.getTime() + availableHours * 60 * 60 * 1000);
  return createDirectHomePizzaPlan({
    style,
    romanFormat: style === 'romana' ? 'tonda' : undefined,
    pizzas: 4,
    ballWeight: 260,
    method: 'direct',
    bakeAt: bake,
    roomTemp: 22,
    fridgeTemp: 4,
    ovenType: 'homeStone',
    ovenTemp: 300,
    flourType: 'caputo00',
    mixing: 'hand',
  }, getHomeFlourStrengthInput('caputo00', { source: 'w', w: 280 }), 63, 'fresh', homeNow, false);
}

const actualColdHomePlan = makeActualDirectHomePlan(36);
assert.ok(actualColdHomePlan, 'production Direct Home planner returns a cold Pro candidate');
assert.ok(actualColdHomePlan.schedule.fridgeHours > 0);
assert.ok(isHomeScheduleDurationValid(actualColdHomePlan.schedule));
const actualColdHomeSchedule = getDirectHomeFermentationSchedule(actualColdHomePlan.schedule, 22, 4);
assert.equal(sumHours(actualColdHomeSchedule, 'final-rest', 'room'), actualColdHomePlan.schedule.roomAfterFridgeHours);
assert.equal(actualColdHomeSchedule.phases.filter((phase) => phase.kind === 'final-rest').length,
  actualColdHomePlan.schedule.roomAfterFridgeHours > 0 ? 1 : 0);
const actualColdHomeCalc = doughCalc({
  pizzas: 4,
  ballWeight: 260,
  hydration: 63,
  saltPct: 2.8,
  oilPct: 2,
  method: 'direct',
  roomHours: 0,
  roomTemp: 22,
  fridgeHours: 0,
  fridgeTemp: 4,
  yeastType: 'fresh',
  flourType: 'caputo00',
  mixing: 'hand',
  fermentationSchedule: actualColdHomeSchedule,
});
assert.equal(actualColdHomeCalc.eTotal, Math.round(rawExposure(actualColdHomeSchedule) * 10) / 10);
const actualColdHomeSteps = reversePlan(
  actualColdHomePlan.schedule.bakeAt,
  'direct',
  actualColdHomePlan.schedule.style,
  translations.hr.planner.stepCopy,
  actualColdHomePlan.schedule,
  null,
  null,
  'hr',
  undefined,
  22,
  actualColdHomeSchedule,
);
assert.ok(actualColdHomeSteps.some((step) => step.at.getTime() === actualColdHomePlan.schedule.startAt.getTime()));
if (actualColdHomePlan.schedule.roomAfterFridgeHours > 0) {
  const expectedFinalRestAt = (actualColdHomePlan.schedule.fridgeAt ?? actualColdHomePlan.schedule.ballingAt).getTime()
    + actualColdHomePlan.schedule.fridgeHours * 60 * 60 * 1000;
  assert.ok(actualColdHomeSteps.some((step) => step.at.getTime() === expectedFinalRestAt));
}

const actualBigaHomePlan = createBigaHomePizzaPlan({
  style: 'neapolitan',
  pizzas: 4,
  ballWeight: 260,
  bakeAt: actualColdHomePlan.schedule.bakeAt,
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
}, homeNow);
const actualPoolishHomePlan = createPoolishHomePizzaPlan({
  style: 'neapolitan',
  pizzas: 4,
  ballWeight: 260,
  bakeAt: actualColdHomePlan.schedule.bakeAt,
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
  poolishHours: 24,
}, homeNow);
assert.ok(actualBigaHomePlan, 'production Biga Home planner returns a prior Beginner schedule');
assert.ok(actualPoolishHomePlan, 'production Poolish Home planner returns a prior Beginner schedule');
const previousBeginnerSchedules = {
  isBeginner: false,
  bakeAt: actualColdHomePlan.schedule.bakeAt,
  directSchedule: actualColdHomePlan.schedule,
  directScheduleMode: 'beginner',
  bigaSchedule: actualBigaHomePlan.schedule,
  poolishSchedule: actualPoolishHomePlan.schedule,
};
const proAfterBeginner = selectPlannerHomeSchedules(previousBeginnerSchedules);
assert.equal(proAfterBeginner.direct, null);
assert.equal(proAfterBeginner.biga, null);
assert.equal(proAfterBeginner.poolish, null);
const proWithCurrentDirect = selectPlannerHomeSchedules({
  ...previousBeginnerSchedules,
  directScheduleMode: 'pro',
});
assert.equal(proWithCurrentDirect.direct, actualColdHomePlan.schedule);
assert.equal(proWithCurrentDirect.biga, null);
assert.equal(proWithCurrentDirect.poolish, null);
const restoredBeginnerSchedules = selectPlannerHomeSchedules({
  ...previousBeginnerSchedules,
  isBeginner: true,
});
assert.equal(restoredBeginnerSchedules.direct, actualColdHomePlan.schedule);
assert.equal(restoredBeginnerSchedules.biga, actualBigaHomePlan.schedule);
assert.equal(restoredBeginnerSchedules.poolish, actualPoolishHomePlan.schedule);

const actualRoomOnlyHomePlan = [1.25, 1.5, 2, 3, 4, 6]
  .map((hours) => makeActualDirectHomePlan(hours, 'neapolitan'))
  .find((plan) => plan && plan.schedule.fridgeHours === 0);
assert.ok(actualRoomOnlyHomePlan, 'production Direct Home planner returns a room-only plan');
assert.ok(isHomeScheduleDurationValid(actualRoomOnlyHomePlan.schedule));
const actualRoomOnlySchedule = getDirectHomeFermentationSchedule(actualRoomOnlyHomePlan.schedule, 22, 4);
assert.equal(sumHours(actualRoomOnlySchedule, 'final-rest', 'room'), actualRoomOnlyHomePlan.schedule.roomAfterFridgeHours);
assert.equal(actualRoomOnlySchedule.phases.some((phase) => phase.environment === 'fridge'), false);
const actualRoomOnlySteps = reversePlan(
  actualRoomOnlyHomePlan.schedule.bakeAt,
  'direct',
  'neapolitan',
  translations.en.planner.stepCopy,
  actualRoomOnlyHomePlan.schedule,
  null,
  null,
  'en',
  undefined,
  22,
  actualRoomOnlySchedule,
);
assert.equal(actualRoomOnlySteps.some((step) => step.title === translations.en.planner.stepCopy.coldTitle), false);

console.log(
  `Pro final-rest alignment passed. Direct 4×260 g @22°C, 2 h room + 24 h fridge: ` +
  `yeast ${beforeExample.total.yeast.toFixed(2)} g -> ${afterExample.total.yeast.toFixed(2)} g ` +
  `(eTotal ${beforeExample.eTotal} -> ${afterExample.eTotal}; ${restMinutes} min final rest).`,
);
