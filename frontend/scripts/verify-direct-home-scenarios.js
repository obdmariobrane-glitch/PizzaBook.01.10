#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });

const {
  generateDirectHomeCandidates,
  evaluateDirectHomeCandidate,
  selectDirectHomeCandidate,
} = moduleRef.exports;

const scenarios = [
  { name: 'A', hydrationPct: 65, w: 280, roomTemp: 24, fridgeTemp: 5, availableHours: 24 },
  { name: 'B', hydrationPct: 65, w: 280, roomTemp: 24, fridgeTemp: 5, availableHours: 48 },
  { name: 'C', hydrationPct: 65, w: 280, roomTemp: 28, fridgeTemp: 5, availableHours: 24 },
  { name: 'D', hydrationPct: 65, w: 280, roomTemp: 24, fridgeTemp: 8, availableHours: 24 },
  { name: 'E', hydrationPct: 70, w: 220, roomTemp: 24, fridgeTemp: 5, availableHours: 24 },
];

const round = (value, digits = 4) => Number(value.toFixed(digits));

for (const scenario of scenarios) {
  const candidates = generateDirectHomeCandidates(scenario.availableHours);
  const sharedInput = {
    flour: { source: 'w', w: scenario.w },
    hydrationPct: scenario.hydrationPct,
    roomTemp: scenario.roomTemp,
    fridgeTemp: scenario.fridgeTemp,
    roomBeforeFridgeHours: 0,
    fridgeHours: 0,
    roomAfterFridgeHours: 0,
  };
  const evaluations = candidates.map((candidate) =>
    evaluateDirectHomeCandidate(candidate, sharedInput, 'fresh'));
  const selected = selectDirectHomeCandidate(evaluations);
  const selectedIndex = evaluations.indexOf(selected);
  const rows = evaluations.map((evaluation, index) => ({
    selected: index === selectedIndex ? 'WINNER' : '',
    strategy: evaluation.candidate.strategy,
    roomBefore: round(evaluation.candidate.roomBeforeFridgeHours),
    fridge: round(evaluation.candidate.fridgeHours),
    roomAfter: round(evaluation.candidate.roomAfterFridgeHours),
    totalHours: round(
      evaluation.candidate.roomBeforeFridgeHours
      + evaluation.candidate.fridgeHours
      + evaluation.candidate.roomAfterFridgeHours,
    ),
    warmBefore: round(evaluation.stressSignal.warmBefore),
    cold: round(evaluation.stressSignal.cold),
    warmAfter: round(evaluation.stressSignal.warmAfter),
    totalStress: round(evaluation.stressSignal.total),
    freshYeastPct: round(evaluation.yeastRequirement.freshYeastPct, 6),
    freshYeastGPer1000g: round(evaluation.yeastRequirement.freshYeastGramsPer1000gFlour, 6),
    yeastMeasurement: evaluation.yeastMeasurement.status,
    flourCapability: evaluation.baseResilience.flourCapability ?? 'null',
    hydrationLoad: evaluation.baseResilience.hydrationLoad ?? 'null',
    baseResilience: evaluation.baseResilience.resilience ?? 'null',
    domain: evaluation.domain.status,
    selectable: evaluation.selectable,
    rejectionReasons: evaluation.rejectionReasons.join('|') || '-',
  }));

  console.log(`\nScenario ${scenario.name}: Direct, Napolitana, hydration ${scenario.hydrationPct}%, W ${scenario.w}, room ${scenario.roomTemp}C, fridge ${scenario.fridgeTemp}C, ${scenario.availableHours}h, fresh yeast`);
  console.table(rows);
  console.log(`Winner: ${selected ? `${selected.candidate.strategy} ${selected.candidate.roomBeforeFridgeHours}/${selected.candidate.fridgeHours}/${selected.candidate.roomAfterFridgeHours}` : 'none'}`);
}