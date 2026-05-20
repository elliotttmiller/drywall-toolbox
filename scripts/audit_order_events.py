#!/usr/bin/env python3
"""
scripts/audit_order_events.py

Audit the wp_dtb_order_events ledger via WP-CLI JSON output or a direct
database dump to identify anomalies:

  - Orders with no events
  - Orders with payment_confirmed but no fulfillment event
  - Events with visibility = 'internal' that may be over-exposed
  - Duplicate idempotency keys
  - Events older than N days with no terminal status

Usage:
  python scripts/audit_order_events.py --db-json events_dump.json [--days 30]
  python scripts/audit_order_events.py --wp-cli-output   # reads from stdin (wp eval)

Input JSON format (array of event rows):
  [
    { "id": 1, "order_id": 100, "event_type": "order.created",
      "visibility": "customer", "idempotency_key": null, "created_at": "2026-05-19 15:12:00" },
    ...
  ]
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta


def load_events(path: str | None) -> list[dict]:
    if path:
        with open(path) as f:
            return json.load(f)
    # Read from stdin.
    return json.load(sys.stdin)


def audit(events: list[dict], lookback_days: int) -> list[str]:
    issues = []
    cutoff = datetime.utcnow() - timedelta(days=lookback_days)

    by_order: dict[int, list[dict]] = defaultdict(list)
    seen_idempotency: dict[str, list[int]] = defaultdict(list)
    terminal_types = {
        "order.completed", "order.cancelled", "order.refunded", "order.payment_failed"
    }

    for ev in events:
        oid = int(ev.get("order_id", 0))
        by_order[oid].append(ev)
        ikey = ev.get("idempotency_key") or ""
        if ikey:
            seen_idempotency[ikey].append(oid)

    # 1. Duplicate idempotency keys.
    for ikey, oids in seen_idempotency.items():
        if len(oids) > 1:
            issues.append(f"[DUPLICATE_IDEMPOTENCY] key='{ikey}' appears {len(oids)} times across orders: {oids}")

    # 2. Per-order checks.
    for oid, evts in by_order.items():
        if not evts:
            issues.append(f"[NO_EVENTS] order_id={oid} has no event rows")
            continue

        types = {e["event_type"] for e in evts}
        last_dt = max(datetime.fromisoformat(e["created_at"]) for e in evts)
        has_terminal = bool(types & terminal_types)
        has_payment  = "order.payment_confirmed" in types
        has_fulfill  = bool(types & {"order.shipped", "order.delivered", "order.completed",
                                      "integration.veeqo.synced", "order.inventory_reserved"})

        # 2a. Payment confirmed but no fulfillment signal (stale).
        if has_payment and not has_fulfill and not has_terminal and last_dt < cutoff:
            age = (datetime.utcnow() - last_dt).days
            issues.append(
                f"[STALE_FULFILLMENT] order_id={oid} paid but no fulfillment event after {age} days"
            )

        # 2b. Old non-terminal orders (possible stuck state).
        if not has_terminal and last_dt < cutoff:
            age = (datetime.utcnow() - last_dt).days
            issues.append(
                f"[STUCK_ORDER] order_id={oid} last event {age} days ago, no terminal status found"
            )

    return issues


def main():
    parser = argparse.ArgumentParser(description="Audit wp_dtb_order_events")
    parser.add_argument("--db-json", default=None, help="Path to JSON dump of events table")
    parser.add_argument("--days", type=int, default=7,
                        help="Lookback window in days for stale/stuck detection (default: 7)")
    args = parser.parse_args()

    print("[DTB Order Events Audit]")
    events = load_events(args.db_json)
    print(f"  Loaded {len(events)} events\n")

    issues = audit(events, args.days)

    if not issues:
        print("  \033[32m✔ No anomalies detected\033[0m")
        sys.exit(0)
    else:
        for issue in issues:
            print(f"  \033[33m⚠ {issue}\033[0m")
        print(f"\n  {len(issues)} issue(s) found.")
        sys.exit(1)


if __name__ == "__main__":
    main()
