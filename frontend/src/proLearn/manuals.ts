import type { Lang } from '../i18n/translations';
import { PRO_LEARN_DE } from './manualContent.de';
import { PRO_LEARN_EN } from './manualContent.en';
import { PRO_LEARN_HR } from './manualContent.generated';
import { PRO_LEARN_SL } from './manualContent.sl';
import type { ProGuideManual, ProGuideTopic } from './types';

export const PRO_LEARN_MANUALS: Record<Lang, ProGuideManual> = {
  hr: PRO_LEARN_HR,
  en: PRO_LEARN_EN,
  de: PRO_LEARN_DE,
  sl: PRO_LEARN_SL,
};

export function findProLearnAnchor(
  manual: ProGuideManual,
  anchor: string,
): { topic: ProGuideTopic; sectionId: string | null } | null {
  for (const topic of manual.topics) {
    if (topic.id === anchor) return { topic, sectionId: null };
    const section = topic.sections.find((item) => item.id === anchor);
    if (section) return { topic, sectionId: section.id };
  }
  return null;
}
