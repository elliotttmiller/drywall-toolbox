<?php
/**
 * DTB_BrandNormalizer
 *
 * Maps raw brand strings (from WC categories, attributes, meta, or CSV) into
 * the canonical DTB brand identity: { key, label, slug }.
 *
 * This is the single source of truth for brand normalization on the backend,
 * replacing the scattered BRAND_ALIASES / BRAND_TO_SLUG logic currently
 * duplicated in frontend/src/services/api.js and parseProductCsv.js.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_BrandNormalizer {

	/**
	 * Canonical brand label → slug key.
	 * Slug is used in URLs (e.g. /products?brand=tapetech).
	 *
	 * @var array<string, string>
	 */
	const BRAND_TO_SLUG = [
		'TapeTech'               => 'tapetech',
		'Columbia Taping Tools'  => 'columbia-taping-tools',
		'Columbia'               => 'columbia-taping-tools',
		'Asgard'                 => 'asgard',
		'SurPro'                 => 'surpro',
		'Graco'                  => 'graco',
		'Platinum Drywall Tools' => 'platinum',
		'Dura-Stilts'            => 'dura-stilts',
		'Level 5'                => 'level5',
	];

	/**
	 * Alias → canonical label.
	 * Covers common CSV/import variants that are not themselves canonical.
	 *
	 * @var array<string, string>
	 */
	const BRAND_ALIASES = [
		'Columbia'                => 'Columbia Taping Tools',
		'columbia'                => 'Columbia Taping Tools',
		'TAPETECH'                => 'TapeTech',
		'Tape Tech'               => 'TapeTech',
		'LEVEL 5'                 => 'Level 5',
		'level 5'                 => 'Level 5',
		'Level5'                  => 'Level 5',
		'GRACO'                   => 'Graco',
		'SURPRO'                  => 'SurPro',
		'Sur-Pro'                 => 'SurPro',
		'SUR PRO'                 => 'SurPro',
		'DURA-STILTS'             => 'Dura-Stilts',
		'Dura Stilts'             => 'Dura-Stilts',
		'ASGARD'                  => 'Asgard',
		'Platinum'                => 'Platinum Drywall Tools',
		'PLATINUM'                => 'Platinum Drywall Tools',
	];

	/**
	 * Normalize a raw brand string to the canonical { key, label, slug } tuple.
	 *
	 * Resolution order:
	 *   1. Exact match in BRAND_TO_SLUG → canonical label already.
	 *   2. Match in BRAND_ALIASES → resolve to canonical label.
	 *   3. Case-insensitive scan of BRAND_TO_SLUG.
	 *   4. Unknown brand → derive slug from sanitize_title().
	 *
	 * @param  string $raw  Raw brand string.
	 * @return array{ key: string, label: string, slug: string }
	 */
	public static function normalize( string $raw ): array {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return [ 'key' => '', 'label' => '', 'slug' => '' ];
		}

		// 1. Exact match in BRAND_TO_SLUG (canonical label).
		if ( isset( self::BRAND_TO_SLUG[ $raw ] ) ) {
			$slug = self::BRAND_TO_SLUG[ $raw ];
			return [ 'key' => $slug, 'label' => $raw, 'slug' => $slug ];
		}

		// 2. Alias → canonical label.
		if ( isset( self::BRAND_ALIASES[ $raw ] ) ) {
			$canonical = self::BRAND_ALIASES[ $raw ];
			$slug      = self::BRAND_TO_SLUG[ $canonical ] ?? sanitize_title( $canonical );
			return [ 'key' => $slug, 'label' => $canonical, 'slug' => $slug ];
		}

		// 3. Case-insensitive scan of canonical labels.
		$lower = strtolower( $raw );
		foreach ( self::BRAND_TO_SLUG as $label => $slug ) {
			if ( strtolower( $label ) === $lower ) {
				return [ 'key' => $slug, 'label' => $label, 'slug' => $slug ];
			}
		}

		// 4. Unknown brand — return as-is with derived slug.
		$slug = sanitize_title( $raw );
		return [ 'key' => $slug, 'label' => $raw, 'slug' => $slug ];
	}

	/**
	 * Normalize a URL brand slug (e.g. "tapetech") to the canonical label.
	 *
	 * @param  string $slug
	 * @return string  Canonical label, or empty string if not found.
	 */
	public static function label_from_slug( string $slug ): string {
		$slug = strtolower( trim( $slug ) );
		foreach ( self::BRAND_TO_SLUG as $label => $s ) {
			if ( $s === $slug ) {
				return $label;
			}
		}
		return '';
	}

	/** Returns true when $slug is a known canonical brand slug. */
	public static function is_known_slug( string $slug ): bool {
		return in_array( strtolower( trim( $slug ) ), array_values( self::BRAND_TO_SLUG ), true );
	}
}
