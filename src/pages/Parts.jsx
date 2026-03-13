import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import BrandSelector from '../components/BrandSelector';
import ToolSelector from '../components/ToolSelector';
import { loadProducts } from '../data/products';
import '../styles/mobile-schematic.css';

// ---------------------------------------------------------------------------
// Schematic JSON data — static imports (bundled by webpack at build time).
// All source files now live under public/schematics/brands/ so they are also
// available as plain-URL assets at runtime.
// ---------------------------------------------------------------------------
import schematic13Data from '../../public/schematics/brands/TapeTech/products/13TT_SCH_hotspots/schematic_data.json';
import schematic88Data from '../../public/schematics/brands/TapeTech/products/88TTR_SCH_hotspots/schematic_data.json';
import schematicNS02Data from '../../public/schematics/brands/TapeTech/products/NS02TT_SCH_hotspots/schematic_data.json';
import schematic73Data from '../../public/schematics/brands/TapeTech/products/73TT_SCH_hotspots/schematic_data.json';
import schematicPAHC10Data from '../../public/schematics/brands/TapeTech/products/PAHC10_SCH_v2_hotspots/schematic_data.json';
import schematicBoxHandleData from '../../public/schematics/brands/TapeTech/products/Box_Handle/schematic_data.json';
import columbiaInsideCornerRollerData from '../../public/schematics/brands/Columbia/InsideCornerRoller/schematic_data.json';
import columbiaMatrixBoxHandleData from '../../public/schematics/brands/Columbia/MatrixBoxHandle/schematic_data.json';

// ---------------------------------------------------------------------------
// Schematic image paths — runtime URLs relative to the deployment base.
// Files are served from public/schematics/brands/... at their original paths.
// ---------------------------------------------------------------------------
const _BASE = process.env.PUBLIC_URL;
const schematic13Img           = `${_BASE}schematics/brands/TapeTech/products/13TT_SCH_hotspots/images/page_1.png`;
const schematic88Img           = `${_BASE}schematics/brands/TapeTech/products/88TTR_SCH_hotspots/images/page_2.png`;
const schematic88ImgPage3      = `${_BASE}schematics/brands/TapeTech/products/88TTR_SCH_hotspots/images/page_3.png`;
const schematicNS02Img         = `${_BASE}schematics/brands/TapeTech/products/NS02TT_SCH_hotspots/images/page_1.png`;
const schematic73Img           = `${_BASE}schematics/brands/TapeTech/products/73TT_SCH_hotspots/images/page_2.png`;
const schematicPAHC10Img       = `${_BASE}schematics/brands/TapeTech/products/PAHC10_SCH_v2_hotspots/images/page_1.png`;
const schematicBoxHandleImg    = `${_BASE}schematics/brands/TapeTech/products/Box_Handle/BH_SCH-enhanced1.png`;
const columbiaInsideCornerRollerImg = `${_BASE}schematics/brands/Columbia/InsideCornerRoller/InsideCornerRoller-2014_1_-enhanced-squared.png`;
const columbiaMatrixBoxHandleImg    = `${_BASE}schematics/brands/Columbia/MatrixBoxHandle/Matrix_Handle-enhanced-square.png`;

// New TapeTech image-only schematics
const tapeTech15TTEImg      = `${_BASE}schematics/brands/TapeTech/products/15TTE_SCH-enhanced.png`;
const tapeTech17TTImg       = `${_BASE}schematics/brands/TapeTech/products/17TT_SCH-enhanced.png`;
const tapeTech30TTXImg      = `${_BASE}schematics/brands/TapeTech/products/30TTX_SCH-enhanced.png`;
const tapeTech35TTImg       = `${_BASE}schematics/brands/TapeTech/products/35TT_SCH-enhanced.png`;
const tapeTech40TTImg       = `${_BASE}schematics/brands/TapeTech/products/40TT_SCH-enhanced.png`;
const tapeTech45TTImg       = `${_BASE}schematics/brands/TapeTech/products/45TT_SCH-enhanced.png`;
const tapeTech76TTCAImg     = `${_BASE}schematics/brands/TapeTech/products/76TT-CA_SCH-enhanced.png`;
const tapeTech8000TTImg     = `${_BASE}schematics/brands/TapeTech/products/8000TT-PA_SCH-enhanced.png`;
const tapeTech8154TTImg     = `${_BASE}schematics/brands/TapeTech/products/8154TT_SCH-enhanced.png`;
const tapeTech85TImg        = `${_BASE}schematics/brands/TapeTech/products/85T_SCH-enhanced.png`;
const tapeTech88TTEImg      = `${_BASE}schematics/brands/TapeTech/products/88TTE_SCH-enhanced.png`;
const tapeTech90TImg        = `${_BASE}schematics/brands/TapeTech/products/90T_SCH-enhanced.png`;
const tapeTechCF30TTImg     = `${_BASE}schematics/brands/TapeTech/products/CF30TT_SCH-enhanced.png`;
const tapeTechCFHTTImg      = `${_BASE}schematics/brands/TapeTech/products/CFHTT-rA-enhanced.png`;
const tapeTechPAHC12Img     = `${_BASE}schematics/brands/TapeTech/products/PAHC12_SCH-enhanced.png`;

// New Columbia image-only schematics
const columbia2WheelImg            = `${_BASE}schematics/brands/Columbia/2_Wheel_Internal_Corner_Applicator-enhanced.png`;
const columbia4WheelImg            = `${_BASE}schematics/brands/Columbia/4_Wheel_Internal_Corner_Applicator-enhanced.png`;
const columbiaExtensionHousingImg  = `${_BASE}schematics/brands/Columbia/Extension_Housing_Schematic-enhanced.png`;
const columbiaICREnhancedImg       = `${_BASE}schematics/brands/Columbia/InsideCornerRoller-2014_1_-enhanced.png`;
const columbiaMatrixHandleImg      = `${_BASE}schematics/brands/Columbia/Matrix_Handle-enhanced.png`;
const columbiaMatrixHeadImg        = `${_BASE}schematics/brands/Columbia/Matrix_Head-enhanced.png`;
const columbiaMatrixLeverImg       = `${_BASE}schematics/brands/Columbia/Matrix_Lever-enhanced.png`;
const columbiaMatrixPinchboxImg    = `${_BASE}schematics/brands/Columbia/Matrix_Pinchbox-enhanced.png`;
const columbiaPredatorBodyImg      = `${_BASE}schematics/brands/Columbia/PREDATOR_BODY_OCTOBER_2018-enhanced.png`;
const columbiaPredatorTaperHeadImg = `${_BASE}schematics/brands/Columbia/PREDATOR_TAPER_HEAD-enhanced.png`;
const columbiaSemiAutoTaperImg     = `${_BASE}schematics/brands/Columbia/SemiAutomaticTaper-2015-enhanced.png`;
const columbiaTaperBodyImg         = `${_BASE}schematics/brands/Columbia/TaperBody-2014-enhanced.png`;
const columbiaTaperHeadImg         = `${_BASE}schematics/brands/Columbia/TaperHead-2014-DS-enhanced.png`;
const columbia3SchematicImg        = `${_BASE}schematics/brands/Columbia/columbia_3_schematic-enhanced.png`;

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
  
  // Mobile zoom/pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isPanning, setIsPanning] = useState(false);
  
  // Fullscreen is always enabled on mobile, never on desktop
  const isFullscreen = isMobile;
  
  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  // Ref to track pinch zoom state without triggering re-renders
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1, initPanX: 0, initPanY: 0, centerX: 0, centerY: 0 });
  
  const schematicContainerRef = useRef(null);
  const schematicImageRef = useRef(null);

  // Desktop mouse-drag panning
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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

  // Build TapeTech Box Handle schematic parts from JSON data
  const schematicBoxHandleParts = (schematicBoxHandleData && schematicBoxHandleData.parts) ? schematicBoxHandleData.parts.map((p) => {
    const coords = schematicBoxHandleData.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (schematicBoxHandleData.diagramPages && schematicBoxHandleData.diagramPages[0]) || 1;
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

  // Build Columbia Inside Corner Roller schematic parts from JSON data
  const columbiaParts = (columbiaInsideCornerRollerData && columbiaInsideCornerRollerData.parts) ? columbiaInsideCornerRollerData.parts.map((p) => {
    const coords = columbiaInsideCornerRollerData.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    // Use percentage-based positioning directly from JSON (already in percentage format)
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (columbiaInsideCornerRollerData.diagramPages && columbiaInsideCornerRollerData.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || 'UNKNOWN',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      widthPx: c && c.widthPx ? c.widthPx : null,
      heightPx: c && c.heightPx ? c.heightPx : null,
      rotation: c && c.rotation ? c.rotation : 0
    };
  }) : [];

  // Build Columbia Matrix Box Handle schematic parts from JSON data
  const matrixBoxHandleParts = (columbiaMatrixBoxHandleData && columbiaMatrixBoxHandleData.parts) ? columbiaMatrixBoxHandleData.parts.map((p) => {
    const coords = columbiaMatrixBoxHandleData.coordinates || {};
    const c = coords[p.id] || coords[String(Number(p.id))] || null;
    // Use percentage-based positioning directly from JSON (already in percentage format)
    const top = c && c.top !== undefined ? `${c.top}%` : '50%';
    const left = c && c.left !== undefined ? `${c.left}%` : '50%';
    const pageNumber = c && c.pageNumber ? c.pageNumber : (columbiaMatrixBoxHandleData.diagramPages && columbiaMatrixBoxHandleData.diagramPages[0]) || 1;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || p.SKU || '',
      quantity: p.quantity || 1,
      material: p.material || 'UNKNOWN',
      price: p.price || 0,
      position: { top, left },
      pageNumber,
      shape: c && c.shape ? c.shape : 'circle',
      width: c && c.width ? c.width : null,
      height: c && c.height ? c.height : null,
      widthPx: c && c.widthPx ? c.widthPx : null,
      heightPx: c && c.heightPx ? c.heightPx : null,
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
      id: 'tapetech-box-handle',
      title: 'Box Handle',
      description: 'TapeTech Box Handle Assembly - Complete schematic with all components',
      brand: 'TapeTech',
      productPartNumber: null,
      diagramPages: schematicBoxHandleData.diagramPages || [1],
      imagePages: {
        [schematicBoxHandleData.diagramPages ? schematicBoxHandleData.diagramPages[0] : 1]: schematicBoxHandleImg
      },
      parts: schematicBoxHandleParts
    },
    {
      id: 'tapetech-corner-finisher-t5',
      title: 'T5 Corner Finisher',
      description: 'Precision Corner Finisher Assembly - Model T05CF (Main Components)',
      brand: 'TapeTech',
      productPartNumber: 'T05CF',
      image: `${_BASE}schematics/brands/TapeTech/products/T05CF_SCH_hotspots/images/page_9.png`,
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
      diagramPages: columbiaInsideCornerRollerData.diagramPages || [1],
      imagePages: {
        [columbiaInsideCornerRollerData.diagramPages ? columbiaInsideCornerRollerData.diagramPages[0] : 1]: columbiaInsideCornerRollerImg
      },
      parts: columbiaParts
    },
    {
      id: 'columbia-matrix-box-handle',
      title: 'Matrix Box Handle',
      description: 'Professional matrix box handle for mud application',
      brand: 'Columbia Taping Tools',
      productPartNumber: null,
      diagramPages: columbiaMatrixBoxHandleData.diagramPages || [1],
      imagePages: {
        [columbiaMatrixBoxHandleData.diagramPages ? columbiaMatrixBoxHandleData.diagramPages[0] : 1]: columbiaMatrixBoxHandleImg
      },
      parts: matrixBoxHandleParts
    },
    // New TapeTech image-only schematics
    {
      id: 'tapetech-15tte',
      title: '15TTE',
      description: 'TapeTech 15TTE schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech15TTEImg },
      parts: []
    },
    {
      id: 'tapetech-17tt',
      title: '17TT',
      description: 'TapeTech 17TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech17TTImg },
      parts: []
    },
    {
      id: 'tapetech-30ttx',
      title: '30TTX',
      description: 'TapeTech 30TTX schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech30TTXImg },
      parts: []
    },
    {
      id: 'tapetech-35tt',
      title: '35TT',
      description: 'TapeTech 35TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech35TTImg },
      parts: []
    },
    {
      id: 'tapetech-40tt',
      title: '40TT',
      description: 'TapeTech 40TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech40TTImg },
      parts: []
    },
    {
      id: 'tapetech-45tt',
      title: '45TT',
      description: 'TapeTech 45TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech45TTImg },
      parts: []
    },
    {
      id: 'tapetech-76tt-ca',
      title: '76TT-CA',
      description: 'TapeTech 76TT-CA schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech76TTCAImg },
      parts: []
    },
    {
      id: 'tapetech-8000tt-pa',
      title: '8000TT-PA',
      description: 'TapeTech 8000TT-PA schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech8000TTImg },
      parts: []
    },
    {
      id: 'tapetech-8154tt',
      title: '8154TT',
      description: 'TapeTech 8154TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech8154TTImg },
      parts: []
    },
    {
      id: 'tapetech-85t',
      title: '85T',
      description: 'TapeTech 85T schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech85TImg },
      parts: []
    },
    {
      id: 'tapetech-88tte',
      title: '88TTE',
      description: 'TapeTech 88TTE schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech88TTEImg },
      parts: []
    },
    {
      id: 'tapetech-90t',
      title: '90T',
      description: 'TapeTech 90T schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTech90TImg },
      parts: []
    },
    {
      id: 'tapetech-cf30tt',
      title: 'CF30TT',
      description: 'TapeTech CF30TT schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTechCF30TTImg },
      parts: []
    },
    {
      id: 'tapetech-cfhtt',
      title: 'CFHTT-rA',
      description: 'TapeTech CFHTT-rA schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTechCFHTTImg },
      parts: []
    },
    {
      id: 'tapetech-pahc12',
      title: 'PAHC12',
      description: 'TapeTech PAHC12 schematic diagram',
      brand: 'TapeTech',
      diagramPages: [1],
      imagePages: { 1: tapeTechPAHC12Img },
      parts: []
    },
    // New Columbia image-only schematics
    {
      id: 'columbia-2-wheel-applicator',
      title: '2-Wheel Internal Corner Applicator',
      description: 'Columbia 2-Wheel Internal Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbia2WheelImg },
      parts: []
    },
    {
      id: 'columbia-4-wheel-applicator',
      title: '4-Wheel Internal Corner Applicator',
      description: 'Columbia 4-Wheel Internal Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbia4WheelImg },
      parts: []
    },
    {
      id: 'columbia-extension-housing',
      title: 'Extension Housing',
      description: 'Columbia Extension Housing schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaExtensionHousingImg },
      parts: []
    },
    {
      id: 'columbia-inside-corner-roller-enhanced',
      title: 'Inside Corner Roller (2014)',
      description: 'Columbia Inside Corner Roller 2014 enhanced schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaICREnhancedImg },
      parts: []
    },
    {
      id: 'columbia-matrix-handle',
      title: 'Matrix Handle',
      description: 'Columbia Matrix Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaMatrixHandleImg },
      parts: []
    },
    {
      id: 'columbia-matrix-head',
      title: 'Matrix Head',
      description: 'Columbia Matrix Head schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaMatrixHeadImg },
      parts: []
    },
    {
      id: 'columbia-matrix-lever',
      title: 'Matrix Lever',
      description: 'Columbia Matrix Lever schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaMatrixLeverImg },
      parts: []
    },
    {
      id: 'columbia-matrix-pinchbox',
      title: 'Matrix Pinchbox',
      description: 'Columbia Matrix Pinchbox schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaMatrixPinchboxImg },
      parts: []
    },
    {
      id: 'columbia-predator-body',
      title: 'Predator Body',
      description: 'Columbia Predator Body schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaPredatorBodyImg },
      parts: []
    },
    {
      id: 'columbia-predator-taper-head',
      title: 'Predator Taper Head',
      description: 'Columbia Predator Taper Head schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaPredatorTaperHeadImg },
      parts: []
    },
    {
      id: 'columbia-semi-auto-taper',
      title: 'Semi-Automatic Taper (2015)',
      description: 'Columbia Semi-Automatic Taper 2015 schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaSemiAutoTaperImg },
      parts: []
    },
    {
      id: 'columbia-taper-body',
      title: 'Taper Body (2014)',
      description: 'Columbia Taper Body 2014 schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaTaperBodyImg },
      parts: []
    },
    {
      id: 'columbia-taper-head',
      title: 'Taper Head (2014-DS)',
      description: 'Columbia Taper Head 2014-DS schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaTaperHeadImg },
      parts: []
    },
    {
      id: 'columbia-3-schematic',
      title: 'Columbia 3"',
      description: 'Columbia 3" schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbia3SchematicImg },
      parts: []
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

  // Reset zoom/pan when schematic changes
    useEffect(() => {
      const t = setTimeout(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }, 0);
      return () => clearTimeout(t);
    }, [selectedSchematic, currentPage]);

  // Touch and zoom handlers for mobile - enhanced with smooth interactions
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch gesture - prevent default and calculate distance
      e.preventDefault();
      e.stopPropagation();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      // Record pinch midpoint relative to the container center so we can
      // keep the focal point stationary as the user zooms.
      const container = schematicContainerRef.current;
      const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      // Offset from container center (our transform-origin)
      const centerX = midX - (rect.left + rect.width / 2);
      const centerY = midY - (rect.top + rect.height / 2);
      pinchRef.current = {
        active: true,
        initDist: distance,
        initScale: scale,
        initPanX: position.x,
        initPanY: position.y,
        centerX,
        centerY,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan gesture (only when zoomed in) - store initial position
      // Don't preventDefault yet - let tap events through
      setTouchStartPos({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
      setHasMoved(false);
      setStartPanPosition({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      // Pinch zoom with smooth scaling towards the pinch midpoint
      e.preventDefault();
      e.stopPropagation();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const { initDist, initScale, initPanX, initPanY, centerX, centerY } = pinchRef.current;
      const zoomFactor = distance / initDist;
      const newScale = Math.min(Math.max(zoomFactor * initScale, 1), 4);

      // Adjust pan so the pinch center stays fixed on screen:
      // newPan = center - (center - initPan) * (newScale / initScale)
      const ratio = newScale / initScale;
      const newPanX = centerX - (centerX - initPanX) * ratio;
      const newPanY = centerY - (centerY - initPanY) * ratio;

      // Clamp pan to valid bounds for the new scale
      const container = schematicContainerRef.current;
      const containerW = container ? container.offsetWidth : 400;
      const containerH = container ? container.offsetHeight : 400;
      const maxPanX = ((newScale - 1) * containerW) / 2;
      const maxPanY = ((newScale - 1) * containerH) / 2;

      setScale(newScale);
      setPosition({
        x: Math.min(Math.max(newPanX, -maxPanX), maxPanX),
        y: Math.min(Math.max(newPanY, -maxPanY), maxPanY),
      });
    } else if (e.touches.length === 1 && scale > 1) {
      // Check distance moved to determine if this is a drag or a tap
      const touch = e.touches[0];
      const moveDistance = Math.hypot(
        touch.clientX - touchStartPos.x,
        touch.clientY - touchStartPos.y
      );
      
      if (moveDistance > 10) {
        // Only preventDefault if user is actually dragging (threshold: 10px)
        if (!hasMoved) {
          e.preventDefault();
          e.stopPropagation();
          setHasMoved(true);
          setIsPanning(true);
        }
        
        // Pan when zoomed - smooth panning with dynamic bounds
        const newX = touch.clientX - startPanPosition.x;
        const newY = touch.clientY - startPanPosition.y;
        
        // Constrain pan based on scale and container size
        const container = schematicContainerRef.current;
        const containerW = container ? container.offsetWidth : 400;
        const containerH = container ? container.offsetHeight : 400;
        const maxPanX = ((scale - 1) * containerW) / 2;
        const maxPanY = ((scale - 1) * containerH) / 2;
        
        setPosition({
          x: Math.min(Math.max(newX, -maxPanX), maxPanX),
          y: Math.min(Math.max(newY, -maxPanY), maxPanY),
        });
      }
    }
  }, [scale, startPanPosition, touchStartPos, hasMoved]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      pinchRef.current.active = false;
      setIsPanning(false);
      setHasMoved(false);
    } else if (e.touches.length === 1 && pinchRef.current.active) {
      // Transitioned from pinch to single-touch — reset pinch tracking
      pinchRef.current.active = false;
    }
  }, []);

  // Setup non-passive touch event listeners to allow preventDefault
  useEffect(() => {
    const container = schematicContainerRef.current;
    if (!container) return;

    // Attach non-passive touch listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Mouse wheel zoom — cursor-aware, non-passive listener added via useEffect below
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDirection = e.deltaY > 0 ? -0.2 : 0.2;
      const newScale = Math.min(Math.max(scale + zoomDirection, 1), 4);
      const container = schematicContainerRef.current;
      const imageDiv  = schematicImageRef.current;
      const containerW = container ? container.offsetWidth  : 400;
      const containerH = imageDiv   ? imageDiv.offsetHeight : (container ? container.offsetHeight : 400);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      } else {
        // Zoom towards the cursor position
        const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: containerW, height: containerH };
        const cursorX = e.clientX - (rect.left + rect.width  / 2);
        const cursorY = e.clientY - (rect.top  + rect.height / 2);
        const ratio = newScale / scale;
        const newX = cursorX - (cursorX - position.x) * ratio;
        const newY = cursorY - (cursorY - position.y) * ratio;
        const maxPanX = ((newScale - 1) * containerW) / 2;
        const maxPanY = ((newScale - 1) * containerH) / 2;
        setPosition({
          x: Math.min(Math.max(newX, -maxPanX), maxPanX),
          y: Math.min(Math.max(newY, -maxPanY), maxPanY),
        });
      }
      setScale(newScale);
    }
  }, [scale, position]);

  // Attach non-passive wheel listener so preventDefault() is respected
  useEffect(() => {
    const container = schematicContainerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Desktop mouse-drag panning: track start when mouse is pressed on the schematic
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 || scale <= 1 || isMobile) return;
    e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: position.x,
      panY: position.y,
    };
    setIsDragging(true);
    setIsPanning(true);
  }, [scale, position, isMobile]);

  // Global mouse-move / mouse-up while dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e) => {
      const { x, y, panX, panY } = dragStartRef.current;
      const newX = panX + (e.clientX - x);
      const newY = panY + (e.clientY - y);
      const container = schematicContainerRef.current;
      const imageDiv  = schematicImageRef.current;
      const containerW = container ? container.offsetWidth  : 400;
      const containerH = imageDiv   ? imageDiv.offsetHeight : (container ? container.offsetHeight : 400);
      const maxPanX = ((scale - 1) * containerW) / 2;
      const maxPanY = ((scale - 1) * containerH) / 2;
      setPosition({
        x: Math.min(Math.max(newX, -maxPanX), maxPanX),
        y: Math.min(Math.max(newY, -maxPanY), maxPanY),
      });
    };
    const onMouseUp = () => {
      setIsDragging(false);
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [isDragging, scale]);

  // Zoom controls
  const handleZoomIn = () => {
    setScale(prev => {
      const newScale = Math.min(prev + 0.5, 4);
      const container = schematicContainerRef.current;
      const imageDiv  = schematicImageRef.current;
      const containerW = container ? container.offsetWidth  : 400;
      const containerH = imageDiv   ? imageDiv.offsetHeight : (container ? container.offsetHeight : 400);
      const maxPanX = ((newScale - 1) * containerW) / 2;
      const maxPanY = ((newScale - 1) * containerH) / 2;
      setPosition(p => ({
        x: Math.min(Math.max(p.x, -maxPanX), maxPanX),
        y: Math.min(Math.max(p.y, -maxPanY), maxPanY),
      }));
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      } else {
        const container = schematicContainerRef.current;
        const imageDiv  = schematicImageRef.current;
        const containerW = container ? container.offsetWidth  : 400;
        const containerH = imageDiv   ? imageDiv.offsetHeight : (container ? container.offsetHeight : 400);
        const maxPanX = ((newScale - 1) * containerW) / 2;
        const maxPanY = ((newScale - 1) * containerH) / 2;
        setPosition(p => ({
          x: Math.min(Math.max(p.x, -maxPanX), maxPanX),
          y: Math.min(Math.max(p.y, -maxPanY), maxPanY),
        }));
      }
      return newScale;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',
          overflow: 'hidden'
        }}>
          {/* Top Back Button - Positioned in top left */}
          <div style={{
            padding: '20px 20px 0 20px',
            flexShrink: 0
          }}>
            <button
              className="back-button"
              onClick={() => {
                setSelectedSchematic(null);
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              aria-label="Back to Tools"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </div>

          {/* Schematic Container Wrapper - Allows flex growth */}
          <div style={{
            maxWidth: isFullscreen ? '100%' : '1400px',
            margin: '0 auto',
            padding: isFullscreen ? '0' : undefined,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}
          onClick={(e) => e.stopPropagation()}
          >
          {/* Brand & Title Header */}
          <div style={{ 
            marginBottom: '40px', 
            textAlign: 'center',
            flexShrink: 0,
            padding: '20px'
          }}>
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
            marginBottom: '8px',
            flexShrink: 0
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
            </div>

            <div 
              className="schematic-container"
              ref={schematicContainerRef}
              onMouseDown={handleMouseDown}
              style={{
                overflow: 'hidden',
                touchAction: scale > 1 ? 'none' : 'auto',
                cursor: scale > 1 ? (isPanning || isDragging ? 'grabbing' : 'grab') : 'default',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                position: 'relative',
                willChange: scale > 1 ? 'transform' : 'auto',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Transform wrapper — sized by the image's natural aspect ratio.
                  Hotspots are absolutely positioned inside here so they scale
                  and pan with the image on every zoom level and screen size. */}
              <div 
                ref={schematicImageRef}
                style={{ 
                  position: 'relative',
                  display: 'block',
                  width: '100%',
                  flex: 'none',
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transformOrigin: 'center center',
                  transition: isPanning || isDragging ? 'none' : 'transform 0.3s ease-out',
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
                      ...(part.widthPx && part.heightPx ? {
                        width: `${part.widthPx}px`,
                        height: `${part.heightPx}px`
                      } : (part.width && part.height ? {
                        width: `${part.width}%`,
                        height: `${part.height}%`
                      } : {}))
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
