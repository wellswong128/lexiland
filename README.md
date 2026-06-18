# 力思樂園 LexiLand

力思樂園 LexiLand is an English vocabulary learning app built with React. Play for vocabulary power. Learn for English power. It helps users save English words, review them with flashcards, test themselves with quizzes, collect mistakes, and remember words through simple spaced repetition.

The first version uses `localStorage` so the app can be built quickly without a backend. A future version will use Supabase for accounts, cloud sync, and multi-device access.

## MVP Features

- Add English vocabulary words.
- View a saved word list.
- Review words with flashcards.
- Take a simple quiz.
- Save incorrect answers in a mistake notebook.
- Use simple spaced repetition.
- Import vocabulary data from JSON.
- Prepare for future AI auto-completion.

## Tech Stack

- React
- Vite
- Tailwind CSS
- React Router
- localStorage for the MVP
- Supabase later
- Vercel deployment

## Project Documents

- `PROJECT_PLAN.md`: product goal, MVP scope, pages, phases, and engineering principles.
- `TASKS.md`: beginner-friendly task list ordered from setup to deployment.
- `DATA_MODEL.md`: localStorage data model and future Supabase table design.
- `PROMPTS.md`: reusable Cursor prompts for development, debugging, refactoring, and future features.
- `README.md`: project overview and setup notes.

## Planned Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Home | `/` | App overview and quick actions. |
| Word List | `/words` | Browse, search, edit, and delete words. |
| Add Word | `/words/new` | Add a new vocabulary word. |
| Word Detail | `/words/:id` | View and edit one word. |
| Flashcards | `/review/flashcards` | Review due words. |
| Quiz | `/review/quiz` | Test word knowledge. |
| Mistakes | `/mistakes` | Review incorrect answers. |
| Import | `/import` | Import words from JSON. |
| Settings | `/settings` | Manage local data and future sync settings. |

## Getting Started

Install dependencies and start the local development server.

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Development Order

1. Create the Vite React project.
2. Add Tailwind CSS.
3. Add React Router.
4. Create the folder structure.
5. Implement the word data model.
6. Implement localStorage helpers.
7. Build Add Word and Word List.
8. Build Flashcards and Quiz.
9. Build Mistake Notebook.
10. Build JSON Import.
11. Polish, debug, and deploy.
12. Plan and implement Supabase later.

## localStorage Version

The MVP stores all words in the browser with this key:

```text
lexiland.words.v1
```

This makes the first version simple and fast to build. The tradeoff is that data stays in the same browser and can be lost if the user clears browser storage.

## Future Supabase Version

Supabase will be added after the localStorage MVP works.

Planned Supabase features:

- User sign up and login.
- Cloud word storage.
- Review history.
- Mistake tracking.
- Row Level Security so users can only access their own data.
- Possible local cache later for offline-friendly behavior.

Prepared Supabase files:

- `supabase/schema.sql`: tables, indexes, triggers, and Row Level Security policies.
- `.env.example`: required Vite environment variables.
- `src/lib/supabaseClient.js`: shared Supabase client helper.

Current data behavior:

- Signed-in users with Supabase env vars use Supabase for word reads and writes.
- Users without a Supabase session continue to use the localStorage fallback.
- The UI is kept mostly unchanged; sign in and sign out live on the Settings page.

Environment variables for the future Supabase version:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AUTH_REDIRECT_URL=https://learn.lexiland.cc
```

For Supabase magic link login, also set these in the Supabase dashboard under **Authentication → URL Configuration**:

- **Site URL:** `https://learn.lexiland.cc`
- **Redirect URLs:** `https://learn.lexiland.cc/**` and `http://localhost:5173/**`

### Cloudflare Email Service SMTP (required for magic links)

Supabase's built-in email service is limited. Use Cloudflare Email Service SMTP:

| Supabase field | Value |
|---|---|
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` |
| Username | `api_token` |
| Password | Cloudflare API token with **Email Sending: Edit** |
| Sender email | `no-reply@lexiland.cc` (must match a domain onboarded in Cloudflare **Email Sending**) |
| Sender name | `力思樂園` |

**Important:** `learn.lexiland.cc` is your app URL, but it is **not automatically authorized for sending**. Either:
1. **Onboard `learn.lexiland.cc`** in Cloudflare → Email Service → Email Sending, then use `no-reply@learn.lexiland.cc`, or
2. **Use the root domain** already onboarded (e.g. `no-reply@lexiland.cc`) in Supabase SMTP Sender email.

Apply automatically (requires Supabase access token + project ref):

```bash
SUPABASE_ACCESS_TOKEN=your_token \
SUPABASE_PROJECT_REF=your_project_ref \
CLOUDFLARE_API_TOKEN=your_cloudflare_token \
npm run configure:supabase-smtp
```

Also set in Vercel:

```bash
VITE_APP_URL=https://learn.lexiland.cc
```

Important:

- Do not use `http://localhost:3000` as the Site URL.
- If Gmail opens `localhost:3000` after login, Supabase Site URL or `VITE_AUTH_REDIRECT_URL` is still pointing to localhost.
- Request a new login link after fixing the URLs. Old magic links keep the old redirect target.

Do not commit real `.env` files or service role keys.

## Future AI Auto-Completion

AI auto-completion is available on the Add Word page through a Vercel serverless function using Agnes AI.

Current flow:

1. User types an English word.
2. User clicks `AI Fill`.
3. The app sends only the English word to `/api/complete-word`.
4. AI returns editable suggestions.
5. User reviews and confirms before saving.

Required server-side environment variables:

```bash
AGNES_API_KEY=your_agnes_api_key
AGNES_MODEL=agnes-2.0-flash
```

Important: `AGNES_API_KEY` must be configured in Vercel environment variables. Do not expose it with a `VITE_` prefix and do not store it in frontend code.

For local development, add the same server-side values to `.env.local`:

```bash
AGNES_API_KEY=your_agnes_api_key
AGNES_MODEL=agnes-2.0-flash
```

Then restart `npm run dev`. The Vite dev server includes a local `/api/complete-word` middleware so AI Fill works locally too.

## Deployment

The app is ready to deploy to Vercel after the production build succeeds.

Expected Vercel settings:

- Build command: `npm run build`
- Output directory: `dist`

This project includes `vercel.json` so React Router routes work after page refresh on Vercel.

Before deployment, run:

```bash
npm run build
```

Manual deployment steps:

1. Create a GitHub repository.
2. Push this project to GitHub.
3. Create a new Vercel project.
4. Import the GitHub repository.
5. Confirm Vercel detects Vite.
6. Confirm build command is `npm run build`.
7. Confirm output directory is `dist`.
8. Deploy.
9. Test `/`, `/words`, `/words/new`, `/review/flashcards`, `/review/quiz`, `/mistakes`, `/import`, and `/settings` on the deployed URL.

## Current Status

The localStorage MVP is implemented through JSON import, quiz, flashcards, mistakes, and basic settings.

```text
Next step: push to GitHub and deploy to Vercel.
```

