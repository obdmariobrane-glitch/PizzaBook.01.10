#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(appPath, 'utf8');
const sourceFile = ts.createSourceFile(appPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const requested = new Set(['getBeginnerPhaseAFlourBehavior']);
const declarations = sourceFile.statements
  .filter((statement) => ts.isFunctionDeclaration(statement) && statement.name && requested.has(statement.name.text))
  .map((statement) => statement.getText(sourceFile));

assert.equal(declarations.length, requested.size);
const compiled = ts.transpileModule(
  `${declarations.join('\n')}\nmodule.exports = { getBeginnerPhaseAFlourBehavior };`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports });
const { getBeginnerPhaseAFlourBehavior } = moduleRef.exports;

assert.equal(getBeginnerPhaseAFlourBehavior('caputo00', 'caputo00', 'manitoba'), 'standard');
assert.equal(getBeginnerPhaseAFlourBehavior('custom', 'caputo00', 'spelt'), 'spelt');
assert.equal(getBeginnerPhaseAFlourBehavior('custom', 'caputo00', 'wholeWheat'), 'wholeWheat');
assert.equal(getBeginnerPhaseAFlourBehavior('custom', 'spelt', 'wholeWheat'), 'spelt');
assert.equal(getBeginnerPhaseAFlourBehavior('manitoba'), 'standard');

const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));
for (const generatorSource of [beginnerSource, localizedSource]) {
  assert.match(generatorSource, /beginnerPhaseAFlourBehavior/);
  assert.match(generatorSource, /5(?:[–-]6)? (?:minuta|minutes)/);
  assert.match(generatorSource, /5\.5/);
  assert.match(generatorSource, /gluten|Gluten|glutena/);
  assert.match(generatorSource, /spelt|Spelt|pirovo/);
  assert.match(generatorSource, /wholeWheat|Whole Wheat|integralno/);
}

assert.match(beginnerSource, /isNeapolitanTipo00BeginnerHand \|\| isNeapolitanTipo00BeginnerMixer/);
assert.match(source, /const isTargetNeapolitanGlutenFreeHandPhaseA = isBeginner/);
assert.match(source, /const isTargetNeapolitanGlutenFreeMixerPhaseA = isBeginner/);
assert.match(source, /const isTargetNeapolitanCustomHandPhaseA = isBeginner/);
assert.match(source, /const isTargetNeapolitanCustomMixerPhaseA = isBeginner/);
assert.match(source, /const isNeapolitanGlutenFreeBeginnerHand = isNeapolitanBeginner && hand && flourType === 'glutenFree'/);
assert.match(source, /const isNeapolitanGlutenFreeBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'glutenFree'/);
assert.match(source, /const isNeapolitanCustomBeginnerHand = isNeapolitanBeginner && hand && flourType === 'custom'/);
assert.match(source, /const isNeapolitanCustomBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'custom'/);
assert.match(source, /(?:steps:|: )isNeapolitanCustomBeginnerHand \? \[/);
assert.match(source, /homogenu, ljepljivu masu/);
assert.match(source, /homogeneous, sticky mass/);
assert.match(source, /5 minuta kako bi psyllium/);
const dedicatedCroatianSteps = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\) \? \[([\s\S]*?)\] : isGlutenFree/)[1];
const dedicatedLocalizedSteps = localizedSource.match(/\(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\) \? \[([\s\S]*?)\] : isNeapolitanWholeWheatBeginnerHand/)[1];
const dedicatedMixerCroatianSteps = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\) \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\)/)[1];
const dedicatedMixerLocalizedSteps = localizedSource.match(/\(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\) \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\)/)[1];
const customHandCroatianSteps = beginnerSource.match(/isNeapolitanCustomBeginnerHand \? \[([\s\S]*?)\] : isNeapolitanCustomBeginnerMixer/)[1];
const customMixerCroatianSteps = beginnerSource.match(/isNeapolitanCustomBeginnerMixer \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\)/)[1];
const customHandLocalizedSteps = localizedSource.match(/isNeapolitanCustomBeginnerHand \? \[([\s\S]*?)\] : isNeapolitanCustomBeginnerMixer/)[1];
const customMixerLocalizedSteps = localizedSource.match(/isNeapolitanCustomBeginnerMixer \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\)/)[1];
assert.equal((dedicatedCroatianSteps.match(/\n        (?:'|`)/g) ?? []).length, 9);
assert.equal((dedicatedLocalizedSteps.match(/\n        pick\(/g) ?? []).length, 9);
assert.equal((dedicatedMixerCroatianSteps.match(/\n        (?:'|`)/g) ?? []).length, 9);
assert.equal((dedicatedMixerLocalizedSteps.match(/\n        pick\(/g) ?? []).length, 9);
assert.equal((customHandCroatianSteps.match(/\n        (?:'|`)/g) ?? []).length, 10);
assert.equal((customMixerCroatianSteps.match(/\n        (?:'|`)/g) ?? []).length, 10);
assert.equal((customHandLocalizedSteps.match(/\n        pick\(/g) ?? []).length, 10);
assert.equal((customMixerLocalizedSteps.match(/\n        pick\(/g) ?? []).length, 10);
assert.match(dedicatedCroatianSteps, /U svu vodu, odnosno \$\{ingredients\.water\} g/);
assert.match(dedicatedLocalizedSteps, /gesamten Wassermenge|all the water|vsej vodi/);
for (const dedicatedSteps of [dedicatedCroatianSteps, dedicatedLocalizedSteps, dedicatedMixerCroatianSteps, dedicatedMixerLocalizedSteps]) {
  assert.match(dedicatedSteps, /ingredients\.water} g/);
  assert.doesNotMatch(dedicatedSteps, /90\s*%|10\s*%|remainingWater|preostalih|restlichen/);
  assert.doesNotMatch(dedicatedSteps, /cold water|kaltes Wasser|hladnu vodu|hladno vodo/);
}
for (const customSteps of [customHandCroatianSteps, customMixerCroatianSteps, customHandLocalizedSteps, customMixerLocalizedSteps]) {
  assert.match(customSteps, /90\s*%|90\s*%/);
  assert.match(customSteps, /10\s*%|10\s*%/);
  assert.match(customSteps, /remainingWater|preostalih|restlichen|restlichen/);
  assert.doesNotMatch(customSteps, /timer\(/);
}
assert.match(source, /isTargetNeapolitanCustomHandPhaseA \|\| isTargetNeapolitanCustomMixerPhaseA/);
assert.match(source, /isTargetNeapolitanCustomHandPhaseA \|\| isTargetNeapolitanCustomMixerPhaseA.*index === 0 \? 7/);
assert.match(source, /Miješenje obično traje oko 10 minuta/);
assert.match(source, /Miješanje obično traje oko 8–10 minuta/);
assert.match(localizedSource, /Mixing usually takes about 10 minutes/);
assert.match(localizedSource, /Mixing usually takes about 8–10 minutes/);
assert.match(source, /Koristite hladnu vodu/);
assert.match(localizedSource, /Verwenden Sie kaltes Wasser/);
assert.match(localizedSource, /Use cold water/);
assert.match(localizedSource, /Uporabite hladno vodo/);
assert.match(source, /doughHandlingInfoStepIndex=\{\(\(isTargetNeapolitanGlutenFreeHandPhaseA \|\| isTargetNeapolitanGlutenFreeMixerPhaseA \|\| isTargetTegliaGlutenFreeHandPhaseA \|\| isTargetTegliaGlutenFreeMixerPhaseA\) \? index === 0 \? 6/);
assert.match(source, /isTargetNeapolitanGlutenFreeMixerPhaseA \|\| isTargetTegliaGlutenFreeHandPhaseA \|\| isTargetTegliaGlutenFreeMixerPhaseA\) \? index === 0 \? 6/);
assert.match(source, /isTargetNeapolitanGlutenFreeMixerPhaseA \|\| isTargetTegliaGlutenFreeHandPhaseA \|\| isTargetTegliaGlutenFreeMixerPhaseA.*index === 0 \? 2/);
assert.match(source, /Ulijte svu vodu, odnosno \$\{ingredients\.water\} g/);
assert.match(localizedSource, /gesamte Wasser.*ingredients\.water.*Mixerschüssel/);
assert.match(localizedSource, /all the water.*ingredients\.water.*mixer bowl/);
assert.match(localizedSource, /vso vodo.*ingredients\.water/);
assert.match(source, /Miješanje bezglutenskog tijesta mikserom/);
assert.match(localizedSource, /Mixing gluten-free dough with a mixer/);
assert.doesNotMatch(dedicatedMixerCroatianSteps, /hladna voda|elastič/);
assert.doesNotMatch(dedicatedMixerLocalizedSteps, /cold water|kaltes Wasser|hladno vodo|elastic/);
assert.match(localizedSource, /isGlutenFree \? 5 : isNeapolitanBeginner \|\| isTegliaCustomBeginnerHand \|\| isTegliaCustomBeginnerMixer \|\| isTegliaTipo00BeginnerHand \|\| isTegliaTipo00BeginnerMixer \|\| isTegliaManitobaBeginnerHand \|\| isTegliaManitobaBeginnerMixer \|\| isTegliaSpeltBeginnerHand \|\| isTegliaSpeltBeginnerMixer \|\| isTegliaWholeWheatBeginnerHand \|\| isTegliaWholeWheatBeginnerMixer \? 5 : beginnerMode \? 5\.5/);
assert.match(localizedSource, /pull away from the bowl appropriately/);
assert.doesNotMatch(beginnerSource, /g \$\{isSpelt \? 'hladne ' : ''\}vode\$\{waterTemperature/);
assert.doesNotMatch(localizedSource, /gesamt \$\{ingredients\.water\} g Wasser\$\{waterTemperature/);
assert.doesNotMatch(localizedSource, /total water\$\{waterTemperature/);
assert.doesNotMatch(localizedSource, /skupno \$\{ingredients\.water\} g vode\$\{waterTemperature/);
assert.match(beginnerSource, /isSpelt \? 'pirovog ' : ''\}brašna.*ukupno \$\{ingredients\.water\} g vode/);
assert.match(beginnerSource, /!isGlutenFree && hand && !isSpelt && !isWholeWheat/);
assert.match(source, /const beginnerWaterInfo = \(isTargetNeapolitanHandPhaseA[\s\S]*?isTargetNeapolitanWholeWheatMixerPhaseA \|\| isTargetTegliaTipo00HandPhaseA \|\| isTargetTegliaTipo00MixerPhaseA \|\| isTargetTegliaManitobaHandPhaseA \|\| isTargetTegliaManitobaMixerPhaseA \|\| isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA \|\| isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && waterTemperatureCalculation/);
assert.match(source, /recommendedWaterTemp/);
assert.match(source, /mješavine brašna/);
assert.match(source, /flour blend/);
assert.match(source, /Mehlmischung/);
assert.match(source, /mešanice moke/);
assert.match(source, /pick\('5 Minuten', '5 minutes', '5 minut'\)/);
assert.match(source, /isNeapolitanBeginner && hand && flourType === 'manitoba'/);
assert.match(source, /isNeapolitanWholeWheatBeginnerHand/);
assert.match(source, /isNeapolitanWholeWheatBeginnerMixer/);
assert.match(source, /Izmjerite \$\{ingredients\.flour\} g integralnog brašna/);
assert.match(source, /Hand kneading whole-wheat dough usually takes about 8–10 minutes/);
assert.match(source, /10–15 Minuten ruhen/);
assert.match(source, /Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu/);
assert.match(source, /Postupno dodajte preostalih 10% vode, odnosno \$\{remainingWater\} g\.`/);
assert.match(source, /Kada je voda gotovo potpuno upijena, dodajte \$\{ingredients\.salt\} g soli/);
assert.match(source, /Nastavite miješati na sporoj brzini dok tijesto ne postane povezano, elastično i može zadržati oblik/);
assert.match(source, /Mixer mixing whole-wheat dough usually takes about 7–10 minutes/);
assert.match(source, /7–10 Minuten/);
assert.match(source, /Mešanje polnozrnatega testa običajno traja približno 7–10 minut/);
assert.match(source, /Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together/);
assert.match(source, /Gradually add the remaining 10% of the water, or \$\{remainingWater\} g\./);
assert.match(source, /When the water is almost fully absorbed, add \$\{ingredients\.salt\} g salt\./);
assert.match(source, /Add the flour to the yeast water and mix by hand until the ingredients come together/);
assert.match(source, /Gradually add the remaining 10% of the water, or \$\{remainingWater\} g\./);
assert.match(source, /When the water is almost fully absorbed, add \$\{ingredients\.salt\} g salt\./);
assert.match(source, /Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind/);
assert.match(source, /Geben Sie nach und nach die restlichen 10 % Wasser, also \$\{remainingWater\} g, hinzu\./);
assert.match(source, /Wenn das Wasser fast vollständig aufgenommen ist, geben Sie \$\{ingredients\.salt\} g Salz hinzu\./);
assert.doesNotMatch(source, /isNeapolitanWholeWheatBeginnerHand \? \[[\s\S]*?weiter, bis das Wasser fast vollständig aufgenommen ist/);
assert.match(source, /timer\('post-mix-rest', mixRestMinutes \* 60, 'rest'\)/);
assert.match(source, /const mixRestMinutes = isTegliaCustomBeginnerHand \|\| isTegliaCustomBeginnerMixer \|\| isTegliaTipo00BeginnerHand \|\| isTegliaTipo00BeginnerMixer \|\| isTegliaManitobaBeginnerHand \|\| isTegliaManitobaBeginnerMixer \|\| isTegliaSpeltBeginnerHand \|\| isTegliaSpeltBeginnerMixer \|\| isTegliaWholeWheatBeginnerHand \|\| isTegliaWholeWheatBeginnerMixer \|\| isNeapolitanTipo00BeginnerHand \|\| isNeapolitanTipo00BeginnerMixer/);
assert.match(source, /Manitoba brašna obično traje oko 10–15 minuta/);
assert.match(source, /Hand kneading Manitoba flour usually takes about 10–15 minutes/);
assert.match(source, /isNeapolitanManitobaBeginnerMixer/);
assert.match(source, /Miješanje Manitoba brašna obično traje oko 10–12 minuta/);
assert.match(source, /Mixer mixing Manitoba flour usually takes about 10–12 minutes/);
assert.match(source, /isNeapolitanSpeltBeginnerMixer/);
assert.match(source, /Miješanje pirovog tijesta mikserom obično traje oko 5–7 minuta/);
assert.match(source, /Mixer mixing spelt dough usually takes about 5–7 minutes/);
assert.match(source, /Mešanje pirinega testa običajno traja približno 5–7 minut/);
assert.match(source, /Koristite sporu brzinu/);
assert.match(source, /Use a slow speed/);
assert.match(source, /Verwenden Sie eine niedrige Geschwindigkeit/);
assert.match(source, /Uporabite počasno hitrost/);
assert.match(source, /zaustavite mikser.*10 minuta/);
assert.match(source, /stop the mixer.*10 minutes/);
assert.match(source, /stoppen Sie den Mixer.*10 Minuten/);
assert.match(source, /ustavite mešalnik.*10 minut/);
assert.match(source, /doughHandlingInfoStepIndex=.*isTargetNeapolitanSpeltMixerPhaseA/);
assert.match(source, /isTargetNeapolitanSpeltHandPhaseA/);
assert.match(source, /isNeapolitanSpeltBeginnerHand/);
assert.match(source, /Ručno miješenje obično traje oko 6–8 minuta/);
assert.match(source, /Hand kneading usually takes about 6–8 minutes/);
assert.match(source, /Ročno gnetenje običajno traja približno 6–8 minut/);
assert.match(source, /etwa 15 Minuten ruhen/);
assert.match(source, /rest for about 15 minutes/);
assert.match(source, /počivati približno 15 minut/);

console.log('Beginner Phase A regression checks passed.');
