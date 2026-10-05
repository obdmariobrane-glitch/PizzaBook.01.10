import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type AnimatedSplashProps = {
  onFinish: () => void;
};

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  useEffect(() => onFinish(), [onFinish]);
  return (
    <View style={styles.root}>
      <ActivityIndicator color="#D15900" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});