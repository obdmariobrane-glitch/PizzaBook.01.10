// Centralized display-only unit conversions. Internal calculations always stay in Celsius/grams —
// these helpers only convert values for presentation or normalize user input back to the base unit.
import type { TemperatureUnit, MeasurementSystem } from './preferences';

const GRAMS_PER_OUNCE = 28.3495;
const GRAMS_PER_POUND = 453.592;
const CM_PER_INCH = 2.54;

export function celsiusToFahrenheit(celsius: number): number {
  return celsius * 9 / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5 / 9;
}

// Round-trip helper for numeric temperature display (e.g. stepper values), always whole degrees.
export function displayTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? Math.round(celsiusToFahrenheit(celsius)) : Math.round(celsius);
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  if (unit === 'celsius') return `${Math.round(celsius * 10) / 10}°C`;
  const fahrenheit = Math.round(celsiusToFahrenheit(celsius) * 10) / 10;
  return `${Number.isInteger(fahrenheit) ? fahrenheit : fahrenheit.toFixed(1)}°F`;
}

// Convert a user-entered temperature (in the display unit) back to Celsius for the calculation engine.
export function temperatureInputToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? fahrenheitToCelsius(value) : value;
}

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}

export function gramsToPounds(grams: number): number {
  return grams / GRAMS_PER_POUND;
}

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OUNCE;
}

export function poundsToGrams(pounds: number): number {
  return pounds * GRAMS_PER_POUND;
}

// `precise` keeps small precision-sensitive ingredients (yeast, salt) in grams even in US mode.
export function formatWeight(grams: number, system: MeasurementSystem, precise = false): string {
  if (system === 'metric' || precise) {
    const rounded = Number.isInteger(grams) ? grams : Math.round(grams * 100) / 100;
    return `${rounded} g`;
  }
  if (grams >= GRAMS_PER_POUND) {
    return `${Math.round(gramsToPounds(grams) * 100) / 100} lb`;
  }
  return `${Math.round(gramsToOunces(grams) * 10) / 10} oz`;
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

function formatInches(cm: number): string {
  return String(Math.round(cmToInches(cm) * 10) / 10);
}

export function formatLength(cm: number, system: MeasurementSystem): string {
  return system === 'us' ? `${formatInches(cm)} in` : `${cm} cm`;
}

// Convert a user-entered weight (in the display unit) back to grams for the calculation engine.
export function weightInputToGrams(value: number, unit: 'g' | 'oz' | 'lb'): number {
  if (unit === 'oz') return ouncesToGrams(value);
  if (unit === 'lb') return poundsToGrams(value);
  return value;
}

// Format only explicit numeric unit tokens in localized recipe prose; sentence text and grammar stay intact.
export function formatUnitText(text: string, temperatureUnit: TemperatureUnit, system: MeasurementSystem): string {
  const withTemperatureValues = text.replace(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*°C/g, (_, first: string, second?: string) => {
    const start = formatTemperature(Number(first.replace(',', '.')), temperatureUnit);
    if (!second) return start;
    const end = formatTemperature(Number(second.replace(',', '.')), temperatureUnit);
    return `${start}–${end}`;
  });
  const withTemperatureLabels = temperatureUnit === 'fahrenheit'
    ? withTemperatureValues.replace(/°C/g, '°F')
    : withTemperatureValues;
  if (system === 'metric') return withTemperatureLabels;

  const withLengths = withTemperatureLabels.replace(/(\d+(?:[.,]\d+)?)(?:\s*([–×x-])\s*(\d+(?:[.,]\d+)?))?\s*cm\b/g, (_, first: string, separator?: string, second?: string) => {
    const start = formatInches(Number(first.replace(',', '.')));
    if (!second) return `${start} in`;
    return `${start}${separator === '–' || separator === '-' ? '–' : ' × '}${formatInches(Number(second.replace(',', '.')))} in`;
  });

  const withWeights = withLengths.replace(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*g\b/g, (token, first: string, second: string | undefined, offset: number, source: string) => {
    const start = Math.max(0, offset - 80);
    const end = Math.min(source.length, offset + token.length + 80);
    const context = source.slice(start, end).toLowerCase();
    const amountOffset = offset - start;
    const ingredientKeywords = [
      { kind: 'precision', pattern: /yeast|hefe|kvas|salt|salz|soli?\b/g },
      { kind: 'regular', pattern: /water|wasser|vod[aeiou]|flour|mehl|mok[aeu]|oil|öl|olje/g },
    ];
    const ingredients = ingredientKeywords.flatMap(({ kind, pattern }) =>
      [...context.matchAll(pattern)].map((match) => ({
        kind,
        index: match.index ?? 0,
        distance: Math.min(
          Math.abs((match.index ?? 0) - amountOffset),
          Math.abs((match.index ?? 0) + match[0].length - amountOffset),
        ),
      })),
    );
    const followingIngredient = ingredients
      .filter((ingredient) => ingredient.index >= amountOffset + token.length
        && !/[,;:\n]/.test(context.slice(amountOffset + token.length, ingredient.index)))
      .sort((a, b) => a.distance - b.distance)[0];
    const nearestIngredient = followingIngredient ?? ingredients.sort((a, b) => a.distance - b.distance)[0];
    const formatAmount = (amount: string) => {
      const grams = Number(amount.replace(',', '.'));
      const precisionSensitive = grams < 10 || nearestIngredient?.kind === 'precision';
      return precisionSensitive ? `${amount} g` : formatWeight(grams, system);
    };
    return second ? `${formatAmount(first)}–${formatAmount(second)}` : formatAmount(first);
  });
  return withWeights.replace(/\(g\)/g, '(oz)');
}
