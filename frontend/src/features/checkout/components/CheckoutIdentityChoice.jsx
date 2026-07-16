import { Link } from 'react-router-dom';
import { CheckCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

const RETURN_TO = '/checkout';
const SAFE_AUTH_PROTOCOLS = new Set(['http:', 'https:']);
const PUBLIC_ENV = {
  REACT_APP_GOOGLE_SSO_URL: process.env.REACT_APP_GOOGLE_SSO_URL,
  REACT_APP_AUTH_GOOGLE_URL: process.env.REACT_APP_AUTH_GOOGLE_URL,
  REACT_APP_APPLE_SSO_URL: process.env.REACT_APP_APPLE_SSO_URL,
  REACT_APP_AUTH_APPLE_URL: process.env.REACT_APP_AUTH_APPLE_URL,
};

function readPublicEnv(name) {
  if (typeof window !== 'undefined') {
    const runtimeEnv = window.DTB_PUBLIC_ENV || window.dtbPublicEnv || {};
    if (typeof runtimeEnv[name] === 'string') return runtimeEnv[name];
  }

  if (typeof PUBLIC_ENV[name] === 'string') {
    return PUBLIC_ENV[name];
  }

  return '';
}

function normalizeReturnUrl(value) {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return '';

  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://drywalltoolbox.com';
    const url = new URL(rawUrl, baseOrigin);
    if (!SAFE_AUTH_PROTOCOLS.has(url.protocol)) return '';
    if (!url.searchParams.has('returnTo')) url.searchParams.set('returnTo', RETURN_TO);
    if (url.origin === baseOrigin) return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch {
    return '';
  }
}

function configuredAuthProviderUrl(provider) {
  const normalized = String(provider || '').toLowerCase();
  const runtime = typeof window !== 'undefined' ? window.DTB_AUTH_PROVIDERS || window.dtbAuthProviders || {} : {};
  const runtimeValue = runtime?.[normalized] || runtime?.[`${normalized}_url`] || '';
  const envValue = normalized === 'google'
    ? (readPublicEnv('REACT_APP_GOOGLE_SSO_URL') || readPublicEnv('REACT_APP_AUTH_GOOGLE_URL'))
    : (readPublicEnv('REACT_APP_APPLE_SSO_URL') || readPublicEnv('REACT_APP_AUTH_APPLE_URL'));
  return normalizeReturnUrl(runtimeValue || envValue || '');
}

function SsoAction({ provider, label, shortLabel }) {
  const href = configuredAuthProviderUrl(provider);
  if (!href) return null;

  return (
    <a className={`dtb-co-sso-button dtb-co-sso-button--${provider}`} href={href} rel="nofollow noopener noreferrer">
      <span className="dtb-co-sso-button__mark" aria-hidden="true">{shortLabel}</span>
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
          <span className="dtb-co-auth-choice__selected-label">Guest checkout</span>
          <p>No account is required. Payment continues through the protected checkout payment step.</p>
        </div>
        <Link to="/login" state={{ returnTo: RETURN_TO }} className="dtb-co-auth-choice__selected-link">
          Sign in instead
        </Link>
      </section>
    );
  }

  const hasSso = Boolean(configuredAuthProviderUrl('google') || configuredAuthProviderUrl('apple'));

  return (
    <section className="dtb-co-auth-choice dtb-co-auth-choice--start" aria-labelledby="dtb-co-auth-choice-title">
      <div className="dtb-co-auth-choice__header">
        <p className="dtb-co-auth-choice__eyebrow">Start checkout</p>
        <h2 id="dtb-co-auth-choice-title" className="dtb-co-auth-choice__title">Checkout as guest</h2>
        <p className="dtb-co-auth-choice__copy">
          Fastest path. Enter shipping details, review the server-calculated total, then continue through the protected payment step.
        </p>
      </div>

      <button type="button" className="dtb-co-auth-choice__guest-primary" onClick={onGuest}>
        <span>Continue as guest</span>
      </button>

      <p className="dtb-co-auth-choice__signin">
        Already have an account?{' '}
        <Link to="/login" state={{ returnTo: RETURN_TO }}>Sign in</Link>
      </p>

      {hasSso && (
        <div className="dtb-co-account-sso" aria-label="Account sign-in options">
          <SsoAction provider="google" shortLabel="G" label="Continue with Google" />
          <SsoAction provider="apple" shortLabel="" label="Continue with Apple" />
        </div>
      )}

      <div className="dtb-co-auth-choice__assurance" aria-label="Checkout assurances">
        <span><ShieldCheck size={13} aria-hidden="true" /> Protected payment step</span>
        <span><LockKeyhole size={13} aria-hidden="true" /> No forced account creation</span>
      </div>
    </section>
  );
}

export default CheckoutIdentityChoice;
