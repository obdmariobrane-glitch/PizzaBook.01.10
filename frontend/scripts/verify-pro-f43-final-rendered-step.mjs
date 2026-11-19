#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { alignProDirectSteps } = require(path.join(
  frontendRoot,
  'src',
  'i18n',
  'proDirectStepAlignment.ts',
));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const expectedColdInstruction = {
  hr: (temperature) => `Kugle fermentiraju u hladnjaku 24 sati pri temperaturi od ${temperature}. Vrijeme hladne fermentacije računa se samo jednom.`,
  en: (temperature) => `Ferment the dough balls in the refrigerator for 24 hours at ${temperature}. Cold fermentation time is counted only once.`,
  de: (temperature) => `Lassen Sie die Teigkugeln 24 Stunden bei ${temperature} im Kühlschrank fermentieren. Die Zeit der kalten Fermentation wird nur einmal berechnet.`,
  sl: (temperature) => `Kroglice naj fermentirajo v hladilniku 24 ur pri temperaturi ${temperature}. Čas hladne fermentacije se šteje samo enkrat.`,
};
const referenceColdInstruction = {
  hr: 'Kugle fermentiraju u hladnjaku 24 sati pri temperaturi od 4–6 °C. Vrijeme hladne fermentacije računa se samo jednom.',
  en: 'Ferment the dough balls in the refrigerator for 24 hours at 4–6 °C. Cold fermentation time is counted only once.',
  de: 'Lassen Sie die Teigkugeln 24 Stunden bei 4–6 °C im Kühlschrank fermentieren. Die Zeit der kalten Fermentation wird nur einmal berechnet.',
  sl: 'Kroglice naj fermentirajo v hladilniku 24 ur pri temperaturi 4–6 °C. Čas hladne fermentacije se šteje samo enkrat.',
};

for (const [lang, renderColdInstruction] of Object.entries(expectedColdInstruction)) {
  for (const fridgeTemperature of [2, 4, 6]) {
    const temperatureText = `${fridgeTemperature}°C`;
    const beginnerReferenceSteps = [{
      title: 'Phase D',
      steps: [
        'Beginner reference: transfer covered dough to the refrigerator.',
        referenceColdInstruction[lang],
        'Beginner reference: continue after cold fermentation.',
      ],
      timers: [{ id: 'cold-fermentation', seconds: 86400, kind: 'fridge' }],
    }];
    const generatedProSteps = [{
      title: 'Phase D',
      steps: [
        'PRO generated: transfer covered dough to the refrigerator.',
        renderColdInstruction(temperatureText),
        'PRO generated: continue after cold fermentation.',
      ],
      timers: [{ id: 'cold-fermentation', seconds: 86400, kind: 'fridge' }],
    }];

    const alignedSteps = alignProDirectSteps(generatedProSteps, beginnerReferenceSteps, {
      isProGlutenFreeBlend: false,
      isProEffectivelyGlutenFree: true,
      fridgeTemperatureText: temperatureText,
    });

    assert.deepEqual(
      alignedSteps[0].steps,
      [
        beginnerReferenceSteps[0].steps[0],
        renderColdInstruction(temperatureText),
        beginnerReferenceSteps[0].steps[2],
      ],
      `${lang} standard GF final Phase D step uses ${temperatureText} and preserves adjacent Beginner-reference text`,
    );
    assert.equal(alignedSteps[0].timers[0].seconds, 86400, 'cold-fermentation duration remains unchanged');
  }
}

for (const pureBlendEndpoint of [0, 100]) {
  for (const fridgeTemperature of [2, 4, 6]) {
    const temperatureText = `${fridgeTemperature}°C`;
    const generated = [{
      steps: ['PRO first', `PRO cold step at ${temperatureText}`, 'PRO last'],
      timers: [{ id: 'cold-fermentation' }],
    }];
    const reference = [{
      steps: ['Beginner first', 'Beginner cold step at 4–6 °C', 'Beginner last'],
      timers: [{ id: 'cold-fermentation' }],
    }];
    const aligned = alignProDirectSteps(generated, reference, {
      isProGlutenFreeBlend: true,
      isProEffectivelyGlutenFree: true,
      fridgeTemperatureText: temperatureText,
    });
    assert.deepEqual(
      aligned,
      generated,
      `pure GF custom blend endpoint ${pureBlendEndpoint} keeps its PRO text at ${temperatureText}`,
    );
  }
}

const nonGlutenFreeGenerated = [{
  steps: ['PRO transfer', 'PRO cold step at 2°C'],
  timers: [{ id: 'cold-fermentation' }],
}];
const nonGlutenFreeReference = [{
  steps: ['Beginner transfer', 'Beginner cold guidance at 4–6 °C'],
  timers: [{ id: 'cold-fermentation' }],
}];
assert.deepEqual(
  alignProDirectSteps(nonGlutenFreeGenerated, nonGlutenFreeReference, {
    isProGlutenFreeBlend: false,
    isProEffectivelyGlutenFree: false,
    fridgeTemperatureText: '2°C',
  })[0].steps,
  nonGlutenFreeReference[0].steps,
  'non-GF instructions retain existing Beginner-reference text',
);

for (const { caseName, isProGlutenFreeBlend } of [
  { caseName: 'Tipo 0/00', isProGlutenFreeBlend: false },
  { caseName: 'flour blend', isProGlutenFreeBlend: true },
]) {
  const generated = [{
    steps: ['Izmjerite 1000 g brašna, 20 g soli, 1.65 g kvasca i 650 g vode.'],
  }];
  const beginnerReference = [{
    steps: ['Izmjerite 1000 g brašna, 20 g soli, 1.6544415396601928 g kvasca i 650 g vode.'],
  }];
  const aligned = alignProDirectSteps(generated, beginnerReference, {
    isProGlutenFreeBlend,
    isProEffectivelyGlutenFree: isProGlutenFreeBlend,
    fridgeTemperatureText: '4°C',
    yeastDisplay: new Intl.NumberFormat('hr', { maximumFractionDigits: 2 }).format(1.6544415396601928),
  });
  assert.equal(aligned[0].steps[0], 'Izmjerite 1000 g brašna, 20 g soli, 1,65 g kvasca i 650 g vode.', `${caseName}: rendered measurement step uses localized two-decimal yeast`);
  assert.equal(beginnerReference[0].steps[0].includes('1.6544415396601928'), true, `${caseName}: Beginner reference remains unchanged`);
}

assert.match(indexSource, /alignProDirectSteps\(generatedDetailedDirectSteps, proTextReferenceSteps/);
assert.match(indexSource, /fridgeTemperatureText: formatTemperature\(fridgeTemp, 'celsius'\)/);
assert.match(indexSource, /const proTextReferenceSteps = !isBeginner && generatedDetailedDirectSteps \? buildDetailedDirectSteps\(true\) : null/);
assert.match(indexSource, /yeastDisplay: method === 'direct' \? formatProDirectYeastAmount\(dough\.total\.yeast\) : undefined/);
assert.match(indexSource, /const formatProDirectYeastAmount = \(grams: number\) =>/);
assert.match(indexSource, /const proDirectYeastWeight = \(grams: number\) =>/);
assert.match(indexSource, /!isBeginner && method === 'direct' \? proDirectYeastWeight\(dough\.main\.yeast\) : weight\(dough\.main\.yeast, true\)/);
assert.equal(new Intl.NumberFormat('hr', { maximumFractionDigits: 2 }).format(1.6544415396601928), '1,65', 'Croatian PRO Direct summary uses a decimal comma');

console.log('F43 final rendered-step alignment regression passed.');
