import { idbService } from './indexedDbService.js';

const STORE = 'offlineQueue';

async function enqueue(request) {
  const db = await idbService.initDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.add(request);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getAll() {
  return idbService.getAll(STORE);
}

async function remove(id) {
  return idbService.del(STORE, id);
}

async function flushQueue() {
  const items = await getAll();
  if (!items.length) return;

  const token = window.getToken?.();
  let flushed = 0;

  for (const item of items) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${window.API_BASE}${item.url}`, {
        method:  item.method,
        headers,
        body:    item.body ?? undefined,
      });

      if (res.ok) {
        await remove(item.id);
        flushed++;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (flushed > 0) {
    window.toast?.('Sincronización completada.', 'success');
  }
}

export const offlineQueue = { enqueue, getAll, remove, flushQueue };

window.offlineQueue = offlineQueue;
