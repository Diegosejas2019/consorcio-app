// ── Estado global de sesión ───────────────────────────────────
export const state = { role: null, user: null };

/**
 * Reemplaza el estado de sesión.
 * Usar en lugar de `state = { ... }` (las reasignaciones no funcionan con ES modules).
 */
export function setState(updates) {
  Object.assign(state, updates);
}

// ── Cache liviano (30 s por defecto) ─────────────────────────
let _cache = {};
export const cache = {
  set: (key, val, ttlMs = 30000) => { _cache[key] = { val, exp: Date.now() + ttlMs }; },
  get: (key) => { const e = _cache[key]; return e && e.exp > Date.now() ? e.val : null; },
  del: (key) => { delete _cache[key]; },
  clear: () => { _cache = {}; },
};
