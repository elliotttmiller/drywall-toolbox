# GitHub Pages Deployment Setup

This document provides instructions for deploying the Drywall Toolbox website to GitHub Pages.

## Overview

The repository is now configured for **fully automatic** deployment to GitHub Pages using GitHub Actions. The workflow will automatically enable GitHub Pages and deploy the site when triggered. All pages and routes are properly configured to work with the `/drywall-toolbox/` base path.

## What Has Been Configured

1. **Vite Configuration** (`vite.config.js`)
   - Base path set to `/drywall-toolbox/` for GitHub Pages
   - Build output directory set to `dist`
   - Assets directory configured

2. **React Router** (`src/App.jsx`)
   - Router basename set to `/drywall-toolbox` for proper routing

3. **GitHub Actions Workflow** (`.github/workflows/deploy.yml`)
   - Automated build and deployment on push to `main` branch
   - Manual deployment option via workflow_dispatch
   - Proper permissions configured for GitHub Pages
   - **Automatic GitHub Pages enablement** - The workflow will automatically enable GitHub Pages if not already enabled

4. **Static Pages**
   - `.nojekyll` file added to prevent Jekyll processing
   - `hotspot-mapper.html` - Smart Schematic Mapper tool
   - `hotspot-test.html` - Hotspot Position Test tool
   - All files properly copied to build output

## Deploying to GitHub Pages

The site will deploy automatically when you push changes to the `main` branch. You can also trigger a manual deployment:

### Automatic Deployment (Recommended)

Simply merge your changes to the `main` branch:

```bash
git checkout main
git merge your-feature-branch
git push origin main
```

The workflow will automatically:
1. Build the React application
2. Enable GitHub Pages (if not already enabled)
3. Deploy the site to https://elliotttmiller.github.io/drywall-toolbox/

### Manual Deployment

You can also trigger deployment manually from any branch:

1. Go to the **Actions** tab in the repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow" button
4. Select the branch (typically `main`)
5. Click "Run workflow"

### Verifying Deployment

1. After the workflow completes (typically 2-3 minutes), the site will be live
2. Visit the site at: https://elliotttmiller.github.io/drywall-toolbox/
3. You can also check **Settings > Pages** in the repository to see the deployment status

## Accessing the Website

Once deployed, the website will be available at:
- **Main Site**: https://elliotttmiller.github.io/drywall-toolbox/
- **Hotspot Mapper**: https://elliotttmiller.github.io/drywall-toolbox/hotspot-mapper.html
- **Hotspot Test**: https://elliotttmiller.github.io/drywall-toolbox/hotspot-test.html

## Available Pages

All React Router pages are accessible:
- `/` - Home
- `/products` - Products catalog
- `/product/:partNumber` - Individual product pages
- `/parts` - Parts listing
- `/cart` - Shopping cart
- `/checkout` - Checkout process
- `/about` - About page
- `/contact` - Contact page
- `/settings/veeqo` - Veeqo settings
- `/settings/woocommerce` - WooCommerce settings

## Troubleshooting

### GitHub Pages Not Enabled Error
If you see an error like "Get Pages site failed" in the workflow logs, don't worry! The workflow is configured to automatically enable GitHub Pages on the first run. Simply re-run the workflow:
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Click "Re-run all jobs"

### Pages Not Loading
- Ensure the base path is correct in both `vite.config.js` and `src/App.jsx`
- Verify that the workflow completed successfully in the Actions tab
- Check browser console for any 404 errors

### Workflow Failing
- Check the Actions tab for error details
- Ensure all dependencies are correctly listed in `package.json`
- Verify that the build completes locally with `npm run build`

### 404 on Direct URL Access
- This is expected for single-page applications
- The `.nojekyll` file and proper routing configuration handle this
- If issues persist, verify the `.nojekyll` file is in the `public` folder

## Local Development

To test the production build locally:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Preview the build (served at http://localhost:4173/drywall-toolbox/)
npm run preview
```

## Updating the Site

The site will automatically rebuild and redeploy whenever you push to the `main` branch. The deployment typically takes 2-3 minutes.

## Custom Domain (Optional)

To use a custom domain:
1. Go to **Settings > Pages**
2. Under "Custom domain", enter your domain name
3. Follow GitHub's instructions for DNS configuration
4. Update the `base` path in `vite.config.js` to `/` and basename in `src/App.jsx` to match

## Support

For issues or questions:
- Check the GitHub Actions logs in the Actions tab
- Review the deployment workflow at `.github/workflows/deploy.yml`
- Consult GitHub Pages documentation: https://docs.github.com/en/pages
