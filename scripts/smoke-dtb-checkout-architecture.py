#!/usr/bin/env python3
"""Static production-architecture guard for Drywall Toolbox checkout/payment.

This does not replace runtime Stripe/WooCommerce testing. It prevents source-level
regressions that previously broke checkout ownership, routing, session continuity,
or secret boundaries.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise AssertionError(message)


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        fail(f"Required file missing: {relative}")
    return path.read_text(encoding="utf-8")


def assert_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        fail(f"{label}: missing required contract marker: {needle}")


def assert_not_contains(text: str, needle: str, label: str) -> None:
    if needle in text:
        fail(f"{label}: forbidden legacy/payment marker present: {needle}")


def check_required_and_retired_files() -> None:
    required = [
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeCheckoutRuntime.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Templates/WooNativeCheckoutPage.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php",
        "frontend/src/api/cart.js",
        "frontend/src/pages/WooNativeCheckout.jsx",
        "frontend/src/utils/checkoutUrl.js",
        "drywalltoolbox/.htaccess",
    ]
    for relative in required:
        if not (ROOT / relative).is_file():
            fail(f"Required production checkout file missing: {relative}")

    retired = [
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Infrastructure/CheckoutSessionRepository.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsExpressCheckoutSurface.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsNativeCheckout.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Templates/WooOrderPayRuntime.php",
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/order-pay-runtime.js",
        "frontend/src/components/payments/WooPaymentsExpressCheckout.jsx",
        "frontend/src/utils/paymentUrl.js",
    ]
    for relative in retired:
        if (ROOT / relative).exists():
            fail(f"Retired checkout/payment artifact must remain deleted: {relative}")


def check_native_runtime() -> None:
    runtime = read(
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeCheckoutRuntime.php"
    )
    for marker in [
        "remove_action( 'wp_enqueue_scripts', 'dtb_enqueue_react_app', 10 )",
        "remove_action( 'wp_enqueue_scripts', 'dtb_dequeue_non_react_assets', 9999 )",
        "remove_filter( 'template_include', 'dtb_force_react_template', 99 )",
        "WooNativeCheckoutPage.php",
        "woocommerce_store_api_checkout_order_processed",
        "Cache-Control: private, no-store, no-cache",
    ]:
        assert_contains(runtime, marker, "native checkout runtime")

    template = read(
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Templates/WooNativeCheckoutPage.php"
    )
    for marker in ["wp_head();", "the_content();", "wp_footer();"]:
        assert_contains(template, marker, "native checkout template")
    for forbidden in ["PaymentIntent", "Stripe\\Checkout", "wc_create_order("]:
        assert_not_contains(template, forbidden, "native checkout template")


def check_official_stripe_contract() -> None:
    stripe = read(
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php"
    )
    for marker in [
        "CHECKOUT_GATEWAY = 'woo_native_stripe'",
        "CONTRACT_VERSION = 'woo-stripe-v1'",
        "provider' => 'woocommerce_stripe'",
        "WC_STRIPE_PLUGIN_PATH",
        "/woocommerce-gateway-stripe/",
        "ReflectionClass",
        "_dtb_payment_provider",
        "_dtb_payment_ref",
    ]:
        assert_contains(stripe, marker, "official Stripe checkout contract")

    state = read(
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php"
    )
    assert_contains(state, "'woo_native_stripe' === $gateway", "payment state")
    assert_contains(state, "'woo-stripe-v1' === $contract", "payment state")
    assert_contains(state, "&&", "payment state exact-contract gate")
    assert_contains(state, "'woocommerce_stripe'", "payment provider verification")
    assert_contains(state, "get_date_paid()", "captured payment verification")


def check_cart_session_and_handoff() -> None:
    cart = read("frontend/src/api/cart.js")
    for marker in [
        "credentials: 'include'",
        "USE_CART_TOKEN_SESSION",
        "apiOrigin !== runtimeOrigin",
        "Nonce",
    ]:
        assert_contains(cart, marker, "Store API cart/session")

    handoff = read("frontend/src/pages/WooNativeCheckout.jsx")
    assert_contains(handoff, "getWooCheckoutUrl", "React checkout handoff")
    assert_contains(handoff, "navigateDocument", "React checkout handoff")
    for forbidden in ["PaymentElement", "loadStripe", "clientSecret", "confirmPayment"]:
        assert_not_contains(handoff, forbidden, "React checkout handoff")

    frontend_src = ROOT / "frontend/src"
    forbidden_imports = [
        "@stripe/react-stripe-js",
        "@stripe/stripe-js",
        "loadStripe(",
        "<PaymentElement",
        "<CardElement",
    ]
    for path in frontend_src.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".js", ".jsx", ".mjs", ".cjs"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for marker in forbidden_imports:
            if marker in text:
                fail(f"React payment SDK/runtime regression in {path.relative_to(ROOT)}: {marker}")


def check_routing() -> None:
    htaccess = read("drywalltoolbox/.htaccess")
    required = [
        "RewriteRule ^checkout/?$ wp/index.php?pagename=checkout [QSA,L]",
        "RewriteRule ^checkout/order-pay/([0-9]+)/?$ wp/index.php?pagename=checkout&order-pay=$1 [QSA,L]",
        "RewriteRule ^checkout/order-received/([0-9]+)/?$ wp/index.php?pagename=checkout&order-received=$1 [QSA,L]",
        "wc-api=",
        "RewriteRule ^ index.html [QSA,L]",
    ]
    for marker in required:
        assert_contains(htaccess, marker, "root routing")

    fallback_pos = htaccess.rfind("RewriteRule ^ index.html [QSA,L]")
    if fallback_pos < 0:
        fail("Root SPA fallback not found")
    for marker in required[:-1]:
        if htaccess.find(marker) > fallback_pos:
            fail(f"WooCommerce route appears after SPA fallback: {marker}")


def check_secret_boundaries() -> None:
    url_helper = read(
        "drywalltoolbox/wp/wp-content/mu-plugins/dtb-platform/Support/Url.php"
    )
    assert_contains(url_helper, "'auth_user' => ''", "Woo credential compatibility helper")
    assert_contains(url_helper, "'auth_pass' => ''", "Woo credential compatibility helper")

    candidates = [
        ROOT / ".github/workflows/ci-build.yml",
        ROOT / ".github/workflows/deploy.yml",
        ROOT / "frontend/.env.example",
        ROOT / "frontend/.env.staging",
    ]
    for path in candidates:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if "REACT_APP_STRIPE_PUBLISHABLE_KEY" in text:
            fail(f"Obsolete browser Stripe key injection remains in {path.relative_to(ROOT)}")


def main() -> int:
    checks = [
        check_required_and_retired_files,
        check_native_runtime,
        check_official_stripe_contract,
        check_cart_session_and_handoff,
        check_routing,
        check_secret_boundaries,
    ]
    try:
        for check in checks:
            check()
    except AssertionError as exc:
        print(f"CHECKOUT ARCHITECTURE GUARD: FAIL\n{exc}", file=sys.stderr)
        return 1

    print("CHECKOUT ARCHITECTURE GUARD: PASS")
    print(f"Validated {len(checks)} production checkout/payment invariant groups.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
