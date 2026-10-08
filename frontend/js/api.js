/* Shared fetch client: attaches JWT and normalizes JSON errors. */
(() => {
  const API_ROOT = window.location.protocol === 'file:' ? 'http://localhost:8000/api' : `${window.location.origin}/api`;
  function getToken() { try { return localStorage.getItem('pulse.token') || ''; } catch (_) { return ''; } }
  function setToken(token) { try { if (token) localStorage.setItem('pulse.token', token); else localStorage.removeItem('pulse.token'); } catch (_) { /* session can still run in memory */ } }
  async function request(path, options = {}) {
    if (window.PulseApi.staticMode && window.PulseStaticApi) return window.PulseStaticApi.request(path, options);
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      response = await fetch(`${API_ROOT}${path}`, { ...options, headers, signal: options.signal || controller.signal, body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body });
    } catch (error) {
      throw new Error('Could not reach Pulse at http://localhost:8000. Start the backend with `uvicorn main:app --reload` from pulse/backend.');
    } finally {
      clearTimeout(timeout);
    }
    let payload = {};
    try { payload = await response.json(); } catch (_) { payload = {}; }
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new CustomEvent('pulse:unauthorized'));
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  }
  window.PulseApi = { request, getToken, setToken, API_ROOT };
})();
