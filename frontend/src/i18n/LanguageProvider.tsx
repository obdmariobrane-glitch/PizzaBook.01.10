import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Lang, Translation } from './translations';
import { getCachedTemperatureUnit, subscribeTemperatureUnit, getCachedMeasurementSystem, subscribeMeasurementSystem } from '../preferences';
import { formatUnitText } from '../units';

type Ctx = { lang: Lang; languageLoaded: boolean; setLang: (l: Lang) => void; t: Translation };
const LanguageContext = createContext<Ctx>({ lang: 'hr', languageLoaded: false, setLang: () => {}, t: translations.hr });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('hr');
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';

  useEffect(() => {
    AsyncStorage.getItem('lang').then(v => {
      if (v === 'hr' || v === 'en' || v === 'de' || v === 'sl') setLangState(v);
    }).catch((error) => {
      console.error('Could not load the saved language preference.', error);
    }).finally(() => setLanguageLoaded(true));
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('lang', l);
  };

  const t = useMemo(() => formatTranslationTree(translations[lang], temperatureUnit, measurementSystem) as Translation, [lang, temperatureUnit, measurementSystem]);

  return (
    <LanguageContext.Provider value={{ lang, languageLoaded, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

function formatTranslationTree(value: unknown, temperatureUnit: 'celsius' | 'fahrenheit', measurementSystem: 'metric' | 'us'): unknown {
  if (typeof value === 'string') return formatUnitText(value, temperatureUnit, measurementSystem);
  if (Array.isArray(value)) return value.map((item) => formatTranslationTree(item, temperatureUnit, measurementSystem));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, formatTranslationTree(item, temperatureUnit, measurementSystem)]));
  }
  return value;
}

export const useT = () => useContext(LanguageContext);
