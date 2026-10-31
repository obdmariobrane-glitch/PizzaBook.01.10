# PizzaBook Release Preflight

**Result: NOT READY for a production AAB build. No build was started.**

Preflight date: 2026-10-16

## EAS upload inspection

The Expo app is nested at `frontend/` under repository root `/app`. A root-scoped [`.easignore`](/app/.easignore) was required: the supported local command `npx --yes eas-cli build:inspect --platform android --profile production --stage archive --output /tmp/pizzabook-eas-v7-archive-inspect-release-20261016` showed the build context spans the repository root. The file uses explicit excludes rather than copying `.gitignore`.

The final local EAS archive inspection completed without starting a build or uploading anything. Its path-only inventory contains **184 files**: 182 under `frontend/`, plus the root `.easignore` and `.gitignore`. The complete file manifest is in [PizzaBook_EAS_Upload_File_Manifest.txt](/app/PizzaBook_EAS_Upload_File_Manifest.txt); it contains paths only, no file contents.

Required app inputs were confirmed present in the inspection snapshot, including:

- `frontend/app.json`, `frontend/eas.json`, `frontend/package.json`, `frontend/yarn.lock`
- app routes and runtime sources under `frontend/app/` and `frontend/src/`
- `frontend/src/freeLaunch.ts`, `frontend/src/proEntitlement.ts`, `frontend/src/experienceLevel.ts`, and `frontend/src/components/ProBillingProvider.tsx`
- Android assets under `frontend/assets/` and the config plugin `frontend/plugins/withTransparentAndroidSplashDrawable.js`

The inspection found **no `.env`/`.env.*`, token/credential-named files, signing-key-named files, or files matching the checked common private-key/API-key/token formats**. The `.env` contents were never read or printed. This is a filename and known-format scan, not a guarantee against every possible secret embedded under an arbitrary name.

### Excluded from the inspected file set

- Repository metadata and unrelated top-level services/tooling: `.git`, `.githooks`, `.emergent`, `.venv`, `.vscode`, `backend/`, `legal/`, `memory/`, root `scripts/`, `tests/`, `test_reports/`, and root exports/review folders.
- Root reports, patches, JSON/text exports and ZIP files.
- `frontend/.env` and nested env-like files; token/credential filename patterns; private-key/signing file extensions.
- `frontend/node_modules/`, `.expo/`, `.metro-cache/`, `dist/`, `dist-b2/`, `dist-f25-preview/`, `web-build/`, and `ui_evidence/`.
- Frontend review ZIPs/Markdown, diffs, logs, `app.json.backup`, verification/generator scripts, and `assets/images/app.code-workspace`.

The local inspection snapshot may contain empty directory placeholders for some ignored folders, but the file inventory shows no files within those folders. The ignore configuration was revised after inspecting the initial archive, then validated again against the final archive snapshot.

## Dirty worktree classification

At the start of this preflight the worktree already had **39 tracked modified paths and 108 untracked paths**. Those pre-existing changes were preserved. This task changed no app source files; it added the root `.easignore`, this report and the path-only upload manifest.

### Pre-existing app/config changes that can affect release behavior

Tracked modified paths include:

- Release identity/config/dependencies: `frontend/app.json`, `frontend/eas.json`, `frontend/package.json`, `frontend/yarn.lock`.
- App screens/routes: `frontend/app/(tabs)/_layout.tsx`, `feed.tsx`, `index.tsx`, `planner.tsx`, `profile.tsx`, `frontend/app/_layout.tsx`, `onboarding.tsx`, `settings.tsx`, `login.tsx`, `new-post.tsx`, `account-deletion.tsx`, `community-guidelines.tsx`, `post/[id].tsx`, and `pro-guide/` screens.
- Recipe/Beginner/PRO-sensitive runtime: `frontend/src/calculator.ts`, `experienceLevel.ts`, `plannerPhaseOverrides.ts`, `proSavedRecipes.ts`, `proLearn/manuals.ts`, and `frontend/src/i18n/{prefermentSteps,spiralMixing,styleSteps,translations}.ts`.
- Auth, notifications and test scripts: `frontend/src/auth.tsx`, `frontend/src/notifications.ts`, and modified verification scripts.

These paths were dirty before this task. In particular, changes in `frontend/app/(tabs)/index.tsx`, `frontend/app/(tabs)/planner.tsx`, `frontend/src/calculator.ts`, `frontend/src/i18n/`, `frontend/src/proLearn/manuals.ts` and `frontend/src/proSavedRecipes.ts` can affect the protected Beginner or PRO experience. Their contents were not reverted or modified here. Existing preflight checks passed against the current dirty tree, but that does not establish that these edits are approved release content or unchanged from the checked-in baseline.

Pre-existing untracked app inputs include free-launch/Billing/auth/community modules and routes, cost-calculator sources, additional localized PRO guide sources, and numerous verification scripts. The app/runtime files remain included in the upload snapshot; verification and generator scripts are excluded. The exact included app paths are in the manifest.

### Pre-existing generated/review artifacts

Untracked artifacts included root review/export directories and files, `frontend/dist-b2/`, `frontend/dist-f25-preview/`, `frontend/ui_evidence/`, root `ui_evidence/`, diff/log files, review ZIPs, and `frontend/app.json.backup`. The large preview/evidence directories were approximately 183 MB in total before filtering. They are not present as files in the final inspected upload set.

## EAS authentication

- `eas whoami`: `emergent-em-user-6d71ca1f-1f6a-427e-bd28-7ad48c4b53cf`
- `eas project:info`: **FAILED — Entity Not Authorized** for the configured project.
- Authentication recovery: **Requires an interactive login by an authorized project owner.** No login/logout or credential changes were performed.
- Remote build version: **Not rechecked after authorization failed.** Do not assume version 7 until authorized access confirms the current remote version.

## Verification performed

All listed checks passed on the current worktree:

- Expo resolved configuration: package `com.pizzabook.app`, project ID `497fc00a-4814-4a1f-abd5-fd111c073d43`, and all nine blocked permissions present.
- TypeScript: `./node_modules/.bin/tsc --noEmit`.
- Free launch: `node ./scripts/verify-free-launch.js`.
- Billing mock lifecycle: `node ./scripts/verify-pro-billing.js`.
- Community remains disabled: `node ./scripts/verify-community-disabled.js`.
- Offline behavior/auth UI: `node ./scripts/verify-offline-phase1.js` and `node ./scripts/verify-offline-auth-ui.js`.
- Beginner regressions: phase sequence, recipe gate, Direct schedule and plan persistence verification scripts.
- PRO/Biga/Poolish regressions: `verify-pro-options.js`, Biga remaining-flour (720 combinations), Poolish phase sequence (1,728 combinations), and Biga calculator/planner parity.
- `git diff --check`.

No new AAB was built, so the merged Android manifest and final binary permissions remain unverified.

## Remaining blockers and readiness

1. **EAS authorization blocked.** An authorized owner must sign in interactively; only then can project access and remote versioning be checked.
2. **Dirty protected app changes need release approval.** Beginner/PRO calculations, screens, planner, translations and saved-recipe/manual files were already modified. Regression tests pass, but the worktree is not a clean, reviewed release snapshot.
3. **Identity/config diffs need explicit review.** `frontend/app.json` and `frontend/eas.json` were already dirty. The resolved package and project ID match the values supplied for this release, but the full changes must still be approved as the intended build input.
4. **Binary-only checks remain unavailable.** No AAB exists from this preflight to inspect the final merged manifest or package/version.

The upload file filtering is now verified locally and the targeted checks pass, but the project is **not ready for a single production AAB build** until blockers 1–3 are resolved. No EAS build, commit, push, deploy, signing-credential change, Play submission or publication was performed.
