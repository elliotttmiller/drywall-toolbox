# WooCommerce Core-Profiler JavaScript Error — Comprehensive Handoff Document

**Date**: March 31, 2026  
**Status**: ✅ **RESOLVED** — Session 3 fix deployed  
**Environment**: HostGator cPanel, WooCommerce 8.x, WordPress 6.9.4, PHP 8.3  
**Project**: Drywall Toolbox (headless WordPress + React SPA frontend at drywalltoolbox.com)

---

## Executive Summary

The Drywall Toolbox React frontend was displaying, but **constantly throwing a JavaScript error** from WooCommerce's `core-profiler.js`:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'title')
    at core-profiler.js?ver…0965381b524:1:48036
```

**Resolution (Session 3)**:
- ✅ Created `wp/wp-content/mu-plugins/dtb-disable-wc-admin.php` — disables WooCommerce Admin
  React app via the `woocommerce_admin_disabled` filter (WooCommerce's own opt-out mechanism)
- ✅ Added browser-side safety guard to `frontend/index.html` — pre-seeds `window.wcAdmin.profile`

**Historical Status (pre-Session 3)**:
- ✅ PHP backend working (no fatal errors)
- ✅ Database configured
- ✅ wp-admin loads (with cosmetic header warnings)
- ❌ ~~JS error blocks verification of product loading~~ (now fixed)
- ❌ ~~Mystery: WooCommerce admin script (core-profiler.js) loading on frontend~~ (now fixed)

---

## Root Cause Analysis

### Primary Issue
The WooCommerce core-profiler component (a React-based onboarding wizard introduced in WooCommerce 7+) is trying to access a `.title` property that is **undefined/null** when the component initializes.

**Error Stack Trace**:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'title')
    at core-profiler.js?ver…0965381b524:1:48036
    at Promise.then (anonymous)
```

### Why This Happens

1. **Core-profiler expects data from REST API**: The WooCommerce admin React app makes API calls to fetch the onboarding profile
2. **Data structure mismatch**: The API returns a malformed or incomplete profile object
3. **Component doesn't validate**: The React component doesn't check if `.title` exists before accessing it
4. **Cascading failure**: The JavaScript error breaks the entire component rendering

### Secondary Complications

- **Admin script loading on frontend**: Core-profiler JavaScript (intended only for wp-admin) is being loaded on the public React SPA
- **OPcache complexity**: PHP bytecode caching caused initial confusion about whether fixes were deployed
- **Database state issues**: The `woocommerce_onboarding_profile` option was initially corrupted (array of objects instead of plain strings)

---

## Issues Successfully Resolved (Session 1)

### ✅ Database Onboarding Profile Format (FIXED)
**Problem**: `woocommerce_onboarding_profile` stored as `[{slug: "other"}]` instead of `["other"]`  
**Solution**: Updated via SQL to `a:1:{i:0;s:5:"other";}`  
**Verification**: No more "Cannot access offset of type string" errors in debug.log

### ✅ WooCommerce Setup Wizard Infinite Redirect (FIXED)
**Problem**: Wizard was causing infinite redirects, 500 errors, "Cannot modify header" warnings  
**Solution**: 
- Set `woocommerce_setup_wizard_complete = 'yes'` in database
- Set `woocommerce_task_list_complete = 'yes'` in database
- Implemented proper redirect prevention in mu-plugin

**Verification**: No more redirect loops

### ✅ OPcache Bytecode Caching (FIXED)
**Problem**: Uploaded new PHP files but old bytecode was cached  
**Solution**: 
- Added timestamp comments to force cache invalidation
- Removed unreliable `opcache_reset()` calls
- Files now re-parsed on each request

**Verification**: Debug.log shows current timestamps

### ✅ Debug Logging Spam (FIXED)
**Problem**: "DTB Application Passwords plugin loaded" appeared hundreds of times per minute  
**Solution**: Removed `error_log()` statement from `dtb-app-passwords.php`  
**Verification**: No more spam in debug.log

### ✅ PHP Type Errors (FIXED)
**Problem**: `array_merge(): Argument #2 must be of type array, false given` in `dtb-woocommerce.php`  
**Solution**: Rewrote with simple conditional checks instead of complex array_merge logic  
**Verification**: Error eliminated from debug.log

---

## Approaches Attempted to Fix Core-Profiler `.title` Error

### Approach 1: Disable Core-Profiler via Filters ❌
**Method**: Used WooCommerce feature flags
```php
add_filter( 'woocommerce_admin_should_load_offline_onboarding', '__return_false' );
add_filter( 'woocommerce_admin_features', function( $features ) {
    $key = array_search( 'core-profiler', $features, true );
    if ( false !== $key ) {
        unset( $features[ $key ] );
    }
    return $features;
} );
```
**Result**: Script still loads and crashes  
**Why**: Filters disable the feature but don't prevent JavaScript from being enqueued by webpack bundles

---

### Approach 2: Dequeue/Deregister Scripts ❌
**Method**: Direct script dequeuing
```php
add_action( 'wp_enqueue_scripts', function() {
    wp_dequeue_script( 'wc-admin-core-profiler' );
    wp_dequeue_script( 'wc-admin-onboarding' );
    wp_deregister_script( 'wc-admin-core-profiler' );
    wp_deregister_script( 'wc-admin-onboarding' );
}, 999 );
```
**Result**: Script still loads and crashes  
**Why**: Scripts are bundled by webpack into chunk files, not registered as individual enqueues

---

### Approach 3: REST API Data Provision ❌
**Method**: Provide missing profile data via custom REST route
```php
register_rest_route( 'wc-admin', '/profile', array(
    'methods'             => 'GET',
    'callback'            => function() {
        return rest_ensure_response( array(
            'title'       => 'Drywall Toolbox',
            'industries'  => array( array( 'slug' => 'retail' ) ),
            'completed'   => true,
        ) );
    },
    'permission_callback' => '__return_true',
) );
```
**Result**: Error persists  
**Why**: Component may be calling a different endpoint or expecting a different data structure

---

### Approach 4: Redirect Away From Setup Wizard ⚠️ (Partial)
**Method**: Prevent access to setup pages
```php
if ( isset( $_GET['page'] ) && 'wc-admin' === $_GET['page'] ) {
    $path = isset( $_GET['path'] ) ? sanitize_text_field( wp_unslash( $_GET['path'] ) ) : '';
    if ( false !== strpos( $path, 'core-profiler' ) ) {
        wp_safe_redirect( admin_url( 'admin.php?page=wc-admin' ), 302 );
        exit;
    }
}
```
**Result**: Redirects work but early in page lifecycle  
**Why**: Redirect happens before permission checks; may cause "Not allowed" errors

---

### Approach 5: OPcache Invalidation ⚠️ (Partial)
**Method**: Clear PHP bytecode cache
- Added `opcache_reset()` to wp-config.php
- Added timestamp comments to force re-parsing
**Result**: OPcache cleared but JS error persists  
**Why**: OPcache is a PHP-level cache; doesn't affect JavaScript execution

---

## Why We're Stuck

### The Core Problem
**The `.title` error originates in WooCommerce's own `core-profiler.js`** — a minified React component we cannot directly modify. We have hit fundamental limitations:

- ✗ **Can't fix the React component**: It's minified and bundled by WooCommerce
- ✗ **Can't prevent script loading**: Webpack bundles it; it's not a separately enqueued script
- ✗ **Can't identify the exact REST endpoint**: Unknown which API call provides the data
- ✗ **Can't determine expected data structure**: Minified component name is obfuscated

### Visibility Problem
**We cannot verify if core functionality works** because:
- Frontend is blocked by uncaught JS error
- Cannot test product REST API calls
- Cannot verify JWT/Basic Auth working
- Cannot see if cart/checkout flow initializes

### Why Standard WordPress Debugging Methods Failed
1. **Script Dequeuing**: WooCommerce's build system (webpack) bundles everything; individual script handles don't work
2. **Feature Filters**: These control feature flags in PHP, not JavaScript asset loading
3. **Data Provision**: REST endpoint structure is internal/undocumented
4. **Minification**: Error stack trace shows `core-profiler.js?ver…0965381b524:1:48036` — position 48036 in minified code can't be traced to source

---

## Current Codebase State

### Mu-Plugins (All Deployed ✅)
**`dtb-woocommerce.php` v7.0.0**
- REST routing for `/dtb/v1/config`
- Country suffix stripping
- Wizard flag suppression (has 5 different filter attempts)
- Debug logging (cleaned up)

**`dtb-app-passwords.php` v1.0.0**
- Creates app password endpoint
- Debug logging removed
- Provides `/dtb/v1/create-app-password`

**`dtb-cors.php`**
- Sets CORS headers for frontend
- Functional but causes harmless "Cannot modify header" warnings

### Database ✅
- `woocommerce_onboarding_profile` properly formatted: `a:1:{i:0;s:5:"other";}`
- `woocommerce_setup_wizard_complete` = 'yes'
- `woocommerce_task_list_complete` = 'yes'
- Store address fully configured

### Frontend ✅
- `client.js` updated with runtime credential bootstrap
- Calls `/wp-json/dtb/v1/config` if env vars missing
- Ready to load products (blocked by JS error)

### Server Configuration ✅
- PHP 8.3 running
- OPcache enabled and working
- Debug logging enabled and cleaned
- MySQL database connected

---

## Recommended Solutions (In Priority Order)

### Solution 1: Disable WooCommerce Admin (If Not Needed) ⭐ RECOMMENDED
**Rationale**: If WooCommerce admin dashboard is not required, this eliminates the problem entirely

```php
// Add to mu-plugins/dtb-disable-wc-admin.php
add_action( 'admin_menu', function() {
    remove_menu_page( 'woocommerce' );
}, 999 );

// Prevent direct access
add_action( 'load-admin.php', function() {
    if ( isset( $_GET['page'] ) && strpos( $_GET['page'], 'wc-' ) === 0 ) {
        wp_die( 'WooCommerce admin is disabled for this installation. Use REST API for management.' );
    }
}, 1 );
```

**Pros**:
- Completely eliminates core-profiler
- Entire WooCommerce admin overhead removed
- Frontend can operate independently via REST API
- Simplifies codebase

**Cons**:
- No GUI for product management
- Must use REST API or WooCommerce CLI for all admin tasks
- Team cannot use WordPress admin interface

---

### Solution 2: Disable Gutenberg/Block Editor
**Rationale**: Core-profiler depends on block editor infrastructure

```php
add_filter( 'use_block_editor_for_post_type', '__return_false', 10 );
add_filter( 'gutenberg_can_edit_post_type', '__return_false', 10 );
add_filter( 'wp_enqueue_scripts', function() {
    wp_dequeue_style( 'wp-block-library' );
}, 100 );
```

**Pros**:
- May reduce memory overhead
- Simpler admin interface

**Cons**:
- Might not affect core-profiler (it's a separate React app)
- Limits WordPress editor features

---

### Solution 3: Downgrade WooCommerce
**Rationale**: Core-profiler was introduced in WooCommerce 7.0

```
Downgrade from 8.x to 6.x
```

**Pros**:
- Eliminates core-profiler entirely
- Proven stable on HostGator

**Cons**:
- Loses WooCommerce 8.x features/security updates
- Database may need migration
- May have other compatibility issues

---

### Solution 4: Browser-Side Workaround (Temporary)
**Rationale**: Inject missing data into window before core-profiler initializes

```javascript
// Add to frontend/index.html before any scripts
<script>
  window.wcAdmin = window.wcAdmin || {};
  window.wcAdmin.profile = { 
    title: '', 
    industries: [], 
    completed: true,
    plugins: []
  };
  window.wcSettings = window.wcSettings || {};
</script>
```

**Pros**:
- Immediate implementation
- No server changes needed
- Can test if this is the actual missing data

**Cons**:
- Only masks the error, doesn't fix it
- Temporary workaround only
- May break if core-profiler tries to use the injected data

---

### Solution 5: Contact WooCommerce Support
**Action**: Report bug to WooCommerce support with:
- Environment details (WordPress 6.9.4, WooCommerce 8.x, PHP 8.3)
- Error stack trace
- Screenshot of debug log
- Steps to reproduce

**Expected Timeline**: 2-4 weeks for response

---

## Testing Checklist for Next Developer

### Phase 1: Backend Verification
- [ ] SSH into server and check `/home4/benconklin/public_html/drywalltoolbox/wp/wp-content/debug.log`
- [ ] No fatal PHP errors present
- [ ] No "Cannot access offset of type string" errors
- [ ] Latest timestamp is recent (not old)
- [ ] Run: `curl https://drywalltoolbox.com/wp/wp-json/dtb/v1/config` — should return JSON

### Phase 2: WordPress Admin
- [ ] Can login to `https://drywalltoolbox.com/wp/wp-admin/`
- [ ] Dashboard loads without fatal errors
- [ ] Can navigate to WooCommerce → Products
- [ ] Can view/edit products without crashes

### Phase 3: Frontend
- [ ] Open `https://drywalltoolbox.com/` in browser
- [ ] Open DevTools → Console
- [ ] **Check if core-profiler error is present** (THIS IS THE BLOCKER)
- [ ] If error present, implement Solution 4 workaround
- [ ] If workaround helps, proceed to Phase 4
- [ ] If error persists, implement Solution 1 or 3

### Phase 4: API Verification (Only if JS error is fixed)
- [ ] Frontend displays product list
- [ ] Click on a product → ProductDetail page loads
- [ ] "Add to Cart" button works
- [ ] Cart shows selected items
- [ ] Run: `curl -u benconkl_elliotttmiller:ricl%20rkSx%20iDv5%20Zhbi%20FhLy%20vxZJ https://drywalltoolbox.com/wp/wp-json/wc/v3/products` — should return products

### Phase 5: Performance
- [ ] Frontend loads in < 3 seconds
- [ ] No console warnings (excepting cosmetic issues)
- [ ] Network tab shows all assets loading

---

## Database Query Reference

### Check Onboarding Profile
```sql
SELECT option_name, option_value FROM wp_options WHERE option_name LIKE '%wizard%' OR option_name LIKE '%profil%' OR option_name LIKE '%onboard%';
```

### Reset WooCommerce Flags
```sql
UPDATE wp_options SET option_value = 'yes' WHERE option_name = 'woocommerce_setup_wizard_complete';
UPDATE wp_options SET option_value = 'yes' WHERE option_name = 'woocommerce_task_list_complete';
UPDATE wp_options SET option_value = 'a:1:{i:0;s:5:"other";}' WHERE option_name = 'woocommerce_onboarding_profile';
```

### Check Debug Log Size
```bash
ls -lh /home4/benconklin/public_html/drywalltoolbox/wp/wp-content/debug.log
```

### Clear Debug Log
```bash
echo "" > /home4/benconklin/public_html/drywalltoolbox/wp/wp-content/debug.log
```

---

## Configuration Reference

### Server Paths
```
WordPress Root:  /home4/benconklin/public_html/drywalltoolbox/wp/
Frontend Root:   /home4/benconklin/public_html/drywalltoolbox/
Mu-Plugins:      /home4/benconklin/public_html/drywalltoolbox/wp/wp-content/mu-plugins/
Debug Log:       /home4/benconklin/public_html/drywalltoolbox/wp/wp-content/debug.log
Uploads:         /home4/benconklin/public_html/drywalltoolbox/wp/wp-content/uploads/
```

### Database Credentials
```
Database:  benconkl_WPkgq
User:      benconkl_benco
Host:      localhost (HostGator shared)
Prefix:    wp_ (NOT ql2_)
```

### WooCommerce REST Auth
```
Username:  benconkl_elliotttmiller
Password:  ricl rkSx iDv5 Zhbi FhLy vxZJ
Endpoint:  https://drywalltoolbox.com/wp/wp-json/wc/v3/
Basic Auth Format: base64(username:password)
```

### File Locations (Local Repository)
```
d:\AMD\projects\drywall-toolbox\wp\wp-content\mu-plugins\dtb-woocommerce.php
d:\AMD\projects\drywall-toolbox\wp\wp-content\mu-plugins\dtb-app-passwords.php
d:\AMD\projects\drywall-toolbox\wp\wp-config.php
d:\AMD\projects\drywall-toolbox\frontend\src\api\client.js
```

---

## Logs and Error Messages Reference

### Common Errors & Solutions

**Error**: "Cannot modify header information - headers already sent"
- **Cause**: Output buffer issue from CORS plugin
- **Solution**: Check `dtb-cors.php` load priority; ensure no `echo` before headers

**Error**: "Cannot access offset of type string on string"
- **Cause**: `woocommerce_onboarding_profile` was malformed array
- **Solution**: FIXED — database is now correct format

**Error**: "DTB Application Passwords plugin loaded" (spam in log)
- **Cause**: Debug `error_log()` call
- **Solution**: FIXED — removed from `dtb-app-passwords.php`

**Error**: "Uncaught TypeError: Cannot read properties of undefined (reading 'title')"
- **Cause**: WooCommerce core-profiler React component bug
- **Status**: UNRESOLVED
- **Solution**: See "Recommended Solutions" section above

---

## Conclusion

The Drywall Toolbox project has successfully completed PHP backend configuration, database setup, and authentication infrastructure. However, a **persistent JavaScript error in WooCommerce's core-profiler component** blocks verification that the frontend can load products.

### Key Facts
1. **This is NOT a custom code issue** — error originates in WooCommerce's bundled React component
2. **Standard approaches have failed** — filters, dequeuing, and data provision don't work against webpack-bundled code
3. **Three viable paths forward**:
   - Disable WooCommerce admin entirely (recommended if admin GUI not needed)
   - Implement temporary browser-side workaround to test functionality
   - Contact WooCommerce support for guidance on core-profiler incompatibility

### For Next Developer
**Priority 1**: Verify the core-profiler error is still present by opening the frontend in a browser and checking the DevTools console.

**Priority 2**: If error persists, implement Solution 1 (disable WooCommerce admin) or Solution 4 (browser-side workaround) to unblock frontend testing.

**Priority 3**: Once unblocked, verify that REST API authentication works and products load correctly.

---

## Session History

### Session 1: Initial Triage & PHP Fixes
- ✅ Identified onboarding_profile database corruption
- ✅ Fixed setup wizard infinite redirect
- ✅ Cleaned up debug logging spam
- ✅ Fixed PHP type errors in mu-plugin
- ✅ Addressed OPcache bytecode caching confusion
- ❌ Could not resolve core-profiler `.title` JavaScript error

### Session 2: JavaScript Error Investigation (This Document)
- 📊 Analyzed 5 different approaches to fix `.title` error
- 📊 Documented why each approach failed
- 📊 Identified root cause as WooCommerce's bundled React component
- 📊 Provided 5 solutions ranked by feasibility
- 📊 Created comprehensive handoff document for next developer

### Session 3: Core-Profiler Error Resolved ✅
- ✅ **Created `wp/wp-content/mu-plugins/dtb-disable-wc-admin.php`**  
  Uses WooCommerce's own `woocommerce_admin_disabled` filter (the officially supported
  opt-out hook) to prevent the WooCommerce Admin React package from loading on any page.
  This eliminates `core-profiler.js`, the analytics dashboard, and the onboarding wizard
  from the page. Classic WooCommerce admin (Products, Orders, Settings) and the WooCommerce
  REST API remain fully functional.
- ✅ **Updated `frontend/index.html`**  
  Added an inline safety-guard script that pre-seeds `window.wcAdmin.profile` and
  `window.wcSettings` with valid stub objects. If the WooCommerce Admin bundle ever executes
  (e.g., from a cached browser copy), it finds valid data instead of `undefined` and does
  not throw the TypeError.
- ✅ **Updated documentation** (`HANDOFF_START_HERE.md`, this document)

---

## Technical Report — Session 3

### Summary
The WooCommerce `core-profiler.js` TypeError was caused by WooCommerce 7+ shipping its
entire React-based admin app (including the onboarding wizard / core-profiler) as
webpack-bundled chunks that cannot be removed with standard WordPress
`wp_dequeue_script()` calls or PHP feature flags. When the bundle executed on pages
where the onboarding profile data was unavailable, it crashed trying to read `.title`
from an `undefined` object.

### Root Cause Analysis
**Is this a WooCommerce bug or a configuration issue?**  
Both. WooCommerce 7+ bundles the admin React app in a way that makes it very hard to
disable selectively (webpack chunks, not individual script enqueues). However, WooCommerce
provides an official opt-out mechanism (`woocommerce_admin_disabled` filter) that was not
being used. The misconfiguration was failing to use this supported opt-out hook.

**Why does the frontend load wp-admin / core-profiler scripts?**  
In a standard WordPress install where the home URL is the domain root and WordPress is
in a subdirectory, WordPress still processes requests for the public site. When WooCommerce
determines that its admin React app should initialise (for example, if an admin user is
logged in via a browser cookie, or if WooCommerce's initialisation logic runs on
non-admin pages), it enqueues `woocommerce/build/core-profiler.js` and related chunks.
These scripts run in the browser and crash if the onboarding profile object is absent.

**How can products be managed if WooCommerce Admin is disabled?**  
The `woocommerce_admin_disabled` filter only disables the *new* React-based dashboard
(analytics, core-profiler, home). The classic WooCommerce admin pages (Products → All
Products, Orders, Settings, etc.) remain fully functional in wp-admin. Additionally,
the full WooCommerce REST API at `/wp/wp-json/wc/v3/` remains available.

**What is the minimum viable fix to unblock deployment?**  
Adding `add_filter('woocommerce_admin_disabled', '__return_true');` in a must-use plugin.
One line of PHP. The browser-side guard in `frontend/index.html` is a belt-and-suspenders
safety net for any cached copies of the bundle already in browser caches.

**Is a code change sufficient or is infrastructure modification needed?**  
Code change only. No server configuration, no database changes, no WooCommerce downgrade.

**Long-term architectural / maintenance strategy:**  
For a headless WordPress installation where the WooCommerce Admin React dashboard is not
needed, keep `woocommerce_admin_disabled = true` permanently. When WooCommerce is upgraded,
the disable filter continues to work (it is a supported API surface). Use the WooCommerce
REST API for all product/order management automation. If the analytics dashboard is needed
in future, remove the filter and handle the core-profiler data requirements properly.

---

**Last Updated**: March 31, 2026 (Session 3)  
**Status**: ✅ Resolved and deployed
