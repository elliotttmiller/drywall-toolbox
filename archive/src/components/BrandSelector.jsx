import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import SearchBar from './SearchBar';

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo
};

export default function BrandSelector({
  brands,
  onSelectBrand,
  searchQuery = '',
  onSearchChange = () => {},
  searchResults = [],
  onSelectSchematic = () => {}
}) {
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Part Schematics</h1>
        <p className="text-gray-600">Browse tool schematics and order replacement parts</p>
      </div>

      {/* Search Bar — wired up to search across brand, category, and tool name */}
      <SearchBar
        placeholder="Search schematics by brand, category, or tool name..."
        value={searchQuery}
        onChange={onSearchChange}
      />

      {hasQuery ? (
        /* Search Results */
        <div>
          <p style={{ color: 'rgba(15,23,42,0.5)', fontSize: '0.875rem', marginBottom: '16px' }}>
            {searchResults.length === 0
              ? `No schematics found for "${searchQuery}"`
              : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`}
          </p>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {searchResults.map((schematic) => (
                <button
                  key={schematic.id}
                  onClick={() => onSelectSchematic(schematic)}
                  style={{
                    position: 'relative',
                    background: '#f3f4f6',
                    borderRadius: '0.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    border: '1px solid rgb(229, 231, 235)',
                    transition: 'all 0.3s ease-out',
                    display: 'flex',
                    alignItems: 'stretch',
                    justifyContent: 'stretch',
                    aspectRatio: '1 / 1',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    padding: 0
                  }}
                  onMouseEnter={(e) => {
                    if (window.innerWidth > 768) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (window.innerWidth > 768) {
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {/* Preview image */}
                  {schematic.previewImage && (
                    <img
                      src={schematic.previewImage}
                      alt={schematic.title}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'blur(1px)'
                      }}
                    />
                  )}

                  {/* Gradient overlay with text */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'clamp(8px, 2vw, 16px)',
                    gap: '4px'
                  }}>
                    <span style={{
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 'clamp(0.8rem, 2.5vw, 1rem)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      textShadow: '0 1px 4px rgba(0,0,0,0.6)'
                    }}>
                      {schematic.title}
                    </span>
                    <span style={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: 'clamp(0.65rem, 1.8vw, 0.78rem)',
                      textAlign: 'center'
                    }}>
                      {schematic.brand}
                    </span>
                    {schematic.category && (
                      <span style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 'clamp(0.6rem, 1.6vw, 0.72rem)',
                        textAlign: 'center'
                      }}>
                        {schematic.category}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Default: brand selector grid */
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
      )}
    </div>
  );
}
