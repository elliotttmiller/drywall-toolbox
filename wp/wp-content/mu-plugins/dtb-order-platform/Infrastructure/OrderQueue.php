<?php
/**
 * Infrastructure: Order Queue — job enqueue, retry, and all async job handlers.
 *
 * @package drywall-toolbox
 */
defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_ORDER_JOB_MAX_RETRIES' ) ) { define( 'DTB_ORDER_JOB_MAX_RETRIES', 3 ); }
if ( ! defined( 'DTB_ORDER_JOB_RETRY_BASE' ) )  { define( 'DTB_ORDER_JOB_RETRY_BASE', 300 ); }

function dtb_order_enqueue_job( string $job_type, int $order_id, array $args = [], int $delay = 0 ): string|int|false {
if ( '' === $job_type || $order_id <= 0 ) { return false; }
if ( 'dtb_order_send_notification' === $job_type && empty( $args['template'] ) ) { return false; }
$job_args = array_merge( [ 'order_id' => $order_id ], $args );
if ( function_exists( 'as_schedule_single_action' ) ) {
if ( function_exists( 'as_next_scheduled_action' ) ) {
$existing = as_next_scheduled_action( $job_type, [ $order_id, $args ], 'dtb-orders' );
if ( false !== $existing ) { return $existing; }
}
return as_schedule_single_action( time() + max( 0, $delay ), $job_type, [ $order_id, $args ], 'dtb-orders' );
}
$timestamp = time() + max( 0, $delay );
wp_schedule_single_event( $timestamp, $job_type, [ $job_args ] );
return $timestamp;
}

function dtb_order_retry_job( string $job_type, int $order_id, array $args = [] ): bool {
$attempt = isset( $args['attempt'] ) ? (int) $args['attempt'] : 1;
if ( $attempt >= DTB_ORDER_JOB_MAX_RETRIES ) {
error_log( sprintf( '[DTB Orders] Max retries reached for %s on order %d.', $job_type, $order_id ) );
return false;
}
$delay           = DTB_ORDER_JOB_RETRY_BASE * (int) pow( 2, $attempt );
$args['attempt'] = $attempt + 1;
dtb_order_enqueue_job( $job_type, $order_id, $args, $delay );
return true;
}

add_action( 'dtb_order_sync_veeqo', 'dtb_order_job_sync_veeqo', 10, 2 );
function dtb_order_job_sync_veeqo( int $order_id, array $args = [] ): void {
dtb_order_append_event( $order_id, 'integration.veeqo.queued', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator' ] );
$order = wc_get_order( $order_id );
if ( ! $order ) { error_log( "[DTB Orders] dtb_order_job_sync_veeqo: order {$order_id} not found." ); return; }
try {
$result = function_exists( 'dtb_veeqo_sync_order' )
? dtb_veeqo_sync_order( $order_id, $order )
: [ 'status' => 'pending', 'message' => 'Veeqo sync not yet configured.' ];
dtb_order_update_integration_state( $order_id, 'veeqo', [ 'status' => 'synced', 'order_id' => $result['veeqo_order_id'] ?? null, 'tracking' => $result['tracking_number'] ?? null ] );
dtb_order_append_event( $order_id, 'integration.veeqo.synced', [ 'source' => 'cron', 'actor_type' => 'veeqo', 'visibility' => 'operator', 'payload' => [ 'veeqo_order_id' => $result['veeqo_order_id'] ?? null, 'tracking_number' => $result['tracking_number'] ?? null ] ] );
if ( ! empty( $result['tracking_number'] ) ) {
dtb_order_set_fulfillment_substate( $order_id, 'shipped', [ 'tracking_number' => $result['tracking_number'], 'carrier' => $result['carrier'] ?? null ] );
dtb_order_enqueue_job( 'dtb_order_send_notification', $order_id, [ 'template' => 'order-shipped' ] );
} elseif ( ! empty( $result['inventory_reserved'] ) ) {
dtb_order_set_fulfillment_substate( $order_id, 'inventory_reserved' );
}
dtb_order_enqueue_job( 'dtb_order_refresh_tracking_projection', $order_id );
} catch ( Throwable $e ) {
$is_retryable = ! preg_match( '/\b4\d{2}\b/', $e->getMessage() );
dtb_order_update_integration_state( $order_id, 'veeqo', [ 'status' => 'failed', 'error' => $e->getMessage() ] );
dtb_order_append_event( $order_id, 'integration.veeqo.failed', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'error_type' => get_class( $e ) ] ] );
error_log( "[DTB Orders] Veeqo sync failed for order {$order_id}: " . $e->getMessage() );
if ( $is_retryable ) { dtb_order_retry_job( 'dtb_order_sync_veeqo', $order_id, $args ); }
}
}

add_action( 'dtb_order_sync_quickbooks', 'dtb_order_job_sync_quickbooks', 10, 2 );
function dtb_order_job_sync_quickbooks( int $order_id, array $args = [] ): void {
dtb_order_append_event( $order_id, 'integration.quickbooks.queued', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'action' => $args['action'] ?? 'create' ] ] );
$order = wc_get_order( $order_id );
if ( ! $order ) { return; }
try {
$result = function_exists( 'dtb_quickbooks_sync_order' )
? dtb_quickbooks_sync_order( $order_id, $order, $args['action'] ?? 'create' )
: [ 'entity_id' => null, 'message' => 'QuickBooks sync not yet configured.' ];
dtb_order_update_integration_state( $order_id, 'quickbooks', [ 'status' => 'synced', 'entity_id' => $result['entity_id'] ?? null ] );
dtb_order_append_event( $order_id, 'integration.quickbooks.synced', [ 'source' => 'cron', 'actor_type' => 'quickbooks', 'visibility' => 'operator', 'payload' => [ 'entity_id' => $result['entity_id'] ?? null ] ] );
} catch ( Throwable $e ) {
$is_retryable = ! preg_match( '/\b4\d{2}\b/', $e->getMessage() );
dtb_order_update_integration_state( $order_id, 'quickbooks', [ 'status' => 'failed', 'error' => $e->getMessage() ] );
dtb_order_append_event( $order_id, 'integration.quickbooks.failed', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'error_type' => get_class( $e ) ] ] );
error_log( "[DTB Orders] QB sync failed for order {$order_id}: " . $e->getMessage() );
if ( $is_retryable ) { dtb_order_retry_job( 'dtb_order_sync_quickbooks', $order_id, $args ); }
}
}

add_action( 'dtb_order_issue_rewards', 'dtb_order_job_issue_rewards', 10, 2 );
function dtb_order_job_issue_rewards( int $order_id, array $args = [] ): void {
dtb_order_append_event( $order_id, 'integration.rewards.queued', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator' ] );
$order = wc_get_order( $order_id );
if ( ! $order ) { return; }
$status = $order->get_status();
if ( in_array( $status, [ 'cancelled', 'refunded', 'failed' ], true ) ) {
dtb_order_append_event( $order_id, 'integration.rewards.failed', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'reason' => "ineligible_status:{$status}" ] ] );
return;
}
$state = dtb_order_get_integration_state( $order_id );
if ( isset( $state['rewards']['status'] ) && 'issued' === $state['rewards']['status'] ) { return; }
try {
$points_issued = function_exists( 'dtb_rewards_issue_for_order' ) ? (int) dtb_rewards_issue_for_order( $order_id, $order ) : 0;
dtb_order_update_integration_state( $order_id, 'rewards', [ 'status' => 'issued', 'points_issued' => $points_issued ] );
dtb_order_append_event( $order_id, 'integration.rewards.issued', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'points_issued' => $points_issued ] ] );
} catch ( Throwable $e ) {
dtb_order_update_integration_state( $order_id, 'rewards', [ 'status' => 'failed', 'error' => $e->getMessage() ] );
dtb_order_append_event( $order_id, 'integration.rewards.failed', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'error_type' => get_class( $e ) ] ] );
error_log( "[DTB Orders] Rewards issuance failed for order {$order_id}: " . $e->getMessage() );
dtb_order_retry_job( 'dtb_order_issue_rewards', $order_id, $args );
}
}

add_action( 'dtb_order_send_notification', 'dtb_order_job_send_notification', 10, 2 );
function dtb_order_job_send_notification( int $order_id, array $args = [] ): void {
$template = sanitize_key( $args['template'] ?? '' );
if ( '' === $template ) { return; }
$order = wc_get_order( $order_id );
if ( ! $order ) { return; }
try {
$sent = false;
$wc_email_map = [ 'order-confirmation' => 'WC_Email_Customer_Processing_Order', 'order-shipped' => 'WC_Email_Customer_Completed_Order', 'order-cancelled' => 'WC_Email_Customer_Note' ];
if ( isset( $wc_email_map[ $template ] ) ) {
$mailer      = WC()->mailer();
$email_class = $wc_email_map[ $template ];
foreach ( $mailer->get_emails() as $email ) {
if ( is_a( $email, $email_class ) ) { $email->trigger( $order_id, $order ); $sent = true; break; }
}
}
$notification_type = 'notification.' . str_replace( '-', '_', $template ) . '.sent';
dtb_order_append_event( $order_id, $notification_type, [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'customer', 'payload' => [ 'template' => $template, 'sent' => $sent ] ] );
dtb_order_update_integration_state( $order_id, 'notifications', [ 'template' => $template, 'sent' => $sent ] );
} catch ( Throwable $e ) {
error_log( "[DTB Orders] Notification '{$template}' failed for order {$order_id}: " . $e->getMessage() );
dtb_order_retry_job( 'dtb_order_send_notification', $order_id, $args );
}
}

add_action( 'dtb_order_refresh_tracking_projection', 'dtb_order_job_refresh_tracking_projection', 10, 2 );
function dtb_order_job_refresh_tracking_projection( int $order_id, array $args = [] ): void {
if ( function_exists( 'dtb_order_build_tracking_projection' ) ) {
$projection = dtb_order_build_tracking_projection( $order_id );
update_post_meta( $order_id, '_dtb_tracking_projection', $projection );
delete_transient( 'dtb_order_tracking_' . $order_id );
set_transient( 'dtb_order_tracking_' . $order_id, $projection, 5 * MINUTE_IN_SECONDS );
}
}

add_action( 'dtb_order_reconcile_payment', 'dtb_order_job_reconcile_payment', 10, 2 );
function dtb_order_job_reconcile_payment( int $order_id, array $args = [] ): void {
$order = wc_get_order( $order_id );
if ( ! $order ) { return; }
if ( 'pending' === $order->get_status() ) {
dtb_order_append_event( $order_id, 'order.payment_review_required', [ 'source' => 'cron', 'actor_type' => 'system', 'visibility' => 'operator', 'payload' => [ 'reason' => 'pending_past_reconcile_window' ] ] );
}
}

add_action( 'dtb_order_handle_refund', 'dtb_order_job_handle_refund', 10, 2 );
function dtb_order_job_handle_refund( int $order_id, array $args = [] ): void {
$order = wc_get_order( $order_id );
if ( ! $order ) { return; }
$state = dtb_order_get_integration_state( $order_id );
if ( 'issued' === ( $state['rewards']['status'] ?? '' ) ) {
try {
if ( function_exists( 'dtb_rewards_reverse_for_order' ) ) { dtb_rewards_reverse_for_order( $order_id, $order ); }
dtb_order_update_integration_state( $order_id, 'rewards', [ 'status' => 'reversed' ] );
} catch ( Throwable $e ) {
error_log( "[DTB Orders] Reward reversal failed for order {$order_id}: " . $e->getMessage() );
}
}
dtb_order_enqueue_job( 'dtb_order_send_notification', $order_id, [ 'template' => 'refunded' === $order->get_status() ? 'order-refunded' : 'order-cancelled' ] );
}

add_action( 'dtb_order_archive_completed', 'dtb_order_job_archive_completed', 10, 2 );
function dtb_order_job_archive_completed( int $order_id, array $args = [] ): void {
update_post_meta( $order_id, '_dtb_order_archived', current_time( 'mysql', true ) );
delete_transient( 'dtb_order_tracking_' . $order_id );
}
