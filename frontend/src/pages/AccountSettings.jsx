/**
 * frontend/src/pages/AccountSettings.jsx
 *
 * Account settings page — /account-settings
 *
 * Auth: Redirects to /login if unauthenticated (via AccountLayout).
 * Stub: Shows a placeholder with user info and planned settings fields.
 * Full implementation (name, email, password change, notification prefs)
 * will follow in a dedicated sprint once the WC customer PATCH endpoint is wired.
 */

import { motion as Motion } from 'framer-motion';
import { User, Lock, Bell } from 'lucide-react';
import AccountLayout from '../components/AccountLayout.jsx';
import SEOHead from '../components/SEOHead';

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const COMING_SOON_SECTIONS = [
  {
    id:    'profile',
    Icon:  User,
    color: '#2563eb',
    bg:    '#eff6ff',
    title: 'Profile',
    desc:  'Update your name, email address, and company information.',
  },
  {
    id:    'password',
    Icon:  Lock,
    color: '#d97706',
    bg:    '#fffbeb',
    title: 'Password',
    desc:  'Change your account password or reset it via email.',
  },
  {
    id:    'notifications',
    Icon:  Bell,
    color: '#0891b2',
    bg:    '#ecfeff',
    title: 'Notifications',
    desc:  'Choose how you hear about order updates, repair status, and promotions.',
  },
];

export default function AccountSettings() {
  return (
    <AccountLayout title="Account Settings" subtitle="Manage your profile, security, and preferences" maxWidth="700px">
      <SEOHead noindex title="Account Settings" />

      <div style={ { display: 'flex', flexDirection: 'column', gap: '12px' } }>
        { COMING_SOON_SECTIONS.map( ( section, i ) => (
          <Motion.div
            key={ section.id }
            custom={ i * 0.08 }
            variants={ fadeUp }
            initial="hidden"
            animate="visible"
            style={ {
              background:   'white',
              border:       '1px solid rgba(15,23,42,0.08)',
              borderRadius: '12px',
              padding:      '18px 20px',
              boxShadow:    '0 2px 12px rgba(15,23,42,0.05)',
              display:      'flex',
              alignItems:   'center',
              gap:          '14px',
            } }
          >
            <div style={ {
              width:          '40px',
              height:         '40px',
              borderRadius:   '10px',
              background:     section.bg,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            } }>
              <section.Icon size={ 18 } style={ { color: section.color } } />
            </div>
            <div style={ { flex: 1 } }>
              <p style={ { margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' } }>{ section.title }</p>
              <p style={ { margin: '3px 0 0', fontSize: '0.78rem', color: 'rgba(15,23,42,0.5)' } }>{ section.desc }</p>
            </div>
            <span style={ {
              background:    '#f1f5f9',
              color:         'rgba(15,23,42,0.45)',
              borderRadius:  '999px',
              padding:       '3px 10px',
              fontSize:      '0.62rem',
              fontWeight:    700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace:    'nowrap',
            } }>
              Coming Soon
            </span>
          </Motion.div>
        ) ) }
      </div>
    </AccountLayout>
  );
}
