export type GuidedActionId = 'mix' | 'fold1' | 'fold2' | 'fridgeIn' | 'balling' | 'portioning' | 'doughRest' | 'trayPrepare' | 'fridgeOut' | 'preheat' | 'shape' | 'bake';

export type GuidedScheduleEvent = {
  id: GuidedActionId;
  at: Date;
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
