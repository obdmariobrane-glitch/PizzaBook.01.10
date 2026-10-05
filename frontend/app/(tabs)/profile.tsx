import { useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Pressable, TextInput, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Icon from '@react-native-vector-icons/ionicons';

import { useAuth } from '../../src/auth';
import { useT } from '../../src/i18n/LanguageProvider';
import { LANGS, Lang } from '../../src/i18n/translations';
import { COLORS, SPACING, RADIUS } from '../../src/theme';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, deleteAccount, updateProfile } = useAuth();
  const { t, lang, setLang } = useT();

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [equipment, setEquipment] = useState(user?.equipment || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, bio, equipment });
      setEdit(false);
    } finally { setSaving(false); }
  };

  const removeAccount = () => {
    Alert.alert(t.profile.deleteAccountTitle, t.profile.deleteAccountWarning, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deleteAccount,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } catch {
            Alert.alert(t.legal.errorTitle, t.legal.accountDeletion.error);
          }
        },
      },
    ]);
  };

  const legalLinks = (
    <View style={styles.card}>
      <Text style={styles.section}>{t.profile.settings}</Text>
      <Pressable style={styles.linkRow} onPress={() => router.push('/privacy')}>
        <Icon name="shield-checkmark-outline" size={20} color={COLORS.brand} />
        <Text style={styles.linkText}>{t.profile.privacyPolicy}</Text>
        <Icon name="chevron-forward" size={18} color={COLORS.muted} />
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.push('/terms')}>
        <Icon name="document-text-outline" size={20} color={COLORS.brand} />
        <Text style={styles.linkText}>{t.profile.terms}</Text>
        <Icon name="chevron-forward" size={18} color={COLORS.muted} />
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.push('/community-guidelines')}>
        <Icon name="people-outline" size={20} color={COLORS.brand} />
        <Text style={styles.linkText}>{t.profile.communityGuidelines}</Text>
        <Icon name="chevron-forward" size={18} color={COLORS.muted} />
      </Pressable>
    </View>
  );

  // Anonymous user view - login CTA + language picker
  if (!user) {
    return (
      <View style={styles.root}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1579751626657-72bc17010498' }}
          style={styles.hero}
          resizeMode="cover"
        >
          <LinearGradient colors={['rgba(28,25,23,0.2)', 'rgba(28,25,23,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroInner, { paddingTop: insets.top + SPACING.lg }]}>
            <View style={styles.heroTop}>
              <Text style={styles.heroTitle}>{t.profile.title}</Text>
              <View />
            </View>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>?</Text>
              </View>
              <Text style={styles.heroName}>{t.login.title}</Text>
            </View>
          </View>
        </ImageBackground>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xxxl, gap: SPACING.lg }}>
          <View style={styles.card}>
            <Text style={styles.section}>{t.login.title}</Text>
            <Text style={styles.bodyText}>{t.login.subtitle}</Text>
            <Pressable testID="profile-login-btn" style={styles.saveBtn} onPress={() => router.push('/login')}>
              <Text style={styles.saveBtnText}>{t.login.google}</Text>
            </Pressable>
          </View>
          {legalLinks}
          <View style={styles.card}>
            <Text style={styles.section}>{t.profile.language}</Text>
            <View style={{ gap: SPACING.sm }}>
              {LANGS.map((l) => (
                <Pressable
                  key={l.code}
                  testID={`lang-${l.code}`}
                  onPress={() => setLang(l.code as Lang)}
                  style={[styles.langRow, lang === l.code && styles.langRowActive]}
                >
                  <Text style={[styles.langFlag, lang === l.code && { color: '#fff' }]}>{l.flag}</Text>
                  <Text style={[styles.langLabel, lang === l.code && { color: '#fff', fontWeight: '700' }]}>{l.label}</Text>
                  {lang === l.code ? <Icon name="checkmark-circle" size={18} color="#fff" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1579751626657-72bc17010498' }}
        style={styles.hero}
        resizeMode="cover"
      >
        <LinearGradient colors={['rgba(28,25,23,0.2)', 'rgba(28,25,23,0.9)']} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroInner, { paddingTop: insets.top + SPACING.lg }]}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>{t.profile.title}</Text>
            <Pressable onPress={() => setEdit(!edit)} testID="edit-profile" style={styles.editBtn}>
              <Text style={styles.editBtnText}>{edit ? t.common.cancel : t.profile.edit}</Text>
            </Pressable>
          </View>
          <View style={styles.avatarWrap}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <Text style={styles.heroName}>{user?.name}</Text>
            <Text style={styles.heroEmail}>{user?.email}</Text>
          </View>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xxxl, gap: SPACING.lg }}>
        {edit ? (
          <View style={styles.card}>
            <Text style={styles.section}>{t.profile.settings}</Text>
            <View>
              <Text style={styles.label}>{t.profile.name}</Text>
              <TextInput testID="edit-name" value={name} onChangeText={setName} style={styles.input} />
            </View>
            <View>
              <Text style={styles.label}>{t.profile.bio}</Text>
              <TextInput testID="edit-bio" value={bio} onChangeText={setBio} style={[styles.input, { minHeight: 80 }]} multiline />
            </View>
            <View>
              <Text style={styles.label}>{t.profile.equipment}</Text>
              <TextInput
                testID="edit-equipment"
                value={equipment}
                onChangeText={setEquipment}
                style={[styles.input, { minHeight: 80 }]}
                multiline
                placeholder={t.profile.equipmentPlaceholder}
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <Pressable testID="save-profile" style={styles.saveBtn} onPress={save} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? '...' : t.profile.save}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.section}>{t.profile.equipment}</Text>
            <Text style={styles.bodyText}>{user?.equipment || t.profile.equipmentPlaceholder}</Text>
            {user?.bio ? (
              <>
                <Text style={styles.section}>{t.profile.bio}</Text>
                <Text style={styles.bodyText}>{user.bio}</Text>
              </>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>{t.profile.language}</Text>
          <View style={{ gap: SPACING.sm }}>
            {LANGS.map((l) => (
              <Pressable
                key={l.code}
                testID={`lang-${l.code}`}
                onPress={() => setLang(l.code as Lang)}
                style={[styles.langRow, lang === l.code && styles.langRowActive]}
              >
                <Text style={[styles.langFlag, lang === l.code && { color: '#fff' }]}>{l.flag}</Text>
                <Text style={[styles.langLabel, lang === l.code && { color: '#fff', fontWeight: '700' }]}>{l.label}</Text>
                {lang === l.code ? <Icon name="checkmark-circle" size={18} color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn}>
          <Icon name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>{t.profile.logout}</Text>
        </Pressable>
        {legalLinks}
        <Pressable testID="delete-account-btn" onPress={removeAccount} style={styles.deleteBtn}>
          <Icon name="trash-outline" size={20} color={COLORS.error} />
          <Text style={styles.deleteText}>{t.profile.deleteAccount}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  hero: { height: 260 },
  heroInner: { flex: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  editBtn: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.2)' },
  editBtnText: { color: '#fff', fontWeight: '600' },
  avatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff' },
  avatarFallback: { backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 32, fontWeight: '800' },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: SPACING.sm },
  heroEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  card: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  section: { fontSize: 13, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  label: { fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.border },
  bodyText: { fontSize: 14, color: COLORS.onSurface, lineHeight: 20 },
  saveBtn: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  langChip: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  langChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  langRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  langRowActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  langFlag: { fontSize: 12, color: COLORS.muted, fontWeight: '800', minWidth: 22 },
  langLabel: { flex: 1, fontSize: 15, color: COLORS.onSurface, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md },
  deleteText: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  linkText: { flex: 1, color: COLORS.onSurface, fontSize: 14, fontWeight: '600' },
});
