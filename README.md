# Drywall Toolbox - Professional Tools & Equipment

A modern, fully responsive e-commerce platform for professional drywall tools and equipment, built with React and Lucide icons.

## 🎨 Features

- **Modern React Architecture** - Built with React 19 and Vite for optimal performance
- **Beautiful UI/UX** - Clean, professional design with Tailwind CSS
- **Lucide Icons** - Professional icon system throughout (40+ icons)
- **Fully Responsive** - Optimized for mobile, tablet, and desktop
- **Product Catalog** - Advanced filtering by brand, category, and price
- **Shopping Cart** - Full cart management with quantity controls
- **Smooth Animations** - Modern transitions and hover effects

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/
│   ├── Header.jsx      # Responsive navigation with mobile menu
│   └── Footer.jsx      # Footer with links and contact info
├── pages/
│   ├── Home.jsx        # Homepage with hero and categories
│   ├── Products.jsx    # Product catalog with filters
│   ├── Cart.jsx        # Shopping cart management
│   ├── About.jsx       # Company information
│   └── Contact.jsx     # Contact form and details
├── App.jsx             # Main app with routing
└── main.jsx            # Entry point
```

## 🛠️ Tech Stack

- **React 19.2.0** - UI library
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Build tool and dev server

## 📱 Pages

- **Homepage** - Hero section, category showcase, features, and trusted brands
- **Products** - Product grid with filtering, sorting, and ratings
- **Cart** - Shopping cart with order summary and free shipping indicator
- **About** - Company mission, values, stats, and brand partners
- **Contact** - Contact form, business hours, and FAQs

## 🎯 Key Features

### Responsive Design
- Mobile-first approach
- Hamburger menu for mobile navigation
- Responsive grid layouts (1-4 columns)
- Touch-optimized interactions

### Product Management
- Filter by brand, category, and price
- Sort by popularity, price, or rating
- Product cards with ratings and badges
- Add to cart functionality

### Shopping Cart
- Add/remove items
- Quantity management
- Automatic tax calculation
- Free shipping threshold ($500+)
- Order summary with totals

### Modern UI/UX
- Gradient backgrounds and buttons
- Card hover effects with lift animations
- Smooth color transitions
- Professional Lucide icons
- Empty states with helpful CTAs

## 📦 Build Output

Production build generates optimized assets:
- JavaScript: ~467 KB (136 KB gzipped)
- CSS: ~60 KB (11 KB gzipped)

## 🚀 GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages.

### Live Site
The site is deployed at: `https://elliotttmiller.github.io/drywall-toolbox/`

### Deployment Process
- **Automatic**: Pushes to the `main` branch trigger automatic deployment via GitHub Actions
- **Manual**: Can be triggered manually from the Actions tab on GitHub

### Technical Details
- Uses Vite's base path configuration for project pages
- Includes SPA routing support for React Router (404.html redirects)
- GitHub Actions workflow handles building and deploying
- `.nojekyll` file ensures proper asset loading

### Repository Settings
To enable GitHub Pages:
1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. The workflow will automatically deploy on push to main

## 🔒 Security

- No vulnerabilities detected
- Input sanitization
- Secure form handling
- SSL encryption for checkout

## 📄 License

ISC

## 🤝 Contributing

This is a demonstration project showcasing modern frontend development practices.

---

**Built with ❤️ for professional contractors**
