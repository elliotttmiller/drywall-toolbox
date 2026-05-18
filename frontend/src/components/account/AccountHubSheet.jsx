import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Package, LifeBuoy, User, X, ShoppingBag, Heart, Sparkles, ChevronRight } from 'lucide-react';

const TABS = [
  { id: 'home',    label: 'Home',    Icon: Home },
  { id: 'orders',  label: 'Orders',  Icon: Package },
  { id: 'support', label: 'Support', Icon: LifeBuoy },
  { id: 'account', label: 'Account', Icon: User },
];

export default function AccountHubSheet({ isOpen, onClose, user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');

  const closeSheet = useCallback(() => {
    setActiveTab('home');
    onClose?.();
  }, [onClose]);

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
                <div className="account-hub__empty-card">
                  <div className="account-hub__empty-icon">
                    <ShoppingBag size={26} strokeWidth={1.5} />
                  </div>
                  <p>Recently viewed products will appear here.</p>
                </div>
              </section>

              <section className="account-hub__list-section">
                <div className="account-hub__section-header account-hub__section-header--static">
                  <span>Favorites</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
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
                <div className="account-hub__empty-card">
                  <div className="account-hub__empty-icon">
                    <ShoppingBag size={26} strokeWidth={1.5} />
                  </div>
                  <p>Recently viewed products will appear here.</p>
                </div>
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
                    { to: '/dashboard',        label: 'My Dashboard'      },
                    { to: '/orders',           label: 'Order History'      },
                    { to: '/rewards',          label: 'Rewards'            },
                    { to: '/addresses',        label: 'Saved Addresses'    },
                    { to: '/account-settings', label: 'Account Settings'   },
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
