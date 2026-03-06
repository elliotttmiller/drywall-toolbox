import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import BrandSelector from '../components/BrandSelector';
import ToolSelector from '../components/ToolSelector';
import { loadProducts } from '../data/products';
import '../styles/mobile-schematic.css';
import schematic13Data from '../../schematics/brands/TapeTech/products/13TT_SCH_hotspots/schematic_data.json';
import schematic13Img from '../../schematics/brands/TapeTech/products/13TT_SCH_hotspots/images/page_1.png';
import schematic88Data from '../../schematics/brands/TapeTech/products/88TTR_SCH_hotspots/schematic_data.json';
import schematic88Img from '../../schematics/brands/TapeTech/products/88TTR_SCH_hotspots/images/page_2.png';
import schematic88ImgPage3 from '../../schematics/brands/TapeTech/products/88TTR_SCH_hotspots/images/page_3.png';
import schematicNS02Data from '../../schematics/brands/TapeTech/products/NS02TT_SCH_hotspots/schematic_data.json';
import schematicNS02Img from '../../schematics/brands/TapeTech/products/NS02TT_SCH_hotspots/images/page_1.png';
import schematic73Data from '../../schematics/brands/TapeTech/products/73TT_SCH_hotspots/schematic_data.json';
import schematic73Img from '../../schematics/brands/TapeTech/products/73TT_SCH_hotspots/images/page_2.png';
import schematicPAHC10Data from '../../schematics/brands/TapeTech/products/PAHC10_SCH_v2_hotspots/schematic_data.json';
import schematicPAHC10Img from '../../schematics/brands/TapeTech/products/PAHC10_SCH_v2_hotspots/images/page_1.png';

const columbiaInsideCornerRollerImg = '/drywall-toolbox/brands/Columbia/Schematics/InsideCornerRoller/InsideCornerRoller-2014_1_-enhanced-squared.png';
const columbiaMatrixBoxHandleImg = '/drywall-toolbox/brands/Columbia/Schematics/MatrixBoxHandle/Matrix_Handle-enhanced-square.png';

// ─── SCHEMATIC VIEWER CONSTANTS ───────────────────────────────────────────────
const MAX_SCALE = 5;                  // maximum zoom level
const ZOOM_STEP = 0.5;                // zoom button increment
const WHEEL_ZOOM_FACTOR = 1.12;       // multiplicative step for ctrl+wheel / trackpad pinch
const DOUBLE_TAP_TIME_MS = 300;       // max ms between taps to count as double-tap
const DOUBLE_TAP_DISTANCE_PX = 40;   // max px between taps to count as double-tap
const DOUBLE_TAP_ZOOM_SCALE = 2.5;   // zoom level applied on double-tap
const PAN_THRESHOLD_PX = 8;          // min drag distance before pan activates
const INERTIA_FRICTION = 0.92;       // per-frame velocity multiplier (1 = no friction)
const INERTIA_MIN_VEL = 0.4;         // px/frame below which inertia stops
const VELOCITY_SMOOTHING_ALPHA = 0.75; // EMA weight for latest velocity sample
const ZOOM_ANIMATION_MS = 250;       // CSS transition duration for animated zoom
const WHEEL_SYNC_DEBOUNCE_MS = 150;  // ms to debounce React state sync after wheel
// ─────────────────────────────────────────────────────────────────────────────

export default function Parts() {
  // Allowed brands to display
  const ALLOWED_BRANDS = [
    'TapeTech',
    'Columbia Taping Tools',
    'Asgard',
    'SurPro',
    'Graco'
  ];

  // Selection flow state
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedSchematic, setSelectedSchematic] = useState(null);
  
  // Schematic viewer state
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [activeHotspotPart, setActiveHotspotPart] = useState(null);
  const [toast, setToast] = useState(null);
  const [brands, setBrands] = useState([]);
  const { addToCart } = useCart();
  
  // Zoom/pan: scale in React state drives UI elements (overflow, cursor, indicator)
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  // Fullscreen is always enabled on mobile, never on desktop
  const isFullscreen = isMobile;

  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs for live gesture state — no React re-renders during 60 fps gestures
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1, initPanX: 0, initPanY: 0, centerX: 0, centerY: 0 });
  const panRef = useRef({ active: false, startClientX: 0, startClientY: 0, startPanX: 0, startPanY: 0, moved: false });
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 });
  const inertiaIdRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const wheelSyncTimeoutRef = useRef(null);

  const schematicContainerRef = useRef(null);
  const schematicImageRef = useRef(null);

  // Load products on mount
  useEffect(() => {
    loadProducts().then(prods => {
      // Extract unique brands and filter to only allowed brands
      const uniqueBrands = [...new Set(prods.map(p => p.brand).filter(Boolean))].sort();
      const filteredBrands = uniqueBrands.filter(brand => ALLOWED_BRANDS.includes(brand));
      setBrands(filteredBrands);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schematic data for tools
  // Build 13TT schematic parts from JSON data
  const schematic13Parts = (schematic13Data && schematic13Data.parts) ? schematic13Data.parts.map((p) => {
    const coords = schematic13Data.coordinates || {};
    // coordinates keys are strings matching part ids
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematic13Data.diagramPages && schematic13Data.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || '',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }) : [];
  // Build 88TTR schematic parts using coordinates for page 2 (first diagram page)
  const schematic88Parts = (schematic88Data && schematic88Data.parts) ? schematic88Data.parts.map((p) => {
    const coords = schematic88Data.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematic88Data.diagramPages && schematic88Data.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || '',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }).filter(Boolean) : [];
  // Build NS02TT schematic parts from JSON data
  const schematicNS02Parts = (schematicNS02Data && schematicNS02Data.parts) ? schematicNS02Data.parts.map((p) => {
    const coords = schematicNS02Data.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematicNS02Data.diagramPages && schematicNS02Data.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || '',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }).filter(Boolean) : [];
  // Build 73TT schematic parts from JSON data
  const schematic73Parts = (schematic73Data && schematic73Data.parts) ? schematic73Data.parts.map((p) => {
    const coords = schematic73Data.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematic73Data.diagramPages && schematic73Data.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || '',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }) : [];
  // Build PAHC10 v2 schematic parts from JSON data
  const schematicPAHC10Parts = (schematicPAHC10Data && schematicPAHC10Data.parts) ? schematicPAHC10Data.parts.map((p) => {
    const coords = schematicPAHC10Data.coordinates || {};
    // Parts in this schematic may have empty `id` fields but valid `sku` values.
    // Use sku as the primary lookup key when id is missing so coordinates (which
    // are keyed by SKU) are found and hotspots render in the right place.
    const lookupKey = (p.id && String(p.id).trim() !== '') ? String(p.id) : (p.sku || p.SKU || '');
    const c = lookupKey && (coords[lookupKey] || coords[String(Number(lookupKey))]) ? (coords[lookupKey] || coords[String(Number(lookupKey))]) : null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematicPAHC10Data.diagramPages && schematicPAHC10Data.diagramPages[0]) || 1;
    return {
      id: p.id && String(p.id).trim() !== '' ? p.id : (p.sku || p.SKU || ''),
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || '',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }) : [];
  const schematics = [
    {
      id: 'tapetech-13tt',
        title: '13TT',
        description: 'Interactive schematic for TapeTech 13TT with hotspots',
        brand: 'TapeTech',
        productPartNumber: null,
        // single-page schematic -- page 1
        diagramPages: schematic13Data.diagramPages || [1],
        imagePages: {
          [schematic13Data.diagramPages ? schematic13Data.diagramPages[0] : 1]: schematic13Img
        },
        parts: schematic13Parts
      },
      {
        id: 'tapetech-88ttr',
          title: '88TTR',
          description: 'Interactive schematic for TapeTech 88TTR (multi-page). Use the pager to switch diagram pages',
          brand: 'TapeTech',
          productPartNumber: null,
          diagramPages: schematic88Data.diagramPages || [2],
          imagePages: {
            // diagramPages reference page numbers from the original PDF export
            2: schematic88Img,
            3: schematic88ImgPage3
          },
          parts: schematic88Parts
        },
    {
      id: 'tapetech-73tt',
      title: '73TT',
      description: 'Interactive schematic for TapeTech 73TT (hotspots & parts)',
      brand: 'TapeTech',
      productPartNumber: null,
      diagramPages: schematic73Data.diagramPages || [2],
      imagePages: {
        [schematic73Data.diagramPages ? schematic73Data.diagramPages[0] : 2]: schematic73Img
      },
      parts: schematic73Parts
    },
    {
      id: 'tapetech-pahc10-v2',
      title: 'PAHC10 v2',
      description: 'Interactive schematic for TapeTech PAHC10 (v2) - hotspots & parts',
      brand: 'TapeTech',
      productPartNumber: null,
      diagramPages: schematicPAHC10Data.diagramPages || [1],
      imagePages: {
        [schematicPAHC10Data.diagramPages ? schematicPAHC10Data.diagramPages[0] : 1]: schematicPAHC10Img
      },
      parts: schematicPAHC10Parts
    },
    {
      id: 'tapetech-nail-spotter-2',
      title: '2" Nail Spotter',
      description: 'Professional 2" EasyClean Nail Spotter - Model NS02TT',
      brand: 'TapeTech',
      productPartNumber: 'NS02TT',
      diagramPages: schematicNS02Data.diagramPages || [1],
      imagePages: {
        [schematicNS02Data.diagramPages ? schematicNS02Data.diagramPages[0] : 1]: schematicNS02Img
      },
      parts: schematicNS02Parts
    },
    {
      id: 'tapetech-corner-finisher-t5',
      title: 'T5 Corner Finisher',
      description: 'Precision Corner Finisher Assembly - Model T05CF (Main Components)',
      brand: 'TapeTech',
      productPartNumber: 'T05CF',
      image: '/T05CF_SCH-9.png',
      parts: [
        { id: '499023', name: 'Finisher Blade', sku: '499023', material: 'STAINLESS-STEEL', price: 24.50, position: { top: '50.38%', left: '77.25%' }, quantity: 1 },
        { id: '800856', name: 'Main Body casting', sku: '800856', material: 'ALUMINUM', price: 85.00, position: { top: '72.35%', left: '53.70%' }, quantity: 1 },
        { id: '800857', name: 'Upper Frame', sku: '800857', material: 'STEEL', price: 42.00, position: { top: '60.95%', left: '34.60%' }, quantity: 1 },
        { id: '800858', name: 'Lower Frame', sku: '800858', material: 'STEEL', price: 42.00, position: { top: '63.30%', left: '29.10%' }, quantity: 1 },
        { id: '809860', name: 'Adjuster Pin', sku: '809860', material: 'STEEL', price: 12.50, position: { top: '58.25%', left: '39.80%' }, quantity: 1 },
        { id: '809861', name: 'Spring Retainer', sku: '809861', material: 'PLASTIC', price: 5.50, position: { top: '78.45%', left: '38.50%' }, quantity: 1 },
        { id: '809862', name: 'Cushion Spring', sku: '809862', material: 'STEEL', price: 8.00, position: { top: '82.90%', left: '24.10%' }, quantity: 1 }
      ]
    },
    {
      id: 'auto-taper',
      title: 'Automatic Taper G2',
      description: 'Professional automatic taping tool with precision components',
      parts: [
        {
          id: 1,
          name: 'High-Tension Pressure Plate',
          sku: 'DT-9920',
          material: 'ALLOY-T6',
          price: 42.00,
          position: { top: '25%', left: '45%' }
        },
        {
          id: 2,
          name: 'Main Drive Bearing',
          sku: 'DT-1104',
          material: 'CHROME-STEEL',
          price: 18.50,
          position: { top: '50%', left: '25%' }
        },
        {
          id: 3,
          name: 'Flow Control Nozzle',
          sku: 'DT-4402',
          material: 'PRECISION-ABS',
          price: 29.99,
          position: { top: '50%', left: '75%' }
        }
      ],
      svg: (
        <svg className="schematic-svg" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
          <rect x="200" y="150" width="400" height="100" rx="10" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <circle cx="200" cy="200" r="40" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <line x1="600" y1="200" x2="700" y2="200" stroke="var(--alloy-edge)" strokeWidth="2"/>
          <rect x="250" y="100" width="300" height="50" rx="5" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
        </svg>
      )
    },
    {
      id: 'corner-finisher',
      title: 'Corner Finisher 3.5"',
      description: 'Precision corner finishing tool for perfect angles',
      parts: [
        {
          id: 4,
          name: 'Corner Guide Rail',
          sku: 'CF-2201',
          material: 'STAINLESS-STEEL',
          price: 35.00,
          position: { top: '30%', left: '35%' }
        },
        {
          id: 5,
          name: 'Wheel Assembly',
          sku: 'CF-2202',
          material: 'RUBBER-COMPOSITE',
          price: 24.50,
          position: { top: '60%', left: '60%' }
        }
      ],
      svg: (
        <svg className="schematic-svg" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
          <path d="M 200 100 L 400 100 L 400 300 L 200 300 Z" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <circle cx="300" cy="150" r="30" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <circle cx="300" cy="250" r="30" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <line x1="400" y1="200" x2="550" y2="200" stroke="var(--alloy-edge)" strokeWidth="2"/>
        </svg>
      )
    },
    {
      id: 'flat-box',
      title: '12" Mega Flat Box',
      description: 'High-capacity flat box for smooth wall finishing',
      parts: [
        {
          id: 6,
          name: 'Blade Insert',
          sku: 'FB-5501',
          material: 'CARBON-STEEL',
          price: 52.00,
          position: { top: '40%', left: '50%' }
        },
        {
          id: 7,
          name: 'Handle Grip',
          sku: 'FB-5502',
          material: 'ERGONOMIC-POLYMER',
          price: 15.99,
          position: { top: '25%', left: '70%' }
        },
        {
          id: 8,
          name: 'Wheel Set',
          sku: 'FB-5503',
          material: 'POLYURETHANE',
          price: 28.00,
          position: { top: '65%', left: '45%' }
        }
      ],
      svg: (
        <svg className="schematic-svg" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
          <rect x="150" y="150" width="500" height="100" rx="15" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <circle cx="200" cy="250" r="20" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <circle cx="600" cy="250" r="20" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <line x1="350" y1="150" x2="450" y2="150" stroke="var(--tension-accent)" strokeWidth="2"/>
        </svg>
      )
    },
    {
      id: 'mud-pump',
      title: 'Mud Pump Pro',
      description: 'Heavy-duty compound pump with variable flow control',
      parts: [
        {
          id: 9,
          name: 'Pump Cylinder',
          sku: 'MP-8801',
          material: 'STAINLESS-STEEL',
          price: 125.00,
          position: { top: '35%', left: '40%' }
        },
        {
          id: 10,
          name: 'Valve Assembly',
          sku: 'MP-8802',
          material: 'BRASS',
          price: 68.50,
          position: { top: '60%', left: '55%' }
        }
      ],
      svg: (
        <svg className="schematic-svg" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
          <circle cx="400" cy="200" r="80" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <rect x="300" y="180" width="200" height="40" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <line x1="400" y1="120" x2="400" y2="80" stroke="var(--alloy-edge)" strokeWidth="3"/>
          <circle cx="400" cy="60" r="15" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
        </svg>
      )
    },
    {
      id: 'extendable-handle',
      title: 'Extendable Handle System',
      description: 'Telescopic handle with quick-lock mechanism',
      parts: [
        {
          id: 11,
          name: 'Quick-Lock Mechanism',
          sku: 'EH-3301',
          material: 'ZINC-ALLOY',
          price: 45.00,
          position: { top: '35%', left: '50%' }
        },
        {
          id: 12,
          name: 'Extension Tube',
          sku: 'EH-3302',
          material: 'ALUMINUM',
          price: 32.50,
          position: { top: '55%', left: '50%' }
        }
      ],
      svg: (
        <svg className="schematic-svg" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
          <line x1="400" y1="100" x2="400" y2="300" stroke="var(--alloy-edge)" strokeWidth="8"/>
          <rect x="375" y="150" width="50" height="30" stroke="var(--alloy-edge)" fill="var(--alloy-deep)" strokeWidth="2"/>
          <circle cx="400" cy="100" r="20" stroke="var(--alloy-edge)" fill="none" strokeWidth="2"/>
          <line x1="350" y1="165" x2="450" y2="165" stroke="var(--tension-accent)" strokeWidth="2"/>
        </svg>
      )
    },
    {
      id: 'columbia-inside-corner-roller',
      title: 'Inside Corner Roller',
      description: 'Professional inside corner roller for smooth corner finishing',
      brand: 'Columbia Taping Tools',
      productPartNumber: null,
      diagramPages: [1],
      imagePages: {
        1: columbiaInsideCornerRollerImg
      },
      parts: [
        {
          id: '01',
          name: 'Handle',
          sku: 'ICR-001',
          quantity: 1,
          material: 'WOOD',
          price: 18.50,
          position: { top: '25%', left: '50%' },
          pageNumber: 1
        },
        {
          id: '02',
          name: 'Roller Head Assembly',
          sku: 'ICR-002',
          quantity: 1,
          material: 'ALUMINUM',
          price: 42.00,
          position: { top: '60%', left: '50%' },
          pageNumber: 1
        },
        {
          id: '03',
          name: 'Wheel Insert',
          sku: 'ICR-003',
          quantity: 2,
          material: 'POLYURETHANE',
          price: 15.99,
          position: { top: '75%', left: '45%' },
          pageNumber: 1
        }
      ]
    },
    {
      id: 'columbia-matrix-box-handle',
      title: 'Matrix Box Handle',
      description: 'Professional matrix box handle for mud application',
      brand: 'Columbia Taping Tools',
      productPartNumber: null,
      diagramPages: [1],
      imagePages: {
        1: columbiaMatrixBoxHandleImg
      },
      parts: [
        {
          id: '01',
          name: 'Main Handle',
          sku: 'MBH-001',
          quantity: 1,
          material: 'WOOD',
          price: 22.00,
          position: { top: '25%', left: '50%' },
          pageNumber: 1
        },
        {
          id: '02',
          name: 'Handle Bracket',
          sku: 'MBH-002',
          quantity: 1,
          material: 'ALUMINUM',
          price: 35.50,
          position: { top: '50%', left: '50%' },
          pageNumber: 1
        },
        {
          id: '03',
          name: 'Grip Pad',
          sku: 'MBH-003',
          quantity: 1,
          material: 'RUBBER',
          price: 8.99,
          position: { top: '70%', left: '50%' },
          pageNumber: 1
        }
      ]
    }
  ];

  // Filter schematics to only include tools from allowed brands
  const allowedSchematics = schematics.filter(s => !s.brand || ALLOWED_BRANDS.includes(s.brand));

  // When schematic changes we reset the page in the schematic selector's onChange handler below.
  const currentSchematic = allowedSchematics.find(s => s.id === selectedSchematic);
  const [currentPage, setCurrentPage] = useState(1);

  // When schematic changes we reset the page in the schematic selector's onChange handler below.

  // Pick the image for the currently selected diagram page (if available)
  const schematicImageSrc = currentSchematic
    ? (currentSchematic.imagePages && currentSchematic.imagePages[currentPage]) || currentSchematic.image || null
    : null;

  const handleAddToCart = (part) => {
    // Create a product object compatible with the cart system
    const cartProduct = {
      id: part.sku, // Use SKU as unique ID
      name: part.name,
      brand: currentSchematic?.brand || selectedBrand || 'Parts', // Use actual brand
      price: part.price,
      part_number: part.sku,
      image: '/placeholder-part.png', // Can be updated later with actual images
    };
    
    addToCart(cartProduct, 1);
    setToast({
      message: `${part.name} added to cart!`,
      type: 'cart'
    });
    setActiveHotspot(null); // Close modal after adding
    setActiveHotspotPart(null);
  };

  const closeModal = () => {
    setActiveHotspot(null);
    setActiveHotspotPart(null);
  };

  // ─── ZOOM / PAN ENGINE ───────────────────────────────────────────────────────

  // Compute pan bounds for a given scale value
  const clampXY = useCallback((sc, x, y) => {
    const container = schematicContainerRef.current;
    const imgDiv = schematicImageRef.current;
    const containerW = container ? container.offsetWidth : 400;
    // Use the inner div's rendered height for accurate Y bounds.
    // Schematics are typically landscape (wider than tall), so containerW is a
    // reasonable square fallback when the ref isn't available yet.
    const divH = imgDiv ? imgDiv.offsetHeight : containerW;
    const maxX = Math.max(0, (sc - 1) * containerW / 2);
    const maxY = Math.max(0, (sc - 1) * divH / 2);
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  }, []);

  // Apply transform directly to the DOM element — bypasses React re-renders
  // for buttery-smooth 60 fps gesture updates.
  const applyTransform = useCallback((sc, x, y, animated = false) => {
    const { x: cx, y: cy } = clampXY(sc, x, y);
    transformRef.current = { scale: sc, x: cx, y: cy };
    const el = schematicImageRef.current;
    if (el) {
      el.style.transition = animated
        ? `transform ${ZOOM_ANIMATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
        : 'none';
      el.style.transform = `scale(${sc}) translate(${cx / sc}px, ${cy / sc}px)`;
    }
    // Update container overflow / cursor immediately when crossing scale=1
    const container = schematicContainerRef.current;
    if (container) {
      const zoomed = sc > 1;
      container.style.overflow = zoomed ? 'hidden' : 'visible';
      container.style.touchAction = zoomed ? 'none' : 'auto';
    }
  }, [clampXY]);

  // Sync the React scale state from the live ref (drives UI: indicator, buttons)
  const syncScale = useCallback(() => {
    setScale(transformRef.current.scale);
  }, []);

  // ─── INERTIA ─────────────────────────────────────────────────────────────────

  const stopInertia = useCallback(() => {
    if (inertiaIdRef.current !== null) {
      cancelAnimationFrame(inertiaIdRef.current);
      inertiaIdRef.current = null;
    }
  }, []);

  const startInertia = useCallback((vx, vy) => {
    stopInertia();
    let velX = vx;
    let velY = vy;
    const tick = () => {
      velX *= INERTIA_FRICTION;
      velY *= INERTIA_FRICTION;
      if (Math.abs(velX) < INERTIA_MIN_VEL && Math.abs(velY) < INERTIA_MIN_VEL) {
        syncScale();
        inertiaIdRef.current = null;
        return;
      }
      const { scale: sc, x, y } = transformRef.current;
      applyTransform(sc, x + velX, y + velY);
      inertiaIdRef.current = requestAnimationFrame(tick);
    };
    inertiaIdRef.current = requestAnimationFrame(tick);
  }, [stopInertia, syncScale, applyTransform]);

  // ─── TOUCH HANDLERS ──────────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e) => {
    stopInertia();

    if (e.touches.length === 2) {
      // ── Pinch begin ──────────────────────────────────────────────
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const container = schematicContainerRef.current;
      const rect = container
        ? container.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 };
      const midX = (t1.clientX + t2.clientX) / 2 - (rect.left + rect.width / 2);
      const midY = (t1.clientY + t2.clientY) / 2 - (rect.top + rect.height / 2);
      const { scale: sc, x, y } = transformRef.current;
      pinchRef.current = {
        active: true, initDist: dist, initScale: sc,
        initPanX: x, initPanY: y, centerX: midX, centerY: midY,
      };
      panRef.current.active = false;

    } else if (e.touches.length === 1) {
      // ── Single-finger: check for double-tap or start pan ─────────
      const touch = e.touches[0];
      const now = Date.now();
      const { time: lastTime, x: lastX, y: lastY } = lastTapRef.current;
      const tapDist = Math.hypot(touch.clientX - lastX, touch.clientY - lastY);

      if (now - lastTime < DOUBLE_TAP_TIME_MS && tapDist < DOUBLE_TAP_DISTANCE_PX) {
        // ── Double-tap zoom ──────────────────────────────────────────
        e.preventDefault();
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        const { scale: sc } = transformRef.current;
        if (sc > 1) {
          applyTransform(1, 0, 0, true);
          setTimeout(syncScale, ZOOM_ANIMATION_MS + 10);
        } else {
          const container = schematicContainerRef.current;
          const rect = container
            ? container.getBoundingClientRect()
            : { left: 0, top: 0, width: 0, height: 0 };
          const tapX = touch.clientX - (rect.left + rect.width / 2);
          const tapY = touch.clientY - (rect.top + rect.height / 2);
          const newScale = DOUBLE_TAP_ZOOM_SCALE;
          // Keep the tapped content point stationary during zoom
          const newX = tapX - tapX * newScale;
          const newY = tapY - tapY * newScale;
          applyTransform(newScale, newX, newY, true);
          setTimeout(syncScale, ZOOM_ANIMATION_MS + 10);
        }
        return;
      }

      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      const { scale: sc, x, y } = transformRef.current;
      if (sc > 1) {
        panRef.current = {
          active: true,
          startClientX: touch.clientX,
          startClientY: touch.clientY,
          startPanX: x,
          startPanY: y,
          moved: false,
        };
        velocityRef.current = {
          vx: 0, vy: 0,
          lastX: touch.clientX, lastY: touch.clientY,
          lastTime: now,
        };
      }
    }
  }, [stopInertia, applyTransform, syncScale]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      // ── Pinch move ────────────────────────────────────────────────
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const { initDist, initScale, initPanX, initPanY, centerX, centerY } = pinchRef.current;
      const newScale = Math.min(Math.max((dist / initDist) * initScale, 1), MAX_SCALE);
      const ratio = newScale / initScale;
      const newX = centerX - (centerX - initPanX) * ratio;
      const newY = centerY - (centerY - initPanY) * ratio;
      applyTransform(newScale, newX, newY);

    } else if (e.touches.length === 1 && panRef.current.active) {
      // ── Single-finger pan ─────────────────────────────────────────
      const touch = e.touches[0];
      const { startClientX, startClientY, startPanX, startPanY, moved } = panRef.current;
      const dx = touch.clientX - startClientX;
      const dy = touch.clientY - startClientY;

      if (!moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;

      e.preventDefault();
      if (!moved) {
        panRef.current.moved = true;
        const container = schematicContainerRef.current;
        if (container) container.style.cursor = 'grabbing';
      }

      // Track velocity (pixels per ~16 ms frame at 60 fps) with exponential smoothing
      const now = Date.now();
      const dt = Math.max(now - velocityRef.current.lastTime, 1);
      const rawVx = (touch.clientX - velocityRef.current.lastX) / dt * 16; // normalise to 16ms frame
      const rawVy = (touch.clientY - velocityRef.current.lastY) / dt * 16;
      velocityRef.current.vx = VELOCITY_SMOOTHING_ALPHA * rawVx + (1 - VELOCITY_SMOOTHING_ALPHA) * velocityRef.current.vx;
      velocityRef.current.vy = VELOCITY_SMOOTHING_ALPHA * rawVy + (1 - VELOCITY_SMOOTHING_ALPHA) * velocityRef.current.vy;
      velocityRef.current.lastX = touch.clientX;
      velocityRef.current.lastY = touch.clientY;
      velocityRef.current.lastTime = now;

      const { scale: sc } = transformRef.current;
      applyTransform(sc, startPanX + dx, startPanY + dy);
    }
  }, [applyTransform]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      pinchRef.current.active = false;

      if (panRef.current.active && panRef.current.moved) {
        const { vx, vy } = velocityRef.current;
        panRef.current.active = false;
        const container = schematicContainerRef.current;
        const { scale: sc } = transformRef.current;
        if (container) container.style.cursor = sc > 1 ? 'grab' : 'default';
        if (Math.hypot(vx, vy) > 1) {
          startInertia(vx, vy);
          return; // syncScale called inside startInertia when done
        }
      }

      panRef.current.active = false;
      syncScale();

    } else if (e.touches.length === 1 && pinchRef.current.active) {
      // Pinch → single finger: hand off to pan
      pinchRef.current.active = false;
      const touch = e.touches[0];
      panRef.current = {
        active: true,
        startClientX: touch.clientX,
        startClientY: touch.clientY,
        startPanX: transformRef.current.x,
        startPanY: transformRef.current.y,
        moved: false,
      };
      velocityRef.current = {
        vx: 0, vy: 0,
        lastX: touch.clientX, lastY: touch.clientY,
        lastTime: Date.now(),
      };
    }
  }, [syncScale, startInertia]);

  // Attach non-passive touch listeners so we can call preventDefault
  useEffect(() => {
    const container = schematicContainerRef.current;
    if (!container) return;
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [selectedSchematic, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ─── WHEEL ZOOM (zooms towards cursor position) ───────────────────────────

  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    stopInertia();
    const container = schematicContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Cursor offset from container center
    const cursorX = e.clientX - (rect.left + rect.width / 2);
    const cursorY = e.clientY - (rect.top + rect.height / 2);
    const { scale: sc, x, y } = transformRef.current;
    // Multiplicative zoom step — same feel regardless of current scale
    const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    const newScale = Math.min(Math.max(sc * factor, 1), MAX_SCALE);
    let newX, newY;
    if (newScale <= 1) {
      newX = 0; newY = 0;
    } else {
      const ratio = newScale / sc;
      newX = cursorX - (cursorX - x) * ratio;
      newY = cursorY - (cursorY - y) * ratio;
    }
    applyTransform(newScale, newX, newY);
    // Debounce React state sync so we don't re-render on every wheel tick
    if (wheelSyncTimeoutRef.current) clearTimeout(wheelSyncTimeoutRef.current);
    wheelSyncTimeoutRef.current = setTimeout(syncScale, WHEEL_SYNC_DEBOUNCE_MS);
  }, [stopInertia, applyTransform, syncScale]);

  // ─── ZOOM BUTTONS ─────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    stopInertia();
    const { scale: sc, x, y } = transformRef.current;
    applyTransform(Math.min(sc + ZOOM_STEP, MAX_SCALE), x, y, true);
    setTimeout(syncScale, ZOOM_ANIMATION_MS + 10);
  }, [stopInertia, applyTransform, syncScale]);

  const handleZoomOut = useCallback(() => {
    stopInertia();
    const { scale: sc, x, y } = transformRef.current;
    const newScale = Math.max(sc - ZOOM_STEP, 1);
    applyTransform(newScale, newScale === 1 ? 0 : x, newScale === 1 ? 0 : y, true);
    setTimeout(syncScale, ZOOM_ANIMATION_MS + 10);
  }, [stopInertia, applyTransform, syncScale]);

  const handleResetZoom = useCallback(() => {
    stopInertia();
    applyTransform(1, 0, 0, true);
    setTimeout(syncScale, ZOOM_ANIMATION_MS + 10);
  }, [stopInertia, applyTransform, syncScale]);

  // Reset zoom/pan when schematic or page changes
  useEffect(() => {
    stopInertia();
    applyTransform(1, 0, 0, false);
    syncScale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchematic, currentPage]);

  // Re-apply live transform after any React render (guards against stale JSX style)
  useLayoutEffect(() => {
    const el = schematicImageRef.current;
    if (!el) return;
    const { scale: sc, x, y } = transformRef.current;
    el.style.transform = `scale(${sc}) translate(${x / sc}px, ${y / sc}px)`;
  });

  // Cleanup timers/RAF on unmount
  useEffect(() => {
    return () => {
      stopInertia();
      if (wheelSyncTimeoutRef.current) clearTimeout(wheelSyncTimeoutRef.current);
    };
  }, [stopInertia]);

  return (
    <section 
      style={{ 
        padding: isFullscreen ? '60px 0 0' : 'clamp(20px, 5vw, 40px) clamp(1rem, 5vw, 2.5rem) clamp(160px, 30vw, 280px)',
        minHeight: '100vh'
      }} 
      className={`section-enter ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onClick={closeModal}
    >
      {/* Show BrandSelector if no brand selected */}
      {!selectedBrand ? (
        <BrandSelector
          brands={brands}
          onSelectBrand={(brand) => {
            setSelectedBrand(brand);
            setSelectedSchematic(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : !selectedSchematic ? (
        /* Show ToolSelector if brand selected but no schematic */
        <ToolSelector
          brand={selectedBrand}
          tools={allowedSchematics.filter(s => s.brand === selectedBrand)}
          onSelectTool={(tool) => {
            setSelectedSchematic(tool.id);
            const s = allowedSchematics.find(sch => sch.id === tool.id);
            const firstPage = (s && s.diagramPages && s.diagramPages[0]) || 1;
            setCurrentPage(firstPage);
          }}
          onBack={() => {
            setSelectedBrand(null);
            setSelectedSchematic(null);
          }}
        />
      ) : (
        /* Show Schematic Viewer if schematic selected */
        <div>
          {/* Top Back Button - Positioned in top left */}
          <div style={{
            padding: '20px 20px 0 20px',
          }}>
            <button
              className="back-button"
              onClick={() => {
                setSelectedSchematic(null);
                applyTransform(1, 0, 0, false);
                setScale(1);
              }}
              aria-label="Back to Tools"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </div>

          {/* Schematic Container */}
          <div style={{
            maxWidth: isFullscreen ? '100%' : '1400px',
            margin: '0 auto',
            padding: isFullscreen ? '0' : undefined
          }}
          onClick={(e) => e.stopPropagation()}
          >
          {/* Brand & Title Header */}
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <h3 style={{ 
              fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
              color: 'var(--text-secondary)',
              fontWeight: 600
            }}>
              {currentSchematic?.brand}
            </h3>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 5vw, 3rem)', 
              margin: '0',
              letterSpacing: '-0.02em',
              textAlign: 'center'
            }}>
              {currentSchematic?.title}
            </h2>
          </div>

          {/* Page selector for multi-page parts diagrams - positioned at top center */}
          {currentSchematic.diagramPages && currentSchematic.diagramPages.length > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '8px' 
          }}>
                <div className="schematic-pager schematic-pager-top" role="group" aria-label="Schematic pages">
                  <button
                    className={`pager-pill ${currentSchematic.diagramPages.indexOf(currentPage) <= 0 ? 'disabled' : ''}`}
                    onClick={() => {
                      const pages = currentSchematic.diagramPages;
                      const idx = pages.indexOf(currentPage);
                      if (idx > 0) setCurrentPage(pages[idx - 1]);
                    }}
                    aria-label="Previous page"
                    disabled={currentSchematic.diagramPages.indexOf(currentPage) <= 0}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  <div className="pager-counter" aria-hidden>
                    {currentSchematic.diagramPages.indexOf(currentPage) + 1} / {currentSchematic.diagramPages.length}
                  </div>

                  <button
                    className={`pager-pill ${currentSchematic.diagramPages.indexOf(currentPage) >= currentSchematic.diagramPages.length - 1 ? 'disabled' : ''}`}
                    onClick={() => {
                      const pages = currentSchematic.diagramPages;
                      const idx = pages.indexOf(currentPage);
                      if (idx < pages.length - 1) setCurrentPage(pages[idx + 1]);
                    }}
                    aria-label="Next page"
                    disabled={currentSchematic.diagramPages.indexOf(currentPage) >= currentSchematic.diagramPages.length - 1}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              )}

            {/* Zoom/Pan Controls Toolbar - Visible on Both Mobile and Desktop */}
            <div className="schematic-zoom-controls">
              <button className="zoom-control-btn" onClick={handleZoomIn} aria-label="Zoom in" title="Zoom in">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35M11 8v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button className="zoom-control-btn" onClick={handleZoomOut} aria-label="Zoom out" title="Zoom out">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {scale > 1 && (
                <button className="zoom-control-btn reset-btn" onClick={handleResetZoom} aria-label="Reset zoom" title="Reset zoom">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              {scale > 1 && (
                <span className="zoom-indicator" aria-live="polite" aria-label={`Zoom ${Math.round(scale * 10) / 10}×`}>
                  {Math.round(scale * 10) / 10}×
                </span>
              )}
            </div>

            <div
              className="schematic-container"
              ref={schematicContainerRef}
              onWheel={handleWheel}
              style={{
                WebkitUserSelect: 'none',
                userSelect: 'none',
                position: 'relative',
              }}
            >
              <div
                ref={schematicImageRef}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '100%',
                  transformOrigin: 'center center',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  pointerEvents: 'auto',
                  willChange: 'transform',
                }}
              >
                {schematicImageSrc ? (
                  <img
                    src={schematicImageSrc}
                    alt={currentSchematic.title}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      pointerEvents: 'none',
                      imageRendering: 'auto',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                    }}
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  currentSchematic.svg
                )}
                
                {/* Hotspots rendered INSIDE the transformed container so they scale and pan with the image */}
                {currentSchematic.parts.filter(part => !part.pageNumber || part.pageNumber === currentPage).map((part) => (
                  <div
                    key={part.id}
                    className={`hotspot hotspot-${part.shape || 'circle'} ${activeHotspot === part.id ? 'active' : ''}`}
                    style={{
                      position: 'absolute',
                      top: part.position.top,
                      left: part.position.left,
                      transform: part.rotation ? `translate(-50%, -50%) rotate(${part.rotation}deg)` : 'translate(-50%, -50%)',
                      zIndex: activeHotspot === part.id ? 1001 : 100,
                      pointerEvents: 'auto',
                      ...(part.width && part.height ? {
                        width: `${part.width}%`,
                        height: `${part.height}%`
                      } : {})
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeHotspot === part.id) {
                        closeModal();
                      } else {
                        setActiveHotspot(part.id);
                        setActiveHotspotPart(part);
                      }
                    }}
                    title={`${part.name} (${part.sku})`}
                  >
                    {/* Desktop inline modal (hidden on mobile via CSS) */}
                    <div className="part-modal" onClick={(e) => e.stopPropagation()}>
                    <h4 style={{
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.1em',
                      marginBottom: '8px'
                    }}>
                      {part.name}
                    </h4>
                    <div className="part-meta">
                      SKU: {part.sku} | {part.material}
                      {part.quantity > 1 && ` | Qty: ${part.quantity}`}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800
                      }}>
                        ${part.price.toFixed(2)}
                      </span>
                      <button
                        className="alloy-button"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.6rem'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(part);
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Mobile Part Modal Overlay — rendered outside the transform context */}
      {activeHotspotPart && (
        <>
          {/* Backdrop */}
          <div
            className="mobile-modal-backdrop"
            onClick={closeModal}
          />
          {/* Modal */}
          <div
            className="mobile-part-modal-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="mobile-modal-close-btn"
              onClick={closeModal}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15,23,42,0.06)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#0f172a',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <h4 style={{
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              fontWeight: '700',
              letterSpacing: '0.08em',
              marginBottom: '10px',
              paddingRight: '38px',
              lineHeight: '1.35',
              wordBreak: 'break-word',
              color: '#0f172a'
            }}>
              {activeHotspotPart.name}
            </h4>
            <div className="part-meta" style={{ marginBottom: '14px', fontSize: '0.78rem' }}>
              SKU: {activeHotspotPart.sku} | {activeHotspotPart.material}
              {activeHotspotPart.quantity > 1 && ` | Qty: ${activeHotspotPart.quantity}`}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '14px',
              borderTop: '1px solid rgba(15,23,42,0.08)',
              gap: '12px'
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: '1.3rem',
                color: 'var(--tension-accent)'
              }}>
                ${activeHotspotPart.price.toFixed(2)}
              </span>
              <button
                className="alloy-button"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  clipPath: 'none',
                  fontWeight: '700'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(activeHotspotPart);
                }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}
