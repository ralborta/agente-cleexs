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
