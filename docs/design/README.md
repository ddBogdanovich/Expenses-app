# PocketLedger design guide

This is the product design contract for the implemented browser application. Read it before creating or changing a screen. It documents the current visual direction and working patterns; it does not authorize new features.

## Sources of truth

- This guide owns design intent, usage rules, and product language.
- [`tokens.css`](../../src/PocketLedger.Web/src/styles/tokens.css) owns exact theme values and shared measurements. Use its semantic variables; do not maintain another palette or token table in TypeScript.
- [`index.css`](../../src/PocketLedger.Web/src/index.css) implements application patterns and the compact layout policy.
- [`ui/`](../../src/PocketLedger.Web/src/ui/) contains shared presentation components. [`SpendingSummary`](../../src/PocketLedger.Web/src/features/today/SpendingSummary.tsx) stays with the feature whose meaning it presents.
- `/design-system`, available to signed-in users through Vite **development mode only**, shows working examples made from the same components and styles. Its examples use local sample data and make no API calls. The route requires a session verified through `/api/auth/me`, rechecked on visibility and every minute; failed verification hides the examples and offers retry, while rejected credentials return to login. The reference is excluded from the production bundle. `npm run preview` serves production and does not expose it.

When changing a design decision, update its implementation, this guide, and affected examples together. Repository instructions and explicit user decisions take precedence. Generic skill suggestions must fit this guide; do not generate a replacement visual direction for each new page. An intentional exception should be documented here with its reason and scope.

## Identity and voice

PocketLedger makes everyday spending easier to understand. Its character is calm, clear, practical, and encouraging without judging the person or their purchases. Preserve forest green, warm off-white backgrounds, white cards, restrained borders, and generous space. Use the existing [`Brand`](../../src/PocketLedger.Web/src/Brand.tsx) wordmark and monogram instead of reconstructing them on each page. The monogram is a shared SVG asset (`public/pocketledger-mark.svg`), also used as the favicon, so its shape does not depend on installed fonts. Keep its fixed colors/proportions in that asset; do not duplicate it in CSS or page markup. A separate marketing logo/brandbook is outside the current scope.

Use plain English for the current UI. Give actions concrete names: “Log in”, “Create account”, “Try again”. Explain errors with a useful next step. Avoid moral judgements, celebratory spending scores, and implementation terms such as JWT or projection in product copy. Existing account-screen promotional text is optional supporting content, not a template for every authenticated page.

Good: “No expenses recorded today.” Avoid: “Perfect! You spent nothing.”

Good: “We couldn’t load today’s spending.” Avoid: “Something went wrong” without a recovery action.

## Theme and typography

Light mode is the only implemented theme. `index.html` explicitly selects it; device dark-mode preferences must not create a partial dark theme. Add dark mode only with a complete palette, state review, and browser verification.

| Semantic role | Token | Use |
| --- | --- | --- |
| Page / card | `--background`, `--surface` | Warm canvas and white content surfaces |
| Body / supporting text | `--foreground`, `--muted` | Primary reading and explanatory text |
| Primary action | `--accent`, `--accent-foreground`, `--accent-hover` | Forest-green actions and their readable foreground |
| Secondary action | `--default`, `--default-foreground`, `--default-hover` | Lower-emphasis controls |
| Input | `--field-background`, `--field-border`, `--field-foreground` | Editable surfaces and meaningful boundaries |
| Error | `--danger`, `--danger-soft` | Validation, request failures, destructive actions |
| Information | `--info`, `--info-soft` | Neutral notices such as session expiration |
| Success | `--success-soft-foreground`, `--success-soft` | Confirmation of completed actions |
| Focus | `--focus` | Visible keyboard focus on light surfaces |
| Text on green | `--accent-foreground`, `--on-accent-muted` | Summary values and supporting text |

Tokens map directly to HeroUI v3's semantic theme variables. An uncustomized HeroUI primary button must fit the same theme as an account-page action. Use `variant="secondary"`, `"outline"`, `"ghost"`, or `"danger"` to express purpose. Do not apply unrelated button background colors in feature code.

Typography uses the native **system sans-serif stack**, with no remote font requests or font package. Previously CSS named Inter without loading it; we now explicitly accept native platform font differences. A future decision to bundle a brand font must include its loading and layout costs.

Use the `--text-*`, `--weight-*`, `--leading-*`, and `--tracking-heading` roles. Body and form labels use `--text-body`; help and errors use `--text-small`; captions/eyebrows use `--text-caption`. Essential instructions must not be captions. Page headings scale with the viewport; the large account introduction is decorative supporting content. Monetary values use tabular numerals and may wrap for extremely large totals.

Use normal-text contrast of at least 4.5:1, large-text contrast of at least 3:1, and meaningful control boundaries/focus indicators of at least 3:1 against adjacent colors. Decorative dividers do not replace input boundaries. Check the composed color pair, including hover and focus states. Disabled controls still need recognizable labels, although disabled content is exempt from WCAG contrast requirements.

## Space, shape, and responsive layout

Use the named `--space-*` scale, based on quarter-rem increments, rather than adding arbitrary page-specific gaps. Larger steps are intentional layout choices. Use `--radius-control` for controls, `--radius-card` for cards, `--radius-small` for notices, and `--shadow-card` for restrained elevation.

`PageShell` provides the shared header, safe-area-aware gutters, optional footer, and a skip link. Its children supply one `<main id="main-content" tabIndex={-1}>`. Use one visible `h1`, then sequential section headings. Keep DOM reading order aligned with visual order. Place session/navigation actions in the header and task actions near their content.

Use `.account-layout` and `.account-card` for account forms only. Desktop account pages can show the supporting introduction beside the form. `.today-main` uses `--reading-width` for a focused daily overview. New authenticated screens should start with the shell and their own task-appropriate content, not copied registration markup.

A named `page` container additionally collapses account columns when its available content width is at most `47.5rem` (the existing 760px threshold at default text). This responds to enlarged root text: the 768px tablet at 200% must not retain a narrow form beside the introduction. Both the application and hosted preview compile the same rule.

The compact layout policy is width <=760 CSS px, or width <=1024px together with height <=540px. At compact sizes, account forms have one column and the introduction is hidden. At height <=540px, reduce vertical padding and keep content at the start. These literal media-query thresholds are documented here because native CSS variables cannot be used in media query conditions. Do not introduce slightly different copies of these breakpoints per page.

Use dynamic minimum viewport height and allow content to grow and scroll. Respect `env(safe-area-inset-*)` on each edge. Do not fix forms or primary submit actions to a viewport height that can be covered by a keyboard. Preserve input text at `max(16px, 1rem)` and scalable password-toggle clearance.

Narrow forms use a container query: below 16rem of available form width, the password visibility button moves to its own row so it cannot cover the input text. The threshold scales with browser text size. Compact horizontal gutters and card padding retain named pixel values to preserve reading room at 200% text; font sizes and touch targets still scale.

## Components and interaction recipes

| Pattern | Implementation | Rules |
| --- | --- | --- |
| Page frame | `PageShell` | Shared brand, skip link, gutters; page supplies the main landmark |
| Content card | `.surface-card` | White surface, shared radius/padding/elevation; page owns its content |
| Controls | HeroUI components directly | Keep semantics, `onPress`, accessible names, and native disabled/pending behavior |
| Primary account/form action | HeroUI `Button` + `.primary-action` | One primary action per task; stretches across its form |
| Form | HeroUI `Form` + `.ledger-form` | Compose `TextField`, visible `Label`, `Input.ledger-input`, optional `Description`, `FieldError` |
| Password | Existing account-page recipe | Preserve show/hide labels, pressed state, paste, autocomplete, and scaled input clearance |
| Notice | `Notice` | Choose `info`, `danger`, or `success` based on meaning |
| Daily total | `SpendingSummary` | Discriminated loading/error/ready state; fetching remains in `TodayPage` |

All buttons and standalone text links target at least `--touch-target` (48 CSS px at default text size). Inputs and primary form actions target `--control-height` (52px). Keep grouped controls separated and let labels wrap. Hover cannot be the only feedback; keep pressed and keyboard-focus states. Motion uses the feedback duration/easing tokens; respect reduced motion. No layout-shifting press scale is used.

Use plain text labels before adding icons. The current decorative arrows/checkmark are retained; do not invent more Unicode or emoji icons. When a new icon is necessary, use consistent SVG geometry (24×24 view box, 2-unit stroke for outline icons) and hide it from assistive technology when the adjacent text already names its purpose. Icon-only controls require an accessible name and the full touch target. Choose a broader icon library only when concrete use justifies a dependency.

Validation appears near the field; a form-level request failure supplies context or recovery. Preserve entered data on failure. Disable repeated submissions and show a pending action label. Editing a field clears the relevant server error without hiding an unrelated field's error. Never replace a recoverable error with success-looking content.

`Notice` uses `alert` for dynamic errors and `status` for dynamic information/success by default. Use `announce={false}` for static documentation examples to avoid unnecessary live regions. Do not encode meaning only in color. On a completed registration or page transition, move focus to the meaningful new content without an unexpected scroll. Do not focus every background refresh.

## Money and business language

PLN is the only currency. Use the existing `formatTotal` formatter for daily totals: Polish formatting, two grosz digits, and the zł currency mark. Keep integer-grosz strings/BigInt precise; do not convert totals through JavaScript floating-point numbers. Dates represent the Warsaw business calendar; use an explicit timezone when displaying the API's date-only value. The current display language for full dates is English (en-GB).

“Today’s spending” includes all owned purchases dated today in Warsaw. It is not a remaining balance. An empty day shows zero and “No expenses recorded today.” Loading shows text, and failure shows an explanation plus retry; neither is zero. Very large totals grow/wrap rather than being clipped or abbreviated into an inaccurate amount.

Rolling allowance and negative available-balance screens are **planned**, not implemented. Future work must distinguish recorded spending, daily allowance, and available allowance, and describe a negative balance factually. Do not color a spending total red merely because a person spent money. These requirements do not introduce allowance calculations into the existing summary.

## Adding or changing a screen

1. Read this guide, frontend `AGENTS.md`, relevant feature code, and the domain rules. Sign in and use the development-only “Design reference” header action. A signed-out direct visit to `/design-system` goes to login, then returns to the reference after authentication. Use “Back to today” to retain the in-memory session; a full-page reload requires login again.
2. Reuse tokens, HeroUI controls, and existing product patterns. Keep feature behavior in its feature; extract a shared component when the same meaningful pattern is reused.
3. Define loading, empty, error, ready/success, disabled, and pending behavior where applicable. Do not invent an unnecessary state or feature to fill a template.
4. Add an example for a new reusable pattern and document its usage. Avoid speculative wrappers around every HeroUI component or a separate distributable component package.
5. Run frontend build, lint, and behavior tests. Perform Playwright MCP and UI/UX skill review with desktop, phone, landscape, larger-text, focus, contrast, and affected state checks. Repeat after fixes.

Use the [mobile verification matrix](../learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits). Browser screenshots are review evidence, not a replacement for semantic checks or physical iPhone follow-up. Store temporary browser artifacts in ignored `output/playwright/`.

## Hosted authentication preview

Development login offers **Try Keycloak preview**. Phase 1 uses native Keycloak templates under `infra/keycloak/themes/pocketledger`, with the same compiled application CSS/tokens and shared SVG. Credentials submit only to provider action URLs. Branded seeded-user login and token-free logout confirmation are delivered here. Phase 2 adds provider registration policy; Phase 3 adds the branded two-field registration form and trusted success confirmation. The existing application registration and confirmation remain the default. Regenerate resources with `npm run build:keycloak-theme` before Aspire startup or after shared CSS changes; never maintain another palette. Review hosted labels, password visibility, pending/error states, and account layout alongside the app. The preview route is development-only, and `/design-system` continues to use the default bearer flow until Phase 5.

## Hosted registration policy boundary

Phase 2 implements the provider-side email/password contract. Phase 3 replaces inherited registration presentation with the existing account recipe: email/password only, the same heading/help/footer, accessible labels and connected field errors, retained email, password visibility, and native provider action URLs. Login/register links keep the same provider transaction. Pending forms announce busy state and block duplicate submissions; credentials become readonly so native POST values remain present. Browser-history restoration resets pending controls.

The provider renders “You’re all set.” only for a newly created user matching its server-side transaction note. The displayed stored email confirms creation, not email ownership. “View today’s spending” completes the existing code flow; no second credential prompt appears. The ordinary app confirmation remains in `AccountPage`; the provider confirmation lives in `registration-confirmation.ftl`. Branded provider errors restart through the approved configured client base URL; unknown clients receive reopen instructions.

Native templates use the packaged production classes and required state attributes (for example `data-visible` on field errors), without another palette or a React runtime. Theme packaging checks password-limit guidance against the realm policy. No reusable app component changed, so `/design-system` examples remain the same. See [ADR 0016](../decisions/0016-hosted-registration-confirmation.md) and [learning note 018](../learning/018-hosted-authentication-experience.md).
