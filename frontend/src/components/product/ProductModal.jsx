import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const backdropVariants = {
  hidden:  { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: { opacity: 1, backdropFilter: 'blur(14px)' },
};

const desktopPanelVariants = {
  hidden:  { opacity: 0, y: 18, scale: 0.985, filter: 'blur(5px)' },
  visible: { opacity: 1, y: 0,  scale: 1,     filter: 'blur(0px)' },
  exit:    { opacity: 0, y: 14, scale: 0.99,  filter: 'blur(3px)' },
};

const mobilePanelVariants = {
  hidden:  { opacity: 0, y: 42, scale: 0.995 },
  visible: { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, y: 28, scale: 0.995 },
};

const reduceMotionPanelVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

const backdropTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };
const panelTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };
const reducedTransition = { duration: 0.12, ease: 'linear' };

function useIsMobileModal() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener?.('change', onChange);
    return () => mediaQuery.removeEventListener?.('change', onChange);
  }, []);

  return isMobile;
}

/**
 * ProductModal — shared animated overlay for all product-detail modals.
 *
 * Features:
 *  • Framer-motion backdrop + panel/sheet animations
 *  • Mobile-first bottom sheet behavior with desktop centered dialog behavior
 *  • Keyboard Escape close
 *  • Focus restoration
 *  • Scroll containment for iOS
 *  • Portal rendering for stable z-index stacking
 */
export default function ProductModal({ isOpen, product, onClose, children }) {
  const scrollRef   = useRef(null);
  const openerRef   = useRef(null);
  const scrollHideTimerRef = useRef(null);
  const [isScrollActive, setIsScrollActive] = useState(false);
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobileModal();

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement;
    } else {
      const id = setTimeout(() => {
        if (openerRef.current && typeof openerRef.current.focus === 'function') {
          openerRef.current.focus({ preventScroll: true });
        }
        openerRef.current = null;
      }, reduceMotion ? 80 : 280);
      return () => clearTimeout(id);
    }
  }, [isOpen, reduceMotion]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.classList.add('dtb-product-modal-open');

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.body.classList.remove('dtb-product-modal-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.focus({ preventScroll: true });
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [product?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (scrollHideTimerRef.current) {
        clearTimeout(scrollHideTimerRef.current);
        scrollHideTimerRef.current = null;
      }
      const resetId = setTimeout(() => {
        setIsScrollActive(false);
      }, 0);
      return () => clearTimeout(resetId);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (scrollHideTimerRef.current) {
        clearTimeout(scrollHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const panelVariants = reduceMotion
    ? reduceMotionPanelVariants
    : (isMobile ? mobilePanelVariants : desktopPanelVariants);
  const transition = reduceMotion ? reducedTransition : panelTransition;

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && product && (
        <>
          <Motion.div
            key="product-modal-backdrop"
            className="fixed inset-0 bg-slate-950/55 product-modal-backdrop"
            style={{ zIndex: 10001 }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reduceMotion ? reducedTransition : backdropTransition}
            onClick={onClose}
            aria-hidden="true"
          />

          <Motion.div
            key="product-modal-panel"
            ref={scrollRef}
            className={`product-modal-scroll-shell fixed left-0 right-0 bottom-0 overflow-y-auto overscroll-contain outline-none${isScrollActive ? ' product-modal-scroll-shell--active' : ''}`}
            style={{ zIndex: 10002 }}
            role="dialog"
            aria-modal="true"
            aria-label={product?.name || 'Product detail'}
            tabIndex={-1}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transition}
            onScroll={() => {
              setIsScrollActive(true);
              if (scrollHideTimerRef.current) clearTimeout(scrollHideTimerRef.current);
              scrollHideTimerRef.current = setTimeout(() => {
                setIsScrollActive(false);
              }, 900);
            }}
          >
            <div
              className="product-modal-scroll-inner flex items-end md:items-center justify-center min-h-full px-0 py-0 md:px-4 md:py-6 lg:px-6"
              onClick={onClose}
            >
              <Motion.div
                className="product-modal-card-shell w-full max-w-6xl"
                layout
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </Motion.div>
            </div>
          </Motion.div>
          <style>{`
            .product-modal-backdrop {
              -webkit-backdrop-filter: blur(14px) saturate(120%);
              backdrop-filter: blur(14px) saturate(120%);
            }
            .product-modal-scroll-shell {
              top: var(--header-height, 96px);
              scrollbar-width: none;
              scrollbar-color: transparent transparent;
              -webkit-overflow-scrolling: touch;
            }
            .product-modal-scroll-shell::-webkit-scrollbar {
              width: 0;
              background: transparent;
            }
            .product-modal-card-shell > * {
              border-radius: 26px 26px 0 0;
              box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.18);
              overflow: hidden;
            }
            @media (min-width: 769px) {
              .product-modal-scroll-shell {
                top: 0;
                scrollbar-width: thin;
                scrollbar-color: transparent transparent;
              }
              .product-modal-card-shell > * {
                border-radius: 26px;
                box-shadow: 0 32px 90px rgba(15, 23, 42, 0.28), 0 8px 22px rgba(15, 23, 42, 0.16);
              }
              .product-modal-scroll-shell::-webkit-scrollbar {
                width: 10px;
              }
              .product-modal-scroll-shell.product-modal-scroll-shell--active::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.32);
                border: 2px solid transparent;
                background-clip: padding-box;
                border-radius: 999px;
              }
              .product-modal-scroll-shell.product-modal-scroll-shell--active::-webkit-scrollbar-track {
                background: transparent;
              }
              .product-modal-scroll-shell.product-modal-scroll-shell--active {
                scrollbar-color: rgba(148, 163, 184, 0.32) transparent;
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .product-modal-backdrop {
                -webkit-backdrop-filter: none;
                backdrop-filter: none;
              }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
