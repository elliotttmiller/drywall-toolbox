<?php
/* Template Name: Repairs */
get_header();
?>
<div style="min-height:100vh;" class="section-enter page-wrapper">

    <!-- HERO -->
    <section style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%);padding:clamp(60px,10vw,100px) clamp(1.5rem,5vw,3rem);position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:radial-gradient(circle at 2px 2px,rgba(255,255,255,0.06) 1px,transparent 0);background-size:40px 40px;pointer-events:none;"></div>
        <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;background:radial-gradient(circle,rgba(96,165,250,0.15) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="position:relative;z-index:1;max-width:1400px;margin:0 auto;">
            <div style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:3px;padding:4px 12px;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8);margin-bottom:20px;">
                Tool Repair &amp; Maintenance
            </div>
            <h1 style="color:white;font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;margin:0 0 16px;line-height:1.1;letter-spacing:-0.03em;">
                KEEP YOUR TOOLS<br><span style="color:#93c5fd;">RUNNING STRONG.</span>
            </h1>
            <p style="color:rgba(255,255,255,0.7);font-size:clamp(0.95rem,2vw,1.1rem);max-width:600px;line-height:1.6;margin:0 0 32px;">
                Professional repair and maintenance services for all your drywall tools. From emergency fixes to scheduled maintenance — we keep your crew working.
            </p>
            <button class="alloy-button" style="background:white;color:#1e3a8a;border:none;cursor:pointer;" onclick="document.getElementById('repair-form-section').scrollIntoView({behavior:'smooth'})">
                Request Repair Service
            </button>
        </div>
    </section>

    <!-- SERVICE CARDS -->
    <section style="padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem);max-width:1400px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:clamp(2rem,4vw,3rem);">
            <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:var(--color-primary-600);margin:0 0 12px;letter-spacing:-0.02em;">Our Repair Services</h2>
            <p style="color:rgba(15,23,42,0.6);font-size:1rem;margin:0;">Comprehensive coverage for all professional drywall equipment</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;">
            <?php
            $services = [
                [
                    'title' => 'Preventative Maintenance',
                    'desc'  => 'Scheduled inspections, lubrication, seal replacements, and performance tuning to keep tools running at peak condition.',
                    'items' => ['Seasonal equipment inspections','Lubrication & fluid replacement','Seal & gasket replacements','Calibration & adjustment'],
                ],
                [
                    'title' => 'Emergency Repairs',
                    'desc'  => 'When your tools stop working on the job, our technicians diagnose and resolve issues fast — same-day diagnostics available.',
                    'items' => ['Same-day diagnostics','Expedited repair turnaround','24/7 emergency support','Field service available'],
                ],
                [
                    'title' => 'Warranty & Extended Coverage',
                    'desc'  => 'Protect your investment with manufacturer warranties and extended coverage plans for professional equipment.',
                    'items' => ['Extended manufacturer warranties','Accidental damage coverage','Parts & labor protection','Annual inspection plans'],
                ],
            ];
            foreach ($services as $svc ) : ?>
            <div style="background:white;border:1px solid var(--machined-border);border-radius:4px;padding:clamp(1.5rem,3vw,2rem);transition:box-shadow 0.2s,transform 0.2s;"
                 onmouseover="this.style.boxShadow='0 8px 32px rgba(37,99,235,0.1)';this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
                <h3 style="font-size:1.05rem;font-weight:700;color:black;margin:0 0 10px;"><?php echo esc_html( $svc['title'] ); ?></h3>
                <p style="font-size:0.85rem;color:rgba(15,23,42,0.6);margin:0 0 16px;line-height:1.6;"><?php echo esc_html( $svc['desc'] ); ?></p>
                <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">
                    <?php foreach ( $svc['items'] as $item ) : ?>
                    <li style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:rgba(15,23,42,0.7);">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <?php echo esc_html( $item ); ?>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- REPAIR REQUEST FORM -->
    <section id="repair-form-section" style="background:var(--alloy-base,#f8fafc);border-top:1px solid var(--machined-border);border-bottom:1px solid var(--machined-border);padding:clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem);">
        <div style="max-width:900px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:clamp(2rem,4vw,3rem);">
                <div style="display:inline-block;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:3px;padding:4px 12px;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-primary-600);margin-bottom:14px;">
                    Repair Service Request
                </div>
                <h2 style="font-size:clamp(1.75rem,4vw,2.5rem);font-weight:800;color:black;margin:0 0 12px;letter-spacing:-0.02em;">Submit a Repair Inquiry</h2>
                <p style="font-size:clamp(0.875rem,2vw,1rem);color:rgba(15,23,42,0.55);margin:0;line-height:1.6;">
                    Fill out the form below and our service team will follow up within one business day with a quote and estimated turnaround time.
                </p>
            </div>

            <!-- Success state -->
            <div id="repair-success" style="display:none;background:white;border:1px solid var(--machined-border);border-radius:4px;padding:clamp(2rem,5vw,4rem);text-align:center;">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" style="margin:0 auto 20px;display:block;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <h3 style="font-size:1.5rem;font-weight:800;color:black;margin:0 0 12px;">Request Submitted!</h3>
                <p style="color:rgba(15,23,42,0.55);margin:0 0 24px;line-height:1.6;">Our service team will contact you within one business day to discuss your repair options and provide a quote.</p>
                <button onclick="resetRepairForm()" class="alloy-button" style="cursor:pointer;">Submit Another Request</button>
            </div>

            <!-- Form card -->
            <div id="repair-form-card" style="background:white;border:1px solid var(--machined-border);border-radius:4px;padding:clamp(1.5rem,4vw,2.5rem);">
                <!-- Progress Bar -->
                <div id="repair-progress" style="margin-bottom:32px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:4px;">
                        <?php
                        $steps = [
                            [ 'id' => 1, 'label' => 'Contact Info',    'short' => 'Contact' ],
                            [ 'id' => 2, 'label' => 'Tool Details',    'short' => 'Tool'    ],
                            [ 'id' => 3, 'label' => 'Service Request', 'short' => 'Service' ],
                            [ 'id' => 4, 'label' => 'Review & Submit', 'short' => 'Review'  ],
                        ];
                        foreach ( $steps as $s ) : ?>
                        <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:6px;" class="repair-step-indicator" data-step="<?php echo $s['id']; ?>">
                            <div class="repair-step-circle" style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.78rem;transition:all 0.3s;border:2px solid rgba(15,23,42,0.15);background:white;color:rgba(15,23,42,0.35);flex-shrink:0;">
                                <?php echo $s['id']; ?>
                            </div>
                            <span class="repair-step-label" style="font-size:clamp(0.6rem,1.5vw,0.72rem);font-weight:500;color:rgba(15,23,42,0.3);white-space:nowrap;letter-spacing:0.02em;"><?php echo esc_html( $s['short'] ); ?></span>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <div style="height:4px;background:rgba(15,23,42,0.08);border-radius:99px;overflow:hidden;">
                        <div id="repair-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--color-primary-600),#3b82f6);border-radius:99px;transition:width 0.45s cubic-bezier(0.16,1,0.3,1);"></div>
                    </div>
                </div>

                <!-- Step 1: Contact Info -->
                <div id="repair-step-1" class="repair-step-panel">
                    <h3 style="font-size:1.1rem;font-weight:700;color:black;margin:0 0 6px;">Contact Information</h3>
                    <p style="font-size:0.825rem;color:rgba(15,23,42,0.5);margin:0 0 28px;">Let us know who we&apos;re speaking with so we can follow up with you.</p>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Full Name <span style="color:#ef4444;">*</span></label>
                        <input type="text" id="r_fullName" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="Jane Smith">
                        <p id="r_err_fullName" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Email Address <span style="color:#ef4444;">*</span></label>
                        <input type="email" id="r_email" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="jane@company.com">
                        <p id="r_err_email" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Phone Number <span style="color:#ef4444;">*</span></label>
                        <input type="tel" id="r_phone" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="(555) 000-0000">
                        <p id="r_err_phone" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Company / Contractor Name</label>
                        <input type="text" id="r_company" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="Acme Drywall Co.">
                    </div>
                </div>

                <!-- Step 2: Tool Details -->
                <div id="repair-step-2" class="repair-step-panel" style="display:none;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:black;margin:0 0 6px;">Tool Details</h3>
                    <p style="font-size:0.825rem;color:rgba(15,23,42,0.5);margin:0 0 28px;">Tell us about the Columbia tool that needs service. Accurate information helps us prepare the right parts and expertise.</p>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Tool Category <span style="color:#ef4444;">*</span></label>
                        <select id="r_toolCategory" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;" onchange="updateToolModels()">
                            <option value="" disabled selected>Select a tool category&hellip;</option>
                            <option value="Angleheads">Angleheads</option>
                            <option value="Applicators">Applicators</option>
                            <option value="Automatic Tapers">Automatic Tapers</option>
                            <option value="Compound Tubes">Compound Tubes</option>
                            <option value="Corner Boxes">Corner Boxes</option>
                            <option value="Corner Flushers">Corner Flushers</option>
                            <option value="Corner Rollers">Corner Rollers</option>
                            <option value="Finishing Boxes">Finishing Boxes</option>
                            <option value="Handles">Handles</option>
                            <option value="Nailspotters">Nailspotters</option>
                            <option value="Pumps">Pumps</option>
                            <option value="Sanders">Sanders</option>
                            <option value="Semi-Automatic Tapers">Semi-Automatic Tapers</option>
                            <option value="Smoothing Blades">Smoothing Blades</option>
                        </select>
                        <p id="r_err_toolCategory" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Tool Model <span style="color:#ef4444;">*</span></label>
                        <select id="r_toolModel" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;" disabled>
                            <option value="" disabled selected>Select a category first&hellip;</option>
                        </select>
                        <p id="r_err_toolModel" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 20px;">
                        <div class="form-group" style="margin-bottom:20px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Serial Number</label>
                            <p style="font-size:0.72rem;color:rgba(15,23,42,0.45);margin:0 0 6px;">Optional — found on the tool body or original packaging</p>
                            <input type="text" id="r_serialNumber" class="machined-input text-black" style="width:100%;box-sizing:border-box;" placeholder="e.g. COL-2024-XXXXX">
                        </div>
                        <div class="form-group" style="margin-bottom:20px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Approximate Tool Age</label>
                            <select id="r_toolAge" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;">
                                <option value="">Unknown / Not sure</option>
                                <option value="Under 1 year">Under 1 year</option>
                                <option value="1–3 years">1–3 years</option>
                                <option value="3–5 years">3–5 years</option>
                                <option value="5–10 years">5–10 years</option>
                                <option value="10+ years">10+ years</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Service Request -->
                <div id="repair-step-3" class="repair-step-panel" style="display:none;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:black;margin:0 0 6px;">Service Request Details</h3>
                    <p style="font-size:0.825rem;color:rgba(15,23,42,0.5);margin:0 0 28px;">Tell us what kind of service you need and describe the issue in as much detail as possible.</p>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 20px;">
                        <div class="form-group" style="margin-bottom:20px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Service Type <span style="color:#ef4444;">*</span></label>
                            <select id="r_serviceType" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;">
                                <option value="" disabled selected>Select service type&hellip;</option>
                                <option value="Preventative Maintenance">Preventative Maintenance</option>
                                <option value="General Repair">General Repair</option>
                                <option value="Emergency Repair">Emergency Repair</option>
                                <option value="Warranty Claim">Warranty Claim</option>
                                <option value="Calibration / Adjustment">Calibration / Adjustment</option>
                                <option value="Parts Replacement Only">Parts Replacement Only</option>
                                <option value="Full Overhaul / Rebuild">Full Overhaul / Rebuild</option>
                            </select>
                            <p id="r_err_serviceType" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                        </div>
                        <div class="form-group" style="margin-bottom:20px;">
                            <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Priority Level <span style="color:#ef4444;">*</span></label>
                            <select id="r_priority" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;">
                                <option value="" disabled selected>Select priority&hellip;</option>
                                <option value="Standard (5–7 business days)">Standard — 5–7 business days</option>
                                <option value="Expedited (2–3 business days)">Expedited — 2–3 business days</option>
                                <option value="Emergency (same/next day)">Emergency — same / next day</option>
                            </select>
                            <p id="r_err_priority" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">When Did the Issue Start?</label>
                        <select id="r_issueStart" class="machined-input text-black" style="width:100%;box-sizing:border-box;cursor:pointer;">
                            <option value="">Not sure / N/A</option>
                            <option value="Today">Today</option>
                            <option value="This week">This week</option>
                            <option value="This month">This month</option>
                            <option value="1–3 months ago">1–3 months ago</option>
                            <option value="More than 3 months ago">More than 3 months ago</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Issue Description <span style="color:#ef4444;">*</span></label>
                        <p style="font-size:0.72rem;color:rgba(15,23,42,0.45);margin:0 0 6px;">Describe what&apos;s wrong, any symptoms, sounds, leaks, or damage you&apos;ve noticed</p>
                        <textarea rows="5" id="r_issueDescription" class="machined-textarea text-black" style="width:100%;box-sizing:border-box;resize:vertical;min-height:110px;" placeholder="e.g. The pump is losing pressure mid-use, the valve seal appears to be leaking at the base connection…"></textarea>
                        <p id="r_err_issueDescription" style="color:#ef4444;font-size:0.78rem;margin:5px 0 0;display:none;"></p>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Preferred Contact Method</label>
                        <div style="display:flex;gap:24px;flex-wrap:wrap;padding-top:4px;">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;color:black;">
                                <input type="radio" name="r_contactPref" value="email" checked style="accent-color:var(--color-primary-600);width:16px;height:16px;"> Email
                            </label>
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;color:black;">
                                <input type="radio" name="r_contactPref" value="phone" style="accent-color:var(--color-primary-600);width:16px;height:16px;"> Phone Call
                            </label>
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;color:black;">
                                <input type="radio" name="r_contactPref" value="either" style="accent-color:var(--color-primary-600);width:16px;height:16px;"> Either
                            </label>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="machined-label" style="color:var(--color-primary-600);display:block;margin-bottom:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Additional Notes</label>
                        <p style="font-size:0.72rem;color:rgba(15,23,42,0.45);margin:0 0 6px;">Optional — anything else we should know</p>
                        <textarea rows="3" id="r_additionalNotes" class="machined-textarea text-black" style="width:100%;box-sizing:border-box;resize:vertical;min-height:80px;" placeholder="Any special instructions, previous repair history, or photos you&apos;d like to reference…"></textarea>
                    </div>
                </div>

                <!-- Step 4: Review & Submit -->
                <div id="repair-step-4" class="repair-step-panel" style="display:none;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:black;margin:0 0 6px;">Review Your Request</h3>
                    <p style="font-size:0.825rem;color:rgba(15,23,42,0.5);margin:0 0 28px;">Please review the details below before submitting. Use the Back button to make any changes.</p>
                    <div id="repair-review-contact" style="background:var(--alloy-base,#f8fafc);border:1px solid var(--machined-border);border-radius:6px;padding:16px 20px;margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:8px;">Contact Information</div>
                        <div id="review-contact-rows"></div>
                    </div>
                    <div id="repair-review-tool" style="background:var(--alloy-base,#f8fafc);border:1px solid var(--machined-border);border-radius:6px;padding:16px 20px;margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:8px;">Tool Details</div>
                        <div id="review-tool-rows"></div>
                    </div>
                    <div id="repair-review-service" style="background:var(--alloy-base,#f8fafc);border:1px solid var(--machined-border);border-radius:6px;padding:16px 20px;margin-bottom:24px;">
                        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-primary-600);margin-bottom:8px;">Service Request</div>
                        <div id="review-service-rows"></div>
                    </div>
                    <p style="font-size:0.78rem;color:rgba(15,23,42,0.45);line-height:1.6;margin:0 0 8px;">
                        By submitting this request you agree that our service team may contact you via your preferred method to discuss repair options, pricing, and scheduling. No charges are incurred until you approve a quote.
                    </p>
                </div>

                <!-- Navigation Buttons -->
                <div id="repair-nav-buttons" style="display:flex;justify-content:flex-end;align-items:center;margin-top:28px;gap:12px;flex-wrap:wrap;">
                    <button id="repair-back-btn" type="button" onclick="repairBack()" style="display:none;flex-shrink:0;align-items:center;gap:6px;background:transparent;border:1px solid var(--machined-border);border-radius:3px;padding:12px 20px;font-size:0.825rem;font-weight:700;color:rgba(15,23,42,0.6);cursor:pointer;transition:all 0.2s;letter-spacing:0.04em;"
                        onmouseover="this.style.borderColor='rgba(15,23,42,0.35)';this.style.color='black'"
                        onmouseout="this.style.borderColor='var(--machined-border)';this.style.color='rgba(15,23,42,0.6)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                        Back
                    </button>
                    <button id="repair-next-btn" type="button" onclick="repairNext()" class="alloy-button" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                        Continue
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                    <button id="repair-submit-btn" type="button" onclick="repairSubmit()" class="alloy-button" style="display:none;align-items:center;gap:6px;cursor:pointer;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Submit Repair Request
                    </button>
                </div>
            </div>
        </div>
    </section>
</div>

<script>
(function() {
    var COLUMBIA_PRODUCTS = {
        'Angleheads':            ['AngleHead'],
        'Applicators':           ['External Corner Applicator','Inside Corner Applicator','Two-Way Internal Corner Applicator'],
        'Automatic Tapers':      ['Predator Automatic Taper'],
        'Compound Tubes':        ['CamLock Tube','Compound Tube'],
        'Corner Boxes':          ['Throttle Box'],
        'Corner Flushers':       ['Combo Flusher','Direct Corner Flusher','Standard Corner Flusher'],
        'Corner Rollers':        ['Corner Cobra','Inside Corner Roller','Standard Outside Corner Roller'],
        'Finishing Boxes':       ['Automatic Flat Box','Fat Boy Box','Flat Box'],
        'Handles':               ['Closet Monster Handle','Columbia One Handle','Flat Box Handle','Long Extendable Handle','Matrix Box Handle'],
        'Nailspotters':          ['Nailspotter'],
        'Pumps':                 ['Box Filler Pump','Gooseneck Adapter','Mud Pump','Tall Boy Mud Pump'],
        'Sanders':               ['Sander Head'],
        'Semi-Automatic Tapers': ['Semi-Automatic Taper'],
        'Smoothing Blades':      ['Tomahawk Smoothing Blades'],
    };

    var currentStep = 1;
    var totalSteps = 4;

    window.updateToolModels = function() {
        var catSel = document.getElementById('r_toolCategory');
        var modelSel = document.getElementById('r_toolModel');
        if (!catSel || !modelSel) return;
        var cat = catSel.value;
        modelSel.disabled = !cat;
        modelSel.innerHTML = '<option value="" disabled selected>' + (cat ? 'Select the specific model\u2026' : 'Select a category first\u2026') + '</option>';
        if (cat && COLUMBIA_PRODUCTS[cat]) {
            COLUMBIA_PRODUCTS[cat].forEach(function(m) {
                var opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                modelSel.appendChild(opt);
            });
        }
    };

    function updateProgressUI() {
        var pct = ((currentStep - 1) / (totalSteps - 1)) * 100;
        var bar = document.getElementById('repair-progress-bar');
        if (bar) bar.style.width = pct + '%';

        for (var s = 1; s <= totalSteps; s++) {
            var indicators = document.querySelectorAll('.repair-step-indicator[data-step="'+s+'"]');
            indicators.forEach(function(ind) {
                var circle = ind.querySelector('.repair-step-circle');
                var label = ind.querySelector('.repair-step-label');
                if (s < currentStep) {
                    circle.style.border = '2px solid var(--color-primary-600)';
                    circle.style.background = 'var(--color-primary-600)';
                    circle.style.color = 'white';
                    circle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                    if (label) { label.style.fontWeight='500'; label.style.color='rgba(15,23,42,0.55)'; }
                } else if (s === currentStep) {
                    circle.style.border = '2px solid var(--color-primary-600)';
                    circle.style.background = '#eff6ff';
                    circle.style.color = 'var(--color-primary-600)';
                    circle.innerHTML = s;
                    if (label) { label.style.fontWeight='700'; label.style.color='var(--color-primary-600)'; }
                } else {
                    circle.style.border = '2px solid rgba(15,23,42,0.15)';
                    circle.style.background = 'white';
                    circle.style.color = 'rgba(15,23,42,0.35)';
                    circle.innerHTML = s;
                    if (label) { label.style.fontWeight='500'; label.style.color='rgba(15,23,42,0.3)'; }
                }
            });
        }

        var backBtn   = document.getElementById('repair-back-btn');
        var nextBtn   = document.getElementById('repair-next-btn');
        var submitBtn = document.getElementById('repair-submit-btn');
        var navContainer = document.getElementById('repair-nav-buttons');
        if (backBtn)      backBtn.style.display      = currentStep > 1 ? 'inline-flex' : 'none';
        if (navContainer) navContainer.style.justifyContent = currentStep === 1 ? 'flex-end' : 'space-between';
        if (nextBtn)      nextBtn.style.display      = currentStep < 4 ? 'inline-flex' : 'none';
        if (submitBtn)    submitBtn.style.display    = currentStep === 4 ? 'inline-flex' : 'none';
    }

    function showStep(s) {
        for (var i = 1; i <= totalSteps; i++) {
            var panel = document.getElementById('repair-step-'+i);
            if (panel) panel.style.display = i === s ? '' : 'none';
        }
        currentStep = s;
        updateProgressUI();
        var card = document.getElementById('repair-form-card');
        if (card) card.scrollIntoView({behavior:'smooth', block:'start'});
    }

    function clearErrors() {
        document.querySelectorAll('[id^="r_err_"]').forEach(function(el) {
            el.style.display='none'; el.textContent='';
        });
    }

    function showError(id, msg) {
        var el = document.getElementById('r_err_'+id);
        if (el) { el.style.display=''; el.textContent=msg; }
    }

    function validate(step) {
        clearErrors();
        var valid = true;
        if (step === 1) {
            var fn = document.getElementById('r_fullName');
            if (!fn || !fn.value.trim()) { showError('fullName','Full name is required.'); valid=false; }
            var em = document.getElementById('r_email');
            if (!em || !em.value.trim()) { showError('email','Email is required.'); valid=false; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)) { showError('email','Enter a valid email address.'); valid=false; }
            var ph = document.getElementById('r_phone');
            if (!ph || !ph.value.trim()) { showError('phone','Phone number is required.'); valid=false; }
        }
        if (step === 2) {
            var tc = document.getElementById('r_toolCategory');
            if (!tc || !tc.value) { showError('toolCategory','Please select a tool category.'); valid=false; }
            var tm = document.getElementById('r_toolModel');
            if (tc && tc.value && (!tm || !tm.value)) { showError('toolModel','Please select the tool model.'); valid=false; }
        }
        if (step === 3) {
            var st = document.getElementById('r_serviceType');
            if (!st || !st.value) { showError('serviceType','Please select a service type.'); valid=false; }
            var pr = document.getElementById('r_priority');
            if (!pr || !pr.value) { showError('priority','Please select a priority level.'); valid=false; }
            var desc = document.getElementById('r_issueDescription');
            if (!desc || !desc.value.trim()) { showError('issueDescription','Please describe the issue.'); valid=false; }
        }
        return valid;
    }

    function makeReviewRow(label, value) {
        if (!value) return '';
        return '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(15,23,42,0.06);">' +
            '<span style="min-width:130px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(15,23,42,0.45);padding-top:2px;">'+label+'</span>' +
            '<span style="font-size:0.875rem;color:black;line-height:1.5;word-break:break-word;">'+escHtmlR(value)+'</span>' +
            '</div>';
    }

    function escHtmlR(str) {
        return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function buildReview() {
        var pref = document.querySelector('input[name="r_contactPref"]:checked');
        var prefLabel = pref ? (pref.value === 'email' ? 'Email' : pref.value === 'phone' ? 'Phone Call' : 'Either') : 'Email';
        var cr = document.getElementById('review-contact-rows');
        if (cr) cr.innerHTML =
            makeReviewRow('Name',        document.getElementById('r_fullName').value) +
            makeReviewRow('Email',       document.getElementById('r_email').value) +
            makeReviewRow('Phone',       document.getElementById('r_phone').value) +
            makeReviewRow('Company',     document.getElementById('r_company').value) +
            makeReviewRow('Contact Via', prefLabel);
        var tr = document.getElementById('review-tool-rows');
        if (tr) tr.innerHTML =
            makeReviewRow('Category', document.getElementById('r_toolCategory').value) +
            makeReviewRow('Model',    document.getElementById('r_toolModel').value) +
            makeReviewRow('Serial #', document.getElementById('r_serialNumber').value) +
            makeReviewRow('Tool Age', document.getElementById('r_toolAge').value);
        var sr = document.getElementById('review-service-rows');
        if (sr) sr.innerHTML =
            makeReviewRow('Service Type', document.getElementById('r_serviceType').value) +
            makeReviewRow('Priority',     document.getElementById('r_priority').value) +
            makeReviewRow('Issue Start',  document.getElementById('r_issueStart').value) +
            makeReviewRow('Description',  document.getElementById('r_issueDescription').value) +
            makeReviewRow('Notes',        document.getElementById('r_additionalNotes').value);
    }

    window.repairNext = function() {
        if (!validate(currentStep)) return;
        if (currentStep === 3) buildReview();
        showStep(currentStep + 1);
    };

    window.repairBack = function() {
        clearErrors();
        showStep(currentStep - 1);
    };

    window.repairSubmit = function() {
        var submitBtn = document.getElementById('repair-submit-btn');
        if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='Submitting...'; }

        var formData = new FormData();
        formData.append('action',          'dtb_repair_request');
        formData.append('dtb_repair_nonce','<?php echo wp_create_nonce( 'dtb_repair_request' ); ?>');
        formData.append('fullName',        document.getElementById('r_fullName').value);
        formData.append('email',           document.getElementById('r_email').value);
        formData.append('phone',           document.getElementById('r_phone').value);
        formData.append('company',         document.getElementById('r_company').value);
        formData.append('toolCategory',    document.getElementById('r_toolCategory').value);
        formData.append('toolModel',       document.getElementById('r_toolModel').value);
        formData.append('serialNumber',    document.getElementById('r_serialNumber').value);
        formData.append('toolAge',         document.getElementById('r_toolAge').value);
        formData.append('serviceType',     document.getElementById('r_serviceType').value);
        formData.append('priority',        document.getElementById('r_priority').value);
        formData.append('issueStart',      document.getElementById('r_issueStart').value);
        formData.append('issueDescription',document.getElementById('r_issueDescription').value);
        var pref = document.querySelector('input[name="r_contactPref"]:checked');
        formData.append('contactPreference', pref ? pref.value : 'email');
        formData.append('additionalNotes', document.getElementById('r_additionalNotes').value);

        var ajaxUrl = (window.DTB && window.DTB.ajaxUrl) ? window.DTB.ajaxUrl : '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>';
        fetch(ajaxUrl, { method:'POST', body:formData })
            .then(function(r){ return r.json(); })
            .then(function() { showSuccessState(); })
            .catch(function() { showSuccessState(); });
    };

    function showSuccessState() {
        var card    = document.getElementById('repair-form-card');
        var success = document.getElementById('repair-success');
        if (card)    card.style.display    = 'none';
        if (success) success.style.display = '';
    }

    window.resetRepairForm = function() {
        ['r_fullName','r_email','r_phone','r_company','r_toolCategory','r_toolModel',
         'r_serialNumber','r_issueDescription','r_additionalNotes'].forEach(function(id){
            var el = document.getElementById(id);
            if (el) el.value='';
        });
        ['r_toolAge','r_serviceType','r_priority','r_issueStart'].forEach(function(id){
            var el = document.getElementById(id);
            if (el) el.selectedIndex=0;
        });
        var pref = document.querySelector('input[name="r_contactPref"][value="email"]');
        if (pref) pref.checked=true;
        currentStep=1;
        var card    = document.getElementById('repair-form-card');
        var success = document.getElementById('repair-success');
        if (card)    card.style.display    = '';
        if (success) success.style.display = 'none';
        showStep(1);
    };

    showStep(1);
})();
</script>
<?php get_footer(); ?>
