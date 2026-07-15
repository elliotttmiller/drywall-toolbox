import { Link } from 'react-router-dom';
import { CheckCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

const RETURN_TO = '/checkout';

const EXPRESS_PROVIDERS = [
  {
    id: 'shop',
    label: 'Shop Pay',
    envKeys: ['REACT_APP_SHOP_PAY_URL', 'REACT_APP_SHOPPAY_URL', 'REACT_APP_EXPRESS_SHOP_PAY_URL'],
    mark: <span className="dtb-co-auth-choice__wallet-mark dtb-co-auth-choice__wallet-mark--shop" aria-hidden="true">shop</span>,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    envKeys: ['REACT_APP_PAYPAL_EXPRESS_URL', 'REACT_APP_PAYPAL_CHECKOUT_URL'],
    mark: <span className="dtb-co-auth-choice__wallet-mark dtb-co-auth-choice__wallet-mark--paypal" aria-hidden="true">PayPal</span>,
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    envKeys: ['REACT_APP_GOOGLE_PAY_URL', 'REACT_APP_EXPRESS_GOOGLE_PAY_URL'],
    mark: <GooglePayMark />,
  },
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    envKeys: ['REACT_APP_APPLE_PAY_URL', 'REACT_APP_EXPRESS_APPLE_PAY_URL'],
    mark: <ApplePayMark />,
  },
];

function readPublicEnv(name) {
  if (typeof window !== 'undefined') {
    const runtimeEnv = window.DTB_PUBLIC_ENV || window.dtbPublicEnv || {};
    if (typeof runtimeEnv[name] === 'string') return runtimeEnv[name];
  }

  if (
    typeof process !== 'undefined'
    && process
    && process.env
    && typeof process.env[name] === 'string'
  ) {
    return process.env[name];
  }

  return '';
}

function configuredProviderUrl(provider) {
  const normalized = String(provider || '').toLowerCase();
  const runtime = typeof window !== 'undefined' ? window.DTB_AUTH_PROVIDERS || window.dtbAuthProviders || {} : {};
  const runtimeValue = runtime?.[normalized] || runtime?.[`${normalized}_url`] || '';
  const envValue = normalized === 'google'
    ? (readPublicEnv('REACT_APP_GOOGLE_SSO_URL') || readPublicEnv('REACT_APP_AUTH_GOOGLE_URL'))
    : (readPublicEnv('REACT_APP_APPLE_SSO_URL') || readPublicEnv('REACT_APP_AUTH_APPLE_URL'));
  return normalizeCheckoutUrl(runtimeValue || envValue || '');
}

function configuredWalletUrl(provider) {
  const normalized = String(provider?.id || '').toLowerCase();
  const runtime = typeof window !== 'undefined'
    ? window.DTB_EXPRESS_CHECKOUT_PROVIDERS || window.dtbExpressCheckoutProviders || {}
    : {};
  const runtimeValue = runtime?.[normalized] || runtime?.[`${normalized}_url`] || '';
  const envValue = (provider?.envKeys || []).map(readPublicEnv).find(Boolean) || '';
  return normalizeCheckoutUrl(runtimeValue || envValue || '');
}

function normalizeCheckoutUrl(value) {
  const rawUrl = String(value || '').trim();

  if (!rawUrl) return '';

  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://drywalltoolbox.com';
    const url = new URL(rawUrl, baseOrigin);
    if (!url.searchParams.has('returnTo')) url.searchParams.set('returnTo', RETURN_TO);
    if (!url.searchParams.has('return_to')) url.searchParams.set('return_to', RETURN_TO);

    if (url.origin === baseOrigin) return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function GooglePayMark() {
  return (
    <span className="dtb-co-auth-choice__wallet-mark dtb-co-auth-choice__wallet-mark--gpay" aria-hidden="true">
      <svg className="dtb-co-auth-choice__sso-mark" viewBox="0 0 24 24" focusable="false">
        <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.42-.22-2.05H12v3.96h6.62c-.13 1.03-.85 2.58-2.45 3.62l-.02.13 3.56 2.54.25.02c2.28-1.94 3.53-4.8 3.53-8.22Z" />
        <path fill="#34A853" d="M12 23c3.26 0 6-1 7.99-2.72l-3.8-2.78c-1.02.65-2.38 1.1-4.19 1.1-3.19 0-5.9-1.94-6.86-4.63l-.13.01-3.7 2.64-.05.12C3.24 20.44 7.29 23 12 23Z" />
        <path fill="#FBBC05" d="M5.14 13.97a6.56 6.56 0 0 1-.36-2.12c0-.74.13-1.45.35-2.12l-.01-.14-3.75-2.69-.12.05A10.54 10.54 0 0 0 0 11.85c0 1.76.47 3.42 1.3 4.88l3.84-2.76Z" />
        <path fill="#EA4335" d="M12 5.1c2.27 0 3.8.9 4.67 1.65l3.41-3.06C17.98 1.9 15.26.7 12 .7 7.29.7 3.24 3.25 1.25 6.95l3.83 2.78C6.05 7.04 8.81 5.1 12 5.1Z" />
      </svg>
      <strong>Pay</strong>
    </span>
  );
}

function ApplePayMark() {
  return (
    <span className="dtb-co-auth-choice__wallet-mark dtb-co-auth-choice__wallet-mark--apple" aria-hidden="true">
      <span className="dtb-co-auth-choice__apple-mark"></span>
      <strong>Pay</strong>
    </span>
  );
}

function WalletAction({ provider }) {
  const href = configuredWalletUrl(provider);
  const title = href
    ? `${provider.label} express checkout`
    : `${provider.label} is available after the express wallet provider is configured.`;

  if (!href) {
    return (
      <button
        type="button"
        className="dtb-co-auth-choice__sso-button dtb-co-auth-choice__sso-button--disabled"
        disabled
        aria-disabled="true"
        title={title}
      >
        {provider.mark}
      </button>
    );
  }

  return (
    <a className="dtb-co-auth-choice__sso-button" href={href} rel="nofollow noopener noreferrer" aria-label={title}>
      {provider.mark}
    </a>
  );
}

function GoogleMark() {
  return (
    <svg className="dtb-co-auth-choice__sso-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.42-.22-2.05H12v3.96h6.62c-.13 1.03-.85 2.58-2.45 3.62l-.02.13 3.56 2.54.25.02c2.28-1.94 3.53-4.8 3.53-8.22Z" />
      <path fill="#34A853" d="M12 23c3.26 0 6-1 7.99-2.72l-3.8-2.78c-1.02.65-2.38 1.1-4.19 1.1-3.19 0-5.9-1.94-6.86-4.63l-.13.01-3.7 2.64-.05.12C3.24 20.44 7.29 23 12 23Z" />
      <path fill="#FBBC05" d="M5.14 13.97a6.56 6.56 0 0 1-.36-2.12c0-.74.13-1.45.35-2.12l-.01-.14-3.75-2.69-.12.05A10.54 10.54 0 0 0 0 11.85c0 1.76.47 3.42 1.3 4.88l3.84-2.76Z" />
      <path fill="#EA4335" d="M12 5.1c2.27 0 3.8.9 4.67 1.65l3.41-3.06C17.98 1.9 15.26.7 12 .7 7.29.7 3.24 3.25 1.25 6.95l3.83 2.78C6.05 7.04 8.81 5.1 12 5.1Z" />
    </svg>
  );
}

function AppleMark() {
  return <span className="dtb-co-auth-choice__apple-mark" aria-hidden="true"></span>;
}

function SsoAction({ provider, label, children }) {
  const href = configuredProviderUrl(provider);

  if (!href) {
    return (
      <button
        type="button"
        className="dtb-co-auth-choice__sso-button dtb-co-auth-choice__sso-button--disabled"
        disabled
        aria-disabled="true"
        title={`${label} is available after the ${provider} SSO provider is configured.`}
      >
        {children}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <a className="dtb-co-auth-choice__sso-button" href={href} rel="nofollow noopener noreferrer">
      {children}
      <span>{label}</span>
    </a>
  );
}

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
          <p>Continue to secure payment after shipping and tax are calculated. You can create or connect an account after payment.</p>
        </div>
        <Link to="/login" state={{ returnTo: RETURN_TO }} className="dtb-co-auth-choice__selected-link">
          Sign in instead
        </Link>
      </section>
    );
  }

  return (
    <section className="dtb-co-auth-choice" aria-labelledby="dtb-co-auth-choice-title">
      <div className="dtb-co-auth-choice__header">
        <p className="dtb-co-auth-choice__eyebrow">Express checkout</p>
        <h2 id="dtb-co-auth-choice-title" className="dtb-co-auth-choice__title">
          Pay faster with a wallet
        </h2>
        <p className="dtb-co-auth-choice__copy">
          Use a configured express wallet when eligible, or continue as guest and choose a wallet on the secure payment step.
        </p>
      </div>

      <div className="dtb-co-auth-choice__sso" role="group" aria-label="Express digital wallet checkout options">
        {EXPRESS_PROVIDERS.map((provider) => (
          <WalletAction key={provider.id} provider={provider} />
        ))}
      </div>

      <div className="dtb-co-auth-choice__divider" aria-hidden="true">
        <span />
        <strong>or</strong>
        <span />
      </div>

      <button type="button" className="dtb-co-auth-choice__guest-primary" onClick={onGuest}>
        <span>Continue as guest</span>
      </button>

      <div className="dtb-co-auth-choice__divider" aria-hidden="true">
        <span />
        <strong>sign in</strong>
        <span />
      </div>

      <div className="dtb-co-auth-choice__sso" role="group" aria-label="Single sign-on checkout options">
        <SsoAction provider="google" label="Continue with Google">
          <GoogleMark />
        </SsoAction>
        <SsoAction provider="apple" label="Continue with Apple">
          <AppleMark />
        </SsoAction>
      </div>

      <p className="dtb-co-auth-choice__signin">
        Already have an account?{' '}
        <Link to="/login" state={{ returnTo: RETURN_TO }}>Sign in</Link>
      </p>

      <div className="dtb-co-auth-choice__assurance" aria-label="Checkout assurances">
        <span><ShieldCheck size={13} aria-hidden="true" /> Wallet-first secure payment</span>
        <span><LockKeyhole size={13} aria-hidden="true" /> No forced account creation</span>
      </div>
    </section>
  );
}

export default CheckoutIdentityChoice;
