<?php
/**
 * DTB_ToolFamilyResolver
 *
 * Determines the canonical tool family key for a product.
 *
 * Priority:
 *   1. _dtb_tool_family meta (explicit) — always wins if set and valid.
 *   2. _dtb_builder_slots meta — infer family from the first slot's allowed families.
 *   3. Category key heuristic — map DTB category → most likely tool family.
 *   4. Product name keyword heuristic — last resort, transition only.
 *
 * The goal is to eliminate (4) entirely once all products have been tagged.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_ToolFamilyResolver {

	/**
	 * DTB category key → default tool family when no explicit meta exists.
	 * Used only as a category-level heuristic (priority 3).
	 *
	 * @var array<string, string>
	 */
	const CATEGORY_FAMILY_HINTS = [
		'taping'    => DTB_ToolFamilies::AUTOMATIC_TAPER,
		'finishing' => DTB_ToolFamilies::FLAT_BOX,
		'corner'    => DTB_ToolFamilies::CORNER_BOX,
		'handles'   => DTB_ToolFamilies::FLAT_BOX_HANDLE,
		'mudboxes'  => DTB_ToolFamilies::PUMP,
		'sanding'   => DTB_ToolFamilies::ACCESSORY,
		'stilts'    => DTB_ToolFamilies::STILT,
		'texture'   => DTB_ToolFamilies::SPRAYER,
		'parts'     => DTB_ToolFamilies::REPLACEMENT_PART,
		'services'  => DTB_ToolFamilies::SERVICE,
	];

	/**
	 * Keyword → tool family mapping used only as a fallback heuristic.
	 * Kept intentionally narrow so it does not over-classify.
	 *
	 * @var array<string, string>
	 */
	const NAME_KEYWORD_HINTS = [
		'automatic taper' => DTB_ToolFamilies::AUTOMATIC_TAPER,
		'flat box'        => DTB_ToolFamilies::FLAT_BOX,
		'finishing box'   => DTB_ToolFamilies::FLAT_BOX,
		'skimming box'    => DTB_ToolFamilies::FLAT_BOX,
		'fat boy'         => DTB_ToolFamilies::FLAT_BOX,
		'angle head'      => DTB_ToolFamilies::ANGLE_HEAD,
		'corner applicator' => DTB_ToolFamilies::CORNER_BOX,
		'corner box'      => DTB_ToolFamilies::CORNER_BOX,
		'box handle'      => DTB_ToolFamilies::FLAT_BOX_HANDLE,
		'angle head handle' => DTB_ToolFamilies::ANGLE_HEAD_HANDLE,
		'corner roller'   => DTB_ToolFamilies::CORNER_ROLLER,
		'inside corner roller' => DTB_ToolFamilies::CORNER_ROLLER,
		'loading pump'    => DTB_ToolFamilies::PUMP,
		'hot mud pump'    => DTB_ToolFamilies::PUMP,
		'easyclean'       => DTB_ToolFamilies::PUMP,
		'gooseneck'       => DTB_ToolFamilies::GOOSENECK,
		'filler adapter'  => DTB_ToolFamilies::FILLER_ADAPTER,
		'box filler'      => DTB_ToolFamilies::FILLER_ADAPTER,
		'skimming blade'  => DTB_ToolFamilies::SKIMMING_BLADE,
	];

	/**
	 * Resolve the tool family for a product.
	 *
	 * @param  string   $meta_family    _dtb_tool_family meta value (may be empty).
	 * @param  string[] $builder_slots  _dtb_builder_slots meta (decoded array).
	 * @param  string   $category_key   Resolved DTB category key.
	 * @param  string   $product_name   Raw product name.
	 * @param  bool     $is_parts       Whether this is a replacement part.
	 * @return string   Tool family key, or empty string if undetermined.
	 */
	public static function resolve(
		string $meta_family,
		array  $builder_slots,
		string $category_key,
		string $product_name,
		bool   $is_parts = false
	): string {
		// 1. Explicit meta — always authoritative.
		if ( '' !== $meta_family && DTB_ToolFamilies::is_valid( $meta_family ) ) {
			return $meta_family;
		}

		// Short-circuit for known parts.
		if ( $is_parts ) {
			return DTB_ToolFamilies::REPLACEMENT_PART;
		}

		// 2. Infer from builder slots meta.
		if ( ! empty( $builder_slots ) ) {
			$first_slot    = $builder_slots[0];
			$slot_families = DTB_ToolFamilies::families_for_slot( $first_slot );
			if ( ! empty( $slot_families ) ) {
				return $slot_families[0];
			}
		}

		// 3. Category key heuristic.
		if ( '' !== $category_key && isset( self::CATEGORY_FAMILY_HINTS[ $category_key ] ) ) {
			return self::CATEGORY_FAMILY_HINTS[ $category_key ];
		}

		// 4. Name keyword heuristic (transition only — avoid over-classifying).
		$lower = strtolower( $product_name );
		foreach ( self::NAME_KEYWORD_HINTS as $keyword => $family ) {
			if ( str_contains( $lower, $keyword ) ) {
				return $family;
			}
		}

		return '';
	}
}
