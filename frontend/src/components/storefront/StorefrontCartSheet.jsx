import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2, X, Package } from 'lucide-react';
import { useEffect } from 'react';

export default function StorefrontCartSheet({ isOpen, onClose, cartItems = [], removeFromCart, getCartTotal }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`cart-overlay${isOpen ? ' active' : ''}`}
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <aside
        className="cart-panel storefront-cart-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* ── Header ── */}
        <header className="scs-header">
          <div className="scs-header-left">
            <div className="scs-header-icon">
              <ShoppingCart size={16} strokeWidth={2.2} />
            </div>
            <h3 className="scs-title">Your Toolbox</h3>
            {cartItems.length > 0 && (
              <span className="scs-count">{cartItems.length}</span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close cart" className="scs-close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        {/* ── Items ── */}
        <div className="scs-body">
          {cartItems.length === 0 ? (
            <div className="scs-empty">
              <div className="scs-empty-icon">
                <Package size={32} strokeWidth={1.4} />
              </div>
              <strong className="scs-empty-title">Your cart is empty</strong>
              <p className="scs-empty-body">Add products to get started.</p>
              <Link to="/products" onClick={onClose} className="scs-browse-btn">
                Browse Products
              </Link>
            </div>
          ) : (
            cartItems.map((item) => {
              const key = item.cartKey || item.id;
              const optionText = Array.isArray(item.variation_attribute_values)
                ? item.variation_attribute_values.map((a) => a.option).filter(Boolean).join(' / ')
                : '';
              return (
                <div key={key} className="scs-item">
                  <div className="scs-item-img">
                    {item.image
                      ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                      : null}
                  </div>
                  <div className="scs-item-info">
                    <span className="scs-item-name">{item.name}</span>
                    {optionText ? <span className="scs-item-variant">{optionText}</span> : null}
                    <div className="scs-item-price-row">
                      <span className="scs-item-price">
                        ${item.price ? item.price.toFixed(2) : '0.00'}
                      </span>
                      <span className="scs-item-qty">× {item.quantity}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart?.(key)}
                    aria-label={`Remove ${item.name}`}
                    className="scs-item-remove"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {cartItems.length > 0 && (
          <footer className="scs-footer">
            <div className="scs-subtotal">
              <span className="scs-subtotal-label">Subtotal</span>
              <strong className="scs-subtotal-amount">
                ${getCartTotal().toFixed(2)}
              </strong>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="scs-checkout-btn"
            >
              Proceed to Checkout
            </Link>
            <Link
              to="/cart"
              onClick={onClose}
              className="scs-view-cart-btn"
            >
              View cart
            </Link>
          </footer>
        )}
      </aside>

      <style>{`
        /* ── Sheet visual overrides (positioning stays in machined-design.css) ── */
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
          padding: 18px 18px 16px;
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
          gap: 9px;
        }

        .scs-header-icon {
          width: 32px;
          height: 32px;
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
          font-size: 0.88rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #0f172a;
        }

        .scs-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1;
        }

        .scs-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          padding: 0;
          transition: background 120ms ease, border-color 120ms ease;
          flex-shrink: 0;
        }

        .scs-close:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        /* ── Body (scrollable) ── */
        .scs-body {
          flex: 1 1 auto;
          overflow-y: auto;
          min-height: 0;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Empty state ── */
        .scs-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 24px;
          gap: 10px;
        }

        .scs-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .scs-empty-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          display: block;
        }

        .scs-empty-body {
          font-size: 0.85rem;
          color: #94a3b8;
          margin: 0;
          line-height: 1.45;
        }

        .scs-browse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
          padding: 12px 28px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-size: 0.88rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 150ms ease, transform 120ms ease;
        }

        .scs-browse-btn:hover  { background: #1e293b; }
        .scs-browse-btn:active { transform: scale(0.97); }

        /* ── Item rows ── */
        .scs-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid #f8fafc;
          transition: background 100ms ease;
        }

        .scs-item:hover {
          background: #fafafa;
        }

        .scs-item-img {
          width: 56px;
          height: 56px;
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

        .scs-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .scs-item-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .scs-item-variant {
          font-size: 0.76rem;
          color: #94a3b8;
          line-height: 1.3;
        }

        .scs-item-price-row {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
        }

        .scs-item-price {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
        }

        .scs-item-qty {
          font-size: 0.78rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .scs-item-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: none;
          background: none;
          color: #cbd5e1;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          margin-top: 1px;
          transition: color 120ms ease, background 120ms ease;
        }

        .scs-item-remove:hover {
          color: #ef4444;
          background: #fef2f2;
        }

        /* ── Footer ── */
        .scs-footer {
          padding: 16px 18px calc(env(safe-area-inset-bottom, 0px) + 16px);
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .scs-subtotal {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0 6px;
        }

        .scs-subtotal-label {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 600;
        }

        .scs-subtotal-amount {
          font-size: 1.0rem;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
        }

        .scs-checkout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 20px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          transition: background 150ms ease, transform 120ms ease;
          text-align: center;
        }

        .scs-checkout-btn:hover  { background: #1e293b; }
        .scs-checkout-btn:active { transform: scale(0.98); }

        .scs-view-cart-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 11px 20px;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: transparent;
          color: #334155;
          font-size: 0.85rem;
          font-weight: 700;
          text-decoration: none;
          transition: background 150ms ease, border-color 150ms ease;
          text-align: center;
        }

        .scs-view-cart-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
