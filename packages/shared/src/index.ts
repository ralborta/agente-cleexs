export const AGENT_SLUGS = {
  TEO: 'teo',
  DISCOVERY: 'discovery',
  GROWTH: 'growth',
} as const;

export type AgentSlug = (typeof AGENT_SLUGS)[keyof typeof AGENT_SLUGS];

export const MISSION_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const CONTENT_PIECE_TYPES = [
  'faq',
  'definition',
  'glossary',
  'checklist',
  'comparison',
  'how_to',
  'pillar',
  'case_study',
  'calculator',
  'landing',
  'other',
] as const;

export type ContentPieceType = (typeof CONTENT_PIECE_TYPES)[number];

export type DashboardKpi = {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
};

export type AgentActivityItem = {
  id: string;
  role: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
};

export const BRAND_TEMPLATE_IDS = ['default', 'minimal', 'corporate', 'editorial'] as const;
export type BrandTemplateId = (typeof BRAND_TEMPLATE_IDS)[number];

export type BrandCta = {
  headline?: string;
  body?: string;
  label?: string;
  /** Base del diagnóstico, ej. https://app.cleexs.net/diagnostico/crear?url= */
  url?: string;
  /** Color del botón (hex). Si falta, usa blanco / primary según template. */
  buttonColor?: string;
  /**
   * Si true (default para URLs de diagnóstico), muestra input de sitio
   * y abre el destino con ?url= prefilled.
   */
  urlInput?: boolean;
  /** Placeholder del input, ej. https://tu-empresa.com */
  placeholder?: string;
};

/** Campos de distribución social (Growth / Creative Engine). */
export type BrandDistributionKit = {
  accentColor?: string;
  backgroundColor?: string;
  fontPrimary?: string;
  fontSecondary?: string;
  visualStyle?: string;
  defaultCta?: string;
  website?: string;
  socialHandles?: {
    linkedin?: string;
  };
};

/** Kit de marca por workspace — parametriza plantillas de artículo en WordPress. */
export type BrandKit = {
  templateId?: BrandTemplateId;
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  /** Foto del autor en el hero editorial (p. ej. Teo). */
  authorAvatarUrl?: string;
  authorLine?: string;
  cta?: BrandCta;
  /** Variante B para A/B del bloque CTA. */
  ctaB?: BrandCta;
  /** Si hay ctaB, habilita rotación A/B (default true). */
  ctaAbEnabled?: boolean;
  /** Identidad para piezas de distribución (LinkedIn, etc.). */
  distribution?: BrandDistributionKit;
};

export const DEFAULT_BRAND_KIT: BrandKit = {
  templateId: 'default',
  brandName: 'Cleexs',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  authorLine: 'Por Teo · Agente de contenido Cleexs',
  cta: {
    headline: 'Conseguí clientes desde ChatGPT',
    body: 'Pegá la URL de tu sitio y descubrí si ChatGPT te recomienda a vos o a tu competencia.',
    label: 'Empezá gratis',
    url: 'https://app.cleexs.net/diagnostico/crear?url=',
    buttonColor: '#FFFFFF',
    urlInput: true,
    placeholder: 'https://tu-empresa.com',
  },
};
