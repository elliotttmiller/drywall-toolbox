import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/machined-design.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// ===== Mobile Viewport Optimization =====
// Prevent keyboard from causing zoom on mobile devices
if (typeof window !== 'undefined') {
  // Set up viewport management for iOS keyboard
  const disableZoomOnInputFocus = () => {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      // Ensure minimum font size to prevent auto-zoom
      input.style.fontSize = '16px';
      
      // Prevent zoom on focus
      input.addEventListener('focus', () => {
        // iOS Safari workaround: adjust viewport scale
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
      });
      
      input.addEventListener('blur', () => {
        // Restore viewport after keyboard closes
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no');
        }
      });
    });
  };
  
  // Run on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disableZoomOnInputFocus);
  } else {
    disableZoomOnInputFocus();
  }
  
  // Re-run when new inputs are dynamically added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if any input elements were added
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
          disableZoomOnInputFocus();
        }
      }
    });
  });
  
  // Start observing the document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Disable double-tap zoom
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
