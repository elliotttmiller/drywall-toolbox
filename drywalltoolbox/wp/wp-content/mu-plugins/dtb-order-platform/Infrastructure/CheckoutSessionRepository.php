<?php
defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_CHECKOUT_SESSION_DB_VERSION' ) ) {
	define( 'DTB_CHECKOUT_SESSION_DB_VERSION', '3.0.0' );
}

final class DTB_OrderCheckoutSessionRepository {
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'dtb_checkout_sessions';
	}

	public static function install(): void {
		if ( DTB_CHECKOUT_SESSION_DB_VERSION === (string) get_option( 'dtb_checkout_session_db_version', '' ) ) {
			return;
		}

		global $wpdb;
		$table = self::table();
		$sql   = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_id char(36) NOT NULL,
			quote_id varchar(64) NOT NULL,
			resume_token_hash char(64) DEFAULT NULL,
			idempotency_key varchar(191) DEFAULT NULL,
			customer_id bigint(20) unsigned NOT NULL DEFAULT 0,
			woo_session_identifier char(64) NOT NULL,
			cart_hash char(64) NOT NULL,
			quote_version bigint(20) unsigned NOT NULL DEFAULT 1,
			selected_shipping_rate_id varchar(191) NOT NULL DEFAULT '',
			fingerprint char(64) NOT NULL,
			state varchar(32) NOT NULL DEFAULT 'quoted',
			state_version bigint(20) unsigned NOT NULL DEFAULT 1,
			payment_gateway varchar(64) NOT NULL DEFAULT 'stripe_embedded_checkout',
			payment_method varchar(100) NOT NULL DEFAULT '',
			context_json longtext NOT NULL,
			quote_json longtext NOT NULL,
			order_id bigint(20) unsigned DEFAULT NULL,
			failure_code varchar(100) NOT NULL DEFAULT '',
			failure_context_redacted text NOT NULL,
			created_at datetime NOT NULL,
			expires_at datetime NOT NULL,
			confirmed_at datetime DEFAULT NULL,
			finalized_at datetime DEFAULT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY session_id (session_id),
			UNIQUE KEY quote_id (quote_id),
			UNIQUE KEY resume_token_hash (resume_token_hash),
			UNIQUE KEY idempotency_key (idempotency_key),
			UNIQUE KEY order_id (order_id),
			KEY woo_session_identifier (woo_session_identifier),
			KEY cart_hash (cart_hash),
			KEY state (state),
			KEY expires_at (expires_at)
		) ENGINE=InnoDB {$wpdb->get_charset_collate()};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		update_option( 'dtb_checkout_session_db_version', DTB_CHECKOUT_SESSION_DB_VERSION, false );
	}

	public static function token_hash( string $token ): string {
		return hash( 'sha256', $token );
	}

	public static function find_by_quote_id( string $quote_id ): ?array {
		return self::find( 'quote_id', $quote_id );
	}

	public static function find_by_session_id( string $session_id ): ?array {
		return self::find( 'session_id', $session_id );
	}

	public static function find_by_resume_token( string $token ): ?array {
		return self::find( 'resume_token_hash', self::token_hash( $token ) );
	}

	public static function find_by_idempotency_key( string $key ): ?array {
		return self::find( 'idempotency_key', $key );
	}

	public static function find_by_order_id( int $order_id ): ?array {
		return self::find( 'order_id', (string) $order_id );
	}

	private static function find( string $column, string $value ): ?array {
		$allowed = [ 'quote_id', 'session_id', 'resume_token_hash', 'idempotency_key', 'order_id' ];
		if ( ! in_array( $column, $allowed, true ) || '' === $value ) {
			return null;
		}
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::table() . " WHERE {$column} = %s LIMIT 1", $value ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return is_array( $row ) ? self::hydrate( $row ) : null;
	}

	private static function hydrate( array $row ): array {
		$row['id']                       = (int) $row['id'];
		$row['customer_id']              = (int) $row['customer_id'];
		$row['order_id']                 = ! empty( $row['order_id'] ) ? (int) $row['order_id'] : 0;
		$row['state_version']            = (int) ( $row['state_version'] ?? 1 );
		$row['quote_version']            = (int) ( $row['quote_version'] ?? 1 );
		$row['context']                  = json_decode( (string) ( $row['context_json'] ?? '' ), true ) ?: [];
		$row['quote']                    = json_decode( (string) ( $row['quote_json'] ?? '' ), true ) ?: [];
		$row['failure_context_redacted'] = (string) ( $row['failure_context_redacted'] ?? '' );
		return $row;
	}

	public static function insert_quote( array $data ): int|false {
		global $wpdb;
		$now = current_time( 'mysql', true );
		$ok  = $wpdb->insert(
			self::table(),
			[
				'session_id'                => (string) $data['session_id'],
				'quote_id'                  => (string) $data['quote_id'],
				'customer_id'               => (int) $data['customer_id'],
				'woo_session_identifier'    => (string) $data['woo_session_identifier'],
				'cart_hash'                 => (string) $data['cart_hash'],
				'quote_version'             => 1,
				'selected_shipping_rate_id' => (string) ( $data['selected_shipping_rate_id'] ?? '' ),
				'fingerprint'               => (string) $data['fingerprint'],
				'state'                     => 'quoted',
				'state_version'             => 1,
				'payment_gateway'           => 'stripe_embedded_checkout',
				'payment_method'            => '',
				'context_json'              => wp_json_encode( $data['context'] ),
				'quote_json'                => wp_json_encode( $data['quote'] ),
				'expires_at'                => $data['expires_at'],
				'failure_code'              => '',
				'failure_context_redacted'  => '',
				'created_at'                => $now,
				'updated_at'                => $now,
			],
			[ '%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' ]
		);
		return false === $ok ? false : (int) $wpdb->insert_id;
	}

	public static function promote_quote( int $id, array $data, int $expected_version = 1 ): bool {
		global $wpdb;
		$now = current_time( 'mysql', true );
		$updated = $wpdb->update(
			self::table(),
			[
				'resume_token_hash'         => (string) $data['resume_token_hash'],
				'idempotency_key'           => (string) $data['idempotency_key'],
				'customer_id'               => (int) $data['customer_id'],
				'woo_session_identifier'    => (string) $data['woo_session_identifier'],
				'cart_hash'                 => (string) $data['cart_hash'],
				'quote_version'             => (int) ( $data['quote_version'] ?? 1 ),
				'selected_shipping_rate_id' => (string) ( $data['selected_shipping_rate_id'] ?? '' ),
				'fingerprint'               => (string) $data['fingerprint'],
				'state'                     => 'created',
				'state_version'             => $expected_version + 1,
				'payment_gateway'           => (string) ( $data['payment_gateway'] ?? 'stripe_embedded_checkout' ),
				'payment_method'            => (string) $data['payment_method'],
				'context_json'              => wp_json_encode( $data['context'] ),
				'quote_json'                => wp_json_encode( $data['quote'] ),
				'expires_at'                => $data['expires_at'],
				'updated_at'                => $now,
			],
			[ 'id' => $id, 'state' => 'quoted', 'state_version' => $expected_version ],
			[ '%s', '%s', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s' ],
			[ '%d', '%s', '%d' ]
		);
		return 1 === (int) $updated;
	}

	public static function update_session( int $id, array $data ): bool {
		$allowed = [
			'resume_token_hash'         => '%s',
			'idempotency_key'           => '%s',
			'context_json'              => '%s',
			'quote_json'                => '%s',
			'order_id'                  => '%d',
			'quote_version'             => '%d',
			'selected_shipping_rate_id' => '%s',
			'expires_at'                => '%s',
			'confirmed_at'              => '%s',
			'finalized_at'              => '%s',
			'failure_code'              => '%s',
			'failure_context_redacted'  => '%s',
			'customer_id'               => '%d',
			'updated_at'                => '%s',
		];
		$values  = [];
		$formats = [];
		foreach ( $allowed as $key => $format ) {
			if ( ! array_key_exists( $key, $data ) ) {
				continue;
			}
			$values[ $key ] = $data[ $key ];
			$formats[]      = $format;
		}
		if ( ! array_key_exists( 'updated_at', $values ) ) {
			$values['updated_at'] = current_time( 'mysql', true );
			$formats[]            = '%s';
		}
		global $wpdb;
		$updated = $wpdb->update( self::table(), $values, [ 'id' => $id ], $formats, [ '%d' ] );
		return false !== $updated;
	}

	public static function transition( int $id, string $from_state, string $to_state, int $expected_version, array $data = [] ): bool {
		global $wpdb;
		$set    = [ 'state' => $to_state, 'state_version' => $expected_version + 1, 'updated_at' => current_time( 'mysql', true ) ];
		$format = [ '%s', '%d', '%s' ];
		foreach ( [
			'order_id'                 => '%d',
			'context_json'             => '%s',
			'quote_json'               => '%s',
			'expires_at'               => '%s',
			'confirmed_at'             => '%s',
			'finalized_at'             => '%s',
			'failure_code'             => '%s',
			'failure_context_redacted' => '%s',
		] as $key => $value_format ) {
			if ( ! array_key_exists( $key, $data ) ) {
				continue;
			}
			$set[ $key ] = $data[ $key ];
			$format[]    = $value_format;
		}
		$updated = $wpdb->update(
			self::table(),
			$set,
			[ 'id' => $id, 'state' => $from_state, 'state_version' => $expected_version ],
			$format,
			[ '%d', '%s', '%d' ]
		);
		return 1 === (int) $updated;
	}
}

add_action( 'plugins_loaded', [ 'DTB_OrderCheckoutSessionRepository', 'install' ], 5 );
