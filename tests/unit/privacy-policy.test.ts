import { describe, expect, it } from 'vitest';
import { detectGpc, resolveRegionPolicy } from '../../src/server/privacy/policy';

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://fanlynks.test/home', { headers });
}

describe('privacy policy resolution', () => {
  it('uses UK strict mode for GB country header', () => {
    expect(resolveRegionPolicy(requestWith({ 'CF-IPCountry': 'GB' }))).toEqual({
      countryCode: 'GB',
      regionPolicy: 'uk_strict'
    });
  });

  it('uses default standard mode outside GB and preserves country code', () => {
    expect(resolveRegionPolicy(requestWith({ 'CF-IPCountry': 'US' }))).toEqual({
      countryCode: 'US',
      regionPolicy: 'default_standard'
    });
  });

  it('detects only explicit Sec-GPC opt-out signal', () => {
    expect(detectGpc(requestWith({ 'Sec-GPC': '1' }))).toBe(true);
    expect(detectGpc(requestWith({ 'Sec-GPC': '0' }))).toBe(false);
    expect(detectGpc(requestWith({}))).toBe(false);
  });
});
