# Open blockers and manual evidence required

1. **Final binary inspection — BLOCKED – REQUIRES AAB REVIEW.** Download the already-built AAB and inspect package, versionCode 6, target SDK, merged permissions, dependency metadata and embedded configuration. This export did not download or change the AAB.
2. **Play Console product — BLOCKED – REQUIRES GOOGLE PLAY CONSOLE.** Confirm `pizzabook_pro_lifetime` is active, one-time/non-consumable, available to the internal track and priced at €6.99 for Austria/other target regions. No Play Console product record was reviewed.
3. **Live billing — BLOCKED – REQUIRES GOOGLE PLAY CONSOLE OR DEVICE TEST.** Test real Play-installed buy, pending, cancel, already-owned, restore on second install, offline use, uninstall/reinstall and refund/revocation. Mock tests are not store evidence.
4. **Data Safety — BLOCKED – PUBLISHER CONFIRMATION.** Complete Play's form using the final binary and confirm treatment of Google Play purchase information, external image requests, diagnostics and any account-level provider configuration.
5. **Privacy notice and GDPR process — BLOCKED – LEGAL/PUBLISHER REVIEW.** Current privacy copy describes account/community/push collection while current code gates those features off. Confirm Austrian/EU controller identity, lawful bases, recipients/processors, transfers, retention, rights, contact, deletion and published policy URL.
6. **Account deletion — BLOCKED if accounts are enabled or collected.** Deletion screen redirects in offline mode; backend deletion code exists but is not reachable in the current configuration. If any account data is collected in released behavior, provide/test an accessible deletion path and any required web deletion route.
7. **Permission justification — OPEN.** Inspect final manifest and justify `RECORD_AUDIO`, legacy storage/media and notification permissions. Image-picker media route is community-disabled; do not equate manifest permission with actual data collection.
8. **Build warning / reproducibility — OPEN.** Prior EAS output noted Expo Go development tooling warning and a 359 MB project archive. Neither prevented the recorded build; assess before future release builds.

No item above was fixed or changed in this evidence-only export.
