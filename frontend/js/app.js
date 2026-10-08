/* Hash router, shared app chrome and delegated interactions. */
(() => {
  const root = document.getElementById('app');
  const state = window.PulseState.state;
  let profile = null;
  let renderId = 0;
  let analyzeTimer;
  let searchTimer;
  let toastTimer;
  let undoAction = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function avatar(person, large = false) {
    const name = person?.name || 'Pulse';
    const color = person?.avatarColor || person?.avatar_color || '#28764f';
    return `<span class="avatar ${large ? 'large' : ''}" style="background:${esc(color)}">${esc(name.trim().charAt(0).toUpperCase())}</span>`;
  }
  function activeScreen() { return (location.hash.replace(/^#/, '') || 'home').split('?')[0]; }
  function notify(message, kind = '', undo = null) {
    const host = document.getElementById('toastHost');
    if (!host) return;
    undoAction = undo;
    host.innerHTML = `<div class="toast ${kind}">${esc(message)}${undo ? '<button class="toast-undo" data-undo-action>Undo</button>' : ''}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { host.innerHTML = ''; }, 2600);
  }
  function topbar() {
    const name = profile?.name || window.PulseAuth.session()?.name || 'Pulse member';
    const email = profile?.email || window.PulseAuth.session()?.email || '';
    return `<header class="topbar"><button class="brand brand-button" data-nav="home" aria-label="Pulse home"><span class="brand-mark">P</span><span>pulse</span></button><div class="top-actions"><button class="subtle-button" data-nav="home">All apps</button><button class="live-toggle ${state.liveEnabled?'on':''}" data-live-toggle aria-pressed="${state.liveEnabled}"><span class="live-dot"></span>${state.liveEnabled?'Live on':'Live'}</button><button class="icon-button live-pause" data-live-pause title="${state.livePaused?'Resume live stream':'Pause live stream'}" aria-label="${state.livePaused?'Resume live stream':'Pause live stream'}" ${state.liveEnabled?'':'hidden'}>${state.livePaused?'▶':'Ⅱ'}</button><button class="icon-button" data-theme-toggle title="Toggle theme" aria-label="Toggle light or dark theme">◐</button><button class="user-button" data-nav="profile" aria-label="Open profile">${avatar(profile || { name })}<span class="user-email">${esc(email)}</span></button><button class="subtle-button" data-logout>Sign out</button></div></header>`;
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('pulse.theme', theme); } catch (_) { /* theme remains for this page */ }
  }
  async function render() {
    const id = ++renderId;
    const keepSearchFocus = document.activeElement?.id === 'feedSearch';
    const searchCaret = keepSearchFocus ? document.activeElement.selectionStart : null;
    const screen = activeScreen();
    const allowed = ['home','sentiment','inbox','trends','alerts','reports','team','profile'];
    if (!allowed.includes(screen)) { location.hash = '#home'; return; }
    root.innerHTML = `${topbar()}<main id="screenContent" class="main-content"><div class="loading-state"><span class="spinner"></span><span>Loading ${esc(screen)}…</span></div></main><dialog class="post-dialog" id="postDialog"><button class="icon-button dialog-close" data-detail-close aria-label="Close post details">×</button><div id="postDetailContent"></div></dialog>`;
    const content = document.getElementById('screenContent');
    try {
      const markup = ['home','sentiment'].includes(screen) ? await window.PulseDashboard.render(screen) : await window.PulseApps.render(screen);
      if (id !== renderId) return;
      content.innerHTML = markup;
      if (keepSearchFocus) {
        const search = document.getElementById('feedSearch');
        search?.focus();
        if (search && searchCaret !== null) search.setSelectionRange(searchCaret, searchCaret);
      }
      if (screen === 'sentiment' && state.analyzerText) analyzeDraft(state.analyzerText);
    } catch (error) {
      if (id !== renderId) return;
      content.innerHTML = `<section class="error-panel"><span class="error-icon">!</span><h2>We couldn't load this view</h2><p>${esc(error.message)}</p><button class="button secondary" data-retry>Try again</button></section>`;
    }
  }
  function navigate(screen) {
    const next = `#${screen}`;
    if (location.hash === next) render(); else location.hash = next;
  }
  function persist() { window.PulseState.persist(); }
  function showPostDetail(post) {
    const dialog = document.getElementById('postDialog');
    const content = document.getElementById('postDetailContent');
    if (!dialog || !content) return;
    content.innerHTML = `<div class="post-meta"><span class="tone-pill ${esc(post.dataset.postTone)}">${esc(post.dataset.postTone)}</span><span>${esc(post.dataset.postPlatform)}</span><span>·</span><span>${esc(post.dataset.postTopic)}</span><span>·</span><span>${esc(post.dataset.postDate ? new Date(post.dataset.postDate).toLocaleString() : '')}</span></div><h2 class="mention-quote">${esc(post.dataset.postText)}</h2><p class="muted">♥ ${esc(post.dataset.postLikes)} likes</p>`;
    dialog.showModal();
  }
  async function analyzeDraft(text) {
    state.analyzerText = text;
    try {
      const result = await window.PulseApi.request('/analyze', { method: 'POST', body: { text } });
      const label = document.getElementById('gaugeLabel');
      const needle = document.getElementById('gaugeNeedle');
      const output = document.getElementById('analyzerOutput');
      if (!label || !needle || !output) return;
      label.textContent = `${result.label[0].toUpperCase()+result.label.slice(1)} · ${result.score >= 0 ? '+' : ''}${Math.round(result.score*100)}%`;
      needle.style.transform = `rotate(${result.score * 75}deg)`;
      const lookup = new Map((result.words || []).map(item => [item.word, item.sentiment]));
      output.innerHTML = text.split(/(\b[a-z']+\b)/gi).map(word => {
        const tone = lookup.get(word.toLowerCase());
        return tone ? `<mark class="word-${tone}">${esc(word)}</mark>` : esc(word);
      }).join('') || 'Positive and negative words will be highlighted here.';
    } catch (error) {
      const output = document.getElementById('analyzerOutput');
      if (output) output.textContent = error.message;
    }
  }
  async function refreshAlerts() {
    const params = new URLSearchParams({ neg_threshold: state.negThreshold, volume_multiplier: state.volumeMultiplier, topic: state.alertTopic === 'All' ? '' : state.alertTopic });
    try {
      const response = await window.PulseApi.request(`/alerts?${params}`);
      const list = document.querySelector('.alert-list');
      const header = document.querySelector('.alert-count');
      if (header) header.textContent = `Last 30 days · ${response.alerts.length} signals`;
      if (list) list.innerHTML = response.alerts.length ? response.alerts.slice().reverse().map(item => `<button class="alert-item" data-alert-day="${item.day}"><span><strong>${new Date(item.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong><span class="muted tiny">${item.mentions} mentions · ${Math.round(item.net*100)}% net</span></span><span class="alert-reasons">${item.reasons.map(reason => reason.type === 'negative-share' ? `Negative share ${reason.value}%` : `Volume ${reason.value}× baseline`).map(esc).join('<br>')}</span></button>`).join('') : '<div class="empty-state">No days meet these thresholds.</div>';
    } catch (error) { notify(error.message, 'error'); }
  }
  async function submitReply(id) {
    const replyText = document.getElementById('replyText')?.value.trim() || '';
    if (!replyText) { notify('Write a reply first.', 'error'); return; }
    try {
      await window.PulseApi.request(`/inbox/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'Replied', replyText } });
      state.repliesSent += 1; state.replyDraft = ''; notify('Reply sent (demo)'); render();
    } catch (error) { notify(error.message, 'error'); }
  }
  document.getElementById('toastHost').addEventListener('click', async event => {
    if (!event.target.closest('[data-undo-action]') || !undoAction) return;
    const undo = undoAction; undoAction = null;
    try { await undo(); }
    catch (error) { notify(error.message, 'error'); }
  });
  root.addEventListener('click', async event => {
    const nav = event.target.closest('[data-nav]');
    if (nav) { navigate(nav.dataset.nav); return; }
    if (event.target.closest('[data-live-toggle]')) { window.PulseLive.toggle(); return; }
    if (event.target.closest('[data-live-pause]')) { window.PulseLive.pause(); return; }
    if (event.target.closest('[data-detail-close]')) { document.getElementById('postDialog')?.close(); return; }
    const postDetail = event.target.closest('[data-post-id]');
    if (postDetail) { showPostDetail(postDetail); return; }
    if (event.target.closest('[data-theme-toggle]')) {
      const current = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(current === 'dark' ? 'light' : 'dark'); return;
    }
    if (event.target.closest('[data-logout]')) { window.PulseLive.stop(); window.PulseAuth.logout(); location.href = 'index.html'; return; }
    if (event.target.closest('[data-retry]')) { render(); return; }
    const globalTone = event.target.closest('[data-global-tone]');
    if (globalTone) { state.tone = globalTone.dataset.globalTone; state.dayFilter = null; state.feedLimit = 12; persist(); render(); return; }
    const chartTone = event.target.closest('[data-chart-tone]');
    if (chartTone) { state.tone = state.tone === chartTone.dataset.chartTone ? 'All' : chartTone.dataset.chartTone; state.dayFilter = null; state.feedLimit = 12; persist(); render(); return; }
    const removeFilter = event.target.closest('[data-remove-filter]');
    if (removeFilter) {
      const key = removeFilter.dataset.removeFilter;
      if (key === 'platform') state.platform = 'All';
      if (key === 'topic') state.topic = '';
      if (key === 'tone') state.tone = 'All';
      if (key === 'search') state.search = '';
      if (key === 'day') state.dayFilter = null;
      persist(); render(); return;
    }
    if (event.target.closest('[data-clear-filters]')) { window.PulseState.clearFilters(); render(); return; }
    if (event.target.closest('[data-add-post-open]')) { document.getElementById('analyzerInput')?.focus(); return; }
    const sample = event.target.closest('[data-analyzer-sample]');
    if (sample) {
      const examples = {
        positive: 'The Lumen phone camera is really beautiful and the battery lasts all day.',
        negative: 'The delivery is really late and support was not helpful.',
        sarcastic: 'Wonderful, another really late delivery. Just perfect.'
      };
      const input = document.getElementById('analyzerInput');
      if (input) { input.value = examples[sample.dataset.analyzerSample]; input.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    if (event.target.closest('[data-analyzer-add]')) {
      const text = document.getElementById('analyzerInput')?.value.trim() || '';
      if (!text) { notify('Write text to add first.', 'error'); return; }
      try {
        await window.PulseApi.request('/posts', { method: 'POST', body: { text, platform: document.getElementById('analyzerPlatform').value, topic: document.getElementById('analyzerTopic').value } });
        state.analyzerText = ''; state.dayFilter = null; notify('Post added to feed'); persist(); render();
      } catch (error) { notify(error.message, 'error'); }
      return;
    }
    const alertDay = event.target.closest('[data-alert-day]');
    if (alertDay) { state.dayFilter = Number(alertDay.dataset.alertDay); state.days = 30; persist(); navigate('sentiment'); return; }
    const platform = event.target.closest('[data-platform]');
    if (platform) { state.platform = platform.dataset.platform; state.dayFilter = null; state.feedLimit = 12; persist(); render(); return; }
    const days = event.target.closest('[data-days]');
    if (days) { state.days = Number(days.dataset.days); state.dayFilter = null; state.feedLimit = 12; persist(); render(); return; }
    const topic = event.target.closest('[data-topic]');
    if (topic) { state.topic = state.topic === topic.dataset.topic ? '' : topic.dataset.topic; state.dayFilter = null; state.feedLimit = 12; persist(); render(); return; }
    if (event.target.closest('[data-clear-topic]')) { state.topic = ''; persist(); render(); return; }
    const dayBar = event.target.closest('[data-day]');
    if (dayBar) { state.dayFilter = Number(dayBar.dataset.day); state.days = 30; persist(); render(); return; }
    if (event.target.closest('[data-show-more]')) { state.feedLimit += 12; render(); return; }
    const inboxFilter = event.target.closest('[data-inbox-filter]');
    if (inboxFilter) { state.inboxFilter = inboxFilter.dataset.inboxFilter; state.inboxSelected = null; state.replyDraft = ''; persist(); render(); return; }
    const inboxItem = event.target.closest('[data-inbox-item]');
    if (inboxItem) { state.inboxSelected = inboxItem.dataset.inboxItem; state.replyDraft = ''; persist(); render(); return; }
    const template = event.target.closest('[data-template]');
    if (template) {
      const box = document.getElementById('replyText');
      if (box) { box.value = template.dataset.template === 'apologize' ? "Hi, I'm sorry to hear about your experience with the Lumen phone. Thank you for letting us know. We'd like to make this right." : 'Hi, thanks for reaching out about your Lumen phone. Could you share a little more detail so our team can help?'; box.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    const send = event.target.closest('[data-send-reply]');
    if (send) { submitReply(send.dataset.sendReply); return; }
    const resolve = event.target.closest('[data-resolve]');
    if (resolve) {
      try {
        const result = await window.PulseApi.request(`/inbox/${encodeURIComponent(resolve.dataset.resolve)}`, { method: 'PATCH', body: { status: 'Resolved' } });
        notify('Mention resolved', '', async () => { await window.PulseApi.request(`/inbox/${encodeURIComponent(resolve.dataset.resolve)}`, { method: 'PATCH', body: result.previous }); render(); });
        render();
      }
      catch (error) { notify(error.message, 'error'); }
      return;
    }
    const trendPlatform = event.target.closest('[data-trend-platform]');
    if (trendPlatform) { state.trendPlatform = trendPlatform.dataset.trendPlatform; persist(); render(); return; }
    const reportDays = event.target.closest('[data-report-days]');
    if (reportDays) { state.reportDays = Number(reportDays.dataset.reportDays); persist(); render(); return; }
    if (event.target.closest('[data-copy-report]')) {
      try { await navigator.clipboard.writeText(document.getElementById('reportText').textContent); notify('Summary copied'); }
      catch (_) { notify('Clipboard access is unavailable in this browser.', 'error'); }
      return;
    }
    const color = event.target.closest('[data-avatar-color]');
    if (color) {
      document.getElementById('avatarColor').value = color.dataset.avatarColor;
      document.querySelectorAll('[data-avatar-color]').forEach(button => { button.classList.toggle('selected', button === color); button.setAttribute('aria-pressed', String(button === color)); });
      document.querySelectorAll('.profile-hero .avatar,.topbar .avatar').forEach(node => { node.style.background = color.dataset.avatarColor; });
      if (profile) profile.avatarColor = color.dataset.avatarColor;
      return;
    }
    const remove = event.target.closest('[data-remove-member]');
    if (remove) {
      if (!window.confirm('Remove this teammate from the workspace?')) return;
      try { await window.PulseApi.request(`/team/${remove.dataset.removeMember}`, { method: 'DELETE' }); notify('Member removed'); render(); }
      catch (error) { notify(error.message, 'error'); }
    }
  });
  root.addEventListener('change', async event => {
    if (event.target.id === 'feedTone') { state.tone = event.target.value; state.dayFilter = null; state.feedLimit = 12; persist(); render(); }
    if (event.target.id === 'feedSort') { state.feedSort = event.target.value; persist(); render(); }
    if (event.target.id === 'inboxSort') { state.inboxSort = event.target.value; persist(); render(); }
    if (event.target.id === 'trendSort') { state.trendSort = event.target.value; persist(); render(); }
    if (event.target.id === 'alertTopic') { state.alertTopic = event.target.value; persist(); render(); }
    if (event.target.id === 'reportDaysSelect') { state.reportDays = Number(event.target.value); render(); }
    if (event.target.matches('[data-member-role]')) {
      try { await window.PulseApi.request(`/team/${event.target.dataset.memberRole}`, { method: 'PATCH', body: { role: event.target.value } }); notify('Role updated'); }
      catch (error) { notify(error.message, 'error'); render(); }
    }
  });
  root.addEventListener('input', event => {
    if (event.target.id === 'feedSearch') {
      state.search = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.feedLimit = 12; persist(); render(); }, 250);
    }
    if (event.target.id === 'analyzerInput') {
      state.analyzerText = event.target.value;
      clearTimeout(analyzeTimer);
      analyzeTimer = setTimeout(() => analyzeDraft(state.analyzerText), 220);
    }
    if (event.target.id === 'replyText') state.replyDraft = event.target.value;
    if (event.target.id === 'profileName') {
      const value = event.target.value.trim() || 'Pulse';
      document.querySelectorAll('.profile-hero h2').forEach(node => { node.textContent = value; });
      document.querySelectorAll('.profile-hero .avatar,.topbar .avatar').forEach(node => { node.textContent = value.charAt(0).toUpperCase(); });
      if (profile) profile.name = value;
    }
    if (event.target.id === 'negThreshold') {
      state.negThreshold = Number(event.target.value);
      document.getElementById('negThresholdValue').textContent = `${state.negThreshold}%`;
      persist();
      clearTimeout(analyzeTimer); analyzeTimer = setTimeout(refreshAlerts, 120);
    }
    if (event.target.id === 'volumeMultiplier') {
      state.volumeMultiplier = Number(event.target.value);
      document.getElementById('volumeMultiplierValue').textContent = `${state.volumeMultiplier.toFixed(1)}×`;
      persist();
      clearTimeout(analyzeTimer); analyzeTimer = setTimeout(refreshAlerts, 120);
    }
  });
  root.addEventListener('pointerover', event => {
    const bar = event.target.closest('[data-day]');
    if (!bar) return;
    const readout = document.getElementById('chartReadout');
    const point = (state.daily || []).find(day => day.day === Number(bar.dataset.day));
    if (readout && point) { readout.hidden = false; readout.textContent = `${new Date(point.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${point.mentions} mentions · ${Math.round(point.net*100)}% net`; }
  });
  root.addEventListener('pointerout', event => { if (event.target.closest('[data-day]')) { const readout = document.getElementById('chartReadout'); if (readout) readout.hidden = true; } });
  root.addEventListener('focusin', event => {
    const bar = event.target.closest('[data-day]');
    if (bar) { const readout = document.getElementById('chartReadout'); const point = (state.daily || []).find(day => day.day === Number(bar.dataset.day)); if (readout && point) { readout.hidden = false; readout.textContent = `${new Date(point.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${point.mentions} mentions · ${Math.round(point.net*100)}% net`; } }
  });
  root.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.target.id === 'profileForm') {
      const name = document.getElementById('profileName').value.trim();
      const title = document.getElementById('profileTitle').value.trim();
      if (!name) { notify('Display name is required.', 'error'); return; }
      try {
        profile = await window.PulseApi.request('/profile', { method: 'PUT', body: { name, title, avatarColor: document.getElementById('avatarColor').value, notifications: { spike: document.getElementById('notifySpike').checked, weekly: document.getElementById('notifyWeekly').checked, tips: document.getElementById('notifyTips').checked } } });
        window.PulseAuth.saveUser({ ...window.PulseAuth.session(), name: profile.name });
        notify('Profile saved'); render();
      } catch (error) { notify(error.message, 'error'); }
    }
    if (event.target.id === 'inviteForm') {
      const email = document.getElementById('inviteEmail').value.trim();
      const error = document.getElementById('inviteError'); error.textContent = '';
      try { await window.PulseApi.request('/team', { method: 'POST', body: { email, role: document.getElementById('inviteRole').value } }); notify('Invite sent (demo)'); render(); }
      catch (failure) { error.textContent = failure.message; }
    }
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('pulse:live-state', event => {
    const toggle = document.querySelector('[data-live-toggle]');
    const pause = document.querySelector('[data-live-pause]');
    if (toggle) { toggle.classList.toggle('on', event.detail.enabled); toggle.setAttribute('aria-pressed', String(event.detail.enabled)); toggle.innerHTML = `<span class="live-dot"></span>${event.detail.enabled ? 'Live on' : 'Live'}`; }
    if (pause) { pause.hidden = !event.detail.enabled; pause.textContent = event.detail.paused ? '▶' : 'Ⅱ'; pause.title = event.detail.paused ? 'Resume live stream' : 'Pause live stream'; pause.setAttribute('aria-label', pause.title); }
  });
  document.addEventListener('pulse:new-post', event => {
    const payload = event.detail || {};
    if (!payload.post) return;
    if (payload.alertTriggered) notify('Negative Delivery spike detected');
    if (['home','sentiment','alerts'].includes(activeScreen()) && !document.getElementById('postDialog')?.open) render();
  });
  document.addEventListener('keydown', event => {
    if (activeScreen() !== 'inbox' || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    const items = [...document.querySelectorAll('[data-inbox-item]')];
    const current = items.findIndex(item => item.classList.contains('selected'));
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); document.getElementById('replyText')?.focus(); return; }
    if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!items.length) return;
      const direction = event.key.toLowerCase() === 'j' ? 1 : -1;
      items[(current + direction + items.length) % items.length].click();
    }
  });
  window.addEventListener('pulse:unauthorized', () => { window.PulseLive.stop(); window.PulseAuth.logout(); location.href = 'index.html'; });
  try { const theme = localStorage.getItem('pulse.theme'); if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; } catch (_) { /* use system preference */ }
  if (!window.PulseApi.getToken()) { location.href = 'index.html'; return; }
  (async () => {
    try { profile = await window.PulseApi.request('/profile'); }
    catch (_) { window.PulseAuth.logout(); location.href = 'index.html'; return; }
    if (!location.hash) location.hash = '#home'; else render();
  })();
  window.PulseApp = { state, get profile() { return profile; }, set profile(value) { profile = value; }, render, notify, esc, avatar };
})();
