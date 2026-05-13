import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProductDetail from '../components/product/ProductDetail';
import ProductModal from '../components/product/ProductModal';
import ProductShoppingCard from '../components/ui/ProductShoppingCard';
import BackButton from '../components/shared/BackButton';
import SearchBar from '../components/catalog/SearchBar';
import Dropdown from '../components/ui/Dropdown';
import { SORT_OPTIONS } from '../constants/sortOptions';
import FilterPanel from '../components/catalog/FilterPanel';
import Toast from '../components/ui/Toast';
import Pagination from '../components/catalog/Pagination';
import { ProductSkeletonGrid } from '../components/catalog/ProductShoppingCardSkeleton';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '../services/catalog';
import { getProductVariations } from '../services/api';
import { useCart } from '../context/CartContext';
import {
  ShoppingCart,
  Filter,
} from 'lucide-react';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/shared/SEOHead';
import { buildSiteLinksSearchBoxSchema } from '../utils/schema';
import { fetchVariationsBatched, getVariationSelectionMap } from '../utils/variationSelection';
import { PLACEHOLDER_IMAGE } from '../constants/images.js';
import '../styles/tool-selector.css';

// products will be loaded from WooCommerce REST API at runtime
// brands list will be derived from loaded products
const categories = [
  { id: 'taping',    name: 'Automatic Taping Tools' },
  { id: 'finishing', name: 'Finishing Tools' },
  { id: 'corner',    name: 'Corner Tools' },
  { id: 'mudboxes',  name: 'Mud Boxes & Pumps' },
  { id: 'sanding',   name: 'Sanding Tools' },
];

const ALLOWED_BRANDS = [
  'TapeTech',
  'Columbia Taping Tools',
  'Asgard',
  'SurPro',
  'Graco',
  'Platinum Drywall Tools',
  'Dura-Stilts',
  'Level 5'
];

const MAX_PRICE = 3000;
const ITEMS_PER_PAGE = 24;

const BRAND_TO_SLUG = {
  'TapeTech':              'tapetech',
  'Columbia Taping Tools': 'columbia-taping-tools',
  'Asgard':                'asgard',
  'SurPro':                'surpro',
  'Graco':                 'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':           'dura-stilts',
  'Level 5':               'level5',
};
const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo,
  'Platinum Drywall Tools': platinumLogo,
  'Dura-Stilts': duraStiltsLogo,
  'Level 5': level5Logo,
};

export default function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const params = new URLSearchParams(location.search);
  const brandParam = params.get('brand');
  const searchParam = params.get('search');
  const pageParam = parseInt(params.get('page') || '1', 10);
  const initialSelectedBrands = brandParam
    ? brandParam
        .split(',')
        .map(b => b.trim())
        .map(b => SLUG_TO_BRAND[b] || b)
        .filter(Boolean)
        .filter(brand => ALLOWED_BRANDS.includes(brand))
    : [];

  const [selectedBrands, setSelectedBrands] = useState(initialSelectedBrands);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDisplayCategory, setSelectedDisplayCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParam ? decodeURIComponent(searchParam) : '');
  const [priceRange, setPriceRange] = useState([0, MAX_PRICE]);
  const [sortBy, setSortBy] = useState('popular');
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [showFilters, setShowFilters] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [cardVariationMap, setCardVariationMap] = useState({});
  const cardVariationMapRef = useRef({});

  const showToast = (message, type = 'cart') => {
    setToast({ message, type });
  };

  const handleAddToCart = (product, quantity = 1) => {
    addToCart(product, quantity);
    showToast(`${product.name} added to cart!`, 'cart');
  };

  const openModal = (product, cardProduct = null) => {
    const initialResolvedVariation = cardProduct?.parent_id ? cardProduct : null;
    setModalProduct({
      product,
      initialResolvedVariation,
      initialSelectedAttrs: initialResolvedVariation
        ? getVariationSelectionMap(initialResolvedVariation)
        : {},
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleBrand = (brand) => {
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(newBrands);
    setCurrentPage(1);
  };

  const resetToBrandList = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedDisplayCategory(null);
    setPriceRange([0, MAX_PRICE]);
    setCurrentPage(1);
    navigate('/products');
  };

  const resetToCategoryCards = () => {
    setSelectedDisplayCategory(null);
    setSelectedCategories([]);
    setCurrentPage(1);
    navigate(`/products?brand=${encodeURIComponent(BRAND_TO_SLUG[selectedBrands[0]] || selectedBrands[0])}`);
  };

  useEffect(() => {
    let mounted = true;
    getProducts().then(list => {
      if (!mounted) return;
      setProducts(list);
      const fromCatalog = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
      const inCatalog = fromCatalog.filter(b => ALLOWED_BRANDS.includes(b));
      const notInCatalog = ALLOWED_BRANDS.filter(b => !inCatalog.includes(b));
      setBrands([...inCatalog, ...notInCatalog]);
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const brandParam = params.get('brand');
    const brandsFromUrl = brandParam
      ? brandParam.split(',').map(b => decodeURIComponent(b.trim())).filter(Boolean).filter(brand => ALLOWED_BRANDS.includes(brand))
      : [];

    const urlBrandsSet = [...brandsFromUrl].sort().join(',');
    const currentBrandsSet = [...selectedBrands].sort().join(',');

    if (urlBrandsSet !== currentBrandsSet) {
      const t = setTimeout(() => setSelectedBrands(brandsFromUrl), 0);
      return () => clearTimeout(t);
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentBrandParam  = params.get('brand')  || '';
    const currentSearchParam = params.get('search') || '';
    const currentPageParam   = params.get('page')   || '';

    const expectedBrandParam  = selectedBrands.length > 0
      ? selectedBrands.map(b => encodeURIComponent(BRAND_TO_SLUG[b] || b)).join(',')
      : '';
    const expectedSearchParam = searchQuery ? encodeURIComponent(searchQuery) : '';
    const expectedPageParam   = currentPage > 1 ? String(currentPage) : '';

    if (
      currentBrandParam  !== expectedBrandParam  ||
      currentSearchParam !== expectedSearchParam ||
      currentPageParam   !== expectedPageParam
    ) {
      const newParams = new URLSearchParams();
      if (selectedBrands.length > 0) newParams.set('brand', expectedBrandParam);
      if (searchQuery)                newParams.set('search', expectedSearchParam);
      if (currentPage > 1)            newParams.set('page', expectedPageParam);
      const newSearch = newParams.toString();
      navigate(newSearch ? `/products?${newSearch}` : '/products', { replace: true });
    }
  }, [selectedBrands, searchQuery, currentPage, navigate, location.search]);

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
    setCurrentPage(1);
  };

  const nonPartsProducts = (products || []).filter(product => !product.is_parts);

  const filteredProducts = nonPartsProducts.filter(product => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) return false;
    if (selectedDisplayCategory && product.display_category !== selectedDisplayCategory) return false;
    if (product.price && (product.price < priceRange[0] || product.price > priceRange[1])) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = product.name && product.name.toLowerCase().includes(query);
      const matchesSku = product.sku && product.sku.toLowerCase().includes(query);
      const matchesUpc = product.upc && product.upc.toLowerCase().includes(query);
      const matchesBrand = product.brand && product.brand.toLowerCase().includes(query);
      if (!matchesName && !matchesSku && !matchesUpc && !matchesBrand) return false;
    }
    return true;
  });

  const brandCategoryCards = (() => {
    if (selectedBrands.length === 0) return [];
    const brandProducts = nonPartsProducts.filter(p => selectedBrands.includes(p.brand));
    const seen = new Set();
    const cards = [];
    for (const p of brandProducts) {
      const dc = p.display_category;
      if (dc && !seen.has(dc)) {
        seen.add(dc);
        cards.push({ name: dc, image: p.image });
      }
    }
    return cards.sort((a, b) => a.name.localeCompare(b.name));
  })();

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      case 'rating': return b.rating - a.rating;
      case 'popular':
      default: {
        const badgePriority = { 'Best Seller': 0, 'Popular': 1, 'New': 2 };
        const aBadgePriority = badgePriority[a.badge] ?? 3;
        const bBadgePriority = badgePriority[b.badge] ?? 3;
        if (aBadgePriority !== bBadgePriority) return aBadgePriority - bBadgePriority;
        const aReviews = a.reviews || 0;
        const bReviews = b.reviews || 0;
        if (aReviews !== bReviews) return bReviews - aReviews;
        const aRating = a.rating || 0;
        const bRating = b.rating || 0;
        if (aRating !== bRating) return bRating - aRating;
        const aIsMainTool = (a.price || 0) > 50;
        const bIsMainTool = (b.price || 0) > 50;
        if (aIsMainTool !== bIsMainTool) return aIsMainTool ? -1 : 1;
        return (b.price || 0) - (a.price || 0);
      }
    }
  });

  const totalPages   = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));
  const safePage     = Math.min(currentPage, totalPages);
  const pageStart    = (safePage - 1) * ITEMS_PER_PAGE;
  const pageProducts = sortedProducts.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const pageVariableIdsKey = pageProducts
    .filter((p) => p.is_variable && p.id)
    .map((p) => String(p.id))
    .join(',');

  useEffect(() => {
    cardVariationMapRef.current = cardVariationMap;
  }, [cardVariationMap]);

  useEffect(() => {
    const variableIds = pageProducts
      .filter((p) => p.is_variable && p.id && !cardVariationMapRef.current[p.id])
      .map((p) => p.id);
    if (variableIds.length === 0) return;

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => {
        next[id] = vars;
      });
      setCardVariationMap((prev) => ({ ...prev, ...next }));
    }).catch(() => {});

    return () => { mounted = false; };
  }, [pageVariableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCardDisplayProduct = useCallback((product) => {
    if (!product.is_variable) return product;
    const vars = cardVariationMap[product.id];
    if (!Array.isArray(vars) || vars.length === 0) return product;
    const best = vars.find(v => v.stock_status !== 'outofstock') || vars[0];
    if (!best) return product;
    if (!best.image || best.image === PLACEHOLDER_IMAGE) {
      return {
        ...best,
        image:           product.image,
        images:          product.images,
        image_thumbnail: product.image_thumbnail,
        image_srcset:    product.image_srcset,
        image_sizes:     product.image_sizes,
      };
    }
    return best;
  }, [cardVariationMap]);

  const goToPage = (n) => {
    setCurrentPage(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 page-wrapper">
      <SEOHead
        title="Products"
        description="Shop professional drywall tools from TapeTech, Columbia, Asgard, Graco, SurPro and more. Automatic taping tools, finishing tools, mud boxes, and replacement parts."
        canonical="https://drywalltoolbox.com/products"
        schema={buildSiteLinksSearchBoxSchema()}
      />
      <div className="container mx-auto px-4 py-4 pt-6">
        {selectedBrands.length > 0 && (
          <div className="mb-6">
            <BackButton
              onClick={selectedDisplayCategory ? resetToCategoryCards : resetToBrandList}
              label={selectedDisplayCategory ? selectedBrands[0] || 'Categories' : 'Brands'}
            />
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Browse our extensive collection of professional drywall tools</p>
        </div>

        {selectedBrands.length > 0 && (
            <SearchBar
              placeholder="Search products by name, SKU, or brand..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
        )}

        {selectedBrands.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => {
                  const brandSlug = BRAND_TO_SLUG[brand] || brand;
                  navigate(`/products?brand=${encodeURIComponent(brandSlug)}`);
                  setSelectedBrands([brand]);
                  setSelectedDisplayCategory(null);
                  setCurrentPage(1);
                }}
                className="dtb-brand-card"
                aria-label={`Shop ${brand}`}
              >
                {brandLogos[brand] ? (
                  <img
                    src={brandLogos[brand]}
                    alt={`${brand} logo`}
                    style={{
                      height: ['Columbia Taping Tools', 'Graco'].includes(brand)
                        ? 'clamp(5.5rem, 16vw, 8rem)'
                        : 'clamp(4rem, 12vw, 6rem)',
                      width: 'auto',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <span style={{
                    fontWeight: 700,
                    fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)',
                    letterSpacing: '-0.02em',
                    color: '#1f2937',
                    textAlign: 'center',
                    lineHeight: 1.2
                  }}>
                    {brand}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : !selectedDisplayCategory && brandCategoryCards.length > 1 ? (
          <div>
            <div className="flex items-center justify-center mb-8">
              {brandLogos[selectedBrands[0]] && (
                <img
                  src={brandLogos[selectedBrands[0]]}
                  alt={`${selectedBrands[0]} logo`}
                  style={{
                    height: ['Columbia Taping Tools', 'Graco'].includes(selectedBrands[0])
                      ? 'clamp(4.5rem, 15vw, 7rem)'
                      : 'clamp(3.75rem, 13vw, 6rem)',
                    width: 'auto',
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>
            <div className="categories-grid">
              {brandCategoryCards.map((cat, index) => {
                const count = nonPartsProducts.filter(
                  p => selectedBrands.includes(p.brand) && p.display_category === cat.name
                ).length;
                return (
                  <button
                    key={cat.name}
                    className={`category-card${cat.image ? '' : ' category-card--no-image'}`}
                    style={{ animationDelay: `${(index + 1) * 0.07}s` }}
                    onClick={() => {
                      setSelectedDisplayCategory(cat.name);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    aria-label={`Browse ${cat.name}`}
                  >
                    {cat.image && <img src={cat.image} alt={cat.name} className="category-card-img" />}
                    <div className="category-card-scrim" />
                    <div className="category-card-content">
                      <div className="category-card-text">
                        <h3 className="category-name">{cat.name}</h3>
                        <span className="category-count">{count} product{count !== 1 ? 's' : ''}</span>
                      </div>
                      <ChevronRight className="category-card-chevron" size={18} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <FilterPanel
              isOpen={showFilters}
              onClose={() => setShowFilters(false)}
              categories={categories}
              brands={brands}
              maxPrice={MAX_PRICE}
              selectedBrands={selectedBrands}
              selectedCategories={selectedCategories}
              priceRange={priceRange}
              onBrandChange={toggleBrand}
              onCategoryChange={toggleCategory}
              onPriceChange={(nextPriceRange) => {
                setPriceRange(nextPriceRange);
                setCurrentPage(1);
              }}
              onClearFilters={() => {
                setSelectedBrands([]);
                setSelectedCategories([]);
                setPriceRange([0, MAX_PRICE]);
                setCurrentPage(1);
                navigate('/products');
              }}
              resultsCount={sortedProducts.length}
            />

          <div className="flex-1">
            <div className="flex flex-row justify-between items-center gap-4 mb-6">
              <Dropdown
                value={sortBy}
                onChange={(value) => {
                  setSortBy(value);
                  setCurrentPage(1);
                }}
                options={SORT_OPTIONS}
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 hover:bg-gray-50 font-medium text-sm transition-colors"
                aria-label="Toggle Filters"
              >
                <Filter size={18} />
                <span>Filters</span>
              </button>
            </div>

            {loading ? (
              <ProductSkeletonGrid count={24} />
            ) : (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              {pageProducts.map((product, index) => {
                  const cardProduct = getCardDisplayProduct(product);
                  return (
                    <ProductShoppingCard
                      key={product.id}
                      product={product}
                      cardProduct={cardProduct}
                      hasSelectedVariation={Boolean(product.is_variable && cardProduct?.parent_id)}
                      onOpenModal={() => openModal(product, cardProduct)}
                      onAddToCart={() => openModal(product, cardProduct)}
                      index={index}
                    />
                  );
              })}
            </div>

            {sortedProducts.length > 0 && (
              <>
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  className="mt-8"
                />
                <p className="text-center text-sm text-gray-400 mt-2">
                  Showing {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, sortedProducts.length)} of{' '}
                  {sortedProducts.length.toLocaleString()} results
                </p>
              </>
            )}

            {sortedProducts.length === 0 && (
              <div className="text-center py-16">
                <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">No products found</h2>
                <p className="text-gray-600 mb-6">Try adjusting your filters to see more products.</p>
                <button
                  onClick={() => {
                    setSelectedBrands([]);
                    setSelectedCategories([]);
                    setPriceRange([0, MAX_PRICE]);
                    setCurrentPage(1);
                    navigate('/products');
                  }}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
            </>
            )}
          </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct?.product || modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            key={`${modalProduct.product?.id || modalProduct.id}:${modalProduct.initialResolvedVariation?.id || 'parent'}`}
            product={modalProduct.product || modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={cardVariationMap[modalProduct.product?.id || modalProduct.id] || []}
            initialResolvedVariation={modalProduct.initialResolvedVariation}
            initialSelectedAttrs={modalProduct.initialSelectedAttrs}
          />
        )}
      </ProductModal>
    </div>
  );
}
