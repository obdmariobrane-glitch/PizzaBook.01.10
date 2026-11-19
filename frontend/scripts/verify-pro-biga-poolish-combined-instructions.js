#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const localRequire = (request) => {
    if (request.startsWith('./')) {
      const localPath = path.resolve(path.dirname(filePath), request.endsWith('.ts') ? request : `${request}.ts`);
      if (fs.existsSync(localPath)) return loadTypeScriptModule(localPath);
    }
    return require(request);
  };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, require: localRequire }, { filename: filePath });
  return moduleRef.exports;
}

const frontendRoot = path.join(path.dirname(module.filename), '..');
const { buildCombinedPrefermentInstructions, buildCombinedP3Instructions, getCombinedOvenBakingSteps } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'combinedPrefermentSteps.ts'));
const { getYeastAwarePrefermentSteps } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const { doughCalc, formatBakingTimeRange, getFermentationSchedule, PIZZA_STYLE_PROFILES } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const { allocateCombinedFlourForDisplay, splitCombinedFlourForDisplay } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'proMethods', 'prefermentWaterAlignment.ts'));
const screenSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const combinedPathGuardExpression = screenSource.match(/const combinedPrefermentPath = (combinedPrefermentsEnabled && !proBaseRecipeCalculationBlocked)\s*\?/)?.[1];
const phaseBSelectionExpression = screenSource.match(/const bigaPhaseBSteps = (combinedInstructions\s*\?[\s\S]*?\n\s*: path\.p2\.steps);/)?.[1];
const phaseBRenderExpression = screenSource.match(/steps=\{(withProIceWaterInstruction\(bigaHomeSchedule \? withoutBigaScheduleTiming\(bigaPhaseBSteps\) : adaptFermentationSteps\(bigaPhaseBSteps, roomHours, fridgeHours, fridgeTemp, lang\)\))\}/)?.[1];
assert.ok(phaseBSelectionExpression, 'combined Phase B selection expression must be extractable from the screen');
assert.ok(phaseBRenderExpression, 'combined Phase B PhaseBlock steps expression must be extractable from the screen');
assert.ok(combinedPathGuardExpression, 'combined instruction generation must use the existing blocked-recipe guard');
const timerSource = fs.readFileSync(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'), 'utf8');
const timerSourceFile = ts.createSourceFile('prefermentSteps.ts', timerSource, ts.ScriptTarget.Latest, true);
let timerTableInitializer;
for (const statement of timerSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  const timerDeclaration = statement.declarationList.declarations.find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === 'PHASE_TIMER_DURATIONS');
  if (timerDeclaration?.initializer) timerTableInitializer = timerDeclaration.initializer.getText(timerSourceFile);
}
assert.ok(timerTableInitializer, 'existing PHASE_TIMER_DURATIONS source must be available');
const phaseTimerDurations = vm.runInNewContext(`(${timerTableInitializer})`);

const languages = {
  hr: { rest: '5 minuta', independent: 'neovisno', biga: 'Bigu', poolish: 'Poolish', balls: '3 kuglica', yeast: { fresh: 'Svježi kvasac', activeDry: 'Aktivni suhi kvasac', dry: 'Instant suhi kvasac' }, mixing: { hand: 'Rukama', mixer: 'kućnim mikserom', spiral: 'spiralnim mikserom' } },
  en: { rest: '5 minutes', independent: 'independently', biga: 'Biga', poolish: 'Poolish', balls: '3 balls', yeast: { fresh: 'fresh yeast', activeDry: 'active dry yeast', dry: 'instant dry yeast' }, mixing: { hand: 'by hand', mixer: 'home mixer', spiral: 'spiral mixer' } },
  de: { rest: '5 Minuten', independent: 'unabhängig', biga: 'Biga', poolish: 'Poolish', balls: '3 Teiglinge', yeast: { fresh: 'Frischhefe', activeDry: 'Aktiv-Trockenhefe', dry: 'Instant-Trockenhefe' }, mixing: { hand: 'von Hand', mixer: 'Haushaltsmixer', spiral: 'Spiralkneter' } },
  sl: { rest: '5 minut', independent: 'neodvisno', biga: 'bigo', poolish: 'poolish', balls: '3 kroglic', yeast: { fresh: 'Sveži kvas', activeDry: 'Aktivni suhi kvas', dry: 'Instant suhi kvas' }, mixing: { hand: 'z roko', mixer: 'domačim mešalnikom', spiral: 'spiralnim mešalnikom' } },
};
const poolishAdditionText = {
  hr: {
    hand: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu za ručni zamjes s Bigom prije nastavka završnog zamjesa.',
    mixer: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu kućnog miksera s Bigom prije nastavka završnog zamjesa.',
    spiral: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu spiralnog miksera s Bigom prije nastavka završnog zamjesa.',
  },
  en: {
    hand: 'Add the entire prepared Poolish to the same hand-mixing bowl as the Biga before continuing the final mix.',
    mixer: 'Add the entire prepared Poolish to the same home-mixer bowl as the Biga before continuing the final mix.',
    spiral: 'Add the entire prepared Poolish to the same spiral-mixer bowl as the Biga before continuing the final mix.',
  },
  de: {
    hand: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Knetschüssel, bevor Sie mit dem Hauptteig fortfahren.',
    mixer: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Schüssel der Haushaltsmaschine, bevor Sie mit dem Hauptteig fortfahren.',
    spiral: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Schüssel des Spiralkneters, bevor Sie mit dem Hauptteig fortfahren.',
  },
  sl: {
    hand: 'Ves pripravljeni poolish dodajte v isto posodo za ročno gnetenje z bigo, preden nadaljujete končno gnetenje.',
    mixer: 'Ves pripravljeni poolish dodajte v isto posodo domačega mešalnika z bigo, preden nadaljujete končno gnetenje.',
    spiral: 'Ves pripravljeni poolish dodajte v isto posodo spiralnega mešalnika z bigo, preden nadaljujete končno gnetenje.',
  },
};
const numberLocales = { hr: 'hr-HR', en: 'en-US', de: 'de-DE', sl: 'sl-SI' };
const formatCombinedAmount = (lang, grams, precise = false) => {
  const formatted = `${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: precise ? 2 : 0, maximumFractionDigits: 2 }).format(grams)} g`;
  if (grams <= 0 || !/^0(?:[,.]0+)?\s*g$/i.test(formatted)) return formatted;
  let precision = 3;
  while (precision < 10 && Number(grams.toFixed(precision)) === 0) precision += 1;
  return `${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(grams)} g`;
};
const zeroYeastSentences = {
  hr: 'Otopite −0,00 g kvasca u vodi.',
  en: 'Dissolve -0.00 g yeast in the water.',
  de: 'Lösen Sie −0,00 g Hefe im Wasser auf.',
  sl: 'Raztopite −0,00 g kvasa v vodi.',
};
const zeroWaterSentences = {
  hr: 'Početna tekuća voda: −0,00 g. Količina preostale tekuće vode za postupno dodavanje: −0,00 g.',
  en: 'Initial liquid water: -0.00 g. Remaining liquid water to add gradually: -0.00 g.',
  de: 'Anfängliches Flüssigwasser: −0,00 g. Verbleibendes Flüssigwasser zur schrittweisen Zugabe: −0,00 g.',
  sl: 'Začetna tekoča voda: −0,00 g. Količina preostale tekoče vode za postopno dodajanje: −0,00 g.',
};
const zeroWaterMixedSentences = {
  hr: 'Dodajte preostalo brašno; dodajte −0,00 g vode i pokrenite mikser u 1. brzini.',
  en: 'Add the remaining flour; add -0.00 g water and start the mixer on speed 1.',
  de: 'Geben Sie das restliche Mehl hinzu; geben Sie −0,00 g Wasser dazu und starten Sie den Mixer auf Stufe 1.',
  sl: 'Dodajte preostalo moko; dodajte −0,00 g vode in zaženite mešalnik pri 1. hitrosti.',
};
const preservedZeroWaterActions = {
  hr: /preostalo brašno.*mikser u 1\. brzini/i,
  en: /remaining flour.*mixer on speed 1/i,
  de: /restliche mehl.*mixer auf stufe 1/i,
  sl: /preostalo moko.*mešalnik pri 1\. hitrosti/i,
};
const zeroWaterLabels = {
  hr: /početna tekuća voda|količina preostale tekuće vode/i,
  en: /initial liquid water|remaining liquid water/i,
  de: /anfängliches flüssigwasser|verbleibendes flüssigwasser/i,
  sl: /začetna tekoča voda|količina preostale tekoče vode/i,
};
const bigaP3Timers = phaseTimerDurations['biga-hand-P3'];
assert.deepEqual(Array.from(bigaP3Timers, (timer) => [timer.id, timer.seconds, timer.kind]), [
  ['rest7m', 420, 'rest'], ['rt30m', 1800, 'rt'], ['fr60m', 3600, 'fridge'],
  ['brt15m', 900, 'ballsRt'], ['bfr5h', 18000, 'ballsFridge'], ['pb15m', 900, 'preBake'],
]);
const formatTimerDuration = (seconds) => seconds % 3600 === 0 ? `${seconds / 3600} hours` : `${seconds / 60} minutes`;
const makeSpiralRecipe = (remaining, formatYeastWeight) => ({
  flourGrams: remaining.flour,
  flourLabel: 'Caputo 00 flour',
  waterBaseGrams: remaining.water,
  liquidWaterGrams: remaining.water,
  iceGrams: 0,
  initialWaterPct: 90,
  yeastGrams: remaining.yeast,
  saltGrams: remaining.salt,
  oilGrams: remaining.oil,
  flourBehavior: 'standard',
  formatWeight: (grams, precise = false) => formatYeastWeight(grams, precise),
});
const noExtraYeastCopy = {
  hr: /nije potrebno dodavati dodatni kvasac/i,
  en: /no additional yeast is needed/i,
  de: /keine zusätzliche hefe erforderlich/i,
  sl: /ni treba dodati dodatnega kvasa/i,
};
for (const lang of Object.keys(languages)) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    for (const yeastType of ['fresh', 'activeDry', 'dry']) {
      const noYeastPath = getYeastAwarePrefermentSteps(
        lang, 'biga', mixing, yeastType, '0.00 g', false, false, 'caputo00', false,
        '300 g Caputo 00 flour', 4, undefined, false,
      );
      assert.match(noYeastPath.p2.steps.join(' '), noExtraYeastCopy[lang], `${lang}/${mixing}/${yeastType}: zero final yeast is explicit`);
      assert.doesNotMatch(noYeastPath.p2.steps.join(' '), /(?<![\d.,])0(?:[,.]0+)?\s*g/i, `${lang}/${mixing}/${yeastType}: no zero-gram yeast action`);
    }
  }
}
assert.match(screenSource, /combinedSpiralRecipe, dough\.main\.yeast > 0\)/);
assert.match(screenSource, /fridgeTemp, proSpiralRecipe, dough\.main\.yeast > 0\)/);

const roundingRegression = doughCalc({
  pizzas: 1,
  ballWeight: 254,
  hydration: 95,
  saltPct: 2.8,
  oilPct: 0,
  roomHours: 4,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  prefermentHours: 16,
  yeastType: 'fresh',
  mixing: 'home',
  flourType: 'caputo00',
  bigaPct: 20,
  bigaHydrationPct: 70,
  poolishPct: 80,
  poolishHydrationPct: 100,
  method: 'biga',
  bigaEnabled: true,
  poolishEnabled: true,
});
assert.equal(roundingRegression.bigaPoolishModel?.mathStatus, 'valid', 'confirmed rounding case is mathematically feasible');
assert.equal(roundingRegression.total.flour, 128);
assert.equal(roundingRegression.preferments?.biga?.flour, 26);
assert.equal(roundingRegression.preferments?.poolish?.flour, 103);
assert.equal(roundingRegression.main.flour, -1, 'calculator output remains unchanged for the regression case');
const roundingDisplay = allocateCombinedFlourForDisplay(roundingRegression.bigaPoolishModel, roundingRegression.total.flour);
assert.deepEqual({ ...roundingDisplay }, { totalFlourGrams: 128, bigaFlourGrams: 25, poolishFlourGrams: 103, finalFlourGrams: 0, displayUnit: 'g' });
assert.equal(roundingDisplay.bigaFlourGrams + roundingDisplay.poolishFlourGrams + roundingDisplay.finalFlourGrams, roundingDisplay.totalFlourGrams);

for (const lang of Object.keys(languages)) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    const remaining = { ...roundingRegression.main, flour: roundingDisplay.finalFlourGrams };
    const formatWeight = (grams, precise = false) => `${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: precise ? 2 : 0, maximumFractionDigits: 2 }).format(grams)} g`;
    const path = getYeastAwarePrefermentSteps(
      lang, 'biga', mixing, 'fresh', formatWeight(remaining.yeast, true), false, remaining.oil > 0,
      'caputo00', false, undefined, 4, makeSpiralRecipe(remaining, formatWeight),
    );
    const instructions = buildCombinedPrefermentInstructions({
      lang, mixing, yeastType: 'fresh', yeastLabel: 'fresh yeast',
      biga: { ...roundingRegression.preferments.biga, flour: roundingDisplay.bigaFlourGrams },
      poolish: { ...roundingRegression.preferments.poolish, flour: roundingDisplay.poolishFlourGrams },
      remaining,
      bigaPct: 20, bigaHydrationPct: 70, poolishPct: 80, poolishHydrationPct: 100,
      bigaPhases: [{ environment: 'room', hours: 4, temperature: 22 }],
      poolishPhases: [{ environment: 'room', hours: 4, temperature: 22 }],
      ballCount: 1, ballWeight: '254 g', baseFinalMixSteps: path.p2.steps,
      basePostMixSteps: [], fridgeHours: 24, fridgeTemperatureC: 4,
      formatWeight, formatYeastWeight: (grams) => formatWeight(grams, true),
      formatDuration: (hours) => `${hours} hours`, formatTimerDuration, formatTemperature: (celsius) => `${celsius}°C`,
    });
    const selectedP2Steps = vm.runInNewContext(phaseBSelectionExpression, {
      combinedInstructions: instructions,
      path: { p2: { steps: path.p2.steps } },
    });
    assert.ok(instructions.biga.steps.some((step) => step.includes(formatWeight(roundingDisplay.bigaFlourGrams))), `${lang}/${mixing}: Phase A uses reconciled Biga flour`);
    assert.ok(instructions.poolish.steps.some((step) => step.includes(formatWeight(roundingDisplay.poolishFlourGrams))), `${lang}/${mixing}: Phase A uses reconciled Poolish flour`);
    assert.ok(Array.from(selectedP2Steps).every((step) => !/(?<![\d.,])[−-]1\s*g\b/.test(step)), `${lang}/${mixing}: P2 has no negative rounded flour`);
    assert.ok(!Array.from(selectedP2Steps).some((step) => /(?:remaining flour|preostalo brašno|restliche mehl|preostalo moko)\s*\(\s*0(?:[,.]0+)?\s*(?:g|oz|lb)/i.test(step)), `${lang}/${mixing}: P2 has no zero-flour action`);
    if (mixing === 'spiral') assert.ok(Array.from(selectedP2Steps).some((step) => /spiral mixer|spiralni mikser|spiralni mešalnik|spiralkneter/i.test(step)), `${lang}: spiral mixing instruction remains`);
  }
}

for (const hydration of [55, 62, 70, 80, 95]) {
  for (const ballWeight of [150, 254, 300, 390, 500, 700, 1200, 1600]) {
    for (let bigaPct = 20; bigaPct <= 80; bigaPct += 5) {
      for (const [bigaHydrationPct, poolishHydrationPct] of [[45, 80], [62, 100], [70, 100], [100, 120]]) {
        const result = doughCalc({
          pizzas: 1, ballWeight, hydration, saltPct: 2.8, oilPct: 0,
          roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, prefermentHours: 16,
          yeastType: 'fresh', mixing: 'home', flourType: 'caputo00', method: 'biga',
          bigaEnabled: true, poolishEnabled: true, bigaPct, poolishPct: 100 - bigaPct,
          bigaHydrationPct, poolishHydrationPct,
        });
        const allocation = allocateCombinedFlourForDisplay(result.bigaPoolishModel, result.total.flour);
        if (result.bigaPoolishModel.mathStatus === 'valid') {
          assert.ok(allocation, `${ballWeight}g/${hydration}%/${bigaPct}-${100 - bigaPct}%: valid model allocates for display`);
          assert.equal(allocation.bigaFlourGrams + allocation.poolishFlourGrams + allocation.finalFlourGrams, allocation.totalFlourGrams);
          assert.ok(allocation.bigaFlourGrams >= 0 && allocation.poolishFlourGrams >= 0 && allocation.finalFlourGrams >= 0);
          const usAllocation = allocateCombinedFlourForDisplay(result.bigaPoolishModel, result.total.flour, 'us');
          assert.ok(usAllocation, `${ballWeight}g/${hydration}%/${bigaPct}-${100 - bigaPct}%: valid model allocates in US units`);
          const usPrecision = usAllocation.displayUnit === 'lb' ? 100 : 10;
          const usUnitGrams = usAllocation.displayUnit === 'lb' ? 453.592 : 28.3495;
          const usDisplayedSteps = [usAllocation.bigaFlourGrams, usAllocation.poolishFlourGrams, usAllocation.finalFlourGrams]
            .reduce((sum, amount) => sum + Math.round(amount / usUnitGrams * usPrecision), 0);
          assert.equal(usDisplayedSteps, Math.round(usAllocation.totalFlourGrams / usUnitGrams * usPrecision), `${ballWeight}g/${hydration}%/${bigaPct}-${100 - bigaPct}%: US component displays sum to total`);
        } else {
          assert.equal(allocation, null, `${ballWeight}g/${hydration}%/${bigaPct}-${100 - bigaPct}%: invalid model is not reconciled`);
          assert.equal(allocateCombinedFlourForDisplay(result.bigaPoolishModel, result.total.flour, 'us'), null);
        }
      }
    }
  }
}
for (const displayUnit of ['g', 'oz', 'lb']) {
  for (const blendPercent of [0, 20, 50, 80, 100]) {
    const blendDisplay = splitCombinedFlourForDisplay(roundingDisplay.finalFlourGrams, blendPercent, displayUnit);
    assert.ok(blendDisplay, `${displayUnit}/${blendPercent}%: custom blend display split exists`);
    assert.equal(blendDisplay.first + blendDisplay.second, roundingDisplay.finalFlourGrams, `${displayUnit}/${blendPercent}%: custom blend display sums to final flour`);
    assert.ok(blendDisplay.first >= 0 && blendDisplay.second >= 0);
  }
}

const invalidWaterRegression = doughCalc({
  pizzas: 1, ballWeight: 254, hydration: 60, saltPct: 2.8, oilPct: 0,
  roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, prefermentHours: 16,
  yeastType: 'fresh', mixing: 'home', flourType: 'caputo00',
  bigaPct: 20, bigaHydrationPct: 70, poolishPct: 80, poolishHydrationPct: 100,
  method: 'biga', bigaEnabled: true, poolishEnabled: true,
});
assert.equal(invalidWaterRegression.bigaPoolishModel?.mathStatus, 'negative-remainder');
assert.equal(allocateCombinedFlourForDisplay(invalidWaterRegression.bigaPoolishModel, invalidWaterRegression.total.flour), null, 'truly infeasible model is never reconciled');
for (const useIce of [false, true]) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    let generatorCalls = 0;
    const shouldGenerate = vm.runInNewContext(combinedPathGuardExpression, {
      combinedPrefermentsEnabled: true,
      proBaseRecipeCalculationBlocked: invalidWaterRegression.main.water < 0 || invalidWaterRegression.bigaPoolishModel.mathStatus === 'negative-remainder',
    });
    if (shouldGenerate) generatorCalls += 1;
    assert.equal(generatorCalls, 0, `ice ${useIce ? 'on' : 'off'}/${mixing}: blocked recipe skips combined instruction generation`);
  }
}
const invalidFlourModel = {
  mathStatus: 'negative-remainder',
  total: { flourGrams: 128 },
  biga: { flourGrams: 102, waterGrams: 71, saltGrams: 0 },
  poolish: { flourGrams: 38, waterGrams: 38, saltGrams: 0 },
  final: { flourGrams: -12, waterGrams: 0, saltGrams: 4 },
};
assert.equal(allocateCombinedFlourForDisplay(invalidFlourModel, 128), null, 'negative raw final flour is never reconciled');

  for (const lang of Object.keys(languages)) {
    for (const mixing of ['hand', 'mixer', 'spiral']) {
    for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    const formatYeastWeight = (grams, precise = true) => formatCombinedAmount(lang, grams, precise);
    const remaining = { flour: 470, water: 296, yeast: 2.5, salt: 28, oil: 12, psyllium: 4 };
    const bigaPath = getYeastAwarePrefermentSteps(
      lang, 'biga', mixing, yeastType, formatYeastWeight(remaining.yeast), false, remaining.oil > 0,
      'caputo00', false, `${remaining.flour} g Caputo 00 flour`, 4, makeSpiralRecipe(remaining, formatYeastWeight),
    );
    const result = buildCombinedPrefermentInstructions({
      lang, mixing, yeastType, yeastLabel: 'fresh yeast',
      biga: { flour: 320, water: 144, yeast: 3.2 },
      poolish: { flour: 210, water: 210, yeast: 1.1 },
      remaining,
      bigaPct: 32, bigaHydrationPct: 45, poolishPct: 21, poolishHydrationPct: 100,
      bigaPhases: [{ environment: 'room', hours: 6, temperature: 21 }, { environment: 'fridge', hours: 10, temperature: 4 }],
        bigaPhases: [{ environment: 'room', hours: 6, temperature: 21 }, { environment: 'fridge', hours: 10, temperature: 22 }],
      poolishPhases: [{ environment: 'room', hours: 3, temperature: 22 }, { environment: 'fridge', hours: 9, temperature: 4 }],
      ballCount: 3, ballWeight: '390 g', baseFinalMixTitle: 'Final dough hand mix',
      baseFinalMixSteps: bigaPath.p2.steps,
      basePostMixSteps: bigaPath.p3.steps,
      fridgeHours: 24,
      fridgeTemperatureC: 4,
      formatWeight: (grams) => `${grams} g`,
      formatYeastWeight,
      formatDuration: (hours) => `${hours} hours`,
      formatTimerDuration,
      formatTemperature: (celsius) => `${celsius}°C`,
      fridgeTemperatureC: 4,
    });
    assert.ok(result.biga.steps.some((step) => step.includes('320 g') && step.includes('144 g') && step.includes(formatYeastWeight(3.2))), `${lang}/${mixing}: Biga amounts`);
    assert.ok(result.poolish.steps.some((step) => step.includes('210 g') && step.includes(formatYeastWeight(1.1))), `${lang}/${mixing}: Poolish amounts`);
    assert.ok(result.biga.steps[3].toLocaleLowerCase().includes(languages[lang].mixing[mixing].toLocaleLowerCase()), `${lang}/${mixing}: mixing-specific Biga preparation`);
    assert.ok(result.biga.steps[2].includes(languages[lang].yeast[yeastType]), `${lang}/${mixing}/${yeastType}: Biga yeast handling`);
    assert.ok(result.poolish.steps[2].includes(languages[lang].yeast[yeastType]), `${lang}/${mixing}/${yeastType}: Poolish yeast handling`);
    assert.equal(result.biga.timers.length, 2, `${lang}/${mixing}: separate Biga timers`);
    assert.equal(result.poolish.timers.length, 2, `${lang}/${mixing}: separate Poolish timers`);
    assert.ok(result.biga.steps.some((step) => step.includes('4°C')), `${lang}/${mixing}: Biga refrigerator temperature`);
    assert.deepEqual(Array.from(result.biga.timers, (timer) => timer.seconds), [21600, 36000]);
    assert.deepEqual(Array.from(result.poolish.timers, (timer) => timer.seconds), [10800, 32400]);
    assert.equal(new Set([...result.biga.timers, ...result.poolish.timers].map((timer) => timer.id)).size, 4);
    assert.ok(result.biga.info.includes(languages[lang].independent));
    assert.ok(result.poolish.info.includes(languages[lang].independent));
    assert.ok(result.finalMixSteps[0].includes(languages[lang].biga) && result.finalMixSteps[0].includes(languages[lang].poolish));
    assert.ok(result.finalMixSteps[0].includes(poolishAdditionText[lang][mixing]), `${lang}/${mixing}: explicit whole-Poolish addition to the selected vessel`);
    assert.equal(result.finalMixSteps[0].includes(languages[lang].biga), true);
    for (const step of bigaPath.p2.steps.slice(1)) assert.ok(result.finalMixSteps.includes(step), `${lang}/${mixing}: preserve Biga P2 continuation`);
    assert.equal(result.finalMixSteps.length, bigaPath.p2.steps.length, `${lang}/${mixing}: no added final-mix steps`);
    assert.ok(result.postMixSteps.some((step) => step.includes(languages[lang].balls) && step.includes('390 g')));
    assert.ok(result.postMixSteps.every((step) => !/260\s*[–-]\s*(?:280|300)\s*g/.test(step)));
    }
  }
}

const selectedBallingStepText = {
  hr: (count, weight) => `Podijelite tijesto na ${count} kuglica od ${weight}.`,
  en: (count, weight) => `Divide the dough into ${count} balls of ${weight}.`,
  de: (count, weight) => `Teilen Sie den Teig in ${count} Teiglinge zu je ${weight}.`,
  sl: (count, weight) => `Testo razdelite na ${count} kroglic po ${weight}.`,
};
const fixedBallWeightPattern = /\b\d+(?:[.,]\d+)?\s*[–-]\s*\d+(?:[.,]\d+)?\s*g\b/i;
const screenAst = ts.createSourceFile('index.tsx', screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function screenExpression(name) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer.getText(screenAst);
    ts.forEachChild(node, visit);
  }
  visit(screenAst);
  assert.ok(initializer, `${name} must exist in the screen`);
  return initializer;
}
function evaluateScreenExpression(name, context) {
  const compiled = ts.transpileModule(`globalThis.result = (${screenExpression(name)});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const sandbox = { ...context };
  vm.runInNewContext(compiled, sandbox);
  return sandbox.result;
}
for (const lang of Object.keys(numberLocales)) {
  const compiledFormatter = ts.transpileModule(`globalThis.formatter = (${screenExpression('formatCombinedYeastWeight')});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const routeWeight = evaluateScreenExpression('weight', {
    formatWeight: (grams) => `${new Intl.NumberFormat(numberLocales[lang], { maximumFractionDigits: 2 }).format(Math.round(grams * 100) / 100)} g`,
    measurementSystem: 'metric',
    lang,
    isBeginner: false,
  });
  const formatterContext = {
    lang,
    weight: routeWeight,
    Math,
    Intl,
  };
  vm.runInNewContext(compiledFormatter, formatterContext);
  const formatter = formatterContext.formatter;
  assert.equal(formatter(1.234), `${new Intl.NumberFormat(numberLocales[lang], { maximumFractionDigits: 2 }).format(1.23)} g`, `${lang}: yeast display is capped at two decimals`);
  assert.equal(formatter(0.004), `<${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0.01)} g`, `${lang}: tiny positive yeast stays visibly nonzero without excess decimals`);
}
const summaryCases = [
  { pizzas: 4, ballWeight: 250 },
  { pizzas: 2, ballWeight: 600 },
].map(({ pizzas, ballWeight }) => ({
  pizzas,
  ballWeight,
  result: doughCalc({
    pizzas,
    ballWeight,
    hydration: 62,
    saltPct: 2.8,
    oilPct: 0,
    roomHours: 4,
    roomTemp: 22,
    fridgeHours: 24,
    fridgeTemp: 4,
    prefermentHours: 16,
    yeastType: 'fresh',
    mixing: 'home',
    flourType: 'caputo00',
    bigaPct: 50,
    bigaHydrationPct: 62,
    poolishPct: 30,
    poolishHydrationPct: 100,
    method: 'biga',
    bigaEnabled: true,
    poolishEnabled: true,
    fermentationSchedule: { phases: [{ kind: 'preferment', environment: 'room', hours: 10, temperature: 21 }], prefermentHours: 10, prefermentRoomHours: 10, prefermentFridgeHours: 0 },
    bigaFermentationSchedule: { phases: [{ kind: 'preferment', environment: 'room', hours: 10, temperature: 21 }], prefermentHours: 10, prefermentRoomHours: 10, prefermentFridgeHours: 0 },
    poolishFermentationSchedule: { phases: [{ kind: 'preferment', environment: 'room', hours: 4, temperature: 22 }, { kind: 'preferment', environment: 'fridge', hours: 8, temperature: 4 }], prefermentHours: 12, prefermentRoomHours: 4, prefermentFridgeHours: 8, poolishMode: 'rt-ct' },
  }),
}));
const pizzaStyleCases = Object.keys(PIZZA_STYLE_PROFILES).flatMap((pizzaStyle) => pizzaStyle === 'romana'
  ? [{ pizzaStyle, isRomanTeglia: false }, { pizzaStyle, isRomanTeglia: true }]
  : [{ pizzaStyle, isRomanTeglia: false }]);
const ovenTypes = ['ooni', 'homeStone', 'homePan', 'kamado'];
assert.ok(screenSource.includes('steps={combinedInstructions.biga.steps}'), 'combined Biga Phase A renders all generated steps');
assert.ok(screenSource.includes('steps={combinedInstructions.poolish.steps}'), 'combined Poolish Phase A renders all generated steps');
assert.ok(screenSource.includes('timers={combinedInstructions.biga.timers}'), 'Biga Phase A uses its own generated timers');
assert.ok(screenSource.includes('timers={combinedInstructions.poolish.timers}'), 'Poolish Phase A uses its own generated timers');
assert.match(screenSource, /label: `Poolish · \$\{stageLabel\} \$\{index \+ 1\} · \$\{environmentLabel\}`/);
assert.match(screenSource, /seconds: phase\.hours \* 3600/);
assert.match(screenSource, /hr: 'Sobna temperatura', en: 'Room temperature', de: 'Raumtemperatur', sl: 'Sobna temperatura'/);
assert.match(screenSource, /hr: 'Hladnjak', en: 'Refrigerator', de: 'Kühlschrank', sl: 'Hladilnik'/);
assert.match(screenSource, /hr: 'ukupno', en: 'total', de: 'gesamt', sl: 'skupaj'/);
assert.ok(screenSource.includes('${weight(blendFlourAmounts.first)} ${flourName(lang, blendA)} + ${weight(blendFlourAmounts.second)} ${flourName(lang, blendB)}'), 'fallback flour amounts do not duplicate their formatted unit');
assert.doesNotMatch(screenSource, /weight\(blendFlourAmounts\.first\)\} g/);
assert.doesNotMatch(screenSource, /weight\(dough\.main\.flour\)\} g/);
for (const { pizzas, ballWeight, result: summary } of summaryCases) {
  assert.ok(summary.preferments?.biga && summary.preferments.poolish, `${pizzas} x ${ballWeight} g calculator result keeps separate preferment quantities`);
for (const lang of Object.keys(languages)) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    const formatYeastWeight = (grams, precise = true) => formatCombinedAmount(lang, grams, precise);
    const bigaPath = getYeastAwarePrefermentSteps(
      lang, 'biga', mixing, 'fresh', formatYeastWeight(summary.main.yeast), false, summary.main.oil > 0,
      'caputo00', false, `${summary.main.flour} g Caputo 00 flour`, 4, makeSpiralRecipe(summary.main, formatYeastWeight),
    );
    const result = buildCombinedPrefermentInstructions({
      lang, mixing, yeastType: 'fresh', yeastLabel: 'fresh yeast',
      biga: summary.preferments.biga,
      poolish: summary.preferments.poolish,
      remaining: summary.main,
      bigaPct: 50, bigaHydrationPct: 62, poolishPct: 30, poolishHydrationPct: 100,
      bigaPhases: summary.prefermentSchedules.biga.phases,
      poolishPhases: summary.prefermentSchedules.poolish.phases,
      ballCount: pizzas, ballWeight: `${ballWeight} g`,
      baseFinalMixSteps: bigaPath.p2.steps,
      basePostMixSteps: bigaPath.p3.steps,
      fridgeHours: 24,
      fridgeTemperatureC: 4,
      formatWeight: (grams) => `${grams} g`,
      formatYeastWeight,
      formatDuration: (hours) => `${hours} hours`,
      formatTimerDuration,
      formatTemperature: (celsius) => `${celsius}°C`,
    });
    const expectedBallingStep = selectedBallingStepText[lang](pizzas, `${ballWeight} g`);
    assert.equal(result.selectedBallingStep, expectedBallingStep, `${pizzas}x${ballWeight}/${lang}/${mixing}: builder uses selected count and mass`);
    const renderedCombinedP3 = buildCombinedP3Instructions({
      lang,
      baseSteps: bigaPath.p3.steps,
      selectedBallingStep: result.selectedBallingStep,
      fridgeHours: 24,
      temperingHours: 2,
      fridgeTemperature: '4°C',
      isGlutenFree: false,
      formatDuration: (seconds) => seconds % 3600 === 0 ? `${seconds / 3600} hours` : `${seconds / 60} minutes`,
    });
    const renderedCombinedP3Steps = renderedCombinedP3.steps;
    assert.ok(renderedCombinedP3Steps.includes(expectedBallingStep), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered P3 uses selected count and mass`);
    assert.ok(!renderedCombinedP3Steps.some((step) => fixedBallWeightPattern.test(step)), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered P3 has no fixed balling range`);
    for (const { pizzaStyle, isRomanTeglia } of pizzaStyleCases) {
      const stylePath = getYeastAwarePrefermentSteps(
        lang, 'biga', mixing, 'fresh', formatYeastWeight(summary.main.yeast), isRomanTeglia, summary.main.oil > 0,
        'caputo00', false, `${summary.main.flour} g Caputo 00 flour`, 4, makeSpiralRecipe(summary.main, formatYeastWeight),
      );
      const styleP3Steps = isRomanTeglia
        ? [stylePath.p3.steps[0], stylePath.p3.steps[1], 'Teglia proof step', 'Teglia bake step']
        : stylePath.p3.steps;
      for (const oven of ovenTypes) {
        const renderedStyleP3Steps = isRomanTeglia
          ? styleP3Steps
          : buildCombinedP3Instructions({
            lang,
            baseSteps: styleP3Steps,
            selectedBallingStep: result.selectedBallingStep,
            fridgeHours: 24,
            temperingHours: 2,
            fridgeTemperature: '4°C',
            isGlutenFree: false,
            formatDuration: (seconds) => seconds % 3600 === 0 ? `${seconds / 3600} hours` : `${seconds / 60} minutes`,
          }).steps;
        if (isRomanTeglia) {
          assert.ok(!renderedStyleP3Steps.some((step) => fixedBallWeightPattern.test(step)), `${pizzaStyle}/teglia/${oven}/${lang}/${mixing}: no balling range is introduced`);
        } else {
          assert.ok(renderedStyleP3Steps.includes(expectedBallingStep), `${pizzaStyle}/${oven}/${lang}/${mixing}: selected ball mass and count reach P3`);
          assert.ok(!renderedStyleP3Steps.some((step) => fixedBallWeightPattern.test(step)), `${pizzaStyle}/${oven}/${lang}/${mixing}: no fixed balling range remains`);
        }
      }
    }
    const phaseBSteps = vm.runInNewContext(phaseBSelectionExpression, {
      combinedInstructions: { finalMixSteps: result.finalMixSteps },
      path: { p2: { steps: bigaPath.p2.steps } },
    });
    const renderedPhaseBSteps = vm.runInNewContext(phaseBRenderExpression, {
      withProIceWaterInstruction: (steps) => steps,
      bigaHomeSchedule: false,
      withoutBigaScheduleTiming: (steps) => steps,
      adaptFermentationSteps: (steps) => steps,
      bigaPhaseBSteps: phaseBSteps,
      roomHours: 4,
      fridgeHours: 24,
      fridgeTemp: 4,
      lang,
    });
    const renderedPhaseBText = Array.from(renderedPhaseBSteps).join(' ');
    assert.ok(renderedPhaseBText.includes(poolishAdditionText[lang][mixing]), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered Phase B names the whole Poolish and correct bowl`);
    assert.ok(renderedPhaseBText.includes(languages[lang].biga) && renderedPhaseBText.toLocaleLowerCase().includes(languages[lang].poolish.toLocaleLowerCase()), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered Phase B names both preferments`);
    for (const sourceStep of bigaPath.p2.steps.slice(1)) {
      const sourceSentences = sourceStep.split(/(?<=[.!?])\s+/).filter((sentence) => {
        const zeroYeast = summary.main.yeast <= 0 && /(?:yeast|kvas|hefe)/i.test(sentence) && /(?<![\d.,])[−-]?0(?:[,.]0+)?\s*g\b/i.test(sentence);
        const zeroWater = /(?:water|vod|wasser)/i.test(sentence) && /(?<![\d.,])[−-]?0(?:[,.]0+)?\s*g\b/i.test(sentence);
        return !zeroYeast && !zeroWater;
      });
      for (const sentence of sourceSentences) {
        assert.ok(renderedPhaseBText.includes(sentence), `${pizzas}x${ballWeight}/${lang}/${mixing}: preserve useful Phase B sentence: ${sentence}; rendered=${renderedPhaseBText}`);
      }
    }
    const bigaText = result.biga.steps.join(' ');
    const poolishText = result.poolish.steps.join(' ');
    const renderedPhaseASteps = [...result.biga.steps, ...result.poolish.steps];
    const renderedPhaseAText = renderedPhaseASteps.join(' ');
    for (const amount of [summary.preferments.biga.flour, summary.preferments.biga.water]) assert.ok(bigaText.includes(`${amount} g`), `${lang}/${mixing}: Biga summary amount ${amount} g`);
    assert.ok(bigaText.includes(formatYeastWeight(summary.preferments.biga.yeast)), `${pizzas}x${ballWeight}/${lang}/${mixing}: Biga yeast formatted to two decimals`);
    for (const amount of [summary.preferments.poolish.flour, summary.preferments.poolish.water]) assert.ok(poolishText.includes(`${amount} g`), `${lang}/${mixing}: Poolish summary amount ${amount} g`);
    assert.ok(poolishText.includes(formatYeastWeight(summary.preferments.poolish.yeast)), `${pizzas}x${ballWeight}/${lang}/${mixing}: Poolish yeast formatted to two decimals`);
    for (const amount of [summary.preferments.biga.flour, summary.preferments.biga.water, summary.preferments.poolish.flour, summary.preferments.poolish.water]) {
      assert.ok(renderedPhaseAText.includes(`${amount} g`), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered Phase A selects calculated amount ${amount} g`);
    }
    for (const amount of [summary.preferments.biga.yeast, summary.preferments.poolish.yeast]) {
      assert.ok(renderedPhaseAText.includes(formatYeastWeight(amount)), `${pizzas}x${ballWeight}/${lang}/${mixing}: rendered Phase A selects locale-formatted yeast ${formatYeastWeight(amount)}`);
    }
    assert.deepEqual(Array.from(result.biga.timers, (timer) => timer.seconds), [36000]);
    assert.deepEqual(Array.from(result.poolish.timers, (timer) => timer.seconds), [14400, 28800]);
    assert.ok(result.biga.steps.some((step) => step.includes('10 hours') && step.includes('21°C')), `${lang}/${mixing}: Biga schedule step matches its selected room phase`);
    assert.ok(result.poolish.steps.some((step) => step.includes('4 hours') && step.includes('22°C')), `${lang}/${mixing}: Poolish schedule step matches its selected room phase`);
    assert.ok(result.poolish.steps.some((step) => step.includes('8 hours') && step.includes('4°C')), `${lang}/${mixing}: Poolish schedule step matches its selected fridge phase`);
    assert.ok(result.biga.timers.every((timer) => timer.label.startsWith('Biga')), `${lang}/${mixing}: Biga timers have branch-specific labels`);
    assert.ok(result.poolish.timers.every((timer) => timer.label.startsWith('Poolish')), `${lang}/${mixing}: Poolish timers have branch-specific labels`);
    assert.equal(summary.prefermentSchedules.finalMixStartHours, 12, `${pizzas}x${ballWeight}: final mix waits until both independent branches finish`);
    }
  }
}

for (const lang of Object.keys(languages)) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    const result = buildCombinedPrefermentInstructions({
      lang, mixing, yeastType: 'fresh', yeastLabel: 'fresh yeast',
      biga: { flour: 320, water: 0, yeast: 0 },
      poolish: { flour: 0, water: 210, yeast: 0 },
      remaining: { flour: 0, water: -0.001, yeast: -0.001, salt: 0, oil: 0 },
      bigaPct: 32, bigaHydrationPct: 0, poolishPct: 21, poolishHydrationPct: 0,
      bigaPhases: [{ environment: 'fridge', hours: 10, temperature: 4 }],
      poolishPhases: [{ environment: 'room', hours: 3, temperature: 22 }],
      ballCount: 1, ballWeight: '390 g',
      baseFinalMixSteps: [`${languages[lang].biga} preparation: add it to the bowl.`, zeroYeastSentences[lang], zeroWaterSentences[lang], zeroWaterMixedSentences[lang], 'Continue the existing mixing procedure.'],
      basePostMixSteps: [],
      fridgeHours: 0,
      fridgeTemperatureC: 4,
      formatWeight: (grams) => `${grams} g`,
      formatYeastWeight: (grams) => `${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grams)} g`,
      formatDuration: (hours) => `${hours} hours`,
      formatTimerDuration,
      formatTemperature: (celsius) => `${celsius}°C`,
    });
    const bigaText = result.biga.steps.join(' ');
    const poolishText = result.poolish.steps.join(' ');
    assert.ok(!/\b0(?:[,.]0+)?\s*g\b/i.test(`${bigaText} ${poolishText}`), `${lang}/${mixing}: no zero-gram quantities`);
    assert.ok(!/yeast|kvas|hefe/i.test(bigaText), `${lang}/${mixing}: no zero-yeast Biga action`);
    assert.ok(!/flour|brašn|mehl|moke/i.test(poolishText), `${lang}/${mixing}: no zero-flour Poolish action`);
    assert.ok(!/water|vod|wasser/i.test(bigaText), `${lang}/${mixing}: no zero-water Biga action`);
    assert.ok(!result.finalMixSteps.some((step) => /[−-]0(?:[,.]0+)?\s*g\b/i.test(step)), `${lang}/${mixing}: no displayed negative zero`);
    assert.ok(!result.finalMixSteps.some((step) => zeroWaterLabels[lang].test(step)), `${lang}/${mixing}: no empty zero-water label`);
    const renderedZeroSteps = vm.runInNewContext(phaseBSelectionExpression, {
      combinedInstructions: { finalMixSteps: result.finalMixSteps },
      path: { p2: { steps: [] } },
    });
    const renderedZeroText = Array.from(renderedZeroSteps).join(' ');
    assert.ok(!/[-−]?0(?:[,.]0+)?\s*g\s*(?:water|vode|vode|wasser|vode)/i.test(renderedZeroText), `${lang}/${mixing}: rendered Phase B omits zero-water actions`);
    assert.ok(!/[-−]?0(?:[,.]0+)?\s*g\s*(?:yeast|kvas|hefe)/i.test(renderedZeroText), `${lang}/${mixing}: rendered Phase B omits zero-yeast actions`);
    assert.match(renderedZeroText, preservedZeroWaterActions[lang], `${lang}/${mixing}: rendered Phase B preserves flour and mixer speed`);
    assert.ok(Array.from(renderedZeroSteps).every((step) => step.trim().length > 0), `${lang}/${mixing}: no empty Phase B rows`);
    assert.ok(result.finalMixSteps.some((step) => /existing mixing procedure/i.test(step)) || result.finalMixSteps.length === 2, `${lang}/${mixing}: retain non-zero follow-up steps`);
    const smallAmount = 0.004;
    const smallRemaining = { flour: 470, water: smallAmount, yeast: smallAmount, salt: 28, oil: 0 };
    const formatSmallAmount = (grams, precise = false) => formatCombinedAmount(lang, grams, precise);
    const smallBigaPath = getYeastAwarePrefermentSteps(
      lang, 'biga', mixing, 'fresh', formatSmallAmount(smallAmount, true), false, false,
      'caputo00', false, `${smallRemaining.flour} g flour`, 4, makeSpiralRecipe(smallRemaining, formatSmallAmount),
    );
    const positiveWaterSentence = ({
      hr: `Dodajte ${formatSmallAmount(smallAmount)} vode i nastavite miješati.`,
      en: `Add ${formatSmallAmount(smallAmount)} water and continue mixing.`,
      de: `Geben Sie ${formatSmallAmount(smallAmount)} Wasser hinzu und mischen Sie weiter.`,
      sl: `Dodajte ${formatSmallAmount(smallAmount)} vode in nadaljujte z mešanjem.`,
    })[lang];
    const smallResult = buildCombinedPrefermentInstructions({
      lang, mixing, yeastType: 'fresh', yeastLabel: 'fresh yeast',
      biga: { flour: 100, water: 50, yeast: 0.1 },
      poolish: { flour: 50, water: 50, yeast: 0.1 },
      remaining: smallRemaining,
      bigaPct: 32, bigaHydrationPct: 50, poolishPct: 16, poolishHydrationPct: 100,
      bigaPhases: [{ environment: 'room', hours: 2, temperature: 21 }],
      poolishPhases: [{ environment: 'room', hours: 2, temperature: 21 }],
      ballCount: 1, ballWeight: '390 g',
      baseFinalMixSteps: [...smallBigaPath.p2.steps, positiveWaterSentence],
      basePostMixSteps: [], fridgeHours: 0, fridgeTemperatureC: 4,
      formatWeight: (grams) => formatSmallAmount(grams),
      formatYeastWeight: (grams) => formatSmallAmount(grams, true),
      formatDuration: (hours) => `${hours} hours`, formatTimerDuration, formatTemperature: (celsius) => `${celsius}°C`,
    });
    const renderedSmallSteps = vm.runInNewContext(phaseBSelectionExpression, {
      combinedInstructions: { finalMixSteps: smallResult.finalMixSteps },
      path: { p2: { steps: smallBigaPath.p2.steps } },
    });
    const renderedSmallText = Array.from(renderedSmallSteps).join(' ');
    assert.ok(renderedSmallText.includes(formatSmallAmount(smallAmount, true)), `${lang}/${mixing}: positive yeast remains visible at precise gram display`);
    assert.ok(renderedSmallText.includes(positiveWaterSentence), `${lang}/${mixing}: positive water addition remains intact`);
    assert.ok(!/[-−]?0(?:[,.]0+)?\s*g\s*(?:water|vode|wasser)/i.test(renderedSmallText), `${lang}/${mixing}: no rounded-zero water action`);
    assert.ok(!/[-−]?0(?:[,.]0+)?\s*g\s*(?:yeast|kvas|hefe)/i.test(renderedSmallText), `${lang}/${mixing}: no rounded-zero yeast action`);
    assert.ok(Array.from(renderedSmallSteps).every((step) => step.trim().length > 0), `${lang}/${mixing}: positive case has no empty rows`);
    assert.throws(() => buildCombinedPrefermentInstructions({
      lang, mixing, yeastType: 'fresh', yeastLabel: 'fresh yeast',
      biga: { flour: 320, water: 0, yeast: 0 }, poolish: { flour: 0, water: 210, yeast: 0 },
      remaining: { flour: 0, water: 0, yeast: 0, salt: -1, oil: 0 },
      bigaPct: 32, bigaHydrationPct: 0, poolishPct: 21, poolishHydrationPct: 0,
      bigaPhases: [{ environment: 'fridge', hours: 10, temperature: 4 }], poolishPhases: [{ environment: 'room', hours: 3, temperature: 22 }],
      ballCount: 1, ballWeight: '390 g', baseFinalMixSteps: ['Existing mix step.'], basePostMixSteps: [], fridgeHours: 0, fridgeTemperatureC: 4,
      formatWeight: (grams) => `${grams} g`,
      formatYeastWeight: (grams) => `${new Intl.NumberFormat(numberLocales[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grams)} g`,
      formatDuration: (hours) => `${hours} hours`, formatTimerDuration, formatTemperature: (celsius) => `${celsius}°C`,
    }), /finite, nonnegative calculated amount/);
  }
}

for (const sourceNeedle of [
  'const combinedPrefermentPath = combinedPrefermentsEnabled && !proBaseRecipeCalculationBlocked',
  'allocateCombinedFlourForDisplay(dough.bigaPoolishModel, dough.total.flour, measurementSystem)',
  'dough.bigaPoolishModel?.mathStatus === \'negative-remainder\'',
  'biga: { ...dough.preferments.biga, flour: combinedFlourDisplay.bigaFlourGrams }',
  'poolish: { ...dough.preferments.poolish, flour: combinedFlourDisplay.poolishFlourGrams }',
  'remaining: { ...dough.main, flour: combinedFlourDisplay.finalFlourGrams }',
  'formatFlourWeight: formatCombinedFlourWeight',
  'value={combinedFlourDisplay ? formatCombinedFlourWeight(combinedFlourDisplay.bigaFlourGrams) : weight(dough.preferments.biga.flour)}',
  'value={combinedFlourDisplay ? formatCombinedFlourWeight(combinedFlourDisplay.poolishFlourGrams) : weight(dough.preferments.poolish.flour)}',
  'value={combinedFlourDisplay ? formatCombinedFlourWeight(combinedFlourDisplay.totalFlourGrams) : weight(dough.total.flour)}',
  'combinedFlourDisplay ? formatCombinedFlourWeight(combinedFlourDisplay.finalFlourGrams) : weight(dough.main.flour)',
  'const combinedRemainingFlourDescription =',
  'const proSpiralFlourGrams = method === \'direct\' ? dough.total.flour : displayedMainFlour',
  'splitCombinedFlourForDisplay(proSpiralFlourGrams, blendPctA, combinedFlourDisplay.displayUnit)',
  'const phaseBSpiralRecipe = combinedInstructions ? combinedSpiralRecipe : proSpiralRecipe',
  'formatFlourWeight: formatCombinedFlourWeight',
  'bigaPhases: dough.prefermentSchedules.biga.phases',
  'poolishPhases: dough.prefermentSchedules.poolish.phases',
  'const formatCombinedWeight =',
  'const formatCombinedYeastWeight =',
  'formatWeight: combinedPrefermentsEnabled ? formatCombinedWeight : weight',
  '? combinedInstructions.finalMixSteps',
  'steps={combinedInstructions.biga.steps}',
  'steps={combinedInstructions.poolish.steps}',
  'timers={combinedInstructions.biga.timers}',
  'timers={combinedInstructions.poolish.timers}',
  'buildCombinedP3Instructions({',
  'getCombinedOvenBakingSteps({',
]) assert.ok(screenSource.includes(sourceNeedle), `Phase A screen integration is missing: ${sourceNeedle}`);
const recipeRenderSource = screenSource.slice(screenSource.indexOf('{/* 7. RECIPE STEPS */}'));
const detailedFallbackCondition = recipeRenderSource.match(/:\s*(!\(combinedInstructions && combinedPrefermentPath\) && detailedDirectStepsForDisplay)\s*\?\s*\(/)?.[1];
assert.ok(detailedFallbackCondition, 'detailed fallback condition must be extractable from the actual render branch');
assert.equal(vm.runInNewContext(detailedFallbackCondition, { combinedInstructions: {}, combinedPrefermentPath: {}, detailedDirectStepsForDisplay: true }), false, 'combined Phase A prevents the detailed fallback from taking over');
assert.equal(vm.runInNewContext(detailedFallbackCondition, { combinedInstructions: null, combinedPrefermentPath: null, detailedDirectStepsForDisplay: true }), true, 'single-method detailed rendering remains available');
const existingBigaRendererIndex = recipeRenderSource.indexOf(": method === 'biga' ? (");
assert.ok(existingBigaRendererIndex > recipeRenderSource.indexOf(detailedFallbackCondition), 'combined mode continues through the existing Biga renderer after Phase A');
assert.ok(recipeRenderSource.includes('combinedInstructions && ((bigaPreparation && !bigaHomeSchedule) || (poolishPreparation && !poolishHomeSchedule))'), 'combined preparation renders separate branch PhaseBlocks');
const combinedP3TimerBlock = recipeRenderSource.match(/const combinedP3Timers =([\s\S]*?)\n\s*: undefined;/)?.[1] ?? '';
assert.ok(combinedP3TimerBlock && !combinedP3TimerBlock.includes("mixingForExperience !== 'spiral'"), 'combined P3 timers are not omitted for spiral mixing');

const p3FormatDuration = (seconds) => seconds % 3600 === 0 ? `${seconds / 3600} hours` : `${seconds / 60} minutes`;
const localizedP3FormatDuration = (seconds, lang) => {
  const hours = seconds / 3600;
  if (Number.isInteger(hours)) {
    return ({ hr: `${hours} sati`, en: `${hours} hours`, de: `${hours} Stunden`, sl: `${hours} ur` })[lang];
  }
  const minutes = seconds / 60;
  return ({ hr: `${minutes} minuta`, en: `${minutes} minutes`, de: `${minutes} Minuten`, sl: `${minutes} minut` })[lang];
};
for (const lang of Object.keys(languages)) {
  for (const selectedRoomHours of [1, 2, 3, 4]) {
    for (const selectedFridgeHours of [0, 24, 48]) {
      const durationText = localizedP3FormatDuration(selectedRoomHours * 3600, lang);
      const p3 = buildCombinedP3Instructions({
        lang,
        baseSteps: ['legacy rest', 'legacy room rest', 'legacy fold step', 'legacy balling', 'legacy ball rest', 'shape and bake'],
        selectedBallingStep: selectedBallingStepText[lang](4, '250 g'),
        fridgeHours: selectedFridgeHours,
        temperingHours: selectedFridgeHours > 0 ? selectedRoomHours : 0,
        roomOnlyFermentationHours: selectedFridgeHours === 0 ? selectedRoomHours : 0,
        fridgeTemperature: '4°C',
        isGlutenFree: false,
        formatDuration: (seconds) => localizedP3FormatDuration(seconds, lang),
      });
      const selectedRoomTimer = p3.timers.find((timer) => timer.seconds === selectedRoomHours * 3600);
      if (selectedFridgeHours === 0) {
        assert.ok(p3.steps[3].includes(durationText), `${lang}/combined/${selectedRoomHours}h/0h: selected room-only phase appears before balling`);
        assert.equal(selectedRoomTimer?.id, 'combined-room-only-fermentation');
        assert.equal(selectedRoomTimer.kind, 'rt');
        assert.ok(p3.timers.some((timer) => timer.seconds === 15 * 60), `${lang}/combined/${selectedRoomHours}h/0h: fixed shaping rest remains distinct`);
        assert.equal(p3.timers.some((timer) => timer.kind === 'fridge' || timer.kind === 'ballsFridge'), false);
      } else {
        assert.ok(p3.steps.at(-1).includes(durationText), `${lang}/combined/${selectedRoomHours}h/${selectedFridgeHours}h: selected tempering appears in shaping instruction`);
        assert.equal(selectedRoomTimer?.id, 'combined-pre-bake-tempering');
        assert.equal(selectedRoomTimer.kind, 'preBake');
        assert.ok(p3.timers.some((timer) => timer.seconds === selectedFridgeHours * 3600 && timer.kind === 'ballsFridge'));
        assert.equal(p3.timers.some((timer) => timer.id === 'combined-room-only-fermentation'), false);
      }

      const baseTimers = [
        { id: 'legacy-room', seconds: 30 * 60, kind: 'rt' },
        { id: 'legacy-fridge', seconds: 60 * 60, kind: 'fridge' },
        { id: 'legacy-balls-fridge', seconds: 5 * 3600, kind: 'ballsFridge' },
      ];
      const bigaContext = {
        isRomanTeglia: false,
        isBeginner: false,
        combinedInstructions: null,
        pizzaStyle: 'neapolitan',
        roomHours: selectedRoomHours,
        fridgeHours: selectedFridgeHours,
        fridgeTemp: 4,
        lang,
        formatDuration: (seconds) => localizedP3FormatDuration(seconds, lang),
        p3Steps: ['short rest', 'short room rest', 'fold rest', 'shape 260–280 g balls.', 'ball rest', 'finish'],
        bigaTakeOutInstruction: `Take out after ${durationText}`,
        bigaRoomOnlyInsertionIndex: 3,
        bigaP3DefaultTimers: baseTimers,
        bigaTemperingHours: selectedFridgeHours > 0 ? selectedRoomHours : 0,
        bigaRoomOnlyInstruction: null,
        bigaTemperingDuration: durationText,
        roomHoursForTimer: selectedRoomHours,
      };
      bigaContext.bigaRoomOnlyInstruction = evaluateScreenExpression('bigaRoomOnlyInstruction', bigaContext);
      const bigaSteps = evaluateScreenExpression('standaloneBigaP3Steps', bigaContext);
      const bigaTimers = evaluateScreenExpression('standaloneBigaP3Timers', bigaContext);
      if (selectedFridgeHours === 0) {
        assert.ok(bigaContext.bigaRoomOnlyInstruction.includes(durationText), `${lang}/Biga/${selectedRoomHours}h/0h: localized selected room-only instruction`);
        assert.ok(bigaSteps.includes(bigaContext.bigaRoomOnlyInstruction), `${lang}/Biga/${selectedRoomHours}h/0h: room-only instruction is rendered`);
        assert.ok(bigaTimers.some((timer) => timer.id === 'biga-room-only-fermentation' && timer.seconds === selectedRoomHours * 3600 && timer.kind === 'rt'));
        assert.equal(bigaTimers.some((timer) => timer.kind === 'fridge' || timer.kind === 'ballsFridge'), false);
      } else {
        assert.equal(bigaContext.bigaRoomOnlyInstruction, null);
        assert.ok(bigaSteps[0].includes(durationText), `${lang}/Biga/${selectedRoomHours}h/${selectedFridgeHours}h: selected tempering appears in take-out instruction`);
        assert.ok(bigaTimers.some((timer) => timer.seconds === selectedRoomHours * 3600 && timer.kind === 'preBake'));
        assert.ok(bigaTimers.some((timer) => timer.kind === 'fridge'));
      }
    }
  }
}
const tondaSchedule = getFermentationSchedule({ method: 'biga', prefermentHours: 24, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2 });
const scheduledTemperingHours = tondaSchedule.phases
  .filter((phase) => phase.kind === 'final-rest' && phase.environment === 'room')
  .reduce((total, phase) => total + phase.hours, 0);
assert.equal(scheduledTemperingHours, 2, 'existing Romana Tonda combined schedule contains the 2-hour post-fridge room phase');
const wholeWheatTondaSpiralPath = getYeastAwarePrefermentSteps(
  'en', 'biga', 'spiral', 'fresh', '1 g', false, false, 'wholeWheat', false,
  '500 g whole wheat flour', 4,
  makeSpiralRecipe({ flour: 500, water: 300, yeast: 1, salt: 14, oil: 0 }, (grams) => `${grams} g`),
);
const noFridgeTondaP3Steps = wholeWheatTondaSpiralPath.p3.steps.filter((step) => !/fridge|refrigerator|kühlschrank|hladilnik|hladnjak/i.test(step));
const tondaNoFridgeSchedule = getFermentationSchedule({ method: 'biga', prefermentHours: 24, roomHours: 2, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, roomAfterFridgeHours: 0 });
const noFridgeTemperingHours = tondaNoFridgeSchedule.phases
  .filter((phase) => phase.kind === 'final-rest' && phase.environment === 'room')
  .reduce((total, phase) => total + phase.hours, 0);
assert.equal(wholeWheatTondaSpiralPath.p3.steps.length, 6, 'whole-wheat spiral Biga P3 starts with all continuation slots');
assert.equal(noFridgeTondaP3Steps.length, 4, 'zero fridge duration filters both legacy cold continuation slots from adapted P3');
assert.equal(noFridgeTemperingHours, 0, 'zero-fridge schedule has no post-fridge tempering phase');
const combinedTondaBaseSteps = noFridgeTondaP3Steps;
const combinedTondaP3 = buildCombinedP3Instructions({
  lang: 'en',
  baseSteps: combinedTondaBaseSteps,
  selectedBallingStep: 'Divide into 4 balls of 250 g.',
  fridgeHours: 0,
  temperingHours: noFridgeTemperingHours,
  fridgeTemperature: '4°C',
  isGlutenFree: false,
  formatDuration: p3FormatDuration,
});
assert.equal(combinedTondaP3.steps.length, 6, 'Romana Tonda combined P3 retains every continuation step at zero fridge hours');
assert.equal(combinedTondaP3.steps[3], 'Divide into 4 balls of 250 g.');
assert.match(combinedTondaP3.steps[5], /Keep the dough balls covered at room temperature for 15 minutes before shaping\./, 'zero-hour final-dough cold phase uses the covered room-rest instruction');
assert.ok(combinedTondaP3.steps[5].includes('shape the pizza'), 'complete final shaping and baking instruction remains present');
assert.ok(!combinedTondaP3.steps[4].includes('fridge'), 'zero-hour ball continuation does not retain a stale fridge instruction');
assert.equal(combinedTondaP3.timers.at(-1).seconds, 15 * 60, 'zero-fridge shaping rest retains its existing short-rest timer');
assert.match(screenSource, /const combinedP3BaseSteps = combinedInstructions && !isRomanTeglia\s*\?\s*p3Steps\s*:\s*path\.p3\.steps/);
assert.ok(screenSource.includes('baseSteps: combinedP3BaseSteps,'), 'combined P3 builder receives the stable continuation template');
assert.ok(screenSource.includes("const combinedTemperingHours = proFermentationSchedule?.phases"), 'P3 tempering is sourced from the calculator fermentation schedule');
assert.ok(screenSource.includes('temperingHours: combinedTemperingHours,'), 'P3 instruction and timer use the schedule-derived tempering duration');
assert.match(screenSource, /const standaloneBigaP3Steps = !isBeginner && !combinedInstructions && fridgeHours > 0[\s\S]*?bigaTakeOutInstruction/,
  'standalone Biga P3 adds a post-fridge instruction only for positive fridge duration');
assert.match(screenSource, /seconds: bigaTemperingHours \* 3600, kind: 'preBake'/,
  'standalone Biga P3 timer uses the selected final-rest schedule');
assert.match(screenSource, /const bigaP3DefaultTimers = isRomanTeglia\s*\? proTegliaPressRestTimers/,
  'PRO Teglia has a dedicated P3 pressing-rest timer');
assert.match(screenSource, /function getRomanTegliaPressRestTimer[\s\S]*?seconds: 5 \* 60/,
  'PRO Teglia pressing-rest timer is exactly five minutes');
assert.match(screenSource, /bigaP3DefaultTimers\.filter\(\(timer\) => timer\.kind !== 'fridge' && timer\.kind !== 'ballsFridge'\)/,
  'zero-fridge Biga P3 does not show stale cold-phase timers');
assert.match(screenSource, /adaptFermentationSteps\([\s\S]*?fridgeTemp,[\s\S]*?\(isBeginner \|\| pizzaStyle !== 'neapolitan'\) && fridgeHours <= 0/,
  'PRO Neapolitan Biga preserves short P3 rests when fridge time is zero without changing Beginner or other styles');
assert.match(screenSource, /biga-room-only-fermentation'[\s\S]*?seconds: roomHours \* 3600/,
  'PRO Neapolitan Biga room-only final fermentation has a selected-duration timer');
assert.ok(screenSource.includes('roomOnlyFermentationHours: !isBeginner && !isRomanTeglia && pizzaStyle === \'neapolitan\' && fridgeHours === 0 ? roomHours : 0,'),
  'combined room-only selected duration is restricted to PRO Napolitana at zero fridge');
assert.match(screenSource, /return getProFermentationPresentationSchedule\(\s*proCalculationFermentationSchedule,\s*method,\s*pizzaStyle,/,
  'positive-fridge Biga presentation schedule is derived from the shared PRO presentation schedule');
assert.match(plannerSource, /sharedCalculatorPlanSettings\.proFermentationSchedule\)\s*\{\s*return sharedCalculatorPlanSettings\.proFermentationSchedule;/, 'Planner uses the same shared fermentation schedule as the P3 tempering instruction');

for (const lang of Object.keys(languages)) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    const selectedBallingStep = selectedBallingStepText[lang](4, '250 g');
    for (const selectedTemperingHours of [2, 3, 4]) {
      const p3 = buildCombinedP3Instructions({
        lang,
        baseSteps: ['legacy 6–7 minute rest', 'Cover for 30 minutes at room temperature.', 'legacy fold or fridge step', 'Shape 260–300 g balls.', 'legacy 30–60 minute ball rest', 'Shape, top, and bake according to oven instructions.'],
        selectedBallingStep,
        fridgeHours: 24,
        temperingHours: selectedTemperingHours,
        fridgeTemperature: '4°C',
        isGlutenFree: false,
        formatDuration: (seconds) => localizedP3FormatDuration(seconds, lang),
      });
      const roomDuration = localizedP3FormatDuration(selectedTemperingHours * 3600, lang);
      const roomDurationPattern = new RegExp(`\\b${selectedTemperingHours}\\s+${({ hr: 'sati', en: 'hours', de: 'Stunden', sl: 'ur' })[lang]}\\b`);
      assert.match(p3.steps[0], /5 minutes|5 minut|5 Minuten/, `${lang}/${mixing}: P3 rest text matches five-minute timer`);
      assert.equal(p3.steps[1], 'Cover for 30 minutes at room temperature.', `${lang}/${mixing}: fixed short room rest is not overwritten`);
      assert.equal(p3.steps[3], selectedBallingStep, `${lang}/${mixing}: P3 uses selected count and weight`);
      assert.ok(p3.steps[4].includes('15 minutes') || p3.steps[4].includes('15 minut') || p3.steps[4].includes('15 Minuten'), `${lang}/${mixing}: ball-room instruction matches its 15-minute timer`);
      assert.ok(p3.steps[4].includes('24 hours') || p3.steps[4].includes('24 sati') || p3.steps[4].includes('24 Stunden') || p3.steps[4].includes('24 ur'), `${lang}/${mixing}: ball-fridge text uses selected 24 hours`);
      assert.ok(p3.steps[5].includes(roomDuration), `${lang}/${mixing}: final instruction uses selected ${selectedTemperingHours}-hour tempering`);
      assert.match(p3.steps[5], /Take the dough balls out of the refrigerator|Izvadite kuglice iz hladnjaka|Nehmen Sie die Teigkugeln .* aus dem Kühlschrank|Kroglice vzemite iz hladilnika/, `${lang}/${mixing}: positive final-dough fridge duration retains the take-out instruction`);
      assert.equal(p3.steps.slice(0, -1).some((step) => roomDurationPattern.test(step)), false, `${lang}/${mixing}: selected tempering is not duplicated before the final step`);
      assert.deepEqual(Array.from(p3.timers, (timer) => timer.seconds), [300, 1800, 1800, 900, 24 * 3600, selectedTemperingHours * 3600]);
      assert.ok(p3.timers.every((timer) => timer.label), `${lang}/${mixing}: every finishing timer has an explicit phase label`);
      assert.ok(!p3.steps.some((step) => fixedBallWeightPattern.test(step)), `${lang}/${mixing}: no fixed balling range remains`);
    }
  }

  const glutenFreeP3 = buildCombinedP3Instructions({
    lang,
    baseSteps: ['rest', 'room step', 'legacy GF rest', '260–300 g balls', 'legacy balls rest', 'final shape'],
    selectedBallingStep: selectedBallingStepText[lang](2, '300 g'),
    fridgeHours: 24,
    temperingHours: scheduledTemperingHours,
    fridgeTemperature: '4°C',
    isGlutenFree: true,
    formatDuration: p3FormatDuration,
  });
  assert.ok(/do not fold|nicht;|ne prepogibajte|nemojte preklapati/i.test(glutenFreeP3.steps[2]), `${lang}: GF bulk step explicitly forbids folding`);
  assert.ok(!/stretch\s*&\s*fold|stretch and fold|Falten Sie den Teig einige Male|prepognite z rokami|preklopite tijesto/i.test(glutenFreeP3.steps[2]), `${lang}: GF instructions never add Stretch & Fold`);
  assert.equal(glutenFreeP3.timers[2].kind, 'fridge', `${lang}: GF cold step has a refrigerator timer`);
  assert.equal(glutenFreeP3.timers[2].seconds, 3600, `${lang}: GF refrigerator timer matches its text`);

  for (const oven of ovenTypes) {
    const bakeDuration = oven === 'kamado' ? '' : formatBakingTimeRange(oven, 400, lang);
    const steps = getCombinedOvenBakingSteps({ lang, oven, temperature: '400°C', bakeDuration });
    if (oven === 'kamado') {
      assert.deepEqual(Array.from(steps), [], `${lang}: Kamado receives no unapproved automatic bake times or temperatures`);
    } else {
      assert.equal(steps.length, 2, `${lang}/${oven}: oven-specific preparation and baking instructions are present`);
      assert.ok(steps[0].includes('400°C'), `${lang}/${oven}: selected oven temperature is included`);
      assert.ok(steps[1].includes(bakeDuration), `${lang}/${oven}: approved oven bake range is included`);
    }
  }
}
assert.ok(screenSource.includes('steps={combinedInstructions ? combinedP3Steps : standaloneBigaP3Steps}'), 'combined P3 rendering stays separate from standalone Biga tempering instructions');
assert.ok(screenSource.includes('buildCombinedP3Instructions({'), 'combined P3 uses the combined-only timing builder');
assert.ok(screenSource.includes('getCombinedOvenBakingSteps({'), 'combined P3 uses oven-specific finishing instructions');
assert.match(screenSource, /buildKamadoPrefermentPhases\(\s*path\.p3,\s*combinedP3Steps/, 'Kamado rendering uses the selected balling instruction');
assert.ok(screenSource.includes('combinedKamadoP3Phases.map'), 'combined Kamado P3 must render its five-minute rest timer');
assert.ok(screenSource.includes('getKamadoBakeBlockedText(lang)'), 'the existing Kamado baking safety block remains available');
const amountsGuard = screenExpression('combinedInstructionAmountsInvalid');
const remainingYeastGuard = screenExpression('combinedRemainingYeastInvalid');
const baseGuard = screenExpression('proBaseRecipeCalculationBlocked');
const inputsGuard = screenExpression('combinedInstructionInputsInvalid');
const actionsGuard = screenExpression('proRecipeCalculationBlocked');
const { toCalculatorMixing } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const fermentationSchedule = getFermentationSchedule({ method: 'biga', prefermentHours: 24, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2 });
const regressionOptions = {
  pizzas: 6, ballWeight: 250, saltPct: 2.9, oilPct: 2, method: 'biga',
  bigaEnabled: true, poolishEnabled: true, bigaPct: 50, poolishPct: 45,
  bigaHydrationPct: 50, poolishHydrationPct: 100, roomHours: 2, roomTemp: 22,
  fridgeHours: 24, fridgeTemp: 4, prefermentHours: 24, flourType: 'caputo00',
  useDirectYeastModelForBiga: true, fermentationSchedule,
};
function evaluateGuards(dough, overrides = {}) {
  const context = {
    combinedPrefermentsEnabled: true, proPrefermentPercentagesInvalid: false,
    proPrefermentWaterInfeasible: false, proDirectExposureInvalid: false, proBlendCalculationBlocked: false,
    combinedFlourDisplay: allocateCombinedFlourForDisplay(dough.bigaPoolishModel, dough.total.flour),
    dough, pizzas: 6, effectiveBall: 250, bigaPct: 50, poolishPct: 45,
    bigaHydrationPct: 50, poolishHydrationPct: 100, ...overrides,
  };
  context.combinedRemainingYeastInvalid = vm.runInNewContext(remainingYeastGuard, context);
  context.combinedInstructionAmountsInvalid = vm.runInNewContext(amountsGuard, context);
  context.proBaseRecipeCalculationBlocked = vm.runInNewContext(baseGuard, context);
  context.combinedPrefermentPath = context.proBaseRecipeCalculationBlocked ? null : { p2: { steps: ['mix'] } };
  if ('combinedPrefermentPath' in overrides) context.combinedPrefermentPath = overrides.combinedPrefermentPath;
  context.combinedInstructionInputsInvalid = vm.runInNewContext(inputsGuard, context);
  context.proRecipeCalculationBlocked = vm.runInNewContext(actionsGuard, context);
  return context;
}
const formatRegressionWeight = (grams) => `${grams} g`;
let invalidTransitions = 0;
let recoveryTransitions = 0;
for (const mixing of ['hand', 'mixer', 'spiral']) {
  for (const yeastType of ['fresh', 'activeDry', 'dry']) {
    let previousBlocked = false;
    for (const hydration of [...Array.from({ length: 26 }, (_, index) => 70 + index), ...Array.from({ length: 25 }, (_, index) => 94 - index)]) {
      const dough = doughCalc({ ...regressionOptions, hydration, mixing: toCalculatorMixing(mixing), yeastType });
      const guard = evaluateGuards(dough, { proPrefermentWaterInfeasible: dough.main.water < 0 || dough.bigaPoolishModel.mathStatus === 'negative-remainder' });
      if (guard.proRecipeCalculationBlocked && !previousBlocked) invalidTransitions += 1;
      if (!guard.proRecipeCalculationBlocked && previousBlocked) recoveryTransitions += 1;
      previousBlocked = guard.proRecipeCalculationBlocked;
      if (dough.main.yeast < 0) {
        assert.equal(dough.main.yeast, -0.01, `${mixing}/${yeastType}/${hydration}: observed negative result is a real centigram`);
        assert.equal(guard.combinedInstructionInputsInvalid, true);
        assert.equal(guard.proRecipeCalculationBlocked, true);
        continue;
      }
      if (guard.proRecipeCalculationBlocked) continue;
      const remaining = { ...dough.main, flour: guard.combinedFlourDisplay.finalFlourGrams };
      const path = getYeastAwarePrefermentSteps('en', 'biga', mixing, yeastType, formatRegressionWeight(remaining.yeast), false, remaining.oil > 0, 'caputo00', false, undefined, 4, makeSpiralRecipe(remaining, formatRegressionWeight));
      const instructions = buildCombinedPrefermentInstructions({
        lang: 'en', mixing, yeastType, yeastLabel: yeastType,
        biga: { ...dough.preferments.biga, flour: guard.combinedFlourDisplay.bigaFlourGrams },
        poolish: { ...dough.preferments.poolish, flour: guard.combinedFlourDisplay.poolishFlourGrams },
        remaining, bigaPct: 50, bigaHydrationPct: 50, poolishPct: 45, poolishHydrationPct: 100,
        bigaPhases: dough.prefermentSchedules.biga.phases, poolishPhases: dough.prefermentSchedules.poolish.phases,
        ballCount: 6, ballWeight: '250 g', baseFinalMixSteps: path.p2.steps,
        basePostMixSteps: [], fridgeHours: 24, fridgeTemperatureC: 4,
        formatWeight: formatRegressionWeight, formatYeastWeight: formatRegressionWeight,
        formatDuration: (hours) => `${hours} hours`, formatTimerDuration, formatTemperature: (temperature) => `${temperature}°C`,
      });
      assert.ok(instructions.finalMixSteps.length > 0, `${mixing}/${yeastType}/${hydration}: instructions recover`);
    }
  }
}
assert.ok(invalidTransitions > 0 && recoveryTransitions > 0, 'both directions exercise blocking and recovery');
for (const hydration of [80, 85]) {
  const dough = doughCalc({ ...regressionOptions, hydration, mixing: 'hand', yeastType: 'fresh' });
  assert.equal(dough.main.yeast, -0.01, `local reproduction at ${hydration}%`);
}
const negativeYeastDough = doughCalc({ ...regressionOptions, hydration: 80, mixing: 'hand', yeastType: 'fresh' });
const negativeYeastAllocation = allocateCombinedFlourForDisplay(negativeYeastDough.bigaPoolishModel, negativeYeastDough.total.flour);
assert.throws(() => buildCombinedPrefermentInstructions({
  lang: 'en', mixing: 'hand', yeastType: 'fresh', yeastLabel: 'fresh yeast',
  biga: { ...negativeYeastDough.preferments.biga, flour: negativeYeastAllocation.bigaFlourGrams },
  poolish: { ...negativeYeastDough.preferments.poolish, flour: negativeYeastAllocation.poolishFlourGrams },
  remaining: { ...negativeYeastDough.main, flour: negativeYeastAllocation.finalFlourGrams },
  bigaPct: 50, bigaHydrationPct: 50, poolishPct: 45, poolishHydrationPct: 100,
  bigaPhases: negativeYeastDough.prefermentSchedules.biga.phases,
  poolishPhases: negativeYeastDough.prefermentSchedules.poolish.phases,
  ballCount: 6, ballWeight: '250 g', baseFinalMixSteps: ['Mix'], basePostMixSteps: [],
  fridgeHours: 24, fridgeTemperatureC: 4, formatWeight: formatRegressionWeight, formatYeastWeight: formatRegressionWeight,
  formatDuration: (hours) => `${hours} hours`, formatTimerDuration, formatTemperature: (temperature) => `${temperature}°C`,
}), /Remaining yeast must be a finite, nonnegative calculated amount/);
const validDough = doughCalc({ ...regressionOptions, hydration: 70, mixing: 'hand', yeastType: 'fresh' });
let remainingYeastDisplay;
let combinedWarningCopy;
function findDisplayExpressions(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(screenAst) === 'value' && node.initializer && ts.isJsxExpression(node.initializer)
    && node.initializer.expression?.getText(screenAst).includes('combinedRemainingYeastInvalid')) {
    remainingYeastDisplay = node.initializer.expression.getText(screenAst);
  }
  if (ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression)
    && node.expression.condition.getText(screenAst) === 'combinedRemainingYeastInvalid'
    && node.expression.getText(screenAst).includes('Izračun preostalog kvasca')) {
    combinedWarningCopy = node.expression.getText(screenAst);
  }
  ts.forEachChild(node, findDisplayExpressions);
}
findDisplayExpressions(screenAst);
assert.ok(remainingYeastDisplay, 'combined remaining yeast display exists');
assert.ok(combinedWarningCopy, 'combined warning selects the yeast-specific reason');
const yeastWarnings = {
  hr: 'Izračun preostalog kvasca nije valjan. Upute, spremanje i popis za kupovinu trenutačno nisu dostupni. Promijenite postavke recepta.',
  en: 'The remaining yeast calculation is invalid. Instructions, saving, and the shopping list are currently unavailable. Change the recipe settings.',
  de: 'Die Berechnung der verbleibenden Hefe ist ungültig. Anleitung, Speichern und Einkaufsliste sind derzeit nicht verfügbar. Ändern Sie die Rezepteinstellungen.',
  sl: 'Izračun preostalega kvasa ni veljaven. Navodila, shranjevanje in nakupovalni seznam trenutno niso na voljo. Spremenite nastavitve recepta.',
};
for (const hydration of [80, 85, 70]) {
  const dough = doughCalc({ ...regressionOptions, hydration, mixing: 'hand', yeastType: 'fresh' });
  const context = evaluateGuards(dough);
  context.weight = (amount) => `${amount} g`;
  assert.equal(vm.runInNewContext(remainingYeastDisplay, context), hydration === 70 ? `${dough.main.yeast} g` : '—');
  assert.equal(context.combinedInstructionInputsInvalid, hydration !== 70);
  assert.equal(context.proRecipeCalculationBlocked, hydration !== 70);
  for (const [lang, text] of Object.entries(yeastWarnings)) {
    const warning = vm.runInNewContext(combinedWarningCopy, { ...context, lang });
    if (hydration !== 70) assert.equal(warning, text, `${lang}/${hydration}: yeast warning`);
    else assert.notEqual(warning, text, `${lang}: recovered state has no yeast warning`);
  }
}
for (const invalid of [-0.01, NaN, Infinity, -Infinity]) {
  const context = evaluateGuards({ ...validDough, main: { ...validDough.main, yeast: invalid } });
  context.weight = (amount) => `${amount} g`;
  assert.equal(vm.runInNewContext(remainingYeastDisplay, context), '—');
  assert.equal(context.proRecipeCalculationBlocked, true);
}
{
  const context = evaluateGuards({ ...validDough, main: { ...validDough.main, salt: -1 } });
  assert.equal(context.combinedInstructionInputsInvalid, true);
  assert.equal(context.combinedRemainingYeastInvalid, false);
  for (const [lang, text] of Object.entries(yeastWarnings)) {
    assert.notEqual(vm.runInNewContext(combinedWarningCopy, { ...context, lang }), text, `${lang}: another invalid amount keeps its own warning`);
  }
}
assert.equal(evaluateGuards(negativeYeastDough, { combinedPrefermentsEnabled: false }).combinedRemainingYeastInvalid, false, 'single-method display is unchanged');
for (const branch of ['biga', 'poolish', 'main']) {
  for (const field of branch === 'main' ? ['water', 'yeast', 'salt', 'oil'] : ['water', 'yeast']) {
    for (const invalid of [-0.01, -1e-12, NaN, Infinity, -Infinity]) {
      const copy = { ...validDough, main: { ...validDough.main }, preferments: { biga: { ...validDough.preferments.biga }, poolish: { ...validDough.preferments.poolish } } };
      (branch === 'main' ? copy.main : copy.preferments[branch])[field] = invalid;
      assert.equal(evaluateGuards(copy).proRecipeCalculationBlocked, true, `${branch}.${field}=${invalid} blocks generation and actions`);
    }
  }
}
for (const field of ['bigaFlourGrams', 'poolishFlourGrams', 'finalFlourGrams']) {
  for (const invalid of [-0.01, NaN, Infinity]) {
    const allocation = { ...allocateCombinedFlourForDisplay(validDough.bigaPoolishModel, validDough.total.flour), [field]: invalid };
    assert.equal(evaluateGuards(validDough, { combinedFlourDisplay: allocation }).proRecipeCalculationBlocked, true, `${field}=${invalid} blocks`);
  }
}
assert.equal(evaluateGuards(validDough, { combinedPrefermentPath: { p2: { steps: [] } } }).proRecipeCalculationBlocked, true, 'missing final-mix steps block');
assert.equal(evaluateGuards(validDough, { pizzas: 0 }).proRecipeCalculationBlocked, true, 'invalid ball count blocks');
assert.equal(evaluateGuards(validDough, { effectiveBall: Infinity }).proRecipeCalculationBlocked, true, 'invalid ball weight blocks');
assert.equal(evaluateGuards(validDough, { combinedFlourDisplay: null }).proRecipeCalculationBlocked, true, 'missing displayed flour allocation blocks');
for (const branch of ['biga', 'poolish']) {
  for (const phases of [[], [{ hours: 0, temperature: 22 }], [{ hours: NaN, temperature: 22 }], [{ hours: 1, temperature: Infinity }]]) {
    const dough = { ...validDough, prefermentSchedules: { ...validDough.prefermentSchedules, [branch]: { ...validDough.prefermentSchedules[branch], phases } } };
    assert.equal(evaluateGuards(dough).proRecipeCalculationBlocked, true, `invalid ${branch} phases block`);
  }
  const missingBranch = { ...validDough, preferments: { ...validDough.preferments, [branch]: null } };
  assert.equal(evaluateGuards(missingBranch).proRecipeCalculationBlocked, true, `missing ${branch} amounts block`);
}
for (const testId of ['mix-toggle', 'add-shopping', 'share-community', 'save-recipe']) {
  assert.match(screenSource, new RegExp(`testID="${testId}"[^\\n]*disabled=\\{proRecipeCalculationBlocked\\}`), `${testId} is disabled when blocked`);
}
assert.match(screenSource, /testID="pro-combined-ingredients-warning"/);
assert.match(screenSource, /!proPrefermentWaterInfeasible && !proPrefermentPercentagesInvalid && !combinedInstructionInputsInvalid/);
assert.match(screenSource, /saveDisabled=\{proRecipeCalculationBlocked\}/);

console.log('PASS: combined display-flour allocation verified for the 254 g regression and 2,080 rounding cases; valid Phase A/P2 instructions proceed, invalid models are not reconciled, and existing locale/mixing checks pass');
