#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected test dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: relativePath });
  return moduleRef.exports;
}

const energy = loadTypeScript('src/energyCost.ts');
const calculator = loadTypeScript('src/costCalculator.ts', { './energyCost': energy });
const localization = loadTypeScript('src/i18n/costCalculator.ts').costCalculatorCopy;
const calculatorScreenSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/index.tsx'),
  'utf8',
);
const profileSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/profile.tsx'),
  'utf8',
);

async function run() {
assert.equal(calculator.parseDecimalInput('8,50'), 8.5);
assert.equal(calculator.parseDecimalInput('8.50'), 8.5);
assert.equal(calculator.parseDecimalInput(',25'), 0.25);
assert.equal(calculator.parseDecimalInput(''), null);
assert.equal(calculator.parseDecimalInput('1,2.3'), null);
assert.equal(calculator.parseDecimalInput('-2'), null);

const energyDefaultState = calculator.createDefaultCostCalculatorState();
assert.deepEqual(JSON.parse(JSON.stringify(energyDefaultState.energy)), {
  countryCode: 'HR',
  energyType: 'electricity',
  unitPrice: null,
  ovenName: '',
  ovenConsumption: null,
});
assert.deepEqual(JSON.parse(JSON.stringify(calculator.calculateEnergyCosts({
  countryCode: 'HR',
  energyType: 'electricity',
  unitPrice: 0.25,
  ovenName: 'Test oven',
  ovenConsumption: 4,
}, 2))), { batchCost: 1, perPizzaCost: 0.5 });
assert.deepEqual(JSON.parse(JSON.stringify(calculator.calculateEnergyCosts({
  countryCode: 'HR',
  energyType: 'lpg',
  unitPrice: 2,
  ovenName: '',
  ovenConsumption: null,
}, 2))), { batchCost: null, perPizzaCost: null });
const legacyEnergyState = { ...energyDefaultState, version: 1 };
delete legacyEnergyState.energy;
assert.equal(calculator.validateCostCalculatorState(legacyEnergyState).energy.countryCode, 'HR');
assert.throws(
  () => calculator.validateCostCalculatorState({ ...energyDefaultState, energy: undefined }),
  /energy settings are missing/,
);
assert.ok(energy.ENERGY_COUNTRIES.length >= 240, 'picker includes all ISO country and region entries');
assert.equal(
  energy.getCountriesForEnergyPicker('en').slice(0, 4).map((country) => country.code).join(','),
  'AT,DE,HR,SI',
);
assert.equal(energy.getEnergyCurrency('HR'), 'EUR');
assert.equal(energy.getEnergyCurrency('US'), 'USD');
assert.equal(energy.getEnergyCurrency('PL'), 'PLN');
assert.equal(energy.getEnergyCurrency('BG'), 'EUR');
assert.equal(energy.getReferenceEnergyPrice('HR', 'electricity'), null, 'do not invent offline reference prices');

const state = calculator.createDefaultCostCalculatorState();
assert.ok(state.ingredients.every((ingredient) => ingredient.purchasePrice === null));
assert.ok(state.ingredients.every((ingredient) => ingredient.packageQuantity === null));
assert.equal(calculator.calculateRecipeCosts(state).perPizzaCost, null);

const seededCatalog = {
  mozzarellaFiorDiLatte: { purchasePrice: 8.5, packageQuantity: 1, packageUnit: 'kg' },
  tomatoSauce: { purchasePrice: 7, packageQuantity: 2.5, packageUnit: 'kg' },
  pizzaBox: { purchasePrice: 35, packageQuantity: 100, packageUnit: 'pieces' },
};
state.ingredients = state.ingredients.map((ingredient) => {
  const purchase = seededCatalog[ingredient.id];
  return purchase ? { ...ingredient, ...purchase } : ingredient;
});
state.recipeItems = [
  { id: 'cheese-per-pizza', ingredientId: 'mozzarellaFiorDiLatte', quantity: 100, unit: 'g' },
  { id: 'sauce-per-pizza', ingredientId: 'tomatoSauce', quantity: 70, unit: 'g' },
  { id: 'box-per-pizza', ingredientId: 'pizzaBox', quantity: 1, unit: 'pieces' },
];
state.batchSize = 3;

const costs = calculator.calculateRecipeCosts(state);
assert.equal(costs.isComplete, true);
assert.ok(Math.abs(costs.itemCosts[0].cost - 0.85) < 1e-12);
assert.ok(Math.abs(costs.itemCosts[1].cost - 0.196) < 1e-12);
assert.ok(Math.abs(costs.itemCosts[2].cost - 0.35) < 1e-12);
assert.ok(Math.abs(costs.perPizzaCost - 1.396) < 1e-12);
assert.ok(Math.abs(costs.batchCost - 4.188) < 1e-12);

const incomplete = calculator.calculateRecipeCosts({
  ...state,
  ingredients: state.ingredients.map((ingredient) =>
    ingredient.id === 'tomatoSauce' ? { ...ingredient, purchasePrice: null, packageQuantity: null } : ingredient),
});
assert.equal(incomplete.isComplete, false);
assert.equal(incomplete.perPizzaCost, null);
assert.equal(incomplete.batchCost, null);
assert.equal(calculator.normalizeUnitQuantity(1.25, 'kg'), 1250);
assert.equal(calculator.normalizeUnitQuantity(2, 'L'), 2000);
assert.deepEqual(Array.from(calculator.compatibleUnits('L')), ['ml', 'L']);
assert.ok(Math.abs(calculator.calculateItemCost(
  { id: 'olive-oil-test', categoryId: 'seasonings', isCustom: false, purchasePrice: 7, packageQuantity: 2.5, packageUnit: 'L' },
  { id: 'oil-per-pizza', ingredientId: 'olive-oil-test', quantity: 100, unit: 'ml' },
) - 0.28) < 1e-12);
assert.equal(calculator.getNormalizedUnitCost({
  id: 'extreme-cost',
  categoryId: 'custom',
  isCustom: true,
  name: 'Extreme',
  purchasePrice: 1e308,
  packageQuantity: 1e-300,
  packageUnit: 'g',
}), null);

const customIngredient = {
  id: 'custom-test',
  categoryId: 'custom',
  isCustom: true,
  name: 'Local cheese',
  purchasePrice: 4.2,
  packageQuantity: 500,
  packageUnit: 'g',
};
const stateWithCustom = {
  ...state,
  ingredients: [...state.ingredients, customIngredient],
  recipeItems: [...state.recipeItems, {
    id: 'custom-per-pizza',
    ingredientId: customIngredient.id,
    quantity: 50,
    unit: 'g',
  }],
};
assert.equal(calculator.validateCostCalculatorState(stateWithCustom).ingredients.at(-1).name, 'Local cheese');
assert.throws(() => calculator.validateCostCalculatorState({
  ...stateWithCustom,
  ingredients: stateWithCustom.ingredients.map((ingredient) =>
    ingredient.id === customIngredient.id ? { ...ingredient, name: ' ' } : ingredient),
}), /invalid fields/);

const imported = calculator.parseProRecipeImport({
  proMode: true,
  settings: { flour: 'caputo00' },
  pizzas: 2,
  flour: 400,
  water: 260,
  salt: 12,
  oil: 5,
  yeast: 2,
  psyllium: 0,
  sauce: 100,
  cheese: 180,
});
assert.ok(imported);
assert.equal(imported.find((item) => item.ingredientId === 'tipo00').quantity, 200);
assert.equal(imported.find((item) => item.ingredientId === 'water').quantity, 130);
assert.equal(calculator.parseProRecipeImport({
  proMode: false,
  settings: { flour: 'caputo00' },
  pizzas: 2,
  flour: 400,
}), null);
assert.equal(calculator.parseProRecipeImport({
  proMode: true,
  settings: { flour: 'caputo00' },
  pizzas: 0,
  flour: 400,
}), null);

const languages = ['hr', 'en', 'de', 'sl'];
const categoryKeys = Object.keys(localization.hr.categories).sort();
for (const language of languages) {
  const copy = localization[language];
  assert.ok(copy.title);
  assert.deepEqual(Object.keys(copy.categories).sort(), categoryKeys);
  assert.deepEqual(
    Object.keys(copy.ingredientNames).sort(),
    Array.from(state.ingredients)
      .filter((ingredient) => !ingredient.isCustom)
      .map((ingredient) => ingredient.id)
      .sort(),
  );
  assert.ok(Object.values(copy.ingredientNames).includes(copy.ingredientNames.pizzaBox));
  assert.ok(copy.ingredientNames.tomatoSauce);
  assert.ok(copy.ingredientNames.mozzarellaFiorDiLatte);
  assert.ok(copy.energyTitle);
  assert.ok(copy.countryCurrencyUnavailable);
  assert.ok(copy.referenceUnavailable);
  assert.ok(copy.priceCountryChangeBody);
}

const actionGroupStart = calculatorScreenSource.indexOf('{/* 8. ACTIONS */}');
const actionGroupEnd = calculatorScreenSource.indexOf('{/* Footer links */}', actionGroupStart);
assert.ok(actionGroupStart >= 0 && actionGroupEnd > actionGroupStart, 'shared calculator action group exists');
const actionGroup = calculatorScreenSource.slice(actionGroupStart, actionGroupEnd);
const actionOrder = [
  'testID="add-shopping"',
  'testID="share-community"',
  'testID="save-recipe"',
  'testID="cost-calculator"',
];
let previousIndex = -1;
for (const marker of actionOrder) {
  const markerIndex = actionGroup.indexOf(marker);
  assert.ok(markerIndex > previousIndex, `${marker} appears in the requested action order`);
  previousIndex = markerIndex;
}
assert.match(actionGroup, /router\.push\('\/cost-calculator'\)/);
assert.match(actionGroup, /costCalculatorCopy\[lang\]\.title/);
assert.doesNotMatch(profileSource, /profile-cost-calculator|costCalculatorEntry|costCalculatorCopy/);
assert.equal(localization.hr.title, 'Kalkulator troška pizze');
assert.equal(localization.de.title, 'Pizzakosten-Rechner');
assert.equal(localization.en.title, 'Pizza Cost Calculator');
assert.equal(localization.sl.title, 'Kalkulator stroška pice');

const memoryStorage = new Map();
const asyncStorageMock = {
  getItem: async (key) => memoryStorage.get(key) ?? null,
  setItem: async (key, value) => { memoryStorage.set(key, value); },
};
const storageModule = loadTypeScript('src/costCalculatorStorage.ts', {
  '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorageMock },
  './costCalculator': calculator,
});
const freshState = await storageModule.loadCostCalculatorState();
assert.equal(freshState.ingredients.length, calculator.DEFAULT_INGREDIENTS.length);
assert.ok(freshState.ingredients.every((ingredient) => ingredient.purchasePrice === null));
const stateWithEnergy = {
  ...stateWithCustom,
  energy: {
    countryCode: 'PL',
    energyType: 'lpg',
    unitPrice: 3.25,
    ovenName: 'Outdoor oven',
    ovenConsumption: 1.4,
  },
};
await storageModule.saveCostCalculatorState(stateWithEnergy);
const roundTrip = await storageModule.loadCostCalculatorState();
assert.equal(roundTrip.batchSize, stateWithEnergy.batchSize);
assert.equal(roundTrip.ingredients.find((ingredient) => ingredient.id === 'custom-test').name, 'Local cheese');
assert.equal(roundTrip.recipeItems.length, stateWithEnergy.recipeItems.length);
assert.deepEqual(JSON.parse(JSON.stringify(roundTrip.energy)), stateWithEnergy.energy);

const withoutOneDefault = calculator.createDefaultCostCalculatorState();
withoutOneDefault.ingredients = withoutOneDefault.ingredients.filter((ingredient) => ingredient.id !== 'salt');
memoryStorage.set(
  calculator.COST_CALCULATOR_STORAGE_KEY,
  JSON.stringify(withoutOneDefault),
);
const restoredDefaults = await storageModule.loadCostCalculatorState();
assert.ok(restoredDefaults.ingredients.some((ingredient) => ingredient.id === 'salt'));
memoryStorage.set(calculator.COST_CALCULATOR_STORAGE_KEY, '{broken json');
await assert.rejects(() => storageModule.loadCostCalculatorState(), /not valid JSON/);

console.log('Pizza cost calculator conversion, costing, persistence-shape, import, and localization checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
