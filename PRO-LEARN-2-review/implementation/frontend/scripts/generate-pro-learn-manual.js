const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '../../PRO-LEARN-HR.md');
const outputPath = path.resolve(__dirname, '../src/proLearn/manualContent.generated.ts');
const descriptions = {
  'topic-dough': 'Razumij kako sastojci stvaraju tijesto i prepoznaj njegov razvoj, elastičnost i podatnost.',
  'topic-flour': 'Čitaj deklaracije, razlikuj W, proteine i P/L te odaberi ili pomiješaj brašna.',
  'topic-water': 'Izračunaj hidrataciju i pekarske postotke te nauči postupno dodavati vodu.',
  'topic-yeast': 'Usporedi svježi, aktivni suhi i instant kvasac te primjereno odmjeri svaki proizvod.',
  'topic-additions': 'Saznaj kako sol, ulje, šećer i slad utječu na tijesto i kada ih dodati.',
  'topic-temperature': 'Mjeri temperature i procijeni vodu za ciljanu temperaturu tijesta.',
  'topic-fermentation': 'Razlikuj fermentaciju od dozrijevanja i procijeni spremnost po više znakova.',
  'topic-methods': 'Usporedi Direct, Bigu i Poolish uz ručno miješenje te planetarni i spiralni mikser.',
  'topic-handling': 'Vježbaj odmore, presavijanje, bulk-fermentaciju, dijeljenje i kuglanje.',
  'topic-cold-proof': 'Razdvoji hlađenje, temperiranje, završni odmor kugli i dizanje tijesta u plehu.',
  'topic-styles': 'Upoznaj Napolitanu, Romanu Tondu, Romanu Tegliu i New York stil.',
  'topic-gluten-free': 'Pripremi zasebno bezglutensko tijesto i spriječi unakrsni kontakt.',
  'topic-toppings': 'Upravljaj vlagom, količinama i redoslijedom umaka, sira i nadjeva.',
  'topic-equipment': 'Odaberi kamen, čelik, pleh ili pizza peć i procijeni toplinu.',
  'topic-troubleshooting': 'Poveži znakove tijesta i pečene pizze s mogućim uzrocima i prilagodbama.',
  'topic-storage': 'Sigurno čuvaj, zamrzni i odmrzni tijesto uz dobru higijenu.',
  'topic-recipes': 'Isprobaj potpune formule, raspodjelu prefermenta i vremenske rasporede.',
  'topic-glossary': 'Brzo pronađi objašnjenja ključnih pekarskih pojmova.',
};

const source = fs.readFileSync(sourcePath, 'utf8');
const topicHeaders = [...source.matchAll(/^## ([A-R])\. (.*?) \{#([^}]+)\}\s*$/gm)];
if (topicHeaders.length !== 18) {
  throw new Error(`Expected 18 A–R topics, found ${topicHeaders.length}`);
}

const introMatch = source.match(/^# (.+)\s*\n+([\s\S]*?)\n+## Sadržaj\b/);
if (!introMatch) throw new Error('Could not locate the manual title and introduction');

const topics = topicHeaders.map((match, index) => {
  const bodyStart = match.index + match[0].length;
  const bodyEnd = topicHeaders[index + 1]?.index ?? source.length;
  const body = source.slice(bodyStart, bodyEnd).trim();
  const sectionHeaders = [...body.matchAll(/^(#{3,4}) (.*?) \{#([^}]+)\}\s*$/gm)];
  if (sectionHeaders.length === 0) {
    throw new Error(`Topic ${match[3]} has no anchored subchapters`);
  }

  const headingLines = body.split('\n').filter((line) => /^#{3,4} /.test(line));
  if (headingLines.length !== sectionHeaders.length) {
    throw new Error(`Topic ${match[3]} has a subchapter without a stable ID`);
  }

  const leadingText = body.slice(0, sectionHeaders[0].index)
    .split('\n')
    .filter((line) => !line.startsWith('**Sadržaj teme:**'))
    .join('\n')
    .trim();

  const sections = sectionHeaders.map((section, sectionIndex) => {
    const sectionStart = section.index + section[0].length;
    const sectionEnd = sectionHeaders[sectionIndex + 1]?.index ?? body.length;
    return {
      id: section[3],
      title: section[2],
      level: section[1].length,
      markdown: body.slice(sectionStart, sectionEnd).trim(),
    };
  });

  return {
    id: match[3],
    title: match[2],
    description: descriptions[match[3]],
    introduction: leadingText,
    sections,
  };
});

for (const topic of topics) {
  if (!topic.description) throw new Error(`Missing card description for ${topic.id}`);
}

const manual = {
  locale: 'hr',
  title: introMatch[1],
  introduction: introMatch[2].trim(),
  topics,
};
const output = [
  "import type { ProGuideManual } from './types';",
  '',
  `export const PRO_LEARN_HR: ProGuideManual = ${JSON.stringify(manual, null, 2)};`,
  '',
].join('\n');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log(`Generated ${topics.length} topics from ${path.relative(process.cwd(), sourcePath)}`);
