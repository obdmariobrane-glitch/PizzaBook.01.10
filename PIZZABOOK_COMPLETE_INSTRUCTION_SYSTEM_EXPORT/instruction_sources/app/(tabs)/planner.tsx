import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useT } from '../../src/i18n/LanguageProvider';
import { getCachedExperienceLevel, subscribeExperienceLevel } from '../../src/experienceLevel';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedTemperatureUnit, subscribeTemperatureUnit, getCachedMeasurementSystem, subscribeMeasurementSystem } from '../../src/preferences';
import { formatTemperature, formatUnitText } from '../../src/units';
import { getCachedPreferredYeastType, subscribePreferredYeastType } from '../../src/preferences';
import { getPlannerNotificationRestoreStatus, shouldReconcilePlannerNotifications, subscribePlannerNotificationRestoreStatus } from '../../src/beginnerPlanRestoreCoordinator';
import {
  getDirectHomeFermentationSchedule, getFermentationSchedule, getTemperingWindow, reversePlan, selectPlannerHomeSchedules, Method, PizzaStyle,
  PlannerTegliaSettings,
  BEGINNER_DIRECT_MIN_WINDOW_HOURS,
  getSharedCalculatorPlanSettings, subscribeSharedCalculatorPlanSettings,
  parseMixingSelection, toCalculatorMixing,
  getSharedHomeBakeAt, setSharedHomeBakeAt, subscribeSharedHomeBakeAt,
  getSharedHomeDirectSchedule, subscribeSharedHomeDirectSchedule,
  getSharedHomeDirectScheduleMode,
  getSharedHomeBigaSchedule, subscribeSharedHomeBigaSchedule,
  getSharedHomePoolishSchedule, subscribeSharedHomePoolishSchedule,
} from '../../src/calculator';
import { cancelLocal, cancelObsoletePlannerNotifications, cancelPlannerNotificationsForMethods, cancelPlannerNotificationsForMethodsExcept, isPushSupported, requestNotificationPermissions, scheduleNotificationBatch, scheduleLocal } from '../../src/notifications';
import { getSpiralPlannerNote } from '../../src/i18n/spiralMixing';
import {
  applyPlannerPhaseOverrides,
  assignPlannerPhaseKeys,
  getPlannerPhaseOverridesStorageKey,
  parsePlannerPhaseOverrides,
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
  roomTemp: number;
  roomHours: number;
  fridgeTemp: number;
  fridgeHours: number;
  bigaHours: number;
  poolishHours: number;
};

const DEFAULT_CALCULATOR_PLAN_SETTINGS: CalculatorPlanSettings = {
  roomTemp: 22,
  roomHours: 2,
  fridgeTemp: 4,
  fridgeHours: 24,
  bigaHours: 24,
  poolishHours: 24,
};

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
  const [plannerSelectionManuallyChanged, setPlannerSelectionManuallyChanged] = useState(false);
  const [style, setStyle] = useState<PizzaStyle>('neapolitan');
  const [selectedMethod, setSelectedMethod] = useState<Method>('direct');
  const [calculatorPlanSettings, setCalculatorPlanSettings] = useState(DEFAULT_CALCULATOR_PLAN_SETTINGS);
  const [plannerTegliaSettings, setPlannerTegliaSettings] = useState(DEFAULT_PLANNER_TEGLIA_SETTINGS);
  const [plannerMixing, setPlannerMixing] = useState<'hand' | 'home' | 'spiral'>('hand');
  const [plannerPhaseOverrides, setPlannerPhaseOverrides] = useState<PlannerPhaseOverrides>({});
  const [plannerPhaseOverridesLoadedFor, setPlannerPhaseOverridesLoadedFor] = useState<string | null>(null);
  const plannerPhaseOverridesStorageKey = getPlannerPhaseOverridesStorageKey(isBeginner ? 'beginner' : 'pro');
  const [editingPhase, setEditingPhase] = useState<PlannerPhaseStep | null>(null);
  const [editingPhaseDraft, setEditingPhaseDraft] = useState<Date>(() => new Date());
  const [editingPhaseInput, setEditingPhaseInput] = useState('');
  const [editingPhasePickerMode, setEditingPhasePickerMode] = useState<null | 'date' | 'time'>(null);
  const [isSchedulingAlarms, setIsSchedulingAlarms] = useState(false);
  const schedulingAlarms = useRef(false);
  const [roomTempLoaded, setRoomTempLoaded] = useState(false);
  useEffect(() => {
    if (!experienceLoaded) return undefined;
    let active = true;
    void AsyncStorage.getItem(plannerPhaseOverridesStorageKey)
      .then((serialized) => {
        if (!active) return;
        setPlannerPhaseOverrides(parsePlannerPhaseOverrides(serialized));
      })
      .catch((error: unknown) => {
        console.error('Failed to load saved Planner phase edits.', error);
        if (active) setPlannerPhaseOverrides({});
      })
      .finally(() => {
        if (active) setPlannerPhaseOverridesLoadedFor(plannerPhaseOverridesStorageKey);
      });
    return () => {
      active = false;
    };
  }, [experienceLoaded, plannerPhaseOverridesStorageKey]);
  useEffect(() => {
    if (plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey) return;
    void AsyncStorage.setItem(
      plannerPhaseOverridesStorageKey,
      JSON.stringify(plannerPhaseOverrides),
    ).catch((error: unknown) => {
      console.error('Failed to save Planner phase edits.', error);
    });
  }, [plannerPhaseOverrides, plannerPhaseOverridesLoadedFor, plannerPhaseOverridesStorageKey]);
  const method: Method = isBeginner
    ? 'direct'
    : sharedCalculatorPlanSettings && !plannerSelectionManuallyChanged
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
    : sharedCalculatorPlanSettings && !plannerSelectionManuallyChanged
      ? sharedCalculatorPlanSettings.pizzaStyle
      : style;
  const effectiveStyleName = isBeginner && effectiveStyle === 'romana'
    ? plannerDirectHomeSchedule?.romanFormat === 'teglia' ? 'Romana Teglia' : 'Romana Tonda'
    : t.calc.pizzaStyles[effectiveStyle].name;
  const plannerStepCopy = isBeginner
    ? t.planner.stepCopy
    : { ...t.planner.stepCopy, directHomeCopy: undefined };
  const activeCalculatorPlanSettings = useMemo(() => sharedCalculatorPlanSettings
    ? {
      roomTemp: sharedCalculatorPlanSettings.roomTemp,
      roomHours: sharedCalculatorPlanSettings.roomHours,
      fridgeTemp: sharedCalculatorPlanSettings.fridgeTemp,
      fridgeHours: sharedCalculatorPlanSettings.fridgeHours,
      bigaHours: sharedCalculatorPlanSettings.bigaHours,
      poolishHours: sharedCalculatorPlanSettings.poolishHours,
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
  useFocusEffect(useCallback(() => {
    let current = true;
    setRoomTempLoaded(false);
    void AsyncStorage.getItem('calculatorSettings')
      .then((value) => {
        if (!value) {
          if (current) {
            setCalculatorPlanSettings(DEFAULT_CALCULATOR_PLAN_SETTINGS);
            setPlannerTegliaSettings(DEFAULT_PLANNER_TEGLIA_SETTINGS);
          }
          return;
        }
        const settings: unknown = JSON.parse(value);
        if (!isRecord(settings)) {
          console.warn('Saved calculator settings are invalid; Planner will use its default fermentation settings.');
          if (current) {
            setCalculatorPlanSettings(DEFAULT_CALCULATOR_PLAN_SETTINGS);
            setPlannerTegliaSettings(DEFAULT_PLANNER_TEGLIA_SETTINGS);
          }
          return;
        }
        const readNumber = (key: keyof CalculatorPlanSettings) => {
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
        const trayWidth = readPositiveSetting('trayWidth', DEFAULT_PLANNER_TEGLIA_SETTINGS.trayWidth);
        const trayLength = readPositiveSetting('trayLength', DEFAULT_PLANNER_TEGLIA_SETTINGS.trayLength);
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
        if (current) {
            if (!getSharedCalculatorPlanSettings()) {
              if (settings.pizzaStyle === 'neapolitan' || settings.pizzaStyle === 'romana' || settings.pizzaStyle === 'ny_style') {
                setStyle(settings.pizzaStyle);
              }
              if (settings.method === 'direct' || settings.method === 'biga' || settings.method === 'poolish') {
                setSelectedMethod(settings.method);
              }
              const savedMixing = parseMixingSelection(settings.mixing);
              if (savedMixing) setPlannerMixing(toCalculatorMixing(savedMixing));
            }
            setCalculatorPlanSettings({
            roomTemp: readNumber('roomTemp'),
            roomHours: readNumber('roomHours'),
            fridgeTemp: readNumber('fridgeTemp'),
            fridgeHours: readNumber('fridgeHours'),
            bigaHours: readNumber('bigaHours'),
            poolishHours: readNumber('poolishHours'),
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
    if (experienceLoaded && isBeginner) {
      void cancelPlannerNotificationsForMethods(['biga', 'poolish']).catch((error) => {
        console.error('Unable to cancel unsupported Beginner Planner alarms:', error);
      });
    }
  }, [experienceLoaded, isBeginner]);
  const hasCurrentBeginnerDirectSchedule = !isBeginner || !!plannerDirectHomeSchedule;
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
    if (!plannerSelectionManuallyChanged
      && sharedCalculatorPlanSettings
      && method === sharedCalculatorPlanSettings.method
      && effectiveStyle === sharedCalculatorPlanSettings.pizzaStyle
      && sharedCalculatorPlanSettings.proFermentationSchedule) {
      return sharedCalculatorPlanSettings.proFermentationSchedule;
    }
    if (method === 'direct' && plannerDirectHomeSchedule) {
      return getDirectHomeFermentationSchedule(
        plannerDirectHomeSchedule,
        activeCalculatorPlanSettings.roomTemp,
        activeCalculatorPlanSettings.fridgeTemp,
      );
    }
    const roomAfterFridgeHours = activeCalculatorPlanSettings.fridgeHours > 0
      ? getTemperingWindow(activeCalculatorPlanSettings.roomTemp).initialMinutes / 60
      : 0;
    return getFermentationSchedule({
      method,
      roomHours: activeCalculatorPlanSettings.roomHours,
      roomTemp: activeCalculatorPlanSettings.roomTemp,
      fridgeHours: activeCalculatorPlanSettings.fridgeHours,
      fridgeTemp: activeCalculatorPlanSettings.fridgeTemp,
      roomAfterFridgeHours,
      ...(method === 'biga' ? { prefermentHours: activeCalculatorPlanSettings.bigaHours } : {}),
      ...(method === 'poolish' ? { prefermentHours: activeCalculatorPlanSettings.poolishHours } : {}),
    });
  })();
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
  const generatedSteps = assignPlannerPhaseKeys(bakeAt && hasCurrentBeginnerDirectSchedule && (roomTempLoaded || !!sharedCalculatorPlanSettings) ? reversePlan(bakeAt, method, effectiveStyle, plannerStepCopy, plannerDirectHomeSchedule, plannerBigaHomeSchedule, plannerPoolishHomeSchedule, lang, formatTemperature(plannerDirectHomeSchedule?.ovenTemp ?? 250, temperatureUnit), activeCalculatorPlanSettings.roomTemp, isBeginner ? undefined : plannerFermentationSchedule, activePlannerTegliaSettings).map((step) => ({
    ...step,
    desc: formatUnitText(
      plannerMixTitles.includes(step.title)
        ? `${step.desc}\n\n${plannerStepCopy.yeastHandling[preferredYeastType]}${activeMixing === 'spiral' ? `\n\n${getSpiralPlannerNote(lang)}` : ''}`
        : step.desc,
      temperatureUnit,
      measurementSystem,
    ),
  })) : [], isBeginner ? JSON.stringify(['beginner', effectiveStyle, activePlannerTegliaSettings.romanFormat, method, activeMixing]) : undefined);
  const phaseKeySignature = JSON.stringify(generatedSteps.map((step) => step.phaseKey));
  useEffect(() => {
    const currentPhaseKeys: string[] = JSON.parse(phaseKeySignature);
    if (plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey || currentPhaseKeys.length === 0) return;
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
  const activePhaseOverrides = plannerPhaseOverridesLoadedFor === plannerPhaseOverridesStorageKey
    ? plannerPhaseOverrides
    : {};
  const steps = applyPlannerPhaseOverrides(generatedSteps, activePhaseOverrides);
  const planKey = bakeAt ? JSON.stringify([
    method,
    effectiveStyle,
    preferredYeastType,
    activeMixing,
    bakeAt.getTime(),
    steps.map((step) => step.at.getTime()),
    plannerDirectHomeSchedule,
    plannerBigaHomeSchedule,
    plannerPoolishHomeSchedule,
    activeCalculatorPlanSettings,
    activePlannerTegliaSettings,
  ]) : '';
  const canReconcilePlannerNotifications = shouldReconcilePlannerNotifications(
    plannerRestoreStatus,
    isBeginner,
    !!bakeAt,
    !!planKey && hasCurrentBeginnerDirectSchedule,
  );

  useEffect(() => {
    if (Platform.OS === 'web' || !isPushSupported() || !canReconcilePlannerNotifications) return;
    void cancelObsoletePlannerNotifications(planKey || null).catch((error) => {
      console.error('Unable to cancel notifications for an outdated Planner plan:', error);
    });
  }, [canReconcilePlannerNotifications, planKey, scheduledPlanKey]);

  useEffect(() => {
    if (!isBeginner || pendingBeginnerReturnBakeAt.current === null || !bakeAt || !plannerDirectHomeSchedule) return;
    if (bakeAt.getTime() !== pendingBeginnerReturnBakeAt.current || plannerDirectHomeSchedule.bakeAt.getTime() !== bakeAt.getTime()) return;
    pendingBeginnerReturnBakeAt.current = null;
    router.replace('/(tabs)?focus=plan');
  }, [isBeginner, bakeAt, plannerDirectHomeSchedule, router]);

  const openPhaseEditor = (phase: PlannerPhaseStep) => {
    if (plannerPhaseOverridesLoadedFor !== plannerPhaseOverridesStorageKey) return;
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
    if (!editingPhase) return;
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
  const displayedBakeAt = bakeAt ?? initial;
  const webDate = webDateDraft
    ?? `${displayedBakeAt.getFullYear()}-${pad(displayedBakeAt.getMonth() + 1)}-${pad(displayedBakeAt.getDate())}`;
  const webTime = webTimeDraft ?? `${pad(displayedBakeAt.getHours())}:${pad(displayedBakeAt.getMinutes())}`;

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

  const generate = (d: Date) => {
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

  const scheduleAll = async () => {
    if (schedulingAlarms.current) return;
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
        <View style={styles.card}>
          <Text style={styles.label}>{t.planner.style}</Text>
          {isBeginner ? (
            <Text style={styles.stepTitle}>{effectiveStyleName}</Text>
          ) : (
            <View style={styles.chipRow}>
              {(['neapolitan', 'romana', 'ny_style'] as PizzaStyle[]).map((key) => (
                <Pressable
                  key={key}
                  testID={`planner-style-${key}`}
                  onPress={() => {
                    setPlannerSelectionManuallyChanged(true);
                    setStyle(key);
                  }}
                  style={[styles.chip, effectiveStyle === key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, effectiveStyle === key && { color: '#fff' }]}>{t.calc.pizzaStyles[key].name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t.planner.method}</Text>
          <View style={styles.chipRow}>
            {[
              { key: 'direct' as const, l: t.calc.direct },
              { key: 'biga' as const, l: t.calc.biga },
              { key: 'poolish' as const, l: t.calc.poolish },
            ].filter((m) => isBeginner ? m.key === 'direct' : true).map((m) => (
              <Pressable
                key={m.key}
                testID={`planner-method-${m.key}`}
                onPress={() => {
                  setPlannerSelectionManuallyChanged(true);
                  setSelectedMethod(m.key);
                }}
                style={[styles.chip, method === m.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, method === m.key && { color: '#fff' }]}>{m.l}</Text>
              </Pressable>
            ))}
          </View>
        </View>

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
                    style={styles.textInput}
                  />
                </View>
              </View>
              <Pressable testID="web-apply" onPress={applyWebDateTime} style={styles.primaryBtn}>
                <Icon name="calendar" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>{t.planner.customApply}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable testID="open-datepicker" onPress={openDatePicker} style={styles.dateBtn}>
              <Icon name="calendar-outline" size={20} color={COLORS.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dateBtnLabel}>{bakeAt ? fmt(bakeAt, lang) : t.planner.mobilePickerHint}</Text>
                <Text style={styles.dateBtnSub}>{bakeAt ? t.planner.mobilePickerChange : t.planner.mobilePickerHelp}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.muted} />
            </Pressable>
          )}

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
                onPress={() => generate(p.date)}
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
              <Pressable testID="schedule-alarms" onPress={scheduleAll} disabled={isSchedulingAlarms} style={styles.alarmBtn}>
                <Icon name="alarm" size={16} color="#fff" />
                <Text style={styles.alarmBtnText}>{t.planner.setAlarms}</Text>
              </Pressable>
            </View>
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
        ) : (
          <View style={styles.empty}>
            <Icon name="time-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyText}>
              {isBeginner && bakeAt ? t.planner.beginnerScheduleUnavailable : t.planner.empty}
            </Text>
          </View>
        )}
      </ScrollView>
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
              <Pressable testID="phase-edit-save" onPress={savePhaseEdit} style={styles.primaryBtn}>
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
