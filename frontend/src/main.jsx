import './bootstrapRuntimeAssetBase.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './styles/machined-design.css'
import './styles/tool-selector.css'
import './styles/technical-specifications.css'
import './styles/product-detail-modern.css'
import './styles/product-variation-selector-overlay.css'
import './styles/reviews.css'
import './styles/storefront-tokens.css'
import './styles/storefront-shell.css'
import './styles/storefront-sections.css'
import './styles/product-page-search-removal.css'
import './styles/storefront-product-card.css'
import './styles/storefront-drawer.css'
import './styles/storefront-search-product-cards.css'
import './styles/account-hub.css'
import './styles/account-hub-cta.css'
import './styles/mobile-responsive.css'
import './styles/mobile-product-typography.css'
import './styles/mobile-liquid-typography.css'
import './styles/schematic-page-tabs-responsive.css'
import './styles/order-item-images.css'
import './styles/product-compatible-schematics-cleanup.css'
import './styles/order-tracking-layout-fixes.css'
import './styles/mobile-account-order-layout-fixes.css'
import './styles/order-checkout-font-consistency.css'
import './styles/global-loading.css'
import './features/checkout/checkout-system.css'
import './features/checkout/checkout-express-payment-rail.css'
import './components/catalog/products-selector-overrides.css'
import './styles/mobile-fluid-viewport-authority.css'
import './features/checkout/checkout-fast-flow.css'
import './features/checkout/checkout-repair-flow.css'
import './features/checkout/checkout-step-runtime.css'
import './features/checkout/checkout-mobile-reference-flow.css'
import './features/checkout/checkout-mobile-sheet-polish.css'
import './features/checkout/checkout-mobile-screen-flow.css'
import './features/checkout/checkout-mobile-flow-revisions.css'
import './features/checkout/checkout-review-only-extras.css'
import './features/checkout/checkout-same-shell-payment.css'
import App from './App.jsx'
import ErrorBoundary from './components/errors/ErrorBoundary.jsx'
import { installSchematicPageLabelRuntime } from './utils/schematicPageLabelRuntime.js'
import { installMobileSchematicNavRuntime } from './utils/mobileSchematicNavRuntime.js'
import { installRepairPackageSelectionRuntime } from './utils/repairPackageSelectionRuntime.js'
import { installCustomerFacingCopyRuntime } from './utils/customerFacingCopyRuntime.js'
import { installCheckoutExpressRailRuntime } from './features/checkout/checkoutExpressRailRuntime.js'
import { installCheckoutWorkflowRuntime } from './features/checkout/checkoutWorkflowRuntime.js'
import { installCheckoutPaymentPreferenceRuntime } from './features/checkout/checkoutPaymentPreferenceRuntime.js'
import { installCheckoutSameShellPaymentRuntime } from './features/checkout/checkoutSameShellPaymentRuntime.js'

// ─── Pre-warm product catalog cache ──────────────────────────────────────────
// The legacy all-products cache is intentionally delayed so it cannot compete
// with the first visible catalog/product render on a cold device.
import { prewarmCatalog } from './services/catalog.js';

installSchematicPageLabelRuntime();
installMobileSchematicNavRuntime();
installRepairPackageSelectionRuntime();
installCustomerFacingCopyRuntime();
installCheckoutPaymentPreferenceRuntime();
installCheckoutExpressRailRuntime();
installCheckoutWorkflowRuntime();
installCheckoutSameShellPaymentRuntime();

if (typeof window !== 'undefined') {
  const pathname = window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  const isCatalogRoute = pathname.startsWith('/products') || pathname.startsWith('/parts');
  const isHomePage = pathname === '/';
  // Max delay for background catalog prewarm on non-home, non-catalog routes.
  const CATALOG_PREWARM_TIMEOUT_MS = 5000;

  if (!isCatalogRoute) {
    const scheduleLegacyCatalogPrewarm = () => prewarmCatalog();
    // On the home page TrendingProducts depends on the legacy catalog immediately,
    // but catalog/product routes already use the faster API-backed loaders.
    if (isHomePage) {
      scheduleLegacyCatalogPrewarm();
    } else {
      window.setTimeout(scheduleLegacyCatalogPrewarm, CATALOG_PREWARM_TIMEOUT_MS);
    }
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
)
