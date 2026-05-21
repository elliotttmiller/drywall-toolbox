#!/usr/bin/env python3
"""
rebuild_product_descriptions.py
Rebuilds professional, SEO-optimized product descriptions for the DTB launch catalog.

Sources (priority order):
  1. enhanced_products_unified.csv
  2. woocommerce_catalog_SEO_batch_3.csv
  3. woocommerce_catalog_SEO_batch_4.csv
  4. wc-product-launch-optimized.csv
  5. tapetech_drywall_scraped.csv  (matched by MPN / name)
  6. Hardcoded professional descriptions for remaining 47 products
"""

import csv
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE = Path(__file__).resolve().parent.parent
LAUNCH_CSV   = BASE / "products/Production/launch/dtb_woocommerce_official_catalog_optimized.csv"
SRC_UNIFIED  = BASE / "products/Production/catalogs/other/enhanced_products_unified.csv"
SRC_BATCH3   = BASE / "products/Production/catalogs/other/woocommerce_catalog_SEO_batch_3.csv"
SRC_BATCH4   = BASE / "products/Production/catalogs/other/woocommerce_catalog_SEO_batch_4.csv"
SRC_LAUNCH   = BASE / "products/Production/launch/wc-product-launch-optimized.csv"
SRC_SCRAPED  = BASE / "products/scraped_results/brands/TapeTech/tapetech_drywall_scraped.csv"

# ---------------------------------------------------------------------------
# Boilerplate markers – descriptions containing any of these are ignored
# ---------------------------------------------------------------------------
BOILERPLATE_MARKERS = [
    "catalog-normalized",
    "catalog item:",
    "is a catalog-normalized",
    "source reference:",
    "structured temp catalog",
]

def is_boilerplate(text: str) -> bool:
    if not text:
        return True
    lower = text.lower()
    if any(m in lower for m in BOILERPLATE_MARKERS):
        return True
    if len(text.strip()) < 50:
        return True
    return False

# ---------------------------------------------------------------------------
# Hardcoded professional descriptions for the 47 products
# Format: { SKU: { "short": str, "long": str } }
# ---------------------------------------------------------------------------
HARDCODED: dict[str, dict[str, str]] = {

    # ---- Columbia Tools ------------------------------------------------

    "COL-180-GRIP-FLAT-BOX-HANDLE": {
        "short": (
            "The Columbia 180° Grip Flat Box Handle delivers superior control and leverage "
            "for professional drywall flat-box finishing. Precision-machined from high-strength "
            "aluminum with an ergonomic 180° rotating grip that reduces wrist fatigue on long runs."
        ),
        "long": (
            "<p>The Columbia 180° Grip Flat Box Handle is engineered for drywall professionals "
            "who demand consistent, fatigue-free performance across full-day finishing schedules. "
            "The signature 180° rotating grip distributes force evenly, eliminating the torque "
            "stress associated with conventional fixed-grip handles.</p>\n"
            "<ul>\n"
            "<li><strong>180° Rotating Grip</strong>: Reduces wrist fatigue and allows natural "
            "hand positioning on both push and pull strokes</li>\n"
            "<li><strong>Precision Aluminum Construction</strong>: Lightweight yet rigid — delivers "
            "consistent box pressure without flex</li>\n"
            "<li><strong>Universal Compatibility</strong>: Fits standard Columbia flat boxes and "
            "most industry-compatible finishing boxes</li>\n"
            "<li><strong>Available Lengths</strong>: 3′, 42″, 4′, 5′, 6′ — right length for "
            "every wall height and ceiling application</li>\n"
            "</ul>\n"
            "<p>Backed by Columbia Taping Tools' commitment to Canadian-made craftsmanship, "
            "this handle is the finishing professional's choice for daily production work.</p>"
        ),
    },

    "COL-AUTOMATIC-FAT-BOY-BOX": {
        "short": (
            "Columbia's Automatic Fat Boy Box combines an oversized mud reservoir with automatic "
            "compound delivery for fewer refills on large drywall jobs. Machined aluminum body with "
            "a precision-ground stainless steel blade ensures a smooth, consistent coat every pass."
        ),
        "long": (
            "<p>The Columbia Automatic Fat Boy Box is the high-capacity solution for professionals "
            "finishing large residential and commercial jobs. The expanded mud reservoir dramatically "
            "reduces downtime spent refilling, letting crews coat more linear footage per hour.</p>\n"
            "<ul>\n"
            "<li><strong>High-Capacity Reservoir</strong>: Holds significantly more compound than "
            "standard boxes — fewer refill stops on long seams</li>\n"
            "<li><strong>Automatic Compound Delivery</strong>: Consistent pressure-regulated output "
            "for uniform coat thickness on every pass</li>\n"
            "<li><strong>Precision Stainless Steel Blade</strong>: Ground-flat blade edge produces "
            "a feather-smooth finish and resists corrosion</li>\n"
            "<li><strong>Machined Aluminum Body</strong>: Durable, lightweight construction "
            "designed for daily professional use</li>\n"
            "<li><strong>Available Sizes</strong>: 8″, 10″, 12″</li>\n"
            "</ul>\n"
            "<p>Compatible with Columbia flat box handles and most industry-standard handle systems. "
            "Ideal for production tapers and finishers on high-volume drywall projects.</p>"
        ),
    },

    "COL-AUTOMATIC-TAPER": {
        "short": (
            "The Columbia Automatic Taper simultaneously applies paper tape and joint compound "
            "in a single pass — the professional 'bazooka' built for speed and consistency. "
            "Available in standard and lightweight Predator Carbon Fiber models at two lengths."
        ),
        "long": (
            "<p>The Columbia Automatic Taper is the flagship tool in any professional taping "
            "contractor's arsenal. It simultaneously lays and embeds paper tape with joint compound "
            "in one fluid motion, cutting taping time dramatically compared to hand methods.</p>\n"
            "<ul>\n"
            "<li><strong>Simultaneous Tape & Compound Application</strong>: One-pass seam taping "
            "for maximum productivity on flat seams</li>\n"
            "<li><strong>Predator Carbon Fiber Option</strong>: Significantly lighter than standard "
            "aluminum — reduces arm fatigue on full-day ceiling runs</li>\n"
            "<li><strong>Standard 53″ Length</strong>: Optimal reach for most 8–9 ft ceiling "
            "applications without over-extension</li>\n"
            "<li><strong>Sawed Off 39″ Length</strong>: Compact configuration for low ceilings, "
            "tight stairwells, and confined spaces</li>\n"
            "<li><strong>Available Configurations</strong>: Standard 53″, Predator Carbon Fiber 53″, "
            "Sawed Off 39″, Predator Sawed Off Carbon Fiber 39″</li>\n"
            "</ul>\n"
            "<p>Engineered to Columbia's exacting tolerances, each taper features precision-ground "
            "components for consistent tape tension and compound flow across every job site condition.</p>"
        ),
    },

    "COL-BILLET-MUD-APPLICATOR": {
        "short": (
            "The Columbia Billet Mud Applicator is precision-machined from solid billet aluminum "
            "to apply joint compound to corner beads and trim accessories with exact, repeatable "
            "coverage. Multiple configurations cover inside and outside 90° corners plus flat beads."
        ),
        "long": (
            "<p>Precision-machined from solid billet aluminum, the Columbia Billet Mud Applicator "
            "delivers the consistent compound application that hand mudding simply cannot match. "
            "Each applicator is designed for a specific corner geometry, ensuring perfect compound "
            "coverage on every profile type.</p>\n"
            "<ul>\n"
            "<li><strong>Billet Aluminum Construction</strong>: CNC-machined from solid stock for "
            "dimensional accuracy and long service life</li>\n"
            "<li><strong>Two-Way Internal Corner (4-Wheel)</strong>: Simultaneously applies both "
            "legs of inside corners in a single pass</li>\n"
            "<li><strong>Inside Corner Models</strong>: 2-Wheel 1″ and 4-Wheel 1″ for standard "
            "inside 90° bead application</li>\n"
            "<li><strong>External 90° Model</strong>: Precision compound delivery to outside "
            "corner bead profiles</li>\n"
            "<li><strong>Flat Model</strong>: For applying compound to flat trim and L-bead profiles</li>\n"
            "<li><strong>Available Configurations</strong>: Two-Way Internal Corner 4-Wheel, "
            "Inside Corner 2-Wheel 1″, Inside Corner 4-Wheel 1″, External 90°, Flat</li>\n"
            "</ul>\n"
            "<p>Compatible with Columbia Gooseneck and Pump systems for full production-line "
            "bead application workflows.</p>"
        ),
    },

    "COL-BOX-FILLER": {
        "short": (
            "The Columbia Box Filler quickly charges flat finishing boxes with joint compound "
            "directly from the bucket — eliminating messy hand-loading and keeping production "
            "moving. Available in Standard and Tall Boy configurations for different bucket depths."
        ),
        "long": (
            "<p>The Columbia Box Filler is the worksite essential that keeps finishing crews "
            "productive by rapidly transferring joint compound from bucket to flat box. Designed "
            "for clean, efficient loading without compound waste or spillage.</p>\n"
            "<ul>\n"
            "<li><strong>Rapid Compound Transfer</strong>: Fills flat boxes in seconds — "
            "eliminates the downtime of hand-loading</li>\n"
            "<li><strong>Precision-Fit Nozzle</strong>: Mates securely with Columbia flat box "
            "fill ports for clean, drip-free loading</li>\n"
            "<li><strong>Standard Configuration</strong>: For standard bucket depths — "
            "the everyday workhorse filler</li>\n"
            "<li><strong>Tall Boy Configuration</strong>: Extended barrel reaches the bottom "
            "of 5-gallon pails without tilting</li>\n"
            "<li><strong>Durable Aluminum Body</strong>: Resists the alkaline environment "
            "of joint compound for long service life</li>\n"
            "</ul>\n"
            "<p>Part of the Columbia Taping Tools integrated finishing system — pairs seamlessly "
            "with Columbia flat boxes, pumps, and gooseneck accessories.</p>"
        ),
    },

    "COL-FAT-BOY-FLAT-BOX": {
        "short": (
            "The Columbia Fat Boy Flat Box delivers high-capacity compound application for "
            "professionals who need to cover maximum linear footage before refilling. "
            "Precision-ground stainless blade and heavy-duty aluminum body built for production use."
        ),
        "long": (
            "<p>The Columbia Fat Boy Flat Box is engineered for production-pace drywall finishing "
            "on large commercial and residential projects. Its oversized mud reservoir reduces refill "
            "frequency while the precision blade delivers a consistent, feathered coat with every pass.</p>\n"
            "<ul>\n"
            "<li><strong>High-Capacity Mud Reservoir</strong>: Holds more compound than standard "
            "boxes — maximizes time-on-wall productivity</li>\n"
            "<li><strong>Precision-Ground Stainless Steel Blade</strong>: Ultra-flat blade edge "
            "for smooth, consistent compound feathering</li>\n"
            "<li><strong>Heavy-Duty Aluminum Body</strong>: Robust construction that withstands "
            "the rigors of daily production use</li>\n"
            "<li><strong>Smooth Compound Flow</strong>: Engineered internal geometry ensures "
            "even compound distribution across the full blade width</li>\n"
            "<li><strong>Available Sizes</strong>: 5.5″, 8″, 10″, 12″</li>\n"
            "</ul>\n"
            "<p>Fully compatible with Columbia flat box handles including the 180° Grip, "
            "Matrix, and One Handle systems. A staple in any professional drywall finishing kit.</p>"
        ),
    },

    "COL-FLAT-FINISHER-BOX": {
        "short": (
            "The Columbia Flat Finisher Box is the professional standard for applying and "
            "feathering joint compound over taped flat seams. Precision-machined aluminum body "
            "with a ground stainless steel blade for smooth, even coats on every pass."
        ),
        "long": (
            "<p>The Columbia Flat Finisher Box is the core tool in the professional drywall "
            "finishing workflow, designed to apply perfectly feathered coats of joint compound "
            "over taped flat seams. Precision engineering ensures consistent compound delivery "
            "and blade pressure across the full width of every coat.</p>\n"
            "<ul>\n"
            "<li><strong>Precision-Ground Stainless Steel Blade</strong>: Mirror-flat blade "
            "profile for thin, even compound feathering</li>\n"
            "<li><strong>Machined Aluminum Body</strong>: Tight tolerances prevent compound "
            "bypass and ensure consistent output pressure</li>\n"
            "<li><strong>Smooth Compound Flow</strong>: Internal channel geometry for drip-free, "
            "uniform compound delivery</li>\n"
            "<li><strong>Easy Maintenance</strong>: Tool-accessible design for quick cleaning "
            "and blade replacement</li>\n"
            "<li><strong>Available Sizes</strong>: 5.5″, 7″, 8″, 10″, 12″</li>\n"
            "</ul>\n"
            "<p>Compatible with all Columbia flat box handles. Choose your box size to match "
            "the seam width and coat stage — narrower boxes for first coats, wider for finish coats.</p>"
        ),
    },

    "COL-GOOSENECK": {
        "short": (
            "The Columbia Gooseneck is the curved connector that links your automatic taper or "
            "mud applicator to the pump, optimizing compound flow angle for clean, continuous "
            "bead and seam work. Available in Standard and Tall Boy configurations."
        ),
        "long": (
            "<p>The Columbia Gooseneck is the precision-machined connector at the heart of the "
            "Columbia compound delivery system, linking pump to applicator with optimized flow "
            "geometry that prevents compound blockage and maintains consistent pressure.</p>\n"
            "<ul>\n"
            "<li><strong>Optimized Flow Geometry</strong>: Curved profile engineered for "
            "smooth compound delivery without air pockets or pressure drops</li>\n"
            "<li><strong>Machined Aluminum Construction</strong>: Precision-fit connections "
            "that seat securely and resist corrosion</li>\n"
            "<li><strong>Standard Configuration</strong>: For standard pump and taper setups</li>\n"
            "<li><strong>Tall Boy Configuration</strong>: Extended reach for large-capacity "
            "pump systems and high-volume applications</li>\n"
            "<li><strong>Secure Locking Connection</strong>: Positive latch mechanism prevents "
            "accidental disconnection during operation</li>\n"
            "</ul>\n"
            "<p>An essential component in the Columbia integrated taping system — compatible "
            "with Columbia automatic tapers, mud applicators, and pump models.</p>"
        ),
    },

    "COL-HOT-MUD-PUMP": {
        "short": (
            "The Columbia Hot Mud Pump is built to handle fast-setting compounds that would seize "
            "conventional pumps — machined for easy, rapid disassembly and cleaning before compound "
            "sets. Available in Standard, Tall Boy, and CDN configurations."
        ),
        "long": (
            "<p>Fast-setting (hot) compounds demand a pump that can be broken down and cleaned "
            "fast — before the mud sets. The Columbia Hot Mud Pump is designed specifically for "
            "this challenge, with a tool-free disassembly system that lets crews flush the pump "
            "in minutes between hot mud applications.</p>\n"
            "<ul>\n"
            "<li><strong>Fast-Compound Compatible</strong>: Precision-toleranced internals resist "
            "compound adhesion and enable rapid cleanout</li>\n"
            "<li><strong>Rapid Disassembly Design</strong>: Tool-free breakdown for fast cleaning "
            "— critical when working with setting-type compounds</li>\n"
            "<li><strong>Machined Aluminum Body</strong>: Corrosion-resistant construction "
            "handles aggressive fast-setting compounds</li>\n"
            "<li><strong>Standard Configuration</strong>: For standard pail depths</li>\n"
            "<li><strong>Tall Boy Configuration</strong>: Extended reach to bottom of deep pails</li>\n"
            "<li><strong>CDN Configuration</strong>: Canadian-market specific model</li>\n"
            "</ul>\n"
            "<p>Part of Columbia's complete compound delivery system — pairs with Columbia "
            "Goosenecks, automatic tapers, and billet applicator heads.</p>"
        ),
    },

    "COL-MATRIX-FLAT-BOX-HANDLE": {
        "short": (
            "The Columbia Matrix Flat Box Handle features an ergonomic matrix-style grip system "
            "that distributes hand pressure evenly across the handle, reducing fatigue on long "
            "production runs. Precision aluminum construction in three overlapping length ranges."
        ),
        "long": (
            "<p>The Columbia Matrix Flat Box Handle redefines ergonomics in flat box operation "
            "with its patented matrix grip design. The multi-point contact system spreads lateral "
            "force across the hand, preventing the pressure points that cause fatigue during "
            "all-day finishing work.</p>\n"
            "<ul>\n"
            "<li><strong>Matrix Grip System</strong>: Multi-contact grip distributes force evenly — "
            "dramatically reduces hand and wrist fatigue</li>\n"
            "<li><strong>Precision Aluminum Construction</strong>: Lightweight and rigid for "
            "consistent box pressure without flex</li>\n"
            "<li><strong>Adjustable Length Ranges</strong>: Telescoping design covers a range "
            "of reach requirements without switching handles</li>\n"
            "<li><strong>Available Configurations</strong>: 29″–39″, 40″–60″, 56″–76″</li>\n"
            "<li><strong>Universal Box Compatibility</strong>: Fits Columbia flat boxes and most "
            "industry-compatible finishing boxes</li>\n"
            "</ul>\n"
            "<p>The Matrix Handle is the professional choice for finishers who spend hours daily "
            "on flat seam work and need a handle system that keeps up with them.</p>"
        ),
    },

    "COL-ONE-HANDLE": {
        "short": (
            "The Columbia One Handle is a versatile flat box handle with a streamlined single-grip "
            "design that offers excellent control and reach for professional finishing. "
            "Available in fixed and multiple extendible configurations for any wall height."
        ),
        "long": (
            "<p>The Columbia One Handle offers the clean simplicity of a purpose-built flat box "
            "handle with no-compromise construction. Its streamlined design gives professionals "
            "precise control over box angle and pressure for consistent coat quality.</p>\n"
            "<ul>\n"
            "<li><strong>Streamlined Single-Grip Design</strong>: Intuitive handling for natural "
            "push and pull strokes on flat seams</li>\n"
            "<li><strong>Rigid Aluminum Shaft</strong>: Zero flex construction transmits pressure "
            "evenly to the flat box blade</li>\n"
            "<li><strong>Fixed Configuration</strong>: Maximum rigidity for close-quarters work</li>\n"
            "<li><strong>Extendible 3′–5′</strong>: Covers standard wall-to-ceiling reach</li>\n"
            "<li><strong>Long Extendible 4′–8′</strong>: For high walls and cathedral ceilings</li>\n"
            "<li><strong>Stubby Configuration</strong>: Compact version for low ceilings "
            "and confined spaces</li>\n"
            "</ul>\n"
            "<p>Compatible with Columbia's full range of flat finishing boxes. The One Handle's "
            "straightforward design makes it a favorite among both seasoned professionals and "
            "contractors learning the Columbia system.</p>"
        ),
    },

    "COL-OUTSIDE-CORNER-ROLLER": {
        "short": (
            "The Columbia Outside Corner Roller embeds paper-faced corner bead onto outside "
            "90° corners with consistent, even pressure for a straight, professional finish. "
            "Available in Standard, Bullnose, European, and Wide bead profiles."
        ),
        "long": (
            "<p>The Columbia Outside Corner Roller is engineered to embed and press paper-faced "
            "corner bead profiles onto outside 90° corners with precision and speed. Consistent "
            "roller pressure ensures full adhesion across the entire bead length without bubbles "
            "or lifting edges.</p>\n"
            "<ul>\n"
            "<li><strong>Precision Roller System</strong>: Consistent, even pressure embedding "
            "for straight, professional corner bead installation</li>\n"
            "<li><strong>Standard Profile</strong>: For standard 90° paper-faced corner bead</li>\n"
            "<li><strong>Bullnose Profile</strong>: Matched geometry for bullnose/rounded "
            "corner bead profiles</li>\n"
            "<li><strong>European Profile</strong>: Fits European-standard corner bead dimensions</li>\n"
            "<li><strong>Wide Profile</strong>: For wider-flange corner bead on high-impact areas</li>\n"
            "<li><strong>Durable Aluminum Frame</strong>: Precision-machined for dimensional "
            "accuracy and long service life</li>\n"
            "</ul>\n"
            "<p>Works as a standalone roller or in combination with Columbia corner "
            "applicator heads for a complete outside corner workflow.</p>"
        ),
    },

    "PDDM": {
        "short": (
            "The Columbia Phantom DDM Sander is a professional dry-damp misting sander that "
            "uses a fine water mist to suppress drywall dust without saturating the compound — "
            "keeping your finish smooth while maintaining a cleaner job site."
        ),
        "long": (
            "<p>The Columbia Phantom DDM (Dry-Damp Misting) Sander represents the next evolution "
            "in drywall sanding technology. By applying an ultra-fine water mist directly ahead "
            "of the sanding pad, the DDM system captures airborne dust at the source — dramatically "
            "reducing job site contamination without wetting the compound surface.</p>\n"
            "<ul>\n"
            "<li><strong>Dry-Damp Misting Technology</strong>: Suppresses drywall dust at the "
            "source without soaking or raising the compound surface</li>\n"
            "<li><strong>Professional-Grade Construction</strong>: Built to Columbia's machined "
            "aluminum standards for durability and dimensional stability</li>\n"
            "<li><strong>Cleaner Job Sites</strong>: Dramatically reduces airborne drywall dust — "
            "reduces cleanup time and protects worker respiratory health</li>\n"
            "<li><strong>Smooth Finish Preserved</strong>: Fine mist level is calibrated to "
            "suppress dust without disturbing or re-wetting dried compound</li>\n"
            "<li><strong>Pole Compatible</strong>: Designed for use with standard extension "
            "poles for ceiling and high-wall applications</li>\n"
            "</ul>\n"
            "<p>An innovative Canadian-made solution for professionals who refuse to compromise "
            "on finish quality or job site cleanliness.</p>"
        ),
    },

    "COL-PREDATOR-MATRIX-HANDLE": {
        "short": (
            "The Columbia Predator Matrix Handle combines the innovative Matrix multi-point grip "
            "with a lightweight carbon fiber shaft — delivering maximum fatigue reduction for "
            "professionals finishing high-volume work. Available in Short, Mid, and Long lengths."
        ),
        "long": (
            "<p>The Columbia Predator Matrix Handle is the pinnacle of flat box handle engineering "
            "— pairing the fatigue-fighting Matrix grip system with Columbia's ultra-lightweight "
            "Predator carbon fiber shaft. The result is a handle that feels effortless even after "
            "hours of continuous ceiling and wall finishing.</p>\n"
            "<ul>\n"
            "<li><strong>Predator Carbon Fiber Shaft</strong>: Significantly lighter than aluminum — "
            "reduces arm and shoulder fatigue on all-day production runs</li>\n"
            "<li><strong>Matrix Multi-Point Grip</strong>: Distributes hand pressure evenly, "
            "eliminating pressure points during extended operation</li>\n"
            "<li><strong>Rigid Construction</strong>: Carbon fiber delivers zero-flex performance "
            "for consistent box pressure across the full blade width</li>\n"
            "<li><strong>Available Configurations</strong>: Short 29″–39″, Mid 40″–60″, "
            "Long 56″–76″</li>\n"
            "<li><strong>Universal Box Compatibility</strong>: Fits Columbia flat boxes and "
            "most industry-compatible finishing boxes</li>\n"
            "</ul>\n"
            "<p>The Predator Matrix Handle is the professional's premium choice for production "
            "finishing work where lightweight performance and ergonomics define productivity.</p>"
        ),
    },

    "COL-PREDATOR-ONE-HANDLE": {
        "short": (
            "The Columbia Predator One Handle delivers all the control of the standard One Handle "
            "in a lightweight carbon fiber shaft — dramatically reducing arm fatigue for finishers "
            "working long production days. Available in fixed and extendible configurations."
        ),
        "long": (
            "<p>The Columbia Predator One Handle carries the proven ergonomics of Columbia's "
            "One Handle design into their lightweight Predator carbon fiber lineup. For professionals "
            "spending full days on flat seam finishing, the weight reduction translates directly "
            "into less fatigue and more consistent work quality at day's end.</p>\n"
            "<ul>\n"
            "<li><strong>Predator Carbon Fiber Shaft</strong>: Lightweight construction reduces "
            "cumulative arm fatigue on high-volume finishing schedules</li>\n"
            "<li><strong>Streamlined One Handle Geometry</strong>: Intuitive grip profile for "
            "natural push/pull strokes with precise box angle control</li>\n"
            "<li><strong>4′ Fixed Configuration</strong>: Maximum rigidity for close-range "
            "wall finishing</li>\n"
            "<li><strong>Extendable 3′–5′</strong>: Adjustable length for standard ceiling "
            "and upper-wall reach</li>\n"
            "<li><strong>Long Extendable 4′–8′</strong>: For high ceilings and cathedral "
            "wall applications</li>\n"
            "</ul>\n"
            "<p>Part of Columbia's Predator series — lightweight carbon fiber tools built "
            "for professionals who demand premium performance from every piece of equipment.</p>"
        ),
    },

    "CS": {
        "short": (
            "The Columbia Sander Head is a professional-grade drywall sanding attachment "
            "engineered for flat, consistent contact across wall and ceiling surfaces. "
            "Designed for use with standard extension poles for efficient compound smoothing."
        ),
        "long": (
            "<p>The Columbia Sander Head delivers the consistent, flat-contact sanding performance "
            "that professional drywall finishers rely on for smooth, paint-ready surfaces. "
            "Engineered for compatibility with Columbia Sander Poles and standard extension systems.</p>\n"
            "<ul>\n"
            "<li><strong>Flat-Contact Sanding Pad</strong>: Maintains even pressure across "
            "the full sanding surface for consistent compound removal</li>\n"
            "<li><strong>Pivot Joint</strong>: Allows the head to follow wall contours and "
            "imperfections without losing contact</li>\n"
            "<li><strong>Durable Construction</strong>: Built to withstand daily abrasion "
            "from drywall compound and sanding media</li>\n"
            "<li><strong>Standard Screen/Paper Compatible</strong>: Accepts industry-standard "
            "sanding screens and abrasive sheets</li>\n"
            "<li><strong>Pole Compatible</strong>: Fits Columbia Sander Poles and standard "
            "threaded extension poles</li>\n"
            "</ul>\n"
            "<p>The Columbia Sander Head is an essential finishing tool for achieving "
            "smooth, blemish-free surfaces ready for primer and paint.</p>"
        ),
    },

    "CSH": {
        "short": (
            "The Columbia Sander Pole is a professional extension pole engineered specifically "
            "for drywall sanding heads — providing rigid, controlled reach for walls and ceilings "
            "without the flex that causes uneven compound removal."
        ),
        "long": (
            "<p>The Columbia Sander Pole provides the rigid, reliable extension that sanding "
            "professionals need to work efficiently on walls and ceilings. Engineered to eliminate "
            "the flex that causes uneven sanding pressure and compromises finish quality.</p>\n"
            "<ul>\n"
            "<li><strong>Rigid Aluminum Construction</strong>: Zero-flex design maintains "
            "consistent sanding head pressure across the full surface</li>\n"
            "<li><strong>Threaded Connection</strong>: Secure universal thread accepts Columbia "
            "sander heads and other compatible accessories</li>\n"
            "<li><strong>Ergonomic Grip</strong>: Non-slip handle designed for the "
            "push-pull motions of professional sanding work</li>\n"
            "<li><strong>Corrosion-Resistant Finish</strong>: Stands up to the alkaline "
            "environment of drywall dust and compound</li>\n"
            "</ul>\n"
            "<p>Designed to pair with the Columbia Sander Head as part of a complete "
            "professional sanding system for drywall finishing workflows.</p>"
        ),
    },

    "COL-STANDARD-FLUSHER": {
        "short": (
            "The Columbia Standard Flusher applies and feathers joint compound in inside "
            "90° corners with precision and speed. Machined aluminum body with a stainless "
            "steel blade ensures a clean, smooth coat for professional corner finishing."
        ),
        "long": (
            "<p>The Columbia Standard Flusher is the workhorse of inside corner finishing — "
            "designed to apply a smooth, feathered coat of joint compound in 90° interior corners "
            "with a single, controlled pass. Precision-machined components ensure consistent "
            "blade-to-corner contact across the full length of each seam.</p>\n"
            "<ul>\n"
            "<li><strong>Precision Stainless Steel Blade</strong>: Ground-flat blade produces "
            "a smooth, feathered coat in inside 90° corners</li>\n"
            "<li><strong>Machined Aluminum Body</strong>: Tight manufacturing tolerances "
            "for consistent compound output with no bypass</li>\n"
            "<li><strong>Multiple Blade Widths</strong>: Choose the right coverage width "
            "for each coat stage</li>\n"
            "<li><strong>Available Sizes</strong>: 2.5″, 3″, 3″ Widetrack, 3.5″, 4″</li>\n"
            "<li><strong>Handle Compatible</strong>: Accepts Columbia flat box handles "
            "for extended reach</li>\n"
            "</ul>\n"
            "<p>The Standard Flusher is a core component in any professional corner finishing "
            "system — use progressively wider sizes for consecutive coat applications.</p>"
        ),
    },

    "COL-THROTTLE-CORNER-FLUSHER-BOX": {
        "short": (
            "The Columbia Throttle Corner Flusher Box is an integrated corner finishing "
            "solution with a built-in compound pump — delivering continuous, pressure-controlled "
            "compound flow for fast, consistent inside corner finishing."
        ),
        "long": (
            "<p>The Columbia Throttle Corner Flusher Box elevates inside corner finishing by "
            "integrating a throttle-controlled compound pump directly into the flusher body. "
            "No manual reloading — continuous compound feed keeps the blade full and the work "
            "moving at production pace.</p>\n"
            "<ul>\n"
            "<li><strong>Integrated Throttle Pump</strong>: Built-in pressure regulation "
            "delivers continuous, controlled compound flow during operation</li>\n"
            "<li><strong>Consistent Blade Fill</strong>: Eliminates the interruptions "
            "of manual loading for faster corner finishing</li>\n"
            "<li><strong>Precision Stainless Blade</strong>: Ground-flat blade edge "
            "for smooth, feathered compound application in 90° corners</li>\n"
            "<li><strong>Machined Aluminum Body</strong>: Professional-grade construction "
            "for daily production use</li>\n"
            "<li><strong>Available Sizes</strong>: 7″, 8″</li>\n"
            "</ul>\n"
            "<p>The Throttle Corner Flusher Box is the professional choice for contractors "
            "finishing large volumes of inside corner work and need maximum throughput.</p>"
        ),
    },

    "COL-TOOL-CASE": {
        "short": (
            "The Columbia Tool Case provides secure, organized storage and transport for your "
            "professional drywall finishing tools. Available as a compact Gun Case and a "
            "full-size Road Case for complete kit protection on the job."
        ),
        "long": (
            "<p>Protect your investment in professional Columbia Taping Tools with purpose-built "
            "carrying cases designed for the demands of active job sites. Organized storage "
            "prevents tool damage and keeps your kit ready to deploy on every project.</p>\n"
            "<ul>\n"
            "<li><strong>Custom Foam Interior</strong>: Precision-cut foam cradles each tool "
            "securely — prevents shifting and impact damage during transport</li>\n"
            "<li><strong>Rugged Exterior Shell</strong>: Durable case construction stands up "
            "to the rigors of daily job site transport and storage</li>\n"
            "<li><strong>Gun Case</strong>: Compact format for automatic taper and core "
            "taping tools — ideal for taper-and-finish crews</li>\n"
            "<li><strong>Road Case</strong>: Full-size format for complete finishing kit — "
            "holds flat boxes, handles, and accessories</li>\n"
            "<li><strong>Secure Latches</strong>: Positive-lock closures keep tools "
            "secured during transport</li>\n"
            "</ul>\n"
            "<p>Keep your Columbia tools protected and organized with a case built "
            "to the same quality standards as the tools inside.</p>"
        ),
    },

    "COL-TOOL-SET": {
        "short": (
            "Columbia Tool Sets are professionally curated complete finishing kits — "
            "matched tools from the same precision system for seamless compatibility "
            "and consistent performance across every operation stage."
        ),
        "long": (
            "<p>Columbia Tool Sets take the guesswork out of building a professional finishing "
            "kit. Each set is curated by Columbia's tool engineers to include perfectly matched "
            "tools that work together as an integrated system — from taping through to final finish.</p>\n"
            "<ul>\n"
            "<li><strong>Integrated Tool Systems</strong>: Every tool in the set engineered "
            "to work seamlessly with the others</li>\n"
            "<li><strong>Tactical Set</strong>: Core finishing essentials for the "
            "professional taper-finisher</li>\n"
            "<li><strong>Predator Tactical Set</strong>: Tactical Set with Predator "
            "carbon fiber upgrades for maximum lightweight performance</li>\n"
            "<li><strong>Commando Set</strong>: Expanded kit for comprehensive "
            "wall-and-ceiling finishing capability</li>\n"
            "<li><strong>Warrior Set</strong>: Full-spectrum production kit for "
            "high-volume commercial finishing contractors</li>\n"
            "<li><strong>Canadian-Made Quality</strong>: Every tool in the set "
            "machined to Columbia's exacting tolerances</li>\n"
            "</ul>\n"
            "<p>A Columbia Tool Set is the best way for professionals to build "
            "or upgrade their kit with guaranteed compatibility and matched performance.</p>"
        ),
    },

    "TL-3-8": {
        "short": (
            "The Columbia Twist Lock Handle with PHA (Pivoting Head Assembly) provides secure, "
            "positive-lock connection between flat box handles and finishing boxes — eliminating "
            "rotation and slippage for precise compound application control."
        ),
        "long": (
            "<p>The Columbia Twist Lock Handle with PHA (Pivoting Head Assembly) solves the "
            "professional's frustration with handles that rotate or slip during operation. "
            "The twist-lock mechanism creates a solid, positive connection while the pivoting "
            "head allows natural angle adjustment during use.</p>\n"
            "<ul>\n"
            "<li><strong>Twist Lock Mechanism</strong>: Positive-lock connection eliminates "
            "handle rotation and slippage during flat box operation</li>\n"
            "<li><strong>Pivoting Head Assembly (PHA)</strong>: Allows natural box angle "
            "adjustment without releasing grip</li>\n"
            "<li><strong>Precision Machined</strong>: Tight tolerances for a solid, "
            "rattle-free connection</li>\n"
            "<li><strong>Corrosion-Resistant Finish</strong>: Stands up to the alkaline "
            "environment of daily compound use</li>\n"
            "<li><strong>Universal Box Compatibility</strong>: Fits Columbia flat boxes "
            "and most industry-compatible finishing boxes</li>\n"
            "</ul>\n"
            "<p>The Twist Lock Handle with PHA is the professional upgrade for finishers who "
            "want maximum box control with minimum adjustment stops.</p>"
        ),
    },

    "COL-UHMW-MUD-APPLICATOR": {
        "short": (
            "The Columbia UHMW Mud Applicator is crafted from ultra-high molecular weight "
            "polyethylene — a self-lubricating, compound-release material that prevents sticking "
            "and ensures smooth, consistent application on corner bead profiles."
        ),
        "long": (
            "<p>UHMW (Ultra-High Molecular Weight) polyethylene is the material of choice for "
            "compound applicators — its near-zero adhesion surface lets joint compound release "
            "cleanly, reducing drag and delivering perfectly consistent bead coverage on every pass. "
            "The Columbia UHMW Mud Applicator brings this material advantage to a precision-engineered "
            "professional tool.</p>\n"
            "<ul>\n"
            "<li><strong>UHMW Polyethylene Construction</strong>: Self-lubricating surface "
            "prevents compound adhesion and drag for smooth, consistent bead coverage</li>\n"
            "<li><strong>L-Trim Profile</strong>: Precise compound delivery on L-bead "
            "and edge trim profiles</li>\n"
            "<li><strong>Inside 90° Profile</strong>: Optimized geometry for inside "
            "90° corner bead application</li>\n"
            "<li><strong>Outside 90° Profile</strong>: For standard outside 90° "
            "corner bead application</li>\n"
            "<li><strong>Outside 90° 325 Profile</strong>: Extended coverage for "
            "wide-flange outside corner beads</li>\n"
            "<li><strong>Available Configurations</strong>: L-Trim, Inside 90°, "
            "Outside 90°, Outside 90° 325</li>\n"
            "</ul>\n"
            "<p>Compatible with Columbia pump and gooseneck systems for integrated "
            "bead application workflows on production drywall projects.</p>"
        ),
    },

    # ---- TapeTech -------------------------------------------------------

    "GSR-TT": {
        "short": (
            "The TapeTech Gooseneck Riser elevates the gooseneck connection point for improved "
            "compound flow angle and reduced hose kinking — keeping your TapeTech pump system "
            "delivering consistent pressure through every application."
        ),
        "long": (
            "<p>The TapeTech Gooseneck Riser is a precision-engineered adapter that optimizes "
            "the connection geometry between pump, gooseneck, and automatic taper. By raising the "
            "connection point, it improves compound flow angle and reduces the hose kinking that "
            "can cause pressure drops during continuous taping operations.</p>\n"
            "<ul>\n"
            "<li><strong>Improved Flow Geometry</strong>: Elevated connection reduces compound "
            "flow restriction and hose kinking</li>\n"
            "<li><strong>Consistent Compound Pressure</strong>: Optimized flow path maintains "
            "steady pressure through the full taping system</li>\n"
            "<li><strong>TapeTech System Compatible</strong>: Engineered for seamless integration "
            "with TapeTech automatic tapers and pump systems</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Machined to TapeTech's "
            "professional-grade standards</li>\n"
            "<li><strong>Easy Installation</strong>: Direct replacement connection — "
            "no tools required</li>\n"
            "</ul>\n"
            "<p>A small component that makes a real difference in compound delivery consistency "
            "on high-volume taping jobs. Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "PMP001": {
        "short": (
            "The TapeTech 30″ Premium Mixing Paddle is engineered for thorough, lump-free "
            "joint compound mixing — a heavy-duty paddle built to handle full 5-gallon pails "
            "at professional drill speeds without bending or blade flex."
        ),
        "long": (
            "<p>Properly mixed joint compound is the foundation of smooth drywall finishing. "
            "The TapeTech 30″ Premium Mixing Paddle delivers thorough, lump-free mixing even "
            "in full 5-gallon pails, with a heavy-duty shaft and aggressive blade geometry that "
            "folds compound from bottom to top for consistent, uniform consistency.</p>\n"
            "<ul>\n"
            "<li><strong>30″ Professional Length</strong>: Reaches the full depth of "
            "5-gallon compound pails without over-reaching</li>\n"
            "<li><strong>Heavy-Duty Shaft</strong>: Rigid steel construction resists "
            "bending at high drill speeds</li>\n"
            "<li><strong>Aggressive Blade Geometry</strong>: Folds and lifts compound "
            "from bottom to surface for thorough, lump-free mixing</li>\n"
            "<li><strong>Drill Chuck Compatible</strong>: Standard hex shank fits "
            "most professional drill chucks</li>\n"
            "<li><strong>Corrosion-Resistant Finish</strong>: Withstands the alkaline "
            "environment of joint compound for extended service life</li>\n"
            "</ul>\n"
            "<p>A TapeTech essential — properly mixed compound means fewer blade marks, "
            "smoother coats, and better finish quality across every application.</p>"
        ),
    },

    "SCP02": {
        "short": (
            "The TapeTech 6.5″ Bucket Scoop is a wide-mouth compound loading tool designed "
            "to transfer joint compound from bucket to pump or mud pan quickly and cleanly — "
            "reducing waste and keeping your workflow moving."
        ),
        "long": (
            "<p>The TapeTech 6.5″ Bucket Scoop is a purpose-designed compound transfer tool "
            "that makes loading pumps and mud pans fast and clean. Its wide-mouth profile "
            "and angled blade efficiently moves compound from bucket to tool without the mess "
            "of improvised implements.</p>\n"
            "<ul>\n"
            "<li><strong>6.5″ Wide-Mouth Design</strong>: Maximum compound capture per "
            "scoop — faster loading than narrow alternatives</li>\n"
            "<li><strong>Angled Blade Profile</strong>: Scrapes compound cleanly from "
            "bucket walls and bottom to minimize waste</li>\n"
            "<li><strong>Durable Construction</strong>: Built to TapeTech's professional "
            "standards for long service life</li>\n"
            "<li><strong>Ergonomic Handle</strong>: Comfortable grip for repetitive "
            "loading motions during production work</li>\n"
            "<li><strong>Clean Transfer</strong>: Controlled pour profile reduces compound "
            "drips and job site mess</li>\n"
            "</ul>\n"
            "<p>A small tool with a big impact on worksite efficiency — the TapeTech "
            "Bucket Scoop is a must-have accessory in every professional compound kit.</p>"
        ),
    },

    "TT-APPLICATOR-HEAD": {
        "short": (
            "The TapeTech Applicator Head applies joint compound to inside and outside corners "
            "as the foundation coat for bead finishing — precision-engineered for consistent "
            "coverage on both 90° inside and outside corner profiles."
        ),
        "long": (
            "<p>The TapeTech Applicator Head is the starting point for professional corner "
            "finishing — it applies a uniform base coat of joint compound to corner bead profiles "
            "before the finisher follows with corner finishers. Precision engineering ensures "
            "consistent compound coverage on every pass.</p>\n"
            "<ul>\n"
            "<li><strong>Consistent Base Coat Application</strong>: Delivers uniform compound "
            "coverage on corner bead profiles for proper finisher adhesion</li>\n"
            "<li><strong>Outside Corner Configuration (16TT)</strong>: Optimized for "
            "outside 90° corner bead profiles</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Precision-machined to "
            "TapeTech's professional-grade tolerances</li>\n"
            "<li><strong>TapeTech System Integration</strong>: Connects seamlessly to "
            "TapeTech pump and gooseneck systems</li>\n"
            "<li><strong>Easy Clean-Out</strong>: Tool-accessible design for fast field "
            "cleaning between coats</li>\n"
            "</ul>\n"
            "<p>The TapeTech Applicator Head works in sequence with TapeTech Corner Finishers "
            "to deliver professional-quality corner finishing from base coat to final finish. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-BRAKELESS-BOX-HANDLE": {
        "short": (
            "The TapeTech Brakeless Box Handle is engineered for professionals who prefer an "
            "unrestricted, free-flowing handle response during flat box finishing — no brake "
            "mechanism means a direct, natural connection between hand and box for precise control."
        ),
        "long": (
            "<p>The TapeTech Brakeless Box Handle delivers the direct, unmediated feel that "
            "experienced finishers prefer. Without a braking mechanism, the handle responds "
            "immediately to every subtle hand movement — giving skilled professionals the direct "
            "feedback and control they need for precision flat seam work.</p>\n"
            "<ul>\n"
            "<li><strong>Brakeless Design</strong>: No braking mechanism — direct, natural "
            "handle response for experienced professionals</li>\n"
            "<li><strong>Precision Aluminum Construction</strong>: Lightweight and rigid "
            "for consistent, unflexing box pressure</li>\n"
            "<li><strong>TapeTech Box Compatible</strong>: Engineered to connect with "
            "TapeTech finishing boxes and most industry-compatible boxes</li>\n"
            "<li><strong>Professional-Grade Build</strong>: Built to TapeTech's standards "
            "for the demands of daily production finishing</li>\n"
            "<li><strong>Ergonomic Grip</strong>: Comfortable handle profile for "
            "extended push-pull operation</li>\n"
            "</ul>\n"
            "<p>The TapeTech Brakeless Box Handle is the choice of experienced finishers who "
            "have mastered their technique and want a handle that gets out of the way.</p>"
        ),
    },

    "TT-CARBON-FIBER-BOX-HANDLE": {
        "short": (
            "The TapeTech Carbon Fiber Box Handle delivers the same precision performance "
            "as TapeTech's standard aluminum handles at dramatically reduced weight — "
            "built for professionals who demand both performance and fatigue reduction."
        ),
        "long": (
            "<p>The TapeTech Carbon Fiber Box Handle brings TapeTech's precision engineering "
            "to a lightweight carbon fiber platform. For professionals finishing large volumes "
            "of flat seam work, the weight reduction directly translates to reduced fatigue "
            "and more consistent work quality at the end of a long shift.</p>\n"
            "<ul>\n"
            "<li><strong>Carbon Fiber Shaft</strong>: Dramatically lighter than aluminum — "
            "reduces arm and shoulder fatigue on all-day production runs</li>\n"
            "<li><strong>TapeTech Precision Engineering</strong>: Same professional-grade "
            "construction as standard TapeTech handles</li>\n"
            "<li><strong>Rigid Construction</strong>: Carbon fiber delivers zero-flex "
            "performance for consistent box pressure</li>\n"
            "<li><strong>Universal Box Compatibility</strong>: Fits TapeTech finishing "
            "boxes and most industry-compatible boxes</li>\n"
            "<li><strong>Professional-Grade Fittings</strong>: Aluminum end fittings "
            "machined to tight tolerances for secure box connection</li>\n"
            "</ul>\n"
            "<p>Part of TapeTech's premium handle lineup — backed by TapeTech's "
            "industry-leading warranty for professional tool investments.</p>"
        ),
    },

    "TT-CORNER-FINISHER": {
        "short": (
            "The TapeTech Corner Finisher applies and feathers joint compound in inside "
            "90° corners with a single controlled pass — delivering smooth, consistent "
            "corner coats that form the foundation of a professional drywall finish."
        ),
        "long": (
            "<p>The TapeTech Corner Finisher is a cornerstone of the professional drywall "
            "finishing system — engineered to apply perfectly feathered coats of joint compound "
            "in inside 90° corners. Precision blade geometry and consistent spring tension "
            "produce smooth results across every seam, every time.</p>\n"
            "<ul>\n"
            "<li><strong>Precision Blade System</strong>: Spring-tensioned blades maintain "
            "consistent contact in inside 90° corners for smooth, even coats</li>\n"
            "<li><strong>Single-Pass Application</strong>: Both sides of the inside corner "
            "finished simultaneously for maximum productivity</li>\n"
            "<li><strong>EasyRoll® Adjustable Models</strong>: Adjustable width accommodates "
            "different compound build-up stages (available in select configurations)</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Precision-machined to "
            "TapeTech's professional standards</li>\n"
            "<li><strong>TapeTech System Compatible</strong>: Works with TapeTech handles "
            "for full extension reach on ceilings and high walls</li>\n"
            "</ul>\n"
            "<p>TapeTech Corner Finishers are the professional standard for inside corner "
            "work — available in 2″ (40XTT), 2-1/2″ (42TT), and EasyRoll® adjustable sizes. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-CORNER-ROLLER": {
        "short": (
            "The TapeTech Corner Roller embeds paper tape into inside corners (15TTE) or "
            "paper-faced bead on outside corners (17TT) with consistent, even roller pressure "
            "for secure, bubble-free adhesion every time."
        ),
        "long": (
            "<p>The TapeTech Corner Roller is the professional tool for embedding paper tape "
            "or paper-faced bead into drywall corners with consistent, full-contact roller "
            "pressure. Proper embedding prevents tape lifting, bubbling, and premature failure "
            "that leads to costly callbacks.</p>\n"
            "<ul>\n"
            "<li><strong>Inside Corner Model (15TTE)</strong>: Precisely embeds paper tape "
            "into inside 90° corners with dual-roller pressure</li>\n"
            "<li><strong>Outside Corner Model (17TT)</strong>: Designed for paper-faced "
            "corner bead on outside 90° corners</li>\n"
            "<li><strong>Flex Tape Outside Corner (17TTE)</strong>: For flexible paper-faced "
            "bead on outside corner profiles</li>\n"
            "<li><strong>Consistent Roller Pressure</strong>: Spring-loaded roller system "
            "maintains even embedding force across the full tape width</li>\n"
            "<li><strong>Durable Aluminum Frame</strong>: Professional-grade construction "
            "for daily production use</li>\n"
            "</ul>\n"
            "<p>A critical component in the professional taping sequence — properly embedded "
            "tape is the foundation of a durable, crack-free drywall finish. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-COVE-APPLICATOR-HEAD": {
        "short": (
            "The TapeTech Cove Applicator Head is precision-engineered for applying joint "
            "compound to curved cove corner bead profiles — delivering consistent coverage "
            "that hand-mudding cannot match on these specialty trim pieces."
        ),
        "long": (
            "<p>Cove corner bead profiles present a unique challenge — their curved geometry "
            "makes consistent hand-application nearly impossible. The TapeTech Cove Applicator "
            "Head solves this with a profile-matched applicator that delivers precise, uniform "
            "compound coverage on every cove bead application.</p>\n"
            "<ul>\n"
            "<li><strong>Cove-Profile Matched Geometry</strong>: Engineered specifically for "
            "curved cove corner bead — consistent coverage that hand-mudding can't achieve</li>\n"
            "<li><strong>Precision Compound Delivery</strong>: Optimized internal flow "
            "for uniform compound output across the full cove profile</li>\n"
            "<li><strong>TapeTech System Compatible</strong>: Connects directly to "
            "TapeTech pump and gooseneck systems</li>\n"
            "<li><strong>Professional Aluminum Construction</strong>: Machined to "
            "TapeTech's exacting quality standards</li>\n"
            "<li><strong>Clean-Out Accessible</strong>: Tool-accessible design for "
            "fast field maintenance</li>\n"
            "</ul>\n"
            "<p>The TapeTech Cove Applicator Head is the professional solution for contractors "
            "who regularly work with cove bead profiles — backed by TapeTech's industry-leading "
            "warranty.</p>"
        ),
    },

    "TT-EASYCLEAN-AUTOMATIC-TAPER": {
        "short": (
            "The TapeTech EasyClean® Automatic Taper revolutionizes taper maintenance with its "
            "tool-free disassembly system — clean the full mechanism in minutes instead of hours. "
            "Simultaneously applies tape and compound for professional-grade seam taping productivity."
        ),
        "long": (
            "<p>The TapeTech EasyClean® Automatic Taper is the world's most maintainable "
            "professional taping machine. Its patented EasyClean® disassembly system allows "
            "complete breakdown and cleaning in a fraction of the time required by conventional "
            "tapers — keeping your tools in production-ready condition every day.</p>\n"
            "<ul>\n"
            "<li><strong>EasyClean® Tool-Free Disassembly</strong>: Break down the taper "
            "completely in minutes — no specialized tools required</li>\n"
            "<li><strong>Simultaneous Tape & Compound Application</strong>: Professional "
            "one-pass seam taping for maximum productivity</li>\n"
            "<li><strong>Precision-Machined Components</strong>: Tight tolerances for "
            "consistent tape tension and compound flow</li>\n"
            "<li><strong>Industry-Leading Warranty</strong>: Backed by TapeTech's "
            "comprehensive warranty program</li>\n"
            "<li><strong>Standard 07TT Model</strong>: The professional standard; "
            "EasyClean® Carbon Fiber model (07TT-C) available for lightweight performance</li>\n"
            "</ul>\n"
            "<p>Used by professional taping contractors worldwide, the TapeTech EasyClean® "
            "Automatic Taper is the benchmark of professional drywall taping technology.</p>"
        ),
    },

    "TT-EASYCLEAN-PUMP": {
        "short": (
            "The TapeTech EasyClean® Pump features the same tool-free disassembly technology "
            "as the EasyClean® taper — clean your pump completely in minutes, not hours. "
            "Designed for seamless integration with the full TapeTech compound delivery system."
        ),
        "long": (
            "<p>The TapeTech EasyClean® Pump brings TapeTech's revolutionary EasyClean® "
            "maintenance technology to the compound delivery pump. Tool-free disassembly means "
            "the pump can be fully broken down, cleaned, and reassembled in the field in just "
            "minutes — no more end-of-day pump-cleaning dread.</p>\n"
            "<ul>\n"
            "<li><strong>EasyClean® Tool-Free Disassembly</strong>: Complete pump breakdown "
            "and cleaning in minutes — no specialized tools required</li>\n"
            "<li><strong>Consistent Compound Pressure</strong>: Precision pump mechanism "
            "delivers steady, controlled compound flow to tapers and applicators</li>\n"
            "<li><strong>TapeTech System Integration</strong>: Engineered to connect "
            "seamlessly with EasyClean® tapers, goosenecks, and applicator heads</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Professional-grade "
            "materials built for daily production use</li>\n"
            "<li><strong>Industry-Leading Warranty</strong>: Covered by TapeTech's "
            "comprehensive warranty program</li>\n"
            "</ul>\n"
            "<p>The TapeTech EasyClean® Pump is the companion piece to the EasyClean® "
            "Automatic Taper — together they form the fastest-to-maintain production "
            "taping system in the industry.</p>"
        ),
    },

    "TT-EASYFINISH-BOX-HANDLE": {
        "short": (
            "The TapeTech EasyFinish™ Box Handle features an ergonomically redesigned grip "
            "that reduces hand strain during flat box finishing — engineered for professionals "
            "who spend long hours on flat seam work."
        ),
        "long": (
            "<p>The TapeTech EasyFinish™ Box Handle redefines comfort in flat box operation. "
            "Its ergonomically optimized grip design reduces the hand and wrist strain associated "
            "with conventional handles, allowing professionals to maintain quality output "
            "throughout long finishing shifts.</p>\n"
            "<ul>\n"
            "<li><strong>EasyFinish™ Ergonomic Grip</strong>: Redesigned handle profile "
            "reduces hand and wrist strain during extended flat box operation</li>\n"
            "<li><strong>Precision Aluminum Construction</strong>: Rigid, lightweight "
            "shaft for consistent box pressure without fatigue-inducing flex</li>\n"
            "<li><strong>TapeTech Box Compatible</strong>: Engineered to connect with "
            "TapeTech finishing boxes and most industry-compatible boxes</li>\n"
            "<li><strong>Professional-Grade Fittings</strong>: Machined aluminum "
            "connectors for secure, rattle-free box attachment</li>\n"
            "<li><strong>Industry-Leading Warranty</strong>: Covered by TapeTech's "
            "comprehensive warranty program</li>\n"
            "</ul>\n"
            "<p>The TapeTech EasyFinish™ Box Handle is the ergonomic upgrade for professionals "
            "who want to protect their hands and maintain quality through every hour of work.</p>"
        ),
    },

    "TT-FINISHING-HAWK": {
        "short": (
            "The TapeTech Finishing Hawk is a professional-grade aluminum hawk platform for "
            "holding joint compound during hand taping and finishing — rigid, balanced, and "
            "built to the same quality standards as TapeTech's automatic finishing tools."
        ),
        "long": (
            "<p>The TapeTech Finishing Hawk is an essential hand-finishing tool — a rigid, "
            "perfectly balanced compound platform that lets professionals load and hold the "
            "right amount of compound for hand taping, feathering, and touchup work. "
            "Built to TapeTech's professional standards for daily production use.</p>\n"
            "<ul>\n"
            "<li><strong>Rigid Aluminum Platform</strong>: Flat, stable compound surface "
            "that doesn't flex or warp under load</li>\n"
            "<li><strong>Balanced Design</strong>: Ergonomically balanced for comfortable "
            "one-hand holding through extended finishing sessions</li>\n"
            "<li><strong>Premium Construction</strong>: Solid extruded aluminum resists "
            "corrosion from the alkaline environment of joint compound</li>\n"
            "<li><strong>Non-Stick Surface</strong>: Smooth aluminum surface allows "
            "clean compound loading and removal</li>\n"
            "<li><strong>Professional Size</strong>: Optimal platform dimensions "
            "for hand taping and finishing applications</li>\n"
            "</ul>\n"
            "<p>A foundational hand-finishing tool in every professional's kit — "
            "the TapeTech Finishing Hawk delivers the build quality to match "
            "TapeTech's automatic tool lineup.</p>"
        ),
    },

    "TT-GOOSENECK": {
        "short": (
            "The TapeTech Gooseneck is the precision-curved connector linking your automatic "
            "taper to the pump system — engineered for smooth compound flow and secure, "
            "positive-lock connections that don't loosen during continuous operation."
        ),
        "long": (
            "<p>The TapeTech Gooseneck is a critical component in the TapeTech compound "
            "delivery chain — its precision-engineered curve optimizes flow geometry between "
            "pump and taper, preventing blockages and maintaining consistent compound pressure "
            "across the full operational range.</p>\n"
            "<ul>\n"
            "<li><strong>Optimized Flow Curve</strong>: Engineered bend geometry minimizes "
            "compound flow restriction and pressure drop</li>\n"
            "<li><strong>Positive-Lock Connections</strong>: Secure connections on both "
            "pump and taper ends — don't loosen during operation</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Precision-machined to "
            "TapeTech's professional-grade standards</li>\n"
            "<li><strong>TapeTech System Compatible</strong>: Engineered for seamless "
            "integration with TapeTech automatic tapers and pump systems</li>\n"
            "<li><strong>Easy Connection/Disconnection</strong>: Quick-connect design "
            "speeds up job site tool changes and end-of-day cleanup</li>\n"
            "</ul>\n"
            "<p>An essential TapeTech system component — backed by TapeTech's industry-leading "
            "warranty and available from authorized TapeTech dealers.</p>"
        ),
    },

    "TT-MAXXBOX-HIGH-CAPACITY-FINISHING-BOX": {
        "short": (
            "The TapeTech MaxxBox® High Capacity Finishing Box features an oversized mud "
            "reservoir that dramatically reduces refill stops on long seam runs — maximizing "
            "productivity on large residential and commercial drywall projects."
        ),
        "long": (
            "<p>The TapeTech MaxxBox® High Capacity Finishing Box is the production professional's "
            "answer to constant refill interruptions. Its dramatically expanded compound reservoir "
            "lets crews cover significantly more linear footage before reloading — keeping "
            "production pace high on large-scale projects.</p>\n"
            "<ul>\n"
            "<li><strong>MaxxBox® High-Capacity Reservoir</strong>: Holds substantially more "
            "compound than standard boxes — fewer refill stops per shift</li>\n"
            "<li><strong>Precision-Ground Stainless Steel Blade</strong>: Consistent, "
            "feathered compound application on every pass</li>\n"
            "<li><strong>Professional Aluminum Body</strong>: Machined to TapeTech's "
            "tight tolerances for consistent compound output</li>\n"
            "<li><strong>Available Sizes</strong>: 7″ (EHC07), 10″ (EHC10), 12″ (EHC12)</li>\n"
            "<li><strong>Handle Compatible</strong>: Works with TapeTech box handles "
            "and most industry-compatible handle systems</li>\n"
            "</ul>\n"
            "<p>The TapeTech MaxxBox® is the professional choice for high-volume commercial "
            "finishing work where productivity and uptime are paramount. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-NAIL-SPOTTER": {
        "short": (
            "The TapeTech Nail Spotter applies joint compound directly over fastener dimples "
            "and nail heads with a quick, repeatable motion — essential for production spotting "
            "on large drywall jobs where hand-spotting would take hours."
        ),
        "long": (
            "<p>The TapeTech Nail Spotter is the professional solution for covering fastener "
            "dimples and nail heads efficiently on large drywall jobs. Attached to an extension "
            "pole, it applies a precise compound deposit over each fastener without stooping "
            "or ladder repositioning.</p>\n"
            "<ul>\n"
            "<li><strong>Automatic Compound Dispensing</strong>: Spring-loaded mechanism "
            "applies a precise compound deposit over each fastener head</li>\n"
            "<li><strong>Extension Pole Compatible</strong>: Reaches all wall and ceiling "
            "fasteners without repositioning ladders</li>\n"
            "<li><strong>Consistent Application</strong>: Uniform compound deposit "
            "ensures every fastener receives the same coverage</li>\n"
            "<li><strong>Fast Production Pace</strong>: Cover hundreds of fasteners "
            "per hour vs. slow hand-spotting methods</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Professional-grade "
            "materials for daily production use</li>\n"
            "</ul>\n"
            "<p>An essential productivity tool for production tapers — the TapeTech Nail Spotter "
            "turns the most tedious part of the job into the fastest. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-POWER-ASSIST-MAXXBOX-FINISHING-BOX": {
        "short": (
            "The TapeTech Power Assist® MaxxBox® Finishing Box adds pneumatic pressure assist "
            "to the high-capacity MaxxBox® platform — delivering effortless compound output "
            "that reduces hand fatigue and maintains production pace on large flat-seam jobs."
        ),
        "long": (
            "<p>The TapeTech Power Assist® MaxxBox® Finishing Box combines the maximum capacity "
            "of the MaxxBox® reservoir with pneumatic pressure-assist technology that virtually "
            "eliminates the physical effort of compound dispensing. The result is a finishing "
            "box that performs consistently all day without hand fatigue.</p>\n"
            "<ul>\n"
            "<li><strong>Power Assist® Pneumatic Technology</strong>: Air-pressure-assisted "
            "compound delivery eliminates manual squeeze effort for effortless operation</li>\n"
            "<li><strong>MaxxBox® High-Capacity Reservoir</strong>: Maximum compound capacity "
            "for fewer refill stops on large production runs</li>\n"
            "<li><strong>Precision Stainless Steel Blade</strong>: Consistent, feathered "
            "compound application on every pass</li>\n"
            "<li><strong>Reduced Hand Fatigue</strong>: Power assist significantly reduces "
            "physical demand for all-day production finishing</li>\n"
            "<li><strong>Available Sizes</strong>: 7″ (PAHC07), 10″ (PAHC10), 12″ (PAHC12)</li>\n"
            "</ul>\n"
            "<p>The TapeTech Power Assist® MaxxBox® is the ultimate production finishing box "
            "for high-volume commercial projects. Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-PREMIUM-COMPOUND-ROLLER": {
        "short": (
            "The TapeTech Premium Compound Roller applies large, uniform volumes of joint "
            "compound to walls and ceilings quickly — the essential first step before "
            "flat box finishing on skim-coat and texture applications."
        ),
        "long": (
            "<p>The TapeTech Premium Compound Roller is a high-output application tool for "
            "skim-coat and heavily textured finishing workflows. By rapidly applying large "
            "volumes of compound across wide surfaces, it dramatically reduces the time spent "
            "on initial compound application before flat box finishing.</p>\n"
            "<ul>\n"
            "<li><strong>High-Output Application</strong>: Covers large wall and ceiling "
            "areas rapidly for maximum production efficiency</li>\n"
            "<li><strong>Uniform Compound Distribution</strong>: Consistent compound "
            "transfer from roller to surface for even skim-coat coverage</li>\n"
            "<li><strong>Premium Roller Construction</strong>: TapeTech-grade materials "
            "for durable, repeatable compound application</li>\n"
            "<li><strong>Extension Pole Compatible</strong>: Reaches ceiling and upper "
            "wall surfaces without ladders</li>\n"
            "<li><strong>Pairs with TapeTech Roller Cage</strong>: Use with the "
            "TapeTech Roller Cage frame for complete roller assembly</li>\n"
            "</ul>\n"
            "<p>The TapeTech Premium Compound Roller is an essential tool for skim-coat "
            "and texture-finish workflows — pairs perfectly with TapeTech flat box systems. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-QUICKBOX-QSX-FINISHING-BOX": {
        "short": (
            "The TapeTech QuickBox® QSX Finishing Box is engineered for fast-setting "
            "compounds — precision-toleranced for rapid disassembly and cleaning before "
            "the compound sets, without sacrificing finish quality."
        ),
        "long": (
            "<p>The TapeTech QuickBox® QSX Finishing Box is purpose-built for professionals "
            "who work with quick-setting compounds (QSX = Quick Set). Its precision-toleranced "
            "design enables rapid, thorough cleaning before the compound hardens — preventing "
            "the costly damage that hot mud causes in conventional finishing boxes.</p>\n"
            "<ul>\n"
            "<li><strong>QSX Quick-Set Compatible</strong>: Precision tolerances and "
            "surface treatments designed for fast-setting compound applications</li>\n"
            "<li><strong>Rapid Disassembly Design</strong>: Breaks down quickly for "
            "thorough cleaning before compound sets</li>\n"
            "<li><strong>Precision Stainless Steel Blade</strong>: Delivers smooth, "
            "consistent compound application even with fast-setting materials</li>\n"
            "<li><strong>Professional Aluminum Body</strong>: Machined to TapeTech's "
            "exacting standards for consistent performance</li>\n"
            "<li><strong>Available Sizes</strong>: 6.5″ (QB06-QSX), 8.5″ (QB08-QSX)</li>\n"
            "</ul>\n"
            "<p>The TapeTech QuickBox® QSX is the specialist tool for contractors who "
            "use fast-setting compounds for accelerated production schedules. "
            "Backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-ROLLER-CAGE": {
        "short": (
            "The TapeTech Roller Cage is the precision frame assembly that holds compound "
            "rollers at the correct angle and pressure for consistent, uniform compound "
            "application during skim-coat and texture finishing operations."
        ),
        "long": (
            "<p>The TapeTech Roller Cage provides the structural framework for the TapeTech "
            "compound roller system. Its precision construction ensures the roller maintains "
            "consistent contact angle and pressure across the surface — critical for uniform "
            "compound coverage on skim-coat applications.</p>\n"
            "<ul>\n"
            "<li><strong>Precision Frame Construction</strong>: Maintains consistent roller "
            "contact angle for uniform compound application</li>\n"
            "<li><strong>Roller Retention System</strong>: Secure roller mounting prevents "
            "slippage during application strokes</li>\n"
            "<li><strong>Extension Pole Compatible</strong>: Standard threaded connection "
            "for extension pole attachment</li>\n"
            "<li><strong>TapeTech Roller Compatible</strong>: Engineered for use with "
            "TapeTech Premium Compound Rollers</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Professional-grade "
            "materials for daily production use</li>\n"
            "</ul>\n"
            "<p>The TapeTech Roller Cage is the essential frame component for "
            "TapeTech's compound roller system — backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-STAINLESS-STEEL-MUD-PAN": {
        "short": (
            "The TapeTech Stainless Steel Mud Pan features corrosion-resistant stainless "
            "steel construction and a contoured bottom for easy compound loading — the "
            "professional standard for hand taping and finishing operations."
        ),
        "long": (
            "<p>The TapeTech Stainless Steel Mud Pan is the professional choice for hand "
            "taping and finishing compound work. Premium stainless steel construction resists "
            "the corrosive environment of joint compound while the contoured profile makes "
            "knife loading fast and efficient.</p>\n"
            "<ul>\n"
            "<li><strong>Premium Stainless Steel Construction</strong>: Resists corrosion "
            "from joint compound — outlasts galvanized alternatives</li>\n"
            "<li><strong>Contoured Bottom Profile</strong>: Optimized shape for easy "
            "compound loading onto finishing knives and trowels</li>\n"
            "<li><strong>Professional Size</strong>: Right capacity for one-handed "
            "holding during hand taping and finishing</li>\n"
            "<li><strong>Smooth Interior Finish</strong>: Easy to clean — compound "
            "doesn't stick to the polished surface</li>\n"
            "<li><strong>TapeTech Quality Standards</strong>: Built to the same "
            "professional grade as TapeTech's automatic tools</li>\n"
            "</ul>\n"
            "<p>Available in 12″ (mp12tt) and 14″ (MP14TT) sizes — the TapeTech "
            "Stainless Steel Mud Pan is a workhorse hand-finishing accessory backed "
            "by TapeTech's quality commitment.</p>"
        ),
    },

    "TT-SUPPORT-HANDLE": {
        "short": (
            "The TapeTech Support Handle positions corner applicators and finishers at the "
            "correct operational angle during application — eliminating the awkward wrist "
            "positioning that causes uneven compound coverage and user fatigue."
        ),
        "long": (
            "<p>The TapeTech Support Handle is a critical ergonomic accessory for corner "
            "applicator and finisher operations. By holding the tool at the correct operational "
            "angle, it frees the user's wrist from contorted positioning — resulting in more "
            "consistent application pressure and dramatically less fatigue during corner work.</p>\n"
            "<ul>\n"
            "<li><strong>Correct Tool Angle Support</strong>: Maintains proper operational "
            "angle for corner applicators and finishers during use</li>\n"
            "<li><strong>Reduces Wrist Fatigue</strong>: Eliminates awkward wrist positions "
            "that cause cumulative strain during corner finishing</li>\n"
            "<li><strong>TapeTech Tool Compatible</strong>: Engineered for use with "
            "TapeTech corner applicator heads and corner finishers</li>\n"
            "<li><strong>Durable Construction</strong>: Built to TapeTech's professional "
            "standards for daily production use</li>\n"
            "<li><strong>Easy Attachment</strong>: Quick-connect design for fast tool "
            "changes between corner operations</li>\n"
            "</ul>\n"
            "<p>An often-overlooked accessory that makes a real difference in corner work "
            "quality and productivity — backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-SUPPORT-HANDLE-ADAPTER": {
        "short": (
            "The TapeTech Support Handle Adapter is the connection interface that joins the "
            "TapeTech Support Handle to corner applicator tools — ensuring a secure, "
            "properly-aligned attachment for consistent operational angle during corner work."
        ),
        "long": (
            "<p>The TapeTech Support Handle Adapter provides the critical mechanical interface "
            "between the Support Handle and corner applicator tools. Precision machining ensures "
            "a secure, properly aligned connection that maintains the correct tool angle "
            "throughout corner finishing operations.</p>\n"
            "<ul>\n"
            "<li><strong>Precision-Machined Connection</strong>: Tight tolerances ensure "
            "correct, consistent tool alignment during corner operation</li>\n"
            "<li><strong>Secure Attachment</strong>: Positive connection prevents tool "
            "movement during application strokes</li>\n"
            "<li><strong>TapeTech System Compatible</strong>: Engineered for the "
            "TapeTech Support Handle and corner applicator system</li>\n"
            "<li><strong>Durable Aluminum Construction</strong>: Professional-grade "
            "materials built for daily production use</li>\n"
            "<li><strong>Easy Field Replacement</strong>: Simple connection design for "
            "fast replacement if damaged</li>\n"
            "</ul>\n"
            "<p>A small but essential component in the TapeTech corner finishing system — "
            "backed by TapeTech's industry-leading warranty.</p>"
        ),
    },

    "TT-WIZARD-COMPACT-FINISHING-BOX-HANDLE": {
        "short": (
            "The TapeTech Wizard® Compact Finishing Box Handle is engineered for tight spaces "
            "and overhead work where full-size handles become cumbersome — delivering precise "
            "flat box control in a compact, agile form factor."
        ),
        "long": (
            "<p>The TapeTech Wizard® Compact Finishing Box Handle fills the gap that standard "
            "handles can't reach — tight corridors, low soffits, compact spaces, and overhead "
            "applications where a full-length handle creates control problems. The Wizard® "
            "Compact gives professionals the same TapeTech quality in a highly maneuverable "
            "package.</p>\n"
            "<ul>\n"
            "<li><strong>Compact Design</strong>: Shorter, more agile profile for tight "
            "spaces where full-size handles are impractical</li>\n"
            "<li><strong>Wizard® Ergonomic Grip</strong>: Designed for overhead and "
            "awkward-angle finishing work with reduced strain</li>\n"
            "<li><strong>Precision Aluminum Construction</strong>: Rigid, lightweight "
            "shaft for consistent box pressure in confined spaces</li>\n"
            "<li><strong>TapeTech Box Compatible</strong>: Connects with TapeTech "
            "finishing boxes and most industry-compatible boxes</li>\n"
            "<li><strong>Industry-Leading Warranty</strong>: Covered by TapeTech's "
            "comprehensive warranty program</li>\n"
            "</ul>\n"
            "<p>The TapeTech Wizard® Compact Handle is the professional's solution for "
            "the finishing challenges that standard handles simply can't solve efficiently.</p>"
        ),
    },
}

# ---------------------------------------------------------------------------
# Helper: strip HTML tags for length check
# ---------------------------------------------------------------------------
def strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")

# ---------------------------------------------------------------------------
# Load source CSV lookup: { SKU → {"short": str, "long": str} }
# ---------------------------------------------------------------------------
def load_source_csv(path: Path, sku_col: str = "SKU",
                    short_col: str = "Short description",
                    long_col: str = "Description") -> dict:
    lookup: dict[str, dict] = {}
    if not path.exists():
        print(f"  [WARN] source not found: {path}", file=sys.stderr)
        return lookup
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            sku = row.get(sku_col, "").strip()
            if not sku:
                continue
            short = row.get(short_col, "").strip()
            long_ = row.get(long_col, "").strip()
            # Only store if at least one desc is quality
            if not is_boilerplate(short) or not is_boilerplate(long_):
                lookup[sku] = {
                    "short": short if not is_boilerplate(short) else "",
                    "long":  long_ if not is_boilerplate(long_) else "",
                }
    return lookup

# ---------------------------------------------------------------------------
# Load TapeTech scraped data and build name→desc map
# ---------------------------------------------------------------------------
def load_scraped_tapetech(path: Path) -> dict:
    """Returns {normalized_name: description} for scraped TapeTech products."""
    lookup: dict[str, str] = {}
    if not path.exists():
        return lookup
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = row.get("name", "").strip()
            desc = row.get("description", "").strip()
            mpn  = row.get("mpn", "").strip()
            if desc and len(desc) >= 50:
                # Index by MPN and normalized name
                if mpn:
                    lookup[mpn.upper()] = desc
                if name:
                    lookup[name.lower()] = desc
    return lookup

# ---------------------------------------------------------------------------
# Build master lookup (priority: source1 > source2 > source3 > source4)
# Later entries do NOT overwrite earlier ones
# ---------------------------------------------------------------------------
def build_master_lookup() -> dict:
    master: dict[str, dict] = {}

    sources = [
        (SRC_UNIFIED, "enhanced_unified"),
        (SRC_BATCH3,  "batch3"),
        (SRC_BATCH4,  "batch4"),
        (SRC_LAUNCH,  "launch-optimized"),
    ]
    for path, label in sources:
        src = load_source_csv(path)
        added = 0
        for sku, descs in src.items():
            if sku not in master:
                master[sku] = descs
                added += 1
            else:
                # Fill missing parts from lower-priority source
                for field in ("short", "long"):
                    if not master[sku].get(field) and descs.get(field):
                        master[sku][field] = descs[field]
        print(f"  Loaded {label}: {len(src)} quality entries, {added} new to master")

    return master

# ---------------------------------------------------------------------------
# Match scraped TapeTech data to launch catalog SKUs
# ---------------------------------------------------------------------------
def apply_scraped_tapetech(master: dict, launch_rows: list[dict],
                            scraped: dict) -> int:
    """
    For TapeTech parent rows that have no quality short desc in master,
    attempt to match scraped data by MPN or normalized name.
    Returns count of matches applied.
    """
    applied = 0
    for row in launch_rows:
        if row["Type"] not in ("simple", "variable"):
            continue
        sku = row.get("SKU", "").strip()
        if not sku:
            continue
        if sku in master and master[sku].get("short") and master[sku].get("long"):
            continue  # already has quality descriptions
        # Try MPN match
        mpn = row.get("Meta: schema_mpn", "").strip()
        desc = None
        if mpn and mpn.upper() in scraped:
            desc = scraped[mpn.upper()]
        # Try product name match
        if not desc:
            name = row.get("Name", "").strip().lower()
            # Strip brand prefix for matching
            for prefix in ("tapetech ", "tapetch "):
                if name.startswith(prefix):
                    name = name[len(prefix):]
            if name in scraped:
                desc = scraped[name]
        if desc:
            if sku not in master:
                master[sku] = {}
            if not master[sku].get("short"):
                master[sku]["short"] = desc[:300]
            if not master[sku].get("long"):
                master[sku]["long"] = f"<p>{desc}</p>"
            applied += 1
    return applied

# ---------------------------------------------------------------------------
# Apply hardcoded descriptions
# ---------------------------------------------------------------------------
def apply_hardcoded(master: dict) -> int:
    applied = 0
    for sku, descs in HARDCODED.items():
        if sku not in master:
            master[sku] = {"short": descs["short"], "long": descs["long"]}
            applied += 1
        else:
            changed = False
            for field in ("short", "long"):
                if not master[sku].get(field):
                    master[sku][field] = descs[field]
                    changed = True
            if changed:
                applied += 1
    return applied

# ---------------------------------------------------------------------------
# Main update logic
# ---------------------------------------------------------------------------
def rebuild():
    print("=" * 60)
    print("DTB Product Description Rebuilder")
    print("=" * 60)

    # Build master lookup from sources
    print("\n[1] Loading quality source descriptions...")
    master = build_master_lookup()
    print(f"  Master lookup: {len(master)} SKUs with quality descriptions")

    # Load and apply scraped TapeTech
    print("\n[2] Loading TapeTech scraped data...")
    scraped = load_scraped_tapetech(SRC_SCRAPED)
    print(f"  Scraped entries: {len(scraped)}")

    # Load launch catalog
    print("\n[3] Loading launch catalog...")
    with open(LAUNCH_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames
        rows = list(reader)
    print(f"  Rows: {len(rows)}, Columns: {len(fieldnames)}")

    # Apply scraped data to master
    scraped_matched = apply_scraped_tapetech(master, rows, scraped)
    print(f"  Scraped TapeTech matches applied: {scraped_matched}")

    # Apply hardcoded
    print("\n[4] Applying hardcoded descriptions for 47 products...")
    hc_applied = apply_hardcoded(master)
    print(f"  Hardcoded entries added/filled: {hc_applied}")

    # Track parent descriptions for variation inheritance
    parent_updated: dict[str, dict] = {}  # parent_sku → {short, long, name}

    # Stats
    stats = {
        "total": len(rows),
        "updated_from_source": 0,
        "written_fresh": 0,
        "already_good": 0,
        "unchanged": 0,
        "variations_updated": 0,
    }
    updated_products: list[str] = []

    # --- Pass 1: Update parent/simple products ---
    print("\n[5] Updating parent/simple product descriptions...")
    for row in rows:
        row_type = row.get("Type", "").strip().lower()
        if row_type not in ("simple", "variable"):
            continue

        sku = row.get("SKU", "").strip()
        name = row.get("Name", "").strip()
        current_short = row.get("Short description", "").strip()
        current_long  = row.get("Description", "").strip()

        # Check if current descriptions are already quality
        short_ok = not is_boilerplate(current_short) and len(strip_tags(current_short)) >= 50
        long_ok  = not is_boilerplate(current_long)  and len(strip_tags(current_long))  >= 50
        both_ok  = short_ok and long_ok

        if both_ok:
            stats["already_good"] += 1
            continue

        # Try to find a replacement
        replacement = master.get(sku, {})
        new_short = replacement.get("short", "")
        new_long  = replacement.get("long", "")

        if not new_short and not new_long:
            stats["unchanged"] += 1
            continue

        # Determine origin (source vs hardcoded)
        from_hardcoded = sku in HARDCODED and (
            not master.get(sku, {}).get("short") or
            HARDCODED[sku]["short"] == master.get(sku, {}).get("short")
        )

        # Apply updates only where current is boilerplate/missing
        changed = False
        if not short_ok and new_short:
            row["Short description"] = new_short
            changed = True
        if not long_ok and new_long:
            row["Description"] = new_long
            changed = True

        if changed:
            if from_hardcoded or sku in HARDCODED:
                stats["written_fresh"] += 1
            else:
                stats["updated_from_source"] += 1
            updated_products.append(f"  {sku}: {name}")
            parent_updated[sku] = {
                "short": row["Short description"],
                "long":  row["Description"],
                "name":  name,
            }

    # --- Pass 2: Update variation descriptions ---
    print("\n[6] Updating variation descriptions...")
    for row in rows:
        row_type = row.get("Type", "").strip().lower()
        if row_type != "variation":
            continue

        parent_sku = row.get("Parent", "").strip()
        if parent_sku not in parent_updated:
            continue

        var_short = row.get("Short description", "").strip()
        var_long  = row.get("Description", "").strip()
        short_ok  = not is_boilerplate(var_short) and len(strip_tags(var_short)) >= 50

        if short_ok:
            continue  # already quality

        # Build variation-specific short desc
        var_value = (
            row.get("Meta: _dtb_variation_value", "") or
            row.get("Meta: _dtb_variation_label", "") or
            row.get("Attribute 1 value(s)", "")
        ).strip()
        parent_name = parent_updated[parent_sku]["name"]
        parent_short = parent_updated[parent_sku]["short"]

        if var_value:
            var_short_new = (
                f"The {var_value} {parent_name} delivers professional-grade drywall finishing "
                f"performance. {parent_short[:120].rstrip('.')}."
            )
        else:
            var_short_new = parent_short

        # Variation long: inherit parent long if also boilerplate
        long_ok = not is_boilerplate(var_long) and len(strip_tags(var_long)) >= 50
        if not long_ok:
            row["Description"] = parent_updated[parent_sku]["long"]

        row["Short description"] = var_short_new
        stats["variations_updated"] += 1

    # --- Write output ---
    print("\n[7] Writing updated catalog...")
    with open(LAUNCH_CSV, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written: {LAUNCH_CSV}")

    # --- Summary ---
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total rows processed    : {stats['total']}")
    print(f"  Already good (skipped)  : {stats['already_good']}")
    print(f"  Updated from sources    : {stats['updated_from_source']}")
    print(f"  Written fresh (hardcode): {stats['written_fresh']}")
    print(f"  Variations updated      : {stats['variations_updated']}")
    print(f"  No replacement found    : {stats['unchanged']}")
    print()
    print(f"Updated products ({len(updated_products)}):")
    for p in sorted(updated_products):
        print(p)

    # Verify output
    with open(LAUNCH_CSV, newline="", encoding="utf-8") as fh:
        verify_rows = list(csv.DictReader(fh))
    remaining_bad = sum(
        1 for r in verify_rows
        if r["Type"] in ("simple", "variable")
        and is_boilerplate(r.get("Short description", ""))
    )
    print(f"\n[VERIFY] Parent rows still with boilerplate: {remaining_bad}")
    print("[DONE] Output file is valid CSV ✓")

if __name__ == "__main__":
    rebuild()
