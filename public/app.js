(() => {
  const $ = (id) => document.getElementById(id);
  const dom = {
    announcement: $('announcement'),
    announcementText: $('announcementText'),
    avatar: $('avatar'),
    title: $('title'),
    subtitle: $('subtitle'),
    heroCta: $('heroCta'),
    content: $('content'),
    footerNote: $('footerNote'),
    privacyChoices: $('privacyChoices'),
    privacyStatus: $('privacyStatus'),
    privacyBanner: $('privacyBanner'),
    privacyTitle: $('privacyTitle'),
    privacyBody: $('privacyBody'),
    privacyAccept: $('privacyAccept'),
    privacyAnalyticsOnly: $('privacyAnalyticsOnly'),
    privacyDecline: $('privacyDecline'),
    privacyClose: $('privacyClose')
  };

  const DEFAULT_TOKENS = {
    bg: '#050505',
    bgAccent: 'radial-gradient(circle at top, rgba(207,160,41,0.16), transparent 34%)',
    surface: '#121212',
    text: '#ffffff',
    muted: '#c8c2b5',
    accent: '#cfa029',
    primaryBg: '#cfa029',
    primaryText: '#050505',
    secondaryBg: '#171717',
    secondaryText: '#ffffff',
    neutralBg: '#101010',
    neutralText: '#f5f0e8',
    border: '#302819',
    iconBg: '#ffffff',
    shadow: '0 18px 44px rgba(0,0,0,0.24)',
    radius: '10px',
    buttonRadius: '8px',
    fontBody: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontHeading: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: '720px',
    gap: '14px'
  };

  const state = {
    slug: deriveSlug(),
    page: null,
    sections: [],
    links: [],
    experiment: null,
    integrations: [],
    privacy: null,
    session: null,
    providers: {
      ga4: { initialized: false },
      meta: { initialized: false },
      gtm: { initialized: false }
    },
    lastForwardingPlan: null
  };

  boot().catch((error) => {
    console.error(error);
    renderStatus('Unable to load this page right now.');
  });

  async function boot() {
    dom.privacyChoices.addEventListener('click', () => {
      prepareStandardPrivacyBanner();
      showPrivacyBanner();
    });
    const acceptHandler = () => updateConsent('granted', 'granted');
    const analyticsOnlyHandler = () => updateConsent('granted', 'denied');
    const declineHandler = () => updateConsent('denied', 'denied');
    const closeHandler = () => hidePrivacyBanner();

    dom.privacyAccept.addEventListener('click', acceptHandler);
    dom.privacyAnalyticsOnly.addEventListener('click', analyticsOnlyHandler);
    dom.privacyDecline.addEventListener('click', declineHandler);
    dom.privacyClose.addEventListener('click', closeHandler);
    dom.privacyAccept.onclick = acceptHandler;
    dom.privacyAnalyticsOnly.onclick = analyticsOnlyHandler;
    dom.privacyDecline.onclick = declineHandler;
    dom.privacyClose.onclick = closeHandler;

    const response = await fetch(`/api/page/${encodeURIComponent(state.slug)}`, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Page not found.');
    }

    state.page = applyPageOverrides(data.page, data.experiment?.contentOverrides);
    state.sections = data.sections || [];
    state.links = applyLinkOverrides(data.links || [], data.experiment?.contentOverrides);
    state.experiment = data.experiment || null;
    state.integrations = data.integrations || [];
    state.privacy = normalizePrivacy(data.privacy);
    applyPrivacyUi();
    state.session = data.session || null;

    applyTokens(resolveTokens(data.experiment?.tokens || data.page?.themeTokens));
    renderPage();
    maybeShowPrivacyBanner();
    await trackEvent({ event_name: 'page_view' });
  }

  function deriveSlug() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('slug');
    if (querySlug) return querySlug.trim();

    const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length > 0 && parts[0] !== 'index.html') return decodeURIComponent(parts[0]);
    return 'home';
  }


  function privacyUi() {
    return state.page?.privacyUi || {};
  }

  function applyPrivacyUi() {
    const ui = privacyUi();
    dom.privacyChoices.textContent = ui.privacyChoicesLabel || 'Your Privacy Choices';
    dom.footerNote.textContent = ui.footerNote || 'Fan Lynks keeps creator funnels clean, fast, and privacy-aware.';
    updatePrivacyStatus();
  }

  function normalizePrivacy(privacy) {
    return {
      regionPolicy: privacy?.regionPolicy || 'default_standard',
      countryCode: privacy?.countryCode || null,
      gpcDetected: Boolean(privacy?.gpcDetected),
      analyticsConsent: privacy?.consent?.analytics || privacy?.analyticsConsent || 'unknown',
      adsConsent: privacy?.consent?.advertising || privacy?.adsConsent || 'unknown'
    };
  }

  function updatePrivacyStatus() {
    if (!dom.privacyStatus) return;
    const analytics = state.privacy?.analyticsConsent || 'unknown';
    const ads = state.privacy?.adsConsent || 'unknown';
    const policy = state.privacy?.regionPolicy || 'default_standard';
    const bits = [];
    if (policy === 'uk_strict') bits.push('UK strict');
    if (policy === 'ca_optout_gpc') bits.push('CA/GPC');
    bits.push(`Analytics: ${analytics}`);
    bits.push(`Ads: ${ads}`);
    if (state.privacy?.gpcDetected) bits.push('GPC on');
    dom.privacyStatus.textContent = bits.join(' • ');
  }

  function applyPageOverrides(page, overrides) {
    const pageOverrides = overrides?.page || {};
    return {
      ...page,
      title: pageOverrides.title || page.title,
      subtitle: pageOverrides.subtitle ?? page.subtitle,
      avatarUrl: pageOverrides.avatarUrl ?? page.avatarUrl,
      announcementText: pageOverrides.announcementText ?? page.announcementText,
      announcementUrl: pageOverrides.announcementUrl ?? page.announcementUrl,
      heroCtaLabel: pageOverrides.heroCtaLabel ?? page.heroCtaLabel,
      heroCtaUrl: pageOverrides.heroCtaUrl ?? page.heroCtaUrl
    };
  }

  function applyLinkOverrides(links, overrides) {
    const byId = overrides?.links || overrides?.linkOverrides || {};
    const ordered = [...links].map((link) => ({
      ...link,
      ...(byId[link.id] || {})
    }));

    const order = overrides?.linkOrder;
    if (!Array.isArray(order) || !order.length) return ordered;

    const rank = new Map(order.map((id, index) => [id, index]));
    return ordered.sort((a, b) => {
      const ar = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
      const br = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      return a.rowOrder - b.rowOrder;
    });
  }

  function resolveTokens(input) {
    const source = input || {};
    const pick = (keys, fallback) => {
      for (const key of keys) {
        if (source[key] != null && source[key] !== '') return source[key];
      }
      return fallback;
    };

    return {
      bg: pick(['bg', 'background', 'backgroundColor'], DEFAULT_TOKENS.bg),
      bgAccent: pick(['bgAccent', 'backgroundAccent', 'backgroundOverlay'], DEFAULT_TOKENS.bgAccent),
      surface: pick(['surface', 'surfaceColor', 'cardColor'], DEFAULT_TOKENS.surface),
      text: pick(['text', 'textColor'], DEFAULT_TOKENS.text),
      muted: pick(['muted', 'mutedColor'], DEFAULT_TOKENS.muted),
      accent: pick(['accent', 'accentColor'], DEFAULT_TOKENS.accent),
      primaryBg: pick(['primaryBg', 'primaryButtonBg'], DEFAULT_TOKENS.primaryBg),
      primaryText: pick(['primaryText', 'primaryButtonText'], DEFAULT_TOKENS.primaryText),
      secondaryBg: pick(['secondaryBg', 'secondaryButtonBg'], DEFAULT_TOKENS.secondaryBg),
      secondaryText: pick(['secondaryText', 'secondaryButtonText'], DEFAULT_TOKENS.secondaryText),
      neutralBg: pick(['neutralBg', 'neutralButtonBg'], DEFAULT_TOKENS.neutralBg),
      neutralText: pick(['neutralText', 'neutralButtonText'], DEFAULT_TOKENS.neutralText),
      border: pick(['border', 'borderColor', 'outlineColor'], DEFAULT_TOKENS.border),
      iconBg: pick(['iconBg', 'iconBackground'], DEFAULT_TOKENS.iconBg),
      shadow: pick(['shadow', 'shadowStyle'], DEFAULT_TOKENS.shadow),
      radius: pick(['radius', 'cardRadius'], DEFAULT_TOKENS.radius),
      buttonRadius: pick(['buttonRadius'], DEFAULT_TOKENS.buttonRadius),
      fontBody: pick(['fontBody', 'bodyFont', 'fontStack'], DEFAULT_TOKENS.fontBody),
      fontHeading: pick(['fontHeading', 'headingFont', 'displayFont'], DEFAULT_TOKENS.fontHeading),
      maxWidth: pick(['maxWidth'], DEFAULT_TOKENS.maxWidth),
      gap: pick(['gap', 'rowGap'], DEFAULT_TOKENS.gap)
    };
  }

  function applyTokens(tokens) {
    const root = document.documentElement;
    root.style.setProperty('--bg', tokens.bg);
    root.style.setProperty('--bg-accent', tokens.bgAccent);
    root.style.setProperty('--surface', tokens.surface);
    root.style.setProperty('--text', tokens.text);
    root.style.setProperty('--muted', tokens.muted);
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--primary-bg', tokens.primaryBg);
    root.style.setProperty('--primary-text', tokens.primaryText);
    root.style.setProperty('--secondary-bg', tokens.secondaryBg);
    root.style.setProperty('--secondary-text', tokens.secondaryText);
    root.style.setProperty('--neutral-bg', tokens.neutralBg);
    root.style.setProperty('--neutral-text', tokens.neutralText);
    root.style.setProperty('--border', tokens.border);
    root.style.setProperty('--icon-bg', tokens.iconBg);
    root.style.setProperty('--shadow', tokens.shadow);
    root.style.setProperty('--radius', normalizeCssUnit(tokens.radius));
    root.style.setProperty('--button-radius', normalizeCssUnit(tokens.buttonRadius));
    root.style.setProperty('--font-body', tokens.fontBody);
    root.style.setProperty('--font-heading', tokens.fontHeading);
    root.style.setProperty('--max-width', normalizeCssUnit(tokens.maxWidth));
    root.style.setProperty('--gap', normalizeCssUnit(tokens.gap));
  }

  function normalizeCssUnit(value) {
    if (typeof value !== 'string') return String(value);
    if (/^\d+$/.test(value)) return `${value}px`;
    return value;
  }

  function renderPage() {
    document.title = state.page.title || 'Fan Lynks';
    dom.title.textContent = state.page.title || 'Untitled page';
    dom.subtitle.textContent = state.page.subtitle || '';
    dom.subtitle.hidden = !state.page.subtitle;

    if (safeHttpUrl(state.page.avatarUrl)) {
      dom.avatar.src = state.page.avatarUrl;
      dom.avatar.alt = state.page.title || 'Avatar';
      dom.avatar.style.display = 'block';
    } else {
      dom.avatar.style.display = 'none';
    }

    if (state.page.announcementEnabled && state.page.announcementText && safeHttpUrl(state.page.announcementUrl)) {
      dom.announcement.hidden = false;
      dom.announcement.style.display = 'flex';
      dom.announcement.href = state.page.announcementUrl;
      dom.announcementText.textContent = state.page.announcementText;
      dom.announcement.onclick = (event) => interceptTrackedNavigation(event, {
        event_name: 'announcement_click',
        destination_url: state.page.announcementUrl
      });
    } else {
      dom.announcement.hidden = true;
      dom.announcement.style.display = 'none';
    }

    if (state.page.heroCtaLabel && safeHttpUrl(state.page.heroCtaUrl)) {
      dom.heroCta.hidden = false;
      dom.heroCta.textContent = state.page.heroCtaLabel;
      dom.heroCta.href = state.page.heroCtaUrl;
      dom.heroCta.onclick = (event) => interceptTrackedNavigation(event, {
        event_name: 'hero_cta_click',
        destination_url: state.page.heroCtaUrl
      });
    } else {
      dom.heroCta.hidden = true;
    }

    renderLinks();
  }

  function renderLinks() {
    dom.content.innerHTML = '';
    const fragments = [];
    const unsectioned = state.links.filter((link) => !link.sectionId);
    if (unsectioned.length) fragments.push(renderLinkBlock(null, unsectioned));

    for (const section of [...state.sections].sort((a, b) => a.sectionOrder - b.sectionOrder)) {
      const sectionLinks = state.links.filter((link) => link.sectionId === section.id);
      if (sectionLinks.length) fragments.push(renderLinkBlock(section, sectionLinks));
    }

    if (!fragments.length) {
      renderStatus('No live links are published on this page yet.');
      return;
    }

    fragments.forEach((node) => dom.content.appendChild(node));
  }

  function renderLinkBlock(section, links) {
    const wrapper = document.createElement('section');
    if (section?.label) {
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = section.label;
      wrapper.appendChild(label);
    }

    const grid = document.createElement('div');
    grid.className = 'links';

    [...links].sort((a, b) => a.rowOrder - b.rowOrder).forEach((link, index) => {
      const row = document.createElement('a');
      row.className = `link-row ${link.styleRole || 'secondary'}`;
      const safeUrl = safeHttpUrl(link.url);
      if (!safeUrl) return;
      row.href = safeUrl;
      row.rel = 'noopener noreferrer';
      row.dataset.linkId = link.id;
      row.dataset.sectionId = link.sectionId || '';
      row.dataset.rowIndex = String(link.rowOrder ?? index + 1);
      row.onclick = (event) => interceptTrackedNavigation(event, {
        event_name: 'link_click',
        link_id: link.id,
        section_id: link.sectionId,
        row_index: link.rowOrder ?? index + 1,
        destination_url: safeUrl
      });

      const icon = document.createElement('div');
      icon.className = 'icon-slot';
      const safeIconUrl = link.iconType === 'image' ? safeHttpUrl(link.iconValue) : null;
      if (safeIconUrl) {
        const img = document.createElement('img');
        img.src = safeIconUrl;
        img.alt = '';
        icon.appendChild(img);
      } else if (link.iconType === 'emoji' && link.iconValue) {
        const span = document.createElement('span');
        span.className = 'icon-emoji';
        span.textContent = link.iconValue;
        icon.appendChild(span);
      } else {
        const span = document.createElement('span');
        span.className = 'icon-fallback';
        span.textContent = fallbackIconText(link.title);
        icon.appendChild(span);
      }
      row.appendChild(icon);

      const content = document.createElement('div');
      content.className = 'content';
      const titleRow = document.createElement('div');
      titleRow.className = 'title-row';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = link.title;
      titleRow.appendChild(title);
      if (link.badgeText) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = link.badgeText;
        titleRow.appendChild(badge);
      }
      content.appendChild(titleRow);

      if (link.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle-small';
        subtitle.textContent = link.subtitle;
        content.appendChild(subtitle);
      }
      row.appendChild(content);

      const chevron = document.createElement('div');
      chevron.className = 'chevron';
      chevron.textContent = '→';
      row.appendChild(chevron);
      grid.appendChild(row);
    });

    wrapper.appendChild(grid);
    return wrapper;
  }

  function renderStatus(message) {
    dom.content.innerHTML = `<div class="card status"><strong>${escapeHtml(message)}</strong></div>`;
  }

  function maybeShowPrivacyBanner() {
    const key = consentAckKey();
    if (state.privacy.regionPolicy === 'uk_strict' && !safeStorageGet(key)) {
      prepareStandardPrivacyBanner({ closeOnlyAfterChoice: true });
      showPrivacyBanner();
      return;
    }

    if (state.privacy.gpcDetected) {
      dom.privacyTitle.textContent = privacyUi().gpcTitle || 'Global Privacy Control detected';
      dom.privacyBody.textContent = privacyUi().gpcBody || 'Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.';
      dom.privacyAccept.hidden = true;
      dom.privacyAnalyticsOnly.hidden = true;
      dom.privacyDecline.hidden = true;
      dom.privacyClose.hidden = false;
      if (!safeStorageGet(key)) showPrivacyBanner();
    }
  }

  function prepareStandardPrivacyBanner(options = {}) {
    dom.privacyTitle.textContent = privacyUi().bannerTitle || 'Choose your privacy settings';
    dom.privacyBody.textContent = privacyUi().bannerBody || 'We use optional analytics and marketing tags only if you allow them. Essential features stay on either way.';
    dom.privacyAccept.textContent = privacyUi().acceptLabel || 'Allow all';
    dom.privacyAnalyticsOnly.textContent = privacyUi().analyticsOnlyLabel || 'Analytics only';
    dom.privacyDecline.textContent = privacyUi().declineLabel || 'Essential only';
    dom.privacyAccept.hidden = false;
    dom.privacyAnalyticsOnly.hidden = false;
    dom.privacyDecline.hidden = false;
    dom.privacyClose.hidden = Boolean(options.closeOnlyAfterChoice);
  }

  function showPrivacyBanner() {
    dom.privacyBanner.style.display = 'block';
  }

  function hidePrivacyBanner() {
    dom.privacyBanner.style.display = 'none';
    safeStorageSet(consentAckKey(), '1');
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }

  async function updateConsent(analytics, advertising) {
    if (!state.page?.id) return;
    const response = await fetch('/api/privacy/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page_id: state.page.id,
        analytics,
        advertising,
        banner_version: privacyUi().bannerVersion || 'v1'
      })
    });

    if (!response.ok) return;

    state.privacy.analyticsConsent = analytics;
    state.privacy.adsConsent = advertising;
    updatePrivacyStatus();
    hidePrivacyBanner();

    if (analytics === 'granted' || advertising === 'granted') {
      const localPlan = state.lastForwardingPlan ? rehydrateForwardingPlan(state.lastForwardingPlan) : buildLocalForwardingPlan();
      dispatchForwarding(localPlan, {
        tenant_id: state.page.tenantId,
        page_id: state.page.id,
        page_slug: state.page.slug,
        experiment_id: state.experiment?.experimentId || null,
        variant_id: state.experiment?.variantId || null,
        event_name: 'page_view',
        country_code: state.privacy.countryCode,
        region_policy: state.privacy.regionPolicy,
        consent_analytics: state.privacy.analyticsConsent,
        consent_ads: state.privacy.adsConsent,
        gpc_detected: state.privacy.gpcDetected,
        session_id: state.session?.sessionId || null,
        occurred_at: new Date().toISOString()
      });
    }
  }

  function consentAckKey() {
    return `clh_privacy_ack_${state.page?.id || state.slug}`;
  }

  async function trackEvent(fields) {
    if (!state.page) return null;
    const event = {
      page_id: state.page.id,
      page_slug: state.page.slug,
      experiment_id: state.experiment?.experimentId || null,
      variant_id: state.experiment?.variantId || null,
      referrer: document.referrer || null,
      utm_source: new URLSearchParams(window.location.search).get('utm_source'),
      utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
      utm_content: new URLSearchParams(window.location.search).get('utm_content'),
      utm_term: new URLSearchParams(window.location.search).get('utm_term'),
      ...fields
    };

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      credentials: 'same-origin',
      keepalive: event.event_name !== 'page_view'
    });

    let data = null;
    try {
      data = await response.json();
    } catch {}

    if (response.ok && data?.forwarding) {
      state.lastForwardingPlan = data.forwarding;
      dispatchForwarding(data.forwarding, data.event);
    }

    return data;
  }

  function buildLocalForwardingPlan() {
    const analyticsAllowed = canForwardAnalytics(state.privacy);
    const adsAllowed = canForwardAds(state.privacy);
    return {
      analyticsAllowed,
      adsAllowed,
      destinations: state.integrations.map((integration) => {
        const provider = integration.provider;
        let allowed = analyticsAllowed;
        let reason = analyticsAllowed ? 'analytics_allowed' : 'analytics_blocked_by_privacy';
        if (provider === 'meta') {
          allowed = adsAllowed;
          reason = adsAllowed ? 'ads_allowed' : 'ads_blocked_by_privacy';
        } else if (provider === 'gtm' && integration.config?.advertisingEnabled) {
          allowed = adsAllowed;
          reason = adsAllowed ? 'ads_allowed' : 'ads_blocked_by_privacy';
        }
        return {
          provider,
          allowed,
          reason,
          mode: 'client_only',
          publicConfig: integration.config || {}
        };
      })
    };
  }

  function canForwardAnalytics(privacy) {
    if (privacy.regionPolicy === 'uk_strict') return privacy.analyticsConsent === 'granted';
    return privacy.analyticsConsent !== 'denied';
  }

  function canForwardAds(privacy) {
    if (privacy.gpcDetected || privacy.regionPolicy === 'ca_optout_gpc') return false;
    if (privacy.regionPolicy === 'uk_strict') return privacy.adsConsent === 'granted';
    return privacy.adsConsent !== 'denied';
  }

  async function interceptTrackedNavigation(event, payload) {
    const anchor = event.currentTarget;
    if (!anchor || !payload.destination_url) return;

    event.preventDefault();
    const href = safeHttpUrl(payload.destination_url);
    if (!href) return;
    const isNewTab = event.metaKey || event.ctrlKey || event.shiftKey || anchor.target === '_blank' || event.button === 1;

    try {
      await Promise.race([
        trackEvent({
          ...payload,
          destination_domain: getDomain(href)
        }),
        new Promise((resolve) => setTimeout(resolve, 180))
      ]);
    } catch {}

    if (isNewTab) {
      window.open(href, '_blank', 'noopener');
    } else {
      window.location.href = href;
    }
  }

  function rehydrateForwardingPlan(plan) {
    if (!plan?.destinations?.length) return buildLocalForwardingPlan();
    const analyticsAllowed = canForwardAnalytics(state.privacy);
    const adsAllowed = canForwardAds(state.privacy);
    return {
      analyticsAllowed,
      adsAllowed,
      destinations: plan.destinations.map((destination) => ({
        ...destination,
        allowed: destination.provider === 'meta'
          ? adsAllowed
          : destination.provider === 'gtm' && destination.publicConfig?.advertisingEnabled
            ? adsAllowed
            : analyticsAllowed
      }))
    };
  }

  function dispatchForwarding(plan, eventPayload) {
    if (!plan?.destinations?.length) return;
    for (const destination of plan.destinations) {
      if (!destination.allowed) continue;
      if (destination.provider === 'ga4') dispatchGa4(destination.publicConfig, eventPayload);
      if (destination.provider === 'meta') dispatchMeta(destination.publicConfig, eventPayload);
      if (destination.provider === 'gtm') dispatchGtm(destination.publicConfig, eventPayload);
    }
  }

  function dispatchGa4(config, payload) {
    const measurementId = config?.measurementId;
    if (!measurementId) return;
    if (payload.event_name === 'page_view' && config?.enablePageViews === false) return;
    if (payload.event_name !== 'page_view' && config?.enableClickEvents === false) return;
    if (!state.providers.ga4.initialized) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
      window.gtag('js', new Date());
      window.gtag('config', measurementId, { send_page_view: false });
      state.providers.ga4.initialized = true;
    }
    const params = buildCommonParams(payload);
    if (config?.enableExperimentParameters === false) {
      delete params.experiment_id;
      delete params.variant_id;
    }
    window.gtag('event', mapGa4EventName(payload.event_name), params);
  }

  function dispatchMeta(config, payload) {
    const pixelId = config?.pixelId;
    if (!pixelId) return;
    if (!state.providers.meta.initialized) {
      !(function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', pixelId);
      state.providers.meta.initialized = true;
    }
    window.fbq('track', mapMetaEventName(payload.event_name), buildCommonParams(payload));
  }

  function dispatchGtm(config, payload) {
    const containerId = config?.containerId;
    if (!containerId) return;
    window.dataLayer = window.dataLayer || [];
    if (!state.providers.gtm.initialized) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`);
      state.providers.gtm.initialized = true;
    }
    window.dataLayer.push({
      event: payload.event_name,
      ...buildCommonParams(payload)
    });
  }

  function mapGa4EventName(eventName) {
    return eventName;
  }

  function mapMetaEventName(eventName) {
    const map = {
      page_view: 'PageView',
      hero_cta_click: 'ViewContent',
      link_click: 'ViewContent',
      announcement_click: 'ViewContent',
      social_click: 'Contact',
      consent_updated: 'CustomizeProduct'
    };
    return map[eventName] || 'ViewContent';
  }

  function buildCommonParams(payload) {
    return {
      page_id: payload.page_id,
      page_slug: payload.page_slug,
      experiment_id: payload.experiment_id,
      variant_id: payload.variant_id,
      link_id: payload.link_id,
      section_id: payload.section_id,
      row_index: payload.row_index,
      destination_domain: payload.destination_domain,
      destination_url: payload.destination_url,
      region_policy: payload.region_policy,
      country_code: payload.country_code
    };
  }

  function loadScript(src) {
    if (document.querySelector(`script[data-src="${cssEscape(src)}"]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.dataset.src = src;
    document.head.appendChild(script);
  }

  function cssEscape(value) {
    return String(value).replace(/"/g, '\\"');
  }

  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return null; }
  }

  function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value, window.location.origin);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  function fallbackIconText(title) {
    const firstWord = String(title || '').trim().split(/\s+/)[0] || 'F';
    return firstWord.slice(0, 1).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
