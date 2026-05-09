/**
 * ui/NavigationCarousel.jsx — Fixed-center 3D navigation carousel
 *
 * The carousel uses deterministic 3D card slots instead of rotating the entire
 * wheel/container. This keeps the active card locked to the viewport center
 * while preserving a 3D angled-card effect for neighboring cards.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const NAV_CARDS = [
  { id: 'products', label: 'Products', sub: 'Full catalog', to: '/all-products' },
  { id: 'parts', label: 'Parts', sub: 'Replacement parts', to: '/parts' },
  { id: 'schematics', label: 'Schematics', sub: 'Tool diagrams', to: '/schematics' },
  { id: 'calculator', label: 'Calculator', sub: 'Estimate materials', to: '/calculators' },
  { id: 'toolsets', label: 'Tool Sets', sub: 'Complete kits', to: '/toolset-builder' },
  { id: 'repairs', label: 'Repairs', sub: 'Expert service', to: '/repairs' },
];

const TOTAL = NAV_CARDS.length;
const AUTO_SLIDE_MS = 10000;
const SWIPE_THRESHOLD = 30;
const DRAG_TAP_LIMIT = 8;
const DRAG_RESISTANCE = 0.42;
const MAX_DRAG_OFFSET = 0.84;

function wrapIndex(index) {
  return ((index % TOTAL) + TOTAL) % TOTAL;
}

function shortestOffset(index, activeIndex) {
  let offset = index - activeIndex;
  if (offset > TOTAL / 2) offset -= TOTAL;
  if (offset < -TOTAL / 2) offset += TOTAL;
  return offset;
}

function getSizing(w) {
  const viewportW = Math.max(320, w || 390);
  const cardW = Math.round(Math.max(160, Math.min(200, viewportW * 0.48)));
  const cardH = Math.round(cardW * 0.9);
  const sideOffset = Math.round(Math.max(cardW * 0.74, Math.min(viewportW * 0.31, cardW * 0.9)));
  const depth = Math.round(cardW * 0.4);
  const persp = Math.round(Math.max(760, viewportW * 2.3));
  return { cardW, cardH, sideOffset, depth, persp };
}

function ArrowBtn({ direction, onClick, isMobile }) {
  const [hov, setHov] = useState(false);
  const sz = isMobile ? 30 : 40;
  const icSz = isMobile ? 14 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Previous' : 'Next'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: isMobile ? '10px' : 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 30,
        width: `${sz}px`,
        height: `${sz}px`,
        borderRadius: '50%',
        border: `1px solid ${hov ? 'rgba(99,149,255,0.40)' : 'rgba(99,149,255,0.22)'}`,
        background: hov ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)',
        color: hov ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.18s, color 0.18s, border-color 0.18s',
        backdropFilter: 'blur(8px)',
        padding: 0,
      }}
    >
      {direction === 'left' ? <ChevronLeft size={icSz} /> : <ChevronRight size={icSz} />}
    </button>
  );
}

function getSlotTransform(offset, dragOffset, sideOffset, depth) {
  const virtual = offset + dragOffset;
  const abs = Math.abs(virtual);
  const clamped = Math.max(-2, Math.min(2, virtual));
  const x = clamped * sideOffset;
  const z = -Math.min(abs, 2) * depth;
  const rotateY = Math.max(-46, Math.min(46, -clamped * 34));
  const scale = Math.max(0.72, 1 - Math.min(abs, 2) * 0.14);

  return {
    transform: `translate3d(calc(-50% + ${x.toFixed(2)}px), -50%, ${z.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    opacity: abs > 2.15 ? 0 : abs > 1.65 ? 0.32 : abs > 0.65 ? 0.58 : 1,
    zIndex: Math.round(100 - abs * 20),
    pointerEvents: abs < 0.42 ? 'auto' : 'none',
  };
}

function NavCard({ card, cardW, cardH, isActive, slotStyle, onTap }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      role="button"
      tabIndex={isActive ? 0 : -1}
      onKeyDown={(e) => { if (isActive && (e.key === 'Enter' || e.key === ' ')) onTap(card.to); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={`Navigate to ${card.label}`}
      aria-hidden={!isActive}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        boxSizing: 'border-box',
        width: `${cardW}px`,
        height: `${cardH}px`,
        transform: slotStyle.transform,
        opacity: slotStyle.opacity,
        zIndex: slotStyle.zIndex,
        pointerEvents: slotStyle.pointerEvents,
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        padding: '16px',
        borderRadius: '18px',
        border: `1px solid ${hov && isActive ? 'rgba(255,255,255,0.68)' : isActive ? 'rgba(226,232,240,0.56)' : 'rgba(226,232,240,0.28)'}`,
        background: isActive
          ? 'linear-gradient(160deg, rgba(255,255,255,0.30) 0%, rgba(232,240,250,0.20) 35%, rgba(203,213,225,0.13) 65%, rgba(255,255,255,0.30) 100%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.20) 0%, rgba(232,240,250,0.12) 35%, rgba(203,213,225,0.09) 65%, rgba(255,255,255,0.20) 100%)',
        cursor: isActive ? 'pointer' : 'default',
        transition: 'transform 560ms cubic-bezier(0.18, 0.9, 0.25, 1), opacity 420ms ease, border-color 220ms ease, box-shadow 220ms ease',
        boxShadow: isActive
          ? (hov
              ? '0 16px 38px rgba(15,23,42,0.22), 0 0 0 1px rgba(255,255,255,0.56)'
              : '0 12px 30px rgba(15,23,42,0.20), 0 0 0 1px rgba(255,255,255,0.40)')
          : '0 8px 20px rgba(15,23,42,0.16)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        gap: '6px',
        outline: 'none',
        overflow: 'hidden',
        willChange: 'transform, opacity',
        backgroundSize: '200% 200%',
        animation: 'dtb-nav-metallic-shift 6s ease-in-out infinite',
      }}
    >
      <div style={{
        fontSize: 'clamp(1rem, 4vw, 1.18rem)',
        fontWeight: 800,
        color: isActive ? (hov ? '#020617' : '#0f172a') : 'rgba(248,250,252,0.90)',
        lineHeight: 1.08,
        letterSpacing: '0.04em',
        transition: 'color 0.15s',
      }}>
        {card.label}
      </div>

      <div style={{
        fontSize: 'clamp(0.62rem, 1.8vw, 0.72rem)',
        fontWeight: 500,
        color: isActive ? 'rgba(15,23,42,0.52)' : 'rgba(226,232,240,0.74)',
        lineHeight: 1.3,
        letterSpacing: '0.02em',
        transition: 'color 0.15s',
      }}>
        {card.sub}
      </div>
    </div>
  );
}

export default function NavigationCarousel() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const activeIdxRef = useRef(0);
  const pausedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastAutoRef = useRef(0);
  const sceneRef = useRef(null);

  useEffect(() => {
    lastAutoRef.current = Date.now();
  }, []);

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
  const { cardW, cardH, sideOffset, depth, persp } = getSizing(containerW);
  const sidePad = isMobile ? 40 : 52;

  const setCenteredIndex = useCallback((rawIdx) => {
    const newIdx = wrapIndex(rawIdx);
    activeIdxRef.current = newIdx;
    setActiveIdx(newIdx);
    setDragOffset(0);
    lastAutoRef.current = Date.now();
  }, []);

  const goNext = useCallback(() => setCenteredIndex(activeIdxRef.current + 1), [setCenteredIndex]);
  const goPrev = useCallback(() => setCenteredIndex(activeIdxRef.current - 1), [setCenteredIndex]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current && !isDraggingRef.current && Date.now() - lastAutoRef.current >= AUTO_SLIDE_MS) goNext();
    }, 250);
    return () => window.clearInterval(id);
  }, [goNext]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDraggingRef.current = true;
      pausedRef.current = true;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      scene.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        const nextOffset = Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, (dx / Math.max(sideOffset, 1)) * DRAG_RESISTANCE));
        setDragOffset(nextOffset);
      }
    };

    const finishDrag = (e) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      pausedRef.current = false;
      setIsDragging(false);
      scene.releasePointerCapture?.(e.pointerId);

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setDragOffset(0);
      if (dx < -SWIPE_THRESHOLD) {
        goNext();
      } else if (dx > SWIPE_THRESHOLD) {
        goPrev();
      } else if (Math.abs(dx) < DRAG_TAP_LIMIT && Math.abs(dy) < DRAG_TAP_LIMIT) {
        // Tap (not a swipe) — navigate to the active card.
        // setPointerCapture() on the scene prevents NavCard.onPointerUp from firing,
        // so navigation must be handled here instead.
        navigate(NAV_CARDS[activeIdxRef.current].to);
      } else {
        setCenteredIndex(activeIdxRef.current);
      }
    };

    scene.addEventListener('pointerdown', onPointerDown);
    scene.addEventListener('pointermove', onPointerMove, { passive: false });
    scene.addEventListener('pointerup', finishDrag);
    scene.addEventListener('pointercancel', finishDrag);

    return () => {
      scene.removeEventListener('pointerdown', onPointerDown);
      scene.removeEventListener('pointermove', onPointerMove);
      scene.removeEventListener('pointerup', finishDrag);
      scene.removeEventListener('pointercancel', finishDrag);
    };
  }, [goNext, goPrev, navigate, setCenteredIndex, sideOffset]);

  const onEnter = useCallback(() => { pausedRef.current = true; }, []);
  const onLeave = useCallback(() => { pausedRef.current = false; }, []);

  return (
    <div style={{ width: '100%', position: 'relative', padding: '4px 0 28px', overflow: 'hidden' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: `0 ${sidePad}px`, position: 'relative', overflow: 'visible' }}>
        <ArrowBtn direction="left" onClick={goPrev} isMobile={isMobile} />
        <div
          ref={sceneRef}
          style={{
            width: '100%',
            height: `${cardH + 96}px`,
            perspective: `${persp}px`,
            perspectiveOrigin: '50% 50%',
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'pan-y',
            overflow: 'visible',
            clipPath: 'inset(-32px 0 -32px 0)',
            overscrollBehaviorX: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformStyle: 'preserve-3d',
            }}
          >
            {NAV_CARDS.map((card, i) => {
              const offset = shortestOffset(i, activeIdx);
              const slotStyle = getSlotTransform(offset, dragOffset, sideOffset, depth);
              return (
                <NavCard
                  key={card.id}
                  card={card}
                  cardW={cardW}
                  cardH={cardH}
                  isActive={i === activeIdx}
                  slotStyle={slotStyle}
                  onTap={(to) => navigate(to)}
                />
              );
            })}
          </div>
        </div>
        <ArrowBtn direction="right" onClick={goNext} isMobile={isMobile} />
      </div>
      <style>{`
        @keyframes dtb-nav-metallic-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
