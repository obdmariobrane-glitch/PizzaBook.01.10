import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const loadTypeScriptModule = (source, filename) => {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const require = (specifier) => {
    if (filename === 'prefermentSteps.ts' && specifier === './spiralMixing') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/i18n/spiralMixing.ts'), 'utf8'),
        'spiralMixing.ts',
      );
    }
    if (filename === 'spiralMixing.ts' && specifier === './proIceWaterInstructions') {
      return loadTypeScriptModule(
        fs.readFileSync(path.join(root, 'src/i18n/proIceWaterInstructions.ts'), 'utf8'),
        'proIceWaterInstructions.ts',
      );
    }
    throw new Error(`Unexpected dependency "${specifier}" in ${filename}.`);
  };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, require }, { filename });
  return moduleRef.exports;
};

const { adaptDirectMixingSteps, adaptDirectYeastStep } = loadTypeScriptModule(
  fs.readFileSync(path.join(root, 'src/i18n/prefermentSteps.ts'), 'utf8'),
  'prefermentSteps.ts',
);
const appSource = fs.readFileSync(path.join(root, 'app/(tabs)/index.tsx'), 'utf8');
const sourceStep = 'Postupno dodajte brašno u vodu s kvascem i miješajte rukom dok ne nestanu suhi dijelovi.';
const expectedHrStep = 'Postupno dodajte brašno u vodu i miješajte rukom dok ne nestanu suhi dijelovi.';
const mixerSourceStep = 'Ulijte vodu s otopljenim kvascem u posudu miksera.';

assert.equal(adaptDirectYeastStep(sourceStep, 'hr', 'dry'), 'Postupno dodajte brašno u vodo i miješajte rukom dok ne nestanu suhi dijelovi.');
assert.equal(adaptDirectYeastStep(sourceStep, 'hr', 'dry', true), expectedHrStep);
assert.equal(adaptDirectYeastStep(mixerSourceStep, 'hr', 'dry'), 'Ulijte vodo u posudu miksera.');
assert.equal(adaptDirectYeastStep(mixerSourceStep, 'hr', 'dry', true), 'Ulijte vodu u posudu miksera.');

for (const lang of ['en', 'de', 'sl']) {
  assert.equal(
    adaptDirectYeastStep(sourceStep, lang, 'dry', true),
    adaptDirectYeastStep(sourceStep, lang, 'dry'),
    `${lang} wording must remain unchanged`,
  );
  assert.equal(
    adaptDirectYeastStep(mixerSourceStep, lang, 'dry', true),
    adaptDirectYeastStep(mixerSourceStep, lang, 'dry'),
    `${lang} mixer wording must remain unchanged`,
  );
}

for (const yeastType of ['fresh', 'activeDry']) {
  for (const step of [sourceStep, mixerSourceStep]) {
    assert.equal(
      adaptDirectYeastStep(step, 'hr', yeastType, true),
      adaptDirectYeastStep(step, 'hr', yeastType),
      `${yeastType} wording must remain unchanged`,
    );
  }
}

for (const mixing of ['hand', 'mixer', 'spiral']) {
  const typoFreeSteps = adaptDirectMixingSteps(
    ['Preparation step.', 'Initial step.', sourceStep],
    'hr',
    'dry',
    mixing,
    false,
    true,
  );
  assert.ok(typoFreeSteps.every((step) => !/\bvodo\b/.test(step)), `${mixing} PRO workflow must not emit "vodo"`);
}

assert.match(
  appSource,
  /adaptDirectYeastStep\(step, lang, preferredYeastType, true\)/,
  'PRO detailed Direct instructions must enable corrected Croatian wording',
);
assert.match(
  appSource,
  /const yeastAwareDetailedDirectSteps = method === 'direct' && !isBeginner && proTegliaPhaseCDSteps/,
  'the PRO yeast adaptation is shared by Direct pizza-style instructions',
);
assert.ok(
  appSource.includes('adaptDirectYeastStep(step, lang, preferredYeastType), phaseIndex'),
  'Beginner Direct instructions must retain the unchanged default behavior',
);
assert.match(appSource, /'hand', false, !isBeginner/);
assert.match(appSource, /dough\.total\.oil > 0,\s*!isBeginner,/);

console.log('F39 PRO New York instant hand typo checks passed.');
