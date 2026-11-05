---
name: plan-phase
description: Splits an existing PRD file into an ordered implementation plan of small, shippable phases and saves it to docs/plan-<feature-name>.md. Takes the path to a PRD (usually docs/prd-*.md) as the argument. Use when a PRD already exists and the user wants a development plan, phases, roadmap, or task breakdown for it (e.g. "make a plan from this PRD", "разбей PRD на фазы", "составь план реализации"). Do not use to write the PRD itself (use the prd skill) or to implement the plan.
argument-hint: [path to PRD file, e.g. docs/prd-csv-export.md]
---

# Plan generator

Create an implementation plan from the PRD at: $ARGUMENTS

If no path was given, look for PRD files in `docs/`. If there is exactly one, use it; otherwise ask the user which one. If the file doesn't exist, ask the user for the correct path. Don't guess.

## Workflow

1. **Read the PRD fully.** Note the goal, scope, "Not in scope", technical constraints, open questions, and every item of "Definition of done".
2. **Explore the codebase** enough to know which layers (frontend, backend, database, infra) the feature touches and what already exists. Tasks must be grounded in the real project, not generic.
3. **Clarify before planning.** If the PRD is missing information needed to split the work (unresolved open questions, unclear scope, ambiguous criteria), ask clarifying questions. Ask the most important ones first (up to 5 per round) and continue if needed. Do NOT create the file until the plan can be written without guessing.
4. **Choose the file name.** Take the feature name from the PRD file name: `docs/prd-<feature-name>.md` → `docs/plan-<feature-name>.md`. If the file already exists, don't overwrite it: ask whether to update it or choose another name.
5. **Split into phases** following the phase rules below, then write the plan using the template and save it.
6. **Verify coverage.** Every item of the PRD's "Definition of done" must be covered by at least one phase. Check that each phase includes the test-first gate below, concrete applicable scenarios, and passing tests in its completion criteria. Fix gaps before finishing.
7. **Report back**: give the file path, a one-line summary of each phase, and any assumptions made.

## Template

```markdown
# Plan: {feature name}

**PRD:** {path to PRD file}
**Date:** {current date, YYYY-MM-DD}

## Implementation phases

### Phase 1: {name}
**Goal:** What this phase delivers and why it is useful on its own.
**Layers:** fe / be / db / infra (only those touched)
**Depends on:** none | Phase N
**Covers:** PRD criteria this phase satisfies (quote or number them)
**Test-first gate:** Before implementation, write or extend {applicable E2E scenarios}, run them against the preceding working state, and record expected behavioral failures. For already-passing or inapplicable cases, state the reason instead of manufacturing a failure.
**Tasks:**
- [ ] {Task}

**Definition of done:**
- [ ] Applicable test-first scenarios and earlier-phase regressions pass; baseline and final results are recorded.
- [ ] {Verifiable criterion}

### Phase 2: {name}
...
```

## Phase splitting rules

- **Each phase leaves the system in a working, shippable state** and delivers something that can be verified. We can stop after any phase and have a coherent result.
- Phases are ordered. A phase may depend on earlier ones, but never on later ones. State dependencies in `Depends on`.
- **Phase 1 is a tracer bullet**: the thinnest end-to-end slice that proves the approach works, going through all layers involved (UI → backend → storage). It is the one phase allowed to mix FE and BE.
- After Phase 1, backend and frontend work go into separate phases. A backend phase must be verifiable without the UI (API tests, curl, etc.).
- Maximum 5 tasks per phase. If a phase needs more, split it.
- A task is a concrete action on the project (what to change and where), small enough to finish in one sitting.

## Test-first E2E rules

- Plan applicable end-to-end tests **before each phase's feature implementation**: write or extend executable scenarios, run them against the preceding working state, record the expected failures, implement the behavior, and rerun the same tests to green. Specify the phase's actual user journeys or observable acceptance outcomes, not just "add E2E tests".
- Use a repeatable automated real-browser suite for browser journeys and real services for integration-dependent outcomes. Backend-only cases may use HTTP integration tests without UI changes. Retain repository-required browser inspection and review alongside automated tests; they do not replace each other.
- Include harness/fixture preparation before the first dependent feature change. Missing dependencies, unavailable infrastructure, broken fixtures, compilation errors, skipped tests, and unconditional failures do not count as behavioral red results. Record blocked scenarios as outstanding; where possible, demonstrate missing behavior through the running application and rerun the full journey once dependencies exist.
- Preserve already-green tests as regressions. For verification/documentation-only phases or behavior already delivered, record a passing baseline and explain why no new red case applies. Do not create artificial failures or expand scope solely to obtain red.
- Require evidence of baseline and final runs: scenario/test name, repeatable command, baseline revision or working-state identifier, expected/actual result, and failure reason. Keep sensitive values out of evidence. Do not weaken assertions, silently replace visual baselines, or skip failures to obtain green; explain any correction to an invalid test.
- Each phase's Definition of done must require its applicable E2E scenarios, earlier-phase regressions, and required checks to pass. Account for test work within the five-task limit and phase dependencies. A blocked test is not green and prevents completion of the affected acceptance criterion.

## Rules

- Cover every item of the PRD's "Definition of done". Nothing may be left out.
- Don't add tasks that aren't required by the PRD. Respect "Not in scope".
- Phase "Definition of done" must be verifiable (yes/no check or measurable value), not "works correctly".
- Do not implement anything. This skill only produces the plan.
- Write the plan in the same language as the PRD. Keep section headings from the template in English.
- Use the real current date. If you don't know it, get it from the environment (e.g. `date +%F`).
