const $ = (id) => document.getElementById(id);
const state = { dashboard: null, settings: null };

function showStatus(message, isError = false) {
  const status = $('dashboardStatus');
  status.textContent = message || '';
  status.dataset.error = isError ? 'true' : 'false';
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.assign('/login?expired=1');
    throw new Error('Your session expired. Sign in again.');
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function setTab(name, focus = false) {
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (focus && selected) tab.focus();
  });
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => { panel.hidden = panel.id !== `panel-${name}`; });
  history.replaceState(null, '', `#${name}`);
}

function metricText(value) { return new Intl.NumberFormat().format(Number(value || 0)); }

function renderDashboard() {
  const { tenant, page, links, analytics } = state.dashboard;
  $('workspaceTitle').textContent = tenant.name;
  $('accountEmail').textContent = state.settings.settings.email;
  $('publicPageLink').href = page.publicUrl;
  $('publicPageLink').hidden = false;
  $('pageTitle').value = page.title;
  $('pageSubtitle').value = page.subtitle || '';
  $('overviewPageTitle').textContent = page.title;
  $('overviewPageSummary').textContent = page.subtitle || 'Add a short introduction in Page settings.';
  $('overviewLinkCount').textContent = links.length ? `${links.length} ${links.length === 1 ? 'link' : 'links'} on your page.` : 'Your page has no links yet. Add your first destination in Links.';
  $('overviewViews').textContent = metricText(analytics.pageViews);
  $('overviewClicks').textContent = metricText(analytics.linkClicks);
  $('analyticsViews').textContent = metricText(analytics.pageViews);
  $('analyticsClicks').textContent = metricText(analytics.linkClicks);
  $('overviewViewsNote').textContent = Number(analytics.pageViews) ? 'Recorded visits' : 'No visits recorded yet';
  $('overviewClicksNote').textContent = Number(analytics.linkClicks) ? 'Recorded clicks' : 'No clicks recorded yet';
  $('analyticsViewsNote').textContent = Number(analytics.pageViews) ? 'Recorded visits' : 'No page views recorded';
  $('analyticsClicksNote').textContent = Number(analytics.linkClicks) ? 'Recorded clicks' : 'No link clicks recorded';
  $('analyticsEmpty').hidden = Boolean(analytics.pageViews || analytics.linkClicks);
  $('profileName').value = state.settings.settings.profile_name;
  $('settingsEmail').textContent = `Signed in as ${state.settings.settings.email}.`;
  renderLinks(links);
}

function renderLinks(links) {
  const list = $('linkList');
  list.replaceChildren();
  if (!links.length) {
    const empty = document.createElement('p');
    empty.className = 'auth-note';
    empty.textContent = 'No links yet. Add your first destination below.';
    list.append(empty);
    return;
  }
  for (const item of links) {
    const form = document.createElement('form');
    form.className = 'link-editor';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'link-title';
    titleLabel.textContent = 'Title';
    const title = document.createElement('input');
    title.maxLength = 120;
    title.required = true;
    title.value = item.title;
    titleLabel.append(title);
    const urlLabel = document.createElement('label');
    urlLabel.className = 'link-url';
    urlLabel.textContent = 'Destination URL';
    const url = document.createElement('input');
    url.type = 'url';
    url.maxLength = 2048;
    url.required = true;
    url.value = item.url;
    urlLabel.append(url);
    const subtitleLabel = document.createElement('label');
    subtitleLabel.className = 'link-subtitle';
    subtitleLabel.textContent = 'Description';
    const subtitle = document.createElement('input');
    subtitle.maxLength = 180;
    subtitle.value = item.subtitle || '';
    subtitleLabel.append(subtitle);
    const actions = document.createElement('div');
    actions.className = 'link-actions';
    const save = document.createElement('button');
    save.className = 'primary';
    save.type = 'submit';
    save.textContent = 'Save';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger-action';
    remove.textContent = 'Remove';
    actions.append(save, remove);
    form.append(titleLabel, urlLabel, subtitleLabel, actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showStatus('Saving link…');
      try {
        await api(`/api/customer/links/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify({ title: title.value, subtitle: subtitle.value, url: url.value }) });
        await refreshDashboard();
        showStatus('Link saved.');
      } catch (error) { showStatus(error.message, true); }
    });
    remove.addEventListener('click', async () => {
      if (!confirm(`Remove “${item.title}” from your page?`)) return;
      showStatus('Removing link…');
      try {
        await api(`/api/customer/links/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        await refreshDashboard();
        showStatus('Link removed.');
      } catch (error) { showStatus(error.message, true); }
    });
    list.append(form);
  }
}

async function refreshDashboard() {
  const [dashboard, settings] = await Promise.all([api('/api/customer/dashboard'), api('/api/customer/settings')]);
  state.dashboard = dashboard;
  state.settings = settings;
  renderDashboard();
}

async function start() {
  try {
    await api('/api/customer/session');
    await refreshDashboard();
    showStatus('');
    const initialTab = ['overview', 'page', 'links', 'analytics', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    setTab(initialTab);
  } catch (error) {
    if (!location.pathname.endsWith('/login')) location.assign('/login');
  }
}

document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
document.querySelector('.dashboard-nav').addEventListener('keydown', (event) => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const current = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  let next = current;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
  if (next !== current) { event.preventDefault(); setTab(tabs[next].dataset.tab, true); }
});

$('pageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  showStatus('Saving page…');
  try {
    await api('/api/customer/page', { method: 'PUT', body: JSON.stringify({ title: $('pageTitle').value, subtitle: $('pageSubtitle').value }) });
    await refreshDashboard();
    showStatus('Page saved.');
  } catch (error) { showStatus(error.message, true); }
});

$('newLinkForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  showStatus('Adding link…');
  try {
    await api('/api/customer/links', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    await refreshDashboard();
    showStatus('Link added.');
  } catch (error) { showStatus(error.message, true); }
});

$('settingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  showStatus('Saving settings…');
  try {
    await api('/api/customer/settings', { method: 'PUT', body: JSON.stringify({ profileName: $('profileName').value }) });
    await refreshDashboard();
    showStatus('Settings saved.');
  } catch (error) { showStatus(error.message, true); }
});

$('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentPassword = $('currentPassword').value;
  const newPassword = $('newPassword').value;
  if (newPassword !== $('confirmPassword').value) return showStatus('Passwords do not match.', true);
  showStatus('Changing password…');
  try {
    const result = await api('/api/customer/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
    showStatus(result.message);
    location.assign('/login');
  } catch (error) { showStatus(error.message, true); }
});

$('logoutBtn').addEventListener('click', async () => {
  $('logoutBtn').disabled = true;
  try {
    await api('/api/customer/logout', { method: 'POST' });
    location.assign('/login');
  } catch (error) {
    $('logoutBtn').disabled = false;
    showStatus(error.message, true);
  }
});

start();
