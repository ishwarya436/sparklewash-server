// Helper utilities for package interpretation (interior counts, etc.)

/**
 * Parse interiorCleaning string/number/boolean into a numeric count (integer >= 0)
 * - Accepts values like "2 per month", "0 per month", "no", 2, "2"
 * - Returns integer >= 0 or null if value not present/unknown
 */
function parseInteriorCleaningValue(val) {
  if (val === null || typeof val === 'undefined') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.max(0, Math.floor(val)) : null;
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0; // boolean true => 1 interior
  }
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (!s) return null;
    if (s === 'no' || s === 'none' || s === 'n/a') return 0;
    // attempt to capture leading number
    const m = s.match(/(\d+)\s*/);
    if (m && m[1]) return Math.max(0, parseInt(m[1], 10));
    // any non-empty string that isn't 'no' we treat as unknown but safe fallback to 0? We'll return null
    return null;
  }
  return null;
}

function hasInteriorFromPackage(pkg) {
  if (!pkg) return false;
  // Explicit business rule: packages named 'Moderate' do NOT include interior cleaning
  const name = (pkg.name || '').toString().toLowerCase();
  if (name.includes('moderate')) return false;

  // consider .interiorCleaning field (string like "2 per month") or interiorCount
  let iv = null;
  if (typeof pkg.interiorCleaning !== 'undefined') iv = parseInteriorCleaningValue(pkg.interiorCleaning);
  if (iv === null && typeof pkg.interiorCount !== 'undefined') iv = parseInteriorCleaningValue(pkg.interiorCount);
  if (iv === null) return false; // unknown -> assume no interior
  return iv > 0;
}

module.exports = { parseInteriorCleaningValue, hasInteriorFromPackage };
