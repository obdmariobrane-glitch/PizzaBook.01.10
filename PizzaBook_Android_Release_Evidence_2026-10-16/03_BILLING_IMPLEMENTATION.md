# Google Play Billing implementation evidence

**Important:** source and mock-test evidence establish implementation behavior only. No physical-device purchase or Play Console product verification is evidenced here.

## Status by area

| Area | Status | Evidence and behavior | Required next action |
|---|---|---|---|
| Billing SDK and product ID | IMPLEMENTED | `frontend/package.json:51`; `frontend/src/proBillingCore.ts:1`; Android IAP plugin is enabled in `frontend/app.json`. | Confirm active Play Console product with exact ID. |
| Product initialization | IMPLEMENTED | `frontend/src/components/ProBillingProvider.tsx:140-147` fetches the in-app product after IAP connection; `:228` selects the matching product. | Verify product availability on a Play-installed test build. |
| Product price €6.99 | CONFIGURED BUT NOT VERIFIED | UI uses the Play-returned product/display price; source does not embed a fixed price. No Play Console evidence was inspected. | Confirm product type, active status, price and regional prices in Play Console. |
| Purchase flow | IMPLEMENTED | `frontend/src/components/ProBillingProvider.tsx:181-205` reconnects if necessary and invokes `requestPurchase` as `in-app`. | Buy with a licensed internal tester; capture successful, cancelled and pending cases. |
| Confirmation and PRO activation | IMPLEMENTED | `frontend/src/proBillingCore.ts:10-13, 29-37` requires exact product ID, `purchased` state and Google store, acknowledges before secure persistence; provider sets PRO only after successful processing (`ProBillingProvider.tsx:76-85`). | Verify end-to-end on Google Play; client-only confirmation is not server-side receipt validation. |
| Restore purchase | IMPLEMENTED | `frontend/src/components/ProBillingProvider.tsx:119-138, 207-223` queries owned purchases and reconciles them; core restores only matching confirmed purchase (`proBillingCore.ts:65-76`). | Test restore on second device/account session. |
| Restart / offline | IMPLEMENTED (local behavior) | SecureStore entitlement is loaded and used offline (`frontend/src/proEntitlement.ts:24-36`; `experienceLevel.ts:32-50`). Mock test covers simulated restart, not an actual process/device restart. | Verify process restart and offline launch on device. |
| Reinstall | BLOCKED – REQUIRES GOOGLE PLAY CONSOLE OR DEVICE TEST | Startup ownership query exists after Billing connects (`ProBillingProvider.tsx:150-160`); no real uninstall/reinstall test was evidenced. | Install from Play, uninstall/reinstall with same tester account, verify restore. |
| Pending/cancelled/already-owned/error handling | IMPLEMENTED (mock-tested) | `ProBillingProvider.tsx:96-119, 191-203`; `proBillingCore.ts:16-26`; `scripts/verify-pro-billing.js:110-147`. | Verify actual Play UI outcomes. |
| Refund/revocation | IMPLEMENTED WITH LIMITATION | A successful ownership query with no matching purchase clears local entitlement (`proBillingCore.ts:65-76`); failed query intentionally retains offline entitlement (`ProBillingProvider.tsx:150-159`). | Confirm refund/revoke behavior with Play test purchase and later successful query. |
| RevenueCat | MISSING / NOT USED | No RevenueCat dependency or source integration found. This app uses `expo-iap` directly. | No action unless a RevenueCat architecture is deliberately chosen. |
| Store operation in this export | BLOCKED – REQUIRES GOOGLE PLAY CONSOLE OR DEVICE TEST | Prior recorded validation was a mock script, not Play Billing transaction evidence. | Perform internal-track tests; do not infer live purchase success from mocks. |

## Existing mock-test evidence

`frontend/scripts/verify-pro-billing.js` tests purchased vs pending/unknown store, acknowledge-before-grant, deduplication/retry, restore clearing, cancellation classification, offline cached entitlement and Beginner availability. The preceding session recorded: “PRO billing mock checks passed”. It does not exercise Google Play services, Play Console catalog configuration, payment, refunds, actual reinstall or device persistence.

The implementation deliberately persists only a boolean local entitlement; it has no backend receipt validation. The source also documents this limitation in `frontend/src/i18n/translations.ts:57,744,1385,2026`.
