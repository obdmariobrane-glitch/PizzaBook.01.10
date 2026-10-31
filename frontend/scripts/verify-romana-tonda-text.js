#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

const required = [
  'Pokrijte posudu i ostavite tijesto da nastavi fermentirati još ${bulkRestMinutes} minuta.',
  'Cover the container and let the dough continue fermenting for another ${bulkRestMinutes} minutes.',
  'Decken Sie den Behälter ab und lassen Sie den Teig weitere ${bulkRestMinutes} Minuten fermentieren.',
  'Pokrijte posodo in pustite, da testo še ${bulkRestMinutes} minut nadaljuje fermentacijo.',
  'kind: \'fridge\'',
  'i pripremite ih za utiskivanje tijesta.',
  'and prepare them for pressing in the dough.',
  'zum Eindrücken des Teigs vor.',
  'in jih pripravite za vtiskovanje testa.',
  'variant === \'romanaTonda\'',
  'Pecite ${bakingTimeRange} na ${ovenTemp} °C; provjerite boju gornje strane i dna',
  'Bake ${bakingTimeRange} at ${ovenTemp} °C; check the colour of the top and bottom',
  'Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C; prüfen Sie die Farbe der Oberseite und des Bodens',
  'Pecite ${bakingTimeRange} pri ${ovenTemp} °C; preverite barvo vrha in dna',
];

const missing = required.filter((marker) => !source.includes(marker));
if (missing.length > 0) {
  console.error('Romana Tonda text consistency check failed:');
  missing.forEach((marker) => console.error(`- missing ${marker}`));
  process.exit(1);
}

console.log('Romana Tonda text consistency passed for HR/EN/DE/SL, Beginner/PRO, dynamic durations, cold badges, tray wording, shaping, and home-oven baking guidance.');
