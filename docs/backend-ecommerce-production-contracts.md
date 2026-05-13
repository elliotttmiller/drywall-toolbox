# Backend Ecommerce Production Contracts

This document defines the backend endpoints required to complete the production-grade headless ecommerce architecture.

## 1. Payment Intent Contract

### Endpoint

`POST /wp-json/dtb/v1/checkout/payment-intent`

### Purpose

Create a Stripe PaymentIntent from the authoritative WooCommerce Store API cart total. The frontend must never calculate or submit the payment amount as authority.

### Request

```json
{
  "idempotency_key": "uuid-v4",
  "shipping_rate_id": "dtb_veeqo_rates:standard",
  "billing_address": {},
  "shipping_address": {}
}
```

### Server Responsibilities

- Validate user/session cart.
- Recalculate WooCommerce cart totals.
- Validate selected shipping rate still exists.
- Validate coupons and rewards discounts.
- Create Stripe PaymentIntent using server-side total.
- Attach cart/order metadata.
- Return only `client_secret`, never Stripe secret keys.

### Response

```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "amount": 12345,
  "currency": "usd",
  "cart_hash": "sha256-cart-state",
  "expires_at": 1730000000
}
```

## 2. Finalize Checkout Contract

### Endpoint

`POST /wp-json/dtb/v1/checkout/finalize`

### Purpose

Finalize a WooCommerce order after Stripe payment confirmation.

### Request

```json
{
  "idempotency_key": "uuid-v4",
  "payment_intent_id": "pi_xxx",
  "cart_hash": "sha256-cart-state"
}
```

### Server Responsibilities

- Verify Stripe PaymentIntent status server-side.
- Verify amount paid equals authoritative cart total.
- Verify cart hash did not change after payment intent creation.
- Create/finalize WooCommerce order exactly once.
- Clear server cart after successful order finalization.
- Return order ID, order key, status, and totals.

### Response

```json
{
  "order_id": 1234,
  "order_key": "wc_order_xxx",
  "status": "processing",
  "total": "123.45",
  "currency": "USD"
}
```

## 3. Catalog Brands Contract

### Endpoint

`GET /wp-json/dtb/v1/catalog/brands`

### Response

```json
{
  "brands": [
    {
      "name": "TapeTech",
      "slug": "tapetech",
      "logo": "https://...",
      "product_count": 42,
      "is_visible": true,
      "sort_order": 10
    }
  ]
}
```

## 4. Brand Categories Contract

### Endpoint

`GET /wp-json/dtb/v1/catalog/brands/:brandSlug/categories`

### Response

```json
{
  "brand": {
    "name": "TapeTech",
    "slug": "tapetech"
  },
  "categories": [
    {
      "name": "Finishing Boxes",
      "slug": "finishing-boxes",
      "image": "https://...",
      "product_count": 12,
      "sort_order": 20
    }
  ]
}
```

## 5. Paginated Catalog Products Contract

### Endpoint

`GET /wp-json/dtb/v1/catalog/products`

### Query Parameters

- `brand`
- `category`
- `search`
- `sort`
- `page`
- `per_page`
- `min_price`
- `max_price`
- `stock_status`

### Response

```json
{
  "items": [],
  "page": 1,
  "per_page": 24,
  "total": 120,
  "total_pages": 5,
  "facets": {
    "brands": [],
    "categories": [],
    "stock_statuses": []
  }
}
```

## Security Requirements

- No WooCommerce consumer keys in frontend bundles.
- All privileged WooCommerce calls server-side only.
- Cookie-authenticated mutating endpoints require CSRF/nonces.
- Stripe secret key server-side only.
- Idempotency required for payment/order mutations.
- Rate-limit checkout/payment endpoints.
- Log structured audit events for payment intent creation and order finalization.
