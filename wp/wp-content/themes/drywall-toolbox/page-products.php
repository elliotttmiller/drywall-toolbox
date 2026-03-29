<?php
/* Template Name: Products */
get_header();
?>
<div class="page-wrapper section-enter" style="min-height:100vh;background:#f8fafc;">
    <div style="max-width:1400px;margin:0 auto;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem);">

        <!-- Back button (shown when brand selected) -->
        <div id="back-to-brands-btn" style="display:none;margin-bottom:24px;">
            <button onclick="resetToBrands()" style="display:inline-flex;align-items:center;gap:8px;background:none;border:1px solid var(--machined-border);border-radius:4px;padding:8px 16px;font-size:0.825rem;font-weight:700;color:rgba(15,23,42,0.6);cursor:pointer;transition:all 0.15s;"
                onmouseover="this.style.borderColor='rgba(15,23,42,0.35)';this.style.color='black'"
                onmouseout="this.style.borderColor='var(--machined-border)';this.style.color='rgba(15,23,42,0.6)'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Brands
            </button>
        </div>

        <!-- Page header -->
        <div style="margin-bottom:clamp(1.5rem,4vw,2.5rem);">
            <h1 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0 0 8px;letter-spacing:-0.02em;">Products</h1>
            <p style="color:rgba(15,23,42,0.5);margin:0;font-size:0.9rem;">Browse our extensive collection of professional drywall tools</p>
        </div>

        <!-- Search bar (shown when brand selected) -->
        <div id="products-search-bar" style="display:none;margin-bottom:20px;">
            <div style="position:relative;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" id="product-search-input" placeholder="Search products by name, SKU, or brand..."
                    class="machined-input text-black"
                    style="width:100%;box-sizing:border-box;padding-left:44px;"
                    oninput="filterProducts()">
            </div>
        </div>

        <!-- Brand selector grid (initial state) -->
        <div id="brand-selector-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;">
            <?php
            $brands_data = [
                [ 'name' => 'TapeTech',              'logo' => 'TapeTech/tapetech_logo.svg'                         ],
                [ 'name' => 'Columbia Taping Tools', 'logo' => 'Columbia/columbia_taping_tools_logo.svg'            ],
                [ 'name' => 'SurPro',                'logo' => 'SurPro/surpro_logo.svg'                             ],
                [ 'name' => 'Asgard',                'logo' => 'Asgard/asgard_logo.svg'                             ],
                [ 'name' => 'Graco',                 'logo' => 'Graco/graco_logo.svg'                               ],
            ];
            foreach ( $brands_data as $bd ) : ?>
            <button onclick="selectBrand('<?php echo esc_js( $bd['name'] ); ?>')"
                style="background:white;border-radius:8px;padding:clamp(1rem,4vw,1.5rem);box-shadow:0 1px 2px rgba(0,0,0,0.05);border:1px solid rgb(229,231,235);transition:all 0.2s;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;cursor:pointer;"
                class="brand-card-products"
                onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';this.style.borderColor='var(--color-primary-600)'"
                onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.05)';this.style.borderColor='rgb(229,231,235)'">
                <img src="<?php echo esc_url( DTB_THEME_URI . '/assets/brands/' . $bd['logo'] ); ?>"
                     alt="<?php echo esc_attr( $bd['name'] ); ?>"
                     style="height:clamp(3rem,10vw,5rem);width:auto;object-fit:contain;max-width:160px;"
                     loading="lazy">
            </button>
            <?php endforeach; ?>
        </div>

        <!-- Product catalog (shown when brand selected) -->
        <div id="product-catalog" style="display:none;">
            <div style="display:flex;flex-direction:column;gap:16px;" class="catalog-layout">
                <!-- Filter panel (mobile overlay + desktop sidebar) -->
                <div id="filter-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999;" onclick="closeFilters()"></div>
                <div id="filter-panel" style="position:fixed;top:0;left:-320px;width:300px;height:100vh;background:white;z-index:1000;overflow-y:auto;padding:24px;transition:left 0.3s;box-shadow:4px 0 24px rgba(0,0,0,0.15);box-sizing:border-box;" class="filter-panel-sidebar">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                        <h3 style="font-size:1rem;font-weight:800;color:black;margin:0;">Filters</h3>
                        <button onclick="closeFilters()" style="background:none;border:none;cursor:pointer;color:rgba(15,23,42,0.5);font-size:1.25rem;line-height:1;">&times;</button>
                    </div>
                    <!-- Category filter -->
                    <div style="margin-bottom:24px;">
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:rgba(15,23,42,0.4);margin-bottom:12px;">Categories</div>
                        <?php
                        $cats = [
                            [ 'id' => 'taping',    'name' => 'Automatic Taping'    ],
                            [ 'id' => 'finishing', 'name' => 'Finishing Tools'      ],
                            [ 'id' => 'corner',    'name' => 'Corner Tools'         ],
                            [ 'id' => 'mudboxes',  'name' => 'Mud Boxes & Pumps'   ],
                            [ 'id' => 'sanding',   'name' => 'Sanding Tools'        ],
                        ];
                        foreach ( $cats as $cat ) : ?>
                        <label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:0.875rem;color:black;">
                            <input type="checkbox" name="cat_filter" value="<?php echo esc_attr( $cat['id'] ); ?>" onchange="filterProducts()" style="accent-color:var(--color-primary-600);width:16px;height:16px;">
                            <?php echo esc_html( $cat['name'] ); ?>
                        </label>
                        <?php endforeach; ?>
                    </div>
                    <!-- Price range filter -->
                    <div style="margin-bottom:24px;">
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:rgba(15,23,42,0.4);margin-bottom:12px;">Max Price</div>
                        <input type="range" id="price-range-input" min="0" max="3000" value="3000" style="width:100%;accent-color:var(--color-primary-600);" oninput="document.getElementById('price-range-val').textContent=this.value;filterProducts()">
                        <div style="font-size:0.825rem;color:rgba(15,23,42,0.6);margin-top:6px;">Up to $<span id="price-range-val">3000</span></div>
                    </div>
                    <button onclick="clearFilters()" style="width:100%;padding:10px;background:none;border:1px solid var(--machined-border);border-radius:4px;font-size:0.825rem;font-weight:700;color:rgba(15,23,42,0.6);cursor:pointer;">Clear Filters</button>
                </div>

                <!-- Top toolbar -->
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                    <button onclick="openFilters()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:white;border:1px solid var(--machined-border);border-radius:4px;font-size:0.825rem;font-weight:700;color:rgba(15,23,42,0.7);cursor:pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/></svg>
                        Filters
                    </button>
                    <select id="sort-select" onchange="filterProducts()" style="padding:10px 14px;background:white;border:1px solid var(--machined-border);border-radius:4px;font-size:0.825rem;font-weight:600;color:black;cursor:pointer;margin-left:auto;">
                        <option value="popular">Sort: Popular</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="name-az">Name: A–Z</option>
                    </select>
                    <span id="product-count-label" style="font-size:0.825rem;color:rgba(15,23,42,0.5);"></span>
                </div>

                <!-- Product grid -->
                <div id="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">
                    <div style="grid-column:1/-1;text-align:center;padding:60px;color:rgba(15,23,42,0.4);">Loading products...</div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Product Modal -->
<div id="product-modal" style="display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);overflow-y:auto;padding:20px;" onclick="if(event.target===this)closeProductModal()">
    <div style="background:white;border-radius:8px;max-width:860px;margin:40px auto;position:relative;overflow:hidden;">
        <button onclick="closeProductModal()" style="position:absolute;top:16px;right:16px;background:rgba(15,23,42,0.08);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:rgba(15,23,42,0.6);z-index:1;">&times;</button>
        <div id="product-modal-content" style="display:grid;grid-template-columns:1fr 1fr;gap:0;" class="product-modal-grid"></div>
    </div>
</div>

<style>
@media(min-width:1024px){
    .catalog-layout { flex-direction: row; }
    #filter-panel { position:static !important; left:auto !important; width:260px !important; height:auto !important; box-shadow:none !important; border:1px solid var(--machined-border); border-radius:4px; flex-shrink:0; }
    #filter-overlay { display:none !important; }
}
@media(max-width:600px){
    .product-modal-grid { grid-template-columns:1fr !important; }
}
.product-card { background:white; border:1px solid var(--machined-border); border-radius:6px; overflow:hidden; transition:all 0.2s; cursor:pointer; display:flex; flex-direction:column; }
.product-card:hover { box-shadow:0 8px 24px rgba(0,0,0,0.1); transform:translateY(-2px); }
</style>

<script>
(function() {
    var allProducts = [];
    var selectedBrands = [];
    var themeUri = window.DTB ? window.DTB.themeUri : '';
    var csvUrl = themeUri + '/assets/products_catalog.csv';

    function getUrlParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function setUrlParam(brand, search) {
        var params = new URLSearchParams();
        if (brand)  params.set('brand',  brand);
        if (search) params.set('search', search);
        var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.replaceState(null, '', url);
    }

    function parseCSV(text) {
        var lines = text.split(/\r?\n/);
        if (!lines.length) return [];
        var headers = parseCSVRow(lines[0]);
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            var vals = parseCSVRow(lines[i]);
            var obj = {};
            headers.forEach(function(h, j) { obj[h.trim()] = vals[j] || ''; });
            rows.push(obj);
        }
        return rows;
    }

    function parseCSVRow(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current); current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    function normalizeProduct(r, idx) {
        var sku    = String(r.sku || r.part_number || '').trim();
        var name   = String(r.name || r.product_name || '').trim();
        var brand  = String(r.brand || '').trim();
        var images = [];
        for (var i = 1; i <= 9; i++) {
            var img = String(r['image_'+i] || '').trim();
            if (img) images.push(img);
        }
        if (!images.length) {
            var primary = String(r.image_url || '').trim();
            if (primary) images.push(primary);
        }
        if (!images.length) images = ['/product-placeholder.jpg'];
        var priceRaw = r.price_numeric || r.price || '';
        var price    = parseFloat(String(priceRaw).replace(/[^0-9.-]+/g,'')) || 0;
        var category = String(r.category || '').trim();
        return {
            id:          sku || 'p-'+idx,
            sku:         sku,
            name:        name || sku || 'Product '+idx,
            brand:       brand,
            image:       images[0],
            images:      images,
            price:       price,
            category:    category,
            description: String(r.description_short || r.short_description || r.description_full || '').trim(),
            upc:         String(r.upc || '').trim(),
        };
    }

    var ALLOWED_BRANDS = ['TapeTech','Columbia Taping Tools','Asgard','SurPro','Graco'];

    function loadCSV() {
        fetch(csvUrl)
            .then(function(r){ return r.text(); })
            .then(function(text) {
                var rows = parseCSV(text);
                allProducts = rows.map(normalizeProduct).filter(function(p){ return p.name && ALLOWED_BRANDS.includes(p.brand); });
                var brandParam = getUrlParam('brand');
                if (brandParam) {
                    var decoded = decodeURIComponent(brandParam);
                    selectedBrands = decoded.split(',').map(function(b){ return b.trim(); }).filter(function(b){ return ALLOWED_BRANDS.includes(b); });
                    if (selectedBrands.length) showCatalog();
                }
            })
            .catch(function(e){ console.warn('Failed to load CSV:', e); });
    }

    function showCatalog() {
        document.getElementById('brand-selector-grid').style.display  = 'none';
        document.getElementById('product-catalog').style.display      = '';
        document.getElementById('back-to-brands-btn').style.display   = '';
        document.getElementById('products-search-bar').style.display  = '';
        filterProducts();
    }

    window.selectBrand = function(brand) {
        selectedBrands = [brand];
        setUrlParam(brand, '');
        showCatalog();
    };

    window.resetToBrands = function() {
        selectedBrands = [];
        document.getElementById('brand-selector-grid').style.display  = 'grid';
        document.getElementById('product-catalog').style.display      = 'none';
        document.getElementById('back-to-brands-btn').style.display   = 'none';
        document.getElementById('products-search-bar').style.display  = 'none';
        document.getElementById('product-search-input').value = '';
        setUrlParam('', '');
    };

    window.openFilters = function() {
        var fp = document.getElementById('filter-panel');
        var fo = document.getElementById('filter-overlay');
        if (window.innerWidth < 1024) {
            if (fp) fp.style.left = '0';
            if (fo) fo.style.display = '';
        }
    };
    window.closeFilters = function() {
        var fp = document.getElementById('filter-panel');
        var fo = document.getElementById('filter-overlay');
        if (fp) fp.style.left = '-320px';
        if (fo) fo.style.display = 'none';
    };
    window.clearFilters = function() {
        document.querySelectorAll('input[name="cat_filter"]').forEach(function(cb){ cb.checked=false; });
        var pr = document.getElementById('price-range-input');
        if (pr) { pr.value=3000; document.getElementById('price-range-val').textContent='3000'; }
        filterProducts();
    };

    window.filterProducts = function() {
        var search = (document.getElementById('product-search-input') || {}).value || '';
        var q = search.toLowerCase().trim();
        var checkedCats = Array.from(document.querySelectorAll('input[name="cat_filter"]:checked')).map(function(c){ return c.value; });
        var maxPrice = parseFloat((document.getElementById('price-range-input') || {}).value) || 3000;
        var sortBy   = (document.getElementById('sort-select') || {}).value || 'popular';

        var filtered = allProducts.filter(function(p) {
            if (selectedBrands.length && !selectedBrands.includes(p.brand)) return false;
            if (checkedCats.length && !checkedCats.includes(p.category)) return false;
            if (p.price && p.price > maxPrice) return false;
            if (q) {
                var nameMatch  = p.name.toLowerCase().includes(q);
                var skuMatch   = p.sku.toLowerCase().includes(q);
                var brandMatch = p.brand.toLowerCase().includes(q);
                if (!nameMatch && !skuMatch && !brandMatch) return false;
            }
            return true;
        });

        filtered.sort(function(a, b) {
            if (sortBy === 'price-low')  return a.price - b.price;
            if (sortBy === 'price-high') return b.price - a.price;
            if (sortBy === 'name-az')    return a.name.localeCompare(b.name);
            return 0;
        });

        var countLabel = document.getElementById('product-count-label');
        if (countLabel) countLabel.textContent = filtered.length + ' product' + (filtered.length !== 1 ? 's' : '');

        renderProductGrid(filtered);
    };

    function renderProductGrid(products) {
        var grid = document.getElementById('product-grid');
        if (!grid) return;
        if (!products.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:rgba(15,23,42,0.4);">No products match your filters. <button onclick="clearFilters()" style="color:var(--color-primary-600);background:none;border:none;cursor:pointer;font-weight:700;">Clear filters</button></div>';
            return;
        }
        grid.innerHTML = products.map(function(p, i) {
            var hasPrice = p.price && p.price > 0;
            return '<div class="product-card" onclick="openProductModal('+i+')" data-product-index="'+i+'">' +
                '<div style="aspect-ratio:1/1;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;">' +
                '<img src="'+escHtmlP(p.image)+'" alt="'+escHtmlP(p.name)+'" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy" onerror="this.src=\'/product-placeholder.jpg\'">' +
                '</div>' +
                '<div style="padding:14px;flex:1;display:flex;flex-direction:column;">' +
                '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-primary-600);margin-bottom:4px;">'+escHtmlP(p.brand)+'</div>' +
                '<div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:auto;line-height:1.3;">'+escHtmlP(p.name)+'</div>' +
                '<div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                (hasPrice ? '<span style="font-weight:800;color:var(--color-primary-600);">$'+p.price.toFixed(2)+'</span>' : '<span style="font-size:0.75rem;color:rgba(15,23,42,0.4);">Contact for price</span>') +
                '<button onclick="event.stopPropagation();addProductToCart(\''+escHtmlP(p.sku)+'\')" style="background:var(--color-primary-600);color:white;border:none;border-radius:4px;padding:6px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap;">Add to Cart</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');
        window._dtbFilteredProducts = products;
    }

    function escHtmlP(str) {
        return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window.openProductModal = function(idx) {
        var products = window._dtbFilteredProducts || [];
        var p = products[idx];
        if (!p) return;
        var modal   = document.getElementById('product-modal');
        var content = document.getElementById('product-modal-content');
        if (!modal || !content) return;
        var hasPrice = p.price && p.price > 0;
        content.innerHTML =
            '<div style="padding:32px;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:300px;">' +
            '<img src="'+escHtmlP(p.image)+'" alt="'+escHtmlP(p.name)+'" style="max-width:100%;max-height:380px;object-fit:contain;" onerror="this.src=\'/product-placeholder.jpg\'">' +
            '</div>' +
            '<div style="padding:32px;display:flex;flex-direction:column;">' +
            '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:6px;">'+escHtmlP(p.brand)+'</div>' +
            '<h2 style="font-size:1.2rem;font-weight:800;color:black;margin:0 0 8px;line-height:1.3;">'+escHtmlP(p.name)+'</h2>' +
            (p.sku ? '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:16px;">SKU: '+escHtmlP(p.sku)+'</div>' : '') +
            (p.description ? '<p style="font-size:0.875rem;color:rgba(15,23,42,0.65);line-height:1.6;margin:0 0 20px;">'+escHtmlP(p.description)+'</p>' : '') +
            (hasPrice ? '<div style="font-size:1.5rem;font-weight:800;color:var(--color-primary-600);margin-bottom:24px;">$'+p.price.toFixed(2)+'</div>' : '<div style="font-size:0.875rem;color:rgba(15,23,42,0.5);margin-bottom:24px;">Contact for pricing</div>') +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:auto;">' +
            '<button onclick="addProductToCart(\''+escHtmlP(p.sku)+'\')" class="alloy-button" style="flex:1;justify-content:center;">Add to Cart</button>' +
            '</div>' +
            '</div>';
        modal.style.display = '';
        document.body.style.overflow = 'hidden';
    };

    window.closeProductModal = function() {
        var modal = document.getElementById('product-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.closeProductModal();
    });

    window.addProductToCart = function(sku) {
        var products = window._dtbFilteredProducts || allProducts;
        var p = products.find(function(x){ return x.sku === sku; });
        if (!p) return;
        if (window.CartManager) {
            window.CartManager.addToCart(p);
        } else {
            var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
            var existing = cart.find(function(i){ return i.sku === sku; });
            if (existing) { existing.quantity = (existing.quantity||1)+1; }
            else { cart.push({sku:p.sku,name:p.name,price:p.price,image:p.image,brand:p.brand,quantity:1}); }
            localStorage.setItem('dtb_cart', JSON.stringify(cart));
            if (window.updateCartCounts) window.updateCartCounts();
            if (window.showToast) window.showToast(p.name+' added to cart!');
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        loadCSV();
    });
})();
</script>
<?php get_footer(); ?>
