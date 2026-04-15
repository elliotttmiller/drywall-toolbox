/**
 * frontend/src/components/dashboard/SettingsTab.jsx
 *
 * Dashboard Settings tab — profile, password, notifications stubs.
 */

import { motion as Motion } from 'framer-motion';
import { User, Lock, Bell, Mail } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.36, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const SECTIONS = [
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
    title: 'Notification Preferences',
    desc:  'Choose which updates you receive for orders, repairs, and promotions.',
  },
  {
    id:    'email',
    Icon:  Mail,
    color: '#7c3aed',
    bg:    '#faf5ff',
    title: 'Email & Communications',
    desc:  'Manage marketing emails, newsletters, and promotional offers.',
  },
];

export default function SettingsTab() {
  return (
    <div style={ { display: 'flex', flexDirection: 'column', gap: '10px' } }>
      { SECTIONS.map( ( section, i ) => (
        <Motion.div
          key={ section.id }
          custom={ i * 0.07 }
          variants={ fadeUp }
          initial="hidden"
          animate="visible"
          style={ {
            display:      'flex',
            alignItems:   'center',
            gap:          '14px',
            background:   'white',
            border:       '1px solid rgba(15,23,42,0.08)',
            borderRadius: '11px',
            padding:      '16px 18px',
            boxShadow:    '0 2px 10px rgba(15,23,42,0.04)',
          } }
        >
          <div style={ { width: '38px', height: '38px', borderRadius: '9px', background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
            <section.Icon size={ 17 } style={ { color: section.color } } />
          </div>
          <div style={ { flex: 1 } }>
            <p style={ { margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' } }>{ section.title }</p>
            <p style={ { margin: '3px 0 0', fontSize: '0.76rem', color: 'rgba(15,23,42,0.48)' } }>{ section.desc }</p>
          </div>
          <span style={ {
            background:    '#f1f5f9',
            color:         'rgba(15,23,42,0.4)',
            borderRadius:  '999px',
            padding:       '3px 9px',
            fontSize:      '0.6rem',
            fontWeight:    700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace:    'nowrap',
            flexShrink:    0,
          } }>
            Coming Soon
          </span>
        </Motion.div>
      ) ) }
    </div>
  );
}
