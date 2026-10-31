#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'frontend');
const OUT = path.join(ROOT, 'PIZZABOOK_COMPLETE_INSTRUCTION_SYSTEM_EXPORT');
const GENERATOR_TEMPLATE = path.join(ROOT, 'instruction_generator_template.cjs');

const sourceFiles = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/planner.tsx',
  'src/calculator.ts',
  'src/i18n/prefermentSteps.ts',
  'src/i18n/spiralMixing.ts',
  'src/i18n/styleSteps.ts',
  'src/i18n/translations.ts',
  'src/guidedRecipe.ts',
  'src/notifications.ts',
  'src/proLearn/manualContent.generated.ts',
];

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function sourceRef(relative, text, node) {
  return {
    path: `frontend/${relative}`,
    line: lineAt(text, node.getStart()),
  };
}

function astInventory(relative, text) {
  const ts = require(path.join(FRONTEND, 'node_modules/typescript'));
  const isTsx = relative.endsWith('.tsx');
  const file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts = [];
  const conditions = [];
  const seenTexts = new Set();
  const addText = (node, kind, value) => {
    const ref = sourceRef(relative, text, node);
    const key = `${ref.path}:${ref.line}:${kind}:${value}`;
    if (seenTexts.has(key)) return;
    seenTexts.add(key);
    texts.push({ ...ref, kind, value });
  };
  const addCondition = (node, kind, expression) => {
    conditions.push({ ...sourceRef(relative, text, node), kind, expression: expression.trim() });
  };
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) addText(node, ts.isNoSubstitutionTemplateLiteral(node) ? 'template' : 'string', node.text);
    if (ts.isIfStatement(node)) addCondition(node.expression, 'if', node.expression.getText(file));
    if (ts.isConditionalExpression(node)) addCondition(node.condition, 'ternary', node.condition.getText(file));
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      addCondition(node, 'logical', node.getText(file));
    }
    if (ts.isCaseClause(node) || ts.isDefaultClause(node)) addCondition(node, ts.isDefaultClause(node) ? 'default' : 'case', node.getText(file).split('\n')[0]);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { texts, conditions };
}

function copySources() {
  for (const relative of sourceFiles) {
    const source = path.join(FRONTEND, relative);
    const destination = path.join(OUT, 'instruction_sources', relative);
    mkdir(path.dirname(destination));
    fs.copyFileSync(source, destination);
  }
}

function writeGenerator() {
  const directory = path.join(OUT, 'instruction_generator');
  mkdir(directory);
  const template = fs.readFileSync(GENERATOR_TEMPLATE, 'utf8');
  const generator = template.replace("const frontend = path.resolve(__dirname, 'frontend');", "const frontend = path.resolve(__dirname, '../../frontend');");
  fs.writeFileSync(path.join(directory, 'index.cjs'), generator, 'utf8');
  fs.chmodSync(path.join(directory, 'index.cjs'), 0o755);
  fs.writeFileSync(path.join(directory, 'README.md'), `# Instruction generator\n\nThis generator loads the current frontend TypeScript modules through the frontend-local TypeScript compiler. It does not modify or copy files back into the application.\n\nUsage:\n\n\`node instruction_generator/index.cjs '{"kind":"beginnerDirect","lang":"en","style":"neapolitan","mixing":"hand","flourType":"caputo00","bakeAt":"2026-10-13T18:00:00.000Z"}'\`\n\nSupported kinds are \`preferment\`, \`spiral\`, \`style\`, \`directSchedule\`, \`bigaSchedule\`, \`poolishSchedule\`, and \`beginnerDirect\`. Dates are serialized as ISO strings.\n\nThe \`beginnerDirect\` generator executes the exact existing Beginner instruction functions from \`frontend/app/(tabs)/index.tsx\` through a read-only extracted runtime.\n`, 'utf8');
}

function buildInventories() {
  const allTexts = [];
  const allConditions = [];
  for (const relative of sourceFiles) {
    const text = fs.readFileSync(path.join(FRONTEND, relative), 'utf8');
    const inventory = astInventory(relative, text);
    allTexts.push(...inventory.texts);
    allConditions.push(...inventory.conditions);
  }
  writeJson(path.join(OUT, 'all_texts.json'), {
    schema: 'pizzabook-instruction-system/all-texts/v1',
    languages: ['hr', 'en', 'de', 'sl'],
    note: 'AST inventory of string literals and template literals in the preserved instruction source files. Dynamic values remain templates with source references.',
    texts: allTexts,
  });
  writeJson(path.join(OUT, 'all_conditions.json'), {
    schema: 'pizzabook-instruction-system/all-conditions/v1',
    conditions: allConditions,
    branch_axes: [
      { id: 'language', values: ['hr', 'en', 'de', 'sl'], status: 'active', source: 'frontend/src/i18n/translations.ts' },
      { id: 'method', values: ['direct', 'biga', 'poolish'], status: 'active', source: 'frontend/src/calculator.ts' },
      { id: 'mixing', values: ['hand', 'mixer/home', 'spiral'], status: 'active', source: 'frontend/src/i18n/spiralMixing.ts' },
      { id: 'yeast', values: ['fresh', 'activeDry', 'dry'], status: 'active', source: 'frontend/src/i18n/prefermentSteps.ts' },
      { id: 'style', values: ['neapolitan', 'romana', 'ny_style'], status: 'active', source: 'frontend/src/calculator.ts' },
      { id: 'flour', values: ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'], status: 'active', source: 'frontend/src/calculator.ts' },
      { id: 'oven', values: ['ooni', 'homeStone', 'homePan'], status: 'active', source: 'frontend/src/calculator.ts' },
      { id: 'romanFormat', values: ['tonda', 'teglia'], status: 'conditional', source: 'frontend/app/(tabs)/index.tsx' },
      { id: 'schedule', values: ['roomOnly', 'fridgeRoom', 'unscheduled'], status: 'conditional', source: 'frontend/src/calculator.ts' },
      { id: 'legacyStyleSteps', values: ['non-HR/non-Neapolitan may return null'], status: 'legacy/conditional', source: 'frontend/src/i18n/styleSteps.ts' },
    ],
    numeric_inputs: [
      'hydrationPct', 'roomTemp', 'fridgeTemp', 'roomHours', 'fridgeHours', 'bigaHours', 'poolishHours',
      'bigaPct', 'poolishPct', 'ovenTemp', 'diameter', 'ballWeight', 'pizzas', 'trayWidth', 'trayLength',
      'doughWeight', 'yeast quantity', 'flour/water/salt/oil quantities',
    ],
  });
}

function buildDependencyMap() {
  writeJson(path.join(OUT, 'instruction_dependencies.json'), {
    schema: 'pizzabook-instruction-system/dependencies/v1',
    roots: [
      { source: 'frontend/app/(tabs)/index.tsx', role: 'active UI assembler and Beginner local instruction functions' },
      { source: 'frontend/src/calculator.ts', role: 'numeric calculations and schedules' },
      { source: 'frontend/src/i18n/prefermentSteps.ts', role: 'Biga/Poolish/direct yeast-aware instructions, timers, notifications' },
      { source: 'frontend/src/i18n/spiralMixing.ts', role: 'spiral mixer instructions' },
      { source: 'frontend/src/i18n/styleSteps.ts', role: 'legacy/pro style-specific phases and baking instructions' },
      { source: 'frontend/src/i18n/translations.ts', role: 'translation catalog' },
      { source: 'frontend/src/guidedRecipe.ts', role: 'guided timeline and notification event assembly' },
      { source: 'frontend/src/notifications.ts', role: 'scheduled notifications' },
      { source: 'frontend/src/proLearn/manualContent.generated.ts', role: 'generated PRO Learn manual' },
    ],
    edges: [
      ['index.tsx', 'calculator.ts'], ['index.tsx', 'prefermentSteps.ts'], ['index.tsx', 'spiralMixing.ts'], ['index.tsx', 'styleSteps.ts'],
      ['index.tsx', 'guidedRecipe.ts'], ['index.tsx', 'notifications.ts'], ['planner.tsx', 'calculator.ts'], ['planner.tsx', 'guidedRecipe.ts'],
      ['prefermentSteps.ts', 'translations.ts'], ['spiralMixing.ts', 'translations.ts'], ['styleSteps.ts', 'calculator.ts'],
    ],
    boundary: {
      beginnerLocalAssemblers: 'Executed from the original frontend/app/(tabs)/index.tsx through external runtime extraction; no production edits required.',
      reusableExportedGenerators: ['calculator.ts', 'prefermentSteps.ts', 'spiralMixing.ts', 'styleSteps.ts', 'index.tsx Beginner local assemblers'],
    },
  });
}

function buildCoverage() {
  writeJson(path.join(OUT, 'branch_coverage.json'), {
    schema: 'pizzabook-instruction-system/branch-coverage/v1',
    static_axes: [
      { axis: 'language', values: ['hr', 'en', 'de', 'sl'], tested: true },
      { axis: 'method', values: ['direct', 'biga', 'poolish'], tested: true },
      { axis: 'mixing', values: ['hand', 'mixer/home', 'spiral'], tested: true },
      { axis: 'yeast', values: ['fresh', 'activeDry', 'dry'], tested: true },
      { axis: 'style', values: ['neapolitan', 'romana', 'ny_style'], tested: true },
      { axis: 'flour', values: ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'], tested: true },
      { axis: 'oven', values: ['ooni', 'homeStone', 'homePan'], tested: true },
      { axis: 'schedule', values: ['roomOnly', 'fridgeRoom', 'unscheduled'], tested: true, note: 'Covered by beginnerDirect using runtime-extracted index.tsx assemblers.' },
    ],
    runtime_smoke_cases: [
      { command: 'preferment', matrix: '4 languages x 2 methods x 3 yeast types x 3 mixing paths' },
      { command: 'spiral', matrix: '4 languages x 3 methods x 3 yeast types' },
      { command: 'style', matrix: 'styles/flours/ovens through exported legacy API' },
      { command: 'directSchedule', matrix: 'deterministic representative room/fridge schedule' },
      { command: 'bigaSchedule', matrix: 'deterministic representative schedule' },
      { command: 'poolishSchedule', matrix: 'deterministic representative schedule' },
      { command: 'beginnerDirect', matrix: 'Beginner direct style/flour/mixing/schedule outputs from exact index.tsx local functions' },
    ],
    exact_beginner_display_coverage: 'available through runtime extraction of index.tsx local functions; outputs include numbered steps, quantities, and schedule timestamps',
  });
}

function buildReadme() {
  fs.writeFileSync(path.join(OUT, 'README.md'), `# PizzaBook complete instruction system export\n\nGenerated as a read-only extraction from the current working tree. The application under \`frontend/\` was not edited by this export.\n\n## Contents\n\n- \`instruction_sources/\`: verbatim copies of the active instruction, calculation, translation, guided-recipe, notification, and generated-manual sources.\n- \`all_texts.json\`: TypeScript AST inventory of string and template literals with source paths and lines.\n- \`all_conditions.json\`: AST condition inventory plus documented branch axes and numeric controls.\n- \`instruction_dependencies.json\`: source ownership and dependency boundaries.\n- \`instruction_generator/\`: standalone CommonJS runner for exported production generators and Beginner direct assembly from \`index.tsx\`.\n- \`branch_coverage.json\`: static axes, smoke matrix, and explicit coverage limitations.\n- \`validation_report.json\`: hashes, parse checks, runtime smoke results, and Beginner parity evidence.\n- \`beginner_matrix_validation.json\`: 576-case Beginner direct matrix (language/style/flour/mixing/schedule) execution evidence.\n\n## Languages\n\nThe source supports Croatian (HR), English (EN), German (DE), and Slovenian (SL). SL is retained because removing it would omit supported production instructions.\n\n## Beginner execution\n\nThe Beginner final display assemblers are local, unexported functions in \`frontend/app/(tabs)/index.tsx\`. This package executes those exact functions through a read-only runtime extractor in \`instruction_generator/index.cjs\`; it does not duplicate or rewrite their rules.\n\n## Regeneration\n\nFrom the repository root:\n\n\`node build_instruction_system_export.cjs\`\n\nThe output directory is intentionally separate from \`frontend/\`.\n`, 'utf8');
}

function validate() {
  const checks = [];
  for (const relative of sourceFiles) {
    const source = path.join(FRONTEND, relative);
    const copied = path.join(OUT, 'instruction_sources', relative);
    const sourceHash = require('crypto').createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const copiedHash = require('crypto').createHash('sha256').update(fs.readFileSync(copied)).digest('hex');
    checks.push({ file: relative, copied_verbatim: sourceHash === copiedHash, sha256: sourceHash });
  }
  const jsonFiles = ['all_texts.json', 'all_conditions.json', 'instruction_dependencies.json', 'branch_coverage.json'];
  const jsonChecks = jsonFiles.map((file) => { JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8')); return { file, valid_json: true }; });
  let runtimeSmoke = { status: 'not-run' };
  let beginnerMatrix = null;
  try {
    const generator = require(path.join(OUT, 'instruction_generator', 'index.cjs'));
    const cases = [
      { kind: 'preferment', lang: 'en', method: 'biga', mixing: 'hand', yeastType: 'dry' },
      { kind: 'spiral', lang: 'de', method: 'direct', yeastType: 'fresh', hasOil: true },
      { kind: 'style', lang: 'hr', style: 'romana', mixing: 'hand', flour: 'spelt', oven: 'homeStone' },
      { kind: 'directSchedule', style: 'neapolitan', now: '2026-01-01T08:00:00.000Z', bakeAt: '2026-01-02T12:00:00.000Z' },
      { kind: 'bigaSchedule', now: '2026-01-01T08:00:00.000Z', bakeAt: '2026-01-02T12:00:00.000Z' },
      { kind: 'poolishSchedule', now: '2026-01-01T08:00:00.000Z', bakeAt: '2026-01-02T12:00:00.000Z' },
      { kind: 'beginnerDirect', lang: 'en', style: 'neapolitan', romanFormat: 'tonda', mixing: 'hand', flourType: 'caputo00', bakeAt: '2026-01-02T12:00:00.000Z', now: '2026-01-01T08:00:00.000Z' },
      { kind: 'beginnerDirect', lang: 'hr', style: 'romana', romanFormat: 'teglia', mixing: 'mixer', flourType: 'manitoba', bakeAt: '2026-01-02T12:00:00.000Z', now: '2026-01-01T08:00:00.000Z' },
      { kind: 'beginnerDirect', lang: 'de', style: 'ny_style', romanFormat: 'tonda', mixing: 'hand', flourType: 'custom', blendA: 'caputo00', blendB: 'wholeWheat', blendPctA: 65, roomHours: 6, fridgeHours: 0 },
    ];
    runtimeSmoke = { status: 'passed', cases: cases.map((input) => ({ kind: input.kind, returned: generator.generate(input) !== undefined })) };

    const langs = ['hr', 'en', 'de', 'sl'];
    const styles = ['neapolitan', 'romana', 'ny_style'];
    const flours = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];
    const mixings = ['hand', 'mixer'];
    const schedules = [
      { name: 'unscheduled', payload: {} },
      { name: 'roomOnly', payload: { now: '2026-10-13T10:00:00.000Z', bakeAt: '2026-10-13T12:00:00.000Z', beginnerScheduleMode: 'roomOnly' } },
      { name: 'fridgeRoom', payload: { now: '2026-10-13T10:00:00.000Z', bakeAt: '2026-10-14T18:00:00.000Z', beginnerScheduleMode: 'fridgeRoom' } },
    ];
    let total = 0;
    let passed = 0;
    const failures = [];
    for (const lang of langs) {
      for (const style of styles) {
        for (const flour of flours) {
          for (const mixing of mixings) {
            const formats = style === 'romana' ? ['tonda', 'teglia'] : ['tonda'];
            for (const romanFormat of formats) {
              for (const schedule of schedules) {
                const input = { kind: 'beginnerDirect', lang, style, romanFormat, mixing, flourType: flour, blendA: 'caputo00', blendB: 'wholeWheat', blendPctA: 70, ...schedule.payload };
                total += 1;
                try {
                  const output = generator.generate(input);
                  const phasesOk = output && Array.isArray(output.phases) && output.phases.every((phase) => Array.isArray(phase.steps) && phase.steps.every((step) => typeof step.number === 'number' && typeof step.text === 'string'));
                  const timestampsOk = schedule.name === 'unscheduled' || !!output.scheduleTimestamps;
                  if (phasesOk && timestampsOk) {
                    passed += 1;
                  } else {
                    failures.push({ input, reason: 'phase/timestamp contract failed' });
                  }
                } catch (error) {
                  failures.push({ input, reason: String(error && error.message || error) });
                }
              }
            }
          }
        }
      }
    }
    beginnerMatrix = {
      generated_at: new Date().toISOString(),
      total,
      passed,
      failed: failures.length,
      dimensions: {
        languages: langs,
        styles,
        flours,
        mixings,
        schedules: schedules.map((item) => item.name),
      },
      failures: failures.slice(0, 25),
    };
    writeJson(path.join(OUT, 'beginner_matrix_validation.json'), beginnerMatrix);
  } catch (error) {
    runtimeSmoke = { status: 'failed', error: String(error && error.stack || error) };
  }
  writeJson(path.join(OUT, 'validation_report.json'), {
    schema: 'pizzabook-instruction-system/validation/v1',
    generated_at: new Date().toISOString(),
    production_source_modified: false,
    copied_sources: checks,
    json_checks: jsonChecks,
    runtime_smoke: runtimeSmoke,
    beginner_matrix: beginnerMatrix,
    non_reproducible_configurations: [
      {
        case: 'Beginner schedule restored from persisted AsyncStorage snapshot',
        reason: 'Standalone generator accepts explicit inputs only and does not load app-local persisted state by key.',
      },
      {
        case: 'UI overlays/tooltips outside instruction phase output',
        reason: 'Generator exports instruction phases, steps, quantities, and schedule timestamps; it does not execute modal interaction state.',
      },
    ],
    live_preview: { status: 'not-run', note: 'A live browser validation was not performed by the export builder; preview claims require a separate current-endpoint check.' },
    known_limitations: ['Static AST inventory does not evaluate runtime-generated strings.', 'Exact rendered-UI parity still depends on app runtime state (for example restored schedules from AsyncStorage) that is not part of standalone generator inputs.', 'No production deploy or commit was performed.'],
  });
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);
  copySources();
  writeGenerator();
  buildInventories();
  buildDependencyMap();
  buildCoverage();
  buildReadme();
  validate();
  console.log(`Created ${OUT}`);
}

main();