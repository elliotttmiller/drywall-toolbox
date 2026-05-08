/**
 * ToolsetBuilder — DTB Kit Builder
 *
 * Original DTB design. Inspired by GLTT's slot-based model but completely
 * re-imagined with three exclusive UX differentiators GLTT doesn't have:
 *
 *  1. WORKFLOW-INTENT FIRST (Stage 1)
 *     User starts with "What job am I building for?" (Full / Finishing / Taping / Flat Box)
 *     and picks a brand — all on one screen. Not a flat 19-item card list.
 *
 *  2. KIT CANVAS (Stage 2)
 *     A live visual strip at the top of the configurator that shows every slot
 *     as a circular node. Empty slots = dashed ring + icon. Filled slots = product
 *     thumbnail + checkmark. The kit literally assembles itself as you configure.
 *     Clicking any node jumps to that slot instantly.
 *
 *  3. SIDE-BY-SIDE COMPARE (Stage 2)
 *     Check any two products in the slot grid and a comparison panel slides up
 *     from the bottom so you can decide between them — no dropdowns, no guessing.
 *
 * Additional improvements over GLTT:
 *   - Large visual product cards (images, price, SKU) not `<select>` dropdowns
 *   - Per-slot guidance copy explaining what each tool does
 *   - Auto-advance to next unfilled required slot after selection
 *   - "Popular choice" and "Recommended" badges
 *   - Always-included accessories shown throughout, not just at end
 *   - Sticky live total in the Kit Canvas header bar
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ChevronRight, ChevronLeft, ChevronDown,
  ShoppingCart, Package, Wrench, Search, X, Trash2,
  CheckCircle2, Layers, Tag, Truck, AlertCircle,
  SplitSquareHorizontal, Star, Zap, Box,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import Toast from '../components/ui/Toast';
import { getProducts } from '../services/catalog';
import { getProductVariations } from '../services/api';
import { useCart } from '../context/CartContext';
import { fetchVariationsBatched } from '../utils/variationSelection';
import {
  SET_TEMPLATES, SCOPE_LABELS, SCOPE_COLORS,
  BUILDER_BRANDS, getSlotProducts,
} from '../data/toolsetTemplates';

const tapeTechLogo  = 'https://drywalltoolbox.com/logos/tapetech_logo.svg';
const columbiaLogo  = 'https://drywalltoolbox.com/logos/columbia_taping_tools_logo.svg';
const level5Logo    = 'https://drywalltoolbox.com/logos/Level5.svg';
const asgardLogo    = 'https://drywalltoolbox.com/logos/asgard_logo.svg';

import '../styles/toolset-builder.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER =
  'https://drywalltoolbox.com/logos/no-image-placeholder.webp';

const BRAND_LOGOS = {
  'TapeTech':              tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'Level 5':               level5Logo,
  'Asgard':                asgardLogo,
};

// Workflow intent cards (Stage 1, left panel) ─ NOT brand-first like GLTT
const WORKFLOW_TYPES = [
  {
    scope:       'full',
    icon:        Layers,
    label:       'Full Kit',
    tagline:     'Taping + Finishing + Corners',
    description: 'Everything from applying tape through final finishing. The complete automatic taping solution for any crew.',
    color:       '#1e3a8a',
    highlight:   '#dbeafe',
  },
  {
    scope:       'finishing',
    icon:        Box,
    label:       'Finishing Kit',
    tagline:     'Flat Boxes + Angle Heads + Corners',
    description: 'For crews that already tape manually or want a dedicated finishing setup. Flat boxes, angle heads, and corner tools.',
    color:       '#1d4ed8',
    highlight:   '#eff6ff',
  },
  {
    scope:       'taping',
    icon:        Zap,
    label:       'Taping Kit',
    tagline:     'Automatic Taper + Handles',
    description: 'Focus on fast, precise tape application. Taper, angle heads, and the handles to run them efficiently.',
    color:       '#0369a1',
    highlight:   '#e0f2fe',
  },
  {
    scope:       'flatbox',
    icon:        Package,
    label:       'Flat Box Kit',
    tagline:     'Flat Boxes + Handles Only',
    description: 'Upgrade or expand your flat box collection. Ideal when you already own a taper and just need great boxes.',
    color:       '#0891b2',
    highlight:   '#ecfeff',
  },
];

// Stage labels
const STAGES = [
  { id: 1, label: 'Choose Kit' },
  { id: 2, label: 'Build Kit'  },
  { id: 3, label: 'Review & Buy' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const img   = (p) => p?.image || p?.featured_image || p?.images?.[0]?.src || p?.thumbnail || PLACEHOLDER;
const price = (p) => {
  if (!p) return 0;
  // For variation products, use their specific price
  if (p.type === 'variation' && p.price != null) {
    return typeof p.price === 'number' ? p.price : parseFloat(p.price || 0);
  }
  // For variable products, use min_price as fallback
  if (p.is_variable && p.min_price != null) return Number(p.min_price);
  return typeof p.price === 'number' ? p.price : parseFloat(p.price || 0);
};
const fmtPrice = (p) => {
  if (!p) return '';
  const n = price(p);
  return `$${n.toFixed(2)}`;
};

// ─── Stage bar ────────────────────────────────────────────────────────────────

function StageBar({ stage, onBack }) {
  return (
    <div className="tsb-stagebar">
      <div className="tsb-stagebar-inner">
        {STAGES.map((s, i) => {
          const done   = stage > s.id;
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              className={`tsb-stage-btn${active ? ' --active' : ''}${done ? ' --done' : ''}`}
              onClick={() => done && onBack(s.id)}
              aria-current={active ? 'step' : undefined}
            >
              <span className="tsb-stage-dot">
                {done ? <Check size={11} strokeWidth={3} /> : <span>{s.id}</span>}
              </span>
              <span className="tsb-stage-label">{s.label}</span>
              {i < STAGES.length - 1 && <span className="tsb-stage-sep" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stage 1: Unified Brand + Kit Selection ───────────────────────────────────
// Shows brands, then that brand's available kits as category-style cards

function Stage1({ allProducts, loading, onConfigure }) {
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const brandPickerRef = useRef(null);

  // Close dropdown on outside click / tap
  useEffect(() => {
    if (!brandDropdownOpen) return;
    const handleOutside = (e) => {
      if (brandPickerRef.current && !brandPickerRef.current.contains(e.target)) {
        setBrandDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [brandDropdownOpen]);

  // Product counts per brand
  const brandCounts = useMemo(() => {
    const counts = {};
    allProducts.forEach((p) => {
      const b = (p.brand || p.dtb_brand || '').trim();
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [allProducts]);

  // Get available templates for selected brand
  const brandTemplates = useMemo(() => {
    if (!selectedBrand) return [];
    return SET_TEMPLATES.filter((t) => t.brand === selectedBrand);
  }, [selectedBrand]);

  const handleBrandSelect = (brand) => {
    setSelectedBrand(brand);
    setBrandDropdownOpen(false);
  };

  const handleTemplateSelect = (template) => {
    onConfigure(template);
  };

  return (
    <div className="tsb-stage1">
      <div className="tsb-stage1-layout">
        {/* Brand selection */}
        <div className="tsb-panel tsb-panel--brand">
          <div className="tsb-panel-header">
            <span className="tsb-panel-step">Step 1</span>
            <h2>Choose your kit</h2>
            <p>Select a brand to see available toolset configurations.</p>
          </div>
          
          {/* ── Custom animated brand dropdown (mobile) ── */}
          <div className="tsb-brand-custom-picker" ref={brandPickerRef}>
            <button
              type="button"
              className={`tsb-brand-trigger${selectedBrand ? ' --has-value' : ''}`}
              onClick={() => setBrandDropdownOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={brandDropdownOpen}
            >
              <div className="tsb-brand-trigger-inner">
                {selectedBrand && BRAND_LOGOS[selectedBrand] ? (
                  <img
                    src={BRAND_LOGOS[selectedBrand]}
                    alt=""
                    className="tsb-brand-trigger-logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="tsb-brand-trigger-logo-placeholder" />
                )}
                <span className="tsb-brand-trigger-text">
                  {selectedBrand || 'Select a brand'}
                </span>
              </div>
              <ChevronDown size={16} className={`tsb-brand-chevron${brandDropdownOpen ? ' --open' : ''}`} />
            </button>
            
            <div
              className={`tsb-brand-dropdown${brandDropdownOpen ? ' --open' : ''}`}
              role="listbox"
              aria-hidden={!brandDropdownOpen}
            >
              <div className="tsb-brand-dropdown-inner">
                <div className="tsb-brand-dropdown-list">
                  {BUILDER_BRANDS.map((brand) => {
                    const count    = brandCounts[brand] || 0;
                    const isActive = selectedBrand === brand;
                    return (
                      <button
                        key={brand}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`tsb-brand-dropdown-item${isActive ? ' --selected' : ''}`}
                        onClick={() => handleBrandSelect(brand)}
                      >
                        <div className="tsb-brand-dropdown-logo">
                          {BRAND_LOGOS[brand] ? (
                            <img
                              src={BRAND_LOGOS[brand]}
                              alt={brand}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="tsb-brand-dropdown-logo-fallback">{brand[0]}</span>
                          )}
                        </div>
                        <div className="tsb-brand-dropdown-info">
                          <span className="tsb-brand-dropdown-name">{brand}</span>
                          <span className="tsb-brand-dropdown-count">
                            {loading ? 'Loading…' : count > 0 ? `${count} products` : 'Coming soon'}
                          </span>
                        </div>
                        {isActive && <Check size={14} strokeWidth={3} className="tsb-brand-dropdown-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Desktop brand list */}
          <div className="tsb-brand-list">
            {BUILDER_BRANDS.map((brand) => {
              const isActive = selectedBrand === brand;
              const count    = brandCounts[brand] || 0;
              return (
                <button
                  key={brand}
                  className={`tsb-brand-option${isActive ? ' --selected' : ''}`}
                  onClick={() => setSelectedBrand(brand)}
                  disabled={loading && count === 0}
                >
                  <div className="tsb-brand-option-logo">
                    {BRAND_LOGOS[brand] ? (
                      <img
                        src={BRAND_LOGOS[brand]}
                        alt={brand}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="tsb-brand-option-fallback">{brand[0]}</span>
                    )}
                  </div>
                  <div className="tsb-brand-option-info">
                    <span className="tsb-brand-option-name">{brand}</span>
                    <span className="tsb-brand-option-count">
                      {loading ? 'Loading…' : count > 0 ? `${count} products` : 'Coming soon'}
                    </span>
                  </div>
                  <span className="tsb-brand-option-check" aria-hidden="true">
                    {isActive && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kit type cards (category-card style) - shown after brand selection */}
          {selectedBrand && brandTemplates.length > 0 && (
            <div className="tsb-kit-selection">
              <h3 className="tsb-kit-selection-heading">{selectedBrand} Toolsets</h3>
              <div className="categories-grid">
                {brandTemplates.map((template, index) => {
                  // Use a representative image for each kit type
                  const kitImage = template.scope === 'full' 
                    ? 'https://drywalltoolbox.com/products/automatic-taping-tools-placeholder.jpg'
                    : template.scope === 'finishing'
                    ? 'https://drywalltoolbox.com/products/finishing-boxes-placeholder.jpg'
                    : template.scope === 'taping'
                    ? 'https://drywalltoolbox.com/products/taper-placeholder.jpg'
                    : 'https://drywalltoolbox.com/products/flat-box-placeholder.jpg';
                  
                  return (
                    <button
                      key={template.id}
                      className="category-card"
                      style={{ animationDelay: `${(index + 1) * 0.07}s` }}
                      onClick={() => handleTemplateSelect(template)}
                      aria-label={`Configure ${template.name}`}
                    >
                      {/* Background image with dark overlay */}
                      <div className="category-card-bg" style={{ backgroundImage: `url(${kitImage})` }} />
                      <div className="category-card-scrim" />
                      <div className="category-card-content">
                        <div className="category-card-text">
                          <h3 className="category-name">{template.name.replace(/^(TapeTech|Columbia|Level 5|Asgard)\s+(Custom\s+)?/i, '')}</h3>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Slot glyph icon (for empty canvas nodes + slot nav)
function SlotGlyph({ icon, size = 16, dim = false }) {
  const c = dim ? '#cbd5e1' : '#64748b';
  switch (icon) {
    case 'taper':     return <Wrench   size={size} color={c} strokeWidth={1.75} />;
    case 'flatbox':   return <Box      size={size} color={c} strokeWidth={1.75} />;
    case 'cornerbox': return <Layers   size={size} color={c} strokeWidth={1.75} />;
    case 'anglehead': return <Zap      size={size} color={c} strokeWidth={1.75} />;
    case 'handle':    return <Wrench   size={size} color={c} strokeWidth={1.75} style={{ opacity: 0.65 }} />;
    case 'roller':    return <Package  size={size} color={c} strokeWidth={1.75} />;
    default:          return <Package  size={size} color={c} strokeWidth={1.75} />;
  }
}

// ─── Compare drawer ───────────────────────────────────────────────────────────
// Another DTB-exclusive feature. Slides up when user marks 2 products to compare.

function CompareDrawer({ items, onClose, onSelect, activeSlotId, slotSelections }) {
  if (items.length < 2) return null;
  return (
    <div className="tsb-compare-backdrop" onClick={onClose}>
      <div className="tsb-compare-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="tsb-compare-header">
          <div>
            <span className="tsb-compare-eyebrow">Side-by-Side Comparison</span>
            <h3>Comparing {items.length} products</h3>
          </div>
          <button className="tsb-compare-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tsb-compare-grid">
          {items.map((product) => {
            const isSelected = slotSelections[activeSlotId]?.id === product.id;
            return (
              <div key={product.id} className={`tsb-compare-col${isSelected ? ' --selected' : ''}`}>
                <div className="tsb-compare-img">
                  <img src={img(product)} alt={product.name} onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                </div>
                <p className="tsb-compare-name">{product.name}</p>
                {product.sku && <p className="tsb-compare-sku">{product.sku}</p>}
                <p className="tsb-compare-price">{fmtPrice(product)}</p>
                {product.short_description && (
                  <p className="tsb-compare-desc" dangerouslySetInnerHTML={{ __html: product.short_description }} />
                )}
                <button
                  className={`tsb-compare-select-btn${isSelected ? ' --selected' : ''}`}
                  onClick={() => { onSelect(product); onClose(); }}
                >
                  {isSelected ? <><Check size={13} strokeWidth={3} /> Selected</> : <>Select This One</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stage 2: Kit Builder ─────────────────────────────────────────────────────

function Stage2({ template, allProducts, slotSelections, onSlotSelect, onBack, onReview }) {
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [compareItems,  setCompareItems]  = useState([]);
  const [showCompare,   setShowCompare]   = useState(false);
  const [slotVariationMap, setSlotVariationMap] = useState({});

  const activeSlot = template.slots[activeSlotIdx];

  // Products for the active slot
  const slotProducts = useMemo(() => {
    if (!activeSlot) return [];
    return getSlotProducts(allProducts, template.brand, activeSlot.filter);
  }, [allProducts, template.brand, activeSlot]);

  const slotVariableIdsKey = useMemo(
    () => slotProducts
      .filter((p) => p.is_variable && p.id)
      .map((p) => String(p.id))
      .sort()
      .join(','),
    [slotProducts],
  );

  useEffect(() => {
    const variableIds = slotProducts
      .filter((p) => p.is_variable && p.id && !Object.prototype.hasOwnProperty.call(slotVariationMap, p.id))
      .map((p) => p.id);
    if (variableIds.length === 0) return;

    let mounted = true;
    fetchVariationsBatched(variableIds, getProductVariations)
      .then((pairs) => {
        if (!mounted) return;
        const next = {};
        pairs.forEach(([id, vars]) => {
          next[id] = Array.isArray(vars) ? vars : [];
        });
        setSlotVariationMap((prev) => ({ ...prev, ...next }));
      })
      .catch(() => { /* variable parents fall back to parent products */ });

    return () => { mounted = false; };
  }, [slotProducts, slotVariableIdsKey, slotVariationMap]);

  const slotOptions = useMemo(() => {
    if (!activeSlot) return [];

    return slotProducts.flatMap((product) => {
      if (!product?.is_variable || !product?.id) return [product];

      const variations = slotVariationMap[product.id];
      if (!Array.isArray(variations) || variations.length === 0) {
        return [product];
      }

      const matchingVariations = variations.filter((variation) => {
        const name = (variation?.name || '').toLowerCase();
        return !name || activeSlot.filter(name);
      });

      if (matchingVariations.length === 0) {
        return [product];
      }

      return matchingVariations.map((variation) => ({
        ...product,
        ...variation,
        parent_id: variation.parent_id || product.id,
        parent_name: product.name,
      }));
    });
  }, [activeSlot, slotProducts, slotVariationMap]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return slotOptions;
    const q = searchQuery.toLowerCase();
    return slotOptions.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.parent_name || '').toLowerCase().includes(q)
    );
  }, [slotOptions, searchQuery]);

  // Required completion count
  const requiredSlots = template.slots.filter((s) => s.required);
  const filledCount   = requiredSlots.filter((s) => slotSelections[s.id]).length;
  const allFilled     = filledCount === requiredSlots.length;

  const goToSlot = useCallback((idx) => {
    setActiveSlotIdx(idx);
    setSearchQuery('');
    setShowCompare(false);
    setCompareItems([]);
  }, []);

  const handleSelect = useCallback((product) => {
    onSlotSelect(activeSlot.id, product);
    // Auto-advance to next unfilled required slot
    const nextIdx = template.slots.findIndex(
      (s, i) => i > activeSlotIdx && s.required && !slotSelections[s.id]
    );
    if (nextIdx !== -1) {
      setTimeout(() => goToSlot(nextIdx), 280);
    } else if (activeSlotIdx < template.slots.length - 1) {
      setTimeout(() => goToSlot(activeSlotIdx + 1), 280);
    }
  }, [activeSlot, activeSlotIdx, template.slots, slotSelections, onSlotSelect, goToSlot]);

  const toggleCompare = useCallback((product) => {
    setCompareItems((prev) => {
      let nextItems;
      if (prev.find((p) => p.id === product.id)) {
        nextItems = prev.filter((p) => p.id !== product.id);
      } else if (prev.length >= 2) {
        nextItems = [prev[1], product];
      } else {
        nextItems = [...prev, product];
      }
      setShowCompare(nextItems.length === 2);
      return nextItems;
    });
  }, []);

  return (
    <div className="tsb-stage2">

      {/* ── Body: slot nav sidebar + product picker ─────────── */}
      <div className="tsb-builder-body">

        {/* Slot nav sidebar */}
        <div className="tsb-slot-sidebar">
          <div className="tsb-slot-sidebar-inner">
            <p className="tsb-sidebar-heading">Tool Slots</p>
            {template.slots.map((slot, idx) => {
              const product  = slotSelections[slot.id];
              const isActive = idx === activeSlotIdx;
              return (
                <button
                  key={slot.id}
                  className={`tsb-slot-item${isActive ? ' --active' : ''}${product ? ' --done' : ''}`}
                  onClick={() => goToSlot(idx)}
                >
                  <span className="tsb-slot-item-dot">
                    {product
                      ? <Check size={10} strokeWidth={3} />
                      : <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{idx + 1}</span>}
                  </span>
                  <div className="tsb-slot-item-text">
                    <span className="tsb-slot-item-label">{slot.label}</span>
                    {product
                      ? <span className="tsb-slot-item-chosen">{product.name}</span>
                      : <span className="tsb-slot-item-status">{slot.required ? 'Required' : 'Optional'}</span>}
                  </div>
                </button>
              );
            })}

            {/* Always-included accessories */}
            {template.alwaysIncluded.length > 0 && (
              <div className="tsb-sidebar-included">
                <p className="tsb-sidebar-heading" style={{ marginTop: '1.25rem' }}>
                  Always Included <span style={{ color: '#16a34a', fontWeight: 700 }}>· FREE</span>
                </p>
                {template.alwaysIncluded.map((item) => (
                  <div key={item} className="tsb-included-row">
                    <Check size={10} strokeWidth={3} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product picker */}
        <div className="tsb-picker">

          {/* Selected product banner */}
          {slotSelections[activeSlot?.id] && (
            <div className="tsb-selected-banner">
              <Check size={13} color="#15803d" strokeWidth={3} style={{ flexShrink: 0 }} />
              <span className="tsb-selected-banner-name">{slotSelections[activeSlot.id].name}</span>
              <span className="tsb-selected-banner-price">{fmtPrice(slotSelections[activeSlot.id])}</span>
              <button className="tsb-selected-clear" onClick={() => onSlotSelect(activeSlot.id, null)}><X size={12} /></button>
            </div>
          )}

          {/* Compare strip */}
          {compareItems.length > 0 && (
            <div className="tsb-compare-strip">
              <SplitSquareHorizontal size={13} color="#7c3aed" style={{ flexShrink: 0 }} />
              <span>{compareItems.length === 1 ? 'Select 1 more to compare' : 'Ready to compare!'}</span>
              {compareItems.length === 2 && (
                <button className="tsb-compare-launch" onClick={() => setShowCompare(true)}>
                  Compare Now <ChevronRight size={11} />
                </button>
              )}
              <button className="tsb-compare-strip-clear" onClick={() => { setShowCompare(false); setCompareItems([]); }}><X size={11} /></button>
            </div>
          )}

          {/* Search */}
          <div className="tsb-search-row">
            <div className="tsb-search-box">
              <Search size={13} className="tsb-search-ico" />
              <input
                type="text"
                className="tsb-search"
                placeholder={`Search ${activeSlot?.label || 'tools'}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && <button className="tsb-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
            </div>
            {filteredProducts.length > 0 && (
              <span className="tsb-product-count">{filteredProducts.length} option{filteredProducts.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Product cards */}
          {filteredProducts.length === 0 ? (
            <div className="tsb-empty">
              {searchQuery
                ? <><AlertCircle size={18} style={{ opacity: 0.4, marginBottom: '8px' }} /><p>No results for "<strong>{searchQuery}</strong>"</p><button className="tsb-empty-reset" onClick={() => setSearchQuery('')}>Clear search</button></>
                : <><Package size={18} style={{ opacity: 0.3, marginBottom: '8px' }} /><p>No {template.brand} products found for this slot yet.<br /><span style={{ fontSize: '0.75rem', opacity: 0.65 }}>Check back after catalog sync.</span></p></>
              }
            </div>
          ) : (
            <div className="tsb-product-grid">
              {filteredProducts.map((product, idx) => {
                const isSelected = slotSelections[activeSlot.id]?.id === product.id;
                const isComparing = compareItems.some((p) => p.id === product.id);
                return (
                  <div
                    key={product.id}
                    className={`tsb-product-card${isSelected ? ' --selected' : ''}${isComparing ? ' --comparing' : ''}`}
                    style={{ animationDelay: `${Math.min(idx, 10) * 0.04}s` }}
                  >
                    {/* Image */}
                    <div className="tsb-product-img" onClick={() => handleSelect(product)}>
                      <img
                        src={img(product)}
                        alt={product.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                      />
                      {isSelected && (
                        <div className="tsb-product-selected-badge">
                          <Check size={14} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="tsb-product-info">
                      {product.type === 'variation' && product.variation_attribute?.option && (
                        <p className="tsb-product-variant-chip">
                          {product.variation_attribute.name || 'Option'}: {product.variation_attribute.option}
                        </p>
                      )}
                      <p className="tsb-product-name">{product.name}</p>
                      {product.parent_name && product.parent_name !== product.name && (
                        <p className="tsb-product-parent">{product.parent_name}</p>
                      )}
                      {product.sku && <p className="tsb-product-sku">{product.sku}</p>}

                      <div className="tsb-product-row">
                        <span className="tsb-product-price">{fmtPrice(product)}</span>
                        <div className="tsb-product-actions">
                          {/* Compare toggle */}
                          <button
                            className={`tsb-compare-toggle${isComparing ? ' --on' : ''}`}
                            onClick={() => toggleCompare(product)}
                            title={isComparing ? 'Remove from compare' : 'Add to compare'}
                          >
                            <SplitSquareHorizontal size={11} />
                          </button>
                          {/* Select */}
                          <button
                            className={`tsb-select-btn${isSelected ? ' --selected' : ''}`}
                            onClick={() => handleSelect(product)}
                          >
                            {isSelected ? <><Check size={11} strokeWidth={3} /> Selected</> : <>Select</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer nav */}
          <div className="tsb-picker-footer">
            <button className="tsb-back-btn" onClick={onBack}><ChevronLeft size={13} /> Change Kit</button>
            <button className="tsb-review-cta-btn" disabled={!allFilled} onClick={onReview}>
              Review Kit {allFilled && `(${Object.keys(slotSelections).length})`}
            </button>
            {activeSlotIdx < template.slots.length - 1 ? (
              <button className="tsb-next-slot-btn" onClick={() => goToSlot(activeSlotIdx + 1)}>
                Next Slot <ChevronRight size={13} />
              </button>
            ) : (
              <div style={{ width: '100px' }} />
            )}
          </div>
        </div>
      </div>

      {/* Compare drawer */}
      {showCompare && (
        <CompareDrawer
          items={compareItems}
          activeSlotId={activeSlot?.id}
          slotSelections={slotSelections}
          onSelect={handleSelect}
          onClose={() => { setShowCompare(false); setCompareItems([]); }}
        />
      )}
    </div>
  );
}

// ─── Stage 3: Review & Cart ───────────────────────────────────────────────────

function Stage3({ template, slotSelections, onRemove, onBack, onAddToCart, success, onStartOver }) {
  const selectedItems = useMemo(
    () => template.slots.map((s) => ({ slot: s, product: slotSelections[s.id] || null })).filter((i) => i.product),
    [template, slotSelections]
  );
  const totalCost = selectedItems.reduce((sum, { product: p }) => sum + price(p), 0);

  if (success) {
    return (
      <div className="tsb-success-screen">
        <div className="tsb-success-gfx"><CheckCircle2 size={38} color="#fff" /></div>
        <h2>Kit Added to Cart!</h2>
        <p>{selectedItems.length} tool{selectedItems.length !== 1 ? 's' : ''} from your <strong>{template.name}</strong> are in your cart.</p>
        <div className="tsb-success-btns">
          <Link to="/cart" className="tsb-success-primary"><ShoppingCart size={15} /> Go to Cart</Link>
          <button className="tsb-success-secondary" onClick={onStartOver}><Layers size={14} /> Build Another Kit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tsb-stage3">

      {/* Configured tools mosaic */}
      <h3 className="tsb-review-section-title">Configured Tools</h3>
      <div className="tsb-review-mosaic">
        {template.slots.map((slot) => {
          const product = slotSelections[slot.id];
          return (
            <div key={slot.id} className={`tsb-review-tile${!product ? ' --empty' : ''}`}>
              {product ? (
                <>
                  <div className="tsb-review-tile-img">
                    <img src={img(product)} alt={product.name} loading="lazy"
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                  </div>
                  <div className="tsb-review-tile-body">
                    <span className="tsb-review-tile-slot">{slot.label}</span>
                    <p className="tsb-review-tile-name">{product.name}</p>
                    {product.sku && <p className="tsb-review-tile-sku">{product.sku}</p>}
                  </div>
                  <div className="tsb-review-tile-price-wrap">
                    <p className="tsb-review-tile-price">{fmtPrice(product)}</p>
                  </div>
                  <button className="tsb-review-tile-remove" onClick={() => onRemove(slot.id)}
                    aria-label={`Remove ${slot.label}`}>
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </>
              ) : (
                <>
                  <div className="tsb-review-tile-img --empty"><AlertCircle size={18} style={{ color: '#cbd5e1' }} /></div>
                  <div className="tsb-review-tile-body">
                    <span className="tsb-review-tile-slot">{slot.label}</span>
                    <p className="tsb-review-tile-name" style={{ color: '#94a3b8' }}>
                      {slot.required ? 'Not selected' : 'Optional — skipped'}
                    </p>
                  </div>
                  {slot.required && <button className="tsb-review-fix-btn" onClick={onBack}>Select</button>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Always-included accessories */}
      {template.alwaysIncluded.length > 0 && (
        <>
          <h3 className="tsb-review-section-title" style={{ marginTop: '2rem' }}>
            Always Included &nbsp;<span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.78rem' }}>— FREE with this kit</span>
          </h3>
          <div className="tsb-review-included">
            {template.alwaysIncluded.map((item) => (
              <div key={item} className="tsb-review-included-chip">
                <div className="tsb-review-chip-icon"><Check size={12} color="#16a34a" strokeWidth={3} /></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer CTA */}
      <div className="tsb-stage3-footer">
        <div className="tsb-stage3-total">
          <div>
            <div className="tsb-total-lbl">Estimated Total</div>
            <div className="tsb-total-sub">{selectedItems.length} configured item{selectedItems.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="tsb-total-amt">${totalCost.toFixed(2)}</div>
        </div>
        <div className="tsb-stage3-ctas">
          <button className="tsb-back-btn" onClick={onBack}><ChevronLeft size={13} /> Edit Kit</button>
          <button
            className="tsb-add-cart-btn"
            disabled={selectedItems.length === 0}
            onClick={onAddToCart}
          >
            <ShoppingCart size={16} /> Add Complete Kit to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ToolsetBuilder() {
  const { addToCart }                         = useCart();
  const [stage, setStage]                     = useState(1);
  const [template, setTemplate]               = useState(null);
  const [slotSelections, setSlotSelections]   = useState({});
  const [allProducts, setAllProducts]         = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [toast, setToast]                     = useState(null);
  const [success, setSuccess]                 = useState(false);

  // Load catalog
  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((products) => { if (!cancelled) { setAllProducts(products); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleConfigure = useCallback((tpl) => {
    setTemplate(tpl); setSlotSelections({}); setStage(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSlotSelect = useCallback((slotId, product) => {
    setSlotSelections((prev) => {
      if (!product) { const n = { ...prev }; delete n[slotId]; return n; }
      return { ...prev, [slotId]: product };
    });
  }, []);

  const handleSlotRemove = useCallback((slotId) => {
    setSlotSelections((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!template) return;
    template.slots.map((s) => slotSelections[s.id]).filter(Boolean).forEach((p) => addToCart(p, 1));
    setSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [template, slotSelections, addToCart]);

  const handleStartOver = useCallback(() => {
    setStage(1); setTemplate(null); setSlotSelections({}); setSuccess(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = useCallback((targetStage) => {
    setStage(targetStage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <>
      <SEOHead
        title="Kit Builder — Build Your Custom Drywall Toolset | Drywall Toolbox"
        description="Build your perfect drywall toolset step by step. Choose your workflow, configure every tool slot with real photos and prices, compare options side-by-side, and add your complete kit to cart."
        canonical="https://drywalltoolbox.com/toolset-builder"
      />

      <div className="tsb-page">

        {/* Hero - only show on Stage 1 */}
        {stage === 1 && (
          <div className="tsb-hero">
            <div className="tsb-hero-content">
              <span className="tsb-hero-eyebrow"><Wrench size={10} /> Kit Builder</span>
              <h1>Build Your Drywall Kit</h1>
              <p>Configure every tool by slot with real images and prices. Compare options side-by-side. Add your complete kit to cart in one click.</p>
            </div>
          </div>
        )}

        {/* Stage Bar - always visible */}
        <StageBar stage={stage} onBack={handleBack} />

        {/* Kit summary bar - show below StageBar in stages 2 & 3 */}
        {stage >= 2 && template && (
          <div className="tsb-kit-bar">
            <div className="tsb-kit-bar-left">
              {BRAND_LOGOS[template.brand] && (
                <img src={BRAND_LOGOS[template.brand]} alt={template.brand} className="tsb-kit-bar-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <div>
                <p className="tsb-kit-bar-name">{template.name}</p>
                <p className="tsb-kit-bar-progress">
                  {stage === 2 
                    ? `${template.slots.filter((s) => s.required && slotSelections[s.id]).length}/${template.slots.filter((s) => s.required).length} required slots filled`
                    : `${Object.keys(slotSelections).length} tool${Object.keys(slotSelections).length !== 1 ? 's' : ''} configured`}
                </p>
              </div>
            </div>
            <div className="tsb-kit-bar-right">
              {stage === 2 && (
                <>
                  <div className="tsb-live-total">
                    <span className="tsb-live-total-label">Running Total</span>
                    <span className="tsb-live-total-val">
                      ${Object.values(slotSelections).reduce((sum, p) => sum + price(p), 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    className="tsb-review-btn"
                    disabled={template.slots.filter((s) => s.required).some((s) => !slotSelections[s.id])}
                    onClick={() => { setStage(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    <ShoppingCart size={14} /> Review Kit
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="tsb-body">
          {stage === 1 && (
            <Stage1 allProducts={allProducts} loading={loading} onConfigure={handleConfigure} />
          )}
          {stage === 2 && template && (
            <Stage2
              template={template}
              allProducts={allProducts}
              slotSelections={slotSelections}
              onSlotSelect={handleSlotSelect}
              onBack={() => handleBack(1)}
              onReview={() => { setStage(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
          {stage === 3 && template && (
            <Stage3
              template={template}
              slotSelections={slotSelections}
              onRemove={handleSlotRemove}
              onBack={() => handleBack(2)}
              onAddToCart={handleAddToCart}
              success={success}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
