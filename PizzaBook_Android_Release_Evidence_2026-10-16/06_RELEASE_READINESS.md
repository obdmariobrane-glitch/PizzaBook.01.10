# Android release readiness

## Confirmed

| Check | Result | Evidence |
|---|---|---|
| Android application ID | `com.pizzabook.app` | `frontend/app.json:21`; resolved Expo config. |
| User-visible version | `1.0.4` | `frontend/app.json:6`. |
| Local configured versionCode | `5` | `frontend/app.json:16`. |
| Built versionCode | `6` | EAS output from 2026-10-16 states no remote versions existed and increments local 5 to 6. |
| EAS project | Existing `@mrbranees-team/pizzabook` project | Prior authorized EAS `project:info` output; project identifier omitted from this sanitized export. |
| Production artifact type | AAB (`app-bundle`) | `frontend/eas.json` production profile. |
| Signing source | Existing remote Android credentials; EAS reported `PizzaBook-Android-Production (default)` | Prior successful build output; no key material exported. |
| Build artifact | Successful EAS Android AAB, versionCode 6 | [EAS build page](https://expo.dev/accounts/mrbranees-team/projects/pizzabook/builds/a3950e7c-c0dd-48fa-a6e2-c79d156c707c); [AAB download](https://expo.dev/artifacts/eas/OyN2QmHycsZjQgT_LXEisjoWi29ouecV4T_gzbvBw1g.aab). |
| TypeScript | Passed in prior session (`tsc --noEmit`) | Result recorded in the preceding release-build session; not rerun per this read-only/no-repeat request. |
| Expo Doctor | 20/20 passed in prior session | Result recorded in the preceding release-build session; not rerun. |
| Billing mock tests | Passed in prior session | Existing `frontend/scripts/verify-pro-billing.js`; result recorded in preceding session. Not a live store test. |
| Emergent backend URL | Not present in prior exported Android JS bundle | Previous release-build session exported JS with backend env blank and confirmed the hostname absent. Current source gate is offline mode. This is not a substitute for binary/network inspection. |
| Worktree scope | Existing dirty changes pre-date this export; only new evidence directory and ZIP are created by this task. | No source edits/builds/tests performed for this export. |

## Not verified from this checkout

* Final AAB manifest and actual target SDK (dependency default is 36; see `05_ANDROID_PERMISSIONS.md`).
* Play Console product activation, €6.99 base price and regional pricing, tester/license accounts, Play Data Safety entries, store listing and privacy-policy URL.
* Real-device/Play-installed purchase, pending/cancel, restore, uninstall/reinstall, offline launch and refund/revocation.
* Whether current internal testing configuration exactly matches the user-reported Play track.

## Assessment

The source has a production AAB profile and a prior successful AAB. Billing code and permission merge inputs are present. The app is **not evidenced as ready for public release** until privacy/Data Safety declarations and notice are reconciled with runtime behavior, final AAB target/permissions are verified, and live Play Billing plus deletion/retention obligations are tested.
