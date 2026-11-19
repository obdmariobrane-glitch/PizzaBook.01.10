import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const calculatorSource = fs.readFileSync(path.join(root, 'src/calculator.ts'), 'utf8');
const translationsSource = fs.readFileSync(path.join(root, 'src/i18n/translations.ts'), 'utf8');
const screenSource = fs.readFileSync(path.join(root, 'app/(tabs)/index.tsx'), 'utf8');
const loadTypeScriptModule = (source, filename) => {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const require = (specifier) => {
    if (filename === 'calculator.ts' && specifier === './proMethods/bigaPoolish') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/proMethods/bigaPoolish.ts'), 'utf8'),
        'proMethods/bigaPoolish.ts',
      );
    }
    if (filename === 'prefermentSteps.ts' && specifier === './spiralMixing') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/i18n/spiralMixing.ts'), 'utf8'),
        'spiralMixing.ts',
      );
    }
    if (filename === 'spiralMixing.ts' && specifier === './proIceWaterInstructions') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/i18n/proIceWaterInstructions.ts'), 'utf8'),
        'proIceWaterInstructions.ts',
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
  getSpongeFermentationSchedule,
  getHomeFlourStrengthInput,
  getTemperingWindow,
  calculateDirectFermentationScheduleExposure,
  calculateDirectFreshYeastPct,
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
  const expectedExposure = method === 'direct'
    ? calculateDirectFermentationScheduleExposure(schedule.phases)
    : Math.max(0.5, rawExposure(schedule));
  const expectedYeastPct = method === 'direct'
    ? calculateDirectFreshYeastPct(expectedExposure) * YEAST_MASS_FACTORS[yeastType]
    : (0.5 / expectedExposure) * YEAST_MASS_FACTORS[yeastType];
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

assert.match(screenSource, /roomBeforeFridgeHours: 0,[\s\S]*?roomAfterFridgeHours: roomHours/,
  'PRO Direct Napolitana assigns the selected room interval only after the fridge');
assert.match(screenSource, /const proCalculationFermentationSchedule = useMemo/,
  'the original schedule remains available to the locked dough calculation');
assert.match(screenSource, /roomBeforeFridgeHours: roomHours,[\s\S]*?roomAfterFridgeHours: 0/,
  'the locked dough calculation retains its previous Direct Napolitana exposure');
assert.match(screenSource, /fermentationSchedule: proCalculationFermentationSchedule/,
  'doughCalc receives the unchanged calculation schedule, not the presentation schedule');
assert.match(screenSource, /getProFermentationPresentationSchedule\(/,
  'PRO instructions and Planner use the isolated presentation schedule');
assert.match(calculatorSource, /if \(style === 'romana' && fridgeHours > 0\)[\s\S]*?phase\.kind === 'final-rest' && phase\.environment === 'room'[\s\S]*?kind: 'final-rest'/,
  'Romana presentation schedules place one selected final rest after the fridge');
assert.match(screenSource, /finalRestMinutes: proFinalRestMinutes/,
  'the Direct Napolitana instruction builder uses the presentation schedule duration');
assert.match(screenSource, /id: 'tempering', seconds: finalRestMinutes \* 60/,
  'the PRO Direct final-rest timer uses the same presentation duration');
assert.match(calculatorSource, /if \(fridgeHours > 0\) \{[\s\S]*?phases: schedule\.phases\.filter\(\(phase\) => !\(phase\.kind === 'final' && phase\.environment === 'room'\)/,
  'positive-fridge Biga presentation schedules omit the duplicate pre-fridge final-room interval');
assert.match(calculatorSource, /if \(fridgeHours > 0\) \{[\s\S]*?phases: schedule\.phases\.filter\(\(phase\) => !\(phase\.kind === 'final' && phase\.environment === 'room'\)/,
  'positive-fridge Poolish and Sponge presentation schedules omit the duplicate final-room interval without changing preferment phases');
assert.match(screenSource, /adaptFermentationSteps\(path\.p3\.steps, roomHours, fridgeHours, fridgeTemp, lang, false\)/,
  'Poolish P3 short room rests are not replaced with the selected final-room duration');
assert.match(screenSource, /seconds: poolishFinalRoomHours \* 3600/,
  'Poolish P3 final-room timer uses the selected schedule duration');
assert.match(screenSource, /id: 'sponge-final-room'[\s\S]*?seconds: poolishFinalRoomHours \* 3600/,
  'Sponge P3 final-room timer uses the selected schedule duration');
assert.match(screenSource, /spongeP3SourceSteps = isSponge[\s\S]*?appendFinalRoomInstruction\(p3Steps\)/,
  'Sponge P3 instructions include the selected final-room duration');
for (const localizedTempering of [
  'ostavite ih pokrivene ${temperingDuration ||',
  'leave them covered for ${temperingDuration ||',
  'lassen Sie sie ${temperingDuration ||',
  'jih pokrite pustite ${temperingDuration ||',
]) {
  assert.ok(screenSource.includes(localizedTempering), `PRO Direct final-room instructions use the selected duration: ${localizedTempering}`);
}

for (const selectedRoomHours of [2, 3, 4]) {
  for (const selectedFridgeHours of [24, 0]) {
    const calculationSchedule = getFermentationSchedule({
      method: 'direct',
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
    });
    const presentationSchedule = {
      ...calculationSchedule,
      phases: calculationSchedule.phases.map((phase) =>
        phase.kind === 'final' && phase.environment === 'room'
          ? { ...phase, kind: 'final-rest' }
          : phase,
      ),
    };
    const calculationDough = doughCalc({
      pizzas: 4,
      ballWeight: 260,
      hydration: 63,
      saltPct: 2.8,
      oilPct: 2,
      method: 'direct',
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      yeastType: 'fresh',
      flourType: 'caputo00',
      mixing: 'hand',
      fermentationSchedule: calculationSchedule,
    });
    assert.equal(sumHours(calculationSchedule, 'final', 'room'), selectedRoomHours);
    assert.equal(sumHours(calculationSchedule, 'final-rest', 'room'), 0);
    assert.equal(sumHours(presentationSchedule, 'final', 'room'), 0);
    assert.equal(sumHours(presentationSchedule, 'final-rest', 'room'), selectedRoomHours);
    assert.equal(
      calculationDough.eTotal,
      Math.round(calculateDirectFermentationScheduleExposure(calculationSchedule.phases) * 10) / 10,
      `Direct ${selectedRoomHours}h/${selectedFridgeHours}h leaves the calculation exposure unchanged`,
    );
    assert.equal(
      presentationSchedule.phases.reduce((total, phase) => total + phase.hours, 0),
      calculationSchedule.phases.reduce((total, phase) => total + phase.hours, 0),
      `Direct ${selectedRoomHours}h/${selectedFridgeHours}h does not double-count the room interval`,
    );

    const planSchedule = {
      startAt: new Date(bakeAt.getTime() - (selectedRoomHours + selectedFridgeHours) * 3600000),
      bakeAt,
      roomBeforeFridgeHours: 0,
      fridgeHours: selectedFridgeHours,
      roomAfterFridgeHours: selectedRoomHours,
      prefermentHours: 0,
    };
    for (const variant of [
      { style: 'neapolitan', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'teglia' },
      { style: 'ny_style', romanFormat: 'tonda' },
    ]) {
      for (const lang of ['hr', 'en', 'de', 'sl']) {
        const copy = translations[lang].planner.stepCopy;
        const tegliaSettings = {
          romanFormat: variant.romanFormat,
          trayCount: 1,
          doughPerTray: 475,
          trayWidth: 30,
          trayLength: 40,
        };
        const plannerSteps = reversePlan(
          bakeAt,
          'direct',
          variant.style,
          copy,
          variant.style === 'neapolitan' ? planSchedule : null,
          null,
          null,
          lang,
          undefined,
          settings.roomTemp,
          presentationSchedule,
          tegliaSettings,
        );
        const expectedDuration = ({
          hr: `${selectedRoomHours} sati`,
          en: `${selectedRoomHours} hours`,
          de: `${selectedRoomHours} Stunden`,
          sl: `${selectedRoomHours} ur`,
        })[lang];
        const finalRoomAt = bakeAt.getTime() - selectedRoomHours * 3600000;
        const finalRoomStep = plannerSteps.find((step) =>
          step.at.getTime() === finalRoomAt && step.desc.includes(expectedDuration),
        );
        assert.ok(finalRoomStep, `${variant.style}/${variant.romanFormat}/${lang} ${selectedRoomHours}h has a matching Planner final-room step`);
        const coldTitles = new Set([copy.coldTitle, copy.directHomeTegliaCopy?.coldMassTitle]);
        const fridgeStep = plannerSteps.find((step) => coldTitles.has(step.title));
        if (selectedFridgeHours > 0) {
          assert.ok(fridgeStep, `${variant.style}/${variant.romanFormat}/${lang} has its selected fridge phase`);
          assert.equal((bakeAt.getTime() - fridgeStep.at.getTime()) / 3600000, selectedRoomHours + selectedFridgeHours);
        } else {
          assert.equal(fridgeStep, undefined, `${variant.style}/${variant.romanFormat}/${lang} zero fridge has no fridge/removal event`);
        }
        assert.equal(
          (bakeAt.getTime() - planSchedule.startAt.getTime()) / 3600000,
          selectedRoomHours + selectedFridgeHours,
          `${variant.style}/${variant.romanFormat}/${lang} keeps the room interval in the total exactly once`,
        );
      }
    }
  }
}

for (const selectedRoomHours of [2, 3, 4]) {
  for (const selectedFridgeHours of [24, 0]) {
    const calculationSchedule = getFermentationSchedule({
      method: 'biga',
      prefermentHours: 24,
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      roomAfterFridgeHours: selectedFridgeHours > 0 ? selectedRoomHours : 0,
    });
    const presentationSchedule = selectedFridgeHours > 0
      ? {
        ...calculationSchedule,
        phases: calculationSchedule.phases.filter(
          (phase) => !(phase.kind === 'final' && phase.environment === 'room'),
        ),
      }
      : calculationSchedule;
    assert.equal(sumHours(calculationSchedule, 'preferment', 'room') + sumHours(calculationSchedule, 'preferment', 'fridge'), 24);
    assert.equal(sumHours(presentationSchedule, 'final', 'room'), selectedFridgeHours > 0 ? 0 : selectedRoomHours);
    assert.equal(sumHours(presentationSchedule, 'final-rest', 'room'), selectedFridgeHours > 0 ? selectedRoomHours : 0);
    assert.equal(
      sumHours(presentationSchedule, 'final', 'room')
        + sumHours(presentationSchedule, 'final', 'fridge')
        + sumHours(presentationSchedule, 'final-rest', 'room'),
      selectedRoomHours + selectedFridgeHours,
      `Biga ${selectedRoomHours}h/${selectedFridgeHours}h has no duplicate final room interval`,
    );
    const calculationDough = doughCalc({
      pizzas: 4,
      ballWeight: 260,
      hydration: 63,
      saltPct: 2.8,
      oilPct: 2,
      method: 'biga',
      bigaPct: 50,
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      prefermentHours: 24,
      yeastType: 'fresh',
      flourType: 'caputo00',
      mixing: 'hand',
      fermentationSchedule: calculationSchedule,
    });
    assert.equal(
      calculationDough.eTotal,
      Math.round(Math.max(0.5, rawExposure(calculationSchedule)) * 10) / 10,
      `Biga ${selectedRoomHours}h/${selectedFridgeHours}h keeps the locked calculation schedule`,
    );

    for (const variant of [
      { style: 'neapolitan', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'teglia' },
      { style: 'ny_style', romanFormat: 'tonda' },
    ]) {
      for (const lang of ['hr', 'en', 'de', 'sl']) {
        const copy = translations[lang].planner.stepCopy;
        const tegliaSettings = { romanFormat: variant.romanFormat, trayCount: 1, doughPerTray: 475, trayWidth: 30, trayLength: 40 };
        const plannerSteps = reversePlan(
          bakeAt,
          'biga',
          variant.style,
          copy,
          null,
          null,
          null,
          lang,
          undefined,
          settings.roomTemp,
          presentationSchedule,
          tegliaSettings,
        );
        const expectedDuration = ({
          hr: `${selectedRoomHours} sati`,
          en: `${selectedRoomHours} hours`,
          de: `${selectedRoomHours} Stunden`,
          sl: `${selectedRoomHours} ur`,
        })[lang];
        const expectedRoomTime = bakeAt.getTime() - selectedRoomHours * 3600000;
        const finalRoomStep = plannerSteps.find((step) =>
          step.at.getTime() === expectedRoomTime && step.desc.includes(expectedDuration),
        );
        if (selectedFridgeHours > 0) {
          assert.ok(finalRoomStep, `${variant.style}/${variant.romanFormat}/${lang} Biga has matching selected final tempering`);
        } else {
          const roomOnlyBulk = plannerSteps.find((step) => step.title === copy.finalBulkTitle && step.at.getTime() === expectedRoomTime);
          assert.ok(roomOnlyBulk, `${variant.style}/${variant.romanFormat}/${lang} Biga preserves the room-only flow`);
        }
        const coldStep = plannerSteps.find((step) => step.title === copy.coldTitle || step.title === copy.directHomeTegliaCopy?.coldMassTitle);
        if (selectedFridgeHours > 0) {
          assert.ok(coldStep, `${variant.style}/${variant.romanFormat}/${lang} Biga retains its cold phase`);
          assert.equal((bakeAt.getTime() - coldStep.at.getTime()) / 3600000, selectedRoomHours + selectedFridgeHours);
        } else {
          assert.equal(coldStep, undefined, `${variant.style}/${variant.romanFormat}/${lang} Biga 0h fridge has no removal step`);
        }
      }
    }
  }
}

for (const selectedRoomHours of [2, 3, 4]) {
  for (const selectedFridgeHours of [24, 0]) {
    const calculationSchedule = getFermentationSchedule({
      method: 'poolish',
      prefermentHours: 24,
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      roomAfterFridgeHours: selectedFridgeHours > 0 ? selectedRoomHours : 0,
    });
    const presentationSchedule = selectedFridgeHours > 0
      ? {
        ...calculationSchedule,
        phases: calculationSchedule.phases.filter(
          (phase) => !(phase.kind === 'final' && phase.environment === 'room'),
        ),
      }
      : calculationSchedule;
    const prefermentHours = (schedule) => schedule.phases
      .filter((phase) => phase.kind === 'preferment')
      .reduce((total, phase) => total + phase.hours, 0);
    assert.equal(prefermentHours(calculationSchedule), 24);
    assert.equal(prefermentHours(presentationSchedule), 24, 'Poolish preferment fermentation remains unchanged');
    assert.equal(sumHours(presentationSchedule, 'final', 'room'), selectedFridgeHours > 0 ? 0 : selectedRoomHours);
    assert.equal(sumHours(presentationSchedule, 'final-rest', 'room'), selectedFridgeHours > 0 ? selectedRoomHours : 0);
    assert.equal(
      sumHours(presentationSchedule, 'final', 'room')
        + sumHours(presentationSchedule, 'final', 'fridge')
        + sumHours(presentationSchedule, 'final-rest', 'room'),
      selectedRoomHours + selectedFridgeHours,
      `Poolish ${selectedRoomHours}h/${selectedFridgeHours}h does not double-count final room time`,
    );
    const calculationDough = doughCalc({
      pizzas: 4,
      ballWeight: 260,
      hydration: 63,
      saltPct: 2.8,
      oilPct: 2,
      method: 'poolish',
      poolishPct: 35,
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      prefermentHours: 24,
      yeastType: 'fresh',
      flourType: 'caputo00',
      mixing: 'hand',
      fermentationSchedule: calculationSchedule,
    });
    assert.equal(
      calculationDough.eTotal,
      Math.round(Math.max(0.5, rawExposure(calculationSchedule)) * 10) / 10,
      `Poolish ${selectedRoomHours}h/${selectedFridgeHours}h keeps the locked calculation schedule`,
    );

    for (const variant of [
      { style: 'neapolitan', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'tonda' },
      { style: 'romana', romanFormat: 'teglia' },
      { style: 'ny_style', romanFormat: 'tonda' },
    ]) {
      for (const lang of ['hr', 'en', 'de', 'sl']) {
        const copy = translations[lang].planner.stepCopy;
        const tegliaSettings = { romanFormat: variant.romanFormat, trayCount: 1, doughPerTray: 475, trayWidth: 30, trayLength: 40 };
        const plannerSteps = reversePlan(
          bakeAt,
          'poolish',
          variant.style,
          copy,
          null,
          null,
          null,
          lang,
          undefined,
          settings.roomTemp,
          presentationSchedule,
          tegliaSettings,
        );
        const expectedDuration = ({
          hr: `${selectedRoomHours} sati`,
          en: `${selectedRoomHours} hours`,
          de: `${selectedRoomHours} Stunden`,
          sl: `${selectedRoomHours} ur`,
        })[lang];
        const expectedRoomTime = bakeAt.getTime() - selectedRoomHours * 3600000;
        const roomEvents = plannerSteps.filter((step) => step.at.getTime() === expectedRoomTime);
        assert.ok(
          roomEvents.some((step) => step.desc.includes(expectedDuration) || step.desc.includes(`${selectedRoomHours} h`)),
          `${variant.style}/${variant.romanFormat}/${lang} Poolish Planner shows selected ${selectedRoomHours}h: ${JSON.stringify(roomEvents)}`,
        );
        const coldStep = plannerSteps.find((step) => step.title === copy.coldTitle || step.title === copy.directHomeTegliaCopy?.coldMassTitle);
        if (selectedFridgeHours > 0) {
          assert.ok(coldStep, `${variant.style}/${variant.romanFormat}/${lang} Poolish retains its selected cold phase`);
          assert.equal((bakeAt.getTime() - coldStep.at.getTime()) / 3600000, selectedRoomHours + selectedFridgeHours);
        } else {
          assert.equal(coldStep, undefined, `${variant.style}/${variant.romanFormat}/${lang} Poolish 0h fridge has no removal step`);
        }
      }
    }
  }
}

for (const { selectedRoomHours, selectedFridgeHours } of [
  { selectedRoomHours: 3, selectedFridgeHours: 24 },
  { selectedRoomHours: 2, selectedFridgeHours: 24 },
  { selectedRoomHours: 4, selectedFridgeHours: 48 },
  { selectedRoomHours: 3, selectedFridgeHours: 0 },
]) {
    const calculationSchedule = getSpongeFermentationSchedule(
      8,
      21,
      selectedRoomHours,
      settings.roomTemp,
      selectedFridgeHours,
      settings.fridgeTemp,
      selectedFridgeHours > 0 ? selectedRoomHours : 0,
    );
    const presentationSchedule = selectedFridgeHours > 0
      ? {
        ...calculationSchedule,
        phases: calculationSchedule.phases.filter(
          (phase) => !(phase.kind === 'final' && phase.environment === 'room'),
        ),
      }
      : calculationSchedule;
    const prefermentHours = (schedule) => schedule.phases
      .filter((phase) => phase.kind === 'preferment')
      .reduce((total, phase) => total + phase.hours, 0);
    assert.equal(prefermentHours(calculationSchedule), 8);
    assert.equal(prefermentHours(presentationSchedule), 8, 'Sponge fermentation duration remains unchanged');
    assert.equal(sumHours(presentationSchedule, 'final', 'room'), selectedFridgeHours > 0 ? 0 : selectedRoomHours);
    assert.equal(sumHours(presentationSchedule, 'final-rest', 'room'), selectedFridgeHours > 0 ? selectedRoomHours : 0);
    assert.equal(
      sumHours(presentationSchedule, 'final', 'room')
        + sumHours(presentationSchedule, 'final', 'fridge')
        + sumHours(presentationSchedule, 'final-rest', 'room'),
      selectedRoomHours + selectedFridgeHours,
      `Sponge ${selectedRoomHours}h/${selectedFridgeHours}h does not double-count final room time`,
    );
    const calculationDough = doughCalc({
      pizzas: 4,
      ballWeight: 260,
      hydration: 63,
      saltPct: 2.8,
      oilPct: 2,
      method: 'sponge',
      spongeFlourPct: 35,
      spongeHydrationPct: 100,
      spongeFermentationHours: 8,
      spongeFermentationTempC: 21,
      spongeYeastMode: 'automatic',
      spongeManualYeastGrams: 0,
      spongeYeastType: 'fresh',
      roomHours: selectedRoomHours,
      roomTemp: settings.roomTemp,
      fridgeHours: selectedFridgeHours,
      fridgeTemp: settings.fridgeTemp,
      prefermentHours: 8,
      yeastType: 'fresh',
      flourType: 'caputo00',
      mixing: 'hand',
      fermentationSchedule: calculationSchedule,
    });
    assert.equal(
      calculationDough.eTotal,
      Math.round(Math.max(0.5, rawExposure(calculationSchedule)) * 10) / 10,
      `Sponge ${selectedRoomHours}h/${selectedFridgeHours}h keeps the locked calculation schedule`,
    );

    for (const lang of ['hr', 'en', 'de', 'sl']) {
      const copy = translations[lang].planner.stepCopy;
      const spongePreparation = { title: 'Sponge preparation', steps: ['Prepare the Sponge.'] };
      const plannerSteps = reversePlan(
        bakeAt,
        'sponge',
        'neapolitan',
        copy,
        null,
        null,
        null,
        lang,
        undefined,
        settings.roomTemp,
        calculationSchedule,
        { romanFormat: 'tonda', trayCount: 1, doughPerTray: 475, trayWidth: 30, trayLength: 40 },
        undefined,
        undefined,
        20,
        undefined,
        spongePreparation,
      );
      const getPhase = (phaseId) => plannerSteps.find((step) => step.phaseId === phaseId);
      const atOffset = (step, hours) => (bakeAt.getTime() - step.at.getTime()) / 3600000 === hours;
      const localizedDuration = (hours) => ({
        hr: `${hours} ${hours === 1 ? 'sat' : 'sati'}`,
        en: `${hours} ${hours === 1 ? 'hour' : 'hours'}`,
        de: `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`,
        sl: `${hours} ${hours === 1 ? 'ura' : 'ur'}`,
      })[lang];
      const spongePrepStep = getPhase('sponge.preparation');
      const finalMixStep = getPhase('sponge.finalMix');
      const finalRoomStep = getPhase('sponge.finalRoom');
      const shapingStep = getPhase('sponge.balling');
      const preheatStep = getPhase('sponge.preheat');
      const bakeStep = getPhase('sponge.bake');
      const localizedBallRestTitle = ({
        hr: 'Odmor kuglica na sobnoj temperaturi',
        en: 'Dough-ball room rest',
        de: 'Teigkugel-Ruhe bei Raumtemperatur',
        sl: 'Počitek kroglic pri sobni temperaturi',
      })[lang];
      assert.ok(spongePrepStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes Sponge preparation`);
      assert.equal(spongePrepStep.title, spongePreparation.title);
      assert.ok(atOffset(spongePrepStep, 8 + selectedRoomHours + selectedFridgeHours));
      assert.ok(finalMixStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes final mixing`);
      assert.equal(finalMixStep.title, copy.refreshTitle);
      assert.ok(atOffset(finalMixStep, selectedRoomHours + selectedFridgeHours));
      assert.ok(finalRoomStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes final room fermentation`);
      assert.equal(finalRoomStep.title, localizedBallRestTitle);
      assert.ok(finalRoomStep.desc.includes(localizedDuration(selectedRoomHours)));
      assert.ok(atOffset(finalRoomStep, selectedRoomHours));
      assert.ok(shapingStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes shaping`);
      assert.ok(atOffset(shapingStep, selectedRoomHours));
      assert.ok(plannerSteps.indexOf(shapingStep) < plannerSteps.indexOf(finalRoomStep), `${lang}: balling precedes the selected room rest`);
      assert.ok(preheatStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes oven preheating`);
      assert.ok(atOffset(preheatStep, 20 / 60), `${lang}: selected preheat offset is preserved`);
      assert.ok(bakeStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes baking`);
      assert.equal(bakeStep.at.getTime(), bakeAt.getTime());
      if (selectedFridgeHours > 0) {
        const coldStep = getPhase('sponge.fridge');
        const removalStep = getPhase('sponge.fridgeRemoval');
        assert.ok(coldStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes cold fermentation`);
        assert.ok(coldStep.desc.includes(localizedDuration(selectedFridgeHours)));
        assert.ok(atOffset(coldStep, selectedRoomHours + selectedFridgeHours));
        assert.ok(removalStep, `${lang}/${selectedRoomHours}h/${selectedFridgeHours}h includes fridge removal`);
        assert.match(removalStep.desc, /shape|oblikuj|formen/i);
        assert.ok(atOffset(removalStep, selectedRoomHours));
        assert.ok(plannerSteps.indexOf(finalMixStep) < plannerSteps.indexOf(coldStep));
        assert.ok(plannerSteps.indexOf(coldStep) < plannerSteps.indexOf(removalStep));
        assert.ok(plannerSteps.indexOf(removalStep) < plannerSteps.indexOf(shapingStep));
      } else {
        assert.equal(getPhase('sponge.fridge'), undefined, `${lang}: no cold phase at 0h fridge`);
        assert.equal(getPhase('sponge.fridgeRemoval'), undefined, `${lang}: no fridge-removal event at 0h fridge`);
        assert.ok(plannerSteps.indexOf(finalMixStep) < plannerSteps.indexOf(shapingStep));
      }
      assert.ok(plannerSteps.indexOf(finalRoomStep) < plannerSteps.indexOf(preheatStep));
      assert.ok(plannerSteps.indexOf(preheatStep) < plannerSteps.indexOf(bakeStep));
    }
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
          const directSchedule = makeSchedule('direct');
          const expectedYeastPct = calculateDirectFreshYeastPct(calculateDirectFermentationScheduleExposure(directSchedule.phases)) * YEAST_MASS_FACTORS[yeastType];
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
assert.equal(beforeExample.eTotal, Math.round(calculateDirectFermentationScheduleExposure(beforeExampleSchedule.phases) * 10) / 10);
assert.equal(afterExample.eTotal, Math.round(calculateDirectFermentationScheduleExposure(afterExampleSchedule.phases) * 10) / 10);
assert.ok(afterExample.eTotal > beforeExample.eTotal);
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
assert.equal(actualColdHomeCalc.eTotal, Math.round(calculateDirectFermentationScheduleExposure(actualColdHomeSchedule.phases) * 10) / 10);
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
