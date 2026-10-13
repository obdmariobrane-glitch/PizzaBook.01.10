#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const rootLayoutSource = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'planner.tsx'), 'utf8');
const notificationsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'notifications.ts'), 'utf8');
const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
const transparentSplashPlugin = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'withTransparentAndroidSplashDrawable.js'), 'utf8');
const persistenceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'beginnerPlanPersistence.ts'), 'utf8');
const guidedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'guidedRecipe.ts'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');
const restoreCoordinatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'beginnerPlanRestoreCoordinator.ts'), 'utf8');

const eventIds = ['mix', 'fold1', 'fold1Gentle', 'fold2', 'fold2Gentle', 'fridgeIn', 'fridgeInCombined', 'balling', 'portioning', 'trayPrepare', 'fridgeOut', 'roomFermentationEnd', 'preheat', 'shape', 'bake'];
for (const id of eventIds) {
  assert.ok(
    (translations.match(new RegExp(`\\b${id}:\\s*\\{`, 'g')) || []).length >= 4,
    `missing localized notification copy for ${id}`,
  );
}

assert.match(appSource, /t\.beginnerCalc\.guidedNotificationCopy\[event\.id\]/);
assert.match(appSource, /scheduleLocalAt\(copy\.title, notificationBody, event\.at/);
assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /const phaseBStart = new Date\(\s*startAt\.getTime\(\) \+ \(directHomeSchedule\.phaseAMinutes \?\? 0\) \* 60000/);
assert.match(appSource, /at: new Date\(phaseBStart\.getTime\(\) \+ fold\.offsetMinutes \* 60000\)/);
assert.match(appSource, /if \(fridgeHours > 0\) \{/);
assert.match(appSource, /const separateFridgeIn = fridgeAt && fridgeAt\.getTime\(\) > ballingAt\.getTime\(\)/);
assert.match(appSource, /id: 'fridgeIn',\s*label: t\.beginnerCalc\.timelineRefrigerateDough,\s*at: fridgeAt/);
assert.match(appSource, /id: isGlutenFree\s*\?\s*'portioning'\s*:\s*isRomanTeglia\s*\?\s*'fridgeIn'\s*:\s*'fridgeInCombined'/);
assert.match(appSource, /if \(roomAfterFridgeHours > 0\) \{\s*steps\.push\(\{\s*id: 'fridgeOut'/);
assert.match(appSource, /id: 'preheat'/);
assert.equal((appSource.match(/id: 'roomFermentationEnd'/g) || []).length, 1);
assert.match(appSource, /getBeginnerRoomOnlyEnd\(directHomeSchedule, preheatAt\)/);
assert.match(appSource, /label: t\.beginnerCalc\.timelineFinalPrepStart/);
assert.equal((translations.match(/roomFermentationEndPreheat:/g) || []).length, 4);
const roomFinalPrepCopy = [
  {
    timeline: 'Početak završne pripreme',
    title: 'Početak završne pripreme',
    combinedTitle: 'Početak završne pripreme i zagrijavanje peći',
    restText: 'Tijesto ostaje pokriveno na sobnoj temperaturi do oblikovanja pizze.',
  },
  {
    timeline: 'Start of final preparation',
    title: 'Start final preparation',
    combinedTitle: 'Start final preparation and preheat the oven',
    restText: 'Keep the dough covered at room temperature until shaping.',
  },
  {
    timeline: 'Beginn der Endvorbereitung',
    title: 'Beginn der Endvorbereitung',
    combinedTitle: 'Beginn der Endvorbereitung und Ofen vorheizen',
    restText: 'Lass den Teig bis zum Formen abgedeckt bei Raumtemperatur.',
  },
  {
    timeline: 'Začetek končne priprave',
    title: 'Začetek končne priprave',
    combinedTitle: 'Začetek končne priprave in segrevanje pečice',
    restText: 'Testo naj ostane pokrito pri sobni temperaturi do oblikovanja.',
  },
];
for (const { timeline, title, combinedTitle, restText } of roomFinalPrepCopy) {
  assert.ok(translations.includes(`timelineFinalPrepStart: '${timeline}'`), `missing timeline label: ${timeline}`);
  assert.ok(translations.includes(`roomFermentationEnd: { title: '${title}'`), `missing room notification title: ${title}`);
  assert.ok(translations.includes(`roomFermentationEndPreheat: { title: '${combinedTitle}'`), `missing combined notification title: ${combinedTitle}`);
  assert.ok(translations.includes(restText), `missing continued room-rest instruction: ${restText}`);
}
assert.match(appSource, /planGuidedNotifications\(beginnerScheduleSteps, guidedCompletedAt, Date\.now\(\)\)/);
assert.match(appSource, /beginnerScheduleModeUserSelected\.current = true/);
assert.match(appSource, /setNighttimeWarningRequest\(\(request\) => request \+ 1\)/);
assert.match(appSource, /if \(!isBeginner \|\| !guidedPlanId\) return/);
assert.doesNotMatch(appSource, /if \(!isBeginner \|\| !guidedPlanId \|\| guidedProgressPlanId !== guidedPlanId\) return/);
assert.match(appSource, /combinedStepId: combinedWith\.id/);
assert.match(appSource, /id: 'roomFermentationEnd'[\s\S]{0,200}?steps\.push\(\{\s*id: 'preheat'/, 'preheat event must be kept next to the room-end event');
assert.match(appSource, /id: 'shape'/);
assert.match(appSource, /id: 'bake'/);

assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /const isGlutenFree = flour === 'glutenFree'/);
assert.match(appSource, /const isRomanTeglia =/);
assert.match(appSource, /id: fold\.index === 1 \? 'fold1' : 'fold2'/);
assert.match(appSource, /id: isTargetBeginnerSchedule \? 'balling' : isGlutenFree \? 'portioning' : 'fridgeInCombined'/);
assert.match(appSource, /id: isGlutenFree\s*\n\s*\? 'portioning'\s*\n\s*: isRomanTeglia\s*\n\s*\? 'fridgeIn'\s*\n\s*: 'fridgeInCombined'/);
assert.match(appSource, /id: isGlutenFree \? 'portioning' : 'balling'/);
assert.match(appSource, /const useGentleFoldCopy = flour !== 'custom'/);
assert.match(appSource, /guidedNotificationCopy\.fold1Gentle/);
assert.match(appSource, /guidedNotificationCopy\.fold2Gentle/);
assert.equal((appSource.match(/for \(const fold of beginnerPhaseBPlan\.folds\)/g) || []).length, 1);

const compiledNotifications = ts.transpileModule(notificationsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const notificationModule = { exports: {} };
vm.runInNewContext(compiledNotifications, {
  module: notificationModule,
  exports: notificationModule.exports,
  require: (name) => {
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'standalone' } };
    throw new Error(`Unexpected dependency in notification test: ${name}`);
  },
}, { filename: 'notifications.ts' });
const { isObsoletePlannerNotification } = notificationModule.exports;
const compiledRestoreCoordinator = ts.transpileModule(restoreCoordinatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const restoreCoordinatorModule = { exports: {} };
vm.runInNewContext(compiledRestoreCoordinator, {
  module: restoreCoordinatorModule,
  exports: restoreCoordinatorModule.exports,
  require: (name) => {
    if (name === './preferences') {
      return { parsePreferredYeastType: (value) => value === 'fresh' || value === 'activeDry' || value === 'dry' ? value : null };
    }
    throw new Error(`Unexpected dependency in restore-coordinator test: ${name}`);
  },
}, { filename: 'beginnerPlanRestoreCoordinator.ts' });
const { shouldReconcilePlannerNotifications } = restoreCoordinatorModule.exports;
const currentPlan = { content: { title: '🍕 Mix', data: { source: 'pizza-planner', planId: 'plan-a' } } };
const oldPlan = { content: { title: '🍕 Mix', data: { source: 'pizza-planner', planId: 'plan-old' } } };
const legacyPlanner = { content: { title: '🍕 Mix', data: { method: 'direct' } } };
const unrelated = { content: { title: 'Reminder', data: { source: 'other', planId: 'plan-old' } } };
assert.equal(isObsoletePlannerNotification(currentPlan, 'plan-a'), false, 'same-plan notifications must survive Planner re-entry/restart');
assert.equal(isObsoletePlannerNotification(oldPlan, 'plan-a'), true, 'notifications for changed plan inputs must be cancelled');
assert.equal(isObsoletePlannerNotification(legacyPlanner, 'plan-a'), true, 'unidentifiable legacy Planner reminders must be cancelled');
assert.equal(isObsoletePlannerNotification(unrelated, 'plan-a'), false, 'other notification sources must not be cancelled');
const reconcilePending = (notifications, status, planId, hasBakeAt, hasCurrentPlan) => (
  shouldReconcilePlannerNotifications(status, true, hasBakeAt, hasCurrentPlan)
    ? notifications.filter((request) => !isObsoletePlannerNotification(request, planId))
    : notifications.slice()
);
assert.deepEqual(
  reconcilePending([currentPlan], 'pending', null, false, false),
  [currentPlan],
  'existing alarms must survive the initial cold-start restore state',
);
assert.deepEqual(
  reconcilePending([currentPlan], 'ready', 'plan-a', true, true),
  [currentPlan],
  'restoring the same plan identity must retain its alarms',
);
assert.deepEqual(
  reconcilePending([currentPlan], 'ready', null, true, false),
  [currentPlan],
  'a non-null but incomplete restored plan identity must not cancel alarms',
);
assert.deepEqual(
  reconcilePending([currentPlan], 'ready', 'plan-b', true, true),
  [],
  'a real input change producing a new plan identity must cancel old alarms',
);
assert.deepEqual(
  reconcilePending([currentPlan], 'ready', null, false, false),
  [],
  'a confirmed empty plan after restore must cancel old alarms',
);
assert.match(notificationsSource, /data\.source === 'pizza-planner'\s*\?\s*currentPlanId === null \|\| data\.planId !== currentPlanId/);
assert.match(plannerSource, /cancelObsoletePlannerNotifications\(planKey \|\| null\)/);
assert.match(plannerSource, /shouldReconcilePlannerNotifications\(/);
assert.match(plannerSource, /!canReconcilePlannerNotifications\) return/);
assert.match(appSource, /setPlannerNotificationRestoreStatus\('pending'\)/);
assert.match(appSource, /setPlannerNotificationRestoreStatus\(loadedIsBeginner \|\| restoredBakeAt !== undefined \? 'ready' : 'unavailable'\)/);
assert.match(restoreCoordinatorSource, /if \(status === 'pending'\) return false/);
assert.match(plannerSource, /source: 'pizza-planner',\s*method,\s*planId: planKey/);
assert.match(plannerSource, /const planKey = bakeAt \? JSON\.stringify\(\[[\s\S]*steps\.map\(\(step\) => step\.at\.getTime\(\)\)[\s\S]*plannerDirectHomeSchedule,[\s\S]*plannerPoolishHomeSchedule/);
assert.match(plannerSource, /cancelObsoletePlannerNotifications\(planKey \|\| null\)/);
assert.match(notificationsSource, /type: mod\.SchedulableTriggerInputTypes\?\.DATE \?\? 'date'[\s\S]*date: scheduledAt/);
assert.match(notificationsSource, /type: mod\.SchedulableTriggerInputTypes\?\.TIME_INTERVAL \?\? 'timeInterval'/);
assert.match(plannerSource, /const trigger = s\.at\.getTime\(\) - Date\.now\(\)/);
assert.match(plannerSource, /return scheduleLocal\(`🍕 \$\{s\.title\}`, s\.desc, Math\.round\(trigger \/ 1000\)/);
assert.match(appSource, /if \(!guidedNotificationsEnabled \|\| !isPushSupported\(\)\) \{/);
assert.match(appSource, /scheduleNotificationBatch\([\s\S]*cancelGuidedNotificationsForPlanExcept\(guidedPlanId/);
assert.match(notificationsSource, /export async function scheduleNotificationBatch/);
assert.match(notificationsSource, /export async function cancelPlannerNotificationsForMethodsExcept/);
assert.match(notificationsSource, /export async function cancelGuidedNotificationsForPlanExcept/);
assert.match(appSource, /Unable to synchronize guided recipe notifications:[\s\S]{0,220}Alert\.alert/);
assert.doesNotMatch(appSource, /Unable to synchronize guided recipe notifications:[\s\S]{0,220}setGuidedNotificationsEnabled\(false\)/,
  'a scheduling failure must not erase the saved Beginner notification preference');
assert.match(appSource, /guidedProgressPlanId !== guidedPlanId/);
assert.match(rootLayoutSource, /if \(!animationDone \|\| experienceLevel === undefined \|\| storedSettingsLoadStatus !== 'loaded'\) return/);
assert.match(rootLayoutSource, /await requestStartupNotificationPermissionIfNeeded/);
assert.match(rootLayoutSource, /STARTUP_NOTIFICATION_PERMISSION_REQUESTED_KEY/);
assert.match(rootLayoutSource, /!startupPermissionSettled/);
assert.match(notificationsSource, /const \{ status \} = await mod\.getPermissionsAsync\(\);\s*if \(status !== 'granted'\) return null;/);
assert.equal(appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1].android.image, undefined);
assert.equal(appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1].android.backgroundColor, '#F7C894');
assert.ok(appConfig.expo.plugins.includes('./plugins/withTransparentAndroidSplashDrawable'));
assert.match(transparentSplashPlugin, /splashscreen_logo\.xml/);
assert.match(transparentSplashPlugin, /android:fillColor="#00000000"/);
assert.match(persistenceSource, /input\.pizzaStyle === 'romana' \? input\.romanFormat : null/);
assert.match(guidedSource, /event\.at\.getTime\(\) > now/);
assert.match(guidedSource, /completedAt\[event\.id\] === undefined/);
assert.match(persistenceSource, /input\.bakeAt,[\s\S]*input\.preferredYeastType,[\s\S]*input\.beginnerScheduleMode/);
assert.doesNotMatch(persistenceSource, /input\.language|input\.temperatureUnit|input\.measurementSystem/);
assert.match(plannerSource, /const planKey = bakeAt \? JSON\.stringify\(\[[\s\S]*steps\.map\(\(step\) => step\.at\.getTime\(\)\)[\s\S]*plannerDirectHomeSchedule,[\s\S]*plannerPoolishHomeSchedule/);

async function verifyTriggerAndCancellationPayloads() {
  const nativeCalls = [];
  let holdNextSchedule = null;
  let permissionState = { status: 'undetermined', canAskAgain: true };
  let permissionRequests = 0;
  let grantPermissionOnRequest = true;
  const cancelledIds = [];
  let pendingNotifications = [
    { identifier: 'same-plan', content: { data: { source: 'pizza-planner', planId: 'plan-a' } } },
    { identifier: 'old-plan', content: { data: { source: 'pizza-planner', planId: 'plan-old' } } },
    { identifier: 'legacy-plan', content: { title: '🍕 Mix', data: { method: 'direct' } } },
    { identifier: 'unrelated', content: { data: { source: 'other' } } },
  ];
  const nativeNotifications = {
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    getPermissionsAsync: async () => permissionState,
    requestPermissionsAsync: async () => {
      permissionRequests += 1;
      permissionState = grantPermissionOnRequest
        ? { status: 'granted', canAskAgain: false }
        : { status: 'denied', canAskAgain: true };
      return permissionState;
    },
    scheduleNotificationAsync: async (request) => {
      nativeCalls.push(request);
      const id = `scheduled-${nativeCalls.length}`;
      pendingNotifications.push({ identifier: id, content: request.content });
      if (holdNextSchedule) {
        const hold = holdNextSchedule;
        holdNextSchedule = null;
        await hold();
      }
      return id;
    },
    getAllScheduledNotificationsAsync: async () => pendingNotifications,
    cancelScheduledNotificationAsync: async (id) => {
      cancelledIds.push(id);
      pendingNotifications = pendingNotifications.filter((request) => request.identifier !== id);
    },
  };
  const nativeModule = { exports: {} };
  vm.runInNewContext(compiledNotifications, {
    module: nativeModule,
    exports: nativeModule.exports,
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'standalone' } };
      if (name === 'expo-notifications') return nativeNotifications;
      throw new Error(`Unexpected dependency in native notification test: ${name}`);
    },
  }, { filename: 'notifications.native.test.ts' });

  const scheduledAt = new Date('2026-10-25T01:30:00.000Z');
  await nativeModule.exports.scheduleLocalAt('Bake', 'Bake now', scheduledAt, {
    source: 'pizza-guided-recipe',
    planId: 'guided-plan-a',
    stepId: 'bake',
  });
  assert.equal(nativeCalls[0].trigger.type, 'date');
  assert.equal(nativeCalls[0].trigger.date.getTime(), scheduledAt.getTime(), 'Beginner DATE trigger must preserve the plan timestamp across the Vienna DST transition');
  assert.deepEqual(JSON.parse(JSON.stringify(nativeCalls[0].content.data)), {
    source: 'pizza-guided-recipe',
    planId: 'guided-plan-a',
    stepId: 'bake',
  });

  await nativeModule.exports.scheduleLocal('🍕 Mix', 'Mix dough', 90, {
    source: 'pizza-planner',
    method: 'direct',
    planId: 'plan-a',
  });
  assert.equal(nativeCalls[1].trigger.type, 'timeInterval');
  assert.equal(nativeCalls[1].trigger.seconds, 90, 'Planner trigger should represent the remaining time to the same Date event');

  await nativeModule.exports.cancelObsoletePlannerNotifications('plan-a');
  assert.deepEqual(
    cancelledIds.sort(),
    ['old-plan', 'legacy-plan'].sort(),
    'only obsolete and unidentifiable Planner alarms should be cancelled',
  );
  assert.ok(pendingNotifications.some((request) => request.identifier === 'same-plan'));
  assert.ok(pendingNotifications.some((request) => request.identifier === 'unrelated'));
  await nativeModule.exports.cancelObsoletePlannerNotifications(null);
  assert.ok(cancelledIds.includes('same-plan'), 'clearing the plan must cancel its remaining reminders');
  assert.ok(pendingNotifications.some((request) => request.identifier === 'unrelated'));
  assert.equal(isObsoletePlannerNotification(currentPlan, null), true, 'an empty plan identity invalidates all Planner reminders');

  const api = nativeModule.exports;
  const rolledBackIdentifiers = [];
  await assert.rejects(
    api.scheduleNotificationBatch(
      ['first', 'second', 'third'],
      async (item) => item === 'third' ? null : `scheduled-${item}`,
      async (identifier) => { rolledBackIdentifiers.push(identifier); },
    ),
    /did not return an identifier/,
  );
  assert.deepEqual(rolledBackIdentifiers, ['scheduled-first', 'scheduled-second'],
    'a partial notification batch must roll back every alarm it created');
  assert.deepEqual(
    Array.from(await api.scheduleNotificationBatch(
      ['first', 'second'],
      async (item) => `success-${item}`,
      async () => { throw new Error('complete batches need no rollback'); },
    )),
    ['success-first', 'success-second'],
    'a fully scheduled notification batch returns all new identifiers',
  );
  const schedulesBeforeStartupPermission = nativeCalls.length;
  const startupPromptOrder = [];
  permissionState = { status: 'undetermined', canAskAgain: true };
  grantPermissionOnRequest = true;
  let firstLaunchRequestRecorded = false;
  const grantedOnFirstLaunch = await api.requestStartupNotificationPermissionIfNeeded(
    firstLaunchRequestRecorded,
    async () => {
      startupPromptOrder.push('recorded');
      firstLaunchRequestRecorded = true;
    },
  );
  assert.equal(grantedOnFirstLaunch, true, 'a first native launch must request undetermined permission');
  assert.equal(permissionRequests, 1);
  assert.equal(firstLaunchRequestRecorded, true, 'the one-time marker must be persisted before showing the system prompt');
  assert.deepEqual(startupPromptOrder, ['recorded']);
  assert.equal(nativeCalls.length, schedulesBeforeStartupPermission, 'the startup permission flow must not schedule recipe reminders');

  permissionState = { status: 'granted', canAskAgain: false };
  const requestsBeforeGrantedCheck = permissionRequests;
  await api.requestStartupNotificationPermissionIfNeeded(false, async () => {
    throw new Error('already-granted permission must not be marked for a request');
  });
  assert.equal(permissionRequests, requestsBeforeGrantedCheck, 'already-granted permission must not trigger a prompt');

  permissionState = { status: 'undetermined', canAskAgain: true };
  grantPermissionOnRequest = false;
  let deniedLaunchRequestRecorded = false;
  const grantedAfterDenial = await api.requestStartupNotificationPermissionIfNeeded(
    deniedLaunchRequestRecorded,
    async () => { deniedLaunchRequestRecorded = true; },
  );
  assert.equal(grantedAfterDenial, false, 'a denied system permission must not enable notifications');
  assert.equal(deniedLaunchRequestRecorded, true);
  assert.equal(permissionState.status, 'denied');
  const requestsAfterDenial = permissionRequests;
  let deniedRequestMarkerChanged = false;
  await api.requestStartupNotificationPermissionIfNeeded(false, async () => { deniedRequestMarkerChanged = true; });
  assert.equal(deniedRequestMarkerChanged, false, 'a denied permission must not trigger another prompt even when the OS permits retry');
  assert.equal(permissionRequests, requestsAfterDenial);
  await api.requestStartupNotificationPermissionIfNeeded(deniedLaunchRequestRecorded, async () => {});
  assert.equal(permissionRequests, requestsAfterDenial, 'reopening after denial must not repeat the system prompt');

  permissionState = { status: 'undetermined', canAskAgain: false };
  let unavailableRequestMarkerChanged = false;
  await api.requestStartupNotificationPermissionIfNeeded(false, async () => { unavailableRequestMarkerChanged = true; });
  assert.equal(unavailableRequestMarkerChanged, false, 'the startup flow must not request when the OS disallows prompting');
  assert.equal(permissionRequests, requestsAfterDenial);

  permissionState = { status: 'undetermined', canAskAgain: true };
  await api.requestStartupNotificationPermissionIfNeeded(true, async () => {});
  assert.equal(permissionRequests, requestsAfterDenial, 'a persisted startup marker must suppress a prompt on reopening');
  assert.equal(await api.requestAndGetDeviceToken(), null, 'token registration must not request permission');
  assert.equal(permissionRequests, requestsAfterDenial, 'token registration must not show a second prompt');

  for (const newerPlanId of ['overlap-plan', 'changed-plan']) {
    pendingNotifications = [];
    let generation = 1;
    let release;
    let started;
    const firstStarted = new Promise((resolve) => { started = resolve; });
    holdNextSchedule = () => {
      started();
      return new Promise((resolve) => { release = resolve; });
    };
    const sync = (planId, expectedGeneration) => api.runGuidedNotificationSync(async () => {
      await api.cancelGuidedNotificationsForPlan(planId);
      if (generation !== expectedGeneration) return;
      await api.scheduleLocalAt('Bake', 'Bake now', new Date(Date.now() + 3600000), {
        source: 'pizza-guided-recipe', planId, stepId: 'bake',
      });
      if (generation !== expectedGeneration) await api.cancelGuidedNotificationsForPlan(planId);
    });
    const older = sync('overlap-plan', 1);
    await firstStarted;
    generation = 2;
    const callsBeforeNewer = nativeCalls.length;
    const newer = sync(newerPlanId, 2);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(nativeCalls.length, callsBeforeNewer, 'newer scheduling must wait for older cleanup');
    release();
    await Promise.all([older, newer]);
    assert.equal(pendingNotifications.length, 1, 'newer sync must retain exactly one alarm');
    assert.equal(pendingNotifications[0].content.data.planId, newerPlanId, 'stale cleanup must preserve the newer plan alarm');
  }
  await assert.rejects(api.runGuidedNotificationSync(async () => { throw new Error('sync failure'); }), /sync failure/);
  let recovered = false;
  await api.runGuidedNotificationSync(async () => { recovered = true; });
  assert.equal(recovered, true, 'a failed sync must not block the queue');
  assert.match(appSource, /runGuidedNotificationSync\(syncNotifications\)/);
  assert.match(appSource, /runGuidedNotificationSync\(\(\) => cancelGuidedNotificationsForPlan\(previousPlanId\)\)/);
}

verifyTriggerAndCancellationPayloads().then(() => {
  console.log('Beginner notification completeness, event triggers, Planner identity, and cancellation checks passed.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
