# ADR 0013: Maintain a small code-backed frontend design system

- Status: Accepted
- Date: 2026-11-02

## Context

The owner requested a shared design foundation before adding more interfaces. Account and daily-spending screens already establish a calm forest-green visual direction, but many choices live in registration-specific CSS. HeroUI supplies controls and accessibility behavior; it does not specify PocketLedger's product language, page structure, or financial presentation. Generic design suggestions alone can produce inconsistent future pages.

## Decision

Preserve the current direction and document it in `docs/design/README.md`. Centralize theme and shared measurements in `src/PocketLedger.Web/src/styles/tokens.css`, mapping semantic colors to HeroUI v3. Explicitly use system sans-serif typography rather than naming an unloaded Inter font. Keep light mode explicit. Render the existing monogram concept as one fixed SVG path asset shared by the wordmark component and favicon.

Use a small local presentation layer (`PageShell`, `Notice`) and shared CSS recipes. Keep the daily-spending presentation in its feature as `SpendingSummary`, with loading/error/ready states; fetching and session behavior remain in `TodayPage`. Use HeroUI controls directly instead of building parallel abstractions for its entire API.

Add a Vite development-only `/design-system` page showing real theme/component implementations and interactive local examples. Select it inside the authenticated application flow; guard its lazy route import with `import.meta.env.DEV` so production eliminates the page and reference styles. Signed-out deep links go to login and continue to the reference after successful authentication. The access gate verifies the bearer session through `GET /api/auth/me` before rendering examples, rechecks on visibility and every minute, and fails closed with retry when verification is unavailable. Logout/reload clear the existing in-memory session. The production app retains its existing account and daily-spending routes. The sample interactions never call the API; the session gate does.

Link the guide through root and frontend READMEs/instructions. Product-specific accepted rules take precedence over generic skill suggestions. Update rules, code, and affected reference examples together. Existing Playwright MCP and UI/UX review requirements remain mandatory.

## Alternatives and costs

A prose-only style guide or PDF is inexpensive to start but leaves implementation/state decisions open and can drift from the app. A large brandbook, standalone UI package, Figma library, or Storybook installation adds maintenance beyond the current screen count. These can be reconsidered when cross-product branding, design collaboration, or component complexity needs them.

A code-backed reference has its own maintenance cost and is not an automated visual-regression system. Shared CSS changes can affect every screen, so checking representative states and viewport sizes is essential. Native system fonts avoid a loading dependency but deliberately vary by platform. Exact design values stay in CSS; prose explains their roles rather than copying a second numerical specification.

## Scope

This changes presentation structure and development documentation. Existing authentication/API contracts, persistence, Aspire resources, and domain rules are unchanged; the reference now participates in the authenticated navigation flow. Rolling allowance, charts, dark mode, and a larger icon system remain future features, not reference-page promises.

## Phase 5 supplement

[ADR 0019](0019-default-browser-session.md) supersedes the browser preview/default split and the reference’s bearer-session gate. HTML document failures now navigate to bounded recovery; API JSON/status contracts and identity/session security remain. Historical rationale above is retained.
