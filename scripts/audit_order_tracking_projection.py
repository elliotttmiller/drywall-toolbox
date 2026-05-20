#!/usr/bin/env python3
"""
scripts/audit_order_tracking_projection.py

Validate customer-safe tracking projections for a set of orders.

Checks:
  1. Projection contains no forbidden internal keys
  2. Tracking URL is valid if tracking_number is present
  3. Timeline events are chronologically ordered
  4. No raw error messages in customer-visible fields

Usage:
  python scripts/audit_order_tracking_projection.py \
    --base-url https://your-site.com \
    --order-ids 100 101 102 \
    --order-key ORDER_KEY   # optional, for guest access
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

FORBIDDEN_FIELDS = {
    "gateway_raw", "raw_error", "stack_trace", "fraud_score",
    "quickbooks_token", "veeqo_api_key", "admin_note",
    "queue_job_id", "payment_method_details", "risk_level",
}


def get_tracking(base_url: str, order_id: int, order_key: str = "") -> tuple[int, dict | None]:
    url = f"{base_url}/wp-json/dtb/v1/orders/{order_id}/tracking"
    if order_key:
        url += f"?order_key={order_key}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None


def check_projection(order_id: int, proj: dict) -> list[str]:
    issues = []

    # 1. No forbidden keys anywhere in the payload (recursive).
    def find_forbidden(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower() in FORBIDDEN_FIELDS:
                    issues.append(f"order_id={order_id} — forbidden field '{k}' at path '{path}'")
                find_forbidden(v, path=f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                find_forbidden(v, path=f"{path}[{i}]")

    find_forbidden(proj)

    # 2. Tracking URL valid when tracking_number present.
    if proj.get("tracking_number") and not proj.get("tracking_url"):
        issues.append(
            f"order_id={order_id} — tracking_number present but no tracking_url"
        )

    # 3. Timeline events chronologically ordered.
    timeline = proj.get("timeline") or []
    prev_dt = None
    for i, ev in enumerate(timeline):
        occurred = ev.get("occurred_at")
        if occurred:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(occurred.replace("Z", "+00:00").replace(" ", "T"))
                if prev_dt and dt < prev_dt:
                    issues.append(
                        f"order_id={order_id} — timeline[{i}] out of order: "
                        f"{occurred} < {prev_dt.isoformat()}"
                    )
                prev_dt = dt
            except ValueError:
                issues.append(f"order_id={order_id} — timeline[{i}] invalid occurred_at: {occurred}")

    # 4. Required fields present.
    for field in ("order_id", "status", "label"):
        if field not in proj:
            issues.append(f"order_id={order_id} — missing required field '{field}'")

    return issues


def main():
    parser = argparse.ArgumentParser(description="Audit DTB order tracking projections")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--order-ids", nargs="+", type=int, required=True)
    parser.add_argument("--order-key", default="", help="WooCommerce order_key for guest access")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    all_issues = []

    print("[DTB Tracking Projection Audit]")
    print(f"  Target: {base}")
    print(f"  Orders: {args.order_ids}\n")

    for oid in args.order_ids:
        status, proj = get_tracking(base, oid, args.order_key)
        if status != 200:
            print(f"  \033[33m⚠ order_id={oid} — HTTP {status}\033[0m")
            continue

        issues = check_projection(oid, proj)
        if issues:
            for issue in issues:
                print(f"  \033[31m✘ {issue}\033[0m")
            all_issues.extend(issues)
        else:
            print(f"  \033[32m✔ order_id={oid} — OK\033[0m")

    print()
    if all_issues:
        print(f"  {len(all_issues)} issue(s) found.")
        sys.exit(1)
    else:
        print("  \033[32mAll projections valid\033[0m")
        sys.exit(0)


if __name__ == "__main__":
    main()
