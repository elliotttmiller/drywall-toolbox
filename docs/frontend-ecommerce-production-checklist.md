# Frontend Ecommerce Production Checklist

This checklist defines the end-to-end implementation path required to turn the current frontend ecommerce architecture into a production-grade headless WooCommerce storefront.

## Phase 0 — Current High-Risk Gaps

- [x] Make WooCommerce Store API cart state authoritative instead of localStorage-only cart state.
- [ ] Remove any production dependency on frontend-exposed WooCommerce credentials.
- [~] Make checkout totals, tax, discounts, and shipping server-authoritative.
- [ ] Finalize Stripe/payment intent lifecycle against authoritative server totals.
- [~] Finish route-param-driven product browse workflow.
- [ ] Consolidate product/catalog API ownership under `frontend/src/api/*`.
- [~] Add observability, error boundaries, and ecommerce event instrumentation.

## Phase 1 — Cart Authority

### Target

The frontend cart must be a projection of WooCommerce Store API state. LocalStorage may only be used as a temporary offline cache or migration fallback, never as the source of truth.

### Tasks

- [x] Refactor `frontend/src/context/CartContext.jsx` to initialize from `initCart()` / `getCart()`.
- [x] Normalize WooCommerce Store API cart items into the existing UI item shape.
- [x] Route all add-to-cart actions through Store API `addToCart()`.
- [x] Route all quantity updates through Store API `updateCartItem()`.
- [x] Route all removals through Store API `removeCartItem()`.
- [x] Persist only a fallback snapshot locally after successful server reconciliation.
- [x] Add mutation status flags: `isLoading`, `isMutating`, `error`, `lastSyncedAt`.
- [x] Add optimistic update rollback for failed mutations.
- [ ] Add guest-cart-to-account-cart merge workflow on login.
- [x] Ensure cart item keys use WooCommerce Store API item keys, not only local IDs.
- [x] Ensure variation items use the selected variation ID plus exact attributes.

### Acceptance Criteria

- [x] Refreshing the page restores cart from WooCommerce Store API session.
- [~] Cart totals shown in header/sidebar/cart page match WooCommerce totals.
- [x] Stale localStorage data cannot override server cart state.
- [x] Failed cart mutations show recoverable UI errors.
- [x] Variant items remain distinct and update/remove correctly.

## Phase 2 — Checkout Authority

### Target

Checkout must use server-authoritative totals and an explicit payment/order state machine.

### Tasks

- [~] Stop using `subtotal * 0.08` as production tax authority.
- [~] Pull subtotal, tax, discounts, shipping, and total from Store API cart totals.
- [ ] Convert `syncAndPlace()` into a fallback/recovery path only.
- [ ] Add server endpoint for creating Stripe PaymentIntents from authoritative cart totals.
- [ ] Confirm selected shipping rate still exists before creating payment intent.
- [ ] Prevent order placement if server cart changed after payment intent creation.
- [ ] Add idempotency keys for order/payment requests.
- [ ] Clear cart only after confirmed successful order creation/payment confirmation.
- [ ] Add explicit states: `idle`, `validating`, `rating`, `creating_payment_intent`, `confirming_payment`, `placing_order`, `complete`, `failed`.

### Acceptance Criteria

- [ ] Payment amount always matches server-side WooCommerce cart total.
- [ ] Checkout cannot place an order using stale browser-side totals.
- [ ] Failed payment does not clear cart.
- [ ] Failed order creation is recoverable.
- [ ] Duplicate submission is prevented with idempotency.

## Phase 3 — Product Browse Routing

### Target

The product browse workflow must be fully URL-derived and refresh-safe.

### Tasks

- [~] Derive selected brand from `/products/brands/:brandSlug` route params.
- [ ] Derive selected category from `/products/brands/:brandSlug/categories/:categorySlug` route params.
- [ ] Replace local-only `selectedDisplayCategory` with route-derived state.
- [~] Replace `/products?brand=...` as canonical navigation with route paths.
- [ ] Preserve legacy query URLs as redirects or compatibility fallbacks.
- [ ] Add `frontend/src/utils/catalogRoutes.js`.
- [x] Add `resolveProductBackTarget()` for PDP return navigation.
- [ ] Add breadcrumbs generated from route params and workflow state.

### Acceptance Criteria

- [ ] Brand/category/product workflow survives refresh.
- [ ] Browser back returns from PDP to category listing when available.
- [ ] Legacy `/products?brand=...` still resolves safely.
- [ ] No drilldown step depends on ephemeral local state.

## Phase 4 — Catalog Data Scalability

### Target

Catalog listing should be backend-filtered and paginated, not full-catalog client-filtered.

### Tasks

- [ ] Add backend endpoints for brands, brand categories, and products.
- [ ] Support server-side `brand`, `category`, `search`, `sort`, `page`, `per_page`, `stock`, and `price` filters.
- [ ] Replace broad `getProducts()` catalog loads with paginated queries.
- [ ] Move brand/category card counts to backend response.
- [ ] Add canonical category image/metadata source.
- [ ] Add cache key strategy for catalog queries.

### Acceptance Criteria

- [ ] Product listing does not require loading the entire catalog.
- [ ] Product counts are accurate and backend-derived.
- [ ] Search/sort/filter responses remain performant at large catalog size.

## Phase 5 — API Consolidation

### Target

All ecommerce API calls should be owned under `frontend/src/api/*`.

### Tasks

- [ ] Move product normalization from `frontend/src/services/api.js` into `frontend/src/api/products.js` or dedicated normalizers.
- [ ] Move catalog calls from `frontend/src/services/catalog.js` into `frontend/src/api/catalog.js`.
- [ ] Keep compatibility exports temporarily during migration.
- [ ] Remove frontend WooCommerce Basic Auth usage from production paths.
- [ ] Route privileged WooCommerce calls through backend proxy endpoints only.
- [ ] Add shared error envelope handling for all API domains.

### Acceptance Criteria

- [ ] Product, cart, checkout, auth, rewards, and customer calls use one API client strategy.
- [ ] No production bundle includes WooCommerce privileged credentials.
- [ ] All API errors are normalized for UI handling.

## Phase 6 — SEO and Structured Data

### Target

Every indexable ecommerce page should have deliberate canonical, metadata, and schema behavior.

### Tasks

- [ ] Define index/noindex rules for brand/category/search/filter URLs.
- [ ] Add self-canonical URLs for indexable brand and category pages.
- [~] Add parent/variant canonical policy for `/products/:slug?variant=...`.
- [~] Add AggregateOffer for variable parent products.
- [~] Add concrete Offer schema for selected variants.
- [ ] Add breadcrumb schema for brand/category/PDP flows.
- [~] Generate variation-aware OG images where variation media exists.

### Acceptance Criteria

- [~] Parent product schema is valid for variable products.
- [~] Selected variant schema is valid for concrete offers.
- [ ] Filter/search URLs do not create duplicate-index bloat.

## Phase 7 — Observability and Analytics

### Target

The storefront must expose production telemetry for failures, performance, and ecommerce funnel events.

### Tasks

- [x] Add a global React error boundary.
- [ ] Add route-level error fallbacks.
- [~] Add API error logging hook.
- [ ] Add checkout failure logging.
- [ ] Add product 404 tracking.
- [~] Add ecommerce events: `view_item_list`, `select_item`, `view_item`, `select_variant`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `search`, `view_category`.
- [x] Normalize event item payloads across catalog/PDP/cart/checkout.

### Acceptance Criteria

- [~] Critical frontend exceptions are captured with route/user/cart context.
- [ ] Checkout failures are measurable.
- [~] Conversion funnel events are consistently emitted.

## Phase 8 — Accessibility and UX

### Target

Core ecommerce interactions must meet production accessibility and usability expectations.

### Tasks

- [ ] Convert variant chips to `radiogroup` / `radio` semantics.
- [ ] Add arrow-key navigation for variant chip groups.
- [ ] Add cart/sidebar focus trap and Escape behavior verification.
- [ ] Announce add-to-cart events through screen-reader live region.
- [ ] Add checkout validation summary with focus management.
- [ ] Ensure loading states are announced when checkout/cart mutations occur.

### Acceptance Criteria

- [ ] Keyboard-only users can select variants and complete checkout.
- [ ] Screen readers receive useful status updates.
- [ ] Checkout validation errors are accessible.

## Phase 9 — Testing and Release Gates

### Target

Production ecommerce flows need automated coverage before release.

### Tasks

- [ ] Add unit tests for variation matching and URL selection.
- [ ] Add unit tests for cart normalization and mutation reducers.
- [ ] Add integration tests for Store API cart sync.
- [ ] Add E2E tests for PLP → PDP → select variation → add to cart → checkout.
- [ ] Add E2E test for browser back from PDP to product category.
- [ ] Add E2E test for failed cart mutation recovery.
- [ ] Add E2E test for failed payment recovery.
- [ ] Add CI gate for build/lint/test.

### Acceptance Criteria

- [ ] Core revenue path is covered by E2E tests.
- [ ] Failed mutation/payment paths are tested.
- [ ] PRs cannot merge without passing frontend production checks.
