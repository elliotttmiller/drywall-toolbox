import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import SchematicFilterBar from '../components/SchematicFilterBar';
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

export default function Parts() {
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [activeHotspotPart, setActiveHotspotPart] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('TapeTech');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSchematic, setSelectedSchematic] = useState('tapetech-13tt');
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const { addToCart } = useCart();
  
  // Mobile zoom/pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  // Ref to track pinch zoom state without triggering re-renders
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1, initPanX: 0, initPanY: 0, centerX: 0, centerY: 0 });
  
  const schematicContainerRef = useRef(null);
  const schematicImageRef = useRef(null);

  // Load products on mount
  useEffect(() => {
    loadProducts().then(prods => {
      setProducts(prods);
      // Extract unique brands
      const uniqueBrands = [...new Set(prods.map(p => p.brand).filter(Boolean))].sort();
      setBrands(uniqueBrands);
      
      // Auto-select TapeTech brand
      setSelectedBrand('TapeTech');
    });
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
        title: 'TapeTech 13TT Schematic',
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
          title: 'TapeTech 88TTR Schematic',
          description: 'Interactive schematic for TapeTech 88TTR (multi-page). Use the pager to switch diagram pages.',
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
      title: 'TapeTech 73TT Schematic',
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
      title: 'TapeTech PAHC10 Schematic v2',
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
      title: 'TapeTech 2" Nail Spotter',
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
      title: 'TapeTech T5 Corner Finisher',
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
          <line x1="350" y1="150" x2="450" y2="150" stroke="var(--alloy-edge)" strokeWidth="3"/>
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
    }
  ];

  // Get products filtered by selected brand
  const filteredProducts = products.filter(p => p.brand === selectedBrand);
  
  // Filter schematics by selected brand and product
  const filteredSchematics = schematics.filter(schematic => {
    // If brand selected, only show schematics for that brand
    if (selectedBrand && schematic.brand !== selectedBrand) {
      return false;
    }
    // If product selected, only show schematics that specify a productPartNumber matching the product
    // Schematics without productPartNumber (null/undefined) are considered brand-level and shown for the brand
    if (selectedProduct && schematic.productPartNumber && schematic.productPartNumber !== selectedProduct.part_number) {
      return false;
    }
    return true;
  });

  const currentSchematic = schematics.find(s => s.id === selectedSchematic);
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
        setIsFullscreen(false);
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

  // Mouse wheel zoom for hybrid devices (tablets, laptops with touch)
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom on trackpad or ctrl+wheel
      e.preventDefault();
      const zoomDirection = e.deltaY > 0 ? -0.2 : 0.2;
      const newScale = Math.min(Math.max(scale + zoomDirection, 1), 4);
      // Clamp pan to valid bounds when scale changes
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      } else {
        const container = schematicContainerRef.current;
        const containerW = container ? container.offsetWidth : 400;
        const containerH = container ? container.offsetHeight : 400;
        const maxPanX = ((newScale - 1) * containerW) / 2;
        const maxPanY = ((newScale - 1) * containerH) / 2;
        setPosition(prev => ({
          x: Math.min(Math.max(prev.x, -maxPanX), maxPanX),
          y: Math.min(Math.max(prev.y, -maxPanY), maxPanY),
        }));
      }
      setScale(newScale);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      } else {
        const container = schematicContainerRef.current;
        const containerW = container ? container.offsetWidth : 400;
        const containerH = container ? container.offsetHeight : 400;
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <section 
      style={{ 
        padding: isFullscreen ? '60px 0 0' : 'clamp(80px, 15vw, 140px) clamp(1rem, 5vw, 2.5rem) clamp(160px, 30vw, 280px)',
        minHeight: '100vh'
      }} 
      className={`section-enter ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onClick={closeModal}
    >
      <div style={{
        maxWidth: isFullscreen ? '100%' : '1400px',
        margin: '0 auto',
        padding: isFullscreen ? '0' : undefined
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!isFullscreen && (
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 5vw, 3rem)', 
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}>
              INTERACTIVE SCHEMATIC VIEWER
            </h2>
          </div>
        )}

        {/* Interactive Viewer */}
        {currentSchematic && (
          <div>
            <div 
              className="schematic-title-container"
              style={{
                marginBottom: '12px',
                padding: '8px 16px',
                background: 'var(--surface-glass)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--alloy-edge)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                flexWrap: 'nowrap',
                position: 'relative',
                zIndex: 9999
              }}>
              <h3 style={{ 
                fontSize: '1.1rem',
                margin: 0,
                letterSpacing: '-0.01em',
                color: 'var(--tension-accent)',
                flex: '0 0 auto',
                whiteSpace: 'nowrap'
              }}>
                {currentSchematic.title}
              </h3>

              {/* Filter bar positioned inline on the right */}
              <SchematicFilterBar
                brands={brands}
                selectedBrand={selectedBrand}
                onBrandChange={(brand) => {
                  setSelectedBrand(brand);
                  setSelectedProduct(null);
                }}
                products={filteredProducts}
                selectedProduct={selectedProduct}
                onProductChange={setSelectedProduct}
                schematics={filteredSchematics}
                selectedSchematic={selectedSchematic}
                onSchematicChange={(schematicId) => {
                  setSelectedSchematic(schematicId);
                  const s = schematics.find(sch => sch.id === schematicId);
                  const firstPage = (s && s.diagramPages && s.diagramPages[0]) || 1;
                  setCurrentPage(firstPage);
                }}
              />
            </div>

            {/* Page selector for multi-page schematics - positioned at top center */}
            {currentSchematic && currentSchematic.diagramPages && currentSchematic.diagramPages.length > 1 && (
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

            {/* Mobile Zoom Controls */}
            <div className="mobile-zoom-controls">
              <button 
                className="zoom-control-btn fullscreen-btn" 
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
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
              <div className="zoom-indicator">
                {Math.round(scale * 100)}%
              </div>
            </div>

            <div 
              className="schematic-container"
              ref={schematicContainerRef}
              onWheel={handleWheel}
              style={{
                overflow: scale > 1 ? 'hidden' : 'visible',
                touchAction: scale > 1 ? 'none' : 'auto',
                cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                position: 'relative',
                willChange: scale > 1 ? 'transform' : 'auto',
              }}
            >
              <div 
                ref={schematicImageRef}
                style={{ 
                  position: 'relative', 
                  display: 'inline-block', 
                  width: '100%',
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.3s ease-out',
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

              {/* Hotspots END */}
            </div>
          </div>
        )}
      </div>

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
