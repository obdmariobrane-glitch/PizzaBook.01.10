import type { BaseTimer } from './prefermentSteps';

type Phase = {
  steps: string[];
  timers?: BaseTimer[];
};

export function adaptProGlutenFreeMixingPhaseA<T extends Phase>(
  phase: T,
  mixing: 'hand' | 'mixer' | 'spiral',
): T {
  const postMixRestTimerIds = ['post-mix-rest', 'post-mix-rest15m'];
  const timers = phase.timers;
  if (!timers?.some((timer) => postMixRestTimerIds.includes(timer.id))) {
    throw new Error('PRO gluten-free mixing phase is missing its post-mix rest timer.');
  }

  return {
    ...phase,
    steps: mixing === 'hand' ? phase.steps.slice(0, -1) : phase.steps,
    timers: mixing === 'hand' ? timers.filter((timer) => !postMixRestTimerIds.includes(timer.id)) : timers,
  };
}