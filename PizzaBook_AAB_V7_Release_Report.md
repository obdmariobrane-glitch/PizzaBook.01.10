# PizzaBook Android AAB V7 Release Report

Date: 2026-10-16

## Outcome

**NO-GO for the production AAB build.** Planner cleanup and source/test validation are complete, but the current Expo CLI identity is not authorized to read the existing EAS project. The remote Android versionCode therefore could not be confirmed. No build was started and no signing credentials were changed.

## Planner changes

- Removed the visible pizza-style and dough-method sections from the Planner. The screen now takes those choices from the current Calculator settings.
- The in-memory Calculator settings take precedence, so recipe changes made while navigating between Calculator and Planner are reflected without a local Planner override.
- When the app is reopened, Planner restores the saved Calculator style and method from `calculatorSettings`. It displays no generated PRO plan, plan key, or delete-plan action if it cannot validate a saved/current recipe; it does not surface the old hard-coded direct/Neapolitan fallback as a plan.
- Beginner continues to use its existing direct-method and saved home-schedule path; no Beginner recipe, calculation, timer, or fermentation code was changed for this task.
- The removed controls used existing localized text, so no new translation strings were required. Verification covered HR, DE, EN, and SL.

## Verification

Passed:

- `npx tsc --noEmit`
- `npx expo config --type public --json`: package `com.pizzabook.app`, Expo project ID `497fc00a-4814-4a1f-abd5-fd111c073d43`, nine blocked Android permissions, and local config versionCode `5`.
- `verify-home-pizza-plan.js`: Planner selector removal, Calculator settings source, saved-setting restoration, safe no-recipe gating, schedule chronology, and localized planner date behavior.
- `verify-mixing-workflow.mjs`
- Beginner phase sequence, Phase A, B3.3, recipe gate, Phase B, final fixes, direct schedule, Direct V1, and plan persistence checks.
- PRO Biga remaining flour (720 combinations), Biga zero-fridge, Poolish phase sequence (1,728 combinations), Poolish Planner (384 cases), Planner schedule preservation, Biga/Planner parity, preheating, oven temperature, and plan deletion checks.
- PRO spiral mixing (3,456 configurations across HR/EN/DE/SL), home-mixer/spiral parity (48 cases), home-mixer instructions (384 configurations), and ice instruction/boundary checks.
- Free-launch, offline, offline-auth UI, Community-disabled, and Billing mock checks.
- `git diff --check`.

Existing source-shape assertions were updated without removing their behavioral expectations. The Beginner B3.3 and PRO Planner deletion assertions were also aligned with their current call signatures/recipe-availability guard.

## EAS project and version

- `npx eas-cli whoami` returned `emergent-em-user-6d71ca1f-1f6a-427e-bd28-7ad48c4b53cf`.
- `npx eas-cli project:info` failed with `Entity Not Authorized` for project ID `497fc00a-4814-4a1f-abd5-fd111c073d43`; this account lacks permission to read the project.
- The chained `build:version:get` command was not reached. Current remote versionCode is **unverified**.
- `eas.json` production uses remote app-version sourcing and `autoIncrement: true`; the resolved local `app.json` versionCode is `5`. The local value is not evidence of the next remote build number.
- Do not build until an authorized project owner/session confirms project access and the current remote versionCode. No automatic retry or second build was attempted.

## EAS archive inspection

`eas build:inspect --platform android --profile production --stage archive` completed locally. The resulting snapshot contained 184 files (95 MB); required Planner source and `yarn.lock` were present. Filename checks found no `.env`, credential/token JSON, signing-key/certificate files, ZIPs, or AABs. Verification scripts, evidence directories, and preview/build-output folders were excluded. This was a local archive inspection, not a build or upload.

The existing dirty worktree and `.easignore` were preserved. No pre-existing changes were reset or cleaned.

## Artifact and remaining blockers

- Build ID: not applicable; no build was started.
- AAB location/link: none.
- Actual AAB package/versionCode/target SDK/merged-manifest verification: not performed; requires a successful authorized build.
- Primary blocker: EAS project authorization and remote versionCode verification.
- No signing credentials were changed. No commit, push, submission, or Google Play publication occurred.

## Files changed for this task

- `frontend/app/(tabs)/planner.tsx`
- `frontend/scripts/verify-home-pizza-plan.js`
- `frontend/scripts/verify-mixing-workflow.mjs`
- `frontend/scripts/verify-beginner-b3-3.js`
- `frontend/scripts/verify-pro-planner-delete-plan.js`
- `PizzaBook_AAB_V7_Release_Report.md`
