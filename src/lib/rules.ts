import type { CategoryRule, Direction } from "@/lib/types";

export interface RuleHit {
  rule: CategoryRule;
  keyword: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whole-word, case-insensitive keyword match — "tea" matches "UPI-...-TEA"
 * but not "TEAM ALLOWANCE". Rules are checked in sort order and the first
 * hit wins, so a specific rule placed above a general one takes precedence.
 */
export function matchRule(
  rules: CategoryRule[],
  text: string,
  direction?: Direction | null,
): RuleHit | null {
  if (!text.trim()) return null;

  const ordered = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of ordered) {
    if (rule.direction && direction && rule.direction !== direction) continue;
    for (const keyword of rule.keywords) {
      const k = keyword.trim();
      if (!k) continue;
      // \b fails next to non-word characters, so bound on "not a letter/digit".
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(k)}($|[^\\p{L}\\p{N}])`, "iu");
      if (pattern.test(text)) return { rule, keyword: k };
    }
  }
  return null;
}
