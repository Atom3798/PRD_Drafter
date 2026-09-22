import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_PARTS,
  GROUP_LABELS,
  getSection,
  getSectionLabel,
  SECTIONS,
  sectionsAtRisk,
  sectionsByPart,
  sectionsInGroup,
} from '@/lib/sections'
import {
  emptyPrdInputs,
  GROUP_NAMES,
  isReadyToGenerate,
  isSectionPopulated,
  missingRequiredFields,
  populatedSectionCount,
  SECTION_GROUPS,
  SECTION_ORDER,
  SECTION_TO_GROUP,
  sectionsNeedingClarification,
  type PrdContent,
  type PrdInputField,
} from '@/lib/types'

/** An otherwise-empty PrdContent, so individual sections can be filled in. */
function emptyContent(): PrdContent {
  return {
    product_overview: null,
    executive_summary: null,
    problem_statement: null,
    goals: [],
    non_goals: [],
    value_proposition: null,
    personas: [],
    pain_points: [],
    user_stories: [],
    functional_requirements: [],
    non_functional_requirements: [],
    features: [],
    user_flow: [],
    success_metrics: [],
    assumptions: [],
    constraints: [],
    risks: [],
    dependencies: [],
    competitive_considerations: null,
    mvp_scope: [],
    future_enhancements: [],
  }
}

describe('section registry', () => {
  it('covers every section key, in document order', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual([...SECTION_ORDER])
  })

  it('gives every section a label, description, part and render type', () => {
    for (const section of SECTIONS) {
      expect(section.label, `${section.key} label`).toBeTruthy()
      expect(section.description, `${section.key} description`).toBeTruthy()
      expect(section.renderType, `${section.key} renderType`).toBeTruthy()
      expect(
        DOCUMENT_PARTS.map((p) => p.id),
        `${section.key} part`,
      ).toContain(section.part)
    }
  })

  it('derives each section group from the shared contract', () => {
    for (const section of SECTIONS) {
      expect(section.group).toBe(SECTION_TO_GROUP[section.key])
    }
  })

  it('gives every section a unique label, so the nav is unambiguous', () => {
    const labels = SECTIONS.map((s) => s.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('only depends on fields that exist on PrdInputs', () => {
    const inputFields = new Set(Object.keys(emptyPrdInputs()) as PrdInputField[])
    for (const section of SECTIONS) {
      expect(section.dependsOn.length, `${section.key} has no inputs`).toBeGreaterThan(0)
      for (const field of section.dependsOn) {
        expect(inputFields, `${section.key} -> ${field}`).toContain(field)
      }
    }
  })

  it('partitions every section into exactly one nav part', () => {
    const grouped = sectionsByPart().flatMap((part) => part.sections.map((s) => s.key))
    expect(grouped.sort()).toEqual([...SECTION_ORDER].sort())
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('matches the generation groups from the contract', () => {
    for (const group of GROUP_NAMES) {
      const fromRegistry = sectionsInGroup(group)
        .map((s) => s.key)
        .sort()
      expect(fromRegistry).toEqual([...SECTION_GROUPS[group]].sort())
      expect(GROUP_LABELS[group]).toBeTruthy()
    }
  })

  it('looks a section up by key, and throws on an unknown one', () => {
    expect(getSection('risks').label).toBe('Risks')
    expect(getSectionLabel('personas')).toBe('Personas')
    // @ts-expect-error - deliberately invalid key
    expect(() => getSection('not_a_section')).toThrow(/Unknown section key/)
  })

  it('assigns a render type consistent with the shape in PrdContent', () => {
    const content = emptyContent()
    for (const section of SECTIONS) {
      const value = content[section.key]
      if (section.renderType === 'prose') {
        expect(value, `${section.key} should be nullable prose`).toBeNull()
      } else {
        expect(Array.isArray(value), `${section.key} should be an array`).toBe(true)
      }
    }
  })
})

describe('sectionsAtRisk', () => {
  it('flags every section when nothing has been filled in', () => {
    expect(sectionsAtRisk(emptyPrdInputs())).toHaveLength(SECTIONS.length)
  })

  it('clears a section once any of its inputs has content', () => {
    const inputs = { ...emptyPrdInputs(), competitors: 'Notion, Confluence' }
    const atRisk = sectionsAtRisk(inputs).map((s) => s.key)
    expect(atRisk).not.toContain('competitive_considerations')
  })

  it('treats whitespace as empty', () => {
    const inputs = { ...emptyPrdInputs(), competitors: '   ' }
    expect(sectionsAtRisk(inputs).map((s) => s.key)).toContain(
      'competitive_considerations',
    )
  })
})

describe('input helpers', () => {
  it('reports all four required fields missing on a blank draft', () => {
    expect(missingRequiredFields(emptyPrdInputs())).toEqual([
      'product_name',
      'idea',
      'problem',
      'target_users',
    ])
    expect(isReadyToGenerate(emptyPrdInputs())).toBe(false)
  })

  it('is ready once the four required fields are filled', () => {
    const inputs = {
      ...emptyPrdInputs(),
      product_name: 'Acme',
      idea: 'A thing',
      problem: 'A problem',
      target_users: 'People',
    }
    expect(missingRequiredFields(inputs)).toEqual([])
    expect(isReadyToGenerate(inputs)).toBe(true)
  })

  it('treats a null draft as missing everything rather than crashing', () => {
    expect(missingRequiredFields(null)).toHaveLength(4)
    expect(isReadyToGenerate(undefined)).toBe(false)
  })
})

describe('content helpers', () => {
  it('counts a blank document as zero populated sections', () => {
    expect(populatedSectionCount(emptyContent())).toBe(0)
    expect(populatedSectionCount(null)).toBe(0)
  })

  it('counts prose and list sections once populated', () => {
    const content = { ...emptyContent(), problem_statement: 'A real problem.' }
    content.goals = ['Ship it']
    expect(populatedSectionCount(content)).toBe(2)
  })

  it('does not count whitespace-only prose as populated', () => {
    const content = { ...emptyContent(), problem_statement: '   ' }
    expect(isSectionPopulated(content, 'problem_statement')).toBe(false)
  })

  it('collects only the sections whose assumptions need clarification', () => {
    const flagged = sectionsNeedingClarification([
      { section_key: 'success_metrics', text: 'Guessed a target', needs_clarification: true },
      { section_key: 'goals', text: 'Restated the goal', needs_clarification: false },
    ])
    expect([...flagged]).toEqual(['success_metrics'])
  })

  it('handles a missing assumptions array', () => {
    expect(sectionsNeedingClarification(null).size).toBe(0)
  })
})
