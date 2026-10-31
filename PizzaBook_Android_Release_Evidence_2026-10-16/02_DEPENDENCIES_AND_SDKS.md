# Dependencies and SDKs

## Confirmed project configuration

| Item | Value | Evidence / status |
|---|---|---|
| Expo SDK | 57.0.0 (resolved); `expo` `~57.0.30` | `frontend/app.json`; `frontend/package.json`; Expo introspection performed in the previous release-build session |
| React Native | 0.86.3 | `frontend/package.json`; `frontend/yarn.lock` |
| React | 19.2.3 | `frontend/package.json`; `frontend/yarn.lock` |
| EAS CLI requirement | `>=24.3.0` | `frontend/eas.json` |
| Package manager | Yarn 1.22.22 | `frontend/package.json` (integrity suffix omitted in evidence copy) |
| Billing | `expo-iap` 6.0.2 | dependency manifest and lockfile |
| Persistence | AsyncStorage 2.2.0; SecureStore `~57.0.4` | direct dependencies; native storage implementation |
| Notifications | `expo-notifications` `~57.0.23` | dependency and app plugin |
| Image selection | `expo-image-picker` `~57.0.20` | dependency; community-gated upload screen |

The sanitized direct dependency inventory and relevant Expo config are in `01_PROJECT_CONFIGURATION/`.

## Privacy/tracking package review

**Confirmed from direct dependencies/source scan:** no RevenueCat, Sentry, Firebase Analytics/Crashlytics, Mixpanel, Amplitude, or PostHog package/configuration was found in `frontend/package.json` or app source. The code review found no explicit analytics or remote crash-reporting calls. This is not a claim that the OS, Google Play, or every transitive SDK performs no telemetry; installed libraries are not presumed to collect data absent evidence.

`expo-device` and `expo-application` are present in the installed dependency tree, but no app source call reading device identifiers was found. Push-token code exists, but the production runtime gate prevents its registration flow while offline-only mode is true (see `04_DATA_SAFETY_GDPR.md`).

## SDK target and certainty

React Native's Android manifest declares target SDK 36 (`frontend/node_modules/react-native/ReactAndroid/src/main/AndroidManifest.xml:10-12`). Expo config introspection did not expose `android.targetSdkVersion`, and this repository has no generated native Android project. Therefore target 36 is the current native dependency default, **not a verified value extracted from the successful AAB**. Confirm the final merged manifest/AAB metadata before publication.

## Lockfile status

`frontend/yarn.lock` has matching direct selectors for core items, including `expo-iap@6.0.2`, Expo SDK packages, React Native 0.86.3 and React 19.2.3. No dependency installation or lockfile modification was performed for this export.
