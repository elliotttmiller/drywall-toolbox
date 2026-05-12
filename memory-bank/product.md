# Product

## What This Project Is

Drywall Toolbox is a headless ecommerce and service platform for professional drywall contractors. The public experience is a React single-page app in `frontend/`. WordPress and WooCommerce in `wp/` provide the backend system of record for products, customers, orders, media, and custom business workflows.

This repository is not just a storefront. It combines:

- ecommerce catalog and checkout
- replacement-parts and schematic lookup
- repair-service intake
- customer account, rewards, and membership experiences
- catalog/media operations tooling for maintaining a large specialized product dataset

## Primary Audience

The current product is aimed primarily at:

- professional drywall finishers and contractors
- customers buying production-grade tools, parts, and accessories
- customers who need repair or rebuild services for drywall tools
- internal operators maintaining catalog data, images, schematics, and WooCommerce content

## Core Value Proposition

The repo currently supports a "one-stop shop" model for drywall professionals:

- buy tools and parts from multiple brands in one place
- find replacement parts through schematics and tool-specific diagrams
- submit repair requests instead of replacing expensive tools outright
- manage orders, account data, rewards, and membership benefits in one system

The product copy and route structure show that the experience is intentionally contractor-oriented rather than general-consumer lifestyle ecommerce.

## Confirmed User-Facing Capabilities

### 1. Storefront and commerce

Confirmed in `frontend/src/App.jsx`, product APIs, and page/component structure:

- browse product listings at `/products`, `/all-products`, and `/category/:slug`
- view product detail pages at `/products/:slug` and `/product/:partNumber`
- filter by brand/category and search the catalog
- add products to cart and use cart/checkout flows
- view order confirmation pages

### 2. Parts and schematic lookup

Confirmed in `frontend/src/pages/Schematics.jsx`, `frontend/src/data/schematicMappings.js`, and the schematics API layer:

- browse brand-specific schematics
- navigate tool diagrams and associated replacement parts
- use schematic media served from WordPress, with static asset fallbacks
- support multiple brands including Columbia, TapeTech, Asgard, Platinum, Dura-Stilts, and Level5 in the current frontend assets/data

This is a major differentiator of the product, not a side feature.

### 3. Repair-service intake

Confirmed in `frontend/src/pages/Repairs.jsx` and `wp/wp-content/mu-plugins/dtb-veeqo.php`:

- multi-step repair request form
- structured capture of contact info, tool details, service tier, shipping, and issue notes
- support for tool-brand and schematic-driven repair flows
- repair submissions create WooCommerce-backed service orders
- optional Veeqo sync and confirmation-email handling happen server-side

The repair flow is a full product surface, with pricing copy, membership-aware messaging, and shipping guidance already built into the frontend.

### 4. Customer authentication and account area

Confirmed in `frontend/src/auth/*`, protected routes in `frontend/src/App.jsx`, and dashboard components:

- login, registration, forgot-password, and reset-password flows
- protected customer pages such as dashboard, orders, rewards, saved addresses, notifications, and account settings
- in-memory token storage rather than browser persistence
- session-expiry handling via `auth:expired` events on 401s

### 5. Rewards

Confirmed in `frontend/src/api/rewards.js`, dashboard tabs, and backend mu-plugins:

- rewards balance/history/redemption flows

### 6. Estimation/calculator tools

Confirmed in `frontend/src/pages/Calculators.jsx` and `frontend/src/components/calculators/`:

- drywall sheet calculator
- tape calculator
- corner bead calculator
- screw calculator
- summary/export/share-oriented calculator hub behavior

These calculators are part of the public product experience, not just internal tooling.

### 7. Informational/support pages

Confirmed route surfaces include:

- contact page
- FAQ
- shipping policy
- returns portal
- toolset builder

## Backend Product Responsibilities

WordPress/WooCommerce are being used as an application backend, not the public rendering layer. The backend currently owns:

- product catalog and product metadata
- customer and order records
- WooCommerce Store API and custom REST endpoints
- repair-order creation
- rewards and membership data exposure
- image/media registration and sync workflows
- schematic media delivery
- inventory/shipping/order integration with Veeqo

## Operational and Internal Product Surfaces

This repo also includes important operator-facing capabilities that support the business but are not end-user storefront features:

- WooCommerce/WordPress admin extensions in `wp/wp-content/mu-plugins/`
- image-sync and product-mapping tooling
- schematics admin support
- cache admin and API health monitoring
- Python scripts for scraping, catalog normalization, image cleanup, migration, auditing, and WooCommerce import preparation
- large local product and image datasets under `products/`

These are part of the product's operating model and should be treated as first-class project concerns.

## Current Product Architecture Assumptions

The checked-in code consistently assumes:

- React is the only public frontend
- WordPress is a headless backend/API/admin layer
- WooCommerce remains the commerce system of record
- product/parts/schematic content is asset-heavy and operationally maintained
- custom business logic belongs in mu-plugins rather than in the frontend

## Scope Boundaries and Non-Goals

Based on the current codebase, the product does not treat these as primary goals:

- traditional WordPress theme rendering for the public site
- generic CMS-first editorial publishing
- lightweight, catalog-only ecommerce without services/repair workflows
- purely static product content with no backend business logic

## Important Current Realities

- The repo is both runtime application and operations workspace.
- Schematics and parts data are a core part of the product identity.
- Repair services are deeply integrated, not an experimental page.
- Rewards/membership/account experiences are real implemented surfaces.
- The frontend still contains both newer `src/api/*` code and older compatibility code in `src/services/*`, so the product is functional but mid-transition in places.
- The repository contains substantial media/catalog payloads, which materially affect maintenance and build behavior.

## Best Short Description

If we need one truthful summary sentence for the project, the most accurate current version is:

Drywall Toolbox is a headless React + WordPress/WooCommerce platform for drywall professionals that combines ecommerce, replacement-parts schematics, repair-service intake, and contractor account/rewards workflows, plus the operational tooling required to maintain a specialized catalog and media library.
