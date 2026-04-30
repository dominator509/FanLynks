export type ConsentState = 'unknown' | 'granted' | 'denied';

export interface PublishedLink {
  id: string;
  sectionId: string | null;
  title: string;
  subtitle: string | null;
  url: string;
  iconType: 'emoji' | 'image' | 'none';
  iconValue: string | null;
  badgeText: string | null;
  styleRole: 'primary' | 'secondary' | 'neutral';
  rowOrder: number;
}

export interface PublishedSection {
  id: string;
  label: string;
  sectionOrder: number;
}

export interface PublishedIntegration {
  provider: 'ga4' | 'meta' | 'gtm' | 'cfwa';
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface PublishedVariant {
  experimentId: string;
  variantId: string;
  variantName: string;
  weight: number;
  tokens: Record<string, unknown>;
  contentOverrides?: Record<string, unknown> | null;
}

export interface PublishedPagePayload {
  page: {
    id: string;
    tenantId: string;
    slug: string;
    title: string;
    subtitle: string | null;
    avatarUrl: string | null;
    announcementEnabled: boolean;
    announcementText: string | null;
    announcementUrl: string | null;
    heroCtaLabel: string | null;
    heroCtaUrl: string | null;
    trackingMode: string;
    privacyMode: string;
    publishedVersion: number;
    themeTokens?: Record<string, unknown> | null;
    privacyUi?: Record<string, unknown> | null;
  };
  sections: PublishedSection[];
  links: PublishedLink[];
  integrations: PublishedIntegration[];
  experiment: {
    id: string;
    assignmentTtlDays: number;
    variants: PublishedVariant[];
  } | null;
  generatedAt: string;
}

export interface EffectivePrivacyState {
  regionPolicy: string;
  countryCode: string | null;
  gpcDetected: boolean;
  analyticsConsent: ConsentState;
  adsConsent: ConsentState;
}
