const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CSS_UNIT = /^(?:0|[1-9]\d{0,3})(?:px|rem|em|%)?$/;
const SAFE_FONT = /^[a-zA-Z0-9\s,"'._-]{1,140}$/;
const SAFE_DECORATIVE_CSS = /^[a-zA-Z0-9\s#(),.%+-]{1,220}$/;

const THEME_KEYS = new Set([
  'bg',
  'bgAccent',
  'surface',
  'text',
  'muted',
  'accent',
  'primaryBg',
  'primaryText',
  'secondaryBg',
  'secondaryText',
  'neutralBg',
  'neutralText',
  'border',
  'iconBg',
  'shadow',
  'radius',
  'buttonRadius',
  'fontBody',
  'fontHeading',
  'maxWidth',
  'gap'
]);

const COLOR_KEYS = new Set([
  'bg',
  'surface',
  'text',
  'muted',
  'accent',
  'primaryBg',
  'primaryText',
  'secondaryBg',
  'secondaryText',
  'neutralBg',
  'neutralText',
  'border',
  'iconBg'
]);

const UNIT_KEYS = new Set(['radius', 'buttonRadius', 'maxWidth', 'gap']);
const FONT_KEYS = new Set(['fontBody', 'fontHeading']);

const PRIVACY_TEXT_LIMITS: Record<string, number> = {
  bannerVersion: 32,
  privacyChoicesLabel: 60,
  bannerTitle: 90,
  bannerBody: 360,
  acceptLabel: 40,
  analyticsOnlyLabel: 40,
  declineLabel: 40,
  gpcTitle: 90,
  gpcBody: 360,
  footerNote: 120
};

export function normalizeText(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, maxLength);
}

export function normalizeOptionalText(input: unknown, maxLength: number): string | null {
  return normalizeText(input, maxLength);
}

export function normalizePublicUrl(input: unknown, fieldName = 'URL'): string {
  const value = normalizeOptionalPublicUrl(input);
  if (!value) throw new Error(`${fieldName} must be an http or https URL.`);
  return value;
}

export function normalizeOptionalPublicUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value || value.length > 2048) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeIcon(input: { iconType?: unknown; iconValue?: unknown }): { iconType: 'emoji' | 'image' | 'none'; iconValue: string | null } {
  if (input.iconType === 'emoji') {
    return {
      iconType: 'emoji',
      iconValue: normalizeOptionalText(input.iconValue, 16)
    };
  }

  if (input.iconType === 'image') {
    const iconUrl = normalizeOptionalPublicUrl(input.iconValue);
    if (!iconUrl) throw new Error('Icon image URL must be an http or https URL.');
    return {
      iconType: 'image',
      iconValue: iconUrl
    };
  }

  return {
    iconType: 'none',
    iconValue: null
  };
}

export function sanitizeThemeTokens(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Record<string, string> = {};

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!THEME_KEYS.has(key) || typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    const lowered = value.toLowerCase();
    if (lowered.includes('url(') || lowered.includes('expression(') || /[;<>{}]/.test(value)) continue;

    if (COLOR_KEYS.has(key)) {
      if (HEX_COLOR.test(value)) output[key] = value;
      continue;
    }

    if (UNIT_KEYS.has(key)) {
      if (CSS_UNIT.test(value)) output[key] = /^\d+$/.test(value) ? `${value}px` : value;
      continue;
    }

    if (FONT_KEYS.has(key)) {
      if (SAFE_FONT.test(value)) output[key] = value;
      continue;
    }

    if ((key === 'bgAccent' || key === 'shadow') && SAFE_DECORATIVE_CSS.test(value)) {
      output[key] = value;
    }
  }

  return output;
}

export function sanitizePrivacyUi(input: unknown): Record<string, string | boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const output: Record<string, string | boolean> = {};

  for (const [key, maxLength] of Object.entries(PRIVACY_TEXT_LIMITS)) {
    const value = normalizeOptionalText(source[key], maxLength);
    if (value) output[key] = value;
  }

  if (typeof source.honorGpc === 'boolean') output.honorGpc = source.honorGpc;
  return output;
}

export function normalizeTrackingMode(input: unknown): string {
  return ['none', 'first_party', 'ga4', 'meta', 'gtm', 'ga4_meta', 'gtm_meta'].includes(String(input)) ? String(input) : 'none';
}

export function normalizePrivacyMode(input: unknown): string {
  return ['default_standard', 'uk_strict', 'ca_optout_gpc'].includes(String(input)) ? String(input) : 'default_standard';
}

export function normalizeStyleRole(input: unknown): 'primary' | 'secondary' | 'neutral' {
  return input === 'primary' || input === 'secondary' ? input : 'neutral';
}

export function normalizeIsoDate(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
