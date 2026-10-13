import { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Icon from '@react-native-vector-icons/ionicons';

import { useT } from '../src/i18n/LanguageProvider';
import { LANGS } from '../src/i18n/translations';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import { getCachedExperienceLevel, setExperienceLevel, subscribeExperienceLevel } from '../src/experienceLevel';
import {
  MeasurementSystem,
  setTemperatureUnit,
  getCachedMeasurementSystem, setMeasurementSystem, subscribeMeasurementSystem,
  getCachedPreferredYeastType, setPreferredYeastType, subscribePreferredYeastType,
} from '../src/preferences';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, lang, setLang } = useT();
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const preferredYeastType = useSyncExternalStore(subscribePreferredYeastType, getCachedPreferredYeastType, getCachedPreferredYeastType) ?? 'fresh';
  const isWide = width >= 640;
  const appVersion = Constants.expoConfig?.version;

  const chooseUnits = (system: MeasurementSystem) => {
    void setMeasurementSystem(system);
    void setTemperatureUnit(system === 'us' ? 'fahrenheit' : 'celsius');
  };

  const choice = (active: boolean, label: string, onPress: () => void, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: active, selected: active }}
      aria-checked={active}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );

  const rowStyle = [styles.row, isWide ? styles.rowWide : styles.rowNarrow];
  const choiceGroupStyle = [styles.choiceGroup, isWide && styles.choiceGroupWide];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="settings-screen">
      <View style={styles.headerOuter}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.profile.preferences.title}</Text>
          <Pressable
            testID="settings-close"
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={() => router.back()}
            style={styles.closeBtn}
          >
            <Icon name="close" size={22} color={COLORS.onSurface} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={[rowStyle, styles.rowDivider]}>
              <Text style={styles.label}>{t.profile.language}</Text>
              <View style={choiceGroupStyle} accessibilityRole="radiogroup" accessibilityLabel={t.profile.language}>
                {LANGS.map((language) =>
                  choice(
                    lang === language.code,
                    language.label,
                    () => setLang(language.code),
                    `settings-lang-${language.code}`,
                  ),
                )}
              </View>
            </View>

            <View style={[rowStyle, styles.rowDivider]}>
              <Text style={styles.label}>{t.profile.preferences.experienceLevel}</Text>
              <View style={choiceGroupStyle} accessibilityRole="radiogroup" accessibilityLabel={t.profile.preferences.experienceLevel}>
                {choice(experienceLevel === 'beginner', t.profile.preferences.beginner, () => setExperienceLevel('beginner'), 'settings-experience-beginner')}
                {choice(experienceLevel === 'pro', t.profile.preferences.pro, () => setExperienceLevel('pro'), 'settings-experience-pro')}
              </View>
            </View>

            <View style={[rowStyle, styles.rowDivider]}>
              <Text style={styles.label}>{t.profile.preferences.units}</Text>
              <View style={choiceGroupStyle} accessibilityRole="radiogroup" accessibilityLabel={t.profile.preferences.units}>
                {choice(measurementSystem === 'metric', t.profile.preferences.metric, () => chooseUnits('metric'), 'settings-units-metric')}
                {choice(measurementSystem === 'us', t.profile.preferences.us, () => chooseUnits('us'), 'settings-units-us')}
              </View>
              <Text style={[styles.unitsHint, isWide && styles.unitsHintWide]}>
                {measurementSystem === 'us' ? 'oz · lb · in · °F' : 'g · kg · cm · °C'}
              </Text>
            </View>

            <View style={rowStyle}>
              <Text style={styles.label}>{t.profile.preferences.yeast}</Text>
              <View style={[styles.yeastOptions, isWide && styles.yeastOptionsWide]}>
                <View style={choiceGroupStyle} accessibilityRole="radiogroup" accessibilityLabel={t.profile.preferences.yeast}>
                  {choice(preferredYeastType === 'fresh', t.profile.preferences.fresh, () => setPreferredYeastType('fresh'), 'settings-yeast-fresh')}
                  {choice(preferredYeastType === 'activeDry', t.profile.preferences.activeDry, () => setPreferredYeastType('activeDry'), 'settings-yeast-active-dry')}
                  {choice(preferredYeastType === 'dry', t.profile.preferences.dry, () => setPreferredYeastType('dry'), 'settings-yeast-dry')}
                </View>
                <Text style={styles.yeastHint}>{t.profile.preferences.defaultYeastHint}</Text>
              </View>
            </View>
          </View>

          <Pressable
            testID="settings-pro-guide"
            accessibilityRole="link"
            accessibilityLabel={t.calc.school}
            onPress={() => router.push('/pro-guide')}
            style={styles.manualEntry}
          >
            <Icon name="book-outline" size={21} color={COLORS.brand} />
            <Text style={styles.manualEntryText}>{t.calc.school}</Text>
            <Icon name="chevron-forward" size={18} color={COLORS.brand} />
          </Pressable>

          <View style={[styles.aboutRow, isWide && styles.aboutRowWide]}>
            {appVersion ? (
              <Text style={styles.versionText}>
                {t.profile.preferences.version.replace('{VERSION}', appVersion)}
              </Text>
            ) : null}
            <Pressable
              testID="settings-privacy"
              accessibilityRole="link"
              onPress={() => router.push('/privacy')}
              style={styles.privacyLink}
            >
              <Text style={styles.privacyText}>{t.profile.privacyPolicy}</Text>
              <Icon name="chevron-forward" size={16} color={COLORS.brand} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  headerOuter: { paddingHorizontal: SPACING.lg },
  header: {
    width: '100%',
    maxWidth: 680,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5, flexShrink: 1 },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  content: { width: '100%', maxWidth: 680, gap: SPACING.sm },
  card: {
    width: '100%',
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manualEntry: {
    width: '100%',
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manualEntryText: { flex: 1, color: COLORS.brand, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  row: { gap: SPACING.md, paddingVertical: SPACING.md },
  rowWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  label: { color: COLORS.onSurface, fontSize: 15, fontWeight: '700' },
  choiceGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
  choiceGroupWide: { flex: 1, justifyContent: 'flex-end' },
  choice: {
    minWidth: 88,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  choiceText: { color: COLORS.onSurface, fontWeight: '600', fontSize: 14, textAlign: 'center' },
  choiceTextActive: { color: '#fff' },
  unitsHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  unitsHintWide: { minWidth: 124, textAlign: 'right' },
  yeastOptions: { gap: SPACING.xs },
  yeastOptionsWide: { flex: 1 },
  yeastHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  aboutRow: {
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  aboutRowWide: { flexWrap: 'nowrap' },
  versionText: { color: COLORS.muted, fontSize: 12 },
  privacyLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  privacyText: { color: COLORS.brand, fontWeight: '600', fontSize: 13 },
});
