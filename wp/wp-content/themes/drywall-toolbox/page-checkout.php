<?php
/* Template Name: Checkout */
get_header();
?>
<div style="min-height:100vh;background:#f8fafc;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem);" class="section-enter page-wrapper">
    <div style="max-width:1200px;margin:0 auto;">

        <!-- Empty cart state -->
        <div id="checkout-empty-state" style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(3rem,8vw,5rem) 2rem;text-align:center;max-width:600px;margin:0 auto;display:none;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.15)" stroke-width="1.2" style="margin:0 auto 24px;display:block;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            <h2 style="font-size:1.75rem;font-weight:800;color:black;margin:0 0 12px;">Your Cart is Empty</h2>
            <p style="color:rgba(15,23,42,0.5);margin:0 0 32px;line-height:1.6;">Add some products to your cart before checking out.</p>
            <a href="<?php echo esc_url(home_url('/products')); ?>" class="alloy-button" style="display:inline-block;text-decoration:none;">Continue Shopping</a>
        </div>

        <!-- Order complete state -->
        <div id="checkout-complete-state" style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(3rem,8vw,5rem) 2rem;text-align:center;max-width:600px;margin:0 auto;display:none;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" style="margin:0 auto 24px;display:block;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h2 style="font-size:1.75rem;font-weight:800;color:black;margin:0 0 12px;">Order Complete!</h2>
            <p style="color:rgba(15,23,42,0.5);margin:0 0 32px;line-height:1.6;">Thank you for your order. A confirmation email has been sent.</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                <a href="<?php echo esc_url(home_url('/products')); ?>" class="alloy-button" style="text-decoration:none;">Continue Shopping</a>
                <a href="<?php echo esc_url(home_url('/')); ?>" style="display:inline-block;border:1px solid var(--machined-border);border-radius:4px;padding:12px 24px;font-size:0.875rem;font-weight:700;color:black;text-decoration:none;background:white;">Back to Home</a>
            </div>
        </div>

        <!-- Checkout form -->
        <div id="checkout-form-state">
            <div style="margin-bottom:2rem;">
                <h1 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0 0 8px;letter-spacing:-0.02em;">Checkout</h1>
                <p style="color:rgba(15,23,42,0.5);font-size:0.9rem;margin:0;">Complete your order</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:24px;" class="checkout-layout">
                <!-- LEFT: Form -->
                <div style="display:flex;flex-direction:column;gap:20px;">
                    <!-- Customer Info -->
                    <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(1.25rem,3vw,1.75rem);">
                        <h2 style="font-size:1.1rem;font-weight:800;color:black;margin:0 0 20px;">Customer Information</h2>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">First Name <span style="color:#ef4444;">*</span></label>
                                <input type="text" id="co_firstName" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="John" required>
                                <p id="err_firstName" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                            </div>
                            <div>
                                <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Last Name <span style="color:#ef4444;">*</span></label>
                                <input type="text" id="co_lastName" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="Doe" required>
                                <p id="err_lastName" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                            </div>
                        </div>
                        <div style="margin-top:16px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Email <span style="color:#ef4444;">*</span></label>
                            <input type="email" id="co_email" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="john@example.com" required>
                            <p id="err_email" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                        </div>
                        <div style="margin-top:16px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Phone <span style="color:#ef4444;">*</span></label>
                            <input type="tel" id="co_phone" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="(555) 000-0000" required>
                            <p id="err_phone" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                        </div>
                    </div>
                    <!-- Shipping Address -->
                    <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(1.25rem,3vw,1.75rem);">
                        <h2 style="font-size:1.1rem;font-weight:800;color:black;margin:0 0 20px;">Shipping Address</h2>
                        <div>
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Street Address <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="co_address" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="123 Main St" required>
                            <p id="err_address" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
                            <div>
                                <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">City <span style="color:#ef4444;">*</span></label>
                                <input type="text" id="co_city" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="New York" required>
                                <p id="err_city" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                            </div>
                            <div>
                                <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">State <span style="color:#ef4444;">*</span></label>
                                <input type="text" id="co_state" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="NY" required>
                                <p id="err_state" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                            </div>
                        </div>
                        <div style="margin-top:16px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">ZIP Code <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="co_zip" class="machined-input text-black" style="width:100%;box-sizing:border-box;max-width:200px;" placeholder="10001" required>
                            <p id="err_zip" style="color:#ef4444;font-size:0.72rem;margin:4px 0 0;display:none;"></p>
                        </div>
                    </div>
                    <!-- Payment Method -->
                    <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(1.25rem,3vw,1.75rem);">
                        <h2 style="font-size:1.1rem;font-weight:800;color:black;margin:0 0 20px;">Payment Method</h2>
                        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                            <label style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid var(--color-primary-600);border-radius:6px;cursor:pointer;background:#eff6ff;">
                                <input type="radio" name="payment_method" value="card" checked style="accent-color:var(--color-primary-600);">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                <span style="font-weight:700;font-size:0.875rem;color:black;">Credit / Debit Card</span>
                            </label>
                            <label style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--machined-border);border-radius:6px;cursor:pointer;background:white;">
                                <input type="radio" name="payment_method" value="purchase_order" style="accent-color:var(--color-primary-600);">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span style="font-weight:700;font-size:0.875rem;color:black;">Purchase Order</span>
                            </label>
                        </div>
                        <div id="card-fields">
                            <div style="margin-bottom:16px;">
                                <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Card Number <span style="color:#ef4444;">*</span></label>
                                <input type="text" id="co_cardNumber" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="4242 4242 4242 4242" maxlength="19">
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                                <div style="grid-column:span 1;">
                                    <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Expiry <span style="color:#ef4444;">*</span></label>
                                    <input type="text" id="co_cardExpiry" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="MM/YY" maxlength="5">
                                </div>
                                <div>
                                    <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">CVC <span style="color:#ef4444;">*</span></label>
                                    <input type="text" id="co_cardCvc" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="123" maxlength="4">
                                </div>
                                <div>
                                    <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Name on Card <span style="color:#ef4444;">*</span></label>
                                    <input type="text" id="co_cardName" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="John Doe">
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Place Order -->
                    <button id="place-order-btn" type="button" onclick="placeOrder()" class="alloy-button" style="width:100%;justify-content:center;display:flex;align-items:center;gap:8px;font-size:1rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        Place Order
                    </button>
                </div>
                <!-- RIGHT: Order Summary -->
                <div style="background:white;border:1px solid var(--machined-border);border-radius:8px;padding:clamp(1.25rem,3vw,1.75rem);align-self:start;position:sticky;top:100px;">
                    <h2 style="font-size:1.1rem;font-weight:800;color:black;margin:0 0 20px;">Order Summary</h2>
                    <div id="checkout-order-items" style="margin-bottom:16px;"></div>
                    <div style="border-top:1px solid var(--machined-border);padding-top:16px;display:flex;flex-direction:column;gap:10px;">
                        <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.6);font-size:0.875rem;">
                            <span>Subtotal</span><span id="co_subtotal" style="font-weight:600;">$0.00</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.6);font-size:0.875rem;">
                            <span>Shipping</span><span id="co_shipping" style="font-weight:600;">$25.00</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;color:rgba(15,23,42,0.6);font-size:0.875rem;">
                            <span>Tax (8%)</span><span id="co_tax" style="font-weight:600;">$0.00</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--machined-border);">
                            <span style="font-weight:800;color:black;font-size:1rem;">Total</span>
                            <span id="checkout-total" style="font-weight:800;color:var(--color-primary-600);font-size:1.25rem;">$0.00</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px;color:rgba(15,23,42,0.4);font-size:0.72rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        Secure checkout with SSL encryption
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<style>
@media(min-width:1024px){
    .checkout-layout { grid-template-columns: 2fr 1fr; }
}
</style>
<script>
document.addEventListener('DOMContentLoaded', function() {
    initCheckout();
    // Payment method radio toggle
    document.querySelectorAll('input[name="payment_method"]').forEach(function(r) {
        r.addEventListener('change', function() {
            var cardFields = document.getElementById('card-fields');
            if (cardFields) cardFields.style.display = this.value === 'card' ? '' : 'none';
            document.querySelectorAll('input[name="payment_method"]').forEach(function(radio) {
                radio.closest('label').style.border = radio.checked ? '2px solid var(--color-primary-600)' : '1px solid var(--machined-border)';
                radio.closest('label').style.background = radio.checked ? '#eff6ff' : 'white';
            });
        });
    });
    // Card number formatting
    var cn = document.getElementById('co_cardNumber');
    if (cn) cn.addEventListener('input', function() {
        var v = this.value.replace(/\D/g,'').slice(0,16);
        this.value = v.replace(/(\d{4})(?=\d)/g,'$1 ');
    });
    var ce = document.getElementById('co_cardExpiry');
    if (ce) ce.addEventListener('input', function() {
        var v = this.value.replace(/\D/g,'').slice(0,4);
        if (v.length >= 3) v = v.slice(0,2)+'/'+v.slice(2);
        this.value = v;
    });
});

function initCheckout() {
    var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
    var emptyState = document.getElementById('checkout-empty-state');
    var formState = document.getElementById('checkout-form-state');
    if (cart.length === 0) {
        if (emptyState) emptyState.style.display = '';
        if (formState) formState.style.display = 'none';
        return;
    }
    renderCheckoutSummaryPage();
}

function renderCheckoutSummaryPage() {
    var cart = []; try { cart = JSON.parse(localStorage.getItem('dtb_cart')||'[]'); } catch(e){}
    var container = document.getElementById('checkout-order-items');
    if (!container) return;
    var subtotal = 0;
    container.innerHTML = cart.map(function(item) {
        var price = parseFloat(item.price)||0;
        var qty = parseInt(item.quantity)||1;
        subtotal += price*qty;
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--machined-border);">' +
            '<div><div style="font-size:0.85rem;font-weight:600;color:black;">'+escHtmlCo(item.name)+'</div>' +
            '<div style="font-size:0.72rem;color:rgba(15,23,42,0.5);">Qty: '+qty+'</div></div>' +
            '<div style="font-weight:700;color:var(--color-primary-600);">$'+(price*qty).toFixed(2)+'</div>' +
            '</div>';
    }).join('');
    var shipping = subtotal >= 500 ? 0 : 25;
    var tax = subtotal * 0.08;
    var total = subtotal + shipping + tax;
    var sub = document.getElementById('co_subtotal');
    var sh = document.getElementById('co_shipping');
    var tx = document.getElementById('co_tax');
    var tot = document.getElementById('checkout-total');
    if (sub) sub.textContent = '$'+subtotal.toFixed(2);
    if (sh) sh.innerHTML = shipping === 0 ? '<span style="color:#16a34a;">FREE</span>' : '$'+shipping.toFixed(2);
    if (tx) tx.textContent = '$'+tax.toFixed(2);
    if (tot) tot.textContent = '$'+total.toFixed(2);
}

function escHtmlCo(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.placeOrder = function() {
    var errs = [];
    var fields = [
        {id:'co_firstName',msg:'First name is required'},
        {id:'co_lastName',msg:'Last name is required'},
        {id:'co_email',msg:'Email is required'},
        {id:'co_phone',msg:'Phone is required'},
        {id:'co_address',msg:'Address is required'},
        {id:'co_city',msg:'City is required'},
        {id:'co_state',msg:'State is required'},
        {id:'co_zip',msg:'ZIP code is required'},
    ];
    // Hide all errors first
    fields.forEach(function(f){
        var ep = document.getElementById('err_'+f.id.replace('co_',''));
        if (ep) { ep.style.display='none'; ep.textContent=''; }
    });
    fields.forEach(function(f){
        var el = document.getElementById(f.id);
        var ep = document.getElementById('err_'+f.id.replace('co_',''));
        if (el && !el.value.trim()) {
            errs.push(f.msg);
            if (ep) { ep.style.display=''; ep.textContent=f.msg; }
            if (!errs.length) el.focus();
        }
    });
    var emailEl = document.getElementById('co_email');
    if (emailEl && emailEl.value && !/\S+@\S+\.\S+/.test(emailEl.value)) {
        errs.push('Invalid email');
        var ep = document.getElementById('err_email');
        if (ep) { ep.style.display=''; ep.textContent='Please enter a valid email address'; }
    }
    var payMethod = document.querySelector('input[name="payment_method"]:checked');
    if (payMethod && payMethod.value === 'card') {
        ['co_cardNumber','co_cardExpiry','co_cardCvc','co_cardName'].forEach(function(id){
            var el = document.getElementById(id);
            if (el && !el.value.trim()) errs.push(id+' is required');
        });
    }
    if (errs.length) return;
    
    var btn = document.getElementById('place-order-btn');
    if (btn) { btn.disabled=true; btn.textContent='Processing...'; }
    
    setTimeout(function() {
        localStorage.removeItem('dtb_cart');
        if (window.updateCartCounts) window.updateCartCounts();
        var formState = document.getElementById('checkout-form-state');
        var completeState = document.getElementById('checkout-complete-state');
        if (formState) formState.style.display='none';
        if (completeState) completeState.style.display='';
    }, 1500);
};
</script>
<?php get_footer(); ?>
