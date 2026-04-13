/**
 * frontend/src/pages/AccountSettings.jsx
 *
 * Account settings page — /account-settings
 *
 * Auth: Redirects to /login if unauthenticated.
 * Stub: Shows a placeholder with user info and planned settings fields.
 * Full implementation (name, email, password change, notification prefs)
 * will follow in a dedicated sprint once the WC customer PATCH endpoint is wired.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { User, Lock, Bell, Loader } from 'lucide-react';
import { useAuthContext } from '../auth/AuthContext.js';
import SEOHead from '../components/SEOHead';

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const COMING_SOON_SECTIONS = [
  {
    id:    'profile',
    Icon:  User,
    title: 'Profile',
    desc:  'Update your name, email address, and company information.',
  },
  {
    id:    'password',
    Icon:  Lock,
    title: 'Password',
    desc:  'Change your account password or reset it via email.',
  },
  {
    id:    'notifications',
    Icon:  Bell,
    title: 'Notifications',
    desc:  'Choose how you hear about order updates, repair status, and promotions.',
  },
];

export default function AccountSettings() {
  const navigate                          = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuthContext();

  useEffect( () => {
    if ( ! isLoading && ! isAuthenticated ) {
      navigate( '/login', { replace: true } );
    }
  }, [ isLoading, isAuthenticated, navigate ] );

  if ( isLoading || ! user ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="animate-spin text-primary-600" size={ 32 } />
      </div>
    );
  }

  const displayName = [ user.first_name, user.last_name ].filter( Boolean ).join( ' ' ) || user.email;

  return (
    <div className="page-wrapper" style={ { minHeight: '100vh', background: '#f8fafc' } }>
      <SEOHead noindex title="Account Settings" />

      {/* Hero strip */}
      <div style={ { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)', padding: 'clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)', position: 'relative', overflow: 'hidden' } }>
        <div style={ { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '40px 40px', pointerEvents: 'none' } } />
        <Motion.div initial={ { opacity: 0, y: 14 } } animate={ { opacity: 1, y: 0 } } transition={ { duration: 0.5 } }
          style={ { position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' } }
        >
          <h1 style={ { color: 'white', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' } }>
            Account Settings
          </h1>
          <p style={ { color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.9rem' } }>{ displayName }</p>
        </Motion.div>
      </div>

      <div style={ { maxWidth: '700px', margin: '0 auto', padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 2.5rem)', display: 'flex', flexDirection: 'column', gap: '16px' } }>

        { COMING_SOON_SECTIONS.map( ( section, i ) => (
          <Motion.div key={ section.id } custom={ i * 0.08 } variants={ cardVariants } initial="hidden" animate="visible"
            style={ { background: 'white', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '20px 24px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', display: 'flex', alignItems: 'center', gap: '16px', opacity: 0.6 } }
          >
            <div style={ { width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
              <section.Icon size={ 18 } style={ { color: 'rgba(15,23,42,0.4)' } } />
            </div>
            <div style={ { flex: 1 } }>
              <p style={ { margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' } }>{ section.title }</p>
              <p style={ { margin: '3px 0 0', fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)' } }>{ section.desc }</p>
            </div>
            <span style={ { background: '#f1f5f9', color: 'rgba(15,23,42,0.4)', borderRadius: '999px', padding: '2px 10px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' } }>
              Coming Soon
            </span>
          </Motion.div>
        ) ) }

        <div style={ { marginTop: '8px' } }>
          <Link to="/dashboard" style={ { fontSize: '0.85rem', fontWeight: 600, color: 'rgba(15,23,42,0.5)', textDecoration: 'none' } }>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
