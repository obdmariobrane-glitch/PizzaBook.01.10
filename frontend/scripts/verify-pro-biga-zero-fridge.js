#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const localRequire = (request) => request === './proMethods/bigaPoolish'
  ? (() => {
    const filePath = path.join(frontendRoot, 'src', 'proMethods', 'bigaPoolish.ts');
    const source = fs.readFileSync(filePath, 'utf8');
    const moduleRef = { exports: {} };
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('module', 'exports', 'require', compiled)(moduleRef, moduleRef.exports, require);
    return moduleRef.exports;
  })()
  : require(request);
const calculatorSource = fs.readFileSync(path.join(frontendRoot, 'src', 'calculator.ts'), 'utf8');
const calculator = { exports: {} };
new Function('module', 'exports', 'require', `${ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText}\nreturn module.exports;`)(calculator, calculator.exports, localRequire);

const { getFermentationSchedule } = calculator.exports;
const uiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');

for (const hours of [4, 5, 6, 7, 8]) {
  const schedule = getFermentationSchedule({
    method: 'biga',
    prefermentHours: hours,
    roomHours: 2,
    roomTemp: 22,
    fridgeHours: 24,
    fridgeTemp: 4,
  });
  assert.equal(schedule.prefermentRoomHours, hours, `${hours}h Biga must remain at room temperature`);
  assert.equal(schedule.prefermentFridgeHours, 0, `${hours}h Biga must not create a refrigerator phase`);
  assert.deepEqual(schedule.phases.filter((phase) => phase.kind === 'preferment').map((phase) => phase.environment), ['room']);
}

for (const hours of [9, 12, 24, 48]) {
  const schedule = getFermentationSchedule({
    method: 'biga',
    prefermentHours: hours,
    roomHours: 2,
    roomTemp: 22,
    fridgeHours: 24,
    fridgeTemp: 4,
  });
  assert.ok(schedule.prefermentFridgeHours > 0, `${hours}h Biga must include positive refrigerator time`);
  assert.deepEqual(
    schedule.phases.filter((phase) => phase.kind === 'preferment').map((phase) => phase.environment),
    ['room', 'fridge'],
  );
}

assert.match(uiSource, /\(\(isBeginner \|\| prefermentFridgeHours > 0\) \? \[/);
assert.match(uiSource, /prefermentFridgeHours > 0/);
for (const text of [
  'hladnjak',
  'refrigerate it for',
  'in den Kühlschrank',
  'v hladilnik',
]) {
  assert.ok(uiSource.includes(text), `missing localized positive-fridge instruction: ${text}`);
}

console.log('F24 Biga zero-fridge regression passed for 4–8h room-only and positive-fridge boundaries.');
