const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(frontendRoot, file), 'utf8');
const storageKey = 'proSavedRecipes';
const values = new Map();
const asyncStorage = {
  async getItem(key) { return values.get(key) ?? null; },
  async setItem(key, value) { values.set(key, value); },
};

function loadRecipeStorageModule() {
  const source = read('src/proSavedRecipes.ts');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const mockRequire = (specifier) => {
    assert.equal(specifier, '@react-native-async-storage/async-storage');
    return { __esModule: true, default: asyncStorage };
  };
  new Function('require', 'module', 'exports', compiled)(mockRequire, module, module.exports);
  return module.exports;
}

async function verifyLocalCrudAndRestart() {
  const preexistingPro = {
    recipe_id: 'local_legacy_pro',
    name: 'Existing PRO recipe',
    recipe: { proMode: true, settings: { pizzaStyle: 'neapolitan', method: 'direct' } },
  };
  const legacyWithoutMode = {
    recipe_id: 'local_legacy_without_mode',
    name: 'Older PRO recipe',
    recipe: { settings: { pizzaStyle: 'romana', romanFormat: 'tonda' } },
  };
  const originalSerialized = JSON.stringify([preexistingPro, legacyWithoutMode]);
  values.set(storageKey, originalSerialized);

  let recipes = loadRecipeStorageModule();
  assert.deepEqual(await recipes.getSavedRecipes('beginner'), []);
  assert.deepEqual(await recipes.getProSavedRecipes(), [preexistingPro, legacyWithoutMode]);
  assert.equal(values.get(storageKey), originalSerialized, 'reading existing recipes must not rewrite stored data');

  const beginnerRecipe = {
    settings: { pizzaStyle: 'new_york', flour: 'glutenFree', method: 'direct' },
    proMode: false,
    pizzas: 2,
    hydration: 65,
  };
  const beginnerSaved = await recipes.saveLocalRecipe('Beginner recipe', beginnerRecipe);
  assert.equal(beginnerSaved.recipe.proMode, false);
  assert.deepEqual(await recipes.getSavedRecipes('beginner'), [beginnerSaved]);
  assert.deepEqual(await recipes.getProSavedRecipes(), [preexistingPro, legacyWithoutMode]);

  const updatedBeginner = await recipes.saveLocalRecipe(
    'Updated Beginner recipe',
    { ...beginnerRecipe, hydration: 68 },
    beginnerSaved.recipe_id,
  );
  assert.equal(updatedBeginner.recipe.hydration, 68);
  assert.equal((await recipes.getSavedRecipes('beginner')).length, 1, 'editing must update, not duplicate, the local record');

  await assert.rejects(
    recipes.saveLocalRecipe('Wrong mode', { proMode: true }, beginnerSaved.recipe_id),
    /cannot be moved between experience modes/,
  );

  recipes = loadRecipeStorageModule();
  assert.deepEqual(await recipes.getSavedRecipes('beginner'), [updatedBeginner], 'saved data must survive a simulated module/app restart');
  assert.deepEqual(await recipes.getProSavedRecipes(), [preexistingPro, legacyWithoutMode]);

  await recipes.deleteProRecipe(updatedBeginner.recipe_id);
  assert.deepEqual(await recipes.getSavedRecipes('beginner'), []);
  assert.deepEqual(await recipes.getProSavedRecipes(), [preexistingPro, legacyWithoutMode], 'deleting one recipe must preserve other modes and legacy data');

  await recipes.deleteProRecipe(preexistingPro.recipe_id);
  assert.deepEqual(await recipes.getProSavedRecipes(), [legacyWithoutMode]);
}

function verifyOfflineUiRouting() {
  const source = read('app/(tabs)/index.tsx');
  assert.match(read('src/offlineMode.ts'), /export const OFFLINE_ONLY_MODE = true;/);
  assert.match(source, /const saved = OFFLINE_ONLY_MODE \|\| !user\s*\?\s*await saveLocalRecipe\(name, recipe, recipeId\)/);
  assert.match(source, /if \(!OFFLINE_ONLY_MODE && !user && isBeginner\) \{ router\.push\('\/login'\); return; \}/);
  assert.match(source, /localOnly=\{OFFLINE_ONLY_MODE \|\| !user\}/);
  assert.match(source, /localOnly \? getSavedRecipes\(recipeMode\) : api\('\/api\/recipes'\)/);
  assert.match(source, /if \(localOnly\) await deleteProRecipe\(recipeId\);\s*else await api\(`\/api\/recipes\/\$\{recipeId\}`/);
  assert.match(source, /onLoad=\{\(saved\) => \{\s*applyRecipe\(saved\.recipe\)/);
  assert.match(source, /Alert\.alert\(t\.calc\.deleteRecipe, recipe\.name, \[\s*\{ text: t\.common\.cancel, style: 'cancel' \},\s*\{ text: t\.calc\.deleteRecipe, style: 'destructive'/);
}

verifyOfflineUiRouting();
verifyLocalCrudAndRestart()
  .then(() => console.log('Local saved recipe CRUD, mode isolation, legacy preservation, simulated restart, and offline UI routing checks passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
