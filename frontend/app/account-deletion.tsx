import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';

import { useAuth } from '../src/auth';
import { useT } from '../src/i18n/LanguageProvider';
import { COLORS, SPACING, RADIUS } from '../src/theme';

export default function AccountDeletion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { user, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const removeAccount = () => {
    Alert.alert(t.profile.deleteAccountTitle, t.profile.deleteAccountWarning, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deleteAccount,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
          } catch {
            Alert.alert(t.legal.errorTitle, t.legal.accountDeletion.error);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevron-back" size={26} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t.profile.deleteAccount}</Text>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxxl }]}>
        <Text style={styles.title}>{t.profile.deleteAccountTitle}</Text>
        <Text style={styles.body}>{t.profile.deleteAccountWarning}</Text>
        <Text style={styles.body}>
          {user ? t.legal.accountDeletion.signedIn : t.legal.accountDeletion.signedOut}
        </Text>
        {user ? (
          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={removeAccount} disabled={busy}>
            <Icon name="trash-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>{busy ? '...' : t.profile.deleteAccount}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>{t.login.google}</Text>
          </Pressable>
        )}
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
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: '800' },
  body: { color: COLORS.onSurfaceTertiary, fontSize: 15, lineHeight: 23 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.error, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
