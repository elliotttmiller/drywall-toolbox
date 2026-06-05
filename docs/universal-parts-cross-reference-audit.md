# Universal Parts Cross-Reference Audit

## Purpose

Drywall Toolbox needs backend-only universal part intelligence while preserving brand-specific frontend catalog and schematic presentation. This report audits existing parts/catalog/schematic sources and the prior universal-part audit outputs to identify which parts can safely be grouped as the same physical item across brands.

The correct target is not a public universal storefront product. The correct target is a backend compatibility layer that maps many brand-specific SKUs, schematic part IDs, and product/schematic placements to one canonical universal physical specification.

## Executive summary

The strongest universal-part candidates are standard hardware parts whose names expose measurable physical specifications: thread, length, head style, nut/washer type, pin dimensions, O-ring dimensions, and material where material is functionally relevant.

The prior generated cross-brand report contains 65 cross-brand universal candidate groups. The most reliable groups are standard screws, nuts, bolts, pins, washers, and O-rings that appear across at least two brands and across catalog plus schematic sources. The strongest single example is `screw 6-32 x 1/2 fillister head`, which appears across Asgard, Columbia, Level5, Platinum, and TapeTech with 26 occurrences and catalog SKUs including Columbia `FA245` and TapeTech `059091`.

The existing audit pipeline is directionally correct because it normalizes names/titles and intentionally keeps SKUs only as provenance. However, it should be hardened before production import because some generated keys are over-broad or incorrectly parsed when source titles omit length, omit head style, include ambiguous shorthand, or include proprietary/contextual words.

## Source corpus reviewed

Primary production/source files referenced by the user:

- `products/Production/launch/dtb_schematics_parts_flattened.csv`
- `products/Production/launch/dtb_parts_catalog.csv`
- `products/Production/launch/extra/dtb_parts_manager_import_parts.csv`
- `products/Production/launch/extra/dtb_parts_manager_import_schematic_map.csv`

Additional referenced/audited sources:

- `frontend/public/brands/**/Schematics/**/schematic_data.json`
- `products/catalogs/platinum_parts_catalog.csv`
- `scripts/audit_universal_parts.py`
- `products/Production/launch/reports/universal_part_occurrences.csv`
- `products/Production/launch/reports/universal_part_groups.csv`
- `products/Production/launch/reports/hardware_part_groups_single_brand_review.csv`

Repository caveat: the user-referenced `products/Production/launch/reports/universal_parts` directory was not found on current `main` by repository search. The discoverable audit outputs were found as sibling CSV files under `products/Production/launch/reports/` in an existing audit commit. This report uses those files as prior audit evidence and should be reconciled back into `main` if they are intended to remain canonical.

## Audit methodology

### Matching principle

Universal grouping must be based on normalized physical descriptions, not SKU equality.

Acceptable match signals:

- thread plus length plus head/drive style for screws and bolts
- thread plus nut type/material for nuts
- nominal size plus washer type/material for washers
- diameter plus length plus pin/rivet style for pins and rivets
- AS568 code or explicit ID/OD/cross-section dimensions for O-rings
- direct cross-brand occurrence across catalog and schematic sources

Rejected or review-only match signals:

- SKU prefix or SKU similarity
- generic labels with no dimensions, such as `Screw`, `Nut`, `Washer`, `Spring`, `Pin`, `Clip`, `Bushing`, `Bearing`, `Wheel`, `Blade`
- proprietary assemblies, castings, plates, bodies, brackets, handles, wheels, seals, blades, bushings, and bearings unless independently confirmed by official dimensions or compatible fitment
- title-only similarity where one title includes functional detail and another does not

### Confidence model

Use these confidence levels for backend import staging:

| Confidence | Meaning | Backend action |
|---|---|---|
| `verified` | Manually confirmed same physical part from official schematic/catalog dimensions or exact standard | Safe for production compatibility mapping |
| `high` | Cross-brand match with measurable physical specification and catalog/schematic corroboration | Safe for staged backend import after spot check |
| `medium` | Cross-brand match from names/titles but missing either catalog corroboration, full dimensional detail, or clear material equivalence | Keep in review queue or limited beta metadata |
| `review` | Same-brand repetition or broad generic part family | Do not import as universal without manual confirmation |
| `reject` | Proprietary, vague, malformed, or conflicting specification | Exclude from universal index |

## Key verified/high-confidence universal candidates

These are the highest-value backend groups found in the audit evidence.

| Universal key | Brands observed | Evidence strength | Notes |
|---|---:|---|---|
| `screw 6-32 x 1/2 fillister head` | 5 | High | Best canonical example. Appears across Asgard, Columbia, Level5, Platinum, and TapeTech. Includes Columbia `FA245`, TapeTech `059091`, and Platinum `6-32 x 1/2 FillisterHeadScrew`. |
| `screw 6-32 x 1/4 binder head` | 4 | High | Appears across Asgard, Columbia, Level5, and TapeTech. Strong thread/length/head match. |
| `screw 4-40 x 3/16 binder head` | 4 | High | Appears across Asgard, Columbia, Level5, and TapeTech. Strong recurring machine-screw pattern. |
| `screw 4-40 x 1/4 binder head` | 4 | High | Appears across Asgard, Columbia, Level5, and TapeTech. Strong cross-brand schematic reuse. |
| `screw 4-40 x 1/4 fillister head` | 4 | High | Appears across Columbia, Level5, Platinum, and TapeTech. Strong candidate but confirm head/drive equivalence where source says only `Fillister Slot`. |
| `screw 1/4-20 x 5/8 socket head` | 3 | High | Appears across Asgard, Columbia, and Level5. Good thread/length/head match. |
| `screw 4-40 x 1/8 binder head` | 3 | High | Appears across Asgard, Columbia, and TapeTech. Strong machine-screw pattern. |
| `screw 4-40 x 5/16 binder head` | 3 | High | Appears across Asgard, Columbia, and TapeTech. Strong machine-screw pattern. |
| `screw 4-40 x 3/16 flat head` | 3 | High | Appears across Asgard, Columbia, and TapeTech. Strong standard hardware candidate. |
| `nut 1/4-20 hex` | 2 | High | Columbia and TapeTech. Confirm slotted/castle variants before treating all rows as identical. |
| `nut 1/4-20 nylon lock` | 2 | High | Columbia and Platinum. Strong standard nut candidate. |
| `nut 10-24 nylon lock` | 2 | High | Asgard and Columbia. Strong standard nut candidate. |
| `nut 3/8-16 nylon lock` | 2 | High | Asgard and Columbia. Strong standard nut candidate. |
| `nut 4-40 hex` | 2 | High | Columbia and TapeTech. Material appears stainless in TapeTech source; confirm material requirement if Columbia does not specify. |
| `nut 6-32 brass` | 2 | High | Asgard and TapeTech. Strong because material is explicit and functionally relevant. |
| `pin 1/16 x 1/2 cotter` | 2 | Medium | Columbia and TapeTech. Good physical match, but material/source naming should be checked. |
| `o-ring 5/32 id; 9/16 od` | 2 | Medium | Asgard and TapeTech. Needs cross-section/width confirmation before production import. |
| `bolt 1/4-20 x 1-1/2` | 2 | Medium | Columbia and Platinum. Confirm head style; the grouped title may be under-specified. |

## Findings by part family

### Screws

Screws produce the strongest and most numerous universal candidates. Machine screw rows commonly include the three required attributes: thread, length, and head style.

Recommended production-ready screw key format:

```text
screw:{thread}:{length}:{head_style}:{drive_style?}:{material?}
```

Examples:

```text
screw:6-32:1/2:fillister:slot:stainless
screw:6-32:1/4:binder:slot:stainless
screw:4-40:3/16:binder:slot:stainless
screw:1/4-20:5/8:socket:unknown:unknown
```

Important correction: do not collapse all `fillister`, `binder`, `pan`, `flat`, `round`, `hex`, `socket`, and `truss` rows into one screw group. Head style is part of the physical specification and must remain in the key.

Important correction: do not treat `Screw` with no thread/length as universal. Those rows stay brand-specific or review-only.

### Bolts

Bolts are generally safe when thread and length are present. The audit found cross-brand candidates such as `bolt 1/4-20 x 1-1/2`, but some bolt rows are under-specified because the canonical key does not always preserve head style.

Recommended production rule:

- Safe: `1/4-20 x 1-1/2 Hex Bolt`
- Review: `1/4-20 x 1-1/2 Bolt`
- Reject: `Bolt`

### Nuts

Nuts are strong candidates when thread and nut type are present.

High-confidence groups include:

- `1/4-20 hex nut`
- `1/4-20 nylon lock nut`
- `10-24 nylon lock nut`
- `3/8-16 nylon lock nut`
- `4-40 hex nut`
- `6-32 brass nut`

Production caveat: `hex`, `nyloc/nylon lock`, `jam`, `brass`, `stainless`, `slotted`, `castle`, and `wing` are not interchangeable. The current audit includes `nut 10-24` with examples spanning wing nut and stainless nut language; that group should be downgraded to review until subtype is fully separated.

### Washers

Washers should only be universal when nominal size and washer type are both present.

Safe examples:

- `#6 flat washer`
- `#10 flat washer`
- `1/4 flat washer`
- `#10 fender washer`
- `#6 belleville washer`

Review-only examples:

- `FB Washer`
- `Cup Washer`
- `Piston Backing Washer`
- `Stainless Steel Washer`

Those review-only labels may be proprietary or geometry-specific even when the word `washer` appears.

### Pins and rivets

Pins and rivets require diameter, length, and pin/rivet type.

Safe or near-safe examples:

- `1/16 x 1/2 cotter pin`
- `1/16 x 1/4 split pin`
- `1/4 x 5/8 split pin`
- `3/16 x 3/8 pop rivet`

Production caveat: the existing same-brand review report shows parse issues such as `pin 1/16 x 1 cotter` for titles that appear to include `1/16 x 1/2`. That parser defect must be fixed before automated import.

### O-rings

O-rings are safe only when a standard size or full dimensions are present.

Safe:

- `AS568-006 Buna O-ring`
- explicit `ID x OD x width/cross-section` dimensions, when all dimensions match

Review:

- `O-Ring`
- `Pump O-Ring`
- `Filler/Gooseneck O-Ring`
- `Mud Pump O-Ring Retainer`

Do not group O-ring retainers with O-rings. Retainers are separate proprietary hardware/parts.

### Springs, clips, bushings, bearings, wheels, blades, plates, castings

These should not be automatically universal based on title alone. The same name can describe different force curves, materials, geometry, tolerances, or tool-specific fitment.

Examples that should remain review-only unless dimensions or official compatibility are added:

- `Return Spring`
- `Tension Spring`
- `Lock Clip`
- `Retainer Clip`
- `Bushing`
- `Bearing Sleeve`
- `Wheel`
- `Blade`
- `Head Casting`
- `Side Plate`
- `Frame`

## Parser/audit quality issues found

### 1. `dtb_parts_catalog.csv` source ambiguity

The user-provided `products/Production/launch/dtb_parts_catalog.csv` currently appears empty on current `main`, while the prior audit output references it as a populated source. This needs reconciliation before this becomes canonical. The populated operational source on current `main` is `products/Production/launch/extra/dtb_parts_manager_import_parts.csv`.

### 2. Existing audit reports are not clearly under the user-specified directory

The user referenced `products/Production/launch/reports/universal_parts`. The discoverable files were under `products/Production/launch/reports/` as flat CSV files, not under a `universal_parts/` directory on current `main`.

Recommended canonical structure:

```text
products/Production/launch/reports/universal_parts/
├─ universal_part_groups.csv
├─ universal_part_occurrences.csv
├─ hardware_part_groups_single_brand_review.csv
└─ universal_parts_report.md
```

### 3. Some keys are too broad

Examples:

- `nut 10-24` mixes examples that may include wing nut and stainless nut language.
- `bolt 1/4-20 x 1-1/2` omits head style.
- `screw 6-32 flat head` lacks length.

These should not be imported as production universal IDs until the subtype/dimension parser is fixed.

### 4. Some dimensions are mis-parsed

The single-brand review report includes likely parse errors, such as a `1/16 x 1/2` cotter pin appearing under a `pin 1/16 x 1` key. Any group with parsed dimension disagreement should be quarantined.

### 5. Material must be conditional, not globally ignored

Stainless may be optional for some non-corrosion-critical screws, but brass, nylon/plastic, Buna rubber, belleville/spring form, and fender washer geometry are functionally relevant. For production safety, material/type should stay in the key whenever it changes fit, function, or durability.

## Recommended backend data model

Create a backend-only universal-parts map with three tables/files. Keep the frontend unchanged.

### `universal_parts`

| Field | Purpose |
|---|---|
| `universal_part_id` | Stable generated ID, e.g. `UP-SCREW-6-32-1-2-FILLISTER-SLOT-SS` |
| `canonical_name` | Human-readable physical part name |
| `part_family` | screw, bolt, nut, washer, pin, rivet, o_ring |
| `thread` | Thread spec, when applicable |
| `length` | Length, when applicable |
| `diameter` | Diameter, when applicable |
| `nominal_size` | Washer/O-ring/pin nominal size |
| `head_style` | fillister, binder, flat, pan, socket, truss, hex, round |
| `drive_style` | slot, phillips, socket, unknown |
| `material` | stainless, brass, nylon, Buna, unknown |
| `confidence` | verified, high, medium, review, reject |
| `status` | active, review, rejected |
| `notes` | Manual review notes |

### `universal_part_members`

| Field | Purpose |
|---|---|
| `universal_part_id` | FK/reference to universal part |
| `brand` | Brand label retained for frontend/customer context |
| `brand_sku` | Brand SKU or catalog SKU |
| `manufacturer_sku` | Manufacturer SKU if distinct |
| `source_title` | Original part title/name |
| `source_file` | Source provenance path |
| `schematic_id` | Compatible schematic ID, if applicable |
| `part_id` | Schematic part ID, if applicable |
| `product_id` | Parent product/tool ID, if known |

### `universal_part_compatibility`

| Field | Purpose |
|---|---|
| `universal_part_id` | FK/reference to universal part |
| `brand` | Compatible brand |
| `tool_family` | Automatic taper, flat box, angle head, pump, etc. |
| `product_id` | Tool/product ID |
| `schematic_id` | Schematic placement |
| `quantity` | Quantity used in that schematic |
| `confidence` | Same confidence policy as above |

## Production import policy

1. Import only `verified` and `high` hardware groups first.
2. Exclude all vague or proprietary rows from automatic universalization.
3. Keep brand SKUs intact and never replace frontend SKUs with universal IDs.
4. Add `universal_part_id` as backend metadata only.
5. Require manual approval for springs, clips, bushings, bearings, wheels, blades, plates, castings, and seals.
6. Require all generated groups to preserve the physical fields that make parts interchangeable.
7. Store original title and source path for every member row to keep the audit reversible.

## Recommended next implementation steps

1. Move or regenerate the report files into `products/Production/launch/reports/universal_parts/` so the audit path is canonical.
2. Update `scripts/audit_universal_parts.py` to emit stable `universal_part_id` values and separate `index`, `members`, and `compatibility` CSVs.
3. Tighten parser validation so screws/bolts require thread and length, nuts require thread and nut subtype, washers require nominal size and washer subtype, pins/rivets require diameter and length, and O-rings require AS568 or full dimensions.
4. Add a manual override file for known verified equivalents that cannot be inferred safely from titles alone.
5. Add a CI/audit check that fails if a new universal group loses required physical fields or mixes incompatible subtypes.
6. Add backend metadata import after manual review of all `high` candidates.

## Initial import allowlist

The following groups are suitable for first-pass backend metadata import after a final human spot check against the generated member rows:

```text
screw 6-32 x 1/2 fillister head
screw 6-32 x 1/4 binder head
screw 4-40 x 3/16 binder head
screw 4-40 x 1/4 binder head
screw 4-40 x 1/4 fillister head
screw 1/4-20 x 5/8 socket head
screw 4-40 x 1/8 binder head
screw 4-40 x 5/16 binder head
screw 4-40 x 3/16 flat head
nut 1/4-20 nylon lock
nut 10-24 nylon lock
nut 3/8-16 nylon lock
nut 4-40 hex
nut 6-32 brass
pin 1/16 x 1/2 cotter
```

## Initial quarantine list

The following groups should not be imported without parser correction or manual confirmation:

```text
nut 10-24
bolt 1/4-20 x 1-1/2
screw 6-32 flat head
screw 10-32 hex head
screw 10-32 x 5/8
pin 1/16 x 1 cotter
all generic Screw/Nut/Washer rows
all Spring rows without dimensions and spring type
all Bushing/Bearing rows without dimensions and fitment confirmation
all Wheel/Blade/Plate/Casting/Frame/Body/Bracket rows
```

## Final recommendation

Proceed with a backend-only universal part index, but keep the first import constrained to measurable standard hardware. The existing audit proves there is real cross-brand reuse, especially around small machine screws and nuts. The frontend should continue to display brand-specific parts and SKUs, while the backend stores universal compatibility metadata for search, schematics, inventory intelligence, substitutions, and service workflows.
