# Word Groups Step 2: Schema + RBAC Review

This file records Step 2 review decisions for Phase 1 Word Groups.

## Scope

- Tables reviewed:
  - `word_groups`
  - `wordbase_group_map`
  - `user_group_picks`
  - `user_group_preferences`
- Constraints reviewed:
  - unique `group_code`
  - unique `(wordbase_id, group_id)`
  - unique `(user_id, group_id)`
  - active group must belong to picked groups (trigger-based)
- Indexes reviewed for filtering and joins.
- RLS + admin permission model reviewed.

## SQL Design Artifact

- Draft SQL: `supabase/word_groups_phase1_design.sql`
- Status: reviewed design draft for Step 2
- Step 3 action: convert to timestamped migration under `supabase/migrations/` and apply in local/staging.

## Table-by-Table Decisions

### `word_groups`

- Purpose: canonical curriculum group records
- Core keys:
  - `id` (uuid PK)
  - `group_code` unique and format-enforced (`hk-<level>-<grade>-<subject>`)
- Integrity:
  - grade enum check (`P1..P6`, `S1..S6`)
  - level enum check (`primary`, `secondary`)
  - grade/subject compatibility check using `is_hk_subject_allowed_for_grade(...)`
  - unique composite index on `(level, grade, subject)` to prevent duplicate groups

### `wordbase_group_map`

- Purpose: many-to-many mapping between `wordbase` and `word_groups`
- Core keys:
  - `wordbase_id` FK -> `public.wordbase(id)`
  - `group_id` FK -> `public.word_groups(id)`
  - unique (`wordbase_id`, `group_id`) to keep mapping idempotent

### `user_group_picks`

- Purpose: user multi-pick set
- Core keys:
  - `user_id` FK -> `auth.users(id)`
  - `group_id` FK -> `public.word_groups(id)`
  - unique (`user_id`, `group_id`)

### `user_group_preferences`

- Purpose: user active group pointer
- Core keys:
  - `user_id` PK/FK -> `auth.users(id)`
  - `active_group_id` FK -> `public.word_groups(id)`
- Integrity:
  - trigger `validate_active_group_is_picked()` guarantees active group is inside user's picks

## RLS / RBAC Behavior (Explicit)

Role source: JWT claims via `current_app_role()`:
- `app_metadata.role` -> fallback `user_metadata.role` -> fallback `student`

Helper:
- `is_owner_or_admin()` -> true only for `owner`, `admin`

Policy matrix:

- `word_groups`
  - read: any authenticated user
  - write (insert/update/delete): owner/admin only
- `wordbase_group_map`
  - read: any authenticated user
  - write (insert/update/delete): owner/admin only
- `user_group_picks`
  - user can read/insert/delete own rows
  - owner/admin can read/insert/delete any rows
- `user_group_preferences`
  - user can read/insert/update/delete own row
  - owner/admin can read/insert/update/delete any row

This aligns with frontend permission boundaries where admin/owner own management operations and students/teachers can manage their own selections.

## Rollback Safety Notes

- All new objects are additive; no existing table is altered destructively.
- Existing word/manual/photo import flows remain intact because legacy tables are untouched in Step 2.
- Migration order for Step 3:
  1. functions
  2. tables + indexes + triggers
  3. RLS enablement
  4. policies

## Open-to-Step-3 Items

- Create timestamped migration from reviewed draft.
- Run in local/staging and verify:
  - constraints reject invalid data
  - RLS blocks non-admin mapping/group writes
  - active-group trigger enforces picked-group invariant
