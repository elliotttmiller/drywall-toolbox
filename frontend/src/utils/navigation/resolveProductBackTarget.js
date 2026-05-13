/**
 * frontend/src/utils/navigation/resolveProductBackTarget.js
 *
 * Resolve the safest user-facing return target from a product detail page.
 *
 * Priority:
 * 1. Explicit workflow `location.state.from` or `location.state.returnTo`.
 * 2. Brand/category route context.
 * 3. Brand route context.
 * 4. Product brand selector root.
 */

function isSafeInternalPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !/^\/\\/u.test(value);
}

export function resolveProductBackTarget(location, context = {}) {
  const state = location?.state || {};

  if (isSafeInternalPath(state.returnTo)) return state.returnTo;
  if (isSafeInternalPath(state.from)) return state.from;

  const brandSlug = context.brandSlug || state.brandSlug || state.brand;
  const categorySlug = context.categorySlug || state.categorySlug || state.category;

  if (brandSlug && categorySlug) {
    return `/products/brands/${encodeURIComponent(brandSlug)}/categories/${encodeURIComponent(categorySlug)}`;
  }

  if (brandSlug) {
    return `/products/brands/${encodeURIComponent(brandSlug)}`;
  }

  return '/products/brands';
}

export default resolveProductBackTarget;
