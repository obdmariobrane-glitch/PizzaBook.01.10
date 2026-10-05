import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import { setExperienceLevel, UserExperienceLevel } from '../src/experienceLevel';

export default function Onboarding() {
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const choose = (level: UserExperienceLevel) => {
    void setExperienceLevel(level);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xxl, paddingBottom: insets.bottom + SPACING.xl }]} testID="onboarding-screen">
      <Text style={styles.title}>{t.onboarding.title}</Text>
      <View style={styles.cards}>
        <Pressable testID="onboarding-beginner" onPress={() => choose('beginner')} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
          <Text style={styles.cardTitle}>{t.onboarding.beginnerTitle}</Text>
          <Text style={styles.cardDesc}>{t.onboarding.beginnerDesc}</Text>
        </Pressable>
        <Pressable testID="onboarding-pro" onPress={() => choose('pro')} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
          <Text style={styles.cardTitle}>{t.onboarding.proTitle}</Text>
          <Text style={styles.cardDesc}>{t.onboarding.proDesc}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.xl, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5, marginBottom: SPACING.xxl, textAlign: 'center' },
  cards: { gap: SPACING.lg },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, gap: SPACING.sm },
  cardPressed: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  cardTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface },
  cardDesc: { fontSize: 15, color: COLORS.onSurfaceTertiary, lineHeight: 21 },
});
