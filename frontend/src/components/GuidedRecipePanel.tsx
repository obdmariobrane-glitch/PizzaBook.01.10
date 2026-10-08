import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { COLORS, SPACING } from '../theme';
import type { GuidedActionId, GuidedDateGroup, GuidedScheduleEvent } from '../guidedRecipe';

type GuidedRecipePanelProps = {
  nextEvent: GuidedScheduleEvent | null;
  nextTimeLabel: string;
  progress: { completed: number; total: number };
  notificationsEnabled: boolean;
  notificationsAvailable: boolean;
  labels: {
    progress: string;
    progressCount: string;
    next: string;
    notifications: string;
    notificationsOn: string;
    notificationsOff: string;
    notificationsUnavailable: string;
    noNext: string;
  };
  onToggleNotifications: () => void;
};

type GuidedRecipeScheduleProps = {
  groups: GuidedDateGroup[];
  completedAt: Readonly<Record<string, number>>;
  nextEvent: GuidedScheduleEvent | null;
  dateLocale: string;
  labels: {
    complete: string;
    completed: string;
  };
  onComplete: (stepId: GuidedActionId) => void;
};

export default function GuidedRecipePanel({
  nextEvent,
  nextTimeLabel,
  progress,
  notificationsEnabled,
  notificationsAvailable,
  labels,
  onToggleNotifications,
}: GuidedRecipePanelProps) {
  const progressPercent = progress.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <View style={styles.card} testID="guided-recipe-panel">
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>{labels.progress}</Text>
        <Text style={styles.progressCount} testID="guided-progress">
          {labels.progressCount.replace('{DONE}', String(progress.completed)).replace('{TOTAL}', String(progress.total))}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.nextCard} testID="guided-next-step">
        <Text style={styles.nextLabel}>{labels.next}</Text>
        {nextEvent ? (
          <>
            <Text style={styles.nextTitle}>{nextEvent.label}</Text>
            <Text style={styles.nextTime}>{nextTimeLabel}</Text>
          </>
        ) : (
          <Text style={styles.completedText}>{labels.noNext}</Text>
        )}
      </View>

      <Pressable
        testID="guided-notification-toggle"
        accessibilityRole="button"
        accessibilityState={{ disabled: !notificationsAvailable }}
        disabled={!notificationsAvailable}
        onPress={onToggleNotifications}
        style={({ pressed }) => [styles.notificationRow, pressed && notificationsAvailable && styles.pressed]}
      >
        <Icon name={notificationsAvailable && notificationsEnabled ? 'notifications' : 'notifications-off-outline'} size={18} color={notificationsAvailable && notificationsEnabled ? COLORS.brand : COLORS.muted} />
        <Text style={styles.notificationLabel}>{labels.notifications}</Text>
        <Text style={[styles.notificationState, notificationsEnabled && notificationsAvailable && styles.notificationStateOn]}>
          {!notificationsAvailable
            ? labels.notificationsUnavailable
            : notificationsEnabled ? labels.notificationsOn : labels.notificationsOff}
        </Text>
      </Pressable>

    </View>
  );
}

export function GuidedRecipeSchedule({
  groups,
  completedAt,
  nextEvent,
  dateLocale,
  labels,
  onComplete,
}: GuidedRecipeScheduleProps) {
  return (
    <View style={styles.scheduleList} testID="guided-schedule">
      {groups.map((group) => (
        <View key={group.key} style={styles.dateGroup}>
          <Text style={styles.dateHeading}>
            {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(group.date)}
          </Text>
          {group.events.map((event) => {
            const completed = completedAt[event.id] !== undefined;
            const active = nextEvent?.id === event.id;
            return (
              <View
                key={event.id}
                testID={`guided-step-${event.id}`}
                style={[styles.eventRow, active && styles.eventRowActive]}
              >
                <Text style={styles.eventTime}>
                  {new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit' }).format(event.at)}
                </Text>
                <Text style={[styles.eventLabel, completed && styles.eventLabelCompleted]}>{event.label}</Text>
                {event.actionable ? (
                  <Pressable
                    testID={`guided-complete-${event.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ checked: completed, disabled: completed }}
                    disabled={completed}
                    onPress={() => onComplete(event.id)}
                    style={[styles.completeButton, completed && styles.completeButtonDone]}
                  >
                    <Text style={[styles.completeText, completed && styles.completeTextDone]}>
                      {completed ? `✓ ${labels.completed}` : labels.complete}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md, padding: SPACING.lg, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  progressTitle: { color: COLORS.brandDark, fontSize: 15, fontWeight: '800' },
  progressCount: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: COLORS.surfaceTertiary },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.brand },
  nextCard: { gap: 4, padding: SPACING.md, borderRadius: 12, backgroundColor: COLORS.brandTertiary },
  nextLabel: { color: COLORS.onBrandTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  nextTitle: { color: COLORS.brandDark, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  nextTime: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: '600' },
  completedText: { color: COLORS.onSurfaceTertiary, fontSize: 14, lineHeight: 19 },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38 },
  notificationLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  notificationState: { flex: 1, color: COLORS.muted, fontSize: 12, textAlign: 'right' },
  notificationStateOn: { color: COLORS.brand, fontWeight: '700' },
  scheduleList: { gap: SPACING.md },
  dateGroup: { gap: 6 },
  dateHeading: { marginTop: 5, color: COLORS.brandDark, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  eventRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 5, paddingVertical: 4, borderRadius: 8 },
  eventRowActive: { backgroundColor: COLORS.brandTertiary },
  eventTime: { color: COLORS.brand, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  eventLabel: { flex: 1, minWidth: 0, color: COLORS.onSurface, fontSize: 12, lineHeight: 17 },
  eventLabelCompleted: { color: COLORS.muted, textDecorationLine: 'line-through' },
  completeButton: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  completeButtonDone: { borderColor: COLORS.success, backgroundColor: '#EAF3ED' },
  completeText: { color: COLORS.onSurface, fontSize: 11, fontWeight: '700' },
  completeTextDone: { color: COLORS.success },
  pressed: { opacity: 0.75 },
});
