# DTB Catalog Platform — API Contract

> Version: 1.0  
> Namespace: `dtb/v1`  
> Base URL: `https://drywalltoolbox.com/wp/wp-json/dtb/v1`

All responses are `application/json`.  
All product/variation IDs are **integers**.  
Prices are **floats** or `null` (never string).  
String fields default to `""` when absent (never `null` unless specified).  
Array fields default to `[]` when absent.

---

## Authentication

Public endpoints (`catalog/facets`, `catalog/products`, `catalog/products/:slug/detail`) require no authentication.

Toolset endpoints (`toolsets`, `toolsets/:id/options`) require no authentication.

`POST /toolsets/validate` requires no authentication (server re-validates all data).

Admin/cache endpoints require JWT Bearer token (`Authorization: Bearer <token>`).

---

## 1. Catalog Facets

### `GET /dtb/v1/catalog/facets`

Returns all filterable facet values for the product listing page.  
Response is cached with a 5-minute TTL, invalidated on any product save/delete.

**Response**

```json
{
  "brands": [
    {
      "key":   "tapetech",
      "label": "TapeTech",
      "slug":  "tapetech",
      "count": 42
    }
  ],
  "categories": [
    {
      "key":   "finishing",
      "label": "Finishing Tools",
      "count": 18
    }
  ],
  "displayCategoriesByBrand": {
    "tapetech": [
      {
        "key":   "finishing_boxes",
        "label": "Finishing Boxes",
        "count": 8
      }
    ]
  }
}
```

---

## 2. Catalog Products

### `GET /dtb/v1/catalog/products`

Returns a paginated list of normalized `CatalogProduct` DTOs.

**Query Parameters**

| Parameter          | Type    | Description                                    |
|--------------------|---------|------------------------------------------------|
| `brand`            | string  | DTB brand slug (e.g. `tapetech`)               |
| `category`         | string  | DTB category key (e.g. `finishing`)            |
| `display_category` | string  | DTB display category key/slug                  |
| `tool_family`      | string  | Tool family key (e.g. `flat_box`)              |
| `product_kind`     | string  | `tool`, `part`, `accessory`, `service`, `kit`  |
| `builder_eligible` | integer | `1` to filter builder-eligible only            |
| `builder_slot`     | string  | Slot ID (e.g. `flatBox`)                       |
| `workflow_scope`   | string  | Scope (e.g. `full`, `finishing`)               |
| `search`           | string  | Full-text search                               |
| `page`             | integer | 1-based page number (default: `1`)             |
| `per_page`         | integer | Items per page, 1–100 (default: `24`)          |
| `sort`             | string  | `popular`, `newest`, `price-low`, `price-high`, `az` |

**Response**

```json
{
  "items": [ /* CatalogProduct[] — see DTO below */ ],
  "pagination": {
    "page":       1,
    "perPage":    24,
    "total":      128,
    "totalPages": 6
  }
}
```

---

## 3. Product Detail

### `GET /dtb/v1/catalog/products/:slug/detail`

Returns the full product detail page DTO: normalized parent, variation matrix, and resolved default variation.

**Response**

```json
{
  "product":    { /* CatalogProduct */ },
  "variations": [ /* CatalogVariation[] */ ],
  "computed": {
    "defaultVariation":      { /* CatalogVariation | null */ },
    "hasInStockVariation":   true,
    "variationCount":        3,
    "inStockVariationCount": 2
  }
}
```

### `GET /dtb/v1/catalog/products/:id/variations`

Returns all variations for a variable parent by product ID.

**Response**

```json
{
  "productId":  205,
  "variations": [ /* CatalogVariation[] */ ],
  "count":      3
}
```

---

## 4. Toolset Templates

### `GET /dtb/v1/toolsets`

Returns all available toolset templates (lean payload, slot `allowedFamilies` omitted).

**Query Parameters**

| Parameter | Type   | Description            |
|-----------|--------|------------------------|
| `brand`   | string | Filter by brand key    |

**Response**

```json
{
  "templates": [ /* ToolsetTemplate[] */ ],
  "count":     4
}
```

### `GET /dtb/v1/toolsets/:id`

Returns a single template by ID with full slot definitions.

**Response**: `ToolsetTemplate`

---

## 5. Toolset Options

### `GET /dtb/v1/toolsets/:id/options`

Returns purchasable options grouped by slot ID.  
Variable products produce one `ToolsetOption` per eligible variation.

**Response**

```json
{
  "templateId": "tapetech-full",
  "optionsBySlot": {
    "taper":   [ /* ToolsetOption[] */ ],
    "flatBox": [ /* ToolsetOption[] */ ]
  }
}
```

---

## 6. Toolset Validation

### `POST /dtb/v1/toolsets/validate`

Validates slot selections before cart submission.  
The frontend must call this before adding toolset items to the cart.

**Request Body**

```json
{
  "templateId": "tapetech-full",
  "selections": {
    "taper":   { "productId": 101, "variationId": 0,   "quantity": 1 },
    "flatBox": { "productId": 205, "variationId": 310, "quantity": 1 }
  }
}
```

**Response — 200 (valid)**

```json
{
  "templateId": "tapetech-full",
  "valid":      true,
  "errors":     [],
  "warnings":   [
    {
      "code":    "out_of_stock",
      "slot":    "taper",
      "message": "\"TapeTech Automatic Taper\" is currently out of stock."
    }
  ]
}
```

**Response — 422 (invalid)**

```json
{
  "templateId": "tapetech-full",
  "valid":      false,
  "errors": [
    {
      "code":    "required_slot_empty",
      "slot":    "taper",
      "message": "Required slot \"Taper\" has no selection."
    }
  ],
  "warnings": []
}
```

**Blocking validation codes**

| Code                       | Meaning                                        |
|----------------------------|------------------------------------------------|
| `required_slot_empty`      | Required slot not filled                       |
| `unknown_slot`             | Slot ID not in template                        |
| `invalid_product_id`       | `productId` ≤ 0 or missing                     |
| `invalid_quantity`         | Quantity not in 1–99 range                     |
| `product_not_found`        | WC product record not found                    |
| `not_purchasable`          | Product/variation is not purchasable           |
| `brand_mismatch`           | Product brand doesn't match template brand     |
| `variation_parent_mismatch`| Variation doesn't belong to stated parent      |
| `slot_ineligible`          | Product not eligible for selected slot         |

**Warning codes (non-blocking)**

| Code           | Meaning                         |
|----------------|---------------------------------|
| `out_of_stock` | Selected item is out of stock   |

---

## 7. DTOs

### CatalogProduct

```jsonc
{
  "id":             205,            // WC product post ID (integer)
  "type":           "variable",     // simple | variable | variation
  "sku":            "TT-FLATBOX",
  "slug":           "tapetech-flat-box",
  "name":           "TapeTech Flat Box",
  "productKind":    "tool",         // tool | part | accessory | service | kit
  "isParts":        false,          // boolean
  "isVariable":     true,
  "parentId":       null,           // integer | null (null for parents)
  "parentSku":      "",
  "defaultVariationId": 310,        // integer | null

  "brand": {
    "key":   "tapetech",
    "label": "TapeTech",
    "slug":  "tapetech"
  },

  "category": {
    "key":   "finishing",
    "label": "Finishing Tools",
    "slug":  "finishing"
  },

  "displayCategory": {
    "key":   "finishing_boxes",
    "label": "Finishing Boxes",
    "slug":  "finishing-boxes"
  },

  "toolFamily": "flat_box",
  "toolRole":   "primary_tool",

  "price": {
    "regular":   null,  // float | null (null for variable parents)
    "sale":      null,
    "effective": null,
    "currency":  "USD",
    "formatted": ""
  },

  "inventory": {
    "stockStatus": "instock",   // instock | outofstock | onbackorder
    "quantity":    null,        // integer | null
    "managed":     false
  },

  "media": {
    "thumbnail": "https://...",  // string | ""
    "images":    []              // string[]
  },

  "builder": {
    "eligible":      true,
    "slots":         ["flatBox", "flatBox2"],
    "workflowScopes":["full", "finishing"],
    "rank":          10,
    "requiredAccessory": false,
    "kitIncludedItem":   false
  },

  "cardProduct": {
    "id":             310,        // variation ID for variable, product ID for simple
    "parentId":       205,        // integer | null
    "sku":            "TT-BOX-7",
    "name":           "TapeTech Flat Box",
    "price":          189.00,     // float | null
    "image":          "https://...",
    "stockStatus":    "instock",
    "variationLabel": "7 in",
    "addToCartType":  "variation" // "simple" | "variation"
  },

  "schematics": {
    "brand": "tapetech",
    "group": "automatic_taper",
    "position": null
  },

  "meta": {
    "mpn":            "",
    "upc":            "",
    "manufacturerSku":"",
    "sourceUrl":      "",
    "catalogSource":  ""
  }
}
```

### CatalogVariation

```jsonc
{
  "id":             310,
  "parentId":       205,
  "parentSku":      "TT-FLATBOX",
  "sku":            "TT-BOX-7",
  "mpn":            "",
  "name":           "TapeTech Flat Box",

  "variationAxis":  "size",
  "variationValue": "7",
  "variationLabel": "7 in",

  "attributes": {
    "attribute_pa_size": "7"
  },

  "price": {
    "regular":   189.00,
    "sale":      null,
    "effective": 189.00,
    "currency":  "USD",
    "formatted": "$189.00"
  },

  "inventory": {
    "stockStatus": "instock",
    "quantity":    null,
    "managed":     false
  },

  "media": {
    "thumbnail": "",         // "" means inherit parent image
    "images":    []
  },

  "purchasable":      true,
  "builderEligible":  true,
  "builderSlots":     ["flatBox", "flatBox2"],
  "sort":             10
}
```

### ToolsetTemplate

```jsonc
{
  "id":          "tapetech-full",
  "brandKey":    "tapetech",
  "scope":       "full",
  "name":        "TapeTech Full Set",
  "description": "Complete TapeTech automatic taping system",
  "slots": [
    { /* ToolsetSlot */ }
  ],
  "includedItems": [],
  "pricingRule":   "sum"
}
```

### ToolsetSlot

```jsonc
{
  "id":                      "flatBox",
  "label":                   "Flat Box #1",
  "required":                true,
  "minSelections":           1,
  "maxSelections":           1,
  "allowedFamilies":         ["flat_box"],   // backend only — not in public list
  "allowVariableParents":    false,
  "requirePurchasableVariation": true
}
```

### ToolsetOption

```jsonc
{
  "productId":      205,
  "variationId":    310,          // null for simple products
  "sku":            "TT-BOX-7",
  "parentSku":      "TT-FLATBOX",
  "name":           "TapeTech Flat Box",
  "variationLabel": "7 in",
  "price":          189.00,       // float | null
  "stockStatus":    "instock",
  "image":          "https://...",
  "brandKey":       "tapetech",
  "brandLabel":     "TapeTech",
  "toolFamily":     "flat_box",
  "builderRank":    10,
  "eligibleSlots":  ["flatBox", "flatBox2"]
}
```

---

## 8. Cart Line Metadata (Toolset)

Every line item added from the Toolset Builder must include this metadata.  
Items sharing the same `_dtb_toolset_instance_id` UUID form one kit configuration.

| Meta key                      | Type   | Example          |
|-------------------------------|--------|------------------|
| `_dtb_toolset_id`             | string | `tapetech-full`  |
| `_dtb_toolset_instance_id`    | string | UUID v4          |
| `_dtb_toolset_slot`           | string | `flatBox`        |
| `_dtb_toolset_slot_label`     | string | `Flat Box #1`    |
| `_dtb_toolset_brand`          | string | `tapetech`       |
| `_dtb_toolset_scope`          | string | `full`           |
| `_dtb_included_item`          | string | `0` or `1`       |

**Rules:**

- Simple product line item: `id` = `productId`.
- Variable product line item: `id` = `variationId` (**never** `productId`).
- `_dtb_toolset_instance_id` is a UUID generated once per Toolset Builder session and shared by all lines in that kit.

---

## 9. DTB Product Meta Keys Reference

| Meta key                        | Type    | Description                                      |
|---------------------------------|---------|--------------------------------------------------|
| `_dtb_brand_key`                | string  | Canonical brand slug (`tapetech`)                |
| `_dtb_brand_label`              | string  | Human-readable brand name                        |
| `_dtb_manufacturer_sku`         | string  | Manufacturer's official SKU                      |
| `_dtb_mpn`                      | string  | Manufacturer Part Number                         |
| `_dtb_upc`                      | string  | UPC/GTIN barcode                                 |
| `_dtb_product_kind`             | string  | `tool`, `part`, `accessory`, `service`, `kit`    |
| `_dtb_tool_family`              | string  | Tool family key (`flat_box`, `automatic_taper`)  |
| `_dtb_tool_role`                | string  | `primary_tool`, `handle`, `replacement_part`, …  |
| `_dtb_category_key`             | string  | DTB internal category key (`finishing`)          |
| `_dtb_display_category_key`     | string  | Display category for filters (`finishing_boxes`) |
| `_dtb_is_parts`                 | boolean | `1` if replacement part                          |
| `_dtb_is_repairable_tool`       | boolean | `1` if tool can be repaired/rebuilt              |
| `_dtb_parent_product_sku`       | string  | Parent SKU (variation only)                      |
| `_dtb_variation_axis`           | string  | Variation dimension key (`size`, `length`)       |
| `_dtb_variation_value`          | string  | Canonical dimension value (`7`, `10`, `36`)      |
| `_dtb_variation_label`          | string  | Display label (`7 in`, `10 in`, `3 ft`)          |
| `_dtb_default_variation_id`     | integer | Default purchasable variation WC ID              |
| `_dtb_inherit_parent_image`     | boolean | Variation inherits parent gallery image          |
| `_dtb_variation_sort`           | integer | Display sort order (lower = first)               |
| `_dtb_builder_eligible`         | boolean | Appears in Toolset Builder slot options          |
| `_dtb_builder_slots`            | string  | CSV slot IDs (`flatBox,flatBox2`)                |
| `_dtb_workflow_scopes`          | string  | CSV scopes (`full,finishing`)                    |
| `_dtb_builder_rank`             | integer | Sort rank within slot (lower = first)            |
| `_dtb_builder_required_accessory` | boolean | Required accessory in kit                     |
| `_dtb_kit_included_item`        | boolean | Included (non-selectable) kit item               |
| `_dtb_compatible_tool_skus`     | string  | CSV of compatible tool SKUs                      |
| `_dtb_replacement_part_for`     | string  | CSV of parent tool SKUs this part fits           |
| `_dtb_schematic_brand`          | string  | Schematics brand key                             |
| `_dtb_schematic_group`          | string  | Schematics group key (`automatic_taper`)         |
| `_dtb_schematic_position`       | integer | Position number in schematic diagram             |
| `_dtb_source_url`               | string  | Official product page URL                        |
| `_dtb_catalog_source`           | string  | `official_pdf`, `shopamestools`, `manual`        |

---

## 10. Cache Invalidation

The catalog platform caches are automatically invalidated on:

- `save_post_product` / `save_post_product_variation`
- `deleted_post` (product or variation)
- `woocommerce_new_product`, `woocommerce_update_product`, `woocommerce_delete_product`
- `woocommerce_new_product_variation`, `woocommerce_update_product_variation`, `woocommerce_delete_product_variation`
- `woocommerce_product_import_inserted_product_object`, `woocommerce_product_import_updated_product_object`
- `woocommerce_trash_product`, `woocommerce_untrash_product`

Manual flush: `POST /wp-json/dtb/v1/admin/cache/products/flush` (requires admin JWT).

The custom action `do_action('dtb_catalog_caches_invalidated', $subject)` fires after every automatic invalidation and can be used by other plugins for dependent cache busting.
