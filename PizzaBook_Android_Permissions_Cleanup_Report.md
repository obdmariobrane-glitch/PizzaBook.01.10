# PizzaBook Android permissions cleanup report

**Date:** 2026-10-16  
**Scope:** Targeted Android permission configuration only. No build, upload, publish, deployment, dependency installation, or version change was performed.

## Summary

`frontend/app.json` now uses Expo's `android.blockedPermissions` to exclude eight permissions that are not needed by currently active app behavior:

* `RECORD_AUDIO`
* `CAMERA`
* `ACTIVITY_RECOGNITION`
* `USE_BIOMETRIC`
* `USE_FINGERPRINT`
* `SYSTEM_ALERT_WINDOW`
* `READ_EXTERNAL_STORAGE`
* `WRITE_EXTERNAL_STORAGE`

This is an Expo config change, not a generated Android manifest edit. The project does not contain a checked-in generated `frontend/android/` project. Neither the existing AAB's manifest nor removal in a new AAB was verified: the existing artifact was 150 MB and no `bundletool`, `aapt`, `aapt2` or `apkanalyzer` binary is installed. Config introspection is only prebuild evidence.

## Original requested permissions: source and feature assessment

| Permission | Source found | Active functionality assessment | Decision |
|---|---|---|---|
| `android.permission.RECORD_AUDIO` | `frontend/node_modules/expo-image-picker/plugin/src/withImagePicker.ts:67,131` may add it for image-picker video support. No app source requests microphone permission or records audio. | Only matching media selection/upload code is in `frontend/app/new-post.tsx:37-62`; that screen redirects because `COMMUNITY_ENABLED` is false (`:297`). No other voice/audio capture flow found. | **Blocked.** |
| `android.permission.CAMERA` | `frontend/node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:4`; image-picker plugin can also declare it (`plugin/src/withImagePicker.ts:75,139`). | App source uses gallery selection, not camera capture; the entire post screen is Community-disabled. | **Blocked.** |
| `android.permission.ACTIVITY_RECOGNITION` | `frontend/node_modules/expo-sensors/android/src/main/AndroidManifest.xml:2`. | No app import/use of `expo-sensors` APIs was found; local recipe storage, notifications and billing do not require activity recognition. | **Blocked.** |
| `android.permission.USE_BIOMETRIC` | No current declaration found in the inspected project/dependency Android manifests. No biometric-auth package/use found. | Authentication is offline-only and no biometric flow exists. | **Blocked defensively** so a merged dependency declaration does not silently add it. |
| `android.permission.USE_FINGERPRINT` | No current declaration found in the inspected project/dependency Android manifests. No fingerprint-auth package/use found. | No fingerprint authentication flow exists. | **Blocked defensively.** |
| `android.permission.SYSTEM_ALERT_WINDOW` | Expo config-plugin base manifest (`frontend/node_modules/@expo/config-plugins/build/plugins/withAndroidBaseMods.js:60-66`) contains it; React Native also has it in its debug manifest (`frontend/node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml:8`). | Production app has no “draw over other apps” feature. This permission is not required for local notifications, storage or Play Billing. | **Blocked.** |
| `android.permission.READ_EXTERNAL_STORAGE` | Expo base manifest (`withAndroidBaseMods.js:65`); Expo FileSystem manifest and plugin (`frontend/node_modules/expo-file-system/android/src/main/AndroidManifest.xml:3-4`, `plugin/src/withFileSystem.ts:26-27`); ImagePicker manifest (`frontend/node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:8`). Some declarations are capped at API 32. | App-owned recipe/settings data uses AsyncStorage/SecureStore (`frontend/src/utils/storage/index.ts:26-97`). The only media picker use is Community-disabled (`frontend/app/new-post.tsx:37-62,297`). No active external/shared-storage file picker flow found. | **Blocked.** Verify older Android/API 24-32 behavior if Community/gallery upload is re-enabled. |
| `android.permission.WRITE_EXTERNAL_STORAGE` | Expo base manifest (`withAndroidBaseMods.js:66`); Expo FileSystem (`android/src/main/AndroidManifest.xml:3-4`, plugin `withFileSystem.ts:26-27`); ImagePicker manifest (`android/src/main/AndroidManifest.xml:7`). Some declarations are capped at API 32. | Active local data is app-private AsyncStorage/SecureStore. No active public/shared external-storage writing feature found. Community media upload path is disabled. | **Blocked.** Revisit if shared external file export/download is added. |

### Relevant source feature gates

* `frontend/src/offlineMode.ts:1`: `OFFLINE_ONLY_MODE = true`; login/account flows and backend push registration are gated off.
* `frontend/src/communityFeature.ts:1`: `COMMUNITY_ENABLED = false`.
* `frontend/app/new-post.tsx:37-62,297`: media picker/upload implementation exists, but route redirects while Community is disabled.
* `frontend/src/notifications.ts:120-160`: runtime notification permission and local notification scheduling remain implemented.
* `frontend/src/components/ProBillingProvider.tsx:140-160,181-223`: Play product initialization, purchase and restore remain implemented.
* `frontend/src/utils/storage/index.ts:26-97`: app-private AsyncStorage/SecureStore methods remain unchanged.

## Removed vs retained

**Configured for removal (8):** all requested permissions listed above. Biometric permissions were not found in current manifest inputs; they are listed defensively in `blockedPermissions`.

**Retained / not blocked:**

* `com.android.vending.BILLING` — required by `expo-iap`; its manifest declares it at `frontend/node_modules/expo-iap/android/src/main/AndroidManifest.xml:2`.
* `android.permission.INTERNET` — required for Google Play Billing and ordinary network operations; Expo base config declares it at `frontend/node_modules/@expo/config-plugins/build/plugins/withAndroidBaseMods.js:60`.
* `android.permission.POST_NOTIFICATIONS` — retained for user-authorized local notifications (`frontend/node_modules/expo-notifications/android/src/main/AndroidManifest.xml:3`).
* `android.permission.RECEIVE_BOOT_COMPLETED` — retained so scheduled notifications can be restored following reboot (`expo-notifications/android/src/main/AndroidManifest.xml:2`).
* `android.permission.VIBRATE` — not part of the requested removal set; Expo Haptics declares it (`frontend/node_modules/expo-haptics/android/src/main/AndroidManifest.xml:2`). No change made.

Permission list above describes configuration inputs/intent. The merged manifest must be checked in the next AAB before claiming a permission is absent from the release binary.

## Files changed

1. `frontend/app.json` — added `android.blockedPermissions`; package, version, versionCode, plugins and other config preserved.
2. `PizzaBook_Android_Permissions_Cleanup_Report.md` — this evidence/report file.

No billing code, Beginner/PRO code, recipes, translations, calculations, timers, schedules, UI, dependency manifests, lockfiles, EAS profiles or existing dirty edits were modified.

## Verification

Commands executed after the config edit:

* `expo config --type introspect --json` — **PASS**; config resolves, package remains `com.pizzabook.app`, local configured versionCode remains `5`, and all eight names resolve in `android.blockedPermissions`. `android.permissions` reports explicit app-level `INTERNET`; this output is not the merged native manifest and does not prove final AAB removal.
* `expo config --json` — **PASS**; public Expo config is parseable. The Expo CLI does not support a `--platform` option for this command.
* `tsc --noEmit` — **PASS**.
* `yarn check:pro-billing` — **PASS**; existing focused mock test. Billing implementation files were not modified.
* `git diff --check` — **PASS** for the intended config edit.
* Final diff/status review — **PASS**; only `frontend/app.json` changed among source/config files; the report is newly created.

No exhaustive recipe regression tests were run. No AAB build/manifest inspection was performed because this task explicitly prohibits a new build; therefore the final signed artifact has not been verified with these permission blocks.

## Remaining risks and follow-up

* A new AAB is required for these permission settings to affect a release. Do not distribute the already-built versionCode 6 artifact as evidence of this cleanup.
* On Android API 24–32, future re-enabling of the Community gallery flow may require the legacy media permission behavior exposed by ImagePicker. Validate that feature separately before changing gates or re-allowing permissions.
* Expo FileSystem/ImagePicker may merge permission declarations from dependencies. Inspect the final AAB manifest and confirm the exact resulting permission list after the next approved build.
* Keep Billing, local notifications, INTERNET, AsyncStorage and SecureStore behavior verified on a Play-installed test build. No direct changes were made to those components.
* `SYSTEM_ALERT_WINDOW`/`ACTIVITY_RECOGNITION` and biometric permissions were blocked defensively. If a later dependency or product feature genuinely requires any of these, explicitly revisit the block list.

## Preservation confirmation

Beginner files and behavior, PRO recipe logic/content, and Billing implementation are unchanged by this task. Existing dirty worktree modifications were inspected before editing and preserved. No versionCode change, dependency install, commit, push, EAS build, Play upload, or deployment occurred.
