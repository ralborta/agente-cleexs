import type { BrandDistributionKit, BrandKit } from '@agente/shared';

export type CreativeFormat = 'linkedin_square' | 'linkedin_landscape';

export type CreativeCategory =
  | 'headline'
  | 'question'
  | 'statistic'
  | 'problem'
  | 'solution'
  | 'problem_solution'
  | 'list_3'
  | 'list_5'
  | 'quote'
  | 'insight'
  | 'before_after'
  | 'comparison'
  | 'myth_fact'
  | 'step_by_step'
  | 'checklist'
  | 'mini_case'
  | 'article_cover'
  | 'strong_cta'
  | 'trend'
  | 'data_point';

export type CreativeLayout =
  | 'center_stack'
  | 'split_vertical'
  | 'list_stack'
  | 'quote_focus'
  | 'stat_focus'
  | 'cover_hero'
  | 'cta_band';

export type CreativeField =
  | 'headline'
  | 'subheadline'
  | 'cta'
  | 'bodyLines'
  | 'leftLabel'
  | 'rightLabel'
  | 'quote'
  | 'statValue'
  | 'statLabel';

export type CreativeTemplateConfig = {
  templateKey: string;
  version: number;
  category: CreativeCategory;
  name: string;
  fields: CreativeField[];
  maxHeadlineLength: number;
  maxSubheadlineLength: number;
  maxCtaLength: number;
  maxBodyLineLength: number;
  maxBodyLines: number;
  aspectRatio: '1:1' | '1.91:1';
  defaultFormat: CreativeFormat;
  layout: CreativeLayout;
  allowedImage: boolean;
  allowedIcon: boolean;
  visualTypeDefault: 'typographic' | 'icon' | 'image';
};

export type CreativeContentInput = {
  contentId: string;
  publicationId?: string;
  brandId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  mainInsight: string;
  cta: string;
  url: string;
  contentType: 'article';
  channel: 'linkedin';
};

export type CreativePlan = {
  templateKey: string;
  templateVersion: number;
  intention: CreativeCategory;
  headline: string;
  subheadline?: string;
  bodyLines?: string[];
  cta: string;
  leftLabel?: string;
  rightLabel?: string;
  quote?: string;
  statValue?: string;
  statLabel?: string;
  visualType: 'typographic' | 'icon' | 'image';
  format: CreativeFormat;
};

export type ResolvedDistributionBrand = {
  brandId: string;
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPrimary: string;
  fontSecondary: string;
  visualStyle: string;
  defaultCta: string;
  website?: string;
  linkedinHandle?: string;
};

export type FormatSize = { width: number; height: number };

export const FORMAT_SIZES: Record<CreativeFormat, FormatSize> = {
  linkedin_square: { width: 1080, height: 1080 },
  linkedin_landscape: { width: 1200, height: 627 },
};

export function resolveDistributionBrand(
  brandId: string,
  kit: BrandKit | null | undefined,
): ResolvedDistributionBrand | null {
  const name = kit?.brandName?.trim();
  if (!name) return null;

  const dist: BrandDistributionKit = kit?.distribution ?? {};
  const primary = kit?.primaryColor || '#2563EB';
  const secondary = kit?.secondaryColor || '#1D4ED8';

  return {
    brandId,
    name,
    logoUrl: kit?.logoUrl,
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: dist.accentColor || '#F97316',
    backgroundColor: dist.backgroundColor || '#0F172A',
    fontPrimary: dist.fontPrimary || kit?.fontFamily || 'system-ui, sans-serif',
    fontSecondary: dist.fontSecondary || kit?.fontFamily || 'system-ui, sans-serif',
    visualStyle: dist.visualStyle || 'clean_corporate',
    defaultCta: dist.defaultCta || kit?.cta?.label || 'Leer artículo',
    website: dist.website,
    linkedinHandle: dist.socialHandles?.linkedin,
  };
}
