<?php
/**
 * DTB_ToolFamilies
 *
 * Defines the canonical tool family taxonomy and the authoritative mapping
 * from tool families to Toolset Builder slot IDs.
 *
 * This is the backend counterpart of the keyword-based slot filters in
 * frontend/src/data/toolsetTemplates.js.  Once products are tagged with
 * _dtb_tool_family, these slot → family maps replace all name-matching logic.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_ToolFamilies {

	// ── Tool family keys ───────────────────────────────────────────────────────

	const AUTOMATIC_TAPER     = 'automatic_taper';
	const FLAT_BOX            = 'flat_box';
	const FLAT_BOX_HANDLE     = 'flat_box_handle';
	const ANGLE_HEAD          = 'angle_head';
	const ANGLE_HEAD_HANDLE   = 'angle_head_handle';
	const CORNER_BOX          = 'corner_box';
	const CORNER_ROLLER       = 'corner_roller';
	const CORNER_ROLLER_HANDLE = 'corner_roller_handle';
	const PUMP                = 'pump';
	const FILLER_ADAPTER      = 'filler_adapter';
	const GOOSENECK           = 'gooseneck';
	const SKIMMING_BLADE      = 'skimming_blade';
	const KNIFE               = 'knife';
	const STILT               = 'stilt';
	const SPRAYER             = 'sprayer';
	const REPLACEMENT_PART    = 'replacement_part';
	const ACCESSORY           = 'accessory';
	const SERVICE             = 'service';

	/**
	 * All valid tool family keys.
	 *
	 * @var string[]
	 */
	const ALL = [
		self::AUTOMATIC_TAPER,
		self::FLAT_BOX,
		self::FLAT_BOX_HANDLE,
		self::ANGLE_HEAD,
		self::ANGLE_HEAD_HANDLE,
		self::CORNER_BOX,
		self::CORNER_ROLLER,
		self::CORNER_ROLLER_HANDLE,
		self::PUMP,
		self::FILLER_ADAPTER,
		self::GOOSENECK,
		self::SKIMMING_BLADE,
		self::KNIFE,
		self::STILT,
		self::SPRAYER,
		self::REPLACEMENT_PART,
		self::ACCESSORY,
		self::SERVICE,
	];

	/**
	 * Toolset Builder slot → allowed tool families.
	 *
	 * A product is eligible for a slot when its _dtb_tool_family value appears
	 * in the families list for that slot.  This replaces keyword-based name
	 * matching in toolsetTemplates.js.
	 *
	 * @var array<string, string[]>
	 */
	const SLOT_FAMILIES = [
		'taper'                  => [ self::AUTOMATIC_TAPER ],
		'flatBox'                => [ self::FLAT_BOX ],
		'flatBox2'               => [ self::FLAT_BOX ],
		'boxHandle'              => [ self::FLAT_BOX_HANDLE ],
		'boxHandle2'             => [ self::FLAT_BOX_HANDLE ],
		'angleHead'              => [ self::ANGLE_HEAD ],
		'angleHead2'             => [ self::ANGLE_HEAD ],
		'cornerBox'              => [ self::CORNER_BOX ],
		'cornerApplicator'       => [ self::CORNER_BOX ],
		'angleHeadHandle'        => [ self::ANGLE_HEAD_HANDLE ],
		'rollerHandle'           => [ self::CORNER_ROLLER, self::CORNER_ROLLER_HANDLE ],
		'cornerBoxHandle'        => [ self::CORNER_ROLLER_HANDLE ],
		'cornerApplicatorHandle' => [ self::CORNER_ROLLER_HANDLE ],
		'cornerHandle'           => [ self::CORNER_ROLLER_HANDLE ],
		'pump'                   => [ self::PUMP ],
		'fillerAdapter'          => [ self::FILLER_ADAPTER ],
		'gooseneck'              => [ self::GOOSENECK ],
	];

	/**
	 * Returns the allowed tool families for a given slot ID.
	 *
	 * @param string $slot_id  Toolset Builder slot ID.
	 * @return string[]        Allowed tool family keys (empty if unknown slot).
	 */
	public static function families_for_slot( string $slot_id ): array {
		return self::SLOT_FAMILIES[ $slot_id ] ?? [];
	}

	/**
	 * Returns every slot ID that accepts the given tool family.
	 *
	 * @param string $family  Tool family key.
	 * @return string[]       Slot IDs.
	 */
	public static function slots_for_family( string $family ): array {
		$slots = [];
		foreach ( self::SLOT_FAMILIES as $slot => $families ) {
			if ( in_array( $family, $families, true ) ) {
				$slots[] = $slot;
			}
		}
		return $slots;
	}

	/** Returns true when $family is a valid key in the taxonomy. */
	public static function is_valid( string $family ): bool {
		return in_array( $family, self::ALL, true );
	}
}
