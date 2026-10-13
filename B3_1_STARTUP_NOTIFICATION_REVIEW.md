# B3-1 startup and notification permission fix

## Changes

- Removed the Android native splash image while preserving its solid `#F7C894`
  background. iOS splash configuration is unchanged.
- Added a native-only, one-time startup notification permission request. It runs
  after the animated splash and saved settings have loaded.
- Existing installs that have not seen the system prompt are asked when
  permission remains undetermined and the OS allows a prompt. The attempt marker
  is persisted before showing the OS dialog; later launches do not ask again,
  including after a denial.
- Device-token registration now checks existing permission instead of requesting
  it. Startup permission flow does not schedule recipe notifications.
- Preserved explicit Planner/Beginner reminder flows and guided-notification
  synchronization.

## Validation

Passed:

- `yarn check:beginner-notifications` (including first request, already granted,
  denied, reopening, OS prompt unavailable, no token-registration prompt, and
  no startup recipe scheduling)
- `yarn check:beginner-plan-persistence`
- `yarn check:home-pizza-plan`
- `yarn check:guided-recipe`
- `yarn check:beginner-direct-schedule`
- `yarn check:roman-workflow`
- `node ./scripts/verify-new-york-workflow.js`
- `yarn tsc --noEmit`
- `git diff --check`
- `npx expo config --type public --json` confirmed Android splash has no image
  and retains the solid background.

## Android preview build

Two EAS preview build attempts failed in the remote Gradle phase with
`EAS_BUILD_UNKNOWN_GRADLE_ERROR`. Neither produced an APK. Build IDs:

- `01d3f65c-0362-45e5-a4db-50bc64d77375` (versionCode 18)
- `289669f2-9501-4281-850e-82de657a0f76` (versionCode 19)

The EAS build logs did not provide readable Gradle diagnostics in this
environment. The APK delivery remains pending a successful Android build.

B3 was not started.
