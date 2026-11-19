#!/usr/bin/env node
// Legacy Poolish recipes must keep their exact results; the RT/CT model is opt-in.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');

function loadTypeScriptModule(filePath) {
  const compiled = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', `${compiled}\nreturn module.exports;`)(loaded, loaded.exports, (request) => {
    if (request.startsWith('.')) {
      const local = path.resolve(path.dirname(filePath), `${request}.ts`);
      return loadTypeScriptModule(local);
    }
    const local = path.join(frontendRoot, 'src', 'i18n', `${path.basename(request)}.ts`);
    if (fs.existsSync(local)) return loadTypeScriptModule(local);
    throw new Error(`Unexpected runtime import: ${request}`);
  });
  return loaded.exports;
}

const calc = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const { translations } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'translations.ts'));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
let checks = 0;
const check = (fn) => { fn(); checks += 1; };

// 1. Golden legacy results. "HEAD-equal" cases were generated from the committed calculator and matched
// the working tree when frozen; "working-tree-snapshot" cases (cold temperatures) freeze the current legacy path.
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'poolish-legacy-golden.json'), 'utf8'));
assert.ok(golden.length >= 100, 'golden fixture is populated');
assert.ok(golden.some((g) => g.source === 'HEAD-equal') && golden.some((g) => g.source === 'working-tree-snapshot'));
for (const { p, schedule: expectedSchedule, dough: expectedDough } of golden) {
  const schedule = calc.getFermentationSchedule({
    method: 'poolish', prefermentHours: p.hours, prefermentTempC: p.temp, roomHours: p.room, roomTemp: 22,
    fridgeHours: p.fridge, fridgeTemp: 4, roomAfterFridgeHours: p.fridge > 0 ? p.room : 0,
  });
  const dough = calc.doughCalc({
    pizzas: 3, ballWeight: 270, hydration: 62, saltPct: 2.8, oilPct: 0, method: 'poolish', poolishPct: p.share,
    poolishHydrationPct: p.pHyd, poolishFermentationTempC: p.temp, prefermentHours: p.hours, yeastType: p.yeast,
    roomHours: p.room, roomTemp: 22, fridgeHours: p.fridge, fridgeTemp: 4, mixing: 'hand', fermentationSchedule: schedule,
  });
  check(() => assert.deepEqual(JSON.parse(JSON.stringify(schedule)), expectedSchedule, `schedule ${JSON.stringify(p)}`));
  check(() => assert.deepEqual(JSON.parse(JSON.stringify(dough)), expectedDough, `dough ${JSON.stringify(p)}`));
  check(() => assert.equal(dough.poolishYeastGrams, undefined, 'legacy recipes do not use the separate phase yeast model'));
  check(() => assert.equal(schedule.poolishMode, undefined, 'legacy schedules carry no RT/CT mode'));
}

// 2. Legacy detection and restore: no migration, no clamping of old temperatures.
for (const saved of [
  {}, { poolishHours: 24, poolishFermentationTempC: 8 }, { poolishFermentationMode: null },
  { poolishFermentationMode: 'legacy' }, { poolishFermentationMode: 1 }, { poolishFermentationMode: undefined, poolishRtHours: 12 },
]) check(() => assert.equal(calc.restorePoolishPhaseSettings(saved), null, JSON.stringify(saved)));
assert.equal(calc.restorePoolishPhaseSettings({ poolishFermentationMode: 'ct-rt', poolishRtHours: 10, poolishCtHours: 20, poolishRtTemperatureC: 23, poolishCtTemperatureC: 5 }).mode, 'ct-rt');
assert.match(indexSource, /restorePoolishPhaseSettings\(saved\)[\s\S]{0,200}restoredPoolish\?\.mode \?\? null/, 'Calculator restore uses legacy-null detection');
assert.match(indexSource, /restorePoolishPhaseSettings\(settings\)[\s\S]{0,200}restoredPoolish\?\.mode \?\? null/, 'recipe load uses legacy-null detection');
assert.ok(!/Math\.max\(20, Math\.min\(24, legacyTemperature\)\)/.test(indexSource), 'no silent clamping of legacy temperatures');
assert.match(plannerSource, /poolishFermentationMode: restoredPoolish\?\.mode \?\? null/, 'Planner restore uses legacy-null detection');
assert.match(indexSource, /!isBeginner && \(method === 'poolish' \|\| poolishEnabled\) && poolishFermentationMode !== null && poolishPhaseInputs !== null/, 'new schedule only for explicit modes');
assert.match(indexSource, /poolishFermentationTempC: !isBeginner && method === 'poolish' && !poolishFermentationSchedule \? poolishFermentationTempC : undefined/, 'legacy yeast model keeps the saved temperature');
assert.match(indexSource, /prefermentTempC: method === 'poolish' \? poolishFermentationTempC : undefined/, 'legacy shared schedule keeps the saved temperature');
check(() => undefined);

// 3. Planner without shared Calculator state: legacy recipes keep poolishHours and the saved temperature.
const legacyPlanner = (overrides) => ({
  poolishFermentationMode: null, poolishHours: 24, poolishFermentationTempC: 22,
  rtHours: 24, ctHours: 24, rtTemperatureC: 22, ctTemperatureC: 4,
  roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, ...overrides,
});
const bakeAt = new Date('2026-10-18T19:00:00.000Z');
const planFor = (schedule, lang) => calc.reversePlan(
  bakeAt, 'poolish', 'neapolitan', translations[lang].planner.stepCopy, null, null, null, lang, '250°C', 22, schedule,
  { romanFormat: 'tonda', trayCount: 4, doughPerTray: 480, trayWidth: 30, trayLength: 40 }, 'homePan', 250, 20, 'hand',
);
for (const hours of [4, 12, 24, 36, 48]) {
  for (const temp of [4, 8, 10, 15, 22, 30, 35]) {
    const settings = legacyPlanner({ poolishHours: hours, poolishFermentationTempC: temp });
    const fallback = calc.getPoolishPlannerFallbackSchedule(settings, 2);
    const direct = calc.getFermentationSchedule({
      method: 'poolish', roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
      prefermentHours: hours, prefermentTempC: temp,
    });
    check(() => assert.deepEqual(fallback, direct, `${hours}h@${temp}C Planner legacy schedule`));
    check(() => assert.equal(fallback.prefermentHours, hours));
    check(() => assert.ok(fallback.phases.filter((phase) => phase.kind === 'preferment').every((phase) => phase.temperature === temp), 'saved temperature is not clamped'));
  }
}
for (const lang of languages) {
  const schedule = calc.getPoolishPlannerFallbackSchedule(legacyPlanner({ poolishHours: 12, poolishFermentationTempC: 8 }), 2);
  const steps = planFor(schedule, lang);
  const copy = translations[lang].planner.stepCopy;
  check(() => assert.ok(steps.some((step) => step.title === copy.poolishTitle), `${lang}: legacy Poolish step keeps its original title`));
  check(() => assert.ok(!steps.some((step) => String(step.phaseId ?? '').startsWith('poolish.phase.')), `${lang}: legacy plan has no per-phase steps`));
}

// 4. Mode changes: every transition and boundary stays inside the supported ranges and never throws.
const modes = ['rt', 'ct', 'rt-ct', 'ct-rt'];
const hourSamples = [Number.NaN, -5, 0, 0.5, 1, 3.5, 4, 24, 48, 49, 100, 120, 121, 500];
const temperatureSamples = [Number.NaN, 0, 4, 6, 7, 19, 20, 24, 25, 40];
for (const from of modes) {
  for (const to of modes) {
    for (const rtHours of hourSamples) {
      for (const ctHours of hourSamples) {
        const normalized = calc.normalizePoolishPhaseInputs(to, {
          rtHours, ctHours, rtTemperatureC: 22, ctTemperatureC: 4,
        });
        const schedule = calc.getPoolishFermentationSchedule({
          mode: to, ...normalized, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
        });
        assert.ok(schedule.prefermentHours > 0, `${from}->${to} ${rtHours}/${ctHours}`);
        assert.ok(normalized.rtHours >= 0 && normalized.rtHours <= 48 && normalized.ctHours >= 0 && normalized.ctHours <= 120);
        if (to === 'rt') assert.ok(normalized.rtHours >= 4);
        if (to === 'ct') assert.ok(normalized.ctHours >= 4);
        if (to === 'rt-ct' || to === 'ct-rt') assert.ok(normalized.rtHours >= 1 && normalized.ctHours >= 1);
        checks += 1;
      }
    }
  }
}
for (const mode of modes) {
  for (const rtTemperatureC of temperatureSamples) {
    for (const ctTemperatureC of temperatureSamples) {
      const normalized = calc.normalizePoolishPhaseInputs(mode, { rtHours: 12, ctHours: 12, rtTemperatureC, ctTemperatureC });
      assert.ok(normalized.rtTemperatureC >= 20 && normalized.rtTemperatureC <= 24);
      assert.ok(normalized.ctTemperatureC >= 4 && normalized.ctTemperatureC <= 6);
      checks += 1;
    }
  }
}
// The exact crash found in review: mixed-mode 1 h values switched to a single-phase mode.
for (const mode of ['rt', 'ct']) {
  assert.throws(() => calc.getPoolishFermentationSchedule({
    mode, rtHours: 1, ctHours: 1, rtTemperatureC: 22, ctTemperatureC: 4, roomHours: 2, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4,
  }), RangeError, 'strict builder still rejects out-of-range input');
  const safe = calc.normalizePoolishPhaseInputs(mode, { rtHours: 1, ctHours: 1, rtTemperatureC: 22, ctTemperatureC: 4 });
  assert.doesNotThrow(() => calc.getPoolishFermentationSchedule({ mode, ...safe, roomHours: 2, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4 }));
  checks += 1;
}
// Restored values that are stale or corrupt never reach the strict builder unsanitized, in Calculator or Planner.
for (const mode of modes) {
  const corrupt = { poolishFermentationMode: mode, poolishRtHours: 0, poolishCtHours: 0, poolishRtTemperatureC: 99, poolishCtTemperatureC: -3 };
  const restored = calc.restorePoolishPhaseSettings(corrupt);
  assert.doesNotThrow(() => calc.getPoolishFermentationSchedule({
    mode, rtTemperatureC: restored.rtTemperatureC, ctTemperatureC: restored.ctTemperatureC, rtHours: restored.rtHours, ctHours: restored.ctHours,
    roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4,
  }));
  assert.doesNotThrow(() => calc.getPoolishPlannerFallbackSchedule({
    poolishFermentationMode: mode, poolishHours: 24, poolishFermentationTempC: 22,
    rtHours: 0, ctHours: 0, rtTemperatureC: 99, ctTemperatureC: -3, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4,
  }, 2));
  checks += 1;
}
assert.equal((indexSource.match(/onPress=\{\(\) => step\(\(\) => selectPoolishMode\(mode\)\)\}/g) ?? []).length, 1, 'all mode buttons use the range-safe handler');
assert.equal((indexSource.match(/setPoolishFermentationMode\(mode\)/g) ?? []).length, 1, 'only selectPoolishMode sets a new mode directly');
assert.match(indexSource, /const selectPoolishMode = [\s\S]{0,900}normalizePoolishPhaseInputs\(mode, seed\)[\s\S]{0,200}setPoolishFermentationMode\(mode\)/, 'the handler normalizes before switching');

// 5. Phase order in the Planner, all languages.
for (const lang of languages) {
  const copy = translations[lang].planner.stepCopy;
  for (const mode of modes) {
    const schedule = calc.getPoolishFermentationSchedule({
      mode, rtHours: 10, ctHours: 20, rtTemperatureC: 22, ctTemperatureC: 4, roomHours: 2, roomTemp: 22,
      fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
    });
    const steps = planFor(schedule, lang);
    const phases = steps.filter((step) => String(step.phaseId ?? '').startsWith('poolish.phase.'));
    const expected = { rt: ['RT'], ct: ['CT'], 'rt-ct': ['RT', 'CT'], 'ct-rt': ['CT', 'RT'] }[mode];
    assert.deepEqual(phases.map((step) => step.title.match(/ (RT|CT) \d$/)[1]), expected, `${lang}/${mode}: phase order`);
    assert.deepEqual(phases.map((step) => step.phaseId), expected.map((_, index) => `poolish.phase.${index + 1}`));
    const hours = { RT: 10, CT: 20 };
    for (let index = 1; index < phases.length; index += 1) {
      assert.equal(phases[index].at.getTime() - phases[index - 1].at.getTime(), hours[expected[index - 1]] * 3600000, `${lang}/${mode}: phase spacing`);
    }
    const finalMix = steps.find((step) => step.title === copy.finalMixTitle.replace('{PREFERMENT}', copy.poolishName));
    const last = phases[phases.length - 1];
    assert.equal(finalMix.at.getTime() - last.at.getTime(), hours[expected[expected.length - 1]] * 3600000, `${lang}/${mode}: last phase ends at the final mix`);
    for (let index = 1; index < steps.length; index += 1) assert.ok(steps[index - 1].at <= steps[index].at);
    if (lang === 'de') {
      for (const step of phases) {
        assert.match(step.desc, /\d+ Std\./, 'German phase durations use Std.');
        assert.ok(!/\b\d+ h\b/.test(step.desc), `German phase text has no "h": ${step.desc}`);
      }
    }
    checks += 1;
  }
}
assert.match(plannerSource, /plannerMixTitles\.includes\(step\.title\) \|\| step\.phaseId === 'poolish\.phase\.1'/, 'yeast and spiral notes reach the first Poolish phase');
assert.match(plannerSource, /const hourUnit = lang === 'de' \? 'Std\.' : 'h'/, 'Planner summary uses Std. in German');
assert.match(plannerSource, /poolishFermentationMode === null\) \{[\s\S]{0,600}activeCalculatorPlanSettings\.poolishHours/, 'Planner summary keeps legacy hours');

// 6. HR/EN/DE/SL copy exists for every new control and note.
for (const phrase of [
  "'Način fermentacije Poolisha'", "'Poolish fermentation mode'", "'Poolish-Fermentationsmodus'",
  "'RT temperatura'", "'RT temperature'", "'RT-Temperatur'", "'RT trajanje'", "'RT duration'", "'RT-Dauer'",
  "'CT temperatura'", "'CT temperature'", "'CT-Temperatur'", "'CT trajanje'", "'CT duration'", "'CT-Dauer'",
  'Procjena kvasca je privremena', 'The yeast estimate is provisional', 'Die Hefeschätzung ist vorläufig', 'Ocena kvasa je začasna',
  'Spremljeni Poolish recept koristi prijašnji izračun', 'This saved Poolish recipe uses the previous calculation',
  'Dieses gespeicherte Poolish-Rezept nutzt die bisherige Berechnung', 'Ta shranjeni recept za Poolish uporablja prejšnji izračun',
]) assert.ok(indexSource.includes(phrase), `missing copy: ${phrase}`);
checks += 1;

// 7. UI and data structure.
const infoMatches = indexSource.match(/testID="poolish-fermentation-info"/g) ?? [];
assert.equal(infoMatches.length, 1, 'one info button');
const infoAt = indexSource.indexOf('testID="poolish-fermentation-info"');
const selectorAt = indexSource.indexOf('testID="poolish-mode-selector"');
assert.ok(infoAt > 0 && infoAt < selectorAt, 'info button sits with the mode label, outside any mode-specific block');
assert.ok(!/poolishFermentationMode === ('ct'|null) \|\|[^\n]*\? \(\s*<>\s*<View style=\{styles\.row\}>[\s\S]{0,200}poolish-fermentation-info/.test(indexSource.slice(infoAt - 400, infoAt + 100)));

const sourceFile = ts.createSourceFile('index.tsx', indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let buildRecipe;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'buildRecipe') buildRecipe = node.initializer;
  ts.forEachChild(node, visit);
};
visit(sourceFile);
assert.ok(buildRecipe, 'buildRecipe found');
const body = ts.isParenthesizedExpression(buildRecipe.body) ? buildRecipe.body.expression : buildRecipe.body;
assert.ok(ts.isObjectLiteralExpression(body));
const styleParamsOwners = [];
const findStyleParams = (node) => {
  if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'style_params') styleParamsOwners.push(node.parent);
  ts.forEachChild(node, findStyleParams);
};
findStyleParams(body);
assert.equal(styleParamsOwners.length, 1, 'exactly one style_params');
assert.equal(styleParamsOwners[0], body, 'style_params is a top-level recipe field, not nested in settings');
const styleParamsText = body.properties.find((property) => property.name?.getText(sourceFile) === 'style_params').getText(sourceFile);
for (const field of ['poolishFermentationMode', 'poolishRtHours', 'poolishCtHours', 'poolishRtTemperatureC', 'poolishCtTemperatureC', 'poolishFermentationTempC']) {
  assert.ok(styleParamsText.includes(field), `style_params keeps ${field}`);
}
const settingsProperty = body.properties.find((property) => property.name?.getText(sourceFile) === 'settings').getText(sourceFile);
for (const field of ['poolishFermentationMode', 'poolishRtHours', 'poolishCtHours', 'poolishRtTemperatureC', 'poolishCtTemperatureC', 'poolishFermentationTempC', 'poolishHours']) {
  assert.ok(settingsProperty.includes(field), `saved settings include ${field}`);
}
checks += 1;

// 8. Opt-in new model: explicit schedules still use the separate Poolish/final yeast calculation.
const explicit = calc.getPoolishFermentationSchedule({
  mode: 'rt', rtHours: 24, ctHours: 24, rtTemperatureC: 22, ctTemperatureC: 4, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
});
const explicitDough = calc.doughCalc({
  pizzas: 3, ballWeight: 270, hydration: 62, saltPct: 2.8, oilPct: 0, method: 'poolish', poolishPct: 35, poolishHydrationPct: 100,
  yeastType: 'fresh', roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, mixing: 'hand', fermentationSchedule: explicit,
});
assert.notEqual(explicitDough.poolishYeastGrams, undefined, 'RT/CT recipes use the new model');
assert.equal(explicitDough.preferment.water + explicitDough.main.water, explicitDough.total.water);
assert.equal(explicitDough.preferment.flour + explicitDough.main.flour, explicitDough.total.flour);
checks += 1;

console.log(`Poolish legacy compatibility regression passed (${checks} checks, ${golden.length} golden recipes).`);
