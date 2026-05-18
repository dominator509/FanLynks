import { describe, expect, it } from 'vitest';
import {
  normalizeIcon,
  normalizeIsoDate,
  normalizeOptionalPublicUrl,
  normalizePrivacyMode,
  normalizePublicUrl,
  normalizeStyleRole,
  normalizeText,
  normalizeTrackingMode,
  sanitizePrivacyUi,
  sanitizeThemeTokens
} from '../../src/server/security/validation';

describe('security validation utilities', () => {
  it('normalizes text and rejects empty or non-string values', () => {
    expect(normalizeText('  Fan Lynks creator funnel  ', 9)).toBe('Fan Lynks');
    expect(normalizeText('   ', 20)).toBeNull();
    expect(normalizeText(null, 20)).toBeNull();
  });

  it('accepts only http/https public URLs without credentials', () => {
    expect(normalizePublicUrl('https://fanlynks.com/path', 'CTA URL')).toBe('https://fanlynks.com/path');
    expect(normalizeOptionalPublicUrl('https://fanlynks.com/join')).toBe('https://fanlynks.com/join');
    expect(normalizeOptionalPublicUrl('http://fanlynks.com/demo')).toBe('http://fanlynks.com/demo');
    expect(normalizeOptionalPublicUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeOptionalPublicUrl('data:text/html,boom')).toBeNull();
    expect(normalizeOptionalPublicUrl('http://%zz')).toBeNull();
    expect(normalizeOptionalPublicUrl('https://user:pass@fanlynks.com')).toBeNull();
    expect(() => normalizePublicUrl('file:///tmp/x', 'CTA URL')).toThrow('CTA URL must be an http or https URL.');
  });

  it('normalizes icon payloads and rejects unsafe image URLs', () => {
    expect(normalizeIcon({ iconType: 'emoji', iconValue: '🔥'.repeat(20) })).toEqual({
      iconType: 'emoji',
      iconValue: '🔥'.repeat(8)
    });
    expect(normalizeIcon({ iconType: 'none', iconValue: 'ignored' })).toEqual({ iconType: 'none', iconValue: null });
    expect(normalizeIcon({ iconType: 'image', iconValue: 'https://fanlynks.com/icon.png' })).toEqual({
      iconType: 'image',
      iconValue: 'https://fanlynks.com/icon.png'
    });
    expect(() => normalizeIcon({ iconType: 'image', iconValue: 'javascript:alert(1)' })).toThrow('Icon image URL must be an http or https URL.');
  });

  it('sanitizes theme tokens by key and value type', () => {
    expect(sanitizeThemeTokens({
      bg: '#050505',
      accent: '#cfa029',
      radius: '18',
      gap: '14px',
      fontBody: 'Montserrat, ui-sans-serif',
      bgAccent: 'radial-gradient(circle at top, #111, transparent 34%)',
      shadow: '0 24px 64px rgba(0,0,0,0.28)',
      badColor: '#fff',
      text: 'red',
      surface: 'url(https://evil.example/x)',
      fontHeading: 'Bad;Font'
    })).toEqual({
      bg: '#050505',
      accent: '#cfa029',
      radius: '18px',
      gap: '14px',
      fontBody: 'Montserrat, ui-sans-serif',
      bgAccent: 'radial-gradient(circle at top, #111, transparent 34%)',
      shadow: '0 24px 64px rgba(0,0,0,0.28)'
    });
    expect(sanitizeThemeTokens(null)).toEqual({});
    expect(sanitizeThemeTokens([])).toEqual({});
  });

  it('sanitizes privacy UI labels and mode enums', () => {
    const privacy = sanitizePrivacyUi({
      bannerVersion: ' v1 ',
      bannerTitle: 'A'.repeat(120),
      honorGpc: false,
      ignored: 'value'
    });
    expect(privacy.bannerVersion).toBe('v1');
    expect(String(privacy.bannerTitle)).toHaveLength(90);
    expect(privacy.honorGpc).toBe(false);
    expect(normalizeTrackingMode('gtm_meta')).toBe('gtm_meta');
    expect(normalizeTrackingMode('bad')).toBe('none');
    expect(normalizePrivacyMode('uk_strict')).toBe('uk_strict');
    expect(normalizePrivacyMode('bad')).toBe('default_standard');
    expect(normalizeStyleRole('primary')).toBe('primary');
    expect(normalizeStyleRole('other')).toBe('neutral');
  });

  it('normalizes ISO dates and rejects malformed values', () => {
    expect(normalizeIsoDate('2026-05-17T12:00:00.000Z')).toBe('2026-05-17T12:00:00.000Z');
    expect(normalizeIsoDate('not a date')).toBeNull();
    expect(normalizeIsoDate('')).toBeNull();
  });
});
