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
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Parts & Schematics</h1>
        <p className="text-gray-600">Browse tool schematics and order replacement parts</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {brands.map((brand) => (
          <button
            key={brand}
            onClick={() => onSelectBrand(brand)}
            style={{
              background: 'white',
              borderRadius: '0.5rem',
              padding: 'clamp(1rem, 4vw, 1.5rem)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              border: '1px solid rgb(229, 231, 235)',
              transition: 'all 0.3s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              aspectRatio: '1 / 1',
              cursor: 'pointer'
            }}
            className="brand-card-products"
            onMouseEnter={(e) => {
              if (window.innerWidth > 768) {
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (window.innerWidth > 768) {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              }
            }}
          >
            <img 
              src={brandLogos[brand]} 
              alt={`${brand} logo`}
              style={{
                height: 'clamp(4rem, 12vw, 6rem)',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
