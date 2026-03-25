import '../styles/brand-selector.css';

import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo
};

export default function BrandSelector({ brands, onSelectBrand }) {
  return (
    <div className="brand-selector">
      <div className="brand-selector-header">
        <h1 className="brand-selector-title">Part Schematics</h1>
        <p className="brand-selector-subtitle">Browse tool schematics and order replacement parts</p>
      </div>

      <div className="brands-grid">
        {brands.map((brand) => (
          <button
            key={brand}
            className="brand-card"
            onClick={() => onSelectBrand(brand)}
            aria-label={`Select ${brand}`}
          >
            {/* Hover gradient overlay */}
            <div className="brand-card-background" aria-hidden="true" />

            <div className="brand-card-content">
              <img
                className="brand-logo"
                src={brandLogos[brand]}
                alt={`${brand} logo`}
              />
              <span className="brand-name">{brand}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
