import { Link } from 'react-router-dom';
import { ShoppingCart, X, Package, Minus, Plus, ArrowRight, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function StorefrontCartSheet({ isOpen, onClose, cartItems = [], removeFromCart, updateQuantity, getCartTotal, isMutating }) {
  const overlayRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const [pendingKey, setPendingKey] = useState(null);

  const handleClose = useCallback(() => {
    if (overlayRef.current?.contains(document.activeElement)) {
      document.activeElement?.blur?.();
    }
    onClose?.();
  }, [onClose]);

  const handleNavAndClose = useCallback((event) => {
    event.currentTarget?.blur?.();
    handleClose();
  }, [handleClose]);

  const handleRemove = useCallback(async (key) => {
    setPendingKey(key);
    try {
      await removeFromCart?.(key);
    } finally {
      setPendingKey(null);
    }
  }, [removeFromCart]);

  const handleQtyChange = useCallback(async (key, delta, currentQty) => {
    const next = currentQty + delta;
    if (next < 1) {
      await handleRemove(key);
      return;
    }
    setPendingKey(key);
    try {
      await updateQuantity?.(key, next);
    } finally {
      setPendingKey(null);
    }
  }, [updateQuantity, handleRemove]);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      closeButtonRef.current?.focus?.();
      return;
    }

    if (previouslyFocusedRef.current?.focus) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, handleClose]);

  const subtotal = getCartTotal();
  const itemCount = cartItems.reduce((n, item) => n + item.quantity, 0);

  return (
    <div
      ref={overlayRef}
      className={`cart-overlay${isOpen ? ' active' : ''}`}
      onClick={handleClose}
      aria-hidden={!isOpen}
      inert={!isOpen ? '' : undefined}
    >
      <aside
        className="cart-panel storefront-cart-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal={isOpen ? 'true' : 'false'}
        aria-label="Shopping cart"
      >
        {/* ── Header ── */}
        <header className="scs-header">
          <div className="scs-header-left">
            <div className="scs-header-icon">
              <ShoppingCart size={15} strokeWidth={2.3} />
            </div>
            <h3 className="scs-title">Your Toolbox</h3>
            {itemCount > 0 && (
              <span className="scs-count">{itemCount}</span>
            )}
          </div>
          <button ref={closeButtonRef} type="button" onClick={handleClose} aria-label="Close cart" className="scs-close">
            <X size={17} strokeWidth={2.5} />
          </button>
        </header>

        {/* ── Items ── */}
        <div className="scs-body">
          {cartItems.length === 0 ? (
            <div className="scs-empty">
              <div className="scs-empty-icon">
                <Package size={30} strokeWidth={1.3} />
              </div>
              <strong className="scs-empty-title">Your cart is empty</strong>
              <p className="scs-empty-body">Add products to get started.</p>
              <Link to="/products" onClick={handleNavAndClose} className="scs-browse-btn">
                Browse Products
              </Link>
            </div>
          ) : (
            <ul className="scs-item-list" role="list">
              {cartItems.map((item) => {
                const key = item.cartKey || item.id;
                const isPending = pendingKey === key;
                const optionText = Array.isArray(item.variation_attribute_values)
                  ? item.variation_attribute_values.map((a) => a.option).filter(Boolean).join(' / ')
                  : '';
                const lineTotal = (item.price * item.quantity).toFixed(2);

                return (
                  <li key={key} className={`scs-item${isPending ? ' scs-item--pending' : ''}`} role="listitem">
                    <div className="scs-item-img">
                      {item.image
                        ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                        : <Package size={22} strokeWidth={1.4} className="scs-item-img-placeholder" />}
                    </div>

                    <div className="scs-item-body">
                      <div className="scs-item-top">
                        <span className="scs-item-name">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(key)}
                          aria-label={`Remove ${item.name}`}
                          className="scs-item-remove"
                          disabled={isPending}
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </div>

                      {optionText ? <span className="scs-item-variant">{optionText}</span> : null}

                      <div className="scs-item-bottom">
                        <div className="scs-item-qty-row" role="group" aria-label={`Quantity for ${item.name}`}>
                          <button
                            type="button"
                            className="scs-qty-btn"
                            onClick={() => handleQtyChange(key, -1, item.quantity)}
                            aria-label={item.quantity === 1 ? `Remove ${item.name}` : 'Decrease quantity'}
                            disabled={isPending}
                          >
                            {item.quantity === 1
                              ? <Trash2 size={11} strokeWidth={2.2} />
                              : <Minus size={11} strokeWidth={2.5} />}
                          </button>
                          <span className="scs-qty-display" aria-live="polite">{item.quantity}</span>
                          <button
                            type="button"
                            className="scs-qty-btn"
                            onClick={() => handleQtyChange(key, 1, item.quantity)}
                            aria-label="Increase quantity"
                            disabled={isPending || item.quantity >= 99}
                          >
                            <Plus size={11} strokeWidth={2.5} />
                          </button>
                        </div>

                        <span className="scs-item-line-total">${lineTotal}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer ── */}
        {cartItems.length > 0 && (
          <footer className="scs-footer">
            <div className="scs-subtotal-row">
              <div className="scs-subtotal-info">
                <span className="scs-subtotal-label">Subtotal</span>
                <span className="scs-subtotal-hint">Shipping &amp; taxes at checkout</span>
              </div>
              <strong className="scs-subtotal-amount">
                ${subtotal.toFixed(2)}
              </strong>
            </div>
            <Link
              to="/checkout"
              onClick={handleNavAndClose}
              className="scs-checkout-btn"
            >
              <span>Checkout</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
            <Link
              to="/cart"
              onClick={handleNavAndClose}
              className="scs-view-cart-btn"
            >
              View full cart
            </Link>
          </footer>
        )}
      </aside>

      <style>{`
        .storefront-cart-sheet {
          display: flex;
          flex-direction: column;
          background: #fff;
          overflow: hidden;
        }

        /* ── Header ── */
        .scs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 14px;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
          background: #fff;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .scs-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .scs-header-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #334155;
          flex-shrink: 0;
        }

        .scs-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #0f172a;
        }

        .scs-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 999px;
          background: #2563eb;
          color: #fff;
          font-size: 0.62rem;
          font-weight: 800;
          line-height: 1;
        }

        .scs-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          cursor: pointer;
          padding: 0;
          transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
          flex-shrink: 0;
        }

        .scs-close:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        /* ── Body ── */
        .scs-body {
          flex: 1 1 auto;
          overflow-y: auto;
          min-height: 0;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.28) transparent;
        }

        .scs-body::-webkit-scrollbar { width: 4px; }
        .scs-body::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.28);
          border-radius: 999px;
        }
        .scs-body::-webkit-scrollbar-track { background: transparent; }

        /* ── Empty state ── */
        .scs-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 52px 24px;
          gap: 10px;
        }

        .scs-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .scs-empty-title {
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
          display: block;
        }

        .scs-empty-body {
          font-size: 0.83rem;
          color: #94a3b8;
          margin: 0;
          line-height: 1.45;
        }

        .scs-browse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
          padding: 11px 26px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-size: 0.84rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 150ms ease, transform 120ms ease;
        }

        .scs-browse-btn:hover  { background: #1e293b; }
        .scs-browse-btn:active { transform: scale(0.97); }

        /* ── Item list ── */
        .scs-item-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .scs-item {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 16px;
          border-bottom: 1px solid #f8fafc;
          transition: background 100ms ease, opacity 160ms ease;
        }

        .scs-item--pending {
          opacity: 0.55;
          pointer-events: none;
        }

        .scs-item-img {
          width: 62px;
          height: 62px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          flex-shrink: 0;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scs-item-img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 5px;
        }

        .scs-item-img-placeholder { color: #cbd5e1; }

        .scs-item-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .scs-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
        }

        .scs-item-name {
          font-size: 0.84rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .scs-item-variant {
          font-size: 0.72rem;
          color: #94a3b8;
          line-height: 1.3;
        }

        .scs-item-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: none;
          background: none;
          color: #cbd5e1;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          margin-top: 1px;
          transition: color 120ms ease, background 120ms ease;
        }

        .scs-item-remove:hover { color: #ef4444; background: #fef2f2; }
        .scs-item-remove:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Qty stepper + line total ── */
        .scs-item-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
          gap: 8px;
        }

        .scs-item-qty-row {
          display: inline-flex;
          align-items: center;
          gap: 0;
          background: #f1f5f9;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .scs-qty-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: #475569;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: background 100ms ease, color 100ms ease;
        }

        .scs-qty-btn:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
        .scs-qty-btn:active:not(:disabled) { background: #cbd5e1; }
        .scs-qty-btn:disabled { color: #cbd5e1; cursor: not-allowed; }

        .scs-qty-display {
          min-width: 26px;
          text-align: center;
          font-size: 0.82rem;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
          padding: 0 2px;
          user-select: none;
        }

        .scs-item-line-total {
          font-size: 0.84rem;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        /* ── Footer ── */
        .scs-footer {
          padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .scs-subtotal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 0 6px;
          gap: 8px;
        }

        .scs-subtotal-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .scs-subtotal-label {
          font-size: 0.88rem;
          color: #0f172a;
          font-weight: 700;
        }

        .scs-subtotal-hint {
          font-size: 0.71rem;
          color: #94a3b8;
          font-weight: 400;
        }

        .scs-subtotal-amount {
          font-size: 1.12rem;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .scs-checkout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 20px;
          border-radius: 14px;
          background: linear-gradient(135deg, #17365d 0%, #2563eb 100%);
          color: #fff;
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-decoration: none;
          transition: opacity 150ms ease, transform 120ms ease, box-shadow 150ms ease;
          text-align: center;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
        }

        .scs-checkout-btn:hover { opacity: 0.93; box-shadow: 0 12px 28px rgba(37, 99, 235, 0.36); }
        .scs-checkout-btn:active { transform: scale(0.98); }

        .scs-view-cart-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: transparent;
          color: #475569;
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
          text-align: center;
        }

        .scs-view-cart-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
