# Data Safety and GDPR evidence (proposed; not a legal opinion)

## Runtime configuration observed

* `frontend/src/offlineMode.ts:1` sets `OFFLINE_ONLY_MODE = true`.
* `frontend/src/communityFeature.ts:1` sets `COMMUNITY_ENABLED = false`.
* Auth initialization exits before reading a session or calling `/api/me` in offline mode (`frontend/src/auth.tsx:109-119`).
* Login and account deletion redirect away; login handler returns immediately (`frontend/app/login.tsx:25,100`; `frontend/app/account-deletion.tsx:64`).
* Community feed, guidelines and post screens redirect while disabled (`frontend/app/(tabs)/feed.tsx`, `frontend/app/community-guidelines.tsx`, `frontend/app/new-post.tsx:297`).
* The backend push registration effect exits in offline mode (`frontend/app/_layout.tsx:220-239`). Startup notification permission handling and local notification scheduling remain present.
* The profile screen loads a remote Unsplash image (`frontend/app/(tabs)/profile.tsx:91-94`). This necessarily sends a network request to the image host when loaded; the host may receive standard connection metadata such as IP address. Login's Pexels image is on a route redirected in the current configuration (`frontend/app/login.tsx:100`).
* The update-manifest/API check is guarded by offline mode (`frontend/app/_layout.tsx:117`); its public manifest URL is in `frontend/app.json:63`.

This describes source behavior. It does not establish what an arbitrary rebuilt artifact or external service logs.

## Data categories, storage, and recipients

| Finding | Evidence and current behavior | Status / action |
|---|---|---|
| Account identity/profile | Auth code can handle name, email, picture, account ID and session token (`frontend/src/auth.tsx:7-20,54-68`); login/auth path is disabled by `OFFLINE_ONLY_MODE`. No active account sign-in was observed in this configuration. | CONFIRMED DISABLED IN CURRENT SOURCE; re-check built app/runtime. |
| Community text/photos/videos | Upload implementation and image-library permission request exist (`frontend/app/new-post.tsx:37-62,95-140`); whole screen redirects because community is disabled (`:297`). | NOT ACTIVE IN CURRENT SOURCE; no upload evidenced. |
| Local app data | AsyncStorage backs ordinary settings (`frontend/src/utils/storage/index.ts:26-60`), language and plans; cost calculator data uses `pizzaCostCalculator.v1` (`frontend/src/costCalculator.ts:7`; `costCalculatorStorage.ts:12,40`). | Stored on device; no remote transmission found for these values in their storage paths. Removal/retention is generally OS app-data clear/uninstall; no comprehensive in-app erase function evidenced. |
| PRO entitlement | Boolean `pizzabookProLifetimeEntitlement` is in SecureStore (`frontend/src/proEntitlement.ts:3,24-42`). | Local sensitive state; not sent to an app backend in the current source. Google Play transaction processing is external. |
| Authentication credentials | Session token uses SecureStore in native auth storage (`frontend/src/auth.tsx:8-20`); auth bootstrap is disabled in offline mode. | Implementation exists but no active session/login flow in current configuration. |
| Purchase data | `expo-iap` queries and requests Google Play purchases (`frontend/src/components/ProBillingProvider.tsx:140-160,181-223`). Local entitlement stores a boolean. | Google Play Billing is a third-party recipient for purchase processing; exact Data Safety treatment must be confirmed against Play Console and applicable Play guidance. No app backend receipt endpoint exists. |
| Notifications | App can request notification permission and schedule local notifications (`frontend/src/notifications.ts:120-160`). The Android dependency declares `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`. | Local reminders are implemented. Push-token read and server registration code exist, but current offline gate prevents registration (`frontend/app/_layout.tsx:220-239`). No remote token transmission confirmed for this config. |
| Device/installation identifiers | A push installation ID generator is defined (`frontend/app/_layout.tsx:32-37`); push registration is gated off. `expo-device` is a dependency, but no app call reading a device identifier was found. | No active identifier collection confirmed. Review any final native/third-party behavior and artifact. |
| Analytics/crash reporting | No direct analytics or crash SDK/config/calls identified in direct dependencies or app source. Console errors are present. | No remote analytics/crash transmission evidenced by reviewed source; verify Play/third-party settings separately. |
| External image request | Profile references Unsplash URL (`frontend/app/(tabs)/profile.tsx:91-94`). | External host receives ordinary request/network metadata; disclose/confirm applicable Data Safety treatment and image-service terms. |
| Data deletion and retention | Privacy text promises account deletion and possible limited retention (`frontend/src/i18n/translations.ts:560,1243,1884,2525`); delete endpoint exists (`frontend/src/auth.tsx:98-103`) but deletion screen redirects while offline (`frontend/app/account-deletion.tsx:64`). | No current in-app account deletion path is available. Resolve before collecting accounts; no server retention schedule or deletion execution evidence was reviewed. |

## Policy consistency warning

The visible privacy text describes Google sign-in, profile/community content, push token, external storage/database/push providers, and account deletion (`frontend/src/i18n/translations.ts:554-560`, English counterpart `:1237-1243`). Current feature flags disable login/backend/community/push registration. The privacy notice therefore describes capabilities that are not active in this offline configuration; publication requires a policy matching the shipped behavior and a clear lawful contact/retention statement. This export does not decide GDPR lawful basis, controller/processor roles, international transfer mechanism, or Austrian consumer law.

## Proposed Google Play Data Safety declaration — **all entries require confirmation**

| Candidate declaration | Proposed current answer | Confirmation required |
|---|---|---|
| Account info (name, email, profile ID) | Do not declare as collected by current runtime; login disabled in source. | Confirm the exact uploaded build and whether any account capability/remote config is enabled. |
| Photos/videos/user-generated content | Do not declare as collected/shared by current runtime; community upload path is gated off. | Confirm the exact build and Play review behavior; if enabled later, declare upload/content and recipients. |
| Purchase history / financial data | Google Play handles checkout; app receives purchase result and stores a local entitlement boolean. | Confirm Play Console Data Safety interpretation, merchant/product setup and what purchase fields the client SDK exposes. |
| Device or other IDs | No app-level active device-ID transmission found; push registration is disabled. | Confirm dependency/native behavior and that production EAS variables/feature flags remain as reviewed. |
| Diagnostics / crash data | No app-level crash/analytics SDK found. | Confirm no account-level Expo/Google/third-party collection is configured outside this repository. |
| App activity / app interactions | No analytics event transmission found. | Confirm third-party SDK/Play configuration. |
| Notifications | Local notifications only are active in source; remote token registration code is gated off. | Confirm permission prompt, local schedule contents, and final manifest. |
| Data sharing | No app backend/community transmission found in current offline source; external image request and Google Play billing are exceptions to review. | Confirm external recipients, request logs, and Play Billing service disclosure. |
| Deletion/retention | No user-account deletion path is available while offline mode is on; local app data can be cleared by OS. | Publish accurate retention/deletion process and test it before enabling account collection. |

**Do not submit this proposal as a completed Data Safety form.** It is an evidence-based draft only; confirm final binary behavior, Play service handling, external image requests, privacy policy, support contact and retention with the responsible publisher/legal adviser.
