import { useMemo } from 'react';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import { ArrowUpRight } from 'lucide-react';
import { sortBrandsBy } from '../../utils/catalogUrlState.js';
import './products-selector.css';

const PRODUCT_BRAND_LOGOS = {
  TapeTech: tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  Columbia: columbiaLogo,
  SurPro: surproLogo,
  Asgard: asgardLogo,
  Graco: gracoLogo,
  'Platinum Drywall Tools': platinumLogo,
  Platinum: platinumLogo,
  'Dura-Stilts': duraStiltsLogo,
  Level5: level5Logo,
  'Level 5': level5Logo,
};

function resolveLogo(brand) {
  return brand.logo || PRODUCT_BRAND_LOGOS[brand.label] || PRODUCT_BRAND_LOGOS[brand.key] || '';
}

export default function ProductsBrandSelector({ brands, onSelectBrand }) {
  const sortedBrands = useMemo(() => sortBrandsBy(brands, 'label'), [brands]);

  return (
    <div className="products-brand-selector">
      <p className="products-brand-selector__breadcrumb">Home &gt; Collections</p>
      <h1 className="products-brand-selector__title">Brands</h1>
      <div className="products-brand-grid">
        {sortedBrands.map((brand) => {
          const label = brand.label || brand.key || '';
          const logo = resolveLogo(brand);
          return (
            <button
              key={brand.slug || brand.key || label}
              onClick={() => onSelectBrand(brand)}
              className="products-brand-card"
            >
              <span className="products-brand-card__logo-frame">
                {logo ? (
                  <img
                    src={logo}
                    alt={`${label} logo`}
                    className="products-brand-card__logo"
                  />
                ) : (
                  <span className="products-brand-card__fallback-label">{label}</span>
                )}
              </span>
              <span className="products-brand-card__name">{label}</span>
              <span className="products-brand-card__cta">
                <span>View collection</span>
                <span className="products-brand-card__cta-icon"><ArrowUpRight size={14} /></span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
