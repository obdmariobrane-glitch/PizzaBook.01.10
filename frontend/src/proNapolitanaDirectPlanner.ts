export type ProNapolitanaDirectPlannerEvent = {
  at: Date;
  title: string;
  desc: string;
  phaseId?: string;
};

type Lang = 'hr' | 'en' | 'de' | 'sl';

export function addProNapolitanaDirectInitialPlannerSteps<T extends ProNapolitanaDirectPlannerEvent>(
  steps: readonly T[],
  lang: Lang,
  glutenFree = false,
): T[] {
  const mixStep = steps.find((step) => step.phaseId === 'direct.mix');
  const fridgeStep = steps.find((step) => step.phaseId === 'direct.fridge');
  if (!mixStep || !fridgeStep) return [...steps];

  const copy = {
    hr: {
      mixTitle: 'Završetak zamjesa',
      mixDesc: 'Ovo označava završetak zamjesa; Planner ne procjenjuje njegovo trajanje.',
      restTitle: glutenFree ? 'Hidratacija psylliuma' : 'Početni odmor tijesta',
      restDesc: glutenFree ? 'Pokrijte smjesu i ostavite je 5 minuta da psyllium upije vodu.' : 'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ballingTitle: 'Podjela i oblikovanje kuglica',
      ballingDesc: 'Podijelite tijesto i oblikujte kuglice prije hladnjaka.',
    },
    en: {
      mixTitle: 'Mixing complete',
      mixDesc: 'This marks the end of mixing; Planner does not estimate its duration.',
      restTitle: glutenFree ? 'Psyllium hydration' : 'Initial dough rest',
      restDesc: glutenFree ? 'Cover the mixture and leave it for 5 minutes so the psyllium can absorb water.' : 'Cover the dough and leave it to rest for 5 minutes.',
      ballingTitle: 'Divide and shape dough balls',
      ballingDesc: 'Divide the dough and shape the balls before refrigeration.',
    },
    de: {
      mixTitle: 'Ende des Knetens',
      mixDesc: 'Dies markiert das Ende des Knetens; Planner schätzt die Dauer nicht.',
      restTitle: glutenFree ? 'Psyllium-Hydratation' : 'Erste Teigruhe',
      restDesc: glutenFree ? 'Decken Sie die Masse ab und lassen Sie das Psyllium 5 Minuten Wasser aufnehmen.' : 'Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.',
      ballingTitle: 'Teig teilen und Teiglinge formen',
      ballingDesc: 'Teilen Sie den Teig und formen Sie die Teiglinge vor dem Kühlen.',
    },
    sl: {
      mixTitle: 'Konec mešanja testa',
      mixDesc: 'To označuje konec mešanja; Planner ne ocenjuje njegovega trajanja.',
      restTitle: glutenFree ? 'Hidracija psylliuma' : 'Začetni počitek testa',
      restDesc: glutenFree ? 'Maso pokrijte in jo pustite 5 minut, da psyllium vpije vodo.' : 'Testo pokrijte in ga pustite počivati 5 minut.',
      ballingTitle: 'Delitev in oblikovanje kroglic',
      ballingDesc: 'Testo razdelite in oblikujte kroglice pred hlajenjem.',
    },
  }[lang];
  const restAt = new Date(fridgeStep.at.getTime() - 5 * 60000);
  const initialSteps = steps.map((step) => step === mixStep
    ? { ...step, at: restAt, title: copy.mixTitle, desc: copy.mixDesc }
    : step);
  initialSteps.push(
    { ...mixStep, at: restAt, title: copy.restTitle, desc: copy.restDesc, phaseId: 'direct.initial.mix-rest' },
    { ...mixStep, at: new Date(fridgeStep.at), title: copy.ballingTitle, desc: copy.ballingDesc, phaseId: 'direct.initial.balling' },
  );
  return initialSteps.sort((left, right) => left.at.getTime() - right.at.getTime()
    || (left.phaseId === 'direct.initial.balling' ? -1 : 0)
      - (right.phaseId === 'direct.initial.balling' ? -1 : 0));
}