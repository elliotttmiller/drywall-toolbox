/**
 * Drywall Toolbox - Products Page JS
 * Loads CSV, filters, sorts, renders product grid, handles product modal.
 * Used by page-products.php
 */
(function () {
  'use strict';

  var allProducts = [];
  var filteredProducts = [];
  var selectedBrands = [];
  var themeUri = (window.DTB && window.DTB.themeUri) ? window.DTB.themeUri : '';
  var csvUrl = themeUri + '/assets/products_catalog.csv';

  var ALLOWED_BRANDS = ['TapeTech', 'Columbia Taping Tools', 'Asgard', 'SurPro', 'Graco'];
  var MAX_PRICE = 3000;

  /* ─── URL HELPERS ─────────────────────────────────────────────────── */
  function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function setUrlParams(brand, search) {
    var params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (search) params.set('search', search);
    var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    try { history.replaceState(null, '', url); } catch (e) {}
  }

  /* ─── CSV PARSER ──────────────────────────────────────────────────── */
  function parseCSVRow(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
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

  function parseCSV(text) {
    var lines = text.split(/\r?\n/);
    if (!lines.length) return [];
    var headers = parseCSVRow(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var vals = parseCSVRow(lines[i]);
      var obj = {};
      headers.forEach(function (h, j) { obj[h.trim()] = (vals[j] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  function inferCategory(name, desc) {
    var text = ((name || '') + ' ' + (desc || '')).toLowerCase();
    if (/\bsand(er|ing)?\b/.test(text)) return 'sanding';
    if (/loading pump|gooseneck|compound tube|mud tube|box filler|filler adapt|mud pump|pump/.test(text)) return 'mudboxes';
    if (/auto.*tap|taper|bazooka/.test(text)) return 'taping';
    if (/corner|flusher|roller|applicator/.test(text)) return 'corner';
    if (/flat box|finishing box|mud box|fat boy/.test(text)) return 'finishing';
    return '';
  }

  function normalizeProduct(r, idx) {
    var sku = String(r.sku || r.part_number || '').trim();
    var name = String(r.name || r.product_name || '').trim();
    var brand = String(r.brand || '').trim();
    var images = [];
    for (var i = 1; i <= 9; i++) {
      var img = String(r['image_' + i] || '').trim();
      if (img) images.push(img);
    }
    if (!images.length) {
      var primary = String(r.image_url || '').trim();
      if (primary) images.push(primary);
    }
    if (!images.length) images = ['/product-placeholder.jpg'];
    var priceRaw = r.price_numeric || r.price || '';
    var price = parseFloat(String(priceRaw).replace(/[^0-9.-]+/g, '')) || 0;
    var descShort = String(r.description_short || r.short_description || '').trim();
    var descFull = String(r.description_full || '').trim();
    var category = String(r.category || '').trim() || inferCategory(name, descShort || descFull);
    return {
      id: sku || 'p-' + idx,
      sku: sku,
      name: name || sku || 'Product ' + idx,
      brand: brand,
      image: images[0],
      images: images,
      price: price,
      category: category,
      description: descShort || descFull,
      upc: String(r.upc || '').trim(),
      rating: parseFloat(r.rating) || 0,
    };
  }

  /* ─── LOAD CSV ────────────────────────────────────────────────────── */
  function loadCSV() {
    fetch(csvUrl)
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var rows = parseCSV(text);
        allProducts = rows
          .map(normalizeProduct)
          .filter(function (p) { return p.name && ALLOWED_BRANDS.indexOf(p.brand) !== -1; });

        var brandParam = getUrlParam('brand');
        if (brandParam) {
          var decoded = decodeURIComponent(brandParam);
          selectedBrands = decoded.split(',')
            .map(function (b) { return b.trim(); })
            .filter(function (b) { return ALLOWED_BRANDS.indexOf(b) !== -1; });
          if (selectedBrands.length) {
            showCatalog();
            return;
          }
        }
        // No brand selected: show brand grid (already visible by default from PHP)
      })
      .catch(function (e) { console.warn('DTB: Failed to load products CSV:', e); });
  }

  /* ─── BRAND / CATALOG TOGGLE ─────────────────────────────────────── */
  function showCatalog() {
    var brandGrid = document.getElementById('brand-selector-grid');
    var catalog = document.getElementById('product-catalog');
    var backBtn = document.getElementById('back-to-brands-btn');
    var searchBar = document.getElementById('products-search-bar');
    if (brandGrid) brandGrid.style.display = 'none';
    if (catalog) catalog.style.display = '';
    if (backBtn) backBtn.style.display = '';
    if (searchBar) searchBar.style.display = '';
    applyFilters();
  }

  window.DTBProducts = {
    selectBrand: function (brand) {
      selectedBrands = [brand];
      setUrlParams(brand, '');
      showCatalog();
    },
    resetToBrands: function () {
      selectedBrands = [];
      var brandGrid = document.getElementById('brand-selector-grid');
      var catalog = document.getElementById('product-catalog');
      var backBtn = document.getElementById('back-to-brands-btn');
      var searchBar = document.getElementById('products-search-bar');
      var searchInput = document.getElementById('product-search-input');
      if (brandGrid) brandGrid.style.display = 'grid';
      if (catalog) catalog.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      if (searchBar) searchBar.style.display = 'none';
      if (searchInput) searchInput.value = '';
      setUrlParams('', '');
    }
  };

  // Expose for inline onclick handlers in PHP template
  window.selectBrand = window.DTBProducts.selectBrand.bind(window.DTBProducts);
  window.resetToBrands = window.DTBProducts.resetToBrands.bind(window.DTBProducts);

  /* ─── FILTER PANEL ────────────────────────────────────────────────── */
  window.openFilters = function () {
    var fp = document.getElementById('filter-panel');
    var fo = document.getElementById('filter-overlay');
    if (window.innerWidth < 1024) {
      if (fp) fp.style.left = '0';
      if (fo) fo.style.display = '';
    }
  };

  window.closeFilters = function () {
    var fp = document.getElementById('filter-panel');
    var fo = document.getElementById('filter-overlay');
    if (fp) fp.style.left = '-320px';
    if (fo) fo.style.display = 'none';
  };

  window.clearFilters = function () {
    document.querySelectorAll('input[name="cat_filter"]').forEach(function (cb) { cb.checked = false; });
    var pr = document.getElementById('price-range-input');
    var prv = document.getElementById('price-range-val');
    if (pr) pr.value = MAX_PRICE;
    if (prv) prv.textContent = MAX_PRICE;
    applyFilters();
  };

  /* ─── APPLY FILTERS ───────────────────────────────────────────────── */
  function applyFilters() {
    var searchInput = document.getElementById('product-search-input');
    var q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var checkedCats = Array.from(document.querySelectorAll('input[name="cat_filter"]:checked'))
      .map(function (c) { return c.value; });
    var maxPrice = parseFloat((document.getElementById('price-range-input') || {}).value) || MAX_PRICE;
    var sortBy = (document.getElementById('sort-select') || {}).value || 'popular';

    var result = allProducts.filter(function (p) {
      if (selectedBrands.length && selectedBrands.indexOf(p.brand) === -1) return false;
      if (checkedCats.length && checkedCats.indexOf(p.category) === -1) return false;
      if (p.price && p.price > maxPrice) return false;
      if (q) {
        var nm = p.name.toLowerCase().includes(q);
        var sk = p.sku.toLowerCase().includes(q);
        var br = p.brand.toLowerCase().includes(q);
        if (!nm && !sk && !br) return false;
      }
      return true;
    });

    result.sort(function (a, b) {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'name-az') return a.name.localeCompare(b.name);
      return 0; // popular: keep original order
    });

    filteredProducts = result;

    var countLabel = document.getElementById('product-count-label');
    if (countLabel) countLabel.textContent = result.length + ' product' + (result.length !== 1 ? 's' : '');

    renderProductGrid(result);
  }

  // Expose for inline oninput/onchange handlers
  window.filterProducts = applyFilters;

  /* ─── HTML ESCAPE ─────────────────────────────────────────────────── */
  function escH(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── PRODUCT GRID ────────────────────────────────────────────────── */
  function renderProductGrid(products) {
    var grid = document.getElementById('product-grid');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:rgba(15,23,42,0.4);">No products match your filters. ' +
        '<button onclick="clearFilters()" style="color:var(--color-primary-600);background:none;border:none;cursor:pointer;font-weight:700;">Clear filters</button></div>';
      return;
    }

    grid.innerHTML = products.map(function (p, idx) {
      var hasPrice = p.price && p.price > 0;
      return (
        '<div class="product-card" onclick="openProductModal(' + idx + ')" style="background:white;border:1px solid var(--machined-border);border-radius:6px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:all 0.2s;" ' +
        'onmouseover="this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.1)\';this.style.transform=\'translateY(-2px)\'" ' +
        'onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'none\'">' +
        '<div style="aspect-ratio:1/1;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;">' +
        '<img src="' + escH(p.image) + '" alt="' + escH(p.name) + '" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy" onerror="this.src=\'/product-placeholder.jpg\'">' +
        '</div>' +
        '<div style="padding:14px;flex:1;display:flex;flex-direction:column;">' +
        '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-primary-600);margin-bottom:4px;">' + escH(p.brand) + '</div>' +
        '<div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:auto;line-height:1.3;">' + escH(p.name) + '</div>' +
        '<div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        (hasPrice ? '<span style="font-weight:800;color:var(--color-primary-600);">$' + p.price.toFixed(2) + '</span>' : '<span style="font-size:0.75rem;color:rgba(15,23,42,0.4);">Contact for price</span>') +
        '<button onclick="event.stopPropagation();addProductToCart(\'' + escH(p.sku) + '\')" style="background:var(--color-primary-600);color:white;border:none;border-radius:4px;padding:6px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;white-space:nowrap;" title="Add ' + escH(p.name) + ' to cart">+ Cart</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ─── PRODUCT MODAL ───────────────────────────────────────────────── */
  window.openProductModal = function (idx) {
    var p = filteredProducts[idx];
    if (!p) return;
    var modal = document.getElementById('product-modal');
    var content = document.getElementById('product-modal-content');
    if (!modal || !content) return;

    var hasPrice = p.price && p.price > 0;
    content.innerHTML =
      '<div style="padding:32px;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:300px;">' +
      '<img src="' + escH(p.image) + '" alt="' + escH(p.name) + '" style="max-width:100%;max-height:380px;object-fit:contain;" loading="lazy" onerror="this.src=\'/product-placeholder.jpg\'">' +
      '</div>' +
      '<div style="padding:32px;display:flex;flex-direction:column;">' +
      '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:6px;">' + escH(p.brand) + '</div>' +
      '<h2 style="font-size:1.2rem;font-weight:800;color:black;margin:0 0 8px;line-height:1.3;">' + escH(p.name) + '</h2>' +
      (p.sku ? '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:16px;">SKU: ' + escH(p.sku) + '</div>' : '') +
      (p.upc ? '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:8px;">UPC: ' + escH(p.upc) + '</div>' : '') +
      (p.description ? '<p style="font-size:0.875rem;color:rgba(15,23,42,0.65);line-height:1.6;margin:0 0 20px;">' + escH(p.description) + '</p>' : '') +
      (hasPrice
        ? '<div style="font-size:1.5rem;font-weight:800;color:var(--color-primary-600);margin-bottom:24px;">$' + p.price.toFixed(2) + '</div>'
        : '<div style="font-size:0.875rem;color:rgba(15,23,42,0.5);margin-bottom:24px;">Contact for pricing</div>') +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:auto;">' +
      '<button onclick="addProductToCart(\'' + escH(p.sku) + '\')" class="alloy-button" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>' +
      'Add to Cart' +
      '</button>' +
      '</div>' +
      '</div>';

    modal.style.display = '';
    document.body.style.overflow = 'hidden';
  };

  window.closeProductModal = function () {
    var modal = document.getElementById('product-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeProductModal();
  });

  /* ─── ADD TO CART ─────────────────────────────────────────────────── */
  window.addProductToCart = function (sku) {
    var p = filteredProducts.find(function (x) { return x.sku === sku; }) ||
            allProducts.find(function (x) { return x.sku === sku; });
    if (!p) return;
    if (window.CartManager) {
      window.CartManager.addToCart(p);
    } else {
      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('dtb_cart') || '[]'); } catch (e) {}
      var existing = cart.find(function (i) { return i.sku === sku; });
      if (existing) existing.quantity = (parseInt(existing.quantity) || 1) + 1;
      else cart.push({ sku: p.sku, name: p.name, price: p.price, image: p.image, brand: p.brand, quantity: 1 });
      localStorage.setItem('dtb_cart', JSON.stringify(cart));
      if (window.updateCartCounts) window.updateCartCounts();
      if (window.showToast) window.showToast(p.name + ' added to cart!');
    }
  };

  /* ─── TRENDING PRODUCTS (homepage) ──────────────────────────────── */
  function renderTrendingProducts() {
    var container = document.getElementById('trending-products');
    if (!container) return;

    var trending = allProducts.slice(0, 8);
    if (!trending.length) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(15,23,42,0.4);">No products available.</div>';
      return;
    }

    container.innerHTML = trending.map(function (p, idx) {
      var hasPrice = p.price && p.price > 0;
      return (
        '<div style="background:white;border:1px solid var(--machined-border);border-radius:6px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:all 0.2s;" ' +
        'onmouseover="this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.08)\';this.style.transform=\'translateY(-2px)\'" ' +
        'onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'none\'">' +
        '<div style="aspect-ratio:1/1;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;">' +
        '<img src="' + escH(p.image) + '" alt="' + escH(p.name) + '" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy" onerror="this.src=\'/product-placeholder.jpg\'">' +
        '</div>' +
        '<div style="padding:12px;flex:1;display:flex;flex-direction:column;">' +
        '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-primary-600);margin-bottom:3px;">' + escH(p.brand) + '</div>' +
        '<div style="font-weight:700;font-size:0.825rem;color:black;margin-bottom:auto;line-height:1.3;">' + escH(p.name) + '</div>' +
        '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
        (hasPrice ? '<span style="font-weight:800;font-size:0.875rem;color:var(--color-primary-600);">$' + p.price.toFixed(2) + '</span>' : '<span style="font-size:0.72rem;color:rgba(15,23,42,0.4);">Contact</span>') +
        '<button onclick="addProductToCart(\'' + escH(p.sku) + '\')" style="background:var(--color-primary-600);color:white;border:none;border-radius:3px;padding:5px 9px;font-size:0.68rem;font-weight:700;cursor:pointer;white-space:nowrap;">+ Cart</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ─── INIT ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    fetch(csvUrl)
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var rows = parseCSV(text);
        allProducts = rows
          .map(normalizeProduct)
          .filter(function (p) { return p.name && ALLOWED_BRANDS.indexOf(p.brand) !== -1; });

        // Render trending products on homepage
        renderTrendingProducts();

        // On products page, handle brand param
        if (document.getElementById('brand-selector-grid')) {
          var brandParam = getUrlParam('brand');
          if (brandParam) {
            var decoded = decodeURIComponent(brandParam);
            selectedBrands = decoded.split(',')
              .map(function (b) { return b.trim(); })
              .filter(function (b) { return ALLOWED_BRANDS.indexOf(b) !== -1; });
            if (selectedBrands.length) showCatalog();
          }
        }
      })
      .catch(function (e) { console.warn('DTB: products CSV load error:', e); });
  });

})();
