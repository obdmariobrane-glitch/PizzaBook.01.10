# Evidence index

Evidence export date: 2026-10-16. Mode: read-only source review and reuse of outputs recorded in the preceding session.

## Contents

* `01_PROJECT_CONFIGURATION/app-config.sanitized.json` — relevant sanitized Expo config extract; omits project ID and unrelated identifiers.
* `01_PROJECT_CONFIGURATION/eas.json` — EAS build profiles; contains no credentials.
* `01_PROJECT_CONFIGURATION/package-direct-dependencies.sanitized.json` — direct dependency inventory from package manifest/lockfile; omits package-manager integrity suffix.
* `01_PROJECT_CONFIGURATION/android-permission-source-manifests.txt` — focused excerpts from dependency manifests and resolved config, not a final merged AAB manifest.
* `02_DEPENDENCIES_AND_SDKS.md` — SDKs and direct analytics/crash-package review.
* `03_BILLING_IMPLEMENTATION.md` — status matrix and limits of mock evidence.
* `04_DATA_SAFETY_GDPR.md` — source-based data flow, local storage, recipients, policy comparison and proposed unconfirmed Data Safety answers.
* `05_ANDROID_PERMISSIONS.md` — Android permission sources and target-SDK verification limit.
* `06_RELEASE_READINESS.md` — release identity, recorded build/test evidence and unverified items.
* `07_OPEN_BLOCKERS.md` — remaining manual actions.

## Source paths reviewed

* `frontend/package.json`, `frontend/yarn.lock`
* `frontend/app.json`, `frontend/eas.json`
* `frontend/src/offlineMode.ts`, `frontend/src/communityFeature.ts`
* `frontend/src/auth.tsx`, `frontend/src/utils/storage/index.ts`, `frontend/src/proEntitlement.ts`, `frontend/src/proBillingCore.ts`, `frontend/src/components/ProBillingProvider.tsx`
* `frontend/src/notifications.ts`, `frontend/app/_layout.tsx`
* `frontend/app/login.tsx`, `frontend/app/account-deletion.tsx`, `frontend/app/new-post.tsx`, `frontend/app/(tabs)/profile.tsx`
* `frontend/src/costCalculator.ts`, `frontend/src/costCalculatorStorage.ts`, `frontend/src/i18n/translations.ts`
* Installed dependency manifests under `frontend/node_modules/expo-iap`, `expo-notifications`, `expo-image-picker` and React Native.

## Prior evidence reused (not repeated)

* EAS production build completed on 2026-10-16: versionCode incremented from 5 to 6; remote Android credentials `PizzaBook-Android-Production (default)` were used. No new build was run for this export.
* TypeScript `tsc --noEmit` passed; Expo Doctor passed 20/20; `yarn check:pro-billing` reported mock checks passed. These are prior-session records, not re-executed here.
* Android JS bundle built in a prior check with Hermes bytecode disabled; the Emergent backend hostname was absent. Hermes bytecode compiler failed locally in that prior check; EAS cloud build itself succeeded.

## Sanitization and scope

No `.env`, credentials, tokens, signing material, service-account files, or raw project identifier were copied. The EAS build and AAB links are public artifact references supplied by the prior build output; accessing/downloading them is left to the owner. No source, Beginner, PRO, configuration, dependency, Play Console, or backend file was changed by this evidence-export task. The only intended new filesystem outputs are this evidence directory and its ZIP archive.

Paths in this index are repository-relative. Line numbers in individual reports refer to the reviewed source paths where available.
