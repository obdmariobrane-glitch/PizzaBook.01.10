#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');
const frontendRoot = path.resolve(path.dirname(process.argv[1]), '..');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: (specifier) => {
      if (!specifier.startsWith('.')) throw new Error(`Unexpected dependency: ${specifier}`);
      const localPath = path.resolve(path.dirname(path.join(frontendRoot, relativePath)), `${specifier}.ts`);
      return loadTypeScript(path.relative(frontendRoot, localPath));
    },
  }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript('src/calculator.ts');
const spongeSteps = loadTypeScript('src/i18n/spongeSteps.ts');
const translations = loadTypeScript('src/i18n/translations.ts').translations;
const appSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

const options = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  method: 'sponge',
  spongeFlourPct: 70,
  spongeHydrationPct: 62,
  spongeFermentationTempC: 27,
  spongeFermentationHours: 4.5,
  spongeYeastMode: 'automatic',
  spongeYeastType: 'fresh',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  flourType: 'caputo00',
};

const automaticFresh = calculator.doughCalc(options);
assert.equal(automaticFresh.method, 'sponge');
assert.equal(calculator.SPONGE_YEAST_REFERENCE.flourShare, 70);
assert.equal(options.spongeHydrationPct, 62);
assert.equal(automaticFresh.preferment.flour + automaticFresh.main.flour, automaticFresh.total.flour);
assert.equal(automaticFresh.preferment.water + automaticFresh.main.water, automaticFresh.total.water);
assert.ok(Math.abs((automaticFresh.preferment.flour / automaticFresh.total.flour) * 100 - options.spongeFlourPct) < 0.2);
assert.ok(Math.abs((automaticFresh.preferment.water / automaticFresh.preferment.flour) * 100 - options.spongeHydrationPct) < 0.2);
assert.ok(Math.abs((automaticFresh.total.water / automaticFresh.total.flour) * 100 - options.hydration) < 0.1);
assert.equal(automaticFresh.total.salt, Math.round(automaticFresh.total.flour * options.saltPct / 100 * 10) / 10);
assert.equal(automaticFresh.total.oil, Math.round(automaticFresh.total.flour * options.oilPct / 100));
assert.ok(Math.abs(
  automaticFresh.preferment.yeast + automaticFresh.main.yeast - automaticFresh.total.yeast,
) < 1e-10);
const displayedMass = automaticFresh.total.flour
  + automaticFresh.total.water
  + automaticFresh.total.salt
  + automaticFresh.total.oil
  + automaticFresh.total.yeast
  + automaticFresh.total.psyllium;
assert.ok(Math.abs(displayedMass - automaticFresh.totalDough) <= 2);

const expectedFreshYeast = calculator.calculateSpongeAutomaticYeastGrams(
  automaticFresh.total.flour,
  options.spongeFermentationTempC,
  options.spongeFermentationHours,
  'fresh',
);
assert.equal(automaticFresh.preferment.yeast, Math.round(expectedFreshYeast * 100) / 100);
const activeDryYeast = calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'activeDry');
const instantDryYeast = calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'dry');
assert.ok(Math.abs(activeDryYeast - 1000 * 0.022 * 0.4) < 1e-10);
assert.ok(Math.abs(instantDryYeast - 1000 * 0.022 / 3) < 1e-10);

const manual = calculator.doughCalc({
  ...options,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: 1,
  yeastMode: 'manual',
  manualYeastGrams: 1,
});
assert.equal(manual.preferment.yeast, 1);
assert.ok(Math.abs(manual.preferment.yeast + manual.main.yeast - manual.total.yeast) < 1e-10);
const idealForManualMode = calculator.doughCalc({
  ...options,
  spongeYeastMode: 'automatic',
  spongeManualYeastGrams: 0,
  yeastMode: 'automatic',
  manualYeastGrams: 0,
});
assert.equal(idealForManualMode.preferment.yeast, automaticFresh.preferment.yeast);
assert.equal(calculator.validateSpongeManualYeastGrams('', 100), 'empty');
assert.equal(calculator.validateSpongeManualYeastGrams('abc', 100), 'invalid');
assert.equal(calculator.validateSpongeManualYeastGrams('0', 100), 'zero');
assert.equal(calculator.validateSpongeManualYeastGrams('-1', 100), 'negative');
assert.equal(calculator.validateSpongeManualYeastGrams('11', 100), 'unreasonable');
assert.equal(calculator.validateSpongeManualYeastGrams('1', 100), null);
assert.equal(calculator.validateSpongeManualYeastGrams('1,5', 100), null);
assert.throws(() => calculator.doughCalc({
  ...options,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: 0,
}), /finite positive quantity/);

const schedule = calculator.getSpongeFermentationSchedule(4.5, 27, 2, 22, 24, 4, 2);
assert.equal(schedule.phases[0].kind, 'preferment');
assert.equal(schedule.phases[0].hours, 4.5);
assert.equal(schedule.phases[0].temperature, 27);
assert.equal(schedule.phases[1].kind, 'final');
assert.equal(schedule.prefermentHours, 4.5);
assert.throws(() => calculator.getSpongeFermentationSchedule(0, 27, 2, 22, 24, 4), /Sponge fermentation schedule/);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'caputo00', 'caputo00', 'wholeWheat', 70), true);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'glutenFree', 'caputo00', 'wholeWheat', 70), false);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'custom', 'glutenFree', 'glutenFree', 50), false);

const preparationByLanguage = {};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = spongeSteps.SPONGE_COPY[lang];
  for (const key of ['flourShare', 'hydration', 'fermentationTemp', 'fermentationDuration', 'yeastType', 'yeastMode', 'automatic', 'manual', 'manualYeast', 'allocationInvalid', 'ready']) {
    assert.ok(copy[key], `${lang} translation is missing ${key}`);
  }
  for (const key of ['yeastPercentage', 'automaticReference', 'automaticCaution']) {
    assert.equal(copy[key], undefined, `${lang} Sponge copy must not retain ${key}`);
  }
  const phase = spongeSteps.getSpongePreparationPhase(lang, {
    flour: '200 g',
    water: '124 g',
    yeast: '2 g',
    yeastPct: '1',
    yeastType: 'fresh',
    fermentationTemp: '27°C',
    fermentationHours: 4.5,
  });
  assert.ok(phase.title);
  assert.equal(phase.steps.length, 5);
  assert.ok(phase.steps.every(Boolean));
  assert.ok(phase.steps[0].includes('1'), `${lang} Sponge preparation must include the yeast percentage`);
  assert.ok(/Sponge flour|Sponge-Mehl|brašnu za Sponge|moko za Sponge/i.test(phase.steps[0]), `${lang} Sponge preparation must identify the percentage basis`);
  assert.ok(/final-dough yeast|Kvasac za završni zamjes|Die Hefe für den Hauptteig|Kvas za končno testo/i.test(phase.steps[0]), `${lang} Sponge preparation must explain that final-dough yeast is separate`);
  preparationByLanguage[lang] = { title: phase.title, steps: phase.steps };
}

const spongeBakeAt = new Date('2030-01-02T18:00:00Z');
const plannerSteps = calculator.reversePlan(
  spongeBakeAt,
  'sponge',
  'neapolitan',
  translations.en.planner.stepCopy,
  null,
  null,
  null,
  'en',
  '250°C',
  22,
  schedule,
  null,
  'homeStone',
  250,
  60,
  'hand',
  preparationByLanguage.en,
);
const spongePlannerPhases = new Map(plannerSteps.map((step) => [step.phaseId, step]));
const hoursBeforeBake = (step) => (spongeBakeAt.getTime() - step.at.getTime()) / 3600000;
assert.equal(plannerSteps.length, 8);
assert.equal(spongePlannerPhases.get('sponge.preparation').title, preparationByLanguage.en.title);
assert.equal(spongePlannerPhases.get('sponge.preparation').desc, preparationByLanguage.en.steps.join('\n'));
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.preparation')), 30.5);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.finalMix')), 26);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.fridge')), 26);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.fridgeRemoval')), 2);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.finalRoom')), 2);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.balling')), 2);
assert.ok(spongePlannerPhases.get('sponge.finalRoom').desc.includes('2 hours'));
assert.ok(plannerSteps.indexOf(spongePlannerPhases.get('sponge.balling')) < plannerSteps.indexOf(spongePlannerPhases.get('sponge.finalRoom')));
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.preheat')), 1);
assert.equal(hoursBeforeBake(spongePlannerPhases.get('sponge.bake')), 0);
assert.match(spongePlannerPhases.get('sponge.fridge').desc, /24 hours/);
assert.match(spongePlannerPhases.get('sponge.finalRoom').desc, /2 hours/);

for (const setting of [
  'spongeFlourPct',
  'spongeHydrationPct',
  'spongeFermentationTempC',
  'spongeFermentationHours',
  'spongeYeastType',
  'spongeYeastMode',
  'spongeManualYeastGrams',
]) {
  assert.ok(appSource.includes(setting), `Calculator persistence is missing ${setting}`);
}
assert.match(appSource, /testID=\{`manual-yeast-\$\{method\}-minus`\}[\s\S]*?stepManualYeastGrams/);
assert.match(appSource, /testID=\{`manual-yeast-\$\{method\}-plus`\}[\s\S]*?stepManualYeastGrams/);
assert.match(appSource, /!isBeginner && precise && grams > 0 && Math\.round\(grams \* 100\) === 0/);
assert.ok(appSource.includes("method === 'sponge' && spongePreparationPhase"));
assert.match(appSource, /\(method === 'poolish' \|\| method === 'sponge'\) && lang === 'hr'/);
assert.match(appSource, /method === 'poolish' \|\| method === 'sponge' \? \(/);
assert.match(appSource, /pct: method === 'sponge' \? spongeFlourPct : poolishPct/);
assert.match(appSource, /phaseKey="sponge-preparation"\s*timers=\{\[spongePreparationPhase\.timer\]\}/);
assert.match(appSource, /poolishFinalMixYeastType = method === 'sponge' \? activeYeastType : preferredYeastType/);
assert.match(appSource, /method: method === 'sponge' \? 'poolish' : method/);
assert.match(appSource, /spongeP3Steps.*weight\(effectiveBall\)/);
assert.match(appSource, /method === 'sponge' && \(lang === 'de' \|\| lang === 'en' \|\| lang === 'sl'\)\s*\? getDetailedDirectStepsLocalized/);
assert.ok(appSource.includes("id: 'sponge-teglia-bake'"), 'Teglia detailed phases include a Sponge bake timer');
assert.ok(appSource.includes('getKamadoBakeBlockedText(lang)'), 'localized Kamado bake instructions remain approval-blocked');
assert.ok(appSource.includes('localizedSpongeKamadoSteps ?? proPhaseESteps'), 'localized Sponge Kamado phases retain the approved preheat transformation');
assert.match(appSource, /sponge-rest7m/);
assert.ok(appSource.includes('calculatorSpongePreparation'));
assert.ok(appSource.includes("const method: Method = isBeginner\n    ? 'direct'"));
assert.ok(plannerSource.includes('sharedCalculatorPlanSettings?.spongePreparation'));
assert.ok(plannerSource.includes('savedMethod === \'sponge\''));
assert.ok(!appSource.includes("method === 'sponge' ? (() => {\n                    const path = getYeastAwarePrefermentSteps(lang, 'poolish'"));

const preferment = loadTypeScript('src/i18n/prefermentSteps.ts');
const spiralMixing = loadTypeScript('src/i18n/spiralMixing.ts');
const proIceWater = loadTypeScript('src/i18n/proIceWaterInstructions.ts');
const appAst = ts.createSourceFile('index.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expressionFor(name) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer.getText(appAst);
    ts.forEachChild(node, visit);
  }
  visit(appAst);
  assert.ok(initializer, `${name} exists in the calculator screen`);
  return initializer;
}
function evaluateExpression(expression, context) {
  const compiled = ts.transpileModule(`globalThis.result = (${expression});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const sandbox = { ...context };
  vm.runInNewContext(compiled, sandbox);
  return sandbox.result;
}
const preciseWeight = evaluateExpression(expressionFor('weight'), {
  formatWeight: (grams) => `${Math.round(grams * 100) / 100} g`,
  measurementSystem: 'metric',
  lang: 'en',
  isBeginner: false,
});
assert.equal(preciseWeight(0.004, true), '<0.01 g', 'tiny positive PRO yeast is not displayed as zero');
const beginnerPreciseWeight = evaluateExpression(expressionFor('weight'), {
  formatWeight: (grams) => `${Math.round(grams * 100) / 100} g`,
  measurementSystem: 'metric',
  lang: 'en',
  isBeginner: true,
});
assert.equal(beginnerPreciseWeight(0.004, true), '0 g', 'Beginner weight formatting remains unchanged');
const spongeText = evaluateExpression(expressionFor('spongeText'), {});
const handExpression = expressionFor('poolishMixSteps');
const spongeP3Expression = expressionFor('spongeP3Steps');
const spongeTimersExpression = expressionFor('spongeP3Timers');
const generatedDetailedDirectStepsExpression = expressionFor('generatedDetailedDirectSteps');
const localizedSpongeMixingPhaseExpression = expressionFor('localizedSpongeMixingPhase');
const detailedDirectStepsForDisplayExpression = expressionFor('detailedDirectStepsForDisplay');
const iceWaterStepExpression = expressionFor('withProIceWaterInstruction');
const iceWaterInfoIndexExpression = expressionFor('getProIceWaterInfoStepIndex');
const generatedStepCounts = new Map();
const generatedPhaseShapes = new Map();
const tegliaBakePhases = evaluateExpression(generatedDetailedDirectStepsExpression, {
  buildDetailedDirectSteps: () => [{ title: 'mix', steps: ['mix'] }, { title: 'bake', steps: ['bake'], timers: [] }],
  isBeginner: false, method: 'sponge', isRomanTeglia: true, oven: 'homePan', ovenTemp: 250,
  getBakingTimeRange: calculator.getBakingTimeRange,
});
const tegliaBakeRange = calculator.getBakingTimeRange('homePan', 250);
assert.ok(tegliaBakePhases.at(-1).timers.some((timer) => timer.id === 'sponge-teglia-bake'), 'Sponge Teglia final phase has a bake timer');
assert.equal(
  tegliaBakePhases.at(-1).timers.find((timer) => timer.id === 'sponge-teglia-bake').seconds,
  Math.round(((tegliaBakeRange.min + tegliaBakeRange.max) / 2) * 60),
  'Sponge Teglia bake timer uses the existing oven range midpoint',
);
const kamadoBakePhases = evaluateExpression(generatedDetailedDirectStepsExpression, {
  buildDetailedDirectSteps: () => [{ title: 'mix', steps: ['mix'] }, { title: 'bake', steps: ['bake'], timers: [] }],
  isBeginner: false, method: 'sponge', isRomanTeglia: true, oven: 'kamado', ovenTemp: 250,
  getBakingTimeRange: calculator.getBakingTimeRange,
});
assert.ok(!kamadoBakePhases.at(-1).timers.some((timer) => timer.id === 'sponge-teglia-bake'), 'Kamado receives no unapproved Sponge bake timer');
for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    for (const mixing of ['hand', 'mixer', 'spiral']) {
      const dough = calculator.doughCalc({ ...options, spongeYeastType: yeastType, yeastType, mixing: calculator.toCalculatorMixing(mixing) });
      const recipe = {
        flourGrams: dough.main.flour, flourLabel: 'Tipo 00', waterBaseGrams: dough.main.water,
        liquidWaterGrams: dough.main.water, iceGrams: 0, initialWaterPct: 90,
        yeastGrams: dough.main.yeast, saltGrams: dough.main.salt, oilGrams: dough.main.oil,
        flourBehavior: 'standard', formatWeight: (grams) => `${grams} g`,
      };
      const path = preferment.getYeastAwarePrefermentSteps(lang, 'poolish', mixing, yeastType, `${dough.main.yeast} g`, false, dough.main.oil > 0, 'caputo00', false, undefined, 4, recipe);
      if (lang !== 'hr') {
        const localizedMixingPhase = evaluateExpression(localizedSpongeMixingPhaseExpression, {
          method: 'sponge', lang, isBeginner: false, mixingForExperience: mixing, activeYeastType: yeastType,
          weight: (amount) => `${amount} g`, dough, isRomanTeglia: false, flour: 'caputo00', pizzaStyle: 'neapolitan',
          isProEffectivelyGlutenFree: false, fridgeTemp: 4, proSpiralRecipe: recipe, poolishHomeSchedule: false,
          getYeastAwarePrefermentSteps: preferment.getYeastAwarePrefermentSteps,
          getSpiralMixingTitle: (language) => `${language} spiral mixing`,
          withProIceWaterInstruction: (steps) => steps,
          getProSpiralMixingStepInfo: () => undefined, getProHomeMixerStepInfo: () => undefined,
          PHASE_TIMER_DURATIONS: preferment.PHASE_TIMER_DURATIONS,
        });
        assert.ok(localizedMixingPhase, `${lang}/${yeastType}/${mixing}: detailed Sponge phase A is generated`);
        assert.equal(localizedMixingPhase.steps.length, path.p2.steps.length, `${lang}/${yeastType}/${mixing}: detailed phase A matches the localized preferment phase`);
        assert.ok(localizedMixingPhase.steps.every((step, index) => step === path.p2.steps[index]), `${lang}/${yeastType}/${mixing}: detailed phase A uses the localized Sponge mixing steps`);
        assert.ok(localizedMixingPhase.timers.some((timer) => timer.seconds === 5 * 60 && timer.kind === 'rest'), `${lang}/${yeastType}/${mixing}: detailed phase A keeps the five-minute post-mix rest`);
        const phaseFixtures = [{ title: 'phase-a', steps: ['old mix'] }, { title: 'phase-b', steps: ['phase b'] }];
        const displayedPhases = evaluateExpression(detailedDirectStepsForDisplayExpression, {
          detailedDirectSteps: phaseFixtures,
          localizedSpongeMixingPhase: localizedMixingPhase,
        });
        assert.equal(displayedPhases.length, phaseFixtures.length, `${lang}/${mixing}: detailed phase count is preserved`);
        assert.equal(displayedPhases[0].steps.length, path.p2.steps.length, `${lang}/${mixing}: localized P2 replaces only the first detailed phase`);
        assert.equal(displayedPhases[1].title, phaseFixtures[1].title, `${lang}/${mixing}: later detailed phases remain intact`);
      }
      const handSteps = evaluateExpression(handExpression, {
        method: 'sponge', mixingForExperience: mixing, lang, dough, poolishFinalMixYeastType: yeastType,
        weight: (amount) => `${amount} g`, Math,
      });
      const steps = Array.from(handSteps ?? path.p2.steps, spongeText);
      assert.ok(steps.length > 0, `${lang}/${yeastType}/${mixing}: final mix exists`);
      const signature = `${yeastType}/${mixing}`;
      const previousStepCount = generatedStepCounts.get(signature);
      if (previousStepCount === undefined) generatedStepCounts.set(signature, steps.length);
      else assert.equal(steps.length, previousStepCount, `${lang}/${signature}: final-mix step count matches other translations`);
      assert.ok(!steps.some((step) => /poolish/i.test(step)), `${lang}/${yeastType}/${mixing}: final mix names Sponge`);
      assert.ok(steps.some((step) => step.includes(`${dough.main.yeast} g`)), `${lang}/${yeastType}/${mixing}: final yeast comes from Sponge calculation`);
      const displayedIngredientAmounts = mixing === 'spiral'
        ? [dough.main.flour]
        : [dough.main.flour, dough.main.salt, dough.main.oil];
      for (const amount of displayedIngredientAmounts) {
        if (amount > 0) assert.ok(steps.some((step) => step.includes(`${amount} g`)), `${lang}/${yeastType}/${mixing}: final-mix amount ${amount} g comes from Sponge calculation`);
      }
      const displayedWaterAmounts = [
        Math.round(dough.main.water * 0.9),
        dough.main.water - Math.round(dough.main.water * 0.9),
      ];
      for (const amount of displayedWaterAmounts) {
        if (amount > 0) assert.ok(steps.some((step) => step.includes(`${amount} g`)), `${lang}/${yeastType}/${mixing}: final-mix water portion ${amount} g comes from Sponge calculation`);
      }
      if (mixing !== 'hand') {
        const info = mixing === 'spiral'
          ? spiralMixing.getProSpiralMixingStepInfo(lang, recipe, path.p2.steps)
          : spiralMixing.getProHomeMixerStepInfo(lang, recipe, path.p2.steps);
        const cards = info.flatMap((entry) => Array.isArray(entry) ? entry : entry ? [entry] : []);
        assert.ok(cards.length >= 2, `${lang}/${yeastType}/${mixing}: mixing information cards exist`);
        assert.ok(cards.some((card) => /speed|brzina|Geschwindigkeit|hitrost/i.test(card.title)), `${lang}/${yeastType}/${mixing}: speed information card exists`);
        assert.ok(cards.some((card) => /temperature|temperatura|Teigtemperatur/i.test(card.title)), `${lang}/${yeastType}/${mixing}: dough-temperature information card exists`);
      }
      const finalSteps = evaluateExpression(spongeP3Expression, {
        p3Steps: path.p3.steps, spongeP3SourceSteps: path.p3.steps, spongeText, weight: (amount) => `${amount} g`, effectiveBall: 285,
      });
      const phaseShapeKey = `${yeastType}/${mixing}`;
      const phaseShape = `${steps.length}/${finalSteps.length}`;
      const previousPhaseShape = generatedPhaseShapes.get(phaseShapeKey);
      if (previousPhaseShape === undefined) generatedPhaseShapes.set(phaseShapeKey, phaseShape);
      else assert.equal(phaseShape, previousPhaseShape, `${lang}/${phaseShapeKey}: generated Sponge P2/P3 structure matches HR`);
      assert.ok(finalSteps.some((step) => step.includes('285 g')), `${lang}/${mixing}: ball size comes from the selected Sponge recipe`);
      assert.ok(!finalSteps.some((step) => /260\s*[–-]\s*280\s*g/.test(step)), `${lang}/${mixing}: Poolish ball-weight placeholder is absent`);
      const timers = evaluateExpression(spongeTimersExpression, {
        isRomanTeglia: false, mixingForExperience: mixing, PHASE_TIMER_DURATIONS: preferment.PHASE_TIMER_DURATIONS,
        poolishFinalRoomHours: 0, poolishHomeSchedule: null, fridgeHours: 0, lang,
      });
      assert.ok(timers.some((timer) => timer.seconds === 7 * 60), `${lang}/${mixing}: bowl rest timer exists`);
      assert.ok(timers.filter((timer) => timer.seconds === 30 * 60).length >= 2, `${lang}/${mixing}: both 30 minute timers exist`);
      assert.ok(!timers.some((timer) => timer.id === 'brt3h'), `${lang}/${mixing}: unreferenced Poolish ball-rest time is not copied`);

      const iceGrams = Math.max(1, Math.round(dough.main.water * 0.1));
      const iceRecipe = {
        ...recipe,
        liquidWaterGrams: dough.main.water - iceGrams,
        iceGrams,
      };
      const icePath = preferment.getYeastAwarePrefermentSteps(lang, 'poolish', mixing, yeastType, `${dough.main.yeast} g`, false, dough.main.oil > 0, 'caputo00', false, undefined, 4, iceRecipe);
      const iceSteps = mixing === 'hand'
        ? Array.from(handSteps ?? icePath.p2.steps, spongeText)
        : icePath.p2.steps.map(spongeText);
      const iceInstructions = proIceWater.getProIceWaterInstructions({
        lang,
        method: 'poolish',
        mixing,
        waterBaseGrams: dough.main.water,
        liquidWaterGrams: iceRecipe.liquidWaterGrams,
        iceGrams,
        initialWaterPct: 90,
        formatWeight: (amount) => `${amount} g`,
      });
      assert.ok(iceInstructions.waterInfo.includes(`${dough.main.water} g`), `${lang}/${yeastType}/${mixing}: water card shows total final-mix water`);
      assert.ok(iceInstructions.waterInfo.includes(`${iceGrams} g`), `${lang}/${yeastType}/${mixing}: water card shows selected ice amount`);
      const displayedIceSteps = evaluateExpression(iceWaterStepExpression, {
        proIceWaterInstructions: iceInstructions,
        mixingForExperience: mixing,
      })(iceSteps);
      const waterInfoIndex = evaluateExpression(iceWaterInfoIndexExpression, {
        proIceWaterInstructions: iceInstructions,
        mixingForExperience: mixing,
      })(displayedIceSteps);
      assert.ok(Number.isInteger(waterInfoIndex), `${lang}/${yeastType}/${mixing}: water information card has a step position`);
      if (mixing === 'hand') {
        assert.equal(waterInfoIndex, 0, `${lang}/${yeastType}: hand-mixing water card is attached to its inserted instruction`);
        assert.equal(displayedIceSteps[0], iceInstructions.step, `${lang}/${yeastType}: hand-mixing ice instruction is displayed first`);
      } else {
        assert.ok(waterInfoIndex < displayedIceSteps.length, `${lang}/${yeastType}/${mixing}: water card points into the final-mix steps`);
        assert.match(displayedIceSteps[waterInfoIndex], /water|Wasser|vod/i, `${lang}/${yeastType}/${mixing}: water card points to the water/yeast step`);
      }
    }
  }
}
for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'custom']) {
  assert.equal(calculator.isProMethodAllowedForFlour('sponge', flour, 'caputo00', 'wholeWheat', 70), true, `${flour}: Sponge remains available`);
}
for (const style of ['neapolitan', 'romana', 'ny_style']) {
  for (const oven of ['homeStone', 'homePan', 'ooni', 'kamado']) {
    const dough = calculator.doughCalc({ ...options, yeastType: 'fresh' });
    assert.ok(dough.preferment && dough.main, `${style}/${oven}: Sponge ingredient blocks remain available`);
  }
}

console.log('Sponge calculation, yeast, schedule, preparation, Planner, and translation checks passed.');
