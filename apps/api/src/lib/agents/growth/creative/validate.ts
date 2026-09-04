import type { CreativePlan, CreativeTemplateConfig } from './types';

export type ValidationIssue = {
  field: string;
  message: string;
  length?: number;
  max?: number;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

function tooLong(value: string | undefined, max: number, field: string): ValidationIssue | null {
  if (!value) return null;
  const length = value.trim().length;
  if (length > max) {
    return { field, message: `${field} excede el máximo (${length}/${max})`, length, max };
  }
  return null;
}

export function validateCreativePlan(
  plan: CreativePlan,
  template: CreativeTemplateConfig,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const push = (issue: ValidationIssue | null) => {
    if (issue) issues.push(issue);
  };

  if (!plan.headline?.trim() && template.fields.includes('headline')) {
    issues.push({ field: 'headline', message: 'headline requerido' });
  }
  push(tooLong(plan.headline, template.maxHeadlineLength, 'headline'));
  push(tooLong(plan.subheadline, template.maxSubheadlineLength, 'subheadline'));
  push(tooLong(plan.cta, template.maxCtaLength, 'cta'));
  push(tooLong(plan.quote, template.maxHeadlineLength + 20, 'quote'));
  push(tooLong(plan.leftLabel, template.maxSubheadlineLength, 'leftLabel'));
  push(tooLong(plan.rightLabel, template.maxSubheadlineLength, 'rightLabel'));
  push(tooLong(plan.statValue, 12, 'statValue'));
  push(tooLong(plan.statLabel, template.maxSubheadlineLength, 'statLabel'));

  if (template.fields.includes('bodyLines')) {
    const lines = plan.bodyLines ?? [];
    if (lines.length === 0) {
      issues.push({ field: 'bodyLines', message: 'bodyLines requerido' });
    }
    if (lines.length > template.maxBodyLines) {
      issues.push({
        field: 'bodyLines',
        message: `demasiadas líneas (${lines.length}/${template.maxBodyLines})`,
        length: lines.length,
        max: template.maxBodyLines,
      });
    }
    for (const [i, line] of lines.entries()) {
      push(tooLong(line, template.maxBodyLineLength, `bodyLines[${i}]`));
    }
  }

  if (plan.headline && plan.subheadline) {
    const h = plan.headline.trim().toLowerCase();
    const s = plan.subheadline.trim().toLowerCase();
    if (h === s || (h.length > 20 && s.includes(h))) {
      issues.push({
        field: 'subheadline',
        message: 'subheadline redundante con headline',
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true };
}
