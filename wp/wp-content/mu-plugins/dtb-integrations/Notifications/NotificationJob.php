<?php
/**
 * Notification job runner.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_NotificationJob' ) ) {
	return;
}

final class DTB_NotificationJob {
	public const ACTION = 'dtb_integrations_send_notification';

	/** Register async job hook. */
	public static function register(): void {
		add_action( self::ACTION, [ self::class, 'handle' ], 10, 1 );
	}

	/**
	 * Queue a notification through Action Scheduler when available.
	 *
	 * @param array $payload Notification payload.
	 */
	public static function enqueue( array $payload ): void {
		$payload = self::sanitize_payload( $payload );

		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::ACTION, [ $payload ], 'dtb-integrations' );
			return;
		}

		self::handle( $payload );
	}

	/**
	 * Handle a queued notification payload.
	 *
	 * @param array $payload Notification payload.
	 */
	public static function handle( array $payload ): void {
		$payload = self::sanitize_payload( $payload );
		$type    = $payload['type'];

		if ( 'email' === $type && class_exists( 'DTB_NotificationDispatcher' ) ) {
			DTB_NotificationDispatcher::email( $payload['to'], $payload['template'], $payload['context'] );
			return;
		}

		if ( 'sms' === $type && class_exists( 'DTB_NotificationDispatcher' ) ) {
			DTB_NotificationDispatcher::sms( $payload['to'], (string) ( $payload['message'] ?? '' ) );
		}
	}

	/**
	 * Sanitize job payload.
	 *
	 * @param array $payload Raw payload.
	 * @return array{type:string,to:string,template:string,message:string,context:array}
	 */
	private static function sanitize_payload( array $payload ): array {
		$context = [];
		foreach ( (array) ( $payload['context'] ?? [] ) as $key => $value ) {
			if ( is_scalar( $value ) || null === $value ) {
				$context[ sanitize_key( (string) $key ) ] = sanitize_text_field( (string) $value );
			}
		}

		return [
			'type'     => sanitize_key( (string) ( $payload['type'] ?? 'email' ) ),
			'to'       => sanitize_text_field( (string) ( $payload['to'] ?? '' ) ),
			'template' => sanitize_key( (string) ( $payload['template'] ?? 'default' ) ),
			'message'  => sanitize_textarea_field( (string) ( $payload['message'] ?? '' ) ),
			'context'  => $context,
		];
	}
}

DTB_NotificationJob::register();
