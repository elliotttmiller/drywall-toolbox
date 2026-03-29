<?php
/* Template Name: Contact */
get_header();
?>
<div style="min-height:100vh;" class="section-enter page-wrapper">

    <!-- HERO STRIP -->
    <section style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%);padding:clamp(48px,8vw,80px) clamp(1.5rem,5vw,3rem) clamp(3rem,6vw,4rem);position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,0.06) 1px,transparent 0);background-size:40px 40px;pointer-events:none;"></div>
        <div style="position:relative;z-index:1;max-width:1400px;margin:0 auto;">
            <div style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:3px;padding:4px 12px;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8);margin-bottom:16px;">
                Get In Touch
            </div>
            <h1 style="color:white;font-size:clamp(2rem,5vw,3.5rem);font-weight:800;margin:0;line-height:1.1;letter-spacing:-0.03em;">
                WE&rsquo;RE HERE TO HELP.
            </h1>
            <p style="color:rgba(255,255,255,0.65);font-size:clamp(0.9rem,2vw,1rem);margin:12px 0 0;max-width:500px;line-height:1.6;">
                Technical support, bulk orders, or custom tool fabrication inquiries — our team of industry veterans has you covered.
            </p>
        </div>
    </section>

    <!-- MAIN CONTENT -->
    <section style="padding:clamp(2.5rem,5vw,4rem) clamp(1.5rem,5vw,3rem);max-width:1400px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(2rem,5vw,4rem);align-items:start;">

            <!-- LEFT: Contact Info -->
            <div>
                <h2 style="font-size:clamp(1.5rem,3vw,2rem);font-weight:800;color:var(--color-primary-600);margin:0 0 8px;letter-spacing:-0.02em;">Contact Information</h2>
                <p style="font-size:0.875rem;color:rgba(15,23,42,0.6);margin:0 0 32px;line-height:1.6;">
                    Reach out directly or use the form and we&apos;ll get back to you within one business day.
                </p>
                <div style="display:flex;flex-direction:column;gap:20px;margin-bottom:32px;">
                    <!-- Email -->
                    <div style="display:flex;align-items:flex-start;gap:16px;">
                        <div style="width:44px;height:44px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--color-primary-600);flex-shrink:0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(15,23,42,0.4);margin-bottom:3px;">Email</div>
                            <a href="mailto:support@drywalltoolbox.com" style="font-size:0.9rem;color:black;text-decoration:none;font-family:var(--font-mono);word-break:break-word;"
                               onmouseover="this.style.color='var(--color-primary-600)'"
                               onmouseout="this.style.color='black'">
                                support@drywalltoolbox.com
                            </a>
                        </div>
                    </div>
                    <!-- Hours -->
                    <div style="display:flex;align-items:flex-start;gap:16px;">
                        <div style="width:44px;height:44px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--color-primary-600);flex-shrink:0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div>
                            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(15,23,42,0.4);margin-bottom:3px;">Hours</div>
                            <div style="font-size:0.9rem;color:black;">Mon &ndash; Fri: 8am &ndash; 6pm EST</div>
                        </div>
                    </div>
                </div>
                <!-- Fast Response badge -->
                <div style="background:white;border:1px solid var(--machined-border);border-radius:4px;padding:20px 24px;display:flex;align-items:center;gap:16px;">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#16a34a;flex-shrink:0;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:0.875rem;color:black;margin-bottom:2px;">Fast Response</div>
                        <div style="font-size:0.775rem;color:rgba(15,23,42,0.5);">We reply within 1 business day</div>
                    </div>
                </div>
            </div>

            <!-- RIGHT: Form -->
            <div style="background:white;border:1px solid var(--machined-border);border-radius:4px;padding:clamp(1.5rem,3vw,2.5rem);">
                <h3 style="font-size:1.1rem;font-weight:700;color:black;margin:0 0 24px;">Send a Message</h3>
                <div id="contact-success" style="display:none;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:16px 20px;margin-bottom:20px;color:#166534;font-size:0.875rem;font-weight:600;">
                    ✓ Message sent! Our engineers will contact you within one business day.
                </div>
                <form id="contact-form">
                    <?php wp_nonce_field('dtb_contact_nonce','dtb_contact_nonce_field'); ?>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Full Name</label>
                        <input type="text" name="contact_name" id="contact_name" placeholder="John Doe" class="machined-input text-black" required style="width:100%;box-sizing:border-box;">
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Inquiry Type</label>
                        <select name="inquiry_type" id="inquiry_type" class="machined-input text-black" required style="width:100%;box-sizing:border-box;cursor:pointer;">
                            <option value="" disabled selected>Select an inquiry type</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="Bulk Order Inquiry">Bulk Order Inquiry</option>
                            <option value="Returns &amp; Warranty">Returns &amp; Warranty</option>
                            <option value="Parts Availability">Parts Availability</option>
                            <option value="Custom Fabrication">Custom Fabrication</option>
                            <option value="General Question">General Question</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:24px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Message</label>
                        <textarea rows="5" name="contact_message" id="contact_message" placeholder="How can we help?" class="machined-textarea text-black" required style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
                    </div>
                    <button type="submit" class="alloy-button" style="width:100%;justify-content:center;">Submit Inquiry</button>
                </form>
            </div>
        </div>
    </section>
</div>

<script>
(function(){
    var form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var data = new FormData(form);
        data.append('action', 'dtb_contact_form');
        fetch(window.DTB && window.DTB.ajaxUrl ? window.DTB.ajaxUrl : '<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
            method: 'POST',
            body: data
        }).then(function(r){ return r.json(); }).then(function(res){
            if (res && res.success) {
                form.reset();
                var s = document.getElementById('contact-success');
                if (s) s.style.display = '';
            } else {
                alert(res && res.data ? res.data : 'Message sent. Our engineers will contact you.');
            }
        }).catch(function(){
            alert('Message sent. Our engineers will contact you.');
        });
    });
})();
</script>
<?php get_footer(); ?>
