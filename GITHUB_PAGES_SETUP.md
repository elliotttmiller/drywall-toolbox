# GitHub Pages Deployment Setup

This document provides instructions for enabling and configuring GitHub Pages for the Drywall Toolbox website.

## Overview

The repository is now configured for automatic deployment to GitHub Pages using GitHub Actions. All pages and routes are properly configured to work with the `/drywall-toolbox/` base path.

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

4. **Static Pages**
   - `.nojekyll` file added to prevent Jekyll processing
   - `hotspot-mapper.html` - Smart Schematic Mapper tool
   - `hotspot-test.html` - Hotspot Position Test tool
   - All files properly copied to build output

## Enabling GitHub Pages

To enable GitHub Pages for this repository, follow these steps:

### Step 1: Navigate to Repository Settings

1. Go to the repository on GitHub: https://github.com/elliotttmiller/drywall-toolbox
2. Click on the **Settings** tab
3. In the left sidebar, click on **Pages** under the "Code and automation" section

### Step 2: Configure Source

1. Under "Build and deployment", set the **Source** to "GitHub Actions"
2. The workflow will automatically detect the `.github/workflows/deploy.yml` file

### Step 3: Trigger Deployment

You have two options to trigger the initial deployment:

**Option A: Push to main branch**
```bash
git checkout main
git merge copilot/configure-deploy-website-github-pages
git push origin main
```

**Option B: Manual workflow trigger**
1. Go to the **Actions** tab in the repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click "Run workflow" button
4. Select the branch (main or your current branch)
5. Click "Run workflow"

### Step 4: Verify Deployment

1. After the workflow completes (typically 2-3 minutes), go back to **Settings > Pages**
2. You should see a message: "Your site is live at https://elliotttmiller.github.io/drywall-toolbox/"
3. Click the link or visit the URL to view your deployed site

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
