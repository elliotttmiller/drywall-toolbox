<?php
/* Template Name: Parts & Schematics */
get_header();
?>
<div style="min-height:100vh;" class="section-enter page-wrapper">

    <!-- HERO -->
    <section style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%);padding:clamp(48px,8vw,80px) clamp(1.5rem,5vw,3rem) clamp(3rem,6vw,4rem);position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,0.06) 1px,transparent 0);background-size:40px 40px;pointer-events:none;"></div>
        <div style="position:relative;z-index:1;max-width:1400px;margin:0 auto;">
            <div style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:3px;padding:4px 12px;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8);margin-bottom:16px;">
                Schematics &amp; Parts
            </div>
            <h1 style="color:white;font-size:clamp(2rem,5vw,3.5rem);font-weight:800;margin:0 0 12px;line-height:1.1;letter-spacing:-0.03em;">
                FIND YOUR PARTS.
            </h1>
            <p style="color:rgba(255,255,255,0.65);font-size:clamp(0.9rem,2vw,1rem);max-width:540px;line-height:1.6;margin:0;">
                Interactive schematics for Columbia Taping Tools and TapeTech. Click any part on the diagram to view part details and add to your order.
            </p>
        </div>
    </section>

    <!-- PARTS VIEWER MAIN AREA -->
    <section style="padding:clamp(2rem,5vw,3.5rem) clamp(1rem,5vw,2.5rem);max-width:1400px;margin:0 auto;">

        <!-- STAGE 1: Brand Selector -->
        <div id="parts-stage-brand">
            <h2 style="font-size:clamp(1.25rem,3vw,1.75rem);font-weight:800;color:black;margin:0 0 8px;letter-spacing:-0.02em;">Select a Brand</h2>
            <p style="color:rgba(15,23,42,0.5);margin:0 0 28px;font-size:0.9rem;">Choose a brand to view available tool schematics</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;max-width:600px;">
                <button onclick="selectPartsBrand('Columbia')"
                    style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.boxShadow='0 8px 24px rgba(37,99,235,0.12)';this.style.borderColor='var(--color-primary-600)'"
                    onmouseout="this.style.boxShadow='none';this.style.borderColor='var(--machined-border)'">
                    <img src="<?php echo esc_url(DTB_THEME_URI.'/assets/brands/Columbia/columbia_taping_tools_logo.svg'); ?>"
                         alt="Columbia Taping Tools" style="height:60px;width:auto;object-fit:contain;max-width:180px;">
                    <div>
                        <div style="font-weight:700;font-size:0.875rem;color:black;">Columbia Taping Tools</div>
                        <div style="font-size:0.75rem;color:rgba(15,23,42,0.5);margin-top:2px;">28 tools available</div>
                    </div>
                </button>
                <button onclick="selectPartsBrand('TapeTech')"
                    style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.boxShadow='0 8px 24px rgba(37,99,235,0.12)';this.style.borderColor='var(--color-primary-600)'"
                    onmouseout="this.style.boxShadow='none';this.style.borderColor='var(--machined-border)'">
                    <img src="<?php echo esc_url(DTB_THEME_URI.'/assets/brands/TapeTech/tapetech_logo.svg'); ?>"
                         alt="TapeTech" style="height:40px;width:auto;object-fit:contain;max-width:160px;">
                    <div>
                        <div style="font-weight:700;font-size:0.875rem;color:black;">TapeTech</div>
                        <div style="font-size:0.75rem;color:rgba(15,23,42,0.5);margin-top:2px;">1 tool available</div>
                    </div>
                </button>
            </div>
        </div>

        <!-- STAGE 2: Tool Selector -->
        <div id="parts-stage-tool" style="display:none;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
                <button onclick="resetToPartsStage1()" style="display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid var(--machined-border);border-radius:4px;padding:8px 14px;font-size:0.8rem;font-weight:700;color:rgba(15,23,42,0.6);cursor:pointer;"
                    onmouseover="this.style.borderColor='rgba(15,23,42,0.35)';this.style.color='black'"
                    onmouseout="this.style.borderColor='var(--machined-border)';this.style.color='rgba(15,23,42,0.6)'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Brands
                </button>
                <span id="parts-brand-label" style="font-size:1rem;font-weight:800;color:black;"></span>
            </div>
            <div id="parts-tool-selector-content"></div>
        </div>

        <!-- STAGE 3: Schematic Viewer -->
        <div id="parts-stage-schematic" style="display:none;">
            <!-- Breadcrumb -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;flex-wrap:wrap;font-size:0.825rem;">
                <button onclick="resetToPartsStage1()" style="background:none;border:none;cursor:pointer;color:var(--color-primary-600);font-weight:600;padding:0;">Brands</button>
                <span style="color:rgba(15,23,42,0.3);">/</span>
                <button id="parts-breadcrumb-brand" onclick="resetToPartsStage2()" style="background:none;border:none;cursor:pointer;color:var(--color-primary-600);font-weight:600;padding:0;"></button>
                <span style="color:rgba(15,23,42,0.3);">/</span>
                <span id="parts-breadcrumb-tool" style="color:black;font-weight:700;"></span>
            </div>
            
            <!-- Tool title + page tabs -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
                <div>
                    <h2 id="parts-tool-title" style="font-size:clamp(1.25rem,3vw,1.75rem);font-weight:800;color:black;margin:0 0 4px;"></h2>
                    <p id="parts-tool-description" style="color:rgba(15,23,42,0.5);font-size:0.875rem;margin:0;"></p>
                </div>
                <div id="parts-page-tabs" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>

            <!-- Schematic image + parts panel -->
            <div style="display:grid;grid-template-columns:1fr;gap:24px;" class="schematic-layout">
                <!-- Image area -->
                <div style="background:#f8fafc;border:1px solid var(--machined-border);border-radius:8px;overflow:hidden;position:relative;">
                    <div id="parts-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f8fafc;z-index:2;">
                        <div style="font-size:0.875rem;color:rgba(15,23,42,0.4);">Loading schematic...</div>
                    </div>
                    <div style="position:relative;display:inline-block;width:100%;">
                        <img id="parts-schematic-img" src="" alt="Schematic" style="width:100%;height:auto;display:block;" onload="onSchematicImgLoad()">
                        <div id="parts-hotspots-container" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
                    </div>
                </div>

                <!-- Parts list -->
                <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;overflow:hidden;">
                    <div style="padding:16px 20px;border-bottom:1px solid var(--machined-border);display:flex;align-items:center;justify-content:space-between;">
                        <h3 style="font-size:0.9rem;font-weight:800;color:black;margin:0;">Parts List</h3>
                        <span id="parts-count-label" style="font-size:0.72rem;color:rgba(15,23,42,0.4);"></span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;" id="parts-table">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="text-align:left;padding:10px 16px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(15,23,42,0.45);white-space:nowrap;">#</th>
                                    <th style="text-align:left;padding:10px 16px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(15,23,42,0.45);white-space:nowrap;">Part Number</th>
                                    <th style="text-align:left;padding:10px 16px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(15,23,42,0.45);">Description</th>
                                    <th style="text-align:right;padding:10px 16px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(15,23,42,0.45);white-space:nowrap;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="parts-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>

<!-- Part detail popup -->
<div id="part-detail-popup" style="display:none;position:fixed;z-index:2000;background:white;border:1px solid var(--machined-border);border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,0.2);padding:20px;max-width:320px;width:90vw;">
    <button onclick="closePartPopup()" style="position:absolute;top:10px;right:10px;background:none;border:none;cursor:pointer;color:rgba(15,23,42,0.4);font-size:1.1rem;line-height:1;">&times;</button>
    <div id="part-detail-content"></div>
</div>

<style>
@media(min-width:900px){
    .schematic-layout { grid-template-columns: 3fr 2fr; }
}
.parts-hotspot {
    position: absolute;
    width: 24px; height: 24px;
    transform: translate(-50%,-50%);
    border-radius: 50%;
    background: rgba(37,99,235,0.85);
    border: 2px solid white;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 800; color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    pointer-events: all;
    transition: transform 0.15s, background 0.15s;
    z-index: 10;
}
.parts-hotspot:hover { transform: translate(-50%,-50%) scale(1.3); background: rgba(29,78,216,1); }
.parts-table-row:hover { background: #eff6ff; cursor: pointer; }
.page-tab { padding: 8px 14px; border-radius: 4px; border: 1px solid var(--machined-border); background: white; font-size: 0.8rem; font-weight: 700; cursor: pointer; color: rgba(15,23,42,0.6); transition: all 0.15s; }
.page-tab.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }
</style>

<script>
(function() {
    var themeUri = window.DTB ? window.DTB.themeUri : '';
    var currentBrand = null;
    var currentSchematic = null;
    var currentPage = 1;
    var currentSchematicData = null;

    var COLUMBIA_SCHEMATICS_MAP = {
        'Angleheads': [
            { title: 'AngleHead', path: 'Angleheads/AngleHead', pages: [{ label: 'Schematic', file: 'AngleHead.json' }] }
        ],
        'Applicators': [
            { title: 'Inside Corner Applicator', path: 'Applicators/InsideCornerApplicator', pages: [
                { label: '2-Wheel', file: '2Wheel.json' },
                { label: '4-Wheel', file: '4Wheel.json' }
            ]},
            { title: 'Two-Way Internal Corner', path: 'Applicators/TwoWayInternalCorner', pages: [{ label: 'Schematic', file: 'TwoWayInternalCorner.json' }] },
            { title: 'External Corner', path: 'Applicators/ExternalCorner', pages: [{ label: 'Schematic', file: 'ExternalCorner.json' }] }
        ],
        'Automatic Tapers': [
            { title: 'Predator Automatic Taper', path: 'AutomaticTapers/PredatorTaper', pages: [
                { label: 'Head', file: 'Head.json' },
                { label: 'Body', file: 'Body.json' }
            ]}
        ],
        'Compound Tubes': [
            { title: 'CamLock Tube', path: 'CompoundTubes/CamLockTube', pages: [{ label: 'Schematic', file: 'CamLockTube.json' }] },
            { title: 'Compound Tube', path: 'CompoundTubes/CompoundTube', pages: [{ label: 'Schematic', file: 'CompoundTube.json' }] }
        ],
        'Corner Boxes': [
            { title: 'Throttle Box', path: 'CornerBoxes/ThrottleBox', pages: [{ label: 'Schematic', file: 'ThrottleBox.json' }] }
        ],
        'Corner Flushers': [
            { title: 'Direct Corner Flusher', path: 'CornerFlushers/DirectCornerFlusher', pages: [{ label: 'Schematic', file: 'DirectCornerFlusher.json' }] },
            { title: 'Combo Flusher', path: 'CornerFlushers/ComboFlusher', pages: [{ label: 'Schematic', file: 'ComboFlusher.json' }] },
            { title: 'Standard Corner Flusher', path: 'CornerFlushers/StandardCornerFlusher', pages: [{ label: 'Schematic', file: 'StandardCornerFlusher.json' }] }
        ],
        'Corner Rollers': [
            { title: 'Corner Cobra', path: 'CornerRollers/CornerCobra', pages: [{ label: 'Schematic', file: 'CornerCobra.json' }] },
            { title: 'Inside Corner Roller', path: 'CornerRollers/InsideCornerRoller', pages: [{ label: 'Schematic', file: 'InsideCornerRoller.json' }] },
            { title: 'Standard Outside Corner Roller', path: 'CornerRollers/StandardOutsideCornerRoller', pages: [{ label: 'Schematic', file: 'StandardOutsideCornerRoller.json' }] }
        ],
        'Finishing Boxes': [
            { title: 'Flat Box', path: 'FinishingBoxes/FlatBox', pages: [{ label: 'Schematic', file: 'FlatBox.json' }] },
            { title: 'Fat Boy Box', path: 'FinishingBoxes/FatBoyBox', pages: [{ label: 'Schematic', file: 'FatBoyBox.json' }] },
            { title: 'Automatic Flat Box', path: 'FinishingBoxes/AutomaticFlatBox', pages: [{ label: 'Schematic', file: 'AutomaticFlatBox.json' }] }
        ],
        'Handles': [
            { title: 'Matrix Box Handle', path: 'Handles/MatrixBoxHandle', pages: [
                { label: 'Box Handle', file: 'BoxHandle.json' },
                { label: 'Head', file: 'Head.json' },
                { label: 'Lever', file: 'Lever.json' },
                { label: 'Extension Housing', file: 'ExtensionHousing.json' },
                { label: 'Pinchbox', file: 'Pinchbox.json' }
            ]},
            { title: 'Closet Monster Handle', path: 'Handles/ClosetMonster', pages: [{ label: 'Schematic', file: 'ClosetMonster.json' }] },
            { title: 'Columbia One Handle', path: 'Handles/ColumbiaOne', pages: [{ label: 'Schematic', file: 'ColumbiaOne.json' }] },
            { title: 'Long Extendable Handle', path: 'Handles/LongExtendableHandle', pages: [{ label: 'Schematic', file: 'LongExtendableHandle.json' }] },
            { title: 'Flat Box Handle', path: 'Handles/FlatBoxHandle', pages: [{ label: 'Schematic', file: 'FlatBoxHandle.json' }] }
        ],
        'Nailspotters': [
            { title: 'Nailspotter', path: 'Nailspotters/Nailspotter', pages: [{ label: 'Schematic', file: 'Nailspotter.json' }] }
        ],
        'Pumps': [
            { title: 'Mud Pump', path: 'Pumps/MudPump', pages: [
                { label: 'Sub-Assemblies', file: 'MudPumpSubAssemblies.json' },
                { label: 'Schematic', file: 'MudPump.json' }
            ]},
            { title: 'Tall Boy Mud Pump', path: 'Pumps/TallBoyMudPump', pages: [
                { label: 'Sub-Assemblies', file: 'TallBoyMudPumpSubAssemblies.json' },
                { label: 'Schematic', file: 'TallBoyMudPump.json' }
            ]},
            { title: 'Box Filler Pump', path: 'Pumps/BoxFiller', pages: [{ label: 'Schematic', file: 'BoxFiller.json' }] },
            { title: 'Gooseneck Adapter', path: 'Pumps/GooseneckAdapter', pages: [{ label: 'Schematic', file: 'GooseneckAdapter.json' }] }
        ],
        'Sanders': [
            { title: 'Sander Head', path: 'Sanders/SanderHead', pages: [{ label: 'Schematic', file: 'SanderHead.json' }] }
        ],
        'Semi-Automatic Tapers': [
            { title: 'Semi-Automatic Taper', path: 'SemiAutomaticTapers/SemiAutomaticTaper', pages: [{ label: 'Schematic', file: 'SemiAutomaticTaper.json' }] }
        ],
        'Smoothing Blades': [
            { title: 'Tomahawk Smoothing Blades', path: 'SmoothingBlades/TomahawkSmoothingBlades', pages: [{ label: 'Schematic', file: 'TomahawkSmoothingBlades.json' }] }
        ]
    };

    var TAPETECH_SCHEMATICS_MAP = {
        'Handles': [
            { title: 'Extendable Support Handle', path: 'TapeTech/ExtendableSupportHandle', pages: [{ label: 'Schematic', file: 'ExtendableSupportHandle.json' }] }
        ]
    };

    function escH(str) {
        return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window.selectPartsBrand = function(brand) {
        currentBrand = brand;
        document.getElementById('parts-stage-brand').style.display = 'none';
        document.getElementById('parts-stage-tool').style.display = '';
        document.getElementById('parts-brand-label').textContent = brand === 'Columbia' ? 'Columbia Taping Tools' : 'TapeTech';
        renderToolSelector(brand);
    };

    function renderToolSelector(brand) {
        var map = brand === 'Columbia' ? COLUMBIA_SCHEMATICS_MAP : TAPETECH_SCHEMATICS_MAP;
        var container = document.getElementById('parts-tool-selector-content');
        var html = '';
        Object.keys(map).forEach(function(category) {
            var tools = map[category];
            html += '<div style="margin-bottom:28px;">' +
                '<h3 style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:rgba(15,23,42,0.4);margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--machined-border);">'+escH(category)+'</h3>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">';
            tools.forEach(function(tool, idx) {
                html += '<button onclick="selectPartsSchematic(\''+escH(brand)+'\',\''+escH(category)+'\','+idx+')" ' +
                    'style="text-align:left;background:white;border:1px solid var(--machined-border);border-radius:6px;padding:14px 16px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:space-between;gap:8px;" ' +
                    'onmouseover="this.style.borderColor=\'var(--color-primary-600)\';this.style.boxShadow=\'0 4px 12px rgba(37,99,235,0.1)\'" ' +
                    'onmouseout="this.style.borderColor=\'var(--machined-border)\';this.style.boxShadow=\'none\'">' +
                    '<span style="font-size:0.825rem;font-weight:700;color:black;line-height:1.3;">'+escH(tool.title)+'</span>' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
                    '</button>';
            });
            html += '</div></div>';
        });
        container.innerHTML = html;
    }

    window.selectPartsSchematic = function(brand, category, toolIdx) {
        var map = brand === 'Columbia' ? COLUMBIA_SCHEMATICS_MAP : TAPETECH_SCHEMATICS_MAP;
        var tool = map[category][toolIdx];
        if (!tool) return;
        currentSchematic = tool;
        currentPage = 0;

        document.getElementById('parts-stage-tool').style.display = 'none';
        document.getElementById('parts-stage-schematic').style.display = '';
        document.getElementById('parts-breadcrumb-brand').textContent = brand === 'Columbia' ? 'Columbia Taping Tools' : 'TapeTech';
        document.getElementById('parts-breadcrumb-tool').textContent = tool.title;
        document.getElementById('parts-tool-title').textContent = tool.title;
        document.getElementById('parts-tool-description').textContent = category;

        renderPageTabs(tool);
        loadSchematicPage(brand, tool, 0);
    };

    function renderPageTabs(tool) {
        var container = document.getElementById('parts-page-tabs');
        if (tool.pages.length <= 1) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = tool.pages.map(function(page, idx) {
            return '<button class="page-tab'+(idx===0?' active':'')+'" onclick="switchSchematicPage('+idx+')" data-page-idx="'+idx+'">'+escH(page.label)+'</button>';
        }).join('');
    }

    window.switchSchematicPage = function(pageIdx) {
        currentPage = pageIdx;
        document.querySelectorAll('.page-tab').forEach(function(tab, i) {
            tab.classList.toggle('active', i === pageIdx);
        });
        loadSchematicPage(currentBrand, currentSchematic, pageIdx);
    };

    function loadSchematicPage(brand, tool, pageIdx) {
        var page = tool.pages[pageIdx];
        if (!page) return;

        var loading = document.getElementById('parts-loading');
        if (loading) loading.style.display = '';

        var basePath = brand === 'Columbia'
            ? themeUri + '/assets/brands/Columbia/Schematics/' + tool.path + '/'
            : themeUri + '/assets/brands/' + tool.path + '/';

        var jsonUrl = basePath + page.file;

        fetch(jsonUrl)
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function(data) {
                currentSchematicData = data;
                var imgEl = document.getElementById('parts-schematic-img');
                if (imgEl) {
                    var imgSrc = data.image ? (basePath + data.image) : '';
                    imgEl.src = imgSrc;
                    imgEl.alt = tool.title;
                }
                renderPartsTable(data.parts || []);
            })
            .catch(function(e) {
                console.warn('Could not load schematic JSON:', jsonUrl, e);
                if (loading) loading.style.display = 'none';
                var tbody = document.getElementById('parts-table-body');
                if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding:24px;text-align:center;color:rgba(15,23,42,0.4);">Schematic data not available for this tool.</td></tr>';
                clearHotspots();
            });
    }

    function onSchematicImgLoadInternal() {
        var loading = document.getElementById('parts-loading');
        if (loading) loading.style.display = 'none';
        if (currentSchematicData) renderHotspots(currentSchematicData.parts || []);
    }

    window.onSchematicImgLoad = onSchematicImgLoadInternal;

    function clearHotspots() {
        var container = document.getElementById('parts-hotspots-container');
        if (container) container.innerHTML = '';
    }

    function renderHotspots(parts) {
        var container = document.getElementById('parts-hotspots-container');
        if (!container) return;
        container.innerHTML = parts.filter(function(p){ return p.x != null && p.y != null; }).map(function(part) {
            return '<div class="parts-hotspot" style="left:'+part.x+'%;top:'+part.y+'%;" ' +
                'onclick="showPartPopup(this,\''+escH(part.item||part.id)+'\',\''+escH(part.partNumber)+'\',\''+escH(part.description)+'\')" ' +
                'title="'+escH(part.partNumber||'')+'">'+escH(part.item||part.id)+'</div>';
        }).join('');
    }

    function renderPartsTable(parts) {
        var tbody = document.getElementById('parts-table-body');
        var countLabel = document.getElementById('parts-count-label');
        if (!tbody) return;
        if (countLabel) countLabel.textContent = parts.length + ' part' + (parts.length !== 1 ? 's' : '');
        if (!parts.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding:24px;text-align:center;color:rgba(15,23,42,0.4);">No parts listed for this schematic.</td></tr>';
            return;
        }
        tbody.innerHTML = parts.map(function(part) {
            return '<tr class="parts-table-row" onclick="addPartToCart(\''+escH(part.partNumber)+'\',\''+escH(part.description)+'\')" style="border-bottom:1px solid rgba(15,23,42,0.05);">' +
                '<td style="padding:10px 16px;font-size:0.78rem;font-weight:700;color:rgba(15,23,42,0.5);">'+escH(part.item||part.id||'')+'</td>' +
                '<td style="padding:10px 16px;font-size:0.78rem;font-weight:700;color:var(--color-primary-600);white-space:nowrap;font-family:var(--font-mono,monospace);">'+escH(part.partNumber||'')+'</td>' +
                '<td style="padding:10px 16px;font-size:0.825rem;color:black;">'+escH(part.description||'')+'</td>' +
                '<td style="padding:10px 16px;text-align:right;">' +
                '<button onclick="event.stopPropagation();addPartToCart(\''+escH(part.partNumber)+'\',\''+escH(part.description)+'\')" ' +
                'style="background:var(--color-primary-600);color:white;border:none;border-radius:3px;padding:5px 10px;font-size:0.7rem;font-weight:700;cursor:pointer;white-space:nowrap;">+ Cart</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    window.showPartPopup = function(el, item, partNumber, description) {
        var popup = document.getElementById('part-detail-popup');
        var content = document.getElementById('part-detail-content');
        if (!popup || !content) return;
        content.innerHTML =
            '<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:8px;">Item '+escH(item)+'</div>' +
            '<div style="font-size:0.875rem;font-weight:700;color:black;margin-bottom:4px;font-family:var(--font-mono,monospace);">'+escH(partNumber)+'</div>' +
            '<div style="font-size:0.825rem;color:rgba(15,23,42,0.7);line-height:1.4;margin-bottom:16px;">'+escH(description)+'</div>' +
            '<button onclick="addPartToCart(\''+escH(partNumber)+'\',\''+escH(description)+'\');closePartPopup();" class="alloy-button" style="width:100%;justify-content:center;font-size:0.8rem;padding:8px 16px;">Add to Cart</button>';
        // Position popup near hotspot
        var rect = el.getBoundingClientRect();
        popup.style.display = '';
        var popupLeft = Math.min(rect.left + window.scrollX, window.innerWidth - 340);
        var popupTop = rect.bottom + window.scrollY + 8;
        popup.style.left = Math.max(8, popupLeft) + 'px';
        popup.style.top = popupTop + 'px';
    };

    window.closePartPopup = function() {
        var popup = document.getElementById('part-detail-popup');
        if (popup) popup.style.display = 'none';
    };

    document.addEventListener('click', function(e) {
        var popup = document.getElementById('part-detail-popup');
        if (popup && popup.style.display !== 'none' && !popup.contains(e.target) && !e.target.classList.contains('parts-hotspot')) {
            closePartPopup();
        }
    });

    window.addPartToCart = function(partNumber, description) {
        var product = {
            sku: partNumber,
            name: description || partNumber,
            price: 0,
            image: '',
            brand: currentBrand === 'Columbia' ? 'Columbia Taping Tools' : 'TapeTech',
            quantity: 1
        };
        if (window.CartManager) {
            window.CartManager.addToCart(product);
        } else {
            var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
            var existing = cart.find(function(i){ return i.sku === partNumber; });
            if (existing) { existing.quantity = (existing.quantity||1)+1; }
            else { cart.push(product); }
            localStorage.setItem('dtb_cart', JSON.stringify(cart));
            if (window.updateCartCounts) window.updateCartCounts();
            if (window.showToast) window.showToast(description + ' added to cart!');
        }
    };

    window.resetToPartsStage1 = function() {
        currentBrand = null; currentSchematic = null;
        document.getElementById('parts-stage-brand').style.display = '';
        document.getElementById('parts-stage-tool').style.display = 'none';
        document.getElementById('parts-stage-schematic').style.display = 'none';
    };

    window.resetToPartsStage2 = function() {
        document.getElementById('parts-stage-tool').style.display = '';
        document.getElementById('parts-stage-schematic').style.display = 'none';
        currentSchematic = null;
    };

    // Handle URL param ?brand=columbia or ?brand=tapetech
    document.addEventListener('DOMContentLoaded', function() {
        var brandParam = new URLSearchParams(window.location.search).get('brand');
        if (brandParam) {
            var b = brandParam.toLowerCase();
            if (b === 'columbia' || b.includes('columbia')) selectPartsBrand('Columbia');
            else if (b === 'tapetech') selectPartsBrand('TapeTech');
        }
    });
})();
</script>
<?php get_footer(); ?>
