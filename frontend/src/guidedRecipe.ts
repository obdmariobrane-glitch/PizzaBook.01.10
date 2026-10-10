export type GuidedActionId = 'mix' | 'fold1' | 'fold2' | 'fridgeIn' | 'fridgeInCombined' | 'balling' | 'portioning' | 'doughRest' | 'trayPrepare' | 'fridgeOut' | 'roomFermentationEnd' | 'preheat' | 'shape' | 'bake';

export type GuidedScheduleEvent = {
  id: GuidedActionId;
  at: Date;
  activeUntil?: Date;
  label: string;
  actionable: boolean;
};

export type GuidedDateGroup = {
  key: string;
  date: Date;
  events: GuidedScheduleEvent[];
};

export function groupGuidedEventsByLocalDate(events: readonly GuidedScheduleEvent[]): GuidedDateGroup[] {
  const groups = new Map<string, GuidedDateGroup>();
  const ordered = [...events].sort((left, right) => left.at.getTime() - right.at.getTime());

  for (const event of ordered) {
    const key = `${event.at.getFullYear()}-${event.at.getMonth()}-${event.at.getDate()}`;
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, date: event.at, events: [event] });
  }

  return [...groups.values()];
}

export function getNextGuidedEvent(
  events: readonly GuidedScheduleEvent[],
  completedAt: Readonly<Record<string, number>>,
): GuidedScheduleEvent | null {
  return [...events]
    .filter((event) => event.actionable && completedAt[event.id] === undefined)
    .sort((left, right) => left.at.getTime() - right.at.getTime())[0] ?? null;
}

export function getNighttimeActiveEvents(
  events: readonly GuidedScheduleEvent[],
): GuidedScheduleEvent[] {
  const overlapsNight = (event: GuidedScheduleEvent) => {
    const end = event.activeUntil ?? event.at;
    if (!event.activeUntil) {
      const hour = event.at.getHours();
      return hour >= 0 && hour < 6;
    }
    const cursor = new Date(event.at);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(end);
    lastDay.setHours(0, 0, 0, 0);
    for (let day = cursor; day.getTime() <= lastDay.getTime(); day.setDate(day.getDate() + 1)) {
      const nightStart = new Date(day);
      nightStart.setHours(0, 0, 0, 0);
      const nightEnd = new Date(day);
      nightEnd.setHours(6, 0, 0, 0);
      if (event.at.getTime() < nightEnd.getTime() && end.getTime() > nightStart.getTime()) return true;
    }
    return false;
  };
  return events.filter((event) => event.actionable && overlapsNight(event));
}

export function getGuidedProgress(
  events: readonly GuidedScheduleEvent[],
  completedAt: Readonly<Record<string, number>>,
): { completed: number; total: number } {
  const actionable = events.filter((event) => event.actionable);
  return {
    completed: actionable.filter((event) => completedAt[event.id] !== undefined).length,
    total: actionable.length,
  };
}

export function getGuidedCountdown(
  scheduledAt: Date,
  now: number,
): { status: 'due' | 'upcoming' | 'overdue'; milliseconds: number } {
  const difference = scheduledAt.getTime() - now;
  if (difference <= 60_000 && difference >= -60_000) return { status: 'due', milliseconds: 0 };
  return difference > 0
    ? { status: 'upcoming', milliseconds: difference }
    : { status: 'overdue', milliseconds: -difference };
}

export function createGuidedPlanId(identity: readonly (string | number | boolean | null | undefined)[]): string {
  return `beginner-guided-v1:${JSON.stringify(identity)}`;
}

export function getLocalDayOffset(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay - fromDay) / 86_400_000);
}

export type GuidedNotificationItem = {
  event: GuidedScheduleEvent;
  combinedWith?: GuidedScheduleEvent;
};

// Events are all kept for the UI; only the notification layer merges a room-fermentation end with a preheat at the same instant.
export function planGuidedNotifications(
  events: readonly GuidedScheduleEvent[],
  completedAt: Readonly<Record<string, number>>,
  now: number,
): GuidedNotificationItem[] {
  const pending = events.filter((event) => event.actionable && completedAt[event.id] === undefined && event.at.getTime() > now);
  const roomEnd = pending.find((event) => event.id === 'roomFermentationEnd');
  const preheat = roomEnd ? pending.find((event) => event.id === 'preheat' && event.at.getTime() === roomEnd.at.getTime()) : undefined;
  return pending
    .filter((event) => event !== preheat)
    .map((event) => (event === roomEnd && preheat ? { event, combinedWith: preheat } : { event }));
}
