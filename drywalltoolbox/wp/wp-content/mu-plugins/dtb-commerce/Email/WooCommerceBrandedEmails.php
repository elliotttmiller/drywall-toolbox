<?php
/**
 * WooCommerce Branded Email Integration
 *
 * Wraps WooCommerce order emails with the DTB branded email template system.
 *
 * @package DrywalltoolboxCommerce
 */

namespace DTB\Commerce\Email;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Initialize WooCommerce branded email hooks.
 *
 * @return void
 */
function dtb_commerce_init_wc_branded_emails(): void {
	if ( ! function_exists( 'WC' ) || ! function_exists( 'dtb_render_branded_email' ) ) {
		return;
	}

	add_action( 'woocommerce_email_header', 'DTB\\Commerce\\Email\\dtb_commerce_wc_email_header_capture', 1 );
	add_action( 'woocommerce_email_footer', 'DTB\\Commerce\\Email\\dtb_commerce_wc_email_footer_wrap', 999 );
}
add_action( 'init', 'DTB\\Commerce\\Email\\dtb_commerce_init_wc_branded_emails' );

/**
 * Start output buffering to capture WooCommerce email content.
 *
 * @param string $email_heading Email heading.
 * @return void
 */
function dtb_commerce_wc_email_header_capture( $email_heading ): void {
	global $dtb_wc_email_capture;

	if ( ! dtb_commerce_should_brand_current_email() ) {
		return;
	}

	$dtb_wc_email_capture = [
		'heading' => $email_heading,
		'start'   => true,
	];

	ob_start();
}

/**
 * End output buffering and wrap content in branded template.
 *
 * @return void
 */
function dtb_commerce_wc_email_footer_wrap(): void {
	global $dtb_wc_email_capture, $email;

	if ( empty( $dtb_wc_email_capture['start'] ) ) {
		return;
	}

	$wc_content = ob_get_clean();

	if ( ! $wc_content ) {
		return;
	}

	$order      = null;
	$order_id   = 0;
	$email_id   = is_object( $email ) && isset( $email->id ) ? $email->id : '';
	$heading    = $dtb_wc_email_capture['heading'] ?? '';
	$user_email = '';

	// Extract order from WC email object
	if ( is_object( $email ) && isset( $email->object ) && is_a( $email->object, 'WC_Order' ) ) {
		$order      = $email->object;
		$order_id   = $order->get_id();
		$user_email = $order->get_billing_email();
	}

	$email_config = dtb_commerce_get_email_config( $email_id, $order );

	$branded_html = dtb_render_branded_email(
		[
			'title'       => $email_config['title'],
			'preheader'   => $email_config['preheader'],
			'eyebrow'     => $email_config['eyebrow'],
			'greeting'    => $email_config['greeting'],
			'intro'       => $email_config['intro'],
			'body_html'   => $wc_content,
			'details'     => $email_config['details'],
			'cta_url'     => $email_config['cta_url'],
			'cta_label'   => $email_config['cta_label'],
			'signoff'     => 'The Drywall Toolbox Team',
			'footer_note' => 'Questions about your order? Reply to this email or contact our support team.',
			'theme'       => 'auto',
		]
	);

	echo $branded_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

	unset( $dtb_wc_email_capture );
}

/**
 * Determine if the current email should be branded.
 *
 * @return bool
 */
function dtb_commerce_should_brand_current_email(): bool {
	global $email;

	if ( ! is_object( $email ) || ! isset( $email->id ) ) {
		return false;
	}

	// Only brand customer-facing emails
	$customer_emails = [
		'customer_processing_order',
		'customer_completed_order',
		'customer_on_hold_order',
		'customer_refunded_order',
		'customer_invoice',
		'customer_note',
		'customer_reset_password',
		'customer_new_account',
	];

	return in_array( $email->id, $customer_emails, true );
}

/**
 * Get email configuration based on email type and order.
 *
 * @param string        $email_id Email ID.
 * @param \WC_Order|null $order    Order object.
 * @return array<string,mixed>
 */
function dtb_commerce_get_email_config( string $email_id, $order ): array {
	$order_number = $order ? $order->get_order_number() : '';
	$order_id     = $order ? $order->get_id() : 0;
	$view_url     = $order_id ? esc_url( home_url( "/dashboard?tab=orders&order={$order_id}" ) ) : '';
	$customer     = $order ? $order->get_formatted_billing_full_name() : '';
	$first_name   = $order ? $order->get_billing_first_name() : '';
	$greeting     = $first_name ? "Hi {$first_name}," : 'Hi there,';

	$defaults = [
		'title'      => 'Order Update',
		'preheader'  => 'Your Drywall Toolbox order has been updated',
		'eyebrow'    => 'Order Notification',
		'greeting'   => $greeting,
		'intro'      => '',
		'details'    => [],
		'cta_url'    => $view_url,
		'cta_label'  => 'View Order Details',
	];

	switch ( $email_id ) {
		case 'customer_processing_order':
			return array_merge(
				$defaults,
				[
					'title'      => 'Order Confirmed',
					'preheader'  => "Order #{$order_number} confirmed – We're preparing your items",
					'eyebrow'    => 'Order Confirmation',
					'intro'      => "Thank you for your order! We've received it and are preparing your items for shipment.",
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
						[ 'label' => 'Order Date', 'value' => $order->get_date_created()->date_i18n( 'F j, Y' ) ],
						[ 'label' => 'Total', 'value' => $order->get_formatted_order_total() ],
					] : [],
				]
			);

		case 'customer_completed_order':
			return array_merge(
				$defaults,
				[
					'title'      => 'Order Shipped',
					'preheader'  => "Order #{$order_number} has been shipped and is on its way",
					'eyebrow'    => 'Order Update',
					'intro'      => 'Great news! Your order has been shipped and is on its way to you.',
					'cta_label'  => 'Track Your Order',
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
						[ 'label' => 'Shipped On', 'value' => $order->get_date_completed() ? $order->get_date_completed()->date_i18n( 'F j, Y' ) : 'Today' ],
						[ 'label' => 'Total', 'value' => $order->get_formatted_order_total() ],
					] : [],
				]
			);

		case 'customer_on_hold_order':
			return array_merge(
				$defaults,
				[
					'title'      => 'Order On Hold',
					'preheader'  => "Order #{$order_number} is on hold pending payment",
					'eyebrow'    => 'Payment Required',
					'intro'      => 'Your order has been received but is on hold pending payment confirmation.',
					'cta_label'  => 'View Order',
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
						[ 'label' => 'Total', 'value' => $order->get_formatted_order_total() ],
					] : [],
				]
			);

		case 'customer_refunded_order':
			$refund_amount = $order ? $order->get_total_refunded_for_order() : 0;
			return array_merge(
				$defaults,
				[
					'title'      => 'Refund Processed',
					'preheader'  => "Refund processed for order #{$order_number}",
					'eyebrow'    => 'Refund Notification',
					'intro'      => 'A refund has been processed for your order. The funds should appear in your account within 5-10 business days.',
					'cta_label'  => 'View Order',
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
						[ 'label' => 'Refund Amount', 'value' => wc_price( $refund_amount ) ],
					] : [],
				]
			);

		case 'customer_invoice':
			return array_merge(
				$defaults,
				[
					'title'      => 'Invoice for Your Order',
					'preheader'  => "Invoice for order #{$order_number}",
					'eyebrow'    => 'Order Invoice',
					'intro'      => 'Please find the invoice for your order below.',
					'cta_label'  => 'View Invoice',
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
						[ 'label' => 'Invoice Date', 'value' => gmdate( 'F j, Y' ) ],
						[ 'label' => 'Total', 'value' => $order->get_formatted_order_total() ],
					] : [],
				]
			);

		case 'customer_note':
			return array_merge(
				$defaults,
				[
					'title'      => 'Note Added to Your Order',
					'preheader'  => "A note has been added to order #{$order_number}",
					'eyebrow'    => 'Order Update',
					'intro'      => 'Our team has added a note to your order.',
					'cta_label'  => 'View Order',
					'details'    => $order ? [
						[ 'label' => 'Order Number', 'value' => $order_number ],
					] : [],
				]
			);

		default:
			return $defaults;
	}
}
