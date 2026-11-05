---
name: requesting-code-review
description: Use when starting GitHub Flow implementation, completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history.

**Core principle:** Review early, review often.

## Starting a new implementation branch

For GitHub Flow work, create each new implementation branch from the latest remote `main`, unless the user explicitly specifies another base:

- Inspect the working tree and preserve existing changes. Use a separate worktree when needed; do not reset, discard, or automatically stash unrelated work.
- Fetch the repository's upstream remote immediately before creating the branch. For this repository, run `git fetch origin` and require it to succeed; if fetching fails, report the blocker instead of treating cached refs as current.
- Create the branch explicitly from the freshly fetched reference: `git switch --no-track -c codex/<task-name> origin/main`. Do not branch from the current feature branch or an unverified local `main`.
- Before implementation commits, verify `git rev-parse HEAD` equals `git rev-parse origin/main`. Record the base commit in the implementation/review context.
- This applies when creating a new branch. Resume an existing task branch without recreating or resetting it; updating its base later is a separate operation.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or: git merge-base origin/main HEAD
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code reviewer subagent:**

Dispatch a `general-purpose` subagent, filling the template at [code-reviewer.md](code-reviewer.md)

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## GitHub issue traceability at completion

For implementation tracked by GitHub issues, include direct issue-to-PR links in the completion checks. Once the implementation PR exists, add `- Implementation PR: [#<number>](<full PR URL>)` under **Links** in every issue the PR implements; create that section if absent. Verify the PR covers the issue and reread the saved body before moving its board card to Done. Preserve unrelated issue content and existing links, and avoid duplicate entries. A PR-body reference or timeline cross-reference alone is insufficient. If several PRs implement a task, retain each relevant link and wait for the task's full acceptance criteria before marking it Done.

The PR description should also reference the covered issues. Use closing keywords only when automatic closure on merge is intended; adding direct links does not itself authorize closing issues, merging, or publishing a PR.

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code reviewer subagent]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just review the diff myself instead of dispatching a reviewer" | You're the coordinator — reviewing the diff inline burns the context window you need to keep driving the work. Dispatch a reviewer subagent: the diff and the evaluation live in its context, and only the findings come back to you. |
| "The reviewer needs my whole session history to understand the change" | Hand it precisely crafted context, never your session's history. That keeps the reviewer on the work product, not your thought process. |

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
