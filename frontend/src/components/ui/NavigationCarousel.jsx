/**
 * ui/NavigationCarousel.jsx — Hero section 3D cylindrical navigation carousel
 *
 * Shows interactive navigation cards (Products, Parts, Schematics, etc.)
 * arranged as a true CSS 3D cylinder above the Trusted Brands marquee.
 *
 * Desktop : Full 3D cylinder — mouse-tilt, arrow buttons, auto-rotate.
 * Mobile  : Touch-swipe snaps one card at a time — no free scrolling.
 *
 * Architecture:
 *   • All animation state (rotation, tilt) lives in refs; a single RAF loop
 *     lerps them each frame and writes directly to wheelRef.style.transform.
 *   • Per-card opacity is also updated per-frame via DOM refs to avoid React
 *     re-renders at 60 fps.
 *   • React state (activeIdx, isDragging) is only updated on discrete events
 *     (card advance, drag-start/end) to keep dot indicators and card styling
 *     in sync without flooding the reconciler.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

/* ── Navigation card definitions ──────────────────────────────────────────── */
const NAV_CARDS = [
  { id: 'products',   label: 'Products',   icon: ShoppingBag, to: '/all-products',    desc: 'Browse all tools & equipment' },
  { id: 'parts',      label: 'Parts',      icon: Settings,    to: '/parts',           desc: 'OEM replacement parts'        },
  { id: 'schematics', label: 'Schematics', icon: Layers,      to: '/schematics',      desc: 'Tool diagrams & parts lists'  },
  { id: 'calculator', label: 'Calculator', icon: Calculator,  to: '/calculators',     desc: 'Estimate your materials'      },
  { id: 'toolsets',   label: 'Tool Sets',  icon: Briefcase,   to: '/toolset-builder', desc: 'Build your perfect kit'       },
  { id: 'repairs',    label: 'Repairs',    icon: Wrench,      to: '/repairs',         desc: 'Professional repair shop'     },
];

const TOTAL      = NAV_CARDS.length; /* 6 cards */
const ANGLE_STEP = 360 / TOTAL;      /* 60° per card */

/* ── Tuning constants ──────────────────────────────────────────────────────── */
const AUTO_SLIDE_MS   = 4600;  /* ms between auto-advances               */
const LERP_ROT        = 0.13;  /* rotation interpolation speed            */
const LERP_TILT       = 0.10;  /* tilt interpolation speed                */
const TILT_MAX        = 7;     /* max rotateX degrees (desktop mouse)     */
const ROT_PER_PX      = 0.36;  /* degrees of rotation per pixel of drag  */
const SWIPE_THRESHOLD   = 35;    /* px needed to commit a swipe             */
const DRAG_TAP_LIMIT    = 8;     /* px — below this is treated as a tap    */
const OPACITY_FADE_FACTOR = 0.72; /* how much non-front cards fade (0–1)   */

/* ── Responsive sizing ─────────────────────────────────────────────────────── */
function getSizing(w) {
  if (!w) return { cardW: 160, cardH: 218, radius: 200, persp: 900 };
  const cardW  = Math.max(110, Math.min(180, Math.round(w * 0.38)));
  const cardH  = Math.round(cardW * 1.36);
  /* radius: keep side cards within viewport by capping at w * 0.48 */
  const radius = Math.max(155, Math.min(260, Math.round(w * 0.48)));
  const persp  = Math.round(radius * 4);
  return { cardW, cardH, radius, persp };
}

/* ── Arrow button ──────────────────────────────────────────────────────────── */
function ArrowBtn({ direction, onClick, isMobile }) {
  const [hov, setHov] = useState(false);
  const sz   = isMobile ? 28 : 40;
  const icSz = isMobile ? 13 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Previous' : 'Next'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: 0,
        top: '50%',
        transform: 'translateY(-60%)', /* offset upward to clear dot indicators */
        zIndex: 10,
        width:  `${sz}px`,
        height: `${sz}px`,
        borderRadius: '50%',
        border:     `1px solid ${hov ? 'rgba(99,149,255,0.40)' : 'rgba(99,149,255,0.22)'}`,
        background:  hov ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)',
        color:       hov ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.18s, color 0.18s, border-color 0.18s',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {direction === 'left' ? <ChevronLeft size={icSz} /> : <ChevronRight size={icSz} />}
    </button>
  );
}

/* ── Individual nav card ───────────────────────────────────────────────────── */
/*
 * Each card is absolutely positioned inside the preserve-3d wheel div.
 * Its static 3D transform is: rotateY(cardAngle) translateZ(radius)
 * The wheel's own rotation then brings each card in/out of view.
 *
 * Tap detection uses a pressRef so navigation only fires when the pointer
 * barely moved (tap, not the end of a drag gesture).
 */
function NavCard({ card, cardAngle, radius, cardW, cardH, isActive, onTap }) {
  const [hov, setHov] = useState(false);
  const Icon = card.icon;
  const pressRef = useRef({ x: 0, y: 0 });

  const onPointerDown = (e) => {
    pressRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e) => {
    const dx = Math.abs(e.clientX - pressRef.current.x);
    const dy = Math.abs(e.clientY - pressRef.current.y);
    if (isActive && dx < DRAG_TAP_LIMIT && dy < DRAG_TAP_LIMIT) {
      onTap(card.to);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isActive ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => { if (isActive && (e.key === 'Enter' || e.key === ' ')) onTap(card.to); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={`Navigate to ${card.label}`}
      style={{
        position: 'absolute',
        width:  `${cardW}px`,
        height: `${cardH}px`,
        left: `-${cardW  / 2}px`,
        top:  `-${cardH / 2}px`,
        /* Static 3D position within the cylinder wheel */
        transform: `rotateY(${cardAngle}deg) translateZ(${radius}px)`,
        backfaceVisibility:       'hidden',
        WebkitBackfaceVisibility: 'hidden',
        padding:      '18px 16px',
        borderRadius: '14px',
        border: `1px solid ${
          hov && isActive ? 'rgba(99,149,255,0.45)'
          : isActive      ? 'rgba(99,149,255,0.22)'
          :                  'rgba(99,149,255,0.09)'
        }`,
        background: hov && isActive ? 'rgba(255,255,255,0.11)'
          : isActive               ? 'rgba(255,255,255,0.07)'
          :                           'rgba(255,255,255,0.03)',
        cursor: isActive ? 'pointer' : 'default',
        /* Opacity is animated per-frame by the RAF loop — not via CSS transition */
        transition: 'background 0.22s, border-color 0.22s, box-shadow 0.22s',
        boxShadow: hov && isActive ? '0 8px 28px rgba(37,99,235,0.22)'
          : isActive               ? '0 2px 12px rgba(37,99,235,0.10)'
          :                           'none',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        userSelect: 'none',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            '10px',
        outline:        'none',
        willChange:     'transform, opacity',
      }}
    >
      {/* Icon container */}
      <div style={{
        width:  '36px',
        height: '36px',
        borderRadius: '10px',
        background: hov && isActive ? 'rgba(37,99,235,0.32)' : 'rgba(37,99,235,0.16)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        transition:     'background 0.18s',
        flexShrink:      0,
      }}>
        <Icon size={17} color="#60a5fa" strokeWidth={1.9} />
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize:     '0.88rem',
          fontWeight:    700,
          color:         hov ? '#ffffff' : '#f0f6ff',
          lineHeight:    1.2,
          marginBottom: '3px',
          transition:   'color 0.15s',
        }}>
          {card.label}
        </div>
        <div style={{
          fontSize:  '0.71rem',
          color:     'rgba(163,192,255,0.55)',
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
  const navigate = useNavigate();

  /* React state — only for discrete events (re-renders for dots, card styling) */
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  /* ── Animation refs (no re-renders) ───────────────────────────────────────── */
  const activeIdxRef   = useRef(0);    /* mirrors activeIdx for RAF/event closures   */
  const targetRotRef   = useRef(0);    /* target cumulative rotation (degrees)        */
  const currentRotRef  = useRef(0);    /* current lerped rotation                     */
  const tiltRef        = useRef(0);    /* current lerped tilt (rotateX)               */
  const targetTiltRef  = useRef(0);    /* target tilt                                 */
  const pausedRef      = useRef(false);/* true while hovering or dragging             */
  const isDraggingRef  = useRef(false);
  const dragStartXRef  = useRef(0);
  const dragBaseRotRef = useRef(0);    /* targetRot at drag-start                     */
  const pressStartRef  = useRef({ x: 0, y: 0 });
  const lastAutoRef    = useRef(null); /* initialised to Date.now() on first RAF tick */

  /* DOM refs */
  const wheelRef  = useRef(null);  /* the preserve-3d wheel div                   */
  const sceneRef  = useRef(null);  /* perspective container — also event target   */
  const animRef   = useRef(null);

  /* ── Measure scene width for responsive sizing ─────────────────────────────── */
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = containerW > 0 && containerW <= 680;
  const { cardW, cardH, radius, persp } = getSizing(containerW);
  const sidePad = isMobile ? 36 : 52;

  /* ── Navigate to a card — computes shortest-path rotation ──────────────────── */
  const goToCard = useCallback((rawIdx) => {
    const newIdx = ((Math.round(rawIdx) % TOTAL) + TOTAL) % TOTAL;
    activeIdxRef.current = newIdx;
    setActiveIdx(newIdx);

    const targetDeg = -newIdx * ANGLE_STEP;
    const cur       = targetRotRef.current;
    /* normalise current mod 360 so we can pick the shortest arc */
    const curMod    = ((cur % 360) + 360) % 360;
    const tgtMod    = ((targetDeg % 360) + 360) % 360;
    let diff        = tgtMod - curMod;
    if (diff >= 180)  diff -= 360; /* prefer forward (counter-clockwise) rotation */
    if (diff < -180)  diff += 360;
    targetRotRef.current = cur + diff;
    lastAutoRef.current  = Date.now();
  }, []);

  const goNext = useCallback(() => goToCard(activeIdxRef.current + 1), [goToCard]);
  const goPrev = useCallback(() => goToCard(activeIdxRef.current - 1), [goToCard]);

  /* ── Single RAF animation loop ──────────────────────────────────────────────── */
  useEffect(() => {
    /* Set the auto-slide baseline here — safe since effects run after paint */
    lastAutoRef.current = Date.now();

    const animate = () => {
      /* Auto-advance when idle */
      if (!pausedRef.current && !isDraggingRef.current) {
        if (Date.now() - lastAutoRef.current >= AUTO_SLIDE_MS) {
          const next = (activeIdxRef.current + 1) % TOTAL;
          activeIdxRef.current = next;
          setActiveIdx(next);
          const tDeg = -next * ANGLE_STEP;
          const cur  = targetRotRef.current;
          const cMod = ((cur % 360) + 360) % 360;
          const tMod = ((tDeg % 360) + 360) % 360;
          let d = tMod - cMod;
          if (d >= 180)  d -= 360;
          if (d < -180)  d += 360;
          targetRotRef.current = cur + d;
          lastAutoRef.current  = Date.now();
        }
      }

      /* Lerp rotation */
      const rotDiff = targetRotRef.current - currentRotRef.current;
      currentRotRef.current += Math.abs(rotDiff) > 0.02 ? rotDiff * LERP_ROT : rotDiff;

      /* Lerp tilt */
      tiltRef.current += (targetTiltRef.current - tiltRef.current) * LERP_TILT;

      /* Apply wheel transform */
      if (wheelRef.current) {
        wheelRef.current.style.transform =
          `rotateX(${tiltRef.current.toFixed(3)}deg) rotateY(${currentRotRef.current.toFixed(3)}deg)`;
      }

      /* Per-card opacity: smooth fade based on current angle from viewer.
         wheelRef.current.children are the NavCard divs in NAV_CARDS order. */
      const wheelEl = wheelRef.current;
      if (wheelEl) {
        const rot = currentRotRef.current;
        const children = wheelEl.children;
        for (let i = 0; i < children.length; i++) {
          const eff  = ((i * ANGLE_STEP + rot) % 360 + 360) % 360;
          const dist = eff > 180 ? 360 - eff : eff; /* 0 = facing viewer */
          const op   = dist >= 90 ? 0 : 1 - (dist / 90) * OPACITY_FADE_FACTOR;
          children[i].style.opacity = op.toFixed(3);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []); /* pure ref-driven — no deps */

  /* ── Desktop: mouse-tilt on hover ─────────────────────────────────────────── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const onMouseMove = (e) => {
      if (isDraggingRef.current) return;
      const { top, height } = scene.getBoundingClientRect();
      const y = (e.clientY - top) / height - 0.5; /* −0.5 … +0.5 */
      targetTiltRef.current = -y * TILT_MAX * 2;
    };
    const onMouseLeave = () => { targetTiltRef.current = 0; };

    scene.addEventListener('mousemove',  onMouseMove);
    scene.addEventListener('mouseleave', onMouseLeave);
    return () => {
      scene.removeEventListener('mousemove',  onMouseMove);
      scene.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  /* ── Desktop: mouse drag ───────────────────────────────────────────────────── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const onMouseDown = (e) => {
      if (e.button !== 0) return; /* only handle primary (left) mouse button */
      e.preventDefault(); /* prevent text-selection highlight during drag */
      isDraggingRef.current  = true;
      pausedRef.current      = true;
      setIsDragging(true);
      dragStartXRef.current  = e.clientX;
      dragBaseRotRef.current = targetRotRef.current;
      pressStartRef.current  = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx      = e.clientX - dragStartXRef.current;
      /* Clamp live rotation to ±1 card step so one drag = one card max */
      const clamped = Math.max(-ANGLE_STEP * 0.9, Math.min(ANGLE_STEP * 0.9, dx * ROT_PER_PX));
      targetRotRef.current = dragBaseRotRef.current + clamped;
    };

    const onMouseUp = (e) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      pausedRef.current     = false;
      setIsDragging(false);
      const dx = e.clientX - dragStartXRef.current;
      if      (dx < -SWIPE_THRESHOLD) goNext();
      else if (dx >  SWIPE_THRESHOLD) goPrev();
      else                             goToCard(activeIdxRef.current); /* snap back */
    };

    scene.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      scene.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [goNext, goPrev, goToCard]);

  /* ── Mobile: touch swipe (snaps one card, no free scroll) ─────────────────── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const onTouchStart = (e) => {
      isDraggingRef.current  = true;
      pausedRef.current      = true;
      setIsDragging(true);
      dragStartXRef.current  = e.touches[0].clientX;
      dragBaseRotRef.current = targetRotRef.current;
      pressStartRef.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastAutoRef.current    = Date.now();
    };

    const onTouchMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.touches[0].clientX - dragStartXRef.current;
      const dy = e.touches[0].clientY - pressStartRef.current.y;
      /* Only intercept primarily-horizontal gestures to preserve vertical scroll */
      if (Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        const clamped = Math.max(-ANGLE_STEP * 0.9, Math.min(ANGLE_STEP * 0.9, dx * ROT_PER_PX));
        targetRotRef.current = dragBaseRotRef.current + clamped;
      }
    };

    const onTouchEnd = (e) => {
      isDraggingRef.current = false;
      pausedRef.current     = false;
      setIsDragging(false);
      const dx = e.changedTouches[0].clientX - dragStartXRef.current;
      if      (dx < -SWIPE_THRESHOLD) goNext();
      else if (dx >  SWIPE_THRESHOLD) goPrev();
      else                             goToCard(activeIdxRef.current); /* snap back */
    };

    scene.addEventListener('touchstart', onTouchStart, { passive: true });
    scene.addEventListener('touchmove',  onTouchMove,  { passive: false });
    scene.addEventListener('touchend',   onTouchEnd);
    return () => {
      scene.removeEventListener('touchstart', onTouchStart);
      scene.removeEventListener('touchmove',  onTouchMove);
      scene.removeEventListener('touchend',   onTouchEnd);
    };
  }, [goNext, goPrev, goToCard]);

  /* Hover pause */
  const onEnter = useCallback(() => { pausedRef.current = true;  }, []);
  const onLeave = useCallback(() => { pausedRef.current = false; }, []);

  return (
    <div style={{ width: '100%', position: 'relative', padding: '0 0 32px' }}>

      {/* Section eyebrow */}
      <p style={{
        textAlign:     'center',
        fontSize:      '0.60rem',
        fontWeight:     800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color:          'rgba(148,163,184,0.38)',
        fontFamily:    'var(--font-mono, monospace)',
        margin:        '0 0 14px',
      }}>
        Navigate
      </p>

      {/* Outer shell — provides arrow clearance via padding */}
      <div style={{
        maxWidth: '900px',
        margin:   '0 auto',
        padding:  `0 ${sidePad}px`,
        position: 'relative',
      }}>
        <ArrowBtn direction="left"  onClick={goPrev} isMobile={isMobile} />

        {/* Perspective scene — measured for responsive sizing */}
        <div
          ref={sceneRef}
          style={{
            width:             '100%',
            height:            `${cardH + 60}px`,
            perspective:       `${persp}px`,
            perspectiveOrigin: '50% 44%',
            position:          'relative',
            cursor:             isDragging ? 'grabbing' : 'grab',
            userSelect:        'none',
            touchAction:       'pan-y', /* allow vertical scroll; horizontal is ours */
          }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          {/* Wheel — rotates in 3D, all cards are children */}
          <div
            ref={wheelRef}
            style={{
              position:       'absolute',
              left:           '50%',
              top:            '50%',
              width:          `${cardW}px`,
              height:         `${cardH}px`,
              marginLeft:     `-${cardW / 2}px`,
              marginTop:      `-${cardH / 2}px`,
              transformStyle: 'preserve-3d',
              transform:      'rotateX(0deg) rotateY(0deg)',
            }}
          >
            {NAV_CARDS.map((card, i) => (
              <NavCard
                key={card.id}
                card={card}
                cardAngle={i * ANGLE_STEP}
                radius={radius}
                cardW={cardW}
                cardH={cardH}
                isActive={i === activeIdx}
                onTap={(to) => navigate(to)}
              />
            ))}
          </div>
        </div>

        <ArrowBtn direction="right" onClick={goNext} isMobile={isMobile} />
      </div>

      {/* Dot / pill progress indicators — one per card */}
      <div style={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        gap:            '5px',
        marginTop:      '14px',
      }}>
        {NAV_CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => goToCard(i)}
            aria-label={`Go to ${card.label}`}
            style={{
              width:      i === activeIdx ? '18px' : '6px',
              height:     '6px',
              borderRadius: '3px',
              border:     'none',
              background:  i === activeIdx ? 'rgba(96,165,250,0.85)' : 'rgba(148,163,184,0.22)',
              cursor:     'pointer',
              padding:     0,
              transition: 'width 0.28s ease, background 0.28s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
