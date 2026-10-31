export type OnboardingExperienceLevel = 'beginner' | 'pro' | null | undefined;
export type OnboardingRoute = '/onboarding' | '/(tabs)';

export function getOnboardingRedirect(
  experienceLevel: OnboardingExperienceLevel,
  segments: readonly string[],
): OnboardingRoute | null {
  if (experienceLevel === undefined) return null;

  const currentRoute = segments[0];
  const canOpenWithoutExperience = currentRoute === 'onboarding'
    || currentRoute === 'pro-guide'
    || currentRoute === 'pro-unlock';

  if (experienceLevel === null) {
    return canOpenWithoutExperience ? null : '/onboarding';
  }

  if (currentRoute === 'onboarding' || segments.length === 0) {
    return '/(tabs)';
  }

  return null;
}
