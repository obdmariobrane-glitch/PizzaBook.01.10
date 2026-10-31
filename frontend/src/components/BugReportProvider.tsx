import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import { useT } from '../i18n/LanguageProvider';
import { COLORS, RADIUS, SPACING } from '../theme';

const SHAKE_TO_REPORT_STORAGE_KEY = 'shakeToReportBugEnabled';
const REPORT_EMAIL = 'support@pizzabook.app';
const SHAKE_THRESHOLD = 1.1;
const SHAKE_COOLDOWN_MS = 1500;

type BugReportContextValue = {
  shakeEnabled: boolean | null;
  setShakeEnabled: (enabled: boolean) => Promise<void>;
  openBugReport: () => void;
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

export function useBugReport() {
  const context = useContext(BugReportContext);
  if (!context) throw new Error('useBugReport must be used within BugReportProvider.');
  return context;
}

export function BugReportProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const copy = t.profile.preferences;
  const [shakeEnabled, setShakeEnabledState] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState('');
  const [isOpeningEmail, setIsOpeningEmail] = useState(false);
  const lastShakeAt = useRef(0);
  const modalOpenRef = useRef(false);

  useEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SHAKE_TO_REPORT_STORAGE_KEY).then((value) => {
      if (active) setShakeEnabledState(value === null ? true : value === 'true');
    }).catch((error: unknown) => {
      console.error('Unable to load shake-to-report preference.', error);
      if (active) setShakeEnabledState(false);
    });
    return () => { active = false; };
  }, []);

  const setShakeEnabled = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(SHAKE_TO_REPORT_STORAGE_KEY, String(enabled));
      setShakeEnabledState(enabled);
    } catch (error) {
      console.error('Unable to save shake-to-report preference.', error);
      throw error;
    }
  }, []);

  const openBugReport = useCallback(() => {
    modalOpenRef.current = true;
    setTitle('');
    setDetails('');
    setFormError('');
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || shakeEnabled !== true) return;
    let active = true;
    let previous: { x: number; y: number; z: number } | null = null;
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    void Accelerometer.isAvailableAsync().then((available) => {
      if (!active) return;
      if (!available) {
        console.warn('Shake-to-report is unavailable because this device has no accelerometer.');
        return;
      }
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener((reading) => {
        const current = { x: reading.x, y: reading.y, z: reading.z };
        if (previous) {
          const delta = Math.hypot(
            current.x - previous.x,
            current.y - previous.y,
            current.z - previous.z,
          );
          const now = Date.now();
          if (
            delta >= SHAKE_THRESHOLD
            && now - lastShakeAt.current >= SHAKE_COOLDOWN_MS
            && !modalOpenRef.current
          ) {
            lastShakeAt.current = now;
            openBugReport();
          }
        }
        previous = current;
      });
    }).catch((error: unknown) => {
      console.error('Unable to initialize shake-to-report sensor.', error);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [openBugReport, shakeEnabled]);

  const submitReport = async () => {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();
    if (!trimmedTitle || !trimmedDetails) {
      setFormError(copy.bugReportRequired);
      return;
    }
    const subject = encodeURIComponent(`${copy.bugReportEmailSubject}: ${trimmedTitle}`);
    const body = encodeURIComponent(`${trimmedDetails}`);
    const mailto = `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
    setIsOpeningEmail(true);
    setFormError('');
    try {
      await Linking.openURL(mailto);
      modalOpenRef.current = false;
      setModalOpen(false);
      Alert.alert(copy.bugReportEmailReadyTitle, copy.bugReportEmailReadyBody);
    } catch (error) {
      console.error('Unable to open the email app for a bug report.', error);
      setFormError(copy.bugReportEmailError);
    } finally {
      setIsOpeningEmail(false);
    }
  };

  const contextValue = useMemo(
    () => ({ shakeEnabled, setShakeEnabled, openBugReport }),
    [openBugReport, setShakeEnabled, shakeEnabled],
  );

  return (
    <BugReportContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          modalOpenRef.current = false;
          setModalOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.heading}>{copy.bugReportTitle}</Text>
              <Text style={styles.label}>{copy.bugReportSummary}</Text>
              <TextInput
                testID="bug-report-summary"
                value={title}
                onChangeText={setTitle}
                placeholder={copy.bugReportSummaryPlaceholder}
                style={styles.input}
                accessibilityLabel={copy.bugReportSummary}
                maxLength={120}
                returnKeyType="next"
              />
              <Text style={styles.label}>{copy.bugReportDetails}</Text>
              <TextInput
                testID="bug-report-details"
                value={details}
                onChangeText={setDetails}
                placeholder={copy.bugReportDetailsPlaceholder}
                style={[styles.input, styles.multilineInput]}
                accessibilityLabel={copy.bugReportDetails}
                multiline
                textAlignVertical="top"
                maxLength={4000}
              />
              {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  testID="bug-report-cancel"
                  accessibilityRole="button"
                  onPress={() => {
                    modalOpenRef.current = false;
                    setModalOpen(false);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{copy.bugReportCancel}</Text>
                </Pressable>
                <Pressable
                  testID="bug-report-submit"
                  accessibilityRole="button"
                  onPress={() => { void submitReport(); }}
                  disabled={isOpeningEmail}
                  style={[styles.primaryButton, isOpeningEmail && styles.disabledButton]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isOpeningEmail ? copy.bugReportOpeningEmail : copy.bugReportSubmit}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </BugReportContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.55)' },
  card: { maxHeight: '90%', backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg },
  heading: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', marginBottom: SPACING.md },
  label: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: '700', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  input: { minHeight: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, color: COLORS.onSurface, backgroundColor: COLORS.surfaceSecondary, fontSize: 15 },
  multilineInput: { minHeight: 140, paddingTop: SPACING.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },
  secondaryButton: { minHeight: 44, minWidth: 90, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary },
  secondaryButtonText: { color: COLORS.brand, fontWeight: '700', fontSize: 13 },
  primaryButton: { minHeight: 44, minWidth: 110, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  disabledButton: { opacity: 0.6 },
  error: { color: COLORS.error, fontSize: 13, lineHeight: 18, marginTop: SPACING.sm },
});
