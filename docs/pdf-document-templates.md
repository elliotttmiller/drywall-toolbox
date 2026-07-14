# Drywall Toolbox PDF document templates

Last updated: 2026-07-14.

## Ownership

Drywall Toolbox uses a theme-owned custom template for WP Overnight / WooCommerce PDF Invoices & Packing Slips:

```text
wp/wp-content/themes/drywall-toolbox/woocommerce/pdf/dtb-modern/
```

This is the canonical DTB document presentation layer for invoices and packing slips. Plugin template files under `wp-content/plugins/woocommerce-pdf-invoices-packing-slips/` must not be edited because plugin updates can overwrite them.

## Files

```text
dtb-modern/
  invoice.php
  packing-slip.php
  style.css
  template-functions.php
  README.md
```

- `invoice.php` renders customer/accounting-facing invoices.
- `packing-slip.php` renders fulfillment-facing packing slips.
- `style.css` defines the shared U.S. Letter PDF print system.
- `template-functions.php` contains presentation-only helpers scoped to this PDF template.

## Document boundaries

The PDF template may read already-materialized WooCommerce order and product data. It must not create, update, or synchronize orders, inventory, accounting projections, fulfillment records, payment states, lifecycle events, Action Scheduler jobs, external API calls, or credentials.

System-of-record boundaries remain unchanged:

- WooCommerce owns orders, totals, taxes, payments, products, and customers.
- DTB order platform owns lifecycle events, queues, projections, and duplicate-side-effect boundaries.
- Veeqo owns fulfillment, inventory, labels, tracking, and warehouse execution.
- QuickBooks owns accounting projection after eligible payment/refund events.

## Invoice contract

Invoices should show:

- DTB branding and site URL;
- invoice number, order number, invoice date, order date, payment method, and status;
- billing address, shipping address, and customer contact details;
- product rows with name, quantity, SKU, brand, MPN when available, and line totals;
- WooCommerce-provided totals;
- support/tracking URL and footer.

## Packing slip contract

Packing slips should show:

- DTB branding and site URL;
- order number, order date, shipping method;
- dominant Ship To block;
- product rows with name, SKU/brand/MPN when available, quantity ordered, quantity packed blank, and check box;
- optional customer note;
- packing controls and support URL.

Packing slips intentionally omit prices, payment totals, tax totals, and accounting-facing invoice copy.

## Activation

After deploying the theme files, select the `dtb-modern` template in the WooCommerce PDF Invoices & Packing Slips settings.

The template renders the plugin-configured header logo when present. If no logo is configured, it uses a text Drywall Toolbox wordmark so the documents remain branded without relying on remote images.

## Validation checklist

Generate and visually inspect both invoice and packing slip PDFs for:

- one item / many items;
- long product names;
- product with and without SKU;
- product with and without thumbnail;
- taxable and non-taxable order;
- free shipping and paid shipping;
- paid, payment due, and refunded status;
- customer note present and absent;
- page break behavior on multi-page orders;
- black-and-white print readability.