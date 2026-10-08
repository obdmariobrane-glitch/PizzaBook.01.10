import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, View, Text, Pressable, ScrollView, Modal, StyleSheet, LogBox, Alert } from 'react-native';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth, api } from '../src/auth';
import { LanguageProvider, useT } from '../src/i18n/LanguageProvider';
import { LANGS, Lang } from '../src/i18n/translations';
import { COLORS } from '../src/theme';
import AnimatedSplash from '../src/components/AnimatedSplash';
import { getCachedExperienceLevel, loadExperienceLevel, subscribeExperienceLevel } from '../src/experienceLevel';
import { loadTemperatureUnit, loadMeasurementSystem, loadPreferredYeastType } from '../src/preferences';
import {
  setupHandlerAndChannel,
  addTapListener,
  getColdStartData,
  getPermissionState,
  requestAndGetDeviceToken,
  isPushSupported,
} from '../src/notifications';

LogBox.ignoreAllLogs(true);

// Module-scope setup (safe no-op if unsupported)
setupHandlerAndChannel();

const PUSH_INSTALLATION_ID_KEY = 'pushInstallationId';
const UPDATE_ALERT_SHOWN_KEY = 'updateAlertShownVersion';

async function getPushInstallationId() {
  const stored = await AsyncStorage.getItem(PUSH_INSTALLATION_ID_KEY);
  if (stored) return stored;
  const generated = `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(PUSH_INSTALLATION_ID_KEY, generated);
  return generated;
}

function AuthGate() {
  const { user, loading, signInWithSessionId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [animationDone, setAnimationDone] = useState(false);
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const finishSplashAnimation = useCallback(() => setAnimationDone(true), []);

  useEffect(() => {
    loadExperienceLevel();
    loadTemperatureUnit();
    loadMeasurementSystem();
    loadPreferredYeastType();
  }, []);

  const openUpdate = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Preuzimanje nije uspjelo', 'Otvori update link ručno u browseru.');
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        const manifestUrl = Constants.expoConfig?.extra?.updateManifestUrl;
        const backendUpdate = await api('/api/app-update').catch(() => null);
        let update = backendUpdate;
        if (manifestUrl) {
          const manifestUpdate = await fetch(manifestUrl)
            .then((response) => response.ok ? response.json() : null)
            .catch(() => null);
          update = manifestUpdate || backendUpdate;
        }
        const currentVersion = Constants.expoConfig?.version || '0.0.0';
        const currentVersionCode = Constants.expoConfig?.android?.versionCode || 0;
        const newerVersion = compareVersions(update?.version || '0.0.0', currentVersion) > 0;
        const newerBuild = Number(update?.version_code || 0) > currentVersionCode;
        if (cancelled || !update?.apk_url || (!newerVersion && !newerBuild)) return;
        const updateKey = `${update.version || '0.0.0'}:${update.version_code || 0}`;
        if (await AsyncStorage.getItem(UPDATE_ALERT_SHOWN_KEY) === updateKey) return;
        await AsyncStorage.setItem(UPDATE_ALERT_SHOWN_KEY, updateKey);
        Alert.alert(
          'Pizzabook update',
          update.message || 'Dostupna je nova verzija Pizzabooka.',
          [
            { text: 'Kasnije', style: 'cancel' },
            { text: 'Preuzmi update', onPress: () => { void openUpdate(update.apk_url); } },
          ],
        );
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle deep links w/ session_id
  useEffect(() => {
    if (Platform.OS === 'web') {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      const m = url.match(/[?#&]session_id=([^&#]+)/);
      if (m) {
        signInWithSessionId(decodeURIComponent(m[1])).finally(() => {
          try {
            const clean = window.location.origin + window.location.pathname;
            window.history.replaceState(window.history.state, '', clean);
          } catch {}
        });
      }
      return;
    }

    let stashed: string | null = null;
    const sub = Linking.addEventListener('url', (e) => {
      if (e?.url) stashed = e.url;
      const m = e?.url?.match(/[?#&]session_id=([^&#]+)/);
      if (m) signInWithSessionId(decodeURIComponent(m[1]));
    });

    Linking.getInitialURL().then((url) => {
      const src = url || stashed;
      const m = src?.match(/[?#&]session_id=([^&#]+)/);
      if (m) signInWithSessionId(decodeURIComponent(m[1]));
    });

    return () => sub.remove();
  }, [signInWithSessionId]);

  // Push tap handlers (only when supported)
  useEffect(() => {
    if (Platform.OS === 'web' || !isPushSupported()) return;

    const openNotification = (data: Record<string, unknown>) => {
      if (data.source === 'pizza-guided-recipe' && typeof data.stepId === 'string') {
        router.push(`/(tabs)?focus=guided&stepId=${encodeURIComponent(data.stepId)}`);
        return;
      }
      const url = data?.deeplink || data?.action_url;
      if (typeof url !== 'string') return;
      if (url.startsWith('http')) Linking.openURL(url);
      else router.push(url as Href);
    };

    const tapSub = addTapListener(openNotification);

    getColdStartData().then((data) => {
      if (data) openNotification(data);
    });

    (async () => {
      try {
        const { status, canAskAgain } = await getPermissionState();
        if (status !== 'denied' || canAskAgain) return;
        const lastNudge = await AsyncStorage.getItem('pushNudgeAt');
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
        await AsyncStorage.setItem('pushNudgeAt', String(Date.now()));
      } catch {}
    })();

    return () => { try { tapSub.remove(); } catch {} };
  }, [router]);

  // Register push for every installed device, then associate it with the user after login.
  useEffect(() => {
    if (Platform.OS === 'web' || !isPushSupported()) return;
    (async () => {
      const token = await requestAndGetDeviceToken();
      if (!token) return;
      try {
        const installationId = await getPushInstallationId();
        await api('/api/register-push', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user?.user_id ?? installationId,
            installation_id: installationId,
            anonymous: !user,
            platform: Platform.OS,
            device_token: token,
          }),
        });
      } catch {}
    })();
  }, [user]);

  // Auth gate: allow anonymous browsing. Only redirect logged-in users off /login.
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'login';
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments, router]);

  // Onboarding gate: first launch (no saved experience level) must see it before the rest of the app.
  useEffect(() => {
    if (experienceLevel === undefined) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (experienceLevel === null && !inOnboarding) router.replace('/onboarding');
    else if (experienceLevel !== null && inOnboarding) router.replace('/(tabs)');
  }, [experienceLevel, segments, router]);

  if (loading || !animationDone || experienceLevel === undefined) {
    return <AnimatedSplash onFinish={finishSplashAnimation} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.surface } }} />
      <WelcomeModal />
    </>
  );
}

const WELCOME_COPY: Record<Lang, { title: string; body: string; dontShow: string; continue: string }> = {
  hr: {
    title: 'Dobrodošli u tvoju novu omiljenu aplikaciju za savršenu pizzu! 🍕',
    body: 'Sve što vidiš u ovoj aplikaciji nastalo je iz mog osobnog kulinarskog putovanja i onih dana kada sam se na svojim počecima žestoko mučio kako doći do savršene pizze. Prošao sam cijeli put – od obične kućne pećnice, preko pećnice s kamenom za pečenje, sve do prave, specijalizirane peći za pizzu.\n\nKroz taj proces osobno sam isprobao svaku moguću varijablu i svaki recept ispekao bezbroj puta. Upravo me to vodilo pri izradi ove aplikacije: želja da sav taj nakupljeni trud, testiranja i iskustvo pretočim u alat koji će pojednostaviti cijeli proces i približiti ti kako tijesto točno funkcionira – bez obzira pečeš li svoju prvu pizzu u životu ili si već iskusni majstor na višoj razini.\n\nZasuči rukave, zabavi se i napravi pizzu kakvu zaslužuješ. Sretno! 🥂🔥',
    dontShow: 'Ne prikazuj ovu poruku ponovno',
    continue: 'Nastavi',
  },
  en: {
    title: 'Welcome to your new favorite app for the perfect pizza! 🍕',
    body: 'Everything you see in this app was born from my personal culinary journey and those early days when I struggled hard to figure out how to make the ultimate pizza. I’ve walked the entire path – from a standard home oven, to an oven with a baking stone, all the way to a true, specialized pizza oven.\n\nThroughout that process, I personally tested every possible variable and baked each recipe countless times. That is what guided me while building this app: the desire to translate all that accumulated effort, testing, and experience into a tool that simplifies the entire process and explains how dough truly works – whether you are baking your very first pizza in life or you are already an advanced master.\n\nRoll up your sleeves, have fun, and make the pizza you deserve. Good luck! 🥂🔥',
    dontShow: 'Do not show this message again',
    continue: 'Continue',
  },
  de: {
    title: 'Willkommen in deiner neuen Lieblings-App für die perfekte Pizza! 🍕',
    body: 'Alles, was du in dieser App siehst, ist aus meiner persönlichen kulinarischen Reise entstanden und aus den Tagen, an denen ich mich anfangs schwergetan habe, um die perfekte Pizza hinzubekommen. Ich habe den ganzen Weg hinter mir – vom normalen Haushaltsbackofen über den Backofen mit Pizzastein bis hin zu einem echten, spezialisierten Pizzaofen.\n\nDabei habe ich persönlich jede erdenkliche Variable ausprobiert und jedes Rezept unzählige Male gebacken. Genau das hat mich bei der Entwicklung dieser App geleitet: der Wunsch, all die gesammelte Arbeit, die Tests und die Erfahrung in ein Tool zu verwandeln, das den gesamten Prozess vereinfacht und dir näherbringt, wie Teig genau funktioniert – egal, ob du gerade deine erste Pizza im Leben backst oder bereits ein erfahrener Meister auf höherem Niveau bist.\n\nKrempel die Ärmel hoch, hab Spaß und mach dir die Pizza, die du verdienst. Viel Erfolg! 🥂🔥',
    dontShow: 'Diese Nachricht nicht erneut anzeigen',
    continue: 'Weiter',
  },
  sl: {
    title: 'Dobrodošel v svoji novi najljubši aplikaciji za popolno pico! 🍕',
    body: 'Vse, kar vidiš v tej aplikaciji, je nastalo iz mojega osebnega kulinaričnega potovanja in tistih dni, ko sem se na svojih začetkih pošteno mučil, kako priti do popolne pice. Prehodil sem celotno pot – od običajne domače pečice, prek pečice s kamnom za peko, vse do prave, specializirane peči za pice.\n\nSkozi ta proces sem osebno preizkusil vsako možno variablo in vsak recept spekel neštetokrat. Prav to me je vodilo pri ustvarjanju te aplikacije: želja, da ves ta nakopičeni trud, testiranja in izkušnje pretopim v orodje, ki bo poenostavilo celoten postopek in ti približalo, kako testo natančno deluje – ne glede na to, ali pečeš svojo prvo pico v življenju ali pa si že izkušen mojster na višji ravni.\n\nZasuči rokave, zabavaj se in si speči pico, kot si jo zaslužiš. Srečno! 🥂🔥',
    dontShow: 'Tega sporočila ne prikaži več',
    continue: 'Nadaljuj',
  },
};

function WelcomeModal() {
  const { lang, setLang } = useT();
  const [selectedLang, setSelectedLang] = useState<Lang>(lang);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const copy = WELCOME_COPY[selectedLang];

  useEffect(() => {
    AsyncStorage.getItem('welcomeMessageDismissed').then((value) => {
      setDismissed(value === 'true');
      setReady(true);
    });
  }, []);

  const selectLanguage = (nextLang: Lang) => {
    setSelectedLang(nextLang);
    setLang(nextLang);
  };

  const continueToApp = async () => {
    if (dontShowAgain) await AsyncStorage.setItem('welcomeMessageDismissed', 'true');
    setDismissed(true);
  };

  return (
    <Modal visible={ready && !dismissed} animationType="fade" transparent onRequestClose={continueToApp}>
      <View style={styles.welcomeOverlay}>
        <View style={styles.welcomeCard}>
          <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.welcomeTitle}>{copy.title}</Text>
            <Text style={styles.welcomeBody}>{copy.body}</Text>

            <Text style={styles.welcomeLanguageTitle}>Jezik / Language / Sprache / Jezik</Text>
            <View style={styles.welcomeLanguages}>
              {LANGS.map((language) => (
                <Pressable
                  key={language.code}
                  testID={`welcome-lang-${language.code}`}
                  onPress={() => selectLanguage(language.code)}
                  style={[styles.welcomeLanguage, selectedLang === language.code && styles.welcomeLanguageActive]}
                >
                  <Text style={[styles.welcomeLanguageFlag, selectedLang === language.code && styles.welcomeLanguageTextActive]}>{language.flag}</Text>
                  <Text style={[styles.welcomeLanguageText, selectedLang === language.code && styles.welcomeLanguageTextActive]}>{language.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable testID="welcome-dont-show" onPress={() => setDontShowAgain((value) => !value)} style={styles.welcomeCheckRow}>
              <View style={[styles.welcomeCheckbox, dontShowAgain && styles.welcomeCheckboxActive]}>
                {dontShowAgain ? <Text style={styles.welcomeCheckmark}>✓</Text> : null}
              </View>
              <Text style={styles.welcomeCheckText}>{copy.dontShow}</Text>
            </Pressable>
            <Pressable testID="welcome-continue" onPress={continueToApp} style={styles.welcomeButton}>
              <Text style={styles.welcomeButtonText}>{copy.continue}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function compareVersions(left: string, right: string) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F7C894' }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  welcomeOverlay: { flex: 1, backgroundColor: 'rgba(28,25,23,0.72)', justifyContent: 'center', padding: 20 },
  welcomeCard: { maxHeight: '88%', backgroundColor: COLORS.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  welcomeContent: { padding: 24, gap: 18 },
  welcomeTitle: { color: COLORS.onSurface, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  welcomeBody: { color: COLORS.onSurface, fontSize: 15, lineHeight: 23 },
  welcomeLanguageTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  welcomeLanguages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  welcomeLanguage: { flexGrow: 1, minWidth: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  welcomeLanguageActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  welcomeLanguageFlag: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
  welcomeLanguageText: { color: COLORS.onSurface, fontSize: 14, fontWeight: '600' },
  welcomeLanguageTextActive: { color: '#fff' },
  welcomeCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  welcomeCheckbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  welcomeCheckboxActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  welcomeCheckmark: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  welcomeCheckText: { flex: 1, color: COLORS.onSurface, fontSize: 14 },
  welcomeButton: { backgroundColor: COLORS.brand, borderRadius: 10, alignItems: 'center', paddingVertical: 14 },
  welcomeButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
