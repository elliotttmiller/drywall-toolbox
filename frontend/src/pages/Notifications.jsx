/**
 * frontend/src/pages/Notifications.jsx
 *
 * Notification preferences page — /notifications
 *
 * Auth: Redirects to /login if unauthenticated (via AccountLayout).
 * Status: Coming soon — shows preference categories as toggles (stubbed off).
 */

import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Bell, Package, Star, Shield, Tag, Mail } from 'lucide-react';
import AccountLayout from '../components/account/AccountLayout.jsx';
import SEOHead       from '../components/shared/SEOHead';

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: ( d ) => ( {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [ 0.16, 1, 0.3, 1 ], delay: d ?? 0 },
  } ),
};

const CARD = {
  background:   'white',
  border:       '1px solid rgba(15,23,42,0.08)',
  borderRadius: '14px',
  boxShadow:    '0 2px 16px rgba(15,23,42,0.06)',
  overflow:     'hidden',
};

const NOTIFICATION_GROUPS = [
  {
    id:    'orders',
    icon:  Package,
    color: '#2563eb',
    bg:    '#eff6ff',
    title: 'Order Updates',
    desc:  'Confirmation, shipping, delivery, and cancellation notices.',
    items: [
      { id: 'order_placed',    label: 'Order placed' },
      { id: 'order_shipped',   label: 'Order shipped' },
      { id: 'order_delivered', label: 'Order delivered' },
      { id: 'order_cancelled', label: 'Order cancelled or refunded' },
    ],
  },
  {
    id:    'repairs',
    icon:  Shield,
    color: '#16a34a',
    bg:    '#f0fdf4',
    title: 'Repair & Service',
    desc:  'Status updates on tool repairs and service requests.',
    items: [
      { id: 'repair_received',  label: 'Repair request received' },
      { id: 'repair_diagnosed', label: 'Diagnosis complete' },
      { id: 'repair_ready',     label: 'Repair complete — ready for pickup/ship' },
    ],
  },
  {
    id:    'rewards',
    icon:  Star,
    color: '#d97706',
    bg:    '#fffbeb',
    title: 'Rewards & Points',
    desc:  'Earn notifications, expiry reminders, and redeemed coupons.',
    items: [
      { id: 'points_earned',   label: 'Points earned on purchase' },
      { id: 'points_expiring', label: 'Points expiring reminder (30 days)' },
      { id: 'coupon_issued',   label: 'Coupon issued on redemption' },
    ],
  },
  {
    id:    'promotions',
    icon:  Tag,
    color: '#7c3aed',
    bg:    '#faf5ff',
    title: 'Promotions & News',
    desc:  'Sales, new arrivals, and exclusive offers.',
    items: [
      { id: 'promo_sale',      label: 'Site-wide sales and promotions' },
      { id: 'promo_new',       label: 'New product arrivals' },
      { id: 'promo_member',    label: 'Exclusive customer offers' },
    ],
  },
];

function Toggle( { checked, onChange, disabled } ) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ checked }
      onClick={ () => ! disabled && onChange( ! checked ) }
      style={ {
        width:      '42px',
        height:     '24px',
        borderRadius: '999px',
        border:     'none',
        background: checked ? '#2563eb' : 'rgba(15,23,42,0.15)',
        cursor:     disabled ? 'not-allowed' : 'pointer',
        position:   'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity:    disabled ? 0.5 : 1,
        padding:    0,
      } }
    >
      <span style={ {
        position:   'absolute',
        top:        '3px',
        left:       checked ? '21px' : '3px',
        width:      '18px',
        height:     '18px',
        borderRadius: '50%',
        background: 'white',
        boxShadow:  '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      } } />
    </button>
  );
}

function NotificationGroup( { group, delay, prefs, onToggle } ) {
  const Icon = group.icon;
  return (
    <Motion.div custom={ delay } variants={ fadeUp } initial="hidden" animate="visible"
      style={ CARD }
    >
      {/* Group header */}
      <div style={ { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,0.07)' } }>
        <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: group.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }>
          <Icon size={ 17 } style={ { color: group.color } } />
        </div>
        <div>
          <p style={ { margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' } }>{ group.title }</p>
          <p style={ { margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(15,23,42,0.45)' } }>{ group.desc }</p>
        </div>
      </div>

      {/* Notification items */}
      { group.items.map( ( item, i ) => (
        <div
          key={ item.id }
          style={ {
            display:       'flex',
            alignItems:    'center',
            justifyContent:'space-between',
            padding:       '13px 20px',
            borderBottom:  i < group.items.length - 1 ? '1px solid rgba(15,23,42,0.055)' : 'none',
          } }
        >
          <span style={ { fontSize: '0.875rem', color: 'rgba(15,23,42,0.7)', fontWeight: 500 } }>
            { item.label }
          </span>
          <Toggle
            checked={ prefs[ item.id ] ?? false }
            onChange={ ( val ) => onToggle( item.id, val ) }
            disabled
          />
        </div>
      ) ) }
    </Motion.div>
  );
}

export default function Notifications() {
  const [ prefs, setPrefs ] = useState( {} );

  function handleToggle( id, val ) {
    setPrefs( ( prev ) => ( { ...prev, [ id ]: val } ) );
  }

  return (
    <AccountLayout title="Notifications" subtitle="Control how and when you hear from us">
      <SEOHead noindex title="Notifications" />

      <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>

        {/* Email channel badge */}
        <Motion.div custom={ 0 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ {
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            padding:      '13px 18px',
            background:   '#f0fdf4',
            border:       '1px solid rgba(22,163,74,0.2)',
            borderRadius: '10px',
          } }
        >
          <Mail size={ 17 } style={ { color: '#16a34a', flexShrink: 0 } } />
          <span style={ { fontSize: '0.83rem', fontWeight: 600, color: '#15803d' } }>
            Notifications are delivered via email to your registered address.
          </span>
        </Motion.div>

        {/* Coming soon banner */}
        <Motion.div custom={ 0.06 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ {
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            padding:      '13px 18px',
            background:   '#fffbeb',
            border:       '1px solid rgba(217,119,6,0.25)',
            borderRadius: '10px',
          } }
        >
          <Bell size={ 17 } style={ { color: '#d97706', flexShrink: 0 } } />
          <span style={ { fontSize: '0.83rem', fontWeight: 600, color: '#92400e' } }>
            Fine-grained notification controls are coming soon — toggles are currently preview-only.
          </span>
        </Motion.div>

        { NOTIFICATION_GROUPS.map( ( group, i ) => (
          <NotificationGroup
            key={ group.id }
            group={ group }
            delay={ 0.1 + i * 0.07 }
            prefs={ prefs }
            onToggle={ handleToggle }
          />
        ) ) }

      </div>
    </AccountLayout>
  );
}
