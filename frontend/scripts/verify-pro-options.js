#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontend = path.join(__dirname, '..');
const calculatorUi = fs.readFileSync(path.join(frontend, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerUi = fs.readFileSync(path.join(frontend, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const settingsUi = fs.readFileSync(path.join(frontend, 'app', 'settings.tsx'), 'utf8');
const proRecipesSource = fs.readFileSync(path.join(frontend, 'src', 'proSavedRecipes.ts'), 'utf8');
const translationsSource = fs.readFileSync(path.join(frontend, 'src', 'i18n', 'translations.ts'), 'utf8');
const bigaPoolishModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(frontend, 'src', 'proMethods', 'bigaPoolish.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  module: bigaPoolishModule,
  exports: bigaPoolishModule.exports,
});
const calculatorModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(frontend, 'src', 'calculator.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  module: calculatorModule,
  exports: calculatorModule.exports,
  require: (specifier) => {
    if (specifier === './proMethods/bigaPoolish') return bigaPoolishModule.exports;
    throw new Error(`Unexpected dependency in calculator test: ${specifier}`);
  },
});
const {
  bakingCalc,
  formatBakingTimeRange,
  getBakingTimeRange,
  getBeginnerPreheatMinutes,
  getOvenBehaviorType,
  isProMethodAllowedForFlour,
  normalizeBeginnerSavedState,
} = calculatorModule.exports;
const styleStepsModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(frontend, 'src', 'i18n', 'styleSteps.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  module: styleStepsModule,
  exports: styleStepsModule.exports,
  require: (specifier) => {
    assert.equal(specifier, '../calculator');
    return calculatorModule.exports;
  },
});

assert.equal(getOvenBehaviorType('kamado'), 'ooni', 'Kamado uses Pizza oven behavior without changing its saved oven identity');
assert.equal(getBakingTimeRange('kamado', 450), null, 'Kamado has no unapproved inherited Pizza-oven baking range');
assert.throws(() => formatBakingTimeRange('kamado', 450, 'en'), /Kamado baking time has not been approved/);
assert.throws(() => bakingCalc('kamado'), /Kamado baking recommendations have not been approved/);
assert.equal(getBeginnerPreheatMinutes('kamado'), getBeginnerPreheatMinutes('ooni'), 'Existing schedule buffer remains unchanged while Kamado bake timers are disabled');
assert.equal(styleStepsModule.exports.getStyleBakingSteps('romana', 'kamado', 'hr'), null);
assert.equal(styleStepsModule.exports.getStyleBakingTemp('romana', 'kamado', 'hr'), null);
const ooniBakeRange = getBakingTimeRange('ooni', 450);
assert.equal(ooniBakeRange.min, 1, 'Pizza oven minimum baking time remains unchanged');
assert.equal(ooniBakeRange.max, 1.5, 'Pizza oven maximum baking time remains unchanged');
assert.equal(typeof bakingCalc('ooni').time, 'string', 'Pizza oven baking instructions remain available');
const beginnerKamado = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', oven: 'kamado', ovenTemp: 450 });
assert.equal(beginnerKamado.oven, 'kamado', 'Beginner normalization preserves the separate Kamado selection');
assert.equal(beginnerKamado.ovenTemp, 450, 'Beginner normalization preserves the saved calculator temperature without using it as the Kamado maximum');
assert.doesNotMatch(calculatorUi, /getBakingTimeRange\('kamado'|formatBakingTimeRange\('kamado'/);
assert.match(calculatorUi, /const kamadoProfileForExperience = isBeginner && kamadoProfile\?\.isDefault \? null : kamadoProfile;/, 'Beginner recipes do not inherit the PRO-only default Kamado maximum');
assert.match(calculatorUi, /const bigaHomeRecipePhases = beginnerNeapolitanBigaHome \? \(\(\) => \{[\s\S]*?return oven === 'kamado' \? insertKamadoPreheatPhase\(phases, lang, kamadoProfileForExperience\) : phases;/, 'Beginner Biga Kamado recipe inserts the dedicated preheat phase');
assert.match(calculatorUi, /kamadoProHomeMixerSteps \?\? kamadoProDirectSteps/, 'PRO Kamado direct recipes prioritize the safe phase adaptation');
assert.match(calculatorUi, /<OvenCard cardStyle=\{styles\.ovenCardTwoColumns\} active=\{oven === 'kamado'\}/, 'Kamado is available in the shared Beginner and Pro oven picker');
assert.match(calculatorUi, /<View style=\{\[styles\.ovenRow, !isRomanTeglia && styles\.ovenRowWrap\]\}>/, 'round-pizza ovens use the responsive two-column grid in both modes');
assert.match(calculatorUi, /Roter Kamado-Keramikgrill mit Holztischen\.png/, 'Kamado uses the already-provided image');
assert.equal([...translationsSource.matchAll(/kamado: 'Kamado'/g)].length, 4, 'Kamado is translated in all four supported languages');

assert.doesNotMatch(`${calculatorUi}\n${plannerUi}\n${settingsUi}`, /isPremiumUnlocked|FREE_PIZZA_STYLE|FREE_FLOUR_TYPES|lock-closed|Pizzabook Premium|Otključaj Premium/i);
assert.match(calculatorUi, /\(\['neapolitan', 'romana', 'ny_style'\] as PizzaStyle\[\]\)\.map/);
assert.match(calculatorUi, /\{styleExpanded \? \(\s*<View style=\{styles\.beginnerStylePicker\}>/, 'Beginner and Pro share the three-card pizza-style picker');
assert.match(calculatorUi, /style=\{\[styles\.beginnerStyleCard, active && styles\.beginnerStyleCardActive\]\}/);
assert.match(calculatorUi, /<Image source=\{styleImages\[key\]\} style=\{styles\.beginnerStyleImage\} resizeMode="contain" \/>/);
assert.match(calculatorUi, /testID=\{`style-info-\$\{key\}`\} onPress=\{\(\) => setStyleInfo\(key\)\}/);
assert.match(calculatorUi, /isBeginner && pizzaStyle === 'romana'/, 'Beginner-specific Roman selector stays in Beginner');
assert.match(calculatorUi, /!isBeginner && pizzaStyle === 'romana'/, 'Pro retains its existing Roman format controls');
assert.match(calculatorUi, /\{flourExpanded \? \(\s*<View style=\{\[\{ gap: 6, marginTop: SPACING\.md \}, styles\.beginnerFlourGrid\]\}>/, 'Pro flour options use the same collapsible grid as Beginner');
assert.doesNotMatch(calculatorUi, /flourExpanded \|\| !isBeginner/, 'Pro flour options collapse when closed');
assert.match(calculatorUi, /!flourExpanded \? <Text style=\{styles\.hint\}>\{FLOURS_BY_LANG\[lang\]\.find\(\(entry\) => entry\.key === flour\)\?\.label\}<\/Text>/, 'collapsed flour card shows the selected flour');
assert.match(calculatorUi, /style=\{\[styles\.flourCompact, styles\.beginnerFlourCard, active && styles\.beginnerFlourCardActive\]\}/);
const hrFlourCatalog = calculatorUi.match(/const FLOURS_HR: FlourEntry\[\] = \[([\s\S]*?)\n\];/)?.[1];
assert.ok(hrFlourCatalog, 'Croatian flour catalog is present');
for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom']) {
  assert.match(hrFlourCatalog, new RegExp(`key: '${flour}'`), `Pro flour category ${flour} remains available`);
}
for (const option of ['w', 'protein', 'unknown']) {
  assert.match(calculatorUi, new RegExp(`key: '${option}' as const`), `Pro flour strength option ${option} remains available`);
}
assert.match(calculatorUi, /testID=\{`flour-strength-\$\{option\.key\}`\}/);
assert.match(calculatorUi, /testID=\{`flour-strength-value-\$\{flourStrengthSource\}`\}[\s\S]{0,150}value=\{flourStrengthValue\}/, 'W/protein value remains controlled when the flour panel is collapsed and reopened');
assert.match(calculatorUi, /testID=\{`blendA-\$\{k\}`\}/);
assert.match(calculatorUi, /testID=\{`blendB-\$\{k\}`\}/);
assert.match(calculatorUi, /testID="blendPct-plus"/);
assert.match(calculatorUi, /isBeginner \? toggleBeginnerSection\('flour'\) : setFlourExpanded/);
assert.match(calculatorUi, /testID="pro-quantity-header"[\s\S]{0,260}setQuantityExpanded\(\(expanded\) => !expanded\)/, 'Pro pizza size card can be collapsed independently without Beginner transitions');
assert.match(calculatorUi, /testID="pro-quantity-summary"/, 'closed Pro size card summarizes the selected quantity and dough weight');
assert.match(calculatorUi, /isRomanTeglia\s*\?\s*t\.calc\.trayEquation\s*\.replace\('\{COUNT\}', String\(pizzas\)\)\s*\.replace\('\{PER_TRAY\}', weight\(effectiveBall\)\)\s*\.replace\('\{TOTAL\}', weight\(dough\.totalDough\)\)\s*\.replace\('\{DIMS\}', `\$\{formatLength\(trayWidth, measurementSystem\)\} × \$\{formatLength\(trayLength, measurementSystem\)\}`\)/, 'closed Pro Teglia summary includes count, per-tray mass, total mass, and localized dimensions');
assert.equal([...translationsSource.matchAll(/trayEquation:/g)].length, 4, 'the Pro Teglia quantity summary is localized in all four languages');
assert.match(translationsSource, /trayEquation: '\{COUNT\} pleha × \{PER_TRAY\} po plehu = \{TOTAL\} ukupno · svaki pleh \{DIMS\}'/);
assert.match(translationsSource, /trayEquation: '\{COUNT\} trays × \{PER_TRAY\} per tray = \{TOTAL\} total · each tray \{DIMS\}'/);
assert.match(translationsSource, /trayEquation: '\{COUNT\} Bleche × \{PER_TRAY\} pro Blech = \{TOTAL\} insgesamt · jedes Blech \{DIMS\}'/);
assert.match(translationsSource, /trayEquation: '\{COUNT\} pekači × \{PER_TRAY\} na pekač = \{TOTAL\} skupaj · vsak pekač \{DIMS\}'/);
assert.match(calculatorUi, /:\s*`\$\{pizzas\} × \$\{weight\(effectiveBall\)\}`/, 'closed round-pizza summary includes pizza count and ball weight');
assert.match(calculatorUi, /quantityExpanded \? <>/, 'Pro size controls are hidden only while the size card is closed');
assert.match(calculatorUi, /!methodExpanded \? isBeginner \? \([\s\S]{0,260}<\/Text>\s*\) : \(\s*<Text testID="pro-method-summary"[\s\S]{0,180}\{hydration\}%/, 'closed Pro method card summarizes method and hydration while Beginner keeps its previous summary');
assert.match(calculatorUi, /\.replace\('\{N\} g', weight\(dims\.doughBall\)\)/, 'automatic and manual ball-weight hints replace the complete localized weight placeholder');
assert.doesNotMatch(calculatorUi, /\.replace\('\{N\}g'/, 'ball-weight hint does not use the mismatched placeholder');
assert.match(calculatorUi, /: `5 · \$\{t\.calc\.baking\}`/, 'Pro oven section is numbered before mixing');
assert.match(calculatorUi, /: `7 · \$\{t\.beginnerCalc\.recipeSteps\}`/, 'Pro recipe steps are numbered after the ingredients');
const methodCardIndex = calculatorUi.indexOf('{methodExpanded && !isBeginner ? <>');
const methodOptionsIndex = calculatorUi.indexOf('<View style={styles.pillGroup}>', methodCardIndex);
const mixingOptionsIndex = calculatorUi.indexOf('testID="mix-hand"', methodCardIndex);
const hydrationIndex = calculatorUi.indexOf('<View style={styles.hydRow}>', mixingOptionsIndex);
assert.ok(methodOptionsIndex >= 0 && methodOptionsIndex < mixingOptionsIndex && mixingOptionsIndex < hydrationIndex, 'Pro mixing choice follows Direct/Biga/Poolish and precedes hydration');
const ingredientsCardIndex = calculatorUi.indexOf('{/* 6. INGREDIENTS AND DOUGH TOTAL */}');
const recipeStepsCardIndex = calculatorUi.indexOf('{/* 7. RECIPE STEPS */}');
const actionsCardIndex = calculatorUi.indexOf('{/* 8. ACTIONS */}');
assert.ok(ingredientsCardIndex < recipeStepsCardIndex && recipeStepsCardIndex < actionsCardIndex, 'Pro recipe phases follow ingredients and precede actions');
assert.match(calculatorUi.slice(recipeStepsCardIndex, actionsCardIndex), /testID="mix-toggle"/, 'Show/Hide steps control lives in the recipe steps card');
assert.match(calculatorUi.slice(ingredientsCardIndex, recipeStepsCardIndex), /6 · \{t\.calc\.totalDough\}/, 'ingredient totals use their updated section number');
const proRomanPickerIndex = calculatorUi.indexOf("{styleExpanded && !isBeginner && pizzaStyle === 'romana' ? (");
const flourCardIndex = calculatorUi.indexOf('{/* 2. FLOUR');
assert.ok(proRomanPickerIndex >= 0 && proRomanPickerIndex < flourCardIndex, 'Pro Romana format controls appear beneath the style cards and before the flour card');
const proPizzaSizeSection = calculatorUi.slice(calculatorUi.indexOf('{/* 2. VELIČINA PIZZE */'), calculatorUi.indexOf('testID="ball-input"'));
assert.doesNotMatch(proPizzaSizeSection, /pizzaStyle === 'romana' && !isBeginner/, 'Pro Romana format controls are not duplicated in pizza size');
assert.equal((calculatorUi.match(/testID="romana-tonda"/g) ?? []).length, 2, 'Tonda selector appears once for Beginner and once for Pro');
assert.equal((calculatorUi.match(/testID="romana-teglia"/g) ?? []).length, 2, 'Teglia selector appears once for Beginner and once for Pro');
assert.doesNotMatch(plannerUi, /testID=\{`planner-style-/,
  'Planner no longer exposes a separate pizza-style selector');
assert.doesNotMatch(plannerUi, /testID=\{`planner-method-/,
  'Planner no longer exposes a separate dough-method selector');
assert.doesNotMatch(plannerUi, /onPress=\{\(\) => setStyle\(/,
  'Planner style is not independently editable');
assert.doesNotMatch(plannerUi, /onPress=\{\(\) => setSelectedMethod\(/,
  'Planner dough method is not independently editable');
assert.match(plannerUi, /AsyncStorage\.getItem\('calculatorSettings'\)/,
  'Planner restores saved calculator settings');
assert.match(plannerUi, /sharedCalculatorPlanSettings\.pizzaStyle/,
  'Planner uses the active calculator pizza style');
assert.match(plannerUi, /sharedCalculatorPlanSettings\.method/,
  'Planner uses the active calculator dough method');
for (const method of ['direct', 'biga', 'poolish']) {
  assert.ok(calculatorUi.includes(`k: '${method}'`), `calculator option ${method} is present`);
}
assert.match(calculatorUi, /isProMethodAllowedForFlour\(m\.k, flour, blendA, blendB, blendPctA\)/, 'method options use the shared flour-eligibility rule');
assert.deepEqual(
  ['direct', 'biga', 'poolish'].filter((method) => isProMethodAllowedForFlour(method, 'glutenFree', 'caputo00', 'wholeWheat', 70)),
  ['direct'],
  'pure gluten-free flour exposes only the Direct method',
);
assert.deepEqual(
  ['direct', 'biga', 'poolish'].filter((method) => isProMethodAllowedForFlour(method, 'custom', 'glutenFree', 'caputo00', 70)),
  ['direct', 'biga', 'poolish'],
  'a custom blend containing gluten-containing flour retains all methods',
);
assert.match(calculatorUi, /testID="mix-hand" onPress=\{\(\) => step\(\(\) => \{ setMixing\('hand'\)/);
assert.match(calculatorUi, /testID="mix-mixer" onPress=\{\(\) => step\(\(\) => \{ setMixing\('mixer'\)/);
assert.match(calculatorUi, /testID="mix-toggle"[^>]*onPress=\{\(\) => setShowMixSteps\(!showMixSteps\)\}/, 'Pro exposes the Show/Hide steps control');
assert.match(calculatorUi, /showMixSteps \? t\.calc\.hideSteps : t\.calc\.showSteps/, 'Pro labels the step control Show or Hide');
assert.match(calculatorUi, /showMixSteps \|\| isBeginner/, 'Pro displays detailed steps when requested');
assert.match(calculatorUi, /completed=\{completedSteps\}[\s\S]{0,200}onToggle=\{toggleStep\}[\s\S]{0,180}activeTimers=\{activeTimers\}[\s\S]{0,180}onStartTimer=\{startTimer\}[\s\S]{0,120}onStopTimer=\{stopTimer\}/, 'step completion and active timer state remain wired to each recipe phase');
assert.match(calculatorUi, /stepInfo=\{isBeginner[\s\S]{0,600}: phase\.stepInfo\}/, 'Pro phases reuse existing information while Beginner keeps its existing gates');
assert.match(calculatorUi, /phaseGuide=\{isWorkflowGlutenFree && !isRomanTeglia && index ===/, 'Pro gluten-free phases reuse the existing visual guides');
assert.doesNotMatch(calculatorUi, /phaseGuide=\{isBeginner &&/, 'visual guides are not locked to Beginner mode');
for (const oven of ['homePan', 'homeStone', 'ooni']) {
  assert.ok(calculatorUi.includes(`testID="oven-${oven}"`), `oven option ${oven} remains available`);
}
assert.match(calculatorUi, /if \(isFlourType\(saved\.flour\)\) setFlour\(saved\.flour\)/);
assert.match(calculatorUi, /if \(saved\.pizzaStyle === 'neapolitan' \|\| saved\.pizzaStyle === 'romana' \|\| saved\.pizzaStyle === 'ny_style'\)/);
assert.match(calculatorUi, /localOnly=\{OFFLINE_ONLY_MODE \|\| !user\}/);
assert.match(calculatorUi, /if \(!OFFLINE_ONLY_MODE && !user && isBeginner\) \{ router\.push\('\/login'\); return; \}/);
assert.match(calculatorUi, /setMethod\(isBeginner \|\| settings\.flour === 'glutenFree' \? 'direct' : settings\.method\)/);

const compiled = ts.transpileModule(proRecipesSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const savedItems = new Map();
const asyncStorageMock = {
  getItem: async (key) => savedItems.get(key) ?? null,
  setItem: async (key, value) => { savedItems.set(key, value); },
};
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  exports: moduleRef.exports,
  require: (name) => {
    if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: asyncStorageMock };
    throw new Error(`Unexpected dependency in Pro saved-recipe test: ${name}`);
  },
}, { filename: 'proSavedRecipes.ts' });

async function verifyLocalProRecipes() {
  const api = moduleRef.exports;
  const recipe = { settings: { pizzaStyle: 'romana', flour: 'custom', method: 'poolish', mixing: 'mixer' } };
  const saved = await api.saveProRecipe('  My Romana  ', recipe);
  assert.equal(saved.name, 'My Romana');
  assert.match(saved.recipe_id, /^local_/);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.getProSavedRecipes())), JSON.parse(JSON.stringify([saved])));

  await api.saveProRecipe('Updated Romana', recipe, saved.recipe_id);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await api.getProSavedRecipes())),
    JSON.parse(JSON.stringify([{ ...saved, name: 'Updated Romana' }])),
    'editing a local recipe must update rather than duplicate it',
  );

  await api.saveProRecipe('Neapolitan', { settings: { pizzaStyle: 'neapolitan' } });
  const reopened = await api.getProSavedRecipes();
  assert.equal(reopened.length, 2, 'local Pro recipes must persist across modal/app reopen');
  assert.equal(reopened[0].name, 'Neapolitan');
  await api.deleteProRecipe(saved.recipe_id);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await api.getProSavedRecipes())),
    JSON.parse(JSON.stringify([reopened[0]])),
    'local Pro recipe deletion must persist',
  );
  await assert.rejects(api.saveProRecipe(' ', recipe), /needs a name/);
}

verifyLocalProRecipes().then(() => {
  console.log('Pro options and local saved-recipe access checks passed.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
