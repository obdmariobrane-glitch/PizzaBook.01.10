# PizzaBook — izvještaj o Android AAB izdanju V8

## Status

**USPJEŠNO — production AAB V8 izrađen i provjeren.**

| Stavka | Rezultat |
|---|---|
| Zatraženo izdanje | Android production AAB V8 |
| Expo projekt | `mrbranees-team/pizzabook` |
| Project ID | `497fc00a-4814-4a1f-abd5-fd111c073d43` |
| Android package | `com.pizzabook.app` |
| EAS CLI račun | `mrbranee` (Owner) |
| Remote Android versionCode prije builda | `7` |
| AAB versionCode | `8` |
| Build ID / status | `6443d54e-d64c-4084-ba4a-949c35d12b0e` / `FINISHED` |
| AAB poveznica | [Preuzmi PizzaBook V8 AAB](https://expo.dev/artifacts/eas/Ew17B_xvQG8L7XDiR_4P8CaqShGtGp6AZlFp4UAcWbs.aab) |
| SHA-256 AAB-a | `db1f1b586704df9dc4f098d40fb56ab78010b604fd4520608c1a47659e3aca12` |
| Manifest i dozvole | **USPJEH** — dekodirani iz preuzetog AAB-a |
| Potpis AAB-a | **USPJEH** — `jarsigner -verify` vratio `jar verified` |
| Slanje na Google Play | Nije provedeno |
| Signing credentials | Postojeći udaljeni keystore korišten; nisu mijenjani |

Build koristio je postojeće EAS vjerodajnice: `PizzaBook-Android-Production (default)`. Build fingerprint: `e7dd2633f6e40926a821233b16cfe30dd8750b5f`.
EAS je prikazao upozorenje da aplikacija koristi Expo Go za razvoj; upozorenje nije zaustavilo production build.
EAS je izvijestio da za production nema postavljenih plain-text ni sensitive environment varijabli. Aplikacija je konfigurirana s `OFFLINE_ONLY_MODE = true`, a community/backend zasloni ostaju deaktivirani.

## Lokalne provjere

Sve sljedeće provjere prošle su:

- `npx tsc --noEmit`
- `node scripts/verify-free-launch.js` — Beginner i PRO ostaju besplatni, paywall se preskače, a konfiguracija blokira Play Billing dozvolu.
- `node scripts/verify-community-disabled.js`
- `node scripts/verify-pro-options.js`
- `node scripts/verify-pro-billing.js`
- `node scripts/verify-home-pizza-plan.js`
- `node scripts/verify-pro-f14-f32-poolish-planner.js` — 384 regresijska slučaja za Poolish Planner.
- `node scripts/verify-beginner-phase-sequence.js`
- `node scripts/verify-beginner-phase-a.js`
- `node scripts/verify-beginner-plan-persistence.js`
- `node scripts/verify-planner-phase-overrides.mjs`

`verify-pro-options.js` ažuriran je tako da provjerava kako Planner nema zasebne odabire stila pizze ni metode tijesta te koristi spremljene/zajedničke postavke Kalkulatora. Aplikacijski kod nije mijenjan.

## Statička konfiguracija i provjera uploada

- Production profil u `eas.json` specificira Android `app-bundle`, udaljeni izvor verzije aplikacije i `autoIncrement: true`.
- Razriješena Expo konfiguracija specificira package `com.pizzabook.app`, očekivani project ID i `expo-notifications`.
- Android konfiguracija blokira `com.android.vending.BILLING` i osam nepotrebnih dozvola: `RECORD_AUDIO`, `CAMERA`, `ACTIVITY_RECOGNITION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` i `WRITE_EXTERNAL_STORAGE`.
- `.easignore` isključuje environment datoteke, credentials/potpisne datoteke, lokalne ovisnosti, generirane previewe i verifikacijske/review artefakte. Pregled EAS upload arhive potvrdio je uključen Planner kod, nije našao environment ili credential datoteke, a verifikacijske skripte bile su isključene.

## Analiza stvarnog AAB-a

Manifest je dekodiran Google Bundletoolom 1.18.3; SHA-256 preuzetog alata podudara se s objavljenim SHA-256 sažetkom službenog izdanja.

- Package: `com.pizzabook.app`
- `android:versionCode`: `8`
- `android:versionName`: `1.0.4`
- Google Play Billing dozvola `com.android.vending.BILLING`: **nije prisutna**
- Svih osam traženih blokiranih dozvola: **nisu prisutne** — `RECORD_AUDIO`, `CAMERA`, `ACTIVITY_RECOGNITION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
- Potrebne dozvole za obavijesti: **prisutne** — `POST_NOTIFICATIONS` i `RECEIVE_BOOT_COMPLETED`
- Potpis: **verificiran** (`jar verified`), algoritam `SHA256withRSA`
- Potpisni certifikat SHA-256 fingerprint: `F2:DC:47:5A:76:03:35:E2:97:D7:3F:55:FF:5D:10:DA:F8:11:7A:79:24:B9:80:3B:72:59:C0:7F:F4:3B:4D:E7`
- Upozorenje potpisa: nema vremenske oznake; `jarsigner` navodi da nakon isteka certifikata (2054-03-02) provjera možda više neće biti moguća.

Nije pokrenut dodatni build. AAB nije poslan ni objavljen na Google Play.
