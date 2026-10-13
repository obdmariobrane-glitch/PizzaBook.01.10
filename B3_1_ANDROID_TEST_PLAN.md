# B3-1 Android Notification Test Plan

## Build target status

The current source has a completed EAS Android internal preview build:
`4f5b1b52-8868-4ef4-b656-9c5ec8d62b8b`, profile `preview`, app version
`1.0.4`, remote Android version code `16`, package
`com.emergent.doughtimer.ia80uq`. Download/install the APK at:
https://expo.dev/artifacts/eas/PRQiJJb7VP_a1UH_D7-xESyMu3BotuzU80G963H8zK4.apk.
The EAS build page is also available at:
https://expo.dev/accounts/emergent-em-user-6d71ca1f-1f6a-427e-bd28-7ad48c4b53cf/projects/pizzabook/builds/4f5b1b52-8868-4ef4-b656-9c5ec8d62b8b.
The current APK was downloaded, passed ZIP integrity validation, and has size
`182742195` bytes and SHA-256
`3d7590ed806fd2e7e153ea74691365a3d48dd669f2dd767d77162af6f60d42c2`.
No Android device test was run.

The preceding successful preview build (`da027650-b2c3-4dd1-a4e5-a0969c2c0bce`,
version code `15`) predates the current fixes and is superseded. Its APK passed
ZIP integrity validation; size `182741215` bytes, SHA-256
`31b0bf0841420201a45153062a4f60b10de2954ede82c6b71be31a7150630f0a`.
The earlier build (`05f4d3c4-ae33-4764-92e9-a805ceea7113`) failed because
Android's splash resource was missing; adding the existing app icon to the
splash configuration fixed that separate build blocker.

The current environment has no Java, Gradle, Android SDK, `adb`, emulator, or
physical device. Web preview/export is not a substitute for Android delivery.
The current Teglia fridge-in and cold-start restore fixes are deployed as
public web preview https://pizzabook--tdoza1li7m.expo.app (`tdoza1li7m`); the
served JS SHA-256
`69efde40a72e417cda7c17fe982728e9f0d5aeff6e8df3f404a4ffb5612a7b50` matches
the local export. This confirms only web delivery, not Android notifications.

The current Android build is the version-code-16 build listed above. The
JavaScript bundle hash verifies only the separately deployed web preview; it
does not prove Android notification delivery.

## Short physical-device protocol

Use a supported Android phone with network access, record Android version,
manufacturer/model, app version, build ID, install method, local timezone, and
permission state. Use the same saved Beginner plan for the lifecycle checks
and an active Planner plan for the Planner cancellation check.

1. **Permission accepted:** clear app data or use a fresh install. Enable
   Beginner notifications and accept Android's notification prompt. Confirm
   the preference remains enabled after returning to the app.
2. **Permission denied:** reset app notification permission or use a second
   fresh install. Deny the prompt, attempt to enable reminders, and confirm the
   app reports denial and no notification is delivered. If Android no longer
   presents a prompt, enable/deny permission in system App info and record
   `canAskAgain`.
3. **Background and closed delivery:** schedule a supported direct plan far
   enough ahead that its next actionable event remains in the future. Record
   the visible plan date/time and pending event. Put the app in background and
   verify delivery; repeat after swiping the app away (do not force-stop it,
   which can suppress Android alarms). Record actual delivery time and payload
   title/body. Then tap the notification and record whether the app opens the
   expected Beginner step. Current guided payloads route to their step;
   Planner payloads have no step/deep-link field and currently fall back to
   opening the app without targeted Planner navigation.
4. **Completion and past events:** mark a future guided step complete and
   verify its pending reminder is cancelled. Let one test event become past,
   return/reopen the app, and confirm neither event is rescheduled.
5. **Re-enable, return, restart:** disable then re-enable guided reminders;
   navigate away and back, then fully close/reopen the app. Inspect Android's
   app notification history and confirm one delivery per still-future step
   (no duplicate entries). A same-plan Planner reminder should remain pending
   after app restart without being duplicated.
6. **Changed plan inputs:** with Planner reminders pending, change a material
   plan input (prefer bake date/time, then style or fermentation schedule),
   return to Planner, and confirm old-plan reminders are cancelled. Schedule
   the revised plan and confirm only its new future reminders remain.
7. **Localization and units:** with a saved guided plan and one completed
   action, switch HR → DE and metric → US. Confirm plan dates, notification
   event identity, and progress are unchanged after app restart. Verify the
   notification language follows the selected language for newly scheduled
   reminders; unit-display changes must not create duplicate reminders.
8. **Vienna calendar boundary:** set the device timezone to
   `Europe/Vienna`. Check a plan crossing local midnight and, separately,
   schedule around the autumn DST repeated hour (25 October 2026). Compare the
   displayed local date/time with the expected instant and record delivery;
   do not infer OS delivery from JavaScript tests.

Capture before/after screenshots or notification-history records with visible
dates/times, plus the build ID and permission screen. Repeat the denied case
with a clean permission state; do not treat the web preview as Android proof.

## Automated preparation already completed

The source-backed notification mock verifies Beginner's absolute DATE trigger,
Planner's time-interval trigger, exact payload fields, same-plan retention,
obsolete/legacy Planner cancellation, and unrelated-notification retention.
Existing automated checks cover past/completed action filtering, progress
identity, B2 balling/fridge-in separation, room-only/fridge-room timing,
midnight grouping, and Europe/Vienna calendar formatting. These checks do not
cover Android's notification permission UI, alarm delivery, background
restrictions, tap behavior, force-stop, or device reboot.
