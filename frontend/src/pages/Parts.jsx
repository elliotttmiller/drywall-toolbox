import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import BrandSelector from '../components/BrandSelector';
import ToolSelector from '../components/ToolSelector';
import { loadProducts } from '../data/products';
import { SCHEMATIC_DEFINITIONS } from '../data/schematicMappings';
import '../styles/mobile-schematic.css';

import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo
};

// ---------------------------------------------------------------------------
// Schematic JSON data — static imports (bundled by webpack at build time).
// Keep only the schematics that are still included in the UI. TapeTech
// schematics removed by request have been deleted from the public assets and
// their imports removed here so the build won't require them.
// ---------------------------------------------------------------------------
import columbiaPredatorTaperBodyData   from '/brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Body/schematic_data.json';
import columbiaPredatorTaperHeadData   from '/brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Head/schematic_data.json';
import columbiaStandardOutsideCornerRollerData from '/brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/schematic_data.json';
import columbiaInsideCornerRollerData from '/brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/schematic_data.json';
import columbiaThrottleBoxData from '/brands/Columbia/Schematics/CornerBoxes/ThrottleBox/schematic_data.json';
import columbiaAutomaticFlatBoxData from '/brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/schematic_data.json';
import columbiaFlatBoxData from '/brands/Columbia/Schematics/FinishingBoxes/FlatBox/schematic_data.json';
import columbiaFatBoyBoxData from '/brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/schematic_data.json';
import columbiaTallBoyMudPumpData from '/brands/Columbia/Schematics/Pumps/TallBoyMudPump/schematic_data.json';
import columbiaNailspotterData from '/brands/Columbia/Schematics/Nailspotters/Nailspotter/schematic_data.json';
import columbiaTomahawkData from '/brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/schematic_data.json';
import columbiaSemiAutomaticTaperData from '/brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/schematic_data.json';
import columbiaSanderHeadData from '/brands/Columbia/Schematics/Sanders/SanderHead/schematic_data.json';
import columbiaAngleHeadData from '/brands/Columbia/Schematics/Angleheads/AngleHead/schematic_data.json';
import columbiaMudPumpData from '/brands/Columbia/Schematics/Pumps/MudPump/schematic_data.json';
import columbiaGooseneckAdapterData from '/brands/Columbia/Schematics/Pumps/GooseneckAdapter/schematic_data.json';
import columbiaBoxFillerData from '/brands/Columbia/Schematics/Pumps/BoxFiller/schematic_data.json';
import columbiaCornerCobraData from '/brands/Columbia/Schematics/CornerRollers/CornerCobra/schematic_data.json';
import columbiaCompoundTubeDataJson from '/brands/Columbia/Schematics/CompoundTubes/CompoundTube/schematic_data.json';
import columbiaCf35Data from '/brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/schematic_data.json';
import columbiaDirectCornerFlusherData from '/brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/schematic_data.json';
import columbiaComboFlusherData from '/brands/Columbia/Schematics/CornerFlushers/ComboFlusher/schematic_data.json';
import columbiaExternalCornerApplicatorData from '/brands/Columbia/Schematics/Applicators/ExternalCorner/schematic_data.json';
import columbiaTwoWayInternalCornerApplicatorData from '/brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/schematic_data.json';
import columbiaInsideCornerApplicator2WheelData from '/brands/Columbia/Schematics/Applicators/InsideCornerApplicator/2Wheel/schematic_data.json';
import columbiaInsideCornerApplicator4WheelData from '/brands/Columbia/Schematics/Applicators/InsideCornerApplicator/4Wheel/schematic_data.json';
import columbiaCamLockTubeData from '/brands/Columbia/Schematics/CompoundTubes/CamLockTube/schematic_data.json';
import columbiaClosetMonsterData from '/brands/Columbia/Schematics/Handles/ClosetMonster/schematic_data.json';
import columbiaColumbiaOneData from '/brands/Columbia/Schematics/Handles/ColumbiaOne/schematic_data.json';
import columbiaMatrixBoxHandleBoxHandleData from '/brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/schematic_data.json';
import columbiaMatrixBoxHandleHeadData from '/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Head/schematic_data.json';
import columbiaMatrixBoxHandleLeverData from '/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Lever/schematic_data.json';
import columbiaMatrixBoxHandlePinchboxData from '/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Pinchbox/schematic_data.json';
import columbiaMatrixBoxHandleExtensionHousingData from '/brands/Columbia/Schematics/Handles/MatrixBoxHandle/ExtensionHousing/schematic_data.json';
import columbiaFlatBoxHandleData from '/brands/Columbia/Schematics/Handles/FlatBoxHandle/schematic_data.json';
import columbiaLongExtendableHandleData from '/brands/Columbia/Schematics/Handles/LongExtendableHandle/schematic_data.json';
import tapeTechExtendableSupportHandleData from '/brands/TapeTech/Schematics/ExtendableSupportHandle/schematic_data.json';

// ---------------------------------------------------------------------------
// Schematic image paths — runtime URLs relative to the deployment base.
// Columbia files are served from public/brands/Columbia/Schematics/... at their original paths.
// ---------------------------------------------------------------------------
const _BASE = process.env.PUBLIC_URL;
const columbiaMatrixBoxHandleImg    = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/Matrix_Handle-enhanced.png`;
const columbiaMatrixBoxHandlePreview = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/columbia_matrix_box_handle.jpg`;

// TapeTech Extendable Support Handle schematic
const tapeTechExtendableSupportHandleImg = `${_BASE}brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_SCH.png`;
const tapeTechExtendableSupportHandlePreview = `${_BASE}brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_SCH.png`;

// New Columbia image-only schematics
const columbia2WayInternalCornerImg = `${_BASE}brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/2_Way_Internal_Corner_Applicator-1-enhanced.png`;
const columbia2WayInternalCornerPreview = `${_BASE}brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/Two-Way_Internal_Corner_Applicator.jpg`;
const columbiaExtensionHousingImg  = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/ExtensionHousing/Extension_Housing_Schematic-1-enhanced.png`;
const columbiaExternalCornerApplicatorImg = `${_BASE}brands/Columbia/Schematics/Applicators/ExternalCorner/8_Wheel_External_Corner_Applicator-1-enhanced.png`;
const columbiaExternalCornerApplicatorPreview = `${_BASE}brands/Columbia/Schematics/Applicators/ExternalCorner/External_90_Aplicator_CEXT90_-_FRONT.jpg`;
const columbiaInsideCornerApplicator2WheelImg = `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/2Wheel/ICA1-2-2015.png`;
const columbiaInsideCornerApplicator4WheelImg = `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/4Wheel/ICA1-4-2015.png`;
const columbiaInsideCornerApplicatorPreview = `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/Inside_Corner_Applicator_4_Wheels_ICA1-4_-_BACK.jpg`;
// (Inside Corner Roller images/data intentionally removed from parts schematics)
const columbiaMatrixHeadImg        = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Head/Matrix_Head-enhanced-enhanced.png`;
const columbiaMatrixLeverImg       = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Lever/Matrix_Lever-1-enhanced.png`;
const columbiaMatrixPinchboxImg    = `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Pinchbox/Matrix_Pinchbox-1-enhanced.png`;
const columbiaPredatorTaperPreview = `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/predator_taper.jpg`;
const columbiaPredatorTaperBodyImg = `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Body/predator_taper_body.png`;
const columbiaPredatorTaperHeadNewImg = `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Head/predator_taper_head.png`;
const columbiaStandardOutsideCornerRollerImg = `${_BASE}brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/OutsideCornerRollers-2016-1-enhanced.png`;
const columbiaStandardOutsideCornerRollerPreview = `${_BASE}brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/External_90_Aplicator.jpg`;
const columbiaInsideCornerRollerImg = `${_BASE}brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/InsideCornerRoller-2014_1_-enhanced-squared.png`;
const columbiaInsideCornerRollerPreview = `${_BASE}brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/cornerroller.jpg`;
const columbiaThrottleBoxImg = `${_BASE}brands/Columbia/Schematics/CornerBoxes/ThrottleBox/CORNER-BOX-SCHEMATIC-enhanced.png`;
const columbiaThrottleBoxPreview = `${_BASE}brands/Columbia/Schematics/CornerBoxes/ThrottleBox/throttlebox8small.jpg`;
const columbiaAutomaticFlatBoxImg = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/AUTO-BOX-SCHEMATIC-2022-enhanced.png`;
const columbiaAutomaticFlatBoxPreview = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/automaticbox-1.jpg`;
const columbiaFlatBoxImg = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FlatBox/FLAT-BOX-HINGED-SCHEMATIC-2022-enhanced.png`;
const columbiaFlatBoxPreview = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FlatBox/2023flatbox.jpg`;
const columbiaFatBoyBoxImg = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/fat_boy_box.png`;
const columbiaFatBoyBoxPreview = `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/InsideTrackBoxFrontSmall.png`;
const columbiaAngleHeadImg = `${_BASE}brands/Columbia/Schematics/Angleheads/AngleHead/AngleHead-2014-3-enhanced.png`;
const columbiaAngleHeadPreview = `${_BASE}brands/Columbia/Schematics/Angleheads/AngleHead/angleheadbacksquare.jpg`;
const columbiaGooseneckAdapterImg = `${_BASE}brands/Columbia/Schematics/Pumps/GooseneckAdapter/Gooseneck-1-1-enhanced.png`;
const columbiaGooseneckAdapterPreview = `${_BASE}brands/Columbia/Schematics/Pumps/GooseneckAdapter/goosenecksquare.jpg`;
const columbiaMudPumpImg = `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SCHEMATIC-2022-enhanced.png`;
const columbiaMudPumpSubAssembliesImg = `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.png`;
const columbiaMudPumpPreview = `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/TallBoyMudpumps.jpg`;
const columbiaTallBoyMudPumpImg = `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SCHEMATIC-2022-enhanced.png`;
const columbiaTallBoyMudPumpSubAssembliesImg = `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.png`;
const columbiaTallBoyMudPumpPreview = `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TallBoyPump.jpg`;
const columbiaNailspotterImg = `${_BASE}brands/Columbia/Schematics/Nailspotters/Nailspotter/NAIL-SPOTTER-SCHEMATIC-2022-enhanced.png`;
const columbiaNailspotterPreview = `${_BASE}brands/Columbia/Schematics/Nailspotters/Nailspotter/2023Nailspotter3inch.jpg`;
const columbiaTomahawkSmoothingBladesImg = `${_BASE}brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/TOMAHAWK-SCHEMATIC-2022-enhanced.png`;
const columbiaTomahawkSmoothingBladesPreview = `${_BASE}brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/Tomahawksmoothingblade.jpg`;
const columbiaStandardCornerFlusherImg = `${_BASE}brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3.5INCH-CORNER-FLUSHER-SCHEMATIC-2015-enhanced.png`;
const columbiaStandardCornerFlusherPreview = `${_BASE}brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3inchflusher.png`;
const columbiaDirectCornerFlusherImg = `${_BASE}brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/DirectStandardFlusher-2015-enhanced.png`;
const columbiaDirectCornerFlusherPreview = `${_BASE}brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/2.5_Direct_Flusher_2.5DF.jpg`;
const columbiaComboFlusherImg = `${_BASE}brands/Columbia/Schematics/CornerFlushers/ComboFlusher/Classic_Combo_Flusher-1-enhanced.png`;
const columbiaComboFlusherPreview = `${_BASE}brands/Columbia/Schematics/CornerFlushers/ComboFlusher/combo_flusher.jpg`;
const columbiaSanderHeadImg = `${_BASE}brands/Columbia/Schematics/Sanders/SanderHead/SANDER-HEAD-SCHEMATIC-enhanced.png`;
const columbiaSanderHeadPreview = `${_BASE}brands/Columbia/Schematics/Sanders/SanderHead/sanderwhandlesquaresmall.jpg`;
const columbiaCompoundTubeImg = `${_BASE}brands/Columbia/Schematics/CompoundTubes/CompoundTube/COMPOUND-TUBE-SCHEMATIC-2022-enhanced.png`;
const columbiaCompoundTubePreview = `${_BASE}brands/Columbia/Schematics/CompoundTubes/CompoundTube/compoundtubesquare.jpg`;
const columbiaCamLockTubeImg = `${_BASE}brands/Columbia/Schematics/CompoundTubes/CamLockTube/Cam_Lock_Tube_2019-enhanced.png`;
const columbiaCamLockTubePreview = `${_BASE}brands/Columbia/Schematics/CompoundTubes/CamLockTube/camlocktubesquare.jpg`;
const columbiaSemiAutomaticTaperImg = `${_BASE}brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/SEMI-AUTOMATIC-TAPER-SCHEMATIC-2022-enhanced.png`;
const columbiaSemiAutomaticTaperPreview = `${_BASE}brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/semiautotapersquare.jpg`;
const columbiaOneImg = `${_BASE}brands/Columbia/Schematics/Handles/ColumbiaOne/Columbia_One-enhanced.png`;
const columbiaOnePreview = `${_BASE}brands/Columbia/Schematics/Handles/ColumbiaOne/columbiaonesquare.jpg`;
const columbiaLongExtendableHandleImg = `${_BASE}brands/Columbia/Schematics/Handles/LongExtendableHandle/extendable-handle-enhanced.png`;
const columbiaLongExtendableHandlePreview = `${_BASE}brands/Columbia/Schematics/Handles/LongExtendableHandle/corner_roller_handle_extendible.jpg`;
const columbiaFlatBoxHandleImg = `${_BASE}brands/Columbia/Schematics/Handles/FlatBoxHandle/180GripBoxHandle-2014-enhanced.png`;
const columbiaFlatBoxHandlePreview = `${_BASE}brands/Columbia/Schematics/Handles/FlatBoxHandle/boxhandle.jpg`;
const columbiaClosetMonsterFlatBoxHandleImg = `${_BASE}brands/Columbia/Schematics/Handles/ClosetMonster/ClosetMonster-2015-enhanced.png`;
const columbiaClosetMonsterFlatBoxHandlePreview = `${_BASE}brands/Columbia/Schematics/Handles/ClosetMonster/closet_monster_copy.jpg`;
const columbiaBoxFillerImg = `${_BASE}brands/Columbia/Schematics/Pumps/BoxFiller/Box_Filler.png`;
const columbiaBoxFillerPreview = `${_BASE}brands/Columbia/Schematics/Pumps/BoxFiller/boxfiller.jpg`;
const columbiaCornerCobraImg = `${_BASE}brands/Columbia/Schematics/CornerRollers/CornerCobra/CORNER-COBRA-SCHEMATIC.2024-enhanced.png`;
const columbiaCornerCobraPreview = `${_BASE}brands/Columbia/Schematics/CornerRollers/CornerCobra/NEWCORNERCOBRA-scaled.png`;

// Build a static schematic-id → brand lookup from SCHEMATIC_DEFINITIONS so the
// URL-param handler can resolve the correct brand without needing the full
// schematics array (which is built inside the component).
const SCHEMATIC_ID_TO_BRAND = {};
Object.entries(SCHEMATIC_DEFINITIONS).forEach(([brand, list]) => {
  list.forEach(({ id }) => { SCHEMATIC_ID_TO_BRAND[id] = brand; });
});

export default function Parts() {
  // Allowed brands to display
  const ALLOWED_BRANDS = [
    'TapeTech',
    'Columbia Taping Tools',
    'Asgard',
    'SurPro',
    'Graco'
  ];

  const location = useLocation();

  // Selection flow state
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedSchematic, setSelectedSchematic] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPos, setLastTapPos] = useState({ x: 0, y: 0 });
  const [forceUpdate, setForceUpdate] = useState(0);
  // Ref to track pinch zoom state without triggering re-renders
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1, initPanX: 0, initPanY: 0, centerX: 0, centerY: 0 });
  // Ref to track any active gesture for synchronous transition control
  const gestureActiveRef = useRef(false);
  
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

  // Pre-select brand + schematic when a ?schematic=<id> query param is present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const schematicId = params.get('schematic');
    if (!schematicId) return;
    const brand = SCHEMATIC_ID_TO_BRAND[schematicId];
    if (!brand) return;
    setSelectedBrand(brand);
    setSelectedSchematic(schematicId);
  }, [location.search]);

  // Schematic data for tools

  // Columbia Inside Corner Roller removed from parts schematics per request.

  // Helper: build part-hotspot array from a schematic JSON data object.
  // Supports both the official schema (x_pct / y_pct, 4 dp) and the legacy
  // top / left format for backward compatibility.
  //
  // Official formula:
  //   x_pct = round((center_x_px / image_natural_width)  * 100, 4)  → CSS left
  //   y_pct = round((center_y_px / image_natural_height) * 100, 4)  → CSS top
  const buildPartsFromData = (data) => {
    if (!data || !data.parts) return [];
    const coords = data.coordinates || {};
    return data.parts.map((p) => {
      const c = coords[p.id] || null;
      // x_pct = horizontal = CSS left; y_pct = vertical = CSS top
      const leftVal = c
        ? (c.x_pct !== undefined ? c.x_pct : (c.left !== undefined ? c.left : 50))
        : 50;
      const topVal  = c
        ? (c.y_pct !== undefined ? c.y_pct : (c.top  !== undefined ? c.top  : 50))
        : 50;
      const top  = `${topVal}%`;
      const left = `${leftVal}%`;
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
        rotation: c && c.rotation ? c.rotation : 0,
        // Pass through official schema fields for optional consumer use
        xPx:  c && c.x_px  !== null && c.x_px  !== undefined ? c.x_px  : null,
        yPx:  c && c.y_px  !== null && c.y_px  !== undefined ? c.y_px  : null,
        bbox: c && c.bbox ? c.bbox : null,
      };
    });
  };

  // Build parts arrays from JSON data
  const predatorTaperBodyParts = buildPartsFromData(columbiaPredatorTaperBodyData);
  const predatorTaperHeadParts = buildPartsFromData(columbiaPredatorTaperHeadData);
  const standardOutsideCornerRollerParts = buildPartsFromData(columbiaStandardOutsideCornerRollerData);
  const insideCornerRollerParts = buildPartsFromData(columbiaInsideCornerRollerData);
  const throttleBoxParts = buildPartsFromData(columbiaThrottleBoxData);
  const automaticFlatBoxParts = buildPartsFromData(columbiaAutomaticFlatBoxData);
  const flatBoxParts = buildPartsFromData(columbiaFlatBoxData);
  const fatBoyBoxParts = buildPartsFromData(columbiaFatBoyBoxData);
  const tallBoyMudPumpParts = buildPartsFromData(columbiaTallBoyMudPumpData);
  const nailspotterParts = buildPartsFromData(columbiaNailspotterData);
  const tomahawkParts = buildPartsFromData(columbiaTomahawkData);
  const semiAutomaticTaperParts = buildPartsFromData(columbiaSemiAutomaticTaperData);
  const sanderHeadParts = buildPartsFromData(columbiaSanderHeadData);
  const angleHeadParts = buildPartsFromData(columbiaAngleHeadData);
  const mudPumpParts = buildPartsFromData(columbiaMudPumpData);
  const gooseneckAdapterParts = buildPartsFromData(columbiaGooseneckAdapterData);
  const boxFillerParts = buildPartsFromData(columbiaBoxFillerData);
  const cornerCobraParts = buildPartsFromData(columbiaCornerCobraData);
  const compoundTubeParts = buildPartsFromData(columbiaCompoundTubeDataJson);
  const cf35Parts = buildPartsFromData(columbiaCf35Data);
  const externalCornerApplicatorParts = buildPartsFromData(columbiaExternalCornerApplicatorData);
  const twoWayInternalCornerApplicatorParts = buildPartsFromData(columbiaTwoWayInternalCornerApplicatorData);
  const insideCornerApplicator2WheelParts = buildPartsFromData(columbiaInsideCornerApplicator2WheelData);
  const insideCornerApplicator4WheelParts = buildPartsFromData(columbiaInsideCornerApplicator4WheelData);
  const camLockTubeParts = buildPartsFromData(columbiaCamLockTubeData);
  const closetMonsterParts = buildPartsFromData(columbiaClosetMonsterData);
  const columbiaOneParts = buildPartsFromData(columbiaColumbiaOneData);
  const matrixBoxHandleBoxHandleParts = buildPartsFromData(columbiaMatrixBoxHandleBoxHandleData);
  const matrixBoxHandleHeadParts = buildPartsFromData(columbiaMatrixBoxHandleHeadData);
  const matrixBoxHandleLeverParts = buildPartsFromData(columbiaMatrixBoxHandleLeverData);
  const matrixBoxHandlePinchboxParts = buildPartsFromData(columbiaMatrixBoxHandlePinchboxData);
  const matrixBoxHandleExtensionHousingParts = buildPartsFromData(columbiaMatrixBoxHandleExtensionHousingData);
  const flatBoxHandleParts = buildPartsFromData(columbiaFlatBoxHandleData);
  const longExtendableHandleParts = buildPartsFromData(columbiaLongExtendableHandleData);
  const tapeTechExtendableSupportHandleParts = buildPartsFromData(tapeTechExtendableSupportHandleData);

  const schematics = [
    {
      id: 'columbia-matrix',
      title: 'Predator Matrix Handle',
      description: 'Columbia Predator Matrix Handle series schematic diagrams',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
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
      navHotspots: [
        ...(columbiaMatrixBoxHandleBoxHandleData.navHotspots || []),
        ...(columbiaMatrixBoxHandleHeadData.navHotspots || []),
        ...(columbiaMatrixBoxHandleLeverData.navHotspots || []),
        ...(columbiaMatrixBoxHandlePinchboxData.navHotspots || []),
        ...(columbiaMatrixBoxHandleExtensionHousingData.navHotspots || []),
      ],
      parts: [...matrixBoxHandleBoxHandleParts, ...matrixBoxHandleHeadParts, ...matrixBoxHandleLeverParts, ...matrixBoxHandlePinchboxParts, ...matrixBoxHandleExtensionHousingParts]
    },
    {
      id: 'columbia-predator-taper',
      title: 'Predator Taper',
      description: 'Columbia Predator Taper series schematic diagrams',
      brand: 'Columbia Taping Tools',
      category: 'Automatic Tapers',
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
      navHotspots: [
        ...(columbiaPredatorTaperBodyData.navHotspots || []),
        ...(columbiaPredatorTaperHeadData.navHotspots || []),
      ],
      parts: [...predatorTaperBodyParts, ...predatorTaperHeadParts]
    },
    // TapeTech Extendable Support Handle schematic
    {
      id: 'tapetech-extendable-support-handle',
      title: 'Extendable Support Handle',
      description: 'TapeTech Extendable Support Handle schematic diagram with parts hotspots',
      brand: 'TapeTech',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: tapeTechExtendableSupportHandleImg },
      previewImage: tapeTechExtendableSupportHandlePreview,
      parts: tapeTechExtendableSupportHandleParts
    },
    {
      id: 'columbia-2-way-internal-corner',
      title: '2-Way Internal Corner Applicator',
      description: 'Columbia 2-Way Internal Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Applicators',
      diagramPages: [1],
      imagePages: { 1: columbia2WayInternalCornerImg },
      previewImage: columbia2WayInternalCornerPreview,
      parts: twoWayInternalCornerApplicatorParts
    },
    {
      id: 'columbia-external-corner-applicator',
      title: 'External Corner Applicator',
      description: 'Columbia External Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Applicators',
      diagramPages: [1],
      imagePages: { 1: columbiaExternalCornerApplicatorImg },
      previewImage: columbiaExternalCornerApplicatorPreview,
      parts: externalCornerApplicatorParts
    },
    {
      id: 'columbia-inside-corner-applicator',
      title: 'Inside Corner Applicator',
      description: 'Columbia Inside Corner Applicator schematic diagrams',
      brand: 'Columbia Taping Tools',
      category: 'Applicators',
      diagramPages: [1, 2],
      pageLabels: {
        1: '2-Wheel',
        2: '4-Wheel'
      },
      imagePages: {
        1: columbiaInsideCornerApplicator2WheelImg,
        2: columbiaInsideCornerApplicator4WheelImg
      },
      previewImage: columbiaInsideCornerApplicatorPreview,
      parts: [...insideCornerApplicator2WheelParts, ...insideCornerApplicator4WheelParts]
    },
    {
      id: 'columbia-standard-outside-corner-roller',
      title: 'Standard Outside Corner Roller',
      description: 'Columbia Standard Outside Corner Roller schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: columbiaStandardOutsideCornerRollerImg },
      previewImage: columbiaStandardOutsideCornerRollerPreview,
      parts: standardOutsideCornerRollerParts
    },
    {
      id: 'columbia-inside-corner-roller',
      title: 'Inside Corner Roller',
      description: 'Columbia Inside Corner Roller schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: columbiaInsideCornerRollerImg },
      previewImage: columbiaInsideCornerRollerPreview,
      parts: insideCornerRollerParts
    },
    {
      id: 'columbia-throttle-box',
      title: 'Throttle Box',
      description: 'Columbia Throttle Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Boxes',
      diagramPages: [1],
      imagePages: { 1: columbiaThrottleBoxImg },
      previewImage: columbiaThrottleBoxPreview,
      parts: throttleBoxParts
    },
    {
      id: 'columbia-automatic-flat-box',
      title: 'Automatic Flat Box',
      description: 'Columbia Automatic Flat Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: columbiaAutomaticFlatBoxImg },
      previewImage: columbiaAutomaticFlatBoxPreview,
      parts: automaticFlatBoxParts
    },
    {
      id: 'columbia-flat-box',
      title: 'Flat Box',
      description: 'Columbia Flat Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: columbiaFlatBoxImg },
      previewImage: columbiaFlatBoxPreview,
      parts: flatBoxParts
    },
    {
      id: 'columbia-fat-boy-box',
      title: 'Fat Boy Box',
      description: 'Columbia Fat Boy Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: columbiaFatBoyBoxImg },
      previewImage: columbiaFatBoyBoxPreview,
      parts: fatBoyBoxParts
    },
    {
      id: 'columbia-angle-head',
      title: 'Angle Head',
      description: 'Columbia Angle Head schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Angleheads',
      diagramPages: [1],
      imagePages: { 1: columbiaAngleHeadImg },
      previewImage: columbiaAngleHeadPreview,
      parts: angleHeadParts
    },
    {
      id: 'columbia-gooseneck-adapter',
      title: 'Gooseneck Adapter',
      description: 'Columbia Gooseneck Adapter schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: columbiaGooseneckAdapterImg },
      previewImage: columbiaGooseneckAdapterPreview,
      parts: gooseneckAdapterParts
    },
    {
      id: 'columbia-mud-pump',
      title: 'Mud Pump',
      description: 'Columbia Mud Pump schematic diagrams',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1, 2],
      pageLabels: {
        1: 'Sub-Assemblies',
        2: 'Schematic'
      },
      imagePages: {
        1: columbiaMudPumpSubAssembliesImg,
        2: columbiaMudPumpImg
      },
      previewImage: columbiaMudPumpPreview,
      parts: mudPumpParts
    },
    {
      id: 'columbia-tall-boy-mud-pump',
      title: 'Tall Boy Mud Pump',
      description: 'Columbia Tall Boy Mud Pump schematic diagrams',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1, 2],
      pageLabels: {
        1: 'Sub-Assemblies',
        2: 'Schematic'
      },
      imagePages: {
        1: columbiaTallBoyMudPumpSubAssembliesImg,
        2: columbiaTallBoyMudPumpImg
      },
      previewImage: columbiaTallBoyMudPumpPreview,
      parts: tallBoyMudPumpParts
    },
    {
      id: 'columbia-nailspotter',
      title: 'Nailspotter 3"',
      description: 'Columbia Nailspotter 3" schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Nailspotters',
      diagramPages: [1],
      imagePages: { 1: columbiaNailspotterImg },
      previewImage: columbiaNailspotterPreview,
      parts: nailspotterParts
    },
    {
      id: 'columbia-tomahawk-smoothing-blades',
      title: 'Tomahawk Smoothing Blades',
      description: 'Columbia Tomahawk Smoothing Blades schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Smoothing Blades',
      diagramPages: [1],
      imagePages: { 1: columbiaTomahawkSmoothingBladesImg },
      previewImage: columbiaTomahawkSmoothingBladesPreview,
      parts: tomahawkParts
    },
    {
      id: 'columbia-standard-corner-flusher',
      title: 'Standard Corner Flusher',
      description: 'Columbia Standard Corner Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: columbiaStandardCornerFlusherImg },
      previewImage: columbiaStandardCornerFlusherPreview,
      parts: cf35Parts
    },
    {
      id: 'columbia-direct-corner-flusher',
      title: 'Direct Corner Flusher',
      description: 'Columbia Direct Corner Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: columbiaDirectCornerFlusherImg },
      previewImage: columbiaDirectCornerFlusherPreview,
      parts: columbiaDirectCornerFlusherData?.parts || []
    },
    {
      id: 'columbia-combo-flusher',
      title: 'Combo Flusher',
      description: 'Columbia Combo Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: columbiaComboFlusherImg },
      previewImage: columbiaComboFlusherPreview,
      parts: columbiaComboFlusherData?.parts || []
    },
    {
      id: 'columbia-sander-head',
      title: 'Sander Head',
      description: 'Columbia Sander Head schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Sanders',
      diagramPages: [1],
      imagePages: { 1: columbiaSanderHeadImg },
      previewImage: columbiaSanderHeadPreview,
      parts: sanderHeadParts
    },
    {
      id: 'columbia-compound-tube',
      title: 'Compound Tube',
      description: 'Columbia Compound Tube schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Compound Tubes',
      diagramPages: [1],
      imagePages: { 1: columbiaCompoundTubeImg },
      previewImage: columbiaCompoundTubePreview,
      parts: compoundTubeParts
    },
    {
      id: 'columbia-cam-lock-tube',
      title: 'Cam Lock Tube',
      description: 'Columbia Cam Lock Tube schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Compound Tubes',
      diagramPages: [1],
      imagePages: { 1: columbiaCamLockTubeImg },
      previewImage: columbiaCamLockTubePreview,
      parts: camLockTubeParts
    },
    {
      id: 'columbia-semi-automatic-taper',
      title: 'Semi-Automatic Taper',
      description: 'Columbia Semi-Automatic Taper schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Semi-Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: columbiaSemiAutomaticTaperImg },
      previewImage: columbiaSemiAutomaticTaperPreview,
      parts: semiAutomaticTaperParts
    },
    {
      id: 'columbia-one',
      title: 'Columbia One',
      description: 'Columbia One schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: columbiaOneImg },
      previewImage: columbiaOnePreview,
      parts: columbiaOneParts
    },
    {
      id: 'columbia-long-extendable-handle',
      title: 'Long Extendable Handle',
      description: 'Columbia Long Extendable Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: columbiaLongExtendableHandleImg },
      previewImage: columbiaLongExtendableHandlePreview,
      parts: longExtendableHandleParts
    },
    {
      id: 'columbia-flat-box-handle',
      title: 'Flat Box Handle',
      description: 'Columbia Flat Box Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: columbiaFlatBoxHandleImg },
      previewImage: columbiaFlatBoxHandlePreview,
      parts: flatBoxHandleParts
    },
    {
      id: 'columbia-closet-monster-flat-box-handle',
      title: 'Closet Monster Flat Box Handle',
      description: 'Columbia Closet Monster Flat Box Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: columbiaClosetMonsterFlatBoxHandleImg },
      previewImage: columbiaClosetMonsterFlatBoxHandlePreview,
      parts: closetMonsterParts
    },
    {
      id: 'columbia-box-filler',
      title: 'Box Filler',
      description: 'Columbia Box Filler schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: columbiaBoxFillerImg },
      previewImage: columbiaBoxFillerPreview,
      parts: boxFillerParts
    },
    {
      id: 'columbia-corner-cobra',
      title: 'Corner Cobra',
      description: 'Columbia Corner Cobra schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: columbiaCornerCobraImg },
      previewImage: columbiaCornerCobraPreview,
      parts: cornerCobraParts
    }
  ];

  // Filter schematics to only include tools from allowed brands
  const allowedSchematics = schematics.filter(s => !s.brand || ALLOWED_BRANDS.includes(s.brand));

  // Filter schematics by search query across brand, category, and tool name
  const searchResults = searchQuery.trim()
    ? allowedSchematics.filter(s => {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.brand?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
        );
      })
    : [];

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
      gestureActiveRef.current = true;
      setForceUpdate(prev => prev + 1);
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
      // Smooth continuous pinch zoom
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
      const rawScale = zoomFactor * initScale;
      const newScale = Math.min(Math.max(rawScale, 0.5), 5);

      // Zoom towards pinch center with smooth focal point tracking
      const ratio = newScale / initScale;
      const newPanX = centerX - (centerX - initPanX) * ratio;
      const newPanY = centerY - (centerY - initPanY) * ratio;

      // Dynamic bounds based on actual image dimensions
      const container = schematicContainerRef.current;
      const imageDiv = schematicImageRef.current;
      const containerW = container ? container.offsetWidth : 400;
      const containerH = imageDiv ? imageDiv.offsetHeight : (container ? container.offsetHeight : 400);
      const maxPanX = Math.max(0, ((newScale - 1) * containerW) / 2);
      const maxPanY = Math.max(0, ((newScale - 1) * containerH) / 2);

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
          gestureActiveRef.current = true;
          setForceUpdate(prev => prev + 1);
        }
        
        // Pan when zoomed - smooth panning with dynamic bounds
        const newX = touch.clientX - startPanPosition.x;
        const newY = touch.clientY - startPanPosition.y;
        
        // Constrain pan based on scale and container size
        const container = schematicContainerRef.current;
        const containerW = container ? container.offsetWidth : 400;
        const containerH = container ? container.offsetHeight : 400;
        const maxPanX = Math.max(0, ((scale - 1) * containerW) / 2);
        const maxPanY = Math.max(0, ((scale - 1) * containerH) / 2);
        
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
      const wasActive = gestureActiveRef.current;
      gestureActiveRef.current = false;
      if (wasActive) setForceUpdate(prev => prev + 1);
      
      // Double-tap to zoom
      if (!hasMoved && e.changedTouches.length === 1) {
        const now = Date.now();
        const touch = e.changedTouches[0];
        const tapX = touch.clientX;
        const tapY = touch.clientY;
        const timeSinceLastTap = now - lastTapTime;
        const distanceFromLastTap = Math.hypot(tapX - lastTapPos.x, tapY - lastTapPos.y);
        
        if (timeSinceLastTap < 300 && distanceFromLastTap < 30) {
          // Double tap detected - zoom in/out
          e.preventDefault();
          const container = schematicContainerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const centerX = tapX - (rect.left + rect.width / 2);
            const centerY = tapY - (rect.top + rect.height / 2);
            
            if (scale === 1) {
              // Zoom in to 2.5x at tap point
              const newScale = 2.5;
              const containerW = container.offsetWidth;
              const containerH = container.offsetHeight;
              const ratio = newScale / scale;
              const newPanX = centerX - (centerX - position.x) * ratio;
              const newPanY = centerY - (centerY - position.y) * ratio;
              const maxPanX = Math.max(0, ((newScale - 1) * containerW) / 2);
              const maxPanY = Math.max(0, ((newScale - 1) * containerH) / 2);
              
              setScale(newScale);
              setPosition({
                x: Math.min(Math.max(newPanX, -maxPanX), maxPanX),
                y: Math.min(Math.max(newPanY, -maxPanY), maxPanY),
              });
            } else {
              // Zoom out to 1x
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }
          }
          setLastTapTime(0);
        } else {
          setLastTapTime(now);
          setLastTapPos({ x: tapX, y: tapY });
        }
      }
      
      setIsPanning(false);
      setHasMoved(false);
    } else if (e.touches.length === 1 && pinchRef.current.active) {
      // Transitioned from pinch to single-touch — reset pinch tracking cleanly
      pinchRef.current.active = false;
      // Keep gesture active if user continues with single finger
      if (scale > 1) {
        const touch = e.touches[0];
        setTouchStartPos({ x: touch.clientX, y: touch.clientY });
        setHasMoved(false);
        setStartPanPosition({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y
        });
      } else {
        gestureActiveRef.current = false;
      }
    }
  }, [hasMoved, scale, position, lastTapTime, lastTapPos]);

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
        minHeight: '100vh',
        backgroundColor: '#f9fafb'
      }} 
      className={`section-enter page-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onClick={closeModal}
    >
      {/* Container wrapper with consistent padding like Products page */}
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: isFullscreen ? '16px' : '2px 16px 24px'
      }}>
      {/* Show BrandSelector if no brand selected */}
      {!selectedBrand ? (
        <BrandSelector
          brands={brands}
          onSelectBrand={(brand) => {
            setSelectedBrand(brand);
            setSelectedSchematic(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          searchQuery={searchQuery}
          onSearchChange={(e) => setSearchQuery(e.target.value)}
          searchResults={searchResults}
          onSelectSchematic={(schematic) => {
            const firstPage = (schematic.diagramPages && schematic.diagramPages[0]) || 1;
            setSelectedBrand(schematic.brand);
            setSelectedSchematic(schematic.id);
            setCurrentPage(firstPage);
            setSearchQuery('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : !selectedSchematic ? (
        /* Show ToolSelector if brand selected but no schematic */
        <ToolSelector
          brand={selectedBrand}
          brandLogo={brandLogos[selectedBrand]}
          tools={allowedSchematics.filter(s => s.brand === selectedBrand)}
          onSelectTool={(tool) => {
            setSelectedSchematic(tool.id);
            const s = allowedSchematics.find(sch => sch.id === tool.id);
            const firstPage = (s && s.diagramPages && s.diagramPages[0]) || 1;
            setCurrentPage(firstPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBack={() => {
            setSelectedBrand(null);
            setSelectedSchematic(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        /* Show Schematic Viewer if schematic selected */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',
          overflow: 'hidden',
          height: '100%'
        }}>
          {/* Top Back Button - Positioned in top left */}
          <div style={{
            padding: 'clamp(12px, 2vw, 20px) clamp(12px, 2vw, 20px) 0 clamp(12px, 2vw, 20px)',
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
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label="Back to Tools"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </div>

          {/* Schematic Container Wrapper - Allows flex growth with responsive sizing */}
          <div style={{
            maxWidth: isFullscreen ? '100%' : 'clamp(600px, 95vw, 1400px)',
            margin: '0 auto',
            padding: isFullscreen ? '0' : 'clamp(12px, 2vw, 20px)',
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
            marginBottom: 'clamp(24px, 4vw, 40px)', 
            textAlign: 'center',
            flexShrink: 0,
            padding: 'clamp(12px, 2vw, 20px)'
          }}>
            {brandLogos[currentSchematic?.brand] ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <img
                  src={brandLogos[currentSchematic.brand]}
                  alt={`${currentSchematic.brand} logo`}
                  style={{
                    height: 'clamp(2.5rem, 6vw, 4rem)',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
            ) : (
              <h3 style={{ 
                fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
                margin: '0 0 8px 0',
                letterSpacing: '-0.02em',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}>
                {currentSchematic?.brand}
              </h3>
            )}
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
                  width: '100%',
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transformOrigin: 'center center',
                  transition: gestureActiveRef.current ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  pointerEvents: 'auto',
                  willChange: scale > 1 || gestureActiveRef.current ? 'transform' : 'auto',
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
                {currentSchematic.parts.filter(part => !part.pageNumber || part.pageNumber === currentPage).map((part, index) => (
                  <div
                    key={`${part.id}-${part.position.top}-${part.position.left}-${index}`}
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
                      // Check if this is a navigation hotspot
                      if (part.name === 'SEE HEAD DETAIL') {
                        setCurrentPage(2);
                        closeModal();
                      } else if (part.name === 'SEE LEVER DETAIL') {
                        setCurrentPage(3);
                        closeModal();
                      } else if (part.name === 'SEE PINCHBOX DETAIL') {
                        setCurrentPage(4);
                        closeModal();
                      } else if (part.name === 'SEE EXTENSION HOUSING DETAIL') {
                        setCurrentPage(5);
                        closeModal();
                      } else if (activeHotspot === part.id) {
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
                  .map((nh, navIndex) => (
                    <div
                      key={`${nh.id}-${nh.top}-${nh.left}-${navIndex}`}
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
      </div>
    </section>
  );
}
