# PizzaBook Free Launch — Implementation and Verification

**Outcome: free-launch changes implemented and source/config checks passed. No AAB build was started.**

## Final release preflight (2026-10-16)

**Release status: BLOCKED — no build started.**

- The latest `npx --yes eas-cli whoami` returned an environment identity that does not have access to the configured project. `npx --yes eas-cli project:info` failed with `Entity Not Authorized`. The remote version query therefore did not run during this final preflight. Although a prior authorized check had read remote Android `versionCode` 6 and production `autoIncrement: true`, current authorization and next-version 7 are not confirmed.
- The current worktree still contains many pre-existing dirty changes, including changes in Beginner/PRO calculation, planner, saved recipes, guide content, and translation sources. These have not been approved as free-release inputs and must not be packaged without review.
- There is no `frontend/.easignore`. The `frontend/.gitignore` does not exclude `.env` or the generated evidence/build-output directories. The repository-level ignore rule is not a substitute for the ignore file used from the Expo project root. No `.env` contents were inspected or included in this report; it cannot be confirmed that secrets or an unintended backend URL will be excluded from an EAS upload.
- `frontend/dist-b2/`, `frontend/dist-f25-preview/`, `frontend/ui_evidence/` and other untracked artifacts are still present within the project tree and are not excluded by the project-level EAS ignore configuration.

These are blocking issues under the requested release safeguards. Do not build until the correct authorized EAS session is restored, remote version 6 is rechecked, protected dirty source inputs are explicitly reviewed/approved, and the EAS upload context is safely constrained to exclude `.env` and unrelated artifacts. No signing credentials were inspected or modified.

## Changes in this task

- Added `frontend/src/freeLaunch.ts` with an explicit free-launch flag.
- Added `hasProAccess()` while retaining `hasProEntitlement()` as the actual saved Google Play purchase state. Free access does not forge, overwrite, or delete historical entitlement data.
- Updated experience-level selection so PRO can be selected without payment. Existing saved Beginner selection and Beginner behavior remain intact.
- Changed onboarding's PRO choice to select PRO directly instead of opening the purchase screen. The settings PRO choice also no longer opens a paywall.
- Replaced the legacy `/pro-unlock` route UI with an immediate redirect into the app. No purchase controls or price are rendered.
- Added a free-launch branch in `ProBillingProvider` that does not mount the Android IAP component and therefore does not call `useIAP`, connect to the store, initialize purchase queries, or expose a purchase action.
- Added `com.android.vending.BILLING` to Expo Android `blockedPermissions`.
- Added `check:free-launch` and focused verification for free access and the supported PRO option matrix. Updated the existing Billing mock check for the new launch entitlement semantics.

The `expo-iap` package, plugin, purchase-processing code, existing `pizzabookProLifetimeEntitlement` key, and billing translations remain in the source for a potential future monetization migration. In this launch configuration they are not used to initialize or present a purchase flow. Billing wording is dormant and not rendered in the launch UI; no user-facing translation string was changed.

## Access behavior

- Beginner remains selectable without purchase, with its existing simplified options and frozen Beginner flow unchanged.
- PRO can be selected from onboarding or Settings without purchase.
- In PRO mode, all currently supported pizza styles and non-gluten-free flour options remain available. Direct, Biga and Poolish remain available wherever the existing method/flour validation permits them.
- Gluten-free flour or a fully gluten-free custom blend continues to allow Direct only. This is an existing recipe/method validity rule and was not changed.
- The current release's full advanced selection is available through PRO mode; Beginner's existing reduced workflow was deliberately not expanded or redesigned.
- Offline core behavior and Community/login gates were not changed.

## Verification

| Check | Result |
|---|---|
| TypeScript | PASS — `./node_modules/.bin/tsc --noEmit` |
| Free-launch access, historical entitlement preservation, styles/flours/method matrix, paywall bypass, Billing gate | PASS — `node ./scripts/verify-free-launch.js` |
| Existing purchase/restore/cancel/retry/duplicate/offline Billing mock behavior | PASS — `node ./scripts/verify-pro-billing.js` |
| Pro styles, flours, methods and saved-recipe access | PASS — `node ./scripts/verify-pro-options.js` |
| Community remains disabled | PASS — `node ./scripts/verify-community-disabled.js` |
| Offline-only behavior and unreleased auth UI | PASS — `node ./scripts/verify-offline-phase1.js` and `node ./scripts/verify-offline-auth-ui.js` |
| Frozen Beginner phase sequence | PASS — `node ./scripts/verify-beginner-phase-sequence.js` |
| Beginner recipe gate | PASS — `node ./scripts/verify-beginner-recipe-gate.js` |
| Beginner Direct schedule | PASS — `node ./scripts/verify-beginner-direct-schedule.js` |
| Beginner plan persistence | PASS — `node ./scripts/verify-beginner-plan-persistence.js` |
| PRO Biga remaining flour | PASS — `node ./scripts/verify-pro-biga-remaining-flour.js` (720 generated combinations across HR/EN/DE/SL) |
| PRO Poolish phase sequence | PASS — `node ./scripts/verify-pro-poolish-phase-sequence.js` (1,728 generated combinations across HR/EN/DE/SL) |
| Biga calculator/planner parity | PASS — `node ./scripts/verify-pro-f30-biga-planner-parity.js` |
| Expo resolved configuration | PASS — `npx expo config --type public --json`; package is `com.pizzabook.app`, project ID remains `497fc00a-4814-4a1f-abd5-fd111c073d43`, and all nine configured blocked permissions are present |
| Whitespace/conflict-marker check | PASS — `git diff --check` |

The Expo config reports all nine blocked permissions: the eight previously requested permissions and `com.android.vending.BILLING`. This confirms the config, not the merged manifest of an AAB.

No physical-device or Play Store test was performed. Source checks establish that the free branch skips the IAP provider; they do not replace a native binary inspection or manual offline device testing.

## Files touched by this task

- `frontend/app.json` — added the Play Billing permission to the existing blocked-permission list.
- `frontend/app/onboarding.tsx` — removed paywall routing for the PRO choice.
- `frontend/app/settings.tsx` — removed the entitlement/paywall gate for selecting PRO.
- `frontend/app/pro-unlock.tsx` — now redirects rather than rendering a paywall.
- `frontend/package.json` — added the `check:free-launch` script only; no dependency was installed or changed by this task.
- `frontend/scripts/verify-free-launch.js` — added focused free-launch checks.
- `frontend/scripts/verify-pro-billing.js` — adjusted mock expectations for the launch access policy while retaining purchase lifecycle checks.
- `frontend/src/freeLaunch.ts` — added the free-launch flag.
- `frontend/src/proEntitlement.ts` — separated free PRO access from actual stored purchase entitlement.
- `frontend/src/experienceLevel.ts` — uses effective PRO access for mode selection.
- `frontend/src/components/ProBillingProvider.tsx` — bypasses the IAP provider in free-launch mode.

Several of these files were already dirty or untracked before this task. All unrelated pre-existing modifications were preserved. No Beginner/PRO recipe calculation, timer, planner, fermentation, translation, Android signing credential, Expo project ID, or dependency-lockfile file was changed by this task.

## Limitations and remaining release blockers

1. No AAB was built, per instruction. Consequently there is no AAB location or final merged-manifest result.
2. Absence of `com.android.vending.BILLING` from the built binary is **not yet verified**. The permission is blocked in Expo configuration; verify it by inspecting the next generated AAB before release.
3. Physical-device validation of offline recipe use, navigation, and lack of store initialization remains outstanding.
4. The worktree already contained pre-existing dirty edits to recipe-sensitive files, including `frontend/app/(tabs)/index.tsx`, `frontend/app/(tabs)/planner.tsx`, `frontend/src/calculator.ts`, PRO saved-recipe/manual files, and translation files. This task did not edit those files, and the focused regression checks passed against the current worktree. Their existing changes were not reverted or re-reviewed as part of this task, so no claim is made that their contents match the repository's checked-in baseline.
5. Prior release verification found no `frontend/.easignore` and an ignored `frontend/.env` containing `EXPO_PUBLIC_BACKEND_URL`. Its contents were not inspected. The EAS upload-context risk remains unresolved; do not start a release build until `.env` and unrelated generated artifacts are safely excluded from the build context.

No commit, push, deploy, Play submission, or build was performed.
