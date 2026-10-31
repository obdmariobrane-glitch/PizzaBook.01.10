#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const provider = fs.readFileSync(path.join(process.cwd(), 'src/components/BugReportProvider.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(process.cwd(), 'app/settings.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(process.cwd(), 'app/_layout.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(process.cwd(), 'src/i18n/translations.ts'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

assert.match(settings, /testID="settings-report-bug"[\s\S]*?onPress=\{openBugReport\}/);
assert.match(provider, /const openBugReport = useCallback\(\(\) =>/);
assert.match(provider, /Accelerometer\.addListener\(\(reading\) =>/);
assert.match(provider, /openBugReport\(\);/);
assert.match(provider, /if \(Platform\.OS === 'web' \|\| shakeEnabled !== true\) return;/);
assert.match(provider, /subscription\?\.remove\(\);/);
assert.match(provider, /visible=\{modalOpen\}/);
assert.equal((provider.match(/<Modal\b/g) ?? []).length, 1, 'one shared bug report modal');
assert.match(provider, /const REPORT_EMAIL = 'support@pizzabook\.app'/);
assert.match(provider, /mailto:\$\{REPORT_EMAIL\}/);
assert.match(provider, /testID="bug-report-submit"/);
assert.match(settings, /testID="settings-shake-to-report"/);
assert.match(settings, /onValueChange=\{\(enabled\) =>/);
assert.match(settings, /setShakeEnabled\(enabled\)/);
assert.match(provider, /AsyncStorage\.setItem\(SHAKE_TO_REPORT_STORAGE_KEY, String\(enabled\)\)/);
assert.match(layout, /<BugReportProvider>[\s\S]*?<AuthProvider>/);
assert.equal(packageJson.dependencies['expo-sensors'], '~57.0.3');

for (const key of [
  'reportBug',
  'shakeToReportBug',
  'bugReportTitle',
  'bugReportSummary',
  'bugReportSummaryPlaceholder',
  'bugReportDetails',
  'bugReportDetailsPlaceholder',
  'bugReportSubmit',
  'bugReportCancel',
  'bugReportRequired',
  'bugReportEmailSubject',
  'bugReportOpeningEmail',
  'bugReportEmailError',
  'bugReportEmailReadyTitle',
  'bugReportEmailReadyBody',
  'shakePreferenceSaveError',
]) {
  const matches = translations.match(new RegExp(`\\b${key}:`, 'g')) ?? [];
  assert.equal(matches.length, 4, `${key} is present in all four translations`);
}

console.log('Shake/manual bug-report access, persisted sensor toggle, shared form, and 4-language checks passed.');
