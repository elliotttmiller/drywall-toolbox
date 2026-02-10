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

## 🚀 Deployment

This project is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:
1. Builds the project with `npm run build`
2. Deploys the `dist/` folder to GitHub Pages
3. Makes the site available at: `https://elliotttmiller.github.io/drywall-toolbox/`

### Manual Deployment

To trigger a manual deployment:
1. Go to the repository's "Actions" tab
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow" → "Run workflow"

### Updating Product Prices

When you update prices in `public/products_catalog.csv`:
1. The changes are automatically detected when pushed to `main`
2. The workflow rebuilds the site including the updated CSV
3. The new prices appear on the live site within a few minutes

**Note**: The CSV file is copied from `public/` to `dist/` during the build process, ensuring all updates are included in the deployment.

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
- JavaScript: ~283 KB (85.75 KB gzipped)
- CSS: ~34 KB (6.16 KB gzipped)

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
