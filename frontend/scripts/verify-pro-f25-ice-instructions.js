#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const loadTsModule = (relativePath) => {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleValue = { exports: {} };
  new Function('module', 'exports', 'require', `${output}\nreturn module.exports;`)(moduleValue, moduleValue.exports, require);
  return moduleValue.exports;
};

const { iceCalc } = loadTsModule('src/calculator.ts');
const { getProIceWaterInstructions } = loadTsModule('src/i18n/proIceWaterInstructions.ts');
const uiSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
const formatWeight = (grams) => `${grams} g`;
const waterSplit = iceCalc(428, 22, 4);

assert.deepEqual(waterSplit, { ice: 92, water: 336 });
const roundingBoundarySplit = iceCalc(371, 22, 4);
assert.deepEqual(roundingBoundarySplit, { ice: 80, water: 291 });
assert.equal(roundingBoundarySplit.ice + roundingBoundarySplit.water, 371);

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    for (const method of ['direct', 'biga', 'poolish']) {
      const waterBaseGrams = method === 'direct' ? 428 : 90;
      const split = method === 'direct' ? waterSplit : iceCalc(waterBaseGrams, 24, 4);
      const instructions = getProIceWaterInstructions({
        lang,
        method,
        mixing,
        waterBaseGrams,
        liquidWaterGrams: split.water,
        iceGrams: split.ice,
        initialWaterPct: 90,
        formatWeight,
      });
      const expected = method === 'direct'
        ? ['428 g', '336 g', '92 g', '302 g', '34 g']
        : ['90 g', '69 g', '21 g', '62 g', '7 g'];
      for (const amount of expected) {
        assert.ok(instructions.waterInfo.includes(amount), `missing ${amount} in ${method}/${lang}/${mixing} water info`);
      }
      if (mixing !== 'hand') {
        assert.equal(instructions.step, undefined, `${method}/${lang} mixer ice guidance is INFO-only`);
      } else {
        for (const amount of expected) {
          assert.ok(instructions.step?.includes(amount), `missing ${amount} in ${method}/${lang}/${mixing} step`);
        }
        assert.match(instructions.step, {
          hr: /otopite/i,
          en: /melt/i,
          de: /lösen sie das eis/i,
          sl: /stopite/i,
        }[lang]);
      }
      assert.match(instructions.waterInfo, {
        hr: /ne dodaje se povrh/i,
        en: /not added on top/i,
        de: /nicht zusätzlich/i,
        sl: /se ne dodaja poleg/i,
      }[lang]);
      assert.match(instructions.waterInfo, {
        hand: { hr: /ručnog zamjesa/i, en: /hand mixing/i, de: /Handkneten/i, sl: /ročnim gnetenjem/i },
        mixer: { hr: /kućni mikser/i, en: /home mixer/i, de: /Haushaltsmixer/i, sl: /domači mešalnik/i },
        spiral: { hr: /spiralni mikser/i, en: /spiral mixer/i, de: /Spiralkneter/i, sl: /spiralni mešalnik/i },
      }[mixing][lang]);
      if (mixing === 'spiral') {
        assert.match(instructions.waterInfo, {
          hr: /spiralni mikser.*potpuno otopite.*tvrde kocke/i,
          en: /spiral mixer.*fully melt.*hard ice cubes/i,
          de: /Spiralkneter.*vollständig.*Harte Eiswürfel/i,
          sl: /spiralni mešalnik.*popolnoma stopite.*Trdih kock/i,
        }[lang]);
      }
      if (method !== 'direct') {
        assert.match(instructions.waterInfo, /Final-dough water|Wassermenge für den Hauptteig|Voda za završni zamjes|Voda za končno testo/);
      }
    }
  }

  const tondaPlan = getProIceWaterInstructions({
    lang,
    method: 'direct',
    mixing: 'hand',
    waterBaseGrams: 428,
    liquidWaterGrams: waterSplit.water,
    iceGrams: waterSplit.ice,
    initialWaterPct: 80,
    formatWeight,
  });
  assert.match(tondaPlan.step, /269 g/);
  assert.match(tondaPlan.step, /336 g/);
  assert.match(tondaPlan.step, /67 g/);
}

assert.throws(() => getProIceWaterInstructions({
  lang: 'en',
  method: 'direct',
  mixing: 'hand',
  waterBaseGrams: 428,
  liquidWaterGrams: 334,
  iceGrams: 92,
  initialWaterPct: 90,
  formatWeight,
}), RangeError);

assert.match(uiSource, /!isBeginner && ice && ice\.ice > 0/);
assert.match(uiSource, /method === 'direct' \? directInitialWaterPct : 90/);
assert.match(uiSource, /\[proIceWaterInstructions\.step, \.\.\.phase\.steps\]/);
assert.match(uiSource, /waterInfo: proIceWaterInstructions\.waterInfo/);
assert.match(uiSource, /ice\.ice > 0/);
assert.match(uiSource, /getProIceWaterInfoStepIndex\(phase\.steps\)/);
assert.match(uiSource, /getProIceWaterInfoStepIndex\(path\.p2\.steps\)/);
assert.match(uiSource, /withProIceWaterInstruction\(bigaHomeSchedule \? withoutBigaScheduleTiming\(path\.p2\.steps\)/);
assert.match(uiSource, /withProIceWaterInstruction\(poolishMixSteps \?\? adaptFermentationSteps\(path\.p2\.steps/);

console.log('F25 PRO ice instruction regression passed.');
