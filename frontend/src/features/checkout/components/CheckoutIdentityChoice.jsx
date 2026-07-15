import { Link } from 'react-router-dom';

export function CheckoutIdentityChoice({ isAuthenticated = false, selected = '', onGuest }) {
  if (isAuthenticated || selected === 'guest') return null;

  return (
    <section className="dtb-co-auth-choice" aria-labelledby="dtb-co-auth-choice-title">
      <p className="dtb-co-auth-choice__eyebrow">Checkout options</p>
      <h2 id="dtb-co-auth-choice-title" className="dtb-co-auth-choice__title">
        How would you like to check out?
      </h2>
      <p className="dtb-co-auth-choice__copy">
        Continue as a guest, or sign in to use saved account details and order tracking.
      </p>
      <div className="dtb-co-auth-choice__actions">
        <button
          type="button"
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--guest"
          onClick={onGuest}
        >
          <span className="dtb-co-auth-choice__option-title">Checkout as guest</span>
          <span className="dtb-co-auth-choice__option-copy">Fastest option. No account required.</span>
        </button>
        <Link
          to="/login"
          state={{ returnTo: '/checkout' }}
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--login"
        >
          <span className="dtb-co-auth-choice__option-title">Log in</span>
          <span className="dtb-co-auth-choice__option-copy">Use saved account details.</span>
        </Link>
        <Link
          to="/register"
          state={{ returnTo: '/checkout' }}
          className="dtb-co-auth-choice__option dtb-co-auth-choice__option--register"
        >
          <span className="dtb-co-auth-choice__option-title">Create account</span>
          <span className="dtb-co-auth-choice__option-copy">Track orders and speed up next time.</span>
        </Link>
      </div>
      <p className="dtb-co-auth-choice__footnote">
        You can create or connect an account after purchase if you continue as a guest.
      </p>
    </section>
  );
}

export default CheckoutIdentityChoice;
