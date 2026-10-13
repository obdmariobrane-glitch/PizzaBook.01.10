# B3-1 notification race fix results

## Change

Applied `B3-1-notification-race-fix.diff` cleanly to the current B3-1 source.
The change serializes guided-notification synchronization and stale-run cleanup
across component remounts. It updates only:

- `frontend/app/(tabs)/index.tsx`
- `frontend/src/notifications.ts`
- `frontend/scripts/verify-beginner-notifications.js`

## Validation

All checks passed:

- `yarn check:beginner-notifications`
- `yarn check:beginner-plan-persistence`
- `yarn check:home-pizza-plan`
- `yarn check:guided-recipe`
- `yarn check:beginner-direct-schedule`
- `yarn check:roman-workflow`
- `node ./scripts/verify-new-york-workflow.js`
- `yarn tsc --noEmit`
- `git diff --check`

The fresh web export was deployed and returned HTTP 200. The deployed JavaScript
bundle SHA-256 matches the local export:
`f406b19d5d12df151e821ea2a5a048494f8e14314931cc07ce4662dda67d39f4`.

## Preview builds

- Web preview: https://pizzabook--7xjdflvoc7.expo.app
- Android preview build: https://expo.dev/accounts/emergent-em-user-6d71ca1f-1f6a-427e-bd28-7ad48c4b53cf/projects/pizzabook/builds/156b2321-6ee0-40ec-bc1e-02b227499057
- Direct APK: https://expo.dev/artifacts/eas/-8e4ta9ljvxlGYZ0T6k5nnJznBmgtl8r48EA4Q2ZYHw.apk
- Android build ID: `156b2321-6ee0-40ec-bc1e-02b227499057`
- Profile: `preview`; app version `1.0.4` (versionCode `17`)

No physical-device test was performed. B3 was not started.
