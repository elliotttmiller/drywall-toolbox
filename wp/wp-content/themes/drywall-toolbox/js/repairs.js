/**
 * Drywall Toolbox - Repairs Page JS
 * 4-step repair request wizard — step navigation, validation, review, AJAX submit.
 * Used by page-repairs.php (inline script handles most logic; this file provides
 * supplemental utilities and ensures the wizard is initialized cleanly).
 */
(function () {
  'use strict';

  var COLUMBIA_PRODUCTS = {
    'Angleheads':            ['AngleHead'],
    'Applicators':           ['External Corner Applicator', 'Inside Corner Applicator', 'Two-Way Internal Corner Applicator'],
    'Automatic Tapers':      ['Predator Automatic Taper'],
    'Compound Tubes':        ['CamLock Tube', 'Compound Tube'],
    'Corner Boxes':          ['Throttle Box'],
    'Corner Flushers':       ['Combo Flusher', 'Direct Corner Flusher', 'Standard Corner Flusher'],
    'Corner Rollers':        ['Corner Cobra', 'Inside Corner Roller', 'Standard Outside Corner Roller'],
    'Finishing Boxes':       ['Automatic Flat Box', 'Fat Boy Box', 'Flat Box'],
    'Handles':               ['Closet Monster Handle', 'Columbia One Handle', 'Flat Box Handle', 'Long Extendable Handle', 'Matrix Box Handle'],
    'Nailspotters':          ['Nailspotter'],
    'Pumps':                 ['Box Filler Pump', 'Gooseneck Adapter', 'Mud Pump', 'Tall Boy Mud Pump'],
    'Sanders':               ['Sander Head'],
    'Semi-Automatic Tapers': ['Semi-Automatic Taper'],
    'Smoothing Blades':      ['Tomahawk Smoothing Blades'],
  };

  /* ─── TOOL MODEL UPDATER ──────────────────────────────────────────── */
  // updateToolModels may also be defined inline in page-repairs.php — this
  // version runs if window.updateToolModels is not already set.
  if (!window.updateToolModels) {
    window.updateToolModels = function () {
      var catSel = document.getElementById('r_toolCategory');
      var modelSel = document.getElementById('r_toolModel');
      if (!catSel || !modelSel) return;
      var cat = catSel.value;
      modelSel.disabled = !cat;
      modelSel.innerHTML = '<option value="" disabled selected>' +
        (cat ? 'Select the specific model\u2026' : 'Select a category first\u2026') + '</option>';
      if (cat && COLUMBIA_PRODUCTS[cat]) {
        COLUMBIA_PRODUCTS[cat].forEach(function (model) {
          var opt = document.createElement('option');
          opt.value = model;
          opt.textContent = model;
          modelSel.appendChild(opt);
        });
      }
    };
  }

  /* ─── SCROLL TO FORM ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Ensure the "Request Repair Service" button scrolls to the form
    var heroBtn = document.querySelector('button[onclick*="repair-form-section"]');
    if (heroBtn) {
      heroBtn.addEventListener('click', function () {
        var section = document.getElementById('repair-form-section');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });

})();
