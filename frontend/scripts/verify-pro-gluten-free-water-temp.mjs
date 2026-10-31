import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {
  beginnerHydrationFor,
  doughCalc,
  FLOUR_PROFILES,
  PIZZA_STYLE_PROFILES,
} from '../src/calculator.ts';

const uiPath = new URL('../app/(tabs)/index.tsx', import.meta.url);
const uiSource = await readFile(uiPath, 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const runtime = vm.createContext({
  croatianHours: (hours) => `${hours} sati`,
  croatianMinutes: (minutes) => `${minutes} minuta`,
  formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
  formatTemperature: (temperature) => `${temperature} °C`,
  getBeginnerNewYorkInstantMixerInstructions: () => undefined,
  getBeginnerOvenTimers: () => [],
  getTegliaFinalProofPlan: () => ({ totalMinutes: 0, proofMinutes: 0, pressRelaxationMinutes: 0 }),
  getTemperingWindow: () => ({ minimumMinutes: 15, maximumMinutes: 30, initialMinutes: 15 }),
  phaseBBulkRestMinutes: () => 30,
  timer: (id, seconds, kind) => ({ id, seconds, kind }),
});

function loadGenerator(name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${name} must exist in the production source`);
  const compiled = ts.transpileModule(
    `${declaration.getText(sourceFile)}\nglobalThis.generator = ${name};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  vm.runInContext(compiled, runtime);
  return runtime.generator;
}

const generateHr = loadGenerator('getDetailedDirectSteps');
const generateLocalized = loadGenerator('getDetailedDirectStepsLocalized');
const styles = [
  { name: 'napolitana', calculationStyle: 'neapolitan', romanTonda: false, romanaTeglia: false, newYork: false, napolitana: true },
  { name: 'romanaTonda', calculationStyle: 'romana', romanTonda: true, romanaTeglia: false, newYork: false, napolitana: false },
  { name: 'romanaTeglia', calculationStyle: 'romana', romanTonda: false, romanaTeglia: true, newYork: false, napolitana: false },
  { name: 'newYork', calculationStyle: 'ny_style', romanTonda: false, romanaTeglia: false, newYork: true, napolitana: false },
];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const fermentationMethods = ['direct', 'biga', 'poolish'];
const languages = ['hr', 'en', 'de', 'sl'];
const roomTemperatures = [22, 30];
const fridgeHoursOptions = [0, 18];
const bakingTimeRange = '5–7 min';
const dimensions = { width: 30, length: 40 };

function calculateDough(style, mixing, roomTemp, fridgeHours, method) {
  const profile = PIZZA_STYLE_PROFILES[style.calculationStyle];
  return doughCalc({
    pizzas: 2,
    ballWeight: profile.ballWeight,
    hydration: beginnerHydrationFor(style.calculationStyle, 'glutenFree') ?? FLOUR_PROFILES.glutenFree.ideal,
    saltPct: profile.saltPct,
    oilPct: profile.oilPct,
    method,
    bigaPct: method === 'biga' ? 50 : undefined,
    poolishPct: method === 'poolish' ? 35 : undefined,
    roomHours: 2,
    roomTemp,
    fridgeHours,
    fridgeTemp: 4,
    mixing,
    flourType: 'glutenFree',
  });
}

function generateHrPhase({ style, mixing, dough, roomTemp, fridgeHours, waterTemperature }) {
  const profile = PIZZA_STYLE_PROFILES[style.calculationStyle];
  const biga = dough.method === 'biga' ? {
    flour: dough.preferment.flour,
    water: dough.preferment.water,
    yeast: dough.preferment.yeast,
    remainingFlour: dough.main.flour,
    remainingWater: dough.main.water,
    pct: 50,
  } : undefined;
  const poolish = dough.method === 'poolish' ? {
    flour: dough.preferment.flour,
    water: dough.preferment.water,
    yeast: dough.preferment.yeast,
    remainingFlour: dough.main.flour,
    remainingWater: dough.main.water,
    pct: 35,
  } : undefined;
  return generateHr(
    mixing,
    dough.total,
    dough.totalDough,
    2,
    profile.ballWeight,
    profile.defaultDiameter,
    fridgeHours,
    4,
    'ooni',
    450,
    roomTemp,
    100,
    100,
    biga,
    poolish,
    'glutenFree',
    style.romanTonda,
    style.romanaTeglia,
    style.newYork,
    style.napolitana,
    dimensions,
    bakingTimeRange,
    waterTemperature,
    false,
    undefined,
    undefined,
    30,
    'fresh',
    4,
  )[0];
}

function generateLocalizedPhase({ lang, style, mixing, ingredients, totalDough, roomTemp, fridgeHours, waterTemperature }) {
  const profile = PIZZA_STYLE_PROFILES[style.calculationStyle];
  return generateLocalized(
    lang,
    ingredients,
    totalDough,
    2,
    profile.ballWeight,
    profile.defaultDiameter,
    fridgeHours,
    2,
    roomTemp,
    4,
    100,
    100,
    'ooni',
    450,
    bakingTimeRange,
    mixing,
    style.name,
    'glutenFree',
    dimensions,
    waterTemperature,
    false,
    undefined,
    30,
    30,
    'fresh',
  )[0];
}

assert.match(
  uiSource,
  /const instructionWaterTemperature = isBeginner\s*\?\s*waterTemperatureCalculation\?\.recommendedWaterTemp\s*:\s*dough\.waterTemp;/,
  'Beginner keeps its existing recommendation; PRO uses the calculated ingredient temperature',
);
assert.equal(
  [...uiSource.matchAll(/instructionWaterTemperature, beginnerTextMode/g)].length,
  2,
  'both Croatian and localized direct generators must receive the selected temperature',
);
assert.equal(
  [...uiSource.matchAll(/isBeginner \? undefined : dough\.waterTemp, beginnerTextMode/g)].length,
  2,
  'Croatian Biga and Poolish generators receive the PRO temperature while retaining the Beginner fallback',
);

const outputs = new Map();
for (const style of styles) {
  for (const mixing of mixingMethods) {
    for (const roomTemp of roomTemperatures) {
      for (const fridgeHours of fridgeHoursOptions) {
        for (const method of fermentationMethods) {
          const dough = calculateDough(style, mixing, roomTemp, fridgeHours, method);
          const label = `${style.name}/${method}/${mixing}/room=${roomTemp}/fridge=${fridgeHours}`;
          const hrPhase = generateHrPhase({
            style,
            mixing,
            dough,
            roomTemp,
            fridgeHours,
            waterTemperature: dough.waterTemp,
          });
          const hrPrep = hrPhase.steps.find((step) => /ukupno .* vode na .* °C/i.test(step));
          if (method === 'direct') {
            assert.ok(hrPrep, `${label}/hr: generated preparation step must state water temperature`);
          }
          if (hrPrep) {
            assert.ok(hrPrep.includes(`${dough.waterTemp} °C`), `${label}/hr: preparation must match ingredient temperature`);
          }
          assert.ok(hrPhase.waterInfo.includes(`${dough.waterTemp} °C`), `${label}/hr: guidance must match ingredient temperature`);
          assert.doesNotMatch(hrPhase.waterInfo, /18–20 °C/, `${label}/hr: remove generic conflicting guidance`);

          if (method === 'direct') {
            for (const lang of ['en', 'de', 'sl']) {
              const phase = generateLocalizedPhase({
                lang,
                style,
                mixing,
                ingredients: dough.total,
                totalDough: dough.totalDough,
                roomTemp,
                fridgeHours,
                waterTemperature: dough.waterTemp,
              });
              assert.ok(phase.waterInfo.includes(`${dough.waterTemp} °C`), `${label}/${lang}: guidance must match ingredient temperature`);
              assert.doesNotMatch(phase.waterInfo, /18–20 °C/, `${label}/${lang}: remove generic conflicting guidance`);
            }
          }

          outputs.set(`${method}/${mixing}/${roomTemp}/${fridgeHours}`, dough.waterTemp);
        }
      }
    }
  }
}

for (const mixing of mixingMethods) {
  for (const method of fermentationMethods) {
    assert.equal(outputs.get(`${method}/${mixing}/22/18`), 10, `${method}/${mixing}: cold recipe follows the existing 10°C cap`);
    assert.equal(outputs.get(`${method}/${mixing}/22/0`), 30, `${method}/${mixing}: room-only recipe follows the existing calculation`);
  }
}
assert.equal(outputs.get('direct/hand/30/0'), 30, 'warmer room setting changes hand-mixing water temperature');
assert.equal(outputs.get('direct/spiral/30/0'), 25, 'spiral mixing retains its existing calculation rule');

console.log('PRO gluten-free water-temperature consistency passed');
