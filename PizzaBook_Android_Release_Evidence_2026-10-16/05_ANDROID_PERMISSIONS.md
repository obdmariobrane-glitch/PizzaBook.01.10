# Android permissions evidence

## Resolved configuration

Expo introspection reported:

* `android.permission.RECORD_AUDIO`
* `android.permission.READ_EXTERNAL_STORAGE`
* `android.permission.WRITE_EXTERNAL_STORAGE`
* `android.permission.INTERNET`

Plugin dependency manifests additionally declare:

| Permission | Source | Observed purpose / note |
|---|---|---|
| `com.android.vending.BILLING` | `frontend/node_modules/expo-iap/android/src/main/AndroidManifest.xml:2` | Google Play in-app billing. |
| `android.permission.POST_NOTIFICATIONS` | `frontend/node_modules/expo-notifications/android/src/main/AndroidManifest.xml:3` | Runtime notification permission (Android versions requiring it). |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Same manifest, `:2` | Notification receiver can restore scheduled notifications after reboot. |
| `android.permission.CAMERA` | `frontend/node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:4` | Declared by image picker, though community upload route is currently disabled. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Same manifest, `:7-8` | Both capped at `maxSdkVersion=32` by image-picker manifest; Expo config also reports them. |
| `RECORD_AUDIO` | Resolved Expo config | Source of merged permission was not conclusively attributed in this evidence pass. Verify necessity in merged manifest; do not infer recording behavior from permission alone. |
| `INTERNET` | Resolved Expo config | Network access, including the profile image and Play Billing. |

Notification code requests runtime permission and schedules local notifications (`frontend/src/notifications.ts:120-160`); startup permission flow is in `frontend/app/_layout.tsx:82-96`. Remote push token registration is disabled by `OFFLINE_ONLY_MODE` (`:220-239`).

## Target SDK

`frontend/node_modules/react-native/ReactAndroid/src/main/AndroidManifest.xml:10-12` specifies target SDK 36. Resolved Expo introspection returned `targetSdkVersion: null`, and no generated `frontend/android/AndroidManifest.xml` exists in this checkout. Therefore SDK 36 is a dependency default, **not direct evidence from the built AAB**.

## Verification limit

The previous EAS build completed successfully, but this export did not download/unpack the AAB. The table is a merge-input inventory, not the final manifest. Before release, inspect the AAB's merged manifest (including `BILLING`, `RECORD_AUDIO`, notification and media permissions) and document why each retained permission is needed.
