import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const profileSource = await readFile(new URL('../src/kamadoOvenProfile.ts', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(profileSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const profileExports = {};
new Function('exports', 'require', compiled)(profileExports, require);

const completeProfile = {
  maximumTemperatureC: 420,
};
assert.deepEqual(profileExports.DEFAULT_KAMADO_OVEN_PROFILE, { maximumTemperatureC: 400, isDefault: true });
assert.equal(profileExports.KAMADO_MAXIMUM_TEMPERATURE_C, 400);
assert.deepEqual(
  profileExports.normalizeKamadoProOvenProfile({ maximumTemperatureC: 300 }),
  { maximumTemperatureC: 400 },
);
assert.deepEqual(
  profileExports.normalizeKamadoProOvenProfile({ maximumTemperatureC: 350, bakingTemperatureC: 340 }),
  { maximumTemperatureC: 400, bakingTemperatureC: 340 },
);
assert.deepEqual(
  profileExports.parseKamadoOvenProfile(
    profileExports.normalizeKamadoProOvenProfile({ maximumTemperatureC: 350, bakingTemperatureC: 340 }),
  ),
  { maximumTemperatureC: 400, bakingTemperatureC: 340 },
  'normalizing and reloading a saved profile preserves the selected baking temperature',
);
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(
  350,
  profileExports.normalizeKamadoProOvenProfile({ maximumTemperatureC: 300 }).maximumTemperatureC,
), true, 'legacy lower PRO profile maximum must not reject 350 °C');
assert.deepEqual(profileExports.parseKamadoOvenProfile(completeProfile), completeProfile);
assert.deepEqual(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 420.5 }), { maximumTemperatureC: 420.5 });
assert.deepEqual(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 1000 }), { maximumTemperatureC: 1000 });
assert.deepEqual(profileExports.parseKamadoOvenProfile({
  maximumTemperatureC: 400,
  isDefault: true,
}), { maximumTemperatureC: 400, isDefault: true });
assert.deepEqual(
  profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 420, bakingTemperatureC: 380 }),
  { maximumTemperatureC: 420, bakingTemperatureC: 380 },
);
assert.deepEqual(
  profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 420, bakingTemperatureC: 380.5 }),
  { maximumTemperatureC: 420, bakingTemperatureC: 380.5 },
);
assert.deepEqual(
  profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 1000, bakingTemperatureC: 600 }),
  { maximumTemperatureC: 1000, bakingTemperatureC: 600 },
);
assert.equal(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 420, bakingTemperatureC: 450 }), null);
assert.equal(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 420, bakingTemperatureC: 0 }), null);
assert.equal(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: 0 }), null);
assert.equal(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: -1 }), null);
assert.equal(profileExports.parseKamadoOvenProfile({ maximumTemperatureC: Number.NaN }), null);
assert.equal(profileExports.parseKamadoOvenProfile({
  styles: {
    neapolitan: { temperatureC: 380, minMinutes: 3, maxMinutes: 4 },
    romana: { temperatureC: 390, minMinutes: 5, maxMinutes: 7 },
    ny_style: { temperatureC: 400, minMinutes: 6, maxMinutes: 8 },
  },
}), null);
assert.equal(profileExports.parseKamadoOvenProfile({ bakingTemperatureC: 380 }), null);
for (const [temperatureC, expected] of [
  [219, null],
  [219.9, null],
  [220, { min: 12, max: 18 }],
  [249, { min: 12, max: 18 }],
  [249.9, { min: 12, max: 18 }],
  [250, { min: 10, max: 14 }],
  [279, { min: 10, max: 14 }],
  [279.9, { min: 10, max: 14 }],
  [280, { min: 8, max: 10 }],
  [299, { min: 8, max: 10 }],
  [299.9, { min: 8, max: 10 }],
  [300, { min: 4, max: 7 }],
  [329, { min: 4, max: 7 }],
  [329.9, { min: 4, max: 7 }],
  [330, { min: 3, max: 5 }],
  [359, { min: 3, max: 5 }],
  [359.9, { min: 3, max: 5 }],
  [360, { min: 2, max: 4 }],
  [400, { min: 2, max: 4 }],
  [400.1, null],
  [401, null],
]) {
  assert.deepEqual(
    profileExports.getKamadoBakeTimeRange(temperatureC, 'neapolitan'),
    expected,
    `${temperatureC} °C should select the specified Neapolitan range`,
  );
}
assert.deepEqual(profileExports.getKamadoBakeTimeRange(250, 'romanaTonda'), { min: 12, max: 16 });
assert.deepEqual(profileExports.getKamadoBakeTimeRange(250, 'newYork'), { min: 12, max: 16 });
assert.deepEqual(profileExports.getKamadoBakeTimeRange(250, 'romanaTeglia'), { min: 14, max: 18 });
assert.deepEqual(profileExports.getKamadoBakeTimeRange(249.6, 'neapolitan'), { min: 12, max: 18 });
assert.deepEqual(profileExports.getKamadoBakeTimeRange(379, 'neapolitan'), { min: 2, max: 4 });
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(380.5, 400), true);
for (const temperatureC of [350, 399, 400]) {
  assert.equal(
    profileExports.isKamadoBakingTemperatureAllowed(temperatureC, profileExports.KAMADO_MAXIMUM_TEMPERATURE_C),
    true,
    `${temperatureC} °C should be accepted under the canonical Kamado maximum`,
  );
}
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(401, profileExports.KAMADO_MAXIMUM_TEMPERATURE_C), false);
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(400.1, 400), false);
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(0, 400), false);
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(380, null), false);
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(null, 400), false);
assert.equal(profileExports.sanitizeKamadoTemperatureInput('380,5'), '380.5');
assert.equal(profileExports.sanitizeKamadoTemperatureInput('3a8.5.9'), '38.5');
assert.equal(profileExports.sanitizeKamadoTemperatureInput(''), '');
assert.equal(profileExports.isKamadoBakingTemperatureAllowed(Number(profileExports.sanitizeKamadoTemperatureInput('')), 400), false);
assert.equal(profileExports.getKamadoBakeTimeRange(Number.NaN, 'neapolitan'), null);
assert.equal(profileExports.getKamadoBakeTimeRange(250, 'unsupported'), null);
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(350, 'neapolitan', 400, 'hr'), 'Preporučeno vrijeme pečenja: 3–5 min');
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(399, 'neapolitan', 400, 'hr'), 'Preporučeno vrijeme pečenja: 2–4 min');
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(400, 'neapolitan', 400, 'hr'), 'Preporučeno vrijeme pečenja: 2–4 min');
assert.equal(profileExports.formatKamadoBakeTimeRange({ min: 12, max: 18 }, 'hr'), '12–18 min');
assert.equal(profileExports.formatKamadoBakeTimeRange({ min: 12, max: 18 }, 'de'), '12–18 Min.');
assert.equal(
  profileExports.formatKamadoBakeTimeRecommendation(380, 'neapolitan', 400, 'hr'),
  'Preporučeno vrijeme pečenja: 2–4 min',
);
assert.equal(
  profileExports.formatKamadoBakeTimeRecommendation(380, 'neapolitan', 400, 'en'),
  'Recommended baking time: 2–4 min',
);
assert.equal(
  profileExports.formatKamadoBakeTimeRecommendation(380, 'neapolitan', 400, 'de'),
  'Empfohlene Backzeit: 2–4 Min.',
);
assert.equal(
  profileExports.formatKamadoBakeTimeRecommendation(380, 'neapolitan', 400, 'sl'),
  'Priporočen čas peke: 2–4 min',
);
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(380, 'romanaTonda', 400, 'hr'), 'Preporučeno vrijeme pečenja: 4–6 min');
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(380, 'newYork', 400, 'hr'), 'Preporučeno vrijeme pečenja: 4–6 min');
assert.equal(profileExports.formatKamadoBakeTimeRecommendation(380, 'romanaTeglia', 400, 'hr'), 'Preporučeno vrijeme pečenja: 6–8 min');
assert.match(profileExports.formatKamadoBakeTimeRecommendation(219.9, 'neapolitan', 400, 'hr'), /220 do 400 °C/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(400.1, 'neapolitan', 450, 'en'), /only from 220 to 400 °C/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(401, 'neapolitan', 400, 'de'), /überschreitet das Kamado-Maximum/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(null, 'neapolitan', 400, 'sl'), /veljavno pozitivno/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(401, 'neapolitan', 400, 'hr'), /prelazi maksimalnu dopuštenu/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(401, 'neapolitan', 400, 'en'), /exceeds the Kamado maximum/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(401, 'neapolitan', 400, 'de'), /überschreitet das Kamado-Maximum/);
assert.match(profileExports.formatKamadoBakeTimeRecommendation(401, 'neapolitan', 400, 'sl'), /presega najvišjo dovoljeno/);

const kamadoPreheatTitles = {
  hr: 'Predgrijavanje Kamada',
  en: 'Kamado preheating',
  de: 'Kamado vorheizen',
  sl: 'Predgrevanje Kamada',
};
for (const [lang, title] of Object.entries(kamadoPreheatTitles)) {
  const isPreheatPhase = (phase) => phase.title.replace(/^(?:Faza|Phase|Fase)\s+[A-Z]:?\s*/i, '').toLowerCase() === title.toLowerCase();
  const preheat = { title: `Faza E: ${title}`, steps: ['heat'] };
  const final = { title: 'Final baking', steps: ['shape', 'bake'] };
  let phases = [{ title: 'Earlier phase', steps: ['prepare'] }, preheat, final];
  phases = profileExports.insertKamadoPhaseOnce(phases, preheat, isPreheatPhase);
  phases = profileExports.insertKamadoPhaseOnce(phases, preheat, isPreheatPhase);
  assert.equal(phases.filter(isPreheatPhase).length, 1, `${lang}: preheating phase appears exactly once`);
  assert.equal(phases.at(-2).title, preheat.title, `${lang}: preheating remains immediately before final baking`);
}

assert.equal(appSource.includes("const KAMADO_PROFILE_STORAGE_KEY = 'kamadoOvenProfile';"), true);
assert.equal(appSource.includes('AsyncStorage.setItem(KAMADO_PROFILE_STORAGE_KEY'), true);
assert.equal(appSource.includes('AsyncStorage.getItem(KAMADO_PROFILE_STORAGE_KEY)'), true);
assert.match(appSource, /rawProfile !== null[\s\S]*?parseKamadoOvenProfile\(JSON\.parse\(rawProfile\)\)[\s\S]*?else if \(!isBeginner\)[\s\S]*?DEFAULT_KAMADO_OVEN_PROFILE/);
assert.match(appSource, /normalizeKamadoProOvenProfile\(savedProfile\)/);
assert.match(appSource, /savedProfile\.maximumTemperatureC !== KAMADO_MAXIMUM_TEMPERATURE_C[\s\S]*?savedProfile\.bakingTemperatureC <= KAMADO_MAXIMUM_TEMPERATURE_C[\s\S]*?JSON\.stringify\(profile\)/);
assert.match(appSource, /if \(profile\.isDefault && isBeginner\)[\s\S]*?setKamadoProfile\(null\)/);
assert.match(appSource, /commitKamadoBakingTemperature = async \(\)[\s\S]*?bakingTemperatureC,\s*\}\)/);
assert.match(appSource, /const profile = parseKamadoOvenProfile\(\{\s*maximumTemperatureC: kamadoMaxTemperature \?\? KAMADO_MAXIMUM_TEMPERATURE_C,\s*bakingTemperatureC,\s*\}\)/);
assert.match(appSource, /bakingTemperatureC > kamadoMaxTemperature[\s\S]*?maksimalne dopuštene temperature Kamada[\s\S]*?must not exceed the Kamado maximum[\s\S]*?darf die Kamado-Maximaltemperatur nicht überschreiten[\s\S]*?ne sme biti višja od najvišje dovoljene temperature Kamada/);
assert.match(appSource, /kamadoTemperatureDraft,\s*kamadoPizzaStyle,\s*kamadoMaxTemperature,\s*lang/);
assert.match(appSource, /setKamadoProfile\(profile\);[\s\S]*?setKamadoBakingTemperatureInput/);
assert.match(appSource, /setKamadoProfile\(profile\);[\s\S]*?bakingTemperatureC !== undefined[\s\S]*?setKamadoBakingTemperatureInput/);
assert.equal(appSource.includes("testID=\"oven-kamado\""), true);
assert.equal(appSource.includes('testID="kamado-profile-max-temperature"'), false);
assert.equal(appSource.includes("'kamado-baking-temperature'"), true);
assert.equal(appSource.includes("({ hr: 'Kamado — postavke pečenja'"), false);
assert.equal(appSource.includes('Odabrana temperatura pečenja ne smije prelaziti spremljeni maksimum uređaja.'), false);
assert.match(appSource, /testID=\{oven === 'kamado' \? 'kamado-baking-temperature' : 'oven-temperature'\}/);
assert.match(appSource, /testID="kamado-bake-time-recommendation" style=\{styles\.bakeText\}>\{kamadoBakeTimeRecommendation\}/);
assert.match(appSource, /isKamadoBakingTemperatureAllowed\(kamadoTemperatureDraft, kamadoMaxTemperature\)/);
assert.match(appSource, /const kamadoBakeTimeRange = !isBeginner && kamadoTemperatureWithinMaximum/);
assert.match(appSource, /const kamadoBake = bakingTimeRange/);
assert.match(appSource, /const kamadoPizzaStyle = isRomanTeglia[\s\S]*?pizzaStyle === 'romana'[\s\S]*?'romanaTonda'[\s\S]*?pizzaStyle === 'ny_style'[\s\S]*?'newYork'[\s\S]*?'neapolitan'/);
assert.match(appSource, /const isRomanTeglia = pizzaStyle === 'romana' && romanFormat === 'teglia'/);
assert.doesNotMatch(appSource, /minMinutes|maxMinutes/);
assert.equal(appSource.includes("require('../../assets/images/Roter Kamado-Keramikgrill mit Holztischen.png')"), true);
assert.match(appSource, /const kamadoProDirectSteps = oven === 'kamado'[\s\S]*?replaceProPhaseE\(yeastAwareDetailedDirectSteps, proPhaseEOptions\)/);
assert.match(appSource, /stepInfo: copy\.info\.map\(\(\[title, body\]\) => \(\{ title, body \}\)\)/);
assert.match(appSource, /steps: copy\.steps,/);
assert.match(appSource, /if \(oven !== 'kamado'\) \{\s*steps\.push\(\{\s*id: 'preheat',/);
assert.match(appSource, /timers: \[\],[\s\S]*?insertKamadoPhaseOnce\(phases, phase/);
assert.match(appSource, /timers: candidate\.timers\?\.filter\(\(timer\) => !\['preheat', 'bake', 'rotate'\]\.includes\(timer\.kind\)\)/);
assert.equal(appSource.includes('insertKamadoPreheatPhase'), true);
assert.match(appSource, /insertKamadoPhaseOnce\(phases, phase/);
assert.equal(appSource.includes('buildKamadoPrefermentPhases'), true);
assert.doesNotMatch((await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8')), /kamadoOvenProfile|Kamado preheating|Predgrijavanje Kamada/);
for (const languageCopy of ['Temperatura pećnice', 'Oven temperature', 'Ofentemperatur', 'Temperatura pečice']) {
  assert.equal(appSource.includes(languageCopy), true, `Missing localized standard temperature label: ${languageCopy}`);
}

console.log('Kamado bare temperature row, persistence, icon, phase and language checks passed.');
