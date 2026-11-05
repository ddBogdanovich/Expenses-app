---
name: issues
description: Creates GitHub milestones and issues from an implementation plan file (usually docs/plan-*.md, produced by the plan skill) using the gh CLI. One milestone per phase, one issue per task. Takes the path to the plan as the argument. Use when a plan with phases already exists and the user wants a GitHub backlog (e.g. "create issues from the plan", "залей план в GitHub", "создай milestones и issues"). Do not use to write the plan itself (use the plan skill) or to implement tasks.
argument-hint: [path to plan file, e.g. docs/plan-csv-export.md]
---

# Issues generator

Create GitHub milestones and issues from the plan at: $ARGUMENTS

If no path was given, look for plan files in `docs/`. If there is exactly one, use it; otherwise ask the user which one. If the file doesn't exist, ask for the correct path. Don't guess.

## Workflow

1. **Check the environment.** Make sure `gh` is installed, authenticated (`gh auth status`), and the current directory is a git repo with a GitHub remote. If something is missing, stop and tell the user what to fix. Don't try to install or log in yourself.
2. **Read the plan fully.** Extract every phase: its name, goal, layers, dependencies, tasks, and definition of done. Also note the PRD path from the plan header.
3. **Check what already exists** to avoid duplicates:
    - milestones: `gh api repos/:owner/:repo/milestones --paginate --jq '.[].title'`
    - issues of a milestone: `gh issue list --state all --milestone "<title>" --json title`
    - labels: `gh label list`
4. **Show a summary and ask for confirmation** before creating anything: target repository, which milestones and how many issues will be created, and which will be skipped because they already exist. Create nothing until the user confirms.
5. **Create milestones**, one per phase, skipping existing ones:
   `gh api repos/:owner/:repo/milestones -f title="<phase heading from the plan>" -f description="<phase goal + phase definition of done>"`
6. **Create issues**, one per task, skipping existing ones (same title in the same milestone) and tasks already checked `- [x]`:
   `gh issue create --title "<task>" --milestone "<milestone title>" [--label "<label>"] --body-file -`
   Pass the body through stdin (heredoc) so quotes and special characters don't break the command.
7. **Report back**: list the created milestones and issues with URLs, and the skipped ones.

## Issue format

- **Title**: the task text from the plan, without the checkbox markup (`- [ ]`). Don't rewrite or shorten it.
- **Body**:
    - what to do (the task text, plus any details from the plan);
    - **Phase goal**: the goal of the phase;
    - **Depends on**: the value of `Depends on` from the plan, if any;
    - **Links**: path to the plan file and to the PRD. If an implementation PR already exists and its scope covers this task, include a direct Markdown link: `- Implementation PR: [#<number>](<full PR URL>)`. Do not invent a PR URL or add an empty placeholder when implementation has not started.
- **Labels**: take them from the phase's `Layers` (fe / be / db / infra), but only if a label with that name already exists in the repository. Never create labels and never invent them. If there are no matching labels, create the issue without labels.
- **Milestone**: the milestone of the phase the task belongs to.

## Implementation handoff

At the start of implementation, create any new task branch from freshly fetched remote `main` (normally `origin/main`), not the current feature branch or a stale local `main`, unless the user explicitly chooses another base. Fetch must succeed before branch creation; verify the new branch starts at that fetched commit. Preserve unrelated changes, using a separate worktree when necessary. Resume existing task branches without resetting them. The [implementation/review skill](../requesting-code-review/SKILL.md#starting-a-new-implementation-branch) contains the concrete GitHub Flow commands.

When these issues are later implemented, add the implementation PR's direct Markdown link to each covered issue's **Links** section before marking the task Done. A PR-body mention or GitHub timeline cross-reference alone does not satisfy this requirement. Preserve other body content and existing PR links; add each relevant PR once when a task spans several PRs. Verify the saved issue body contains the correct URL. Link the covered issues from the PR description as well; use automatic closing keywords only when closing them on merge is intended. This is a handoff requirement for the implementation workflow, not authorization for this generator to implement tasks or edit existing issues during backlog creation.

## Rules

- Create only what is in the plan: no extra issues, no changes to task wording.
- Don't close, edit, or delete existing issues and milestones.
- If any command fails, stop immediately. Report what has been created so far and what failed, and don't retry the whole run (that would create duplicates). Offer to continue from the failed step.
- Write issues in the same language as the plan.
- Don't modify the plan file.
