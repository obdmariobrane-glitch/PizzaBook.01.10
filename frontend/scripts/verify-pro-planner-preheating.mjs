import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const loadTypeScriptModule = (relativePath) => {
  const filename = path.basename(relativePath);
  const source = readFileSync(path.join(root, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const moduleRequire = (specifier) => {
    if (relativePath === 'src/calculator.ts' && specifier === './proMethods/bigaPoolish') {
      return loadTypeScriptModule('src/proMethods/bigaPoolish.ts');
    }
    throw new Error(`Unexpected dependency "${specifier}" in ${relativePath}.`);
  };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: moduleRequire,
  }, { filename });
  return moduleRef.exports;
};

const { formatBakingTimeRange, getBeginnerPreheatMinutes, getFermentationSchedule, reversePlan } = loadTypeScriptModule('src/calculator.ts');
const { formatTemperature } = loadTypeScriptModule('src/units.ts');
const { translations } = loadTypeScriptModule('src/i18n/translations.ts');


const bakeAt = new Date('2026-10-14T18:00:00.000Z');
const ovenTemperatures = {
  ooni: [350, 400, 450, 480],
  homeStone: [200, 250, 300],
  homePan: [200, 250, 300],
};
const styles = [
  ['neapolitan', undefined],
  ['romana', 'tonda'],
  ['romana', 'teglia'],
  ['ny_style', undefined],
];

for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = translations[lang].planner.stepCopy;
  assert.deepEqual(
    Object.keys(copy.ovenPreheatDesc).sort(),
    ['homePan', 'homeStone', 'ooni'],
    `${lang}: oven-specific preheat copy must cover each oven`,
  );

  for (const ovenType of Object.keys(ovenTemperatures)) {
    const preheatMinutes = getBeginnerPreheatMinutes(ovenType);
    for (const ovenTemp of ovenTemperatures[ovenType]) {
      for (const unit of ['celsius', 'fahrenheit']) {
        for (const method of ['direct', 'biga', 'poolish']) {
          for (const [style, romanFormat] of styles) {
            for (const roomOnly of [true, false]) {
              const schedule = getFermentationSchedule({
                method,
                roomHours: 2,
                roomTemp: 22,
                fridgeHours: roomOnly ? 0 : 24,
                fridgeTemp: 4,
                roomAfterFridgeHours: roomOnly ? 0 : 2,
                ...(method === 'direct' ? {} : { prefermentHours: 18 }),
              });
              const temperatureLabel = formatTemperature(ovenTemp, unit);
              const steps = reversePlan(
                bakeAt,
                method,
                style,
                copy,
                null,
                null,
                null,
                lang,
                temperatureLabel,
                22,
                schedule,
                romanFormat ? { romanFormat, trayCount: 1, doughPerTray: 480, trayWidth: 30, trayLength: 40 } : null,
                ovenType,
                ovenTemp,
                preheatMinutes,
              );
              const preheatStep = steps.find((step) => step.title === copy.ovenTitle);
              assert.ok(preheatStep, `${lang}/${ovenType}/${style}/${method}: preheat step must exist`);
              assert.equal(
                preheatStep.at.getTime(),
                bakeAt.getTime() - preheatMinutes * 60000,
                `${lang}/${ovenType}/${style}/${method}: preheat start must match selected oven and bake deadline`,
              );
              assert.ok(preheatStep.desc.includes(temperatureLabel), `${lang}/${ovenType}/${style}: preheat temperature must match`);
              assert.ok(preheatStep.desc.includes(String(preheatMinutes)), `${lang}/${ovenType}/${style}: preheat duration must match its timestamp`);

              if (style === 'ny_style') {
                const bakeTitle = method === 'poolish' ? copy.poolishBakeTitle : copy.bakeTitle;
                const bakeStep = steps.find((step) => step.title === bakeTitle);
                assert.ok(bakeStep, `${lang}/${ovenType}/${method}: bake step must exist`);
                assert.equal(bakeStep.at.getTime(), bakeAt.getTime(), 'selected baking deadline must remain unchanged');
                assert.ok(bakeStep.desc.includes(temperatureLabel), 'New York bake temperature must match Calculator selection');
                assert.ok(
                  bakeStep.desc.includes(formatBakingTimeRange(ovenType, ovenTemp, lang)),
                  'New York bake duration must use the selected oven and temperature',
                );
              }
            }
          }
        }
      }
    }
  }
}

const beginnerCopy = translations.en.planner.stepCopy;
const staleHomeSchedule = {
  startAt: new Date(bakeAt.getTime() - 36 * 3600000),
  bakeAt,
  ballingAt: new Date(bakeAt.getTime() - 30 * 3600000),
  fridgeAt: new Date(bakeAt.getTime() - 28 * 3600000),
  doughReadyAt: new Date(bakeAt.getTime() - 2 * 3600000),
  preheatAt: new Date(bakeAt.getTime() - 60 * 60000),
  style: 'romana',
  romanFormat: 'tonda',
  ovenType: 'homeStone',
  ovenTemp: 280,
  roomTemp: 22,
  fridgeTemp: 4,
  ballWeight: 210,
  prefermentHours: 0,
  roomBeforeFridgeHours: 2,
  fridgeHours: 24,
  roomAfterFridgeHours: 2,
};
for (const strategy of [undefined, 'fridgeRoom']) {
  const proHomeSteps = reversePlan(
    bakeAt,
    'direct',
    'romana',
    beginnerCopy,
    { ...staleHomeSchedule, strategy },
    null,
    null,
    'en',
    '450°C',
    22,
    undefined,
    null,
    'ooni',
    450,
    getBeginnerPreheatMinutes('ooni'),
  );
  const preheatStep = proHomeSteps.find((step) => step.phaseId === 'direct.preheat');
  assert.ok(preheatStep, `PRO direct home schedule (${strategy ?? 'legacy'}) must include preheating`);
  assert.equal(
    preheatStep.at.getTime(),
    bakeAt.getTime() - 20 * 60000,
    'current PRO oven selection must override stale schedule preheating time',
  );
  assert.match(preheatStep.desc, /450°C/);
  assert.match(preheatStep.desc, /20/);
}

for (const fridgeHours of [0, 24]) {
  const napolitanaSchedule = {
    startAt: new Date(bakeAt.getTime() - (fridgeHours + 2) * 3600000),
    bakeAt,
    roomBeforeFridgeHours: 0,
    fridgeHours,
    roomAfterFridgeHours: 2,
    fridgeTemp: 4,
    ovenType: 'ooni',
    ovenTemp: 400,
  };
  const steps = reversePlan(
    bakeAt,
    'direct',
    'neapolitan',
    beginnerCopy,
    napolitanaSchedule,
    null,
    null,
    'en',
    '400°C',
    22,
    undefined,
    null,
    'ooni',
    400,
    20,
  );
  const phaseIds = Array.from(steps, (step) => step.phaseId);
  assert.deepEqual(
    phaseIds,
    fridgeHours > 0
      ? ['direct.mix', 'direct.fridge', 'direct.fridgeRemoval', 'direct.finalRoom', 'direct.preheat', 'direct.bake']
      : ['direct.mix', 'direct.finalRoom', 'direct.preheat', 'direct.bake'],
    `PRO Napolitana Planner ordering for ${fridgeHours}h fridge`,
  );
  assert.equal(steps.find((step) => step.phaseId === 'direct.finalRoom').at.getTime(), bakeAt.getTime() - 2 * 3600000);
  assert.equal(steps.find((step) => step.phaseId === 'direct.preheat').at.getTime(), bakeAt.getTime() - 20 * 60000);
  assert.equal(steps.find((step) => step.phaseId === 'direct.bake').at.getTime(), bakeAt.getTime());
  if (fridgeHours === 0) {
    assert.ok(!phaseIds.includes('direct.fridgeRemoval'), 'zero fridge duration must not create a fridge-removal event');
  }
}

const unchangedBeginnerSteps = reversePlan(
  bakeAt,
  'direct',
  'romana',
  beginnerCopy,
  null,
  null,
  null,
  'en',
  '280°C',
  22,
  getFermentationSchedule({
    method: 'direct',
    roomHours: 2,
    roomTemp: 22,
    fridgeHours: 24,
    fridgeTemp: 4,
    roomAfterFridgeHours: 2,
  }),
  null,
  'ooni',
  450,
);
assert.equal(
  unchangedBeginnerSteps.find((step) => step.title === beginnerCopy.ovenTitle).at.getTime(),
  bakeAt.getTime() - 60 * 60000,
  'omitting the PRO-only preheat duration must preserve the existing Beginner Planner timing',
);

const plannerSource = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
assert.match(plannerSource, /isBeginner\s*\?\s*undefined\s*:\s*getBeginnerPreheatMinutes\(plannerOvenType\)/);

console.log('PRO Planner preheating and baking regression passed');
