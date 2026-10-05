import { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';

import { useT } from '../src/i18n/LanguageProvider';
import { LANGS, Lang } from '../src/i18n/translations';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import { UserExperienceLevel, getCachedExperienceLevel, setExperienceLevel, subscribeExperienceLevel } from '../src/experienceLevel';
import {
  MeasurementSystem, PreferredYeastType,
  setTemperatureUnit,
  getCachedMeasurementSystem, setMeasurementSystem, subscribeMeasurementSystem,
  getCachedPreferredYeastType, setPreferredYeastType, subscribePreferredYeastType,
} from '../src/preferences';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang, setLang } = useT();
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const preferredYeastType = useSyncExternalStore(subscribePreferredYeastType, getCachedPreferredYeastType, getCachedPreferredYeastType) ?? 'fresh';

  // V1: Units also selects its normal temperature display; temperatureUnit stays a separate preference so it can be split later.
  const chooseUnits = (system: MeasurementSystem) => {
    void setMeasurementSystem(system);
    void setTemperatureUnit(system === 'us' ? 'fahrenheit' : 'celsius');
  };

  const chip = (active: boolean, label: string, onPress: () => void, testID: string) => (
    <Pressable key={testID} testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="settings-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t.profile.preferences.title}</Text>
        <Pressable testID="settings-close" onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Icon name="close" size={22} color={COLORS.onSurface} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xxl, gap: SPACING.lg }}>
        <View style={styles.card}>
          <Text style={styles.section}>{t.profile.language}</Text>
          <View style={styles.chipRow}>
            {LANGS.map((l) => chip(lang === l.code, l.label, () => setLang(l.code as Lang), `settings-lang-${l.code}`))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t.profile.preferences.experienceLevel}</Text>
          <View style={styles.chipRow}>
            {chip(experienceLevel === 'beginner', t.profile.preferences.beginner, () => setExperienceLevel('beginner' as UserExperienceLevel), 'settings-experience-beginner')}
            {chip(experienceLevel === 'pro', t.profile.preferences.pro, () => setExperienceLevel('pro' as UserExperienceLevel), 'settings-experience-pro')}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t.profile.preferences.units}</Text>
          <View style={styles.chipRow}>
            {chip(measurementSystem === 'metric', t.profile.preferences.metric, () => chooseUnits('metric'), 'settings-units-metric')}
            {chip(measurementSystem === 'us', t.profile.preferences.us, () => chooseUnits('us'), 'settings-units-us')}
          </View>
          <Text style={styles.hint}>
            {measurementSystem === 'us'
              ? 'oz · lb · °F'
              : 'g · kg · °C'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t.profile.preferences.yeast}</Text>
          <View style={styles.chipRow}>
            {chip(preferredYeastType === 'fresh', t.profile.preferences.fresh, () => setPreferredYeastType('fresh' as PreferredYeastType), 'settings-yeast-fresh')}
            {chip(preferredYeastType === 'dry', t.profile.preferences.dry, () => setPreferredYeastType('dry' as PreferredYeastType), 'settings-yeast-dry')}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  card: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  section: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.onSurface, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: COLORS.muted },
});
