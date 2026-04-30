#!/usr/bin/env node

import fs from 'node:fs';

const args = parseArgs(process.argv.slice(2));
const base = normalizeBase(args.base || process.env.CUSTOM_LINK_HUB_BASE_URL || 'http://127.0.0.1:8788');
const slug = args.slug || process.env.CUSTOM_LINK_HUB_PAGE_SLUG || 'home';
const verbose = Boolean(args.verbose);

const jar = new Map();
const report = [];
let exitCode = 0;

async function main() {
  log(`Smoke testing ${base} using slug "${slug}"`);

  const pageApi = await step('GET /api/page/:slug', async () => {
    const res = await request(`/api/page/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } });
    const data = await readJsonSafe(res);
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(data?.ok, 'Expected ok=true payload');
    assert(data?.page?.id, 'Expected page.id');
    assert(Array.isArray(data?.links), 'Expected links array');
    return data;
  });

  const pageId = pageApi?.page?.id;
  const pageTitle = pageApi?.page?.title || '(untitled)';
  const firstLink = Array.isArray(pageApi?.links) && pageApi.links.length > 0 ? pageApi.links[0] : null;
  rememberSessionFromPayload(pageApi);

  await step('GET /api/privacy/state', async () => {
    assert(pageId, 'Missing page id from page payload');
    const res = await request(`/api/privacy/state?page_id=${encodeURIComponent(pageId)}`, { headers: { accept: 'application/json' } });
    const data = await readJsonSafe(res);
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(data?.ok, 'Expected ok=true payload');
    assert(data?.consent, 'Expected consent object');
    return data;
  });

  await step('POST /api/events page_view', async () => {
    assert(pageId, 'Missing page id from page payload');
    const body = {
      event_name: 'page_view',
      page_id: pageId,
      page_slug: slug,
      occurred_at: new Date().toISOString()
    };
    const res = await request('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await readJsonSafe(res);
    rememberSessionFromPayload(data);
    assert(res.status === 202 || res.status === 200, `Expected 200/202, got ${res.status}`);
    assert(data?.ok && data?.stored, 'Expected stored event payload');
    return data;
  });

  if (firstLink?.id && firstLink?.url) {
    await step('POST /api/events link_click', async () => {
      const body = {
        event_name: 'link_click',
        page_id: pageId,
        page_slug: slug,
        link_id: firstLink.id,
        section_id: firstLink.sectionId || null,
        row_index: typeof firstLink.rowOrder === 'number' ? firstLink.rowOrder : null,
        destination_url: firstLink.url,
        destination_domain: domainOf(firstLink.url),
        occurred_at: new Date().toISOString()
      };
      const res = await request('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await readJsonSafe(res);
      assert(res.status === 202 || res.status === 200, `Expected 200/202, got ${res.status}`);
      assert(data?.ok && data?.stored, 'Expected stored link_click payload');
      return data;
    });
  } else {
    note('Skipped link_click smoke because the page payload had no usable links.');
  }

  await step('POST /api/privacy/consent', async () => {
    assert(pageId, 'Missing page id from page payload');
    const body = {
      page_id: pageId,
      analytics: 'granted',
      advertising: 'denied',
      banner_version: 'smoke-test-v1'
    };
    const res = await request('/api/privacy/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await readJsonSafe(res);
    rememberSessionFromPayload(data);
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(data?.ok && data?.saved, 'Expected saved consent payload');
    return data;
  });

  await step('GET /api/privacy/state after consent', async () => {
    const res = await request(`/api/privacy/state?page_id=${encodeURIComponent(pageId)}`, { headers: { accept: 'application/json' } });
    const data = await readJsonSafe(res);
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(data?.consent?.analytics === 'granted', 'Expected analytics consent to become granted');
    assert(data?.consent?.advertising === 'denied', 'Expected advertising consent to become denied');
    return data;
  });

  await step('GET /slug HTML shell', async () => {
    const res = await request(`/${encodeURIComponent(slug)}`, { headers: { accept: 'text/html' } });
    const text = await res.text();
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(/privacyChoices|app\.js|Custom Link Hub/i.test(text), 'Expected public HTML shell markers');
    return { bytes: text.length };
  });

  await step('GET /admin.html shell', async () => {
    const res = await request('/admin.html', { headers: { accept: 'text/html' } });
    const text = await res.text();
    assert(res.ok, `Expected 2xx, got ${res.status}`);
    assert(/Admin|login|Custom Link Hub/i.test(text), 'Expected admin HTML shell markers');
    return { bytes: text.length };
  });

  printSummary({ base, slug, pageId, pageTitle });
  process.exit(exitCode);
}

async function step(name, fn) {
  try {
    const value = await fn();
    report.push({ name, ok: true, detail: value });
    log(`✓ ${name}`);
    if (verbose && value !== undefined) console.log(indent(formatValue(value)));
    return value;
  } catch (error) {
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    report.push({ name, ok: false, detail: message });
    console.error(`✗ ${name} — ${message}`);
    if (verbose && error?.stack) console.error(indent(error.stack));
    return null;
  }
}

function note(message) {
  report.push({ name: 'note', ok: true, detail: message });
  log(`• ${message}`);
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookieHeader = cookieHeaderValue();
  if (cookieHeader) headers.set('cookie', cookieHeader);

  const res = await fetch(new URL(path, base), {
    ...init,
    headers,
    redirect: 'follow'
  });

  captureCookies(res.headers);
  return res;
}

function rememberSessionFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  const session = payload.session || payload?.page?.session || null;
  if (session?.visitorKey) jar.set('clh_vid', session.visitorKey);
  if (session?.sessionId) jar.set('clh_sid', session.sessionId);
}

function captureCookies(headers) {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : splitSetCookie(headers.get('set-cookie'));

  for (const raw of setCookies) {
    if (!raw) continue;
    const pair = raw.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    jar.set(name, value);
  }
}

function cookieHeaderValue() {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function splitSetCookie(value) {
  if (!value) return [];
  const out = [];
  let current = '';
  let inExpires = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value.slice(i, i + 8).toLowerCase();
    if (next === 'expires=') inExpires = true;
    if (ch === ',' && !inExpires) {
      out.push(current.trim());
      current = '';
      continue;
    }
    if (inExpires && ch === ';') inExpires = false;
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

async function readJsonSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected JSON response but received: ${text.slice(0, 200)}`);
  }
}

function printSummary(meta) {
  console.log('\nSmoke test summary');
  console.log('------------------');
  console.log(`Base URL: ${meta.base}`);
  console.log(`Slug: ${meta.slug}`);
  if (meta.pageId) console.log(`Page ID: ${meta.pageId}`);
  if (meta.pageTitle) console.log(`Page title: ${meta.pageTitle}`);
  const passed = report.filter((item) => item.ok).length;
  const failed = report.filter((item) => !item.ok).length;
  console.log(`Checks passed: ${passed}`);
  console.log(`Checks failed: ${failed}`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    for (const row of report.filter((item) => !item.ok)) {
      console.log(`- ${row.name}: ${row.detail}`);
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--verbose') {
      out.verbose = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function normalizeBase(value) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function log(message) {
  console.log(message);
}

function formatValue(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function indent(text) {
  return String(text).split('\n').map((line) => `  ${line}`).join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
