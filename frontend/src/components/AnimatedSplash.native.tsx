import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

type AnimatedSplashProps = {
  onFinish: () => void;
};

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  useEffect(() => {
    onFinish();
  }, [onFinish]);

  return (
    <View style={styles.root} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});