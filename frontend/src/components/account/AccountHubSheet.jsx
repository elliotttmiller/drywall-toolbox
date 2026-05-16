import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Package, LifeBuoy, User, X } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'orders', label: 'Orders', Icon: Package },
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeSheet();
    };
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

  if (!isOpen) return null;

  return (
    <div className="account-hub" role="dialog" aria-modal="true" aria-label="Account hub">
      <button type="button" className="account-hub__backdrop" onClick={closeSheet} aria-label="Close account hub" />
      <section className="account-hub__sheet">
        <button type="button" className="account-hub__close" onClick={closeSheet} aria-label="Close account hub">
          <X size={20} />
        </button>
        <div className="account-hub__content">
          {activeTab === 'home' && (
            <div className="account-hub__panel">
              <section className="account-hub__section">
                <h2>Welcome, {firstName}</h2>
              </section>
              <section className="account-hub__section">
                <div className="account-hub__card">
                  <strong>Recently viewed</strong>
                  <p className="account-hub__empty">Your recently viewed tools will appear here.</p>
                </div>
              </section>
              <section className="account-hub__section">
                <div className="account-hub__card">
                  <strong>Favorites</strong>
                  <p className="account-hub__empty">You haven&apos;t saved any favorites yet.</p>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="account-hub__panel">
              <section className="account-hub__section">
                <div className="account-hub__card">
                  <strong>No recent orders</strong>
                  <p className="account-hub__empty">Your orders will show up here once you complete checkout.</p>
                  <button
                    type="button"
                    className="account-hub__link-button"
                    onClick={() => {
                      closeSheet();
                      navigate('/products');
                    }}
                  >
                    Start shopping
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="account-hub__panel">
              <section className="account-hub__section">
                <div className="account-hub__card">
                  <Link to="/contact" onClick={closeSheet}>Contact Support</Link>
                  <Link to="/repairs" onClick={closeSheet}>Repairs</Link>
                  <Link to="/faq" onClick={closeSheet}>FAQ</Link>
                  <Link to="/schematics" onClick={closeSheet}>Schematics</Link>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="account-hub__panel">
              <section className="account-hub__section">
                <div className="account-hub__card">
                  <strong>{displayName}</strong>
                  <p>{user?.email || 'No email on file'}</p>
                  <Link to="/dashboard" onClick={closeSheet}>View account</Link>
                  <Link to="/dashboard" onClick={closeSheet}>Edit account</Link>
                  <button
                    type="button"
                    className="account-hub__link-button account-hub__link-button--danger"
                    onClick={async () => {
                      closeSheet();
                      await onLogout?.();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
        <nav className="account-hub-nav" aria-label="Account hub tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`account-hub-nav__button${activeTab === id ? ' account-hub-nav__button--active' : ''}`}
              onClick={() => setActiveTab(id)}
              aria-selected={activeTab === id}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}
