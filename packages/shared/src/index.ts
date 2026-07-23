export const AGENT_SLUGS = {
  TEO: 'teo',
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

export const BRAND_TEMPLATE_IDS = ['default', 'minimal', 'corporate'] as const;
export type BrandTemplateId = (typeof BRAND_TEMPLATE_IDS)[number];

export type BrandCta = {
  headline?: string;
  body?: string;
  label?: string;
  url?: string;
};

/** Kit de marca por workspace — parametriza plantillas de artículo en WordPress. */
export type BrandKit = {
  templateId?: BrandTemplateId;
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  authorLine?: string;
  cta?: BrandCta;
};

export const DEFAULT_BRAND_KIT: BrandKit = {
  templateId: 'default',
  brandName: 'Cleexs',
  primaryColor: '#2563EB',
  secondaryColor: '#1D4ED8',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  authorLine: 'Por Teo · Agente de contenido Cleexs',
  cta: {
    headline: '¿Querés medir tu visibilidad en Google e IA?',
    body: 'Cleexs analiza cómo te ven ChatGPT, Google y tus competidores.',
    label: 'Checkeá tu visibilidad gratis',
    url: 'https://app.cleexs.net/diagnostico/crear?url=',
  },
};
