import type { ProGuideManual } from './types';
import { PRO_LEARN_EN_PART1 } from './manualContent.en.part1';
import { PRO_LEARN_EN_PART2 } from './manualContent.en.part2';
import { PRO_LEARN_EN_PART3 } from './manualContent.en.part3';

export const PRO_LEARN_EN: ProGuideManual = {
  locale: 'en',
  title: 'PizzaBook Pro School',
  introduction: 'A practical PizzaBook guide to understanding dough and making pizza at home. Quantities and schedules are starting estimates: watch the dough temperature, appearance, and extensibility, and adjust the timing as needed.',
  topics: [...PRO_LEARN_EN_PART1, ...PRO_LEARN_EN_PART2, ...PRO_LEARN_EN_PART3],
};
