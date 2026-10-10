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
const STRETCH_FOLD_IMAGES = [
  require('../../assets/images/phase-b-stretch-fold-01.png'),
  require('../../assets/images/phase-b-stretch-fold-02.png'),
  require('../../assets/images/phase-b-stretch-fold-03.png'),
  require('../../assets/images/phase-b-stretch-fold-04.png'),
  require('../../assets/images/phase-b-stretch-fold-05.png'),
];
const BALLING_IMAGES = [
  require('../../assets/images/phase_c_01_no_number.png'),
  require('../../assets/images/phase_c_02_no_number.png'),
  require('../../assets/images/phase_c_03_no_number.png'),
  require('../../assets/images/phase_c_04_no_number.png'),
  require('../../assets/images/phase_c_05_dough_balls_room_temperature (4).png'),
];
const NAPOLETANA_BAKING_IMAGES = [
  require('../../assets/images/phase_e_01_prepare_dough.png'),
  require('../../assets/images/phase_e_02_press_center.png'),
  require('../../assets/images/phase_e_03_stretch_dough.png'),
  require('../../assets/images/phase_e_04_shape_pizza.png'),
  require('../../assets/images/phase_e_05_add_toppings.png'),
];
const ROMANA_TONDA_BAKING_IMAGES = [
  require('../../assets/images/phase_e_romana_tonda_01_prepare_dough.png'),
  require('../../assets/images/phase_e_romana_tonda_02_press_center.png'),
  require('../../assets/images/phase_e_romana_tonda_03_stretch_dough.png'),
  require('../../assets/images/phase_e_romana_tonda_04_thin_round_shape.png'),
  require('../../assets/images/phase_e_romana_tonda_05_add_toppings.png'),
];
const NEW_YORK_BAKING_IMAGES = [
  require('../../assets/images/phase_e_new_york_01_prepare_dough.png'),
  require('../../assets/images/phase_e_new_york_02_press_center.png'),
  require('../../assets/images/phase_e_new_york_03_stretch_dough.png'),
  require('../../assets/images/phase_e_new_york_04_final_shape.png'),
  require('../../assets/images/phase_e_new_york_05_add_toppings.png'),
];

export type MixingGuideKind = 'hand' | 'mixer' | 'stretchFold' | 'balling' | 'baking' | 'bakingRomanaTonda' | 'bakingNewYork';

export default function MixingGuideCarousel({
  lang,
  kind = 'mixer',
  onSlideChange,
}: {
  lang: Lang;
  kind?: MixingGuideKind;
  onSlideChange?: (slide: number) => void;
}) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const images = kind === 'stretchFold'
    ? STRETCH_FOLD_IMAGES
    : kind === 'balling'
      ? BALLING_IMAGES
      : kind === 'baking'
        ? NAPOLETANA_BAKING_IMAGES
        : kind === 'bakingRomanaTonda'
          ? ROMANA_TONDA_BAKING_IMAGES
          : kind === 'bakingNewYork'
            ? NEW_YORK_BAKING_IMAGES
        : MIXER_IMAGES;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (frameWidth > 0) {
      const nextSlide = Math.min(images.length - 1, Math.round(event.nativeEvent.contentOffset.x / frameWidth));
      if (activeSlide !== nextSlide) {
        setActiveSlide(nextSlide);
        onSlideChange?.(nextSlide);
      }
    }
  };

  return (
    <View
      style={styles.container}
      testID={kind === 'stretchFold'
        ? 'phase-b-stretch-fold-carousel'
        : kind === 'balling'
          ? 'phase-c-balling-carousel'
          : kind === 'baking'
            ? 'phase-e-napoletana-carousel'
            : kind === 'bakingRomanaTonda'
              ? 'phase-e-romana-tonda-carousel'
              : kind === 'bakingNewYork'
                ? 'phase-e-new-york-carousel'
          : 'phase-a-mixer-carousel'}
    >
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
            testID={kind === 'stretchFold'
              ? 'phase-b-stretch-fold-carousel-pager'
              : kind === 'balling'
                ? 'phase-c-balling-carousel-pager'
                : kind === 'baking'
                  ? 'phase-e-napoletana-carousel-pager'
                  : kind === 'bakingRomanaTonda'
                    ? 'phase-e-romana-tonda-carousel-pager'
                    : kind === 'bakingNewYork'
                      ? 'phase-e-new-york-carousel-pager'
                : 'phase-a-mixer-carousel-pager'}
          >
            {images.map((source, index) => (
              <View key={index} style={{ width: frameWidth, height: frameWidth * 9 / 16 }}>
                <Image source={source} resizeMode="contain" style={styles.image} />
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View
        accessibilityLabel={{
          hr: `Slika ${activeSlide + 1} od ${images.length}`,
          en: `Image ${activeSlide + 1} of ${images.length}`,
          de: `Bild ${activeSlide + 1} von ${images.length}`,
          sl: `Slika ${activeSlide + 1} od ${images.length}`,
        }[lang]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: images.length, now: activeSlide + 1 }}
        style={styles.indicator}
        testID={kind === 'stretchFold'
          ? 'phase-b-stretch-fold-carousel-indicator'
          : kind === 'balling'
            ? 'phase-c-balling-carousel-indicator'
            : kind === 'baking'
              ? 'phase-e-napoletana-carousel-indicator'
                  : kind === 'bakingRomanaTonda'
                    ? 'phase-e-romana-tonda-carousel-indicator'
                    : kind === 'bakingNewYork'
                      ? 'phase-e-new-york-carousel-indicator'
                  : 'phase-a-mixer-carousel-indicator'}
      >
        {images.map((_, index) => (
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
