import type { ProGuideManual } from './types';
import { PRO_LEARN_DE_PART1 } from './manualContent.de.part1';
import { PRO_LEARN_DE_PART2 } from './manualContent.de.part2';
import { PRO_LEARN_DE_PART3 } from './manualContent.de.part3';

export const PRO_LEARN_DE: ProGuideManual = {
  locale: 'de',
  title: 'PizzaBook-Pro-Schule',
  introduction: 'Ein praxisnaher PizzaBook-Leitfaden zum Verständnis von Teig und zur Pizzazubereitung zu Hause. Mengen und Zeitpläne sind Ausgangswerte: Beobachten Sie Temperatur, Aussehen und Dehnbarkeit des Teigs und passen Sie die Zeit bei Bedarf an.',
  topics: [...PRO_LEARN_DE_PART1, ...PRO_LEARN_DE_PART2, ...PRO_LEARN_DE_PART3],
};
