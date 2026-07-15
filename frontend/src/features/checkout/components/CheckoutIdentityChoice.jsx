import { Link } from 'react-router-dom';
import { CheckCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

const RETURN_TO = '/checkout';

const EXPRESS_PROVIDERS = [
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    layout: 'half',
    envKeys: ['REACT_APP_APPLE_PAY_URL', 'REACT_APP_EXPRESS_APPLE_PAY_URL'],
    mark: <span className="dtb-co-wallet-mark dtb-co-wallet-mark--apple" aria-hidden="true"><span>Apple</span><strong>Pay</strong></span>,
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    layout: 'half',
    envKeys: ['REACT_APP_GOOGLE_PAY_URL', 'REACT_APP_EXPRESS_GOOGLE_PAY_URL'],
    mark: <span className="dtb-co-wallet-mark dtb-co-wallet-mark--gpay" aria-hidden="true"><span>G</span><strong>Pay</strong></span>,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    layout: 'full',
    envKeys: ['REACT_APP_PAYPAL_EXPRESS_URL', 'REACT_APP_PAYPAL_CHECKOUT_URL'],
    mark: <span className="dtb-co-wallet-mark dtb-co-wallet-mark--paypal" aria-hidden="true">PayPal</span>,
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

function configuredWalletUrl(provider) {
  const normalized = String(provider?.id || '').toLowerCase();
  const runtime = typeof window !== 'undefined'
    ? window.DTB_EXPRESS_CHECKOUT_PROVIDERS || window.dtbExpressCheckoutProviders || {}
    : {};
  const runtimeValue = runtime?.[normalized] || runtime?.[`${normalized}_url`] || '';
  const envValue = (provider?.envKeys || []).map(readPublicEnv).find(Boolean) || '';
  return normalizeCheckoutUrl(runtimeValue || envValue || '');
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

function WalletAction({ provider }) {
  const href = configuredWalletUrl(provider);
  const title = href
    ? `${provider.label} express checkout`
    : `${provider.label} is available after the express wallet provider is configured.`;
  const className = `dtb-co-wallet-button dtb-co-wallet-button--${provider.id.replace(/_/g, '-')} dtb-co-wallet-button--${provider.layout}`;

  if (!href) {
    return (
      <button type="button" className={`${className} dtb-co-wallet-button--disabled`} disabled aria-disabled="true" title={title}>
        {provider.mark}
      </button>
    );
  }

  return (
    <a className={className} href={href} rel="nofollow noopener noreferrer" aria-label={title}>
      {provider.mark}
    </a>
  );
}

function SsoAction({ provider, label, children }) {
  const href = configuredProviderUrl(provider);

  if (!href) {
    return (
      <button type="button" className="dtb-co-sso-button dtb-co-sso-button--disabled" disabled aria-disabled="true">
        {children}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <a className="dtb-co-sso-button" href={href} rel="nofollow noopener noreferrer">
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
          <p>No account is required. Continue to secure payment after shipping and tax are calculated.</p>
        </div>
        <Link to="/login" state={{ returnTo: RETURN_TO }} className="dtb-co-auth-choice__selected-link">
          Sign in instead
        </Link>
      </section>
    );
  }

  return (
    <section className="dtb-co-auth-choice" aria-labelledby="dtb-co-auth-choice-title">
      <div className="dtb-co-express-block" aria-label="Express checkout options">
        <p className="dtb-co-auth-choice__eyebrow">Express checkout</p>
        <div className="dtb-co-wallet-grid" role="group" aria-label="Digital wallet checkout options">
          {EXPRESS_PROVIDERS.map((provider) => (
            <WalletAction key={provider.id} provider={provider} />
          ))}
        </div>
      </div>

      <div className="dtb-co-auth-choice__divider" aria-hidden="true">
        <span />
        <strong>or continue below</strong>
        <span />
      </div>

      <div className="dtb-co-auth-choice__header">
        <h2 id="dtb-co-auth-choice-title" className="dtb-co-auth-choice__title">Let&apos;s get started</h2>
        <p className="dtb-co-auth-choice__copy">
          Guest checkout is fastest. You can create or connect an account after payment for order tracking.
        </p>
      </div>

      <button type="button" className="dtb-co-auth-choice__guest-primary" onClick={onGuest}>
        <span>Continue as guest</span>
      </button>

      <p className="dtb-co-auth-choice__signin">
        Already have an account?{' '}
        <Link to="/login" state={{ returnTo: RETURN_TO }}>Sign in</Link>
      </p>

      <div className="dtb-co-account-sso" aria-label="Account sign-in options">
        <SsoAction provider="google" label="Continue with Google"><span aria-hidden="true">G</span></SsoAction>
        <SsoAction provider="apple" label="Continue with Apple"><span aria-hidden="true">Apple</span></SsoAction>
      </div>

      <div className="dtb-co-auth-choice__assurance" aria-label="Checkout assurances">
        <span><ShieldCheck size={13} aria-hidden="true" /> Secure payment handoff</span>
        <span><LockKeyhole size={13} aria-hidden="true" /> No forced account creation</span>
      </div>
    </section>
  );
}

export default CheckoutIdentityChoice;
