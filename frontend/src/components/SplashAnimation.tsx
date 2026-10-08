import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, ImageBackground, Platform, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

type SplashAnimationProps = {
  onFinish: () => void;
};

const SPLASH_BACKGROUND = require('../../assets/images/pizza-splash-background.png');
const PIZZA_SLICE = require('../../assets/images/pizza-slice-mark.png');
const useNativeDriver = Platform.OS !== 'web';

export default function SplashAnimation({ onFinish }: SplashAnimationProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [wordmarkProgress] = useState(() => new Animated.Value(0));
  const [sliceOpacity] = useState(() => new Animated.Value(0));
  const [sliceScale] = useState(() => new Animated.Value(0.75));

  const markImageLoaded = useCallback(() => setImageLoaded(true), []);
  const reportImageError = useCallback((event: { nativeEvent: { error: string } }) => {
    console.error('Unable to load the splash background image:', event.nativeEvent.error);
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    if (!imageLoaded) return undefined;

    let finishTimeout: ReturnType<typeof setTimeout> | undefined;
    const wordmark = Animated.sequence([
      Animated.delay(200),
      Animated.timing(wordmarkProgress, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
    ]);
    const slice = Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(sliceOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.spring(sliceScale, {
          toValue: 1,
          damping: 14,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver,
        }),
      ]),
    ]);

    Animated.parallel([wordmark, slice]).start(({ finished }) => {
      if (finished) finishTimeout = setTimeout(onFinish, 250);
    });

    return () => {
      wordmark.stop();
      slice.stop();
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [imageLoaded, onFinish, sliceOpacity, sliceScale, wordmarkProgress]);

  const wordmarkOpacity = wordmarkProgress;
  const wordmarkTransform = [
    { translateY: wordmarkProgress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
    { scale: wordmarkProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
  ];
  return (
    <ImageBackground
      source={SPLASH_BACKGROUND}
      resizeMode="cover"
      onLoadEnd={markImageLoaded}
      onError={reportImageError}
      style={styles.root}
      imageStyle={styles.background}
      accessibilityLabel="Freshly baked pizza with basil and tomatoes"
    >
      <View style={styles.content}>
        <View style={styles.brandPosition}>
          <View style={styles.brandRow} accessible accessibilityLabel="PizzaBook">
            <Animated.View style={[styles.wordmark, { opacity: wordmarkOpacity, transform: wordmarkTransform }]}>
              <Text style={styles.pizzaText}>Pizza</Text>
              <Text style={styles.bookText}>Book</Text>
            </Animated.View>
            <Animated.Image
              source={PIZZA_SLICE}
              resizeMode="contain"
              accessible={false}
              style={[
                styles.slice,
                {
                  opacity: sliceOpacity,
                  transform: [{ scale: sliceScale }],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : '#F7C894' },
  background: { width: '100%', height: '100%' },
  content: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  brandPosition: { position: 'absolute', top: '30.7%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  pizzaText: { color: COLORS.onSurface, fontSize: 54, lineHeight: 64, fontWeight: '900', letterSpacing: -1.6 },
  bookText: { color: COLORS.brand, fontSize: 54, lineHeight: 64, fontWeight: '900', letterSpacing: -1.6 },
  slice: { width: 66, height: 78 },
});
