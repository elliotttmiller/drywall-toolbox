import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';

export default function StorefrontCartSheet({ isOpen, onClose, cartItems = [], removeFromCart, getCartTotal }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className={`cart-overlay${isOpen ? ' active' : ''}`} onClick={onClose} aria-hidden={!isOpen}>
      <aside className="cart-panel storefront-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Shopping cart">
        <header className="cart-panel-header" style={{ position: 'sticky', top: 0, background: 'var(--dtb-surface)', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} />
            <h3 style={{ margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Your Toolbox</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cart" style={{ border: 0, background: 'none' }}><X size={20} /></button>
        </header>

        <div className="cart-panel-items">
          {cartItems.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--dtb-muted)' }}>
              <ShoppingCart size={34} />
              <p>Your cart is empty.</p>
              <Link to="/products" onClick={onClose}>Continue shopping</Link>
            </div>
          ) : cartItems.map((item) => {
            const key = item.cartKey || item.id;
            const optionText = Array.isArray(item.variation_attribute_values)
              ? item.variation_attribute_values.map((attr) => attr.option).filter(Boolean).join(' / ')
              : '';
            return (
              <div key={key} className="cart-item">
                {item.image ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{item.name}</strong>
                  {optionText ? <span style={{ color: 'var(--dtb-muted)', fontSize: '0.75rem' }}>{optionText}</span> : null}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>${item.price ? item.price.toFixed(2) : '0.00'} × {item.quantity}</div>
                </div>
                <button type="button" onClick={() => removeFromCart?.(key)} aria-label={`Remove ${item.name}`} style={{ border: 0, background: 'none', color: '#ef4444' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        <footer className="cart-panel-footer" style={{ position: 'sticky', bottom: 0, background: 'var(--dtb-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong>Subtotal</strong>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>${getCartTotal().toFixed(2)}</strong>
          </div>
          <Link to="/checkout" onClick={onClose} className="alloy-button" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex', position: 'sticky', bottom: 0 }}>
            Finalize Order
          </Link>
        </footer>
      </aside>
    </div>
  );
}
