/** JSON guardado en Integration.config para type=linkedin */
export type LinkedInIntegrationConfig = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  personUrn: string;
  personId: string;
  scopes: string[];
  connectedAt: string;
  connectedByUserId?: string;
  organizationUrn?: string | null;
  organizationName?: string | null;
  lastError?: string | null;
};

export type LinkedInStatusPublic = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'not_configured';
  appConfigured: boolean;
  personId?: string | null;
  personUrnMasked?: string | null;
  scopes?: string[];
  connectedAt?: string | null;
  expiresAt?: string | null;
  organizationName?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};
