/**
 * Session-scoped checkout draft storage.
 *
 * Stores only temporary checkout-intent fields so mobile refreshes do not wipe
 * progress. Payment data, gateway tokens, checkout session tokens, and customer
 * ownership state are never stored here.
 */

const CHECKOUT_DRAFT_KEY = 'dtb:checkout-form-draft:v2';
const LEGACY_CHECKOUT_DRAFT_KEY = 'dtb:checkout-form-draft:v1';
const CHECKOUT_DRAFT_TTL_MS = 60 * 60 * 1000;

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

function legacyStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function allowedDraftFields(source = {}) {
  return {
    firstName: source.firstName || '',
    lastName: source.lastName || '',
    email: source.email || '',
    phone: source.phone || '',
    address: source.address || '',
    city: source.city || '',
    state: source.state || '',
    zip: source.zip || '',
    country: source.country || 'US',
    // Do not persist free-form notes across browser sessions.
    customerNote: '',
  };
}

function parseEnvelope(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.data && typeof parsed.data === 'object') return parsed;
    return { savedAt: 0, data: parsed };
  } catch {
    return null;
  }
}

export function readCheckoutDraft(blankForm) {
  const safeBlank = allowedDraftFields(blankForm || {});
  const current = storage();
  const envelope = parseEnvelope(current?.getItem(CHECKOUT_DRAFT_KEY));

  if (envelope?.data) {
    const savedAt = Number(envelope.savedAt || 0);
    if (!savedAt || Date.now() - savedAt <= CHECKOUT_DRAFT_TTL_MS) {
      return { ...safeBlank, ...allowedDraftFields(envelope.data) };
    }
    try { current?.removeItem(CHECKOUT_DRAFT_KEY); } catch { /* non-critical */ }
  }

  const legacy = legacyStorage();
  const legacyEnvelope = parseEnvelope(legacy?.getItem(LEGACY_CHECKOUT_DRAFT_KEY));
  if (legacyEnvelope?.data) {
    try { legacy?.removeItem(LEGACY_CHECKOUT_DRAFT_KEY); } catch { /* non-critical */ }
    const migrated = { ...safeBlank, ...allowedDraftFields(legacyEnvelope.data) };
    writeCheckoutDraft(migrated);
    return migrated;
  }

  return safeBlank;
}

export function writeCheckoutDraft(data) {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({
      savedAt: Date.now(),
      data: allowedDraftFields(data),
    }));
  } catch {
    // Draft persistence is non-critical; checkout remains fully usable.
  }
}

export function clearCheckoutDraft() {
  try { storage()?.removeItem(CHECKOUT_DRAFT_KEY); } catch { /* non-critical */ }
  try { legacyStorage()?.removeItem(LEGACY_CHECKOUT_DRAFT_KEY); } catch { /* non-critical */ }
}
