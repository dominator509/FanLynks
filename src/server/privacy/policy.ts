export type RegionPolicy = 'uk_strict' | 'ca_optout_gpc' | 'default_standard';

export function resolveRegionPolicy(request: Request): { countryCode: string | null; regionPolicy: RegionPolicy } {
  const countryCode = request.headers.get('CF-IPCountry');
  if (countryCode === 'GB') {
    return { countryCode, regionPolicy: 'uk_strict' };
  }
  // Cloudflare country code is country-level; state-specific California handling should be layered
  // with additional signals, user choice, and GPC rather than depending on country code alone.
  return { countryCode, regionPolicy: 'default_standard' };
}

export function detectGpc(request: Request): boolean {
  const secGpc = request.headers.get('Sec-GPC');
  return secGpc === '1';
}
