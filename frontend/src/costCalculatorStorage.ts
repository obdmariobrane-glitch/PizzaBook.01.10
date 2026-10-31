import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COST_CALCULATOR_STORAGE_KEY,
  createDefaultCostCalculatorState,
  validateCostCalculatorState,
  type CostCalculatorState,
} from './costCalculator';

export async function loadCostCalculatorState(): Promise<CostCalculatorState> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(COST_CALCULATOR_STORAGE_KEY);
  } catch (error) {
    console.error('Unable to load saved pizza cost calculator data.', error);
    throw new Error('Unable to load saved pizza cost calculator data.', { cause: error });
  }
  if (raw === null) return createDefaultCostCalculatorState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error('Saved pizza cost calculator data is not valid JSON.', error);
    throw new Error('Saved pizza cost calculator data is not valid JSON.', { cause: error });
  }
  const validated = validateCostCalculatorState(parsed);
  const savedIngredients = new Map(validated.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const defaults = createDefaultCostCalculatorState();
  const ingredients = [
    ...defaults.ingredients.map((ingredient) => savedIngredients.get(ingredient.id) ?? ingredient),
    ...validated.ingredients.filter((ingredient) => ingredient.isCustom),
  ];
  return { ...validated, ingredients };
}

export async function saveCostCalculatorState(state: CostCalculatorState): Promise<void> {
  const validated = validateCostCalculatorState(state);
  const serialized = JSON.stringify(validated);
  try {
    await AsyncStorage.setItem(COST_CALCULATOR_STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Unable to save pizza cost calculator data.', error);
    throw new Error('Unable to save pizza cost calculator data.', { cause: error });
  }
}
