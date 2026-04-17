import { showLoading } from '../ui/loading.js';
import { toast } from '../ui/toast.js';

export async function apiCall(fn, opts = {}) {
  const { loading = true, silent = false } = opts;
  if (loading) showLoading(true);
  try {
    const result = await fn();
    return result;
  } catch (err) {
    if (!silent) {
      const msg = !navigator.onLine
        ? 'Sin conexión — se muestran datos del último acceso'
        : err.message;
      toast(msg, 'warning');
    }
    throw err;
  } finally {
    if (loading) showLoading(false);
  }
}

window.apiCall = apiCall;
