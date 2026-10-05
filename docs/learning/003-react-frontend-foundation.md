# Learning note 003: The empty React frontend

## Each tool has a different job

| Tool | Role in this project | Familiar backend comparison |
| --- | --- | --- |
| React | Builds the UI from components and updates it as state changes | Presentation framework |
| TypeScript | Checks JavaScript types before the app runs | C# compiler type checking |
| Vite | Serves modules during development and bundles production assets | Build and development tooling |
| npm | Installs packages and runs the scripts in `package.json` | NuGet plus named build commands |
| Tailwind CSS | Generates styling utilities used in JSX | Styling system |
| HeroUI | Provides reusable accessible UI components and their styles | Component toolkit |
| Oxlint | Checks source for suspicious patterns | Static analyzer |
| Aspire | Starts the frontend process alongside the API | Local application composition |

TypeScript types disappear from the emitted JavaScript. They cannot validate an untrusted API response at runtime. We will consider runtime validation when the frontend consumes its first API contract.

## How the page starts

`index.html` defines the document and a `root` element. `src/main.tsx` attaches React to that element, imports global CSS, and renders `App` under `StrictMode`. `src/App.tsx` contains the placeholder UI.

StrictMode helps expose problematic component behavior during development. Components should render predictably and avoid changing external state during rendering.

`vite.config.ts` activates the React and Tailwind plugins. CSS imports Tailwind first and HeroUI second, matching the [HeroUI quick-start guide](https://heroui.com/docs/react/getting-started/quick-start). HeroUI v3 does not need a global provider. Product components will be added when we implement a screen.

## Package versions and the lock file

`package.json` describes dependencies and scripts. `package-lock.json` records the exact resolved dependency graph. `npm install` can update that graph; `npm ci` installs the recorded graph and fails when it disagrees with `package.json`.

Commit the lock file, but keep `node_modules` and generated `dist` assets out of Git. The backend's `Directory.Packages.props` manages NuGet dependencies; it does not manage npm packages.

## Development versus production

`npm run dev` starts Vite with fast module updates. `npm run build` first checks TypeScript, then produces static assets under `dist`. `npm run preview` is a local way to inspect those assets; it is not our production deployment strategy. See the [Vite guide](https://vite.dev/guide/).

Aspire starts the development server using `AddViteApp`, automatically assigning the development endpoint. Its npm installer uses `ci`, and its health check requests `/`. The frontend does not yet request the API, so there is no API URL, proxy, or CORS policy to configure here.

The API already exports OpenTelemetry. The frontend currently contributes process logs and resource status to Aspire; instrumenting browser interactions is a separate task.

## Check your understanding

1. Why can TypeScript accept code whose API response is invalid at runtime?
2. What does `npm ci` guarantee that a dependency version range alone cannot?
3. Why do we commit the lock file but exclude `node_modules`?
4. How does a Vite development server differ from the production bundle?
5. Why does a mobile-friendly browser app still need a separate decision for native iOS packaging?
