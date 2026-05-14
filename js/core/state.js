// ── Estado global de sesión ───────────────────────────────────
export const state = { role: null, user: null, features: {}, adminRole: null, permissions: [] };

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
  set: (key, val, ttlMs = 30000) => {
    _cache[key] = { val, exp: Date.now() + ttlMs };
    window.__apiDebugLogCache?.(key, 'SET');
  },
  get: (key) => {
    const e = _cache[key];
    if (!e) {
      window.__apiDebugLogCache?.(key, 'MISS');
      return null;
    }
    if (e.exp <= Date.now()) {
      delete _cache[key];
      window.__apiDebugLogCache?.(key, 'EXPIRED');
      return null;
    }
    window.__apiDebugLogCache?.(key, 'HIT');
    return e.val;
  },
  del: (key) => { delete _cache[key]; },
  delPrefix: (prefix) => {
    Object.keys(_cache).forEach(key => {
      if (key.startsWith(prefix)) delete _cache[key];
    });
  },
  keys: () => Object.keys(_cache),
  clear: () => { _cache = {}; },
};

window.gestionarCache = cache;
