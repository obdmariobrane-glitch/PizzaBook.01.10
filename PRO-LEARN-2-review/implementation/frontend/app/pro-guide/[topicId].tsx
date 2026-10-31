import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';

import { useT } from '../../src/i18n/LanguageProvider';
import LegacySchoolPage from '../../src/proLearn/LegacySchoolPage';
import MarkdownContent from '../../src/proLearn/MarkdownContent';
import { findProLearnAnchor, PRO_LEARN_MANUALS } from '../../src/proLearn/manuals';
import { COLORS, RADIUS, SPACING } from '../../src/theme';

export default function ProGuideTopic() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, lang, languageLoaded } = useT();
  const params = useLocalSearchParams<{ topicId?: string | string[]; section?: string | string[] }>();
  const topicId = Array.isArray(params.topicId) ? params.topicId[0] : params.topicId;
  const initialSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const manual = PRO_LEARN_MANUALS[lang];
  const topic = manual?.topics.find((item) => item.id === topicId);
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});
  const pendingAnchor = useRef<string | null>(null);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/pro-guide');
  }, [router]);

  const scrollToAnchor = useCallback((anchor: string) => {
    if (anchor === topic?.id) {
      pendingAnchor.current = null;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const position = sectionPositions.current[anchor];
    if (position !== undefined) {
      pendingAnchor.current = null;
      scrollRef.current?.scrollTo({ y: Math.max(0, position - SPACING.sm), animated: true });
    } else {
      pendingAnchor.current = anchor;
    }
  }, [topic?.id]);

  useEffect(() => {
    if (!initialSection) return;
    pendingAnchor.current = initialSection;
    requestAnimationFrame(() => {
      const position = sectionPositions.current[initialSection];
      if (position !== undefined) scrollToAnchor(initialSection);
    });
  }, [initialSection, scrollToAnchor, topicId]);

  if (!languageLoaded) {
    return (
      <View style={[styles.root, styles.loading, { paddingTop: insets.top }]} testID="pro-guide-language-loading">
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  if (!manual) return <LegacySchoolPage onBack={goBack} />;

  if (!topic) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]} testID="pro-guide-topic-not-found">
        <Pressable
          testID="pro-guide-topic-back"
          accessibilityRole="button"
          accessibilityLabel={t.common.backToTopics}
          onPress={goBack}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backText}>{t.common.backToTopics}</Text>
        </Pressable>
        <Text style={styles.notFound}>Tema nije pronađena.</Text>
      </View>
    );
  }

  const openLink = (href: string) => {
    if (!href.startsWith('#')) return;
    const anchor = decodeURIComponent(href.slice(1));
    const destination = findProLearnAnchor(manual, anchor);
    if (!destination) return;
    if (destination.topic.id === topic.id) {
      scrollToAnchor(destination.sectionId ?? destination.topic.id);
    } else {
      router.push({
        pathname: '/pro-guide/[topicId]',
        params: {
          topicId: destination.topic.id,
          ...(destination.sectionId ? { section: destination.sectionId } : {}),
        },
      });
    }
  };

  const onContentSizeChange = () => {
    const pending = pendingAnchor.current;
    if (pending && sectionPositions.current[pending] !== undefined) scrollToAnchor(pending);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={`pro-guide-topic-${topic.id}`}>
      <View style={[styles.topBar, { maxWidth: width >= 900 ? 840 : undefined }]}>
        <Pressable
          testID="pro-guide-topic-back"
          accessibilityRole="button"
          accessibilityLabel={t.common.backToTopics}
          onPress={goBack}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={20} color={COLORS.brand} />
          <Text style={styles.backText}>{t.common.backToTopics}</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.xxl },
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{topic.title}</Text>
          <Text style={styles.topicIntro}>{topic.description}</Text>
          {topic.introduction ? (
            <MarkdownContent
              markdown={topic.introduction}
              onLinkPress={openLink}
              testID={`pro-guide-introduction-${topic.id}`}
            />
          ) : null}
          {topic.sections.length > 0 ? (
            <View style={styles.contentsCard} testID="pro-guide-contents">
              <Text style={styles.contentsTitle}>{t.common.contents}</Text>
              <View style={styles.contentsList}>
                {topic.sections.map((section) => (
                  <Pressable
                    key={section.id}
                    testID={`pro-guide-toc-${section.id}`}
                    accessibilityRole="link"
                    accessibilityLabel={section.title}
                    onPress={() => scrollToAnchor(section.id)}
                    style={[styles.contentsItem, section.level === 4 && styles.contentsNested]}
                  >
                    <Text style={styles.contentsText}>{section.title}</Text>
                    <Icon name="chevron-forward" size={15} color={COLORS.brand} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {topic.sections.map((section) => (
            <View
              key={section.id}
              onLayout={(event) => {
                sectionPositions.current[section.id] = event.nativeEvent.layout.y;
                if (pendingAnchor.current === section.id) {
                  requestAnimationFrame(() => scrollToAnchor(section.id));
                }
              }}
              style={styles.section}
            >
              <Text style={section.level === 4 ? styles.subheadingNested : styles.subheading}>
                {section.title}
              </Text>
              <MarkdownContent
                markdown={section.markdown}
                onLinkPress={openLink}
                testID={`pro-guide-section-${section.id}`}
              />
            </View>
          ))}
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
  content: { width: '100%', maxWidth: 760, gap: SPACING.lg },
  title: { color: COLORS.onSurface, fontSize: 29, lineHeight: 36, fontWeight: '800' },
  topicIntro: { color: COLORS.onSurfaceTertiary, fontSize: 16, lineHeight: 25 },
  contentsCard: { width: '100%', gap: SPACING.sm, padding: SPACING.lg, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg },
  contentsTitle: { color: COLORS.onSurface, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  contentsList: { gap: SPACING.xs },
  contentsItem: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingVertical: SPACING.xs },
  contentsNested: { paddingLeft: SPACING.lg },
  contentsText: { flex: 1, color: COLORS.brand, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  section: { width: '100%', gap: SPACING.md, marginBottom: SPACING.xxl },
  subheading: { color: COLORS.onSurface, fontSize: 22, lineHeight: 29, fontWeight: '800', marginBottom: SPACING.xs },
  subheadingNested: { color: COLORS.onSurface, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  notFound: { padding: SPACING.xl, color: COLORS.onSurface, fontSize: 17, lineHeight: 25 },
});
