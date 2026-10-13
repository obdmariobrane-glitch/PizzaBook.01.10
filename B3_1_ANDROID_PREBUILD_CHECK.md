# B3-1 Android splash prebuild check

## Root cause confirmed

Before the follow-up change, local Android prebuild omitted
`android/app/src/main/res/drawable/splashscreen_logo.xml` when no Android splash
image was configured. However, generated `values/styles.xml` still referenced
`@drawable/splashscreen_logo` in `windowSplashScreenAnimatedIcon`. That left an
unresolved Android resource and can fail the Gradle resource/link phase.

## Fix

Added `frontend/plugins/withTransparentAndroidSplashDrawable.js`, registered
before `expo-splash-screen`. The config plugin generates
`res/drawable/splashscreen_logo.xml` after the Expo splash plugin's cleanup. It
is a valid 1dp transparent vector drawable, so no pizza artwork appears. The
native splash retains `#F7C894` as its solid background.

The one-time native startup permission request remains in place, token
registration does not request permission, no recipe notifications are
automatically scheduled, and guided reminder synchronization is unchanged.

## Local prebuild evidence

Ran `npx expo prebuild --clean --platform android --no-install` locally (no EAS
build). Generated resources confirmed:

- `res/values/styles.xml` references `@drawable/splashscreen_logo`.
- `res/drawable/splashscreen_logo.xml` exists and contains a transparent
  `#00000000` vector path.
- `res/values/colors.xml` defines `splashscreen_background` as `#F7C894`.
- No density-specific splash PNG was generated.
- The style reference resolves to the generated drawable XML.

The prebuild-generated `frontend/android/` directory was temporary and was
removed after inspection. It was absent before this local check. Package-script
edits made by the prebuild command were restored; existing unrelated manifest
changes were retained.

## Validation

Passed `yarn check:beginner-notifications`, `yarn tsc --noEmit`,
`node --check plugins/withTransparentAndroidSplashDrawable.js`, XML parsing for
the generated drawable/styles/colors files, resolved Expo splash config
validation, and `git diff --check`.

No EAS build was started or retried. APK work remains deferred as requested.
