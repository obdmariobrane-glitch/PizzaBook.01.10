#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const indexSource = read('app/(tabs)/index.tsx');
const plannerSource = read('app/(tabs)/planner.tsx');
const calculatorSource = read('src/calculator.ts');
const indexFile = ts.createSourceFile('index.tsx', indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function extractFunction(sourceFile, name, globals = {}) {
  const declaration = sourceFile.statements.find((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(declaration, `${name} must remain a function declaration`);
  const compiled = ts.transpileModule(
    `${declaration.getText(sourceFile)}\nmodule.exports = ${name};`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    ...globals,
    module: moduleRef,
    exports: moduleRef.exports,
  }, { filename: name });
  return { [name]: moduleRef.exports };
}

function loadTypeScript(relativePath) {
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
  }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript('src/calculator.ts');
const translations = loadTypeScript('src/i18n/translations.ts').translations;

const { fmt } = extractFunction(
  ts.createSourceFile('planner.tsx', plannerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  'fmt',
);
const plannerDate = new Date('2026-10-13T19:05:00');
for (const [lang, locale] of Object.entries({
  hr: 'hr-HR',
  en: 'en-GB',
  de: 'de-DE',
  sl: 'sl-SI',
})) {
  const expectedDay = new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: '2-digit', month: 'short',
  }).format(plannerDate);
  const expectedTime = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit',
  }).format(plannerDate);
  assert.equal(fmt(plannerDate, lang), `${expectedDay} · ${expectedTime}`);
}
assert.notEqual(fmt(plannerDate, 'hr'), fmt(plannerDate, 'en'));
assert.match(plannerSource, /fmt\(inFiveHours, lang\)/);
assert.match(plannerSource, /fmt\(inTwoDays, lang\)/);
assert.match(plannerSource, /fmt\(nextSat, lang\)/);
assert.match(plannerSource, /fmt\(bakeAt, lang\)/);
assert.doesNotMatch(indexSource, /elastično ter se počne/);
assert.match(indexSource, /elastično i počne se prikladno odvajati/);

const { buildBeginnerFinalPhaseInfo } = extractFunction(indexFile, 'buildBeginnerFinalPhaseInfo');
const helpCopyChecks = {
  hr: {
    semolina: /bezglutensk|rižin/i,
    wheatSemolina: /pšeničnu semolu/i,
    glutenFreeShape: /bezglutensk.*ne rastežite.*napuhani rub/i,
    newYorkShape: /umjerenim rubom.*visoki napuhani rub napolitane/i,
  },
  en: {
    semolina: /gluten-free.*rice flour/i,
    wheatSemolina: /not wheat semolina/i,
    glutenFreeShape: /gluten-free.*do not stretch.*airy rim/i,
    newYorkShape: /moderate rim.*Do not form a tall Neapolitan rim/i,
  },
  de: {
    semolina: /glutenfrei|Reis/i,
    wheatSemolina: /Weizengrieß|Semola/i,
    glutenFreeShape: /glutenfrei.*nicht.*luftigen Rand/i,
    newYorkShape: /mäßigem Rand.*Keinen hohen neapolitanischen Rand/i,
  },
  sl: {
    semolina: /brezglutensk|riž/i,
    wheatSemolina: /pšeničn.*zdrob/i,
    glutenFreeShape: /brezglutensk.*ne raztegujte.*zračnega roba/i,
    newYorkShape: /zmernim robom.*visokega neapeljskega roba/i,
  },
};
const helpTitles = {
  hr: {
    gfSurface: 'Zašto ne koristiti pšeničnu semolu?',
    gfShape: 'Kako oblikovati bezglutensko tijesto?',
    nyShape: 'Kako oblikovati tijesto za New York pizzu?',
  },
  en: {
    gfSurface: 'Why avoid wheat semolina?',
    gfShape: 'How should gluten-free dough be shaped?',
    nyShape: 'How should New York dough be shaped?',
  },
  de: {
    gfSurface: 'Warum keine Semola?',
    gfShape: 'Wie formt man glutenfreien Teig?',
    nyShape: 'Wie formt man New-York-Teig?',
  },
  sl: {
    gfSurface: 'Zakaj ne uporabiti pšeničnega zdroba?',
    gfShape: 'Kako oblikujemo brezglutensko testo?',
    nyShape: 'Kako oblikujemo testo za newyorško pico?',
  },
};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const glutenFreeHelp = buildBeginnerFinalPhaseInfo(lang, 'ny_style', 'glutenFree', 'homeStone');
  assert.equal(glutenFreeHelp[2].title, helpTitles[lang].gfSurface);
  assert.equal(glutenFreeHelp[4].title, helpTitles[lang].gfShape);
  assert.match(glutenFreeHelp[2].body, helpCopyChecks[lang].semolina);
  assert.match(glutenFreeHelp[2].body, helpCopyChecks[lang].wheatSemolina);
  assert.match(glutenFreeHelp[4].body, helpCopyChecks[lang].glutenFreeShape);

  const newYorkHelp = buildBeginnerFinalPhaseInfo(lang, 'ny_style', 'caputo00', 'homeStone');
  assert.equal(newYorkHelp[4].title, helpTitles[lang].nyShape);
  assert.match(newYorkHelp[4].body, helpCopyChecks[lang].newYorkShape);
}

const { getBeginnerNewYorkInstantMixerInstructions } = extractFunction(
  indexFile,
  'getBeginnerNewYorkInstantMixerInstructions',
);
const newYorkMixerTranslations = {
  hr: {
    first: /brašno i prvi dio vode \(510 g\).*1–2 minute prije dodavanja kvasca/i,
    yeast: /početnog miješanja dodajte 0\.6 g instant suhog kvasca/i,
  },
  en: {
    first: /first water portion \(510 g\).*low speed for 1–2 minutes/i,
    yeast: /After the initial 1–2 minutes, add 0\.6 g instant dry yeast/i,
  },
  de: {
    first: /erste Wasserportion \(510 g\).*1–2 Minuten bei niedriger Geschwindigkeit/i,
    yeast: /nach den ersten 1–2 Minuten 0\.6 g Instant-Trockenhefe/i,
  },
  sl: {
    first: /prvi del vode \(510 g\).*1–2 minuti pri nizki hitrosti/i,
    yeast: /Po prvih 1–2 minutah dodajte 0\.6 g instant suhega kvasa/i,
  },
};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const instructions = getBeginnerNewYorkInstantMixerInstructions(lang, 510, 0.6);
  assert.match(instructions.initialMix, newYorkMixerTranslations[lang].first);
  assert.match(instructions.addYeast, newYorkMixerTranslations[lang].yeast);
  assert.doesNotMatch(`${instructions.initialMix} ${instructions.addYeast}`, /fresh yeast|Frischhefe|sveži kvas|svježeg kvasca|dissolve|auflösen|otopite kvasac|raztop/i);
}
const croatianDirectSteps = indexFile.statements.find((statement) =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'getDetailedDirectSteps');
assert.ok(croatianDirectSteps);
const croatianDirectSource = croatianDirectSteps.getText(indexFile);
assert.match(croatianDirectSource, /preferredYeastType: PreferredYeastType = 'fresh'/);
assert.match(croatianDirectSource, /const isNewYorkInstantMixerBeginner = isNewYorkMixerBeginner && preferredYeastType === 'dry'/);
assert.match(croatianDirectSource, /\] : instantMixerInstructions \? \[/);
assert.match(croatianDirectSource, /instantMixerInstructions\.initialMix/);
assert.match(croatianDirectSource, /instantMixerInstructions\.addYeast/);
assert.match(indexSource, /getDetailedDirectSteps\(mixingForExperience, directStepIngredients,[^\n]*proFinalRestMinutes, preferredYeastType\)/);
const localizedFunction = indexFile.statements.find((statement) =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'getDetailedDirectStepsLocalized');
assert.ok(localizedFunction);
const localizedSource = localizedFunction.getText(indexFile);
assert.match(localizedSource, /isNewYorkMixerBeginner && preferredYeastType === 'dry'/);
assert.match(localizedSource, /instantMixerInstructions\?\.initialMix/);
assert.match(localizedSource, /instantMixerInstructions\?\.addYeast/);
assert.match(indexSource, /proFinalRestMinutes, preferredYeastType\)/);

assert.match(indexSource, /const mixRestMinutes = isNewYorkMixerBeginner \? 6 :/);
assert.match(indexSource, /const mixRestLabel = isGlutenFree && beginnerMode \? '5 minuta' : isNeapolitanBeginner \? '5 minuta' : isNewYorkMixerBeginner \? '6 minuta'/);
assert.match(indexSource, /const mixRestMinutes = isGlutenFree \? 5 : isNewYorkMixerBeginner \? 6 :/);
assert.match(indexSource, /isNewYorkMixerBeginner\s*\?\s*pick\('6 Minuten', '6 minutes', '6 minut'\)/);
assert.match(indexSource, /timer\('post-mix-rest', Math\.round\(mixRestMinutes \* 60\), 'rest'\)/);

const { buildBeginnerTegliaHomeSteps } = extractFunction(indexFile, 'buildBeginnerTegliaHomeSteps', {
  formatDuration: (seconds) => `${seconds / 60} min`,
  getTegliaFinalProofPlan: calculator.getTegliaFinalProofPlan,
  getBeginnerTegliaRoomOnlyEnd: () => null,
  buildBeginnerTegliaPhaseC: () => ({ title: 'Phase C: final rest', steps: [], stepInfo: [] }),
  buildBeginnerPhaseBSteps: () => ['phase B'],
  getBeginnerPhaseBTimers: () => [],
  buildBeginnerRoomOnlyFinalStart: () => ({
    info: { title: 'Room rest', body: 'Room rest.' },
    step: 'ROOM REST',
  }),
  buildBeginnerTegliaPreheat: () => 'PREHEAT',
  getBeginnerPreheatMinutes: () => 60,
  getBeginnerPhaseCTimers: () => [],
  addSequentialBeginnerPhaseLetters: (phases) => phases,
});
const proofTitles = {
  hr: 'Završno dizanje',
  en: 'Final rise',
  de: 'Endgare',
  sl: 'Končno vzhajanje',
};
const preheatTitles = {
  hr: 'Predgrijavanje pećnice',
  en: 'Oven preheating',
  de: 'Ofen vorheizen',
  sl: 'Segrevanje pečice',
};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const bakeAt = new Date('2026-10-10T20:00:00Z');
  const phases = [
    { title: 'Phase A: mixing', steps: ['mix'] },
    { title: 'Phase B: fermentation', steps: ['ferment'] },
    { title: 'Phase C: fermentation', steps: ['one', 'two', 'three'] },
    { title: 'Phase D: final rest', steps: ['one', 'two', 'three', 'four'] },
  ];
  const output = buildBeginnerTegliaHomeSteps(
    phases,
    {
      bakeAt,
      preheatAt: new Date('2026-10-10T19:00:00Z'),
      roomAfterFridgeHours: 3,
      fridgeHours: 0,
      roomTemp: 22,
      ovenType: 'homeStone',
    },
    { durationMinutes: 90 },
    22,
    lang,
    250,
    '20–25 min',
    { width: 30, length: 40 },
    'caputo00',
    0,
    0,
    'celsius',
    1,
    '480 g',
    '480 g',
  );
  const finalPhaseOutput = output.at(-1);
  assert.ok(finalPhaseOutput);
  assert.ok(finalPhaseOutput.steps.indexOf('PREHEAT') > finalPhaseOutput.steps.findIndex((step) =>
    /Nakon utiskivanja|After pressing|nach dem Eindrücken|Po vtiskovanju/i.test(step)),
  `${lang}: ${JSON.stringify(finalPhaseOutput.steps)}`);
  const proofInfoIndex = finalPhaseOutput.stepInfo.findIndex((info) => info?.title === proofTitles[lang]);
  const preheatInfoIndex = finalPhaseOutput.stepInfo.findIndex((info) => info?.title === preheatTitles[lang]);
  assert.ok(proofInfoIndex >= 0 && preheatInfoIndex > proofInfoIndex, `${lang}: proof help precedes preheating help`);
}

const reversePlan = calculator.reversePlan;
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = translations[lang].planner.stepCopy;
  for (const hours of [24, 15.189215277777777]) {
    const bakeAt = new Date('2026-10-13T19:00:00Z');
    const selectedFermentationSchedule = {
      phases: [
        { kind: 'final', environment: 'fridge', hours, temperature: 4 },
        { kind: 'final', environment: 'room', hours: 0.5, temperature: 22 },
      ],
    };
    const steps = reversePlan(
      bakeAt,
      'direct',
      'ny_style',
      copy,
      null,
      null,
      null,
      lang,
      undefined,
      22,
      selectedFermentationSchedule,
    );
    const coldStep = steps.find((step) => step.title === copy.coldTitle);
    assert.ok(coldStep, `${lang}: cold-duration planner step is present`);
    const expected = hours === 24 ? '24 h' : '15 h 11 min';
    assert.ok(coldStep.desc.includes(expected), `${lang}: ${coldStep.desc}`);
    if (hours !== 24) assert.ok(!coldStep.desc.includes(String(hours)), `${lang}: raw numeric duration leaked`);
  }
}
assert.match(calculatorSource, /HOURS: formatHoursLabel\(fridgeHours\)/);
assert.match(calculatorSource, /HOURS: formatHoursLabel\(finalFridgeHours\)/);
assert.match(calculatorSource, /HOURS: formatHoursLabel\(ballsColdHours\)/);

console.log('Beginner B3.3 focused regressions passed for HR/EN/DE/SL.');
