import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Toast from '../components/Toast';
import BrandSelector from '../components/BrandSelector';
import ToolSelector from '../components/ToolSelector';
import { getProductBySku } from '../api/products';
import { SCHEMATIC_DEFINITIONS } from '../data/schematicMappings';
import { useSchematicMedia } from '../hooks/useSchematicMedia';
import '../styles/mobile-schematic.css';
import SEOHead from '../components/SEOHead';
import { buildBreadcrumbSchema } from '../utils/schema';

import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_taping_tools_logo.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import gracoLogo from '/brands/Graco/graco_logo.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import platinumLogo from '/brands/Platinum/platinum_logo.svg';
import duraStiltsLogo from '/brands/Dura-Stilts/dura-stilts-logo.svg';

const brandLogos = {
  'TapeTech': tapeTechLogo,
  'Columbia Taping Tools': columbiaLogo,
  'SurPro': surproLogo,
  'Asgard': asgardLogo,
  'Graco': gracoLogo,
  'Level5': level5Logo,
  'Platinum Drywall Tools': platinumLogo,
  'Dura-Stilts': duraStiltsLogo,
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
// Asgard schematic JSON data imports
// ---------------------------------------------------------------------------
import asgardFA01ADData    from '/brands/Asgard/Schematics/Adapters/FA01-AD/schematic_data.json';
import asgardAH25ADData    from '/brands/Asgard/Schematics/AngleHeads/AH25-AD/schematic_data.json';
import asgardAH30ADData    from '/brands/Asgard/Schematics/AngleHeads/AH30-AD/schematic_data.json';
import asgardAH35ADData    from '/brands/Asgard/Schematics/AngleHeads/AH35-AD/schematic_data.json';
import asgardCA08ADData    from '/brands/Asgard/Schematics/AngleHeads/CA08-AD/schematic_data.json';
import asgardCFAADData     from '/brands/Asgard/Schematics/AngleHeads/CFA-AD/schematic_data.json';
import asgardEHC07ADData   from '/brands/Asgard/Schematics/FinishingBoxes/EHC07-AD/schematic_data.json';
import asgardEHC10ADData   from '/brands/Asgard/Schematics/FinishingBoxes/EHC10-AD/schematic_data.json';
import asgardEHC12ADData   from '/brands/Asgard/Schematics/FinishingBoxes/EHC12-AD/schematic_data.json';
import asgardEZ07ADData    from '/brands/Asgard/Schematics/FinishingBoxes/EZ07-AD/schematic_data.json';
import asgardEZ10ADData    from '/brands/Asgard/Schematics/FinishingBoxes/EZ10-AD/schematic_data.json';
import asgardEZ12ADData    from '/brands/Asgard/Schematics/FinishingBoxes/EZ12-AD/schematic_data.json';
import asgardPA07ADData    from '/brands/Asgard/Schematics/FinishingBoxes/PA07-AD/schematic_data.json';
import asgardPA10ADData    from '/brands/Asgard/Schematics/FinishingBoxes/PA10-AD/schematic_data.json';
import asgardPA12ADData    from '/brands/Asgard/Schematics/FinishingBoxes/PA12-AD/schematic_data.json';
import asgardBBHADData     from '/brands/Asgard/Schematics/Handles/BBH-AD/schematic_data.json';
import asgardBBHEADData    from '/brands/Asgard/Schematics/Handles/BBHE-AD/schematic_data.json';
import asgardFBHEADData    from '/brands/Asgard/Schematics/Handles/FBHE-AD/schematic_data.json';
import asgardFHADData      from '/brands/Asgard/Schematics/Handles/FH-AD/schematic_data.json';
import asgardXHADData      from '/brands/Asgard/Schematics/Handles/XH-AD/schematic_data.json';
import asgardGN01ADData    from '/brands/Asgard/Schematics/Other/GN01-AD/schematic_data.json';
import asgardLP01ADData    from '/brands/Asgard/Schematics/Pumps/LP01-AD/schematic_data.json';
import asgardCR01ADData    from '/brands/Asgard/Schematics/Rollers/CR01-AD/schematic_data.json';
import asgardNS03ADData    from '/brands/Asgard/Schematics/Spotters/NS03-AD/schematic_data.json';
import asgardAT01ADData    from '/brands/Asgard/Schematics/Tapers/AT01-AD/schematic_data.json';

// ---------------------------------------------------------------------------
// Level5 schematic JSON data imports
// ---------------------------------------------------------------------------
import level5CornerRollerData         from '/brands/Level5/Schematics/CornerRollers/Corner-Roller/schematic_data.json';
import level5CutterChainAssemblyData  from '/brands/Level5/Schematics/AutomaticTapers/Cutter-Chain-Assembly/schematic_data.json';
import level5DriveDogAssemblyData     from '/brands/Level5/Schematics/AutomaticTapers/Drive-Dog-Assembly/schematic_data.json';
import level5GooserAssemblyData       from '/brands/Level5/Schematics/AutomaticTapers/Gooser-Assembly/schematic_data.json';
import level5TaperWheelAssemblyData   from '/brands/Level5/Schematics/AutomaticTapers/Taper-Wheel-Assembly/schematic_data.json';
import level5CoverPlateAssemblyData   from '/brands/Level5/Schematics/AutomaticTapers/Cover-Plate-Assembly/schematic_data.json';
import level5CornerFinisher35Data     from '/brands/Level5/Schematics/CornerFinishers/3.5-inch-Corner-Finisher/schematic_data.json';
import level57inFlatBoxData           from '/brands/Level5/Schematics/FinishingBoxes/7-inch-Flat-Box/schematic_data.json';
import level57inMegaFlatBoxData       from '/brands/Level5/Schematics/FinishingBoxes/7-inch-Mega-Flat-Box/schematic_data.json';
import level510inFlatBoxData          from '/brands/Level5/Schematics/FinishingBoxes/10-inch-Flat-Box/schematic_data.json';
import level510inMegaFlatBoxData      from '/brands/Level5/Schematics/FinishingBoxes/10-inch-Mega-Flat-Box/schematic_data.json';
import level512inFlatBoxData          from '/brands/Level5/Schematics/FinishingBoxes/12-inch-Flat-Box/schematic_data.json';
import level512inMegaBoxData          from '/brands/Level5/Schematics/FinishingBoxes/12-inch-Mega-Box/schematic_data.json';
import level514inFlatBoxData          from '/brands/Level5/Schematics/FinishingBoxes/14-inch-Flat-Box/schematic_data.json';
import level5CompoundPumpData         from '/brands/Level5/Schematics/Pumps/Compound-Pump/schematic_data.json';

// ---------------------------------------------------------------------------
// Platinum schematic JSON data imports
// ---------------------------------------------------------------------------
import platinumCompoundPumpData       from '/brands/Platinum/Schematics/CompoundPump/schematic_data.json';
import platinumFlatBoxData            from '/brands/Platinum/Schematics/FlatBox/schematic_data.json';
import platinumOutsideCornerRollerData from '/brands/Platinum/Schematics/OutsideCornerRoller/schematic_data.json';

// ---------------------------------------------------------------------------
// Schematic image paths — static fallbacks served from public/brands/…
// Primary source: WordPress Media Library WebP images (via useSchematicMedia).
// Fallback: original PNG/JPG files from public/brands/ (used before WP upload).
//
// Migration: run scripts/convert_schematics_to_webp.py then
//            scripts/upload_schematics_to_wp.py to populate WP Media Library.
//            Once confirmed, originals in public/brands/*/Schematics/ can be deleted.
// ---------------------------------------------------------------------------
const _BASE = process.env.PUBLIC_URL;

// Static fallback image paths — all converted to WebP.
// These are served from public/brands/ and copied verbatim into dist/ by webpack.
const _fallbacks = {
  'columbia-matrix': {
    pages: {
      1: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/Matrix_Handle-enhanced.webp`,
      2: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Head/Matrix_Head-enhanced-enhanced.webp`,
      3: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Lever/Matrix_Lever-1-enhanced.webp`,
      4: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/Pinchbox/Matrix_Pinchbox-1-enhanced.webp`,
      5: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/ExtensionHousing/Extension_Housing_Schematic-1-enhanced.webp`,
    },
    preview: `${_BASE}brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/columbia_matrix_box_handle.webp`,
  },
  'columbia-predator-taper': {
    pages: {
      1: `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Body/predator_taper_body.webp`,
      2: `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Head/predator_taper_head.webp`,
    },
    preview: `${_BASE}brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/predator_taper.webp`,
  },
  'tapetech-extendable-support-handle': {
    pages: { 1: `${_BASE}brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_SCH.webp` },
    preview: `${_BASE}brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_02-300x300.webp`,
  },
  'columbia-2-way-internal-corner': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/2_Way_Internal_Corner_Applicator-1-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/Two-Way_Internal_Corner_Applicator.webp`,
  },
  'columbia-external-corner-applicator': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Applicators/ExternalCorner/8_Wheel_External_Corner_Applicator-1-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Applicators/ExternalCorner/External_90_Aplicator_CEXT90_-_FRONT.webp`,
  },
  'columbia-inside-corner-applicator': {
    pages: {
      1: `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/2Wheel/ICA1-2-2015.webp`,
      2: `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/4Wheel/ICA1-4-2015.webp`,
    },
    preview: `${_BASE}brands/Columbia/Schematics/Applicators/InsideCornerApplicator/Inside_Corner_Applicator_4_Wheels_ICA1-4_-_BACK.webp`,
  },
  // (Inside Corner Roller images/data intentionally removed from parts schematics)
  'columbia-standard-outside-corner-roller': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/OutsideCornerRollers-2016-1-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/External_90_Aplicator.webp`,
  },
  'columbia-inside-corner-roller': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/InsideCornerRoller-2014_1_-enhanced-squared.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/cornerroller.webp`,
  },
  'columbia-throttle-box': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerBoxes/ThrottleBox/CORNER-BOX-SCHEMATIC-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerBoxes/ThrottleBox/throttlebox8small.webp`,
  },
  'columbia-automatic-flat-box': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/AUTO-BOX-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/automaticbox-1.webp`,
  },
  'columbia-flat-box': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FlatBox/FLAT-BOX-HINGED-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FlatBox/2023flatbox.webp`,
  },
  'columbia-fat-boy-box': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/fat_boy_box.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/InsideTrackBoxFrontSmall.webp`,
  },
  'columbia-angle-head': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Angleheads/AngleHead/AngleHead-2014-3-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Angleheads/AngleHead/angleheadbacksquare.webp`,
  },
  'columbia-gooseneck-adapter': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Pumps/GooseneckAdapter/Gooseneck-1-1-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Pumps/GooseneckAdapter/goosenecksquare.webp`,
  },
  'columbia-mud-pump': {
    pages: {
      1: `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.webp`,
      2: `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SCHEMATIC-2022-enhanced.webp`,
    },
    preview: `${_BASE}brands/Columbia/Schematics/Pumps/MudPump/TallBoyMudpumps.webp`,
  },
  'columbia-tall-boy-mud-pump': {
    pages: {
      1: `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.webp`,
      2: `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SCHEMATIC-2022-enhanced.webp`,
    },
    preview: `${_BASE}brands/Columbia/Schematics/Pumps/TallBoyMudPump/TallBoyPump.webp`,
  },
  'columbia-nailspotter': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Nailspotters/Nailspotter/NAIL-SPOTTER-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Nailspotters/Nailspotter/2023Nailspotter3inch.webp`,
  },
  'columbia-tomahawk-smoothing-blades': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/TOMAHAWK-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/Tomahawksmoothingblade.webp`,
  },
  'columbia-standard-corner-flusher': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3.5INCH-CORNER-FLUSHER-SCHEMATIC-2015-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3inchflusher.webp`,
  },
  'columbia-direct-corner-flusher': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/DirectStandardFlusher-2015-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/2.5_Direct_Flusher_2.5DF.webp`,
  },
  'columbia-combo-flusher': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerFlushers/ComboFlusher/Classic_Combo_Flusher-1-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerFlushers/ComboFlusher/combo_flusher.webp`,
  },
  'columbia-sander-head': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Sanders/SanderHead/SANDER-HEAD-SCHEMATIC-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Sanders/SanderHead/sanderwhandlesquaresmall.webp`,
  },
  'columbia-compound-tube': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CompoundTubes/CompoundTube/COMPOUND-TUBE-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CompoundTubes/CompoundTube/compoundtubesquare.webp`,
  },
  'columbia-cam-lock-tube': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CompoundTubes/CamLockTube/Cam_Lock_Tube_2019-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CompoundTubes/CamLockTube/camlocktubesquare.webp`,
  },
  'columbia-semi-automatic-taper': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/SEMI-AUTOMATIC-TAPER-SCHEMATIC-2022-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/semiautotapersquare.webp`,
  },
  'columbia-one': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Handles/ColumbiaOne/Columbia_One-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Handles/ColumbiaOne/columbiaonesquare.webp`,
  },
  'columbia-long-extendable-handle': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Handles/LongExtendableHandle/extendable-handle-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Handles/LongExtendableHandle/corner_roller_handle_extendible.webp`,
  },
  'columbia-flat-box-handle': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Handles/FlatBoxHandle/180GripBoxHandle-2014-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Handles/FlatBoxHandle/boxhandle.webp`,
  },
  'columbia-closet-monster-flat-box-handle': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Handles/ClosetMonster/ClosetMonster-2015-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Handles/ClosetMonster/closet_monster_copy.webp`,
  },
  'columbia-box-filler': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/Pumps/BoxFiller/Box_Filler.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/Pumps/BoxFiller/boxfiller.webp`,
  },
  'columbia-corner-cobra': {
    pages: { 1: `${_BASE}brands/Columbia/Schematics/CornerRollers/CornerCobra/CORNER-COBRA-SCHEMATIC.2024-enhanced.webp` },
    preview: `${_BASE}brands/Columbia/Schematics/CornerRollers/CornerCobra/NEWCORNERCOBRA-scaled.webp`,
  },

  // ── Asgard ─────────────────────────────────────────────────────────────────
  'asgard-fa01-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Adapters/FA01-AD/images/FA01-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Adapters/FA01-AD/images/FA01-AD_preview.webp`,
  },
  'asgard-ah25-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH25-AD/images/AH25-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH25-AD/images/AH25-AD_preview.webp`,
  },
  'asgard-ah30-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH30-AD/images/AH30-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH30-AD/images/AH30-AD_preview.webp`,
  },
  'asgard-ah35-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH35-AD/images/AH35-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/AngleHeads/AH35-AD/images/AH35-AD_preview.webp`,
  },
  'asgard-ca08-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/AngleHeads/CA08-AD/images/CA08-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/AngleHeads/CA08-AD/images/CA08-AD_preview.webp`,
  },
  'asgard-cfa-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/AngleHeads/CFA-AD/images/CFA-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/AngleHeads/CFA-AD/images/CFA-AD_preview.webp`,
  },
  'asgard-ehc07-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC07-AD/images/EHC07-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC07-AD/images/EHC07-AD_preview.webp`,
  },
  'asgard-ehc10-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC10-AD/images/EHC10-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC10-AD/images/EHC10-AD_preview.webp`,
  },
  'asgard-ehc12-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC12-AD/images/EHC12-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EHC12-AD/images/EHC12-AD_preview.webp`,
  },
  'asgard-ez07-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ07-AD/images/EZ07-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ07-AD/images/EZ07-AD_preview.webp`,
  },
  'asgard-ez10-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ10-AD/images/EZ10-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ10-AD/images/EZ10-AD_preview.webp`,
  },
  'asgard-ez12-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ12-AD/images/EZ12-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/EZ12-AD/images/EZ12-AD_preview.webp`,
  },
  'asgard-pa07-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA07-AD/images/PA07-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA07-AD/images/PA07-AD_preview.webp`,
  },
  'asgard-pa10-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA10-AD/images/PA10-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA10-AD/images/PA10-AD_preview.webp`,
  },
  'asgard-pa12-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA12-AD/images/PA12-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/FinishingBoxes/PA12-AD/images/PA12-AD_preview.webp`,
  },
  'asgard-bbh-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Handles/BBH-AD/images/BBH-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Handles/BBH-AD/images/BBH-AD_preview.webp`,
  },
  'asgard-bbhe-ad': {
    pages: {
      1: `${_BASE}brands/Asgard/Schematics/Handles/BBHE-AD/images/BBHE-AD_SCH-page-001.webp`,
      2: `${_BASE}brands/Asgard/Schematics/Handles/BBHE-AD/images/BBHE-AD_SCH-page-002.webp`,
    },
    preview: `${_BASE}brands/Asgard/Schematics/Handles/BBHE-AD/images/BBHE-AD_preview.webp`,
  },
  'asgard-fbhe-ad': {
    pages: {
      1: `${_BASE}brands/Asgard/Schematics/Handles/FBHE-AD/images/FBHE-AD_SCH-page-001.webp`,
      2: `${_BASE}brands/Asgard/Schematics/Handles/FBHE-AD/images/FBHE-AD_SCH-page-002.webp`,
    },
    preview: `${_BASE}brands/Asgard/Schematics/Handles/FBHE-AD/images/FBHE-AD_preview.webp`,
  },
  'asgard-fh-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Handles/FH-AD/images/FH-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Handles/FH-AD/images/FH-AD_preview.webp`,
  },
  'asgard-xh-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Handles/XH-AD/images/XH-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Handles/XH-AD/images/XH-AD_preview.webp`,
  },
  'asgard-gn01-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Other/GN01-AD/images/GN01-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Other/GN01-AD/images/GN01-AD_preview.webp`,
  },
  'asgard-lp01-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Pumps/LP01-AD/images/LP01-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Pumps/LP01-AD/images/LP01-AD_preview.webp`,
  },
  'asgard-cr01-ad': {
    pages: { 1: `${_BASE}brands/Asgard/Schematics/Rollers/CR01-AD/images/CR01-AD_SCH-page-001.webp` },
    preview: `${_BASE}brands/Asgard/Schematics/Rollers/CR01-AD/images/CR01-AD_preview.webp`,
  },
  'asgard-ns03-ad': {
    pages: {
      1: `${_BASE}brands/Asgard/Schematics/Spotters/NS03-AD/images/NS03-AD_SCH-page-001.webp`,
    },
    preview: `${_BASE}brands/Asgard/Schematics/Spotters/NS03-AD/images/NS03-AD_preview.webp`,
  },
  'asgard-at01-ad': {
    pages: {
      1:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-001.webp`,
      2:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-002.webp`,
      3:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-003.webp`,
      4:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-004.webp`,
      5:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-005.webp`,
      6:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-006.webp`,
      7:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-007.webp`,
      8:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-008.webp`,
      9:  `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-009.webp`,
      10: `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-010.webp`,
      11: `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-011.webp`,
      12: `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_SCH-page-012.webp`,
    },
    preview: `${_BASE}brands/Asgard/Schematics/Tapers/AT01-AD/images/AT01-AD_preview.webp`,
  },

  // ── Level5 ────────────────────────────────────────────────────────────────
  'level5-corner-roller-4-707': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/CornerRollers/Corner-Roller/4-707_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/CornerRollers/Corner-Roller/4-707_preview.webp`,
  },
  'level5-9333-cutter-chain-assembly': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Cutter-Chain-Assembly/9333_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Cutter-Chain-Assembly/9333_SCH-page-001.webp`,
  },
  'level5-7097-drive-dog-assembly': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Drive-Dog-Assembly/7097_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Drive-Dog-Assembly/7097_SCH-page-001.webp`,
  },
  'level5-7293-gooser-assembly': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Gooser-Assembly/7293_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Gooser-Assembly/7293_SCH-page-001.webp`,
  },
  'level5-7218-taper-wheel-assembly': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Taper-Wheel-Assembly/7218_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Taper-Wheel-Assembly/7218_SCH-page-001.webp`,
  },
  'level5-7377-cover-plate-assembly-old-style': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Cover-Plate-Assembly/7377_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/AutomaticTapers/Cover-Plate-Assembly/7377_SCH-page-001.webp`,
  },
  'level5-4-734-3-5-corner-finisher': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/CornerFinishers/3.5-inch-Corner-Finisher/4-734_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/CornerFinishers/3.5-inch-Corner-Finisher/4-734_SCH-page-001.webp`,
  },
  'level5-7-inch-flat-box-4-764': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/7-inch-Flat-Box/4-764_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/7-inch-Flat-Box/4-764_SCH-page-001.webp`,
  },
  'level5-7-inch-mega-flat-box-4-767': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/7-inch-Mega-Flat-Box/4-767_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/7-inch-Mega-Flat-Box/4-767_SCH-page-001.webp`,
  },
  'level5-10-inch-flat-box-4-765': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/10-inch-Flat-Box/4-765_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/10-inch-Flat-Box/4-765_SCH-page-001.webp`,
  },
  'level5-10-inch-mega-flat-box-4-768': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/10-inch-Mega-Flat-Box/4-768_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/10-inch-Mega-Flat-Box/4-768_SCH-page-001.webp`,
  },
  'level5-12-inch-flat-box-4-766': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/12-inch-Flat-Box/4-766_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/12-inch-Flat-Box/4-766_SCH-page-001.webp`,
  },
  'level5-12-inch-mega-box-4-769': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/FinishingBoxes/12-inch-Mega-Box/4-769_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/FinishingBoxes/12-inch-Mega-Box/4-769_SCH-page-001.webp`,
  },
  // 14" Flat Box has no static image yet; entry kept for WP Media Library pickup
  'level5-14-inch-flat-box-4-770': {
    pages:   {},
    preview: undefined,
  },
  'level5-compound-pump-4-771': {
    pages:   { 1: `${_BASE}brands/Level5/Schematics/Pumps/Compound-Pump/4-771_SCH-page-001.webp` },
    preview: `${_BASE}brands/Level5/Schematics/Pumps/Compound-Pump/4-771_SCH-page-001.webp`,
  },

  // ── Platinum ──────────────────────────────────────────────────────────────
  'platinum-compound-pump': {
    pages:   { 1: `${_BASE}brands/Platinum/Schematics/CompoundPump/PT-Compound-Pump-page-001.webp` },
    preview: `${_BASE}brands/Platinum/Schematics/CompoundPump/PT-Compound-Pump-preview.webp`,
  },
  'platinum-flat-box': {
    pages:   { 1: `${_BASE}brands/Platinum/Schematics/FlatBox/Platinum_Flat_Box-page-001.webp` },
    preview: `${_BASE}brands/Platinum/Schematics/FlatBox/Platinum_Flat_Box-preview.webp`,
  },
  'platinum-outside-corner-roller': {
    pages:   { 1: `${_BASE}brands/Platinum/Schematics/OutsideCornerRoller/platinum_outside_cornerroller-page-001.webp` },
    preview: `${_BASE}brands/Platinum/Schematics/OutsideCornerRoller/platinum_outside_cornerroller_preview.webp`,
  },
};

// Brand name ↔ URL slug maps so navigation produces readable URLs like
// /schematics?brand=columbia-taping-tools&schematic=columbia-matrix
const BRAND_TO_SLUG = {
  'TapeTech':              'tapetech',
  'Columbia Taping Tools': 'columbia-taping-tools',
  'Asgard':                'asgard',
  'Level5':                'level5',
  'SurPro':                'surpro',
  'Graco':                 'graco',
  'Platinum Drywall Tools': 'platinum',
  'Dura-Stilts':           'dura-stilts',
};
const SLUG_TO_BRAND = Object.fromEntries(
  Object.entries(BRAND_TO_SLUG).map(([name, slug]) => [slug, name])
);

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
    'Level5',
    'SurPro',
    'Graco',
    'Platinum Drywall Tools',
    'Dura-Stilts',
  ];

  const location = useLocation();
  const navigate = useNavigate();

  // WP Media Library schematic manifest (WebP, preferred over static fallbacks)
  const { manifest: schematicManifest } = useSchematicMedia();

  // Helper: resolve a diagram page URL — WP manifest WebP takes priority,
  //         falls back to static PNG/JPG from public/brands/ until WP is populated.
  const schImg = useCallback((id, page) => {
    const wpUrl = schematicManifest?.[id]?.pages?.[String(page)]?.url;
    return wpUrl ?? _fallbacks[id]?.pages?.[page];
  }, [schematicManifest]);

  // Helper: resolve a preview image URL — same WP-first, static-fallback pattern.
  const schPrev = useCallback((id) => {
    const wpUrl = schematicManifest?.[id]?.preview;
    return wpUrl ?? _fallbacks[id]?.preview;
  }, [schematicManifest]);

  // Selection flow state — initialised directly from URL so first render is correct
  const _initParams = new URLSearchParams(location.search);
  const _initBrandSlug = _initParams.get('brand');
  const _initSchematicId = _initParams.get('schematic');
  const [selectedBrand, setSelectedBrand] = useState(
    () => {
      if (_initBrandSlug) return SLUG_TO_BRAND[_initBrandSlug] ?? null;
      if (_initSchematicId) return SCHEMATIC_ID_TO_BRAND[_initSchematicId] ?? null;
      return null;
    }
  );
  const [selectedSchematic, setSelectedSchematic] = useState(
    () => _initSchematicId ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // Schematic viewer state
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [activeHotspotPart, setActiveHotspotPart] = useState(null);
  const [hotspotStockStatus, setHotspotStockStatus] = useState(null); // 'instock' | 'outofstock' | null (loading)
  const [hotspotProduct, setHotspotProduct] = useState(null); // full WC product for the active hotspot (image, etc.)
  // Position of the detached desktop modal within schematic-container (px from top-left)
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
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
  const [, setForceUpdate] = useState(0);
  // Ref to track pinch zoom state without triggering re-renders
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1, initPanX: 0, initPanY: 0, centerX: 0, centerY: 0 });
  // Ref to track any active gesture for synchronous transition control
  const gestureActiveRef = useRef(false);
  
  const schematicContainerRef = useRef(null);
  const schematicImageRef = useRef(null);
  // Ref to the detached desktop part-modal rendered outside the transform context
  const detachedModalRef = useRef(null);
  // Snapshot of the last clicked hotspot's bounding rect for position recalculation
  const lastHotspotRectRef = useRef(null);

  // Desktop mouse-drag panning
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Brand list is static — these are the known brands with schematics.
  // We do NOT derive this from WooCommerce product inventory; the brand cards
  // should always be visible regardless of whether WC products are loaded.
  useEffect(() => {
    setBrands(ALLOWED_BRANDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state → URL so the address bar always reflects where the user is.
  // Uses replace:true so browser back-button steps back through real navigation
  // points rather than every intermediate state change.
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBrand)    params.set('brand',     BRAND_TO_SLUG[selectedBrand] ?? selectedBrand);
    if (selectedSchematic) params.set('schematic', selectedSchematic);
    const qs = params.toString();
    navigate(qs ? `/schematics?${qs}` : '/schematics', { replace: true });
  }, [selectedBrand, selectedSchematic, navigate]);

  // Schematic data for tools

  // Columbia Inside Corner Roller removed from parts schematics per request.

  // Helper: build part-hotspot array from a schematic JSON data object.
  // Supports both the official schema (x_pct / y_pct, 4 dp) and the legacy
  // top / left format for backward compatibility.
  //
  // Official formula:
  //   x_pct = round((center_x_px / image_natural_width)  * 100, 4)  → CSS left
  //   y_pct = round((center_y_px / image_natural_height) * 100, 4)  → CSS top
  //
  // Each returned part carries imageNaturalWidth / imageNaturalHeight so the
  // render layer can set aspect-ratio on the image wrapper before the image
  // loads (preventing a layout jump that would momentarily misplace hotspots).
  const buildPartsFromData = (data) => {
    if (!data || !data.parts) return [];
    const coords = data.coordinates || {};
    const imgW = data.image_natural_width  ?? null;
    const imgH = data.image_natural_height ?? null;
    return data.parts.map((p) => {
      const c = coords[p.id] || null;
      // Resolve horizontal position (CSS left):
      //   1. x_pct (official schema, percentage of image width)
      //   2. x_px  → converted to % using image_natural_width
      //   3. left  (legacy field, already a percentage)
      //   4. 50 (centre fallback)
      const leftVal = c
        ? (c.x_pct !== undefined
            ? c.x_pct
            : (c.x_px !== null && c.x_px !== undefined && imgW
                ? (c.x_px / imgW) * 100
                : (c.left !== undefined ? c.left : 50)))
        : 50;
      // Resolve vertical position (CSS top):
      //   1. y_pct (official schema, percentage of image height)
      //   2. y_px  → converted to % using image_natural_height
      //   3. top   (legacy field, already a percentage)
      //   4. 50 (centre fallback)
      const topVal = c
        ? (c.y_pct !== undefined
            ? c.y_pct
            : (c.y_px !== null && c.y_px !== undefined && imgH
                ? (c.y_px / imgH) * 100
                : (c.top !== undefined ? c.top : 50)))
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
        // Natural image dimensions from the source data.  These are identical
        // for every part on the same page and are used by the viewer to set
        // aspect-ratio on the image wrapper and to convert pixel-based hotspot
        // sizes (widthPx / heightPx) to scale-independent percentages.
        imageNaturalWidth:  imgW,
        imageNaturalHeight: imgH,
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

  // Asgard parts arrays
  const asgardFA01ADParts    = buildPartsFromData(asgardFA01ADData);
  const asgardAH25ADParts    = buildPartsFromData(asgardAH25ADData);
  const asgardAH30ADParts    = buildPartsFromData(asgardAH30ADData);
  const asgardAH35ADParts    = buildPartsFromData(asgardAH35ADData);
  const asgardCA08ADParts    = buildPartsFromData(asgardCA08ADData);
  const asgardCFAADParts     = buildPartsFromData(asgardCFAADData);
  const asgardEHC07ADParts   = buildPartsFromData(asgardEHC07ADData);
  const asgardEHC10ADParts   = buildPartsFromData(asgardEHC10ADData);
  const asgardEHC12ADParts   = buildPartsFromData(asgardEHC12ADData);
  const asgardEZ07ADParts    = buildPartsFromData(asgardEZ07ADData);
  const asgardEZ10ADParts    = buildPartsFromData(asgardEZ10ADData);
  const asgardEZ12ADParts    = buildPartsFromData(asgardEZ12ADData);
  const asgardPA07ADParts    = buildPartsFromData(asgardPA07ADData);
  const asgardPA10ADParts    = buildPartsFromData(asgardPA10ADData);
  const asgardPA12ADParts    = buildPartsFromData(asgardPA12ADData);
  const asgardBBHADParts     = buildPartsFromData(asgardBBHADData);
  const asgardBBHEADParts    = buildPartsFromData(asgardBBHEADData);
  const asgardFBHEADParts    = buildPartsFromData(asgardFBHEADData);
  const asgardFHADParts      = buildPartsFromData(asgardFHADData);
  const asgardXHADParts      = buildPartsFromData(asgardXHADData);
  const asgardGN01ADParts    = buildPartsFromData(asgardGN01ADData);
  const asgardLP01ADParts    = buildPartsFromData(asgardLP01ADData);
  const asgardCR01ADParts    = buildPartsFromData(asgardCR01ADData);
  const asgardNS03ADParts    = buildPartsFromData(asgardNS03ADData);
  const asgardAT01ADParts    = buildPartsFromData(asgardAT01ADData);

  // Level5 parts arrays
  const level5CornerRollerParts        = buildPartsFromData(level5CornerRollerData);
  const level5CutterChainAssemblyParts = buildPartsFromData(level5CutterChainAssemblyData);
  const level5DriveDogAssemblyParts    = buildPartsFromData(level5DriveDogAssemblyData);
  const level5GooserAssemblyParts      = buildPartsFromData(level5GooserAssemblyData);
  const level5TaperWheelAssemblyParts  = buildPartsFromData(level5TaperWheelAssemblyData);
  const level5CoverPlateAssemblyParts  = buildPartsFromData(level5CoverPlateAssemblyData);
  const level5CornerFinisher35Parts    = buildPartsFromData(level5CornerFinisher35Data);
  const level57inFlatBoxParts          = buildPartsFromData(level57inFlatBoxData);
  const level57inMegaFlatBoxParts      = buildPartsFromData(level57inMegaFlatBoxData);
  const level510inFlatBoxParts         = buildPartsFromData(level510inFlatBoxData);
  const level510inMegaFlatBoxParts     = buildPartsFromData(level510inMegaFlatBoxData);
  const level512inFlatBoxParts         = buildPartsFromData(level512inFlatBoxData);
  const level512inMegaBoxParts         = buildPartsFromData(level512inMegaBoxData);
  const level514inFlatBoxParts         = buildPartsFromData(level514inFlatBoxData);
  const level5CompoundPumpParts        = buildPartsFromData(level5CompoundPumpData);

  // Platinum parts arrays
  const platinumCompoundPumpParts       = buildPartsFromData(platinumCompoundPumpData);
  const platinumFlatBoxParts            = buildPartsFromData(platinumFlatBoxData);
  const platinumOutsideCornerRollerParts = buildPartsFromData(platinumOutsideCornerRollerData);

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
        1: schImg('columbia-matrix', 1),
        2: schImg('columbia-matrix', 2),
        3: schImg('columbia-matrix', 3),
        4: schImg('columbia-matrix', 4),
        5: schImg('columbia-matrix', 5)
      },
      previewImage: schPrev('columbia-matrix'),
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
        1: schImg('columbia-predator-taper', 1),
        2: schImg('columbia-predator-taper', 2)
      },
      previewImage: schPrev('columbia-predator-taper'),
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
      imagePages: { 1: schImg('tapetech-extendable-support-handle', 1) },
      previewImage: schPrev('tapetech-extendable-support-handle'),
      parts: tapeTechExtendableSupportHandleParts
    },
    {
      id: 'columbia-2-way-internal-corner',
      title: '2-Way Internal Corner Applicator',
      description: 'Columbia 2-Way Internal Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Applicators',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-2-way-internal-corner', 1) },
      previewImage: schPrev('columbia-2-way-internal-corner'),
      parts: twoWayInternalCornerApplicatorParts
    },
    {
      id: 'columbia-external-corner-applicator',
      title: 'External Corner Applicator',
      description: 'Columbia External Corner Applicator schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Applicators',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-external-corner-applicator', 1) },
      previewImage: schPrev('columbia-external-corner-applicator'),
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
        1: schImg('columbia-inside-corner-applicator', 1),
        2: schImg('columbia-inside-corner-applicator', 2)
      },
      previewImage: schPrev('columbia-inside-corner-applicator'),
      parts: [...insideCornerApplicator2WheelParts, ...insideCornerApplicator4WheelParts]
    },
    {
      id: 'columbia-standard-outside-corner-roller',
      title: 'Standard Outside Corner Roller',
      description: 'Columbia Standard Outside Corner Roller schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-standard-outside-corner-roller', 1) },
      previewImage: schPrev('columbia-standard-outside-corner-roller'),
      parts: standardOutsideCornerRollerParts
    },
    {
      id: 'columbia-inside-corner-roller',
      title: 'Inside Corner Roller',
      description: 'Columbia Inside Corner Roller schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-inside-corner-roller', 1) },
      previewImage: schPrev('columbia-inside-corner-roller'),
      parts: insideCornerRollerParts
    },
    {
      id: 'columbia-throttle-box',
      title: 'Throttle Box',
      description: 'Columbia Throttle Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-throttle-box', 1) },
      previewImage: schPrev('columbia-throttle-box'),
      parts: throttleBoxParts
    },
    {
      id: 'columbia-automatic-flat-box',
      title: 'Automatic Flat Box',
      description: 'Columbia Automatic Flat Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-automatic-flat-box', 1) },
      previewImage: schPrev('columbia-automatic-flat-box'),
      parts: automaticFlatBoxParts
    },
    {
      id: 'columbia-flat-box',
      title: 'Flat Box',
      description: 'Columbia Flat Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-flat-box', 1) },
      previewImage: schPrev('columbia-flat-box'),
      parts: flatBoxParts
    },
    {
      id: 'columbia-fat-boy-box',
      title: 'Fat Boy Box',
      description: 'Columbia Fat Boy Box schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-fat-boy-box', 1) },
      previewImage: schPrev('columbia-fat-boy-box'),
      parts: fatBoyBoxParts
    },
    {
      id: 'columbia-angle-head',
      title: 'Angle Head',
      description: 'Columbia Angle Head schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Angleheads',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-angle-head', 1) },
      previewImage: schPrev('columbia-angle-head'),
      parts: angleHeadParts
    },
    {
      id: 'columbia-gooseneck-adapter',
      title: 'Gooseneck Adapter',
      description: 'Columbia Gooseneck Adapter schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-gooseneck-adapter', 1) },
      previewImage: schPrev('columbia-gooseneck-adapter'),
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
        1: schImg('columbia-mud-pump', 1),
        2: schImg('columbia-mud-pump', 2)
      },
      previewImage: schPrev('columbia-mud-pump'),
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
        1: schImg('columbia-tall-boy-mud-pump', 1),
        2: schImg('columbia-tall-boy-mud-pump', 2)
      },
      previewImage: schPrev('columbia-tall-boy-mud-pump'),
      parts: tallBoyMudPumpParts
    },
    {
      id: 'columbia-nailspotter',
      title: 'Nailspotter 3"',
      description: 'Columbia Nailspotter 3" schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Nailspotters',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-nailspotter', 1) },
      previewImage: schPrev('columbia-nailspotter'),
      parts: nailspotterParts
    },
    {
      id: 'columbia-tomahawk-smoothing-blades',
      title: 'Tomahawk Smoothing Blades',
      description: 'Columbia Tomahawk Smoothing Blades schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Smoothing Blades',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-tomahawk-smoothing-blades', 1) },
      previewImage: schPrev('columbia-tomahawk-smoothing-blades'),
      parts: tomahawkParts
    },
    {
      id: 'columbia-standard-corner-flusher',
      title: 'Standard Corner Flusher',
      description: 'Columbia Standard Corner Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-standard-corner-flusher', 1) },
      previewImage: schPrev('columbia-standard-corner-flusher'),
      parts: cf35Parts
    },
    {
      id: 'columbia-direct-corner-flusher',
      title: 'Direct Corner Flusher',
      description: 'Columbia Direct Corner Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-direct-corner-flusher', 1) },
      previewImage: schPrev('columbia-direct-corner-flusher'),
      parts: columbiaDirectCornerFlusherData?.parts || []
    },
    {
      id: 'columbia-combo-flusher',
      title: 'Combo Flusher',
      description: 'Columbia Combo Flusher schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Flushers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-combo-flusher', 1) },
      previewImage: schPrev('columbia-combo-flusher'),
      parts: columbiaComboFlusherData?.parts || []
    },
    {
      id: 'columbia-sander-head',
      title: 'Sander Head',
      description: 'Columbia Sander Head schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Sanders',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-sander-head', 1) },
      previewImage: schPrev('columbia-sander-head'),
      parts: sanderHeadParts
    },
    {
      id: 'columbia-compound-tube',
      title: 'Compound Tube',
      description: 'Columbia Compound Tube schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Compound Tubes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-compound-tube', 1) },
      previewImage: schPrev('columbia-compound-tube'),
      parts: compoundTubeParts
    },
    {
      id: 'columbia-cam-lock-tube',
      title: 'Cam Lock Tube',
      description: 'Columbia Cam Lock Tube schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Compound Tubes',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-cam-lock-tube', 1) },
      previewImage: schPrev('columbia-cam-lock-tube'),
      parts: camLockTubeParts
    },
    {
      id: 'columbia-semi-automatic-taper',
      title: 'Semi-Automatic Taper',
      description: 'Columbia Semi-Automatic Taper schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Semi-Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-semi-automatic-taper', 1) },
      previewImage: schPrev('columbia-semi-automatic-taper'),
      parts: semiAutomaticTaperParts
    },
    {
      id: 'columbia-one',
      title: 'Columbia One',
      description: 'Columbia One schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-one', 1) },
      previewImage: schPrev('columbia-one'),
      parts: columbiaOneParts
    },
    {
      id: 'columbia-long-extendable-handle',
      title: 'Long Extendable Handle',
      description: 'Columbia Long Extendable Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-long-extendable-handle', 1) },
      previewImage: schPrev('columbia-long-extendable-handle'),
      parts: longExtendableHandleParts
    },
    {
      id: 'columbia-flat-box-handle',
      title: 'Flat Box Handle',
      description: 'Columbia Flat Box Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-flat-box-handle', 1) },
      previewImage: schPrev('columbia-flat-box-handle'),
      parts: flatBoxHandleParts
    },
    {
      id: 'columbia-closet-monster-flat-box-handle',
      title: 'Closet Monster Flat Box Handle',
      description: 'Columbia Closet Monster Flat Box Handle schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-closet-monster-flat-box-handle', 1) },
      previewImage: schPrev('columbia-closet-monster-flat-box-handle'),
      parts: closetMonsterParts
    },
    {
      id: 'columbia-box-filler',
      title: 'Box Filler',
      description: 'Columbia Box Filler schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-box-filler', 1) },
      previewImage: schPrev('columbia-box-filler'),
      parts: boxFillerParts
    },
    {
      id: 'columbia-corner-cobra',
      title: 'Corner Cobra',
      description: 'Columbia Corner Cobra schematic diagram',
      brand: 'Columbia Taping Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('columbia-corner-cobra', 1) },
      previewImage: schPrev('columbia-corner-cobra'),
      parts: cornerCobraParts
    },

    // ── Asgard ────────────────────────────────────────────────────────────────
    {
      id: 'asgard-at01-ad',
      title: 'HAMMER Automatic Taper',
      description: 'Asgard HAMMER Automatic Taper schematic diagrams',
      brand: 'Asgard',
      category: 'Tapers',
      diagramPages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      pageLabels: {
        1: 'Assembly 1',
        2: 'Assembly 2',
        3: 'Assembly 3',
        4: 'Assembly 4',
        5: 'Assembly 5',
        6: 'Assembly 6',
        7: 'Assembly 7',
        8: 'Assembly 8',
        9: 'Assembly 9',
        10: 'Assembly 10',
        11: 'Assembly 11',
        12: 'Assembly 12',
      },
      imagePages: {
        1:  schImg('asgard-at01-ad', 1),
        2:  schImg('asgard-at01-ad', 2),
        3:  schImg('asgard-at01-ad', 3),
        4:  schImg('asgard-at01-ad', 4),
        5:  schImg('asgard-at01-ad', 5),
        6:  schImg('asgard-at01-ad', 6),
        7:  schImg('asgard-at01-ad', 7),
        8:  schImg('asgard-at01-ad', 8),
        9:  schImg('asgard-at01-ad', 9),
        10: schImg('asgard-at01-ad', 10),
        11: schImg('asgard-at01-ad', 11),
        12: schImg('asgard-at01-ad', 12),
      },
      previewImage: schPrev('asgard-at01-ad'),
      parts: asgardAT01ADParts
    },
    {
      id: 'asgard-ah25-ad',
      title: '2.5″ Angle Head Corner Finisher',
      description: 'Asgard 2.5″ Angle Head Corner Finisher schematic diagram',
      brand: 'Asgard',
      category: 'Angle Heads',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ah25-ad', 1) },
      previewImage: schPrev('asgard-ah25-ad'),
      parts: asgardAH25ADParts
    },
    {
      id: 'asgard-ah30-ad',
      title: '3″ Angle Head Corner Finisher',
      description: 'Asgard 3″ Angle Head Corner Finisher schematic diagram',
      brand: 'Asgard',
      category: 'Angle Heads',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ah30-ad', 1) },
      previewImage: schPrev('asgard-ah30-ad'),
      parts: asgardAH30ADParts
    },
    {
      id: 'asgard-ah35-ad',
      title: '3.5″ Angle Head Corner Finisher',
      description: 'Asgard 3.5″ Angle Head Corner Finisher schematic diagram',
      brand: 'Asgard',
      category: 'Angle Heads',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ah35-ad', 1) },
      previewImage: schPrev('asgard-ah35-ad'),
      parts: asgardAH35ADParts
    },
    {
      id: 'asgard-ca08-ad',
      title: '8″ Angle Box Corner Applicator',
      description: 'Asgard 8″ Angle Box Corner Applicator schematic diagram',
      brand: 'Asgard',
      category: 'Angle Heads',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ca08-ad', 1) },
      previewImage: schPrev('asgard-ca08-ad'),
      parts: asgardCA08ADParts
    },
    {
      id: 'asgard-cfa-ad',
      title: 'Angle Head Adapter',
      description: 'Asgard Angle Head Adapter schematic diagram',
      brand: 'Asgard',
      category: 'Angle Heads',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-cfa-ad', 1) },
      previewImage: schPrev('asgard-cfa-ad'),
      parts: asgardCFAADParts
    },
    {
      id: 'asgard-fa01-ad',
      title: 'Filler Adapter',
      description: 'Asgard Filler Adapter schematic diagram',
      brand: 'Asgard',
      category: 'Adapters',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-fa01-ad', 1) },
      previewImage: schPrev('asgard-fa01-ad'),
      parts: asgardFA01ADParts
    },
    {
      id: 'asgard-ehc07-ad',
      title: '7″ MaxxBox Finishing Box',
      description: 'Asgard 7″ MaxxBox Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ehc07-ad', 1) },
      previewImage: schPrev('asgard-ehc07-ad'),
      parts: asgardEHC07ADParts
    },
    {
      id: 'asgard-ehc10-ad',
      title: '10″ MaxxBox Finishing Box',
      description: 'Asgard 10″ MaxxBox Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ehc10-ad', 1) },
      previewImage: schPrev('asgard-ehc10-ad'),
      parts: asgardEHC10ADParts
    },
    {
      id: 'asgard-ehc12-ad',
      title: '12″ MaxxBox Finishing Box',
      description: 'Asgard 12″ MaxxBox Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ehc12-ad', 1) },
      previewImage: schPrev('asgard-ehc12-ad'),
      parts: asgardEHC12ADParts
    },
    {
      id: 'asgard-ez07-ad',
      title: '7″ Flat Finishing Box',
      description: 'Asgard 7″ Flat Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ez07-ad', 1) },
      previewImage: schPrev('asgard-ez07-ad'),
      parts: asgardEZ07ADParts
    },
    {
      id: 'asgard-ez10-ad',
      title: '10″ Flat Finishing Box',
      description: 'Asgard 10″ Flat Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ez10-ad', 1) },
      previewImage: schPrev('asgard-ez10-ad'),
      parts: asgardEZ10ADParts
    },
    {
      id: 'asgard-ez12-ad',
      title: '12″ Flat Finishing Box',
      description: 'Asgard 12″ Flat Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-ez12-ad', 1) },
      previewImage: schPrev('asgard-ez12-ad'),
      parts: asgardEZ12ADParts
    },
    {
      id: 'asgard-pa07-ad',
      title: '7″ Power Assist Finishing Box',
      description: 'Asgard 7″ Power Assist Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-pa07-ad', 1) },
      previewImage: schPrev('asgard-pa07-ad'),
      parts: asgardPA07ADParts
    },
    {
      id: 'asgard-pa10-ad',
      title: '10″ Power Assist Finishing Box',
      description: 'Asgard 10″ Power Assist Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-pa10-ad', 1) },
      previewImage: schPrev('asgard-pa10-ad'),
      parts: asgardPA10ADParts
    },
    {
      id: 'asgard-pa12-ad',
      title: '12″ Power Assist Finishing Box',
      description: 'Asgard 12″ Power Assist Finishing Box schematic diagram',
      brand: 'Asgard',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-pa12-ad', 1) },
      previewImage: schPrev('asgard-pa12-ad'),
      parts: asgardPA12ADParts
    },
    {
      id: 'asgard-bbh-ad',
      title: 'Brakeless Box Handle',
      description: 'Asgard Brakeless Box Handle schematic diagram',
      brand: 'Asgard',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-bbh-ad', 1) },
      previewImage: schPrev('asgard-bbh-ad'),
      parts: asgardBBHADParts
    },
    {
      id: 'asgard-bbhe-ad',
      title: 'Brakeless Box Handle – Extendable',
      description: 'Asgard Brakeless Box Handle – Extendable schematic diagrams',
      brand: 'Asgard',
      category: 'Handles',
      diagramPages: [1, 2],
      pageLabels: {
        1: 'Handle',
        2: 'Extension'
      },
      imagePages: {
        1: schImg('asgard-bbhe-ad', 1),
        2: schImg('asgard-bbhe-ad', 2),
      },
      previewImage: schPrev('asgard-bbhe-ad'),
      parts: asgardBBHEADParts
    },
    {
      id: 'asgard-fbhe-ad',
      title: 'Extendable Flat Box Handle with Brake',
      description: 'Asgard Extendable Flat Box Handle with Brake schematic diagrams',
      brand: 'Asgard',
      category: 'Handles',
      diagramPages: [1, 2],
      pageLabels: {
        1: 'Handle',
        2: 'Extension'
      },
      imagePages: {
        1: schImg('asgard-fbhe-ad', 1),
        2: schImg('asgard-fbhe-ad', 2),
      },
      previewImage: schPrev('asgard-fbhe-ad'),
      parts: asgardFBHEADParts
    },
    {
      id: 'asgard-fh-ad',
      title: 'Fiberglass Handle',
      description: 'Asgard Fiberglass Handle schematic diagram',
      brand: 'Asgard',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-fh-ad', 1) },
      previewImage: schPrev('asgard-fh-ad'),
      parts: asgardFHADParts
    },
    {
      id: 'asgard-xh-ad',
      title: 'Extendable Support Handle',
      description: 'Asgard Extendable Support Handle schematic diagram',
      brand: 'Asgard',
      category: 'Handles',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-xh-ad', 1) },
      previewImage: schPrev('asgard-xh-ad'),
      parts: asgardXHADParts
    },
    {
      id: 'asgard-gn01-ad',
      title: 'Gooseneck',
      description: 'Asgard Gooseneck schematic diagram',
      brand: 'Asgard',
      category: 'Other',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-gn01-ad', 1) },
      previewImage: schPrev('asgard-gn01-ad'),
      parts: asgardGN01ADParts
    },
    {
      id: 'asgard-lp01-ad',
      title: 'Compound Loading Pump',
      description: 'Asgard Compound Loading Pump schematic diagram',
      brand: 'Asgard',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-lp01-ad', 1) },
      previewImage: schPrev('asgard-lp01-ad'),
      parts: asgardLP01ADParts
    },
    {
      id: 'asgard-cr01-ad',
      title: 'Inside Corner Roller',
      description: 'Asgard Inside Corner Roller schematic diagram',
      brand: 'Asgard',
      category: 'Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('asgard-cr01-ad', 1) },
      previewImage: schPrev('asgard-cr01-ad'),
      parts: asgardCR01ADParts
    },
    {
      id: 'asgard-ns03-ad',
      title: '3″ Nail Spotter',
      description: 'Asgard 3″ Nail Spotter schematic diagrams',
      brand: 'Asgard',
      category: 'Spotters',
      diagramPages: [1, 2],
      imagePages: {
        1: schImg('asgard-ns03-ad', 1),
        2: schImg('asgard-ns03-ad', 2),
      },
      previewImage: schPrev('asgard-ns03-ad'),
      parts: asgardNS03ADParts
    },

    // ── Level5 ───────────────────────────────────────────────────────────────
    {
      id: 'level5-corner-roller-4-707',
      title: 'Corner Roller',
      description: 'Level5 Corner Roller schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-corner-roller-4-707', 1) },
      previewImage: schPrev('level5-corner-roller-4-707'),
      parts: level5CornerRollerParts
    },
    {
      id: 'level5-9333-cutter-chain-assembly',
      title: 'Cutter Chain Assembly',
      description: 'Level5 Cutter Chain Assembly schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-9333-cutter-chain-assembly', 1) },
      previewImage: schPrev('level5-9333-cutter-chain-assembly'),
      parts: level5CutterChainAssemblyParts
    },
    {
      id: 'level5-7097-drive-dog-assembly',
      title: 'Drive Dog Assembly',
      description: 'Level5 Drive Dog Assembly schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7097-drive-dog-assembly', 1) },
      previewImage: schPrev('level5-7097-drive-dog-assembly'),
      parts: level5DriveDogAssemblyParts
    },
    {
      id: 'level5-7293-gooser-assembly',
      title: 'Gooser Assembly',
      description: 'Level5 Gooser Assembly schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7293-gooser-assembly', 1) },
      previewImage: schPrev('level5-7293-gooser-assembly'),
      parts: level5GooserAssemblyParts
    },
    {
      id: 'level5-7218-taper-wheel-assembly',
      title: 'Taper Wheel Assembly',
      description: 'Level5 Taper Wheel Assembly schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7218-taper-wheel-assembly', 1) },
      previewImage: schPrev('level5-7218-taper-wheel-assembly'),
      parts: level5TaperWheelAssemblyParts
    },
    {
      id: 'level5-7377-cover-plate-assembly-old-style',
      title: 'Cover Plate Assembly',
      description: 'Level5 Cover Plate Assembly schematic diagram',
      brand: 'Level5',
      category: 'Automatic Tapers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7377-cover-plate-assembly-old-style', 1) },
      previewImage: schPrev('level5-7377-cover-plate-assembly-old-style'),
      parts: level5CoverPlateAssemblyParts
    },
    {
      id: 'level5-4-734-3-5-corner-finisher',
      title: '3.5" Corner Finisher',
      description: 'Level5 3.5" Corner Finisher schematic diagram with parts hotspots',
      brand: 'Level5',
      category: 'Corner Finishers',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-4-734-3-5-corner-finisher', 1) },
      previewImage: schPrev('level5-4-734-3-5-corner-finisher'),
      parts: level5CornerFinisher35Parts
    },
    {
      id: 'level5-7-inch-flat-box-4-764',
      title: '7" Flat Box',
      description: 'Level5 7" Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7-inch-flat-box-4-764', 1) },
      previewImage: schPrev('level5-7-inch-flat-box-4-764'),
      parts: level57inFlatBoxParts
    },
    {
      id: 'level5-7-inch-mega-flat-box-4-767',
      title: '7" Mega Flat Box',
      description: 'Level5 7" Mega Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-7-inch-mega-flat-box-4-767', 1) },
      previewImage: schPrev('level5-7-inch-mega-flat-box-4-767'),
      parts: level57inMegaFlatBoxParts
    },
    {
      id: 'level5-10-inch-flat-box-4-765',
      title: '10" Flat Box',
      description: 'Level5 10" Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-10-inch-flat-box-4-765', 1) },
      previewImage: schPrev('level5-10-inch-flat-box-4-765'),
      parts: level510inFlatBoxParts
    },
    {
      id: 'level5-10-inch-mega-flat-box-4-768',
      title: '10" Mega Flat Box',
      description: 'Level5 10" Mega Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-10-inch-mega-flat-box-4-768', 1) },
      previewImage: schPrev('level5-10-inch-mega-flat-box-4-768'),
      parts: level510inMegaFlatBoxParts
    },
    {
      id: 'level5-12-inch-flat-box-4-766',
      title: '12" Flat Box',
      description: 'Level5 12" Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-12-inch-flat-box-4-766', 1) },
      previewImage: schPrev('level5-12-inch-flat-box-4-766'),
      parts: level512inFlatBoxParts
    },
    {
      id: 'level5-12-inch-mega-box-4-769',
      title: '12" Mega Box',
      description: 'Level5 12" Mega Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-12-inch-mega-box-4-769', 1) },
      previewImage: schPrev('level5-12-inch-mega-box-4-769'),
      parts: level512inMegaBoxParts
    },
    {
      id: 'level5-14-inch-flat-box-4-770',
      title: '14" Flat Box',
      description: 'Level5 14" Flat Box schematic diagram',
      brand: 'Level5',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-14-inch-flat-box-4-770', 1) },
      previewImage: schPrev('level5-14-inch-flat-box-4-770'),
      parts: level514inFlatBoxParts
    },
    {
      id: 'level5-compound-pump-4-771',
      title: 'Compound Pump',
      description: 'Level5 Compound Pump schematic diagram',
      brand: 'Level5',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: schImg('level5-compound-pump-4-771', 1) },
      previewImage: schPrev('level5-compound-pump-4-771'),
      parts: level5CompoundPumpParts
    },

    // ── Platinum ────────────────────────────────────────────────────────────
    {
      id: 'platinum-compound-pump',
      title: 'Compound Pump',
      description: 'Platinum Drywall Tools Compound Pump schematic diagram',
      brand: 'Platinum Drywall Tools',
      category: 'Pumps',
      diagramPages: [1],
      imagePages: { 1: schImg('platinum-compound-pump', 1) },
      previewImage: schPrev('platinum-compound-pump'),
      parts: platinumCompoundPumpParts,
    },
    {
      id: 'platinum-flat-box',
      title: 'Flat Box',
      description: 'Platinum Drywall Tools Flat Box schematic diagram',
      brand: 'Platinum Drywall Tools',
      category: 'Finishing Boxes',
      diagramPages: [1],
      imagePages: { 1: schImg('platinum-flat-box', 1) },
      previewImage: schPrev('platinum-flat-box'),
      parts: platinumFlatBoxParts,
    },
    {
      id: 'platinum-outside-corner-roller',
      title: 'Outside Corner Roller',
      description: 'Platinum Drywall Tools Outside Corner Roller schematic diagram',
      brand: 'Platinum Drywall Tools',
      category: 'Corner Rollers',
      diagramPages: [1],
      imagePages: { 1: schImg('platinum-outside-corner-roller', 1) },
      previewImage: schPrev('platinum-outside-corner-roller'),
      parts: platinumOutsideCornerRollerParts,
    },
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

  // Derive the intrinsic aspect-ratio for the current page from the first
  // matching part's imageNaturalWidth/Height (all parts on the same page share
  // the same source-image dimensions).  Applied to the image-wrapper div so
  // the layout reserves the correct proportional height *before* the image
  // finishes loading, preventing a jump that would transiently misalign
  // hotspot percentage positions on slow mobile connections.
  const currentPageFirstPart = currentSchematic
    ? currentSchematic.parts.find(p => !p.pageNumber || p.pageNumber === currentPage)
    : null;
  const currentPageAspectRatio =
    currentPageFirstPart?.imageNaturalWidth && currentPageFirstPart?.imageNaturalHeight
      ? `${currentPageFirstPart.imageNaturalWidth} / ${currentPageFirstPart.imageNaturalHeight}`
      : undefined;

  const [addingToCart, setAddingToCart] = useState(null); // part.id being added

  const handleAddToCart = async (part) => {
    if (addingToCart) return; // prevent double-click
    setAddingToCart(part.id);

    try {
      // Look up the live WooCommerce product by SKU so we use the real price,
      // product ID, and image from the store instead of stale JSON values.
      const wcProduct = part.sku ? await getProductBySku(part.sku) : null;

      const cartProduct = wcProduct
        ? {
            id: wcProduct.id,
            name: wcProduct.name || part.name,
            brand: currentSchematic?.brand || selectedBrand || 'Parts',
            price: parseFloat(wcProduct.price) || 0,
            part_number: wcProduct.sku || part.sku,
            sku: wcProduct.sku || part.sku,
            image: wcProduct.images?.[0] || '/no-image-placeholder.webp',
            permalink: wcProduct.permalink || '',
            _wcProduct: wcProduct,
          }
        : {
            // Fallback: WC product not found — use schematic JSON data as-is
            id: part.sku || part.id,
            name: part.name,
            brand: currentSchematic?.brand || selectedBrand || 'Parts',
            price: part.price || 0,
            part_number: part.sku,
            sku: part.sku,
            image: '/no-image-placeholder.webp',
          };

      addToCart(cartProduct, 1);
      setToast({
        message: `${cartProduct.name} added to cart!`,
        type: 'cart',
      });
    } catch {
      setToast({ message: 'Could not add item to cart. Try again.', type: 'error' });
    } finally {
      setAddingToCart(null);
      setActiveHotspot(null);
      setActiveHotspotPart(null);
      setHotspotProduct(null);
    }
  };

  const closeModal = () => {
    setActiveHotspot(null);
    setActiveHotspotPart(null);
    setHotspotProduct(null);
  };

  // Calculate and apply an optimal position for the detached desktop modal so it
  // remains fully visible within the schematic-container regardless of where the
  // clicked hotspot is located (edges, corners, etc.).
  const calculateAndSetModalPosition = useCallback((hotspotRect) => {
    const container = schematicContainerRef.current;
    if (!container || !hotspotRect) return;

    const containerRect = container.getBoundingClientRect();
    const MODAL_ESTIMATED_HEIGHT = 260; // conservative fallback before first render (includes product image)
    // Derive dimensions from the rendered modal element when available so the
    // calculation stays in sync with any future CSS width/height changes.
    const MODAL_WIDTH  = detachedModalRef.current ? detachedModalRef.current.offsetWidth  : 280;
    const MODAL_HEIGHT = detachedModalRef.current ? detachedModalRef.current.offsetHeight : MODAL_ESTIMATED_HEIGHT;
    const OFFSET = 12;  // gap between hotspot and modal
    const PADDING = 8;  // minimum clearance from container edges

    // Hotspot geometry relative to the container
    const hotspotCenterX = (hotspotRect.left + hotspotRect.width / 2) - containerRect.left;
    const hotspotBottom  = hotspotRect.bottom - containerRect.top;
    const hotspotTop     = hotspotRect.top    - containerRect.top;

    // Prefer placing the modal below the hotspot
    let top  = hotspotBottom + OFFSET;
    let left = hotspotCenterX - MODAL_WIDTH / 2;

    // Clamp horizontally so the modal never overflows left or right
    left = Math.max(PADDING, Math.min(left, containerRect.width - MODAL_WIDTH - PADDING));

    // If the modal would overflow the bottom edge, flip it above the hotspot
    if (top + MODAL_HEIGHT > containerRect.height - PADDING) {
      top = hotspotTop - MODAL_HEIGHT - OFFSET;
    }

    // Final vertical clamp — guards against very tall viewports or tiny hotspots near the top
    top = Math.max(PADDING, Math.min(top, containerRect.height - MODAL_HEIGHT - PADDING));

    setModalPosition({ top, left });
  }, []);

  // Fetch live WooCommerce stock status and product image whenever a hotspot is opened.
  // Runs in the background — UI shows a loading state until resolved.
  // Parts with no SKU skip the fetch entirely and resolve immediately to 'unknown'.
  // A 10-second timeout guards against a slow/failing credentialsReady bootstrap
  // that would otherwise leave the spinner stuck indefinitely.
  useEffect(() => {
    if (!activeHotspotPart?.sku) {
      // No SKU — skip the async fetch and show Unavailable immediately.
      setHotspotStockStatus('unknown');
      setHotspotProduct(null);
      return;
    }
    let cancelled = false;
    setHotspotStockStatus(null); // reset to loading while fetching
    setHotspotProduct(null);
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setHotspotStockStatus('unknown');
        setHotspotProduct(null);
      }
    }, 10000);
    getProductBySku(activeHotspotPart.sku).then((wc) => {
      if (!cancelled) {
        clearTimeout(timeoutId);
        setHotspotStockStatus(wc ? (wc.stock_status || 'instock') : 'unknown');
        setHotspotProduct(wc || null);
      }
    }).catch(() => {
      if (!cancelled) {
        clearTimeout(timeoutId);
        setHotspotStockStatus('unknown');
        setHotspotProduct(null);
      }
    });
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [activeHotspotPart]);

  // After the detached modal renders, recalculate its position using its actual
  // rendered height so the initial estimate is corrected if needed.
  useEffect(() => {
    if (!activeHotspotPart || isMobile || !lastHotspotRectRef.current) return;
    calculateAndSetModalPosition(lastHotspotRectRef.current);
  }, [activeHotspotPart, isMobile, calculateAndSetModalPosition]);
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
        ...(selectedSchematic ? {
          height: 'calc(100vh - var(--header-height, 70px))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } : {
          minHeight: '100vh',
        }),
        backgroundColor: '#f9fafb'
      }} 
      className={`page-wrapper ${selectedSchematic ? 'viewer-active' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onClick={closeModal}
    >
      <SEOHead
        title="Tool Schematics & Diagrams"
        description="Interactive exploded-view schematics and part diagrams for professional drywall finishing tools. Find replacement parts for TapeTech, Columbia, Asgard, Level5, and more."
        canonical="https://drywalltoolbox.com/schematics"
        schema={buildBreadcrumbSchema([
          { label: 'Home',       path: '/'            },
          { label: 'Schematics', path: '/schematics'  },
        ])}
      />
      {/* Container wrapper — full-height flex column when viewer is active */}
      <div style={{
        maxWidth: selectedSchematic ? '100%' : '1280px',
        margin: '0 auto',
        padding: selectedSchematic ? '0' : (isFullscreen ? '16px' : '2px 16px 24px'),
        ...(selectedSchematic ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 } : {})
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
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflow: 'hidden',
        }}>
          {/* ── Compact viewer top bar: back | logo + title | pager ── */}
          <div className="viewer-top-bar">
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

            <div className="viewer-title-group" aria-labelledby="viewer-tool-title-id">
              {brandLogos[currentSchematic?.brand] && (
                <img
                  src={brandLogos[currentSchematic.brand]}
                  alt={`${currentSchematic.brand} logo`}
                  className={[
                    'viewer-brand-logo',
                    currentSchematic.brand === 'Level5' ? 'viewer-brand-logo--level5' : '',
                    currentSchematic.brand === 'Columbia Taping Tools' ? 'viewer-brand-logo--columbia' : '',
                  ].filter(Boolean).join(' ')}
                />
              )}
              <h1 id="viewer-tool-title-id" className="viewer-tool-title">{currentSchematic?.title}</h1>
            </div>

            {/* Inline pager for multi-page schematics */}
            {currentSchematic.diagramPages && currentSchematic.diagramPages.length > 1 && (
              <div className="viewer-pager schematic-pager" role="group" aria-label="Schematic pages">
                <button
                  className={`pager-pill${currentSchematic.diagramPages.indexOf(currentPage) <= 0 ? ' disabled' : ''}`}
                  onClick={() => {
                    const pages = currentSchematic.diagramPages;
                    const idx = pages.indexOf(currentPage);
                    if (idx > 0) setCurrentPage(pages[idx - 1]);
                  }}
                  aria-label="Previous page"
                  disabled={currentSchematic.diagramPages.indexOf(currentPage) <= 0}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="pager-counter" role="status" aria-live="polite">
                  {currentSchematic.pageLabels?.[currentPage]
                    ? `${currentSchematic.pageLabels[currentPage]} (${currentSchematic.diagramPages.indexOf(currentPage) + 1}/${currentSchematic.diagramPages.length})`
                    : `${currentSchematic.diagramPages.indexOf(currentPage) + 1} / ${currentSchematic.diagramPages.length}`
                  }
                </div>
                <button
                  className={`pager-pill${currentSchematic.diagramPages.indexOf(currentPage) >= currentSchematic.diagramPages.length - 1 ? ' disabled' : ''}`}
                  onClick={() => {
                    const pages = currentSchematic.diagramPages;
                    const idx = pages.indexOf(currentPage);
                    if (idx < pages.length - 1) setCurrentPage(pages[idx + 1]);
                  }}
                  aria-label="Next page"
                  disabled={currentSchematic.diagramPages.indexOf(currentPage) >= currentSchematic.diagramPages.length - 1}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* ── Mobile page-tab strip — one tappable pill per page, shown only on mobile ── */}
          {currentSchematic.diagramPages && currentSchematic.diagramPages.length > 1 && (
            <div className="viewer-page-tabs" role="tablist" aria-label="Schematic pages" aria-orientation="horizontal">
              {currentSchematic.diagramPages.map((pageNum) => (
                <button
                  key={pageNum}
                  role="tab"
                  className={`page-tab${currentPage === pageNum ? ' active' : ''}`}
                  aria-selected={currentPage === pageNum}
                  aria-controls="schematic-diagram-panel"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {currentSchematic.pageLabels?.[pageNum] || `Page ${pageNum}`}
                </button>
              ))}
            </div>
          )}

          {/* ── Schematic body — fills remaining viewport height ── */}
          <div
            id="schematic-diagram-panel"
            role="tabpanel"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              overflow: 'hidden',
              padding: isFullscreen ? '0 6px 6px' : '8px 12px 12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Zoom/Pan Controls Toolbar — rendered INSIDE schematic-container so
                  `position: absolute` on desktop correctly anchors to the viewer edge. */}
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
              {/* Transform wrapper — sized by the image's natural aspect ratio on
                  mobile (so hotspot % coords land accurately before the image loads),
                  and flex-fills the full container height on desktop so wide
                  schematics use the entire viewport instead of rendering tiny. */}
              <div 
                ref={schematicImageRef}
                className="schematic-image-wrapper"
                style={{ 
                  position: 'relative',
                  // On mobile: pre-allocate height via aspect-ratio so hotspots
                  // land correctly even on slow connections.
                  // On desktop: CSS flex: 1 1 auto fills remaining height instead —
                  // setting aspectRatio here would fight that and make the image tiny.
                  ...(isMobile && currentPageAspectRatio ? { aspectRatio: currentPageAspectRatio } : {}),
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
                      width: isMobile ? '100%' : 'auto',
                      height: isMobile ? 'auto' : '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
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
                {currentSchematic.parts.filter(part => !part.pageNumber || part.pageNumber === currentPage).map((part, index) => {
                  // Use a composite key so duplicate part IDs (e.g. shared fasteners
                  // that appear twice on a schematic) each get an independent active
                  // state — only the clicked instance highlights, not all copies.
                  const hotspotKey = `${part.id}::${index}`;
                  return (
                  <div
                    key={`${part.id}-${part.position.top}-${part.position.left}-${index}`}
                    className={`hotspot hotspot-${part.shape || 'circle'} ${activeHotspot === hotspotKey ? 'active' : ''}`}
                    style={{
                      position: 'absolute',
                      top: part.position.top,
                      left: part.position.left,
                      transform: part.rotation ? `translate(-50%, -50%) rotate(${part.rotation}deg)` : 'translate(-50%, -50%)',
                      zIndex: activeHotspot === hotspotKey ? 1001 : 100,
                      pointerEvents: 'auto',
                      // Convert pixel-based hotspot dimensions to scale-independent
                      // percentages using the source image's natural dimensions so
                      // the hotspot always covers the same portion of the image
                      // regardless of the screen size or device pixel ratio.
                      ...(part.widthPx && part.heightPx && part.imageNaturalWidth && part.imageNaturalHeight ? {
                        width:  `${(part.widthPx  / part.imageNaturalWidth)  * 100}%`,
                        height: `${(part.heightPx / part.imageNaturalHeight) * 100}%`,
                      } : part.widthPx && part.heightPx ? {
                        // Fallback: no natural dimensions available — use pixels as-is
                        width:  `${part.widthPx}px`,
                        height: `${part.heightPx}px`,
                      } : part.width && part.height ? {
                        width:  `${part.width}%`,
                        height: `${part.height}%`,
                      } : {})
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
                      } else if (activeHotspot === hotspotKey) {
                        closeModal();
                      } else {
                        // Snapshot the hotspot's bounding rect before React re-renders
                        // so calculateAndSetModalPosition can use it both immediately
                        // and in the post-render useEffect.
                        const r = e.currentTarget.getBoundingClientRect();
                        lastHotspotRectRef.current = {
                          top: r.top, left: r.left, bottom: r.bottom,
                          right: r.right, width: r.width, height: r.height,
                        };
                        calculateAndSetModalPosition(lastHotspotRectRef.current);
                        setActiveHotspot(hotspotKey);
                        setActiveHotspotPart(part);
                      }
                    }}
                    title={`${part.name} (${part.sku})`}
                  >
                    {/* Desktop inline modal (hidden on mobile via CSS) */}
                    <div className="part-modal" onClick={(e) => e.stopPropagation()}>
                    {activeHotspot === hotspotKey && hotspotProduct?.images?.[0] && (
                      <img
                        src={hotspotProduct.images[0]}
                        alt={part.name}
                        className="hotspot-modal-image"
                      />
                    )}
                    <h4 style={{
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.1em',
                      marginBottom: '8px'
                    }}>
                      {part.name}
                    </h4>
                    <div className="part-meta">
                      SKU: {part.sku}
                      {part.quantity > 1 && ` | Qty: ${part.quantity}`}
                      {activeHotspot === hotspotKey && (
                        <span style={{
                          marginLeft: '6px',
                          fontWeight: 700,
                          color: hotspotStockStatus === 'instock' ? '#16a34a'
                               : hotspotStockStatus === 'outofstock' ? '#dc2626'
                               : '#6b7280',
                        }}>
                          {hotspotStockStatus === 'instock' ? '● In Stock'
                         : hotspotStockStatus === 'outofstock' ? '● Out of Stock'
                         : hotspotStockStatus === 'unknown' ? '● Unavailable'
                         : '…'}
                        </span>
                      )}
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
                        {/* Show live WC price when available; fall back to JSON-static price */}
                        ${(parseFloat(hotspotProduct?.price) > 0 ? parseFloat(hotspotProduct.price) : part.price).toFixed(2)}
                      </span>
                      <button
                        className="alloy-button"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.6rem'
                        }}
                        disabled={!part.sku || addingToCart === part.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(part);
                        }}
                      >
                        {addingToCart === part.id ? '…' : part.sku ? 'Add' : 'Unavailable'}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}

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
            {/* Desktop detached modal — lives inside schematic-container but OUTSIDE
                the transform wrapper so it is never scaled or clipped by the viewer.
                Position is calculated in calculateAndSetModalPosition to ensure it
                stays fully within the container boundaries. Hidden on mobile (the
                overlay handles the mobile presentation). */}
            {!isMobile && activeHotspotPart && (
              <div
                ref={detachedModalRef}
                className="part-modal part-modal-detached"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: `${modalPosition.top}px`,
                  left: `${modalPosition.left}px`,
                }}
              >
                {hotspotProduct?.images?.[0] && (
                  <img
                    src={hotspotProduct.images[0]}
                    alt={activeHotspotPart.name}
                    className="hotspot-modal-image"
                  />
                )}
                <h4 style={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  marginBottom: '8px'
                }}>
                  {activeHotspotPart.name}
                </h4>
                <div className="part-meta">
                  SKU: {activeHotspotPart.sku}
                  {activeHotspotPart.quantity > 1 && ` | Qty: ${activeHotspotPart.quantity}`}
                  <span style={{
                    marginLeft: '6px',
                    fontWeight: 700,
                    color: hotspotStockStatus === 'instock' ? '#16a34a'
                         : hotspotStockStatus === 'outofstock' ? '#dc2626'
                         : '#6b7280',
                  }}>
                    {hotspotStockStatus === 'instock' ? '● In Stock'
                   : hotspotStockStatus === 'outofstock' ? '● Out of Stock'
                   : hotspotStockStatus === 'unknown' ? '● Unavailable'
                   : '…'}
                  </span>
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
                    {/* Show live WC price when available; fall back to JSON-static price */}
                    ${(parseFloat(hotspotProduct?.price) > 0 ? parseFloat(hotspotProduct.price) : activeHotspotPart.price).toFixed(2)}
                  </span>
                  <button
                    className="alloy-button"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.6rem'
                    }}
                    disabled={!activeHotspotPart.sku || addingToCart === activeHotspotPart.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(activeHotspotPart);
                    }}
                  >
                    {addingToCart === activeHotspotPart.id ? '…' : activeHotspotPart.sku ? 'Add' : 'Unavailable'}
                  </button>
                </div>
              </div>
            )}
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
            {hotspotProduct?.images?.[0]?.src && (
              <img
                src={hotspotProduct.images[0].src}
                alt={hotspotProduct.images[0].alt || activeHotspotPart.name}
                className="hotspot-modal-image hotspot-modal-image--mobile"
              />
            )}
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
              SKU: {activeHotspotPart.sku}
              {activeHotspotPart.quantity > 1 && ` | Qty: ${activeHotspotPart.quantity}`}
              <span style={{
                marginLeft: '6px',
                fontWeight: 700,
                color: hotspotStockStatus === 'instock' ? '#16a34a'
                     : hotspotStockStatus === 'outofstock' ? '#dc2626'
                     : '#6b7280',
              }}>
                {hotspotStockStatus === 'instock' ? '● In Stock'
               : hotspotStockStatus === 'outofstock' ? '● Out of Stock'
               : hotspotStockStatus === 'unknown' ? '● Unavailable'
               : '…'}
              </span>
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
                {/* Show live WC price when available; fall back to JSON-static price */}
                ${(parseFloat(hotspotProduct?.price) > 0 ? parseFloat(hotspotProduct.price) : activeHotspotPart.price).toFixed(2)}
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
                disabled={!activeHotspotPart?.sku || addingToCart === activeHotspotPart?.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(activeHotspotPart);
                }}
              >
                {addingToCart === activeHotspotPart?.id ? 'Adding…' : activeHotspotPart?.sku ? 'Add to Cart' : 'Unavailable'}
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
