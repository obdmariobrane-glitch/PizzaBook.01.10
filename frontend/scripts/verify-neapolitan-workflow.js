#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript(path.join('src', 'calculator.ts'));
const units = loadTypeScript(path.join('src', 'units.ts'));
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');
const { PIZZA_STYLE_PROFILES, formatBakingTimeRange, createDirectHomePizzaPlan } = calculator;

// Profile defaults
const p = PIZZA_STYLE_PROFILES.neapolitan;
assert.equal(p.defaultDiameter, 30);
assert.equal(p.ballWeight, 250);
assert.equal(p.hydration, 62);
assert.equal(p.saltPct, 2.9);
assert.equal(p.oilPct, 2);

// Style-switch state reset (Beginner)
assert.match(uiSource, /isBeginner && nextStyle === 'neapolitan'/);
assert.match(uiSource, /setOven\(nextStyle === 'neapolitan' \? 'ooni' : 'homeStone'\)/);
assert.match(uiSource, /const styleOvenTemp = nextStyle === 'neapolitan' \? 450 : 300/);
assert.match(uiSource, /setTrayWidthInput\('30'\)/);

// Legacy fallback removed from unscheduled Beginner recipe
assert.match(uiSource, /buildBeginnerUnscheduledDirectSteps/);
assert.match(uiSource, /beginnerDirectHomeSteps \?\? beginnerUnscheduledDirectSteps/);

// Exact Neapolitan Tipo 00 Beginner Hand Phase A is isolated from Mixer and other flours.
assert.match(uiSource, /isNeapolitanBeginner && hand && flourType === 'caputo00'/);
assert.match(uiSource, /isNeapolitanBeginner && !hand && flourType === 'caputo00'/);
assert.match(uiSource, /const isTargetNeapolitanHandPhaseA = isBeginner/);
assert.match(uiSource, /const isTargetNeapolitanMixerPhaseA = isBeginner/);
assert.match(uiSource, /const isTargetNeapolitanManitobaHandPhaseA = isBeginner/);
assert.match(uiSource, /const isTargetNeapolitanManitobaMixerPhaseA = isBeginner/);
assert.match(uiSource, /pizzaStyle === 'neapolitan'/);
assert.match(uiSource, /const isTargetNeapolitanSpeltMixerPhaseA = isBeginner/);
assert.match(uiSource, /Recommended water temperature: \$\{formatTemperature\(waterTemperatureCalculation\.recommendedWaterTemp/);
assert.match(uiSource, /Preporučena temperatura vode: \$\{formatTemperature\(waterTemperatureCalculation\.recommendedWaterTemp/);
assert.match(uiSource, /Empfohlene Wassertemperatur: \$\{formatTemperature\(waterTemperatureCalculation\.recommendedWaterTemp/);
assert.match(uiSource, /Priporočena temperatura vode: \$\{formatTemperature\(waterTemperatureCalculation\.recommendedWaterTemp/);
assert.doesNotMatch(uiSource, /Koristite hladnu do mlaku vodu/);
assert.match(
  uiSource,
  /waterInfoStepIndex=\{\([^}]*isTargetNeapolitanHandPhaseA[^}]*\) && index === 0 \? 2 : undefined\}/,
);
assert.match(
  uiSource,
  /doughHandlingInfoStepIndex=\{[^}]*isTargetNeapolitanMixerPhaseA[^}]*index === 0 \? 7 : undefined\)?\}/,
);
assert.match(uiSource, /function getBeginnerPhaseCTimers\(schedule: HomePizzaPlanSchedule, temperingMinutes: number\)/);
assert.match(uiSource, /id: 'beginner-phase-c-preheat'/);
assert.doesNotMatch(uiSource, /getBeginnerPhaseCTimers[\s\S]{0,500}id: 'bake'/);
assert.match(uiSource, /const hasWaterInfo = !!waterInfo && \(waterInfoStepIndex !== undefined \? i === waterInfoStepIndex : \/ukupno \.\*vode\|total water\|Sieben und wiegen Sie\.\*Wasser\|skupno \.\*vode\/i\.test\(s\)\)/);
assert.match(uiSource, /Mixer mixing usually takes about 8–10 minutes/);
assert.match(uiSource, /Mixer mixing spelt dough usually takes about 5–7 minutes/);
assert.match(uiSource, /The gluten in spelt dough is more sensitive/);
assert.match(uiSource, /stop the mixer, cover the dough, and let it rest for about 10 minutes/);
assert.match(uiSource, /Pour the yeast water into the mixer bowl, add the flour/);
assert.match(uiSource, /Miješanje obično traje oko 8–10 minuta/);
assert.match(uiSource, /let it rest for about 10 minutes/);
assert.match(uiSource, /Stretch & Fold: take one edge of the dough/);
assert.match(uiSource, /Then continue with the recipe/);
assert.doesNotMatch(uiSource, /Mixer mixing usually takes about 6 minutes|Miješanje obično traje oko 6 minuta/);
assert.match(uiSource, /Hand kneading Manitoba flour usually takes about 10–15 minutes/);
assert.match(uiSource, /Ručno miješenje Manitoba brašna obično traje oko 10–15 minuta/);
assert.match(uiSource, /Miješanje Manitoba brašna obično traje oko 10–12 minuta/);
assert.match(uiSource, /Mixer mixing Manitoba flour usually takes about 10–12 minutes/);
assert.match(uiSource, /approximately 90% of the water, or \$\{initialWater\} g/);
assert.match(uiSource, /remaining 10% of the water, or \$\{remainingWater\} g/);
assert.match(uiSource, /isNeapolitanWholeWheatBeginnerMixer/);
assert.match(uiSource, /Miješanje integralnog tijesta mikserom obično traje oko 7–10 minuta/);
assert.match(uiSource, /Mixer mixing whole-wheat dough usually takes about 7–10 minutes/);
assert.match(uiSource, /Hand kneading usually takes about 10 minutes/);
assert.match(uiSource, /If the dough becomes too sticky and difficult to work with/);
assert.match(uiSource, /let it rest for 5 minutes/);
assert.doesNotMatch(uiSource, /timer\('hand-knead'/);
assert.doesNotMatch(uiSource, /timer\('mixer-low'/);
assert.doesNotMatch(uiSource, /timer\('mixer-develop'/);
assert.equal((uiSource.match(/isNeapolitanTipo00BeginnerMixer \? \[/g) ?? []).length, 2);

// Style-info modal localisation
assert.equal((translations.match(/styleInfo: \{/g) ?? []).length, 4);
assert.doesNotMatch(uiSource, /Promjer:|Hidratacija:|Oblikovanje:/);
assert.match(uiSource, /t\.calc\.styleInfo\.diameter/);

// Length conversion (display only)
assert.equal(units.formatLength(30, 'metric'), '30 cm');
assert.equal(units.formatLength(30, 'us'), '11.8 in');
assert.equal(units.formatUnitText('Stretch to 30 cm.', 'fahrenheit', 'us'), 'Stretch to 11.8 in.');
assert.equal(units.formatUnitText('Stretch to 30 cm.', 'celsius', 'metric'), 'Stretch to 30 cm.');
assert.match(units.formatUnitText('Tray 30×40 cm', 'fahrenheit', 'us'), /11\.8 × 15\.7 in/);
const mixed = units.formatUnitText('Use 300 g water at 450°C for a 30 cm pizza', 'fahrenheit', 'us');
assert.match(mixed, /11\.8 in/);
assert.match(mixed, /°F/);
assert.doesNotMatch(mixed, /°C| cm\b/);
assert.match(units.formatUnitText('3 g yeast', 'celsius', 'us'), /oz|g/);

// Bake-time consistency: shared oven-specific estimate
assert.equal(formatBakingTimeRange('ooni', 450, 'en'), '60 s–90 s');
assert.equal(formatBakingTimeRange('homeStone', 300, 'en'), '3 min–4.5 min');
assert.notEqual(formatBakingTimeRange('homeStone', 300, 'en'), formatBakingTimeRange('ooni', 450, 'en'));
assert.match(translations, /bake it for \{BAKE_TIME\}/);

// Smart schedule matrix must stay unchanged
const expected = {
  '6-18': ['roomOnly', 3, 0], '6-22': ['hybrid', 2, 1], '6-28': ['coldDominant', 1, 2],
  '8-18': ['roomOnly', 5, 0], '8-22': ['hybrid', 2, 3], '8-28': ['coldDominant', 1, 4],
  '12-18': ['roomOnly', 9, 0], '12-22': ['hybrid', 2, 7], '12-28': ['coldDominant', 1, 8],
  '18-18': ['hybrid', 2, 13], '18-22': ['hybrid', 2, 13], '18-28': ['coldDominant', 1, 14],
  '24-18': ['coldDominant', 1, 20], '24-22': ['coldDominant', 1, 20], '24-28': ['coldDominant', 1, 20],
  '48-18': ['coldDominant', 1, 24], '48-22': ['coldDominant', 1, 24], '48-28': ['coldDominant', 1, 24],
  '72-18': ['coldDominant', 1, 24], '72-22': ['coldDominant', 1, 24], '72-28': ['coldDominant', 1, 24],
};
const now = new Date('2026-03-02T08:00:00Z');
for (const hours of [6, 8, 12, 18, 24, 48, 72]) {
  for (const roomTemp of [18, 22, 28]) {
    const input = {
      style: 'neapolitan', pizzas: 4, ballWeight: 250, method: 'direct',
      bakeAt: new Date(now.getTime() + hours * 3600000), roomTemp, fridgeTemp: 4, ovenType: 'ooni', ovenTemp: 450,
    };
    const fresh = createDirectHomePizzaPlan(input, { source: 'unknown' }, 62, 'fresh', now, true).schedule;
    const dry = createDirectHomePizzaPlan(input, { source: 'unknown' }, 62, 'dry', now, true).schedule;
    const key = `${hours}-${roomTemp}`;
    const [strategy, before, fridge] = expected[key];
    assert.equal(fresh.strategy, strategy, key);
    assert.equal(fresh.roomBeforeFridgeHours, before, key);
    assert.equal(fresh.fridgeHours, fridge, key);
    assert.equal(fresh.roomAfterFridgeHours, 3, key);
    const workflowHours = before + fridge + 3;
    assert.equal(workflowHours, Math.min(hours, 28), `${key} workflow duration`);
    assert.equal(
      fresh.startAt.getTime(),
      new Date(input.bakeAt.getTime() - workflowHours * 3600000).getTime(),
      `${key} delayed start`,
    );
    assert.equal(fresh.startAt.getTime() <= now.getTime(), hours <= 28, `${key} start anchor`);
    if (strategy === 'roomOnly') assert.equal(fresh.fridgeHours, 0, key);
    assert.deepEqual(
      [dry.strategy, dry.roomBeforeFridgeHours, dry.fridgeHours, dry.roomAfterFridgeHours],
      [fresh.strategy, fresh.roomBeforeFridgeHours, fresh.fridgeHours, fresh.roomAfterFridgeHours],
      `${key} fresh/dry`,
    );
  }
}

// ---- Final Beginner fixes ----
const tr = loadTypeScript(path.join('src', 'i18n', 'translations.ts'));
const trs = tr.translations || tr.default;
const { normalizeBeginnerSavedState, reversePlan } = calculator;

// Planner: number and unit converted together, exactly once
{
  const now = new Date('2026-10-05T06:49:00Z');
  const bake = new Date(now.getTime() + 60 * 3600000);
  const plan = createDirectHomePizzaPlan({ style: 'neapolitan', pizzas: 4, ballWeight: 250, method: 'direct', bakeAt: bake, roomTemp: 22, fridgeTemp: 4, ovenType: 'ooni', ovenTemp: 450 }, { source: 'unknown' }, 62, 'fresh', now, true);
  for (const lng of ['hr', 'en', 'de', 'sl']) {
    const steps = reversePlan(bake, 'direct', 'neapolitan', trs[lng].planner.stepCopy, plan.schedule, null, null, lng, '450°C');
    const us = steps.map((x) => units.formatUnitText(x.desc, 'fahrenheit', 'us')).join('\n');
    const metric = steps.map((x) => units.formatUnitText(x.desc, 'celsius', 'metric')).join('\n');
    assert.match(us, /39\.2\s?°F/, `${lng} fridge °F`);
    assert.match(us, /71\.6\s?°F/, `${lng} room °F`);
    assert.doesNotMatch(us, /\b(4|22)\s?°F/, `${lng} raw celsius number with °F`);
    assert.doesNotMatch(us, /°C/, `${lng} mixed units`);
    assert.match(metric, /\b4\s?°C/, `${lng} fridge °C`);
    assert.match(metric, /\b22\s?°C/, `${lng} room °C`);
    assert.doesNotMatch(metric, /°C\s?°C|°°/, `${lng} double unit`);
  }
}

// Stale persisted Beginner state
{
  const stale = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', diameter: 35, customBallWeight: 480, oven: 'homePan', ovenTemp: 250, romanFormat: 'teglia', method: 'biga', useIce: true, hydration: 72, trayWidth: 40, trayLength: 60 });
  assert.equal(stale.pizzaStyle, 'neapolitan');
  assert.equal(stale.diameter, 30);
  assert.equal(stale.customBallWeight, null);
  assert.equal(stale.romanFormat, 'tonda');
  assert.equal(stale.oven, 'ooni');
  assert.equal(stale.ovenTemp, 450);
  assert.equal(stale.method, 'direct');
  assert.equal(stale.useIce, false);
  assert.equal(stale.hydration, 62);
  assert.equal(stale.trayWidth, 30);
  assert.equal(stale.trayLength, 40);
  const ny = normalizeBeginnerSavedState({ pizzaStyle: 'ny_style', diameter: 30, customBallWeight: 250, oven: 'ooni', ovenTemp: 450, method: 'poolish' });
  assert.deepEqual([ny.diameter, ny.customBallWeight, ny.oven, ny.ovenTemp, ny.method, ny.hydration], [35, null, 'homeStone', 300, 'direct', 64]);
  const tonda = normalizeBeginnerSavedState({ pizzaStyle: 'romana', romanFormat: 'teglia', diameter: 35, customBallWeight: 900, oven: 'ooni', ovenTemp: 450, trayWidth: 30, trayLength: 40 });
  assert.equal(tonda.romanFormat, 'teglia');
  assert.deepEqual([tonda.oven, tonda.ovenTemp], ['homePan', 250]);
  const tondaOnly = normalizeBeginnerSavedState({ pizzaStyle: 'romana', romanFormat: 'tonda', diameter: 35, customBallWeight: 600, oven: 'homePan', ovenTemp: 250, trayWidth: 30, trayLength: 40 });
  assert.deepEqual([tondaOnly.romanFormat, tondaOnly.diameter, tondaOnly.customBallWeight, tondaOnly.oven, tondaOnly.ovenTemp], ['tonda', 33, null, 'homeStone', 300]);
  const nyLeak = normalizeBeginnerSavedState({ pizzaStyle: 'ny_style', romanFormat: 'teglia', trayWidth: 40, trayLength: 60, oven: 'homeStone', ovenTemp: 300 });
  assert.deepEqual([nyLeak.romanFormat, nyLeak.trayWidth, nyLeak.trayLength], ['tonda', 30, 40]);
  // Valid persisted customisation survives
  const keep = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', diameter: 30, customBallWeight: 260, oven: 'ooni', ovenTemp: 430, hydration: 65 });
  assert.deepEqual([keep.customBallWeight, keep.ovenTemp, keep.hydration, keep.oven], [260, 430, 65, 'ooni']);
}
assert.match(uiSource, /const ice = useMemo\(\(\) => \(?!isBeginner && useIce/);
assert.match(uiSource, /normalizeBeginnerSavedState\(/);

// Flour/hydration: Beginner Neapolitan hydration follows the selected flour.
assert.match(uiSource, /beginnerHydrationFor\(pizzaStyle, flour\)/);

// Flour names localized (no Croatian in EN/DE/SL)
{
  const blocks = {};
  for (const lng of ['HR', 'EN', 'DE', 'SL']) {
    const m = uiSource.match(new RegExp(`const FLOURS_${lng}: FlourEntry\\[\\] = \\[([\\s\\S]*?)\\n\\];`));
    assert.ok(m, `FLOURS_${lng}`);
    blocks[lng] = [...m[1].matchAll(/key: '(\w+)',\s+label: '([^']+)'/g)].map((x) => [x[1], x[2]]);
    assert.equal(blocks[lng].length, 6, `${lng} flours`);
  }
  for (const lng of ['EN', 'DE', 'SL']) {
    for (const [key, label] of blocks[lng]) {
      assert.doesNotMatch(label, /Pirovo|Visoki|Integralno|Bezglutensko|Mješavina|brašno/i, `${lng} ${key} ${label}`);
    }
  }
  assert.equal((uiSource.match(/FLOUR_PROFILES\[[^\]]+\]\.label|flourProfile\.label/g) ?? []).length, 1);
  assert.match(uiSource, /flourName\(lang, flour\)/);
}

// Teglia ROOM_ONLY recipe: no refrigerator, authoritative final window, 15 min shaping explained
assert.match(uiSource, /function buildBeginnerTegliaHomeSteps/);
assert.match(uiSource, /buildBeginnerTegliaHomeSteps\(beginnerDirectRecipeSteps, directHomeSchedule, beginnerPhaseBPlan!, roomTemp, lang, ovenTemp, bakingTimeRange, \{ width: trayWidth, length: trayLength \}, flour, dims\.sauce, dims\.cheese, temperatureUnit, pizzas, weight\(effectiveBall\), weight\(dough\.totalDough\)\)/);
assert.match(uiSource, /phases\.filter\(\(phase\) => !coldTitle\.test\(phase\.title\)\)/);

// Fridge-out is a scheduled timestamp, not a new duration or alarm.
assert.match(uiSource, /const coldFinalStart =\s*refrigerated\s*\?\s*\{\s*\.\.\.buildBeginnerColdFinalStart\(schedule, lang, true\)/);
assert.match(uiSource, /coldFinalStart!\.step/);
assert.match(uiSource, /buildBeginnerColdFinalStart\(schedule, lang, true\)/);

// Small salt/yeast stay in grams in US mode; large quantities convert
for (const small of ['0.13 g fresh yeast', '1.5 g dry yeast', '8 g salt']) {
  assert.equal(units.formatUnitText(small, 'fahrenheit', 'us'), small, small);
}
assert.match(units.formatUnitText('Mix 1000 g flour and 620 g water', 'fahrenheit', 'us'), /lb|oz/);

// Saved-recipe load path reuses the authoritative Beginner normalization
{
  const m = uiSource.match(/function applyBeginnerNormalized\(saved: Record<string, any>\) \{[\s\S]*?\n  \}/);
  assert.ok(m, 'applyBeginnerNormalized');
  assert.equal((m[0].match(/normalizeBeginnerSavedState\(/g) ?? []).length, 1);
  const recipeFn = uiSource.match(/const applyRecipe = [\s\S]*?\n  \};/)[0];
  assert.match(recipeFn, /if \(isBeginner\) applyBeginnerNormalized\(settings\)/);
  assert.match(uiSource, /if \(restoreBeginnerStyles\) applyBeginnerNormalized\(saved\)/);
  assert.equal((uiSource.match(/normalizeBeginnerSavedState\(/g) ?? []).length, 1); // single call site
  // Pro: applyRecipe still applies raw settings; normalization is Beginner-gated
  assert.doesNotMatch(recipeFn, /^\s*applyBeginnerNormalized\(settings\)/m);

  const legacy = { pizzaStyle: 'neapolitan', diameter: 35, customBallWeight: 480, romanFormat: 'teglia', oven: 'homePan', ovenTemp: 250, method: 'biga', useIce: true, hydration: 80, trayWidth: 40, trayLength: 60 };
  const n = normalizeBeginnerSavedState(legacy);
  assert.deepEqual(
    [n.pizzaStyle, n.diameter, n.customBallWeight, n.romanFormat, n.hydration, n.oven, n.ovenTemp, n.method, n.useIce, n.trayWidth, n.trayLength],
    ['neapolitan', 30, null, 'tonda', 62, 'ooni', 450, 'direct', false, 30, 40],
  );
  const valid = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', diameter: 30, customBallWeight: 270, oven: 'ooni', ovenTemp: 420, hydration: 64, method: 'direct', useIce: false });
  assert.deepEqual([valid.customBallWeight, valid.ovenTemp, valid.hydration, valid.oven], [270, 420, 64, 'ooni']);
  const nyLegacy = normalizeBeginnerSavedState({ pizzaStyle: 'ny_style', diameter: 30, customBallWeight: 250, romanFormat: 'teglia', oven: 'ooni', ovenTemp: 450, method: 'poolish', useIce: true, hydration: 80 });
  assert.deepEqual(
    [nyLegacy.diameter, nyLegacy.customBallWeight, nyLegacy.romanFormat, nyLegacy.hydration, nyLegacy.oven, nyLegacy.ovenTemp, nyLegacy.method, nyLegacy.useIce],
    [35, null, 'tonda', 64, 'homeStone', 300, 'direct', false],
  );
}

// ---- All six flours stay available; Pro no longer has premium access gates ----
{
  const { beginnerHydrationFor, doughCalc, BASE_FLOURS } = calculator;
  assert.doesNotMatch(uiSource, /isPremiumUnlocked|FREE_PIZZA_STYLE|FREE_FLOUR_TYPES|lock-closed|Pizzabook Premium|Otključaj Premium/);
  assert.match(uiSource, /const changeFlour = \(f: FlourType\) => \{\s*setFlour\(f\)/);
  assert.match(uiSource, /const changeStyle = \(nextStyle: PizzaStyle\) => \{\s*const next = PIZZA_STYLE_PROFILES\[nextStyle\]/);
  assert.match(uiSource, /\(\['neapolitan', 'romana', 'ny_style'\] as PizzaStyle\[\]\)\.map/);
  assert.match(uiSource, /FLOURS_BY_LANG\[lang\]\.map\(\(f\) => \{/);
  assert.match(uiSource, /\{isCustom \? \(\s*<View style=\{styles\.blendPanel\}>/);
  assert.match(uiSource, /if \(isFlourType\(saved\.flour\)\) setFlour\(saved\.flour\)/);
  assert.match(uiSource, /if \(saved\.pizzaStyle === 'neapolitan' \|\| saved\.pizzaStyle === 'romana' \|\| saved\.pizzaStyle === 'ny_style'\)/);
  assert.match(uiSource, /if \(settings\.method\) setMethod\(settings\.flour === 'glutenFree' \? 'direct' : settings\.method\)/);
  assert.match(uiSource, /flour !== 'glutenFree' \|\| m\.k === 'direct'/);
  // Pro-only strength controls remain hidden in Beginner
  assert.match(uiSource, /\{!isBeginner \? \(\s*<View style=\{\{ gap: SPACING\.sm, marginTop: SPACING\.md \}\}>/);
  assert.match(uiSource, /if \(!user && isBeginner\) \{ router\.push\('\/login'\); return; \}/);
  assert.match(uiSource, /localOnly=\{!user\}/);
  assert.match(uiSource, /!user\s*\?\s*await saveProRecipe\(name, recipe, recipeId\)/);
  assert.match(uiSource, /localOnly \? getProSavedRecipes\(\) : api\('\/api\/recipes'\)/);

  // Flour ids and blend persist through the single normalization path
  for (const flour of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom']) {
    for (const style of ['neapolitan', 'ny_style', 'romana']) {
      const n = normalizeBeginnerSavedState({ pizzaStyle: style, flour, blendA: 'spelt', blendB: 'manitoba', blendPctA: 55 });
      assert.equal(n.flour, flour);
      assert.deepEqual([n.blendA, n.blendB, n.blendPctA], ['spelt', 'manitoba', 55]);
      assert.equal(n.hydration, beginnerHydrationFor(style, flour));
      assert.equal(n.method, 'direct');
    }
  }
  const badBlend = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', flour: 'bogus', blendA: 'custom', blendB: 'x', blendPctA: 500 });
  assert.deepEqual([badBlend.flour, badBlend.blendA, badBlend.blendB, badBlend.blendPctA], ['caputo00', 'caputo00', 'wholeWheat', 70]);
  assert.ok(BASE_FLOURS.includes(badBlend.blendA) && BASE_FLOURS.includes(badBlend.blendB));

  // Beginner hydration follows the selected style, except for the gluten-free flour profile.
  const approvedNeapolitanHydration = { caputo00: 62, manitoba: 62, spelt: 62, wholeWheat: 62, glutenFree: 80, custom: 62 };
  for (const [flour, hydration] of Object.entries(approvedNeapolitanHydration)) {
    assert.equal(beginnerHydrationFor('neapolitan', flour), hydration);
  }
  assert.equal(beginnerHydrationFor('ny_style', 'spelt'), 64);
  assert.equal(beginnerHydrationFor('romana', 'wholeWheat'), 59);
  assert.equal(normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', flour: 'glutenFree', hydration: 62 }).hydration, 80);
  assert.equal(normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', flour: 'glutenFree', hydration: 78, oven: 'ooni', ovenTemp: 450 }).hydration, 78);
  assert.match(uiSource, /beginnerHydrationFor\(pizzaStyle, flour\)/);

  // Calculation: water follows hydration for every flour/style; GF psyllium is calculated and reconciles
  for (const style of ['neapolitan', 'ny_style', 'romana']) {
    const ball = PIZZA_STYLE_PROFILES[style].ballWeight;
    for (const flourType of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom']) {
      const hydration = beginnerHydrationFor(style, flourType);
      const r = doughCalc({ pizzas: 4, ballWeight: ball, hydration, saltPct: PIZZA_STYLE_PROFILES[style].saltPct, oilPct: PIZZA_STYLE_PROFILES[style].oilPct, method: 'direct', roomHours: 3, roomTemp: 22, fridgeHours: 20, fridgeTemp: 4, flourType, yeastType: 'fresh', mixing: 'hand' });
      for (const v of [r.total.flour, r.total.water, r.total.salt, r.total.yeast, r.total.oil, r.totalDough]) assert.ok(Number.isFinite(v) && v >= 0, `${style} ${flourType}`);
      assert.ok(Math.abs(r.total.water / r.total.flour * 100 - hydration) < 1.5, `${style} ${flourType} hydration`);
      assert.equal(r.totalDough, 4 * ball);
      if (flourType === 'glutenFree') assert.ok(r.total.psyllium > 0);
      else assert.ok(!r.total.psyllium);
      const fresh = doughCalc({ pizzas: 4, ballWeight: ball, hydration, saltPct: 2.5, oilPct: 2, method: 'direct', roomHours: 3, roomTemp: 22, fridgeHours: 20, fridgeTemp: 4, flourType, yeastType: 'fresh', mixing: 'hand' });
      const mixer = doughCalc({ pizzas: 4, ballWeight: ball, hydration, saltPct: 2.5, oilPct: 2, method: 'direct', roomHours: 3, roomTemp: 22, fridgeHours: 20, fridgeTemp: 4, flourType, yeastType: 'fresh', mixing: 'mixer' });
      assert.deepEqual(fresh.total, mixer.total, `${style} ${flourType} hand/mixer quantities`);
    }
  }
}

// Gluten-free Recipe in DE/EN/SL (localized builder) and Planner shaping must not use wheat gluten/semolina guidance
{
  const start = uiSource.indexOf('function getDetailedDirectStepsLocalized(');
  const end = uiSource.indexOf('function buildBeginnerTegliaHomeSteps(');
  const localized = uiSource.slice(start, end);
  assert.match(localized, /const psylliumAmount = isGlutenFree/);
  for (const needle of ['psyllium husk', 'Flohsamenschalen (Psyllium)', 'luskin trpotca (psyllium)', 'is not kneaded to develop gluten', 'Do not do Stretch & Fold', 'gluten-free or rice flour']) {
    assert.ok(localized.includes(needle), needle);
  }
  assert.doesNotMatch(localized, /If oil is used|Če uporabljate olje/);
  assert.match(uiSource, /if \(plan\.behavior === 'glutenFree'\) \{\s*return \[/);
  assert.match(uiSource, /flour === 'glutenFree' && !isRomanTeglia && index === \(directRecipeFridgeHours > 0 \? 4 : 3\)[\s\S]*kind: 'bakingGlutenFree'/);
  assert.match(uiSource, /mixingGuideKind === 'bakingGlutenFree'\s*\?\s*\(\{ hr: 'FAZA E', en: 'PHASE E', de: 'PHASE E', sl: 'FAZA E' \}\[lang\]\)/);
  assert.match(uiSource, /mixingGuideKind === 'bakingGlutenFree'\s*\?\s*\(\{ hr: 'Temperiranje, oblikovanje i pečenje', en: 'Tempering, shaping and baking'/);
  assert.match(uiSource, /phase-e-gluten-free-visual-guide-close-icon/);
  for (const lng of ['hr', 'en', 'de', 'sl']) {
    const dh = trs[lng].planner.stepCopy.directHomeCopy;
    assert.ok(dh.shapingGlutenFree && !/semol|zdrob|Semola/i.test(dh.shapingGlutenFree), lng);
  }
  const now = new Date('2026-10-05T06:49:00Z');
  const bake = new Date(now.getTime() + 60 * 3600000);
  const plan = createDirectHomePizzaPlan({ style: 'neapolitan', pizzas: 4, ballWeight: 250, method: 'direct', bakeAt: bake, roomTemp: 22, fridgeTemp: 4, ovenType: 'ooni', ovenTemp: 450 }, { source: 'unknown' }, 62, 'fresh', now, true);
  const plain = reversePlan(bake, 'direct', 'neapolitan', trs.en.planner.stepCopy, plan.schedule, null, null, 'en', '450°C').map((x) => x.desc).join('\n');
  const gf = reversePlan(bake, 'direct', 'neapolitan', trs.en.planner.stepCopy, { ...plan.schedule, glutenFree: true }, null, null, 'en', '450°C').map((x) => x.desc).join('\n');
  assert.match(plain, /semolina/);
  assert.doesNotMatch(gf, /semolina/);
  assert.match(gf, /gluten-free or rice flour/);
  assert.match(uiSource, /\{ \.\.\.directHomeSchedule, glutenFree: true \}/);
}

// Custom blend is described in the Recipe measuring step
assert.match(uiSource, /blendDetail/);

// No authoritative mixed gluten-free blend rule exists: Beginner blends must not contain GF flour
const gfBlend = normalizeBeginnerSavedState({ pizzaStyle: 'neapolitan', flour: 'custom', blendA: 'glutenFree', blendB: 'glutenFree', blendPctA: 50 });
assert.deepEqual([gfBlend.blendA, gfBlend.blendB], ['caputo00', 'wholeWheat']);
assert.match(uiSource, /BASE_FLOURS\.filter\(\(k\) => !isBeginner \|\| k !== 'glutenFree'\)/);

// Info icons: Beginner flour info carries a reference note; Romana format alerts are localized
assert.match(uiSource, /BEGINNER_FLOUR_NOTE\[lang\]/);
assert.match(uiSource, /BEGINNER_BLEND_INFO\[lang\]/);
assert.match(uiSource, /Alert\.alert\('Romana Tonda', ROMANA_FORMAT_INFO\[lang\]\.tonda\)/);
assert.match(uiSource, /Alert\.alert\('Romana Teglia', ROMANA_FORMAT_INFO\[lang\]\.teglia\)/);
assert.doesNotMatch(uiSource, /Alert\.alert\('Romana T[a-z]+', '/);

// Beginner Recipe content fixes
{
  const tegliaStart = uiSource.indexOf('function buildBeginnerTegliaHomeSteps(');
  const tegliaEnd = uiSource.indexOf('function buildBeginnerDirectHomeSteps(');
  const teglia = uiSource.slice(tegliaStart, tegliaEnd);
  // Scheduled Teglia remains one mass, with tray pressing and bake steps.
  assert.match(teglia, /pressSteps\.press/);
  assert.match(teglia, /pressSteps\.top/);
  assert.match(teglia, /pressSteps\.bake/);
  assert.doesNotMatch(teglia, /ballingStep|divide the dough into balls|shape dough balls/i);
  // Bake range + oven temperature stay localized for all supported languages.
  assert.equal((teglia.match(/\$\{bakingTimeRange\} (na|at|bei|pri) \$\{ovenTemp\} °C/g) || []).length >= 4 || (teglia.match(/\$\{bakingTimeRange\}/g) || []).length === 4, true);
  for (const phrase of ['pecite bez grilla', 'bake without the grill', 'backen Sie ohne Grill', 'pecite brez žara']) assert.ok(teglia.toLowerCase().includes(phrase.toLowerCase()), phrase);
  // Teglia sentences never trigger the Neapolitan-centric toppings info
  assert.doesNotMatch(teglia, /Dodajte nadjev|Add the toppings|Belegen Sie die Pizza|Dodajte nadev/i);

  // style-aware dough temperature info
  assert.match(uiSource, /doughTemperatureStyle === 'romanaTonda' \|\| doughTemperatureStyle === 'romanaTeglia' \? \[21, 23\] : \[23, 25\]/);
  assert.match(uiSource, /doughTemperatureStyle === 'newYork' \? \{/);
  assert.match(uiSource, /doughTemperatureStyle=\{beginnerDirectHome \?/);

  // Beginner water info: no ice sentence in the Beginner branch, Beginner title
  assert.doesNotMatch(uiSource, /Ice is not selected|Led nije odabran|Eis ist nicht ausgewählt|Led ni izbran/);
  for (const t of ["'Temperatura vode'", "'Water temperature'", "'Wassertemperatur'"]) assert.ok(uiSource.includes(t), t);
  assert.match(uiSource, /infoTitleOverrides\?\.water/);

  // Sticky dough info adds no extra Stretch & Fold
  assert.doesNotMatch(uiSource, /Nauljite ili lagano smočite ruke, napravite kratki odmor, a zatim Stretch & Fold/);
  assert.doesNotMatch(uiSource, /let the dough rest briefly, and then perform a Stretch & Fold/);
  assert.doesNotMatch(uiSource, /anschließend ein Stretch & Fold durch/);
  assert.doesNotMatch(uiSource, /nato izvedite Stretch & Fold/);

  // Gluten-free oil is mixed in, not kneaded
  assert.match(uiSource, /isGlutenFree\n\s+\? pick\(`Geben Sie \$\{ingredients\.oil\} g Olivenöl hinzu und mischen Sie, bis es vollständig eingearbeitet ist\.`/);
  assert.ok(uiSource.includes('miješajte dok se potpuno ne sjedini sa smjesom'));

  // Stone/steel info is a starting recommendation
  assert.ok(uiSource.includes('Kao početnu poziciju postavite kamen ili čelik'));
  assert.ok(uiSource.includes('As a starting position, place the pizza stone or steel'));
  assert.ok(!uiSource.includes("'Kamen ili čelik postavite dvije rešetke ispod gornjeg grijača.'"));
  // Gluten-free (i) attachment triggers
  for (const needle of ['Mixing is finished when|', 'Das Mischen ist beendet|', 'Mešanje je končano', 'Gluten-free dough is not kneaded|', 'Glutenfreier Teig wird nicht geknetet|', 'Brezglutensko testo se ne gnete', 'Bezglutenska smjesa se ne mijesi|', 'Mixing and bulk run|', 'Miješanje i bulk traju|']) assert.ok(uiSource.includes(needle), needle);
  const gfSigns = /\^\[\^;\]\*\(\?:Miješanje i bulk traju/;
  assert.match(uiSource, gfSigns);
  assert.ok(uiSource.includes('Cover the container and let the mixture rest for 15 minutes|'));
}

console.log('Beginner Neapolitan workflow checks passed.');