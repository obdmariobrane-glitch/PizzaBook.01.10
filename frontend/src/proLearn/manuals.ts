import type { Lang } from '../i18n/translations';
import { PRO_LEARN_HR } from './manualContent.generated';
import type { ProGuideManual, ProGuideTopic } from './types';

export const PRO_LEARN_MANUALS: Record<Lang, ProGuideManual | null> = {
  hr: PRO_LEARN_HR,
  en: null,
  de: null,
  sl: null,
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
