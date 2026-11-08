# PRD: User currency and time-zone preferences

**Date**: 2026-11-08
**Status**: Draft

## Goal

Let each PocketLedger user choose their time zone and record expenses in PLN, BYN (Belarusian ruble), USD, or EUR without repeatedly selecting the same currency. Preserve recorded amounts, currencies, and purchase dates when preferences change, and show separate totals so different currencies are never added together as if they were equivalent. Deliver Settings and a basic expense-entry form using the existing PocketLedger design.

Phase 1 now implements account-owned time-zone Settings and a currency-neutral daily summary, while expense storage remains PLN-only. Currency-bearing Money/storage, remembered currencies, currency editing and expense-entry UI remain later phases. See [learning note 024](learning/024-account-time-zone-settings.md) for delivered scope and verification; the full milestone criteria below are not yet all complete.

## User scenarios

- A new or existing user opens Settings for the first time -> their initial currency is PLN and time zone is Europe/Warsaw; no mandatory onboarding interrupts access.
- A user saves a different default currency or time zone in Settings -> subsequent activity uses the saved preferences, including after logout, login, and use on another browser.
- A user opens the basic expense form -> the currency is already selected from their remembered default, and the purchase date defaults to today in their saved time zone.
- A user records 12.34 EUR -> the expense retains EUR and its entered purchase date; the next new expense starts in EUR without another currency-selection step.
- A user opens the currency picker after using EUR, then USD -> USD appears first, EUR next, followed by currencies they have not recently selected. Each supported currency appears once and can be identified by its code and name.
- A user selects BYN but cancels or fails to save an expense -> their existing remembered currency and recent-currency order remain unchanged.
- A user records 10.00 PLN and 5.00 EUR on the same purchase date -> today's spending shows separate PLN and EUR totals, with no combined monetary total or exchange conversion.
- A user changes the default from PLN to USD -> an existing 100.00 PLN expense remains 100.00 PLN; it is neither converted nor relabelled as USD.
- A user changes time zone -> the meaning of today changes for subsequent activity, while saved purchase dates remain unchanged. A different date may now be today's date, so the selected daily summary can change without rewriting any expense.
- A user explicitly edits or deletes an expense through the existing expense API -> the existing correction behavior remains available; changing preferences alone never performs an expense edit or deletion.
- A user experiences a failed Settings or expense save -> clear feedback and a retry path preserve their entered non-secret values, and no success or changed preference is reported before persistence succeeds.

## Scope

- Support exactly these currencies in this milestone: Polish złoty (PLN), Belarusian ruble (BYN), US dollar (USD), and euro (EUR). All four use two fractional decimal digits.
- Give each account a persistent default currency, time zone, and recent-currency ordering. Keep these financial preferences independent of identity-provider account administration.
- Initially use PLN and Europe/Warsaw for both existing users and newly provisioned users. Preserve existing expense data; no reset or new account registration is required.
- Add an authenticated Settings screen, reachable from the daily spending page, with editable default currency and time zone. Save changes explicitly, show success/failure feedback, and provide a route back to today's spending.
- Allow selection of supported named regional time zones, including Europe/Warsaw and zones outside Poland. Apply each zone's seasonal clock changes; do not treat a fixed UTC offset as a regional time zone. A separate country preference is not required.
- Add a basic authenticated expense-entry form reachable from today's spending. Include amount, currency, purchase date, free-text category, optional note, and an explicit allowance classification, matching the existing expense rules. No extra payee, bank, location, or account fields are required.
- Preselect the default currency and allow overriding it per expense. A successful new expense save makes that currency the remembered default for future new expenses; an explicit Settings currency save also changes that default. Opening the picker, failed saves, and cancelled forms do not change it.
- Order the currency picker by the user's most recently committed selections first, newest first, followed by all remaining supported currencies. A committed selection is the currency of a successfully created expense or an explicitly saved currency preference. Do not insert duplicates, globally alphabetize away the recent group, or reorder items merely because a picker was opened. Retain recent usage of all four supported currencies; other users have independent histories.
- Keep an open expense draft's amount, currency, and purchase date intact when preferences change elsewhere. A successful preference change must not silently reinterpret an amount already entered in a form. Explicitly choosing a different currency on a new draft is the user's designation of that amount, not an exchange-rate conversion.
- Use the user's saved time zone to determine today's date, the new-expense date default, future-date validation, and the daily spending screen. Server location and browser/device time-zone settings must not override the saved preference.
- Preserve a recorded expense's currency, exact amount, and purchase date across all preference changes. Existing expenses are PLN with their existing purchase dates; no timestamps or different historical dates are inferred.
- Return and display separate totals per currency for the selected current date. Include every currency with expenses on that date, even if it differs from the current default. With no expenses, show zero in the current default currency and the existing empty-day message; loading/failure must not masquerade as zero.
- Preserve the current edit/delete API capabilities. An existing expense retains its stored currency when opened/read or when its other details are corrected; a different user default must not silently replace it. An intentional expense correction remains distinct from a preference change. Editing/deleting an existing expense does not update the remembered default or recent-currency order.
- Update fixed PLN/Warsaw terminology in affected domain behavior, expense contracts, persistence, validation, summaries, formatting, and reference examples. Currency-specific names such as “grosz” must not describe USD, EUR, or BYN amounts. Display currency codes wherever symbols alone would be ambiguous.

## Not in scope

- Exchange rates, currency conversion, a base-currency valuation, or a combined total across currencies.
- Currencies beyond PLN, BYN, USD, and EUR; cryptocurrency; or currencies with different fractional precision.
- Changing the interface language, a separate country preference, or a full locale-preferences system. Preserve the current English interface and existing formatting conventions where compatible with clear currency identification.
- Transaction timestamps, automatic travel/location detection, or shifting recorded purchase dates after a time-zone change.
- An append-only expense ledger, revision/audit history, or disabling the current explicit edit/delete capabilities. “Immutable history” here means that preference changes do not rewrite expense records.
- A full expense-history browser or edit/delete UI; this milestone adds a basic creation form and retains existing API correction capabilities.
- Rolling allowance calculation, allowance screens, or converting/reinterpreting the planned 50.00 PLN allowance into other currencies. Those future rules need their own requirements.
- Redesigning hosted authentication, changing Keycloak ownership of credentials, account linking, or resetting existing identity/application data.

## Technical constraints

- Follow the modular monolith and framework-independent domain boundaries. Preserve checked exact monetary arithmetic, positive expense amounts, stable IDs/ownership, category/note rules, and explicit allowance classification. Money and all expense projections must retain enough currency identity to prevent invalid cross-currency arithmetic.
- Preserve integer minor-unit precision through storage, API transport, aggregation, and display, including totals beyond JavaScript's safe integer range. For these four currencies, 12.34 represents 1,234 minor units; reject fractions smaller than one minor unit rather than silently rounding them. An integer labelled `grosz` cannot become a generic foreign-currency amount without an explicit contract change.
- Validate supported currency codes and regional time-zone identifiers at the application boundary. Invalid preference/expense requests must leave stored preferences, expenses, and recent-currency order unchanged.
- Time-zone preferences define the current business calendar, while expenses remain date-based records. At the same instant two accounts may have different values of today. A zone change can make a previously valid recorded purchase date later than the new local today; it must not invalidate or delete the existing record. New expenses and explicit purchase-date changes must satisfy the non-future rule in the active zone; corrections to other fields must not force a historical date rewrite.
- Preference changes must be isolated to the authenticated owner. Retain cookie-session authorization, antiforgery requirements for mutations, foreign-expense NotFound behavior, no-store responses, and existing session-security guarantees.
- Preserve existing account/expense IDs, owner relationships, integer amounts, dates, and data across migration and restarts. Introducing explicit currency metadata for legacy expenses must identify them as PLN without numerical conversion or loss of precision. Contract changes require updating all maintained clients, examples, tests, and consumers together.
- A successful expense save and its remembered-currency effect must have a consistent observable result; avoid duplicate expenses or misleading default changes on failure/retry. Do not claim a rejected save changed the account's default.
- Keep React/TypeScript, HeroUI v3, Tailwind CSS v4, .NET 10, PostgreSQL, and the existing Aspire workflow. Preserve the [design guide](design/README.md), phone-first interaction, light theme, shared tokens/components, scalable text, focus behavior, and keyboard/assistive-technology access.
- Future implementation must update the affected README, agent instructions, [domain model](domain-model.md), design/reference examples, learning notes, diagrams, and consequential ADRs. Preserve historical decision rationale and mark replaced currency/calendar decisions as superseded where appropriate.
- Follow the agreed test-first workflow: before each applicable implementation phase, write/run executable E2E acceptance scenarios against the preceding working state, record expected behavioral failures, and rerun the same scenarios plus regressions to green afterward. Already-green scenarios remain regressions; blocked fixtures/infrastructure are not behavioral red results. This PRD itself does not implement those tests.

## Definition of done

- [ ] Existing and newly provisioned accounts receive PLN and Europe/Warsaw as initial defaults without mandatory onboarding. Existing account IDs, expense IDs/owners, amounts, and purchase dates survive upgrade; all old expenses are explicitly identifiable as PLN.
- [ ] A signed-in user can open Settings, choose any of PLN/BYN/USD/EUR and a supported regional time zone, save, see confirmation, and return to today's spending. Saved values persist across reload, logout/login, restart, and another browser session for that account.
- [ ] Another account cannot read/change those preferences or recent usage. Unsupported currency/time-zone values and unauthenticated/forged mutations are rejected without partial updates.
- [ ] A user can open the basic expense-entry form from today's spending, enter all required purchase details with currency already selected, save successfully, see confirmation, and return to an accurate daily summary. An optional note can be left empty; the allowance flag requires an explicit value, including false.
- [ ] A successful new expense in EUR makes EUR the next form's default across sessions. A later saved USD expense makes USD the default, with USD then EUR before remaining currencies in the picker. Each of the four currencies appears once, labelled with code/name; Settings uses the same recent-first behavior.
- [ ] Saving a currency explicitly in Settings moves it to the front and makes it the default. Opening, cancelling, or failing an expense/preference save leaves the prior default and recent order unchanged. Editing/deleting an older expense does not change either value.
- [ ] A draft already containing 12.34 EUR remains 12.34 EUR with its entered date after preferences change elsewhere. Preferences do not silently convert or relabel draft values.
- [ ] Creating expenses in each supported currency preserves their exact values. Inputs below minor-unit precision are rejected; integer boundary/overflow and totals beyond JavaScript's safe integer range retain existing exactness guarantees.
- [ ] Recording 10.00 PLN and 5.00 EUR for today's date shows two labelled totals, never a combined 15.00 total. Expenses in non-default currencies remain included; same-currency amounts sum exactly. An empty day shows zero in the default currency, while loading/error states remain distinct from zero.
- [ ] Changing PLN to BYN/USD/EUR and changing time zone leave every saved expense's amount, currency, purchase date, ID, owner, category, note, and allowance flag unchanged. Tests compare stored/read historical records before and after preference changes.
- [ ] Two users in zones on opposite sides of a date boundary receive their respective local today/date default and matching daily summaries at the same instant. Tests cover midnight and daylight-saving transitions and prove that differing server/browser zones do not override saved settings.
- [ ] A time-zone change may switch the date shown by today's summary but does not shift any saved purchase date. If an existing purchase date is now later than local today, the record remains readable/deletable and its non-date details remain correctable; new future dates and explicit changes to a future purchase date are rejected.
- [ ] Existing expense reads and explicit edit/delete API operations retain owner isolation. Non-currency edits retain the expense's original currency regardless of the default; an explicit permitted amount/currency correction affects that expense only. Preference changes never invoke expense correction/deletion.
- [ ] Daily-summary text, displayed dates, monetary labels, validation messages, request/response examples, and production behavior use the active account/expense context. PLN/Warsaw remain initial defaults and valid examples rather than universal runtime assumptions; no currency is inferred from the preference when reading an already recorded expense.
- [ ] Settings and expense forms exercise loading, invalid input, pending/double-submission prevention, save success, network/API failure, retry, cancellation, and expired-session behavior. A failed/uncertain response never displays false success or silently discards entered values.
- [ ] Applicable real-browser E2E scenarios have recorded baseline failures or justified already-green results before their implementation phase and passing results afterward. Real PostgreSQL integration tests verify upgrade preservation, exact per-currency aggregation, owner isolation, preference persistence, and historical invariance; mocks alone are not acceptance evidence.
- [ ] Frontend build/lint/behavior tests, relevant backend build/behavior/integration tests and formatting checks pass. Final Playwright MCP validation and project-local UI/UX review find no unresolved issues across the [existing mobile/accessibility matrix](learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits), including large/small phones, landscape, desktop, short viewport, 200% text, keyboard/focus, contrast, and touch targets; physical iPhone limits are recorded separately.
- [ ] Documentation, supported-currency lists, maintained API examples, design-reference cases, learning notes/exercises, and ADR supersession links match the completed feature. Planned allowance functionality remains explicitly separate.
