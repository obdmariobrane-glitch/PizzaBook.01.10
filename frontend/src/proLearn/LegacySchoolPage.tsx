import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';

import { useT } from '../i18n/LanguageProvider';
import { COLORS, RADIUS, SPACING } from '../theme';

export default function LegacySchoolPage({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          testID="pro-guide-legacy-back"
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          onPress={onBack}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backText}>{t.common.back}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl }]}>
        <View style={styles.content}>
          <Image
            source={require('../../assets/images/chef-pro-guide.png')}
            resizeMode="contain"
            accessibilityLabel={t.school.title}
            style={styles.chef}
          />
          <Text style={styles.title}>{t.school.title}</Text>
          <Text style={styles.intro}>{t.school.subtitle}</Text>
          <View style={styles.rules}>
            {t.school.rules.map((rule, index) => (
              <View key={`${rule.title}-${index}`} style={styles.ruleCard}>
                <View style={styles.ruleNumber}>
                  <Text style={styles.ruleNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.ruleContent}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleBody}>{rule.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { width: '100%', maxWidth: 840, alignSelf: 'center', paddingHorizontal: SPACING.lg, minHeight: 56, justifyContent: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm },
  backText: { color: COLORS.brand, fontSize: 15, fontWeight: '700' },
  scrollContent: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  content: { width: '100%', maxWidth: 760, alignItems: 'center', gap: SPACING.md },
  chef: { width: 164, height: 200 },
  title: { color: COLORS.onSurface, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  intro: { color: COLORS.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 620 },
  rules: { width: '100%', gap: SPACING.md, marginTop: SPACING.sm },
  ruleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg },
  ruleNumber: { width: 34, height: 34, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  ruleNumberText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  ruleContent: { flex: 1, gap: SPACING.xs },
  ruleTitle: { color: COLORS.onSurface, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  ruleBody: { color: COLORS.onSurfaceTertiary, fontSize: 15, lineHeight: 23 },
});
