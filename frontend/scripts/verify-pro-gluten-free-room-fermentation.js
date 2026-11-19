const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { getFermentationSchedule } = require(path.join(frontendRoot, 'src', 'calculator.ts'));
const { isProMethodAllowedForFlour } = require(path.join(frontendRoot, 'src', 'calculator.ts'));
const { adaptProGlutenFreeMixingPhaseA, adaptProGlutenFreeRoomPhaseB } = require(path.join(frontendRoot, 'src', 'i18n', 'proGlutenFreeBulk.ts'));
const { formatDuration } = require(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
const styles = ['neapolitan', 'romanaTonda', 'romanaTeglia', 'newYork'];
const roomDurationsMinutes = [0, 1, 5, 14, 15, 16, 60, 120, 360, 1440];
const roomTemperatures = [18, 22, 30];
const expectedPhaseBTitles = {
  hr: 'Faza B: Početna fermentacija na sobnoj temperaturi',
  en: 'Phase B: Initial room-temperature fermentation',
  de: 'Phase B: Erste Raumtemperatur-Fermentation',
  sl: 'Faza B: Začetna fermentacija pri sobni temperaturi',
};
const expectedHydrationTitles = {
  hr: 'Faza B: Hidratacijski odmor',
  en: 'Phase B: Hydration rest',
  de: 'Phase B: Hydratationsruhe',
  sl: 'Faza B: Hidratacijski počitek',
};
const expectedNoRemainingFermentation = {
  hr: 'ne preostaje vrijeme za fermentaciju',
  en: 'no room-fermentation time remains',
  de: 'es bleibt keine Raumzeit für die Fermentation',
  sl: 'za fermentacijo ne ostane časa',
};
const expectedNoRoomPeriod = {
  hr: 'dodatni hidratacijski odmor u ovoj fazi nije zakazan',
  en: 'no extra hydration rest is scheduled in this phase',
  de: 'keine zusätzliche Hydratationsruhe eingeplant',
  sl: 'v tej fazi ni načrtovan dodaten hidratacijski počitek',
};
const expectedShortHydrationLimitation = {
  hr: 'kraće je od preporučenih 15 minuta',
  en: 'shorter than the 15-minute hydration target',
  de: 'kürzer als die vorgesehenen 15 Minuten',
  sl: 'krajše od predvidenih 15 minut',
};
const expectedNoHydrationLimitation = {
  hr: 'nije moguće odraditi 15-minutnu hidrataciju',
  en: '15-minute psyllium hydration cannot be accommodated',
  de: '15-minütige Psyllium-Hydratation ist daher nicht möglich',
  sl: '15-minutne hidracije psylliuma ni mogoče izvesti',
};

const initialPhase = {
  title: 'Phase B: Short Rest',
  steps: ['Transfer the mixture to a covered container.', 'Rest for 15 minutes.', 'Keep the dough covered.'],
  fermentationInfo: 'Old short-rest description.',
  timers: [{ id: 'gluten-free-short-rest', seconds: 900, kind: 'rt' }],
};
const initialMixingPhase = {
  title: 'Phase A: Mixing',
  steps: ['Mix until combined.', 'Cover and rest for 5 minutes.'],
  timers: [{ id: 'post-mix-rest', seconds: 300, kind: 'rest' }],
};

for (const lang of languages) {
  for (const style of styles) {
    for (const minutes of roomDurationsMinutes) {
      for (const roomTemp of roomTemperatures) {
        for (const fridgeHours of [0, 24]) {
          for (const fridgeTemp of [2, 4, 6]) {
            const schedule = getFermentationSchedule({
              method: 'direct',
              roomHours: minutes / 60,
              roomTemp,
              fridgeHours,
              fridgeTemp,
              roomAfterFridgeHours: fridgeHours > 0 ? 2 : 0,
            });
            const scheduledRoomSeconds = Math.round(
              schedule.phases
                .filter((phase) => phase.kind === 'final' && phase.environment === 'room')
                .reduce((total, phase) => total + phase.hours, 0) * 3600,
            );
            const scheduledFridge = schedule.phases.find((phase) => phase.kind === 'final' && phase.environment === 'fridge');
            const scheduledTempering = schedule.phases.find((phase) => phase.kind === 'final-rest');
            const roomTemperatureText = `${roomTemp} °C`;
            const result = adaptProGlutenFreeRoomPhaseB(
              initialPhase,
              lang,
              style,
              scheduledRoomSeconds,
              roomTemperatureText,
              fridgeHours > 0,
            );
            const adaptedMixingPhase = adaptProGlutenFreeMixingPhaseA(
              { ...initialMixingPhase, steps: [...initialMixingPhase.steps], timers: [...initialMixingPhase.timers] },
              'hand',
            );
            assert.equal(adaptedMixingPhase.timers.find((timer) => timer.id === 'post-mix-rest')?.seconds, 300,
              `${lang}/${style}/${minutes}m keeps the independent Psyllium rest timer`);
            assert.ok(adaptedMixingPhase.steps.at(-1).includes('5 minutes'),
              `${lang}/${style}/${minutes}m keeps the matching Psyllium rest instruction`);
            assert.equal(result.timers.reduce((total, timer) => total + timer.seconds, 0), scheduledRoomSeconds,
              `${lang}/${style}/${minutes}m room timers alone preserve the selected initial room period`);

            const expectedRestSeconds = Math.min(15 * 60, scheduledRoomSeconds);
            const expectedRemainingRoomSeconds = scheduledRoomSeconds - expectedRestSeconds;
            assert.equal(result.title, expectedRemainingRoomSeconds > 0 ? expectedPhaseBTitles[lang] : expectedHydrationTitles[lang], `${lang}/${style}/${minutes}m title matches the remaining fermentation`);
            assert.ok(result.fermentationInfo, `${lang}/${style}/${minutes}m explains that rest is included in the selected room period`);
            assert.equal(result.steps[0], initialPhase.steps[0], `${lang}/${style}/${minutes}m preserves the opening step`);
            assert.equal(result.steps.at(-1), initialPhase.steps.at(-1), `${lang}/${style}/${minutes}m preserves trailing steps`);

            const restTimer = result.timers.find((timer) => timer.kind === 'rest');
            const roomTimer = result.timers.find((timer) => timer.kind === 'rt');
            assert.equal(restTimer?.seconds, expectedRestSeconds || undefined, `${lang}/${style}/${minutes}m hydration rest fits inside the selected room period`);
            assert.ok(result.timers.every((timer) => timer.seconds >= 0), `${lang}/${style}/${minutes}m has no negative timer`);
            assert.equal(
              result.timers.reduce((total, timer) => total + timer.seconds, 0),
              scheduledRoomSeconds,
              `${lang}/${style}/${minutes}m timers sum exactly to the calculated initial room period`,
            );

            if (expectedRestSeconds > 0) {
              assert.ok(result.steps.some((step) => step.includes(formatDuration(expectedRestSeconds, lang))), `${lang}/${style}/${minutes}m instructions use the capped hydration-rest duration`);
            }
            if (expectedRemainingRoomSeconds > 0) {
              assert.equal(roomTimer?.seconds, expectedRemainingRoomSeconds, `${lang}/${style}/${minutes}m room timer is only the remaining schedule time`);
              assert.ok(result.steps.some((step) => step.includes(formatDuration(expectedRemainingRoomSeconds, lang))), `${lang}/${style}/${minutes}m instructions use the remaining fermentation duration`);
              assert.ok(result.steps.some((step) => step.includes(roomTemperatureText)), `${lang}/${style}/${minutes}m instructions use the selected room temperature`);
            } else {
              assert.equal(roomTimer, undefined, `${lang}/${style}/${minutes}m has no room-fermentation timer after hydration`);
              if (scheduledRoomSeconds > 0) {
                assert.ok(result.steps.some((step) => step.includes(expectedNoRemainingFermentation[lang])), `${lang}/${style}/${minutes}m explains that the selected period leaves no fermentation time`);
              } else {
                assert.ok(result.steps.some((step) => step.includes(expectedNoRoomPeriod[lang])), `${lang}/${style}/0m does not add an unscheduled hydration rest`);
                assert.ok(result.steps.some((step) => step.includes(expectedNoHydrationLimitation[lang])), `${lang}/${style}/0m reports that 15-minute hydration cannot fit`);
              }
            }
            if (scheduledRoomSeconds > 0 && scheduledRoomSeconds < 15 * 60) {
              assert.ok(result.steps.some((step) => step.includes(expectedShortHydrationLimitation[lang])), `${lang}/${style}/${minutes}m reports the shortened hydration limitation`);
            }

            if (fridgeHours > 0) {
              assert.equal(scheduledFridge?.hours, fridgeHours, `${lang}/${style}/${minutes}m refrigerator phase remains selected`);
              assert.equal(scheduledFridge?.temperature, fridgeTemp, `${lang}/${style}/${minutes}m refrigerator temperature remains selected`);
              assert.equal(scheduledTempering?.hours, 2, `${lang}/${style}/${minutes}m final tempering remains a separate phase`);
              assert.ok(result.steps.some((step) => /Phase D|faze D|faza D/i.test(step)), `${lang}/${style}/${minutes}m instructions identify the refrigerator phase`);
            } else {
              assert.equal(scheduledFridge, undefined, `${lang}/${style}/${minutes}m room-only schedule has no refrigerator phase`);
              assert.equal(scheduledTempering, undefined, `${lang}/${style}/${minutes}m room-only schedule has no final-rest phase`);
              assert.ok(result.steps.some((step) => /not selected|nicht ausgewählt|nije odabrana|ni izbrana/i.test(step)), `${lang}/${style}/${minutes}m room-only instructions do not imply refrigeration`);
            }
          }
        }
      }
    }
  }
}

assert.match(indexSource, /const proInitialRoomFermentationSeconds = proFermentationSchedule\?\.phases[\s\S]*?phase\.kind === 'final' && phase\.environment === 'room'/);
assert.match(indexSource, /!isBeginner[\s\S]*?method === 'direct'[\s\S]*?flour === 'glutenFree'[\s\S]*?adaptProGlutenFreeRoomPhaseB/);
assert.match(indexSource, /setMethod\(saved\.flour === 'glutenFree' \? 'direct' : saved\.method\)/);
assert.match(indexSource, /phaseIndex === 0\) return adaptProGlutenFreeMixingPhaseA\(phase, mixingForExperience\)/);
assert.match(indexSource, /adaptProGlutenFreeRoomPhaseB\(/);
for (const flour of ['glutenFree', 'custom']) {
  const blend = flour === 'custom' ? ['glutenFree', 'glutenFree', 70] : ['caputo00', 'wholeWheat', 70];
  assert.equal(
    isProMethodAllowedForFlour('direct', flour, ...blend),
    true,
    `${flour} permits the Direct method`,
  );
  assert.equal(
    isProMethodAllowedForFlour('biga', flour, ...blend),
    false,
    `${flour} does not permit Biga when effectively gluten-free`,
  );
  assert.equal(
    isProMethodAllowedForFlour('poolish', flour, ...blend),
    false,
    `${flour} does not permit Poolish when effectively gluten-free`,
  );
}
assert.match(indexSource, /isProMethodAllowedForFlour\(m\.k, flour, blendA, blendB, blendPctA\)/);
assert.match(indexSource, /napolitanaGlutenFreeRemainingMinutes[\s\S]*?Math\.max\(0, Math\.round\(roomHours \* 60\)\)/);
assert.match(indexSource, /timer\('gluten-free-napolitana-rest', napolitanaGlutenFreeRemainingMinutes \* 60, 'rt'\)/);

console.log('PRO gluten-free initial room fermentation consistency passed.');
