/**
 * ToolsetBuilder — Build Your Own Toolset
 *
 * Multi-step workflow:
 *   1. Choose a Brand
 *   2. Pick Tools (category-filtered product grid)
 *   3. Review & Add All to Cart
 *
 * Inspired by greatlakestapingtools.com/tools/build-your-own-set,
 * fully redesigned with the DTB Machined Precision design system.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  Package,
  Wrench,
  Search,
  X,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Layers,
  BookmarkPlus,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import Toast from '../components/Toast';
import { getProducts } from '../services/catalog';
import { useCart } from '../context/CartContext';

import tapeTechLogo  from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo  from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo    from '/brands/SurPro/surpro_logo.svg';
import asgardLogo    from '/brands/Asgard/asgard_logo.svg';
import gracoLogo     from '/brands/Graco/graco_logo.svg';
import platinumLogo  from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';
import level5Logo    from '/brands/Level5/Level5.svg';

import '../styles/toolset-builder.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_IMG = 'https://www.drywalltoolbox.com/wp/wp-content/uploads/2026/05/no-image-placeholder.webp';

const STEPS = [
  { id: 1, label: 'Choose Brand' },
  { id: 2, label: 'Pick Tools'   },
  { id: 3, label: 'Review & Buy' },
];

const BRANDS = [
  { name: 'TapeTech',              logo: tapeTechLogo,    slug: 'tapetech'               },
  { name: 'Columbia Taping Tools', logo: columbiaLogo,    slug: 'columbia-taping-tools'  },
  { name: 'Level 5',               logo: level5Logo,      slug: 'level5'                 },
  { name: 'SurPro',                logo: surproLogo,      slug: 'surpro'                 },
  { name: 'Asgard',                logo: asgardLogo,      slug: 'asgard'                 },
  { name: 'Graco',                 logo: gracoLogo,       slug: 'graco'                  },
  { name: 'Platinum Drywall Tools',logo: platinumLogo,    slug: 'platinum'               },
  { name: 'Dura-Stilts',           logo: duraStiltsLogo,  slug: 'dura-stilts'            },
];

// Category order + friendly names
const CATEGORY_ORDER = [
  'taping',
  'finishing',
  'corner',
  'mudboxes',
  'sanding',
  'other',
];

const CATEGORY_LABELS = {
  taping:    'Automatic Taping',
  finishing: 'Finishing Tools',
  corner:    'Corner Tools',
  mudboxes:  'Mud Boxes & Pumps',
  sanding:   'Sanding',
  other:     'Other',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function displayPrice(product) {
  if (!product) return '';
  if (product.is_variable && product.min_price != null) {
    return `From $${Number(product.min_price).toFixed(2)}`;
  }
  const p = typeof product.price === 'number'
    ? product.price
    : parseFloat(product.price || 0);
  return `$${p.toFixed(2)}`;
}

function numericPrice(product) {
  if (!product) return 0;
  if (product.is_variable && product.min_price != null) return Number(product.min_price);
  return typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
}

function resolveImage(product) {
  return (
    product?.image ||
    product?.featured_image ||
    product?.images?.[0]?.src ||
    product?.thumbnail ||
    PLACEHOLDER_IMG
  );
}

function normCategory(product) {
  // Map product categories to our canonical keys
  const cats = (product.categories || []).map((c) => {
    if (typeof c === 'string') return c.toLowerCase();
    return (c.name || c.slug || '').toLowerCase();
  });
  const name = (product.name || '').toLowerCase();
  const cat  = (product.category || '').toLowerCase();

  if (cats.some(c => /taping|tape/i.test(c)) || /taping|tape/i.test(cat)) return 'taping';
  if (cats.some(c => /finish/i.test(c)) || /finish/i.test(cat)) return 'finishing';
  if (cats.some(c => /corner/i.test(c)) || /corner/i.test(cat)) return 'corner';
  if (cats.some(c => /mud|pump/i.test(c)) || /mud|pump/i.test(cat)) return 'mudboxes';
  if (cats.some(c => /sand/i.test(c)) || /sand/i.test(cat)) return 'sanding';

  // Fall back to name heuristics
  if (/taping|auto tape/i.test(name)) return 'taping';
  if (/finish/i.test(name)) return 'finishing';
  if (/corner/i.test(name)) return 'corner';
  if (/mud|pump/i.test(name)) return 'mudboxes';
  if (/sand/i.test(name)) return 'sanding';

  return 'other';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="tsb-stepper" role="navigation" aria-label="Build steps">
      <div className="tsb-stepper-inner">
        {STEPS.map((step) => {
          const done   = currentStep > step.id;
          const active = currentStep === step.id;
          return (
            <button
              key={step.id}
              className={[
                'tsb-step',
                active ? 'tsb-step--active' : '',
                done   ? 'tsb-step--done'   : '',
              ].filter(Boolean).join(' ')}
              onClick={() => done && onStepClick(step.id)}
              aria-current={active ? 'step' : undefined}
              title={done ? `Go back to step ${step.id}` : step.label}
              style={{ cursor: done ? 'pointer' : active ? 'default' : 'not-allowed' }}
            >
              <span className="tsb-step-num" aria-hidden="true">
                {done ? <Check size={12} strokeWidth={3} /> : step.id}
              </span>
              <span className="tsb-step-label">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrandCard({ brand, selected, onClick }) {
  return (
    <button
      type="button"
      className={`tsb-brand-card${selected ? ' tsb-brand-card--selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="tsb-brand-check" aria-hidden="true">
        <Check size={11} strokeWidth={3} color="#fff" />
      </span>
      <div className="tsb-brand-logo-wrap">
        <img
          src={brand.logo}
          alt={brand.name}
          className="tsb-brand-logo"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
      <span className="tsb-brand-name">{brand.name}</span>
    </button>
  );
}

function QtyControl({ qty, onInc, onDec, small = false }) {
  if (small) {
    return (
      <div className="tsb-summary-item-qty">
        <button className="tsb-summary-qty-btn" onClick={onDec} aria-label="Decrease quantity">−</button>
        <span className="tsb-summary-qty-val">{qty}</span>
        <button className="tsb-summary-qty-btn" onClick={onInc} aria-label="Increase quantity">+</button>
      </div>
    );
  }
  return (
    <div className="tsb-qty-stepper">
      <button className="tsb-qty-btn" onClick={onDec} aria-label="Decrease">−</button>
      <span className="tsb-qty-val">{qty}</span>
      <button className="tsb-qty-btn" onClick={onInc} aria-label="Increase">+</button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ToolsetBuilder() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // ── State ────────────────────────────────────────────────────────────────────
  const [step,         setStep]         = useState(1);
  const [selectedBrand,setSelectedBrand] = useState(null);   // brand name string
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  // selections: { [productId]: { product, qty } }
  const [selections,   setSelections]   = useState({});
  const [allProducts,  setAllProducts]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState(null);
  const [showSuccess,  setShowSuccess]  = useState(false);
  const searchInputRef = useRef(null);

  // ── Load catalog ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProducts()
      .then((products) => {
        if (!cancelled) {
          setAllProducts(products.filter((p) => p.type !== 'variation'));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Derived brand products ───────────────────────────────────────────────────
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return allProducts.filter((p) => {
      const brand = (p.brand || p.dtb_brand || '').trim();
      return brand === selectedBrand;
    });
  }, [allProducts, selectedBrand]);

  // ── Categories available for selected brand ──────────────────────────────────
  const availableCategories = useMemo(() => {
    const set = new Set(brandProducts.map(normCategory));
    return CATEGORY_ORDER.filter((c) => set.has(c));
  }, [brandProducts]);

  // ── Filtered products (by category + search) ─────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = brandProducts;
    if (activeCategory !== 'all') {
      list = list.filter((p) => normCategory(p) === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name         || '').toLowerCase().includes(q) ||
          (p.sku          || '').toLowerCase().includes(q) ||
          (p.part_number  || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [brandProducts, activeCategory, searchQuery]);

  // ── Summary items ────────────────────────────────────────────────────────────
  const summaryItems = useMemo(
    () => Object.values(selections).filter((s) => s.qty > 0),
    [selections]
  );

  const totalItems = summaryItems.reduce((sum, s) => sum + s.qty, 0);

  const totalPrice = summaryItems.reduce(
    (sum, s) => sum + numericPrice(s.product) * s.qty,
    0
  );

  // ── Callbacks ────────────────────────────────────────────────────────────────
  const toggleProduct = useCallback((product) => {
    setSelections((prev) => {
      const id = String(product.id);
      if (prev[id]) {
        // Already selected — remove
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { product, qty: 1 } };
    });
  }, []);

  const setQty = useCallback((productId, qty) => {
    const id = String(productId);
    if (qty <= 0) {
      setSelections((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelections((prev) => ({
        ...prev,
        [id]: { ...prev[id], qty },
      }));
    }
  }, []);

  const incQty = useCallback((productId) => {
    setSelections((prev) => {
      const id = String(productId);
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], qty: prev[id].qty + 1 } };
    });
  }, []);

  const decQty = useCallback((productId) => {
    setSelections((prev) => {
      const id = String(productId);
      if (!prev[id]) return prev;
      const next = prev[id].qty - 1;
      if (next <= 0) {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      }
      return { ...prev, [id]: { ...prev[id], qty: next } };
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[String(productId)];
      return next;
    });
  }, []);

  const handleAddAllToCart = useCallback(() => {
    if (summaryItems.length === 0) return;
    summaryItems.forEach(({ product, qty }) => {
      addToCart(product, qty);
    });
    setShowSuccess(true);
  }, [summaryItems, addToCart]);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setSelectedBrand(null);
    setSelections({});
    setSearchQuery('');
    setActiveCategory('all');
    setShowSuccess(false);
  }, []);

  const handleSelectBrand = useCallback((brandName) => {
    if (selectedBrand === brandName) {
      setSelectedBrand(null);
    } else {
      setSelectedBrand(brandName);
      setActiveCategory('all');
      setSearchQuery('');
    }
  }, [selectedBrand]);

  const handleNextStep = useCallback(() => {
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePrevStep = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStepClick = useCallback((stepId) => {
    if (stepId < step) {
      setStep(stepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // Reset active category when brand changes
  useEffect(() => {
    setActiveCategory('all');
  }, [selectedBrand]);

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderSummaryPanel() {
    return (
      <div className="tsb-summary-card">
        <div className="tsb-summary-header">
          <h3>Your Toolset</h3>
          <p>{totalItems === 0 ? 'No tools selected yet' : `${totalItems} tool${totalItems !== 1 ? 's' : ''} selected`}</p>
        </div>

        {summaryItems.length === 0 ? (
          <div className="tsb-summary-empty">
            <Package size={22} style={{ marginBottom: '6px', opacity: 0.35 }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              Select tools from the grid to build your set.
            </p>
          </div>
        ) : (
          <div className="tsb-summary-items">
            {summaryItems.map(({ product, qty }) => (
              <div key={product.id} className="tsb-summary-item">
                <div className="tsb-summary-item-img">
                  <img
                    src={resolveImage(product)}
                    alt={product.name}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                  />
                </div>
                <div className="tsb-summary-item-info">
                  <p className="tsb-summary-item-name">{product.name}</p>
                  <p className="tsb-summary-item-price">
                    {displayPrice(product)}
                    {qty > 1 && (
                      <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.68rem' }}>
                        {' '}× {qty}
                      </span>
                    )}
                  </p>
                </div>
                <QtyControl
                  qty={qty}
                  onInc={() => incQty(product.id)}
                  onDec={() => decQty(product.id)}
                  small
                />
                <button
                  className="tsb-summary-remove"
                  onClick={() => removeItem(product.id)}
                  aria-label={`Remove ${product.name}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="tsb-summary-footer">
          <div className="tsb-total-row">
            <div>
              <div className="tsb-total-label">Estimated Total</div>
              <div className="tsb-total-items">{totalItems} item{totalItems !== 1 ? 's' : ''}</div>
            </div>
            <div className="tsb-total-price">${totalPrice.toFixed(2)}</div>
          </div>

          {step < 3 ? (
            <button
              className="tsb-nav-next"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={summaryItems.length === 0}
              onClick={handleNextStep}
            >
              Review Toolset <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="tsb-add-all-btn"
              disabled={summaryItems.length === 0}
              onClick={handleAddAllToCart}
            >
              <ShoppingCart size={16} />
              Add All to Cart
            </button>
          )}

          {summaryItems.length > 0 && (
            <button className="tsb-save-btn" onClick={() => setToast({ message: 'Toolset saved! (Coming soon)', type: 'info' })}>
              <BookmarkPlus size={14} />
              Save Toolset
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Step 1: Choose Brand ─────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="tsb-section" style={{ animationDelay: '0.05s' }}>
        <div className="tsb-section-header">
          <div>
            <h2 className="tsb-section-title">Choose Your Brand</h2>
            <p className="tsb-section-sub">Select the brand you want to build a toolset from</p>
          </div>
        </div>
        <div className="tsb-section-body">
          <div className="tsb-brand-grid">
            {BRANDS.map((brand, idx) => {
              const count = allProducts.filter((p) => {
                const b = (p.brand || p.dtb_brand || '').trim();
                return b === brand.name;
              }).length;
              if (count === 0 && !loading) return null;
              return (
                <BrandCard
                  key={brand.name}
                  brand={brand}
                  selected={selectedBrand === brand.name}
                  onClick={() => handleSelectBrand(brand.name)}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                />
              );
            })}
          </div>
        </div>

        <div className="tsb-nav-bar">
          <div />
          <button
            className="tsb-nav-next"
            disabled={!selectedBrand}
            onClick={handleNextStep}
          >
            Pick Tools <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Pick Tools ────────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div className="tsb-section" style={{ animationDelay: '0.05s' }}>
        <div className="tsb-section-header">
          <div>
            <h2 className="tsb-section-title">
              {selectedBrand ? `${selectedBrand} Tools` : 'Pick Your Tools'}
            </h2>
            <p className="tsb-section-sub">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} · click a tool to add it to your set
            </p>
          </div>
          {selectedBrand && (
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
              }}
              onClick={() => setStep(1)}
            >
              Change brand
            </button>
          )}
        </div>

        {/* Category tabs */}
        {availableCategories.length > 1 && (
          <div className="tsb-category-tabs" role="tablist">
            <button
              className={`tsb-cat-tab${activeCategory === 'all' ? ' tsb-cat-tab--active' : ''}`}
              onClick={() => setActiveCategory('all')}
              role="tab"
              aria-selected={activeCategory === 'all'}
            >
              All
              <span className="tsb-cat-badge">{brandProducts.length}</span>
            </button>
            {availableCategories.map((cat) => {
              const count = brandProducts.filter((p) => normCategory(p) === cat).length;
              return (
                <button
                  key={cat}
                  className={`tsb-cat-tab${activeCategory === cat ? ' tsb-cat-tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                  role="tab"
                  aria-selected={activeCategory === cat}
                >
                  {CATEGORY_LABELS[cat] || cat}
                  <span className="tsb-cat-badge">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="tsb-search-wrap">
          <Search size={13} className="tsb-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="tsb-search-input"
            placeholder={`Search ${selectedBrand || ''} tools…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 'calc(1.75rem + 10px)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                padding: '4px',
                marginTop: '2px',
              }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="tsb-product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid rgba(15,23,42,0.08)' }}>
                <div className="tsb-skeleton" style={{ height: '140px' }} />
                <div style={{ padding: '0.75rem' }}>
                  <div className="tsb-skeleton" style={{ height: '12px', marginBottom: '6px', width: '80%' }} />
                  <div className="tsb-skeleton" style={{ height: '10px', width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="tsb-no-products">
            {searchQuery ? (
              <>No results for "<strong>{searchQuery}</strong>" — <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => setSearchQuery('')}>clear search</button></>
            ) : (
              'No products found in this category.'
            )}
          </div>
        ) : (
          <div className="tsb-product-grid">
            {filteredProducts.map((product, idx) => {
              const id       = String(product.id);
              const selected = Boolean(selections[id]);
              const qty      = selections[id]?.qty || 0;
              return (
                <div
                  key={id}
                  className={`tsb-product-card${selected ? ' tsb-product-card--selected' : ''}`}
                  style={{ animationDelay: `${Math.min(idx, 12) * 0.04}s` }}
                >
                  {/* Image */}
                  <div
                    className="tsb-product-card-img"
                    onClick={() => toggleProduct(product)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src={resolveImage(product)}
                      alt={product.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    />
                    <div className="tsb-product-select-overlay">
                      <div className="tsb-product-check-badge">
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="tsb-product-card-body">
                    <p className="tsb-product-card-name">{product.name}</p>
                    {product.sku && (
                      <p className="tsb-product-card-sku">{product.sku}</p>
                    )}

                    <div className="tsb-product-card-footer">
                      <span className="tsb-product-card-price">{displayPrice(product)}</span>

                      {selected ? (
                        <QtyControl
                          qty={qty}
                          onInc={(e) => { e?.stopPropagation?.(); incQty(product.id); }}
                          onDec={(e) => { e?.stopPropagation?.(); decQty(product.id); }}
                        />
                      ) : (
                        <button
                          className="tsb-add-btn"
                          onClick={() => toggleProduct(product)}
                          aria-label={`Add ${product.name} to toolset`}
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="tsb-nav-bar">
          <button className="tsb-nav-back" onClick={handlePrevStep}>
            <ChevronLeft size={14} /> Brand
          </button>
          <button
            className="tsb-nav-next"
            disabled={summaryItems.length === 0}
            onClick={handleNextStep}
          >
            Review {summaryItems.length > 0 && `(${totalItems})`} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Review & Buy ──────────────────────────────────────────────────────
  function renderStep3() {
    if (showSuccess) {
      return (
        <div className="tsb-section">
          <div className="tsb-success">
            <div className="tsb-success-icon">
              <CheckCircle2 size={36} color="#fff" />
            </div>
            <h2>Added to Cart!</h2>
            <p>
              {totalItems} tool{totalItems !== 1 ? 's' : ''} have been added to your cart.
              Ready to check out or keep building.
            </p>
            <div className="tsb-success-actions">
              <Link to="/cart" className="tsb-success-btn-primary">
                <ShoppingCart size={15} /> View Cart
              </Link>
              <button className="tsb-success-btn-secondary" onClick={handleStartOver}>
                <Layers size={15} /> Build Another Set
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="tsb-section" style={{ animationDelay: '0.05s' }}>
        <div className="tsb-section-header">
          <div>
            <h2 className="tsb-section-title">Review Your Toolset</h2>
            <p className="tsb-section-sub">
              {totalItems} item{totalItems !== 1 ? 's' : ''} · ${totalPrice.toFixed(2)} estimated total
            </p>
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#2563eb',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            onClick={() => setStep(2)}
          >
            ← Edit Tools
          </button>
        </div>

        <div className="tsb-section-body">
          {summaryItems.length === 0 ? (
            <div className="tsb-empty">
              <div className="tsb-empty-icon">
                <Package size={24} style={{ color: '#94a3b8' }} />
              </div>
              <p className="tsb-empty-title">No tools selected</p>
              <p className="tsb-empty-sub">Go back to pick tools for your set.</p>
              <button
                className="tsb-nav-next"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setStep(2)}
              >
                Pick Tools <ChevronRight size={15} />
              </button>
            </div>
          ) : (
            <div className="tsb-review-grid">
              {summaryItems.map(({ product, qty }) => (
                <div key={product.id} className="tsb-review-item">
                  <div className="tsb-review-item-img">
                    <img
                      src={resolveImage(product)}
                      alt={product.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    />
                  </div>
                  <div className="tsb-review-item-info">
                    <p className="tsb-review-item-name">{product.name}</p>
                    {product.sku && (
                      <p className="tsb-review-item-sku">{product.sku}</p>
                    )}
                    <p className="tsb-review-item-price">{displayPrice(product)}</p>
                    <div className="tsb-review-qty-row">
                      <span className="tsb-review-qty-label">Qty:</span>
                      <QtyControl
                        qty={qty}
                        onInc={() => incQty(product.id)}
                        onDec={() => decQty(product.id)}
                      />
                      <button
                        className="tsb-review-remove"
                        onClick={() => removeItem(product.id)}
                        aria-label={`Remove ${product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tsb-nav-bar">
          <button className="tsb-nav-back" onClick={handlePrevStep}>
            <ChevronLeft size={14} /> Edit Tools
          </button>
          <button
            className="tsb-nav-next"
            style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)' }}
            disabled={summaryItems.length === 0}
            onClick={handleAddAllToCart}
          >
            <ShoppingCart size={15} />
            Add All to Cart
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <>
      <SEOHead
        title="Toolset Builder — Build Your Own Drywall Toolset | Drywall Toolbox"
        description="Customize and build your perfect drywall toolset. Pick your brand, select tools by category, review your set, and add everything to cart in one click."
        canonical="https://drywalltoolbox.com/toolset-builder"
      />

      <div className="tsb-page">
        {/* Hero */}
        <div className="tsb-hero">
          <div className="tsb-hero-inner">
            <span className="tsb-hero-eyebrow">
              <Wrench size={10} />
              Toolset Builder
            </span>
            <h1>Build Your Perfect Toolset</h1>
            <p className="tsb-hero-subtitle">
              Choose a brand, browse the full product lineup, and assemble your custom toolset — then add everything to cart in a single click.
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={step} onStepClick={handleStepClick} />

        {/* Two-column layout */}
        <div className="tsb-layout">
          {/* Main content */}
          <div>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          {/* Sticky sidebar summary */}
          <div className="tsb-sidebar">
            {renderSummaryPanel()}
          </div>
        </div>

        {/* Mobile sticky summary bar */}
        <div className="tsb-mobile-summary-toggle">
          <div className="tsb-mobile-summary-info">
            <div className="tsb-mobile-summary-count">
              {totalItems === 0 ? 'No tools selected' : `${totalItems} tool${totalItems !== 1 ? 's' : ''}`}
            </div>
            <div className="tsb-mobile-summary-total">${totalPrice.toFixed(2)}</div>
          </div>
          {step < 3 ? (
            <button
              className="tsb-nav-next"
              disabled={summaryItems.length === 0}
              onClick={handleNextStep}
              style={{ flexShrink: 0 }}
            >
              {step === 1 ? 'Pick Tools' : 'Review'} <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="tsb-add-all-btn"
              disabled={summaryItems.length === 0}
              onClick={handleAddAllToCart}
              style={{ width: 'auto', flexShrink: 0 }}
            >
              <ShoppingCart size={15} /> Add All
            </button>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
