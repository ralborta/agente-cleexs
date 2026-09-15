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
  /** Company Page (preferida). Si falta, se publica como perfil personal. */
  organizationUrn?: string | null;
  organizationName?: string | null;
  lastError?: string | null;
};

export type LinkedInStatusPublic = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'not_configured';
  appConfigured: boolean;
  /** true si hay org URN y se puede publicar como Page */
  canPublishAsPage: boolean;
  /** true si se puede publicar al perfil personal (w_member_social) */
  canPublishAsMember: boolean;
  /** page | member | none */
  publishTarget: 'page' | 'member' | 'none';
  personId?: string | null;
  personUrnMasked?: string | null;
  organizationUrnMasked?: string | null;
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

export type LinkedInOrganization = {
  organizationUrn: string;
  organizationId: string;
  name: string;
};
