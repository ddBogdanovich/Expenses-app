---
name: prd
description: Writes a Product Requirements Document (PRD) for a new feature and saves it to docs/prd-<feature-name>.md. Asks clarifying questions first if the request is vague. Use when the user asks to write a PRD, define or specify requirements, or describe scope and acceptance criteria for a feature BEFORE implementation (e.g. "write a PRD for...", "составь PRD", "опиши требования к фиче"). Do not use for implementation plans, technical designs, or bug reports.
argument-hint: [feature description]
---

# PRD generator

Create a PRD for this feature: $ARGUMENTS

If no feature description was provided, ask the user what feature the PRD is for.

## Workflow

1. **Understand the request.** Check the repository (existing code, docs, README, other PRDs in `docs/`) for context. Don't ask the user about anything you can find yourself.
2. **Clarify before writing.** If the goal, target user, scope boundaries, or success criteria are missing, ambiguous, or contradictory, ask clarifying questions. Ask the most important ones first (up to 5 per round), then continue in further rounds if needed. Do NOT create the file until you can fill every section of the template concretely without guessing. Anything the user explicitly can't answer goes into "Open questions".
3. **Choose the file name.** Derive a short feature name (2-5 words) from the request and convert it to kebab-case ASCII: `docs/prd-<feature-name>.md`, e.g. `docs/prd-csv-report-export.md`. Never put the raw `$ARGUMENTS` text into the file name. Create the `docs/` folder (relative to the project root) if it doesn't exist. If the file already exists, don't overwrite it: ask the user whether to update it or choose another name.
4. **Write the PRD** using the template below and save it.
5. **Report back**: give the file path and a 2-3 sentence summary, and list any open questions.

## Template

```markdown
# PRD: {feature name}

**Date**: {current date, YYYY-MM-DD}
**Status**: Draft

## Goal
2-3 sentences: what problem this solves and what value the user gets.

## User scenarios
- {User/role} {action} -> {observable result}

## Scope
Concrete list of what is included in this feature.

## Not in scope
Explicit list of what must NOT be done as part of this feature.

## Technical constraints
Known constraints the solution must respect (existing systems, compatibility, performance, security, deadlines). Constraints only, not solutions.

## Definition of done
- [ ] {Verifiable criterion}

## Open questions
Unresolved points and who can answer them. Omit this section if there are none.
```

## Rules

- Be concrete and specific: no abstractions, no buzzwords ("seamless", "robust", "user-friendly").
- Every item in "Definition of done" must be verifiable: someone can check it with a yes/no answer or a measurable value (e.g. "export of 10k rows finishes in under 5 s", not "export works fast").
- Describe WHAT and WHY only. Don't prescribe implementation, architecture, libraries, or approach.
- Write the PRD in the language the user wrote their request in. Keep the section headings from the template in English.
- Use the real current date. If you don't know it, get it from the environment (e.g. `date +%F`).
