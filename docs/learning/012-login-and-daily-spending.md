# Login and daily spending

> Time-zone Phase 1 update: [learning note 024](024-account-time-zone-settings.md) describes the current account-aware calendar, unchanged-date correction rule, Settings and currency-labelled summary contract. Warsaw/scalar-total examples below record the earlier milestone.
> Historical milestone note. [Learning note 022](022-credential-retirement.md) describes the current backend: Keycloak-only credentials, default protected cookie sessions, no first-party JWT endpoints/signing key or password storage, and retained legacy owner/expense rows. Code paths and commands below describing legacy credentials record the earlier implementation and are not current setup instructions.


## Follow one login

Open `/` in a fresh tab. The app sends you to `/login`, where your password manager can fill the email and current password. The form sends both to `POST /api/auth/login`. A successful response supplies the token. React keeps it in memory, replaces the login URL with `/`, and requests `GET /api/expenses/today` with a bearer authorization header. Refreshing the page or logging out clears that browser session. Registration at `/register` offers the same main page from its confirmation screen.

The browser guard controls navigation. The API independently checks the JWT signature and lifetime and obtains the owner ID from its subject. A rejected token returns the user to login. A temporary network failure offers a retry. Showing zero on a failed request would misrepresent what the user spent.

## Follow one amount

A read projection answers a particular question using only the fields needed for the answer. Here `TodayExpenseHandler` supplies the authenticated account and the business calendar's Warsaw date to `IExpenseQueries.TotalGroszAsync`. PostgreSQL filters on those two indexed columns and sums the stored integer amounts. The result for an empty day is zero. A qualifying lunch of 12.30 zł and a non-qualifying ticket of 8.05 zł give **20,35 zł** on the main page.

PostgreSQL widens the sum of bigint values to numeric. The API returns the integer digits as a string so even a total beyond JavaScript’s safe integer range reaches the browser intact. The browser uses BigInt for the zloty and grosz components and Intl.NumberFormat for Polish currency presentation. Downloading the expense list to add it in React would transfer the account’s history and duplicate calendar logic.

## Try it

1. Log in and open the browser network panel. Which request identifies the business date? Where does the owner ID come from?
2. Use the expense API to backdate the ticket to yesterday. Return to the tab. What changes on the main page?
3. Call the daily-total endpoint without a token. Compare the response with an authenticated account that has no spending today.

## Presentation reuse

`TodayPage` retains fetching, refresh, and session behavior. `SpendingSummary` renders loading/error/ready states, precise formatted PLN, and retry. The same feature-owned component appears in the development design reference; `PageShell` supplies the shared page frame. See the [design guide](../design/README.md) and [Learning note 015](015-frontend-design-system.md).

## Phase 5 update

The implementation details above record the original milestone. [Learning note 021](021-default-browser-session.md) describes the current browser: hosted Keycloak entry, cookie-session restoration in `App`, protected reference access, recovery and logout. Legacy frontend credential forms and token state are removed; legacy backend retirement remains Phase 6. Preserve the historical verification evidence above.
