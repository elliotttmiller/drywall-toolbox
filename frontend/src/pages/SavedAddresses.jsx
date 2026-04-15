/**
 * frontend/src/pages/SavedAddresses.jsx
 *
 * Saved shipping and billing addresses — /addresses
 *
 * Auth: Redirects to /login if unauthenticated (via AccountLayout).
 * Status: Displays user's current WooCommerce billing + shipping addresses
 *         and a coming-soon stub for multi-address management.
 */

import { motion as Motion } from 'framer-motion';
import { MapPin, Home, Truck, Plus, Edit3 } from 'lucide-react';
import AccountLayout from '../components/AccountLayout.jsx';
import SEOHead       from '../components/SEOHead';
import { useAuthContext } from '../auth/AuthContext.js';

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
};

function AddressCard( { type, address, delay } ) {
  const Icon = type === 'billing' ? Home : Truck;
  const color = type === 'billing' ? '#2563eb' : '#16a34a';
  const bg    = type === 'billing' ? '#eff6ff' : '#f0fdf4';
  const label = type === 'billing' ? 'Billing Address' : 'Shipping Address';

  const isEmpty = ! address?.first_name && ! address?.address_1;

  return (
    <Motion.div custom={ delay } variants={ fadeUp } initial="hidden" animate="visible"
      style={ { ...CARD, padding: '20px 22px' } }
    >
      <div style={ { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' } }>
        <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
          <div style={ { width: '36px', height: '36px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Icon size={ 17 } style={ { color } } />
          </div>
          <h2 style={ { margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#0f172a' } }>{ label }</h2>
        </div>
        { ! isEmpty && (
          <button
            type="button"
            style={ {
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '5px',
              padding:        '5px 11px',
              borderRadius:   '7px',
              border:         '1px solid rgba(15,23,42,0.12)',
              background:     'transparent',
              fontSize:       '0.75rem',
              fontWeight:     650,
              color:          'rgba(15,23,42,0.55)',
              cursor:         'pointer',
              transition:     'background 0.15s',
            } }
            onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f1f5f9'; } }
            onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; } }
          >
            <Edit3 size={ 12 } /> Edit
          </button>
        ) }
      </div>

      { isEmpty ? (
        <div style={ { padding: '20px 0', textAlign: 'center' } }>
          <MapPin size={ 26 } style={ { color: 'rgba(15,23,42,0.2)', display: 'block', margin: '0 auto 10px' } } />
          <p style={ { margin: '0 0 14px', fontSize: '0.83rem', color: 'rgba(15,23,42,0.4)' } }>No { label.toLowerCase() } saved yet.</p>
          <button
            type="button"
            style={ {
              display:     'inline-flex',
              alignItems:  'center',
              gap:         '6px',
              padding:     '7px 16px',
              borderRadius: '8px',
              border:      '1.5px dashed rgba(15,23,42,0.2)',
              background:  'transparent',
              fontSize:    '0.8rem',
              fontWeight:  650,
              color:       'rgba(15,23,42,0.5)',
              cursor:      'pointer',
              transition:  'border-color 0.15s, color 0.15s',
            } }
            onMouseEnter={ ( e ) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; } }
            onMouseLeave={ ( e ) => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.2)'; e.currentTarget.style.color = 'rgba(15,23,42,0.5)'; } }
          >
            <Plus size={ 13 } /> Add address
          </button>
        </div>
      ) : (
        <address style={ { fontStyle: 'normal', lineHeight: 1.65, fontSize: '0.88rem', color: '#334155' } }>
          { [ address.first_name, address.last_name ].filter( Boolean ).join( ' ' ) && (
            <p style={ { margin: '0 0 2px', fontWeight: 650, color: '#0f172a' } }>
              { [ address.first_name, address.last_name ].filter( Boolean ).join( ' ' ) }
            </p>
          ) }
          { address.company   && <p style={ { margin: '0 0 2px' } }>{ address.company }</p> }
          { address.address_1 && <p style={ { margin: '0 0 2px' } }>{ address.address_1 }</p> }
          { address.address_2 && <p style={ { margin: '0 0 2px' } }>{ address.address_2 }</p> }
          { ( address.city || address.state || address.postcode ) && (
            <p style={ { margin: '0 0 2px' } }>
              { [ address.city, address.state, address.postcode ].filter( Boolean ).join( ', ' ) }
            </p>
          ) }
          { address.country   && <p style={ { margin: 0 } }>{ address.country }</p> }
          { address.phone     && <p style={ { margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(15,23,42,0.5)' } }>{ address.phone }</p> }
        </address>
      ) }
    </Motion.div>
  );
}

export default function SavedAddresses() {
  const { user } = useAuthContext();

  const billing  = user?.billing  || {};
  const shipping = user?.shipping || {};

  return (
    <AccountLayout title="Saved Addresses" subtitle="Manage your billing and shipping addresses">
      <SEOHead noindex title="Saved Addresses" />

      <div style={ { display: 'flex', flexDirection: 'column', gap: '16px' } }>

        <AddressCard type="billing"  address={ billing }  delay={ 0 } />
        <AddressCard type="shipping" address={ shipping } delay={ 0.07 } />

        {/* Coming-soon multi-address note */}
        <Motion.div custom={ 0.14 } variants={ fadeUp } initial="hidden" animate="visible"
          style={ {
            background:   '#f8fafc',
            border:       '1.5px dashed rgba(15,23,42,0.12)',
            borderRadius: '12px',
            padding:      '18px 20px',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
          } }
        >
          <Plus size={ 18 } style={ { color: 'rgba(15,23,42,0.3)', flexShrink: 0 } } />
          <div>
            <p style={ { margin: '0 0 2px', fontSize: '0.88rem', fontWeight: 650, color: 'rgba(15,23,42,0.5)' } }>
              Multiple saved addresses
            </p>
            <p style={ { margin: 0, fontSize: '0.78rem', color: 'rgba(15,23,42,0.38)' } }>
              Support for saving multiple addresses and switching at checkout is coming soon.
            </p>
          </div>
        </Motion.div>

      </div>
    </AccountLayout>
  );
}
