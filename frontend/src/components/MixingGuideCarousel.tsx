import { useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { COLORS, RADIUS } from '../theme';
import type { Lang } from '../i18n/translations';

const MIXER_IMAGES = [
  require('../../assets/guides/mixing/mixer-01.png'),
  require('../../assets/guides/mixing/mixer-02.png'),
  require('../../assets/guides/mixing/mixer-03.png'),
  require('../../assets/guides/mixing/mixer-04.png'),
];

export type MixingGuideKind = 'hand' | 'mixer';

export default function MixingGuideCarousel({ lang }: { lang: Lang }) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (frameWidth > 0) {
      const nextSlide = Math.min(MIXER_IMAGES.length - 1, Math.round(event.nativeEvent.contentOffset.x / frameWidth));
      setActiveSlide((currentSlide) => currentSlide === nextSlide ? currentSlide : nextSlide);
    }
  };

  return (
    <View style={styles.container} testID="phase-a-mixer-carousel">
      <View
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
        style={styles.frame}
      >
        {frameWidth > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            style={styles.pager}
            testID="phase-a-mixer-carousel-pager"
          >
            {MIXER_IMAGES.map((source, index) => (
              <View key={index} style={{ width: frameWidth, height: frameWidth * 9 / 16 }}>
                <Image source={source} resizeMode="contain" style={styles.image} />
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View
        accessibilityLabel={{
          hr: `Slika ${activeSlide + 1} od ${MIXER_IMAGES.length}`,
          en: `Image ${activeSlide + 1} of ${MIXER_IMAGES.length}`,
          de: `Bild ${activeSlide + 1} von ${MIXER_IMAGES.length}`,
          sl: `Slika ${activeSlide + 1} od ${MIXER_IMAGES.length}`,
        }[lang]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: MIXER_IMAGES.length, now: activeSlide + 1 }}
        style={styles.indicator}
        testID="phase-a-mixer-carousel-indicator"
      >
        {MIXER_IMAGES.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === activeSlide ? styles.activeDot : styles.inactiveDot]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 5, alignItems: 'center' },
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceTertiary,
  },
  pager: { flex: 1 },
  image: { width: '100%', height: '100%' },
  indicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 9 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  activeDot: { backgroundColor: COLORS.brand },
  inactiveDot: { backgroundColor: COLORS.borderStrong },
});
