# PizzaBook QA Handoff

Generated from the current working tree on 2026-10-10.

## Current project state

- Repository root: `/app`
- Frontend application: `/app/frontend`
- Expo SDK: see `frontend/package.json` and the installed lockfile
- Package manager: Yarn 1.22.22
- Expo web preview currently responding at: `http://localhost:3000`
- Android application ID currently configured as: `com.emergent.doughtimer.ia80uq`
- iOS bundle identifier currently configured as: `com.emergent.doughtimer.ia80uq`
- Expo EAS project ID currently configured in `frontend/app.json`: `0d36eeb4-694f-4640-bd26-583ab48a9611`
- No native `android/` directory is present.
- No production build was started for this handoff.

## Current uncommitted changes

The worktree was already dirty before this handoff. The current tracked modifications are:

- `frontend/app/(tabs)/planner.tsx`
  - Uses the localized `common.back` translation for Planner Back button labels.
- `frontend/src/i18n/translations.ts`
  - Contains the approved Beginner HR, DE, EN, and SL language corrections.

Current untracked or generated review artifacts include:

- `BEGINNER_FINAL_3_ISSUES.md`
- `BEGINNER_REMAINING_TEXT_AUDIT.md`
- `frontend/app.json.backup`
- `pizzabook_beginner_text_export/`
- Previously generated review ZIP files and QA/report artifacts in the repository root

No existing user changes were reverted or committed.

## Beginner coverage

Beginner mode currently supports these styles:

- Neapolitan
- Romana Tonda
- Romana Teglia
- New York Style

Supported Beginner flour selections include:

- Tipo 00
- Manitoba
- Spelt
- Whole wheat
- Gluten-free
- Custom blends

Beginner uses the direct dough method. Biga and Poolish instruction definitions remain in the project for supported non-Beginner paths, but Beginner does not expose those preferment methods.

Beginner supports:

- Hand mixing and mixer-specific instructions
- Room-only fermentation
- Cold plus room-temperature fermentation
- Home stone, home pan, and pizza-oven paths
- Guided recipe phases and Planner scheduling
- Local guided notifications where the platform supports them
- Croatian (HR), German (DE), English (EN), and Slovenian (SL)

Gluten-free Beginner instructions use dedicated cohesive-mass guidance rather than traditional gluten-development instructions.

## Running the project

### Web preview

```bash
cd /app/frontend
yarn install
yarn web --port 3000
```

Open:

```text
http://localhost:3000
```

The currently running preview was started from `/app/frontend` with Expo on port `3000`.

### Expo development server

```bash
cd /app/frontend
yarn start
```

Use the Expo CLI prompts to open the project in a compatible development client, emulator, simulator, or Expo Go where supported.

### Focused validation scripts

From `/app/frontend`:

```bash
yarn check:beginner-phase-sequence
yarn check:beginner-notifications
yarn check:home-pizza-plan
yarn check:gallery-sync
yarn check:roman-workflow
yarn check:guided-recipe
yarn tsc --noEmit
```

Some scripts may require the frontend dependencies and environment configuration that are intentionally excluded from the handoff archive.

## Environment and backend notes

Environment files and credentials are intentionally excluded from the project export:

- `frontend/.env`
- `backend/.env`
- Any credential, token, key, certificate, or private signing file

The frontend can render and calculate core pizza recipes locally, but authentication, community functionality, remote saved data, media uploads, remote push registration, and backend-dependent features require the configured backend services and environment variables. Do not copy secrets into the QA archive or commit them.

## Known issues and review notes

1. **No Android APK is currently available.** No `.apk` or `.aab` was found anywhere under `/app`. An Android build was not started because approval was not provided.
2. **The project has no checked-in native Android directory.** Android binaries are expected to be produced through Expo/EAS or an approved local prebuild/build workflow.
3. **The configured Android application ID is still `com.emergent.doughtimer.ia80uq`.** It has not been changed as part of this handoff.
4. **EAS Update is not fully configured in the current project.** The existing `updateManifestUrl` points to the configured custom update mechanism; do not assume an EAS Update deployment is available.
5. **Backend ownership and availability affect non-offline features.** QA that exercises login, community, uploads, remote saved recipes, or remote notifications needs valid owner-provided services and environment configuration.
6. **The worktree contains uncommitted localization and Planner changes.** QA should test the current files as exported, not assume they match the last commit.
7. **The current project contains prior audit/export artifacts.** These are included in the full project handoff where they are non-secret, but they are not runtime dependencies.

## Android APK status

**Status: NOT AVAILABLE**

No existing Android APK or AAB was found. No new build was started, no signing credentials were changed, and no build artifact is provided in this handoff.

