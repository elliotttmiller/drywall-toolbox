import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './styles/machined-design.css'
import './styles/tool-selector.css'
import './styles/technical-specifications.css'
import './styles/product-detail-modern.css'
import './styles/storefront-tokens.css'
import './styles/storefront-shell.css'
import './styles/storefront-sections.css'
import './styles/storefront-product-card.css'
import './styles/storefront-drawer.css'
import './styles/account-hub.css'
import App from './App.jsx'
import ErrorBoundary from './components/errors/ErrorBoundary.jsx'

// ─── Pre-warm product catalog cache ──────────────────────────────────────────
// Kick off the catalog fetch immediately — before React even renders.
// On first visit:  begins the API fetch immediately so it's ready sooner.
// On return visits: reads from IndexedDB instantly and optionally revalidates
//                   in the background — product pages load with 0ms wait.
import { prewarmCatalog } from './services/catalog.js';
prewarmCatalog();

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
// critical resource loading or React hydration.  Only registered in production
// builds because the GenerateSW plugin only emits service-worker.js then.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = process.env.PUBLIC_URL + '/service-worker.js';
    navigator.serviceWorker
      .register(swUrl)
      .catch(() => {
        // SW registration failures are non-fatal; log silently.
      });
  });
}
