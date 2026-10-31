const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const frontendRoot = path.resolve(path.dirname(require.main.filename), '..');

const sourcePath = path.join(frontendRoot, 'src/proBillingCore.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleObject = { exports: {} };
new Function('exports', 'require', 'module', compiled)(moduleObject.exports, require, moduleObject);

const {
  createProPurchaseProcessor,
  isAlreadyOwnedError,
  isPurchaseCancelled,
  PRO_LIFETIME_PRODUCT_ID,
  restoreProEntitlement,
  resolveExperienceLevel,
} = moduleObject.exports;
const storageValues = new Map();
const secureStorage = {
  async secureGet(key, fallback) {
    return storageValues.has(key) ? storageValues.get(key) : fallback;
  },
  async secureSet(key, value) {
    storageValues.set(key, value);
    return true;
  },
  async secureRemove(key) {
    storageValues.delete(key);
    return true;
  },
};
const entitlementSource = fs.readFileSync(path.join(frontendRoot, 'src/proEntitlement.ts'), 'utf8');
const freeLaunchSource = fs.readFileSync(path.join(frontendRoot, 'src/freeLaunch.ts'), 'utf8');
const freeLaunchModule = { exports: {} };
const freeLaunchCode = ts.transpileModule(freeLaunchSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', 'require', 'module', freeLaunchCode)(freeLaunchModule.exports, require, freeLaunchModule);
const entitlementModule = { exports: {} };
const entitlementCode = ts.transpileModule(entitlementSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', 'require', 'module', entitlementCode)(
  entitlementModule.exports,
  (id) => {
    if (id === './utils/storage') return { storage: secureStorage };
    if (id === './freeLaunch') return freeLaunchModule.exports;
    throw new Error(`Unexpected entitlement test dependency: ${id}`);
  },
  entitlementModule,
);
const entitlement = entitlementModule.exports;
const settingsValues = new Map([['userExperienceLevel', 'pro']]);
const settingsStorage = {
  async getItem(key, fallback) {
    return settingsValues.has(key) ? settingsValues.get(key) : fallback;
  },
  async setItem(key, value) {
    settingsValues.set(key, value);
    return true;
  },
};
const experienceSource = fs.readFileSync(path.join(frontendRoot, 'src/experienceLevel.ts'), 'utf8');
const experienceModule = { exports: {} };
const experienceCode = ts.transpileModule(experienceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', 'require', 'module', experienceCode)(
  experienceModule.exports,
  (id) => {
    if (id === './utils/storage') return { storage: settingsStorage };
    if (id === './proEntitlement') return entitlement;
    if (id === './proBillingCore') return moduleObject.exports;
    throw new Error(`Unexpected experience-level test dependency: ${id}`);
  },
  experienceModule,
);
const translationsSource = fs.readFileSync(path.join(frontendRoot, 'src/i18n/translations.ts'), 'utf8');
const translationsModule = { exports: {} };
const translationsCode = ts.transpileModule(translationsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', 'require', 'module', translationsCode)(
  translationsModule.exports,
  require,
  translationsModule,
);
const purchase = {
  productId: PRO_LIFETIME_PRODUCT_ID,
  purchaseState: 'purchased',
  store: 'google',
  id: 'play-order-1',
};

async function run() {
  let acknowledgementCount = 0;
  let persistenceCount = 0;
  const processor = createProPurchaseProcessor(async () => {
    acknowledgementCount += 1;
  }, async () => {
    persistenceCount += 1;
    return true;
  });

  assert.equal(await processor(purchase), true, 'confirmed Play purchase is granted');
  assert.equal(await processor(purchase), true, 'duplicate purchase event remains successful');
  assert.equal(acknowledgementCount, 1, 'duplicate event is acknowledged only once');
  assert.equal(persistenceCount, 1, 'duplicate event is persisted only once');

  let rejectedWasNotPersisted = false;
  const invalidProcessor = createProPurchaseProcessor(async () => {
    throw new Error('must not acknowledge an invalid purchase');
  }, async () => {
    rejectedWasNotPersisted = true;
    return true;
  });
  assert.equal(await invalidProcessor({ ...purchase, purchaseState: 'pending' }), false, 'pending purchase is not granted');
  assert.equal(await invalidProcessor({ ...purchase, store: 'unknown' }), false, 'non-Play purchase is not granted');
  assert.equal(rejectedWasNotPersisted, false, 'invalid purchases are not persisted');

  let retryCount = 0;
  const retryProcessor = createProPurchaseProcessor(async () => {
    retryCount += 1;
    if (retryCount === 1) throw new Error('temporary acknowledgement failure');
  }, async () => true);
  await assert.rejects(retryProcessor(purchase), /temporary acknowledgement failure/);
  assert.equal(await retryProcessor(purchase), true, 'failed processing can be retried');
  assert.equal(retryCount, 2, 'retry acknowledges again after the prior failure');

  let acknowledgementFinished = false;
  let grantAfterAcknowledgement = false;
  await restoreProEntitlement([purchase], async () => {
    acknowledgementFinished = true;
  }, async () => {
    grantAfterAcknowledgement = acknowledgementFinished;
    return true;
  }, async () => true);
  assert.equal(grantAfterAcknowledgement, true, 'restore grants only after acknowledgement');

  let revoked = false;
  assert.equal(await restoreProEntitlement([], async () => {}, async () => true, async () => {
    revoked = true;
    return true;
  }), false, 'empty successful store query does not grant PRO');
  assert.equal(revoked, true, 'empty successful restore clears a stale cached entitlement');

  assert.equal(isPurchaseCancelled({ code: 'user-cancelled' }), true, 'store cancellation is recognized');
  assert.equal(isPurchaseCancelled(new Error('network failure')), false, 'non-cancellation errors remain errors');
  assert.equal(isAlreadyOwnedError({ code: 'already-owned' }), true, 'already-owned purchase can be restored');
  assert.equal(resolveExperienceLevel('pro', false), 'beginner', 'mode preference cannot unlock PRO');
  assert.equal(resolveExperienceLevel('pro', true), 'pro', 'confirmed cached entitlement allows offline PRO mode');
  assert.equal(resolveExperienceLevel('beginner', false), 'beginner', 'Beginner remains available without purchase');

  assert.equal(await entitlement.loadProEntitlement(), false, 'no saved store confirmation is locked');
  assert.equal(await entitlement.grantProEntitlement(), true, 'confirmed store purchase can be saved securely');
  assert.equal(entitlement.hasProEntitlement(), true, 'saved purchase status is available offline');
  const restartedEntitlement = { exports: {} };
  new Function('exports', 'require', 'module', entitlementCode)(
    restartedEntitlement.exports,
    (id) => {
      if (id === './utils/storage') return { storage: secureStorage };
      if (id === './freeLaunch') return freeLaunchModule.exports;
      throw new Error(`Unexpected entitlement test dependency: ${id}`);
    },
    restartedEntitlement,
  );
  assert.equal(await restartedEntitlement.exports.loadProEntitlement(), true, 'saved entitlement survives simulated app restart');
  assert.equal(await restartedEntitlement.exports.revokeProEntitlement(), true, 'confirmed empty restore clears local entitlement');
  assert.equal(restartedEntitlement.exports.hasProEntitlement(), false, 'revoked entitlement no longer grants PRO');
  assert.equal(restartedEntitlement.exports.hasProAccess(), true, 'free launch grants access independently of store entitlement');
  await experienceModule.exports.loadExperienceLevel();
  assert.equal(experienceModule.exports.getCachedExperienceLevel(), 'pro', 'free launch keeps the saved PRO mode accessible');
  assert.equal(await experienceModule.exports.setExperienceLevel('pro'), true, 'PRO can be selected without a purchase in free launch mode');
  storageValues.set('pizzabookProLifetimeEntitlement', true);
  await experienceModule.exports.loadExperienceLevel();
  assert.equal(experienceModule.exports.getCachedExperienceLevel(), 'pro', 'confirmed cached entitlement restores PRO after restart while offline');

  for (const language of ['hr', 'en', 'de', 'sl']) {
    const localizedBilling = translationsModule.exports.translations[language].billing;
    assert.ok(localizedBilling.title && localizedBilling.buy && localizedBilling.restore && localizedBilling.offlineSecurity, `${language} has complete billing copy`);
  }

  console.log('PRO billing mock checks passed: purchase, cancellation classification, retry, duplicate event, restore, and offline gate.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
