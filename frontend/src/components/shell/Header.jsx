import { Phone } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import StorefrontHeader from '../storefront/StorefrontHeader';
import '../../styles/storefront-top-banner.css';

const STORE_PHONE_DISPLAY = '(609) 866-5269';
const STORE_PHONE_HREF = 'tel:+16098665269';

export default function Header(props) {
  const { pathname } = useLocation();
  const showHomeUtilityBar = pathname === '/';
  const hasTopTicker = Boolean(props.hasTopTicker || showHomeUtilityBar);

  return (
    <>
      {showHomeUtilityBar ? (
        <div className="storefront-top-banner" role="region" aria-label="Store information">
          <div className="storefront-top-banner__inner">
            <span className="storefront-top-banner__spacer" aria-hidden="true" />
            <span className="storefront-top-banner__shipping">Free Shipping on Orders +$50</span>
            <a className="storefront-top-banner__phone" href={STORE_PHONE_HREF} aria-label={`Call Drywall Toolbox at ${STORE_PHONE_DISPLAY}`}>
              <Phone size={13} strokeWidth={2} aria-hidden="true" />
              <span>{STORE_PHONE_DISPLAY}</span>
            </a>
          </div>
        </div>
      ) : null}
      <StorefrontHeader {...props} hasTopTicker={hasTopTicker} />
    </>
  );
}
