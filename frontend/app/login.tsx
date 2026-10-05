import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Icon from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth';
import { useT } from '../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../src/theme';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { t } = useT();
  const { signInWithSessionId } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin + '/'
        : Linking.createURL('/', { scheme: 'frontend' });
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
        return;
      }

      const result: any = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const rawUrl: string = result?.url || (await Linking.getInitialURL()) || '';
      const m = rawUrl.match(/[?#&]session_id=([^&#]+)/);
      if (!m) {
        if (result?.type !== 'cancel') setError('Prijava nije dovršena. Pokušajte ponovno.');
        return;
      }
      await signInWithSessionId(decodeURIComponent(m[1]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prijava nije uspjela. Pokušajte ponovno.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <ImageBackground
        source={{ uri: 'https://images.pexels.com/photos/27600445/pexels-photo-27600445.jpeg' }}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(28,25,23,0.15)', 'rgba(28,25,23,0.85)', 'rgba(28,25,23,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.content, { paddingTop: insets.top + SPACING.xxxl, paddingBottom: insets.bottom + SPACING.xxl }]}>
          <View style={styles.top}>
            <View style={styles.logoRing}>
              <Text style={styles.logoEmoji}>🍕</Text>
            </View>
            <Text style={styles.brand}>Pizzabook</Text>
          </View>
          <View style={styles.bottom}>
            <Text style={styles.title}>{t.login.title}</Text>
            <Text style={styles.subtitle}>{t.login.subtitle}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              testID="google-login-button"
              onPress={onLogin}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.brand} />
              ) : (
                <>
                  <Icon name="logo-google" size={20} color={COLORS.brand} />
                  <Text style={styles.btnText}>{t.login.google}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surfaceInverse },
  bg: { flex: 1, width: '100%', height: '100%' },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'space-between' },
  top: { alignItems: 'center', marginTop: SPACING.xxxl },
  logoRing: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  logoEmoji: { fontSize: 44 },
  brand: { fontSize: 32, color: '#fff', fontWeight: '800', letterSpacing: -0.5 },
  bottom: {},
  title: { fontSize: 30, color: '#fff', fontWeight: '800', marginBottom: SPACING.md, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 22, marginBottom: SPACING.xl },
  error: { color: '#ffd7cc', fontSize: 14, lineHeight: 20, marginBottom: SPACING.md },
  btn: { flexDirection: 'row', gap: SPACING.md, backgroundColor: '#fff', paddingVertical: 16, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700' },
});
