import { apiClient } from '../api/client.js';
import { brandToSlug, isAllProductsCategorySlug, parseCatalogQuery } from '../utils/catalogUrlState.js';

const FRESH_CACHE_TTL = 5 * 60 * 1000;
const STALE_CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_VERSION = 'v4';
const PRODUCT_STORAGE_PREFIX = `dtb:catalog-products:${CACHE_VERSION}:`;
const FACETS_STORAGE_PREFIX = `dtb:catalog-facets:${CACHE_VERSION}:`;

const productCache = new Map();
const productInflight = new Map();
const facetsCache = new Map();
const facetsInflight = new Map();
const snapshotInflight = new Map();

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readPersistent(prefix, key) {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(`${prefix}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.cachedAt || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistent(prefix, key, data) {
  if (!canUseStorage() || !data) return;

  try {
    window.localStorage.setItem(`${prefix}${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // Persistent cache is opportunistic. Storage quota/private mode failures are non-fatal.
  }
}

function removePersistent(prefix, key) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(`${prefix}${key}`);
  } catch {
    // Non-critical cleanup.
  }
}

function getCacheEntry(cache, key, prefix, { allowStale = false } = {}) {
  const now = Date.now();
  const memoryEntry = cache.get(key);

  if (memoryEntry?.data) {
    const age = now - memoryEntry.cachedAt;
    if (age < FRESH_CACHE_TTL) {
      return { data: memoryEntry.data, isStale: false, source: 'memory' };
    }
    if (allowStale && age < STALE_CACHE_TTL) {
      return { data: memoryEntry.data, isStale: true, source: 'memory' };
    }
  }

  const persistentEntry = readPersistent(prefix, key);
  if (!persistentEntry?.data) return null;

  const persistentAge = now - persistentEntry.cachedAt;
  if (persistentAge >= STALE_CACHE_TTL) {
    removePersistent(prefix, key);
    return null;
  }

  cache.set(key, persistentEntry);
  if (persistentAge < FRESH_CACHE_TTL) {
    return { data: persistentEntry.data, isStale: false, source: 'persistent' };
  }

  return allowStale
    ? { data: persistentEntry.data, isStale: true, source: 'persistent' }
    : null;
}

function setCacheEntry(cache, key, prefix, data) {
  if (!data) return data;

  const entry = { data, cachedAt: Date.now() };
  cache.set(key, entry);
  writePersistent(prefix, key, data);
  return data;
}

function sortedKey(value = {}) {
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizePathSegment(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCatalogScope(scope = {}) {
  const normalized = {};

  if (scope.brand) normalized.brand = String(scope.brand);
  if (scope.category) normalized.category = String(scope.category);
  if (scope.displayCategory && !isAllProductsCategorySlug(scope.displayCategory)) {
    normalized.display_category = String(scope.displayCategory);
  }
  if (scope.productKind) normalized.product_kind = String(scope.productKind);
  if (scope.isParts !== undefined && scope.isParts !== null && scope.isParts !== '') {
    normalized.is_parts = String(scope.isParts);
  }

  return normalized;
}

export function buildCatalogFacetsUrl(scope = {}) {
  const params = new URLSearchParams(normalizeCatalogScope(scope));
  const qs = params.toString();
  return `/wp-json/dtb/v1/catalog/facets${qs ? `?${qs}` : ''}`;
}

export function getCachedCatalogFacets(scope = {}, options = {}) {
  const entry = getCacheEntry(
    facetsCache,
    sortedKey(normalizeCatalogScope(scope)),
    FACETS_STORAGE_PREFIX,
    options,
  );
  return options.returnEntry ? entry : entry?.data || null;
}

export function fetchCatalogFacets(scope = {}) {
  const normalized = normalizeCatalogScope(scope);
  const key = sortedKey(normalized);
  const cached = getCacheEntry(facetsCache, key, FACETS_STORAGE_PREFIX);
  if (cached?.data) return Promise.resolve(cached.data);

  if (!facetsInflight.has(key)) {
    facetsInflight.set(
      key,
      apiClient(buildCatalogFacetsUrl(normalized))
        .then((data) => setCacheEntry(facetsCache, key, FACETS_STORAGE_PREFIX, data))
        .finally(() => {
          facetsInflight.delete(key);
        }),
    );
  }

  return facetsInflight.get(key);
}

export function buildCatalogProductParams(query = {}) {
  const params = {};
  if (query.brands && query.brands.length > 0) {
    params.brand = brandToSlug(query.brands[0]);
  }
  if (query.category) params.category = query.category;
  if (!query.search && query.displayCategory && !isAllProductsCategorySlug(query.displayCategory)) {
    params.display_category = query.displayCategory;
  }
  if (query.toolFamily) params.tool_family = query.toolFamily;
  if (query.productKind) params.product_kind = query.productKind;
  if (query.builderSlot) params.builder_slot = query.builderSlot;
  if (query.workflowScope) params.workflow_scope = query.workflowScope;
  if (typeof query.isParts === 'number') params.is_parts = query.isParts;
  if (query.search) params.search = query.search;
  if (query.page && query.page > 1) params.page = query.page;
  if (query.perPage) params.per_page = query.perPage;
  if (query.sort && query.sort !== 'popular') params.sort = query.sort;
  return params;
}

export function buildCatalogProductsUrl(query = {}) {
  const qs = new URLSearchParams(buildCatalogProductParams(query)).toString();
  return `/wp-json/dtb/v1/catalog/products${qs ? `?${qs}` : ''}`;
}

function buildCatalogSnapshotUrl(query = {}) {
  const params = buildCatalogProductParams(query);
  if (params.search || params.tool_family || params.builder_slot || params.workflow_scope || params.product_kind) {
    return '';
  }

  const page = normalizePathSegment(params.page || 1) || '1';
  const sort = params.sort ? normalizePathSegment(params.sort) : '';
  const suffix = sort ? `-${sort}` : '';

  if (params.is_parts === 1 || params.is_parts === '1') {
    return `/catalog-snapshots/parts/page-${page}${suffix}.json`;
  }

  const brand = normalizePathSegment(params.brand || '');
  const category = normalizePathSegment(params.display_category || params.category || '');

  if (brand && category) {
    return `/catalog-snapshots/brands/${brand}/categories/${category}/page-${page}${suffix}.json`;
  }

  if (brand) {
    return `/catalog-snapshots/brands/${brand}/page-${page}${suffix}.json`;
  }

  if (category) {
    return `/catalog-snapshots/categories/${category}/page-${page}${suffix}.json`;
  }

  return `/catalog-snapshots/products/page-${page}${suffix}.json`;
}

async function fetchJsonIfPresent(url) {
  if (!url || typeof window === 'undefined') return null;

  const absoluteUrl = new URL(url, window.location.origin).toString();
  const response = await fetch(absoluteUrl, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
  }).catch(() => null);

  if (!response || !response.ok) return null;
  return response.json().catch(() => null);
}

export function getCachedCatalogProducts(query = {}, options = {}) {
  const entry = getCacheEntry(
    productCache,
    sortedKey(buildCatalogProductParams(query)),
    PRODUCT_STORAGE_PREFIX,
    options,
  );
  return options.returnEntry ? entry : entry?.data || null;
}

export function getRenderableCatalogProducts(query = {}) {
  return getCachedCatalogProducts(query, { allowStale: true, returnEntry: true });
}

export function fetchCatalogProductSnapshot(query = {}) {
  const url = buildCatalogSnapshotUrl(query);
  if (!url) return Promise.resolve(null);

  const key = `snapshot:${url}`;
  if (!snapshotInflight.has(key)) {
    snapshotInflight.set(
      key,
      fetchJsonIfPresent(url)
        .then((data) => {
          if (!data) return null;
          setCacheEntry(productCache, sortedKey(buildCatalogProductParams(query)), PRODUCT_STORAGE_PREFIX, data);
          return data;
        })
        .finally(() => {
          snapshotInflight.delete(key);
        }),
    );
  }

  return snapshotInflight.get(key);
}

export function fetchCatalogProducts(query = {}, options = {}) {
  const forceNetwork = Boolean(options?.forceNetwork);
  const params = buildCatalogProductParams(query);
  const key = sortedKey(params);

  if (!forceNetwork) {
    const cached = getCacheEntry(productCache, key, PRODUCT_STORAGE_PREFIX);
    if (cached?.data) return Promise.resolve(cached.data);

    if (!productInflight.has(key)) {
      productInflight.set(
        key,
        apiClient(buildCatalogProductsUrl(query))
          .then((data) => setCacheEntry(productCache, key, PRODUCT_STORAGE_PREFIX, data))
          .finally(() => {
            productInflight.delete(key);
          }),
      );
    }

    return productInflight.get(key);
  }

  return apiClient(buildCatalogProductsUrl(query))
    .then((data) => setCacheEntry(productCache, key, PRODUCT_STORAGE_PREFIX, data));
}

export function primeCatalogFromLocation(search = '', pathParams = {}) {
  const query = parseCatalogQuery(new URLSearchParams(search), pathParams);
  fetchCatalogProductSnapshot(query).catch(() => {});
  fetchCatalogProducts(query, { forceNetwork: true }).catch(() => {});
}
