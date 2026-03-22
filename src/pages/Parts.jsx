import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import BrandSelector from '../components/BrandSelector';
import ToolSelector from '../components/ToolSelector';
import { loadProducts } from '../data/products';
import '../styles/mobile-schematic.css';

// ---------------------------------------------------------------------------
// Schematic JSON data — static imports (bundled by webpack at build time).
// Keep only the schematics that are still included in the UI. TapeTech
// schematics removed by request have been deleted from the public assets and
// their imports removed here so the build won't require them.
// ---------------------------------------------------------------------------
import columbiaMatrixBoxHandleData from '../../public/schematics/brands/Columbia/MatrixBoxHandle/schematic_data.json';
import columbiaPredatorTaperData   from '../../public/schematics/brands/Columbia/PredatorTaper/schematic_data.json';

// ---------------------------------------------------------------------------
// Schematic image paths — runtime URLs relative to the deployment base.
// Files are served from public/schematics/brands/... at their original paths.
// ---------------------------------------------------------------------------
const _BASE = process.env.PUBLIC_URL;
const columbiaMatrixBoxHandleImg    = `${_BASE}schematics/brands/Columbia/Matrix_Handle-enhanced.png`;
const columbiaMatrixBoxHandlePreview = `${_BASE}schematics/brands/Columbia/MatrixBoxHandle/columbia_matrix_box_handle.jpg`;

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
const columbia2WayInternalCornerImg = `${_BASE}schematics/brands/Columbia/2_Way_Internal_Corner_Applicator-1-enhanced.png`;
const columbia2WayInternalCornerPreview = `${_BASE}schematics/brands/Columbia/Two-Way_Internal_Corner_Applicator.jpg`;
const columbiaExtensionHousingImg  = `${_BASE}schematics/brands/Columbia/Extension_Housing_Schematic-1-enhanced.png`;
const columbiaExternalCornerApplicatorImg = `${_BASE}schematics/brands/Columbia/8_Wheel_External_Corner_Applicator-1-enhanced.png`;
const columbiaExternalCornerApplicatorPreview = `${_BASE}schematics/brands/Columbia/External_90_Aplicator_CEXT90_-_FRONT.jpg`;
// (Inside Corner Roller images/data intentionally removed from parts schematics)
const columbiaMatrixHeadImg        = `${_BASE}schematics/brands/Columbia/Matrix_Head-enhanced-enhanced.png`;
const columbiaMatrixLeverImg       = `${_BASE}schematics/brands/Columbia/Matrix_Lever-1-enhanced.png`;
const columbiaMatrixPinchboxImg    = `${_BASE}schematics/brands/Columbia/Matrix_Pinchbox-1-enhanced.png`;
const columbiaPredatorTaperPreview = `${_BASE}schematics/brands/Columbia/predator_taper.jpg`;
const columbiaPredatorTaperBodyImg = `${_BASE}schematics/brands/Columbia/predator_taper_body.png`;
const columbiaPredatorTaperHeadNewImg = `${_BASE}schematics/brands/Columbia/predator_taper_head.png`;

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

  // Columbia Inside Corner Roller removed from parts schematics per request.

  // Helper: build part-hotspot array from a schematic JSON data object
  const buildPartsFromData = (data) => {
    if (!data || !data.parts) return [];
    const coords = data.coordinates || {};
    return data.parts.map((p) => {
      const c = coords[p.id] || null;
      const top  = c && c.top  !== undefined ? `${c.top}%`  : '50%';
      const left = c && c.left !== undefined ? `${c.left}%` : '50%';
      const pageNumber = c && c.pageNumber
        ? c.pageNumber
        : (data.diagramPages && data.diagramPages[0]) || 1;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        quantity: p.quantity || 1,
        material: p.material || 'UNKNOWN',
        price: p.price || 0,
        position: { top, left },
        pageNumber,
        shape: c && c.shape ? c.shape : 'circle',
        width:   c && c.width   ? c.width   : null,
        height:  c && c.height  ? c.height  : null,
        widthPx: c && c.widthPx ? c.widthPx : null,
        heightPx: c && c.heightPx ? c.heightPx : null,
        rotation: c && c.rotation ? c.rotation : 0
      };
    });
  };

  // Build parts arrays from JSON data
  const matrixBoxHandleParts  = buildPartsFromData(columbiaMatrixBoxHandleData);
  const predatorTaperParts    = buildPartsFromData(columbiaPredatorTaperData);

  const schematics = [
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
    // Columbia Inside Corner Roller (parts-based) removed
    {
      id: 'columbia-matrix',
      title: 'Predator Matrix Handle',
      description: 'Columbia Predator Matrix Handle series schematic diagrams',
      brand: 'Columbia Taping Tools',
      diagramPages: [1, 2, 3, 4, 5],
      pageLabels: {
        1: 'Box Handle',
        2: 'Head',
        3: 'Lever',
        4: 'Pinchbox',
        5: 'Extension Housing'
      },
      imagePages: {
        1: columbiaMatrixBoxHandleImg,
        2: columbiaMatrixHeadImg,
        3: columbiaMatrixLeverImg,
        4: columbiaMatrixPinchboxImg,
        5: columbiaExtensionHousingImg
      },
      previewImage: columbiaMatrixBoxHandlePreview,
      parts: matrixBoxHandleParts,
      // Navigation hotspots: click a physical region to jump to its detail page
      navHotspots: [
        {
          id: 'nav-matrix-head',
          label: 'Head Detail',
          pageNumber: 1,
          top: '61%', left: '10%', width: '32%', height: '30%',
          targetPage: 2
        },
        {
          id: 'nav-matrix-lever',
          label: 'Lever Detail',
          pageNumber: 1,
          top: '2%', left: '55%', width: '38%', height: '16%',
          targetPage: 3
        },
        {
          id: 'nav-matrix-pinchbox',
          label: 'Pinchbox Detail',
          pageNumber: 1,
          top: '34%', left: '34%', width: '26%', height: '22%',
          targetPage: 4
        },
        {
          id: 'nav-matrix-ext-housing',
          label: 'Ext. Housing Detail',
          pageNumber: 1,
          top: '19%', left: '47%', width: '26%', height: '20%',
          targetPage: 5
        }
      ]
    },
    {
      id: 'columbia-predator-taper',
      title: 'Predator Taper',
      description: 'Columbia Predator Taper series schematic diagrams',
      brand: 'Columbia Taping Tools',
      diagramPages: [1, 2],
      pageLabels: {
        1: 'Body',
        2: 'Head'
      },
      imagePages: {
        1: columbiaPredatorTaperBodyImg,
        2: columbiaPredatorTaperHeadNewImg
      },
      previewImage: columbiaPredatorTaperPreview,
      parts: predatorTaperParts,
      // Navigation hotspot: click the head region on Body page → Head detail
      navHotspots: [
        {
          id: 'nav-taper-head',
          label: 'Head Detail',
          pageNumber: 1,
          top: '5%', left: '28%', width: '44%', height: '28%',
          targetPage: 2
        }
      ]
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
      id: 'columbia-2-way-internal-corner',
      title: '2-Way Internal Corner Applicator',
      description: 'Columbia 2-Way Internal Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbia2WayInternalCornerImg },
      previewImage: columbia2WayInternalCornerPreview,
      parts: []
    },
    {
      id: 'columbia-external-corner-applicator',
      title: 'External Corner Applicator',
      description: 'Columbia External Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      diagramPages: [1],
      imagePages: { 1: columbiaExternalCornerApplicatorImg },
      previewImage: columbiaExternalCornerApplicatorPreview,
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
            flexShrink: 0,
            position: 'relative',
            zIndex: 2000
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
                    {currentSchematic.pageLabels?.[currentPage]
                      ? `${currentSchematic.pageLabels[currentPage]} (${currentSchematic.diagramPages.indexOf(currentPage) + 1}/${currentSchematic.diagramPages.length})`
                      : `${currentSchematic.diagramPages.indexOf(currentPage) + 1} / ${currentSchematic.diagramPages.length}`
                    }
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

                {/* Navigation hotspots — click a tool region to jump to its detail page */}
                {(currentSchematic.navHotspots || [])
                  .filter(nh => nh.pageNumber === currentPage)
                  .map((nh) => (
                    <div
                      key={nh.id}
                      className="nav-hotspot"
                      role="button"
                      tabIndex={0}
                      aria-label={`Navigate to ${nh.label}`}
                      style={{
                        position: 'absolute',
                        top: nh.top,
                        left: nh.left,
                        width: nh.width,
                        height: nh.height,
                        zIndex: 80,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPage(nh.targetPage);
                        setActiveHotspot(null);
                        setActiveHotspotPart(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCurrentPage(nh.targetPage);
                          setActiveHotspot(null);
                          setActiveHotspotPart(null);
                        }
                      }}
                    >
                      <span className="nav-hotspot-label">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        {nh.label}
                      </span>
                    </div>
                  ))
                }
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
