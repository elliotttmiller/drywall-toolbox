# HostGator Cookie and Cache Runtime Contract

Last verified against source: 2026-07-14.

## Purpose

Drywall Toolbox runs with the public document root at `/public_html/drywalltoolbox/` while WordPress core lives under `/public_html/drywalltoolbox/wp/`. Root URLs such as `/wp-admin/`, `/wp-login.php`, `/wp-json/*`, `/dtb/*`, and `/checkout/order-pay/*` are intentionally routed into the WordPress subdirectory before the React SPA fallback.

Because WordPress is mounted under `/wp` but exposed through root aliases, cookie path scope and cache bypass rules must be explicit. Otherwise mobile browsers and host-level cache can load the wp-admin login page while WordPress rejects the login test cookie.

## Runtime-only `wp-config.php` constants

`wp-config.php` is not committed to the repository and must not be uploaded from Git. These constants belong in the live server `wp-config.php` before WordPress loads, above the `require_once ABSPATH . 'wp-settings.php';` line:

```php
define( 'WP_HOME', 'https://drywalltoolbox.com' );
define( 'WP_SITEURL', 'https://drywalltoolbox.com/wp' );

define( 'COOKIEPATH', '/' );
define( 'SITECOOKIEPATH', '/' );
define( 'ADMIN_COOKIE_PATH', '/' );
```

The root cookie paths are required because native WordPress admin cookies are issued by WordPress in `/wp` but must be valid for root-mounted `/wp-admin`, `/wp-login.php`, and root `/wp-json` requests.

## Canonical host policy

Use only:

```text
https://drywalltoolbox.com/wp-admin/
https://drywalltoolbox.com/wp-login.php
```

Do not mix `www`, `http`, or direct `/wp/wp-admin/` URLs for operator login. The root `.htaccess` canonicalizes `www.drywalltoolbox.com` to `drywalltoolbox.com` so all native WordPress and DTB cookies stay on one host.

## Cache-bypass policy

The root and WordPress `.htaccess` files intentionally mark these request families as private and non-cacheable:

- `/wp-admin/*`
- `/wp-login.php`
- `/wp-json/*`
- `/dtb/*`
- `/wp-cron.php`
- `/xmlrpc.php`
- `/cart`, `/checkout`, `/account`, `/my-account`, `/orders`, `/addresses`, `/rewards`
- auth/reset/logout paths
- `wc-api` callbacks
- keyed order-pay requests
- query-string REST and order-pay shapes
- requests carrying native WordPress auth cookies or WooCommerce session/cart cookies

The root `.htaccess` also sets `endurance-no-cache=1` for those surfaces so HostGator/Endurance cache is bypassed for admin, login, REST, WooCommerce session, and order-payment requests.

## Cacheable assets

Static React and public assets remain cacheable:

- JS/CSS/manifest/JSON: short public cache with revalidation.
- Images/fonts/PDFs: longer public cache.
- `index.html` and error HTML: no-store/revalidate so manual deployments pick up new asset references.

Do not make the whole site globally no-store. Only dynamic/auth/session/payment surfaces bypass cache.

## Operational update sequence

1. Update live `wp-config.php` constants above `wp-settings.php`.
2. Upload `drywalltoolbox/.htaccess` to `/public_html/drywalltoolbox/.htaccess`.
3. Upload `drywalltoolbox/wp/.htaccess` to `/public_html/drywalltoolbox/wp/.htaccess`.
4. Clear HostGator/server/CDN cache.
5. In the browser, remove old `drywalltoolbox.com` cookies or test in a fresh private session.
6. Open `https://drywalltoolbox.com/wp-login.php`, then `https://drywalltoolbox.com/wp-admin/`.

## Non-goals

- Do not edit or commit `wp-config.php` into Git.
- Do not cache WordPress admin, REST, checkout, cart, account, or payment pages.
- Do not alter WooCommerce payment lifecycle, nonce, tokenization, or callback behavior.
- Do not use broad rewrites that send missing JS/CSS assets to the React SPA shell.
