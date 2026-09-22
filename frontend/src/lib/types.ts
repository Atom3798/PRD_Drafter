/**
 * The shared contract.
 *
 * This file and `backend/app/models/prd.py` describe the same data. They must
 * stay in sync, and they are FROZEN after Phase 2 — changes need lead
 * approval, because five people are coding against them.
 *
 * Two naming collisions are worth understanding before you read further:
 *
 * 1. **`assumptions` means two different things.** There is an `assumptions`
 *    *section* inside the PRD document (a normal list of stated assumptions,
 *    part of `PrdContent`), and there is the cross-cutting `Assumption`
 *    record that flags where the model had to infer something (stored
 *    alongside the PRD, surfaced in the editor's assumptions panel). They are
 *    unrelated. The second is the anti-fabrication mechanism.
 *
 * 2. **Generation groups are not document order.** `SECTION_GROUPS` controls
 *    which sections come from which of the four parallel LLM calls.
 *    `SECTION_ORDER` controls the order a human reads them in.
 */

// ---------------------------------------------------------------------------
// Status and enums
// ---------------------------------------------------------------------------

/** Mirrors the `prd_status` Postgres enum. */
export type PrdStatus = 'draft' | 'generating' | 'generated' | 'failed'

export type Priority = 'must' | 'should' | 'could'
export type Likelihood = 'low' | 'medium' | 'high'
export type Impact = 'low' | 'medium' | 'high'
export type Scope = 'mvp' | 'future'

// ---------------------------------------------------------------------------
// Section identity
// ---------------------------------------------------------------------------

/**
 * Document order — the order a person reads the finished PRD in. Used by the
 * editor's section nav and by Markdown export.
 *
 * Deliberately different from `SECTION_GROUPS` below, which exists to
 * parallelise generation. Optimising one for the other would make either the
 * latency or the document worse.
 */
export const SECTION_ORDER = [
  'executive_summary',
  'product_overview',
  'problem_statement',
  'value_proposition',
  'goals',
  'non_goals',
  'personas',
  'pain_points',
  'user_stories',
  'features',
  'functional_requirements',
  'non_functional_requirements',
  'user_flow',
  'mvp_scope',
  'success_metrics',
  'assumptions',
  'constraints',
  'dependencies',
  'risks',
  'competitive_considerations',
  'future_enhancements',
] as const

export type SectionKey = (typeof SECTION_ORDER)[number]

export type GroupName = 'strategy' | 'users' | 'requirements' | 'execution'

/**
 * Which sections each of the four parallel LLM calls is responsible for.
 * Total latency is roughly the slowest group rather than the sum of 21
 * sections.
 */
export const SECTION_GROUPS: Record<GroupName, readonly SectionKey[]> = {
  strategy: [
    'product_overview',
    'executive_summary',
    'problem_statement',
    'goals',
    'non_goals',
    'value_proposition',
  ],
  users: ['personas', 'pain_points', 'user_stories'],
  requirements: [
    'functional_requirements',
    'non_functional_requirements',
    'features',
    'user_flow',
  ],
  execution: [
    'success_metrics',
    'assumptions',
    'constraints',
    'risks',
    'dependencies',
    'competitive_considerations',
    'mvp_scope',
    'future_enhancements',
  ],
} as const

export const GROUP_NAMES = [
  'strategy',
  'users',
  'requirements',
  'execution',
] as const satisfies readonly GroupName[]

/** Reverse lookup: which group produces a given section. */
export const SECTION_TO_GROUP: Record<SectionKey, GroupName> = Object.fromEntries(
  GROUP_NAMES.flatMap((group) =>
    SECTION_GROUPS[group].map((key) => [key, group] as const),
  ),
) as Record<SectionKey, GroupName>

// ---------------------------------------------------------------------------
// Structured content items
// ---------------------------------------------------------------------------

export interface Persona {
  name: string
  description: string
  goals: string[]
  frustrations: string[]
}

export interface UserStory {
  /** Stable identifier, e.g. "US-01". */
  id: string
  persona: string
  /** "As a ..., I want ..., so that ..." */
  story: string
  acceptance_criteria: string[]
  priority: Priority
}

export interface Requirement {
  /** "FR-01" for functional, "NFR-01" for non-functional. */
  id: string
  title: string
  description: string
  priority: Priority
  rationale: string | null
}

export interface Feature {
  name: string
  description: string
  user_value: string
  scope: Scope
}

export interface Risk {
  description: string
  likelihood: Likelihood
  impact: Impact
  mitigation: string
}

export interface Metric {
  name: string
  definition: string
  /**
   * `null` when the user supplied no number. The model must NOT invent one —
   * a plausible-looking fake target is the exact failure this product exists
   * to avoid. Render it as "not specified", never as a guess.
   */
  target: string | null
  timeframe: string | null
}

/**
 * An inference the model made, recorded rather than hidden.
 *
 * This is the anti-fabrication mechanism. When the model has to guess at
 * something material, it says so here instead of presenting the guess as fact.
 */
export interface Assumption {
  section_key: SectionKey
  text: string
  /**
   * True when the guess is material and a human should confirm it. These sort
   * first in the assumptions panel and mark their section amber — the only
   * place amber is used in the product.
   */
  needs_clarification: boolean
}

// ---------------------------------------------------------------------------
// PRD content
// ---------------------------------------------------------------------------

/**
 * The generated document.
 *
 * A section the user gave nothing for stays empty and gets an `Assumption`
 * explaining what is missing — it is never padded with generic filler.
 */
export interface PrdContent {
  // strategy
  product_overview: string | null
  executive_summary: string | null
  problem_statement: string | null
  goals: string[]
  non_goals: string[]
  value_proposition: string | null

  // users
  personas: Persona[]
  pain_points: string[]
  user_stories: UserStory[]

  // requirements
  functional_requirements: Requirement[]
  non_functional_requirements: Requirement[]
  features: Feature[]
  user_flow: string[]

  // execution
  success_metrics: Metric[]
  /**
   * The document's own assumptions section. NOT the cross-cutting
   * `Assumption` records — see the file header.
   */
  assumptions: string[]
  constraints: string[]
  risks: Risk[]
  dependencies: string[]
  competitive_considerations: string | null
  mvp_scope: string[]
  future_enhancements: string[]
}

/** The value stored at a given section key. */
export type SectionValue = PrdContent[SectionKey]

// ---------------------------------------------------------------------------
// Wizard inputs
// ---------------------------------------------------------------------------

/**
 * Answers from the seven-step wizard.
 *
 * Every field is optional in practice: a draft saves after every keystroke, so
 * a half-filled form must always persist. Only four fields gate generation —
 * see `REQUIRED_INPUT_FIELDS`.
 */
export interface PrdInputs {
  // Step 1 — Idea
  product_name: string
  idea: string
  product_type: string

  // Step 2 — Problem
  problem: string
  why_now: string
  current_alternatives: string

  // Step 3 — Users
  target_users: string
  personas_input: string
  pain_points_input: string

  // Step 4 — Features
  core_features: string
  nice_to_haves: string
  non_goals_input: string

  // Step 5 — Goals
  business_goals: string
  success_metrics_input: string
  timeline: string

  // Step 6 — Constraints
  platforms: string
  tech_constraints: string
  competitors: string
  other_context: string
}

export type PrdInputField = keyof PrdInputs

/**
 * Four required fields out of nineteen. A user should be able to reach
 * Generate in under two minutes; everything else improves the output but
 * never blocks it.
 */
export const REQUIRED_INPUT_FIELDS = [
  'product_name',
  'idea',
  'problem',
  'target_users',
] as const satisfies readonly PrdInputField[]

export type RequiredInputField = (typeof REQUIRED_INPUT_FIELDS)[number]

/** Mirrors `MAX_FIELD_CHARS` / `MAX_TOTAL_INPUT_CHARS` in the backend. */
export const MAX_FIELD_CHARS = 5_000
export const MAX_TOTAL_INPUT_CHARS = 50_000
export const MAX_TITLE_CHARS = 200
export const MAX_INSTRUCTION_CHARS = 500

export const WIZARD_STEP_COUNT = 7

// ---------------------------------------------------------------------------
// Usage and provenance
// ---------------------------------------------------------------------------

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

// ---------------------------------------------------------------------------
// Persisted entities
// ---------------------------------------------------------------------------

/** A full PRD, inputs and content included. */
export interface Prd {
  id: string
  user_id: string
  title: string
  status: PrdStatus
  inputs: PrdInputs
  content: PrdContent | null
  assumptions: Assumption[]
  wizard_step: number
  generation_error: string | null
  provider: string | null
  model: string | null
  token_usage: TokenUsage | null
  generation_started_at: string | null
  created_at: string
  updated_at: string
}

/** The dashboard list item. Deliberately omits inputs and content. */
export interface PrdSummary {
  id: string
  title: string
  status: PrdStatus
  created_at: string
  updated_at: string
  section_count: number
}

/** Version history list item, without the content payload. */
export interface PrdVersionSummary {
  id: string
  version_number: number
  change_summary: string
  created_at: string
}

export interface PrdVersion extends PrdVersionSummary {
  prd_id: string
  content: PrdContent
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export interface CreatePrdRequest {
  title?: string
}

/**
 * Partial update, used by autosave. An omitted field means "leave alone" —
 * the backend merges rather than replacing, so a PATCH carrying only
 * `wizard_step` will not wipe `inputs`.
 */
export interface UpdatePrdRequest {
  title?: string
  inputs?: Partial<PrdInputs>
  content?: Partial<PrdContent>
  wizard_step?: number
}

export interface RegenerateSectionRequest {
  /** Optional steering, e.g. "make this more technical". */
  instruction?: string
}

// ---------------------------------------------------------------------------
// Response bodies
// ---------------------------------------------------------------------------

export interface PrdListResponse {
  items: PrdSummary[]
  /** Total matching the filter, not `items.length` — used for pagination. */
  total: number
}

export interface GenerationStatusResponse {
  status: PrdStatus
  generation_error: string | null
  started_at: string | null
}

/**
 * Per-group result, so the progress panel can show which of the four
 * succeeded. A partial failure still persists the groups that worked.
 */
export interface GroupOutcome {
  group: GroupName
  succeeded: boolean
  /** Plain language, safe to show. Never a provider error string. */
  error: string | null
}

export interface GenerationResultResponse {
  status: PrdStatus
  groups: GroupOutcome[]
  section_count: number
  assumption_count: number
}

export interface RegenerateSectionResponse {
  section_key: SectionKey
  /** Shape depends on the section's render type. */
  content: SectionValue
  assumptions: Assumption[]
  version_number: number | null
}

export interface VersionListResponse {
  items: PrdVersionSummary[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** An empty `PrdInputs`, for a fresh draft. */
export function emptyPrdInputs(): PrdInputs {
  return {
    product_name: '',
    idea: '',
    product_type: '',
    problem: '',
    why_now: '',
    current_alternatives: '',
    target_users: '',
    personas_input: '',
    pain_points_input: '',
    core_features: '',
    nice_to_haves: '',
    non_goals_input: '',
    business_goals: '',
    success_metrics_input: '',
    timeline: '',
    platforms: '',
    tech_constraints: '',
    competitors: '',
    other_context: '',
  }
}

/** Required fields still blank. Empty array means ready to generate. */
export function missingRequiredFields(
  inputs: Partial<PrdInputs> | null | undefined,
): RequiredInputField[] {
  if (!inputs) return [...REQUIRED_INPUT_FIELDS]
  return REQUIRED_INPUT_FIELDS.filter((field) => !inputs[field]?.trim())
}

export function isReadyToGenerate(
  inputs: Partial<PrdInputs> | null | undefined,
): boolean {
  return missingRequiredFields(inputs).length === 0
}

/** Whether a section holds anything worth rendering. */
export function isSectionPopulated(
  content: PrdContent | null | undefined,
  key: SectionKey,
): boolean {
  if (!content) return false
  const value = content[key]
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return value.length > 0
}

export function populatedSectionCount(content: PrdContent | null | undefined): number {
  if (!content) return 0
  return SECTION_ORDER.filter((key) => isSectionPopulated(content, key)).length
}

/** Section keys carrying at least one unresolved assumption. */
export function sectionsNeedingClarification(
  assumptions: Assumption[] | null | undefined,
): Set<SectionKey> {
  const keys = new Set<SectionKey>()
  for (const assumption of assumptions ?? []) {
    if (assumption.needs_clarification) keys.add(assumption.section_key)
  }
  return keys
}
