const shapes = [
  { key: 'napolitana', name: 'Napolitana', kind: 'round', oven: 'Visoka temperatura prema odabiru pecnice' },
  { key: 'romana-tonda', name: 'Romana Tonda', kind: 'tonda', oven: 'Visoka temperatura prema odabiru pecnice' },
  { key: 'romana-teglia', name: 'Romana Teglia', kind: 'teglia', oven: 'Kucna pecnica na korisnickoj temperaturi' },
  { key: 'new-york', name: 'New York', kind: 'round', oven: 'Kucna pecnica ili pecnica prema odabiru' },
];
const flours = [
  { key: 'caputo00', name: 'Tipo 00', rule: 'Koristi osnovni postupak bez posebnog ogranicenja.' },
  { key: 'manitoba', name: 'Manitoba', rule: 'Mijesajte snaznije; koristite cvrsce Stretch & Fold preklape i vecu sposobnost drzanja hidratacije.' },
  { key: 'spelt', name: 'Pirovo brasno', rule: 'Mijesajte krace i njeznije; ne opterecujte strukturu i ne rastezite agresivno.' },
  { key: 'wholeWheat', name: 'Integralno brasno', rule: 'Mijesajte krace i njeznije; mekinje brze upijaju vodu, a baza ostaje manje prozracna.' },
  { key: 'custom', name: 'Mjesano brasno', rule: 'Koristi isti postupak kao Tipo 00; hidratacija se racuna prema odabranoj mjesavini.' },
  { key: 'glutenFree', name: 'Bezglutensko brasno', rule: 'Obavezan psyllium 2% od brasna; bez razvoja glutena, bez klasicnog Stretch & Folda i bez rastezanja u zraku.' },
];
const methods = [
  { key: 'direct', name: 'Direct' },
  { key: 'biga', name: 'Biga' },
  { key: 'poolish', name: 'Poolish' },
];
const mixing = [
  { key: 'hand', name: 'Rucni zamjes' },
  { key: 'mixer', name: 'Mikser' },
];

function flourLine(flour) {
  return `Izracunate kolicine: brasno [g], voda [g], sol [g], kvasac [g], ulje ili mast [g]. ${flour.rule}`;
}
function shapeSteps(shape, flour) {
  const glutenFree = flour.key === 'glutenFree';
  if (shape.kind === 'teglia') return [
    'Ne oblikujte kugle; tijesto ostaje kao jedna masa.',
    'Napravite njezne Stretch & Fold preklape u posudi tijekom fermentacije.',
    'Nakon hladne fermentacije zagrijte pecnicu na korisnicki unesenu temperaturu.',
    'Nauljite tepsiju prema unesenim dimenzijama i utisnite cijelu masu do rubova.',
    'Dodajte nadjev bez pretjerivanja s vlaznim sastojcima.',
    'Pecite u kucnoj pecnici; grill koristite samo u zavrsnom koraku ako je potrebno.',
  ];
  if (shape.kind === 'tonda') return [
    'Oblikujte pojedinacne cvrste kugle, priblizno 200-220 g.',
    'Nakon fermentacije otvorite kuglu u tanku i ravnu Romanu Tonda.',
    glutenFree ? 'Oblikujte podlogu laganim pritiskanjem prstima; rub ce biti nizi i kompaktniji jer nema glutenske strukture.' : 'Oblikujte pritiskanjem prstiju; ne rastezite agresivno u zraku.',
    'Dodajte tanak i ravnomjeran nadjev.',
    'Pecite pojedinacno na visokoj temperaturi prema odabranoj pecnici.',
  ];
  if (shape.key === 'napolitana') return [
    'Oblikujte pojedinacne kugle prema odabranom promjeru.',
    'Otvorite kuglu pritiskanjem od sredine prema rubu.',
    glutenFree ? 'Oblikujte rub laganim pritiskanjem prstima; ne ocekujte visok i prozracen rub jer nema glutenske strukture.' : 'Ostavite izrazen i prozracen rub.',
    'Dodajte nadjev bez preopterecenja sredine.',
    'Pecite kratko na visokoj temperaturi i rotirajte prema potrebi.',
  ];
  return [
    'Oblikujte vece kugle, priblizno 350-400 g.',
    glutenFree ? 'Otvorite podlogu laganim pritiskanjem; rub ce biti nizi i kompaktniji jer nema glutenske strukture.' : 'Otvorite kuglu tako da centar ostane tanak, a rub mekan i izrazen.',
    'Ravnomjerno dodajte suhu mozzarellu, umak i dodatke.',
    'Pecite prema odabranoj pecnici dok rub ne bude zlatan i sredina savitljiva.',
  ];
}
function directSteps(shape, flour, mode) {
  const hand = mode.key === 'hand';
  const steps = [];
  steps.push(hand ? 'Operite i temeljito osusite ruke.' : 'Pripremite mikser i njegovu posudu.');
  steps.push(flour.key === 'glutenFree'
    ? 'Pripremite bezglutensko brasno, obavezne psyllium ljuskice, vodu, sol, kvasac i ulje.'
    : flourLine(flour));
  steps.push(hand ? 'U priblizno 90% vode otopite kvasac.' : 'U posudu stavite brasno i veci dio vode te pokrenite mikser u prvoj brzini.');
  steps.push(hand ? 'Postupno dodajte brasno i povezte smjesu.' : 'Postupno dodajte preostalo brasno.');
  steps.push('Dodajte sol kao zaseban korak.');
  steps.push('Postupno dodajte preostalu vodu.');
  if (flour.key === 'glutenFree') {
    steps.push('Obavezno dodajte psyllium u kolicini od 2% brasna.');
    steps.push('Mijesajte samo dok se smjesa ne poveze; ne razvijajte gluten.');
    steps.push('Ostavite smjesu 15 minuta da psyllium povuce vlagu.');
  } else {
    steps.push('Dodajte izracunatu kolicinu ulja ili masti.');
    steps.push(hand ? 'Prebacite tijesto na radnu povrsinu i mijesite dlanovima 10-15 minuta.' : 'Mijesajte u posudi dok se tijesto ne poveze i postane glatko.');
    steps.push(hand ? 'Pokrijte tijesto i ostavite ga 15 minuta.' : 'Ostavite tijesto 5 minuta u posudi miksera.');
  }
  steps.push(...shapeSteps(shape, flour));
  return steps;
}
function prefermentSteps(shape, flour, method, mode) {
  const hand = mode.key === 'hand';
  const steps = [];
  steps.push(hand ? 'Operite i temeljito osusite ruke.' : 'Pripremite mikser i njegovu posudu.');
  if (method.key === 'biga') {
    steps.push('Pripremite izracunate kolicine brasna, vode i kvasca za Bigu.');
    steps.push('Kratko povezte sastojke; smjesa mora ostati gruba i mrvicasta.');
    steps.push('Ostavite Bigu 8 sati na sobnoj temperaturi.');
    steps.push('Prebacite Bigu u hladnjak na 16 sati. Ukupno: 24 sata.');
    steps.push('Bigu natrgajte i dodajte preostalu vodu, brasno, sol i ulje.');
  } else {
    steps.push('Pripremite izracunate kolicine brasna, vode i kvasca za Poolish.');
    steps.push('Otopite kvasac u vodi i dodajte brasno.');
    steps.push('Promijesajte do glatke tekuce smjese.');
    steps.push('Ostavite Poolish prema odabranom vremenu fermentacije.');
    steps.push('Hladni Poolish prebacite u posudu i dodajte preostalo brasno, vodu, sol i ulje.');
  }
  steps.push(flourLine(flour));
  steps.push(hand ? 'Prebacite tijesto na radnu povrsinu i mijesite dlanovima 10-15 minuta.' : 'Mijesajte u mikseru dok se tijesto ne poveze.');
  steps.push(hand ? 'Pokrijte tijesto i ostavite ga 15 minuta.' : 'Ostavite tijesto 5 minuta u posudi miksera.');
  steps.push(...shapeSteps(shape, flour));
  return steps;
}
function section(shape, flour, method, mode) {
  const unavailable = flour.key === 'glutenFree' && method.key !== 'direct';
  const title = `${shape.name} | ${flour.name} | ${method.name} | ${mode.name}`;
  const lines = [`## ${title}`, '', `**Status:** ${unavailable ? 'Nije dostupno za bezglutensko brasno.' : 'Aktivna kombinacija.'}`, ''];
  if (!unavailable) {
    lines.push(...(method.key === 'direct' ? directSteps(shape, flour, mode) : prefermentSteps(shape, flour, method, mode)).map((step, index) => `${index + 1}. ${step}`));
  }
  lines.push('', '---', '');
  return lines.join('\n');
}

let output = '# Kompletan pregled 128 kombinacija pizza koraka\n\n';
output += 'Ovaj dokument je generiran za rucnu provjeru. Svaka kombinacija ima zasebno poglavlje. Bezglutensko brasno koristi samo Direct metodu, pa ukupno postoji 128 aktivnih kombinacija.\n\n';
let count = 0;
for (const shape of shapes) {
  for (const flour of flours) {
    for (const method of methods) {
      for (const mode of mixing) {
        if (flour.key === 'glutenFree' && method.key !== 'direct') continue;
        output += section(shape, flour, method, mode);
        count += 1;
      }
    }
  }
}
output = output.replace('128 aktivnih kombinacija', `${count} aktivnih kombinacija`);
require('fs').writeFileSync('/app/ALL_128_PIZZA_STEPS.md', output, 'utf8');
console.log(`Generated ${count} combinations.`);
