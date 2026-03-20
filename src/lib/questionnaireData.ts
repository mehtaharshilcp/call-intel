import type { QuestionnaireTopic } from '../types'

/** Sales discovery checklist topic ids (used in LLM prompt). */
export const QUESTIONNAIRE_TOPICS: QuestionnaireTopic[] = [
  { id: 'budget', label: 'Budget discussion' },
  { id: 'competitor', label: 'Competitor comparison' },
  { id: 'scope_kitchen', label: 'Kitchen size / scope' },
  { id: 'cabinet_style', label: 'Cabinet style preference' },
  { id: 'full_remodel', label: 'Full kitchen remodel?' },
  { id: 'timeline', label: 'Timeline / install date' },
  { id: 'decision_maker', label: 'Decision maker' },
]

export function topicsForPrompt(): { id: string; label: string; hints: string }[] {
  const hints: Record<string, string> = {
    budget: 'budget, price, cost, financing, payment',
    competitor: 'competitor, other quote, elsewhere, comparing',
    scope_kitchen: 'kitchen size, layout, square feet, scope',
    cabinet_style: 'cabinet style, shaker, modern, traditional, finish',
    full_remodel: 'full remodel, gut renovation, replace everything',
    timeline: 'timeline, when, install date, schedule',
    decision_maker: 'decision, spouse, partner, who decides',
  }
  return QUESTIONNAIRE_TOPICS.map((t) => ({
    id: t.id,
    label: t.label,
    hints: hints[t.id] ?? '',
  }))
}
