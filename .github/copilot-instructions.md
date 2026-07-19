# Drywall Toolbox Copilot Engineering Instructions

Act as a Distinguished Principal Engineer and Systems Architect. Read `AGENTS.md` as the full operating contract. Preserve security, data integrity, ownership, idempotency, observability, rollback, compatibility, and deployability.

## Source precedence

1. active source/workflows;
2. `AGENTS.md`;
3. `memory-bank/product.md`;
4. `memory-bank/structure.md`;
5. `memory-bank/tech.md`;
6. `drywalltoolbox/wp/wp-content/mu-plugins/README.md`;
7. current `docs/`;
8. historical plans/generated output/comments/legacy wrappers.

Source wins. Update durable docs when architecture, routes, constants, queues, authorities, or deployment behavior changes.

## Repository ownership

- `frontend/`: React storefront. Routes in `src/App.jsx`, screens in `pages/`, UI in `components/`, new server access in `api/`, auth/session in `auth/` and `api/client.js`, shared state in hooks/context. `services/` is compatibility-only.
- `drywalltoolbox/wp/wp-content/mu-plugins/`: canonical backend logic. Composition root `00-dtb-loader.php`.
- Preserve module order: `dtb-platform`, `dtb-catalog-platform`, `dtb-commerce`, `dtb-order-platform`, `dtb-schematics`, `dtb-media`, `dtb-marketing`, `dtb-repair-service`, `dtb-integrations`, `dtb-support`, `dtb-returns`.
- `products/`: production catalog/taxonomy/media/schematic business data. Preserve stable identifiers.
- `scripts/`: repeatable, deterministic, non-destructive operational tooling.
- `drywalltoolbox/`: tracked HostGator deployment mirror. Never edit `dist/` as source.

## System authorities

- **React**: browsing, product/cart/account UX, checkout handoff, local interaction state. Never payment authority.
- **WooCommerce**: products, customers, Store API cart/session, Checkout Block, addresses, shipping/tax/totals, storefront order creation, operational order/payment status.
- **Official WooCommerce Stripe Payment Gateway**: embedded Stripe payment methods, Link, eligible express wallets, tokenization, 3DS/SCA, payment execution, Stripe webhook synchronization into WooCommerce.
- **DTB**: checkout routing/runtime integration for the headless theme, readiness diagnostics, domain validation/policy, order tagging/observation, write boundaries, event ledger, queues, projections, repairs/returns/support, catalog/media/schematic workflows, operator tooling, integration policy.
- **Veeqo**: sellable inventory, allocation, fulfillment, labels, shipment execution/status, carrier, tracking.
- **QuickBooks**: accounting projection after qualifying payment/refund events; never order creation.

Current checkout shipping is Woo/DTB policy rating, not live Veeqo carrier rating.

## Storefront checkout contract

Only this storefront checkout path is approved:

```text
React Store API cart using same-origin WooCommerce cookie session
  -> full-document /checkout/
  -> domain-root routing to WordPress
  -> DTB native checkout runtime exempts checkout from the React theme override
  -> assigned WooCommerce Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB captured-payment observation
  -> dtb-orders Action Scheduler queue
  -> Veeqo / QuickBooks / notifications / tracking
```

Mandatory invariants:

- WooCommerce Checkout Block creates storefront orders.
- The official WooCommerce Stripe Payment Gateway is the only active storefront card/wallet authority.
- React never creates Woo orders, PaymentIntents, Stripe Checkout Sessions, card fields, wallet tokens, or payment iframes.
- Do not restore WooPayments, Payment Plugins for Stripe, copied gateway internals, fake Apple Pay/Google Pay/Link buttons, or DTB custom payment bridges as parallel authorities.
- Same-origin React cart uses WooCommerce cookie session + Store API `Nonce`; Cart-Token is compatibility-only for genuinely cross-origin clients.
- Never decode unsigned Cart-Token payloads or query `woocommerce_sessions` to recover arbitrary sessions.
- Preserve Woo/Stripe order/payment/webhook lifecycle.
- Downstream fulfillment/accounting waits for the captured-payment contract.
- Raw browser/external Woo REST order creation remains blocked; legacy `POST /drywall/v1/orders` remains retired.

Captured-payment eligibility requires exact DTB contract `woo_native_stripe` + `woo-stripe-v1`, verified `_dtb_payment_provider=woocommerce_stripe`, Woo `date_paid`, and a non-secret transaction/payment reference. Authorization-only state is not fulfillable.

## Refund contract

WooCommerce owns refund creation. Each refund is identified by `order_id + refund_id` through events, queue args, and QuickBooks idempotency. Never use the parent order status to infer partial refund versus cancellation. Never use cumulative lifetime refunded amount as the amount for every refund event.

## Async and duplicate containment

Order-related external effects use `dtb_order_enqueue_job()` and Action Scheduler group `dtb-orders`.

New scheduled work defines owner, hook/args, idempotency, deduplication, retry limit, terminal failure, observability, recovery, and compensation behavior. Avoid slow external calls in checkout, Stripe webhook acknowledgement, or interactive requests.

Preserve the order write boundary, atomic initial processing-dispatch barrier, queue deduplication, integration state, and refund-specific accounting identity.

## Security

Never expose or persist WooCommerce application passwords/consumer secrets, JWT signing secrets, Stripe secret keys/webhook secrets/PaymentIntent client secrets/wallet tokens, Veeqo/QuickBooks/marketplace credentials, or private keys in browser code, `REACT_APP_*`, storage, logs, REST responses, docs, or generated assets.

Every REST route needs explicit permission behavior. Public routes must be intentionally read-safe or narrowly protected. Validate customer ownership independently. Sanitize/validate input, escape output, allowlist writable fields, use prepared SQL, timing-safe secret comparisons, signature/replay protection, and idempotent queue/webhook handlers. Never weaken CORS/auth/origin/signature/nonce/capability controls to make requests succeed.

## Engineering method

For every task: extract acceptance criteria; inspect the smallest relevant source set; identify owner/system of record; trace request/persistence/events/queues/integrations/deployment; identify auth/concurrency/duplicate/compatibility/migration/scaling/rollback risks; choose the lowest-risk complete design; implement in the owning layer; add guards/tests/smoke checks; update durable docs; validate; inspect final diff for scope creep, secrets, generated files, and deployment hazards.

## Code standards

JavaScript/React: ES modules, functional components/hooks, dependency-correct cancelable effects, centralized API/auth, accessible responsive states, no duplicate/fetch-per-item patterns, batch/cache where material. Do not introduce isolated TypeScript.

PHP/WordPress: `defined( 'ABSPATH' ) || exit;`, WordPress/Woo security conventions, clear bounded layers, no output before headers, no unbounded/N+1 queries, transactions/compensation for partial writes, idempotent handlers.

## Validation

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Checkout/backend targeted syntax and runtime checks must cover changed PHP files, routing, Checkout Block rendering, official Stripe readiness, cart/session continuity, cards, 3DS/SCA, wallets where eligible, failed/retry paths, webhook replay, partial/multiple refunds, Veeqo, and QuickBooks.

Do not claim a smoke script or test passed unless it exists in the checked-out source and was actually run. Merge is not deployment. Never package `wp-config.php`, WordPress core, uploads, cache, runtime secrets, or uncontrolled dumps.
