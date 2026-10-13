# B3-1 Notification Review

## Scope and outcome

Reviewed the B2-final notification paths without replaying the B2 UI matrix.
The notification date comes from the same `Date`-valued Beginner schedule
events shown by Beginner. Planner events are built by `reversePlan` from the
matching shared schedule where supported.

One reproducible stale-reminder defect was found in Planner: its
`scheduledPlanKey` lived only in component state and scheduled reminders
contained no plan identity. Re-entering Planner or restarting the app therefore
could not tell whether an existing alarm still matched the selected plan.
Planner reminders now carry the plan key, and mounting/updating Planner cancels
only reminders from obsolete plan keys (including legacy, unidentifiable
Planner reminders). Matching-plan and unrelated notifications are retained.

The follow-up review found two additional issues and fixed them. Romana Teglia
production translations have a `fridgeIn` action but no separate `balling`
copy. The old Planner gate required both and fell back to an earlier combined
milestone at `ballingAt`; it now emits the fridge-in action at the schedule's
actual `fridgeAt`, while keeping an optional earlier action only when copy
exists. The regression uses the actual HR, EN, DE, and SL production
translation objects and asserts 17:00 in `Europe/Vienna`.

Cold-start notification cleanup is now gated by an explicit restore status.
Pending or failed restore cannot pass a temporary `null`/incomplete identity
to the cancellation helper. A ready restored plan reconciles against its full
current identity; a ready, confirmed empty Beginner plan cancels old Planner
alarms; a real input change produces a new identity and cancels only the old
plan. A matching restored plan retains its alarms.

## Beginner and Planner event / trigger correspondence

| Event | Beginner schedule and notification | Planner representation |
|---|---|---|
| Mix, folds | `beginnerScheduleSteps` reuses the computed event `Date`; one `DATE` trigger per pending actionable event. Completed folds are omitted. | Direct home milestones derive from the same schedule and fold offsets; Planner schedules each future `step.at` as a time interval to that same instant. |
| Balling / shaping and fridge-in | When `fridgeAt > ballingAt`, B2 emits separate `balling` (or style-appropriate portioning) and `fridgeIn` events. Each gets its own payload and trigger. | `reversePlan` emits separate events when both copy actions exist. Romana Teglia has no separate balling copy, so Planner now emits its production `fridgeIn` action at the exact `fridgeAt` without fabricating an earlier combined fridge-in. |
| Fridge-out | `fridgeOut` uses `getBeginnerFridgeOutAt`; omitted if no room-after-fridge phase exists. | Home schedule derives the final-room milestone from fridge timing. |
| Room-only end / preheat | Room-only schedules may place both at the same instant. The notification planner merges only that exact pair; payload uses `stepId=roomFermentationEnd` and `combinedStepId=preheat`. Completing either cancels the shared reminder. | The room-end guidance and preheat are generated from the same local schedule. |
| Preheat / bake | Separate actionable events unless preheat is combined with a same-time room end. Past or completed events are filtered before scheduling. | Separate future Planner rows and local reminders. |

Beginner local reminders use an absolute Expo `DATE` trigger with the exact
event `Date`. Planner reminders use a one-shot `TIME_INTERVAL` trigger derived
from `step.at - Date.now()` and rounded to seconds. Both preserve the intended
instant; their delivery accuracy and Android reboot/background behavior still
require device verification. Guided payloads contain source, plan ID, step ID,
and the optional combined step ID. Planner payloads contain source, method,
and the new plan ID.

## Coverage matrix

| Branch | Notification route and schedule coverage | Verification type | Status / boundary |
|---|---|---|---|
| Neapolitan / Direct / hand or mixer | Beginner guided events use the direct schedule; Planner uses reverse-plan milestones. | Existing Beginner/Planner schedule regressions; B2 representative UI history; B3-1 notification mock. | Supported; no Android delivery test in this pass. |
| Romana Tonda / Direct / hand or mixer | Same direct event builder; Tonda gets the round-dough shaping path. | Roman workflow and home-plan regressions; prior B2 UI evidence; B3-1 notification mock. | Supported; no full UI replay. |
| Romana Teglia / Direct / hand or mixer | Same direct event builder; tray preparation/handling follows the Teglia branch. | Roman workflow and home-plan regressions; production HR/EN/DE/SL Planner-copy regression asserts fridge-in at 17:00 Europe/Vienna; B3-1 notification mock. | Supported; automated correction verified; no Android delivery test. |
| New York / Direct / hand or mixer | Same direct event builder; New York handling and schedule inputs remain style-specific. | New York workflow and home-plan regressions; prior B2 UI evidence; B3-1 notification mock. | Supported; no full UI replay. |
| Room-only / fridge-room | Room-only omits fridge-in/out; fridge-room can emit separate balling, fridge-in, fridge-out, preheat, and bake events. | Existing home-plan, Beginner schedule, and guided-event regressions; B2 public UI checks for room-only and cold-plan timing. | Supported; event scheduling is automated here, not re-tested on device. |
| Fresh / dry yeast | Yeast changes the computed plan input and ingredient requirements, not the notification transport. | Direct schedule and persistence regressions; prior coverage. | Supported through the shared event route; no yeast-by-style Android matrix. |
| Standard / stronger specialty flour | Uses normal or gentle fold copy while keeping event IDs and event dates from the same schedule. | Home-plan and workflow regressions; notification source check. | Supported. |
| Gluten-free flour | Omits fold events where the gluten-free Phase B plan has no folds; uses portioning event copy. | Home-plan, workflow and notification event checks. | Supported. |
| Custom flour blend | Shared event route; custom blends use the configured blend inputs and generic fold copy. | Home-plan and persistence regressions; previous B2 public blend case. | Supported; other ratios were not device-tested. |
| Beginner Biga / Poolish | Beginner has Biga/Poolish schedules and recipe milestones, but `beginnerScheduleSteps` / `guidedPlanId` currently require a direct schedule. | Source trace only. | **Not supported by Beginner guided notifications.** |
| Planner Direct / Biga / Poolish | Planner reverse-plan milestones are schedulable for the method selected in Planner. | Existing schedule code/tests; B3-1 notification mock covers transport, not each method delivery. | Supported by Planner; device delivery remains open. |
| Web and Android Expo Go | Web has no native local notification module; Android Expo Go is explicitly treated as unsupported. | Platform guards and source inspection. | **Unsupported; use an installed native Android build.** |

## Lifecycle and identity checks

- `planGuidedNotifications` excludes non-actionable, completed, and past events;
  an exact same-time room-end/preheat pair produces one notification.
- Marking a combined event matches either `stepId` or `combinedStepId` for
  cancellation. Source inspection shows Beginner synchronization cancels the
  same plan's tagged reminders before scheduling the remaining future events.
  The native-API mock verifies selection/retention, but does not mount the React
  effect or simulate a real app restart.
- Planner notifications now have a durable plan identity. It is derived from
  the method/style, event timestamps, and generated schedule objects, not
  language/unit presentation. The native-API mock confirms the cleanup helper
  retains a reminder with the same plan key and selects stale/legacy alarms.
  Planner re-entry/restart behavior is source-traced, not device-tested.
  Restore status is `pending`, `ready`, or `unavailable`; reconciliation is
  blocked while pending, after a failed restore for Beginner, and whenever a
  Beginner schedule is incomplete or mismatched with its bake date. A
  restore-ready empty plan cancels obsolete Planner alarms. Automated
  lifecycle regression covers existing alarm → pending cold-start → same plan
  restored and retained → input changed to a new identity and old alarm
  cancelled. The schedule button also cancels Planner alarms before replacing
  them.
- Beginner plan identity is based on actual schedule inputs; display language
  and unit preferences are not in the identity. Existing persistence tests
  assert that property. Planner `planKey` also excludes language and unit
  presentation state.
- Beginner snapshots serialize schedule dates as ISO timestamps. Guided
  grouping and event comparison use local calendar parts / epoch milliseconds.
  Existing `Europe/Vienna` assertions cover a plan crossing local midnight.
  The B3-1 mocked DATE-trigger regression additionally checks that the exact
  epoch timestamp is passed unchanged for `2026-10-25T01:30:00Z`, the repeated
  local hour at the autumn Vienna DST transition.

These are source-backed automated checks, not Android OS delivery evidence.
No physical device, emulator, or native notification delivery was available
in this run. Android permission prompts, background delivery, notification
tap behavior, force-stop behavior, and OS reboot restoration remain open.

## Changes and validation

- `frontend/src/notifications.ts`: identify obsolete Planner notifications
  by plan ID, retaining same-plan and unrelated notifications; cancel all
  Planner notifications if there is no active plan.
- `frontend/app/(tabs)/planner.tsx`: reconcile only after the restore state
  permits it and the Beginner schedule identity is complete; include the plan
  key in each new Planner notification payload.
- `frontend/src/beginnerPlanRestoreCoordinator.ts` and
  `frontend/app/(tabs)/index.tsx`: publish restore readiness and expose the
  reconciliation guard; pending/failed cold starts preserve saved alarms.
- `frontend/src/calculator.ts`: permit a production Teglia fridge-in milestone
  without requiring a separate balling-copy string.
- `frontend/scripts/verify-beginner-notifications.js`: mock the native Expo
  notification API and verify exact DATE and interval triggers, payloads,
  obsolete-plan cancellation, retention of same-plan reminders, and the
  cold-start → restore → input-change lifecycle.
- `frontend/scripts/verify-home-pizza-plan.js`: use actual production
  translations for four locales to verify Romana Teglia fridge-in at 17:00
  Europe/Vienna.

The Teglia regression now verifies the actual production copy at the true
fridge-in timestamp instead of relying on a synthetic Planner fixture. The
cold-start regression verifies that an unresolved restore does not cancel
alarms, a restored same-identity plan keeps them, and a changed plan or a
restore-ready empty Beginner plan cancels obsolete alarms.

Executed after these fixes: `check:beginner-notifications`,
`check:guided-recipe`, `check:beginner-plan-persistence`,
`check:home-pizza-plan`, `TZ=Europe/Vienna npm run check:home-pizza-plan`,
`check:beginner-direct-schedule`, `check:roman-workflow`,
`verify-new-york-workflow.js`, TypeScript `--noEmit`, and `git diff --check`.
These are automated regressions; none exercised Android delivery.

## Preview and Android build boundary

Updated web preview after the Teglia and restore-readiness fixes:
https://pizzabook--tdoza1li7m.expo.app (deployment `tdoza1li7m`). The served
JavaScript bundle SHA-256,
`69efde40a72e417cda7c17fe982728e9f0d5aeff6e8df3f404a4ffb5612a7b50`, matches
the local export at `frontend/dist-b3-1-teglia-coldstart`. This verifies web
delivery only, not Android notifications. The environment has no Java, Gradle,
Android SDK, `adb`, emulator, or physical device. EAS internal Android preview build
`05f4d3c4-ae33-4764-92e9-a805ceea7113` failed at Gradle resource linking because
Android's splash theme referenced the missing `@drawable/splashscreen_logo`.
The app config had no Android splash image, so Expo's plugin emitted no image
resource. Adding the existing `icon.png` as the Android splash image fixed the
config path; local `expo prebuild --platform android --no-install` generated
all five density-specific `splashscreen_logo.png` resources. A retry,
`da027650-b2c3-4dd1-a4e5-a0969c2c0bce`, is in progress at
https://expo.dev/accounts/emergent-em-user-6d71ca1f-1f6a-427e-bd28-7ad48c4b53cf/projects/pizzabook/builds/da027650-b2c3-4dd1-a4e5-a0969c2c0bce.
The corrected retry finished successfully: app version `1.0.4`, remote Android
version code `15`, package `com.emergent.doughtimer.ia80uq`, profile
`preview`. It predates the current Teglia/restore-readiness fixes and is
superseded by build `4f5b1b52-8868-4ef4-b656-9c5ec8d62b8b` (version code `16`,
APK linked in `B3_1_ANDROID_TEST_PLAN.md`). Neither build was tested on a
physical Android device.
Download/install:
https://expo.dev/artifacts/eas/yFKNhfErMDxT5Mlc_Z4J7I2G7oep1d2unXwdEMzAc6E.apk.
The build page is the installation fallback and provides the Expo install
flow. The APK download was checked as an Android package and passed ZIP
integrity; size `182741215` bytes, SHA-256
`31b0bf0841420201a45153062a4f60b10de2954ede82c6b71be31a7150630f0a`.
No actual-device notification delivery test was performed. `expo-doctor` also
reports duplicate native packages and SDK patch version mismatches; those
unrelated dependency upgrades were not made.

B3 was not started beyond this B3-1 notification review and test preparation.
