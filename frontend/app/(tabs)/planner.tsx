import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useT } from '../../src/i18n/LanguageProvider';
import type { Lang } from '../../src/i18n/translations';
import { getCachedExperienceLevel, subscribeExperienceLevel } from '../../src/experienceLevel';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedTemperatureUnit, subscribeTemperatureUnit, getCachedMeasurementSystem, subscribeMeasurementSystem } from '../../src/preferences';
import { formatTemperature, formatUnitText } from '../../src/units';
import { getCachedPreferredYeastType, subscribePreferredYeastType } from '../../src/preferences';
import { getPlannerNotificationRestoreStatus, shouldReconcilePlannerNotifications, subscribePlannerNotificationRestoreStatus } from '../../src/beginnerPlanRestoreCoordinator';
import {
  getDirectHomeFermentationSchedule, getFermentationSchedule, getSpongeFermentationSchedule, getPlannerRoomAfterFridgeHours, getBakingTimeRange, reversePlan, selectPlannerHomeSchedules, Method, PizzaStyle, PoolishFermentationMode, restorePoolishPhaseSettings, getPoolishPlannerFallbackSchedule,
  getPoolishFinalMixDurationMinutes,
  OvenType, PlannerTegliaSettings,
  SPONGE_YEAST_REFERENCE,
  BEGINNER_DIRECT_MIN_WINDOW_HOURS,
  getBeginnerPreheatMinutes,
  getSharedCalculatorPlanSettings, subscribeSharedCalculatorPlanSettings,
  parseMixingSelection, toCalculatorMixing,
  getSharedHomeBakeAt, setSharedHomeBakeAt, subscribeSharedHomeBakeAt,
  getSharedHomeDirectSchedule, subscribeSharedHomeDirectSchedule,
  getSharedHomeDirectScheduleMode,
  getSharedHomeBigaSchedule, subscribeSharedHomeBigaSchedule,
  getSharedHomePoolishSchedule, subscribeSharedHomePoolishSchedule,
  isValidProTrayDimension,
  isEffectivelyGlutenFreeBlend,
  FlourType,
  CalculatorYeastSummary,
} from '../../src/calculator';
import { cancelLocal, cancelObsoletePlannerNotifications, cancelPlannerNotificationsForMethods, cancelPlannerNotificationsForMethodsExcept, cancelPlannerNotificationsForPlan, isPushSupported, requestNotificationPermissions, scheduleNotificationBatch, scheduleLocal } from '../../src/notifications';
import { getSpiralPlannerNote } from '../../src/i18n/spiralMixing';
import { YEAST_SETTINGS_COPY } from '../../src/i18n/yeastSettings';
import { formatDuration } from '../../src/i18n/prefermentSteps';
import { addProNapolitanaDirectInitialPlannerSteps } from '../../src/proNapolitanaDirectPlanner';
import {
  alignProNapolitanaSpongePlannerSteps,
  alignProSpongeBallingBeforeFridge,
  buildProNapolitanaFermentationSchedule,
  buildProNapolitanaInitialPlannerEvents,
  buildProTegliaSpongePlannerEvents,
  getProNapolitanaInitialIntervals,
  getProNapolitanaPlannerWindow,
  ensureProTargetBakeEvent,
  resolveProNapolitanaFinalRestHours,
} from '../../src/proNapolitanaPlanner';
import { getProKamadoBigaMixDurationMinutes, buildProKamadoPlannerSteps, buildProKamadoPrefermentBranchSteps } from '../../src/proKamadoPlanner';
import {
  applyPlannerPhaseOverrides,
  assignPlannerPhaseKeys,
  getPlannerPhaseOverridesStorageKey,
  parsePlannerPhaseOverrides,
  parseProPlannerBakeTarget,
  PRO_PLANNER_BAKE_TARGET_STORAGE_KEY,
  PlannerPhaseStep,
  PlannerPhaseOverrides,
  retainCurrentPlannerPhaseOverrides,
} from '../../src/plannerPhaseOverrides';

function fmt(d: Date, lang: string) {
  const locale = lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'en-GB';
  const day = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function fmtPlanDate(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'en-GB', { dateStyle: 'medium' }).format(d);
}

function fmtPlanTime(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'en-GB', { timeStyle: 'short' }).format(d);
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatLocalDateTimeInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTimeInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    ? date
    : null;
}

type CalculatorPlanSettings = {
  oven?: OvenType;
  ovenTemp?: number;
  roomTemp: number;
  roomHours: number;
  fridgeTemp: number;
  fridgeHours: number;
  bigaHours: number;
  bigaStartHours: number;
  bigaPct: number;
  bigaHydrationPct: number;
  poolishHours: number;
  poolishStartHours: number;
  poolishPct: number;
  poolishHydrationPct: number;
  poolishFermentationTempC: number;
  poolishFermentationMode: PoolishFermentationMode | null;
  poolishRtHours: number;
  poolishCtHours: number;
  poolishRtTemperatureC: number;
  poolishCtTemperatureC: number;
  spongeFlourPct: number;
  spongeHydrationPct: number;
  spongeFermentationTempC: number;
  spongeFermentationHours: number;
  spongePreparationByLanguage: Record<Lang, { title: string; steps: string[] }> | null;
  yeastSummary: CalculatorYeastSummary | null;
};
type NumericCalculatorPlanSetting = Exclude<keyof CalculatorPlanSettings, 'oven' | 'ovenTemp' | 'poolishFermentationMode' | 'spongePreparationByLanguage' | 'yeastSummary' | 'bigaFermentationSchedule' | 'poolishFermentationSchedule'>;

const DEFAULT_CALCULATOR_PLAN_SETTINGS: CalculatorPlanSettings = {
  roomTemp: 22,
  roomHours: 2,
  fridgeTemp: 4,
  fridgeHours: 24,
  bigaHours: 24,
  bigaStartHours: 0,
  bigaPct: 50,
  bigaHydrationPct: 62,
  poolishHours: 24,
  poolishStartHours: 0,
  poolishPct: 35,
  poolishHydrationPct: 100,
  poolishFermentationTempC: 22,
  poolishFermentationMode: null,
  poolishRtHours: 24,
  poolishCtHours: 24,
  poolishRtTemperatureC: 22,
  poolishCtTemperatureC: 4,
  spongeFlourPct: SPONGE_YEAST_REFERENCE.flourShare,
  spongeHydrationPct: 62,
  spongeFermentationTempC: SPONGE_YEAST_REFERENCE.fermentationTempC,
  spongeFermentationHours: SPONGE_YEAST_REFERENCE.fermentationHours,
  spongePreparationByLanguage: null,
  yeastSummary: null,
};
const SPONGE_PREPARATION_STORAGE_KEY = 'calculatorSpongePreparation';
const CALCULATOR_YEAST_SUMMARY_KEY = 'calculatorYeastSummary';

const DEFAULT_PLANNER_TEGLIA_SETTINGS: PlannerTegliaSettings = {
  romanFormat: 'tonda',
  trayCount: 1,
  doughPerTray: 480,
  trayWidth: 30,
  trayLength: 40,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCalculatorYeastSummary(value: string | null): CalculatorYeastSummary | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null) return null;
    if (
      isRecord(parsed)
      && (parsed.method === 'direct' || parsed.method === 'biga' || parsed.method === 'poolish' || parsed.method === 'sponge')
      && (parsed.yeastType === 'fresh' || parsed.yeastType === 'activeDry' || parsed.yeastType === 'dry')
      && (parsed.mode === 'automatic' || parsed.mode === 'manual')
      && typeof parsed.quantityGrams === 'number'
      && Number.isFinite(parsed.quantityGrams)
      && typeof parsed.bakerPercentage === 'number'
      && Number.isFinite(parsed.bakerPercentage)
      && (parsed.finalDoughQuantityGrams === undefined
        || (typeof parsed.finalDoughQuantityGrams === 'number' && Number.isFinite(parsed.finalDoughQuantityGrams)))
      && (parsed.yeastBudgetGrams === undefined || (typeof parsed.yeastBudgetGrams === 'number' && Number.isFinite(parsed.yeastBudgetGrams)))
      && (parsed.bigaYeastGrams === undefined || (typeof parsed.bigaYeastGrams === 'number' && Number.isFinite(parsed.bigaYeastGrams)))
      && (parsed.bigaYeastRequiredGrams === undefined || (typeof parsed.bigaYeastRequiredGrams === 'number' && Number.isFinite(parsed.bigaYeastRequiredGrams)))
      && (parsed.bigaYeastExcessGrams === undefined || (typeof parsed.bigaYeastExcessGrams === 'number' && Number.isFinite(parsed.bigaYeastExcessGrams)))
      && (parsed.bigaYeastBudgetExceeded === undefined || typeof parsed.bigaYeastBudgetExceeded === 'boolean')
      && (parsed.finalDoughYeastGrams === undefined || (typeof parsed.finalDoughYeastGrams === 'number' && Number.isFinite(parsed.finalDoughYeastGrams)))
      && (parsed.poolishYeastGrams === undefined || (typeof parsed.poolishYeastGrams === 'number' && Number.isFinite(parsed.poolishYeastGrams)))
    ) {
      return parsed as CalculatorYeastSummary;
    }
  } catch (error) {
    console.warn('Saved Planner yeast summary could not be parsed.', error);
    return null;
  }
  console.warn('Saved Planner yeast summary is invalid.');
  return null;
}

function parseSpongePreparation(value: string | null): Record<Lang, { title: string; steps: string[] }> | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (isRecord(parsed) && isRecord(parsed.byLanguage)) {
      const byLanguage = parsed.byLanguage;
      const readPhase = (language: Lang) => {
        const phase = byLanguage[language];
        return isRecord(phase)
          && typeof phase.title === 'string'
          && Array.isArray(phase.steps)
          && phase.steps.every((step) => typeof step === 'string')
          ? { title: phase.title, steps: phase.steps }
          : null;
      };
      const hr = readPhase('hr');
      const en = readPhase('en');
      const de = readPhase('de');
      const sl = readPhase('sl');
      if (hr && en && de && sl) return { hr, en, de, sl };
    }
  } catch (error: unknown) {
    console.warn('Saved Sponge preparation for Planner could not be parsed.', error);
    return null;
  }
  console.warn('Saved Sponge preparation for Planner is invalid; ignoring it.');
  return null;
}

function isOvenType(value: unknown): value is OvenType {
  return value === 'ooni' || value === 'homeStone' || value === 'homePan';
}

function isBlendFlourType(value: unknown): value is Exclude<FlourType, 'custom'> {
  return value === 'caputo00' || value === 'manitoba' || value === 'spelt'
    || value === 'wholeWheat' || value === 'glutenFree';
}

export default function Planner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { returnTo, returnToken, returnSection } = useLocalSearchParams<{ returnTo?: string; returnToken?: string; returnSection?: string }>();
  const returnToBeginner = useRef(returnTo === 'beginner');
  const beginnerReturnSection = useRef(returnSection === 'style' ? 'style' : 'plan');
  const { t, lang } = useT();
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const experienceLoaded = experienceLevel !== undefined;
  const isBeginner = experienceLevel !== 'pro';
  const plannerRestoreStatus = useSyncExternalStore(subscribePlannerNotificationRestoreStatus, getPlannerNotificationRestoreStatus, getPlannerNotificationRestoreStatus);
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const preferredYeastType = useSyncExternalStore(subscribePreferredYeastType, getCachedPreferredYeastType, getCachedPreferredYeastType) ?? 'fresh';
  const sharedCalculatorPlanSettings = useSyncExternalStore(
    subscribeSharedCalculatorPlanSettings,
    getSharedCalculatorPlanSettings,
    getSharedCalculatorPlanSettings,
  );
  const hasSharedCalculatorPlanSettings = !!sharedCalculatorPlanSettings;
  const [style, setStyle] = useState<PizzaStyle>('neapolitan');
  const [selectedMethod, setSelectedMethod] = useState<Method>('direct');
  const [hasSavedCalculatorRecipe, setHasSavedCalculatorRecipe] = useState(false);
  const [plannerUsesGlutenFreeFlour, setPlannerUsesGlutenFreeFlour] = useState(false);
  const [calculatorPlanSettings, setCalculatorPlanSettings] = useState(DEFAULT_CALCULATOR_PLAN_SETTINGS);
  const [plannerTegliaSettings, setPlannerTegliaSettings] = useState(DEFAULT_PLANNER_TEGLIA_SETTINGS);
  const [plannerMixing, setPlannerMixing] = useState<'hand' | 'home' | 'spiral'>('hand');
  const [plannerBakeTargetLoadedFor, setPlannerBakeTargetLoadedFor] = useState<'pro' | null>(null);
  const [plannerPhaseOverrides, setPlannerPhaseOverrides] = useState<PlannerPhaseOverrides>({});
  const [plannerPhaseOverridesLoadedFor, setPlannerPhaseOverridesLoadedFor] = useState<string | null>(null);
  const [staleProOverridesWarningFor, setStaleProOverridesWarningFor] = useState<string | null>(null);
  const [deletePlanConfirmationOpen, setDeletePlanConfirmationOpen] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [deletePlanFailure, setDeletePlanFailure] = useState<'notifications' | 'storage' | null>(null);
  const legacyProOverridesWarningShown = useRef(false);
  const [editingPhase, setEditingPhase] = useState<PlannerPhaseStep | null>(null);
  const [editingPhaseDraft, setEditingPhaseDraft] = useState<Date>(() => new Date());
  const [editingPhaseInput, setEditingPhaseInput] = useState('');
  const [editingPhasePickerMode, setEditingPhasePickerMode] = useState<null | 'date' | 'time'>(null);
  const [isSchedulingAlarms, setIsSchedulingAlarms] = useState(false);
  const schedulingAlarms = useRef(false);
  const [roomTempLoaded, setRoomTempLoaded] = useState(false);
  const method: Method = isBeginner
    ? 'direct'
    : sharedCalculatorPlanSettings
      ? sharedCalculatorPlanSettings.method
      : selectedMethod;
  const bakeAt = useSyncExternalStore(subscribeSharedHomeBakeAt, getSharedHomeBakeAt, getSharedHomeBakeAt);
  const directHomeSchedule = useSyncExternalStore(subscribeSharedHomeDirectSchedule, getSharedHomeDirectSchedule, getSharedHomeDirectSchedule);
  const directHomeScheduleMode = useSyncExternalStore(subscribeSharedHomeDirectSchedule, getSharedHomeDirectScheduleMode, getSharedHomeDirectScheduleMode);
  const bigaHomeSchedule = useSyncExternalStore(subscribeSharedHomeBigaSchedule, getSharedHomeBigaSchedule, getSharedHomeBigaSchedule);
  const poolishHomeSchedule = useSyncExternalStore(subscribeSharedHomePoolishSchedule, getSharedHomePoolishSchedule, getSharedHomePoolishSchedule);
  const {
    direct: plannerDirectHomeSchedule,
    biga: plannerBigaHomeSchedule,
    poolish: plannerPoolishHomeSchedule,
  } = selectPlannerHomeSchedules({
    isBeginner,
    bakeAt,
    directSchedule: directHomeSchedule,
    directScheduleMode: directHomeScheduleMode,
    bigaSchedule: bigaHomeSchedule,
    poolishSchedule: poolishHomeSchedule,
  });
  const [scheduledPlanKey, setScheduledPlanKey] = useState<string | null>(null);
  const pendingBeginnerReturnBakeAt = useRef<number | null>(null);
  const effectiveStyle = isBeginner && plannerDirectHomeSchedule?.style
    ? plannerDirectHomeSchedule.style
    : sharedCalculatorPlanSettings
      ? sharedCalculatorPlanSettings.pizzaStyle
      : style;
  const hasCurrentCalculatorRecipe = isBeginner || !!sharedCalculatorPlanSettings || hasSavedCalculatorRecipe;
  const plannerStepCopy = isBeginner
    ? t.planner.stepCopy
    : {
      ...t.planner.stepCopy,
      directHomeCopy: undefined,
      directHomeTegliaCopy: {
        ...t.planner.stepCopy.directHomeTegliaCopy,
        temperingAsMass: t.planner.proTegliaTiming.temperingAsMass,
        finalRoom: t.planner.proTegliaTiming.finalRoom,
      },
    };
  const activeCalculatorPlanSettings = useMemo(() => sharedCalculatorPlanSettings
    ? {
      oven: sharedCalculatorPlanSettings.oven,
      ovenTemp: sharedCalculatorPlanSettings.ovenTemp,
      roomTemp: sharedCalculatorPlanSettings.roomTemp,
      roomHours: sharedCalculatorPlanSettings.roomHours,
      fridgeTemp: sharedCalculatorPlanSettings.fridgeTemp,
      fridgeHours: sharedCalculatorPlanSettings.fridgeHours,
      bigaHours: sharedCalculatorPlanSettings.bigaHours,
      bigaStartHours: sharedCalculatorPlanSettings.bigaStartHours ?? 0,
      bigaPct: sharedCalculatorPlanSettings.bigaPct,
      bigaHydrationPct: sharedCalculatorPlanSettings.bigaHydrationPct,
      poolishHours: sharedCalculatorPlanSettings.poolishHours,
      poolishStartHours: sharedCalculatorPlanSettings.poolishStartHours ?? 0,
      poolishPct: sharedCalculatorPlanSettings.poolishPct,
      poolishHydrationPct: sharedCalculatorPlanSettings.poolishHydrationPct,
      poolishFermentationTempC: sharedCalculatorPlanSettings.poolishFermentationTempC,
      poolishFermentationMode: sharedCalculatorPlanSettings.poolishFermentationMode,
      poolishRtHours: sharedCalculatorPlanSettings.poolishRtHours,
      poolishCtHours: sharedCalculatorPlanSettings.poolishCtHours,
      poolishRtTemperatureC: sharedCalculatorPlanSettings.poolishRtTemperatureC,
      poolishCtTemperatureC: sharedCalculatorPlanSettings.poolishCtTemperatureC,
      spongeFlourPct: sharedCalculatorPlanSettings.spongeFlourPct,
      spongeHydrationPct: sharedCalculatorPlanSettings.spongeHydrationPct,
      spongeFermentationTempC: sharedCalculatorPlanSettings.spongeFermentationTempC,
      spongeFermentationHours: sharedCalculatorPlanSettings.spongeFermentationHours,
      spongePreparationByLanguage: sharedCalculatorPlanSettings.spongePreparationByLanguage,
      yeastSummary: sharedCalculatorPlanSettings.yeastSummary,
    }
    : calculatorPlanSettings, [sharedCalculatorPlanSettings, calculatorPlanSettings]);
  const activePlannerTegliaSettings = useMemo(() => sharedCalculatorPlanSettings
    ? {
      romanFormat: sharedCalculatorPlanSettings.romanFormat,
      trayCount: Math.max(1, Math.round(sharedCalculatorPlanSettings.trayCount)),
      doughPerTray: Math.round(sharedCalculatorPlanSettings.doughPerTray),
      trayWidth: sharedCalculatorPlanSettings.trayWidth,
      trayLength: sharedCalculatorPlanSettings.trayLength,
    }
    : plannerTegliaSettings, [sharedCalculatorPlanSettings, plannerTegliaSettings]);
  const activeMixing = sharedCalculatorPlanSettings?.mixing ?? plannerMixing;
  const sharedYeastSummary = sharedCalculatorPlanSettings
    ? sharedCalculatorPlanSettings.yeastSummary
    : calculatorPlanSettings.yeastSummary;
  const activeYeastSummary = sharedYeastSummary?.method === selectedMethod ? sharedYeastSummary : null;
  const plannerYeastType = activeYeastSummary?.yeastType ?? preferredYeastType;
  const plannerYeastSummaryText = !isBeginner && activeYeastSummary
    ? (() => {
      const quantity = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(activeYeastSummary.quantityGrams);
      const percentage = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(activeYeastSummary.bakerPercentage);
      const yeastType = ({
        hr: { fresh: 'svježi kvasac', activeDry: 'aktivni suhi kvasac', dry: 'instant suhi kvasac' },
        en: { fresh: 'fresh yeast', activeDry: 'active dry yeast', dry: 'instant dry yeast' },
        de: { fresh: 'Frischhefe', activeDry: 'Aktiv-Trockenhefe', dry: 'Instant-Trockenhefe' },
        sl: { fresh: 'sveži kvas', activeDry: 'aktivni suhi kvas', dry: 'instant suhi kvas' },
      }[lang])[activeYeastSummary.yeastType];
      const mainQuantity = activeYeastSummary.finalDoughQuantityGrams === undefined
        ? ''
        : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(activeYeastSummary.finalDoughQuantityGrams);
      const poolishQuantity = activeYeastSummary.poolishYeastGrams === undefined
        ? ''
        : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(activeYeastSummary.poolishYeastGrams);
      const requiredBigaQuantity = activeYeastSummary.bigaYeastRequiredGrams
        ?? (activeYeastSummary.bigaYeastGrams ?? 0) + (activeYeastSummary.bigaYeastExcessGrams ?? 0);
      const bigaDetails = activeYeastSummary.bigaYeastGrams === undefined
        || activeYeastSummary.yeastBudgetGrams === undefined
        || activeYeastSummary.finalDoughYeastGrams === undefined
        ? ''
        : (() => {
          const copy = YEAST_SETTINGS_COPY[lang];
          const format = (value: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
          const summary = copy.bigaBudgetSummary
            .replace('{BUDGET}', format(activeYeastSummary.yeastBudgetGrams!))
            .replace('{BIGA}', format(activeYeastSummary.bigaYeastGrams!))
            .replace('{REQUIRED}', format(requiredBigaQuantity))
            .replace('{FINAL}', format(activeYeastSummary.finalDoughYeastGrams!));
          return activeYeastSummary.bigaYeastBudgetExceeded && (activeYeastSummary.bigaYeastExcessGrams ?? 0) > 0
            ? `${summary}\n${copy.bigaBudgetWarning
              .replace('{BUDGET}', format(activeYeastSummary.yeastBudgetGrams!))
              .replace('{BIGA}', format(activeYeastSummary.bigaYeastGrams!))
              .replace('{REQUIRED}', format(requiredBigaQuantity))
              .replace('{FINAL}', format(activeYeastSummary.finalDoughYeastGrams!))
              .replace('{EXCESS}', format(activeYeastSummary.bigaYeastExcessGrams!))}`
            : summary;
        })();
      const summary = ({
        hr: `Kvasac: ${quantity} g (${yeastType}) · ${percentage}% brašna${poolishQuantity ? `; Poolish: ${poolishQuantity} g` : ''}${mainQuantity ? `; završno tijesto: ${mainQuantity} g` : ''}`,
        en: `Yeast: ${quantity} g (${yeastType}) · ${percentage}% flour${poolishQuantity ? `; Poolish: ${poolishQuantity} g` : ''}${mainQuantity ? `; final dough: ${mainQuantity} g` : ''}`,
        de: `Hefe: ${quantity} g (${yeastType}) · ${percentage}% Mehl${poolishQuantity ? `; Poolish: ${poolishQuantity} g` : ''}${mainQuantity ? `; Hauptteig: ${mainQuantity} g` : ''}`,
        sl: `Kvas: ${quantity} g (${yeastType}) · ${percentage}% moke${poolishQuantity ? `; Poolish: ${poolishQuantity} g` : ''}${mainQuantity ? `; končno testo: ${mainQuantity} g` : ''}`,
      }[lang]);
      return bigaDetails ? `${summary}\n${bigaDetails}` : summary;
    })()
    : null;
  const plannerPrefermentSettingsText = !isBeginner
    ? (() => {
      const percent = (value: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value);
      if (method === 'biga') {
        return ({
          hr: `Biga: ${percent(activeCalculatorPlanSettings.bigaPct)}% brašna · hidratacija ${percent(activeCalculatorPlanSettings.bigaHydrationPct)}% · ${activeCalculatorPlanSettings.bigaHours} h`,
          en: `Biga: ${percent(activeCalculatorPlanSettings.bigaPct)}% of flour · ${percent(activeCalculatorPlanSettings.bigaHydrationPct)}% hydration · ${activeCalculatorPlanSettings.bigaHours} h`,
          de: `Biga: ${percent(activeCalculatorPlanSettings.bigaPct)}% Mehl · ${percent(activeCalculatorPlanSettings.bigaHydrationPct)}% Hydration · ${activeCalculatorPlanSettings.bigaHours} Std.`,
          sl: `Biga: ${percent(activeCalculatorPlanSettings.bigaPct)}% moke · ${percent(activeCalculatorPlanSettings.bigaHydrationPct)}% hidracije · ${activeCalculatorPlanSettings.bigaHours} h`,
        }[lang]);
      }
      if (method === 'poolish' && activeCalculatorPlanSettings.poolishFermentationMode === null) {
        const temp = formatTemperature(activeCalculatorPlanSettings.poolishFermentationTempC, temperatureUnit);
        return ({
          hr: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% brašna · hidratacija ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% · fermentacija ${temp} / ${activeCalculatorPlanSettings.poolishHours} h`,
          en: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% of flour · ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% hydration · fermentation ${temp} / ${activeCalculatorPlanSettings.poolishHours} h`,
          de: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% Mehl · ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% Hydration · Fermentation ${temp} / ${activeCalculatorPlanSettings.poolishHours} Std.`,
          sl: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% moke · hidracija ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% · fermentacija ${temp} / ${activeCalculatorPlanSettings.poolishHours} h`,
        }[lang]);
      }
      if (method === 'poolish' && activeCalculatorPlanSettings.poolishFermentationMode !== null) {
        const mode = activeCalculatorPlanSettings.poolishFermentationMode;
        const hourUnit = lang === 'de' ? 'Std.' : 'h';
        const hasRoom = mode !== 'ct';
        const hasCold = mode !== 'rt';
        const roomPhase = hasRoom ? `RT ${activeCalculatorPlanSettings.poolishRtHours} ${hourUnit} @ ${formatTemperature(activeCalculatorPlanSettings.poolishRtTemperatureC, temperatureUnit)}` : '';
        const coldPhase = hasCold ? `CT ${activeCalculatorPlanSettings.poolishCtHours} ${hourUnit} @ ${formatTemperature(activeCalculatorPlanSettings.poolishCtTemperatureC, temperatureUnit)}` : '';
        const phaseText = mode === 'ct-rt' ? `${coldPhase} → ${roomPhase}` : [roomPhase, coldPhase].filter(Boolean).join(' → ');
        const totalHours = (hasRoom ? activeCalculatorPlanSettings.poolishRtHours : 0) + (hasCold ? activeCalculatorPlanSettings.poolishCtHours : 0);
        return ({
          hr: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% brašna · hidratacija ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% · ${phaseText} · ukupno ${totalHours} h`,
          en: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% of flour · ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% hydration · ${phaseText} · ${totalHours} h total`,
          de: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% Mehl · ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% Hydration · ${phaseText} · insgesamt ${totalHours} Std.`,
          sl: `Poolish: ${percent(activeCalculatorPlanSettings.poolishPct)}% moke · hidracija ${percent(activeCalculatorPlanSettings.poolishHydrationPct)}% · ${phaseText} · skupaj ${totalHours} h`,
        }[lang]);
      }
      if (method === 'sponge') {
        const temp = formatTemperature(activeCalculatorPlanSettings.spongeFermentationTempC, temperatureUnit);
        return ({
          hr: `Sponge: ${percent(activeCalculatorPlanSettings.spongeFlourPct)}% brašna · hidratacija ${percent(activeCalculatorPlanSettings.spongeHydrationPct)}% · fermentacija ${temp} / ${activeCalculatorPlanSettings.spongeFermentationHours} h`,
          en: `Sponge: ${percent(activeCalculatorPlanSettings.spongeFlourPct)}% of flour · ${percent(activeCalculatorPlanSettings.spongeHydrationPct)}% hydration · fermentation ${temp} / ${activeCalculatorPlanSettings.spongeFermentationHours} h`,
          de: `Sponge: ${percent(activeCalculatorPlanSettings.spongeFlourPct)}% Mehl · ${percent(activeCalculatorPlanSettings.spongeHydrationPct)}% Hydration · Fermentation ${temp} / ${activeCalculatorPlanSettings.spongeFermentationHours} Std.`,
          sl: `Sponge: ${percent(activeCalculatorPlanSettings.spongeFlourPct)}% moke · hidracija ${percent(activeCalculatorPlanSettings.spongeHydrationPct)}% · fermentacija ${temp} / ${activeCalculatorPlanSettings.spongeFermentationHours} h`,
        }[lang]);
      }
      return null;
    })()
    : null;
  const plannerOvenType = isBeginner
    ? plannerDirectHomeSchedule?.ovenType ?? 'homeStone'
    : sharedCalculatorPlanSettings?.oven
      ?? activeCalculatorPlanSettings.oven
      ?? plannerDirectHomeSchedule?.ovenType
      ?? 'homeStone';
  const plannerOvenTemp = isBeginner
    ? plannerDirectHomeSchedule?.ovenTemp ?? 250
    : sharedCalculatorPlanSettings?.ovenTemp
      ?? activeCalculatorPlanSettings.ovenTemp
      ?? plannerDirectHomeSchedule?.ovenTemp
      ?? 250;
  const beginnerKamadoPlanBlocked = isBeginner
    && (plannerDirectHomeSchedule?.ovenType === 'kamado' || sharedCalculatorPlanSettings?.oven === 'kamado')
    && getBakingTimeRange('kamado', plannerOvenTemp) === null;
  useFocusEffect(useCallback(() => {
    let current = true;
    setRoomTempLoaded(false);
    setHasSavedCalculatorRecipe(false);
    setPlannerUsesGlutenFreeFlour(false);
    void Promise.all([
      AsyncStorage.getItem('calculatorSettings'),
      AsyncStorage.getItem(SPONGE_PREPARATION_STORAGE_KEY).catch((error: unknown) => {
        console.error('Failed to restore Sponge preparation for Planner.', error);
        return null;
      }),
      AsyncStorage.getItem(CALCULATOR_YEAST_SUMMARY_KEY).catch((error: unknown) => {
        console.error('Failed to restore the yeast summary for Planner.', error);
        return null;
      }),
    ])
      .then(([value, savedSpongePreparation, savedYeastSummary]) => {
        if (!value) {
          if (current) {
            setHasSavedCalculatorRecipe(false);
            setPlannerUsesGlutenFreeFlour(false);
            setCalculatorPlanSettings(DEFAULT_CALCULATOR_PLAN_SETTINGS);
            setPlannerTegliaSettings(DEFAULT_PLANNER_TEGLIA_SETTINGS);
          }
          return;
        }
        const settings: unknown = JSON.parse(value);
        if (!isRecord(settings)) {
          console.warn('Saved calculator settings are invalid; Planner will use its default fermentation settings.');
          if (current) {
            setHasSavedCalculatorRecipe(false);
            setPlannerUsesGlutenFreeFlour(false);
            setCalculatorPlanSettings(DEFAULT_CALCULATOR_PLAN_SETTINGS);
            setPlannerTegliaSettings(DEFAULT_PLANNER_TEGLIA_SETTINGS);
          }
          return;
        }
        const readNumber = (key: NumericCalculatorPlanSetting) => {
          const saved = settings[key];
          if (typeof saved === 'number' && Number.isFinite(saved)) return saved;
          if (saved !== undefined) console.warn(`Saved calculator setting "${key}" is invalid; Planner will use its default.`);
          return DEFAULT_CALCULATOR_PLAN_SETTINGS[key];
        };
        const readPositiveSetting = (key: string, fallback: number) => {
          const saved = settings[key];
          if (typeof saved === 'number' && Number.isFinite(saved) && saved > 0) return saved;
          if (saved !== undefined) console.warn(`Saved calculator setting "${key}" is invalid; Planner will use its default.`);
          return fallback;
        };
        const readBoundedSetting = (key: string, fallback: number, minimum: number, maximum: number) => {
          const saved = settings[key];
          if (typeof saved === 'number' && Number.isFinite(saved) && saved >= minimum && saved <= maximum) return saved;
          if (saved !== undefined) console.warn(`Saved calculator setting "${key}" is invalid; Planner will use its default.`);
          return fallback;
        };
        const readTrayDimension = (key: 'trayWidth' | 'trayLength', fallback: number) => {
          if (isBeginner) return readPositiveSetting(key, fallback);
          const saved = settings[key];
          if (isValidProTrayDimension(saved)) return saved;
          if (saved !== undefined) console.warn(`Saved PRO tray setting "${key}" is invalid; Planner will use its default.`);
          return fallback;
        };
        const trayWidth = readTrayDimension('trayWidth', DEFAULT_PLANNER_TEGLIA_SETTINGS.trayWidth);
        const trayLength = readTrayDimension('trayLength', DEFAULT_PLANNER_TEGLIA_SETTINGS.trayLength);
        const customBallWeight = settings.customBallWeight;
        const doughPerTray = typeof customBallWeight === 'number' && Number.isFinite(customBallWeight) && customBallWeight > 0
          ? customBallWeight
          : Math.round(trayWidth * trayLength * 0.4);
        if (customBallWeight !== undefined && customBallWeight !== null
          && !(typeof customBallWeight === 'number' && Number.isFinite(customBallWeight) && customBallWeight > 0)) {
          console.warn('Saved calculator setting "customBallWeight" is invalid; Planner will use the tray-area default.');
        }
        const romanFormat = settings.romanFormat === 'teglia' ? 'teglia' : 'tonda';
        if (settings.romanFormat !== undefined && settings.romanFormat !== 'teglia' && settings.romanFormat !== 'tonda') {
          console.warn('Saved calculator setting "romanFormat" is invalid; Planner will use Tonda.');
        }
        const savedOven = settings.oven;
        if (savedOven !== undefined && !isOvenType(savedOven)) {
          console.warn('Saved calculator setting "oven" is invalid; Planner will use its schedule or default oven.');
        }
        const savedOvenTemp = settings.ovenTemp;
        const ovenTempIsValid = typeof savedOvenTemp === 'number'
          && Number.isFinite(savedOvenTemp)
          && savedOvenTemp >= 200
          && savedOvenTemp <= 500;
        if (savedOvenTemp !== undefined && !ovenTempIsValid) {
          console.warn('Saved calculator setting "ovenTemp" is invalid; Planner will use its schedule or default temperature.');
        }
        const savedStyle = settings.pizzaStyle;
        const savedMethod = settings.method;
        const savedRecipeUsesGlutenFreeFlour = settings.flour === 'glutenFree'
          || (settings.flour === 'custom'
            && (!isBlendFlourType(settings.blendA)
              || !isBlendFlourType(settings.blendB)
              || typeof settings.blendPctA !== 'number'
              || isEffectivelyGlutenFreeBlend(settings.blendA, settings.blendB, settings.blendPctA)));
        const hasValidSavedRecipe = (savedStyle === 'neapolitan' || savedStyle === 'romana' || savedStyle === 'ny_style')
          && (savedMethod === 'direct' || savedMethod === 'biga' || savedMethod === 'poolish' || savedMethod === 'sponge')
          && (savedMethod !== 'sponge' || !savedRecipeUsesGlutenFreeFlour);
        const spongePreparationByLanguage = savedMethod === 'sponge'
          ? parseSpongePreparation(savedSpongePreparation)
          : null;
        const yeastSummary = parseCalculatorYeastSummary(savedYeastSummary);
        const restoredPoolish = restorePoolishPhaseSettings(settings);
        if (current) {
            setHasSavedCalculatorRecipe(hasValidSavedRecipe);
          setPlannerUsesGlutenFreeFlour(savedRecipeUsesGlutenFreeFlour);
            if (savedStyle === 'neapolitan' || savedStyle === 'romana' || savedStyle === 'ny_style') {
              setStyle(savedStyle);
            }
            if (savedMethod === 'direct' || savedMethod === 'biga' || savedMethod === 'poolish' || savedMethod === 'sponge') {
              setSelectedMethod(savedMethod);
            }
            const savedMixing = parseMixingSelection(settings.mixing);
            if (savedMixing) setPlannerMixing(toCalculatorMixing(savedMixing));
            setCalculatorPlanSettings({
            oven: isOvenType(savedOven) ? savedOven : undefined,
            ovenTemp: ovenTempIsValid ? savedOvenTemp : undefined,
            roomTemp: readNumber('roomTemp'),
            roomHours: readNumber('roomHours'),
            fridgeTemp: readNumber('fridgeTemp'),
            fridgeHours: readNumber('fridgeHours'),
            bigaHours: readNumber('bigaHours'),
            bigaStartHours: readNumber('bigaStartHours'),
            bigaPct: readBoundedSetting('bigaPct', 50, 20, 100),
            bigaHydrationPct: readBoundedSetting('bigaHydrationPct', 62, 10, 200),
            poolishHours: readNumber('poolishHours'),
            poolishStartHours: readNumber('poolishStartHours'),
            poolishPct: readBoundedSetting('poolishPct', 35, 20, 100),
            poolishHydrationPct: readBoundedSetting('poolishHydrationPct', 100, 10, 200),
            poolishFermentationTempC: readBoundedSetting('poolishFermentationTempC', 22, 4, 35),
            poolishFermentationMode: restoredPoolish?.mode ?? null,
            poolishRtHours: restoredPoolish?.rtHours ?? 24,
            poolishCtHours: restoredPoolish?.ctHours ?? 24,
            poolishRtTemperatureC: restoredPoolish?.rtTemperatureC ?? 22,
            poolishCtTemperatureC: restoredPoolish?.ctTemperatureC ?? 4,
            spongeFlourPct: readBoundedSetting('spongeFlourPct', SPONGE_YEAST_REFERENCE.flourShare, 1, 100),
            spongeHydrationPct: readBoundedSetting('spongeHydrationPct', 62, 1, 200),
            spongeFermentationTempC: readBoundedSetting('spongeFermentationTempC', SPONGE_YEAST_REFERENCE.fermentationTempC, 4, 35),
            spongeFermentationHours: readBoundedSetting('spongeFermentationHours', SPONGE_YEAST_REFERENCE.fermentationHours, 0.5, 48),
            spongePreparationByLanguage,
            yeastSummary,
          });
          setPlannerTegliaSettings({
            romanFormat,
            trayCount: Math.max(1, Math.round(readPositiveSetting('pizzas', DEFAULT_PLANNER_TEGLIA_SETTINGS.trayCount))),
            doughPerTray: Math.round(doughPerTray),
            trayWidth,
            trayLength,
          });
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load current calculator fermentation settings for Planner.', error);
        if (current) {
          setCalculatorPlanSettings(DEFAULT_CALCULATOR_PLAN_SETTINGS);
          setPlannerTegliaSettings(DEFAULT_PLANNER_TEGLIA_SETTINGS);
          setPlannerUsesGlutenFreeFlour(false);
        }
      })
      .finally(() => {
        if (current) setRoomTempLoaded(true);
      });
    return () => {
      current = false;
    };
  }, []));
  useEffect(() => {
    returnToBeginner.current = returnTo === 'beginner';
    if (returnSection === 'style' || returnSection === 'plan') beginnerReturnSection.current = returnSection;
  }, [returnTo, returnSection, returnToken]);
  useEffect(() => {
    if (experienceLoaded && isBeginner && hasSharedCalculatorPlanSettings && !beginnerKamadoPlanBlocked) {
      void cancelPlannerNotificationsForMethods(['biga', 'poolish']).catch((error) => {
        console.error('Unable to cancel unsupported Beginner Planner alarms:', error);
      });
    }
  }, [experienceLoaded, isBeginner, beginnerKamadoPlanBlocked, hasSharedCalculatorPlanSettings]);
  const hasCurrentBeginnerDirectSchedule = !isBeginner || !!plannerDirectHomeSchedule;
  const plannerRoomBeforeFridgeHours = effectiveStyle === 'romana' && activeCalculatorPlanSettings.fridgeHours > 0
    ? 0
    : activeCalculatorPlanSettings.roomHours;
  const plannerFermentationSchedule = (() => {
    if (isBeginner) {
      if (method === 'direct' && plannerDirectHomeSchedule) {
        return getDirectHomeFermentationSchedule(
          plannerDirectHomeSchedule,
          activeCalculatorPlanSettings.roomTemp,
          activeCalculatorPlanSettings.fridgeTemp,
        );
      }
      return getFermentationSchedule({
        method,
        roomHours: activeCalculatorPlanSettings.roomHours,
        roomTemp: activeCalculatorPlanSettings.roomTemp,
        fridgeHours: activeCalculatorPlanSettings.fridgeHours,
        fridgeTemp: activeCalculatorPlanSettings.fridgeTemp,
        ...(method === 'biga' ? { prefermentHours: activeCalculatorPlanSettings.bigaHours } : {}),
        ...(method === 'poolish' ? { prefermentHours: activeCalculatorPlanSettings.poolishHours } : {}),
      });
    }
    if (sharedCalculatorPlanSettings
      && method === sharedCalculatorPlanSettings.method
      && effectiveStyle === sharedCalculatorPlanSettings.pizzaStyle
      && sharedCalculatorPlanSettings.proFermentationSchedule) {
      return sharedCalculatorPlanSettings.proFermentationSchedule;
    }
    if (method === 'sponge') {
      return getSpongeFermentationSchedule(
        activeCalculatorPlanSettings.spongeFermentationHours,
        activeCalculatorPlanSettings.spongeFermentationTempC,
        plannerRoomBeforeFridgeHours,
        activeCalculatorPlanSettings.roomTemp,
        activeCalculatorPlanSettings.fridgeHours,
        activeCalculatorPlanSettings.fridgeTemp,
        activeCalculatorPlanSettings.fridgeHours > 0 ? activeCalculatorPlanSettings.roomHours : 0,
      );
    }
    if (method === 'direct' && plannerDirectHomeSchedule) {
      return getDirectHomeFermentationSchedule(
        plannerDirectHomeSchedule,
        activeCalculatorPlanSettings.roomTemp,
        activeCalculatorPlanSettings.fridgeTemp,
      );
    }
    const roomAfterFridgeHours = getPlannerRoomAfterFridgeHours(
      method,
      effectiveStyle,
      activePlannerTegliaSettings.romanFormat,
      activeCalculatorPlanSettings.roomHours,
      activeCalculatorPlanSettings.fridgeHours,
      activeCalculatorPlanSettings.roomTemp,
    );
    if (method === 'poolish') {
      return getPoolishPlannerFallbackSchedule({
        poolishFermentationMode: activeCalculatorPlanSettings.poolishFermentationMode,
        poolishHours: activeCalculatorPlanSettings.poolishHours,
        poolishFermentationTempC: activeCalculatorPlanSettings.poolishFermentationTempC,
        rtHours: activeCalculatorPlanSettings.poolishRtHours,
        ctHours: activeCalculatorPlanSettings.poolishCtHours,
        rtTemperatureC: activeCalculatorPlanSettings.poolishRtTemperatureC,
        ctTemperatureC: activeCalculatorPlanSettings.poolishCtTemperatureC,
        roomHours: plannerRoomBeforeFridgeHours,
        roomTemp: activeCalculatorPlanSettings.roomTemp,
        fridgeHours: activeCalculatorPlanSettings.fridgeHours,
        fridgeTemp: activeCalculatorPlanSettings.fridgeTemp,
      }, roomAfterFridgeHours);
    }
    return getFermentationSchedule({
      method,
      roomHours: plannerRoomBeforeFridgeHours,
      roomTemp: activeCalculatorPlanSettings.roomTemp,
      fridgeHours: activeCalculatorPlanSettings.fridgeHours,
      fridgeTemp: activeCalculatorPlanSettings.fridgeTemp,
      roomAfterFridgeHours,
      ...(method === 'biga' ? { prefermentHours: activeCalculatorPlanSettings.bigaHours } : {}),
    });
  })();
  const isProNapolitanaColdPlan = !isBeginner
    && plannerOvenType !== 'kamado'
    && activeCalculatorPlanSettings.fridgeHours > 0
    && !(method === 'direct' && plannerDirectHomeSchedule)
    && !(method === 'biga' && plannerBigaHomeSchedule)
    && !(method === 'poolish' && plannerPoolishHomeSchedule);
  const proNapolitanaCombined = method === 'biga'
    && (sharedCalculatorPlanSettings?.bigaEnabled ?? true)
    && !!sharedCalculatorPlanSettings?.poolishEnabled;
  const proNapolitanaInitialIntervals = isProNapolitanaColdPlan
    ? getProNapolitanaInitialIntervals(method, proNapolitanaCombined, activeCalculatorPlanSettings.roomTemp)
    : [];
  const isProNyCombinedColdPlan = isProNapolitanaColdPlan
    && method === 'biga'
    && effectiveStyle === 'ny_style'
    && proNapolitanaCombined;
  const isProRomanaTondaCombinedColdPlan = isProNapolitanaColdPlan
    && method === 'biga'
    && effectiveStyle === 'romana'
    && activePlannerTegliaSettings.romanFormat === 'tonda'
    && proNapolitanaCombined;
  const isProNeapolitanCombinedColdPlan = isProNapolitanaColdPlan
    && method === 'biga'
    && effectiveStyle === 'neapolitan'
    && proNapolitanaCombined;
  const proFinalRoomHours = resolveProNapolitanaFinalRestHours({
    isBeginner,
    ovenType: plannerOvenType,
    method,
    style: effectiveStyle,
    combinedBigaPoolish: proNapolitanaCombined,
    fridgeHours: activeCalculatorPlanSettings.fridgeHours,
    selectedHours: activeCalculatorPlanSettings.roomHours,
    fallbackHours: getPlannerRoomAfterFridgeHours(
      method,
      effectiveStyle,
      activePlannerTegliaSettings.romanFormat,
      activeCalculatorPlanSettings.roomHours,
      activeCalculatorPlanSettings.fridgeHours,
      activeCalculatorPlanSettings.roomTemp,
    ),
  });
  const proNapolitanaWindow = isProNapolitanaColdPlan && bakeAt
    ? getProNapolitanaPlannerWindow(
      bakeAt,
      proFinalRoomHours,
      activeCalculatorPlanSettings.fridgeHours,
      proNapolitanaInitialIntervals,
    )
    : null;
  const proNapolitanaFermentationSchedule = isProNapolitanaColdPlan
    ? buildProNapolitanaFermentationSchedule(
      plannerFermentationSchedule,
      proNapolitanaInitialIntervals,
      proFinalRoomHours,
      activeCalculatorPlanSettings.fridgeHours,
      activeCalculatorPlanSettings.roomTemp,
      activeCalculatorPlanSettings.fridgeTemp,
    )
    : plannerFermentationSchedule;
  const plannerMixTitles = [
    plannerStepCopy.directMixTitle,
    plannerStepCopy.directTitle,
    plannerStepCopy.bigaMixTitle,
    plannerStepCopy.bigaTitle,
    plannerStepCopy.poolishMixTitle,
    plannerStepCopy.poolishTitle,
    plannerStepCopy.finalMixTitle.replace('{PREFERMENT}', plannerStepCopy.bigaName),
    plannerStepCopy.finalMixTitle.replace('{PREFERMENT}', plannerStepCopy.poolishName),
  ];
  const isProKamadoPlan = !isBeginner && plannerOvenType === 'kamado';
  const isProTegliaSponge = !isBeginner
    && method === 'sponge'
    && effectiveStyle === 'romana'
    && activePlannerTegliaSettings.romanFormat === 'teglia'
    && !isProKamadoPlan;
  const kamadoInitialIntervals = isProKamadoPlan
    ? getProNapolitanaInitialIntervals(method, proNapolitanaCombined, activeCalculatorPlanSettings.roomTemp)
    : [];
  const plannerBaseSteps = !beginnerKamadoPlanBlocked && bakeAt && hasCurrentBeginnerDirectSchedule && (roomTempLoaded || !!sharedCalculatorPlanSettings) && hasCurrentCalculatorRecipe ? (
    isProKamadoPlan
      ? buildProKamadoPlannerSteps(
        bakeAt,
        method,
        effectiveStyle,
        isProNapolitanaColdPlan ? proNapolitanaFermentationSchedule : plannerFermentationSchedule,
        lang,
        getBeginnerPreheatMinutes(plannerOvenType),
        activeCalculatorPlanSettings.spongePreparationByLanguage?.[lang]
          ?? sharedCalculatorPlanSettings?.spongePreparation
          ?? null,
        kamadoInitialIntervals,
        proNapolitanaCombined,
        method === 'poolish'
          ? getPoolishFinalMixDurationMinutes(activeMixing)
          : method === 'biga'
            ? getProKamadoBigaMixDurationMinutes(activeMixing)
            : method === 'sponge'
              ? getPoolishFinalMixDurationMinutes(activeMixing)
            : 0,
      )
      : reversePlan(
        bakeAt,
        method,
        effectiveStyle,
        plannerStepCopy,
        isProNapolitanaColdPlan ? null : plannerDirectHomeSchedule,
        isProNapolitanaColdPlan ? null : plannerBigaHomeSchedule,
        isProNapolitanaColdPlan ? null : plannerPoolishHomeSchedule,
        lang,
        formatTemperature(plannerOvenTemp, temperatureUnit),
        activeCalculatorPlanSettings.roomTemp,
        isBeginner ? undefined : proNapolitanaFermentationSchedule,
        activePlannerTegliaSettings,
        plannerOvenType,
        plannerOvenTemp,
        isBeginner ? undefined : getBeginnerPreheatMinutes(plannerOvenType),
        isBeginner ? undefined : activeMixing,
        isBeginner
          ? null
          : activeCalculatorPlanSettings.spongePreparationByLanguage?.[lang]
            ?? sharedCalculatorPlanSettings?.spongePreparation
            ?? null,
        isBeginner ? undefined : activeCalculatorPlanSettings.bigaHydrationPct,
      )
  ).map((step) => ({
    ...step,
    desc: formatUnitText(
      plannerMixTitles.includes(step.title) || step.phaseId === 'poolish.phase.1'
        ? `${step.desc}\n\n${plannerStepCopy.yeastHandling[plannerYeastType]}${activeMixing === 'spiral' ? `\n\n${getSpiralPlannerNote(lang)}` : ''}`
        : step.desc,
      temperatureUnit,
      measurementSystem,
    ),
  })) : [];
  const combinedBranchAlarmSteps = (() => {
    if (isBeginner || method !== 'biga') return [];
    const roomAfterFridgeHours = getPlannerRoomAfterFridgeHours(
      method,
      effectiveStyle,
      activePlannerTegliaSettings.romanFormat,
      activeCalculatorPlanSettings.roomHours,
      activeCalculatorPlanSettings.fridgeHours,
      activeCalculatorPlanSettings.roomTemp,
    );
    const branchSchedules = [
      {
        name: plannerStepCopy.bigaName,
        phaseId: 'biga',
        schedule: { ...plannerFermentationSchedule, startAtHours: activeCalculatorPlanSettings.bigaStartHours },
      },
    ];
    if (sharedCalculatorPlanSettings?.poolishEnabled) {
      const poolishSchedule = getPoolishPlannerFallbackSchedule({
        poolishFermentationMode: activeCalculatorPlanSettings.poolishFermentationMode,
        poolishHours: activeCalculatorPlanSettings.poolishHours,
        poolishFermentationTempC: activeCalculatorPlanSettings.poolishFermentationTempC,
        rtHours: activeCalculatorPlanSettings.poolishRtHours,
        ctHours: activeCalculatorPlanSettings.poolishCtHours,
        rtTemperatureC: activeCalculatorPlanSettings.poolishRtTemperatureC,
        ctTemperatureC: activeCalculatorPlanSettings.poolishCtTemperatureC,
        roomHours: plannerRoomBeforeFridgeHours,
        roomTemp: activeCalculatorPlanSettings.roomTemp,
        fridgeHours: activeCalculatorPlanSettings.fridgeHours,
        fridgeTemp: activeCalculatorPlanSettings.fridgeTemp,
      }, roomAfterFridgeHours);
      branchSchedules.push({
        name: plannerStepCopy.poolishName,
        phaseId: 'poolish',
        schedule: { ...poolishSchedule, startAtHours: activeCalculatorPlanSettings.poolishStartHours },
      });
    }
    const branchEnds = branchSchedules.map(({ schedule }) => {
      const phases = schedule.phases.filter((phase) => phase.kind === 'preferment');
      return (schedule.startAtHours ?? 0) + phases.reduce((total, phase) => total + phase.hours, 0);
    });
    const finalMixStartHours = Math.max(...branchEnds);
    const finalMixTitle = plannerStepCopy.finalMixTitle.replace('{PREFERMENT}', plannerStepCopy.bigaName);
    const baseFinalMix = plannerBaseSteps.find((step) => step.title === finalMixTitle)
      ?? (isProKamadoPlan ? plannerBaseSteps.find((step) => step.phaseId === 'biga.finalMix') : undefined);
    if (!baseFinalMix) return [];
    const baseBigaEndHours = plannerFermentationSchedule.phases
      .filter((phase) => phase.kind === 'preferment')
      .reduce((total, phase) => total + phase.hours, 0);
    const laterBranchShiftMs = isProKamadoPlan
      ? 0
      : Math.max(0, finalMixStartHours - baseBigaEndHours) * 60 * 60 * 1000;
    const finalMixAt = baseFinalMix.at.getTime() + laterBranchShiftMs;
    const phaseSteps: typeof plannerBaseSteps = [];
    if (isProKamadoPlan) {
      phaseSteps.push(...buildProKamadoPrefermentBranchSteps(
        new Date(finalMixAt),
        branchSchedules.map(({ name, phaseId, schedule }) => ({
          name,
          phaseId: phaseId as 'biga' | 'poolish',
          phases: schedule.phases.filter((phase) => phase.kind === 'preferment'),
          startAtHours: schedule.startAtHours ?? 0,
        })),
        lang,
      ));
    } else {
      branchSchedules.forEach(({ name, phaseId, schedule }) => {
        const phases = schedule.phases.filter((phase) => phase.kind === 'preferment');
        let elapsed = schedule.startAtHours ?? 0;
        const phaseCopy = ({
          hr: { phase: 'Faza', at: 'na', ready: 'Spremno za završni zamjes.' },
          en: { phase: 'Phase', at: 'at', ready: 'Ready for the final mix.' },
          de: { phase: 'Phase', at: 'bei', ready: 'Bereit für den Hauptteig.' },
          sl: { phase: 'Faza', at: 'pri', ready: 'Pripravljeno za končno mešanje testa.' },
        } as const)[lang];
        phases.forEach((phase, index) => {
          elapsed += phase.hours;
          const environment = phase.environment === 'room' ? 'RT' : 'CT';
          const duration = formatDuration(phase.hours * 3600, lang);
          phaseSteps.push({
            at: new Date(finalMixAt + (elapsed - finalMixStartHours) * 60 * 60 * 1000),
            title: `${name} · ${environment} ${index + 1}`,
            desc: `${phaseCopy.phase} ${index + 1}/${phases.length}: ${duration} ${phaseCopy.at} ${phase.temperature}°C.${index === phases.length - 1 ? ` ${phaseCopy.ready}` : ''}`,
            phaseId: `${phaseId}.phase.${index + 1}`,
          });
        });
      });
    }
    const shiftedBaseSteps = laterBranchShiftMs === 0
      ? plannerBaseSteps
      : plannerBaseSteps.map((step) => step === baseFinalMix
        ? { ...step, at: new Date(step.at.getTime() + laterBranchShiftMs) }
        : step);
    return [...shiftedBaseSteps, ...phaseSteps];
  })();
  const plannerScheduleSteps = combinedBranchAlarmSteps.length > 0 ? combinedBranchAlarmSteps : plannerBaseSteps;
  const proNapolitanaPlannerSteps = (() => {
    if (!bakeAt) return plannerScheduleSteps;
    if (!isProNapolitanaColdPlan) {
      if (!isBeginner
        && !isProKamadoPlan
        && method === 'direct'
        && effectiveStyle === 'neapolitan'
        && (plannerDirectHomeSchedule?.fridgeHours ?? 0) > 0) {
        return addProNapolitanaDirectInitialPlannerSteps(plannerScheduleSteps, lang, plannerUsesGlutenFreeFlour);
      }
      if (isBeginner || isProKamadoPlan || method !== 'sponge' || activeCalculatorPlanSettings.fridgeHours <= 0) {
        return plannerScheduleSteps;
      }
      const roomRestDuration = formatDuration(proFinalRoomHours * 3600, lang);
      const fridgeDuration = formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang);
      const spongeColdCopy = ({
        hr: {
          fridge: `Oblikovane kuglice pokrijte i ostavite u hladnjaku pri ${activeCalculatorPlanSettings.fridgeTemp}°C tijekom ${fridgeDuration}.`,
          removalTitle: 'Izvadi oblikovane kuglice iz hladnjaka',
          removal: `Izvadite oblikovane kuglice iz hladnjaka i ostavite ih ${roomRestDuration} na sobnoj temperaturi kao završni odmor.`,
        },
        en: {
          fridge: `Cover the shaped dough balls and refrigerate them at ${activeCalculatorPlanSettings.fridgeTemp}°C for ${fridgeDuration}.`,
          removalTitle: 'Remove the shaped dough balls from the fridge',
          removal: `Remove the shaped dough balls from the fridge and leave them at room temperature for ${roomRestDuration} as their final rest.`,
        },
        de: {
          fridge: `Decken Sie die geformten Teigkugeln ab und stellen Sie sie bei ${activeCalculatorPlanSettings.fridgeTemp}°C für ${fridgeDuration} in den Kühlschrank.`,
          removalTitle: 'Geformte Teigkugeln aus dem Kühlschrank nehmen',
          removal: `Nehmen Sie die geformten Teigkugeln aus dem Kühlschrank und lassen Sie sie ${roomRestDuration} als abschließende Ruhezeit bei Raumtemperatur stehen.`,
        },
        sl: {
          fridge: `Oblikovane kroglice pokrijte in jih pri ${activeCalculatorPlanSettings.fridgeTemp}°C postavite v hladilnik za ${fridgeDuration}.`,
          removalTitle: 'Oblikovane kroglice vzemi iz hladilnika',
          removal: `Oblikovane kroglice vzemi iz hladilnika in jih pusti ${roomRestDuration} pri sobni temperaturi za končni počitek.`,
        },
      } as const)[lang];
      const alignedSteps = alignProSpongeBallingBeforeFridge(plannerScheduleSteps).map((step) => {
        if (step.phaseId === 'sponge.fridge') return { ...step, desc: spongeColdCopy.fridge };
        if (step.phaseId === 'sponge.fridgeRemoval') {
          return { ...step, title: spongeColdCopy.removalTitle, desc: spongeColdCopy.removal };
        }
        return step;
      });
      const tiePriority = (step: { phaseId?: string }) => step.phaseId === 'sponge.finalMix'
        ? -2
        : step.phaseId === 'sponge.balling'
          ? -1
          : 0;
      return alignedSteps.sort((left, right) => left.at.getTime() - right.at.getTime() || tiePriority(left) - tiePriority(right));
    }
    const finalMixStep = method === 'sponge'
      ? plannerScheduleSteps.find((step) => step.phaseId === 'sponge.finalMix')
      : method === 'direct'
        ? plannerScheduleSteps.find((step) => step.phaseId === 'direct.mix' || step.title === plannerStepCopy.directTitle)
        : plannerScheduleSteps.find((step) => step.phaseId === `${method}.finalMix`)
          ?? plannerScheduleSteps.find((step) => step.title === plannerStepCopy.finalMixTitle.replace('{PREFERMENT}', method === 'biga' ? plannerStepCopy.bigaName : plannerStepCopy.poolishName));
    if (!finalMixStep) return plannerScheduleSteps;
    const finalMixStepIndex = plannerScheduleSteps.indexOf(finalMixStep);

    const spongePrefermentHours = plannerFermentationSchedule.phases
      .filter((phase) => phase.kind === 'preferment')
      .reduce((total, phase) => total + phase.hours, 0);
    const finalMixDurationMinutes = method === 'biga'
      ? getProKamadoBigaMixDurationMinutes(activeMixing)
      : method === 'poolish' || method === 'sponge'
        ? getPoolishFinalMixDurationMinutes(activeMixing)
        : 0;
    const finalMixTargetAt = proNapolitanaWindow && method !== 'direct' && method !== 'sponge'
      ? new Date(proNapolitanaWindow.finalMixAt.getTime() - finalMixDurationMinutes * 60000)
      : null;
    const earlierPhaseShiftMs = finalMixTargetAt
      ? finalMixTargetAt.getTime() - finalMixStep.at.getTime()
      : 0;
    const alignedSteps = method === 'sponge' && proNapolitanaWindow && !isProKamadoPlan
      ? alignProNapolitanaSpongePlannerSteps(plannerScheduleSteps, proNapolitanaWindow, spongePrefermentHours, finalMixDurationMinutes)
      : plannerScheduleSteps;
    const shiftedSteps = alignedSteps.map((step) => {
      if (finalMixTargetAt && step.at.getTime() <= finalMixStep.at.getTime()) {
        return { ...step, at: new Date(step.at.getTime() + earlierPhaseShiftMs) };
      }
      if (method === 'sponge' && step.phaseId === 'sponge.fridgeRemoval') {
        const roomRestDuration = formatDuration(activeCalculatorPlanSettings.roomHours * 3600, lang);
        const takeOutCopy = ({
          hr: {
            title: isProTegliaSponge ? 'Izvadi masu tijesta iz hladnjaka' : 'Izvadi oblikovane kuglice iz hladnjaka',
            desc: isProTegliaSponge
              ? `Izvadite cijelu masu tijesta iz hladnjaka i držite je pokrivenu tijekom završnog odmora od ${roomRestDuration}; priprema tepsija počinje u zasebnom koraku.`
              : `Izvadite već oblikovane kuglice iz hladnjaka i ostavite ih ${roomRestDuration} na sobnoj temperaturi kao završni odmor.`,
          },
          en: {
            title: isProTegliaSponge ? 'Remove the dough mass from the fridge' : 'Remove the shaped dough balls from the fridge',
            desc: isProTegliaSponge
              ? `Remove the complete dough mass from the fridge and keep it covered during its ${roomRestDuration} final rest; tray preparation starts in a separate step.`
              : `Remove the already-shaped dough balls from the fridge and leave them at room temperature for ${roomRestDuration} as their final rest.`,
          },
          de: {
            title: isProTegliaSponge ? 'Teigmasse aus dem Kühlschrank nehmen' : 'Geformte Teigkugeln aus dem Kühlschrank nehmen',
            desc: isProTegliaSponge
              ? `Nehmen Sie die gesamte Teigmasse aus dem Kühlschrank und lassen Sie sie während der abschließenden Ruhezeit von ${roomRestDuration} abgedeckt; die Blechvorbereitung beginnt in einem eigenen Schritt.`
              : `Nehmen Sie die bereits geformten Teigkugeln aus dem Kühlschrank und lassen Sie sie ${roomRestDuration} als abschließende Ruhezeit bei Raumtemperatur stehen.`,
          },
          sl: {
            title: isProTegliaSponge ? 'Maso testa vzemi iz hladilnika' : 'Oblikovane kroglice vzemi iz hladilnika',
            desc: isProTegliaSponge
              ? `Celotno maso testa vzemi iz hladilnika in jo med končnim počitkom ${roomRestDuration} pusti pokrito; priprava pekačev se začne v ločenem koraku.`
              : `Že oblikovane kroglice vzemi iz hladilnika in jih pusti ${roomRestDuration} pri sobni temperaturi za končni počitek.`,
          },
        })[lang];
        return { ...step, ...takeOutCopy };
      }
      if (method === 'sponge' && step.phaseId === 'sponge.fridge') {
        const coldDesc = (isProTegliaSponge ? ({
          hr: `Pokrijte cijelu masu završnog tijesta i ostavite je u hladnjaku pri ${activeCalculatorPlanSettings.fridgeTemp}°C tijekom ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
          en: `Cover the complete final dough mass and refrigerate it at ${activeCalculatorPlanSettings.fridgeTemp}°C for ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
          de: `Decken Sie die gesamte fertige Teigmasse ab und stellen Sie sie bei ${activeCalculatorPlanSettings.fridgeTemp}°C für ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)} in den Kühlschrank.`,
          sl: `Celotno maso končnega testa pokrij in jo pri ${activeCalculatorPlanSettings.fridgeTemp}°C postavi v hladilnik za ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
        }) : ({
          hr: `Oblikovane kuglice pokrijte i ostavite u hladnjaku pri ${activeCalculatorPlanSettings.fridgeTemp}°C tijekom ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
          en: `Cover the shaped dough balls and refrigerate them at ${activeCalculatorPlanSettings.fridgeTemp}°C for ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
          de: `Decken Sie die geformten Teigkugeln ab und stellen Sie sie bei ${activeCalculatorPlanSettings.fridgeTemp}°C für ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)} in den Kühlschrank.`,
          sl: `Oblikovane kroglice pokrijte in jih pri ${activeCalculatorPlanSettings.fridgeTemp}°C postavite v hladilnik za ${formatDuration(activeCalculatorPlanSettings.fridgeHours * 3600, lang)}.`,
        }))[lang];
        return { ...step, desc: coldDesc };
      }
      return step;
    });
    if (isProKamadoPlan) return shiftedSteps;
    const adjustedFinalMix = method === 'sponge'
      ? shiftedSteps.find((step) => step.phaseId === 'sponge.finalMix')
      : (isProNyCombinedColdPlan || isProRomanaTondaCombinedColdPlan)
        ? shiftedSteps[finalMixStepIndex] ?? finalMixStep
        : finalMixStep;
    const mixAt = adjustedFinalMix?.at ?? finalMixStep.at;
    const initialSequenceAt = new Date(mixAt.getTime() + finalMixDurationMinutes * 60000);
    const intervalLabel = (seconds: number) => formatDuration(seconds, lang);
    const copy = {
      hr: {
        mixRest: 'Odmor nakon završnog zamjesa',
        roomRest: (index: number) => `Sobni odmor ${index}`,
        fold: (index: number) => `Stretch & Fold ${index}`,
        balling: 'Podjela i oblikovanje kuglica',
        ballRest: (duration: string) => `Odmor kuglica – ${duration}`,
      },
      en: {
        mixRest: 'Rest after final mix',
        roomRest: (index: number) => `Room rest ${index}`,
        fold: (index: number) => `Stretch & Fold ${index}`,
        balling: 'Divide and shape dough balls',
        ballRest: (duration: string) => `Dough-ball rest – ${duration}`,
      },
      de: {
        mixRest: 'Ruhe nach dem Endkneten',
        roomRest: (index: number) => `Raumruhe ${index}`,
        fold: (index: number) => `Stretch & Fold ${index}`,
        balling: 'Teiglinge teilen und formen',
        ballRest: (duration: string) => `Ruhe der Teigkugeln – ${duration}`,
      },
      sl: {
        mixRest: 'Počitek po končnem mešanju',
        roomRest: (index: number) => `Počitek pri sobni temperaturi ${index}`,
        fold: (index: number) => `Stretch & Fold ${index}`,
        balling: 'Razdeli in oblikuj kroglice',
        ballRest: (duration: string) => `Počitek kroglic – ${duration}`,
      },
    }[lang];
    const description = {
      hr: {
        mixRest: (duration: string) => `Ostavite tijesto pokriveno ${duration} nakon završnog zamjesa.`,
        roomRest: (duration: string) => `Nakon preklapanja ostavite tijesto pokriveno ${duration} na sobnoj temperaturi.`,
        fold: 'Napravite Stretch & Fold prije sljedećeg sobnog odmora.',
        balling: (duration: string) => `Oblikujte kuglice prije hladnjaka${duration ? `; odmor kuglica traje ${duration}.` : '.'}`,
        ballRest: (duration: string) => `Nakon oblikovanja ostavite kuglice da odmore ${duration} prije hladnjaka.`,
      },
      en: {
        mixRest: (duration: string) => `Keep the dough covered for ${duration} after the final mix.`,
        roomRest: (duration: string) => `After folding, keep the dough covered at room temperature for ${duration}.`,
        fold: 'Perform Stretch & Fold before the next room rest.',
        balling: (duration: string) => `Shape the dough balls before refrigeration${duration ? `; rest them for ${duration}.` : '.'}`,
        ballRest: (duration: string) => `After shaping, leave the dough balls to rest for ${duration} before refrigeration.`,
      },
      de: {
        mixRest: (duration: string) => `Lassen Sie den Teig nach dem Endkneten ${duration} abgedeckt ruhen.`,
        roomRest: (duration: string) => `Lassen Sie den Teig nach dem Falten ${duration} abgedeckt bei Raumtemperatur ruhen.`,
        fold: 'Falten Sie den Teig vor der nächsten Ruhephase.',
        balling: (duration: string) => `Formen Sie die Teigkugeln vor dem Kühlen${duration ? `; lassen Sie sie ${duration} ruhen.` : '.'}`,
        ballRest: (duration: string) => `Lassen Sie die Teigkugeln nach dem Formen vor dem Kühlen ${duration} ruhen.`,
      },
      sl: {
        mixRest: (duration: string) => `Testo po končnem mešanju pustite pokrito ${duration}.`,
        roomRest: (duration: string) => `Po prepogibu pustite testo pokrito ${duration} pri sobni temperaturi.`,
        fold: 'Testo prepognite pred naslednjim sobnim počitkom.',
        balling: (duration: string) => `Kroglice oblikujte pred hlajenjem${duration ? `; počivajo naj ${duration}.` : '.'}`,
        ballRest: (duration: string) => `Po oblikovanju naj kroglice pred hlajenjem počivajo ${duration}.`,
      },
    }[lang];
    const phases = buildProNapolitanaInitialPlannerEvents(
      method,
      proNapolitanaCombined,
      initialSequenceAt,
      proNapolitanaInitialIntervals,
    ).filter((event) => !(isProTegliaSponge && event.kind === 'balling')).flatMap((event) => {
      const separateBallRest = (isProNyCombinedColdPlan || isProRomanaTondaCombinedColdPlan)
        && event.kind === 'balling'
        && (event.seconds ?? 0) > 0;
      const title = event.kind === 'mix-rest'
        ? copy.mixRest
        : event.kind === 'room-rest'
          ? copy.roomRest(event.index ?? 1)
          : event.kind === 'fold'
            ? copy.fold(event.index ?? 1)
            : copy.balling;
      const desc = event.kind === 'mix-rest'
        ? description.mixRest(intervalLabel(event.seconds ?? 0))
        : event.kind === 'room-rest'
          ? description.roomRest(intervalLabel(event.seconds ?? 0))
          : event.kind === 'fold'
            ? description.fold
            : description.balling(separateBallRest ? '' : event.seconds ? intervalLabel(event.seconds) : '');
      const phaseId = event.kind === 'mix-rest'
        ? 'pro.initial.mix-rest'
        : event.kind === 'room-rest'
          ? `pro.initial.room-rest-${event.index}`
          : event.kind === 'fold'
            ? `pro.initial.fold-${event.index}`
            : 'pro.initial.balling';
      const shapingStep = { at: event.at, title, desc, phaseId };
      if (!separateBallRest) return [shapingStep];
      const duration = intervalLabel(event.seconds ?? 0);
      return [
        shapingStep,
        {
          at: event.at,
          title: copy.ballRest(duration),
          desc: description.ballRest(duration),
          phaseId: 'pro.initial.ball-rest',
        },
      ];
    });
    const tegliaSpongeEvents = isProTegliaSponge && proNapolitanaWindow
      ? buildProTegliaSpongePlannerEvents(
        proNapolitanaWindow.fridgeEndAt,
        bakeAt,
        proFinalRoomHours,
        lang,
      )
      : [];
    const allSteps = [
      ...shiftedSteps.filter((step) => !(isProTegliaSponge && step.phaseId === 'sponge.finalRoom')),
      ...phases,
      ...tegliaSpongeEvents,
    ];
    const completeSteps = ensureProTargetBakeEvent(
      allSteps,
      isProRomanaTondaCombinedColdPlan || isProNeapolitanCombinedColdPlan,
      bakeAt,
      {
        phaseId: 'romanaTonda.bake',
        title: plannerStepCopy.bakeTitle ?? plannerStepCopy.ovenTitle,
        desc: plannerStepCopy.bakeDesc ?? plannerStepCopy.ovenDesc,
      },
    );
    const tiePriority = (step: { phaseId?: string }) => step.phaseId === 'pro.initial.balling'
      ? -2
      : step.phaseId === 'pro.initial.ball-rest' || step.phaseId === 'sponge.balling'
        ? -1
        : 0;
    return completeSteps.sort((left, right) => left.at.getTime() - right.at.getTime() || tiePriority(left) - tiePriority(right));
  })();
  const generatedSteps = assignPlannerPhaseKeys(
    proNapolitanaPlannerSteps,
  isBeginner
    ? JSON.stringify(['beginner', effectiveStyle, activePlannerTegliaSettings.romanFormat, method, activeMixing])
    : 'pro',
  !isBeginner,
  );
  const plannerPhaseOverrideScheduleIdentity = !isBeginner && bakeAt && generatedSteps.length > 0
    ? JSON.stringify([
      bakeAt.getTime(),
      method,
      effectiveStyle,
      activeMixing,
      activePlannerTegliaSettings,
      plannerOvenType,
      plannerOvenTemp,
      activeCalculatorPlanSettings,
      plannerDirectHomeSchedule?.glutenFree ?? null,
      generatedSteps.map((step, index) => [
        'phaseId' in step && typeof step.phaseId === 'string' ? step.phaseId : index,
        step.at.getTime(),
      ]),
    ])
    : null;
  const plannerPhaseOverridesStorageKey = isBeginner
    ? getPlannerPhaseOverridesStorageKey('beginner')
    : plannerPhaseOverrideScheduleIdentity
      ? getPlannerPhaseOverridesStorageKey('pro', plannerPhaseOverrideScheduleIdentity)
      : null;
  useEffect(() => {
    if (!experienceLoaded || !plannerPhaseOverridesStorageKey) return undefined;
    let active = true;
    void (async () => {
      const serialized = await AsyncStorage.getItem(plannerPhaseOverridesStorageKey);
      if (!active) return;
      const restoredOverrides = parsePlannerPhaseOverrides(serialized);
      if (!isBeginner && serialized === null && !legacyProOverridesWarningShown.current) {
        const legacyKey = getPlannerPhaseOverridesStorageKey('pro');
        const keys = await AsyncStorage.getAllKeys();
        if (!active) return;
        const previousKeys = keys.filter((key) => (
          key !== plannerPhaseOverridesStorageKey
          && (key === legacyKey || key.startsWith(`${legacyKey}:`))
        ));
        const previousValues = previousKeys.length > 0
          ? await AsyncStorage.multiGet(previousKeys)
          : [];
        if (!active) return;
        const hasUnscopedEdits = previousValues.some(([, value]) => {
          if (value === null) return false;
          try {
            return Object.keys(parsePlannerPhaseOverrides(value)).length > 0;
          } catch (error: unknown) {
            console.warn('Saved PRO Planner phase edits could not be mapped to this schedule.', error);
            return true;
          }
        });
        if (hasUnscopedEdits) {
          legacyProOverridesWarningShown.current = true;
          setStaleProOverridesWarningFor(plannerPhaseOverridesStorageKey);
          if (Platform.OS !== 'web') Alert.alert(t.planner.stalePhaseOverridesNotApplied);
        }
      }
      setPlannerPhaseOverrides(restoredOverrides);
    })()
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to load saved Planner phase edits.', error);
        if (!isBeginner) {
          setStaleProOverridesWarningFor(plannerPhaseOverridesStorageKey);
          if (Platform.OS !== 'web') Alert.alert(t.planner.stalePhaseOverridesNotApplied);
        }
        setPlannerPhaseOverrides({});
      })
      .finally(() => {
        if (active) setPlannerPhaseOverridesLoadedFor(plannerPhaseOverridesStorageKey);
      });
    return () => {
      active = false;
    };
  }, [experienceLoaded, isBeginner, plannerPhaseOverridesStorageKey, t.planner.stalePhaseOverridesNotApplied]);
  useEffect(() => {
    if (isDeletingPlan || !plannerPhaseOverridesStorageKey || plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey) return;
    void AsyncStorage.setItem(
      plannerPhaseOverridesStorageKey,
      JSON.stringify(plannerPhaseOverrides),
    ).catch((error: unknown) => {
      console.error('Failed to save Planner phase edits.', error);
    });
  }, [isDeletingPlan, plannerPhaseOverrides, plannerPhaseOverridesLoadedFor, plannerPhaseOverridesStorageKey]);
  const phaseKeySignature = JSON.stringify(generatedSteps.map((step) => step.phaseKey));
  useEffect(() => {
    const currentPhaseKeys: string[] = JSON.parse(phaseKeySignature);
    if (!plannerPhaseOverridesStorageKey
      || plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey
      || currentPhaseKeys.length === 0) return;
    // Prune intentionally edited dates when their phase is removed from the new calculator schedule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlannerPhaseOverrides((current) => {
      const retained = retainCurrentPlannerPhaseOverrides(
        current,
        currentPhaseKeys.map((phaseKey) => ({ phaseKey })),
      );
      return Object.keys(retained).length === Object.keys(current).length ? current : retained;
    });
  }, [phaseKeySignature, plannerPhaseOverridesLoadedFor, plannerPhaseOverridesStorageKey]);
  const activePhaseOverrides = plannerPhaseOverridesStorageKey
    && plannerPhaseOverridesLoadedFor === plannerPhaseOverridesStorageKey
    ? plannerPhaseOverrides
    : {};
  const steps = applyPlannerPhaseOverrides(generatedSteps, activePhaseOverrides);
  const hasProPlan = !isBeginner && hasCurrentCalculatorRecipe && (!!bakeAt || steps.length > 0);
  const planKey = bakeAt && hasCurrentCalculatorRecipe ? JSON.stringify([
    method,
    effectiveStyle,
    preferredYeastType,
    activeMixing,
    plannerOvenType,
    bakeAt.getTime(),
    steps.map((step) => step.at.getTime()),
    plannerDirectHomeSchedule,
    plannerBigaHomeSchedule,
    plannerPoolishHomeSchedule,
    activeCalculatorPlanSettings,
    activePlannerTegliaSettings,
  ]) : '';
  const canReconcilePlannerNotifications = !beginnerKamadoPlanBlocked && (!isBeginner || hasSharedCalculatorPlanSettings) && shouldReconcilePlannerNotifications(
    plannerRestoreStatus,
    isBeginner,
    !!bakeAt,
    !!planKey && hasCurrentBeginnerDirectSchedule,
  );

  useEffect(() => {
    if (isDeletingPlan || Platform.OS === 'web' || !isPushSupported() || !canReconcilePlannerNotifications) return;
    void cancelObsoletePlannerNotifications(planKey || null).catch((error) => {
      console.error('Unable to cancel notifications for an outdated Planner plan:', error);
    });
  }, [canReconcilePlannerNotifications, isDeletingPlan, planKey, scheduledPlanKey]);

  useEffect(() => {
    if (!isBeginner || pendingBeginnerReturnBakeAt.current === null || !bakeAt || !plannerDirectHomeSchedule) return;
    if (bakeAt.getTime() !== pendingBeginnerReturnBakeAt.current || plannerDirectHomeSchedule.bakeAt.getTime() !== bakeAt.getTime()) return;
    pendingBeginnerReturnBakeAt.current = null;
    router.replace('/(tabs)?focus=plan');
  }, [isBeginner, bakeAt, plannerDirectHomeSchedule, router]);

  const openPhaseEditor = (phase: PlannerPhaseStep) => {
    if (beginnerKamadoPlanBlocked || !plannerPhaseOverridesStorageKey || plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey) return;
    setEditingPhase(phase);
    setEditingPhaseDraft(new Date(phase.at));
    setEditingPhaseInput(formatLocalDateTimeInput(phase.at));
    setEditingPhasePickerMode(null);
  };
  const closePhaseEditor = () => {
    setEditingPhase(null);
    setEditingPhasePickerMode(null);
  };
  const savePhaseEdit = () => {
    if (beginnerKamadoPlanBlocked || !editingPhase) return;
    const at = Platform.OS === 'web' ? parseLocalDateTimeInput(editingPhaseInput) : editingPhaseDraft;
    if (!at || Number.isNaN(at.getTime())) {
      Alert.alert(t.planner.invalidDate);
      return;
    }
    if (!generatedSteps.some((step) => step.phaseKey === editingPhase.phaseKey)) {
      closePhaseEditor();
      return;
    }
    setPlannerPhaseOverrides((current) => ({
      ...current,
      [editingPhase.phaseKey]: at.getTime(),
    }));
    closePhaseEditor();
  };
  const onPhasePickerChange = (event: { type?: string }, selected?: Date) => {
    if (Platform.OS === 'android') {
      setEditingPhasePickerMode(null);
      if (event.type === 'dismissed') return;
    }
    if (!selected) return;
    setEditingPhaseDraft((current) => {
      const next = new Date(current);
      if (editingPhasePickerMode === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  // Native picker state (iOS/Android)
  const [pickerMode, setPickerMode] = useState<null | 'date' | 'time'>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  });

  // Web-only: text inputs (native picker doesn't render on web)
  const initial = new Date();
  initial.setHours(19, 0, 0, 0);
  initial.setDate(initial.getDate() + 1);
  const [webDateDraft, setWebDateDraft] = useState<string | null>(null);
  const [webTimeDraft, setWebTimeDraft] = useState<string | null>(null);
  const plannerBakeTargetReady = !beginnerKamadoPlanBlocked && (isBeginner || plannerBakeTargetLoadedFor === 'pro');
  const displayedBakeAt = bakeAt ?? (plannerBakeTargetReady ? initial : null);
  const webDate = webDateDraft
    ?? (displayedBakeAt
      ? `${displayedBakeAt.getFullYear()}-${pad(displayedBakeAt.getMonth() + 1)}-${pad(displayedBakeAt.getDate())}`
      : '');
  const webTime = webTimeDraft
    ?? (displayedBakeAt ? `${pad(displayedBakeAt.getHours())}:${pad(displayedBakeAt.getMinutes())}` : '');

  useEffect(() => {
    if (!experienceLoaded || isBeginner) return undefined;
    let active = true;
    setPlannerBakeTargetLoadedFor(null);
    void AsyncStorage.getItem(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY)
      .then((serialized) => {
        if (!active || serialized === null) return;
        const restored = parseProPlannerBakeTarget(serialized);
        if (!restored) {
          console.warn('Saved PRO Planner bake target is invalid; ignoring it.');
          Alert.alert(t.planner.bakeTargetRestoreFailed);
          return;
        }
        setSharedHomeBakeAt(restored);
        setWebDateDraft(null);
        setWebTimeDraft(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Failed to restore the saved PRO Planner bake target.', error);
        Alert.alert(t.planner.bakeTargetRestoreFailed);
      })
      .finally(() => {
        if (active) setPlannerBakeTargetLoadedFor('pro');
      });
    return () => {
      active = false;
    };
  }, [experienceLoaded, isBeginner, t.planner.bakeTargetRestoreFailed]);

  // Preset options for "when to bake"
  const now = new Date();
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  nextSat.setHours(18, 0, 0, 0);
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  inTwoDays.setHours(19, 0, 0, 0);
  const inFiveHours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  const presets = [
    { label: `+5h (${fmt(inFiveHours, lang)})`, date: inFiveHours },
    { label: `+2d (${fmt(inTwoDays, lang)})`, date: inTwoDays },
    { label: `${fmt(nextSat, lang)}`, date: nextSat },
  ];

  const generate = async (d: Date) => {
    if (!plannerBakeTargetReady) return false;
    if (Number.isNaN(d.getTime())) {
      Alert.alert(t.planner.invalidDate);
      return false;
    }
    if (d.getTime() <= Date.now()) {
      Alert.alert(t.planner.pastDate);
      return false;
    }
    const availableHours = (d.getTime() - Date.now()) / (60 * 60 * 1000);
    if ((isBeginner && availableHours < BEGINNER_DIRECT_MIN_WINDOW_HOURS) || (!isBeginner && availableHours < 1)) {
      Alert.alert(t.planner.shortTimeTitle, t.planner.shortTimeMessage, [{ text: t.planner.understand }]);
      return false;
    }
    if (!isBeginner) {
      try {
        await AsyncStorage.setItem(PRO_PLANNER_BAKE_TARGET_STORAGE_KEY, d.toISOString());
      } catch (error: unknown) {
        console.error('Failed to save the PRO Planner bake target.', error);
        Alert.alert(t.planner.bakeTargetSaveFailed);
        return false;
      }
    }
    setSharedHomeBakeAt(d);
    setWebDateDraft(null);
    setWebTimeDraft(null);
    if (isBeginner) {
      AsyncStorage.setItem('beginnerBakeAt', d.toISOString()).catch((error) => {
        console.error('Unable to persist the scheduled bake time:', error);
      });
    }
    setScheduledPlanKey(null);
    if (returnToBeginner.current) {
      returnToBeginner.current = false;
      router.replace(`/(tabs)?focus=${beginnerReturnSection.current}`);
    }
    return true;
  };

  const handlePlannerBack = () => {
    if (returnToBeginner.current) {
      router.replace(`/(tabs)?focus=${beginnerReturnSection.current}`);
    } else {
      router.back();
    }
  };

  const deletePlan = async () => {
    if (isBeginner || isDeletingPlan || schedulingAlarms.current || !hasProPlan) return;
    setIsDeletingPlan(true);
    setDeletePlanFailure(null);
    try {
      if (isPushSupported()) {
        const cancellation = await cancelPlannerNotificationsForPlan(
          [planKey, scheduledPlanKey].filter((planId): planId is string => !!planId),
        );
        if (!cancellation.supported || cancellation.remainingCount > 0 || cancellation.unassociatedCount > 0) {
          setScheduledPlanKey(null);
          setDeletePlanFailure('notifications');
          setDeletePlanConfirmationOpen(false);
          return;
        }
      }
      const storageKeys = [
        ...(plannerPhaseOverridesStorageKey ? [plannerPhaseOverridesStorageKey] : []),
        PRO_PLANNER_BAKE_TARGET_STORAGE_KEY,
      ];
      const savedPlanValues = await AsyncStorage.multiGet(storageKeys);
      try {
        await AsyncStorage.multiRemove(storageKeys);
      } catch (error: unknown) {
        const valuesToRestore = savedPlanValues.filter(
          (entry): entry is [string, string] => entry[1] !== null,
        );
        try {
          await AsyncStorage.multiSet(valuesToRestore);
        } catch (restoreError: unknown) {
          console.error('Failed to restore PRO Planner plan data after an incomplete deletion.', restoreError);
        }
        throw error;
      }
      setPlannerPhaseOverridesLoadedFor(null);
      setPlannerPhaseOverrides({});
      setStaleProOverridesWarningFor(null);
      setSharedHomeBakeAt(null);
      setWebDateDraft(null);
      setWebTimeDraft(null);
      setScheduledPlanKey(null);
      setEditingPhase(null);
      setDeletePlanConfirmationOpen(false);
    } catch (error: unknown) {
      console.error('Failed to delete the saved PRO Planner plan.', error);
      setScheduledPlanKey(null);
      setDeletePlanFailure('storage');
      setDeletePlanConfirmationOpen(false);
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const scheduleAll = async () => {
    if (beginnerKamadoPlanBlocked || schedulingAlarms.current || isDeletingPlan) return;
    schedulingAlarms.current = true;
    setIsSchedulingAlarms(true);
    let createdIdentifiers: string[] = [];
    try {
      if (Platform.OS === 'web' || !isPushSupported()) {
        Alert.alert(t.planner.alarmUnavailable);
        return;
      }
      if (scheduledPlanKey === planKey) {
        Alert.alert(t.planner.alarmsAlreadySet);
        return;
      }
      if (!await requestNotificationPermissions()) {
        Alert.alert(t.planner.permissionRequired);
        return;
      }
      const futureSteps = steps.filter((s) => s.at.getTime() > Date.now());
      if (!futureSteps.length) {
        Alert.alert(t.planner.pastDate);
        return;
      }
      createdIdentifiers = await scheduleNotificationBatch(
        futureSteps,
        (s) => {
          const trigger = s.at.getTime() - Date.now();
          return scheduleLocal(`🍕 ${s.title}`, s.desc, Math.round(trigger / 1000), {
            source: 'pizza-planner',
            method,
            planId: planKey,
          });
        },
        cancelLocal,
      );
      if (createdIdentifiers.length !== futureSteps.length) {
        throw new Error(`Planner alarm scheduling returned ${createdIdentifiers.length} of ${futureSteps.length} identifiers.`);
      }
      await cancelPlannerNotificationsForMethodsExcept(
        ['direct', 'biga', 'poolish'],
        new Set(createdIdentifiers),
      );
      setScheduledPlanKey(planKey);
      Alert.alert(t.planner.alarmsSet.replace('{N}', String(createdIdentifiers.length)));
    } catch (error) {
      await Promise.all(createdIdentifiers.map(cancelLocal));
      console.error('Unable to schedule the complete Planner alarm set:', error);
      Alert.alert(t.planner.alarmFailed);
    } finally {
      schedulingAlarms.current = false;
      setIsSchedulingAlarms(false);
    }
  };

  const openDatePicker = () => {
    if (!plannerBakeTargetReady) return;
    if (Platform.OS === 'web') return; // web uses inline text inputs
    setPickerDraft(bakeAt ?? pickerDraft);
    setPickerMode('date');
  };

  const onPickerChange = (event: any, selected?: Date) => {
    // Android: closes immediately after pick; iOS: keeps open
    const type = event?.type;
    if (Platform.OS === 'android') {
      setPickerMode(null);
      if (type === 'dismissed') return;
    }
    if (selected) {
      setPickerDraft(selected);
      if (Platform.OS === 'android') {
        if (pickerMode === 'date') {
          // After date is picked, immediately open time picker
          setTimeout(() => setPickerMode('time'), 100);
        } else {
          generate(selected);
        }
      }
    }
  };

  const iosConfirm = () => {
    setPickerMode(null);
    generate(pickerDraft);
  };

  // Web: build Date from inputs and generate
  const applyWebDateTime = () => {
    // Parse YYYY-MM-DD and HH:MM
    const [y, m, d] = webDate.split('-').map((x) => Number(x));
    const [hh, mm] = webTime.split(':').map((x) => Number(x));
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || !Number.isInteger(hh) || !Number.isInteger(mm)) {
      Alert.alert(t.planner.invalidDate);
      return;
    }
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (
      Number.isNaN(dt.getTime())
      || dt.getFullYear() !== y
      || dt.getMonth() !== m - 1
      || dt.getDate() !== d
      || dt.getHours() !== hh
      || dt.getMinutes() !== mm
    ) {
      Alert.alert(t.planner.invalidDate);
      return;
    }
    generate(dt);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="planner-back" accessibilityRole="button" accessibilityLabel={t.common.back} onPress={handlePlannerBack} style={styles.backButton}>
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backButtonText}>{t.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.planner.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.lg }}>
        {beginnerKamadoPlanBlocked ? (
          <View testID="beginner-kamado-plan-warning" accessibilityRole="alert" style={styles.staleOverrideNotice}>
            <Text style={styles.staleOverrideNoticeText}>{({
              hr: 'Plan za Kamado trenutačno nije dostupan jer vrijeme pečenja nije odobreno. Odaberite drugu peć za izradu plana.',
              en: 'A Kamado plan is currently unavailable because its baking time has not been approved. Choose another oven to create a plan.',
              de: 'Ein Kamado-Plan ist derzeit nicht verfügbar, da die Backzeit nicht freigegeben ist. Wählen Sie einen anderen Ofen, um einen Plan zu erstellen.',
              sl: 'Načrt za Kamado trenutno ni na voljo, ker čas peke ni odobren. Za izdelavo načrta izberite drugo peč.',
            }[lang])}</Text>
          </View>
        ) : null}
        {deletePlanFailure ? (
          <View testID="delete-plan-notice" accessibilityRole="alert" style={styles.staleOverrideNotice}>
            <Text style={styles.staleOverrideNoticeText}>
              {deletePlanFailure === 'notifications'
                ? t.planner.deletePlanNotificationsUnconfirmed
                : t.planner.deletePlanStorageFailed}
            </Text>
          </View>
        ) : null}
        {!isBeginner
          && Platform.OS === 'web'
          && plannerPhaseOverridesStorageKey !== null
          && staleProOverridesWarningFor !== null
          && staleProOverridesWarningFor === plannerPhaseOverridesStorageKey ? (
            <View testID="stale-pro-phase-override-warning" accessibilityRole="alert" style={styles.staleOverrideNotice}>
              <Text style={styles.staleOverrideNoticeText}>{t.planner.stalePhaseOverridesNotApplied}</Text>
            </View>
          ) : null}
        {/* Custom date+time entry */}
        <View style={styles.card}>
          <Text style={styles.label}>{t.planner.customTitle}</Text>

          {Platform.OS === 'web' ? (
            <View style={{ gap: SPACING.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.microLabel}>{t.planner.customDate}</Text>
                  <TextInput
                    testID="web-date"
                    // @ts-expect-error web-only prop
                    type="date"
                    value={webDate}
                    onChangeText={setWebDateDraft}
                    editable={plannerBakeTargetReady}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.microLabel}>{t.planner.customTime}</Text>
                  <TextInput
                    testID="web-time"
                    // @ts-expect-error web-only prop
                    type="time"
                    value={webTime}
                    onChangeText={setWebTimeDraft}
                    editable={plannerBakeTargetReady}
                    style={styles.textInput}
                  />
                </View>
              </View>
              <View style={styles.planActionRow}>
                <Pressable testID="web-apply" onPress={applyWebDateTime} disabled={!plannerBakeTargetReady} style={[styles.primaryBtn, styles.planActionButton]}>
                  <Icon name="calendar" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>{t.planner.customApply}</Text>
                </Pressable>
                {hasProPlan ? (
                  <Pressable
                    testID="delete-plan"
                    accessibilityRole="button"
                    onPress={() => setDeletePlanConfirmationOpen(true)}
                    disabled={isDeletingPlan || isSchedulingAlarms}
                    style={styles.deletePlanButton}
                  >
                    <Icon name="trash-outline" size={16} color={COLORS.error} />
                    <Text style={styles.deletePlanButtonText}>{t.planner.deletePlan}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <Pressable testID="open-datepicker" onPress={openDatePicker} disabled={!plannerBakeTargetReady} style={styles.dateBtn}>
              <Icon name="calendar-outline" size={20} color={COLORS.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dateBtnLabel}>{bakeAt ? fmt(bakeAt, lang) : t.planner.mobilePickerHint}</Text>
                <Text style={styles.dateBtnSub}>{bakeAt ? t.planner.mobilePickerChange : t.planner.mobilePickerHelp}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.muted} />
            </Pressable>
          )}
          {Platform.OS !== 'web' && hasProPlan ? (
            <Pressable
              testID="delete-plan"
              accessibilityRole="button"
              onPress={() => setDeletePlanConfirmationOpen(true)}
              disabled={isDeletingPlan || isSchedulingAlarms}
              style={styles.deletePlanButton}
            >
              <Icon name="trash-outline" size={16} color={COLORS.error} />
              <Text style={styles.deletePlanButtonText}>{t.planner.deletePlan}</Text>
            </Pressable>
          ) : null}

          {pickerMode ? (
            <View>
              <DateTimePicker
                value={pickerDraft}
                mode={pickerMode}
                is24Hour
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
              {Platform.OS === 'ios' ? (
                <View style={styles.iosRow}>
                  <Pressable onPress={() => setPickerMode(null)} style={[styles.iosBtn, { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }]}>
                    <Text style={[styles.iosBtnText, { color: COLORS.onSurface }]}>{t.planner.cancel}</Text>
                  </Pressable>
                  {pickerMode === 'date' ? (
                    <Pressable onPress={() => setPickerMode('time')} style={[styles.iosBtn, { backgroundColor: COLORS.brand }]}>
                      <Text style={styles.iosBtnText}>{t.planner.nextToTime}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={iosConfirm} style={[styles.iosBtn, { backgroundColor: COLORS.brand }]}>
                      <Text style={styles.iosBtnText}>{t.planner.confirm}</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Quick presets */}
        <View style={styles.card}>
          <Text style={styles.label}>{t.planner.presetsTitle}</Text>
          <View style={{ gap: SPACING.sm }}>
            {presets.map((p, i) => (
              <Pressable
                key={i}
                testID={`preset-${i}`}
                onPress={() => { void generate(p.date); }}
                disabled={!plannerBakeTargetReady}
                style={[styles.optRow, bakeAt?.getTime() === p.date.getTime() && styles.optRowActive]}
              >
                <Icon name="flash" size={18} color={COLORS.brand} />
                <Text style={styles.optText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {steps.length > 0 ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.stepsHeader}>{t.planner.steps}</Text>
              <Pressable testID="schedule-alarms" onPress={scheduleAll} disabled={isSchedulingAlarms || isDeletingPlan} style={styles.alarmBtn}>
                <Icon name="alarm" size={16} color="#fff" />
                <Text style={styles.alarmBtnText}>{t.planner.setAlarms}</Text>
              </Pressable>
            </View>
            {plannerYeastSummaryText ? <Text style={styles.stepDesc}>{plannerYeastSummaryText}</Text> : null}
            {plannerPrefermentSettingsText ? <Text testID="planner-preferment-settings" style={styles.stepDesc}>{plannerPrefermentSettingsText}</Text> : null}
            {steps.map((s, i) => (
              <View key={s.phaseKey} style={styles.stepItem}>
                <View style={styles.stepDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepDate}>{fmtPlanDate(s.at, lang)}</Text>
                  <Text style={styles.stepTime}>{fmtPlanTime(s.at, lang)}</Text>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                  <Pressable
                    testID={`edit-phase-${i}`}
                    accessibilityRole="button"
                    onPress={() => openPhaseEditor(s)}
                    style={styles.editPhaseButton}
                  >
                    <Icon name="create-outline" size={15} color={COLORS.brand} />
                    <Text style={styles.editPhaseText}>{t.planner.editPhase}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : beginnerKamadoPlanBlocked ? null : (
          <View style={styles.empty}>
            <Icon name="time-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyText}>
              {isBeginner && bakeAt ? t.planner.beginnerScheduleUnavailable : t.planner.empty}
            </Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={deletePlanConfirmationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeletingPlan) setDeletePlanConfirmationOpen(false);
        }}
      >
        <View style={styles.phaseModalBackdrop}>
          <View style={styles.phaseModal}>
            <Text testID="delete-plan-confirmation-title" style={styles.phaseModalTitle}>{t.planner.deletePlanTitle}</Text>
            <Text style={styles.deletePlanMessage}>{t.planner.deletePlanMessage}</Text>
            <View style={styles.phaseModalActions}>
              <Pressable
                testID="delete-plan-cancel"
                accessibilityRole="button"
                onPress={() => setDeletePlanConfirmationOpen(false)}
                disabled={isDeletingPlan || isSchedulingAlarms}
                style={styles.phaseCancelButton}
              >
                <Text style={styles.phaseCancelText}>{t.planner.cancel}</Text>
              </Pressable>
              <Pressable
                testID="delete-plan-confirm"
                accessibilityRole="button"
                onPress={() => { void deletePlan(); }}
                disabled={isDeletingPlan || isSchedulingAlarms}
                style={styles.deletePlanConfirmButton}
              >
                <Text style={styles.deletePlanConfirmText}>{t.planner.deletePlan}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editingPhase !== null}
        transparent
        animationType="fade"
        onRequestClose={closePhaseEditor}
      >
        <View style={styles.phaseModalBackdrop}>
          <View style={styles.phaseModal}>
            <Text style={styles.phaseModalTitle}>{t.planner.editPhase}</Text>
            <Text style={styles.stepTitle}>{editingPhase?.title}</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                testID="phase-time-input"
                // @ts-expect-error web-only prop
                type="datetime-local"
                value={editingPhaseInput}
                onChangeText={setEditingPhaseInput}
                style={styles.textInput}
              />
            ) : (
              <>
                <View style={styles.row}>
                  <Pressable
                    testID="phase-edit-date"
                    onPress={() => setEditingPhasePickerMode('date')}
                    style={styles.dateBtn}
                  >
                    <Text style={styles.dateBtnLabel}>{t.planner.customDate}</Text>
                    <Text style={styles.dateBtnSub}>{fmtPlanDate(editingPhaseDraft, lang)}</Text>
                  </Pressable>
                  <Pressable
                    testID="phase-edit-time"
                    onPress={() => setEditingPhasePickerMode('time')}
                    style={styles.dateBtn}
                  >
                    <Text style={styles.dateBtnLabel}>{t.planner.customTime}</Text>
                    <Text style={styles.dateBtnSub}>{fmtPlanTime(editingPhaseDraft, lang)}</Text>
                  </Pressable>
                </View>
                {editingPhasePickerMode ? (
                  <DateTimePicker
                    testID="phase-date-time-picker"
                    value={editingPhaseDraft}
                    mode={editingPhasePickerMode}
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPhasePickerChange}
                  />
                ) : null}
              </>
            )}
            <View style={styles.phaseModalActions}>
              <Pressable testID="phase-edit-cancel" onPress={closePhaseEditor} style={styles.phaseCancelButton}>
                <Text style={styles.phaseCancelText}>{t.planner.cancel}</Text>
              </Pressable>
              <Pressable testID="phase-edit-save" onPress={savePhaseEdit} disabled={beginnerKamadoPlanBlocked} style={[styles.primaryBtn, beginnerKamadoPlanBlocked && { opacity: 0.5 }]}>
                <Text style={styles.primaryBtnText}>{t.planner.savePhase}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  backButtonText: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  card: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  staleOverrideNotice: { padding: SPACING.md, borderWidth: 1, borderColor: COLORS.warning, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary },
  staleOverrideNoticeText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  label: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  microLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: SPACING.md, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: SPACING.md },
  textInput: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 15, color: COLORS.onSurface },
  primaryBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brand, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  planActionRow: { flexDirection: 'row', gap: SPACING.sm },
  planActionButton: { flex: 1 },
  deletePlanButton: { flex: 1, flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.surface },
  deletePlanButtonText: { color: COLORS.error, fontSize: 13, fontWeight: '700' },
  deletePlanMessage: { color: COLORS.onSurface, fontSize: 14, lineHeight: 20 },
  deletePlanConfirmButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.error },
  deletePlanConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  dateBtnLabel: { color: COLORS.onSurface, fontSize: 15, fontWeight: '700' },
  dateBtnSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  iosRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  iosBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  iosBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  optRowActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  optText: { color: COLORS.onSurface, fontSize: 14 },
  stepsHeader: { fontSize: 15, fontWeight: '800', color: COLORS.brand, textTransform: 'uppercase', letterSpacing: 0.5 },
  alarmBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: COLORS.brand, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill },
  alarmBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stepItem: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.brand, marginTop: 6 },
  stepTime: { fontSize: 12, color: COLORS.brand, fontWeight: '700' },
  stepDate: { fontSize: 12, color: COLORS.muted, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface, marginTop: 2 },
  stepDesc: { fontSize: 13, color: COLORS.muted, marginTop: 2, lineHeight: 18 },
  editPhaseButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: SPACING.sm, paddingVertical: 4 },
  editPhaseText: { color: COLORS.brand, fontSize: 12, fontWeight: '700' },
  phaseModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, backgroundColor: 'rgba(0,0,0,0.45)' },
  phaseModal: { width: '100%', maxWidth: 480, padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  phaseModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  phaseModalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  phaseCancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  phaseCancelText: { color: COLORS.onSurface, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  emptyText: { color: COLORS.muted, fontSize: 15 },
});
