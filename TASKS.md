# LexiLoop Tasks

This task list is designed for beginner-friendly development. Finish one small task, run the app, test it manually, then move to the next task.

## How To Use This File

1. Work from top to bottom.
2. Do not start many features at the same time.
3. After each task, run the app and check the result in the browser.
4. If something breaks, fix it before continuing.
5. Mark tasks as done only when the feature works after refresh.

## Phase 0: Understand The App

- [ ] Read `PROJECT_PLAN.md`.
- [ ] Read `DATA_MODEL.md`.
- [ ] Read this task list once from top to bottom.
- [ ] Decide the first UI language for the app: English, Traditional Chinese, or mixed.
- [ ] Prepare 5 to 10 sample words for testing.

## Phase 1: Create The React Project

- [x] Create a Vite React project in this folder.
- [x] Install project dependencies.
- [x] Start the development server.
- [x] Confirm the default Vite page works in the browser.
- [x] Remove unused starter UI.
- [x] Create a simple `App` component with the text `LexiLoop`.
- [x] Make sure the page still works after refresh.

Suggested commands:

```bash
npm create vite@latest . -- --template react
npm install
npm run dev
```

## Phase 2: Add Tailwind CSS

- [x] Install Tailwind CSS and related setup packages.
- [x] Create Tailwind config files if needed.
- [x] Import Tailwind styles in the main CSS file.
- [x] Add one Tailwind class to verify styling works.
- [x] Create a basic app layout with a max-width container.
- [x] Test the page on desktop and mobile browser width.

## Phase 3: Add React Router

- [x] Install `react-router-dom`.
- [x] Create a `routes` setup.
- [x] Add a shared layout with navigation links.
- [x] Create placeholder pages for Home, Word List, Add Word, Flashcards, Quiz, Mistakes, Import, and Settings.
- [x] Click every navigation link and confirm routes work.
- [x] Refresh each route and confirm the page still loads.

## Phase 4: Create The Folder Structure

- [x] Create `src/components`.
- [x] Create `src/pages`.
- [x] Create `src/features/words`.
- [x] Create `src/features/review`.
- [x] Create `src/features/import`.
- [x] Create `src/lib`.
- [x] Create `src/data`.
- [x] Move page components into `src/pages`.
- [x] Keep shared UI components in `src/components`.

Recommended structure:

```text
src/
  components/
  data/
  features/
    import/
    review/
    words/
  lib/
  pages/
  App.jsx
  main.jsx
  index.css
```

## Phase 5: Define The Word Data Model

- [x] Create a `src/features/words/wordTypes.js` file.
- [x] Add a documented example word object.
- [x] Create helper functions for generating IDs and dates.
- [x] Create a `createWord` helper that normalizes new word input.
- [x] Confirm every new word has `id`, `term`, `definition`, `createdAt`, and review fields.

## Phase 6: Build localStorage Helpers

- [x] Create `src/lib/storage.js`.
- [x] Add a storage key like `lexiloop.words.v1`.
- [x] Create `loadWords`.
- [x] Create `saveWords`.
- [x] Create `resetWords`.
- [x] Handle empty storage by returning an empty array.
- [x] Handle broken JSON with a safe fallback and a console warning.
- [x] Test by saving sample data manually.

## Phase 7: Build Word State Management

- [x] Create a custom hook named `useWords`.
- [x] Load words from localStorage when the app starts.
- [x] Save words to localStorage whenever words change.
- [x] Add `addWord`.
- [x] Add `updateWord`.
- [x] Add `deleteWord`.
- [x] Add `importWords`.
- [x] Add `resetAllWords`.
- [x] Pass this data through context or a simple top-level state.

Beginner note: start with top-level state in `App.jsx`. Move to Context only when passing props becomes annoying.

## Phase 8: Add Word Feature

- [x] Build the Add Word page form.
- [x] Add fields for English word and definition.
- [x] Add optional fields for pronunciation, part of speech, example sentence, translation, and tags.
- [x] Validate that word and definition are required.
- [x] Show a helpful error if required fields are empty.
- [x] Save the word on submit.
- [x] Redirect to the word list after saving.
- [ ] Confirm the word remains after page refresh.

## Phase 9: Word List Feature

- [x] Show all saved words on the Word List page.
- [x] Show empty state text when there are no words.
- [x] Add search by English word or definition.
- [x] Show tags if a word has tags.
- [x] Add a link to each word detail page.
- [x] Add a delete button with a confirmation step.
- [ ] Confirm deleted words stay deleted after refresh.

## Phase 10: Word Detail And Edit

- [x] Create the Word Detail page.
- [x] Show all fields for one word.
- [x] Show review status, correct count, incorrect count, and next review date.
- [x] Add an edit mode.
- [x] Save edits to localStorage.
- [x] Add a back link to the word list.
- [x] Handle invalid word IDs with a not-found message.

## Phase 11: Flashcards

- [x] Create a helper that returns words due for review.
- [x] Build the Flashcards page.
- [x] Show one word at a time.
- [x] Hide the answer until the user clicks `Show Answer`.
- [x] Add `Remembered` and `Forgot` buttons.
- [x] Update review data after each answer.
- [x] Move to the next card after answering.
- [x] Show a complete message when the session is done.
- [ ] Confirm review changes remain after refresh.

## Phase 12: Simple Spaced Repetition

- [x] Add review fields from `DATA_MODEL.md`.
- [x] Create an `updateReviewResult` helper.
- [x] If the user remembers a word, increase its review level.
- [x] If the user forgets a word, reset or lower its review level.
- [x] Set the next review date based on review level.
- [x] Keep the intervals simple: 1 day, 3 days, 7 days, 14 days, 30 days.
- [x] Test both remembered and forgot results.

## Phase 13: Quiz

- [x] Decide the first quiz type: multiple choice or typed answer.
- [x] Create quiz questions from saved words.
- [x] Show one question at a time.
- [x] Let the user choose or type an answer.
- [x] Show whether the answer is correct.
- [x] Update correct and incorrect counts.
- [x] Add incorrect answers to the mistake notebook.
- [x] Show final score at the end.
- [x] Handle the case where there are not enough words.

Recommended first version: multiple choice using the English word as the question and definitions as choices.

## Phase 14: Mistake Notebook

- [x] Add a way to identify words with mistakes.
- [x] Show mistaken words on the Mistakes page.
- [x] Show incorrect count and last incorrect date.
- [x] Add a button to review only mistakes with flashcards.
- [x] Add a button to clear a word from mistakes after the user feels confident.
- [ ] Confirm mistake state remains after refresh.

## Phase 15: Import JSON

- [x] Create the Import page.
- [x] Add a textarea for pasted JSON.
- [x] Define the accepted JSON format in the UI.
- [x] Parse JSON safely.
- [x] Show errors for invalid JSON.
- [x] Validate required fields.
- [x] Show a preview before importing.
- [x] Import valid words into localStorage.
- [x] Prevent duplicate words or ask the user what to do.
- [x] Test with valid and invalid JSON.

Example import format:

```json
[
  {
    "term": "resilient",
    "definition": "able to recover quickly from difficulty",
    "translation": "有韌性的",
    "example": "She is resilient after every setback.",
    "partOfSpeech": "adjective",
    "tags": ["personality", "advanced"]
  }
]
```

## Phase 16: UI Polish

- [x] Add consistent page titles.
- [x] Add consistent button styles.
- [x] Add consistent form input styles.
- [x] Add empty states for every page.
- [x] Add simple error messages.
- [x] Improve mobile layout.
- [x] Check keyboard navigation for forms and buttons.
- [x] Make the app readable in light mode first.

## Phase 17: Debug Checklist

- [x] Refresh the app after adding a word.
- [x] Refresh the app after editing a word.
- [x] Refresh the app after deleting a word.
- [x] Try adding a word with missing required fields.
- [x] Try importing broken JSON.
- [x] Try quiz with zero words.
- [x] Try quiz with only one word.
- [x] Try flashcards with zero due words.
- [x] Check browser console for errors.
- [x] Run a production build.

Suggested command:

```bash
npm run build
```

## Phase 18: Deploy To Vercel

- [x] Push the project to GitHub.
- [x] Create a new Vercel project.
- [x] Connect the GitHub repository.
- [x] Confirm Vercel detects Vite.
- [x] Set build command to `npm run build`.
- [x] Set output directory to `dist`.
- [x] Deploy the first version.
- [x] Test every route on the deployed URL.

## Phase 19: Prepare Supabase Version

- [x] Create a Supabase project.
- [x] Design tables based on `DATA_MODEL.md`.
- [x] Add authentication.
- [x] Create a `profiles` table if user profile data is needed.
- [x] Create a `words` table.
- [x] Create a `review_events` table.
- [x] Decide not to create a separate `mistakes` table because mistake state stays on `words`.
- [x] Add Row Level Security policies.
- [x] Create a Supabase client in the React app.
- [x] Replace localStorage reads and writes with Supabase queries.
- [x] Keep the UI mostly unchanged.

## Phase 20: Future AI Auto-Completion

- [ ] Add an `AI Fill` button on the Add Word page.
- [ ] Decide which AI API to use.
- [ ] Send only the English word to the AI service.
- [ ] Ask AI for definition, translation, example sentence, part of speech, and tags.
- [ ] Show AI results as editable suggestions.
- [ ] Let the user confirm before saving.
- [ ] Add error handling for failed AI requests.
- [ ] Avoid storing API keys in frontend code.

## Good First Milestone

The first useful milestone is:

- Vite app runs.
- Tailwind works.
- React Router works.
- Users can add words.
- Users can see words after refresh.

After this milestone, the app is real enough to build review features safely.

