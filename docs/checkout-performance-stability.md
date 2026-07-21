# Checkout Performance and Stability Contract

Last verified against source: 2026-07-21.

## Ownership and safety boundary

Checkout performance work must not create a second checkout, payment, cart, or order authority.

```text
React cart
  -> successful Woo Store API add-to-cart
  -> low-priority DTB static checkout prewarm
  -> full-document /checkout/
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> Woo order/payment lifecycle
```

WooCommerce remains authoritative for cart/session, customer/address state, shipping/tax/totals, checkout submission, and order creation. The official WooCommerce Stripe extension remains authoritative for payment-method eligibility, provider iframes, tokenization, 3DS/SCA, wallets, payment execution, and webhook reconciliation.

Performance optimizations must fail open. A failed prewarm, telemetry write, PageSpeed audit, or DTB runtime enhancement must not block cart mutation, checkout navigation, payment rendering, or Woo submission.

## Checkout asset loading

`dtb-commerce/Payment/CheckoutPerformance.php` owns the checkout-only performance policy.

Core rules:

- DTB checkout JavaScript remains footer-loaded/deferred where supported.
- The native checkout document restores Stripe preconnect/DNS-prefetch hints that the normal headless SPA intentionally removes.
- DTB-owned checkout CSS is preloaded on the native checkout document.
- On the first successful add-to-cart event in a storefront document, React schedules one low-priority prewarm using `requestIdleCallback` when available, with a bounded timer fallback.
- The prewarm fetches the existing checkout capabilities endpoint, reads only the server-provided `performance.asset_prewarm` manifest, then preloads DTB checkout styles and prefetches DTB checkout scripts.
- Prewarm URLs are allowlisted to the storefront/backend origin; Stripe preconnect origins are separately allowlisted.
- Prewarm never requests the private `/checkout/` HTML document because that response is session-owned and `private/no-store`.

The prewarm asset-version constants are statically checked against the owning checkout enqueue locations so stale speculative URLs fail CI rather than silently drifting.

## Third-party budget

Checkout is intentionally stricter than the general storefront.

At late enqueue time DTB removes only known non-essential marketing, analytics, A/B testing, chat, and loyalty/rewards assets by explicit handle/host policy. Unknown plugin assets are not heuristically removed because a payment or Woo dependency must never be broken to improve a synthetic performance score.

The runtime also audits Resource Timing entries and records unexpected non-payment third-party hosts. Stripe, Stripe network, Apple, Google Pay, and same-origin resources are excluded from that warning path.

A newly introduced checkout third party must have an explicit business owner, necessity, performance budget, failure behavior, and rollback path.

## Image loading and layout stability

Checkout order-summary images are presentation-only. DTB applies `decoding="async"`; images initially below the viewport are marked `loading="lazy"` and low fetch priority.

Do not lazy-load provider iframes, checkout form controls, the primary checkout logo, or assets required to render the first interactive checkout state.

The runtime observes cumulative layout shift and largest-contentful-paint when supported. Threshold breaches are telemetry signals, not payment gates.

## Runtime stability and re-render detection

`dtb-commerce/assets/woo-native-checkout-performance.js` records bounded checkout-only diagnostics for:

- uncaught JavaScript errors;
- unhandled promise rejections;
- script/style/iframe resource load errors;
- official Stripe payment-surface timeout;
- unexpected wholesale replacement of the Woo Checkout Block root;
- suspected form-state loss across a root replacement using counts of populated controls only;
- mobile checkout LCP/CLS/load threshold breaches;
- unexpected third-party resources.

The root-replacement diagnostic checks controls only for empty/non-empty or checked state, then transmits aggregate counts. It never captures or transmits field values. DTB does not attempt to reconstruct Woo checkout form state from duplicated browser state; Woo remains the only authoritative form/cart state owner.

The runtime uses a scoped observer on the Woo checkout root plus a bounded 30-second root-identity check. Do not add another permanent document-wide mutation observer for performance monitoring.

## Payment-surface failure recovery

After a bounded timeout, DTB verifies that the official payment block contains an actual provider iframe. Express-wallet iframes elsewhere on the page do not count as card/payment-block readiness.

If the official payment surface is still unavailable:

- record a non-secret `payment_surface_timeout` diagnostic;
- show a visible recovery notice inside the Woo payment block;
- offer `Try express checkout` only when an actual eligible express surface exists;
- always offer `Reload payment options`, preserving the Woo cart/session;
- never create a fallback PaymentIntent, Payment Element, wallet button, Checkout Session, or independent payment submission path.

If the provider surface later appears, the recovery notice is removed.

## Telemetry security and observability

Endpoint:

```text
POST /wp-json/dtb/v1/checkout/runtime-telemetry
```

This endpoint is diagnostics-only. It:

- requires the dedicated checkout telemetry nonce;
- requires same-origin scheme/host/port when an Origin header is present;
- is rate limited;
- deduplicates event IDs for a bounded period;
- allowlists event kinds;
- bounds field lengths and array sizes;
- strips query strings from reported source URLs;
- redacts email addresses, order keys, JWT/bearer tokens, Stripe keys/webhook secrets/client secrets, and Checkout Session secrets before persistence;
- never accepts payment state or changes an order/cart/payment object.

Telemetry writes use DTB logging and are not synchronous external calls.

## Performance testing

Static contract:

```powershell
./scripts/smoke-dtb-checkout-performance.ps1
```

Google PageSpeed Insights mobile shell audit:

```powershell
./scripts/audit-dtb-checkout-pagespeed.ps1 \
  -Url "https://drywalltoolbox.com/checkout/" \
  -OutputPath "artifacts/checkout-pagespeed-mobile.json"
```

For higher API quotas, set `GOOGLE_PAGESPEED_API_KEY` in the operator environment. Never commit the key.

A public PageSpeed run cannot reproduce a shopper-specific WooCommerce cookie/cart session. Treat it as a checkout-shell baseline. Release acceptance must also run an authenticated/session-preserving mobile Lighthouse or WebPageTest flow against staging with a real cart.

Required measurements include:

- server response time/TTFB;
- FCP/LCP;
- CLS;
- total blocking time/long tasks;
- unused/render-blocking JavaScript and CSS;
- checkout third-party requests;
- payment provider load time/failures;
- cart -> checkout navigation timing;
- checkout state preservation during address/shipping recalculation.

## Release gate

Before live acceptance:

1. Frontend lint/build and both checkout smoke scripts pass in a functioning runner.
2. Mobile PageSpeed/Lighthouse evidence is recorded for the release candidate.
3. There are no unexplained third-party checkout hosts.
4. Address/shipping/tax updates do not wholesale-remount checkout or wipe populated fields.
5. Card provider loading, card success/decline, and 3DS/SCA success/cancel/failure are tested.
6. Eligible and ineligible wallet cases are tested.
7. Payment-surface timeout recovery is verified without introducing a second payment authority.
8. Duplicate submit/reload/webhook replay remains idempotent through Woo, `dtb-orders`, Veeqo, QuickBooks, notifications, and tracking.
9. Checkout remains `private/no-store`; optimization must never cache session-owned checkout HTML.
