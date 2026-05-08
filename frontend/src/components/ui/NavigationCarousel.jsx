/**
 * ui/NavigationCarousel.jsx — Hero section navigation card carousel
 *
 * Shows interactive navigation cards (Products, Parts, Schematics, etc.)
 * positioned in the hero above the Trusted Brands marquee.
 *
 * Desktop  : 3 cards visible + prominent left/right arrow buttons
 * Mobile   : 1.5 cards visible + subtle arrows + smooth touch drag
 *
 * Touch/drag is handled via framer-motion's drag prop.
 * Tap vs. drag is distinguished by measuring pointer delta on pointer-up.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  ShoppingBag,
  Settings,
  Layers,
  Calculator,
  Briefcase,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/* ── Card definitions ──────────────────────────────────────────────────────── */
const NAV_CARDS = [
  {
    id: 'products',
    label: 'Products',
    icon: ShoppingBag,
    to: '/all-products',
    desc: 'Browse all tools & equipment',
  },
  {
    id: 'parts',
    label: 'Parts',
    icon: Settings,
    to: '/parts',
    desc: 'OEM replacement parts',
  },
  {
    id: 'schematics',
    label: 'Schematics',
    icon: Layers,
    to: '/schematics',
    desc: 'Tool diagrams & parts lists',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    icon: Calculator,
    to: '/calculators',
    desc: 'Estimate your materials',
  },
  {
    id: 'toolsets',
    label: 'Tool Sets',
    icon: Briefcase,
    to: '/toolset-builder',
    desc: 'Build your perfect kit',
  },
  {
    id: 'repairs',
    label: 'Repairs',
    icon: Wrench,
    to: '/repairs',
    desc: 'Professional repair shop',
  },
];

const CARD_GAP = 12; /* px between cards */
const DRAG_TAP_THRESHOLD = 8; /* px — below this is a tap, not a drag */
const DRAG_SLIDE_THRESHOLD = 55; /* px — drag offset required to advance slide */

/* Responsive breakpoints and card visibility counts */
const DESKTOP_BREAKPOINT = 680;
const TABLET_BREAKPOINT = 460;
const DESKTOP_VISIBLE_CARDS = 3;
const TABLET_VISIBLE_CARDS = 2.2;
const MOBILE_VISIBLE_CARDS = 1.6;
const AUTO_SLIDE_INTERVAL_MILLISECONDS = 4600;

const CARD_3D_ROTATION_FACTOR = -12;
const CARD_3D_BASE_TRANSLATE_Z = 22;
const CARD_3D_TRANSLATE_Z_STEP = 10;
const CARD_3D_MIN_SCALE = 0.84;
const CARD_3D_SCALE_STEP = 0.08;
const CARD_3D_MIN_OPACITY = 0.58;
const CARD_3D_OPACITY_STEP = 0.16;

/* Arrow button horizontal clearance */
const DESKTOP_SIDE_PADDING = 52;
const MOBILE_SIDE_PADDING = 36;

/* ── Arrow button ──────────────────────────────────────────────────────────── */
function ArrowBtn({ direction, onClick, disabled, isMobile }) {
  const [hov, setHov] = useState(false);
  const size = isMobile ? 28 : 40;
  const iconSize = isMobile ? 13 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'left' ? 'Previous' : 'Next'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: 0,
        top: '50%',
        transform: 'translateY(-60%)', /* offset upward to clear dot indicators */
        zIndex: 2,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        border: `1px solid ${disabled ? 'rgba(99,149,255,0.08)' : 'rgba(99,149,255,0.22)'}`,
        background: disabled
          ? 'rgba(255,255,255,0.03)'
          : hov
          ? 'rgba(255,255,255,0.13)'
          : 'rgba(255,255,255,0.07)',
        color: disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.18s, color 0.18s, border-color 0.18s',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {direction === 'left'
        ? <ChevronLeft size={iconSize} />
        : <ChevronRight size={iconSize} />}
    </button>
  );
}

/* ── Individual nav card ───────────────────────────────────────────────────── */
function NavCard({ card, width }) {
  const [hov, setHov] = useState(false);
  const Icon = card.icon;
  const navigate = useNavigate();
  const pressRef = useRef({ x: 0, y: 0 });

  const onPointerDown = (e) => {
    pressRef.current = { x: e.clientX, y: e.clientY };
  };

  /* Only navigate if the pointer barely moved (tap, not drag) */
  const onPointerUp = (e) => {
    const dx = Math.abs(e.clientX - pressRef.current.x);
    const dy = Math.abs(e.clientY - pressRef.current.y);
    if (dx < DRAG_TAP_THRESHOLD && dy < DRAG_TAP_THRESHOLD) {
      navigate(card.to);
    }
  };

  const depth = card.depth ?? 0;
  const absDepth = Math.abs(depth);
  const rotateY = depth * CARD_3D_ROTATION_FACTOR;
  const translateZ = Math.max(0, CARD_3D_BASE_TRANSLATE_Z - absDepth * CARD_3D_TRANSLATE_Z_STEP);
  const scale = Math.max(CARD_3D_MIN_SCALE, 1 - absDepth * CARD_3D_SCALE_STEP);
  const depthOpacity = Math.max(CARD_3D_MIN_OPACITY, 1 - absDepth * CARD_3D_OPACITY_STEP);

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(card.to); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={`Navigate to ${card.label}`}
      style={{
        width: `${width}px`,
        flexShrink: 0,
        padding: '18px 16px',
        borderRadius: '14px',
        border: `1px solid ${hov ? 'rgba(99,149,255,0.35)' : 'rgba(99,149,255,0.13)'}`,
        background: hov ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'background 0.22s, border-color 0.22s, transform 0.32s ease, box-shadow 0.22s, opacity 0.26s',
        transform: `${hov ? 'translateY(-3px)' : 'translateY(0)'} rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`,
        boxShadow: hov ? '0 8px 24px rgba(37,99,235,0.20)' : 'none',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
        minHeight: '108px',
        outline: 'none',
        opacity: depthOpacity,
      }}
    >
      {/* Icon container */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: hov ? 'rgba(37,99,235,0.28)' : 'rgba(37,99,235,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.18s',
      }}>
        <Icon size={17} color="#60a5fa" strokeWidth={1.9} />
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize: '0.88rem',
          fontWeight: 700,
          color: hov ? '#ffffff' : '#f0f6ff',
          lineHeight: 1.2,
          marginBottom: '3px',
          transition: 'color 0.15s',
        }}>
          {card.label}
        </div>
        <div style={{
          fontSize: '0.71rem',
          color: 'rgba(163,192,255,0.55)',
          lineHeight: 1.4,
        }}>
          {card.desc}
        </div>
      </div>
    </div>
  );
}

/* ── Main carousel ─────────────────────────────────────────────────────────── */
export default function NavigationCarousel() {
  const [active, setActive] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [paused, setPaused] = useState(false);
  const clipRef = useRef(null);
  const dragOffsetRef = useRef(0);

  /* Measure container width reactively */
  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Responsive: how many cards are visible at once */
  const visible = containerW > DESKTOP_BREAKPOINT
    ? DESKTOP_VISIBLE_CARDS
    : containerW > TABLET_BREAKPOINT
    ? TABLET_VISIBLE_CARDS
    : MOBILE_VISIBLE_CARDS;
  const cardW = containerW > 0
    ? (containerW - CARD_GAP * Math.floor(visible - 1)) / visible
    : 220;
  const totalCards = NAV_CARDS.length;
  const maxActive = Math.max(0, totalCards - Math.floor(visible));
  const isMobile = containerW > 0 && containerW <= DESKTOP_BREAKPOINT;
  const focalIndex = active + Math.floor(visible / 2);

  const prev = useCallback(
    () => setActive((a) => (a <= 0 ? maxActive : a - 1)),
    [maxActive],
  );
  const next = useCallback(
    () => setActive((a) => (a >= maxActive ? 0 : a + 1)),
    [maxActive],
  );

  const canPrev = maxActive > 0;
  const canNext = maxActive > 0;

  /* Translate the track based on active index */
  const trackX = -(active * (cardW + CARD_GAP));

  const onDragStart = () => {
    dragOffsetRef.current = 0;
  };

  const onDrag = (_e, info) => {
    dragOffsetRef.current = Math.max(
      dragOffsetRef.current,
      Math.abs(info.offset.x),
    );
  };

  const onDragEnd = (_e, info) => {
    if (dragOffsetRef.current > DRAG_SLIDE_THRESHOLD) {
      if (info.offset.x < -DRAG_SLIDE_THRESHOLD) next();
      else if (info.offset.x > DRAG_SLIDE_THRESHOLD) prev();
    }
    dragOffsetRef.current = 0;
  };

  useEffect(() => {
    if (paused || maxActive <= 0) return;
    const id = setInterval(() => {
      next();
    }, AUTO_SLIDE_INTERVAL_MILLISECONDS);
    return () => clearInterval(id);
  }, [paused, maxActive, next]);

  /* Horizontal padding for arrow clearance */
  const sidePad = isMobile ? MOBILE_SIDE_PADDING : DESKTOP_SIDE_PADDING;

  return (
    <div style={{ width: '100%', position: 'relative', padding: '0 0 32px' }}>

      {/* Section eyebrow */}
      <p style={{
        textAlign: 'center',
        fontSize: '0.60rem',
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(148,163,184,0.38)',
        fontFamily: 'var(--font-mono, monospace)',
        margin: '0 0 14px',
      }}>
        Navigate
      </p>

      {/* Carousel viewport */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: `0 ${sidePad}px`,
        position: 'relative',
        perspective: '1200px',
      }}>

        <ArrowBtn direction="left" onClick={prev} disabled={!canPrev} isMobile={isMobile} />

        {/* Clip + track */}
        <div
          ref={clipRef}
          style={{ overflow: 'hidden' }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onPointerDown={() => setPaused(true)}
        >
          <Motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            animate={{ x: trackX }}
            transition={{ type: 'spring', stiffness: 310, damping: 36 }}
            style={{
              display: 'flex',
              gap: `${CARD_GAP}px`,
              willChange: 'transform',
              cursor: 'grab',
            }}
            whileDrag={{ cursor: 'grabbing' }}
          >
            {NAV_CARDS.map((card, index) => {
              const depth = cardW > 0 ? index - focalIndex : 0;
              return (
                <NavCard
                  key={card.id}
                  card={{ ...card, depth }}
                  width={cardW}
                />
              );
            })}
          </Motion.div>
        </div>

        <ArrowBtn direction="right" onClick={next} disabled={!canNext} isMobile={isMobile} />
      </div>

      {/* Dot / pill progress indicators */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '5px',
        marginTop: '14px',
      }}>
        {Array.from({ length: maxActive + 1 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: i === active ? '18px' : '6px',
              height: '6px',
              borderRadius: '3px',
              border: 'none',
              background: i === active
                ? 'rgba(96,165,250,0.85)'
                : 'rgba(148,163,184,0.22)',
              cursor: 'pointer',
              padding: 0,
              transition: 'width 0.28s ease, background 0.28s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
