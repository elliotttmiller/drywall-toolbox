import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './styles/machined-design.css'
import './styles/tool-selector.css'
import './styles/technical-specifications.css'
import './styles/product-detail-modern.css'
import './styles/reviews.css'
import './styles/storefront-tokens.css'
import './styles/storefront-shell.css'
import './styles/storefront-sections.css'
import './styles/storefront-product-card.css'
import './styles/storefront-drawer.css'
import './styles/account-hub.css'
import App from './App.jsx'
import ErrorBoundary from './components/errors/ErrorBoundary.jsx'
import { joinRuntimeAssetUrl } from './setWebpackPublicPath.js'

// ─── Pre-warm product catalog cache ──────────────────────────────────────────
// Product listing pages use the DTB catalog-platform endpoints, so prewarm
// those first. The legacy all-products cache is useful for older schematic
// lookups, but it is intentionally delayed so it cannot compete with the first
// visible product grid render on a cold device.
import { prewarmCatalog } from './services/catalog.js';
import { prewarmCatalogPlatformForCurrentRoute } from './services/catalogPlatformCache.js';

prewarmCatalogPlatformForCurrentRoute();

if (typeof window !== 'undefined') {
  const pathname = window.location.pathname.replace(/^\/drywall-toolbox(?=\/|$)/, '') || '/';
  const isCatalogRoute = pathname.startsWith('/products') || pathname.startsWith('/parts');

  if (!isCatalogRoute) {
    const scheduleLegacyCatalogPrewarm = () => prewarmCatalog();
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(scheduleLegacyCatalogPrewarm, { timeout: 8000 });
    } else {
      window.setTimeout(scheduleLegacyCatalogPrewarm, 8000);
    }
  }
}

// ===== Mobile Viewport Optimization =====
// Prevent iOS Safari from auto-zooming on input focus.
// The correct fix is font-size: 16px on all inputs (done in index.css).
// This JS layer is a belt-and-suspenders guard: on focus it briefly sets
// maximum-scale=1 to suppress the zoom animation, then immediately restores
// normal scaling on blur so pinch-to-zoom still works (required by WCAG 1.4.4).
if (typeof window !== 'undefined') {
  const manageInputZoom = () => {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      // Belt-and-suspenders: enforce 16px via JS as well as CSS
      input.style.fontSize = '16px';
      
      input.addEventListener('focus', () => {
        // Temporarily suppress the iOS zoom animation while the keyboard rises.
        // maximum-scale=1 is the minimum needed; user-scalable remains yes.
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0');
        }
      });
      
      input.addEventListener('blur', () => {
        // Restore full zoom capability after the keyboard closes.
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
        }
      });
    });
  };
  
  // Run on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', manageInputZoom);
  } else {
    manageInputZoom();
  }
  
  // Re-run when new inputs are dynamically added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        const hasInputs = Array.from(mutation.addedNodes).some(node => 
          node.querySelector && (
            node.querySelector('input') || 
            node.querySelector('textarea') ||
            node.querySelector('select') ||
            node.tagName === 'INPUT' ||
            node.tagName === 'TEXTAREA' ||
            node.tagName === 'SELECT'
          )
        );
        if (hasInputs) {
          manageInputZoom();
        }
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Prevent accidental multi-touch zoom (e.g. two-finger scroll misread as pinch).
  // passive:false is required to call preventDefault(); kept narrowly scoped to
  // multi-touch only so single-finger scroll is never affected.
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
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

// ─── Service Worker registration (production only) ────────────────────────────
// Deferred until after the 'load' event so the SW fetch does not compete with
// critical resource loading or React hydration.  On GitHub Pages we explicitly
// unregister SWs to avoid stale cached shells referencing deleted hashed assets.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  const isGithubPagesHost = typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname);

  if (isGithubPagesHost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.unregister();
      });
    }).catch(() => {});
  } else {
    window.addEventListener('load', () => {
      const swUrl = joinRuntimeAssetUrl('service-worker.js');
      navigator.serviceWorker
        .register(swUrl)
        .catch(() => {
          // SW registration failures are non-fatal; log silently.
        });
    });
  }
}
