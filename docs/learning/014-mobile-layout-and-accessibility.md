# Mobile layout and accessibility

## Start with the daily task

Responsive design lets the same page adapt to its available space. PocketLedger retains its two-column introduction and form on desktop. At widths up to 760 CSS pixels, or up to 1024px when the viewport is at most 540px tall, the account form becomes the main content; the decorative introduction is hidden. The second condition covers landscape phones. Both account modes and the registration confirmation have one visible `h1`. This keeps a new user from scrolling through promotional text before entering an email on a phone.

CSS media queries solve this without device detection, extra React state, or an additional mobile application. A user-agent check would be brittle and would not account for rotation or window resizing. A native application could integrate more closely with iOS, but would add a separate UI and delivery process to maintain.

## Viewports and safe areas

CSS pixels describe layout space, rather than the hardware screen's pixel count. Test several widths instead of fixing the layout to one iPhone model. `index.html` uses `viewport-fit=cover`; `PageShell` / `.page-shell` then takes the maximum of its normal gutters and `env(safe-area-inset-*)` on every edge. The browser supplies those insets when needed to keep content clear of the camera area and home indicator, including landscape use.

`min-height: 100dvh` follows the dynamic viewport, which changes with browser chrome. Content can grow taller and scroll. A fixed `height: 100vh` could clip the form. The short-height media query reduces vertical spacing, and controls stay in normal document flow so a keyboard does not cover a fixed submit bar. Mobile keyboard behavior still depends on the browser; a reduced-height browser test cannot fully reproduce iOS's keyboard and visual viewport.

## Touch, readable text, and focus

`--touch-target` names the shared 48px minimum target size. Inputs and primary account actions are at least 52px high. The password button and account links have generous hit areas, and pressed actions provide feedback through HeroUI and the primary button's pressed background.

Inputs use `max(16px, 1rem)`: the baseline avoids the small-input zoom behavior in iOS, while `rem` allows larger browser text settings. Password padding scales with text so the Show/Hide button does not overlap the typed value. Email fields keep an email keyboard and password-manager autocomplete hints; password fields preserve paste and new/current-password autocomplete. `enterKeyHint` provides next/go keyboard labels where supported; it is a hint, not a replacement for the submit button or browser focus behavior.

Visible focus indicators support keyboard users. Success and daily-page focus use `preventScroll` to announce the new content without automatically scrolling the header away. Reduced-motion settings disable animation and transitions. The existing light design is explicitly declared with `color-scheme: light`, including when the device prefers dark mode; a designed dark theme remains future work.

The daily-total card reserves a minimum height while loading. It grows for large totals and wrapped dates rather than clipping content. An unavailable total retains its error and retry interaction instead of displaying zero.

## Verification and its limits

Use Playwright MCP with a mobile touch context to exercise registration, password visibility, duplicate-email errors, pending submission, success continuation, login failures, daily-total loading, retry, zero, a very large total, and logout. API fixtures make these browser states reproducible; they do not establish real API or database correctness. The existing frontend behavior tests cover the integration contract separately.

Review screenshots and inspect horizontal overflow, control sizes, focus order, and text contrast at 440×956, 430×932, 428×926, and 414×896, plus a small phone (375×812 and 320×568), landscape (956×440), tablet (768×1024), and desktop (1440×1000). Repeat at 200% root text size and with reduced motion. Check a short viewport (440×420) to confirm that the submit action can scroll into view. Browser artifacts are kept in the ignored `output/playwright/` directory.

Emulation is useful evidence about responsive layout, not proof of physical iPhone Safari behavior. On a real Pro Max, follow up with Safari portrait/landscape, expanded/collapsed browser chrome, the real keyboard, password-manager autofill, larger system text, pinch zoom, and VoiceOver. Confirm safe-area clearance there; Chromium's emulation does not reproduce iOS safe-area insets or VoiceOver.

## Exercise

1. Set the root font size to 200%. Why does a pixel-sized right padding fail beside a larger Show button, and why does `rem` help?
2. Open registration in landscape and focus the password. Can you scroll to Create account without dismissing the keyboard?
3. Explain why a spending request failure must offer retry rather than showing `0,00 zł`.

## Shared design foundation

These mobile requirements are incorporated into the [design guide](../design/README.md). Shared theme and measurement values now live in `src/PocketLedger.Web/src/styles/tokens.css`; account styles use `.account-layout`/`.account-card`, forms use `.ledger-form`/`.ledger-input`, and the daily total is rendered by `SpendingSummary`. The development-only `/design-system` page exercises these shared patterns. See [Learning note 015](015-frontend-design-system.md).

Narrow forms use a container query: below 16rem of available form width, the password visibility button moves to its own row so it cannot cover the input text. The threshold scales with browser text size. Compact horizontal gutters and card padding retain named pixel values to preserve reading room at 200% text; font sizes and touch targets still scale.

## Account layout at enlarged text

Phase 1 Keycloak review exposed a narrow two-column form at 768×1024 with 200% root text. `PageShell` now supplies the named `page` inline-size container; account columns collapse below `47.5rem` of available content. Unlike a viewport-only pixel breakpoint, the rem-based container threshold responds to root text enlargement. The normal 1440px desktop composition stays intact, and the same compiled rule serves native provider pages. Repeat the matrix for both hosted and application account screens after changes.
