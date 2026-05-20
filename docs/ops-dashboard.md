# DTB Ops — Order Operations Dashboard

Production-grade WP-Admin observability and management source of truth.

1. Objective

Build a unified WP-Admin operations dashboard for managing and observing product orders and repair orders end to end.

This dashboard is not an external integrations dashboard. It must not include Rewards, Veeqo, QuickBooks, accounting, third-party fulfillment health, or external sync management in this phase.

The dashboard must provide a clean, operator-grade interface for:

Product order tracking
Repair order tracking
Order lifecycle visibility
Repair lifecycle visibility
Customer-safe tracking projections
Internal operator timelines
Local queue/action status
SLA and aging visibility
Manual local admin actions
Audit history

The final result should be a single multi-tab WP-Admin command center under:

WP-Admin → DTB Ops → Order Operations

⸻

2. Scope

2.1 Included

WooCommerce product orders
DTB product-order event ledger
DTB product-order tracking projections
Repair request CPT records
DTB repair event ledger
Repair tracking projections
Local DTB queue/action state
Operator audit logs
Order/repair status management
Order/repair timeline inspection
Manual local projection refreshes
Internal notes
SLA aging indicators
Bulk order/repair actions

2.2 Excluded

Rewards
Veeqo
QuickBooks
Accounting sync
External fulfillment health
External integration retry controls
Credential/config health panels
Rewards liability
Third-party webhook replay
External inventory reservation dashboards

External integration fields may continue existing in backend code, but this dashboard must not surface or manage them in this phase.

⸻

3. Current Foundation

The current codebase already has a strong foundation:

dtb-ops-dashboard.php
  Existing DTB Ops menu, KPI dashboard, audit log, AJAX polling
dtb-order-admin.php
  WooCommerce order columns, order detail timeline, integration-state metaboxes, operator actions
dtb-order-events.php
  wp_dtb_order_events table, product-order event ledger, customer/operator visibility
dtb-order-tracking.php
  Customer-safe product-order tracking projection and REST/SSE endpoints
dtb-repairs.php
  dtb_repair_request CPT, repair REST submit/status/media/SSE/health endpoints
dtb-repair-events.php
  wp_dtb_repair_events table, repair event ledger, customer/operator visibility
dtb-repair-admin.php
  Existing repair admin tooling
dtb-repair-workflows.php
  Repair status machine and transition helpers
dtb-repair-queue.php
  Local repair job handlers

The goal is not to replace these systems. The goal is to consolidate them into a professional operations dashboard while preserving existing functionality.

⸻

4. Target Admin Navigation

WP-Admin
└─ DTB Ops
   ├─ Order Operations
   ├─ Audit Log
   └─ Settings

The Order Operations page should be the main operational interface.

⸻

5. Dashboard Tabs

Order Operations
├─ Overview
├─ Product Orders
├─ Repair Orders
├─ Queue / Actions
└─ Audit Log

⸻

6. Architecture

6.1 Near-Term Current-Codebase Implementation

Before the full mu-plugin rebuild, implement inside existing root-level modules:

wp/wp-content/mu-plugins/
├─ dtb-ops-dashboard.php
├─ dtb-order-admin.php
├─ dtb-order-events.php
├─ dtb-order-tracking.php
├─ dtb-repair-admin.php
├─ dtb-repair-events.php
├─ dtb-repair-workflows.php
├─ dtb-repair-queue.php
└─ dtb-repairs.php

Recommended new files during the current architecture phase:

wp/wp-content/mu-plugins/
├─ dtb-order-operations-dashboard.php
├─ dtb-order-operations-ajax.php
├─ dtb-order-operations-actions.php
└─ dtb-order-operations-read-models.php

6.2 Target Post-Rebuild Module Structure

After the mu-plugin rebuild, move the dashboard into:

wp/wp-content/mu-plugins/dtb-platform/Observability/
├─ OrderOperationsDashboard.php
├─ OrderOperationsController.php
├─ OrderOperationsKpiService.php
├─ OrderOperationsAuditService.php
├─ OrderOperationsQueueInspector.php
├─ OrderOperationsPermissionService.php
└─ OrderOperationsAssetManager.php

Domain-specific read models should live under:

wp/wp-content/mu-plugins/dtb-order-platform/
├─ Admin/
│  ├─ ProductOrderDashboardPanel.php
│  ├─ ProductOrderTimelineDrawer.php
│  └─ ProductOrderBulkActions.php
└─ Services/
   ├─ ProductOrderOpsQueryService.php
   └─ ProductOrderOpsProjectionService.php
wp/wp-content/mu-plugins/dtb-repair-service/
├─ Admin/
│  ├─ RepairOrderDashboardPanel.php
│  ├─ RepairOrderTimelineDrawer.php
│  └─ RepairOrderBulkActions.php
└─ Services/
   ├─ RepairOrderOpsQueryService.php
   └─ RepairOrderOpsProjectionService.php

⸻

7. Data Sources

7.1 Product Orders

WooCommerce orders
wp_dtb_order_events
DTB product-order tracking projection
WooCommerce order status
WooCommerce customer/order metadata
Order line items
Local DTB order queue/action state

7.2 Repair Orders

dtb_repair_request CPT
_repair_status meta
_repair_customer_email
_repair_customer_name
_repair_tool_brand
_repair_model
_repair_serial
_repair_service_tier
_repair_assigned_tech_id
wp_dtb_repair_events
Repair status projection
Repair media attachments
Local DTB repair queue/action state

7.3 Audit

dtb_audit_log
wp_dtb_order_events
wp_dtb_repair_events
operator action events
manual status transition events
manual projection refresh events
bulk action events

⸻

8. Overview Tab

8.1 Purpose

Provide the operator with a real-time operational snapshot of order activity.

8.2 KPI Cards

Orders Today
Open Product Orders
Processing Product Orders
On-Hold Product Orders
Recently Completed Product Orders
Open Repair Orders
Repairs Awaiting Review
Repairs Awaiting Customer
Repairs In Progress
Repairs Ready To Ship
Stale Product Orders
Stale Repair Orders
SLA Warnings
Failed Local Actions
Recent Operator Actions

8.3 Behavior

AJAX refresh on page load
Manual refresh button
Polling every 15–30 seconds
Pause polling when browser tab is hidden
Resume polling when tab becomes visible
Gracefully degrade if a data source is unavailable

8.4 No External Integration Cards

Do not show:

Veeqo Health
QuickBooks Health
Rewards Liability
External Sync Failures
External Webhook Failures

⸻

9. Product Orders Tab

9.1 Purpose

Provide a dedicated management interface for product-order lifecycle and tracking visibility.

9.2 Table Columns

Order ID
Date
Customer
Email
Woo Status
DTB Lifecycle State
Fulfillment Substate
Tracking State
Items
Order Total
Age
Last Event
Last Updated
Actions

9.3 Filters

WooCommerce status
DTB lifecycle state
Fulfillment substate
Tracking state
Stale / aging state
Date range
Customer
Email
Order ID
Tracking number

9.4 Row Actions

View Timeline
View Customer Tracker
Refresh Projection
Refresh Tracking
Add Internal Note
Mark Reviewed
Open WooCommerce Order

9.5 Bulk Actions

Refresh Tracking Projections
Refresh Order Projections
Mark Reviewed
Add Bulk Internal Note
Export Selected

9.6 Explicitly Forbidden Actions

Retry Veeqo Sync
Retry QuickBooks Sync
Recalculate Rewards
Replay External Webhook
Run External Fulfillment Sync

⸻

10. Repair Orders Tab

10.1 Purpose

Provide a dedicated management interface for repair-service lifecycle tracking.

10.2 Table Columns

Repair ID
Submitted Date
Customer
Email
Tool Brand
Model
Serial
Service Tier
Repair Status
Assigned Technician
SLA Age
Last Event
Last Updated
Actions

10.3 Filters

Repair status
Assigned technician
Awaiting customer
SLA warning
SLA breached
Tool brand
Service tier
Date range
Customer
Email
Repair ID
Model
Serial

10.4 Row Actions

View Timeline
View Customer Tracker
View Media
Assign Technician
Add Internal Note
Request Customer Info
Transition Status
Close Repair
Cancel Repair
Open Repair Detail

10.5 Bulk Actions

Assign Technician
Request Customer Info
Transition Status
Close Repairs
Refresh Repair Projections
Add Bulk Internal Note
Export Selected

10.6 Repair Statuses

submitted
reviewed
awaiting_customer
approved
quoted
quote_accepted
quote_declined
parts_allocated
in_progress
ready_to_ship
completed
closed
cancelled

⸻

11. Queue / Actions Tab

11.1 Purpose

Show only local DTB queue/action state relevant to product orders and repair orders.

11.2 Included Job Types

order projection refresh
order tracking projection refresh
repair projection refresh
repair status transition
repair notification
order notification
event projection rebuild
audit log write
local dashboard cache refresh

11.3 Excluded Job Types

Veeqo sync
QuickBooks sync
Rewards issuance
External webhook replay
External fulfillment sync
Accounting sync

11.4 Table Columns

Job ID
Entity Type
Entity ID
Job Type
Status
Attempts
Created At
Last Run
Next Run
Last Error Summary
Actions

11.5 Actions

Retry Local Job
Cancel Local Job
Mark Resolved
Open Linked Product Order
Open Linked Repair Order
View Sanitized Payload

Payload views must redact:

secrets
tokens
credentials
raw webhook bodies
personally excessive customer data
stack traces

⸻

12. Audit Log Tab

12.1 Purpose

Provide a unified operator and lifecycle audit view for product orders and repair orders.

12.2 Included Events

operator login/access-relevant events
manual order actions
manual repair actions
product-order lifecycle events
repair lifecycle events
internal notes
bulk actions
projection refreshes
status transitions
local queue retries
access-denied events

12.3 Filters

Entity type: product_order / repair_order
Entity ID
Actor
Event type
Visibility
Source
Date range
Severity

12.4 Table Columns

Time
Entity Type
Entity ID
Event Type
Actor
Source
Visibility
Summary
Actions

⸻

13. Settings Tab

13.1 Purpose

Expose safe dashboard configuration only.

13.2 Allowed Settings

Polling interval
SLA warning threshold
SLA breach threshold
Default page size
Enabled dashboard tabs
Operator capability mapping
Audit retention days
Display timezone

13.3 Forbidden Settings

Do not expose:

JWT secret
API keys
Webhook secrets
OAuth credentials
WooCommerce consumer secrets
Server-level credentials
Raw environment values

⸻

14. Permissions

14.1 Required Capabilities

Recommended capability:

dtb_manage_order_operations

Fallback during current implementation:

manage_woocommerce

Admin-only settings may require:

manage_options

14.2 Permission Rules

Viewing dashboard requires dtb_manage_order_operations or manage_woocommerce.
Mutating product orders requires manage_woocommerce.
Mutating repair orders requires dtb_manage_repairs or manage_woocommerce.
Viewing audit logs requires manage_options or dtb_manage_order_operations.
Changing dashboard settings requires manage_options.

All AJAX actions must verify:

current user capability
nonce
entity existence
action allowlist
entity type
input schema

⸻

15. Security Requirements

15.1 All Mutations

Every mutation must be:

nonce-protected
capability-gated
input-validated
input-sanitized
audited
idempotent where applicable
safe to retry

15.2 Data Exposure

The dashboard must not expose:

raw secrets
raw tokens
raw payment payloads
raw webhook payloads
stack traces
unredacted exception payloads
private customer data beyond operational need
external integration credentials

15.3 Audit Requirement

Every operator action must write an audit event.

Examples:

order.projection_refreshed
order.marked_reviewed
order.note_added
repair.assigned_technician
repair.status_transitioned
repair.customer_info_requested
repair.closed
repair.cancelled
dashboard.bulk_action_run
queue.local_job_retried
queue.local_job_cancelled

⸻

16. AJAX / REST Contracts

16.1 Admin AJAX Endpoints

Near-term implementation may use admin-ajax.php.

Required actions:

dtb_ops_order_overview
dtb_ops_product_orders
dtb_ops_repair_orders
dtb_ops_order_timeline
dtb_ops_repair_timeline
dtb_ops_order_action
dtb_ops_repair_action
dtb_ops_bulk_order_action
dtb_ops_bulk_repair_action
dtb_ops_local_queue
dtb_ops_audit_log
dtb_ops_settings_save

16.2 Future REST Controllers

After module rebuild:

dtb-platform/Rest/OpsOrderOverviewController.php
dtb-platform/Rest/OpsProductOrdersController.php
dtb-platform/Rest/OpsRepairOrdersController.php
dtb-platform/Rest/OpsLocalQueueController.php
dtb-platform/Rest/OpsAuditController.php

Namespace:

dtb/v1

Routes:

GET  /ops/order-operations/overview
GET  /ops/order-operations/product-orders
GET  /ops/order-operations/repair-orders
GET  /ops/order-operations/product-orders/{id}/timeline
GET  /ops/order-operations/repair-orders/{id}/timeline
POST /ops/order-operations/product-orders/{id}/action
POST /ops/order-operations/repair-orders/{id}/action
POST /ops/order-operations/product-orders/bulk-action
POST /ops/order-operations/repair-orders/bulk-action
GET  /ops/order-operations/local-queue
GET  /ops/order-operations/audit-log
GET  /ops/order-operations/settings
POST /ops/order-operations/settings

⸻

17. UI / UX Requirements

17.1 Layout

Use a tabbed WP-Admin interface:

Overview | Product Orders | Repair Orders | Queue / Actions | Audit Log | Settings

17.2 Interaction Model

Tables support pagination.
Filters apply without full page reload.
Manual refresh button exists on every tab.
Polling only runs on active dashboard tabs.
Polling pauses when browser tab is hidden.
Timeline opens in a drawer/modal.
Operator actions confirm before execution.
Bulk actions show selected count and confirmation.
Errors are shown as safe operator messages.

17.3 Visual Status System

Use consistent badges:

green    = completed / healthy / handled
blue     = active / in progress
yellow   = waiting / pending / stale
red      = failed / breached / cancelled
gray     = closed / unknown / unavailable

Do not rely on color only. Include text labels.

⸻

18. Read Models

18.1 Product Order Row Projection

Each product-order row should return:

{
  "entity_type": "product_order",
  "order_id": 1234,
  "date_created": "2026-05-19T14:22:00Z",
  "customer_name": "Customer Name",
  "customer_email": "customer@example.com",
  "woo_status": "processing",
  "dtb_status": "payment_confirmed",
  "fulfillment_substate": "packed",
  "tracking_state": "tracking_available",
  "item_count": 3,
  "total": "$129.99",
  "age_seconds": 7200,
  "last_event": "order.packed",
  "last_updated_at": "2026-05-19T15:30:00Z"
}

18.2 Repair Order Row Projection

Each repair row should return:

{
  "entity_type": "repair_order",
  "repair_id": 1042,
  "submitted_at": "2026-05-19T15:42:00Z",
  "customer_name": "Customer Name",
  "customer_email": "customer@example.com",
  "brand": "TapeTech",
  "model": "Automatic Taper",
  "serial": "ABC123",
  "service_tier": "standard",
  "repair_status": "in_progress",
  "assigned_technician": "Tech Name",
  "sla_state": "warning",
  "age_seconds": 86400,
  "last_event": "repair.in_progress",
  "last_updated_at": "2026-05-20T10:15:00Z"
}

⸻

19. Operator Action Contracts

19.1 Product Order Actions

Allowed actions:

refresh_order_projection
refresh_tracking_projection
mark_reviewed
add_internal_note

Example request:

{
  "entity_type": "product_order",
  "entity_id": 1234,
  "action": "refresh_tracking_projection",
  "nonce": "..."
}

19.2 Repair Order Actions

Allowed actions:

assign_technician
request_customer_info
transition_status
add_internal_note
refresh_repair_projection
close_repair
cancel_repair

Example request:

{
  "entity_type": "repair_order",
  "entity_id": 1042,
  "action": "transition_status",
  "to_status": "in_progress",
  "note": "Technician started repair.",
  "nonce": "..."
}

19.3 Action Processing Rules

Validate nonce.
Validate capability.
Validate entity exists.
Validate action is allowed.
Validate transition if status-changing.
Write audit event.
Run local mutation or enqueue local job.
Return safe response.
Refresh affected projection.

⸻

20. Local Queue / Action Model

This dashboard should inspect only local dashboard/order/repair jobs.

Recommended local job groups:

dtb_local_order_projection
dtb_local_order_tracking_projection
dtb_local_repair_projection
dtb_local_repair_notification
dtb_local_order_notification
dtb_local_audit
dtb_local_dashboard_refresh

If Action Scheduler is available, use it. If not, degrade to WP-Cron or synchronous safe fallback for lightweight projection refreshes.

Do not surface external sync queues in this dashboard phase.

⸻

21. Implementation Backlog

Phase 1 — Dashboard Shell

[ ] Add Order Operations submenu under DTB Ops
[ ] Add tabbed WP-Admin page shell
[ ] Add inline/admin-enqueued CSS
[ ] Add inline/admin-enqueued JS
[ ] Add nonce bootstrap object
[ ] Add permission guard
[ ] Add manual refresh behavior
[ ] Add polling with Page Visibility pause/resume

Phase 2 — Overview Tab

[ ] Add overview KPI service
[ ] Count open product orders
[ ] Count processing/on-hold/completed product orders
[ ] Count open repair orders
[ ] Count repair statuses
[ ] Add stale product-order detection
[ ] Add stale repair-order detection
[ ] Add SLA warning/breach detection
[ ] Add recent activity feed

Phase 3 — Product Orders Tab

[ ] Build product-order query service
[ ] Build product-order row projection
[ ] Add table rendering
[ ] Add pagination
[ ] Add filters
[ ] Add search
[ ] Add timeline drawer
[ ] Add customer-safe tracker preview
[ ] Add row actions
[ ] Add bulk actions

Phase 4 — Repair Orders Tab

[ ] Build repair-order query service
[ ] Build repair-order row projection
[ ] Add table rendering
[ ] Add pagination
[ ] Add filters
[ ] Add search
[ ] Add repair media preview
[ ] Add timeline drawer
[ ] Add customer-safe tracker preview
[ ] Add technician assignment
[ ] Add repair status transition actions
[ ] Add bulk actions

Phase 5 — Queue / Actions Tab

[ ] Add local queue inspector
[ ] Add pending/failed/completed job table
[ ] Add sanitized payload viewer
[ ] Add retry local job action
[ ] Add cancel local job action
[ ] Add linked entity navigation

Phase 6 — Audit Log Tab

[ ] Aggregate dtb_audit_log
[ ] Aggregate product-order events
[ ] Aggregate repair events
[ ] Add filters
[ ] Add pagination
[ ] Add entity links
[ ] Add event summary formatting

Phase 7 — Settings Tab

[ ] Add safe settings schema
[ ] Add polling interval config
[ ] Add SLA threshold config
[ ] Add page-size config
[ ] Add audit retention config
[ ] Add capability guard
[ ] Add settings save audit event

Phase 8 — Hardening

[ ] Add sanitization for all inputs
[ ] Add escaping for all output
[ ] Add nonce validation for every mutation
[ ] Add capability checks for every endpoint
[ ] Add action allowlists
[ ] Add redaction for payload views
[ ] Add audit events for all manual actions
[ ] Add graceful empty states
[ ] Add failure states
[ ] Add smoke tests

⸻

22. Acceptance Criteria

The dashboard is production-ready when:

1. WP-Admin exposes DTB Ops → Order Operations.
2. The page contains Overview, Product Orders, Repair Orders, Queue / Actions, Audit Log, and Settings tabs.
3. Product Orders tab supports filtering, search, pagination, timeline inspection, tracker preview, row actions, and bulk actions.
4. Repair Orders tab supports filtering, search, pagination, media preview, timeline inspection, tracker preview, technician assignment, status transitions, row actions, and bulk actions.
5. Queue / Actions tab shows only local DTB jobs and excludes external integration syncs.
6. Audit Log tab aggregates operator and lifecycle events for product orders and repair orders.
7. No Rewards, Veeqo, QuickBooks, accounting, or third-party integration dashboard content appears.
8. All mutations are nonce-protected.
9. All mutations are capability-gated.
10. All operator actions write audit events.
11. All output is escaped.
12. All input is validated and sanitized.
13. Dashboard polling pauses when browser tab is hidden.
14. Dashboard degrades gracefully if a subsystem is unavailable.
15. Existing WooCommerce order-detail diagnostics continue working.
16. Existing repair admin screens continue working.
17. No raw secrets, tokens, payment payloads, webhook payloads, or stack traces are shown.
18. Repository smoke checks in Section 24 (frontend lint/build and MU-plugin composition) are documented and pass before rollout.
19. Regression checks show no breakage in existing frontend or MU-plugin composition behavior.

⸻

23. Final Target

The final system should be:

A unified WP-Admin Order Operations dashboard for managing and observing DTB product orders and repair orders end to end, using local order/repair event ledgers, tracking projections, repair CPT state, WooCommerce order state, local queue/action state, and audit logs — without exposing or managing external integrations in this phase.

This gives DTB a focused production-grade operations interface for the two core service flows that matter now:

Product Orders
Repair Orders

⸻

24. Smoke Checks / Regression Verification

Run these before release:

1. Frontend baseline:
   - `cd frontend`
   - `npm install`
   - `npm run lint`
   - `npm run build`
   - Success criteria: both commands exit with status code 0.
2. MU-plugin composition:
   - `pwsh -File scripts/smoke-dtb-mu-modules.ps1`
   - Success criteria: command exits with status code 0 and prints `DTB MU module smoke check passed.`

If any command fails, block rollout and resolve failures before enabling operator-facing dashboard mutations.
