// Drywall Toolbox - Main JavaScript

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      navMenu.classList.toggle('active');
    });
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', function(event) {
    if (!event.target.closest('.header-content')) {
      if (navMenu) {
        navMenu.classList.remove('active');
      }
    }
  });
  
  // Search functionality
  const searchForm = document.querySelector('.search-bar');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const searchTerm = document.querySelector('.search-bar input').value;
      if (searchTerm) {
        window.location.href = `products.html?search=${encodeURIComponent(searchTerm)}`;
      }
    });
  }
  
  // Add to cart functionality
  const addToCartButtons = document.querySelectorAll('.add-to-cart');
  addToCartButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      const productName = this.dataset.productName;
      const productPrice = this.dataset.productPrice;
      
      addToCart({
        id: productId,
        name: productName,
        price: productPrice,
        quantity: 1
      });
      
      // Show notification
      showNotification('Product added to cart!');
      updateCartBadge();
    });
  });
  
  // Initialize cart badge on page load
  updateCartBadge();
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
  
  // Filter functionality for products page
  const filterCheckboxes = document.querySelectorAll('.filter-option input');
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', filterProducts);
  });
  
  // Category filter
  const categoryLinks = document.querySelectorAll('.category-card');
  categoryLinks.forEach(link => {
    link.addEventListener('click', function() {
      const category = this.dataset.category;
      if (category) {
        window.location.href = `products.html?category=${encodeURIComponent(category)}`;
      }
    });
  });
  
  // Brand filter
  const brandLinks = document.querySelectorAll('.brand-logo');
  brandLinks.forEach(link => {
    link.addEventListener('click', function() {
      const brand = this.dataset.brand;
      if (brand) {
        window.location.href = `products.html?brand=${encodeURIComponent(brand)}`;
      }
    });
  });
  
  // Animate elements on scroll
  observeElements();
});

// Shopping Cart Functions
function getCart() {
  const cart = localStorage.getItem('drywallToolboxCart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem('drywallToolboxCart', JSON.stringify(cart));
}

function addToCart(product) {
  let cart = getCart();
  const existingProduct = cart.find(item => item.id === product.id);
  
  if (existingProduct) {
    existingProduct.quantity += product.quantity;
  } else {
    cart.push(product);
  }
  
  saveCart(cart);
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== productId);
  saveCart(cart);
  updateCartBadge();
}

function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  const product = cart.find(item => item.id === productId);
  
  if (product) {
    product.quantity = parseInt(quantity);
    if (product.quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart(cart);
    }
  }
}

function updateCartBadge() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.querySelector('.icon-btn .badge');
  
  if (badge) {
    badge.textContent = totalItems;
    if (totalItems === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'block';
    }
  }
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
}

// Notification System
function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Filter Products
function filterProducts() {
  const selectedBrands = [];
  const selectedCategories = [];
  const selectedPriceRanges = [];
  
  document.querySelectorAll('.filter-option input[data-type="brand"]:checked').forEach(checkbox => {
    selectedBrands.push(checkbox.value);
  });
  
  document.querySelectorAll('.filter-option input[data-type="category"]:checked').forEach(checkbox => {
    selectedCategories.push(checkbox.value);
  });
  
  document.querySelectorAll('.filter-option input[data-type="price"]:checked').forEach(checkbox => {
    selectedPriceRanges.push(checkbox.value);
  });
  
  const products = document.querySelectorAll('.product-card');
  
  products.forEach(product => {
    const productBrand = product.dataset.brand;
    const productCategory = product.dataset.category;
    const productPrice = parseFloat(product.dataset.price);
    
    let showProduct = true;
    
    // Filter by brand
    if (selectedBrands.length > 0 && !selectedBrands.includes(productBrand)) {
      showProduct = false;
    }
    
    // Filter by category
    if (selectedCategories.length > 0 && !selectedCategories.includes(productCategory)) {
      showProduct = false;
    }
    
    // Filter by price
    if (selectedPriceRanges.length > 0) {
      let matchesPrice = false;
      selectedPriceRanges.forEach(range => {
        if (range === 'under-100' && productPrice < 100) matchesPrice = true;
        if (range === '100-500' && productPrice >= 100 && productPrice <= 500) matchesPrice = true;
        if (range === '500-1000' && productPrice >= 500 && productPrice <= 1000) matchesPrice = true;
        if (range === 'over-1000' && productPrice > 1000) matchesPrice = true;
      });
      if (!matchesPrice) showProduct = false;
    }
    
    // Show or hide product
    if (showProduct) {
      product.style.display = 'block';
      product.style.animation = 'fadeIn 0.3s ease-out';
    } else {
      product.style.display = 'none';
    }
  });
}

// Intersection Observer for animations
function observeElements() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe cards and sections
  document.querySelectorAll('.card, .feature-item, .category-card').forEach(element => {
    observer.observe(element);
  });
}

// URL Parameter Helper
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name) || '';
}

// Handle search on products page
if (window.location.pathname.includes('products.html')) {
  const searchParam = getUrlParameter('search');
  if (searchParam) {
    const products = document.querySelectorAll('.product-card');
    const searchLower = searchParam.toLowerCase();
    products.forEach(product => {
      const title = product.querySelector('.card-title').textContent.toLowerCase();
      const description = product.querySelector('.card-text').textContent.toLowerCase();
      if (title.includes(searchLower) || description.includes(searchLower)) {
        product.style.display = 'block';
      } else {
        product.style.display = 'none';
      }
    });
  }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
