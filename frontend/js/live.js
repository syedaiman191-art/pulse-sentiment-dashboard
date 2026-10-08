/* Authenticated SSE controls and real-time post notifications. */
(() => {
  let source = null;
  let timer = null;
  function setStatus(enabled, paused = false) {
    const state = window.PulseState.state;
    state.liveEnabled = enabled;
    state.livePaused = paused;
    document.dispatchEvent(new CustomEvent('pulse:live-state', { detail: { enabled, paused } }));
  }
  function connect() {
    const token = window.PulseApi.getToken();
    if (!token) { window.PulseApp.notify('Sign in again to start Live mode.', 'error'); return; }
    if (window.PulseApi.staticMode) {
      clearInterval(timer);
      setStatus(true, false);
      timer = setInterval(() => document.dispatchEvent(new CustomEvent('pulse:new-post', { detail: window.PulseStaticApi.createLivePost() })), 2500);
      return;
    }
    source?.close();
    source = new EventSource(`${window.PulseApi.API_ROOT}/stream?token=${encodeURIComponent(token)}`);
    source.onopen = () => setStatus(true, false);
    source.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        document.dispatchEvent(new CustomEvent('pulse:new-post', { detail: payload }));
      } catch (_) { /* ignore malformed stream events */ }
    };
    source.onerror = () => {
      if (!window.PulseState.state.livePaused) setStatus(true, true);
    };
  }
  function toggle() {
    if (window.PulseState.state.liveEnabled) {
      source?.close(); source = null; clearInterval(timer); timer = null; setStatus(false, false);
    } else {
      setStatus(true, false); connect();
    }
  }
  function pause() {
    const state = window.PulseState.state;
    if (!state.liveEnabled) return;
    if (state.livePaused) connect();
    else { source?.close(); source = null; clearInterval(timer); timer = null; setStatus(true, true); }
  }
  window.PulseLive = { toggle, pause, stop: () => { source?.close(); source = null; clearInterval(timer); timer = null; setStatus(false, false); } };
})();
