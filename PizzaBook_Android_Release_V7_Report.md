# PizzaBook Android Production AAB V7 — Release Verification

**Verification outcome: BLOCKED — no build was started.**

This report records the checks performed before a possible production AAB build. The existing dirty worktree contains changes in protected feature areas and substantial unignored artifacts inside the Expo project directory. Building from it would package unreviewed changes and upload unrelated files. No pre-existing changes were cleaned, reverted, or overwritten.

## Release identity and remote version

| Check | Result | Evidence |
|---|---|---|
| EAS account | PASS — `mrbranee` | `npx --yes eas-cli whoami` |
| EAS project access | PASS — Owner access to `mrbranees-team/pizzabook` | `npx --yes eas-cli project:info`; project ID `497fc00a-4814-4a1f-abd5-fd111c073d43` |
| Android package | PASS — `com.pizzabook.app` | Resolved Expo config from `frontend/app.json` |
| App version name | PASS — `1.0.4` | Resolved Expo config |
| EAS version source | PASS — remote | `frontend/eas.json`: `cli.appVersionSource` |
| Production increment | PASS — `autoIncrement: true` | `frontend/eas.json`: production profile |
| Android artifact type | PASS — `app-bundle` | `frontend/eas.json`: production Android profile |
| Current remote Android versionCode | PASS — `6` | `npx --yes eas-cli build:version:get --platform android --profile production --json` |
| Next build versionCode | Expected to increment to `7`; **not built or verified** | Remote version `6` plus production `autoIncrement: true`; app-config `android.versionCode: 5` is not authoritative with remote versioning |

The EAS version query reported that no production environment variables with Plain text or Sensitive visibility were found. No credential values were inspected or copied into this report.

## Configuration and focused checks

| Check | Result | Evidence |
|---|---|---|
| Expo config validation | PASS | `npx expo config --type public --json`, with assertions for slug, owner, project ID, package and blocked permissions |
| Eight blocked permissions | PASS in resolved Expo config | `frontend/app.json` contains all requested entries: `RECORD_AUDIO`, `CAMERA`, `ACTIVITY_RECOGNITION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` |
| TypeScript | PASS | `./node_modules/.bin/tsc --noEmit` |
| Community-disabled checks | PASS | `node ./scripts/verify-community-disabled.js` |
| Billing mock checks | PASS | `node ./scripts/verify-pro-billing.js`; purchase, cancellation classification, retry, duplicate event, restore and offline gate |
| Config whitespace check | PASS | `git diff --check -- frontend/app.json frontend/eas.json frontend/package.json frontend/yarn.lock` |

These checks validate source/config behavior only. They do not verify the merged manifest of a generated AAB or a live Google Play purchase.

## Dirty worktree review and build-input blockers

At verification time, the repository contained **39 tracked modified paths and 104 untracked paths**. The tracked diff summary was **3,747 insertions and 781 deletions across 39 files**. Changes predate this verification; this task did not edit or clean them.

The dirty set includes protected or release-sensitive areas, including:

- `frontend/app/(tabs)/index.tsx` and `frontend/app/(tabs)/planner.tsx`
- `frontend/src/calculator.ts` and `frontend/src/experienceLevel.ts`
- `frontend/src/i18n/prefermentSteps.ts`, `spiralMixing.ts`, `styleSteps.ts`, and `translations.ts`
- `frontend/src/proLearn/manuals.ts` and `frontend/src/proSavedRecipes.ts`
- Untracked `frontend/src/components/ProBillingProvider.tsx` and additional `frontend/src/i18n/` and `frontend/src/proLearn/` source files

Consequently, building this working tree could incorporate unreviewed changes to Beginner/PRO behavior, translations and Billing-related implementation, contrary to the requested protected scope. No claim is made that those existing edits were created by this task.

An independent read-only review also found that the dirty `frontend/app.json` diff changes the Android package and EAS project identity relative to the checked-in baseline. The resolved values match the project/package confirmed for this task, but the identity diff itself must be explicitly confirmed as intended before building because it changes which Android listing/project the artifact targets. No identity was changed by this verification.

The Expo project has no `.easignore`. Its `frontend/.gitignore` does not exclude the following untracked directories, and `git check-ignore` found no ignore rule for representative files:

| Untracked directory | Approximate size |
|---|---:|
| `frontend/dist-b2/` | 77 MB |
| `frontend/dist-f25-preview/` | 78 MB |
| `frontend/ui_evidence/` | 28 MB |

These add approximately **183 MB** of unrelated build outputs/evidence to the project tree. Other untracked review/export files are present as well. Without an explicit, safely reviewed EAS upload exclusion policy, the build input is not sufficiently controlled.

The same review found an ignored `frontend/.env` file defining `EXPO_PUBLIC_BACKEND_URL`, referenced by `frontend/src/auth.tsx` and `frontend/app/new-post.tsx`. Its contents were not inspected or disclosed. The repository-level Git ignore rule is not an EAS upload exclusion rule, and the frontend `.gitignore` does not exclude `.env`; with no `.easignore`, inclusion in the build upload/context cannot be ruled out. This is an additional data-exposure and production-configuration blocker. Do not print, copy, or include the `.env` contents in reports.

## Build and artifact verification

- EAS production build: **NOT STARTED**
- Build ID / build URL: **Not available**
- AAB artifact location: **Not available**
- Actual package/versionCode/target SDK inspection: **NOT PERFORMED**
- Merged-manifest inspection: **NOT PERFORMED**
- Eight blocked permissions absent from the binary: **UNVERIFIED**
- Billing and notification permissions present in the binary: **UNVERIFIED**
- Existing production signing credentials: **NOT INSPECTED OR MODIFIED**
- Google Play submission/upload: **NOT PERFORMED**

## Required next action

Do not start a production build from this working tree as-is. First have the existing dirty source changes in protected areas reviewed and explicitly approved for inclusion; confirm the package/project identity diff is intended; and establish a narrowly scoped EAS ignore policy that excludes `.env`, generated previews/evidence and unrelated review artifacts without excluding app inputs. Preserve the current worktree; do not discard or reset these changes. After those decisions, re-run the release-input checks and verify existing signing credentials before starting exactly one build.
