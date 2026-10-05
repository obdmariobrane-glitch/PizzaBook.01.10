import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';

import { COLORS, SPACING } from '../theme';

type LegalSection = { heading: string; body: string };

type LegalPageProps = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export default function LegalPage({ title, intro, sections }: LegalPageProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevron-back" size={26} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxxl }]}>
        <Text style={styles.intro}>{intro}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { flex: 1, textAlign: 'center', color: COLORS.onSurface, fontSize: 17, fontWeight: '700' },
  headerSpace: { width: 26 },
  content: { padding: SPACING.lg, gap: SPACING.lg },
  intro: { color: COLORS.onSurface, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  section: { gap: SPACING.sm },
  heading: { color: COLORS.onSurface, fontSize: 17, fontWeight: '800' },
  body: { color: COLORS.onSurfaceTertiary, fontSize: 14, lineHeight: 22 },
});
