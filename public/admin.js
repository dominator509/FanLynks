const $ = (id) => document.getElementById(id);

const DEFAULT_PRESET = 'fanlynks_dark';
const FANLYNKS_FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const PRESETS = {
  fanlynks_dark: {
    bg: '#050505', surface: '#121212', text: '#ffffff', muted: '#c8c2b5', accent: '#cfa029', border: '#302819', iconBg: '#ffffff',
    primaryBg: '#cfa029', primaryText: '#050505', secondaryBg: '#171717', secondaryText: '#ffffff', neutralBg: '#101010', neutralText: '#f5f0e8',
    fontBody: FANLYNKS_FONT, fontHeading: FANLYNKS_FONT, gap: '14px'
  },
  fanlynks_light: {
    bg: '#ffffff', surface: '#f7f4ee', text: '#050505', muted: '#5b5549', accent: '#cfa029', border: '#ded3bd', iconBg: '#050505',
    primaryBg: '#050505', primaryText: '#ffffff', secondaryBg: '#f0e6d0', secondaryText: '#050505', neutralBg: '#ffffff', neutralText: '#050505',
    fontBody: FANLYNKS_FONT, fontHeading: FANLYNKS_FONT, gap: '14px'
  },
  fanlynks_gold: {
    bg: '#100d06', surface: '#191307', text: '#fff8e8', muted: '#d9c99c', accent: '#d9aa2d', border: '#3b2a0b', iconBg: '#fff8e8',
    primaryBg: '#d9aa2d', primaryText: '#050505', secondaryBg: '#231908', secondaryText: '#fff8e8', neutralBg: '#151008', neutralText: '#fff8e8',
    fontBody: FANLYNKS_FONT, fontHeading: FANLYNKS_FONT, gap: '14px'
  },
  clean_ice: {
    bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#2563eb', border: '#dbe3ef', iconBg: '#eef4ff',
    primaryBg: '#2563eb', primaryText: '#ffffff', secondaryBg: '#eff6ff', secondaryText: '#0f172a', neutralBg: '#f8fafc', neutralText: '#0f172a',
    fontBody: FANLYNKS_FONT, fontHeading: FANLYNKS_FONT, gap: '14px'
  },
  forest_gold: {
    bg: '#0b1913', surface: '#12241c', text: '#f4f1e8', muted: '#c4c0b5', accent: '#d6b25e', border: '#254235', iconBg: '#1a3127',
    primaryBg: '#d6b25e', primaryText: '#1b1710', secondaryBg: '#173126', secondaryText: '#f4f1e8', neutralBg: '#13261d', neutralText: '#edf3ea',
    fontBody: FANLYNKS_FONT, fontHeading: FANLYNKS_FONT, gap: '14px'
  }
};

const EXP_PRESETS = [
  { theme_name: 'fanlynks_dark', page_bg: '#050505', surface_bg: '#121212', text_color: '#ffffff', accent_color: '#cfa029', font_preset: 'fanlynks_montserrat', button_style: 'gold_fill' },
  { theme_name: 'fanlynks_light', page_bg: '#ffffff', surface_bg: '#f7f4ee', text_color: '#050505', accent_color: '#cfa029', font_preset: 'fanlynks_montserrat', button_style: 'black_fill' },
  { theme_name: 'fanlynks_gold', page_bg: '#100d06', surface_bg: '#191307', text_color: '#fff8e8', accent_color: '#d9aa2d', font_preset: 'fanlynks_montserrat', button_style: 'premium_gold' }
];

const els = {
  email: $('email'), password: $('password'), turnstileToken: $('turnstileToken'), turnstileWidget: $('turnstileWidget'), loginBtn: $('loginBtn'), logoutBtn: $('logoutBtn'), loginPanel: $('loginPanel'),
  passwordPanel: $('passwordPanel'), currentPassword: $('currentPassword'), newPassword: $('newPassword'), confirmPassword: $('confirmPassword'), changePasswordBtn: $('changePasswordBtn'),
  pageId: $('pageId'), loadBtn: $('loadBtn'), previewBtn: $('previewBtn'), status: $('status'),
  pageTitle: $('pageTitle'), pageSubtitle: $('pageSubtitle'), pageAvatar: $('pageAvatar'), heroLabel: $('heroLabel'), heroUrl: $('heroUrl'),
  announcementEnabled: $('announcementEnabled'), announcementText: $('announcementText'), announcementUrl: $('announcementUrl'), trackingMode: $('trackingMode'), privacyMode: $('privacyMode'), savePageBtn: $('savePageBtn'), publishPageBtn: $('publishPageBtn'), pageSlugChip: $('pageSlugChip'), pageVersionChip: $('pageVersionChip'),
  appearancePreset: $('appearancePreset'), themeBg: $('themeBg'), themeSurface: $('themeSurface'), themeText: $('themeText'), themeMuted: $('themeMuted'), themeAccent: $('themeAccent'), themeBorder: $('themeBorder'), themeIconBg: $('themeIconBg'), themeGap: $('themeGap'),
  themePrimaryBg: $('themePrimaryBg'), themePrimaryText: $('themePrimaryText'), themeSecondaryBg: $('themeSecondaryBg'), themeSecondaryText: $('themeSecondaryText'), themeNeutralBg: $('themeNeutralBg'), themeNeutralText: $('themeNeutralText'), themeFontBody: $('themeFontBody'), themeFontHeading: $('themeFontHeading'), saveAppearanceBtn: $('saveAppearanceBtn'), appearancePreview: $('appearancePreview'),
  newLinkTitle: $('newLinkTitle'), newLinkUrl: $('newLinkUrl'), newLinkIconType: $('newLinkIconType'), newLinkIconValue: $('newLinkIconValue'), newLinkStyleRole: $('newLinkStyleRole'), newLinkBadge: $('newLinkBadge'), newLinkSubtitle: $('newLinkSubtitle'), createLinkBtn: $('createLinkBtn'), saveOrderBtn: $('saveOrderBtn'), linksList: $('linksList'),
  newName: $('newName'), newTtl: $('newTtl'), variantCount: $('variantCount'), newVariants: $('newVariants'), generateBtn: $('generateBtn'), createBtn: $('createBtn'), experiments: $('experiments'),
  analyticsWindow: $('analyticsWindow'), refreshAnalyticsBtn: $('refreshAnalyticsBtn'), refreshRecommendationBtn: $('refreshRecommendationBtn'), analyticsSummary: $('analyticsSummary'), analyticsLinks: $('analyticsLinks'), analyticsSources: $('analyticsSources'), analyticsExperiments: $('analyticsExperiments'), analyticsDestinations: $('analyticsDestinations'), analyticsMatrix: $('analyticsMatrix'), analyticsConsent: $('analyticsConsent'), analyticsRecommendation: $('analyticsRecommendation'), analyticsSpend: $('analyticsSpend'), spendEditId: $('spendEditId'), spendDate: $('spendDate'), spendSource: $('spendSource'), spendMedium: $('spendMedium'), spendVariantId: $('spendVariantId'), spendAmount: $('spendAmount'), spendNote: $('spendNote'), saveSpendBtn: $('saveSpendBtn'), cancelSpendEditBtn: $('cancelSpendEditBtn'),
  ga4Enabled: $('ga4Enabled'), ga4MeasurementId: $('ga4MeasurementId'), ga4PageViews: $('ga4PageViews'), ga4ClickEvents: $('ga4ClickEvents'), ga4ExperimentParams: $('ga4ExperimentParams'),
  metaEnabled: $('metaEnabled'), metaPixelId: $('metaPixelId'), metaEventMappings: $('metaEventMappings'),
  gtmEnabled: $('gtmEnabled'), gtmContainerId: $('gtmContainerId'), gtmAdvertisingEnabled: $('gtmAdvertisingEnabled'),
  cfwaEnabled: $('cfwaEnabled'), cfwaOverlayEnabled: $('cfwaOverlayEnabled'), saveIntegrationsBtn: $('saveIntegrationsBtn'),
  axiomTokenStatus: $('axiomTokenStatus'), issueAxiomTokenBtn: $('issueAxiomTokenBtn'), revokeAxiomTokenBtn: $('revokeAxiomTokenBtn'),
  axiomIssuedTokenPanel: $('axiomIssuedTokenPanel'), axiomIssuedToken: $('axiomIssuedToken'), copyAxiomTokenBtn: $('copyAxiomTokenBtn'), hideAxiomTokenBtn: $('hideAxiomTokenBtn'),
  privacyBannerVersion: $('privacyBannerVersion'), privacyChoicesLabel: $('privacyChoicesLabel'), privacyBannerTitle: $('privacyBannerTitle'), privacyFooterNote: $('privacyFooterNote'), privacyBannerBody: $('privacyBannerBody'), privacyAcceptLabel: $('privacyAcceptLabel'), privacyAnalyticsOnlyLabel: $('privacyAnalyticsOnlyLabel'), privacyDeclineLabel: $('privacyDeclineLabel'), privacyGpcTitle: $('privacyGpcTitle'), privacyHonorGpc: $('privacyHonorGpc'), privacyGpcBody: $('privacyGpcBody'), savePrivacyBtn: $('savePrivacyBtn'),
  sessionState: $('sessionState'), sessionRefreshBtn: $('sessionRefreshBtn'),
  tabButtons: Array.from(document.querySelectorAll('.tab-btn')), tabPanels: Array.from(document.querySelectorAll('.tab-panel'))
};

const state = {
  payload: null,
  links: [],
  experiments: [],
  integrations: {},
  analytics: null,
  sessionInfo: null,
  lastInteractionAt: Date.now(),
  dirty: false
};

let turnstileWidgetId = null;

function setStatus(message, isError = false) {
  els.status.textContent = message || '';
  els.status.style.color = isError ? '#ff8d9c' : '#a9b1c7';
}

function showTurnstileError(errorCode) {
  els.turnstileToken.value = '';
  const code = String(errorCode || 'unknown');
  const message = code.startsWith('110')
    ? `Turnstile configuration error (${code}). Add ${window.location.hostname} to this widget's allowed hostnames in Cloudflare Turnstile.`
    : `Turnstile error (${code}). Refresh and try again.`;
  els.turnstileWidget.textContent = message;
  setStatus(message, true);
  return true;
}

function updatePublishMeta() {
  const page = state.payload?.page;
  if (els.pageSlugChip) els.pageSlugChip.textContent = `Slug: ${page?.slug || '—'}`;
  if (els.pageVersionChip) els.pageVersionChip.textContent = `Published v${page?.publishedVersion ?? '—'}${state.dirty ? ' • draft changes' : ''}`;
}

function setDirty(next) {
  state.dirty = Boolean(next);
  updatePublishMeta();
}

function currentPageId() { return (els.pageId.value || '').trim(); }
function requirePageId() { const id = currentPageId(); if (!id) throw new Error('Page ID is required.'); return id; }

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!('content-type' in headers) && options.body !== undefined && options.method && options.method !== 'GET') headers['content-type'] = 'application/json';
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error(data.error || 'Your admin session expired. Log in again.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}


function formatNumber(value) { return new Intl.NumberFormat().format(Number(value || 0)); }
function formatPct(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function formatMoney(value, currency = 'USD') { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
function expiresInMs(expiresAt) { return expiresAt ? (new Date(expiresAt).getTime() - Date.now()) : 0; }
function relativeSessionLabel(expiresAt) {
  const ms = expiresInMs(expiresAt);
  if (!expiresAt || !Number.isFinite(ms)) return 'Session unknown';
  if (ms <= 0) return 'Session expired';
  const mins = Math.ceil(ms / 60000);
  return mins >= 60 ? `Session ${Math.ceil(mins / 60)}h left` : `Session ${mins}m left`;
}
function touchInteraction() { state.lastInteractionAt = Date.now(); }
function updateSessionUi() {
  const info = state.sessionInfo;
  const active = Boolean(info?.authenticated);
  els.sessionState.classList.toggle('hidden', !active);
  els.sessionRefreshBtn.classList.toggle('hidden', !active);
  if (els.passwordPanel) els.passwordPanel.classList.toggle('hidden', !active);
  if (!active) return;
  els.sessionState.textContent = relativeSessionLabel(info.user?.expiresAt);
  const ms = expiresInMs(info.user?.expiresAt);
  els.sessionState.style.background = ms < 10 * 60000 ? '#4a1f29' : ms < 30 * 60000 ? '#43341a' : '';
  els.sessionState.style.color = ms < 10 * 60000 ? '#ffd7dc' : ms < 30 * 60000 ? '#ffe8a3' : '';
}
function handleSessionExpired() {
  state.sessionInfo = null;
  updateSessionUi();
  els.loginPanel.classList.remove('hidden');
  if (els.passwordPanel) els.passwordPanel.classList.add('hidden');
  els.logoutBtn.classList.add('hidden');
}
function analyticsSinceIso() {
  const days = Math.max(1, Number(els.analyticsWindow?.value || 30));
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function renderTable(container, columns, rows, emptyText = 'No data yet.') {
  if (!container) return;
  if (!rows?.length) {
    container.innerHTML = `<div class="muted" style="padding:12px">${emptyText}</div>`;
    return;
  }
  const thead = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  const tbody = rows.map((row) => `<tr>${columns.map((col) => `<td>${col.render ? col.render(row) : escapeHtml(row[col.key] ?? '')}</td>`).join('')}</tr>`).join('');
  container.innerHTML = `<table class="table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function renderAnalytics() {
  const summary = state.analytics?.summary;
  const links = state.analytics?.links || [];
  const sources = state.analytics?.sources || [];
  const variants = state.analytics?.variants || [];
  const destinations = state.analytics?.destinations || [];
  const matrix = state.analytics?.matrix || [];
  const consent = state.analytics?.consent || [];
  const spend = state.analytics?.spend?.entries || [];
  if (els.analyticsSummary) {
    const cards = [
      { label: 'Visitors', value: formatNumber(summary?.pageViews ?? 0), sub: 'Page views' },
      { label: 'Clicks', value: formatNumber(summary?.clicks ?? 0), sub: 'Tracked CTA interactions' },
      { label: 'Page CTR', value: formatPct(summary?.pageCtr ?? 0), sub: 'Clicks / page views' },
      { label: 'Top Row', value: summary?.topRow?.row_index != null ? `#${summary.topRow.row_index}` : '—', sub: summary?.topRow?.clicks ? `${formatNumber(summary.topRow.clicks)} clicks` : 'No winner yet' },
      { label: 'Top Source', value: summary?.topSource?.source || '—', sub: summary?.topSource?.clicks ? `${formatNumber(summary.topSource.clicks)} clicks` : 'No source data yet' },
      { label: 'Top Variant', value: summary?.topVariant?.variant_name || summary?.topVariant?.variant_id || '—', sub: summary?.topVariant?.clicks ? `${formatNumber(summary.topVariant.clicks)} clicks` : 'No experiment clicks yet' },
      { label: 'Top Domain', value: summary?.topDestination?.destinationDomain || '—', sub: summary?.topDestination?.clicks ? `${formatNumber(summary.topDestination.clicks)} clicks` : 'No destination data yet' },
      { label: 'Analytics Consent', value: formatPct(summary?.analyticsConsentRate ?? 0), sub: summary?.consentRecords ? `${formatNumber(summary.consentRecords)} consent updates` : 'No consent records yet' },
      { label: 'Ad Spend', value: formatMoney(summary?.totalSpend ?? 0), sub: summary?.cpcProxy ? `${formatMoney(summary.cpcProxy)} CPC proxy` : 'No spend entered' }
    ];
    els.analyticsSummary.innerHTML = cards.map((card) => `<div class="metric"><div class="label">${escapeHtml(card.label)}</div><div class="value">${escapeHtml(card.value)}</div><div class="sub">${escapeHtml(card.sub)}</div></div>`).join('');
  }

  renderTable(els.analyticsLinks, [
    { label: 'Row', render: (row) => row.row_index != null ? `#${escapeHtml(row.row_index)}` : '—' },
    { label: 'Title', render: (row) => escapeHtml(row.title || '(unknown)') },
    { label: 'Clicks', render: (row) => formatNumber(row.clicks) },
    { label: 'Domain', render: (row) => escapeHtml(row.destination_domain || '—') }
  ], links, 'No link clicks yet.');

  renderTable(els.analyticsSources, [
    { label: 'Source', render: (row) => escapeHtml(row.source) },
    { label: 'Medium', render: (row) => escapeHtml(row.medium) },
    { label: 'Views', render: (row) => formatNumber(row.pageViews) },
    { label: 'Clicks', render: (row) => formatNumber(row.clicks) },
    { label: 'CTR', render: (row) => formatPct(row.ctr) },
    { label: 'Spend', render: (row) => formatMoney(row.spend || 0) },
    { label: 'CPC', render: (row) => row.clicks ? formatMoney(row.cpcProxy || 0) : '—' }
  ], sources, 'No source data yet.');

  renderTable(els.analyticsExperiments, [
    { label: 'Variant', render: (row) => escapeHtml(row.variantName || row.variantId || '(unknown)') },
    { label: 'Views', render: (row) => formatNumber(row.pageViews) },
    { label: 'Clicks', render: (row) => formatNumber(row.clicks) },
    { label: 'CTR', render: (row) => formatPct(row.ctr) },
    { label: 'Spend', render: (row) => formatMoney(row.spend || 0) },
    { label: 'CPC', render: (row) => row.clicks ? formatMoney(row.cpcProxy || 0) : '—' }
  ], variants, 'No experiment data yet.');

  renderTable(els.analyticsDestinations, [
    { label: 'Domain', render: (row) => escapeHtml(row.destinationDomain || '(none)') },
    { label: 'Clicks', render: (row) => formatNumber(row.clicks) }
  ], destinations, 'No destination data yet.');

  renderTable(els.analyticsMatrix, [
    { label: 'Source', render: (row) => escapeHtml(row.source) },
    { label: 'Medium', render: (row) => escapeHtml(row.medium) },
    { label: 'Variant', render: (row) => escapeHtml(row.variantName || row.variantId || '(unassigned)') },
    { label: 'Views', render: (row) => formatNumber(row.pageViews) },
    { label: 'Clicks', render: (row) => formatNumber(row.clicks) },
    { label: 'CTR', render: (row) => formatPct(row.ctr) }
  ], matrix, 'No source × variant data yet.');

  renderTable(els.analyticsConsent, [
    { label: 'Region Policy', render: (row) => escapeHtml(row.regionPolicy) },
    { label: 'Records', render: (row) => formatNumber(row.records) },
    { label: 'Analytics', render: (row) => formatPct(row.analyticsAcceptanceRate) },
    { label: 'Ads', render: (row) => formatPct(row.adsAcceptanceRate) },
    { label: 'GPC', render: (row) => formatNumber(row.gpcCount) }
  ], consent, 'No consent records yet.');

  const recommendation = state.analytics?.recommendation || null;
  if (els.analyticsRecommendation) renderRecommendation(recommendation);

  renderTable(els.analyticsSpend, [
    { label: 'Date', render: (row) => escapeHtml(row.spendDate || '') },
    { label: 'Source', render: (row) => escapeHtml(row.source || '—') },
    { label: 'Medium', render: (row) => escapeHtml(row.medium || '—') },
    { label: 'Variant', render: (row) => escapeHtml(row.variantName || row.variantId || '—') },
    { label: 'Amount', render: (row) => formatMoney(row.amount, row.currency || 'USD') },
    { label: 'Note', render: (row) => escapeHtml(row.note || '') },
    { label: 'Action', render: (row) => `<div class="actions" style="margin-top:0"><button data-spend-edit="${escapeAttr(row.id)}">Edit</button><button data-spend-delete="${escapeAttr(row.id)}">Delete</button></div>` }
  ], spend, 'No spend entries yet.');

  if (els.analyticsSpend) {
    els.analyticsSpend.querySelectorAll('[data-spend-edit]').forEach((btn) => {
      btn.onclick = async () => {
        if (!btn.dataset.spendEdit) return;
        editSpendEntry(btn.dataset.spendEdit);
      };
    });
    els.analyticsSpend.querySelectorAll('[data-spend-delete]').forEach((btn) => {
      btn.onclick = async () => {
        if (!btn.dataset.spendDelete) return;
        await deleteSpendEntry(btn.dataset.spendDelete);
      };
    });
  }
}

function renderRecommendation(recommendation) {
  if (!els.analyticsRecommendation) return;
  if (!recommendation?.experimentId) {
    els.analyticsRecommendation.innerHTML = '<div class="muted" style="padding:12px">No active or recent experiment available for recommendation.</div>';
    return;
  }
  const variantsRows = (recommendation.variants || []).map((row) => `
    <tr>
      <td>${escapeHtml(row.variantName || row.variantId)}</td>
      <td>${formatNumber(row.pageViews)}</td>
      <td>${formatNumber(row.clicks)}</td>
      <td>${formatPct(row.ctr)}</td>
      <td>${formatMoney(row.spend || 0)}</td>
      <td>${row.clicks ? formatMoney(row.cpcProxy || 0) : '—'}</td>
    </tr>`).join('');
  const applyButton = recommendation.recommendedVariantId ? `<button id="applyRecommendedWinnerBtn" class="primary">Apply Recommended Winner</button>` : '';
  els.analyticsRecommendation.innerHTML = `
    <div style="padding:14px">
      <div class="row" style="align-items:center">
        <div>
          <div><strong>${escapeHtml(recommendation.experimentName || recommendation.experimentId)}</strong></div>
          <div class="small muted">Confidence: ${escapeHtml(recommendation.confidence || 'observe')} • ${escapeHtml(recommendation.reason || 'Not enough signal yet')}</div>
        </div>
        <div>${recommendation.recommendedVariantId ? `<span class="pill">Recommend ${escapeHtml(recommendation.recommendedVariantName || recommendation.recommendedVariantId)}</span>` : '<span class="pill">Observe</span>'}</div>
      </div>
      <div class="small muted" style="margin-top:10px">${escapeHtml(recommendation.summary || '')}</div>
      <div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Variant</th><th>Views</th><th>Clicks</th><th>CTR</th><th>Spend</th><th>CPC</th></tr></thead><tbody>${variantsRows || '<tr><td colspan="6">No variant stats yet.</td></tr>'}</tbody></table></div>
      <div class="actions">${applyButton}</div>
    </div>`;
  const applyBtn = document.getElementById('applyRecommendedWinnerBtn');
  if (applyBtn) applyBtn.onclick = () => chooseWinner(recommendation.experimentId, recommendation.recommendedVariantId);
}

async function loadAnalytics() {
  if (!currentPageId()) return;
  try {
    const pageId = requirePageId();
    const since = encodeURIComponent(analyticsSinceIso());
    const [summaryData, linksData, experimentsData, sourcesData, destinationsData, matrixData, consentData, spendData, recommendationData] = await Promise.all([
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/summary?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/links?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/experiments?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/sources?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/destinations?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/matrix?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/consent?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/spend?since=${since}`, { method: 'GET', headers: {} }),
      api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/recommendation?since=${since}`, { method: 'GET', headers: {} })
    ]);
    state.analytics = {
      summary: summaryData.summary || null,
      links: linksData.links || [],
      variants: experimentsData.variants || [],
      sources: sourcesData.sources || [],
      destinations: destinationsData.destinations || [],
      matrix: matrixData.matrix || [],
      consent: consentData.consent || [],
      spend: spendData || { summary: { totalSpend: 0 }, entries: [] },
      recommendation: recommendationData?.recommendation || null,
      since: summaryData.since || null
    };
    renderAnalytics();
  } catch (error) {
    state.analytics = { summary: null, links: [], variants: [], sources: [], destinations: [], matrix: [], consent: [], spend: { summary: { totalSpend: 0 }, entries: [] }, recommendation: null };
    renderAnalytics();
    setStatus(error.message, true);
  }
}

function resetSpendForm() {
  if (els.spendEditId) els.spendEditId.value = '';
  if (els.cancelSpendEditBtn) els.cancelSpendEditBtn.classList.add('hidden');
  if (els.saveSpendBtn) els.saveSpendBtn.textContent = 'Save Spend Entry';
  if (els.spendDate && !els.spendDate.value) els.spendDate.value = new Date().toISOString().slice(0, 10);
  if (els.spendSource) els.spendSource.value = '';
  if (els.spendMedium) els.spendMedium.value = '';
  if (els.spendVariantId) els.spendVariantId.value = '';
  if (els.spendAmount) els.spendAmount.value = '';
  if (els.spendNote) els.spendNote.value = '';
}

function editSpendEntry(id) {
  const row = state.analytics?.spend?.entries?.find((entry) => entry.id === id);
  if (!row) return;
  els.spendEditId.value = row.id;
  els.spendDate.value = row.spendDate || new Date().toISOString().slice(0, 10);
  els.spendSource.value = row.source || '';
  els.spendMedium.value = row.medium || '';
  els.spendVariantId.value = row.variantId || '';
  els.spendAmount.value = row.amount != null ? String(row.amount) : '';
  els.spendNote.value = row.note || '';
  els.saveSpendBtn.textContent = 'Update Spend Entry';
  els.cancelSpendEditBtn.classList.remove('hidden');
  els.spendAmount.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveSpendEntry() {
  if (!currentPageId()) return setStatus('Load a page first.', true);
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/spend`, {
      method: 'POST',
      body: JSON.stringify({
        id: els.spendEditId.value.trim() || undefined,
        spendDate: els.spendDate.value,
        source: els.spendSource.value.trim(),
        medium: els.spendMedium.value.trim(),
        variantId: els.spendVariantId.value.trim(),
        amount: Number(els.spendAmount.value || 0),
        note: els.spendNote.value.trim(),
        currency: 'USD'
      })
    });
    resetSpendForm();
    setStatus('Spend entry saved.');
    await loadAnalytics();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function deleteSpendEntry(id) {
  if (!currentPageId()) return;
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/analytics/spend?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {}
    });
    if (els.spendEditId.value === id) resetSpendForm();
    setStatus('Spend entry deleted.');
    await loadAnalytics();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function switchTab(tab) {
  els.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  els.tabPanels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== tab));
  if (tab === 'analytics' && currentPageId()) loadAnalytics();
}

function themeFromForm() {
  return {
    bg: els.themeBg.value,
    surface: els.themeSurface.value,
    text: els.themeText.value,
    muted: els.themeMuted.value,
    accent: els.themeAccent.value,
    border: els.themeBorder.value,
    iconBg: els.themeIconBg.value,
    primaryBg: els.themePrimaryBg.value,
    primaryText: els.themePrimaryText.value,
    secondaryBg: els.themeSecondaryBg.value,
    secondaryText: els.themeSecondaryText.value,
    neutralBg: els.themeNeutralBg.value,
    neutralText: els.themeNeutralText.value,
    fontBody: els.themeFontBody.value.trim() || PRESETS[DEFAULT_PRESET].fontBody,
    fontHeading: els.themeFontHeading.value.trim() || PRESETS[DEFAULT_PRESET].fontHeading,
    gap: els.themeGap.value.trim() || '14px'
  };
}

function fillThemeForm(tokens) {
  const fallback = PRESETS[DEFAULT_PRESET];
  const t = { ...fallback, ...(tokens || {}) };
  els.themeBg.value = normalizeColor(t.bg, fallback.bg);
  els.themeSurface.value = normalizeColor(t.surface, fallback.surface);
  els.themeText.value = normalizeColor(t.text, fallback.text);
  els.themeMuted.value = normalizeColor(t.muted, fallback.muted);
  els.themeAccent.value = normalizeColor(t.accent, fallback.accent);
  els.themeBorder.value = normalizeColor(t.border, fallback.border);
  els.themeIconBg.value = normalizeColor(t.iconBg, fallback.iconBg);
  els.themePrimaryBg.value = normalizeColor(t.primaryBg, fallback.primaryBg);
  els.themePrimaryText.value = normalizeColor(t.primaryText, fallback.primaryText);
  els.themeSecondaryBg.value = normalizeColor(t.secondaryBg, fallback.secondaryBg);
  els.themeSecondaryText.value = normalizeColor(t.secondaryText, fallback.secondaryText);
  els.themeNeutralBg.value = normalizeColor(t.neutralBg, fallback.neutralBg);
  els.themeNeutralText.value = normalizeColor(t.neutralText, fallback.neutralText);
  els.themeFontBody.value = t.fontBody || fallback.fontBody;
  els.themeFontHeading.value = t.fontHeading || fallback.fontHeading;
  els.themeGap.value = t.gap || '14px';
  renderAppearancePreview();
updatePublishMeta();
}

function normalizeColor(value, fallback) {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return fallback;
}

function renderAppearancePreview() {
  const theme = themeFromForm();
  const shell = els.appearancePreview;
  shell.style.setProperty('--pv-bg', theme.bg);
  shell.style.setProperty('--pv-text', theme.text);
  shell.style.setProperty('--pv-surface', theme.surface);
  shell.style.setProperty('--pv-border', theme.border);
  shell.style.setProperty('--pv-icon', theme.iconBg);
  shell.style.fontFamily = theme.fontBody;
  shell.innerHTML = `
    <div style="font-family:${theme.fontHeading};font-size:24px;font-weight:700;letter-spacing:0">${escapeHtml(els.pageTitle.value || 'Fan Lynks')}</div>
    <div style="color:${theme.muted};margin-top:6px">${escapeHtml(els.pageSubtitle.value || 'Cleaner funnels, smarter analytics, and more control.')}</div>
    <div class="preview-row preview-btn primary"><div class="preview-icon">★</div><div><div>Primary CTA</div><div style="opacity:.72;font-size:13px">Highest value action first</div></div></div>
    <div class="preview-row preview-btn secondary"><div class="preview-icon">◎</div><div><div>Secondary CTA</div><div style="opacity:.72;font-size:13px">Supportive offer or signup</div></div></div>
    <div class="preview-row preview-btn neutral"><div class="preview-icon">○</div><div><div>Neutral CTA</div><div style="opacity:.72;font-size:13px">Additional destination</div></div></div>
  `;
}


function fillPrivacyForm(privacyUi) {
  const ui = privacyUi || {};
  els.privacyBannerVersion.value = ui.bannerVersion || 'v1';
  els.privacyChoicesLabel.value = ui.privacyChoicesLabel || 'Your Privacy Choices';
  els.privacyBannerTitle.value = ui.bannerTitle || 'Choose your privacy settings';
  els.privacyFooterNote.value = ui.footerNote || 'Fast, privacy-aware link hub';
  els.privacyBannerBody.value = ui.bannerBody || 'We use optional analytics and marketing tags only if you allow them. Essential features stay on either way.';
  els.privacyAcceptLabel.value = ui.acceptLabel || 'Allow all';
  els.privacyAnalyticsOnlyLabel.value = ui.analyticsOnlyLabel || 'Analytics only';
  els.privacyDeclineLabel.value = ui.declineLabel || 'Essential only';
  els.privacyGpcTitle.value = ui.gpcTitle || 'Global Privacy Control detected';
  els.privacyHonorGpc.checked = ui.honorGpc !== false;
  els.privacyGpcBody.value = ui.gpcBody || 'Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.';
}

function privacyUiFromForm() {
  return {
    bannerVersion: els.privacyBannerVersion.value.trim() || 'v1',
    privacyChoicesLabel: els.privacyChoicesLabel.value.trim() || 'Your Privacy Choices',
    bannerTitle: els.privacyBannerTitle.value.trim() || 'Choose your privacy settings',
    footerNote: els.privacyFooterNote.value.trim() || 'Fast, privacy-aware link hub',
    bannerBody: els.privacyBannerBody.value.trim() || 'We use optional analytics and marketing tags only if you allow them. Essential features stay on either way.',
    acceptLabel: els.privacyAcceptLabel.value.trim() || 'Allow all',
    analyticsOnlyLabel: els.privacyAnalyticsOnlyLabel.value.trim() || 'Analytics only',
    declineLabel: els.privacyDeclineLabel.value.trim() || 'Essential only',
    gpcTitle: els.privacyGpcTitle.value.trim() || 'Global Privacy Control detected',
    honorGpc: els.privacyHonorGpc.checked,
    gpcBody: els.privacyGpcBody.value.trim() || 'Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.'
  };
}

function integrationDefaults() {
  return {
    ga4: { isEnabled: false, config: { measurementId: '', enablePageViews: true, enableClickEvents: true, enableExperimentParameters: true } },
    meta: { isEnabled: false, config: { pixelId: '', eventMappings: { page_view: 'PageView', hero_cta_click: 'ViewContent', link_click: 'ViewContent' } } },
    gtm: { isEnabled: false, config: { containerId: '', advertisingEnabled: false } },
    cfwa: { isEnabled: false, config: { enabled: true } }
  };
}

function fillIntegrationsForm(integrations) {
  const normalized = Array.isArray(integrations)
    ? integrations.reduce((acc, item) => { if (item?.provider) acc[item.provider] = { isEnabled: !!item.isEnabled, config: item.config || {} }; return acc; }, {})
    : (integrations || {});
  const merged = { ...integrationDefaults(), ...normalized };
  state.integrations = merged;
  els.ga4Enabled.checked = Boolean(merged.ga4?.isEnabled);
  els.ga4MeasurementId.value = merged.ga4?.config?.measurementId || '';
  els.ga4PageViews.checked = merged.ga4?.config?.enablePageViews !== false;
  els.ga4ClickEvents.checked = merged.ga4?.config?.enableClickEvents !== false;
  els.ga4ExperimentParams.checked = merged.ga4?.config?.enableExperimentParameters !== false;
  els.metaEnabled.checked = Boolean(merged.meta?.isEnabled);
  els.metaPixelId.value = merged.meta?.config?.pixelId || '';
  els.metaEventMappings.value = JSON.stringify(merged.meta?.config?.eventMappings || { page_view: 'PageView', hero_cta_click: 'ViewContent', link_click: 'ViewContent' }, null, 2);
  els.gtmEnabled.checked = Boolean(merged.gtm?.isEnabled);
  els.gtmContainerId.value = merged.gtm?.config?.containerId || '';
  els.gtmAdvertisingEnabled.checked = Boolean(merged.gtm?.config?.advertisingEnabled);
  els.cfwaEnabled.checked = Boolean(merged.cfwa?.isEnabled);
  els.cfwaOverlayEnabled.checked = merged.cfwa?.config?.enabled !== false;
}

function integrationsFromForm() {
  return {
    ga4: {
      isEnabled: els.ga4Enabled.checked,
      config: {
        measurementId: els.ga4MeasurementId.value.trim(),
        enablePageViews: els.ga4PageViews.checked,
        enableClickEvents: els.ga4ClickEvents.checked,
        enableExperimentParameters: els.ga4ExperimentParams.checked
      }
    },
    meta: {
      isEnabled: els.metaEnabled.checked,
      config: {
        pixelId: els.metaPixelId.value.trim(),
        eventMappings: safeParseTextareaJson(els.metaEventMappings.value, {})
      }
    },
    gtm: {
      isEnabled: els.gtmEnabled.checked,
      config: {
        containerId: els.gtmContainerId.value.trim(),
        advertisingEnabled: els.gtmAdvertisingEnabled.checked
      }
    },
    cfwa: {
      isEnabled: els.cfwaEnabled.checked,
      config: {
        enabled: els.cfwaOverlayEnabled.checked
      }
    }
  };
}

function safeParseTextareaJson(value, fallback) {
  try { return value.trim() ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function hydratePageForm(payload) {
  const page = payload.page;
  state.payload = payload;
  state.links = [...(payload.links || [])].sort((a, b) => a.rowOrder - b.rowOrder);
  els.pageTitle.value = page.title || '';
  els.pageSubtitle.value = page.subtitle || '';
  els.pageAvatar.value = page.avatarUrl || '';
  els.heroLabel.value = page.heroCtaLabel || '';
  els.heroUrl.value = page.heroCtaUrl || '';
  els.announcementEnabled.checked = Boolean(page.announcementEnabled);
  els.announcementText.value = page.announcementText || '';
  els.announcementUrl.value = page.announcementUrl || '';
  els.trackingMode.value = page.trackingMode || 'none';
  els.privacyMode.value = page.privacyMode || 'default_standard';
  fillThemeForm(page.themeTokens || PRESETS[DEFAULT_PRESET]);
  fillPrivacyForm(payload.privacyUi || page.privacyUi || {});
  fillIntegrationsForm(payload.integrations || {});
  renderLinks();
  renderAppearancePreview();
}

async function checkSession(refresh = false) {
  try {
    const suffix = refresh ? '?refresh=1' : '';
    const data = await api(`/api/admin/session${suffix}`, { method: 'GET', headers: {} });
    const authed = Boolean(data?.authenticated);
    state.sessionInfo = data || null;
    els.loginPanel.classList.toggle('hidden', authed);
    els.logoutBtn.classList.toggle('hidden', !authed);
    if (els.passwordPanel) els.passwordPanel.classList.toggle('hidden', !authed);
    updateSessionUi();
  } catch {
    handleSessionExpired();
  }
}

async function refreshSessionManually() {
  setStatus('Refreshing session...');
  await checkSession(true);
  if (state.sessionInfo?.authenticated && state.sessionInfo?.refreshed) {
    await checkSession(false);
    setStatus('Session refreshed.');
    return;
  }
  if (state.sessionInfo?.authenticated) {
    setStatus('Session is still active.');
  }
}

async function loadTurnstile() {
  if (!els.turnstileWidget) return;
  try {
    const config = await api('/api/admin/config', { method: 'GET', headers: {} });
    if (!config.turnstileSiteKey) {
      els.turnstileWidget.textContent = 'Turnstile site key is not configured.';
      return;
    }

    await loadTurnstileScript();
    if (!window.turnstile || turnstileWidgetId !== null) return;
    turnstileWidgetId = window.turnstile.render(els.turnstileWidget, {
      sitekey: config.turnstileSiteKey,
      action: 'admin_login',
      callback: (token) => { els.turnstileToken.value = token; },
      'expired-callback': () => { els.turnstileToken.value = ''; },
      'error-callback': showTurnstileError
    });
  } catch (error) {
    els.turnstileWidget.textContent = error.message || 'Unable to load Turnstile.';
  }
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector('script[data-turnstile="1"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = '1';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function resetTurnstile() {
  els.turnstileToken.value = '';
  if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
}

async function maybeRefreshSession() {
  if (!state.sessionInfo?.authenticated) return;
  const ms = expiresInMs(state.sessionInfo.user?.expiresAt);
  const recentlyActive = (Date.now() - state.lastInteractionAt) < 5 * 60000;
  if (ms > 10 * 60000 || !recentlyActive) { updateSessionUi(); return; }
  await checkSession(true);
}

async function login() {
  setStatus('Logging in...');
  try {
    const token = els.turnstileToken.value.trim();
    if (!token) throw new Error('Complete the Turnstile challenge first.');
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: els.email.value.trim(),
        password: els.password.value,
        turnstileToken: token
      })
    });
    await checkSession();
    setStatus('Logged in.');
  } catch (error) {
    setStatus(error.message, true);
    resetTurnstile();
  }
}

async function logout() {
  clearAxiomTokenDisclosure();
  try {
    await api('/api/admin/logout', { method: 'POST', headers: {} });
    await checkSession();
    setStatus('Logged out.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function clearPasswordFields() {
  if (els.currentPassword) els.currentPassword.value = '';
  if (els.newPassword) els.newPassword.value = '';
  if (els.confirmPassword) els.confirmPassword.value = '';
}

async function changePassword() {
  setStatus('Changing password...');
  try {
    await api('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: els.currentPassword.value,
        newPassword: els.newPassword.value,
        confirmPassword: els.confirmPassword.value
      })
    });
    clearPasswordFields();
    state.sessionInfo = null;
    handleSessionExpired();
    setStatus('Password changed. Log in again.', true);
    resetTurnstile();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadPage() {
  setStatus('Loading page...');
  clearAxiomTokenDisclosure();
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}`, { method: 'GET', headers: {} });
    hydratePageForm(data.page);
    await Promise.all([loadIntegrations(), loadExperiments(), loadAnalytics(), loadAxiomToken()]);
    setStatus('Page loaded.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function clearAxiomTokenDisclosure() {
  if (els.axiomIssuedToken) {
    els.axiomIssuedToken.value = '';
    els.axiomIssuedToken.type = 'password';
  }
  if (els.axiomIssuedTokenPanel) els.axiomIssuedTokenPanel.classList.add('hidden');
}

function handlePageTargetChange() {
  clearAxiomTokenDisclosure();
  if (els.axiomTokenStatus) els.axiomTokenStatus.textContent = 'Load the selected page to manage its AXIOM token.';
  if (els.issueAxiomTokenBtn) els.issueAxiomTokenBtn.disabled = true;
  if (els.revokeAxiomTokenBtn) els.revokeAxiomTokenBtn.classList.add('hidden');
}

function renderAxiomTokenStatus(token) {
  if (!els.axiomTokenStatus) return;
  els.issueAxiomTokenBtn.disabled = false;
  if (token?.configured) {
    const used = token.lastUsedAt ? ` Last used ${new Date(token.lastUsedAt).toLocaleString()}.` : ' Not used yet.';
    els.axiomTokenStatus.textContent = `Active token ${token.prefix}, created ${new Date(token.createdAt).toLocaleString()}.${used}`;
    els.issueAxiomTokenBtn.textContent = 'Rotate token';
    els.revokeAxiomTokenBtn.classList.remove('hidden');
  } else {
    els.axiomTokenStatus.textContent = 'No AXIOM token is active for this page.';
    els.issueAxiomTokenBtn.textContent = 'Issue token';
    els.revokeAxiomTokenBtn.classList.add('hidden');
  }
}

async function loadAxiomToken() {
  clearAxiomTokenDisclosure();
  if (!els.axiomTokenStatus || !currentPageId()) return;
  els.axiomTokenStatus.textContent = 'Checking AXIOM token status...';
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}/axiom-token`, { method: 'GET', headers: {} });
    renderAxiomTokenStatus(data.token);
  } catch (error) {
    els.axiomTokenStatus.textContent = `Token controls unavailable: ${error.message}`;
    els.issueAxiomTokenBtn.disabled = false;
    els.revokeAxiomTokenBtn.classList.add('hidden');
  }
}

async function issueAxiomToken() {
  clearAxiomTokenDisclosure();
  els.axiomTokenStatus.textContent = 'Issuing page-scoped AXIOM token...';
  els.issueAxiomTokenBtn.disabled = true;
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}/axiom-token`, { method: 'POST', headers: {} });
    els.axiomIssuedToken.value = data.token;
    els.axiomIssuedToken.type = 'text';
    els.axiomIssuedTokenPanel.classList.remove('hidden');
    renderAxiomTokenStatus({ configured: true, prefix: data.tokenPrefix, createdAt: data.createdAt, lastUsedAt: null });
    setStatus(data.rotated ? 'AXIOM token rotated. Copy the new token now; the previous token was revoked.' : 'AXIOM token issued. Copy it now; it will not be shown again.');
  } catch (error) {
    els.axiomTokenStatus.textContent = `Token issue failed: ${error.message}`;
    setStatus(error.message, true);
  } finally {
    els.issueAxiomTokenBtn.disabled = false;
  }
}

async function revokeAxiomToken() {
  if (!window.confirm('Revoke the active AXIOM token for this page? AXIOM analytics sync will stop until a new token is issued.')) return;
  els.revokeAxiomTokenBtn.disabled = true;
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/axiom-token`, { method: 'DELETE', headers: {} });
    clearAxiomTokenDisclosure();
    renderAxiomTokenStatus({ configured: false });
    setStatus('AXIOM token revoked.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    els.revokeAxiomTokenBtn.disabled = false;
  }
}

async function copyAxiomToken() {
  try {
    await navigator.clipboard.writeText(els.axiomIssuedToken.value);
    setStatus('AXIOM token copied. Store it in AXIOM before hiding it.');
  } catch {
    setStatus('Copy failed. Select and copy the token field manually.', true);
  }
}

function buildPageBody() {
  return {
    title: els.pageTitle.value.trim(),
    subtitle: els.pageSubtitle.value.trim() || null,
    avatarUrl: els.pageAvatar.value.trim() || null,
    announcementEnabled: els.announcementEnabled.checked,
    announcementText: els.announcementText.value.trim() || null,
    announcementUrl: els.announcementUrl.value.trim() || null,
    heroCtaLabel: els.heroLabel.value.trim() || null,
    heroCtaUrl: els.heroUrl.value.trim() || null,
    trackingMode: els.trackingMode.value,
    privacyMode: els.privacyMode.value,
    themeTokens: themeFromForm(),
    privacyUi: privacyUiFromForm()
  };
}

async function savePage() {
  setStatus('Saving page...');
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}`, { method: 'PUT', body: JSON.stringify(buildPageBody()) });
    await loadPage();
    setDirty(false);
    setStatus('Draft saved.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveAppearance() { return savePage(); }
async function savePrivacy() { return savePage(); }

async function publishPage() {
  setStatus('Publishing page...');
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}/publish`, { method: 'POST', headers: {} });
    if (state.payload?.page) {
      state.payload.page.publishedVersion = data.publishedVersion;
      state.payload.page.slug = data.slug || state.payload.page.slug;
    }
    setDirty(false);
    updatePublishMeta();
    setStatus(`Published live: /${data.slug} (v${data.publishedVersion})`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadIntegrations() {
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}/integrations`, { method: 'GET', headers: {} });
    fillIntegrationsForm(data.integrations || {});
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveIntegrations() {
  setStatus('Saving integrations...');
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/integrations`, { method: 'PUT', body: JSON.stringify({ integrations: integrationsFromForm() }) });
    await loadIntegrations();
    setStatus('Integrations saved.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderLinks() {
  els.linksList.innerHTML = '';
  if (!state.links.length) {
    els.linksList.innerHTML = '<div class="muted">No links yet.</div>';
    return;
  }
  state.links.forEach((link, index) => {
    const card = document.createElement('div');
    card.className = 'link-card';
    card.innerHTML = `
      <div class="row" style="align-items:center">
        <div>
          <h3>${escapeHtml(link.title)}</h3>
          <div class="small muted">#${index + 1} • ${escapeHtml(link.styleRole || 'neutral')}</div>
        </div>
        <div class="actions" style="justify-content:flex-end">
          <button data-action="up">↑</button>
          <button data-action="down">↓</button>
          <button data-action="save" class="alt">Save</button>
          <button data-action="delete" class="danger">Delete</button>
        </div>
      </div>
      <div class="row">
        <div><label>Title</label><input data-field="title" value="${escapeAttr(link.title || '')}" /></div>
        <div><label>URL</label><input data-field="url" value="${escapeAttr(link.url || '')}" /></div>
      </div>
      <label>Subtitle</label><input data-field="subtitle" value="${escapeAttr(link.subtitle || '')}" />
      <div class="row">
        <div><label>Icon type</label><select data-field="iconType"><option value="none">None</option><option value="emoji">Emoji</option><option value="image">Image URL</option></select></div>
        <div><label>Icon value</label><input data-field="iconValue" value="${escapeAttr(link.iconValue || '')}" /></div>
        <div><label>Badge</label><input data-field="badgeText" value="${escapeAttr(link.badgeText || '')}" /></div>
      </div>
      <div class="row">
        <div><label>Style role</label><select data-field="styleRole"><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="neutral">Neutral</option></select></div>
        <div><label>Start at</label><input data-field="startAt" placeholder="2026-04-09T00:00:00Z" value="${escapeAttr(link.startAt || '')}" /></div>
        <div><label>End at</label><input data-field="endAt" placeholder="2026-04-30T00:00:00Z" value="${escapeAttr(link.endAt || '')}" /></div>
      </div>
      <label><input data-field="isEnabled" type="checkbox" style="width:auto;margin-right:8px" ${link.isEnabled === false ? '' : 'checked'} /> Enabled</label>
    `;
    card.querySelector('[data-field="iconType"]').value = link.iconType || 'none';
    card.querySelector('[data-field="styleRole"]').value = link.styleRole || 'neutral';
    card.querySelector('[data-action="up"]').onclick = () => moveLink(index, -1);
    card.querySelector('[data-action="down"]').onclick = () => moveLink(index, 1);
    card.querySelector('[data-action="save"]').onclick = () => saveLink(card, link.id, index);
    card.querySelector('[data-action="delete"]').onclick = () => deleteLink(link.id);
    els.linksList.appendChild(card);
  });
}

function moveLink(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.links.length) return;
  const copy = [...state.links];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  state.links = copy.map((link, i) => ({ ...link, rowOrder: i + 1 }));
  renderLinks();
}

async function saveCurrentOrder() {
  setStatus('Saving link order...');
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/links/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedLinkIds: state.links.map((link) => link.id) })
    });
    await loadPage();
    setStatus('Link order saved.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function createLink() {
  setStatus('Creating link...');
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/links`, {
      method: 'POST',
      body: JSON.stringify({
        title: els.newLinkTitle.value.trim(),
        url: els.newLinkUrl.value.trim(),
        subtitle: els.newLinkSubtitle.value.trim() || null,
        iconType: els.newLinkIconType.value,
        iconValue: els.newLinkIconValue.value.trim() || null,
        badgeText: els.newLinkBadge.value.trim() || null,
        styleRole: els.newLinkStyleRole.value
      })
    });
    els.newLinkTitle.value = '';
    els.newLinkUrl.value = '';
    els.newLinkSubtitle.value = '';
    els.newLinkIconValue.value = '';
    els.newLinkBadge.value = '';
    await loadPage();
    switchTab('links');
    setStatus('Link created.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveLink(card, linkId, index) {
  setStatus('Saving link...');
  try {
    const body = {
      title: card.querySelector('[data-field="title"]').value.trim(),
      url: card.querySelector('[data-field="url"]').value.trim(),
      subtitle: card.querySelector('[data-field="subtitle"]').value.trim() || null,
      iconType: card.querySelector('[data-field="iconType"]').value,
      iconValue: card.querySelector('[data-field="iconValue"]').value.trim() || null,
      badgeText: card.querySelector('[data-field="badgeText"]').value.trim() || null,
      styleRole: card.querySelector('[data-field="styleRole"]').value,
      rowOrder: index + 1,
      startAt: card.querySelector('[data-field="startAt"]').value.trim() || null,
      endAt: card.querySelector('[data-field="endAt"]').value.trim() || null,
      isEnabled: card.querySelector('[data-field="isEnabled"]').checked
    };
    await api(`/api/admin/link/${encodeURIComponent(linkId)}`, { method: 'PUT', body: JSON.stringify(body) });
    await loadPage();
    switchTab('links');
    setStatus('Link saved.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function deleteLink(linkId) {
  if (!window.confirm('Delete this link?')) return;
  setStatus('Deleting link...');
  try {
    await api(`/api/admin/link/${encodeURIComponent(linkId)}`, { method: 'DELETE', headers: {} });
    await loadPage();
    switchTab('links');
    setStatus('Link deleted.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function generateVariants() {
  const count = Math.max(1, Math.min(6, Number(els.variantCount.value || 2)));
  const weight = Math.max(1, Math.floor(100 / count));
  const variants = Array.from({ length: count }, (_, i) => ({
    name: `Variant ${String.fromCharCode(65 + i)}`,
    weight,
    isEnabled: true,
    tokens: EXP_PRESETS[i % EXP_PRESETS.length],
    contentOverrides: i === 0 ? { headline: 'Control' } : null
  }));
  els.newVariants.value = JSON.stringify(variants, null, 2);
}

async function loadExperiments() {
  try {
    const pageId = requirePageId();
    const data = await api(`/api/admin/page/${encodeURIComponent(pageId)}/experiments`, { method: 'GET', headers: {} });
    state.experiments = data.experiments || [];
    renderExperiments();
  } catch (error) {
    state.experiments = [];
    renderExperiments();
    throw error;
  }
}

function renderExperiments() {
  els.experiments.innerHTML = '';
  if (!state.experiments.length) {
    els.experiments.innerHTML = '<div class="muted">No experiments yet.</div>';
    return;
  }
  state.experiments.forEach((experiment) => {
    const card = document.createElement('div');
    card.className = 'card';
    const variantsJson = JSON.stringify(experiment.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      weight: variant.weight,
      isEnabled: variant.isEnabled,
      tokens: variant.tokens,
      contentOverrides: variant.contentOverrides
    })), null, 2);
    card.innerHTML = `
      <div class="row" style="align-items:center">
        <div>
          <h3>${escapeHtml(experiment.name)}</h3>
          <div class="small muted"><span class="pill">${escapeHtml(experiment.status)}</span>TTL ${experiment.assignmentTtlDays}d ${experiment.winnerVariantId ? `• winner ${escapeHtml(experiment.winnerVariantId)}` : ''}</div>
        </div>
        <div class="actions" style="justify-content:flex-end">
          <button data-action="start">Start</button>
          <button data-action="pause">Pause</button>
        </div>
      </div>
      <label>Name</label><input data-field="name" value="${escapeAttr(experiment.name)}" />
      <div class="row"><div><label>TTL days</label><input data-field="ttl" type="number" min="1" max="180" value="${experiment.assignmentTtlDays}" /></div><div><label>Winner variant ID</label><input data-field="winner" placeholder="var_xxx" value="${escapeAttr(experiment.winnerVariantId || '')}" /></div></div>
      <label>Variants JSON</label><textarea data-field="variants">${escapeHtml(variantsJson)}</textarea>
      <div class="actions"><button data-action="save" class="alt">Save</button><button data-action="winner" class="primary">Mark Winner</button></div>
    `;
    card.querySelector('[data-action="start"]').onclick = () => mutateExperiment(experiment.id, 'start');
    card.querySelector('[data-action="pause"]').onclick = () => mutateExperiment(experiment.id, 'pause');
    card.querySelector('[data-action="save"]').onclick = () => saveExperiment(experiment.id, card);
    card.querySelector('[data-action="winner"]').onclick = () => chooseWinner(experiment.id, card.querySelector('[data-field="winner"]').value.trim());
    els.experiments.appendChild(card);
  });
}

async function createExperiment() {
  setStatus('Creating experiment...');
  try {
    const pageId = requirePageId();
    await api(`/api/admin/page/${encodeURIComponent(pageId)}/experiments`, {
      method: 'POST',
      body: JSON.stringify({
        name: els.newName.value.trim(),
        assignmentTtlDays: Number(els.newTtl.value || 30),
        variants: JSON.parse(els.newVariants.value || '[]')
      })
    });
    els.newName.value = '';
    await loadExperiments();
    setStatus('Experiment created.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function mutateExperiment(experimentId, action) {
  setStatus(`${action === 'start' ? 'Starting' : 'Pausing'} experiment...`);
  try {
    await api(`/api/admin/experiment/${encodeURIComponent(experimentId)}/${action}`, { method: 'POST', headers: {} });
    await loadExperiments();
    setStatus(`Experiment ${action}ed.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveExperiment(experimentId, card) {
  setStatus('Saving experiment...');
  try {
    await api(`/api/admin/experiment/${encodeURIComponent(experimentId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: card.querySelector('[data-field="name"]').value.trim(),
        assignmentTtlDays: Number(card.querySelector('[data-field="ttl"]').value || 30),
        variants: JSON.parse(card.querySelector('[data-field="variants"]').value || '[]')
      })
    });
    await loadExperiments();
    setStatus('Experiment saved.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function chooseWinner(experimentId, winnerVariantId) {
  if (!winnerVariantId) return setStatus('Winner variant ID is required.', true);
  setStatus('Marking winner...');
  try {
    await api(`/api/admin/experiment/${encodeURIComponent(experimentId)}/winner`, {
      method: 'POST',
      body: JSON.stringify({ winnerVariantId })
    });
    await loadExperiments();
    setStatus('Winner selected.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function fillPresetOptions() {
  els.appearancePreset.innerHTML = Object.keys(PRESETS).map((key) => `<option value="${key}">${key.replace(/_/g, ' ')}</option>`).join('');
}

function applyPreset() {
  fillThemeForm(PRESETS[els.appearancePreset.value] || PRESETS[DEFAULT_PRESET]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function escapeAttr(value) { return escapeHtml(value); }

function wire() {
  els.loginBtn.onclick = login;
  els.logoutBtn.onclick = logout;
  if (els.changePasswordBtn) els.changePasswordBtn.onclick = changePassword;
  els.loadBtn.onclick = loadPage;
  els.previewBtn.onclick = () => {
    if (!state.payload?.page?.slug) return setStatus('Load a page first.', true);
    window.open(`/${encodeURIComponent(state.payload.page.slug)}`, '_blank');
  };
  els.savePageBtn.onclick = savePage;
  if (els.publishPageBtn) els.publishPageBtn.onclick = publishPage;
  els.saveAppearanceBtn.onclick = saveAppearance;
  els.saveIntegrationsBtn.onclick = saveIntegrations;
  if (els.issueAxiomTokenBtn) els.issueAxiomTokenBtn.onclick = issueAxiomToken;
  if (els.revokeAxiomTokenBtn) els.revokeAxiomTokenBtn.onclick = revokeAxiomToken;
  if (els.copyAxiomTokenBtn) els.copyAxiomTokenBtn.onclick = copyAxiomToken;
  if (els.hideAxiomTokenBtn) els.hideAxiomTokenBtn.onclick = clearAxiomTokenDisclosure;
  if (els.pageId) els.pageId.addEventListener('input', handlePageTargetChange);
  els.savePrivacyBtn.onclick = savePrivacy;
  els.createLinkBtn.onclick = createLink;
  els.saveOrderBtn.onclick = saveCurrentOrder;
  els.generateBtn.onclick = generateVariants;
  els.createBtn.onclick = createExperiment;
  if (els.refreshAnalyticsBtn) els.refreshAnalyticsBtn.onclick = () => loadAnalytics();
  if (els.refreshRecommendationBtn) els.refreshRecommendationBtn.onclick = () => loadAnalytics();
  if (els.saveSpendBtn) els.saveSpendBtn.onclick = saveSpendEntry;
  if (els.cancelSpendEditBtn) els.cancelSpendEditBtn.onclick = resetSpendForm;
  if (els.sessionRefreshBtn) els.sessionRefreshBtn.onclick = refreshSessionManually;
  if (els.analyticsWindow) els.analyticsWindow.onchange = () => { if (currentPageId()) loadAnalytics(); };
  els.tabButtons.forEach((btn) => btn.onclick = () => switchTab(btn.dataset.tab));
  els.appearancePreset.onchange = applyPreset;
  [els.pageTitle, els.pageSubtitle, els.pageAvatar, els.heroLabel, els.heroUrl, els.announcementText, els.announcementUrl, els.trackingMode, els.privacyMode, els.themeBg, els.themeSurface, els.themeText, els.themeMuted, els.themeAccent, els.themeBorder, els.themeIconBg, els.themePrimaryBg, els.themePrimaryText, els.themeSecondaryBg, els.themeSecondaryText, els.themeNeutralBg, els.themeNeutralText, els.themeFontBody, els.themeFontHeading, els.themeGap, els.privacyBannerVersion, els.privacyChoicesLabel, els.privacyBannerTitle, els.privacyFooterNote, els.privacyBannerBody, els.privacyAcceptLabel, els.privacyAnalyticsOnlyLabel, els.privacyDeclineLabel, els.privacyGpcTitle, els.privacyGpcBody].forEach((el) => el && el.addEventListener('input', () => { renderAppearancePreview(); setDirty(true); }));
  [els.announcementEnabled, els.privacyHonorGpc].forEach((el) => el && el.addEventListener('change', () => setDirty(true)));
}

fillPresetOptions();
generateVariants();
resetSpendForm();
wire();
['click','keydown','pointerdown'].forEach((eventName) => window.addEventListener(eventName, touchInteraction, { passive: true }));
checkSession();
loadTurnstile();
setInterval(maybeRefreshSession, 60_000);
switchTab('page');
renderAppearancePreview();
