<?php
/**
 * DTB_CategoryNormalizer
 *
 * Maps WooCommerce category names and slugs to DTB's internal category keys.
 *
 * This is the backend counterpart of CATEGORY_MAP in parseProductCsv.js.
 * Moving the mapping here means the frontend can consume pre-keyed data from
 * the catalog API rather than deriving keys itself.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CategoryNormalizer {

	/**
	 * Map from lowercase WC category name → DTB category key.
	 *
	 * @var array<string, string>
	 */
	const CATEGORY_MAP = [
		// Taping
		'automatic taping tools'  => 'taping',
		'taping tools'            => 'taping',
		'automatic tapers'        => 'taping',
		'tapers'                  => 'taping',
		// Finishing
		'finishing tools'         => 'finishing',
		'flat boxes'              => 'finishing',
		'finishing boxes'         => 'finishing',
		'angle heads'             => 'finishing',
		'skimming blades'         => 'finishing',
		'accessories & adapters'  => 'finishing',
		'accessories and adapters'=> 'finishing',
		'accessories'             => 'finishing',
		// Corner
		'corner tools'            => 'corner',
		'corner boxes'            => 'corner',
		'corner applicators'      => 'corner',
		// Mud Boxes / Pumps
		'mud boxes'               => 'mudboxes',
		'mud boxes & pumps'       => 'mudboxes',
		'mud boxes and pumps'     => 'mudboxes',
		'loading pumps'           => 'mudboxes',
		'pumps'                   => 'mudboxes',
		// Handles & Extensions
		'handles & extensions'    => 'handles',
		'handles and extensions'  => 'handles',
		'box handles'             => 'handles',
		'angle head handles'      => 'handles',
		'handles'                 => 'handles',
		// Sanding
		'sanding'                 => 'sanding',
		'sanding tools'           => 'sanding',
		'sanders'                 => 'sanding',
		// Stilts
		'stilts'                  => 'stilts',
		'extension tubes & clamps'=> 'stilts',
		'legs & brackets'         => 'stilts',
		'springs & bearings'      => 'stilts',
		'straps & buckles'        => 'stilts',
		'soles & floor plates'    => 'stilts',
		// Texture
		'texture'                 => 'texture',
		'texture tools'           => 'texture',
		'texture sprayers'        => 'texture',
		// Taping tool sets
		'taping tool sets'        => 'taping',
		'tool cases'              => 'taping',
		'tool sets'               => 'taping',
		// Parts
		'parts'                   => 'parts',
		'replacement parts'       => 'parts',
		'parts & accessories'     => 'parts',
		'parts and accessories'   => 'parts',
		// Services
		'services'                => 'services',
		'repair services'         => 'services',
	];

	/**
	 * DTB category key → human-readable label.
	 *
	 * @var array<string, string>
	 */
	const CATEGORY_LABELS = [
		'taping'   => 'Automatic Taping Tools',
		'finishing'=> 'Finishing Tools',
		'corner'   => 'Corner Tools',
		'handles'  => 'Handles & Extensions',
		'mudboxes' => 'Mud Boxes & Pumps',
		'sanding'  => 'Sanding Tools',
		'stilts'   => 'Stilts',
		'texture'  => 'Texture Tools',
		'parts'    => 'Replacement Parts',
		'services' => 'Repair Services',
	];

	/**
	 * Resolve a DTB category identity from a WC product array.
	 *
	 * Priority:
	 *   1. _dtb_category_key meta (explicit)
	 *   2. WC category names mapped through CATEGORY_MAP
	 *
	 * @param  array $wc_categories  WC product categories ([ { id, name, slug } ]).
	 * @param  string $meta_key      Existing _dtb_category_key value (may be empty).
	 * @return array{ key: string, label: string, slug: string }
	 */
	public static function resolve( array $wc_categories, string $meta_key = '' ): array {
		if ( '' !== $meta_key ) {
			return self::from_key( $meta_key );
		}

		foreach ( $wc_categories as $cat ) {
			$name = strtolower( trim( $cat['name'] ?? '' ) );
			if ( isset( self::CATEGORY_MAP[ $name ] ) ) {
				return self::from_key( self::CATEGORY_MAP[ $name ] );
			}
			// Try slug
			$slug = strtolower( trim( $cat['slug'] ?? '' ) );
			// Convert hyphens to spaces for a slug-based lookup
			$slug_as_name = str_replace( '-', ' ', $slug );
			if ( isset( self::CATEGORY_MAP[ $slug_as_name ] ) ) {
				return self::from_key( self::CATEGORY_MAP[ $slug_as_name ] );
			}
		}

		return [ 'key' => '', 'label' => '', 'slug' => '' ];
	}

	/**
	 * Build a category identity from a known DTB category key.
	 *
	 * @param  string $key
	 * @return array{ key: string, label: string, slug: string }
	 */
	public static function from_key( string $key ): array {
		$label = self::CATEGORY_LABELS[ $key ] ?? ucwords( str_replace( '_', ' ', $key ) );
		return [ 'key' => $key, 'label' => $label, 'slug' => $key ];
	}

	/** Returns true when $key is a recognized DTB category key. */
	public static function is_valid_key( string $key ): bool {
		return isset( self::CATEGORY_LABELS[ $key ] );
	}
}
