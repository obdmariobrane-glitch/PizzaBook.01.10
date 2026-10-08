import { View, Text, StyleSheet, Pressable, ScrollView, Image, ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';

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
    <View style={styles.root} testID="onboarding-screen">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Icon name="pizza-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.brand}>PizzaBook</Text>
        </View>
        <View style={styles.intro}>
          <Text style={styles.title}>{t.onboarding.title}</Text>
          <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>
        </View>
        <View style={styles.cards}>
          <ExperienceCard
            testID="onboarding-beginner"
            title={t.onboarding.beginnerTitle}
            lead={t.onboarding.beginnerLead}
            description={t.onboarding.beginnerDescription}
            benefits={[t.onboarding.beginnerBenefit1, t.onboarding.beginnerBenefit2, t.onboarding.beginnerBenefit3]}
            recommended={t.onboarding.recommended}
            assetLabel={t.onboarding.beginnerAssetLabel}
            chefSource={require('../assets/images/chef-beginner.png')}
            recommendedCard
            onPress={() => choose('beginner')}
          />
          <ExperienceCard
            testID="onboarding-pro"
            title={t.onboarding.proTitle}
            lead={t.onboarding.proLead}
            description={t.onboarding.proDescription}
            benefits={[t.onboarding.proBenefit1, t.onboarding.proBenefit2, t.onboarding.proBenefit3]}
            assetLabel={t.onboarding.proAssetLabel}
            chefSource={require('../assets/images/chef-pro.png')}
            onPress={() => choose('pro')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

type ExperienceCardProps = {
  testID: string;
  title: string;
  lead: string;
  description: string;
  benefits: string[];
  recommended?: string;
  assetLabel: string;
  chefSource: ImageSourcePropType;
  recommendedCard?: boolean;
  onPress: () => void;
};

function ExperienceCard({
  testID,
  title,
  lead,
  description,
  benefits,
  recommended,
  assetLabel,
  chefSource,
  recommendedCard = false,
  onPress,
}: ExperienceCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${lead}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, recommendedCard && styles.cardRecommended, pressed && styles.cardPressed]}
    >
      {recommended ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{recommended}</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardLead}>{lead}</Text>
          <Text style={styles.cardDesc}>{description}</Text>
          <View style={styles.benefits}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Icon name="checkmark" size={15} color={COLORS.success} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.chefSlot} pointerEvents="none">
          <Image source={chefSource} style={styles.chefImage} resizeMode="contain" accessibilityLabel={assetLabel} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  brandMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  brand: { color: COLORS.onSurface, fontSize: 20, fontWeight: '900' },
  intro: { gap: SPACING.xs, maxWidth: 360 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '800', color: COLORS.onSurface },
  subtitle: { fontSize: 15, lineHeight: 21, color: COLORS.muted },
  cards: { gap: SPACING.md },
  card: { position: 'relative', overflow: 'hidden', backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, gap: SPACING.md, shadowColor: COLORS.onSurface, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardRecommended: { borderColor: COLORS.brand, borderWidth: 2, shadowOpacity: 0.14, elevation: 5 },
  cardPressed: { backgroundColor: COLORS.brandTertiary, borderColor: COLORS.brandSecondary, transform: [{ scale: 0.99 }] },
  badge: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, backgroundColor: COLORS.brandTertiary, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  badgeText: { color: COLORS.onBrandTertiary, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  cardBody: { position: 'relative', flexDirection: 'row', alignItems: 'flex-start' },
  cardCopy: { width: '67%', minWidth: 0, gap: SPACING.xs, zIndex: 1 },
  cardTitle: { color: COLORS.onSurface, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  cardLead: { color: COLORS.brand, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  benefits: { gap: 5, marginTop: SPACING.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  benefitText: { flex: 1, color: COLORS.onSurface, fontSize: 13, lineHeight: 17, fontWeight: '600' },
  chefSlot: { position: 'absolute', right: -8, bottom: -10, width: 148, height: 166, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  chefImage: { width: '100%', height: '100%' },
});
