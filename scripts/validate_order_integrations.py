#!/usr/bin/env python3
"""
scripts/validate_order_integrations.py

Validates that all required integration configuration is present and reachable:
  - Stripe webhook secret configured
  - Veeqo API key configured
  - QuickBooks client credentials configured
  - wp_dtb_order_events table exists (via /dtb/v1/orders/health)

Usage:
  python scripts/validate_order_integrations.py --base-url https://your-site.com
"""

import argparse
import json
import sys
import urllib.request
import urllib.error


def get_health(base_url: str) -> tuple[int, dict | None]:
    url = f"{base_url}/wp-json/dtb/v1/orders/health"
    try:
        with urllib.request.urlopen(url) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None
    except Exception as e:
        print(f"  \033[31mNetwork error: {e}\033[0m")
        return 0, None


def main():
    parser = argparse.ArgumentParser(description="Validate DTB order integration config")
    parser.add_argument("--base-url", required=True)
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    print("[DTB Order Integration Validation]")
    print(f"  Target: {base}\n")

    status, health = get_health(base)

    if health is None:
        print("  \033[31m✘ Could not reach health endpoint\033[0m")
        sys.exit(1)

    print(f"  HTTP {status}")

    checks = [
        ("woocommerce",  health.get("woocommerce"),  "WooCommerce active"),
        ("payments",     health.get("payments"),     "Default payment gateway configured"),
        ("queue",        health.get("queue"),        "Action Scheduler available"),
        ("veeqo",        health.get("veeqo"),        "Veeqo configured"),
        ("quickbooks",   health.get("quickbooks"),   "QuickBooks configured"),
        ("rewards",      health.get("rewards"),      "Rewards integration available"),
        ("events_table", health.get("events_table"), "wp_dtb_order_events table exists"),
    ]

    all_ok = True
    for key, ok, label in checks:
        icon = "\033[32m✔" if ok else "\033[31m✘"
        print(f"  {icon} {label}\033[0m")
        if not ok:
            all_ok = False

    print()
    if not all_ok:
        print("  \033[31mIntegration validation failed — review configuration above.\033[0m")
        sys.exit(1)
    else:
        print("  \033[32mAll integration checks passed.\033[0m")
        sys.exit(0)


if __name__ == "__main__":
    main()
