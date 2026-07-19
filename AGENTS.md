# AGENTS.md

## Cursor Cloud specific instructions

LexiLand is a single Vite + React 19 SPA (vocabulary learning app). It is **local-first**: the full MVP runs against browser `localStorage` with **zero external services**, so no database, auth, or AI service is needed to develop or test core flows.

### Services

| Service | Required? | Run / Notes |
| --- | --- | --- |
| Vite dev server | Yes | `npm run dev` (serves the SPA on port `5173`; add `-- --host` to expose). Also mounts the `/api/*` serverless handlers locally via the `localApiPlugin` in `vite.config.js`. |
| Supabase (auth + cloud sync + shared wordbase) | Optional | Activates only when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set in `.env.local`. Without them the app falls back to `localStorage`. |
| Agnes AI (AI Fill, photo extraction, memory tips/images) | Optional | The `/api/*` handlers need server-side `AGNES_API_KEY` (see `.env.example`). Without it the AI buttons fail but everything else works. |

### Lint / Test / Build / Run

- There is **no lint script and no automated test framework** configured. `package.json` only defines `dev`, `build`, and `preview`. Do not look for `npm test`/`npm run lint`; testing is manual (exercise routes in the browser).
- Build: `npm run build` (output to `dist/`).
- Run (dev): `npm run dev`. Preview a production build with `npm run preview`.

### Notes

- Optional env vars go in `.env.local` (never commit real keys); see `.env.example`. `VITE_`-prefixed vars are client-exposed; `AGNES_*` are server-side only and must NOT use a `VITE_` prefix.
- App data lives in `localStorage` under key `lexiland.words.v1`; clearing browser storage wipes saved words when not signed into Supabase.
- Routes include the main pages plus six mini-games under `/games/*`.
