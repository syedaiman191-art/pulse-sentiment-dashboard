/* Home and sentiment dashboard views. */
(() => {
  const api = () => window.PulseApi.request;
  const esc = value => window.PulseApp.esc(value);
  const state = () => window.PulseApp.state;
  const fmt = value => new Intl.NumberFormat().format(value || 0);
  const signed = value => `${value >= 0 ? '+' : ''}${Math.round((value || 0) * 100)}%`;
  const dateLabel = value => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
  const topics = ['Battery life', 'Camera', 'Price', 'Support', 'Delivery', 'Design'];
  const platforms = ['All', 'X', 'Reddit', 'Instagram', 'YouTube'];
  const query = values => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString();

  function postMarkup(post) {
    return `<article class="post-row post-clickable" data-post-id="${esc(post.id)}" data-post-text="${esc(post.text)}" data-post-platform="${esc(post.platform)}" data-post-topic="${esc(post.topic)}" data-post-tone="${esc(post.label)}" data-post-date="${esc(post.created_at)}" data-post-likes="${post.likes}" tabindex="0" role="button" aria-label="Open ${esc(post.platform)} mention: ${esc(post.text)}"><div class="post-meta"><span class="tone-pill ${esc(post.label)}">${esc(post.label)}</span><span>${esc(post.platform)}</span><span>·</span><span>${esc(post.topic)}</span><span>·</span><time>${dateLabel(post.created_at)} · ${String(post.hour).padStart(2, '0')}:00</time><span class="post-likes">♥ ${fmt(post.likes)}</span></div><p class="post-text">${esc(post.text)}</p></article>`;
  }
  function kpi(label, value, comparison, target, tone = '') {
    return `<button class="kpi-card" data-nav="${target}"><span class="kpi-label">${esc(label)}<span aria-hidden="true">↗</span></span><strong class="kpi-value ${tone}">${esc(value)}</strong><span class="kpi-foot">${esc(comparison)}</span></button>`;
  }
  function lineChart(points, aria) {
    const width = 700, height = 210, pad = 25;
    const values = points.map(item => item.net || 0);
    const coords = values.map((value, index) => {
      const x = pad + index * (width - pad * 2) / Math.max(1, values.length - 1);
      const y = height - pad - (value + 1) / 2 * (height - pad * 2);
      return `${x},${y}`;
    });
    return `<svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}"><line class="grid-line" x1="${pad}" x2="${width-pad}" y1="${height/2}" y2="${height/2}"/><line class="grid-line" x1="${pad}" x2="${width-pad}" y1="${pad}" y2="${pad}"/><line class="grid-line" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"/><polygon class="line-area" points="${pad},${height/2} ${coords.join(' ')} ${width-pad},${height/2}"/><polyline class="line-path" points="${coords.join(' ')}"/>${points.map((point, index) => `<circle class="line-point" cx="${pad + index * (width-pad*2) / Math.max(1, points.length-1)}" cy="${height-pad-(point.net+1)/2*(height-pad*2)}" r="3"><title>${dateLabel(point.date)} · ${signed(point.net)}</title></circle>`).join('')}<text class="chart-label" x="${pad}" y="${height-4}">${dateLabel(points[0]?.date)}</text><text class="chart-label" text-anchor="end" x="${width-pad}" y="${height-4}">${dateLabel(points.at(-1)?.date)}</text></svg>`;
  }
  function homeTiles() {
    const apps = [['sentiment', '◒', 'Sentiment', 'Track customer mood'], ['inbox', '✉', 'Mentions inbox', 'Reply and resolve'], ['trends', '⌁', 'Trend explorer', 'Find what is changing'], ['alerts', '!', 'Alerts', 'Tune your thresholds'], ['reports', '▤', 'Reports', 'Share a clear summary'], ['team', '◎', 'Team', 'Manage access'], ['profile', '◉', 'Profile', 'Your preferences']];
    return `<div class="app-grid">${apps.map(([id, icon, title, desc]) => `<button class="app-tile" data-nav="${id}"><span class="app-icon">${icon}</span><strong>${title}</strong><span>${desc}</span></button>`).join('')}</div>`;
  }
  async function home() {
    const [summary7, summary14, inbox, alerts] = await Promise.all([
      api()('/summary?days=7'), api()('/summary?days=14'), api()('/inbox?status=New'), api()('/alerts')
    ]);
    const profile = window.PulseApp.profile || window.PulseAuth.session() || {};
    const alertCount = alerts.alerts.filter(item => item.day >= 23).length;
    const previousAlertCount = alerts.alerts.filter(item => item.day >= 16 && item.day < 23).length;
    const inboxThisWeek = Math.round((summary7.negative + summary7.neutral) * summary7.mentions);
    const inboxPreviousWeek = Math.round((summary7.previous.negative + summary7.previous.neutral) * summary7.previous.mentions);
    const firstName = (profile.name || 'there').split(' ')[0];
    const cards = [
      kpi('Net sentiment · 7 days', signed(summary7.net), `${signed(summary7.comparison.net)} pts vs previous week`, 'sentiment', summary7.net >= 0 ? 'positive-text' : 'negative-text'),
      kpi('Mentions · 7 days', fmt(summary7.mentions), `${signed(summary7.comparison.mentions / Math.max(summary7.previous.mentions, 1))} vs previous week`, 'sentiment'),
      kpi('Open inbox items', fmt(inbox.total), `${fmt(inboxThisWeek)} new · ${signed((inboxThisWeek-inboxPreviousWeek)/Math.max(inboxPreviousWeek,1))} vs previous week`, 'inbox'),
      kpi('Alerts this week', fmt(alertCount), `${signed((alertCount-previousAlertCount)/Math.max(previousAlertCount,1))} vs previous week`, 'alerts')
    ].join('');
    const attention = (inbox.mentions || []).filter(item => item.label === 'negative').slice(0, 4);
    return `<div class="page-head"><div><div class="eyebrow">Workspace</div><h1>Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${esc(firstName)}</h1><p class="muted">Here is what customers are saying about the Lumen phone.</p></div></div>
      <section class="kpi-grid">${cards}</section>
      <div class="content-grid home-grid"><section class="panel"><div class="section-heading"><div><h2>Net sentiment</h2><p class="muted small">Daily average · last 14 days</p></div><button class="text-button" data-nav="sentiment">Explore sentiment →</button></div><div class="chart-box">${lineChart(summary14.daily, 'Daily net sentiment over 14 days')}</div></section>
      <section class="panel"><div class="section-heading"><div><h2>Needs attention</h2><p class="muted small">Latest negative customer posts</p></div><span class="tone-pill negative">${attention.length} new</span></div><div class="post-list">${attention.length ? attention.map(postMarkup).join('') : '<div class="empty-state">No negative posts in the inbox.</div>'}</div><button class="button secondary compact" data-nav="inbox">Open inbox</button></section></div>
      <section class="app-section"><div class="section-heading"><div><h2>All apps</h2><p class="muted small">Your Lumen phone listening workspace</p></div></div>${homeTiles()}</section>`;
  }
  function stackedChart(daily) {
    const width = 760, height = 230, left = 26, right = 8, baseline = height - 28, usable = height - 48;
    const peak = Math.max(1, ...daily.map(day => day.mentions));
    const bw = (width - left - right) / Math.max(1, daily.length);
    const bars = daily.map((day, index) => {
      const x = left + index * bw + bw * 0.17, barWidth = bw * 0.66;
      let y = baseline;
      const sections = [['positive','positive'], ['neutral','neutral'], ['negative','negative']].map(([key, cls]) => {
        const barHeight = day[key] / peak * usable; y -= barHeight;
        return `<rect class="stack-${cls}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(0, barHeight)}" rx="2"/>`;
      }).join('');
      return `<g class="day-bar" data-day="${day.day}" tabindex="0" role="button" aria-label="${dateLabel(day.date)} · ${day.mentions} mentions">${sections}<rect class="bar-hit" x="${x-2}" y="${baseline-usable}" width="${barWidth+4}" height="${usable}"/><title>${dateLabel(day.date)} · ${day.mentions} mentions</title></g>`;
    }).join('');
    return `<svg class="stack-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily stacked sentiment volume">${[0,.5,1].map(r => `<line class="grid-line" x1="${left}" x2="${width-right}" y1="${baseline-r*usable}" y2="${baseline-r*usable}"/>`).join('')}${bars}<text class="chart-label" x="${left}" y="${height-5}">${dateLabel(daily[0]?.date)}</text><text class="chart-label" text-anchor="end" x="${width-right}" y="${height-5}">${dateLabel(daily.at(-1)?.date)}</text></svg>`;
  }
  function sentimentDonut(data) {
    const pos = Math.round(data.positive * 100), neu = Math.round((data.positive + data.neutral) * 100);
    return `<div class="donut" style="--positive-stop:${pos}%;--neutral-stop:${neu}%"><div class="donut-center"><strong>${signed(data.net)}</strong><span>net</span></div></div><div class="legend"><button data-chart-tone="positive"><i class="positive"></i>Positive ${pos}%</button><button data-chart-tone="neutral"><i class="neutral"></i>Neutral ${Math.round(data.neutral*100)}%</button><button data-chart-tone="negative"><i class="negative"></i>Negative ${Math.round(data.negative*100)}%</button></div>`;
  }
  function activeFilters(s) {
    const tags = [];
    if (s.platform !== 'All') tags.push(['platform', s.platform]);
    if (s.topic) tags.push(['topic', s.topic]);
    if (s.tone !== 'All') tags.push(['tone', s.tone]);
    if (s.search) tags.push(['search', `“${s.search}”`]);
    if (s.dayFilter !== null) tags.push(['day', dateLabel(s.daily?.find(item => item.day === s.dayFilter)?.date)]);
    if (!tags.length) return '';
    return `<div class="active-filters"><span class="muted tiny">Filtered by</span>${tags.map(([key,value]) => `<button class="filter-tag" data-remove-filter="${key}">${esc(value)} <span aria-hidden="true">×</span></button>`).join('')}<button class="text-button" data-clear-filters>Clear filters</button></div>`;
  }
  function topicList(topics, selected) {
    return topics.map(item => {
      const amount = Math.min(49, Math.abs(item.average) * 49);
      const placement = item.average >= 0 ? `left:50%;width:${amount}%` : `left:${50-amount}%;width:${amount}%;background:var(--negative)`;
      return `<button class="topic-rank ${selected === item.topic ? 'selected' : ''}" data-topic="${esc(item.topic)}"><span class="topic-name">${esc(item.topic)}</span><span class="diverging-track"><span class="diverging-fill" style="${placement}"></span></span><strong>${signed(item.average)}</strong></button>`;
    }).join('');
  }
  async function sentiment() {
    const s = state();
    const params = { days: s.days, platform: s.platform === 'All' ? '' : s.platform, topic: s.topic, tone: s.tone === 'All' ? '' : s.tone, q: s.search };
    const summaryData = await api()(`/summary?${query(params)}`);
    s.daily = summaryData.daily;
    const postParams = { ...params, day: s.dayFilter, sort: s.feedSort, limit: s.feedLimit, offset: 0 };
    const result = await api()(`/posts?${query(postParams)}`);
    const topicsData = summaryData.topics;
    const worst = summaryData.daily.filter(day => day.mentions > 0).sort((a,b) => a.net - b.net)[0];
    const mainTopic = worst?.topicCounts?.[0]?.topic || 'conversation';
    const platformChips = platforms.map(platform => `<button class="chip ${s.platform === platform ? 'active' : ''}" data-platform="${platform}">${platform}</button>`).join('');
    const rangeChips = [7,14,30].map(days => `<button class="chip ${s.days === days ? 'active' : ''}" data-days="${days}">${days} days</button>`).join('');
    const insight = worst ? `${dateLabel(worst.date)} was the lowest-sentiment day (${signed(worst.net)}), led by ${mainTopic.toLowerCase()}.` : 'Not enough data for a daily insight.';
    return `<div class="page-head"><div><div class="eyebrow">Listening</div><h1>Sentiment dashboard</h1><p class="muted">A live read on conversations about the Lumen phone.</p></div><button class="button secondary compact" data-add-post-open>Add to feed</button></div>
      <div class="toolbar filter-bar"><div class="chip-group">${platformChips}</div><div class="chip-group">${rangeChips}</div><div class="chip-group">${['All','positive','neutral','negative'].map(tone => `<button class="chip ${s.tone===tone?'active':''}" data-global-tone="${tone}">${tone==='All'?'All tones':tone}</button>`).join('')}</div></div>${activeFilters(s)}
      <section class="kpi-grid">${kpi('Net sentiment', signed(summaryData.net), `${signed(summaryData.comparison.net)} pts vs previous period`, 'sentiment', summaryData.net >= 0 ? 'positive-text' : 'negative-text')}${kpi('Mentions', fmt(summaryData.mentions), `${signed(summaryData.comparison.mentions / Math.max(summaryData.previous.mentions,1))} vs previous period`, 'sentiment')}${kpi('Positive share', `${Math.round(summaryData.positive*100)}%`, `${fmt(Math.round(summaryData.positive*summaryData.mentions))} posts`, 'sentiment', 'positive-text')}${kpi('Negative share', `${Math.round(summaryData.negative*100)}%`, `${fmt(Math.round(summaryData.negative*summaryData.mentions))} posts`, 'inbox', 'negative-text')}</section>
      <div class="content-grid chart-grid-layout"><section class="panel"><div class="section-heading"><div><h2>Daily conversation volume</h2><p class="muted small">Stacked by sentiment · hover or focus a day</p></div></div><div class="chart-box" id="stackedChart">${stackedChart(summaryData.daily)}</div><div class="chart-readout" id="chartReadout" hidden></div><p class="insight"><span class="insight-mark">✳</span>${esc(insight)}</p></section><section class="panel"><div class="section-heading"><div><h2>Sentiment mix</h2><p class="muted small">Share of selected mentions</p></div></div><div class="donut-layout">${sentimentDonut(summaryData)}</div></section></div>
      <div class="content-grid topic-analyzer-grid"><section class="panel"><div class="section-heading"><div><h2>Topics</h2><p class="muted small">Average sentiment · select to filter</p></div><button class="text-button" data-clear-topic>Clear topic</button></div><div class="topic-rankings">${topicList(topicsData, s.topic)}</div></section><section class="panel"><div class="section-heading"><div><h2>Live text analyzer</h2><p class="muted small">Score a draft before you reply</p></div></div><div class="sample-actions"><button class="chip" data-analyzer-sample="positive">Positive sample</button><button class="chip" data-analyzer-sample="negative">Negative sample</button><button class="chip" data-analyzer-sample="sarcastic">Sarcastic sample</button></div><textarea id="analyzerInput" class="textarea" aria-label="Text to analyze" placeholder="Try: The camera is really great, but support was not helpful.">${esc(s.analyzerText || '')}</textarea><div class="gauge"><div class="gauge-arc"></div><div class="gauge-needle" id="gaugeNeedle"></div><span class="gauge-value" id="gaugeLabel">Neutral · 0%</span></div><div class="highlight-output" id="analyzerOutput">${esc(s.analyzerText || 'Positive and negative words will be highlighted here.')}</div><div class="analyzer-add"><label class="field"><span>Platform</span><select class="input" id="analyzerPlatform">${['X','Reddit','Instagram','YouTube'].map(item => `<option>${item}</option>`).join('')}</select></label><label class="field"><span>Topic</span><select class="input" id="analyzerTopic">${topics.map(item => `<option>${esc(item)}</option>`).join('')}</select></label><button class="button primary compact" data-analyzer-add>Add to feed</button></div></section></div>
      <section class="panel feed-panel"><div class="section-heading feed-heading"><div><h2>Post feed</h2><p class="muted small">${fmt(result.posts.length)} shown · ${fmt(summaryData.mentions)} mentions</p></div><div class="feed-tools"><input class="input search-input" id="feedSearch" type="search" aria-label="Search all widgets" placeholder="Search all widgets" value="${esc(s.search)}"><select class="input select-input" id="feedTone" aria-label="Filter by sentiment">${['All','positive','neutral','negative'].map(tone => `<option ${s.tone === tone ? 'selected' : ''}>${tone}</option>`).join('')}</select><select class="input select-input" id="feedSort" aria-label="Sort posts"><option value="newest" ${s.feedSort==='newest'?'selected':''}>Newest</option><option value="most_liked" ${s.feedSort==='most_liked'?'selected':''}>Most liked</option><option value="most_negative" ${s.feedSort==='most_negative'?'selected':''}>Most negative</option></select></div></div>${result.posts.length ? `<div class="post-list">${result.posts.map(postMarkup).join('')}</div>` : '<div class="empty-state">No posts match these filters.</div>'}${result.posts.length >= s.feedLimit ? '<div class="center-actions"><button class="button secondary compact" data-show-more>Show more</button></div>' : ''}</section>`;
  }
  window.PulseDashboard = { render: screen => screen === 'home' ? home() : sentiment(), postMarkup, signed, fmt, query };
})();
