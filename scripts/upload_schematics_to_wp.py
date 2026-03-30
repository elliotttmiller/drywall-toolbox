#!/usr/bin/env python3
"""
upload_schematics_to_wp.py
──────────────────────────
Batch-uploads WebP schematic images from public/brands/*/Schematics/ to the
WordPress Media Library, setting the three custom meta fields required by the
DTB Schematics Media API plugin (dtb-schematics-api.php):

    _dtb_schematic_id    — schematic ID matching Parts.jsx schematics array
    _dtb_schematic_page  — page number ("1", "2", …) or "0" for preview images
    _dtb_schematic_type  — "diagram" or "preview"

Dependencies:
    pip install requests
    pip install Pillow   # only needed when --auto-convert is used

Configuration (create a .env or export environment variables before running):
    WP_BASE_URL      WordPress URL, e.g. https://drywalltoolbox.com/wp
    WP_AUTH_USER     WordPress username with Application Password enabled
    WP_AUTH_PASS     Application Password (Manage → Application Passwords in profile)

Usage (run from repo root):
    export WP_BASE_URL=https://drywalltoolbox.com/wp
    export WP_AUTH_USER=admin
    export WP_AUTH_PASS="xxxx xxxx xxxx xxxx xxxx xxxx"
    python scripts/upload_schematics_to_wp.py

    # Dry-run (print upload plan without uploading):
    python scripts/upload_schematics_to_wp.py --dry-run

    # Re-upload all, overwriting existing media by slug:
    python scripts/upload_schematics_to_wp.py --overwrite

    # Auto-convert PNG/JPG → WebP on the fly when the .webp file is missing.
    # Useful after restoring backups/ or when running the first-time upload.
    # Falls back to PNG/JPG originals at the same path (sans extension):
    python scripts/upload_schematics_to_wp.py --auto-convert

    # Point to a backup directory that mirrors the public/brands/ tree:
    python scripts/upload_schematics_to_wp.py --auto-convert \\
        --source-root backups/schematics_non_webp_20260330-051523

Naming convention:
    Diagram images are uploaded with slug: dtb-schem-{schematic-id}-p{page}
    Preview images are uploaded with slug: dtb-schem-{schematic-id}-preview

    If a media item with that slug already exists, the upload is skipped unless
    --overwrite is given (which deletes and re-uploads the item).
"""

import argparse
import io
import os
import sys
import tempfile
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("ERROR: requests is required.  Install it with:  pip install requests\n")

# ─── Schematic manifest ───────────────────────────────────────────────────────
# Maps each schematic ID to the file paths of its diagram pages and preview.
# Keys must match the `id` field in Parts.jsx schematics array.
# Values: { "pages": { page_number: relative_path }, "preview": relative_path }
# Paths are relative to repo root.

SCHEMATICS_MANIFEST = {
    "columbia-matrix": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/Matrix_Handle-enhanced.webp",
            2: "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Head/Matrix_Head-enhanced-enhanced.webp",
            3: "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Lever/Matrix_Lever-1-enhanced.webp",
            4: "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/Pinchbox/Matrix_Pinchbox-1-enhanced.webp",
            5: "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/ExtensionHousing/Extension_Housing_Schematic-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Handles/MatrixBoxHandle/BoxHandle/columbia_matrix_box_handle.webp",
    },
    "columbia-predator-taper": {
        "pages": {
            1: "public/brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Body/predator_taper_body.webp",
            2: "public/brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/Head/predator_taper_head.webp",
        },
        "preview": "public/brands/Columbia/Schematics/AutomaticTapers/PredatorTaper/predator_taper.webp",
    },
    "tapetech-extendable-support-handle": {
        "pages": {
            1: "public/brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_SCH.webp",
        },
        "preview": "public/brands/TapeTech/Schematics/ExtendableSupportHandle/XHTT_02-300x300.webp",
    },
    "columbia-2-way-internal-corner": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/2_Way_Internal_Corner_Applicator-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Applicators/TwoWayInternalCorner/Two-Way_Internal_Corner_Applicator.webp",
    },
    "columbia-external-corner-applicator": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Applicators/ExternalCorner/8_Wheel_External_Corner_Applicator-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Applicators/ExternalCorner/External_90_Aplicator_CEXT90_-_FRONT.webp",
    },
    "columbia-inside-corner-applicator": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Applicators/InsideCornerApplicator/2Wheel/ICA1-2-2015.webp",
            2: "public/brands/Columbia/Schematics/Applicators/InsideCornerApplicator/4Wheel/ICA1-4-2015.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Applicators/InsideCornerApplicator/Inside_Corner_Applicator_4_Wheels_ICA1-4_-_BACK.webp",
    },
    "columbia-standard-outside-corner-roller": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/OutsideCornerRollers-2016-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerRollers/StandardOutsideCornerRoller/External_90_Aplicator.webp",
    },
    "columbia-inside-corner-roller": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/InsideCornerRoller-2014_1_-enhanced-squared.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerRollers/InsideCornerRoller/cornerroller.webp",
    },
    "columbia-throttle-box": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerBoxes/ThrottleBox/CORNER-BOX-SCHEMATIC-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerBoxes/ThrottleBox/throttlebox8small.webp",
    },
    "columbia-automatic-flat-box": {
        "pages": {
            1: "public/brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/AUTO-BOX-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/FinishingBoxes/AutomaticFlatBox/automaticbox-1.webp",
    },
    "columbia-flat-box": {
        "pages": {
            1: "public/brands/Columbia/Schematics/FinishingBoxes/FlatBox/FLAT-BOX-HINGED-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/FinishingBoxes/FlatBox/2023flatbox.webp",
    },
    "columbia-fat-boy-box": {
        "pages": {
            1: "public/brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/fat_boy_box.webp",
        },
        "preview": "public/brands/Columbia/Schematics/FinishingBoxes/FatBoyBox/InsideTrackBoxFrontSmall.webp",
    },
    "columbia-angle-head": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Angleheads/AngleHead/AngleHead-2014-3-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Angleheads/AngleHead/angleheadbacksquare.webp",
    },
    "columbia-gooseneck-adapter": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Pumps/GooseneckAdapter/Gooseneck-1-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Pumps/GooseneckAdapter/goosenecksquare.webp",
    },
    "columbia-mud-pump": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.webp",
            2: "public/brands/Columbia/Schematics/Pumps/MudPump/MUD-PUMP-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Pumps/MudPump/TallBoyMudpumps.webp",
    },
    "columbia-tall-boy-mud-pump": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SUB-ASSEMBLIES-2022-enhanced.webp",
            2: "public/brands/Columbia/Schematics/Pumps/TallBoyMudPump/TALL-BOY-MUD-PUMP-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Pumps/TallBoyMudPump/TallBoyPump.webp",
    },
    "columbia-nailspotter": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Nailspotters/Nailspotter/NAIL-SPOTTER-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Nailspotters/Nailspotter/2023Nailspotter3inch.webp",
    },
    "columbia-tomahawk-smoothing-blades": {
        "pages": {
            1: "public/brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/TOMAHAWK-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/SmoothingBlades/TomahawkSmoothingBlades/Tomahawksmoothingblade.webp",
    },
    "columbia-standard-corner-flusher": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3.5INCH-CORNER-FLUSHER-SCHEMATIC-2015-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerFlushers/StandardCornerFlusher/3inchflusher.webp",
    },
    "columbia-direct-corner-flusher": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/DirectStandardFlusher-2015-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerFlushers/DirectCornerFlusher/2.5_Direct_Flusher_2.5DF.webp",
    },
    "columbia-combo-flusher": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerFlushers/ComboFlusher/Classic_Combo_Flusher-1-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerFlushers/ComboFlusher/combo_flusher.webp",
    },
    "columbia-sander-head": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Sanders/SanderHead/SANDER-HEAD-SCHEMATIC-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Sanders/SanderHead/sanderwhandlesquaresmall.webp",
    },
    "columbia-compound-tube": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CompoundTubes/CompoundTube/COMPOUND-TUBE-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CompoundTubes/CompoundTube/compoundtubesquare.webp",
    },
    "columbia-cam-lock-tube": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CompoundTubes/CamLockTube/Cam_Lock_Tube_2019-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CompoundTubes/CamLockTube/camlocktubesquare.webp",
    },
    "columbia-semi-automatic-taper": {
        "pages": {
            1: "public/brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/SEMI-AUTOMATIC-TAPER-SCHEMATIC-2022-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/SemiAutomaticTapers/SemiAutomaticTaper/semiautotapersquare.webp",
    },
    "columbia-one": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Handles/ColumbiaOne/Columbia_One-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Handles/ColumbiaOne/columbiaonesquare.webp",
    },
    "columbia-long-extendable-handle": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Handles/LongExtendableHandle/extendable-handle-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Handles/LongExtendableHandle/corner_roller_handle_extendible.webp",
    },
    "columbia-flat-box-handle": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Handles/FlatBoxHandle/180GripBoxHandle-2014-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Handles/FlatBoxHandle/boxhandle.webp",
    },
    "columbia-closet-monster-flat-box-handle": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Handles/ClosetMonster/ClosetMonster-2015-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Handles/ClosetMonster/closet_monster_copy.webp",
    },
    "columbia-box-filler": {
        "pages": {
            1: "public/brands/Columbia/Schematics/Pumps/BoxFiller/Box_Filler.webp",
        },
        "preview": "public/brands/Columbia/Schematics/Pumps/BoxFiller/boxfiller.webp",
    },
    "columbia-corner-cobra": {
        "pages": {
            1: "public/brands/Columbia/Schematics/CornerRollers/CornerCobra/CORNER-COBRA-SCHEMATIC.2024-enhanced.webp",
        },
        "preview": "public/brands/Columbia/Schematics/CornerRollers/CornerCobra/NEWCORNERCOBRA-scaled.webp",
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _slug_for(schematic_id: str, page: int | None, is_preview: bool) -> str:
    """Build a deterministic WP media slug for a schematic image."""
    if is_preview:
        return f"dtb-schem-{schematic_id}-preview"
    return f"dtb-schem-{schematic_id}-p{page}"


def _find_source_image(
    webp_path: Path,
    source_root: Path | None,
    repo_root: Path,
) -> Path | None:
    """Locate the best source image for a manifest entry.

    Priority:
      1. The expected .webp file at ``webp_path``.
      2. A PNG/JPG sibling of ``webp_path`` (same dir, different extension).
      3. If ``source_root`` is given, same relative path under that root
         (trying .webp, then .png/.jpg/.jpeg).

    Returns the first existing Path, or None if nothing is found.
    """
    if webp_path.exists():
        return webp_path

    # Look for a PNG/JPG sibling alongside the expected WebP path.
    for ext in ('.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'):
        candidate = webp_path.with_suffix(ext)
        if candidate.exists():
            return candidate

    if source_root is not None:
        # Compute the path relative to the repo root, then graft onto source_root.
        try:
            rel = webp_path.relative_to(repo_root)
        except ValueError:
            rel = webp_path  # fallback: use as-is

        # Try the WebP path first, then PNG/JPG variants.
        for ext in ('.webp', '.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'):
            candidate = (source_root / rel).with_suffix(ext)
            if candidate.exists():
                return candidate

    return None


def _convert_to_webp_bytes(src: Path, quality: int = 90) -> bytes:
    """Convert an image file to WebP and return the raw bytes.

    Requires Pillow (``pip install Pillow``).
    """
    try:
        from PIL import Image  # type: ignore[import]
    except ImportError:
        sys.exit(
            "ERROR: Pillow is required for --auto-convert.  "
            "Install it with:  pip install Pillow\n"
        )
    buf = io.BytesIO()
    with Image.open(src) as img:
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        img.save(buf, format='WEBP', quality=quality, method=6)
    return buf.getvalue()


def _find_existing_by_slug(session: "requests.Session", api_base: str, slug: str) -> dict | None:
    """Return the WP media item dict for the given slug, or None."""
    r = session.get(f"{api_base}/media", params={"slug": slug, "per_page": 1})
    try:
        r.raise_for_status()
    except requests.HTTPError:
        # Surface server response to help diagnose 406/other REST errors.
        sys.stderr.write(f"ERROR: GET {r.url} returned {r.status_code}\n")
        try:
            sys.stderr.write(r.text + "\n")
        except Exception:
            pass
        raise
    try:
        items = r.json()
    except ValueError:
        sys.stderr.write(f"ERROR: Non-JSON response for GET {r.url}:\n{r.text}\n")
        raise
    return items[0] if items else None


def _delete_media(session: "requests.Session", api_base: str, media_id: int) -> None:
    r = session.delete(f"{api_base}/media/{media_id}", params={"force": True})
    r.raise_for_status()


def _upload_media(
    session: "requests.Session",
    api_base: str,
    filepath: Path,
    slug: str,
    title: str,
    schematic_id: str,
    page: str,
    img_type: str,
    *,
    webp_bytes: bytes | None = None,
) -> dict:
    """Upload a file (or pre-converted bytes) and return the new media item dict.

    If ``webp_bytes`` is provided, those bytes are uploaded directly as WebP
    regardless of the source ``filepath`` format.  The upload filename is
    always ``<slug>.webp`` so the Media Library stores a clean WebP file.
    """
    # Determine the upload filename and content to send.
    if webp_bytes is not None:
        upload_name = f"{slug}.webp"
        data = webp_bytes
    else:
        upload_name = filepath.name
        with filepath.open("rb") as f:
            data = f.read()

    r = session.post(
        f"{api_base}/media",
        headers={
            "Content-Disposition": f'attachment; filename="{upload_name}"',
            "Content-Type": "image/webp",
        },
        data=data,
    )
    r.raise_for_status()
    media = r.json()
    media_id = media["id"]

    # Update title, slug, and custom meta in a single PATCH.
    patch = session.post(
        f"{api_base}/media/{media_id}",
        json={
            "title": title,
            "slug": slug,
            "alt_text": title,
            "meta": {
                "_dtb_schematic_id":   schematic_id,
                "_dtb_schematic_page": page,
                "_dtb_schematic_type": img_type,
            },
        },
    )
    patch.raise_for_status()
    return patch.json()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload schematic WebP images to WordPress Media Library",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  # Normal upload (WebP files must already exist):\n"
            "  python scripts/upload_schematics_to_wp.py\n\n"
            "  # Auto-convert PNG/JPG → WebP on the fly when .webp is missing:\n"
            "  python scripts/upload_schematics_to_wp.py --auto-convert\n\n"
            "  # Use backed-up PNG/JPG originals as the source:\n"
            "  python scripts/upload_schematics_to_wp.py --auto-convert \\\n"
            "      --source-root backups/schematics_non_webp_20260330-051523\n"
        ),
    )
    parser.add_argument("--dry-run",      action="store_true", help="Print upload plan without uploading")
    parser.add_argument("--overwrite",    action="store_true", help="Delete and re-upload existing media items")
    parser.add_argument(
        "--auto-convert",
        action="store_true",
        help=(
            "When the expected .webp file is missing, automatically locate the "
            "PNG/JPG original and convert it to WebP before uploading.  "
            "Requires Pillow: pip install Pillow."
        ),
    )
    parser.add_argument(
        "--source-root",
        default=None,
        help=(
            "Alternate root directory to search for source images when the "
            "expected path is missing.  The script mirrors the public/brands/ "
            "tree under this root.  Example: "
            "backups/schematics_non_webp_20260330-051523"
        ),
    )
    args = parser.parse_args()

    wp_base = os.environ.get("WP_BASE_URL", "").rstrip("/")
    auth_user = os.environ.get("WP_AUTH_USER", "")
    auth_pass = os.environ.get("WP_AUTH_PASS", "")

    if not wp_base:
        sys.exit("ERROR: set WP_BASE_URL environment variable (e.g. https://drywalltoolbox.com/wp)")
    if not auth_user or not auth_pass:
        sys.exit("ERROR: set WP_AUTH_USER and WP_AUTH_PASS environment variables")

    api_base = f"{wp_base}/wp-json/wp/v2"
    repo_root = Path(__file__).parent.parent.resolve()

    source_root: Path | None = None
    if args.source_root:
        source_root = (repo_root / args.source_root).resolve()
        if not source_root.exists():
            sys.exit(f"ERROR: --source-root path does not exist: {source_root}")
        print(f"Source root: {source_root}")

    session = requests.Session()
    session.auth = (auth_user, auth_pass)
    # Some servers return 406 Not Acceptable when no Accept header is provided.
    # Set a permissive JSON accept header and a stable User-Agent to improve
    # compatibility with REST endpoints and security filtering.
    session.headers.update({
        "Accept": "application/json",
        "User-Agent": "drywall-toolbox-scripts/1.0",
    })

    total = ok = skip = error = 0

    def _process_one(
        rel_path: str,
        slug: str,
        title: str,
        schematic_id: str,
        page: str,
        img_type: str,
    ) -> None:
        nonlocal ok, skip, error, total
        total += 1
        webp_path = repo_root / rel_path

        # Locate source image — either the expected .webp or a convertible original.
        src = _find_source_image(webp_path, source_root, repo_root)

        if src is None:
            hint = (
                " (use --auto-convert --source-root <backup-dir> to upload from backups)"
                if not args.auto_convert
                else " (not found in backups either — check paths)"
            )
            print(f"  MISS  {rel_path}{hint}")
            error += 1
            return

        needs_convert = src.suffix.lower() != ".webp"

        if needs_convert and not args.auto_convert:
            print(
                f"  SKIP  {slug}  ← {src.name} "
                f"(PNG/JPG found but --auto-convert not set)"
            )
            skip += 1
            return

        if args.dry_run:
            conv_note = f" [will convert {src.suffix} → webp]" if needs_convert else ""
            print(f"  DRY   {slug}  ← {src.name}{conv_note}")
            ok += 1
            return

        existing = _find_existing_by_slug(session, api_base, slug)
        if existing and not args.overwrite:
            print(f"  SKIP  {slug}  (already in Media Library)")
            skip += 1
            return
        if existing and args.overwrite:
            _delete_media(session, api_base, existing["id"])

        try:
            webp_bytes = _convert_to_webp_bytes(src) if needs_convert else None
        except Exception as exc:  # noqa: BLE001 — Pillow or I/O error during conversion
            print(f"  ERROR {slug}: conversion failed — {exc}")
            error += 1
            return

        try:
            _upload_media(
                session, api_base, src, slug, title,
                schematic_id, page, img_type,
                webp_bytes=webp_bytes,
            )
            conv_note = f" (converted from {src.suffix})" if needs_convert else ""
            print(f"  OK    {slug}{conv_note}")
            ok += 1
        except requests.RequestException as exc:
            print(f"  ERROR {slug}: upload failed — {exc}")
            error += 1

    for schematic_id, data in SCHEMATICS_MANIFEST.items():
        # Process diagram pages
        for page_num, rel_path in data["pages"].items():
            slug  = _slug_for(schematic_id, page_num, is_preview=False)
            title = f"DTB Schematic — {schematic_id} — Page {page_num}"
            _process_one(rel_path, slug, title, schematic_id, str(page_num), "diagram")

        # Process preview image
        if data.get("preview"):
            slug  = _slug_for(schematic_id, None, is_preview=True)
            title = f"DTB Schematic Preview — {schematic_id}"
            _process_one(data["preview"], slug, title, schematic_id, "0", "preview")

    print(f"\n{'Dry-run summary' if args.dry_run else 'Summary'}:")
    print(f"  Total   : {total}")
    print(f"  {'Would upload' if args.dry_run else 'Uploaded'}: {ok}")
    print(f"  Skipped : {skip}")
    print(f"  Errors  : {error}")

    if not args.dry_run and error == 0 and ok > 0:
        print(
            "\n✓ All images uploaded.\n"
            "  Verify at: GET /wp-json/dtb/v1/schematics/media\n"
            "  Once confirmed, the local source images can be deleted.\n"
            "  PNG/JPG originals in backups/ can be removed once WP images are confirmed live."
        )


if __name__ == "__main__":
    main()
