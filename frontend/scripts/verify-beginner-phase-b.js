#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const compiled = ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });

const { calculateBeginnerPhaseBPlan } = moduleRef.exports;
const plan = (durationMinutes, flourBehavior = 'standard', workflow = 'round') =>
  calculateBeginnerPhaseBPlan({ durationMinutes, flourBehavior, workflow });

const oneHour = plan(60);
assert.equal(JSON.stringify(oneHour), JSON.stringify({
  durationMinutes: 60,
  foldCount: 1,
  folds: [{ index: 1, offsetMinutes: 20 }],
  finalRestMinutes: 40,
  behavior: 'standard',
  workflow: 'round',
}));

const twoHours = plan(120);
assert.equal(JSON.stringify(twoHours), JSON.stringify({
  durationMinutes: 120,
  foldCount: 2,
  folds: [
    { index: 1, offsetMinutes: 20 },
    { index: 2, offsetMinutes: 50 },
  ],
  finalRestMinutes: 70,
  behavior: 'standard',
  workflow: 'round',
}));

const short = plan(30);
assert.equal(short.foldCount, 0);
assert.equal(short.finalRestMinutes, 30);
assert.equal(short.folds.length, 0);

for (const flourBehavior of ['gentle']) {
  assert.equal(plan(60, flourBehavior).behavior, 'gentle');
  assert.equal(plan(60, flourBehavior).foldCount, 1);
  assert.equal(plan(120, flourBehavior).foldCount, 2);
  assert.ok(plan(120, flourBehavior).foldCount <= 2);
}

for (const workflow of ['round', 'teglia']) {
  const gf = plan(120, 'glutenFree', workflow);
  assert.equal(gf.foldCount, 0);
  assert.equal(gf.folds.length, 0);
  assert.equal(gf.workflow, workflow);
}

assert.deepEqual(plan(120, 'standard', 'round'), plan(120, 'standard', 'round'));
assert.deepEqual(plan(120, 'standard', 'round'), plan(120, 'standard', 'round'));
for (const fold of twoHours.folds) {
  assert.ok(fold.offsetMinutes > 0);
  assert.ok(fold.offsetMinutes < twoHours.durationMinutes);
}
assert.equal(twoHours.folds[1].offsetMinutes - twoHours.folds[0].offsetMinutes, 30);

const sourceFile = ts.createSourceFile('index.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const phaseBRendererSource = sourceFile.statements
  .find((statement) => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'buildBeginnerPhaseBSteps')
  ?.getText(sourceFile);
const phaseBInfoSource = sourceFile.statements
  .find((statement) => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'buildBeginnerPhaseBStepInfo')
  ?.getText(sourceFile);
assert.ok(phaseBRendererSource, 'Phase-B recipe renderer must be present');
assert.ok(phaseBInfoSource, 'Phase-B help renderer must be present');
const tegliaStart = uiSource.indexOf('function buildBeginnerTegliaHomeSteps(');
const directStart = uiSource.indexOf('function buildBeginnerDirectHomeSteps(');
const tegliaRendererSource = uiSource.slice(tegliaStart, directStart);
const directRendererSource = uiSource.slice(directStart);
assert.doesNotMatch(phaseBRendererSource, /\$\{roomTemp\}\s*°C/);
assert.doesNotMatch(tegliaRendererSource, /\$\{roomTemp\}\s*°C/);
assert.doesNotMatch(directRendererSource, /\$\{roomTemp\}\s*°C/);
const rendererModule = { exports: {} };
const rendererCompiled = ts.transpileModule(`
function formatDuration(seconds) { return \`\${seconds / 60} minutes\`; }
${phaseBRendererSource}
${phaseBInfoSource}
module.exports = { buildBeginnerPhaseBSteps, buildBeginnerPhaseBStepInfo };
`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(rendererCompiled, { module: rendererModule, exports: rendererModule.exports });
const renderPhaseB = rendererModule.exports.buildBeginnerPhaseBSteps;
const renderPhaseBInfo = rendererModule.exports.buildBeginnerPhaseBStepInfo;
const foldText = (steps) => steps.filter((step) => /Stretch & Fold|fold|preklapanj|prepogn|rastegni|preklopi|Navlažite ruke/i.test(step));
assert.equal(foldText(renderPhaseB(plan(30), 'hr', false)).length, 0);
assert.equal(renderPhaseB(plan(30), 'hr', false)[1], 'Pokrijte tijesto i ostavite ga da fermentira 30 minutes.');
const oneHourSteps = renderPhaseB(oneHour, 'hr', false);
assert.equal(foldText(oneHourSteps).length, 1);
assert.equal(JSON.stringify(oneHourSteps.slice(0, 4)), JSON.stringify([
  'Uljem lagano premažite fermentacijsku posudu i prebacite tijesto u nju.',
  'Pokrijte tijesto i ostavite ga da odmori 20 minutes.',
  'Napravi Stretch & Fold.',
  'Pokrijte tijesto i ostavite ga da fermentira još 40 minutes.',
]));
const twoHourSteps = renderPhaseB(twoHours, 'hr', false);
assert.equal(foldText(twoHourSteps).length, 2);
assert.equal(twoHourSteps[1], 'Pokrijte tijesto i ostavite ga da odmori 20 minutes.');
assert.equal(twoHourSteps[3], 'Pokrijte tijesto i ostavite ga da odmori 30 minutes.');
assert.equal(twoHourSteps[5], 'Pokrijte tijesto i ostavite ga da fermentira još 70 minutes.');
const twoHourInfo = renderPhaseBInfo(twoHours, 'hr', false);
assert.equal(twoHourInfo[1].title, 'Zašto je odmor važan?');
assert.equal(twoHourInfo[3].title, 'Zašto je odmor između preklapanja važan?');
for (const [lang, expected] of [
  ['hr', 'Lagano nauljite fermentacijsku posudu, prebacite smjesu u nju i pokrijte je.'],
  ['en', 'Lightly oil the fermentation container, transfer the mixture into it, and cover it.'],
  ['de', 'Ölen Sie den Gärbehälter leicht ein, geben Sie die Masse hinein und decken Sie sie ab.'],
  ['sl', 'Fermentacijsko posodo rahlo naoljite, prenesite maso vanjo in jo pokrijte.'],
]) {
  for (const isTeglia of [false, true]) {
    const glutenFreeSteps = renderPhaseB(plan(120, 'glutenFree', isTeglia ? 'teglia' : 'round'), lang, isTeglia);
    assert.equal(glutenFreeSteps[0], expected);
    assert.equal(foldText(glutenFreeSteps).length, 0);
  }
}

assert.match(uiSource, /calculateBeginnerPhaseBPlan\(\{/);
assert.match(uiSource, /durationMinutes: directHomeSchedule\.roomBeforeFridgeHours \* 60/);
assert.match(uiSource, /id: fold\.index === 1 \? 'fold1' : 'fold2'/);
assert.match(uiSource, /buildBeginnerPhaseBSteps\(phaseBPlan/);
assert.match(uiSource, /const phaseBTitle = \{/);
assert.match(uiSource, /title: phaseBTitle/);
assert.match(uiSource, /if \(components\.includes\('spelt'\)\) return 'spelt'/);
assert.match(uiSource, /if \(components\.includes\('wholeWheat'\)\) return 'wholeWheat'/);
assert.match(uiSource, /flourBehavior: flour === 'glutenFree'/);
assert.match(uiSource, /Führen Sie ein Stretch & Fold durch\./);
assert.match(uiSource, /Führen Sie das zweite Stretch & Fold durch\./);
assert.match(uiSource, /betweenFolds:/);
assert.doesNotMatch(uiSource, /Miješajte i fermentirajte tijesto \$\{hours\}/);
assert.doesNotMatch(uiSource, /trikrat zelo nežno prepognite/);
assert.doesNotMatch(uiSource, /dva nježna preklapanja/);
assert.match(uiSource, /const beginnerDirectHome = isBeginner && method === 'direct' && !!directHomeSchedule/);

console.log('Beginner Phase-B plan and integration checks passed.');
