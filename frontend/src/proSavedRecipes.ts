import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProSavedRecipe = {
  recipe_id: string;
  name: string;
  recipe: any;
};

const PRO_SAVED_RECIPES_KEY = 'proSavedRecipes';

function isProSavedRecipe(value: unknown): value is ProSavedRecipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<ProSavedRecipe>;
  return typeof recipe.recipe_id === 'string'
    && typeof recipe.name === 'string'
    && typeof recipe.recipe === 'object'
    && recipe.recipe !== null;
}

export async function getProSavedRecipes(): Promise<ProSavedRecipe[]> {
  const stored = await AsyncStorage.getItem(PRO_SAVED_RECIPES_KEY);
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isProSavedRecipe)) {
    throw new Error('Saved Pro recipes have an invalid format.');
  }
  return parsed;
}

export async function saveProRecipe(
  name: string,
  recipe: unknown,
  recipeId?: string | null,
): Promise<ProSavedRecipe> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('A saved recipe needs a name.');
  if (!recipe || typeof recipe !== 'object') throw new Error('A saved recipe needs valid recipe data.');

  const recipes = await getProSavedRecipes();
  const saved: ProSavedRecipe = {
    recipe_id: recipeId ?? `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    name: normalizedName,
    recipe,
  };
  const existingIndex = recipes.findIndex((item) => item.recipe_id === saved.recipe_id);
  const updated = existingIndex === -1
    ? [saved, ...recipes]
    : recipes.map((item) => item.recipe_id === saved.recipe_id ? saved : item);
  await AsyncStorage.setItem(PRO_SAVED_RECIPES_KEY, JSON.stringify(updated));
  return saved;
}

export async function deleteProRecipe(recipeId: string): Promise<void> {
  const recipes = await getProSavedRecipes();
  await AsyncStorage.setItem(
    PRO_SAVED_RECIPES_KEY,
    JSON.stringify(recipes.filter((recipe) => recipe.recipe_id !== recipeId)),
  );
}
