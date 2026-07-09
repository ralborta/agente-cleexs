export type GoogleMetricsConfig = {
  serviceAccount: Record<string, unknown>;
  gscSiteUrl: string;
  ga4PropertyId: string;
};

function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
    throw new Error('JSON de service account inválido');
  }
  return parsed;
}

export function resolveGoogleMetricsConfig(workspaceSlug: string): GoogleMetricsConfig | null {
  const prefix = workspaceSlug.toUpperCase().replace(/-/g, '_');

  const jsonRaw =
    process.env[`GOOGLE_${prefix}_SERVICE_ACCOUNT_JSON`] ||
    (workspaceSlug === 'cleexs' ? process.env.GOOGLE_SERVICE_ACCOUNT_JSON : undefined);

  const gscSiteUrl =
    process.env[`GSC_${prefix}_SITE_URL`] ||
    (workspaceSlug === 'cleexs' ? process.env.GSC_SITE_URL : undefined);

  const ga4PropertyId =
    process.env[`GA4_${prefix}_PROPERTY_ID`] ||
    (workspaceSlug === 'cleexs' ? process.env.GA4_PROPERTY_ID : undefined);

  if (!jsonRaw || !gscSiteUrl) {
    return null;
  }

  try {
    return {
      serviceAccount: parseServiceAccountJson(jsonRaw),
      gscSiteUrl,
      ga4PropertyId: ga4PropertyId?.replace(/^properties\//, '') ?? '',
    };
  } catch {
    return null;
  }
}

export function isGoogleMetricsConfigured(config: GoogleMetricsConfig | null): config is GoogleMetricsConfig {
  return Boolean(config?.gscSiteUrl && config?.serviceAccount);
}

export function hasGa4Configured(config: GoogleMetricsConfig | null): boolean {
  return Boolean(config?.ga4PropertyId);
}

export function getGoogleMetricsStatus(workspaceSlug: string) {
  const config = resolveGoogleMetricsConfig(workspaceSlug);
  const sa = config?.serviceAccount as { client_email?: string } | undefined;
  return {
    configured: isGoogleMetricsConfigured(config),
    gscSiteUrl: config?.gscSiteUrl ?? null,
    ga4PropertyId: config?.ga4PropertyId ?? null,
    serviceAccountEmail: sa?.client_email ?? null,
  };
}
