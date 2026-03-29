<?php
/* Template Name: Cart */
get_header();
?>
<div style="min-height:100vh;background:#f8fafc;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem);" class="section-enter page-wrapper">
    <div style="max-width:1200px;margin:0 auto;">
        <div style="margin-bottom:2rem;">
            <h1 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0 0 8px;letter-spacing:-0.02em;">Shopping Cart</h1>
            <p id="cart-item-count" style="color:rgba(15,23,42,0.5);font-size:0.9rem;margin:0;">0 items in your cart</p>
        </div>

        <!-- Empty state -->
        <div id="cart-empty-state" style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(3rem,8vw,5rem) 2rem;text-align:center;max-width:600px;margin:0 auto;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.15)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 24px;display:block;">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <h2 style="font-size:1.75rem;font-weight:800;color:black;margin:0 0 12px;">Your Cart is Empty</h2>
            <p style="color:rgba(15,23,42,0.5);margin:0 0 32px;line-height:1.6;">Looks like you haven&apos;t added any products to your cart yet.</p>
            <a href="<?php echo esc_url(home_url('/products')); ?>" class="alloy-button" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                Start Shopping
            </a>
        </div>

        <!-- Cart content -->
        <div id="cart-content" style="display:none;">
            <div style="display:grid;grid-template-columns:1fr;gap:24px;" class="cart-layout">
                <!-- Cart items -->
                <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;overflow:hidden;">
                    <div id="cart-page-items"></div>
                </div>
                <a href="<?php echo esc_url(home_url('/products')); ?>" style="display:inline-flex;align-items:center;gap:6px;color:var(--color-primary-600);font-weight:600;font-size:0.875rem;text-decoration:none;">
                    ← Continue Shopping
                </a>
            </div>

            <!-- Order Summary -->
            <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(1.25rem,3vw,1.75rem);margin-top:24px;" id="cart-summary-panel">
                <h2 style="font-size:1.25rem;font-weight:800;color:black;margin:0 0 20px;">Order Summary</h2>
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                    <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.7);">
                        <span>Subtotal:</span>
                        <span id="cart-subtotal-display" style="font-weight:600;">$0.00</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.7);">
                        <span>Shipping:</span>
                        <span id="cart-shipping-display" style="font-weight:600;">$25.00</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.7);">
                        <span>Tax (8%):</span>
                        <span id="cart-tax-display" style="font-weight:600;">$0.00</span>
                    </div>
                </div>
                <div id="shipping-notice" style="background:#fefce8;border:1px solid #fcd34d;border-radius:4px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:10px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    <div style="font-size:0.825rem;">
                        <p style="color:#92400e;font-weight:700;margin:0 0 2px;">Almost there!</p>
                        <p id="shipping-notice-text" style="color:#b45309;margin:0;">Add more to qualify for free shipping</p>
                    </div>
                </div>
                <div style="border-top:1px solid var(--machined-border);padding-top:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:1.1rem;font-weight:800;color:black;">Total:</span>
                    <span id="cart-total" style="font-size:1.4rem;font-weight:800;color:var(--color-primary-600);">$0.00</span>
                </div>
                <a href="<?php echo esc_url(home_url('/checkout')); ?>" class="alloy-button" style="display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;width:100%;box-sizing:border-box;">
                    Proceed to Checkout
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
                <p style="font-size:0.72rem;color:rgba(15,23,42,0.4);text-align:center;margin:12px 0 0;">Secure checkout with SSL encryption</p>
            </div>
        </div>
    </div>
</div>
<style>
@media(min-width:1024px){
    .cart-layout { grid-template-columns: 2fr; }
    #cart-summary-panel { position: sticky; top: 100px; }
}
.quantity-control { display: inline-flex; align-items: center; border: 1px solid var(--machined-border); border-radius: 4px; overflow: hidden; }
.quantity-btn { background: white; border: none; width: 32px; height: 32px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; color: rgba(15,23,42,0.6); transition: background 0.15s; }
.quantity-btn:hover { background: #f1f5f9; }
.quantity-input { border: none; border-left: 1px solid var(--machined-border); border-right: 1px solid var(--machined-border); width: 48px; height: 32px; text-align: center; font-size: 0.875rem; font-weight: 700; color: black; -moz-appearance: textfield; }
.quantity-input::-webkit-outer-spin-button, .quantity-input::-webkit-inner-spin-button { -webkit-appearance: none; }
</style>
<script>
document.addEventListener('DOMContentLoaded', function() {
    renderCartPageFull();
});

function renderCartPageFull() {
    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('dtb_cart') || '[]'); } catch(e){}
    
    var emptyState = document.getElementById('cart-empty-state');
    var cartContent = document.getElementById('cart-content');
    var countEl = document.getElementById('cart-item-count');
    var count = cart.reduce(function(s,i){ return s+(parseInt(i.quantity)||1); },0);
    if (countEl) countEl.textContent = count + ' item' + (count !== 1 ? 's' : '') + ' in your cart';
    
    if (cart.length === 0) {
        if (emptyState) emptyState.style.display = '';
        if (cartContent) cartContent.style.display = 'none';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (cartContent) cartContent.style.display = '';
    
    var container = document.getElementById('cart-page-items');
    if (!container) return;
    
    var subtotal = 0;
    container.innerHTML = cart.map(function(item) {
        var price = parseFloat(item.price) || 0;
        var qty = parseInt(item.quantity) || 1;
        subtotal += price * qty;
        return '<div class="cart-item" style="display:grid;grid-template-columns:80px 1fr auto;gap:16px;align-items:start;padding:20px;border-bottom:1px solid var(--machined-border);" data-sku="'+escHtml(item.sku)+'">' +
            '<div style="width:80px;height:80px;background:#f8fafc;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
            (item.image ? '<img src="'+escHtml(item.image)+'" style="width:100%;height:100%;object-fit:contain;" loading="lazy">' : '') +
            '</div>' +
            '<div>' +
            '<div style="font-size:0.72rem;color:rgba(15,23,42,0.5);margin-bottom:2px;">'+escHtml(item.brand||'')+'</div>' +
            '<div style="font-weight:700;font-size:0.9rem;color:black;margin-bottom:4px;">'+escHtml(item.name)+'</div>' +
            '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:10px;">SKU: '+escHtml(item.sku)+'</div>' +
            '<div class="quantity-control">' +
            '<button class="quantity-btn" onclick="cartChangeQty(\''+escHtml(item.sku)+'\', -1)">−</button>' +
            '<input type="number" class="quantity-input" value="'+qty+'" min="1" onchange="cartSetQty(\''+escHtml(item.sku)+'\', this.value)">' +
            '<button class="quantity-btn" onclick="cartChangeQty(\''+escHtml(item.sku)+'\', 1)">+</button>' +
            '</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
            '<div style="font-weight:800;font-size:1rem;color:var(--color-primary-600);margin-bottom:6px;">$'+(price*qty).toFixed(2)+'</div>' +
            '<div style="font-size:0.72rem;color:rgba(15,23,42,0.4);margin-bottom:8px;">$'+price.toFixed(2)+' ea.</div>' +
            '<button onclick="cartRemoveItem(\''+escHtml(item.sku)+'\')" style="font-size:0.72rem;color:rgba(15,23,42,0.4);background:none;border:none;cursor:pointer;padding:0;">Remove</button>' +
            '</div>' +
            '</div>';
    }).join('');
    
    var shipping = subtotal >= 500 ? 0 : 25;
    var tax = subtotal * 0.08;
    var total = subtotal + shipping + tax;
    
    var sd = document.getElementById('cart-subtotal-display');
    var shd = document.getElementById('cart-shipping-display');
    var td = document.getElementById('cart-tax-display');
    var tot = document.getElementById('cart-total');
    var notice = document.getElementById('shipping-notice');
    var noticeText = document.getElementById('shipping-notice-text');
    
    if (sd) sd.textContent = '$'+subtotal.toFixed(2);
    if (shd) shd.innerHTML = shipping === 0 ? '<span style="color:#16a34a;font-weight:700;">FREE</span>' : '$'+shipping.toFixed(2);
    if (td) td.textContent = '$'+tax.toFixed(2);
    if (tot) tot.textContent = '$'+total.toFixed(2);
    if (notice) {
        if (subtotal >= 500) {
            notice.style.background = '#f0fdf4';
            notice.style.borderColor = '#86efac';
            notice.querySelector('svg').setAttribute('stroke', '#16a34a');
            if (noticeText) { noticeText.parentElement.querySelector('p').textContent = 'Free Shipping!'; noticeText.style.color = '#15803d'; noticeText.textContent = 'You qualify for free shipping!'; }
        } else {
            if (noticeText) noticeText.textContent = 'Add $'+(500-subtotal).toFixed(2)+' more to qualify for free shipping';
        }
    }
}

function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window.cartChangeQty = function(sku, delta) {
    var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
    var item = cart.find(function(i){ return i.sku === sku; });
    if (item) { item.quantity = Math.max(1, (parseInt(item.quantity)||1)+delta); localStorage.setItem('dtb_cart', JSON.stringify(cart)); }
    renderCartPageFull();
    if (window.updateCartCounts) window.updateCartCounts();
};
window.cartSetQty = function(sku, val) {
    var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
    var item = cart.find(function(i){ return i.sku === sku; });
    if (item) { item.quantity = Math.max(1, parseInt(val)||1); localStorage.setItem('dtb_cart', JSON.stringify(cart)); }
    renderCartPageFull();
    if (window.updateCartCounts) window.updateCartCounts();
};
window.cartRemoveItem = function(sku) {
    var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
    cart = cart.filter(function(i){ return i.sku !== sku; });
    localStorage.setItem('dtb_cart', JSON.stringify(cart));
    renderCartPageFull();
    if (window.updateCartCounts) window.updateCartCounts();
};
</script>
<?php get_footer(); ?>
