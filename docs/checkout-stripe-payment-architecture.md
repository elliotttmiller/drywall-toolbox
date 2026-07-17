# Checkout Stripe Embedded Payment Architecture

## Purpose

Drywall Toolbox checkout uses Stripe Embedded Checkout as the storefront checkout UI/workflow authority. React renders the branded checkout shell and cart summary. DTB creates Stripe Checkout Sessions from a server-authoritative WooCommerce cart snapshot, handles Stripe dynamic shipping callbacks, verifies Stripe webhooks, and materializes a WooCommerce order only after Stripe reports a paid Checkout Session.

WooCommerce is the operational order record after verified payment. Veeqo syncs normal WooCommerce processing orders. QuickBooks receives accounting projections after eligible order/refund lifecycle events.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Checkout shell, cart summary, loading/error states | React storefront |
| Embedded checkout form, contact/address/payment UI, wallets, saved methods, localization | Stripe Embedded Checkout |
| Cart snapshot, Checkout Session creation, idempotency, dynamic shipping endpoint, webhook verification, Woo order materialization | DTB MU plugins |
| Product catalog, customer account, materialized order record | WooCommerce |
| Paid-order observation, event ledger, downstream jobs | DTB order platform |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React must never receive Stripe secret keys, webhook secrets, WooCommerce application passwords, Veeqo credentials, QuickBooks credentials, or private integration credentials. Browser code receives only the Stripe publishable key and Stripe Checkout Session client secret.

## Production flow

```text
React /checkout route
  -> GET /wp-json/dtb/v1/checkout/stripe-embedded/config
  -> POST /wp-json/dtb/v1/checkout/stripe-embedded/session
       DTB validates current Woo cart/session
       DTB stores locked checkout snapshot + idempotency key
       DTB creates Stripe Checkout Session with ui_mode=embedded
  -> Stripe Embedded Checkout iframe
       Stripe collects contact, billing, shipping, tax/payment context, payment method, wallets, and saved-method UI
  -> POST /wp-json/dtb/v1/checkout/stripe-embedded/shipping-options
       Stripe onShippingDetailsChange sends { checkoutSessionId, shippingDetails }
       DTB calculates shipping from Woo/DTB policy, not live Veeqo carrier rating
       DTB updates the Stripe Checkout Session shipping details/options
  -> POST /wp-json/dtb/v1/stripe/embedded-checkout/webhook
       DTB verifies Stripe-Signature
       DTB retrieves the Checkout Session from Stripe
       DTB requires payment_status=paid before Woo order creation
       DTB validates DTB session id, Stripe session id, cart hash, amount, and currency
       DTB creates one WooCommerce order with real product/variation line items and SKUs
       DTB stores Stripe payment/session references and marks Woo order paid
  -> WooCommerce payment lifecycle hooks
  -> DTB order event ledger + dtb-orders queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

## Active checkout routes

| Route | Method | Authority |
| --- | --- | --- |
| `/wp-json/dtb/v1/checkout/stripe-embedded/config` | GET | Public checkout runtime config; returns publishable values only |
| `/wp-json/dtb/v1/checkout/stripe-embedded/session` | POST | Creates a Stripe Embedded Checkout Session from the current Woo cart snapshot |
| `/wp-json/dtb/v1/checkout/stripe-embedded/shipping-options` | POST | Handles Stripe dynamic shipping updates using DTB/Woo shipping policy |
| `/wp-json/dtb/v1/checkout/stripe-embedded/status` | GET | Returns verified session/order status for `/checkout/complete` |
| `/wp-json/dtb/v1/stripe/embedded-checkout/webhook` | POST | Public Stripe webhook endpoint protected by Stripe-Signature HMAC |

The old Woo-native checkout/payment-surface endpoints and same-shell Payment Plugins integration were removed from the active bootstrap and deleted from source in this architecture branch.

## Stripe Checkout Session contract

DTB creates Checkout Sessions with:

```text
mode = payment
ui_mode = embedded
redirect_on_completion = always
client_reference_id = DTB checkout session id
metadata.dtb_checkout_session_id = DTB checkout session id
metadata.dtb_cart_hash = locked cart hash
metadata.dtb_idempotency_key = DTB checkout idempotency key
metadata.dtb_customer_id = authenticated customer id, or 0 for guest
metadata.dtb_contract_version = 5
billing_address_collection = required
phone_number_collection.enabled = true
shipping_address_collection.allowed_countries = DTB allowed countries
permissions.update_shipping_details = server_only
return_url = /checkout/complete?stripe_session_id={CHECKOUT_SESSION_ID}
```

Line items are generated from the current server-side WooCommerce cart snapshot. Browser cart values are display-only and are not authoritative.

## Dynamic shipping contract

Stripe Embedded Checkout calls `onShippingDetailsChange` when the customer completes the shipping details form. The runtime payload shape is treated as:

```json
{
  "checkoutSessionId": "cs_...",
  "shippingDetails": {
    "name": "Customer Name",
    "address": {
      "line1": "...",
      "line2": "...",
      "city": "...",
      "state": "...",
      "postal_code": "...",
      "country": "US"
    }
  }
}
```

The frontend sends that shape to DTB as:

```json
{
  "checkout_session_id": "cs_...",
  "shipping_details": { }
}
```

The shipping-options endpoint:

1. retrieves the Stripe Checkout Session from Stripe;
2. validates the DTB checkout session metadata;
3. validates same-cart ownership using the Cart-Token/session hash;
4. calculates shipping using `DTB_CheckoutValidator::shipping_rates_for_current_cart()`;
5. updates the Stripe Checkout Session with `shipping_details` and `shipping_options`;
6. returns `{ "type": "accept" }` or a Stripe-compatible reject action.

These are DTB/Woo policy rates. They are not live Veeqo carrier rates.

## Webhook and order materialization contract

The Stripe webhook endpoint is public only because Stripe cannot present browser credentials. The authorization boundary is the `Stripe-Signature` HMAC using `DTB_STRIPE_WEBHOOK_SECRET`.

Handled events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
refund.created
refund.updated
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
```

For successful sessions, DTB must:

1. verify the Stripe webhook signature with timing-safe comparison;
2. retrieve the Checkout Session from Stripe;
3. require `payment_status=paid`;
4. verify DTB session metadata, Stripe session id, cart hash, amount, and currency;
5. use the checkout-session row as the idempotency/write boundary;
6. create exactly one WooCommerce order with real product/variation line items and SKUs;
7. store Stripe session/payment references on the Woo order;
8. mark the Woo order paid using WooCommerce payment completion;
9. let DTB payment lifecycle observers append events and dispatch `dtb-orders` downstream jobs.

Duplicate webhook deliveries must be idempotent. A second delivery for the same Stripe session or financial event must not create a duplicate Woo order, duplicate note, duplicate event, or duplicate downstream processing dispatch.

## Refund and dispute projection

Stripe refund/dispute events are projected into Woo order metadata, order notes, and the DTB event ledger using Stripe event idempotency. The bridge stores the latest refund/dispute state and amount/reference metadata and leaves operational resolution to the order/finance workflows. It does not create a second order, mutate fulfillment allocation, or call Veeqo directly from the webhook acknowledgement path.

## Configuration

Configure these values outside generated assets and browser code, normally in `wp-config.php` or secure host-level configuration:

```php
define( 'DTB_STRIPE_PUBLISHABLE_KEY', 'pk_...' );
define( 'DTB_STRIPE_SECRET_KEY', 'sk_...' );
define( 'DTB_STRIPE_WEBHOOK_SECRET', 'whsec_...' );
```

The intended Stripe webhook endpoint is:

```text
/wp-json/dtb/v1/stripe/embedded-checkout/webhook
```

No WooCommerce Stripe gateway plugin should be active as the storefront `/checkout` payment authority. Stripe Embedded Checkout is the only storefront checkout/payment UI for this architecture.

## Operational readiness checklist

Before production use, verify:

1. `DTB_STRIPE_PUBLISHABLE_KEY`, `DTB_STRIPE_SECRET_KEY`, and `DTB_STRIPE_WEBHOOK_SECRET` are configured for the intended Stripe mode.
2. Stripe Dashboard has a webhook endpoint pointing to `/wp-json/dtb/v1/stripe/embedded-checkout/webhook`.
3. No competing Woo Stripe gateway is active as the storefront checkout authority.
4. Stripe Embedded Checkout loads on desktop and mobile.
5. Stripe dynamic shipping callback returns shipping methods for supported destinations and rejects unsupported destinations.
6. Card success, 3DS, wallet, failed card, async success/failure, expired session, retry, duplicate webhook delivery, refund, and dispute events are tested.
7. WooCommerce order is created only after a verified paid Stripe session.
8. Woo order contains real product/variation IDs, SKUs, billing/shipping addresses, shipping line, Stripe payment references, and DTB checkout metadata.
9. DTB checkout session state reaches `paid` exactly once per Stripe session.
10. DTB event ledger and `dtb-orders` queue receive exactly one downstream processing dispatch per paid order.
11. Veeqo pulls the WooCommerce processing order and maps order lines by SKU.
12. Refund/dispute projections create only idempotent metadata/notes/events and do not perform synchronous Veeqo or QuickBooks side effects.

## Validation commands

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Backend:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeEmbeddedCheckoutConfig.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeApiClient.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeEmbeddedCheckoutBridge.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Rest/StripeEmbeddedCheckoutRestController.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Rest/StripeEmbeddedCheckoutWebhookController.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Application/StripeEmbeddedCheckoutOrderMaterializer.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because Stripe Embedded Checkout, dynamic shipping callbacks, webhook delivery, wallets, tax behavior, and Veeqo order sync depend on deployed Stripe/WooCommerce/Veeqo configuration.
