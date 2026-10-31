#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontend = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(frontend, relativePath), 'utf8');
const freeLaunchSource = read('src/freeLaunch.ts');
const entitlementSource = read('src/proEntitlement.ts');
const experienceSource = read('src/experienceLevel.ts');
const providerSource = read('src/components/ProBillingProvider.tsx');
const unlockRoute = read('app/pro-unlock.tsx');
const onboarding = read('app/onboarding.tsx');
const settings = read('app/settings.tsx');
const appConfig = JSON.parse(read('app.json'));

function loadTs(source, dependencies = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(
    loaded.exports,
    (id) => {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Unexpected test dependency: ${id}`);
    },
    loaded,
  );
  return loaded.exports;
}

const freeLaunch = loadTs(freeLaunchSource);
assert.equal(freeLaunch.FREE_LAUNCH_MODE, true, 'free launch mode is explicitly enabled');

const storedValues = new Map([['pizzabookProLifetimeEntitlement', true]]);
const mockStorage = {
  async secureGet(key, fallback) {
    return storedValues.has(key) ? storedValues.get(key) : fallback;
  },
  async secureSet(key, value) {
    storedValues.set(key, value);
    return true;
  },
  async secureRemove(key) {
    storedValues.delete(key);
    return true;
  },
  async getItem(key, fallback) {
    return storedValues.has(key) ? storedValues.get(key) : fallback;
  },
  async setItem(key, value) {
    storedValues.set(key, value);
    return true;
  },
};
const entitlement = loadTs(entitlementSource, {
  './utils/storage': { storage: mockStorage },
  './freeLaunch': freeLaunch,
});

async function run() {
  await entitlement.loadProEntitlement();
  assert.equal(entitlement.hasProEntitlement(), true, 'existing purchase record remains readable');
  assert.equal(entitlement.hasProAccess(), true, 'existing paid entitlements retain PRO access');
  assert.equal(storedValues.get('pizzabookProLifetimeEntitlement'), true, 'existing entitlement data is preserved');

  storedValues.set('pizzabookProLifetimeEntitlement', false);
  await entitlement.loadProEntitlement();
  assert.equal(entitlement.hasProEntitlement(), false, 'free launch does not forge a store purchase');
  assert.equal(entitlement.hasProAccess(), true, 'free launch grants PRO independently of purchase');
  assert.equal(storedValues.get('pizzabookProLifetimeEntitlement'), false, 'free access does not overwrite legacy entitlement state');

  const experience = loadTs(experienceSource, {
    './utils/storage': { storage: mockStorage },
    './proEntitlement': entitlement,
    './proBillingCore': loadTs(read('src/proBillingCore.ts')),
  });
  await experience.loadExperienceLevel();
  assert.equal(await experience.setExperienceLevel('pro'), true, 'PRO mode can be selected without payment');
  assert.equal(experience.getCachedExperienceLevel(), 'pro', 'saved PRO mode stays accessible');

  const calculatorModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read('src/calculator.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: calculatorModule, exports: calculatorModule.exports });
  const { BASE_FLOURS, FLOUR_PROFILES, PIZZA_STYLE_PROFILES, isProMethodAllowedForFlour } = calculatorModule.exports;
  const methods = ['direct', 'biga', 'poolish'];
  for (const [style, profile] of Object.entries(PIZZA_STYLE_PROFILES)) {
    assert.ok(profile && profile.flourTypes.length > 0, `${style} has supported flour options`);
  }
  for (const flour of BASE_FLOURS) {
    assert.ok(FLOUR_PROFILES[flour], `${flour} flour profile is available`);
    assert.equal(isProMethodAllowedForFlour('direct', flour, 'caputo00', 'wholeWheat', 70), true);
    if (flour !== 'glutenFree') {
      assert.deepEqual(
        methods.map((method) => isProMethodAllowedForFlour(method, flour, 'caputo00', 'wholeWheat', 70)),
        [true, true, true],
        `${flour} supports Direct, Biga and Poolish in PRO mode`,
      );
    }
  }
  assert.equal(isProMethodAllowedForFlour('biga', 'custom', 'glutenFree', 'glutenFree', 50), false);
  assert.equal(isProMethodAllowedForFlour('poolish', 'custom', 'glutenFree', 'glutenFree', 50), false);

  assert.match(onboarding, /const choose = \(level: UserExperienceLevel\) => void setExperienceLevel\(level\)/, 'onboarding selects Beginner and PRO directly');
  assert.doesNotMatch(onboarding, /router\.push\(['"]\/pro-unlock/, 'onboarding does not open a paywall');
  assert.doesNotMatch(settings, /router\.push\(['"]\/pro-unlock/, 'settings does not open a paywall');
  assert.match(unlockRoute, /<Redirect href="\/\(tabs\)" \/>/, 'legacy paywall route redirects into the app');
  assert.doesNotMatch(unlockRoute, /purchase|price|billing|€|€6\.99/i, 'launch route renders no payment UI or price');
  assert.ok(
    providerSource.indexOf('if (FREE_LAUNCH_MODE)') < providerSource.indexOf('<AndroidProBillingProvider>'),
    'free launch bypasses the Android IAP provider',
  );
  assert.ok(
    appConfig.expo.android.blockedPermissions.includes('com.android.vending.BILLING'),
    'Android release config blocks the Play Billing permission',
  );

  console.log('Free launch checks passed: entitlement migration, PRO access, styles, flours, methods, paywall bypass, and Billing disablement.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
