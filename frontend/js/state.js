/* Shared UI filters and transient workspace state. */
(() => {
  const defaults = {
    days: 14, platform: 'All', topic: '', tone: 'All', search: '', feedLimit: 12,
    feedSort: 'newest', dayFilter: null, inboxFilter: 'New', inboxSort: 'newest', inboxSelected: null,
    replyDraft: '', trendPlatform: 'All', trendSort: 'rising', negThreshold: 35,
    volumeMultiplier: 1.7, alertTopic: 'All', reportDays: 7, analyzerText: '',
    repliesSent: 0, selectedPost: null, liveEnabled: false, livePaused: false,
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pulse.filters') || '{}') || {}; } catch (_) { saved = {}; }
  const state = { ...defaults, ...saved, liveEnabled: false, livePaused: false };
  function persist() {
    const copy = { ...state, liveEnabled: false, livePaused: false };
    try { localStorage.setItem('pulse.filters', JSON.stringify(copy)); } catch (_) { /* filters stay in memory */ }
  }
  function clearFilters() {
    Object.assign(state, { days: 14, platform: 'All', topic: '', tone: 'All', search: '', dayFilter: null, feedLimit: 12 });
    persist();
  }
  window.PulseState = { state, persist, clearFilters };
})();
