/**
 * ToolsetBuilder — Build Your Own Drywall Toolset
 *
 * Three-stage workflow modeled on Great Lakes Taping Tools'
 * "Build Your Own Set" but completely redesigned:
 *
 *   Stage 1 — SET TYPE SELECTION
 *     Pick a brand + set scope (Full Set / Finishing Set / Taping Set / Flat Box Set)
 *     Each card shows scope badge, included slots count, always-included accessories
 *
 *   Stage 2 — SLOT CONFIGURATOR
 *     For each slot in the chosen set template, pick ONE product from a visual card grid
 *     (no dropdowns — full images, SKUs, prices, descriptions)
 *     Slot progress sidebar tracks completion
 *     Always-included accessories shown in an info panel
 *
 *   Stage 3 — REVIEW & CART
 *     Clean review of all selected slot products + always-included list
 *     Running total + "Add All to Cart" CTA
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  CheckCircle2,
  Layers,
  Tag,
  Truck,
  AlertCircle,
  Info,
  ArrowRight,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';
import Toast from '../components/Toast';
import { getProducts } from '../services/catalog';
import { useCart } from '../context/CartContext';
import {
  SET_TEMPLATES,
  SCOPE_LABELS,
  SCOPE_COLORS,
  BUILDER_BRANDS,
  getTemplatesForBrand,
  getSlotProducts,
} from '../data/toolsetTemplates';

import tapeTechLogo   from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo   from '/brands/Columbia/columbia_taping_tools_logo.svg';
import level5Logo     from '/brands/Level5/Level5.svg';
import asgardLogo     from '/brands/Asgard/asgard_logo.svg';

import '../styles/toolset-builder.css';

// ── Constants ──────────────────────────────────────────────────────────────────
const PLACEHOLDER_IMG =
  'https://www.drywalltoolbox.com/wp/wp-content/uploads/2026/05/no-image-placeholder.webp';

const BRAND_LOGOS = {
  'TapeTech':             tapeTechLogo,
  'Columbia Taping Tools':columbiaLogo,
  'Level 5':              level5Logo,
  'Asgard':               asgardLogo,
};

const STAGES = [
  { id: 1, label: 'Choose Set Type' },
  { id: 2, label: 'Configure Tools'  },
  { id: 3, label: 'Review & Buy'     },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function resolveImage(product) {
  return (
    product?.image ||
    product?.featured_image ||
    product?.images?.[0]?.src ||
    product?.thumbnail ||
    PLACEHOLDER_IMG
  );
}

function displayPrice(product) {
  if (!product) return '';
  if (product.is_variable && product.min_price != null) {
    return `From $${Number(product.min_price).toFixed(2)}`;
  }
  const p =
    typeof product.price === 'number'
      ? product.price
      : parseFloat(product.price || 0);
  return `$${p.toFixed(2)}`;
}

function numericPrice(product) {
  if (!product) return 0;
  if (product.is_variable && product.min_price != null)
    return Number(product.min_price);
  return typeof product.price === 'number'
    ? product.price
    : parseFloat(product.price || 0);
}

// Count required slots that have been filled
function countFilledRequired(template, slotSelections) {
  if (!template) return { filled: 0, total: 0 };
  const required = template.slots.filter((s) => s.required);
  const filled   = required.filter((s) => slotSelections[s.id]).length;
  return { filled, total: required.length };
}

// ── Sub-components ──────────────────────────────────────────────────────────────

// Progress stepper
function StageBar({ stage, onStageClick }) {
  return (
    <div className="tsb-stepper" role="navigation" aria-label="Build stages">
      <div className="tsb-stepper-inner">
        {STAGES.map((s) => {
          const done   = stage > s.id;
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              className={[
                'tsb-step',
                active ? 'tsb-step--active' : '',
                done   ? 'tsb-step--done'   : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => done && onStageClick(s.id)}
              aria-current={active ? 'step' : undefined}
              style={{ cursor: done ? 'pointer' : active ? 'default' : 'not-allowed' }}
            >
              <span className="tsb-step-num" aria-hidden="true">
                {done ? <Check size={12} strokeWidth={3} /> : s.id}
              </span>
              <span className="tsb-step-label">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Slot icon renderer
function SlotIcon({ icon, size = 18 }) {
  const style = { color: '#2563eb', flexShrink: 0 };
  switch (icon) {
    case 'taper':     return <Wrench size={size} style={style} />;
    case 'flatbox':   return <Package size={size} style={style} />;
    case 'cornerbox': return <Layers size={size} style={style} />;
    case 'anglehead': return <ArrowRight size={size} style={style} />;
    case 'handle':    return <Wrench size={size} style={{ ...style, color: '#64748b' }} />;
    case 'roller':    return <Layers size={size} style={{ ...style, color: '#0891b2' }} />;
    default:          return <Package size={size} style={style} />;
  }
}

// ── Stage 1: Set Type Selection ────────────────────────────────────────────────

function Stage1SetSelection({
  allProducts,
  loading,
  onSelectTemplate,
  selectedBrandFilter,
  setSelectedBrandFilter,
}) {
  // Count products per brand to know which brands are populated
  const brandProductCounts = useMemo(() => {
    const counts = {};
    allProducts.forEach((p) => {
      const b = (p.brand || p.dtb_brand || '').trim();
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [allProducts]);

  const visibleTemplates = useMemo(() => {
    if (selectedBrandFilter === 'all') return SET_TEMPLATES;
    return SET_TEMPLATES.filter((t) => t.brand === selectedBrandFilter);
  }, [selectedBrandFilter]);

  return (
    <div className="tsb-section" style={{ animationDelay: '0.05s' }}>
      <div className="tsb-section-header">
        <div>
          <h2 className="tsb-section-title">Choose Your Set Type</h2>
          <p className="tsb-section-sub">
            Pick a brand and set scope — then configure every tool your way
          </p>
        </div>
      </div>

      {/* Brand filter pills */}
      <div className="tsb-brand-filter-strip">
        <button
          className={`tsb-brand-pill${selectedBrandFilter === 'all' ? ' tsb-brand-pill--active' : ''}`}
          onClick={() => setSelectedBrandFilter('all')}
        >
          All Brands
        </button>
        {BUILDER_BRANDS.map((brand) => {
          const count = brandProductCounts[brand] || 0;
          return (
            <button
              key={brand}
              className={`tsb-brand-pill${selectedBrandFilter === brand ? ' tsb-brand-pill--active' : ''}`}
              onClick={() => setSelectedBrandFilter(brand)}
            >
              {BRAND_LOGOS[brand] && (
                <img
                  src={BRAND_LOGOS[brand]}
                  alt=""
                  className="tsb-brand-pill-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {brand.replace(' Taping Tools', '').replace(' Drywall Tools', '')}
              {loading ? null : count === 0 ? (
                <span className="tsb-brand-pill-badge tsb-brand-pill-badge--empty">0</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Set template cards grid */}
      <div className="tsb-section-body">
        {loading ? (
          <div className="tsb-set-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="tsb-set-card tsb-set-card--skeleton">
                <div className="tsb-skeleton" style={{ height: '20px', marginBottom: '8px', width: '40%' }} />
                <div className="tsb-skeleton" style={{ height: '28px', marginBottom: '10px', width: '75%' }} />
                <div className="tsb-skeleton" style={{ height: '14px', marginBottom: '6px' }} />
                <div className="tsb-skeleton" style={{ height: '14px', width: '80%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="tsb-set-grid">
            {visibleTemplates.map((template, idx) => {
              const scopeColor = SCOPE_COLORS[template.scope] || SCOPE_COLORS.full;
              const requiredSlots = template.slots.filter((s) => s.required).length;
              const optionalSlots = template.slots.filter((s) => !s.required).length;
              const brandHasProducts = (brandProductCounts[template.brand] || 0) > 0;

              return (
                <button
                  key={template.id}
                  className="tsb-set-card"
                  style={{ animationDelay: `${Math.min(idx, 8) * 0.06}s` }}
                  onClick={() => onSelectTemplate(template)}
                  disabled={!brandHasProducts && !loading}
                >
                  {/* Free shipping badge */}
                  <div className="tsb-set-card-badges">
                    <span className="tsb-badge tsb-badge--shipping">
                      <Truck size={10} /> Ships FREE
                    </span>
                    {template.savingsLabel && (
                      <span className="tsb-badge tsb-badge--savings">
                        <Tag size={10} /> {template.savingsLabel}
                      </span>
                    )}
                  </div>

                  {/* Brand logo + scope badge */}
                  <div className="tsb-set-card-brand-row">
                    {BRAND_LOGOS[template.brand] && (
                      <img
                        src={BRAND_LOGOS[template.brand]}
                        alt={template.brand}
                        className="tsb-set-card-brand-logo"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span
                      className="tsb-scope-badge"
                      style={{ background: scopeColor.bg, color: scopeColor.text }}
                    >
                      {SCOPE_LABELS[template.scope]}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="tsb-set-card-name">{template.name}</h3>

                  {/* Description */}
                  <p className="tsb-set-card-desc">{template.description}</p>

                  {/* Slot summary */}
                  <div className="tsb-set-card-meta">
                    <span className="tsb-set-meta-item">
                      <span className="tsb-set-meta-num">{requiredSlots}</span> required tool{requiredSlots !== 1 ? 's' : ''}
                    </span>
                    {optionalSlots > 0 && (
                      <span className="tsb-set-meta-item tsb-set-meta-item--opt">
                        +{optionalSlots} optional
                      </span>
                    )}
                  </div>

                  {/* Always included teaser */}
                  {template.alwaysIncluded.length > 0 && (
                    <div className="tsb-set-card-included">
                      <span className="tsb-set-included-label">Always included:</span>
                      <span className="tsb-set-included-count">
                        {template.alwaysIncluded.length} free accessor{template.alwaysIncluded.length !== 1 ? 'ies' : 'y'}
                      </span>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="tsb-set-card-cta">
                    Configure Set <ChevronRight size={14} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stage 2: Slot Configurator ─────────────────────────────────────────────────

function Stage2Configurator({
  template,
  allProducts,
  slotSelections,
  onSlotSelect,
  onBack,
  onNext,
}) {
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [searchQuery, setSearchQuery]     = useState('');
  const activeSlot = template.slots[activeSlotIdx];

  // Products for the currently active slot
  const slotProducts = useMemo(() => {
    if (!activeSlot) return [];
    return getSlotProducts(allProducts, template.brand, activeSlot.filter);
  }, [allProducts, template.brand, activeSlot]);

  // Filtered by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return slotProducts;
    const q = searchQuery.toLowerCase();
    return slotProducts.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku  || '').toLowerCase().includes(q)
    );
  }, [slotProducts, searchQuery]);

  // Check completion
  const { filled, total } = countFilledRequired(template, slotSelections);
  const allRequiredFilled = filled === total;

  // Navigate slots
  const goToSlot = useCallback((idx) => {
    setActiveSlotIdx(idx);
    setSearchQuery('');
  }, []);

  const goNextSlot = useCallback(() => {
    if (activeSlotIdx < template.slots.length - 1) {
      goToSlot(activeSlotIdx + 1);
    }
  }, [activeSlotIdx, template.slots.length, goToSlot]);

  const goPrevSlot = useCallback(() => {
    if (activeSlotIdx > 0) {
      goToSlot(activeSlotIdx - 1);
    }
  }, [activeSlotIdx, goToSlot]);

  const handleSelectProduct = useCallback((product) => {
    onSlotSelect(activeSlot.id, product);
    // Auto-advance to next unfilled required slot
    const nextUnfilled = template.slots.findIndex(
      (s, i) => i > activeSlotIdx && s.required && !slotSelections[s.id]
    );
    if (nextUnfilled !== -1) {
      setTimeout(() => goToSlot(nextUnfilled), 300);
    } else if (activeSlotIdx < template.slots.length - 1) {
      setTimeout(() => goToSlot(activeSlotIdx + 1), 300);
    }
  }, [activeSlot, onSlotSelect, activeSlotIdx, template.slots, slotSelections, goToSlot]);

  const handleClearSlot = useCallback((e) => {
    e.stopPropagation();
    onSlotSelect(activeSlot.id, null);
  }, [activeSlot, onSlotSelect]);

  return (
    <div className="tsb-configurator">
      {/* ── Configurator header ─────────────────────────────── */}
      <div className="tsb-config-header">
        <div className="tsb-config-header-inner">
          <div className="tsb-config-brand-row">
            {BRAND_LOGOS[template.brand] && (
              <img
                src={BRAND_LOGOS[template.brand]}
                alt={template.brand}
                className="tsb-config-brand-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div>
              <h2 className="tsb-config-title">{template.name}</h2>
              <p className="tsb-config-sub">{template.tagline}</p>
            </div>
          </div>
          {/* Completion indicator */}
          <div className="tsb-config-progress">
            <div className="tsb-config-progress-bar">
              <div
                className="tsb-config-progress-fill"
                style={{ width: total > 0 ? `${(filled / total) * 100}%` : '0%' }}
              />
            </div>
            <span className="tsb-config-progress-label">
              {filled}/{total} required tools selected
            </span>
          </div>
        </div>
      </div>

      {/* ── Main configurator body: slot list + product grid ── */}
      <div className="tsb-config-body">

        {/* ── Left: Slot navigation ───────────────────────── */}
        <div className="tsb-slot-nav">
          <div className="tsb-slot-nav-inner">
            <p className="tsb-slot-nav-heading">Tool Slots</p>
            {template.slots.map((slot, idx) => {
              const selected = slotSelections[slot.id];
              const isActive = idx === activeSlotIdx;
              return (
                <button
                  key={slot.id}
                  className={[
                    'tsb-slot-nav-item',
                    isActive   ? 'tsb-slot-nav-item--active'   : '',
                    selected   ? 'tsb-slot-nav-item--done'     : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => goToSlot(idx)}
                >
                  <span className="tsb-slot-nav-dot" aria-hidden="true">
                    {selected ? <Check size={10} strokeWidth={3} /> : <span>{idx + 1}</span>}
                  </span>
                  <div className="tsb-slot-nav-text">
                    <span className="tsb-slot-nav-label">{slot.label}</span>
                    {selected ? (
                      <span className="tsb-slot-nav-product">{selected.name}</span>
                    ) : (
                      <span className="tsb-slot-nav-empty">
                        {slot.required ? 'Required' : 'Optional'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Always included accessories */}
            {template.alwaysIncluded.length > 0 && (
              <div className="tsb-slot-included-panel">
                <p className="tsb-slot-nav-heading" style={{ marginTop: '1rem' }}>Always Included</p>
                {template.alwaysIncluded.map((item) => (
                  <div key={item} className="tsb-included-item">
                    <Check size={11} strokeWidth={3} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Active slot product picker ─────────────── */}
        <div className="tsb-slot-picker">
          {/* Slot header */}
          <div className="tsb-slot-picker-header">
            <div className="tsb-slot-picker-title-row">
              <div className="tsb-slot-icon-wrap">
                <SlotIcon icon={activeSlot?.icon} size={18} />
              </div>
              <div>
                <div className="tsb-slot-picker-title">
                  {activeSlot?.label}
                  <span className={`tsb-required-pill${activeSlot?.required ? '' : ' tsb-required-pill--opt'}`}>
                    {activeSlot?.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                {activeSlot?.hint && (
                  <p className="tsb-slot-picker-hint">{activeSlot.hint}</p>
                )}
              </div>
            </div>

            {/* Slot prev / next arrows */}
            <div className="tsb-slot-arrows">
              <button
                className="tsb-slot-arrow"
                disabled={activeSlotIdx === 0}
                onClick={goPrevSlot}
                aria-label="Previous slot"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tsb-slot-arrow-label">
                {activeSlotIdx + 1} / {template.slots.length}
              </span>
              <button
                className="tsb-slot-arrow"
                disabled={activeSlotIdx === template.slots.length - 1}
                onClick={goNextSlot}
                aria-label="Next slot"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Currently selected display */}
          {slotSelections[activeSlot?.id] && (
            <div className="tsb-slot-selected-bar">
              <Check size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span className="tsb-slot-selected-name">
                {slotSelections[activeSlot.id].name}
              </span>
              <span className="tsb-slot-selected-price">
                {displayPrice(slotSelections[activeSlot.id])}
              </span>
              <button className="tsb-slot-clear-btn" onClick={handleClearSlot}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* Search */}
          <div className="tsb-search-wrap" style={{ paddingTop: '0.75rem' }}>
            <Search size={13} className="tsb-search-icon" />
            <input
              type="text"
              className="tsb-search-input"
              placeholder={`Search ${activeSlot?.label || 'tools'}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position:  'absolute',
                  right:     'calc(1.75rem + 10px)',
                  top:       '50%',
                  transform: 'translateY(-50%)',
                  background:'none',
                  border:    'none',
                  cursor:    'pointer',
                  color:     '#94a3b8',
                  display:   'flex',
                  padding:   '4px',
                  marginTop: '2px',
                }}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Product cards */}
          {filteredProducts.length === 0 ? (
            <div className="tsb-slot-empty">
              {searchQuery ? (
                <p>
                  No results for "<strong>{searchQuery}</strong>" —{' '}
                  <button
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    onClick={() => setSearchQuery('')}
                  >
                    clear search
                  </button>
                </p>
              ) : (
                <p>
                  No {template.brand} products found for this slot. This slot may be populated once the catalog is fully synced.
                </p>
              )}
            </div>
          ) : (
            <div className="tsb-slot-product-grid">
              {filteredProducts.map((product, idx) => {
                const isSelected = slotSelections[activeSlot.id]?.id === product.id;
                return (
                  <button
                    key={product.id}
                    className={`tsb-slot-product-card${isSelected ? ' tsb-slot-product-card--selected' : ''}`}
                    onClick={() => handleSelectProduct(product)}
                    style={{ animationDelay: `${Math.min(idx, 12) * 0.04}s` }}
                  >
                    {/* Image */}
                    <div className="tsb-slot-product-img">
                      <img
                        src={resolveImage(product)}
                        alt={product.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                      />
                      {isSelected && (
                        <div className="tsb-slot-product-check">
                          <Check size={15} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="tsb-slot-product-body">
                      <p className="tsb-slot-product-name">{product.name}</p>
                      {product.sku && (
                        <p className="tsb-slot-product-sku">{product.sku}</p>
                      )}
                      <div className="tsb-slot-product-bottom">
                        <span className="tsb-slot-product-price">
                          {displayPrice(product)}
                        </span>
                        <span className={`tsb-slot-select-btn${isSelected ? ' tsb-slot-select-btn--selected' : ''}`}>
                          {isSelected ? (
                            <><Check size={11} strokeWidth={3} /> Selected</>
                          ) : (
                            <>Select <ChevronRight size={11} /></>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Slot navigation footer */}
          <div className="tsb-nav-bar">
            <button className="tsb-nav-back" onClick={onBack}>
              <ChevronLeft size={14} /> Change Set
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {activeSlotIdx < template.slots.length - 1 && (
                <button className="tsb-nav-next" style={{ background: '#f1f5f9', color: '#1e293b', border: '1.5px solid rgba(15,23,42,0.1)' }} onClick={goNextSlot}>
                  Next Slot <ChevronRight size={14} />
                </button>
              )}
              <button
                className="tsb-nav-next"
                disabled={!allRequiredFilled}
                onClick={onNext}
              >
                <ShoppingCart size={14} />
                Review Set {allRequiredFilled && `(${filled})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stage 3: Review & Cart ─────────────────────────────────────────────────────

function Stage3Review({
  template,
  slotSelections,
  onSlotRemove,
  onBack,
  onAddToCart,
  showSuccess,
  onStartOver,
}) {
  // Compute total price from selected slots
  const selectedItems = useMemo(
    () => template.slots.map((slot) => ({
      slot,
      product: slotSelections[slot.id] || null,
    })).filter((item) => item.product !== null),
    [template, slotSelections]
  );

  const totalPrice = selectedItems.reduce(
    (sum, { product }) => sum + numericPrice(product),
    0
  );

  if (showSuccess) {
    return (
      <div className="tsb-section">
        <div className="tsb-success">
          <div className="tsb-success-icon">
            <CheckCircle2 size={36} color="#fff" />
          </div>
          <h2>Added to Cart!</h2>
          <p>
            {selectedItems.length} tool{selectedItems.length !== 1 ? 's' : ''} from your{' '}
            <strong>{template.name}</strong> have been added to your cart.
          </p>
          <div className="tsb-success-actions">
            <Link to="/cart" className="tsb-success-btn-primary">
              <ShoppingCart size={15} /> View Cart
            </Link>
            <button className="tsb-success-btn-secondary" onClick={onStartOver}>
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
            {selectedItems.length} tool{selectedItems.length !== 1 ? 's' : ''} configured · $
            {totalPrice.toFixed(2)} estimated total
          </p>
        </div>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.78rem', fontWeight: 600, padding: '4px 8px', borderRadius: '6px' }}
          onClick={onBack}
        >
          ← Edit Configuration
        </button>
      </div>

      <div className="tsb-section-body">
        {/* Configured tools */}
        <h3 className="tsb-review-section-label">Configured Tools</h3>
        <div className="tsb-review-grid">
          {template.slots.map((slot) => {
            const product = slotSelections[slot.id];
            return (
              <div
                key={slot.id}
                className={`tsb-review-item${!product ? ' tsb-review-item--empty' : ''}`}
              >
                {product ? (
                  <>
                    <div className="tsb-review-item-img">
                      <img
                        src={resolveImage(product)}
                        alt={product.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                      />
                    </div>
                    <div className="tsb-review-item-info">
                      <p className="tsb-review-slot-label">{slot.label}</p>
                      <p className="tsb-review-item-name">{product.name}</p>
                      {product.sku && (
                        <p className="tsb-review-item-sku">{product.sku}</p>
                      )}
                      <p className="tsb-review-item-price">{displayPrice(product)}</p>
                    </div>
                    <button
                      className="tsb-review-remove"
                      onClick={() => onSlotRemove(slot.id)}
                      aria-label={`Remove ${slot.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="tsb-review-item-img tsb-review-item-img--empty">
                      <AlertCircle size={20} style={{ color: '#cbd5e1' }} />
                    </div>
                    <div className="tsb-review-item-info">
                      <p className="tsb-review-slot-label">{slot.label}</p>
                      <p className="tsb-review-item-name" style={{ color: '#94a3b8', fontWeight: 500 }}>
                        {slot.required ? 'Not selected (Required)' : 'Not selected (Optional)'}
                      </p>
                    </div>
                    <button
                      className="tsb-nav-next"
                      style={{ padding: '7px 12px', fontSize: '0.72rem' }}
                      onClick={onBack}
                    >
                      Select <ChevronRight size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Always included accessories */}
        {template.alwaysIncluded.length > 0 && (
          <>
            <h3 className="tsb-review-section-label" style={{ marginTop: '2rem' }}>
              Always Included <span style={{ fontWeight: 500, color: '#16a34a', fontSize: '0.75rem' }}>— FREE with your set</span>
            </h3>
            <div className="tsb-review-included-grid">
              {template.alwaysIncluded.map((item) => (
                <div key={item} className="tsb-review-included-item">
                  <div className="tsb-review-included-icon">
                    <Check size={14} color="#16a34a" strokeWidth={3} />
                  </div>
                  <span className="tsb-review-included-name">{item}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Total + CTA */}
      <div className="tsb-review-footer">
        <div className="tsb-review-total-row">
          <div>
            <div className="tsb-total-label">Estimated Total</div>
            <div className="tsb-total-items">{selectedItems.length} configured tool{selectedItems.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="tsb-total-price">${totalPrice.toFixed(2)}</div>
        </div>
        <div className="tsb-review-cta-row">
          <button className="tsb-nav-back" onClick={onBack}>
            <ChevronLeft size={14} /> Edit Configuration
          </button>
          <button
            className="tsb-nav-next"
            style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)', padding: '13px 24px', fontSize: '0.92rem' }}
            disabled={selectedItems.length === 0}
            onClick={onAddToCart}
          >
            <ShoppingCart size={16} /> Add All to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function ToolsetBuilder() {
  const { addToCart } = useCart();

  // ── State ─────────────────────────────────────────────────────────────────────
  const [stage,               setStage]               = useState(1);
  const [selectedTemplate,    setSelectedTemplate]    = useState(null);
  const [slotSelections,      setSlotSelections]      = useState({});
  const [allProducts,         setAllProducts]         = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [toast,               setToast]               = useState(null);
  const [showSuccess,         setShowSuccess]         = useState(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');

  // ── Load catalog ──────────────────────────────────────────────────────────────
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

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setSlotSelections({});
    setStage(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSlotSelect = useCallback((slotId, product) => {
    setSlotSelections((prev) => {
      if (product === null) {
        const next = { ...prev };
        delete next[slotId];
        return next;
      }
      return { ...prev, [slotId]: product };
    });
  }, []);

  const handleSlotRemove = useCallback((slotId) => {
    setSlotSelections((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }, []);

  const handleStageClick = useCallback((s) => {
    if (s < stage) {
      setStage(s);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [stage]);

  const handleBackToSetSelection = useCallback(() => {
    setStage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleGoToReview = useCallback(() => {
    setStage(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!selectedTemplate) return;
    const items = selectedTemplate.slots
      .map((slot) => slotSelections[slot.id])
      .filter(Boolean);
    if (items.length === 0) return;
    items.forEach((product) => addToCart(product, 1));
    setShowSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedTemplate, slotSelections, addToCart]);

  const handleStartOver = useCallback(() => {
    setStage(1);
    setSelectedTemplate(null);
    setSlotSelections({});
    setShowSuccess(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <SEOHead
        title="Toolset Builder — Build Your Own Drywall Toolset | Drywall Toolbox"
        description="Build your perfect drywall toolset step by step. Choose a set type, pick your tools for each slot, and add everything to cart in one click. TapeTech, Columbia, Level 5, Asgard."
        canonical="https://drywalltoolbox.com/toolset-builder"
      />

      <div className="tsb-page">

        {/* ── Hero ────────────────────────────────────────────── */}
        <div className="tsb-hero">
          <div className="tsb-hero-inner">
            <span className="tsb-hero-eyebrow">
              <Wrench size={10} /> Toolset Builder
            </span>
            <h1>Build Your Perfect Drywall Toolset</h1>
            <p className="tsb-hero-subtitle">
              Choose a set type, configure every tool slot with real product images and prices,
              then add your complete set to cart in one click.
            </p>
            <div className="tsb-hero-badges">
              <span className="tsb-hero-badge">
                <Truck size={12} /> Free Shipping
              </span>
              <span className="tsb-hero-badge">
                <Tag size={12} /> Bundle Savings
              </span>
              <span className="tsb-hero-badge">
                <Check size={12} strokeWidth={3} /> Free Accessories Included
              </span>
            </div>
          </div>
        </div>

        {/* ── Stage indicator ─────────────────────────────────── */}
        <StageBar stage={stage} onStageClick={handleStageClick} />

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="tsb-content">
          {stage === 1 && (
            <Stage1SetSelection
              allProducts={allProducts}
              loading={loading}
              onSelectTemplate={handleSelectTemplate}
              selectedBrandFilter={selectedBrandFilter}
              setSelectedBrandFilter={setSelectedBrandFilter}
            />
          )}

          {stage === 2 && selectedTemplate && (
            <Stage2Configurator
              template={selectedTemplate}
              allProducts={allProducts}
              slotSelections={slotSelections}
              onSlotSelect={handleSlotSelect}
              onBack={handleBackToSetSelection}
              onNext={handleGoToReview}
            />
          )}

          {stage === 3 && selectedTemplate && (
            <Stage3Review
              template={selectedTemplate}
              slotSelections={slotSelections}
              onSlotRemove={handleSlotRemove}
              onBack={() => setStage(2)}
              onAddToCart={handleAddToCart}
              showSuccess={showSuccess}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
