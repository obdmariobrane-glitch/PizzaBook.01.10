#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const frontend = path.resolve(__dirname, '../../frontend');
const ts = require(path.join(frontend, 'node_modules/typescript'));

const originalTs = Module._extensions['.ts'];
const originalTsx = Module._extensions['.tsx'];

function transpileTs(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      sourceMap: false,
    },
    fileName,
  }).outputText;
}

Module._extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(transpileTs(source, filename), filename);
};
Module._extensions['.tsx'] = Module._extensions['.ts'];

function load(relative) {
  return require(path.join(frontend, relative));
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => item instanceof Date ? item.toISOString() : item));
}

let beginnerRuntimeCache = null;

function loadBeginnerRuntime() {
  if (beginnerRuntimeCache) return beginnerRuntimeCache;

  const file = path.join(frontend, 'app/(tabs)/index.tsx');
  let source = fs.readFileSync(file, 'utf8');
  source += '\nmodule.exports.__beginnerRuntime = {'
    + ' getDetailedDirectSteps,'
    + ' getDetailedDirectStepsLocalized,'
    + ' buildBeginnerUnscheduledDirectSteps,'
    + ' buildBeginnerTegliaHomeSteps,'
    + ' buildBeginnerDirectHomeSteps,'
    + ' getBeginnerPhaseAFlourBehavior,'
    + ' flourName,'
    + ' formatBeginnerClockTime'
    + '};\n';

  const compiled = transpileTs(source, file);
  const dirname = path.dirname(file);

  const reactStub = {
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
    useSyncExternalStore: (subscribe, getSnapshot) => (typeof getSnapshot === 'function' ? getSnapshot() : undefined),
    createElement: () => null,
    Fragment: Symbol('fragment'),
  };

  const rnStub = {
    View() {}, Text() {}, ScrollView() {}, Pressable() {}, Modal() {}, TextInput() {}, Image() {}, ImageBackground() {}, ActivityIndicator() {},
    Platform: { OS: 'web' },
    Alert: { alert() {} },
    StyleSheet: { create: (value) => value },
  };

  const noop = function noop() {};
  const makeStub = () => new Proxy(noop, { get: () => makeStub(), apply: () => undefined });

  const allowedSourceModules = new Set([
    '../../src/i18n/prefermentSteps',
    '../../src/i18n/spiralMixing',
    '../../src/calculator',
    '../../src/units',
    '../../src/theme',
  ]);

  function resolveSourceModule(base, spec) {
    const root = path.resolve(base, spec);
    const candidates = [root, `${root}.ts`, `${root}.tsx`, `${root}.js`];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error(`Unable to resolve module: ${spec}`);
  }

  function localRequire(spec) {
    if (spec === 'react') return reactStub;
    if (spec === 'react-native') return rnStub;
    if (spec === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
    if (spec === 'expo-router') return { useLocalSearchParams: () => ({}), useRouter: () => ({ push() {}, replace() {} }) };
    if (spec === '@react-native-vector-icons/ionicons') return function Icon() { return null; };
    if (spec === 'expo-haptics') return {};
    if (spec === '@react-native-async-storage/async-storage') {
      return {
        __esModule: true,
        default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      };
    }
    if (spec.startsWith('../../assets/')) return spec;
    if (spec.startsWith('../../src/')) {
      if (allowedSourceModules.has(spec)) return resolveSourceModule(dirname, spec);
      if (spec === '../../src/components/GuidedRecipePanel') return { __esModule: true, default: function GuidedRecipePanel() { return null; } };
      if (spec === '../../src/components/MixingGuideCarousel') return { __esModule: true, default: function MixingGuideCarousel() { return null; } };
      return makeStub();
    }
    try {
      return require(spec);
    } catch {
      return makeStub();
    }
  }

  const moduleObj = { exports: {} };
  const wrapper = new vm.Script(`(function(exports,require,module,__filename,__dirname){${compiled}\n})`, { filename: file });
  wrapper.runInThisContext()(moduleObj.exports, localRequire, moduleObj, file, dirname);

  beginnerRuntimeCache = moduleObj.exports.__beginnerRuntime;
  if (!beginnerRuntimeCache) throw new Error('Failed to extract Beginner runtime from index.tsx');
  return beginnerRuntimeCache;
}

function buildBeginnerDirectInstructions(input) {
  const calc = load('src/calculator.ts');
  const pref = load('src/i18n/prefermentSteps.ts');
  const spiral = load('src/i18n/spiralMixing.ts');
  const units = load('src/units.ts');
  const beginner = loadBeginnerRuntime();

  const lang = input.lang || 'en';
  const style = input.style || 'neapolitan';
  const romanFormat = input.romanFormat || 'tonda';
  const isRomanTeglia = style === 'romana' && romanFormat === 'teglia';
  const mixing = input.mixing || 'hand';
  const mixingForExperience = mixing === 'spiral' ? 'mixer' : mixing;
  const beginnerMixing = calc.toBeginnerDirectMixing(mixingForExperience);
  const oven = input.ovenType || 'homeStone';
  const ovenTemp = Number.isFinite(input.ovenTemp) ? input.ovenTemp : 450;
  const pizzas = Number.isFinite(input.pizzas) ? input.pizzas : 2;
  const diameter = Number.isFinite(input.diameter) ? input.diameter : (style === 'ny_style' ? 35 : style === 'romana' ? 33 : 30);
  const trayWidth = Number.isFinite(input.trayWidth) ? input.trayWidth : 30;
  const trayLength = Number.isFinite(input.trayLength) ? input.trayLength : 40;
  const trayDoughWeight = Math.round(trayWidth * trayLength * 0.4);
  const customBallWeight = Number.isFinite(input.ballWeight) ? input.ballWeight : null;
  const effectiveBall = isRomanTeglia
    ? (customBallWeight ?? trayDoughWeight)
    : (customBallWeight ?? calc.beginnerBallWeightForDiameter(style, diameter));

  const roomTemp = Number.isFinite(input.roomTemp) ? input.roomTemp : 22;
  const fridgeTemp = Number.isFinite(input.fridgeTemp) ? input.fridgeTemp : 4;
  const roomHours = Number.isFinite(input.roomHours) ? input.roomHours : 5;
  const fridgeHours = Number.isFinite(input.fridgeHours) ? input.fridgeHours : 24;
  const flour = input.flourType || 'caputo00';
  const hydration = Number.isFinite(input.hydrationPct) ? input.hydrationPct : calc.beginnerHydrationFor(style, flour);
  const saltPct = Number.isFinite(input.saltPct) ? input.saltPct : (calc.PIZZA_STYLE_PROFILES[style]?.saltPct ?? 2.8);
  const oilPct = Number.isFinite(input.oilPct) ? input.oilPct : (calc.PIZZA_STYLE_PROFILES[style]?.oilPct ?? 2);
  const blendA = input.blendA || 'caputo00';
  const blendB = input.blendB || 'wholeWheat';
  const blendPctA = Number.isFinite(input.blendPctA) ? input.blendPctA : 70;
  const isCustom = flour === 'custom';
  const yeastType = input.yeastType || 'dry';
  const measurementSystem = input.measurementSystem || 'metric';
  const temperatureUnit = input.temperatureUnit || 'celsius';

  const now = new Date(input.now || new Date().toISOString());
  const bakeAt = input.bakeAt ? new Date(input.bakeAt) : null;
  const flourStrength = input.flourStrength || calc.getHomeFlourStrengthInput(flour, input.explicitFlourStrength ?? null);

  const homePlan = bakeAt
    ? calc.createDirectHomePizzaPlan({
      style,
      pizzas,
      ballWeight: effectiveBall,
      method: 'direct',
      romanFormat: isRomanTeglia ? romanFormat : undefined,
      ovenTemp,
      bakeAt,
      roomTemp,
      fridgeTemp,
      ovenType: oven,
      flourType: flour,
      mixing: beginnerMixing,
      beginnerScheduleMode: input.beginnerScheduleMode,
    }, flourStrength, hydration, yeastType, now, true)
    : null;

  const directHomeSchedule = homePlan?.schedule ?? null;
  const legacyHours = calc.getHomePlanLegacyFermentationHours(homePlan, roomHours, fridgeHours);

  const dough = calc.doughCalc({
    pizzas,
    ballWeight: effectiveBall,
    hydration,
    saltPct,
    oilPct,
    method: 'direct',
    bigaPct: 50,
    poolishPct: 50,
    roomHours: legacyHours.roomHours,
    roomTemp,
    fridgeHours: legacyHours.fridgeHours,
    fridgeTemp,
    prefermentHours: 0,
    mixing: calc.toCalculatorMixing(mixingForExperience),
    beginnerDirectStyle: flour !== 'glutenFree'
      ? (isRomanTeglia ? 'romanaTeglia' : style === 'romana' ? 'romanaTonda' : style === 'ny_style' ? 'newYork' : 'neapolitan')
      : undefined,
    beginnerDirectMixing: beginnerMixing,
    yeastType,
    flourType: flour,
  });

  const blendFlourAmounts = calc.splitFlourBlend(dough.main.flour, blendPctA);
  const psylliumGrams = flour === 'glutenFree' ? (dough.total.psyllium ?? 0) : 0;
  const beginnerDisplayFlour = directHomeSchedule
    ? Math.round((dough.totalDough - dough.total.water - dough.total.salt - dough.total.oil - dough.total.yeast - psylliumGrams) * 100) / 100
    : dough.total.flour;

  const dims = calc.dimensionsCalc(diameter, pizzas);
  const bakingTimeRange = calc.formatBakingTimeRange(oven, ovenTemp, lang);
  const waterTemperatureCalculation = dough.waterTemperature;
  const directRecipeRoomHours = directHomeSchedule?.roomAfterFridgeHours ?? roomHours;
  const directRecipeFridgeHours = directHomeSchedule?.fridgeHours ?? fridgeHours;
  const directStepIngredients = { ...dough.total, flour: beginnerDisplayFlour };

  const generatedDetailedDirectSteps = lang === 'hr'
    ? beginner.getDetailedDirectSteps(
      mixingForExperience,
      directStepIngredients,
      dough.totalDough,
      pizzas,
      effectiveBall,
      diameter,
      directRecipeFridgeHours,
      directRecipeRoomHours,
      oven,
      ovenTemp,
      roomTemp,
      dims.cheese,
      dims.sauce,
      undefined,
      undefined,
      flour,
      style === 'romana' && romanFormat === 'tonda',
      isRomanTeglia,
      style === 'ny_style',
      style === 'neapolitan',
      { width: trayWidth, length: trayLength },
      bakingTimeRange,
      waterTemperatureCalculation?.recommendedWaterTemp,
      true,
      beginner.getBeginnerPhaseAFlourBehavior(flour, blendA, blendB),
      waterTemperatureCalculation?.targetFinalDoughTemp,
      0,
      yeastType,
    )
    : beginner.getDetailedDirectStepsLocalized(
      lang,
      directStepIngredients,
      dough.totalDough,
      pizzas,
      effectiveBall,
      diameter,
      directRecipeFridgeHours,
      directRecipeRoomHours,
      roomTemp,
      dims.cheese,
      dims.sauce,
      oven,
      ovenTemp,
      bakingTimeRange,
      mixingForExperience,
      isRomanTeglia ? 'romanaTeglia' : style === 'romana' ? 'romanaTonda' : style === 'ny_style' ? 'newYork' : 'napolitana',
      flour,
      { width: trayWidth, length: trayLength },
      waterTemperatureCalculation?.recommendedWaterTemp,
      true,
      beginner.getBeginnerPhaseAFlourBehavior(flour, blendA, blendB),
      waterTemperatureCalculation?.targetFinalDoughTemp,
      0,
      yeastType,
    );

  const detailedDirectSteps = mixingForExperience === 'spiral' && generatedDetailedDirectSteps
    ? generatedDetailedDirectSteps.map((phase, phaseIndex) => {
      const mixingPhaseIndex = 0;
      if (phaseIndex !== mixingPhaseIndex) return phase;
      return {
        ...phase,
        title: spiral.getSpiralMixingTitle(lang, 'direct'),
        steps: spiral.getSpiralMixingSteps(lang, yeastType, { method: 'direct', hasOil: dough.total.oil > 0 }),
        stepInfo: undefined,
      };
    })
    : generatedDetailedDirectSteps;

  const beginnerDirectRecipeSteps = detailedDirectSteps
    ? detailedDirectSteps.map((phase, phaseIndex) => ({
      ...phase,
      steps: phase.steps.map((step) => {
        const labelled = pref.adaptDirectYeastStep(step, lang, yeastType);
        if (!isCustom || phaseIndex !== 0) return labelled;
        const blendDetail = ` (${blendFlourAmounts.first} g ${beginner.flourName(lang, blendA)} + ${blendFlourAmounts.second} g ${beginner.flourName(lang, blendB)})`;
        const blendFlourLabel = { hr: 'mješavine brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanice moke' }[lang] || 'flour blend';
        const neutralLabelled = labelled.replace(/(\d+(?:\.\d+)? g )(?:of flour|(?:pirovog )?brašna|Mehl|moke)/, `$1${blendFlourLabel}`);
        return neutralLabelled.replace(/(\d+(?:\.\d+)? g (?:mješavine brašna|flour blend|Mehlmischung|mešanice moke))/, `$1${blendDetail}`);
      }),
    }))
    : null;

  let finalPhases;
  let mode;
  let limitations = [];

  if (!beginnerDirectRecipeSteps) {
    finalPhases = [];
    mode = 'unavailable';
  } else if (!directHomeSchedule) {
    finalPhases = beginner.buildBeginnerUnscheduledDirectSteps(beginnerDirectRecipeSteps, fridgeTemp, lang);
    mode = 'unscheduled';
  } else {
    const phaseBPlan = calc.calculateBeginnerPhaseBPlan({
      durationMinutes: directHomeSchedule.phaseBMinutes ?? directHomeSchedule.roomBeforeFridgeHours * 60,
      flourBehavior: flour === 'glutenFree'
        ? 'glutenFree'
        : beginner.getBeginnerPhaseAFlourBehavior(flour, blendA, blendB) === 'standard'
          ? 'standard'
          : 'gentle',
      workflow: isRomanTeglia ? 'teglia' : 'round',
    });
    const weight = (grams, precise = false) => units.formatWeight(grams, measurementSystem, precise);
    finalPhases = isRomanTeglia
      ? beginner.buildBeginnerTegliaHomeSteps(
        beginnerDirectRecipeSteps,
        directHomeSchedule,
        phaseBPlan,
        roomTemp,
        lang,
        ovenTemp,
        bakingTimeRange,
        { width: trayWidth, length: trayLength },
        flour,
        dims.sauce,
        dims.cheese,
        temperatureUnit,
        pizzas,
        weight(effectiveBall),
        weight(dough.totalDough),
      )
      : beginner.buildBeginnerDirectHomeSteps(
        beginnerDirectRecipeSteps,
        directHomeSchedule,
        phaseBPlan,
        roomTemp,
        fridgeTemp,
        ovenTemp,
        oven,
        bakingTimeRange,
        lang,
        yeastType,
        style,
        diameter,
        dims.sauce,
        dims.cheese,
        flour,
        weight(dough.totalDough),
        weight(effectiveBall),
        pizzas,
      );
    mode = directHomeSchedule.fridgeHours > 0 ? 'fridgeRoom' : 'roomOnly';
    limitations = directHomeSchedule.limitations || [];
  }

  const numberedPhases = (finalPhases || []).map((phase, phaseIndex) => ({
    phase: phase.title,
    phaseIndex: phaseIndex + 1,
    steps: (phase.steps || []).map((step, stepIndex) => ({ number: stepIndex + 1, text: step })),
    stepInfo: phase.stepInfo || undefined,
    timers: phase.timers || undefined,
  }));

  const timestamp = (date) => ({
    iso: date.toISOString(),
    display: beginner.formatBeginnerClockTime(date, lang),
  });

  const scheduleTimestamps = directHomeSchedule
    ? {
      startAt: timestamp(directHomeSchedule.startAt),
      ballingAt: timestamp(directHomeSchedule.ballingAt),
      ...(directHomeSchedule.fridgeAt ? { fridgeAt: timestamp(directHomeSchedule.fridgeAt) } : {}),
      ...(directHomeSchedule.preheatAt ? { preheatAt: timestamp(directHomeSchedule.preheatAt) } : {}),
      bakeAt: timestamp(directHomeSchedule.bakeAt),
    }
    : null;

  return {
    kind: 'beginnerDirect',
    source: 'frontend/app/(tabs)/index.tsx extracted local functions',
    language: lang,
    style,
    romanFormat,
    flour,
    mixing,
    scheduled: !!directHomeSchedule,
    scheduleMode: mode,
    limitations,
    unavailableReason: !directHomeSchedule && bakeAt ? 'No selectable direct-home schedule for provided window and conditions.' : null,
    quantities: {
      pizzas,
      diameter,
      ballWeight: effectiveBall,
      totalDough: dough.totalDough,
      flour: beginnerDisplayFlour,
      water: dough.total.water,
      salt: dough.total.salt,
      oil: dough.total.oil,
      yeast: dough.total.yeast,
      saucePerPizza: dims.sauce,
      cheesePerPizza: dims.cheese,
    },
    schedule: directHomeSchedule,
    scheduleTimestamps,
    phases: numberedPhases,
  };
}

function generate(input) {
  const lang = input.lang || 'en';
  if (input.kind === 'preferment') {
    const mod = load('src/i18n/prefermentSteps.ts');
    return jsonSafe(mod.getYeastAwarePrefermentSteps(lang, input.method || 'biga', input.mixing || 'hand', input.yeastType || 'dry', !!input.teglia, !!input.hasOil));
  }
  if (input.kind === 'spiral') {
    const mod = load('src/i18n/spiralMixing.ts');
    return jsonSafe({ title: mod.getSpiralMixingTitle(lang, input.method || 'direct'), steps: mod.getSpiralMixingSteps(lang, input.yeastType || 'dry', { method: input.method || 'direct', hasOil: !!input.hasOil }) });
  }
  if (input.kind === 'style') {
    const mod = load('src/i18n/styleSteps.ts');
    return jsonSafe({ phases: mod.getStyleSteps(input.mixing || 'hand', input.style || 'romana', input.roomHours || 2, input.fridgeHours || 24, input.flour || 'caputo00', input.romanTray || false), baking: mod.getStyleBakingSteps(lang, input.oven || 'homeStone', input.style || 'romana', input.bakingTime || '5-7 min', input.ovenTemp || 250), bakingTemperature: mod.getStyleBakingTemp(input.oven || 'homeStone', input.style || 'romana') });
  }
  if (input.kind === 'directSchedule') {
    const mod = load('src/calculator.ts');
    const now = new Date(input.now || '2026-01-01T08:00:00.000Z');
    const bakeAt = new Date(input.bakeAt || '2026-01-02T12:00:00.000Z');
    const plan = mod.createDirectHomePizzaPlan({
      style: input.style || 'neapolitan', romanFormat: input.romanFormat, pizzas: input.pizzas || 2,
      ballWeight: input.ballWeight || 250, method: 'direct', bakeAt, roomTemp: input.roomTemp || 22,
      fridgeTemp: input.fridgeTemp || 4, ovenType: input.ovenType || 'homeStone', ovenTemp: input.ovenTemp || 450,
      flourType: input.flourType || 'caputo00', mixing: input.mixing || 'hand', beginnerScheduleMode: input.beginnerScheduleMode,
    }, input.flourStrength || { source: 'unknown' }, input.hydrationPct || 65, input.yeastType || 'dry', now, input.conservativeUnknownFlour !== false);
    return jsonSafe(plan);
  }
  if (input.kind === 'bigaSchedule' || input.kind === 'poolishSchedule') {
    const mod = load('src/calculator.ts');
    const now = new Date(input.now || '2026-01-01T08:00:00.000Z');
    const bakeAt = new Date(input.bakeAt || '2026-01-02T12:00:00.000Z');
    const base = { style: input.style || 'neapolitan', pizzas: input.pizzas || 2, ballWeight: input.ballWeight || 250, bakeAt, roomTemp: input.roomTemp || 22, fridgeTemp: input.fridgeTemp || 4, ovenType: input.ovenType || 'homeStone' };
    const plan = input.kind === 'bigaSchedule'
      ? mod.createBigaHomePizzaPlan(base, now)
      : mod.createPoolishHomePizzaPlan({ ...base, poolishHours: input.poolishHours || 16 }, now);
    return jsonSafe(plan);
  }
  if (input.kind === 'beginnerDirect') {
    return jsonSafe(buildBeginnerDirectInstructions(input));
  }
  throw new Error('Unknown kind. Use preferment, spiral, style, directSchedule, bigaSchedule, poolishSchedule, or beginnerDirect.');
}

if (require.main === module) {
  const input = JSON.parse(process.argv[2] || '{}');
  process.stdout.write(JSON.stringify(generate(input), null, 2) + '\n');
}

module.exports = { generate };

process.on('exit', () => {
  if (originalTs) Module._extensions['.ts'] = originalTs;
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
});
