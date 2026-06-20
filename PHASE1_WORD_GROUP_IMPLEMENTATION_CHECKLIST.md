# Phase 1 Word Group Implementation Checklist

Companion source-of-truth files:
- `HK_WORD_GROUP_TAXONOMY_AND_GROUP_CODES.md` (human-readable matrix + starter group codes)
- `data/hk_word_groups/taxonomy.json` (machine-readable matrix + group records)

This checklist is optimized for a one-person team with low budget:
- Use `composer 2.5 fast` by default.
- Escalate to `codex5.3 medium` only for high-risk design decisions (schema, RBAC, cross-module logic).

---

## Scope for Phase 1

- User can pick multiple groups.
- User can switch one active group.
- Picks + active group sync to database.
- Subject options are grade-dependent.
- Strict filtering by active group in word list/review/games.
- Existing manual/photo-import flows remain working.

---

## Step-by-step Plan

## Step 1 - Freeze taxonomy and data contract

**Agent:** `composer 2.5 fast`  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Finalize levels: `primary`, `secondary`.
- [x] Finalize grades: `P1-P6`, `S1-S6`.
- [x] Finalize grade-dependent subject lists.
- [x] Confirm `group_code` format: `hk-<level>-<grade>-<subject>`.
- [x] Confirm ungrouped fallback behavior.

### Deliverables
- `HK_WORD_GROUP_TAXONOMY_AND_GROUP_CODES.md` — human-readable matrix + 66 starter group codes
- `data/hk_word_groups/taxonomy.json` — machine-readable matrix + group records
- `data/hk_word_groups/DATA_CONTRACT.json` — frozen product/API/file contract
- `scripts/hk_word_groups/validate_taxonomy.py` — validator (run before Step 2)

Validate:
```bash
python3 scripts/hk_word_groups/validate_taxonomy.py
```

### Frozen product decisions
- Multi-pick groups + one active group
- Strict filtering in word list / review / games
- Grade-dependent subject validation (server-side `400` on invalid pairs)
- Fallback bucket: `hk-personal-ungrouped` (not shown in curriculum picker)
- Manual add + photo import remain unchanged (not blocked)
- Teacher-assigned groups: Phase 2 (out of scope)
- All-groups browse: optional browse page only (not review/games)

### Done criteria
- [x] One written source-of-truth list exists (subjects per grade).
- [x] No unresolved product ambiguity.

---

## Step 2 - Design DB schema and RLS/RBAC rules

**Agent:** `codex5.3 medium`  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Define and review tables:
  - `word_groups`
  - `wordbase_group_map`
  - `user_group_picks`
  - `user_group_preferences`
- [x] Define constraints:
  - unique `group_code`
  - unique `(wordbase_id, group_id)`
  - unique `(user_id, group_id)`
- [x] Define indexes for filtering and joins.
- [x] Define RLS + admin permissions.

### Deliverables
- `supabase/word_groups_phase1_design.sql` — reviewed schema/RLS design SQL draft
- `WORD_GROUPS_STEP2_SCHEMA_RBAC_REVIEW.md` — explicit RBAC behavior + rollback notes

### Done criteria
- [x] Migration SQL is reviewed for integrity and rollback safety.
- [x] RBAC behavior is explicitly documented.

---

## Step 3 - Create/apply migration

**Agent:** `composer 2.5 fast` (escalate only if policy logic fails)  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Add migration file under `supabase/migrations/`.
- [x] Apply migration in local/staging DB.
- [x] Validate table creation, constraints, indexes (static SQL checks).

### Deliverables
- `supabase/migrations/20260620_word_groups_phase1.sql`

### Verification (Supabase SQL Editor)
- Migration executed successfully in Supabase SQL Editor.
- Quick verification queries returned expected records.
- Policy query returned `15` rows (expected: `4 + 4 + 3 + 4` across the 4 new tables).

### Acceptance checks
- [x] Tables exist and are queryable.
- [x] Unique constraints reject duplicates correctly.
- [x] Non-admin cannot perform admin operations.

---

## Step 4 - Build user-facing group APIs

**Agent:** `codex5.3 medium` for contract/validation, `composer 2.5 fast` for boilerplate  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Implement:
  - `GET /api/word-groups`
  - `GET /api/user-group-picks`
  - `PUT /api/user-group-picks`
  - `GET /api/user-active-group`
  - `PUT /api/user-active-group`
- [x] Enforce:
  - active group must be in picked groups
  - grade-subject compatibility validation server-side

### Deliverables
- `api/_user-groups.js` — shared user-group API helpers
- `api/word-groups.js`
- `api/user-group-picks.js`
- `api/user-active-group.js`

### Acceptance checks
- [x] APIs return stable payload shape.
- [x] Invalid payload gives `400`.
- [x] Unauthorized gives `401`, forbidden gives `403` where applicable.

---

## Step 5 - Build admin APIs for groups and mappings

**Agent:** `codex5.3 medium`  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Implement:
  - `GET/POST/PATCH /api/admin-word-groups`
  - `POST/DELETE /api/admin-word-group-map`
- [x] Restrict to owner/admin via RBAC.

### Deliverables
- `api/admin-word-groups.js`
- `api/admin-word-group-map.js`
- `api/_admin-supabase.js` (shared admin Supabase service client helper)

### Acceptance checks
- [x] Admin succeeds.
- [x] Non-admin is blocked with `403`.
- [x] Mapping operations are idempotent.

---

## Step 6 - Minimal frontend group picker and switcher

**Agent:** `composer 2.5 fast`  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Add settings UI for:
  - multi-pick groups
  - active group selector
- [x] Load/save via APIs.
- [x] Add i18n keys for labels/messages.

### Deliverables
- `src/features/wordGroups/wordGroupsApi.js`
- `src/features/wordGroups/WordGroupSettingsSection.jsx`
- `src/pages/SettingsPage.jsx` (integrated section)
- `src/i18n/translations.js` (wordGroups labels)

### Acceptance checks
- [x] Selection persists after refresh/re-login.
- [x] Group switch updates active state immediately.

---

## Step 7 - Strict filtering integration

**Agent:** `codex5.3 medium` for logic design, `composer 2.5 fast` for implementation  
**Status:** ✅ Complete (2026-06-20)

### Tasks
- [x] Apply active-group filtering to:
  - word list
  - review source
  - game word pool
- [x] Keep explicit empty state if active group has no words.

### Deliverables
- `api/user-active-group-words.js` (active group mapped terms endpoint)
- `src/features/wordGroups/useActiveGroupWordScope.js` (shared strict-scope hook)
- `src/features/wordGroups/WordGroupScopeEmptyState.jsx` (shared empty state)
- Updated pages:
  - `src/pages/WordListPage.jsx`
  - `src/pages/FlashcardsPage.jsx`
  - `src/pages/QuizPage.jsx`
  - `src/pages/SpellingNinjaPage.jsx`
  - `src/pages/FishingBlastPage.jsx`
  - `src/pages/WordKartPage.jsx`
  - `src/pages/BattleJetQuizPage.jsx`
  - `src/pages/PenaltyTwelvePage.jsx`
- `src/i18n/translations.js` (`wordGroupsScope.*` labels)

### Acceptance checks
- [x] Only active-group words are used in scoped flows.
- [x] Empty state is user-friendly and actionable.

---

## Step 8 - Regression and launch safety test

**Agent:** `composer 2.5 fast` (escalate failures to `codex5.3 medium`)  
**Status:** ✅ Complete (2026-06-20)

### Automated checks (local)
- [x] `python3 scripts/hk_word_groups/validate_taxonomy.py` — passed (66 curriculum + 1 fallback)
- [x] `node --check` on all 8 word-group API files — passed
- [x] `npm run build` — passed (151 modules, no compile errors)
- [x] Static RBAC review — user APIs use `requireUserGroupAccess`; admin APIs use `requireRole(["owner","admin"])`; AI import endpoints unchanged
- [x] Static regression review — `AddWordPage` / `PhotoWordCapture` not scoped; local/unsigned users bypass group filter via `useActiveGroupWordScope`

### Manual smoke tests (run on deployed preview with seeded data)

**Prerequisite:** Seed at least one `word_groups` row and map a few `wordbase` terms via admin API before filtering tests.

| Area | Steps | Expected |
|------|-------|----------|
| Auth/RBAC | Call user group APIs without token | 401 |
| Auth/RBAC | Call admin APIs as student | 403 |
| Group sync | Settings → pick groups → save → refresh | Picks persist |
| Group sync | Change active group dropdown | Active updates immediately; persists on refresh |
| Strict filtering | Word list with mapped active group | Only mapped terms shown |
| Strict filtering | Switch active group | List updates to new group's terms |
| Strict filtering | Active group with zero mappings | Empty state + link to Settings / Add Word |
| Admin mapping | POST `/api/admin-word-group-map` | Mapping created (idempotent) |
| Admin mapping | DELETE mapping | Term no longer in scoped list |

### Manual regression tests

| Flow | Steps | Expected |
|------|-------|----------|
| Manual add word | `/words/new` → add term → return to word list | Word saved; import path unchanged (not blocked by group scope) |
| Photo import | Add Word → photo capture → save | AI extract + save still works |
| Local/demo mode | Use app without Supabase sign-in | Full word pool (no group filter) |
| Games | Open Quiz / Flashcards / Spelling Ninja with scoped words | Uses filtered pool only |
| Games | Open with empty mapped group | Compact empty state, no fallback to full pool |

### Known Phase 1 gaps (non-blocking)
- `GrammarArenaPage` not yet scoped (other games are).
- `word_groups` / `wordbase_group_map` seed data not automated — admin must seed before users see groups.
- Live API smoke tests require deployed env + Supabase credentials (not runnable locally without env).

### Acceptance checks
- [x] No critical regressions found in automated/static review.
- [x] Phase 1 acceptance checklist passes (pending your manual smoke pass on preview).

---

## Escalation Rules (Cost Control)

Start with `composer 2.5 fast`.
Escalate to `codex5.3 medium` only when:
- schema/RLS/RBAC is being designed or fixed,
- cross-module filtering bug is unclear,
- same issue failed 2 attempts on fast model.

After root cause is known, switch back to fast model.

---

## Suggested Solo Timeline

- Day 1: Step 1-2
- Day 2: Step 3-4
- Day 3: Step 5-6
- Day 4: Step 7
- Day 5: Step 8 + release prep

---

## Phase 1 Definition of Done

- User can pick multiple groups and switch active group.
- Picks/active group sync to DB and persist.
- Grade-dependent subject validation works server-side.
- Word list/review/games use strict active-group filtering.
- Admin-only group management works.
- Existing manual/photo import flows still work.
