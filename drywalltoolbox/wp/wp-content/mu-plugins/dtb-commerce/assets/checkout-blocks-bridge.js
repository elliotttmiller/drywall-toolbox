(function(){
  'use strict';
  var wc = window.wc || {};
  var wp = window.wp || {};
  var registry = wc.wcBlocksRegistry;
  var settings = wc.wcSettings;
  var elApi = wp.element;
  if (!registry || typeof registry.registerPaymentMethod !== 'function' || !elApi || typeof elApi.createElement !== 'function') {
    return;
  }
  var createElement = elApi.createElement;
  var data = settings && typeof settings.getSetting === 'function' ? settings.getSetting('dtb_checkout_blocks_bridge_data', {}) : {};
  data = data || {};
  var enabled = data.bridgeEnabled === true && data.sameShellSupported === true;
  var title = String(data.title || 'Drywall Toolbox secure checkout');
  function label(){ return createElement('span', { className: 'dtb-blocks-bridge-label' }, title); }
  function content(){ return createElement('div', { className: 'dtb-blocks-bridge-content' }, String(data.description || 'Provider-owned checkout is required.')); }
  registry.registerPaymentMethod({
    name: 'dtb_checkout_blocks_bridge',
    label: createElement(label),
    content: createElement(content),
    edit: createElement(content),
    ariaLabel: title,
    canMakePayment: function(){ return enabled; },
    supports: data.supports || { features: ['products'] }
  });
}());
