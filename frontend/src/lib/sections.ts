/**
 * The section registry.
 *
 * One entry per section, and every consumer reads from here: the editor's
 * nav, each section's renderer, the wizard's review warnings, and Markdown
 * export. Adding a section means adding it here and to `types.ts` /
 * `prd.py` — and nowhere else.
 *
 * `sections.test.ts` asserts this registry covers `SECTION_ORDER` exactly, so
 * a section cannot be added to the contract and silently forgotten here.
 */

import {
  SECTION_ORDER,
  SECTION_TO_GROUP,
  type GroupName,
  type PrdInputField,
  type SectionKey,
} from '@/lib/types'

/**
 * How a section renders, and therefore how it is edited.
 *
 * - `prose` — markdown string; a textarea in edit mode
 * - `list` — string[]; add/remove/reorder rows
 * - everything else — an array of objects with its own renderer and editor
 */
export type SectionRenderType =
  | 'prose'
  | 'list'
  | 'personas'
  | 'stories'
  | 'requirements'
  | 'features'
  | 'risks'
  | 'metrics'

/**
 * Nav grouping in the editor sidebar. Distinct from the generation groups in
 * `SECTION_GROUPS` — this is how a reader navigates the document, not how it
 * was produced.
 */
export type DocumentPart = 'overview' | 'users' | 'solution' | 'execution'

export const DOCUMENT_PARTS: { id: DocumentPart; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'solution', label: 'Solution' },
  { id: 'execution', label: 'Execution' },
]

export interface SectionMeta {
  key: SectionKey
  /** Heading shown in the nav, the editor, and the exported Markdown. */
  label: string
  part: DocumentPart
  renderType: SectionRenderType
  /** Which parallel LLM call produces it. Derived, not hand-maintained. */
  group: GroupName
  /** One line explaining what belongs here. Shown in the editor. */
  description: string
  /**
   * Wizard fields that feed this section. The review step uses these to warn
   * which sections will come back thin — "you haven't described success
   * metrics, so that section will be marked as needing clarification."
   */
  dependsOn: PrdInputField[]
}

type SectionMetaSeed = Omit<SectionMeta, 'key' | 'group'>

const SEED: Record<SectionKey, SectionMetaSeed> = {
  executive_summary: {
    label: 'Executive summary',
    part: 'overview',
    renderType: 'prose',
    description: 'The whole document in a paragraph, for someone who reads nothing else.',
    dependsOn: ['product_name', 'idea', 'problem', 'target_users'],
  },
  product_overview: {
    label: 'Product overview',
    part: 'overview',
    renderType: 'prose',
    description: 'What the product is and who it is for.',
    dependsOn: ['product_name', 'idea', 'product_type'],
  },
  problem_statement: {
    label: 'Problem statement',
    part: 'overview',
    renderType: 'prose',
    description: 'The problem being solved, and why it matters now.',
    dependsOn: ['problem', 'why_now', 'current_alternatives'],
  },
  value_proposition: {
    label: 'Value proposition',
    part: 'overview',
    renderType: 'prose',
    description: 'Why someone would choose this over what they do today.',
    dependsOn: ['idea', 'problem', 'current_alternatives'],
  },
  goals: {
    label: 'Goals',
    part: 'overview',
    renderType: 'list',
    description: 'What success looks like for the business and the user.',
    dependsOn: ['business_goals', 'idea'],
  },
  non_goals: {
    label: 'Non-goals',
    part: 'overview',
    renderType: 'list',
    description: 'Explicitly out of scope. Stops arguments later.',
    dependsOn: ['non_goals_input'],
  },

  personas: {
    label: 'Personas',
    part: 'users',
    renderType: 'personas',
    description: 'Who uses this, what they want, and what frustrates them.',
    dependsOn: ['target_users', 'personas_input'],
  },
  pain_points: {
    label: 'Pain points',
    part: 'users',
    renderType: 'list',
    description: 'Specific frustrations the product addresses.',
    dependsOn: ['pain_points_input', 'problem'],
  },
  user_stories: {
    label: 'User stories',
    part: 'users',
    renderType: 'stories',
    description: 'As a ..., I want ..., so that ... — with acceptance criteria.',
    dependsOn: ['target_users', 'core_features'],
  },

  features: {
    label: 'Features',
    part: 'solution',
    renderType: 'features',
    description: 'What gets built, and the user value of each piece.',
    dependsOn: ['core_features', 'nice_to_haves'],
  },
  functional_requirements: {
    label: 'Functional requirements',
    part: 'solution',
    renderType: 'requirements',
    description: 'What the system must do, numbered and prioritised.',
    dependsOn: ['core_features', 'idea'],
  },
  non_functional_requirements: {
    label: 'Non-functional requirements',
    part: 'solution',
    renderType: 'requirements',
    description: 'Performance, security, accessibility, reliability.',
    dependsOn: ['tech_constraints', 'platforms'],
  },
  user_flow: {
    label: 'User flow',
    part: 'solution',
    renderType: 'list',
    description: 'The path a user takes through the product, step by step.',
    dependsOn: ['core_features', 'target_users'],
  },
  mvp_scope: {
    label: 'MVP scope',
    part: 'solution',
    renderType: 'list',
    description: 'The smallest version worth shipping.',
    dependsOn: ['core_features', 'timeline'],
  },

  success_metrics: {
    label: 'Success metrics',
    part: 'execution',
    renderType: 'metrics',
    description:
      'How you will know it worked. Targets stay empty unless you gave a number.',
    dependsOn: ['success_metrics_input', 'business_goals'],
  },
  assumptions: {
    label: 'Assumptions',
    part: 'execution',
    renderType: 'list',
    description: 'What must be true for this plan to hold.',
    dependsOn: ['other_context', 'idea'],
  },
  constraints: {
    label: 'Constraints',
    part: 'execution',
    renderType: 'list',
    description: 'Technical, legal, budget, or timeline limits.',
    dependsOn: ['tech_constraints', 'platforms', 'timeline'],
  },
  dependencies: {
    label: 'Dependencies',
    part: 'execution',
    renderType: 'list',
    description: 'External systems, teams, or decisions this relies on.',
    dependsOn: ['tech_constraints', 'other_context'],
  },
  risks: {
    label: 'Risks',
    part: 'execution',
    renderType: 'risks',
    description: 'What could go wrong, how likely, and what you would do.',
    dependsOn: ['other_context', 'timeline', 'tech_constraints'],
  },
  competitive_considerations: {
    label: 'Competitive considerations',
    part: 'execution',
    renderType: 'prose',
    description:
      'How this sits against alternatives. Only names competitors you named.',
    dependsOn: ['competitors', 'current_alternatives'],
  },
  future_enhancements: {
    label: 'Future enhancements',
    part: 'execution',
    renderType: 'list',
    description: 'Deliberately deferred — worth building, but not now.',
    dependsOn: ['nice_to_haves'],
  },
}

/** Every section, in document order. */
export const SECTIONS: SectionMeta[] = SECTION_ORDER.map((key) => ({
  key,
  group: SECTION_TO_GROUP[key],
  ...SEED[key],
}))

const BY_KEY = new Map<SectionKey, SectionMeta>(
  SECTIONS.map((section) => [section.key, section]),
)

export function getSection(key: SectionKey): SectionMeta {
  const section = BY_KEY.get(key)
  if (!section) throw new Error(`Unknown section key: ${key}`)
  return section
}

export function getSectionLabel(key: SectionKey): string {
  return BY_KEY.get(key)?.label ?? key
}

/** Sections belonging to one nav part, in document order. */
export function sectionsInPart(part: DocumentPart): SectionMeta[] {
  return SECTIONS.filter((section) => section.part === part)
}

/** Sections produced by one generation group, in document order. */
export function sectionsInGroup(group: GroupName): SectionMeta[] {
  return SECTIONS.filter((section) => section.group === group)
}

/** Nav structure for the editor sidebar: parts, each with its sections. */
export function sectionsByPart(): { part: DocumentPart; label: string; sections: SectionMeta[] }[] {
  return DOCUMENT_PARTS.map(({ id, label }) => ({
    part: id,
    label,
    sections: sectionsInPart(id),
  }))
}

/**
 * Sections whose feeding inputs are all blank, so they will be thin.
 *
 * Used by the wizard's review step to set expectations before generating,
 * rather than letting the user discover it afterwards.
 */
export function sectionsAtRisk(
  inputs: Partial<Record<PrdInputField, string>> | null | undefined,
): SectionMeta[] {
  if (!inputs) return SECTIONS
  return SECTIONS.filter((section) =>
    section.dependsOn.every((field) => !inputs[field]?.trim()),
  )
}

/** Human-readable label for the four generation groups, for the progress UI. */
export const GROUP_LABELS: Record<GroupName, string> = {
  strategy: 'Strategy and framing',
  users: 'Users and stories',
  requirements: 'Requirements and features',
  execution: 'Metrics, risks and scope',
}
