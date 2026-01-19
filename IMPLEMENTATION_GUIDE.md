# Interactive Schematic Viewer - Platinum Drywall Tools

## Overview
This interactive schematic viewer transforms static PDF-based schematics into an engaging, web-based shopping experience. Users can click or hover over parts directly on schematic images to view product details and add items to their cart without leaving the page.

## Features

### ✅ Implemented
- **Interactive Hotspots**: Clickable/hoverable areas on schematic images
- **Responsive Design**: Works seamlessly on Desktop, Tablet, and Mobile devices
- **Percentage-Based Positioning**: Hotspots scale perfectly with image size
- **Product Detail Popups**: Display product thumbnail, name, SKU, price, and description
- **AJAX Add-to-Cart**: No page reload when adding items (WooCommerce-ready)
- **Visual Feedback**: Pulsing animations, hover effects, and cart notifications
- **Accessible**: Keyboard navigation (ESC to close popup)
- **Easy Data Configuration**: Simple JSON structure for adding new hotspots

### 🎨 Design System
- **Typography**: Audiowide for headings, Poppins for body text (as per site standards)
- **Color Palette**: 
  - Primary: `#FFCC33` (Yellow)
  - Secondary: `#000000` (Black)
  - Text: `#F8F8F8` (White)
- **Zero Global Impact**: All styles are scoped to the schematic viewer

## File Structure

```
drywall-toolbox/
├── index.html                          # Interactive schematic viewer
├── schematic_diagrams/
│   ├── platinum_corner_roller_Handle.png  # Main schematic PNG
│   └── [other schematics...]
└── README.md                           # This file
```

## How to Use

### For Developers

1. **Open `index.html`** in a web browser
2. **View the interactive schematic** with sample hotspots
3. **Click hotspots** to see product details
4. **Test add-to-cart** functionality (currently simulated)

### For Stakeholders (Adding New Hotspots)

Edit the `schematicData` object in `index.html` (around line 345):

```javascript
const schematicData = {
    schematicId: 'platinum_corner_roller_handle',
    hotspots: [
        {
            id: 'part-001',                    // Unique identifier
            left: '25%',                        // Horizontal position (percentage)
            top: '30%',                         // Vertical position (percentage)
            partNumber: 'PCR-HANDLE-01',        // Part number to display on hotspot
            productData: {
                id: 101,                        // WooCommerce Product ID
                name: 'Corner Roller Handle Assembly',
                sku: 'PCR-HANDLE-01',
                price: 89.99,
                image: 'path/to/product/image.jpg',
                description: 'Product description here...'
            }
        },
        // Add more hotspots here...
    ]
};
```

### Finding Hotspot Coordinates

**Method 1: Using Browser Developer Tools**
1. Open `index.html` in your browser
2. Right-click on the schematic image → "Inspect"
3. In the console, type:
   ```javascript
   document.getElementById('schematicImage').addEventListener('click', function(e) {
       const rect = this.getBoundingClientRect();
       const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(2);
       const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(2);
       console.log(`left: '${x}%', top: '${y}%'`);
   });
   ```
4. Click anywhere on the schematic to get coordinates

**Method 2: Using Image Editor**
1. Open the PNG in Photoshop/GIMP
2. Use the "Info" panel to get pixel coordinates
3. Calculate percentages: `(pixel_x / image_width * 100)%`

## WooCommerce Integration

### Current Implementation (Mock)
The current version simulates AJAX cart functionality for demonstration purposes.

### Production Integration Steps

1. **Include WooCommerce Scripts** (add to `<head>`):
```html
<?php wp_head(); ?> 
<script>
var wc_add_to_cart_params = {
    ajax_url: '<?php echo admin_url('admin-ajax.php'); ?>',
    wc_ajax_url: '<?php echo WC_AJAX::get_endpoint('%%endpoint%%'); ?>',
    cart_url: '<?php echo wc_get_cart_url(); ?>'
};
</script>
```

2. **Replace Mock AJAX in `addToCart()` function**:
```javascript
function addToCart(product) {
    const btn = document.getElementById('addToCartBtn');
    btn.classList.add('loading');
    btn.textContent = 'Adding...';
    
    // Real WooCommerce AJAX
    const data = {
        action: 'woocommerce_add_to_cart',
        product_id: product.id,
        quantity: 1
    };
    
    jQuery.post(wc_add_to_cart_params.ajax_url, data, function(response) {
        if (response.error) {
            showCartNotification('Error adding to cart');
            return;
        }
        
        // Update cart count
        jQuery(document.body).trigger('wc_fragment_refresh');
        
        // Trigger cart drawer
        if (jQuery('.astra-mobile-cart-drawer').length) {
            jQuery('body').addClass('ast-mobile-cart-active');
        }
        
        showCartNotification(`${product.name} added to cart!`);
        btn.classList.remove('loading');
        btn.textContent = 'Add to Cart';
        setTimeout(closeProductPopup, 500);
    });
}
```

3. **Update Product Data** with real WooCommerce product IDs from your database

## Responsive Breakpoints

- **Desktop**: Full experience with hover previews (> 768px)
- **Tablet**: Touch-optimized hotspots (768px - 1024px)
- **Mobile**: Larger touch targets, optimized popup (< 768px)

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome Mobile (Android 10+)

## Performance Optimization

- **Lazy Loading**: Images load on-demand
- **Percentage Positioning**: No JavaScript calculations needed for resize
- **CSS Animations**: Hardware-accelerated transforms
- **Minimal DOM**: Hotspots are simple, lightweight elements

## Accessibility Features

- ✅ Keyboard navigation (ESC to close)
- ✅ ARIA labels on interactive elements
- ✅ High contrast color scheme
- ✅ Focus indicators
- ✅ Screen reader friendly

## Testing Checklist

### Visual Verification
- [ ] Hotspots are positioned correctly over part numbers
- [ ] Hotspots pulse to attract attention
- [ ] Popup displays correctly on all devices
- [ ] Colors match site design system

### Functionality
- [ ] Click/tap hotspots to open popup
- [ ] ESC key closes popup
- [ ] Overlay click closes popup
- [ ] Add to Cart button works
- [ ] Cart notification appears
- [ ] Multiple items can be added

### Responsiveness
- [ ] Test on Desktop (1920x1080, 1366x768)
- [ ] Test on Tablet (768x1024)
- [ ] Test on Mobile (375x667, 414x896)
- [ ] Hotspots stay aligned during resize
- [ ] Popup fits on small screens

### Integration (Production Only)
- [ ] WooCommerce product IDs are correct
- [ ] Prices update dynamically
- [ ] Cart drawer opens on add-to-cart
- [ ] Cart count updates
- [ ] Guest users can add to cart
- [ ] Logged-in users can add to cart

## Next Steps

### For Single Schematic (Current)
1. ✅ Implement base HTML/CSS/JS structure
2. ✅ Add sample hotspots
3. ✅ Test responsiveness
4. 🔄 Take screenshot for approval
5. 🔄 Get feedback from stakeholders

### For Multiple Schematics
1. Create a schematic selector/navigation
2. Load schematic data dynamically from JSON files
3. Implement schematic switching without page reload
4. Add URL routing for direct schematic links

### Future Enhancements
- **Search**: Find parts by number across all schematics
- **Zoom**: Magnify specific areas of schematics
- **Compare**: Side-by-side comparison of similar tools
- **History**: Recently viewed parts
- **Favorites**: Save frequently ordered parts

## Support & Maintenance

### Adding New Schematics
1. Export schematic as high-resolution PNG (min 1920px wide)
2. Place PNG in `schematic_diagrams/` folder
3. Create new hotspot configuration
4. Update navigation if needed

### Troubleshooting

**Hotspots not visible?**
- Check that PNG file path is correct
- Verify percentage values are within 0-100%
- Inspect browser console for JavaScript errors

**Cart not updating?**
- Ensure WooCommerce is active
- Check AJAX URL in `wc_add_to_cart_params`
- Verify product IDs exist in database

**Popup not appearing?**
- Check browser console for errors
- Verify all product data fields are filled
- Test in different browsers

## Technical Specifications

### Hotspot System
- **Positioning**: Percentage-based absolute positioning
- **Size**: 30px desktop, 25px mobile
- **Visual**: Yellow (#FFCC33) with pulse animation
- **State**: Hover scale (1.2x), click opens popup

### Popup System
- **Position**: Fixed, centered on viewport
- **Max Width**: 500px desktop, 95% mobile
- **Animation**: 0.3s fade-in with transform
- **Z-index**: 1000 (popup), 999 (overlay)

### Data Structure
- **Format**: JavaScript object literal
- **Storage**: Inline in HTML (easily editable)
- **Future**: Can be moved to external JSON file

## Credits

**Design System**: Platinum Drywall Tools brand guidelines  
**Typography**: Google Fonts (Audiowide, Poppins)  
**Framework**: Vanilla JavaScript (zero dependencies)  
**Icons**: Unicode characters (cross-browser compatible)

## License

Proprietary - © Platinum Drywall Tools

---

**Last Updated**: January 19, 2026  
**Version**: 1.0.0 (Proof of Concept)  
**Status**: ✅ Ready for Stakeholder Review
