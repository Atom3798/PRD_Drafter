/**
 * The guided interview, defined as data.
 *
 * Seven steps built from one declarative table rather than seven hand-written
 * forms — otherwise the steps drift apart in spacing, validation and copy.
 *
 * The copy matters more than it looks. Most people asked to "describe your
 * target users" freeze; a concrete placeholder and a one-line hint about what
 * makes a good answer is the difference between a thin PRD and a useful one.
 */

import type { PrdInputField } from '@/lib/types'
import { REQUIRED_INPUT_FIELDS } from '@/lib/types'

export interface WizardField {
  name: PrdInputField
  label: string
  /** Shown inside the empty field. A real example, never a restatement. */
  placeholder: string
  /** One line under the field explaining what a good answer contains. */
  help?: string
  control: 'input' | 'textarea'
  rows?: number
  required?: boolean
}

export interface WizardStep {
  /** 1-based, and the value persisted as `wizard_step`. */
  id: number
  title: string
  /** What this step is for, in one sentence. */
  subtitle: string
  fields: WizardField[]
}

const required = new Set<string>(REQUIRED_INPUT_FIELDS)

function field(config: Omit<WizardField, 'required'>): WizardField {
  return { ...config, required: required.has(config.name) }
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'The idea',
    subtitle: 'What are you building, in plain language?',
    fields: [
      field({
        name: 'product_name',
        label: 'Product name',
        placeholder: 'Pantry',
        control: 'input',
        help: 'A working name is fine. You can change it later.',
      }),
      field({
        name: 'idea',
        label: 'Describe the idea',
        placeholder:
          'A mobile app where home cooks photograph recipe cards and printouts, and get them back as searchable recipes they can organise into collections and share with family.',
        control: 'textarea',
        rows: 5,
        help: 'One paragraph. Say what it does and who it is for — skip the pitch.',
      }),
      field({
        name: 'product_type',
        label: 'What kind of product is it?',
        placeholder: 'Consumer mobile app',
        control: 'input',
        help: 'For example: internal tool, B2B SaaS, mobile app, API, browser extension.',
      }),
    ],
  },
  {
    id: 2,
    title: 'The problem',
    subtitle: 'What is broken today, and for whom?',
    fields: [
      field({
        name: 'problem',
        label: 'What problem does this solve?',
        placeholder:
          'Recipes end up scattered across screenshots, bookmarks and handwritten cards. People cannot find the thing they cooked last month, and family recipes are lost when the person who wrote them down is gone.',
        control: 'textarea',
        rows: 5,
        help: 'Describe the problem as the user experiences it, not the feature you plan to build.',
      }),
      field({
        name: 'why_now',
        label: 'Why is now the right time?',
        placeholder:
          'Phone cameras and on-device text recognition are finally good enough to read a handwritten card reliably.',
        control: 'textarea',
        rows: 3,
        help: 'What changed — technology, cost, regulation, user behaviour?',
      }),
      field({
        name: 'current_alternatives',
        label: 'What do people do instead today?',
        placeholder:
          'Screenshots in a camera roll, a Notes file, bookmarked links, or a physical recipe box.',
        control: 'textarea',
        rows: 3,
        help: 'Including "nothing" or "a spreadsheet" — those are real alternatives.',
      }),
    ],
  },
  {
    id: 3,
    title: 'The users',
    subtitle: 'Who is this for, and what do they struggle with?',
    fields: [
      field({
        name: 'target_users',
        label: 'Who will use this?',
        placeholder:
          'Home cooks who cook several times a week and have collected recipes for years across different places.',
        control: 'textarea',
        rows: 4,
        help: 'Be specific. "Everyone" produces a PRD that helps nobody.',
      }),
      field({
        name: 'personas_input',
        label: 'Any specific people or roles in mind?',
        placeholder:
          'A parent cooking for a family on weeknights. A grandparent wanting to pass recipes on. A keen cook who follows food blogs.',
        control: 'textarea',
        rows: 4,
        help: 'Rough sketches are enough — personas get written up for you.',
      }),
      field({
        name: 'pain_points_input',
        label: 'What frustrates them most?',
        placeholder:
          'Cannot find a recipe they know they saved. Lose everything when they change phone. Screenshots are unreadable a year later.',
        control: 'textarea',
        rows: 4,
        help: 'One frustration per line works well.',
      }),
    ],
  },
  {
    id: 4,
    title: 'The features',
    subtitle: 'What does it do — and what does it deliberately not do?',
    fields: [
      field({
        name: 'core_features',
        label: 'Core features',
        placeholder:
          'Capture a recipe from a photo. Edit the extracted text. Organise into collections. Search by ingredient. Share a collection with family.',
        control: 'textarea',
        rows: 5,
        help: 'One per line. These become requirements and user stories.',
      }),
      field({
        name: 'nice_to_haves',
        label: 'Nice to have, but not essential',
        placeholder:
          'Meal planning. Automatic shopping lists. Scaling servings up and down.',
        control: 'textarea',
        rows: 3,
        help: 'These land in "future enhancements" rather than the MVP.',
      }),
      field({
        name: 'non_goals_input',
        label: 'Explicitly out of scope',
        placeholder:
          'Not a social network. No recipe marketplace. Not doing grocery delivery.',
        control: 'textarea',
        rows: 3,
        help: 'Naming non-goals now prevents an argument later. Worth the minute.',
      }),
    ],
  },
  {
    id: 5,
    title: 'Goals and success',
    subtitle: 'How will you know whether this worked?',
    fields: [
      field({
        name: 'business_goals',
        label: 'What are you trying to achieve?',
        placeholder:
          'Prove people will trust the app with recipes that matter to them, and that capture is reliable enough to use weekly.',
        control: 'textarea',
        rows: 4,
        help: 'The outcome you want, not the features that might get you there.',
      }),
      field({
        name: 'success_metrics_input',
        label: 'How would you measure success?',
        placeholder:
          'Recipes captured per user in the first week. Share of captures kept without heavy editing. Return rate after 30 days.',
        control: 'textarea',
        rows: 4,
        help: 'Include real targets if you have them. If you do not, leave them out — targets you never gave are left blank rather than invented.',
      }),
      field({
        name: 'timeline',
        label: 'Timeline or milestones',
        placeholder: 'Working prototype in six weeks; a usable beta by end of term.',
        control: 'textarea',
        rows: 3,
        help: 'Rough is fine. Dates you do not supply will not be made up.',
      }),
    ],
  },
  {
    id: 6,
    title: 'Constraints and context',
    subtitle: 'What limits the solution?',
    fields: [
      field({
        name: 'platforms',
        label: 'Platforms',
        placeholder: 'iOS and Android. No web app for the first release.',
        control: 'input',
        help: 'Where it has to run.',
      }),
      field({
        name: 'tech_constraints',
        label: 'Technical constraints',
        placeholder:
          'Capture has to work offline. Small team, no dedicated ML engineer. Must use an off-the-shelf text recognition API.',
        control: 'textarea',
        rows: 4,
        help: 'Budget, team size, existing systems, compliance, anything fixed.',
      }),
      field({
        name: 'competitors',
        label: 'Competitors or comparable products',
        placeholder: 'Paprika, AnyList, Notion recipe templates.',
        control: 'textarea',
        rows: 3,
        help: 'Only competitors you name here will appear — none will be invented.',
      }),
      field({
        name: 'other_context',
        label: 'Anything else worth knowing?',
        placeholder:
          'This is a university team project with five people over one semester.',
        control: 'textarea',
        rows: 3,
        help: 'Assumptions, prior research, stakeholder opinions, hard constraints.',
      }),
    ],
  },
  {
    id: 7,
    title: 'Review and generate',
    subtitle: 'Check your answers and choose the shape of the document.',
    fields: [],
  },
]

export const FIRST_STEP = 1
export const LAST_STEP = WIZARD_STEPS.length
export const REVIEW_STEP = LAST_STEP

export function getStep(id: number): WizardStep {
  return WIZARD_STEPS.find((step) => step.id === id) ?? WIZARD_STEPS[0]!
}

/** Clamp an arbitrary number (from a URL or the database) to a real step. */
export function clampStep(value: number | null | undefined): number {
  if (!value || Number.isNaN(value)) return FIRST_STEP
  return Math.min(Math.max(Math.trunc(value), FIRST_STEP), LAST_STEP)
}

/** Every content field across the interview, for the review step. */
export const ALL_CONTENT_FIELDS: WizardField[] = WIZARD_STEPS.flatMap(
  (step) => step.fields,
)
