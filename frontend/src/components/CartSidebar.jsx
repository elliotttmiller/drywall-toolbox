import { X, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export default function CartSidebar({ isOpen, onClose }) {
  const { cartItems, removeFromCart, getCartTotal } = useCart();

  if (!isOpen) return null;

  return (
    <div 
      className={`cart-overlay ${isOpen ? 'active' : ''}`}
      onClick={onClose}
    >
      <div 
        className="cart-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '40px' 
        }}>
          <h3 style={{ 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em' 
          }}>
            Your Toolbox
          </h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer' 
            }}
            aria-label="Close cart"
          >
            <X size={24} />
          </button>
        </div>

        <div id="cart-items-list">
          {cartItems.length === 0 ? (
            <p style={{ 
              opacity: 0.5, 
              textAlign: 'center', 
              marginTop: '40px' 
            }}>
              Your cart is empty.
            </p>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: '0.9rem',
                    color: '#0f172a' /* force black, not brand blue */
                  }}>
                    {item.name}
                  </div>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.75rem', 
                    opacity: 0.6,
                    color: '#0f172a' /* ensure price text is black */
                  }}>
                    ${item.price ? item.price.toFixed(2) : '0.00'} × {item.quantity}
                  </div>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  aria-label={`Remove ${item.name}`}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'red', 
                    fontSize: '0.7rem', 
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ 
          marginTop: '40px', 
          borderTop: '2px solid var(--alloy-deep)', 
          paddingTop: '20px' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '24px' 
          }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>SUBTOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#0f172a', fontWeight: 800 }}>
              ${getCartTotal().toFixed(2)}
            </span>
          </div>
          <Link 
            to="/checkout"
            onClick={onClose}
            className="alloy-button" 
            style={{ 
              width: '100%', 
              justifyContent: 'center',
              textDecoration: 'none'
            }}
          >
            Finalize Order
          </Link>
        </div>
      </div>
    </div>
  );
}
