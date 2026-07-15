import { Link } from 'react-router-dom';
import { CheckCircle, LogIn, ShieldCheck, ShoppingBag, UserPlus } from 'lucide-react';

export function CheckoutIdentityChoice({ isAuthenticated = false, selected = '', onGuest }) {
  if (isAuthenticated) return null;

  if (selected === 'guest') {
    return (
      <section className="dtb-co-auth-choice dtb-co-auth-choice--selected" aria-label="Checkout identity">
        <div className="dtb-co-auth-choice__selected-icon" aria-hidden="true">
          <CheckCircle size={17} strokeWidth={2.4} />
        </div>
        <div className="dtb-co-auth-choice__selected-copy">
          <span className="dtb-co-auth-choice__selected-label">Guest checkout selected</span>
          <p>No account is required. You can create or connect an account after purchase for tracking and faster reorders.</p>
        </div>
        <Link to="/login" state={{ returnTo: '/checkout' }} className="dtb-co-auth-choice__selected-link">
          Sign in instead
        </Link>
      </section>
    );
  }

  return (
    <section className="dtb-co-auth-choice" aria-labelledby="dtb-co-auth-choice-title">
      <div className="dtb-co-auth-choice__header">
        <p className="dtb-co-auth-choice__eyebrow">Checkout options</p>
        <h2 id="dtb-co-auth-choice-title" className="dtb-co-auth-choice__title">
          Continue your way
        </h2>
        <p className="dtb-co-auth-choice__copy">
          Start as a guest for the fastest checkout, or sign in to use saved account details.
        </p>
      </div>

      <div className="dtb-co-auth-choice__actions" role="group" aria-label="Choose how to check out">
        <button
          type="button"
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--guest"
          onClick={onGuest}
        >
          <span className="dtb-co-auth-choice__option-icon" aria-hidden="true">
            <ShoppingBag size={18} strokeWidth={2.2} />
          </span>
          <span className="dtb-co-auth-choice__option-content">
            <span className="dtb-co-auth-choice__option-title">Checkout as guest</span>
            <span className="dtb-co-auth-choice__option-copy">Fastest path. No password or account required.</span>
          </span>
          <span className="dtb-co-auth-choice__option-badge">Recommended</span>
        </button>

        <Link
          to="/login"
          state={{ returnTo: '/checkout' }}
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--secondary"
        >
          <span className="dtb-co-auth-choice__option-icon" aria-hidden="true">
            <LogIn size={17} strokeWidth={2.2} />
          </span>
          <span className="dtb-co-auth-choice__option-content">
            <span className="dtb-co-auth-choice__option-title">Log in</span>
            <span className="dtb-co-auth-choice__option-copy">Use saved details.</span>
          </span>
        </Link>

        <Link
          to="/register"
          state={{ returnTo: '/checkout' }}
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--secondary"
        >
          <span className="dtb-co-auth-choice__option-icon" aria-hidden="true">
            <UserPlus size={17} strokeWidth={2.2} />
          </span>
          <span className="dtb-co-auth-choice__option-content">
            <span className="dtb-co-auth-choice__option-title">Create account</span>
            <span className="dtb-co-auth-choice__option-copy">Track orders faster.</span>
          </span>
        </Link>
      </div>

      <div className="dtb-co-auth-choice__assurance" aria-label="Checkout assurances">
        <span><ShieldCheck size={13} aria-hidden="true" /> Secure payment handoff</span>
        <span>No forced account creation</span>
        <span>Order tracking after purchase</span>
      </div>
    </section>
  );
}

export default CheckoutIdentityChoice;
