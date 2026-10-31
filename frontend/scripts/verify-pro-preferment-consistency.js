#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const frontendRoot = path.join(__dirname, '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findDeclaration(sourceFile, name) {
  let declaration;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === name
    ) {
      declaration = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(declaration?.initializer, `expected ${name} to have an initializer`);
  return declaration.initializer;
}

function findFunction(filePath, name) {
  const text = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let declaration;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(declaration, `expected ${name} to be declared in ${filePath}`);
  return declaration.getText(sourceFile).replace(/^export\s+/, '');
}

function evaluate(source, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(`module.exports = (${source});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, ...context });
  return module.exports;
}

function loadFunction(filePath, name, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    `${findFunction(filePath, name)}\nmodule.exports = ${name};`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, ...context });
  return module.exports;
}

const getFermentationSchedule = loadFunction(
  path.join(frontendRoot, 'src', 'calculator.ts'),
  'getFermentationSchedule',
);
const celsiusToFahrenheit = loadFunction(path.join(frontendRoot, 'src', 'units.ts'), 'celsiusToFahrenheit');
const formatTemperature = loadFunction(path.join(frontendRoot, 'src', 'units.ts'), 'formatTemperature', { celsiusToFahrenheit });
const formatDuration = loadFunction(
  path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'),
  'formatDuration',
);

const summaryInitializer = findDeclaration(indexFile, 'proPrefermentScheduleSummary');
const bigaPreparationInitializer = findDeclaration(indexFile, 'bigaPreparation');
const poolishPreparationInitializer = findDeclaration(indexFile, 'poolishPreparation');
const prefermentStepsPath = path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts');
const prefermentStepsFile = ts.createSourceFile(
  prefermentStepsPath,
  fs.readFileSync(prefermentStepsPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const timerKindLabels = evaluate(findDeclaration(prefermentStepsFile, 'TIMER_KIND_LABEL').getText(prefermentStepsFile));
const languages = ['hr', 'en', 'de', 'sl'];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const pizzaStyles = ['neapolitan', 'romanaTonda', 'romanaTeglia', 'newYork'];
const prefermentCases = [
  { hours: 4, roomTemp: 18, fridgeTemp: 4, temperatureUnit: 'celsius' },
  { hours: 8, roomTemp: 22, fridgeTemp: 5, temperatureUnit: 'celsius' },
  { hours: 12, roomTemp: 26, fridgeTemp: 6, temperatureUnit: 'fahrenheit' },
  { hours: 24, roomTemp: 22, fridgeTemp: 4, temperatureUnit: 'celsius' },
  { hours: 48, roomTemp: 18, fridgeTemp: 3, temperatureUnit: 'fahrenheit' },
];
const dough = {
  preferment: { flour: 600, water: 300, yeast: 1.2 },
  main: { flour: 400, water: 250, yeast: 0.8 },
};
const coldLabels = {
  hr: 'hladnjak',
  en: 'refrigerat',
  de: 'Kühlschrank',
  sl: 'hladilnik',
};

for (const lang of languages) {
  for (const method of ['biga', 'poolish']) {
    for (const mixing of mixingMethods) {
      for (const pizzaStyle of pizzaStyles) {
        for (const config of prefermentCases) {
          const schedule = getFermentationSchedule({
            method,
            prefermentHours: config.hours,
            roomHours: 0,
            roomTemp: config.roomTemp,
            fridgeHours: 0,
            fridgeTemp: config.fridgeTemp,
          });
          const expectedRoomHours = Math.min(method === 'biga' ? 8 : 1, config.hours);
          const expectedFridgeHours = config.hours - expectedRoomHours;
          assert.equal(schedule.prefermentRoomHours, expectedRoomHours);
          assert.equal(schedule.prefermentFridgeHours, expectedFridgeHours);
          assert.equal(
            schedule.prefermentRoomHours + schedule.prefermentFridgeHours,
            config.hours,
            `${lang}/${method}/${config.hours}h schedule must sum to its selected duration`,
          );
          const roomTemperature = formatTemperature(config.roomTemp, config.temperatureUnit);
          const fridgeTemperature = formatTemperature(config.fridgeTemp, config.temperatureUnit);

          const context = {
            isBeginner: false,
            method,
            lang,
            temperatureUnit: config.temperatureUnit,
            roomTemp: config.roomTemp,
            fridgeTemp: config.fridgeTemp,
            prefermentRoomTemperature: roomTemperature,
            prefermentFridgeTemperature: fridgeTemperature,
            prefermentRoomHours: schedule.prefermentRoomHours,
            prefermentFridgeHours: schedule.prefermentFridgeHours,
            bigaHours: config.hours,
            poolishHours: config.hours,
            bigaPct: 50,
            bigaHydrationPct: 62,
            poolishPct: 35,
            poolishHydrationPct: 100,
            dough,
            yeastShortLabel: 'fresh yeast',
            preferredYeastType: 'fresh',
            mixing,
            mixingForExperience: mixing,
            isRomanTeglia: pizzaStyle === 'romanaTeglia',
            croatianHours: (hours) => `${hours} sati`,
            timer: (id, seconds, kind) => ({ id, seconds, kind }),
            formatDuration,
            formatTemperature,
          };
          const summary = evaluate(summaryInitializer.getText(indexFile), context);
          const roomDuration = formatDuration(expectedRoomHours * 3600, lang);
          const totalDuration = formatDuration(config.hours * 3600, lang);
          assert.ok(summary.includes(roomDuration), `${lang}/${method}/${config.hours}h summary must show room duration`);
          assert.ok(summary.includes(roomTemperature), `${lang}/${method}/${config.hours}h summary must show room temperature`);
          assert.ok(summary.includes(totalDuration), `${lang}/${method}/${config.hours}h summary must show total duration`);
          assert.doesNotMatch(summary, /honey|Honig|medu/i);

          if (expectedFridgeHours > 0) {
            const fridgeDuration = formatDuration(expectedFridgeHours * 3600, lang);
            assert.ok(summary.includes(fridgeDuration), `${lang}/${method}/${config.hours}h summary must show fridge duration`);
            assert.ok(summary.includes(fridgeTemperature), `${lang}/${method}/${config.hours}h summary must show fridge temperature`);
          } else {
            assert.ok(!summary.includes(coldLabels[lang]), `${lang}/${method}/${config.hours}h room-only summary must omit a fridge phase`);
          }

          const preparation = evaluate(
            (method === 'biga' ? bigaPreparationInitializer : poolishPreparationInitializer).getText(indexFile),
            context,
          );
          const steps = preparation.steps.join(' ');
          assert.ok(steps.includes(roomTemperature), `${lang}/${method}/${config.hours}h steps must show the selected room temperature`);
          assert.ok(!/honey|Honig|medu/i.test(steps), `${lang}/${method}/${config.hours}h steps must not mention unsupported honey`);
          const hasFridgeStep = steps.includes(coldLabels[lang]);
          assert.equal(
            hasFridgeStep,
            expectedFridgeHours > 0,
            `${lang}/${method}/${mixing}/${pizzaStyle}/${config.hours}h steps must match the schedule's fridge phase`,
          );
          if (expectedFridgeHours > 0) {
            assert.ok(steps.includes(fridgeTemperature), `${lang}/${method}/${config.hours}h steps must show the selected fridge temperature`);
          }
        }
      }
    }
  }
}

for (const lang of languages) {
  for (const method of ['biga', 'poolish']) {
    const initializer = method === 'biga' ? bigaPreparationInitializer : poolishPreparationInitializer;
    const schedule = getFermentationSchedule({
      method,
      prefermentHours: 4,
      roomHours: 0,
      roomTemp: 20,
      fridgeHours: 0,
      fridgeTemp: 4,
    });
    const preparation = evaluate(initializer.getText(indexFile), {
      isBeginner: true,
      method,
      lang,
      roomTemp: 20,
      fridgeTemp: 4,
      prefermentRoomTemperature: '20 °C',
      prefermentFridgeTemperature: '4 °C',
      prefermentRoomHours: schedule.prefermentRoomHours,
      prefermentFridgeHours: schedule.prefermentFridgeHours,
      bigaHours: 4,
      poolishHours: 4,
      bigaPct: 50,
      bigaHydrationPct: 62,
      poolishPct: 35,
      poolishHydrationPct: 100,
      dough,
      yeastShortLabel: 'fresh yeast',
      preferredYeastType: 'fresh',
      mixing: 'hand',
      mixingForExperience: 'hand',
      isRomanTeglia: false,
      croatianHours: (hours) => `${hours} sati`,
      timer: (id, seconds, kind) => ({ id, seconds, kind }),
    });
    assert.ok(preparation.steps.join(' ').includes(coldLabels[lang]), `${lang} Beginner preparation must retain its refrigerator instruction`);
  }
  assert.ok(timerKindLabels[lang].preferment, `${lang} must have a preferment timer label`);
  assert.notEqual(timerKindLabels[lang].preferment, timerKindLabels[lang].rt);
}

assert.match(
  indexSource,
  /const idealFermentationText = !isBeginner && method !== 'direct'\s*\?\s*proPrefermentScheduleSummary/,
  'the rendered PRO fermentation info must use the calculated preferment summary',
);
const resultCardStart = indexSource.indexOf('6 · {t.calc.preferment}');
const resultCardEnd = indexSource.indexOf('<Text style={[styles.recipeSection, { marginTop: SPACING.md }]}>{t.calc.mainDough}', resultCardStart);
assert.ok(resultCardStart >= 0 && resultCardEnd > resultCardStart);
const resultCard = indexSource.slice(resultCardStart, resultCardEnd);
assert.match(resultCard, /<Text style=\{styles\.hint\}>\{proPrefermentScheduleSummary\}<\/Text>/);
assert.doesNotMatch(resultCard, /t\.calc\.(?:bigaHint|poolishHint)/);
assert.ok(indexSource.includes(
  "{ id: `biga-fermentation-${mixingForExperience}`, seconds: bigaHours * 3600, kind: isBeginner ? 'rt' as const : 'preferment' as const }",
));
assert.ok(indexSource.includes(
  "{ id: 'poolish-fermentation', seconds: poolishHours * 3600, kind: 'preferment' as const }",
));
assert.match(indexSource, /isBeginner \|\| prefermentFridgeHours > 0/);
assert.match(indexSource, /bigaHomeScheduleHint \?\? t\.calc\.bigaHint/);

console.log('PRO Biga/Poolish preferment summaries, preparation steps, and timer labels passed.');
