# Learning note 015: A small frontend design system

## From repeated choices to shared rules

A design system combines visual rules, reusable implementation, and examples. A brandbook usually emphasizes identity and marketing usage; a style guide documents appearance and conventions; a UI kit supplies components. PocketLedger needs a small combination focused on daily product work.

Previously a new page could copy `registration-shell` and then choose its own muted color, button dimensions, or error styling. Now [`PageShell`](../../src/PocketLedger.Web/src/ui/PageShell.tsx) owns the page frame, [`Notice`](../../src/PocketLedger.Web/src/ui/Notice.tsx) distinguishes message meaning, and [the design guide](../design/README.md) explains how to use the patterns.

## Tokens give values a meaning

A design token is a named design value. `--accent` means primary action color; `--danger` means error/destructive color; `--space-6` is a shared spacing step. The exact values live in [`tokens.css`](../../src/PocketLedger.Web/src/styles/tokens.css), not in multiple page components or documentation tables.

```css
.notice--danger {
  color: var(--danger);
  background: var(--danger-soft);
}
```

Semantic names matter even when two roles currently share a color: success and the primary brand color can evolve independently. HeroUI already consumes tokens such as `--accent`, `--default`, `--danger`, and `--focus`, so the same theme applies to controls used directly from the library. Avoid a second set of hardcoded button colors.

The system font stack is deliberate. Writing “Inter” in CSS did not load that font. Bundling a font would improve cross-platform typography consistency but introduce asset loading and layout considerations. The first system accepts native fonts and tests responsive text behavior. The small brand monogram is an SVG path asset shared by `Brand` and the favicon, so the logo shape itself does not vary with fonts.

## Composition and feature ownership

React composition means supplying children and small explicit props rather than inheriting page classes or configuring a universal component with many flags.

```tsx
<PageShell headerAction={<Button variant="outline" onPress={logOut}>Log out</Button>}>
  <main id="main-content" tabIndex={-1}>
    <h1>Today’s spending</h1>
    <SpendingSummary state={{ status: 'ready', total }} />
  </main>
</PageShell>
```

`PageShell` owns brand/header/gutters/skip navigation. The page owns the main landmark and task. `SpendingSummary` remains in `features/today` because its meaning is specific to daily spending, even though the reference page also renders it. Its discriminated union permits ready data, an error with a retry action, or loading; it does not permit a confusing combination of `loading=true` with visible zero spending. `TodayPage` still owns requests, refresh, and session expiration.

Keep HeroUI `TextField`, `Label`, `Input`, `Description`, and `FieldError` composition visible. A wrapper around every primitive would introduce a second API for one person to learn and maintain. Shared styles and examples are sufficient until repetition demonstrates a useful higher-level component.

## A working reference rather than screenshots alone

Run through Aspire as usual, or run `npm run dev` from `src/PocketLedger.Web`, then sign in and use the “Design reference” header action. A signed-out `/design-system` visit goes to login and continues to the reference after authentication. Inspect buttons, form validation/pending/disabled states, notices, and daily totals including error/retry, zero, loading, and an amount beyond JavaScript's safe integer range. Example controls change local state without API calls or persistent storage. The permanently invalid sample field sits outside the working example form so it does not prevent valid example submissions.

`App.tsx` uses Vite's `import.meta.env.DEV` guard and a lazy route import behind its authenticated rendering branch. `main.tsx` always mounts the application. Production builds remove the reference page, its fixtures, and its reference stylesheet. `npm run preview` serves that production output and opens the normal app even at `/design-system`; this is not a fourth production route. Lazy loading also avoids downloading the reference page when developing ordinary account screens.

This avoids another dependency such as Storybook while there are few patterns. It does not supply automated screenshot comparisons or replace browser validation. Add a larger component workshop only when concrete needs outweigh maintenance.

## Verification and exercises

Run `npm run build`, `npm run lint`, and `npm test` from the frontend. Inspect the production output to confirm reference-only copy/styles are absent. Use Playwright MCP to exercise actual screens and the reference, capture/review screenshots, check contrast and keyboard focus, and repeat [the mobile matrix](014-mobile-layout-and-accessibility.md#verification-and-its-limits). Mocked API responses in browser QA make states reproducible, not proof of backend correctness. Follow [ADR 0013](../decisions/0013-code-backed-frontend-design-system.md).

1. Change `--accent` temporarily. Which screens and button states change? Why should hover color be checked too? Revert the experiment.
2. Explain why a session-expired notice is informational while a failed request is an error.
3. Add a temporary second `SpendingSummary` in the reference. Does it produce duplicate IDs? What should happen when only one summary changes?
4. Inspect the empty, failed, and loading summaries. Why is zero appropriate for only one of them?
5. Design an expense form on paper using existing patterns. Which parts are presentation, and which belong to its future use-case behavior?

## Initial implementation verification

On 2026-11-02, the frontend production build, lint, and all 20 behavior tests passed. An isolated Playwright MCP session exercised reference and account interactions, including registration pending/conflict/success, login failures/session expiration, and daily-total loading/error/retry. Browser fixtures prevented changes to real accounts or expenses.

Responsive checks covered 18 reference and 60 application viewport/text combinations across the matrix in note 014, including 200% root text and landscape. Screenshot review found and led to fixes for long-heading overflow and password controls that left too little input reading room. The final layout checks, focus/skip navigation, reduced-motion/light-theme behavior, and measured text/control contrast passed. The reference page, fixture copy, and reference stylesheet were absent from production assets. Documentation links and code review passed. This is browser-emulation evidence; the physical iPhone/Safari/VoiceOver follow-up described in note 014 remains applicable.

## Protecting the development reference

A development-only route is not automatically an authenticated route. Selecting the reference in `main.tsx` bypassed the guard in `App`; the owner's access requirement moved route selection inside `App`. Signed-out deep links render login rather than loading the reference, and successful login returns to the requested reference. The development header provides client-side navigation so changing pages does not discard the in-memory token. Browser Back/Forward, Back to today, and logout follow the same application flow.

`DesignSystemRoute` verifies the session through the existing authenticated `GET /api/auth/me` endpoint before mounting the examples. A rejected token returns to login; an unavailable check shows retry without exposing the examples. Checks repeat when the tab becomes visible and every minute, matching the app's bounded session-refresh approach rather than treating a nonempty token string as permanently valid. A completed request from an abandoned route cannot restore access after logout. These are UI access checks; the backend still owns credential validation, and Vite's source modules are ordinary frontend development assets, not secret storage.

The API check belongs to the route gate, not the local demo controls. No role system, token persistence, or new authentication endpoint was added. Try an expired token or an offline session check: neither should display the reference. Then retry after restoring connectivity and verify that Back to today preserves your session.

The authentication correction passed all 25 frontend behavior tests, production build, lint, and code review. Playwright MCP confirmed signed-out visits do not load the reference module and login continuation waits for successful session verification. Unavailable or rejected checks do not expose examples, and retry/logout/reload/history work correctly. The updated reference/today headers passed 36 viewport/text combinations, including phones, landscape, desktop, and 200% text; keyboard navigation and visible focus were also checked. Sample API responses were intercepted locally, without modifying real accounts.
