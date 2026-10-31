#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontend = path.resolve('.');
const read = (relativePath) => fs.readFileSync(path.join(frontend, relativePath), 'utf8');
const routingSource = read('src/onboardingRouting.ts');
const rootLayout = read('app/_layout.tsx');
const indexRoute = read('app/index.tsx');
const onboardingRoute = read('app/onboarding.tsx');
const settingsRoute = read('app/settings.tsx');

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

const { getOnboardingRedirect } = loadTs(routingSource);

async function run() {
  const stored = new Map();
  const mockStorage = {
    async getItem(key, fallback) {
      return stored.has(key) ? stored.get(key) : fallback;
    },
    async setItem(key, value) {
      stored.set(key, value);
      return true;
    },
  };
  const mockEntitlement = {
    hasProAccess: () => true,
    loadProEntitlement: async () => true,
    subscribeProEntitlement: () => () => {},
  };
  const experienceSource = read('src/experienceLevel.ts');
  const billingSource = read('src/proBillingCore.ts');
  const loadExperienceModule = () => loadTs(experienceSource, {
    './utils/storage': { storage: mockStorage },
    './proEntitlement': mockEntitlement,
    './proBillingCore': loadTs(billingSource),
  });

  let experience = loadExperienceModule();
  assert.equal(await experience.loadExperienceLevel(), null, 'fresh storage has no selected experience');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), []), '/onboarding', 'first launch shows onboarding');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['(tabs)']), '/onboarding', 'direct calculator entry without a choice shows onboarding');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['login']), '/onboarding', 'a login route cannot bypass onboarding without a choice');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['pro-guide']), null, 'the guide is accessible without completing onboarding');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['onboarding']), null, 'return from the guide leaves onboarding visible');

  assert.equal(await experience.setExperienceLevel('beginner'), true, 'Beginner choice is persisted');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['onboarding']), '/(tabs)', 'Beginner choice exits onboarding');
  experience = loadExperienceModule();
  await experience.loadExperienceLevel();
  assert.equal(experience.getCachedExperienceLevel(), 'beginner', 'Beginner choice survives a cold restart');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), []), '/(tabs)', 'Beginner restart opens the calculator');

  assert.equal(await experience.setExperienceLevel('pro'), true, 'PRO choice can be saved when access is available');
  experience = loadExperienceModule();
  await experience.loadExperienceLevel();
  assert.equal(experience.getCachedExperienceLevel(), 'pro', 'PRO choice survives a cold restart');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), []), '/(tabs)', 'PRO restart opens the calculator');
  assert.equal(getOnboardingRedirect(experience.getCachedExperienceLevel(), ['(tabs)']), null, 'changing the mode in settings keeps the user in the app');

  assert.match(rootLayout, /getOnboardingRedirect\(experienceLevel, segments\)/, 'the root gate is the sole redirect decision point');
  assert.match(rootLayout, /if \(redirect\) router\.replace\(redirect\)/, 'the root gate applies the resolved redirect');
  assert.match(rootLayout, /if \(loading \|\| experienceLevel === undefined\) return;[\s\S]*?user && inAuth && experienceLevel !== null/, 'the auth redirect waits for onboarding state and cannot bypass onboarding');
  assert.doesNotMatch(indexRoute, /Redirect|router\.(replace|push)/, 'the root index does not compete with the onboarding gate');
  assert.match(onboardingRoute, /setExperienceLevel\(level\)/, 'onboarding still persists a chosen experience level');
  assert.match(onboardingRoute, /router\.push\('\/pro-guide'\)/, 'the guide action does not set an experience level');
  assert.match(settingsRoute, /setExperienceLevel\('beginner'\)/, 'settings can still select Beginner');
  assert.match(settingsRoute, /setExperienceLevel\('pro'\)/, 'settings can still select PRO');
}

run().then(() => console.log('Onboarding routing checks passed.')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
