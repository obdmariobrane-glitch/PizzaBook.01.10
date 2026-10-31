export type KamadoOvenProfile = {
  maximumTemperatureC: number;
  bakingTemperatureC?: number;
  isDefault?: boolean;
};

export type KamadoPizzaStyle = 'neapolitan' | 'romanaTonda' | 'newYork' | 'romanaTeglia';

export type KamadoBakeTimeRange = {
  min: number;
  max: number;
};

export const KAMADO_MAXIMUM_TEMPERATURE_C = 400;

const KAMADO_BAKE_TIME_RANGES: readonly {
  minTemperatureC: number;
  maxTemperatureC: number;
  minMinutes: number;
  maxMinutes: number;
}[] = [
  { minTemperatureC: 220, maxTemperatureC: 249, minMinutes: 12, maxMinutes: 18 },
  { minTemperatureC: 250, maxTemperatureC: 279, minMinutes: 10, maxMinutes: 14 },
  { minTemperatureC: 280, maxTemperatureC: 299, minMinutes: 8, maxMinutes: 10 },
  { minTemperatureC: 300, maxTemperatureC: 329, minMinutes: 4, maxMinutes: 7 },
  { minTemperatureC: 330, maxTemperatureC: 359, minMinutes: 3, maxMinutes: 5 },
  { minTemperatureC: 360, maxTemperatureC: 400, minMinutes: 2, maxMinutes: 4 },
];

const KAMADO_STYLE_ADDITIONAL_MINUTES: Record<KamadoPizzaStyle, number> = {
  neapolitan: 0,
  romanaTonda: 2,
  newYork: 2,
  romanaTeglia: 4,
};

export const DEFAULT_KAMADO_OVEN_PROFILE: KamadoOvenProfile = {
  maximumTemperatureC: KAMADO_MAXIMUM_TEMPERATURE_C,
  isDefault: true,
};

export function normalizeKamadoProOvenProfile(profile: KamadoOvenProfile): KamadoOvenProfile {
  return {
    ...profile,
    maximumTemperatureC: KAMADO_MAXIMUM_TEMPERATURE_C,
  };
}

export function isKamadoBakingTemperatureAllowed(
  temperatureC: number | null,
  maximumTemperatureC: number | null,
): boolean {
  return temperatureC !== null
    && maximumTemperatureC !== null
    && Number.isFinite(temperatureC)
    && Number.isFinite(maximumTemperatureC)
    && temperatureC > 0
    && maximumTemperatureC > 0
    && temperatureC <= maximumTemperatureC;
}

export function sanitizeKamadoTemperatureInput(value: string): string {
  const numericCharacters = value.replace(',', '.').replace(/[^\d.]/g, '');
  const decimalIndex = numericCharacters.indexOf('.');
  if (decimalIndex < 0) return numericCharacters;
  const whole = numericCharacters.slice(0, decimalIndex).replace(/\./g, '');
  const fraction = numericCharacters.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 1);
  return `${whole}.${fraction}`;
}

export function getKamadoBakeTimeRange(
  temperatureC: number,
  style: KamadoPizzaStyle,
): KamadoBakeTimeRange | null {
  if (!Number.isFinite(temperatureC) || !Object.prototype.hasOwnProperty.call(KAMADO_STYLE_ADDITIONAL_MINUTES, style)) return null;
  if (temperatureC < 220 || temperatureC > 400) return null;
  const range = KAMADO_BAKE_TIME_RANGES.find(
    ({ minTemperatureC, maxTemperatureC }) => temperatureC >= minTemperatureC && temperatureC < maxTemperatureC + 1,
  );
  if (!range) return null;
  const styleAdjustment = KAMADO_STYLE_ADDITIONAL_MINUTES[style];
  return {
    min: range.minMinutes + styleAdjustment,
    max: range.maxMinutes + styleAdjustment,
  };
}

export function formatKamadoBakeTimeRange(range: KamadoBakeTimeRange, lang: 'hr' | 'en' | 'de' | 'sl'): string {
  const minutes = ({ hr: 'min', en: 'min', de: 'Min.', sl: 'min' })[lang];
  return `${range.min}–${range.max} ${minutes}`;
}

export function formatKamadoBakeTimeRecommendation(
  temperatureC: number | null,
  style: KamadoPizzaStyle,
  maximumTemperatureC: number | null,
  lang: 'hr' | 'en' | 'de' | 'sl',
): string {
  const messages = {
    hr: {
      label: 'Preporučeno vrijeme pečenja',
      invalid: 'Unesite valjanu pozitivnu temperaturu pečenja.',
      missingMaximum: 'Maksimalna temperatura Kamada nije dostupna.',
      exceedsMaximum: 'Temperatura prelazi maksimalnu dopuštenu temperaturu Kamada.',
      unavailable: 'Preporuka je dostupna samo za temperature od 220 do 400 °C.',
    },
    en: {
      label: 'Recommended baking time',
      invalid: 'Enter a valid positive baking temperature.',
      missingMaximum: 'The Kamado maximum temperature is unavailable.',
      exceedsMaximum: 'The temperature exceeds the Kamado maximum.',
      unavailable: 'A recommendation is available only from 220 to 400 °C.',
    },
    de: {
      label: 'Empfohlene Backzeit',
      invalid: 'Geben Sie eine gültige positive Backtemperatur ein.',
      missingMaximum: 'Die Kamado-Maximaltemperatur ist nicht verfügbar.',
      exceedsMaximum: 'Die Temperatur überschreitet das Kamado-Maximum.',
      unavailable: 'Eine Empfehlung ist nur für Temperaturen von 220 bis 400 °C verfügbar.',
    },
    sl: {
      label: 'Priporočen čas peke',
      invalid: 'Vnesite veljavno pozitivno temperaturo peke.',
      missingMaximum: 'Najvišja temperatura Kamada ni na voljo.',
      exceedsMaximum: 'Temperatura presega najvišjo dovoljeno temperaturo Kamada.',
      unavailable: 'Priporočilo je na voljo samo pri temperaturah od 220 do 400 °C.',
    },
  }[lang];

  if (temperatureC === null || !Number.isFinite(temperatureC) || temperatureC <= 0) return messages.invalid;
  if (maximumTemperatureC === null || !Number.isFinite(maximumTemperatureC) || maximumTemperatureC <= 0) return messages.missingMaximum;
  if (temperatureC > maximumTemperatureC) return messages.exceedsMaximum;
  const range = getKamadoBakeTimeRange(temperatureC, style);
  return range
    ? `${messages.label}: ${formatKamadoBakeTimeRange(range, lang)}`
    : messages.unavailable;
}

export function insertKamadoPhaseOnce<T>(
  phases: readonly T[],
  phase: T,
  isKamadoPreheatPhase: (candidate: T) => boolean,
): T[] {
  const withoutExistingKamadoPreheat = phases.filter((candidate) => !isKamadoPreheatPhase(candidate));
  if (withoutExistingKamadoPreheat.length === 0) return [phase];
  const finalPhaseIndex = withoutExistingKamadoPreheat.length - 1;
  return [
    ...withoutExistingKamadoPreheat.slice(0, finalPhaseIndex),
    phase,
    withoutExistingKamadoPreheat[finalPhaseIndex],
  ];
}

export function parseKamadoOvenProfile(value: unknown): KamadoOvenProfile | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const maximumTemperatureC = candidate.maximumTemperatureC ?? candidate.maxTemperatureC;
  const bakingTemperatureC = candidate.bakingTemperatureC;
  if (
    typeof maximumTemperatureC === 'number'
    && Number.isFinite(maximumTemperatureC)
    && maximumTemperatureC > 0
    && (bakingTemperatureC === undefined
    || (typeof bakingTemperatureC === 'number'
      && Number.isFinite(bakingTemperatureC)
      && bakingTemperatureC > 0
      && bakingTemperatureC <= maximumTemperatureC))
  ) {
    return {
      maximumTemperatureC,
      ...(typeof bakingTemperatureC === 'number' ? { bakingTemperatureC } : {}),
      ...(candidate.isDefault === true ? { isDefault: true } : {}),
    };
  }
  return null;
}
