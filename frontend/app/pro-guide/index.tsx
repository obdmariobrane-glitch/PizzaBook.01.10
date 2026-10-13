import React, { useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';

import { useT } from '../../src/i18n/LanguageProvider';
import LegacySchoolPage from '../../src/proLearn/LegacySchoolPage';
import { PRO_LEARN_MANUALS } from '../../src/proLearn/manuals';
import { COLORS, RADIUS, SPACING } from '../../src/theme';

export default function ProGuideIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, lang, languageLoaded } = useT();
  const manual = PRO_LEARN_MANUALS[lang];
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  if (!languageLoaded) {
    return (
      <View style={[styles.root, styles.loading, { paddingTop: insets.top }]} testID="pro-guide-language-loading">
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  if (!manual) return <LegacySchoolPage onBack={goBack} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="pro-guide-home">
      <View style={[styles.topBar, { maxWidth: width >= 900 ? 840 : undefined }]}>
        <Pressable
          testID="pro-guide-home-back"
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          onPress={goBack}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backText}>{t.common.back}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.xxl },
        ]}
      >
        <View style={styles.content}>
          <Image
            source={require('../../assets/images/chef-pro-guide.png')}
            resizeMode="contain"
            accessibilityLabel={manual.title}
            style={styles.chef}
          />
          <Text style={styles.title}>{manual.title}</Text>
          <Text style={styles.intro}>{manual.introduction}</Text>
          <View style={styles.topicList}>
            {manual.topics.map((topic, index) => (
              <Pressable
                key={topic.id}
                testID={`pro-guide-topic-card-${topic.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${topic.title}. ${topic.description}`}
                accessibilityHint={t.common.openTopic}
                onPress={() => router.push({ pathname: '/pro-guide/[topicId]', params: { topicId: topic.id } })}
                style={({ pressed }) => [styles.topicCard, pressed && styles.topicCardPressed]}
              >
                <View style={styles.topicNumber}>
                  <Text style={styles.topicNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.topicText}>
                  <Text style={styles.topicTitle}>{topic.title}</Text>
                  <Text style={styles.topicDescription}>{topic.description}</Text>
                  <View style={styles.openRow}>
                    <Text style={styles.openText}>{t.common.openTopic}</Text>
                    <Icon name="chevron-forward" size={17} color={COLORS.brand} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: 'center', justifyContent: 'center' },
  topBar: { width: '100%', alignSelf: 'center', paddingHorizontal: SPACING.lg, minHeight: 56, justifyContent: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm },
  backText: { color: COLORS.brand, fontSize: 15, fontWeight: '700' },
  scrollContent: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  content: { width: '100%', maxWidth: 760, alignItems: 'center', gap: SPACING.md },
  chef: { width: 178, height: 214 },
  title: { color: COLORS.onSurface, fontSize: 30, lineHeight: 37, fontWeight: '800', textAlign: 'center' },
  intro: { color: COLORS.onSurfaceTertiary, fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 680, marginBottom: SPACING.sm },
  topicList: { width: '100%', gap: SPACING.md },
  topicCard: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg },
  topicCardPressed: { backgroundColor: COLORS.surfaceTertiary, borderColor: COLORS.borderStrong },
  topicNumber: { width: 38, height: 38, borderRadius: RADIUS.pill, backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  topicNumberText: { color: COLORS.onBrandTertiary, fontSize: 12, fontWeight: '800' },
  topicText: { flex: 1, gap: SPACING.xs },
  topicTitle: { color: COLORS.onSurface, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  topicDescription: { color: COLORS.onSurfaceTertiary, fontSize: 15, lineHeight: 23 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: SPACING.xs },
  openText: { color: COLORS.brand, fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
