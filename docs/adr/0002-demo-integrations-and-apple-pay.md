# Demo integrations and the Apple Pay gate

Integrations ship as adapters that refuse the live side effect until env vars are set. Giving has a second gate: Stripe, `GIVING_LIVE`, and `APPLE_PAY_NONPROFIT_APPROVED` must all be true. That matches App Store guideline 3.2.1(vi) while Apple's nonprofit Apple Pay approval is still pending. The Candid Seal is noted as the transparency credential; it is not itself the Apple approval.

The iOS Stripe PaymentSheet type is not linked. The server creates the PaymentIntent, and the app has a demo confirmation that cannot charge. Adding the Stripe iOS SDK is a deliberate package pin after approval, not a silent dependency in CI.
