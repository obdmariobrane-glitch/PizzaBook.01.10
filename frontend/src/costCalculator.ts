import {
  getEnergyCurrency,
  isEnergyCountryCode,
  type EnergyType,
} from './energyCost';

export const COST_CALCULATOR_STORAGE_KEY = 'pizzaCostCalculator.v1';
export const COST_CALCULATOR_STATE_VERSION = 2;

export const COST_CATEGORIES = [
  'flour',
  'sauces',
  'cheese',
  'meat',
  'vegetables',
  'toppings',
  'seasonings',
  'packaging',
  'custom',
] as const;

export type CostCategoryId = (typeof COST_CATEGORIES)[number];
export type CostUnit = 'g' | 'kg' | 'ml' | 'L' | 'pieces';

export const DEFAULT_INGREDIENTS = [
  { id: 'tipo00', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'manitoba', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'wholeWheat', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'glutenFreeFlour', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'speltFlour', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'otherFlour', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'water', categoryId: 'flour', packageUnit: 'L' },
  { id: 'yeast', categoryId: 'flour', packageUnit: 'g' },
  { id: 'salt', categoryId: 'flour', packageUnit: 'kg' },
  { id: 'psyllium', categoryId: 'flour', packageUnit: 'g' },
  { id: 'tomatoSauce', categoryId: 'sauces', packageUnit: 'kg' },
  { id: 'mozzarellaFiorDiLatte', categoryId: 'cheese', packageUnit: 'kg' },
  { id: 'mozzarellaBuffalo', categoryId: 'cheese', packageUnit: 'kg' },
  { id: 'parmesan', categoryId: 'cheese', packageUnit: 'kg' },
  { id: 'prosciuttoCotto', categoryId: 'meat', packageUnit: 'kg' },
  { id: 'prosciuttoCrudo', categoryId: 'meat', packageUnit: 'kg' },
  { id: 'salami', categoryId: 'meat', packageUnit: 'kg' },
  { id: 'mushrooms', categoryId: 'vegetables', packageUnit: 'kg' },
  { id: 'onions', categoryId: 'vegetables', packageUnit: 'kg' },
  { id: 'peppers', categoryId: 'vegetables', packageUnit: 'kg' },
  { id: 'basil', categoryId: 'vegetables', packageUnit: 'g' },
  { id: 'olives', categoryId: 'toppings', packageUnit: 'kg' },
  { id: 'oliveOil', categoryId: 'seasonings', packageUnit: 'L' },
  { id: 'oregano', categoryId: 'seasonings', packageUnit: 'g' },
  { id: 'pizzaBox', categoryId: 'packaging', packageUnit: 'pieces' },
] as const satisfies readonly {
  id: string;
  categoryId: CostCategoryId;
  packageUnit: CostUnit;
}[];

export type DefaultIngredientId = (typeof DEFAULT_INGREDIENTS)[number]['id'];

export type CostIngredient = {
  id: string;
  categoryId: CostCategoryId;
  isCustom: boolean;
  name?: string;
  purchasePrice: number | null;
  packageQuantity: number | null;
  packageUnit: CostUnit;
};

export type CostRecipeItem = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: CostUnit;
};

export type EnergyCostSettings = {
  countryCode: string;
  energyType: EnergyType;
  unitPrice: number | null;
  ovenName: string;
  ovenConsumption: number | null;
};

export type CostCalculatorState = {
  version: typeof COST_CALCULATOR_STATE_VERSION;
  ingredients: CostIngredient[];
  recipeItems: CostRecipeItem[];
  batchSize: number;
  energy: EnergyCostSettings;
};

const VALID_UNITS: readonly CostUnit[] = ['g', 'kg', 'ml', 'L', 'pieces'];
const UNIT_DIMENSIONS: Record<CostUnit, 'weight' | 'volume' | 'count'> = {
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  L: 'volume',
  pieces: 'count',
};

const IMPORT_INGREDIENT_IDS: Record<string, string> = {
  caputo00: 'tipo00',
  manitoba: 'manitoba',
  wholeWheat: 'wholeWheat',
  glutenFree: 'glutenFreeFlour',
  spelt: 'speltFlour',
  custom: 'otherFlour',
};

export function createDefaultCostCalculatorState(): CostCalculatorState {
  return {
    version: COST_CALCULATOR_STATE_VERSION,
    ingredients: DEFAULT_INGREDIENTS.map(({ id, categoryId, packageUnit }) => ({
      id,
      categoryId,
      isCustom: false,
      purchasePrice: null,
      packageQuantity: null,
      packageUnit,
    })),
    recipeItems: [],
    batchSize: 1,
    energy: {
      countryCode: 'HR',
      energyType: 'electricity',
      unitPrice: null,
      ovenName: '',
      ovenConsumption: null,
    },
  };
}

export function calculateEnergyCosts(
  energy: EnergyCostSettings,
  batchSize: number,
): { batchCost: number | null; perPizzaCost: number | null } {
  if (
    energy.unitPrice === null
    || energy.ovenConsumption === null
    || !Number.isFinite(energy.unitPrice)
    || energy.unitPrice < 0
    || !Number.isFinite(energy.ovenConsumption)
    || energy.ovenConsumption <= 0
    || !Number.isInteger(batchSize)
    || batchSize < 1
  ) return { batchCost: null, perPizzaCost: null };
  const batchCost = energy.unitPrice * energy.ovenConsumption;
  if (!Number.isFinite(batchCost)) return { batchCost: null, perPizzaCost: null };
  return { batchCost, perPizzaCost: batchCost / batchSize };
}

export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d*(?:[.,]\d*)?$/.test(trimmed) || !/\d/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function unitDimension(unit: CostUnit): 'weight' | 'volume' | 'count' {
  return UNIT_DIMENSIONS[unit];
}

export function compatibleUnits(unit: CostUnit): CostUnit[] {
  const dimension = unitDimension(unit);
  return VALID_UNITS.filter((candidate) => unitDimension(candidate) === dimension);
}

export function normalizeUnitQuantity(quantity: number, unit: CostUnit): number {
  if (!Number.isFinite(quantity)) return Number.NaN;
  if (unit === 'kg' || unit === 'L') {
    const normalized = quantity * 1000;
    return Number.isFinite(normalized) ? normalized : Number.NaN;
  }
  return quantity;
}

export function getNormalizedUnitCost(ingredient: CostIngredient): number | null {
  const { purchasePrice, packageQuantity, packageUnit } = ingredient;
  if (
    purchasePrice === null
    || packageQuantity === null
    || !Number.isFinite(purchasePrice)
    || purchasePrice < 0
    || !Number.isFinite(packageQuantity)
    || packageQuantity <= 0
  ) return null;
  const normalizedPackageQuantity = normalizeUnitQuantity(packageQuantity, packageUnit);
  if (!Number.isFinite(normalizedPackageQuantity) || normalizedPackageQuantity <= 0) return null;
  const normalizedUnitCost = purchasePrice / normalizedPackageQuantity;
  return Number.isFinite(normalizedUnitCost) ? normalizedUnitCost : null;
}

export function calculateItemCost(
  ingredient: CostIngredient | undefined,
  item: CostRecipeItem,
): number | null {
  if (!ingredient || unitDimension(ingredient.packageUnit) !== unitDimension(item.unit)) return null;
  const unitCost = getNormalizedUnitCost(ingredient);
  if (unitCost === null || !Number.isFinite(item.quantity) || item.quantity <= 0) return null;
  const normalizedQuantity = normalizeUnitQuantity(item.quantity, item.unit);
  const cost = unitCost * normalizedQuantity;
  return Number.isFinite(cost) ? cost : null;
}

export function calculateRecipeCosts(state: CostCalculatorState): {
  itemCosts: { itemId: string; cost: number | null }[];
  perPizzaCost: number | null;
  batchCost: number | null;
  isComplete: boolean;
} {
  const ingredientById = new Map(state.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const itemCosts = state.recipeItems.map((item) => ({
    itemId: item.id,
    cost: calculateItemCost(ingredientById.get(item.ingredientId), item),
  }));
  const subtotal = itemCosts.reduce((total, { cost }) => total + (cost ?? 0), 0);
  const batchSubtotal = subtotal * state.batchSize;
  const isComplete = itemCosts.length > 0
    && itemCosts.every(({ cost }) => cost !== null)
    && Number.isFinite(subtotal)
    && Number.isFinite(batchSubtotal);
  const perPizzaCost = isComplete ? subtotal : null;
  const batchCost = isComplete ? batchSubtotal : null;
  return { itemCosts, perPizzaCost, batchCost, isComplete };
}

export function isCostUnit(value: unknown): value is CostUnit {
  return typeof value === 'string' && VALID_UNITS.includes(value as CostUnit);
}

function isCategoryId(value: unknown): value is CostCategoryId {
  return typeof value === 'string' && COST_CATEGORIES.includes(value as CostCategoryId);
}

export function validateCostCalculatorState(value: unknown): CostCalculatorState {
  if (!value || typeof value !== 'object') throw new Error('Saved cost calculator data is not an object.');
  const candidate = value as {
    version?: unknown;
  } & Omit<Partial<CostCalculatorState>, 'version'>;
  if (
    (candidate.version !== 1 && candidate.version !== COST_CALCULATOR_STATE_VERSION)
    || !Array.isArray(candidate.ingredients)
    || !Array.isArray(candidate.recipeItems)
    || typeof candidate.batchSize !== 'number'
    || !Number.isInteger(candidate.batchSize)
    || candidate.batchSize < 1
    || candidate.batchSize > 9999
  ) throw new Error('Saved cost calculator data has an unsupported format.');

  const ingredients = candidate.ingredients.map((value): CostIngredient => {
    if (!value || typeof value !== 'object') throw new Error('A saved ingredient is invalid.');
    const ingredient = value as Partial<CostIngredient>;
    if (
      typeof ingredient.id !== 'string'
      || !isCategoryId(ingredient.categoryId)
      || typeof ingredient.isCustom !== 'boolean'
      || !isCostUnit(ingredient.packageUnit)
      || (ingredient.purchasePrice !== null
        && (typeof ingredient.purchasePrice !== 'number'
          || !Number.isFinite(ingredient.purchasePrice)
          || ingredient.purchasePrice < 0))
      || (ingredient.packageQuantity !== null
        && (typeof ingredient.packageQuantity !== 'number'
          || !Number.isFinite(ingredient.packageQuantity)
          || ingredient.packageQuantity <= 0))
      || (ingredient.isCustom && (typeof ingredient.name !== 'string' || !ingredient.name.trim()))
      || (!ingredient.isCustom && ingredient.name !== undefined)
      || (ingredient.purchasePrice === null) !== (ingredient.packageQuantity === null)
    ) throw new Error('A saved ingredient has invalid fields.');
    const defaultIngredient = DEFAULT_INGREDIENTS.find(({ id }) => id === ingredient.id);
    if (
      (ingredient.isCustom && ingredient.categoryId !== 'custom')
      || (!ingredient.isCustom
        && (!defaultIngredient || ingredient.categoryId !== defaultIngredient.categoryId))
    ) throw new Error('A saved ingredient has an invalid catalog identity.');
    return ingredient as CostIngredient;
  });
  if (new Set(ingredients.map(({ id }) => id)).size !== ingredients.length) {
    throw new Error('Saved ingredients contain duplicate IDs.');
  }

  const recipeItems = candidate.recipeItems.map((value): CostRecipeItem => {
    if (!value || typeof value !== 'object') throw new Error('A saved recipe ingredient is invalid.');
    const item = value as Partial<CostRecipeItem>;
    if (
      typeof item.id !== 'string'
      || typeof item.ingredientId !== 'string'
      || !isCostUnit(item.unit)
      || typeof item.quantity !== 'number'
      || !Number.isFinite(item.quantity)
      || item.quantity < 0
    ) throw new Error('A saved recipe ingredient has invalid fields.');
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    if (!ingredient || unitDimension(ingredient.packageUnit) !== unitDimension(item.unit)) {
      throw new Error('A saved recipe ingredient has an incompatible unit.');
    }
    return {
      id: item.id,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
    };
  });
  if (new Set(recipeItems.map(({ id }) => id)).size !== recipeItems.length) {
    throw new Error('Saved recipe ingredients contain duplicate IDs.');
  }

  const rawEnergy = candidate.energy;
  if (rawEnergy === undefined && candidate.version !== 1) {
    throw new Error('Saved energy settings are missing.');
  }
  const energy = rawEnergy === undefined
    ? createDefaultCostCalculatorState().energy
    : (() => {
      if (!rawEnergy || typeof rawEnergy !== 'object') {
        throw new Error('Saved energy settings are invalid.');
      }
      const settings = rawEnergy as Partial<EnergyCostSettings>;
      if (
        !isEnergyCountryCode(settings.countryCode)
        || !['electricity', 'naturalGas', 'lpg'].includes(settings.energyType ?? '')
        || (settings.unitPrice !== null
          && (typeof settings.unitPrice !== 'number'
            || !Number.isFinite(settings.unitPrice)
            || settings.unitPrice < 0))
        || (settings.ovenConsumption !== null
          && (typeof settings.ovenConsumption !== 'number'
            || !Number.isFinite(settings.ovenConsumption)
            || settings.ovenConsumption <= 0))
        || typeof settings.ovenName !== 'string'
        || settings.ovenName.length > 100
      ) throw new Error('Saved energy settings have invalid fields.');
      return {
        countryCode: settings.countryCode,
        energyType: settings.energyType as EnergyType,
        unitPrice: settings.unitPrice ?? null,
        ovenName: settings.ovenName,
        ovenConsumption: settings.ovenConsumption ?? null,
      };
    })();
  if (!getEnergyCurrency(energy.countryCode) && energy.unitPrice !== null) {
    throw new Error('Saved energy price has no known local currency.');
  }

  return {
    version: COST_CALCULATOR_STATE_VERSION,
    ingredients,
    recipeItems,
    batchSize: candidate.batchSize,
    energy,
  };
}

export function parseProRecipeImport(value: unknown): CostRecipeItem[] | null {
  if (!value || typeof value !== 'object') return null;
  const recipe = value as Record<string, unknown>;
  if (recipe.proMode !== true || !recipe.settings || typeof recipe.settings !== 'object') return null;
  const settings = recipe.settings as Record<string, unknown>;
  const flourId = typeof settings.flour === 'string' ? IMPORT_INGREDIENT_IDS[settings.flour] : undefined;
  const pizzas = recipe.pizzas;
  if (!flourId || typeof pizzas !== 'number' || !Number.isInteger(pizzas) || pizzas < 1) return null;

  const fields: [string, string, CostUnit][] = [
    [flourId, 'flour', 'g'],
    ['water', 'water', 'ml'],
    ['salt', 'salt', 'g'],
    ['oliveOil', 'oil', 'ml'],
    ['yeast', 'yeast', 'g'],
    ['psyllium', 'psyllium', 'g'],
    ['tomatoSauce', 'sauce', 'g'],
    ['mozzarellaFiorDiLatte', 'cheese', 'g'],
  ];
  const result: CostRecipeItem[] = [];
  for (const [ingredientId, field, unit] of fields) {
    const amount = recipe[field];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) continue;
    if (amount === 0) continue;
    result.push({
      id: `import-${ingredientId}`,
      ingredientId,
      quantity: amount / pizzas,
      unit,
    });
  }
  return result.some(({ ingredientId }) => ingredientId === flourId) ? result : null;
}
