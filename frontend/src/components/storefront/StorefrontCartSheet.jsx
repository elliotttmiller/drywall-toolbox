import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2, X } from 'lucide-react';
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
      style={{ alignItems: 'flex-end' }}
    >
      <aside
        className="cart-panel storefront-cart-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <header className="cart-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={17} />
            <h3 className="cart-sheet-title">Your Toolbox</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cart" className="cart-sheet-close">
            <X size={20} />
          </button>
        </header>

        {/* Items */}
        <div className="cart-sheet-items">
          {cartItems.length === 0 ? (
            <div className="cart-sheet-empty">
              <ShoppingCart size={36} style={{ color: 'var(--dtb-muted)', marginBottom: 12 }} />
              <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Your cart is empty</p>
              <p style={{ color: 'var(--dtb-muted)', fontSize: '0.85rem', margin: '0 0 16px' }}>Add products to get started.</p>
              <Link to="/products" onClick={onClose} className="alloy-button">Browse Products</Link>
            </div>
          ) : cartItems.map((item) => {
            const key = item.cartKey || item.id;
            const optionText = Array.isArray(item.variation_attribute_values)
              ? item.variation_attribute_values.map((attr) => attr.option).filter(Boolean).join(' / ')
              : '';
            return (
              <div key={key} className="cart-sheet-item">
                {item.image ? (
                  <div className="cart-sheet-item-img">
                    <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                  </div>
                ) : (
                  <div className="cart-sheet-item-img cart-sheet-item-img--placeholder" />
                )}
                <div className="cart-sheet-item-info">
                  <strong className="cart-sheet-item-name">{item.name}</strong>
                  {optionText ? <span className="cart-sheet-item-variant">{optionText}</span> : null}
                  <div className="cart-sheet-item-price">
                    ${item.price ? item.price.toFixed(2) : '0.00'} × {item.quantity}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart?.(key)}
                  aria-label={`Remove ${item.name}`}
                  className="cart-sheet-item-remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <footer className="cart-sheet-footer">
            <div className="cart-sheet-subtotal">
              <span>Subtotal</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>${getCartTotal().toFixed(2)}</strong>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="alloy-button"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex' }}
            >
              Proceed to Checkout
            </Link>
          </footer>
        )}
      </aside>

      <style>{`
        .storefront-cart-sheet {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--dtb-surface);
          box-shadow: var(--dtb-shadow-sheet);
          max-height: 92dvh;
          overflow: hidden;
        }

        /* Mobile: bottom sheet */
        @media (max-width: 767px) {
          .cart-overlay {
            align-items: flex-end !important;
          }

          .storefront-cart-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 20px 20px 0 0;
            max-height: 90dvh;
          }
        }

        .cart-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--dtb-border);
          flex-shrink: 0;
          position: sticky;
          top: 0;
          background: var(--dtb-surface);
          z-index: 2;
        }

        .cart-sheet-title {
          margin: 0;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .cart-sheet-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--dtb-border);
          color: var(--dtb-text);
          cursor: pointer;
          padding: 0;
          transition: background 120ms ease;
        }

        .cart-sheet-close:hover {
          background: #cbd5e1;
        }

        .cart-sheet-items {
          flex: 1 1 auto;
          overflow-y: auto;
          min-height: 0;
          padding: 8px 0;
          -webkit-overflow-scrolling: touch;
        }

        .cart-sheet-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 24px;
        }

        .cart-sheet-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid var(--dtb-border);
        }

        .cart-sheet-item-img {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          background: #f8fafc;
          border: 1px solid var(--dtb-border);
          flex-shrink: 0;
          overflow: hidden;
        }

        .cart-sheet-item-img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }

        .cart-sheet-item-img--placeholder {
          background: #f1f5f9;
        }

        .cart-sheet-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .cart-sheet-item-name {
          display: block;
          font-size: 0.88rem;
          font-weight: 700;
          line-height: 1.3;
          color: var(--dtb-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cart-sheet-item-variant {
          font-size: 0.75rem;
          color: var(--dtb-muted);
        }

        .cart-sheet-item-price {
          font-size: 0.78rem;
          font-family: var(--font-mono);
          color: var(--dtb-text);
          font-weight: 600;
        }

        .cart-sheet-item-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: none;
          color: #ef4444;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          margin-top: 2px;
          transition: background 120ms ease;
        }

        .cart-sheet-item-remove:hover {
          background: #fef2f2;
        }

        .cart-sheet-footer {
          padding: 14px 18px calc(env(safe-area-inset-bottom, 0px) + 14px);
          border-top: 1px solid var(--dtb-border);
          flex-shrink: 0;
          background: var(--dtb-surface);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cart-sheet-subtotal {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.92rem;
        }
      `}</style>
    </div>
  );
}
