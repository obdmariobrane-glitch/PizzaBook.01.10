#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { getProSpiralMixingStepInfo, getSpiralMixingSteps } = require(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
const { getProIceWaterInstructions } = require(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));
const uiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');

const languages = ['hr', 'en', 'de', 'sl'];
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const flourCases = [
  {
    id: 'standard',
    behavior: 'standard',
    labels: { hr: 'Tipo 00', en: 'Tipo 00', de: 'Tipo 00', sl: 'Tipo 00' },
    preferment: true,
  },
  {
    id: 'manitoba',
    behavior: 'manitoba',
    labels: { hr: 'Manitoba', en: 'Manitoba', de: 'Manitoba', sl: 'Manitoba' },
    preferment: true,
  },
  {
    id: 'spelt',
    behavior: 'spelt',
    labels: { hr: 'pir', en: 'spelt', de: 'Dinkel', sl: 'pira' },
    preferment: true,
  },
  {
    id: 'whole-wheat',
    behavior: 'wholeWheat',
    labels: { hr: 'integralno brašno', en: 'whole-wheat flour', de: 'Vollkornmehl', sl: 'polnozrnata moka' },
    preferment: true,
  },
  {
    id: 'wheat-blend',
    behavior: 'standard',
    labels: { hr: 'mješavina brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanica moke' },
    blend: {
      hr: '670 g Tipo 00 + 330 g bezglutenskog brašna',
      en: '670 g Tipo 00 + 330 g gluten-free flour',
      de: '670 g Tipo 00 + 330 g glutenfreies Mehl',
      sl: '670 g Tipo 00 + 330 g brezglutenske moke',
    },
    preferment: true,
  },
  {
    id: 'gluten-free',
    behavior: 'glutenFree',
    labels: { hr: 'bezglutensko brašno', en: 'gluten-free flour', de: 'glutenfreies Mehl', sl: 'brezglutenska moka' },
    psylliumGrams: 15,
    preferment: false,
  },
  {
    id: 'gluten-free-blend-a-100',
    behavior: 'glutenFree',
    labels: { hr: 'mješavina brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanica moke' },
    blend: {
      hr: '1000 g bezglutenskog brašna A',
      en: '1000 g gluten-free flour A',
      de: '1000 g glutenfreies Mehl A',
      sl: '1000 g brezglutenske moke A',
    },
    psylliumGrams: 15,
    preferment: false,
  },
  {
    id: 'gluten-free-blend-b-100',
    behavior: 'glutenFree',
    labels: { hr: 'mješavina brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanica moke' },
    blend: {
      hr: '1000 g bezglutenskog brašna B',
      en: '1000 g gluten-free flour B',
      de: '1000 g glutenfreies Mehl B',
      sl: '1000 g brezglutenske moke B',
    },
    psylliumGrams: 15,
    preferment: false,
  },
];

const mixMarkers = {
  standard: { hr: /Pokrenite na niskoj/, en: /Start at a low/, de: /Beginnen Sie mit einer niedrigen/, sl: /Začnite pri nizki/ },
  manitoba: { hr: /Počnite/, en: /Start at/, de: /Beginnen Sie/, sl: /Začnite/ },
  spelt: { hr: /Miješajte kratko/, en: /Mix briefly/, de: /Kurz bei niedriger/, sl: /Kratko mešajte/ },
  wholeWheat: { hr: /Miješajte na niskoj/, en: /Mix at low/, de: /Bei niedriger/, sl: /Mešajte pri nizki/ },
  glutenFree: { hr: /Miješajte samo/, en: /Mix only/, de: /Nur auf/, sl: /Mešajte samo/ },
};
const finishMarkers = {
  hr: /Zaustavite spiralni mikser/,
  en: /Stop the spiral mixer/,
  de: /Stoppen Sie den Spiralkneter/,
  sl: /Spiralni mešalnik ustavite/,
};
const glutenFreeFinishMarkers = {
  hr: /ne mijesite radi razvoja glutena/i,
  en: /do not knead gluten-free dough to develop gluten/i,
  de: /glutenfreien Teig nicht zur Glutenentwicklung kneten/i,
  sl: /brezglutenskega testa ne gnetite za razvoj glutena/i,
};
const glutenFreeHomogeneityMarkers = {
  hr: /homogena/i,
  en: /homogeneous/i,
  de: /homogene/i,
  sl: /homogena/i,
};
const initialWaterMarker = {
  hr: /početnih .*%/,
  en: /initial .*%/,
  de: /anfänglichen .*%/,
  sl: /začetnih .*%/,
};
const restMarker = {
  hr: /5 minuta/,
  en: /5 minutes/,
  de: /5 Minuten/,
  sl: /5 minut/,
};
const weight = (grams) => `${grams} g`;
let testedConfigurations = 0;

for (const lang of languages) {
  for (const style of styles) {
    const directInitialWaterPct = style === 'romanaTeglia' || style === 'romanaTonda' ? 80 : 90;
    const methods = ['direct', 'biga', 'poolish'];
    for (const method of methods) {
      const supportedFlours = method === 'direct' ? flourCases : flourCases.filter((item) => item.preferment);
      for (const flourCase of supportedFlours) {
        for (const yeastType of yeastTypes) {
          for (const hasIce of [false, true]) {
            for (const hasOil of [false, true]) {
              const waterBaseGrams = method === 'direct' ? 428 : 90;
              const liquidWaterGrams = hasIce
                ? method === 'direct' ? 336 : 69
                : waterBaseGrams;
              const iceGrams = hasIce ? method === 'direct' ? 92 : 21 : 0;
              const initialWaterPct = method === 'direct' ? directInitialWaterPct : 90;
              const iceInstructions = hasIce
                ? getProIceWaterInstructions({
                  lang,
                  method,
                  mixing: 'spiral',
                  waterBaseGrams,
                  liquidWaterGrams,
                  iceGrams,
                  initialWaterPct,
                  formatWeight: weight,
                })
                : undefined;
              const recipe = {
                flourGrams: 1000,
                flourLabel: flourCase.labels[lang],
                ...(flourCase.blend ? { flourBlendDescription: flourCase.blend[lang] } : {}),
                ...(method === 'direct' ? {} : { prefermentGrams: 500 }),
                waterBaseGrams,
                liquidWaterGrams,
                iceGrams,
                initialWaterPct,
                yeastGrams: 2,
                saltGrams: 20,
                oilGrams: hasOil ? 15 : 0,
                ...(flourCase.psylliumGrams ? { psylliumGrams: flourCase.psylliumGrams } : {}),
                flourBehavior: flourCase.behavior,
                ...(method === 'direct' && flourCase.behavior !== 'glutenFree' ? { restMinutes: 5 } : {}),
                targetDoughTemperature: 23,
                formatWeight: weight,
              };
              const steps = getSpiralMixingSteps(lang, yeastType, { method, hasOil, recipe });
              const caseLabel = `${lang}/${style}/${method}/${flourCase.id}/${yeastType}/ice=${hasIce}/oil=${hasOil}`;
              const expectedInitialWater = hasIce
                ? method === 'direct'
                  ? directInitialWaterPct === 80 ? 269 : 302
                  : 62
                : Math.round(waterBaseGrams * initialWaterPct / 100);
              const expectedRemainingWater = hasIce
                ? method === 'direct'
                  ? directInitialWaterPct === 80 ? 67 : 34
                  : 7
                : waterBaseGrams - expectedInitialWater;
              const cursorBeforeInitialMix = 3 + Number(flourCase.behavior === 'glutenFree');
              const stepInfo = getProSpiralMixingStepInfo(lang, recipe);
              const allStepInfo = stepInfo.flatMap((entry, index) => (
                entry === undefined ? [] : (Array.isArray(entry) ? entry : [entry]).map((item) => ({ ...item, index }))
              ));

              assert.match(steps[1], new RegExp(`1000 g ${flourCase.labels[lang]}`), `${caseLabel} lists the exact flour amount`);
              assert.ok(steps[1].includes(`${weight(waterBaseGrams)} ${hasIce ? ({
                hr: 'ukupnog vodenog ekvivalenta',
                en: 'total water equivalent',
                de: 'Wasserequivalent',
                sl: 'skupnega vodnega ekvivalenta',
              }[lang]) : ({
                hr: 'vode',
                en: 'water',
                de: 'Wasser',
                sl: 'vode',
              }[lang])}`), `${caseLabel} lists the water amount`);
              if (method !== 'direct') assert.ok(steps[1].includes('500 g'), `${caseLabel} lists the preferment amount`);
              assert.ok(steps[1].includes('2 g'), `${caseLabel} lists the yeast amount`);
              assert.ok(steps[1].includes('20 g'), `${caseLabel} lists the salt amount`);
              assert.equal(steps[1].includes('15 g'), hasOil || flourCase.behavior === 'glutenFree', `${caseLabel} includes oil or psyllium only when present`);

              assert.match(steps[2], {
                fresh: { hr: /Svježi kvasac \(2 g\)/, en: /fresh yeast \(2 g\)/, de: /Frischhefe \(2 g\)/, sl: /Sveži kvas \(2 g\)/ },
                activeDry: { hr: /Aktivni suhi kvasac \(2 g\)/, en: /active dry yeast \(2 g\)/, de: /Aktiv-Trockenhefe \(2 g\)/, sl: /Aktivni suhi kvas \(2 g\)/ },
                dry: { hr: /Instant suhi kvasac \(2 g\)/, en: /instant dry yeast \(2 g\)/, de: /Instant-Trockenhefe \(2 g\)/, sl: /Instant suhi kvas \(2 g\)/ },
              }[yeastType][lang], `${caseLabel} gives yeast-specific measured handling`);

              let cursor = 3;
              if (flourCase.behavior === 'glutenFree') {
                assert.match(steps[cursor], /psyllium|Flohsamenschalen/i, `${caseLabel} has the psyllium preparation step`);
                assert.ok(steps[cursor].includes('15 g'), `${caseLabel} lists the calculated psyllium amount`);
                cursor += 1;
              }
              if (hasIce) {
                for (const amount of [waterBaseGrams, liquidWaterGrams, iceGrams, expectedInitialWater, expectedRemainingWater]) {
                  assert.ok(iceInstructions.waterInfo.includes(weight(amount)), `${caseLabel} water INFO lists ${weight(amount)}`);
                }
                assert.match(iceInstructions.waterInfo, /replaces part|zamjenjuje dio|ersetzt einen Teil|nadomesti del/i, `${caseLabel} water INFO explains that ice replaces water`);
                assert.match(iceInstructions.waterInfo, /spiral mixer|Spiralkneter|spiralni mikser|spiralni mešalnik/i, `${caseLabel} water INFO gives spiral-mixer-safe guidance`);
                assert.doesNotMatch(steps.join(' '), /\b(?:ice|led|eis)\b/i, `${caseLabel} keeps ice instructions out of numbered steps`);
              }

              assert.equal(cursor, cursorBeforeInitialMix, `${caseLabel} has the expected setup-step order`);
              assert.match(steps[cursor], initialWaterMarker[lang], `${caseLabel} adds the measured initial water after preparation`);
              assert.ok(steps[cursor].includes(`${weight(expectedInitialWater)}`), `${caseLabel} uses the correct initial liquid-water amount`);
              cursor += 1;
              assert.ok(steps[cursor].includes(`${weight(expectedRemainingWater)}`), `${caseLabel} gradually adds the remaining liquid water`);
              cursor += 1;
              assert.ok(steps[cursor].includes('20 g'), `${caseLabel} adds the exact salt amount after water`);
              cursor += 1;
              const mixingStepIndex = cursor;
              assert.match(steps[cursor], mixMarkers[flourCase.behavior][lang], `${caseLabel} has flour- and equipment-appropriate mixing guidance`);
              assert.equal(allStepInfo.filter((item) => item.title === ({
                hr: 'Brzina spiralnog miksera',
                en: 'Spiral mixer speed',
                de: 'Geschwindigkeit des Spiralkneters',
                sl: 'Hitrost spiralnega mešalnika',
              }[lang])).length, 1, `${caseLabel} shows one speed INFO`);
              assert.equal(allStepInfo.find((item) => item.title === ({
                hr: 'Brzina spiralnog miksera',
                en: 'Spiral mixer speed',
                de: 'Geschwindigkeit des Spiralkneters',
                sl: 'Hitrost spiralnega mešalnika',
              }[lang]))?.index, mixingStepIndex, `${caseLabel} locates speed INFO beside the first mixing step`);
              if (flourCase.behavior === 'glutenFree') {
                assert.match(steps[cursor], glutenFreeHomogeneityMarkers[lang], `${caseLabel} targets a homogeneous gluten-free dough`);
                assert.match(steps[cursor], glutenFreeFinishMarkers[lang], `${caseLabel} does not knead gluten-free dough to develop gluten`);
              }
              cursor += 1;
              let oilStepIndex;
              if (hasOil) {
                oilStepIndex = cursor;
                assert.ok(steps[cursor].includes('15 g'), `${caseLabel} adds the exact oil amount`);
                cursor += 1;
              }
              assert.match(steps[cursor], /23\s*°C/, `${caseLabel} checks target dough temperature`);
              cursor += 1;
              const finishStepIndex = cursor;
              assert.match(steps[cursor], finishMarkers[lang], `${caseLabel} has an explicit mixing end condition`);
              assert.equal(allStepInfo.filter((item) => item.title === ({
                hr: 'Temperatura tijesta',
                en: 'Dough temperature',
                de: 'Teigtemperatur',
                sl: 'Temperatura testa',
              }[lang])).length, 1, `${caseLabel} shows one dough-temperature INFO`);
              assert.equal(allStepInfo.find((item) => item.title === ({
                hr: 'Temperatura tijesta',
                en: 'Dough temperature',
                de: 'Teigtemperatur',
                sl: 'Temperatura testa',
              }[lang]))?.index, finishStepIndex, `${caseLabel} locates temperature INFO beside mixing completion`);
              assert.doesNotMatch(steps[cursor], /speed|Geschwindigkeit|hitrost|brzinu|duration|trajanje|Dauer|trajanje proizvajalca/i, `${caseLabel} does not repeat speed guidance at mixing completion`);
              cursor += 1;
              if (method === 'direct' && flourCase.behavior !== 'glutenFree') {
                assert.match(steps[cursor], restMarker[lang], `${caseLabel} keeps the existing measured rest`);
                cursor += 1;
              }
              assert.equal(cursor, steps.length, `${caseLabel} contains no unaccounted steps`);
              if (hasOil) {
                assert.match(steps[oilStepIndex], /oil|ulj|olj|öl/i, `${caseLabel} includes a dedicated oil-addition step`);
              }
              const flourInfo = allStepInfo.filter((item) => item.index === 1);
              const expectedFlourInfoCount = Number(!!flourCase.blend) + Number(flourCase.behavior === 'glutenFree');
              assert.equal(flourInfo.length, expectedFlourInfoCount, `${caseLabel} shows only applicable flour INFO`);
              if (flourCase.blend) {
                assert.ok(flourInfo.some((item) => item.body.includes(flourCase.blend[lang])), `${caseLabel} INFO lists actual flour blend components`);
              }
              if (flourCase.behavior === 'glutenFree') {
                assert.ok(flourInfo.some((item) => /traditional gluten network|herkömmliches glutennetz|tradicionalnu glutensku mrežu|običajne glutenske mreže/i.test(item.body)), `${caseLabel} INFO explains gluten-free dough behavior`);
              }
              testedConfigurations += 1;
            }
          }
        }
      }
    }
  }
}

assert.match(uiSource, /const proSpiralRecipe: SpiralMixingRecipe/);
assert.match(uiSource, /const proDirectSpiralSteps = !isBeginner && method === 'direct' && mixingForExperience === 'spiral'/);
assert.match(uiSource, /proHomeMixerDetailedSteps \?\? proSpiralDirectInstructions/);
assert.match(uiSource, /getProIceWaterInfoStepIndex\(phase\.steps\)/);
assert.match(uiSource, /getProIceWaterInfoStepIndex\(path\.p2\.steps\)/);
assert.match(uiSource, /getYeastAwarePrefermentSteps[\s\S]*?fridgeTemp, proSpiralRecipe\)/);
assert.match(uiSource, /waterBaseGrams: iceWaterBase,\s*liquidWaterGrams: ice\?\.water \?\? iceWaterBase,\s*iceGrams: ice\?\.ice \?\? 0/);
assert.match(uiSource, /const generatedMixingSteps = !isBeginner && mixingForExperience === 'spiral' && textAlignedDetailedDirectSteps/);
assert.match(uiSource, /adaptSpiralMixerSourceSteps\(\s*phase\.steps\.map/);
assert.match(uiSource, /const proSpiralDirectInstructions = !isBeginner && method === 'direct' && mixingForExperience === 'spiral' && detailedDirectSteps/);
assert.match(uiSource, /phaseIndex === 0 \? phase : yeastAwareDetailedDirectSteps\?\.\[phaseIndex\] \?\? phase/);
assert.match(uiSource, /proSpiralDirectInstructions[\s\S]{0,200}beginnerDirectHomeSteps/);
assert.match(uiSource, /beginnerDirectHomeSteps[\s\S]{0,300}beginnerDirectRecipeSteps[\s\S]{0,160}detailedDirectSteps/);
assert.match(uiSource, /stepInfo: proSpiralRecipe \? getProSpiralMixingStepInfo\(lang, proSpiralRecipe, steps\) : phase\.stepInfo/);
assert.match(uiSource, /getProSpiralMixingStepInfo\(lang, proSpiralRecipe, path\.p2\.steps\)/);
assert.match(uiSource, /const customStepInfos = customStepInfo === undefined/);
assert.match(uiSource, /customStepInfos\.map\(\(customInfo, infoIndex\)/);
assert.match(uiSource, /const preparationIndex = steps\.findIndex/);
assert.match(uiSource, /return preparationIndex;/);

console.log(`PRO spiral-mixing matrix passed: ${testedConfigurations} configurations across HR/EN/DE/SL.`);
