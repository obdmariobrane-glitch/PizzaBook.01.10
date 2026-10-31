import type { ProGuideManual } from './types';
import { PRO_LEARN_SL_PART1 } from './manualContent.sl.part1';
import { PRO_LEARN_SL_PART2 } from './manualContent.sl.part2';
import { PRO_LEARN_SL_PART3 } from './manualContent.sl.part3';

export const PRO_LEARN_SL: ProGuideManual = {
  locale: 'sl',
  title: 'PizzaBookova šola za izkušene',
  introduction: 'Praktični PizzaBookov vodnik za razumevanje testa in pripravo pice doma. Količine in časovni načrti so začetne ocene: spremljajte temperaturo, videz in raztegljivost testa ter po potrebi prilagodite čas.',
  topics: [...PRO_LEARN_SL_PART1, ...PRO_LEARN_SL_PART2, ...PRO_LEARN_SL_PART3],
};
