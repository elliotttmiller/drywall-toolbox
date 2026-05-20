#!/usr/bin/env python3
"""
scripts/smoke_dtb_orders.py

Smoke-test the DTB product-ordering API layer.

Checks:
  1. /dtb/v1/orders/health returns ok:true
  2. Unauthenticated /dtb/v1/orders returns 401
  3. Tracking endpoint with invalid order_key returns 403/404
  4. Webhook endpoint with missing signature returns 400/403

Usage:
  python scripts/smoke_dtb_orders.py --base-url https://your-site.com
  python scripts/smoke_dtb_orders.py --base-url https://your-site.com --auth-token YOUR_JWT

Options:
  --base-url      Site base URL (required)
  --auth-token    JWT for authenticated checks (optional)
  --verbose       Print full response bodies
"""

import argparse
import json
import sys
import urllib.request
import urllib.error


def request(url: str, method: str = "GET", headers: dict = None, body: bytes = None) -> tuple[int, dict | None]:
    """Make an HTTP request and return (status_code, json_body)."""
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if body:
        req.data = body

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, None


def check(label: str, status: int, expected_status: int | list[int], body: dict | None = None,
          body_check: dict | None = None, verbose: bool = False):
    """Assert a status code and optional body keys."""
    if isinstance(expected_status, int):
        expected_status = [expected_status]

    ok = status in expected_status
    color = "\033[32m✔" if ok else "\033[31m✘"
    reset = "\033[0m"
    print(f"  {color} {label} — HTTP {status}{reset}")

    if verbose and body is not None:
        print(f"    {json.dumps(body, indent=2)}")

    if not ok:
        return False

    if body_check and isinstance(body, dict):
        for k, v in body_check.items():
            if body.get(k) != v:
                print(f"  \033[31m✘ Body check failed: expected {k}={v}, got {body.get(k)}\033[0m")
                return False

    return True


def main():
    parser = argparse.ArgumentParser(description="DTB Orders smoke test")
    parser.add_argument("--base-url", required=True, help="Site base URL (e.g. https://drywalltoolbox.com)")
    parser.add_argument("--auth-token", default="", help="JWT for authenticated checks")
    parser.add_argument("--verbose", action="store_true", help="Print response bodies")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    api  = f"{base}/wp-json/dtb/v1"
    token = args.auth_token.strip()
    verbose = args.verbose

    results = []

    print("\n[DTB Orders Smoke Test]")
    print(f"  Target: {base}\n")

    # ── 1. Health endpoint ────────────────────────────────────────────────────
    print("1. Health endpoint")
    status, body = request(f"{api}/orders/health")
    results.append(check("GET /dtb/v1/orders/health → 200 ok:true", status, 200, body,
                          body_check={"ok": True}, verbose=verbose))

    # ── 2. Unauth order list ──────────────────────────────────────────────────
    print("\n2. Unauthenticated access")
    status, body = request(f"{api}/orders")
    results.append(check("GET /dtb/v1/orders without auth → 401", status, 401, body, verbose=verbose))

    # ── 3. Tracking with invalid order_key ────────────────────────────────────
    print("\n3. Tracking access control")
    status, body = request(f"{api}/orders/99999999/tracking?order_key=INVALID_KEY")
    results.append(check("GET /dtb/v1/orders/99999999/tracking?order_key=INVALID_KEY → 403 or 404",
                          status, [403, 404], body, verbose=verbose))

    # ── 4. Webhook without signature ─────────────────────────────────────────
    print("\n4. Webhook signature validation")
    body_bytes = b'{"type":"payment_intent.succeeded","data":{"object":{}}}'
    status, body = request(
        f"{api}/webhooks/payment/stripe",
        method="POST",
        headers={"Content-Type": "application/json"},
        body=body_bytes,
    )
    results.append(check("POST /dtb/v1/webhooks/payment/stripe without sig → 400 or 403",
                          status, [400, 403], body, verbose=verbose))

    # ── 5. Authenticated checks (when JWT provided) ───────────────────────────
    if token:
        print("\n5. Authenticated order access")
        auth_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        status, body = request(f"{api}/orders", headers=auth_headers)
        results.append(check("GET /dtb/v1/orders with valid JWT → 200", status, 200, body, verbose=verbose))

        status, body = request(f"{api}/orders/99999999", headers=auth_headers)
        results.append(check("GET /dtb/v1/orders/99999999 (nonexistent) → 403 or 404",
                              status, [403, 404], body, verbose=verbose))
    else:
        print("\n5. (Skipping authenticated checks — no --auth-token provided)")

    # ── Summary ───────────────────────────────────────────────────────────────
    total   = len(results)
    passed  = sum(1 for r in results if r)
    failed  = total - passed

    print(f"\n{'─' * 40}")
    print(f"  Passed: {passed}/{total}")
    if failed:
        print(f"  \033[31mFailed: {failed}/{total}\033[0m")
        sys.exit(1)
    else:
        print("  \033[32mAll checks passed\033[0m")
        sys.exit(0)


if __name__ == "__main__":
    main()
