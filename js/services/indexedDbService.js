const DB_NAME = 'gestionar-db';
const DB_VERSION = 1;

let _dbPromise = null;

function initDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { autoIncrement: true, keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req   = fn(store);
    if (req) {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror    = (e) => reject(e.target.error);
    }
  });
}

async function get(storeName, key) {
  return withStore(storeName, 'readonly', (store) => store.get(key));
}

async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

async function set(storeName, key, value) {
  return withStore(storeName, 'readwrite', (store) => store.put({ key, ...value }));
}

async function bulkSet(storeName, items) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}

async function del(storeName, key) {
  return withStore(storeName, 'readwrite', (store) => store.delete(key));
}

async function clear(storeName) {
  return withStore(storeName, 'readwrite', (store) => store.clear());
}

export const idbService = { initDB, get, getAll, set, bulkSet, del, clear };

window.idbService = idbService;

initDB().catch(() => {});
