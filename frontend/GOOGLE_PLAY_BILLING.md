# Google Play Billing: PizzaBook PRO

PizzaBook uses `expo-iap` 6.0.2 for the Android one-time, non-consumable product `pizzabook_pro_lifetime`. The app displays the localized price returned by Google Play; the €6.99 price must be configured in Play Console and is not embedded in app code.

## Play Console setup

1. Open the Play Console app whose Android package is `com.pizzabook.app`.
2. Create an in-app product with ID `pizzabook_pro_lifetime` and configure it as a one-time product, not a subscription or consumable.
3. Set the base price to €6.99 and review the regional prices/currency conversions offered by Play.
4. Activate the product and publish an internal or closed testing release containing a build with the billing implementation.
5. Add tester accounts to the selected testing track and to the license-testing list.
6. Install the app from its Play testing link using one of those Google accounts; Play Billing does not provide a valid purchase flow from Expo Go or a sideloaded build.
7. Test a purchase, cancellation, pending payment, reinstall/restore, and an already-owned purchase before promoting the release.

Do not replace the existing Android package name or EAS signing key. A real Play-installed test build is required to validate store behavior; no build or purchase was performed as part of this implementation.

## Entitlement and security limits

The app grants access only after Google Play reports the expected product as purchased and `finishTransaction` successfully acknowledges it as non-consumable. The resulting boolean entitlement is stored in Android SecureStore so a previously confirmed purchase remains usable offline. An ownership query that fails retains the offline entitlement; a successful query that reports no owned purchase clears it.

There is intentionally no backend receipt validation. Consequently, the client cannot provide server-grade cryptographic verification or protect paid functionality against a rooted device, modified app, or local entitlement tampering. Refunds/revocations are noticed only when a later successful Play ownership query reports that the purchase is no longer owned. Do not use this client-only design to protect server-side services or high-value content.
