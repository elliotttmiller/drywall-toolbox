import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Package, LifeBuoy, User, X, ShoppingBag, Heart, Sparkles, ChevronRight, Clock, CheckCircle, AlertCircle, Truck, Loader } from 'lucide-react';
import { getCustomerOrders } from '../../api/orders.js';
import { getRecentlyViewed } from '../../utils/recentlyViewed.js';

const TABS = [
  { id: 'home',    label: 'Home',    Icon: Home },
  { id: 'orders',  label: 'Orders',  Icon: Package },
  { id: 'support', label: 'Support', Icon: LifeBuoy },
  { id: 'account', label: 'Account', Icon: User },
];

// ─── Order status badge ───────────────────────────────────────────────────────

const ORDER_STATUS_CFG = {
  pending:    { label: 'Pending',    color: '#d97706', bg: '#fffbeb', Icon: Clock        },
  processing: { label: 'Processing', color: '#2563eb', bg: '#eff6ff', Icon: Package      },
  'on-hold':  { label: 'On Hold',    color: '#d97706', bg: '#fff7ed', Icon: Clock        },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle  },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle  },
  refunded:   { label: 'Refunded',   color: '#64748b', bg: '#f8fafc', Icon: AlertCircle  },
  failed:     { label: 'Failed',     color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle  },
  shipped:    { label: 'Shipped',    color: '#2563eb', bg: '#eff6ff', Icon: Truck        },
};

function OrderStatusBadge( { status } ) {
  const cfg = ORDER_STATUS_CFG[ status ] || { label: status, color: '#64748b', bg: '#f8fafc', Icon: Package };
  return (
    <span style={ {
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '3px',
      padding:      '2px 7px',
      borderRadius: '999px',
      background:   cfg.bg,
      color:        cfg.color,
      fontSize:     '0.65rem',
      fontWeight:   700,
      whiteSpace:   'nowrap',
    } }>
      <cfg.Icon size={ 9 } />{ cfg.label }
    </span>
  );
}

// ─── Recently viewed tile ─────────────────────────────────────────────────────

function RecentlyViewedTile( { product, onClose } ) {
  return (
    <Link
      to={ `/products/${ product.slug }` }
      onClick={ onClose }
      style={ {
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        padding:        '8px 10px',
        borderRadius:   '8px',
        textDecoration: 'none',
        transition:     'background 0.12s',
      } }
      onMouseEnter={ ( e ) => { e.currentTarget.style.background = '#f1f5f9'; } }
      onMouseLeave={ ( e ) => { e.currentTarget.style.background = 'transparent'; } }
    >
      <div style={ {
        width:          '40px',
        height:         '40px',
        borderRadius:   '6px',
        background:     '#f8fafc',
        border:         '1px solid rgba(15,23,42,0.08)',
        flexShrink:     0,
        overflow:       'hidden',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      } }>
        { product.image
          ? <img src={ product.image } alt={ product.name } style={ { width: '100%', height: '100%', objectFit: 'contain' } } />
          : <Package size={ 18 } style={ { color: 'rgba(15,23,42,0.2)' } } />
        }
      </div>
      <div style={ { flex: 1, minWidth: 0 } }>
        <p style={ { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
          { product.name }
        </p>
        { product.price && (
          <p style={ { margin: '1px 0 0', fontSize: '0.72rem', color: 'rgba(15,23,42,0.5)' } }>
            { product.price }
          </p>
        ) }
      </div>
      <ChevronRight size={ 14 } strokeWidth={ 2.5 } style={ { color: 'rgba(15,23,42,0.25)', flexShrink: 0 } } />
    </Link>
  );
}

export default function AccountHubSheet({ isOpen, onClose, user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const closeSheet = useCallback(() => {
    setActiveTab('home');
    onClose?.();
  }, [onClose]);

  // Refresh recently viewed whenever sheet opens — deferred to avoid sync setState-in-effect
  useEffect(() => {
    if (!isOpen) return;
    Promise.resolve(getRecentlyViewed()).then(setRecentlyViewed);
  }, [isOpen]);

  // Fetch orders when sheet opens and user is authenticated
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;

    async function load() {
      setOrdersLoading(true);
      try {
        const data = await getCustomerOrders(user.id, 1, 5);
        if (cancelled) return;
        setOrders(Array.isArray(data) ? data : (data?.orders ?? []));
      } catch { /* noop */ }
      if (!cancelled) setOrdersLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, user?.id]);

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeSheet]);

  const firstName = useMemo(
    () => user?.first_name || user?.name?.split(' ')?.[0] || 'there',
    [user]
  );
  const displayName = useMemo(
    () => [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || 'My Account',
    [user]
  );

  return (
    <div
      className={`account-hub${isOpen ? ' account-hub--open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Account hub"
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="account-hub__backdrop"
        onClick={closeSheet}
        aria-label="Close account hub"
        tabIndex={isOpen ? 0 : -1}
      />

      {/* Sheet */}
      <section className="account-hub__sheet">

        {/* Close button */}
        <button
          type="button"
          className="account-hub__close"
          onClick={closeSheet}
          aria-label="Close"
          tabIndex={isOpen ? 0 : -1}
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Scrollable content */}
        <div className="account-hub__content">

          {/* ── UNAUTHENTICATED ── */}
          {!user && (
            <div className="account-hub__panel">
              <h2 className="account-hub__headline">
                Earn rewards, track orders, and save your tools
              </h2>
              <div className="account-hub__rewards-badge">
                <Sparkles size={14} strokeWidth={2} />
                <span>Rewards available</span>
              </div>
              <button
                type="button"
                className="account-hub__signin-cta"
                onClick={() => { closeSheet(); navigate('/login'); }}
              >
                Sign in
              </button>

              <div className="account-hub__divider" />

              <section className="account-hub__list-section">
                <button
                  type="button"
                  className="account-hub__section-header"
                  onClick={() => { closeSheet(); navigate('/products'); }}
                >
                  <span>Recently viewed</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
                { recentlyViewed.length > 0 ? (
                  <div className="account-hub__recently-viewed-list">
                    { recentlyViewed.slice(0, 4).map((p) => (
                      <RecentlyViewedTile key={p.id} product={p} onClose={closeSheet} />
                    )) }
                  </div>
                ) : (
                  <div className="account-hub__empty-card">
                    <div className="account-hub__empty-icon">
                      <ShoppingBag size={26} strokeWidth={1.5} />
                    </div>
                    <p>Recently viewed products will appear here.</p>
                  </div>
                ) }
              </section>

              <section className="account-hub__list-section">
                <div className="account-hub__section-header account-hub__section-header--static">
                  <span>Favorites</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </div>
                <div className="account-hub__empty-card">
                  <div className="account-hub__empty-icon account-hub__empty-icon--muted">
                    <Heart size={26} strokeWidth={1.5} />
                  </div>
                  <p>No favorite products</p>
                </div>
              </section>
            </div>
          )}

          {/* ── AUTHENTICATED: HOME ── */}
          {user && activeTab === 'home' && (
            <div className="account-hub__panel">
              <h2 className="account-hub__welcome">
                Welcome,<br />{firstName}
              </h2>

              <section className="account-hub__list-section">
                <button
                  type="button"
                  className="account-hub__section-header"
                  onClick={() => { closeSheet(); navigate('/products'); }}
                >
                  <span>Recently viewed</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
                { recentlyViewed.length > 0 ? (
                  <div className="account-hub__recently-viewed-list">
                    { recentlyViewed.slice(0, 4).map((p) => (
                      <RecentlyViewedTile key={p.id} product={p} onClose={closeSheet} />
                    )) }
                  </div>
                ) : (
                  <div className="account-hub__empty-card">
                    <div className="account-hub__empty-icon">
                      <ShoppingBag size={26} strokeWidth={1.5} />
                    </div>
                    <p>Recently viewed products will appear here.</p>
                  </div>
                ) }
              </section>

              <section className="account-hub__list-section">
                <div className="account-hub__section-header account-hub__section-header--static">
                  <span>Favorites</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </div>
                <div className="account-hub__empty-card">
                  <div className="account-hub__empty-icon account-hub__empty-icon--muted">
                    <Heart size={26} strokeWidth={1.5} />
                  </div>
                  <p>No favorite products</p>
                </div>
              </section>
            </div>
          )}

          {/* ── AUTHENTICATED: ORDERS ── */}
          {user && activeTab === 'orders' && (
            <div className="account-hub__panel">
              { ordersLoading ? (
                <div style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px 0' } }>
                  <Loader size={20} style={ { color: '#2563eb' } } className="animate-spin" />
                  <span style={ { fontSize: '0.85rem', color: 'rgba(15,23,42,0.5)' } }>Loading orders…</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="account-hub__panel account-hub__panel--centered">
                  <div className="account-hub__empty-state">
                    <div className="account-hub__empty-state-icon">
                      <Package size={34} strokeWidth={1.4} />
                    </div>
                    <strong className="account-hub__empty-state-title">No orders yet</strong>
                    <p className="account-hub__empty-state-body">
                      Current and past orders will appear here to track shipping updates.
                    </p>
                    <button
                      type="button"
                      className="account-hub__outline-btn"
                      onClick={() => { closeSheet(); navigate('/products'); }}
                    >
                      Start shopping
                    </button>
                  </div>
                </div>
              ) : (
                <div className="account-hub__list-section">
                  <div className="account-hub__links-card" style={ { padding: 0 } }>
                    { orders.map((order, i) => (
                      <Link
                        key={ order.id }
                        to={ `/order/${ order.id }` }
                        onClick={ closeSheet }
                        style={ {
                          display:        'flex',
                          alignItems:     'center',
                          gap:            '10px',
                          padding:        '12px 14px',
                          textDecoration: 'none',
                          borderBottom:   i < orders.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                          transition:     'background 0.12s',
                        } }
                        onMouseEnter={ (e) => { e.currentTarget.style.background = '#f8fafc'; } }
                        onMouseLeave={ (e) => { e.currentTarget.style.background = 'transparent'; } }
                      >
                        <div style={ { flex: 1, minWidth: 0 } }>
                          <div style={ { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' } }>
                            <span style={ { fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' } }>Order #{ order.id }</span>
                            <OrderStatusBadge status={ order.status } />
                          </div>
                          <p style={ { margin: 0, fontSize: '0.72rem', color: 'rgba(15,23,42,0.42)' } }>
                            { order.date_created ? new Date(order.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }
                          </p>
                        </div>
                        <div style={ { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } }>
                          <span style={ { fontWeight: 750, color: '#0f172a', fontSize: '0.88rem' } }>
                            ${ parseFloat(order.total ?? 0).toFixed(2) }
                          </span>
                          <ChevronRight size={13} style={ { color: 'rgba(15,23,42,0.25)' } } />
                        </div>
                      </Link>
                    )) }
                  </div>
                  <button
                    type="button"
                    onClick={ () => { closeSheet(); navigate('/dashboard?tab=orders'); } }
                    style={ {
                      marginTop:      '10px',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      gap:            '4px',
                      width:          '100%',
                      padding:        '9px',
                      borderRadius:   '8px',
                      border:         '1px solid rgba(15,23,42,0.1)',
                      background:     'transparent',
                      fontSize:       '0.8rem',
                      fontWeight:     650,
                      color:          '#2563eb',
                      cursor:         'pointer',
                      transition:     'background 0.12s',
                    } }
                    onMouseEnter={ (e) => { e.currentTarget.style.background = '#eff6ff'; } }
                    onMouseLeave={ (e) => { e.currentTarget.style.background = 'transparent'; } }
                  >
                    View all orders <ChevronRight size={13} />
                  </button>
                </div>
              ) }
            </div>
          )}

          {/* ── AUTHENTICATED: SUPPORT ── */}
          {user && activeTab === 'support' && (
            <div className="account-hub__panel">
              <h2 className="account-hub__welcome">Support</h2>
              <section className="account-hub__list-section">
                <div className="account-hub__links-card">
                  {[
                    { to: '/contact',    label: 'Contact Support' },
                    { to: '/repairs',    label: 'Repairs'         },
                    { to: '/faq',        label: 'FAQ'             },
                    { to: '/schematics', label: 'Schematics'      },
                  ].map(({ to, label }) => (
                    <Link key={to} to={to} onClick={closeSheet} className="account-hub__row-link">
                      <span>{label}</span>
                      <ChevronRight size={16} strokeWidth={2.5} className="account-hub__row-chevron" />
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── AUTHENTICATED: ACCOUNT ── */}
          {user && activeTab === 'account' && (
            <div className="account-hub__panel">
              <h2 className="account-hub__welcome">{displayName}</h2>
              {user?.email && (
                <p className="account-hub__account-email">{user.email}</p>
              )}
              <section className="account-hub__list-section">
                <div className="account-hub__links-card">
                  {[
                    { to: '/dashboard',                label: 'My Dashboard'      },
                    { to: '/dashboard?tab=orders',     label: 'Order History'     },
                    { to: '/dashboard?tab=rewards',    label: 'Rewards'           },
                    { to: '/dashboard?tab=addresses',  label: 'Saved Addresses'   },
                    { to: '/dashboard?tab=settings',   label: 'Account Settings'  },
                  ].map(({ to, label }) => (
                    <Link key={to} to={to} onClick={closeSheet} className="account-hub__row-link">
                      <span>{label}</span>
                      <ChevronRight size={16} strokeWidth={2.5} className="account-hub__row-chevron" />
                    </Link>
                  ))}
                </div>
              </section>
              <section className="account-hub__list-section">
                <button
                  type="button"
                  className="account-hub__signout-btn"
                  onClick={async () => { closeSheet(); await onLogout?.(); }}
                >
                  Sign out
                </button>
              </section>
            </div>
          )}
        </div>

        {/* ── BOTTOM TAB BAR (authenticated only) ── */}
        {user && (
          <nav className="account-hub-nav" aria-label="Account hub navigation">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`account-hub-nav__item${activeTab === id ? ' account-hub-nav__item--active' : ''}`}
                onClick={() => setActiveTab(id)}
                aria-selected={activeTab === id}
                aria-label={label}
                tabIndex={isOpen ? 0 : -1}
              >
                <span className="account-hub-nav__pill">
                  <Icon size={22} strokeWidth={activeTab === id ? 2.2 : 1.6} />
                </span>
              </button>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}
