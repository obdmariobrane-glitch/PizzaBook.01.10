import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useT } from '../../src/i18n/LanguageProvider';
import { getCachedExperienceLevel, subscribeExperienceLevel } from '../../src/experienceLevel';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedTemperatureUnit, subscribeTemperatureUnit, getCachedMeasurementSystem, subscribeMeasurementSystem } from '../../src/preferences';
import { formatTemperature, formatUnitText } from '../../src/units';
import {
  reversePlan, Method, PizzaStyle,
  BEGINNER_DIRECT_MAX_WINDOW_HOURS, BEGINNER_DIRECT_MIN_WINDOW_HOURS,
  getSharedHomeBakeAt, setSharedHomeBakeAt, subscribeSharedHomeBakeAt,
  getSharedHomeDirectSchedule, subscribeSharedHomeDirectSchedule,
  getSharedHomeBigaSchedule, subscribeSharedHomeBigaSchedule,
  getSharedHomePoolishSchedule, subscribeSharedHomePoolishSchedule,
} from '../../src/calculator';
import { scheduleLocal, cancelPlannerNotificationsForMethods, isPushSupported, requestNotificationPermissions } from '../../src/notifications';

function fmt(d: Date) {
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function fmtPlanDate(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'en-GB', { dateStyle: 'medium' }).format(d);
}

function fmtPlanTime(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'en-GB', { timeStyle: 'short' }).format(d);
}

function pad(n: number) { return String(n).padStart(2, '0'); }

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
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const [style, setStyle] = useState<PizzaStyle>('neapolitan');
  const [selectedMethod, setSelectedMethod] = useState<Method>('direct');
  const method: Method = isBeginner ? 'direct' : selectedMethod;
  const bakeAt = useSyncExternalStore(subscribeSharedHomeBakeAt, getSharedHomeBakeAt, getSharedHomeBakeAt);
  const directHomeSchedule = useSyncExternalStore(subscribeSharedHomeDirectSchedule, getSharedHomeDirectSchedule, getSharedHomeDirectSchedule);
  const bigaHomeSchedule = useSyncExternalStore(subscribeSharedHomeBigaSchedule, getSharedHomeBigaSchedule, getSharedHomeBigaSchedule);
  const poolishHomeSchedule = useSyncExternalStore(subscribeSharedHomePoolishSchedule, getSharedHomePoolishSchedule, getSharedHomePoolishSchedule);
  const [scheduledPlanKey, setScheduledPlanKey] = useState<string | null>(null);
  const pendingBeginnerReturnBakeAt = useRef<number | null>(null);
  const effectiveStyle = isBeginner && directHomeSchedule?.style ? directHomeSchedule.style : style;
  const effectiveStyleName = isBeginner && effectiveStyle === 'romana'
    ? directHomeSchedule?.romanFormat === 'teglia' ? 'Romana Teglia' : 'Romana Tonda'
    : t.calc.pizzaStyles[effectiveStyle].name;
  const plannerStepCopy = isBeginner
    ? t.planner.stepCopy
    : { ...t.planner.stepCopy, directHomeCopy: undefined };
  useEffect(() => {
    returnToBeginner.current = returnTo === 'beginner';
    if (returnSection === 'style' || returnSection === 'plan') beginnerReturnSection.current = returnSection;
  }, [returnTo, returnSection, returnToken]);
  useEffect(() => {
    if (experienceLoaded && isBeginner) void cancelPlannerNotificationsForMethods(['biga', 'poolish']);
  }, [experienceLoaded, isBeginner]);
  const hasCurrentBeginnerDirectSchedule = !isBeginner || (!!directHomeSchedule && !!bakeAt
    && directHomeSchedule.bakeAt.getTime() === bakeAt.getTime());
  const steps = bakeAt && hasCurrentBeginnerDirectSchedule ? reversePlan(bakeAt, method, effectiveStyle, plannerStepCopy, directHomeSchedule, bigaHomeSchedule, poolishHomeSchedule, lang, formatTemperature(directHomeSchedule?.ovenTemp ?? 250, temperatureUnit)).map((step) => ({
    ...step,
    desc: formatUnitText(step.desc, temperatureUnit, measurementSystem),
  })) : [];
  const planKey = bakeAt ? `${bakeAt.getTime()}-${method}-${effectiveStyle}-${directHomeSchedule?.romanFormat ?? ''}-${directHomeSchedule?.ovenTemp ?? ''}-${directHomeSchedule?.strategy ?? ''}-${directHomeSchedule?.startAt.getTime() ?? ''}-${directHomeSchedule?.roomBeforeFridgeHours ?? ''}-${directHomeSchedule?.fridgeHours ?? ''}-${directHomeSchedule?.roomAfterFridgeHours ?? ''}-${directHomeSchedule?.ballingAt?.getTime() ?? ''}-${directHomeSchedule?.preheatAt?.getTime() ?? ''}-${bigaHomeSchedule?.finalMixAt.getTime() ?? ''}-${poolishHomeSchedule?.finalMixAt.getTime() ?? ''}` : '';

  useEffect(() => {
    if (!isBeginner || pendingBeginnerReturnBakeAt.current === null || !bakeAt || !directHomeSchedule) return;
    if (bakeAt.getTime() !== pendingBeginnerReturnBakeAt.current || directHomeSchedule.bakeAt.getTime() !== bakeAt.getTime()) return;
    pendingBeginnerReturnBakeAt.current = null;
    router.replace('/(tabs)?focus=plan');
  }, [isBeginner, bakeAt, directHomeSchedule, router]);

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
  const [webDate, setWebDate] = useState<string>(
    `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}`
  );
  const [webTime, setWebTime] = useState<string>(`${pad(initial.getHours())}:${pad(initial.getMinutes())}`);

  // Preset options for "when to bake"
  const now = new Date();
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  nextSat.setHours(18, 0, 0, 0);
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  inTwoDays.setHours(19, 0, 0, 0);
  const inFiveHours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  const presets = [
    { label: `+5h (${fmt(inFiveHours)})`, date: inFiveHours },
    { label: `+2d (${fmt(inTwoDays)})`, date: inTwoDays },
    { label: `${fmt(nextSat)}`, date: nextSat },
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
    if (isBeginner && (availableHours < BEGINNER_DIRECT_MIN_WINDOW_HOURS || availableHours > BEGINNER_DIRECT_MAX_WINDOW_HOURS)) {
      Alert.alert(t.planner.beginnerWindowTitle, t.planner.beginnerWindowMessage);
      return false;
    }
    if (!isBeginner && availableHours < 1) {
      Alert.alert(t.planner.shortTimeTitle, t.planner.shortTimeMessage, [{ text: t.planner.understand }]);
      return false;
    }
    setSharedHomeBakeAt(d);
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
    await cancelPlannerNotificationsForMethods(['direct', 'biga', 'poolish']);
    let scheduled = 0;
    for (const s of futureSteps) {
      const trigger = s.at.getTime() - Date.now();
      const id = await scheduleLocal(`🍕 ${s.title}`, s.desc, Math.round(trigger / 1000), { source: 'pizza-planner', method });
      if (id) scheduled += 1;
    }
    if (!scheduled) {
      Alert.alert(t.planner.alarmFailed);
      return;
    }
    setScheduledPlanKey(planKey);
    Alert.alert(t.planner.alarmsSet.replace('{N}', String(scheduled)));
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
        <Pressable testID="planner-back" accessibilityRole="button" accessibilityLabel="Back" onPress={handlePlannerBack} style={styles.backButton}>
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backButtonText}>Back</Text>
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
                  onPress={() => setStyle(key)}
                  style={[styles.chip, style === key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, style === key && { color: '#fff' }]}>{t.calc.pizzaStyles[key].name}</Text>
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
                onPress={() => setSelectedMethod(m.key)}
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
                    onChangeText={setWebDate}
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
                    onChangeText={setWebTime}
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
                <Text style={styles.dateBtnLabel}>{bakeAt ? fmt(bakeAt) : t.planner.mobilePickerHint}</Text>
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
              <Pressable testID="schedule-alarms" onPress={scheduleAll} style={styles.alarmBtn}>
                <Icon name="alarm" size={16} color="#fff" />
                <Text style={styles.alarmBtnText}>{t.planner.setAlarms}</Text>
              </Pressable>
            </View>
            {steps.map((s, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepDate}>{fmtPlanDate(s.at, lang)}</Text>
                  <Text style={styles.stepTime}>{fmtPlanTime(s.at, lang)}</Text>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Icon name="time-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyText}>{t.planner.empty}</Text>
          </View>
        )}
      </ScrollView>
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
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  emptyText: { color: COLORS.muted, fontSize: 15 },
});
