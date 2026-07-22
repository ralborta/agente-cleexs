export type AiSourceId = 'chatgpt' | 'perplexity' | 'claude' | 'copilot' | 'gemini' | 'google' | 'other';

export type AiSourceMeta = {
  id: AiSourceId;
  label: string;
  color: string;
  isAiEngine: boolean;
};

export const AI_SOURCE_CATALOG: Record<AiSourceId, AiSourceMeta> = {
  chatgpt: { id: 'chatgpt', label: 'ChatGPT', color: '#14b8a6', isAiEngine: true },
  perplexity: { id: 'perplexity', label: 'Perplexity', color: '#8b5cf6', isAiEngine: true },
  claude: { id: 'claude', label: 'Claude', color: '#f97316', isAiEngine: true },
  copilot: { id: 'copilot', label: 'Copilot / Bing', color: '#3b82f6', isAiEngine: true },
  gemini: { id: 'gemini', label: 'Gemini', color: '#6366f1', isAiEngine: true },
  google: { id: 'google', label: 'Google', color: '#2563eb', isAiEngine: false },
  other: { id: 'other', label: 'Otros', color: '#64748b', isAiEngine: false },
};

export function classifySessionSource(source: string, medium?: string): AiSourceId {
  const value = `${source} ${medium ?? ''}`.toLowerCase();

  if (/openai|chatgpt|chat\.openai/.test(value)) return 'chatgpt';
  if (/perplexity/.test(value)) return 'perplexity';
  if (/claude|anthropic/.test(value)) return 'claude';
  if (/copilot|bing/.test(value)) return 'copilot';
  if (/gemini/.test(value)) return 'gemini';
  if (/^google\b|google\.com/.test(value.trim()) || source.toLowerCase() === 'google') return 'google';

  return 'other';
}

export function emptySourceTotals(): Record<AiSourceId, number> {
  return {
    chatgpt: 0,
    perplexity: 0,
    claude: 0,
    copilot: 0,
    gemini: 0,
    google: 0,
    other: 0,
  };
}
