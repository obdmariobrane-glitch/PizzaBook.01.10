#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');

function loadTypeScriptModule(filePath, dependencies = require) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', 'require', `${compiled}\nreturn module.exports;`)(
    loadedModule,
    loadedModule.exports,
    dependencies,
  );
  return loadedModule.exports;
}

const translations = loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'translations.ts')).translations;
const locales = {
  hr: {
    label: 'Obriši plan',
    title: 'Obrisati postojeći plan?',
    message: 'Svi događaji i ručne izmjene ovog plana bit će obrisani. Recept i postavke Kalkulatora ostat će sačuvani.',
  },
  en: {
    label: 'Delete plan',
    title: 'Delete the existing plan?',
    message: 'All events and manual changes in this plan will be deleted. The recipe and Calculator settings will remain saved.',
  },
  de: {
    label: 'Plan löschen',
    title: 'Den bestehenden Plan löschen?',
    message: 'Alle Ereignisse und manuellen Änderungen dieses Plans werden gelöscht. Rezept und Rechnereinstellungen bleiben gespeichert.',
  },
  sl: {
    label: 'Izbriši načrt',
    title: 'Želite izbrisati obstoječi načrt?',
    message: 'Vsi dogodki in ročne spremembe tega načrta bodo izbrisani. Recept in nastavitve Kalkulatorja bodo ostali shranjeni.',
  },
};

for (const [language, expected] of Object.entries(locales)) {
  const copy = translations[language].planner;
  assert.equal(copy.deletePlan, expected.label, `${language}: delete action label`);
  assert.equal(copy.deletePlanTitle, expected.title, `${language}: confirmation title`);
  assert.equal(copy.deletePlanMessage, expected.message, `${language}: confirmation body`);
  assert.ok(copy.deletePlanNotificationsUnconfirmed, `${language}: notification warning`);
  assert.ok(copy.deletePlanStorageFailed, `${language}: storage failure warning`);
}

let scheduledNotifications = [
  { identifier: 'active-plan', content: { title: 'Mix', data: { source: 'pizza-planner', planId: 'plan-current' } } },
  { identifier: 'other-plan', content: { title: 'Bake', data: { source: 'pizza-planner', planId: 'plan-other' } } },
  { identifier: 'unscoped-plan', content: { title: 'Cold phase', data: { source: 'pizza-planner' } } },
  { identifier: 'legacy-planner', content: { title: '🍕 Old alarm', data: {} } },
  { identifier: 'guided-plan', content: { title: 'Guided step', data: { source: 'pizza-guided-recipe', planId: 'plan-current' } } },
];
const failingIdentifiers = new Set();
const fakeNotifications = {
  getAllScheduledNotificationsAsync: async () => scheduledNotifications,
  cancelScheduledNotificationAsync: async (identifier) => {
    if (failingIdentifiers.has(identifier)) throw new Error(`cannot cancel ${identifier}`);
    scheduledNotifications = scheduledNotifications.filter((notification) => notification.identifier !== identifier);
  },
};
const notifications = loadTypeScriptModule(
  path.join(frontendRoot, 'src', 'notifications.ts'),
  (name) => {
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === 'expo-constants') return { default: { executionEnvironment: 'standalone' } };
    if (name === 'expo-notifications') return fakeNotifications;
    return require(name);
  },
);

(async () => {
  const cancellation = await notifications.cancelPlannerNotificationsForPlan(['plan-current']);
  assert.deepEqual(cancellation, {
    supported: true,
    cancelledCount: 1,
    remainingCount: 0,
    unassociatedCount: 2,
  }, 'cancel and verify only alarms tied to the deleted plan');
  assert.deepEqual(
    scheduledNotifications.map((notification) => notification.identifier).sort(),
    ['guided-plan', 'legacy-planner', 'other-plan', 'unscoped-plan'],
    'unrelated, guided, and unassociated alarms are not canceled',
  );

  scheduledNotifications = [
    { identifier: 'cannot-cancel', content: { title: 'Mix', data: { source: 'pizza-planner', planId: 'plan-current' } } },
  ];
  failingIdentifiers.add('cannot-cancel');
  const failedCancellation = await notifications.cancelPlannerNotificationsForPlan(['plan-current']);
  assert.equal(failedCancellation.remainingCount, 1, 'failed cancellation remains visible to the caller');
  assert.equal(failedCancellation.cancelledCount, 0);

  const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');
  assert.match(plannerSource, /const hasProPlan = !isBeginner && hasCurrentCalculatorRecipe && \(!!bakeAt \|\| steps\.length > 0\)/);
  assert.match(plannerSource, /if \(isBeginner \|\| isDeletingPlan \|\| schedulingAlarms\.current \|\| !hasProPlan\) return/);
  assert.match(plannerSource, /AsyncStorage\.multiRemove\(storageKeys\)/);
  assert.match(plannerSource, /PRO_PLANNER_BAKE_TARGET_STORAGE_KEY/);
  assert.match(plannerSource, /getPlannerPhaseOverridesStorageKey/);
  assert.match(plannerSource, /testID="delete-plan-confirm"/);
  assert.match(plannerSource, /testID="delete-plan-cancel"/);

  console.log('PRO Planner delete-plan checks passed: localized confirmation, plan-scoped notification cancellation/verification, and PRO-only deletion wiring.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
