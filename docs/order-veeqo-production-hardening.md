# Order / Veeqo Production Hardening

## Purpose

This document defines the production-safe operating model for Drywall Toolbox order creation, inventory authority, Veeqo fulfillment, and duplicate-loop containment.

Drywall Toolbox is a headless React + WordPress/WooCommerce contractor platform. React owns the public UX, WordPress/WooCommerce is the commerce backend, and mu-plugins own backend business logic and integrations.

## System-of-record boundaries

```text
React storefront
  -> DTB checkout REST contract
  -> WooCommerce order/payment record
  -> DTB order queue
  -> Veeqo fulfillment/inventory/shipping
  -> WooCommerce tracking/status projection
```

Authoritative ownership:

| Domain | Source of truth | Notes |
| --- | --- | --- |
| Checkout UX | React | No secrets or Veeqo API writes in browser. |
| Payment/order shell | WooCommerce | Orders enter through DTB checkout or approved admin workflows. |
| Inventory | Veeqo | WooCommerce stock is a downstream projection/cache. |
| Fulfillment/shipping/tracking | Veeqo | Veeqo owns warehouse allocation and carrier state. |
| Integration writes | DTB queue | External writes must be idempotent, queued, and observable. |
| Accounting | QuickBooks | Trigger only from confirmed payment/refund events. |

## Hard production rules

1. No external integration may create WooCommerce orders through raw `/wc/v*/orders` REST calls unless explicitly authorized by `DTB_EXTERNAL_ORDER_WRITE_SECRET`.
2. Veeqo must not create WooCommerce orders. WooCommerce orders are created by DTB checkout/admin workflows, then pushed to Veeqo.
3. Veeqo bridge/API2Cart can be used only for channel verification/read-only access unless the integration is intentionally redesigned.
4. Marketplace read models may not materialize into WooCommerce orders unless `DTB_MARKETPLACE_MATERIALIZATION_ENABLED` is explicitly true.
5. Legacy direct Veeqo writes from `woocommerce_order_status_changed` must remain disabled. Veeqo writes belong in the DTB order queue.
6. Duplicate order detection must run across all Woo order creation paths, not just DTB checkout finalization.
7. Duplicate orders must suppress emails, skip integration jobs, and be cancelled/marked against a canonical order.

## Current hardening controls

### `zzz-dtb-order-loop-containment.php`

Location:

```text
drywalltoolbox/wp/wp-content/mu-plugins/zzz-dtb-order-loop-containment.php
```

Responsibilities:

- Blocks direct external WooCommerce REST order creation at `/wc/v1/orders`, `/wc/v2/orders`, and `/wc/v3/orders`.
- Removes risky marketplace materialization and legacy Veeqo direct sync hooks.
- Fingerprints orders by billing/shipping identity, total, payment method, currency, and normalized line items.
- Marks duplicate-loop orders with `_dtb_duplicate_of_order_id` and `_dtb_order_loop_fingerprint`.
- Suppresses duplicate order emails.
- Blocks new DTB Action Scheduler jobs for duplicate orders.
- Auto-cancels duplicates when `DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES` is true.
- Exposes admin diagnostics:

```text
GET  /wp-json/dtb/v1/order-loop/status
POST /wp-json/dtb/v1/order-loop/sweep
```

### `MarketplaceMaterializationQueue.php`

Marketplace order materialization is now disabled by default. Set this only after the importer is proven idempotent in staging:

```php
define( 'DTB_MARKETPLACE_MATERIALIZATION_ENABLED', true );
```

## Required live deployment sequence

1. Upload the updated MU-plugin files to live:

```text
/public_html/drywalltoolbox/wp/wp-content/mu-plugins/zzz-dtb-order-loop-containment.php
/public_html/drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/Marketplace/Jobs/MarketplaceMaterializationQueue.php
```

2. Temporarily disable Veeqo/API2Cart bridge order writes:

```text
/public_html/drywalltoolbox/wp/bridge2cart -> bridge2cart_DISABLED
```

3. Remove or comment any public root bridge alias while verification/order-loop debugging is active.

4. Disable WooCommerce new-order emails temporarily if the inbox is still being flooded.

5. Clear pending scheduled actions for duplicate order IDs:

```text
dtb_marketplace_materialize_unlinked
dtb_marketplace_reconcile
dtb_order_sync_veeqo
dtb_order_sync_quickbooks
dtb_order_send_notification
dtb_order_refresh_tracking_projection
```

6. Run the admin sweep endpoint:

```text
POST /wp-json/dtb/v1/order-loop/sweep
```

7. Confirm status:

```text
GET /wp-json/dtb/v1/order-loop/status
```

## Verification checklist

- No new duplicate order batch appears after 30–40 minutes.
- New duplicates are cancelled and tagged with `_dtb_duplicate_of_order_id`.
- Duplicate customer/admin emails stop.
- Canonical/original test order remains intact.
- Veeqo order creation occurs only through the queued DTB integration path.
- WooCommerce → Status → Logs contains `dtb-order-loop-containment` entries for blocked external writes or contained duplicates.

## Rollback / configuration

Disable the whole containment layer:

```php
define( 'DTB_ORDER_LOOP_CONTAINMENT_ENABLED', false );
```

Narrow controls:

```php
define( 'DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES', false );
define( 'DTB_ORDER_LOOP_DISABLE_MARKETPLACE_MATERIALIZATION', false );
define( 'DTB_ORDER_LOOP_DISABLE_LEGACY_VEEQO_DIRECT_SYNC', false );
define( 'DTB_ORDER_LOOP_BLOCK_WC_REST_ORDER_CREATION', false );
```

Allow a deliberately approved external REST order writer:

```php
define( 'DTB_EXTERNAL_ORDER_WRITE_SECRET', 'generate-a-long-random-secret' );
```

The external client must send:

```text
X-DTB-External-Order-Secret: <secret>
```

## Permanent target architecture

- Remove direct Veeqo status hooks from `VeeqoClient.php` after staging validation.
- Move all Veeqo order writes into the DTB Action Scheduler queue.
- Treat Veeqo inventory as upstream and WooCommerce stock as a projection.
- Keep bridge/API2Cart isolated from order creation.
- Add a WP-admin integration health screen that shows:
  - external order-write blocking status
  - latest duplicate-loop detections
  - latest Veeqo sync status
  - failed queue jobs
  - Veeqo inventory pull status
