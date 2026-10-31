type StepPhase = {
  steps: string[];
  timers?: Array<{ id: string }>;
};

type ProDirectStepAlignmentOptions = {
  isProGlutenFreeBlend: boolean;
  isProEffectivelyGlutenFree: boolean;
  fridgeTemperatureText: string;
};

export function alignProDirectSteps<T extends StepPhase>(
  generatedSteps: T[],
  beginnerReferenceSteps: T[],
  options: ProDirectStepAlignmentOptions,
): T[] {
  return generatedSteps.map((phase, index) => {
    const referencePhase = beginnerReferenceSteps[index];
    if (!referencePhase || options.isProGlutenFreeBlend) return phase;

    const steps = [...referencePhase.steps];
    const isColdFermentationPhase = phase.timers?.some((timer) => timer.id === 'cold-fermentation');
    if (options.isProEffectivelyGlutenFree && isColdFermentationPhase) {
      const temperatureStepIndex = phase.steps.findIndex((step) =>
        step.includes(options.fridgeTemperatureText),
      );
      if (temperatureStepIndex < 0 || temperatureStepIndex >= steps.length) {
        throw new Error('Unable to align the PRO gluten-free cold-fermentation temperature step.');
      }
      steps[temperatureStepIndex] = phase.steps[temperatureStepIndex];
    }

    return { ...phase, steps };
  });
}
