type StepPhase = {
  steps: string[];
  timers?: Array<{ id: string }>;
};

type ProDirectStepAlignmentOptions = {
  isProGlutenFreeBlend: boolean;
  isProEffectivelyGlutenFree: boolean;
  fridgeTemperatureText: string;
  yeastDisplay?: string;
};

function formatYeastMeasurementStep(steps: string[], yeastDisplay?: string): string[] {
  if (!yeastDisplay) return steps;
  const stepIndex = steps.findIndex((step) =>
    /(?:izmjerite|measure|wiegen sie|odmerite)/i.test(step)
      && /\b(?:kvasca|kvasa|yeast|hefe)\b/i.test(step),
  );
  if (stepIndex < 0) return steps;

  const formattedStep = steps[stepIndex].replace(
    /(?:\d+(?:[.,]\d+)*)\s*g(?=\s+(?:kvasca|kvasa|yeast|hefe)\b)/i,
    `${yeastDisplay} g`,
  );
  if (formattedStep === steps[stepIndex]) return steps;
  return steps.map((step, index) => index === stepIndex ? formattedStep : step);
}

export function alignProDirectSteps<T extends StepPhase>(
  generatedSteps: T[],
  beginnerReferenceSteps: T[],
  options: ProDirectStepAlignmentOptions,
): T[] {
  return generatedSteps.map((phase, index) => {
    const referencePhase = beginnerReferenceSteps[index];
    if (!referencePhase || options.isProGlutenFreeBlend) {
      const steps = formatYeastMeasurementStep(phase.steps, options.yeastDisplay);
      return steps === phase.steps ? phase : { ...phase, steps };
    }

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

    return { ...phase, steps: formatYeastMeasurementStep(steps, options.yeastDisplay) };
  });
}
