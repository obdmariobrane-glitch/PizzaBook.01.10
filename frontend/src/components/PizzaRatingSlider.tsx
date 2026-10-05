import { Pressable, StyleSheet, View } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';

import { COLORS, SPACING } from '../theme';

type PizzaRatingSliderProps = {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  disabled?: boolean;
  testID?: string;
};

export function PizzaRatingMark({ rating, size = 24 }: { rating: number; size?: number }) {
  return <Icon name={rating > 0 ? 'star' : 'star-outline'} size={size} color={rating > 0 ? COLORS.brand : COLORS.muted} />;
}

export default function PizzaRatingSlider({ value, onChange, onChangeEnd, disabled = false, testID }: PizzaRatingSliderProps) {
  const selectedValue = Math.max(0, Math.min(5, value));

  return (
    <View style={[styles.root, disabled && styles.disabled]} testID={testID}>
      <View
        style={styles.stars}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 1, max: 5, now: selectedValue || 1 }}
      >
        {[1, 2, 3, 4, 5].map((number) => (
          <Pressable
            key={number}
            testID={testID ? `${testID}-star-${number}` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${number}/5`}
            disabled={disabled}
            onPress={() => {
              onChange(number);
              onChangeEnd?.(number);
            }}
            hitSlop={6}
            style={styles.starButton}
          >
            <PizzaRatingMark rating={number <= selectedValue ? 1 : 0} size={30} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: SPACING.xs },
  disabled: { opacity: 0.85 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  starButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
});
