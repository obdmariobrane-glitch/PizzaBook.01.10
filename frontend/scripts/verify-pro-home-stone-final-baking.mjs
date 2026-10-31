import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {
  getBeginnerPreheatMinutes,
  getTegliaFinalProofPlan,
} from '../src/calculator.ts';
import { formatTemperature, formatUnitText } from '../src/units.ts';

const uiPath = new URL('../app/(tabs)/index.tsx', import.meta.url);
const uiSource = await readFile(uiPath, 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const phaseFunction = sourceFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'replaceProPhaseE',
);
assert.ok(phaseFunction, 'production PRO final-phase replacement must be found');

const transpiledFunction = ts.transpileModule(phaseFunction.getText(sourceFile), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const runtime = vm.createContext({
  formatDuration(seconds, lang) {
    const value = Math.round(seconds / 60);
    return `${value} ${{ hr: 'minuta', en: 'minutes', de: 'Minuten', sl: 'minut' }[lang]}`;
  },
  getBeginnerPreheatMinutes,
  getTegliaFinalProofPlan,
  usesPizzaOvenBehavior: (oven) => oven === 'ooni' || oven === 'kamado',
  getKamadoBakeBlockedText: () => 'Kamado bake settings are not defined.',
});
vm.runInContext(`${transpiledFunction}\nglobalThis.replaceProPhaseE = replaceProPhaseE;`, runtime);
const replaceProPhaseE = runtime.replaceProPhaseE;

const languages = {
  hr: { pizzaOven: /pizza peć/i, homeOven: /kućnu pećnicu/i, stone: /kamen ili čelik/i, tray: /tepsij/i },
  en: { pizzaOven: /pizza oven/i, homeOven: /home oven/i, stone: /stone or steel/i, tray: /tray/i },
  de: { pizzaOven: /pizzaofen/i, homeOven: /haushaltsbackofen/i, stone: /(?:pizza)?stein oder (?:-stahl|stahl)/i, tray: /blech/i },
  sl: { pizzaOven: /pizza peč/i, homeOven: /domačo pečico/i, stone: /kamen ali jeklo/i, tray: /pekač/i },
};
const variants = ['napolitana', 'romanaTonda', 'newYork'];
const ovenTemperatures = { ooni: 450, homeStone: 280, homePan: 250 };
const bakeTimeRange = '5–7 min';
const basePhases = [{ title: 'Phase D: mix', steps: ['Mix dough'], timers: [] }];

for (const [lang, terms] of Object.entries(languages)) {
  for (const variant of variants) {
    for (const [oven, ovenTemp] of Object.entries(ovenTemperatures)) {
      for (const unit of ['celsius', 'fahrenheit']) {
        const [phase] = replaceProPhaseE(basePhases, {
          lang,
          variant,
          glutenFree: false,
          oven,
          ovenTemp,
          fridgeHours: 24,
          finalRestMinutes: 30,
          diameter: 30,
          sauceAmount: 60,
          cheeseAmount: 80,
          trayCount: 1,
          bakingTimeRange: bakeTimeRange,
          trayDimensions: { width: 30, length: 40 },
        });
        const [ , preheat, , , , , launch, bake] = phase.steps;
        const localeOutput = formatUnitText(
          `${preheat} ${launch} ${bake}`,
          unit,
          unit === 'fahrenheit' ? 'us' : 'metric',
        );

        assert.ok(localeOutput.includes(bakeTimeRange), `${lang}/${variant}/${oven}/${unit}: baking range must stay present`);
        assert.ok(
          localeOutput.includes(formatTemperature(ovenTemp, unit)),
          `${lang}/${variant}/${oven}/${unit}: temperature display must remain unchanged`,
        );
        if (oven === 'homeStone') {
          assert.match(preheat, terms.homeOven, `${lang}/${variant}: identify a conventional home oven`);
          assert.match(preheat, terms.stone, `${lang}/${variant}: identify the stone/steel surface`);
          assert.match(launch, terms.stone, `${lang}/${variant}: transfer to the stone/steel surface`);
          assert.doesNotMatch(localeOutput, terms.pizzaOven, `${lang}/${variant}: homeStone must not be called a pizza oven`);
        } else if (oven === 'ooni') {
          assert.match(preheat, terms.pizzaOven, `${lang}/${variant}: identify the pizza oven`);
          assert.match(launch, terms.pizzaOven, `${lang}/${variant}: launch into the pizza oven`);
          assert.doesNotMatch(localeOutput, terms.stone, `${lang}/${variant}: Ooni wording must not identify a home stone`);
        } else {
          assert.match(preheat, /oven|pećnic|Ofen|pečic/i, `${lang}/${variant}: identify the home oven`);
          assert.doesNotMatch(localeOutput, terms.pizzaOven, `${lang}/${variant}: homePan must not be called a pizza oven`);
          assert.doesNotMatch(localeOutput, terms.stone, `${lang}/${variant}: homePan must not be called a stone oven`);
        }
      }
    }
  }

  const [tegliaPhase] = replaceProPhaseE(basePhases, {
    lang,
    variant: 'romanaTeglia',
    glutenFree: false,
    oven: 'homePan',
    ovenTemp: ovenTemperatures.homePan,
    fridgeHours: 24,
    finalRestMinutes: 30,
    diameter: 30,
    sauceAmount: 60,
    cheeseAmount: 80,
    trayCount: 1,
    bakingTimeRange: bakeTimeRange,
    trayDimensions: { width: 30, length: 40 },
  });
  assert.ok(
    tegliaPhase.steps.some((step) => terms.tray.test(step)),
    `${lang}/romanaTeglia/homePan: final instructions must retain the tray setup`,
  );
  assert.ok(
    tegliaPhase.steps.every((step) => !terms.pizzaOven.test(step)),
    `${lang}/romanaTeglia/homePan: tray instructions must not call the setup a pizza oven`,
  );
}

assert.match(uiSource, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps\s*\?\s*replaceProPhaseE/);
assert.match(uiSource, /proPrefermentDetailedSteps/, 'Biga and Poolish final steps flow through the same PRO-only replacement');
assert.match(uiSource, /isRomanTeglia\s*\?\s*\(/, 'Romana Teglia uses its dedicated tray final-phase branch');

console.log('PRO homeStone final-baking terminology regression passed');
