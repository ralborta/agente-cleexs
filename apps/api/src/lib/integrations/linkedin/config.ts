export type LinkedInAppConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
};

export function resolveLinkedInAppConfig(): LinkedInAppConfig | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const apiVersion = process.env.LINKEDIN_API_VERSION?.trim() || '202509';

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri, apiVersion };
}

export function isLinkedInAppConfigured(): boolean {
  return resolveLinkedInAppConfig() !== null;
}
