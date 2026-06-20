# HK Word Group Taxonomy and Starter Group Codes

Source of truth for Phase 1 Word Groups (Hong Kong primary and secondary students).

**Status:** Frozen on 2026-06-20 (Step 1 complete)

Related files:
- Implementation checklist: `PHASE1_WORD_GROUP_IMPLEMENTATION_CHECKLIST.md`
- Machine-readable matrix: `data/hk_word_groups/taxonomy.json`
- Frozen data contract: `data/hk_word_groups/DATA_CONTRACT.json`
- Validator: `scripts/hk_word_groups/validate_taxonomy.py`
- Per-group word list files (future): `data/hk_word_groups/<level>/<grade>/<subject>.json`

---

## Naming Rules

### `group_code` format

```
hk-<level>-<grade>-<subject-slug>
```

Examples:
- `hk-primary-p1-english`
- `hk-secondary-s2-geography`
- `hk-secondary-s4-physics`

Rules:
- All lowercase
- Use hyphens only (no spaces)
- `level`: `primary` | `secondary`
- `grade`: `p1`–`p6`, `s1`–`s6`
- `subject-slug`: stable English slug from the subject table below

### Display names (i18n)

Each group has:
- `display_name_en`
- `display_name_zh_hant`

Pattern:
- EN: `{Grade} {Subject}` (e.g. `P3 English`, `S2 Geography`)
- zh-Hant: `{年級}{科目}` (e.g. `小三英文`, `中二地理`)

---

## Controlled Enums

| Field | Values |
| --- | --- |
| `level` | `primary`, `secondary` |
| `grade` | `P1`, `P2`, `P3`, `P4`, `P5`, `P6`, `S1`, `S2`, `S3`, `S4`, `S5`, `S6` |
| `locale` | `zh-Hant` (default for HK content) |

---

## Subject Slugs

| Subject (EN) | Subject slug | zh-Hant label |
| --- | --- | --- |
| English | `english` | 英文 |
| Mathematics | `mathematics` | 數學 |
| General Studies | `general-studies` | 常識 |
| Science | `science` | 科學 |
| Integrated Science | `integrated-science` | 綜合科學 |
| Chinese History | `chinese-history` | 中國歷史 |
| History | `history` | 歷史 |
| Geography | `geography` | 地理 |
| Physics | `physics` | 物理 |
| Chemistry | `chemistry` | 化學 |
| Biology | `biology` | 生物 |
| Economics | `economics` | 經濟 |
| ICT | `ict` | 資訊及通訊科技 |

---

## Grade-Dependent Subject Matrix (HK)

### Primary

| Grade band | Grades | Allowed subjects |
| --- | --- | --- |
| Lower primary | P1, P2, P3 | English, Mathematics, General Studies |
| Upper primary | P4, P5, P6 | English, Mathematics, General Studies, Science |

### Secondary

| Grade band | Grades | Allowed subjects |
| --- | --- | --- |
| Lower secondary | S1, S2, S3 | English, Mathematics, Integrated Science, Chinese History, History, Geography |
| Upper secondary | S4, S5, S6 | English, Mathematics, Physics, Chemistry, Biology, Economics, Geography, History, ICT |

Validation rule (server-side):
- Reject any `(grade, subject)` pair not listed above with HTTP `400`.

---

## Starter Group Codes (Phase 1)

Total starter groups: **66** curriculum groups + **1** fallback bucket.

### Primary — P1 to P3 (9 groups)

| group_code | grade | subject |
| --- | --- | --- |
| `hk-primary-p1-english` | P1 | English |
| `hk-primary-p1-mathematics` | P1 | Mathematics |
| `hk-primary-p1-general-studies` | P1 | General Studies |
| `hk-primary-p2-english` | P2 | English |
| `hk-primary-p2-mathematics` | P2 | Mathematics |
| `hk-primary-p2-general-studies` | P2 | General Studies |
| `hk-primary-p3-english` | P3 | English |
| `hk-primary-p3-mathematics` | P3 | Mathematics |
| `hk-primary-p3-general-studies` | P3 | General Studies |

### Primary — P4 to P6 (12 groups)

| group_code | grade | subject |
| --- | --- | --- |
| `hk-primary-p4-english` | P4 | English |
| `hk-primary-p4-mathematics` | P4 | Mathematics |
| `hk-primary-p4-general-studies` | P4 | General Studies |
| `hk-primary-p4-science` | P4 | Science |
| `hk-primary-p5-english` | P5 | English |
| `hk-primary-p5-mathematics` | P5 | Mathematics |
| `hk-primary-p5-general-studies` | P5 | General Studies |
| `hk-primary-p5-science` | P5 | Science |
| `hk-primary-p6-english` | P6 | English |
| `hk-primary-p6-mathematics` | P6 | Mathematics |
| `hk-primary-p6-general-studies` | P6 | General Studies |
| `hk-primary-p6-science` | P6 | Science |

### Secondary — S1 to S3 (18 groups)

| group_code | grade | subject |
| --- | --- | --- |
| `hk-secondary-s1-english` | S1 | English |
| `hk-secondary-s1-mathematics` | S1 | Mathematics |
| `hk-secondary-s1-integrated-science` | S1 | Integrated Science |
| `hk-secondary-s1-chinese-history` | S1 | Chinese History |
| `hk-secondary-s1-history` | S1 | History |
| `hk-secondary-s1-geography` | S1 | Geography |
| `hk-secondary-s2-english` | S2 | English |
| `hk-secondary-s2-mathematics` | S2 | Mathematics |
| `hk-secondary-s2-integrated-science` | S2 | Integrated Science |
| `hk-secondary-s2-chinese-history` | S2 | Chinese History |
| `hk-secondary-s2-history` | S2 | History |
| `hk-secondary-s2-geography` | S2 | Geography |
| `hk-secondary-s3-english` | S3 | English |
| `hk-secondary-s3-mathematics` | S3 | Mathematics |
| `hk-secondary-s3-integrated-science` | S3 | Integrated Science |
| `hk-secondary-s3-chinese-history` | S3 | Chinese History |
| `hk-secondary-s3-history` | S3 | History |
| `hk-secondary-s3-geography` | S3 | Geography |

### Secondary — S4 to S6 (27 groups)

| group_code | grade | subject |
| --- | --- | --- |
| `hk-secondary-s4-english` | S4 | English |
| `hk-secondary-s4-mathematics` | S4 | Mathematics |
| `hk-secondary-s4-physics` | S4 | Physics |
| `hk-secondary-s4-chemistry` | S4 | Chemistry |
| `hk-secondary-s4-biology` | S4 | Biology |
| `hk-secondary-s4-economics` | S4 | Economics |
| `hk-secondary-s4-geography` | S4 | Geography |
| `hk-secondary-s4-history` | S4 | History |
| `hk-secondary-s4-ict` | S4 | ICT |
| `hk-secondary-s5-english` | S5 | English |
| `hk-secondary-s5-mathematics` | S5 | Mathematics |
| `hk-secondary-s5-physics` | S5 | Physics |
| `hk-secondary-s5-chemistry` | S5 | Chemistry |
| `hk-secondary-s5-biology` | S5 | Biology |
| `hk-secondary-s5-economics` | S5 | Economics |
| `hk-secondary-s5-geography` | S5 | Geography |
| `hk-secondary-s5-history` | S5 | History |
| `hk-secondary-s5-ict` | S5 | ICT |
| `hk-secondary-s6-english` | S6 | English |
| `hk-secondary-s6-mathematics` | S6 | Mathematics |
| `hk-secondary-s6-physics` | S6 | Physics |
| `hk-secondary-s6-chemistry` | S6 | Chemistry |
| `hk-secondary-s6-biology` | S6 | Biology |
| `hk-secondary-s6-economics` | S6 | Economics |
| `hk-secondary-s6-geography` | S6 | Geography |
| `hk-secondary-s6-history` | S6 | History |
| `hk-secondary-s6-ict` | S6 | ICT |

### Fallback bucket (ungrouped / personal words)

| group_code | purpose |
| --- | --- |
| `hk-personal-ungrouped` | Existing words, manual input, photo import without confirmed group |

Behavior:
- Not grade-dependent; always available.
- Used for backward compatibility and optional group assignment later.
- Not shown as a curriculum pick in the grade/subject picker (internal + settings only).

---

## Local Word List File Convention

One JSON file per curriculum group:

```
data/hk_word_groups/primary/p1/english.json
data/hk_word_groups/secondary/s4/physics.json
```

Suggested word-list file schema:

```json
{
  "group_code": "hk-primary-p1-english",
  "level": "primary",
  "grade": "P1",
  "subject": "english",
  "locale": "zh-Hant",
  "version": "2026.06",
  "words": [
    {
      "term": "apple",
      "definition": "A round fruit with red, green, or yellow skin.",
      "translation": "蘋果",
      "example": "I eat an apple every morning.",
      "example_translation": "我每天早上吃一個蘋果。",
      "tags": ["hk", "primary", "p1", "english"]
    }
  ]
}
```

Import order (future script):
1. Load `data/hk_word_groups/taxonomy.json` (groups + matrix)
2. Upsert all groups into `word_groups`
3. For each word file: upsert `wordbase` rows + `wordbase_group_map`

---

## Phase 1 Content Targets (Low-Cost Start)

Start small, extend later:
- **MVP**: 20–50 starter words per group for English groups first
- **Next**: expand Mathematics / General Studies / Science
- **Later**: full secondary subject coverage (100–200+ words per group)

Priority order for content creation:
1. English groups (all grades)
2. Mathematics groups
3. General Studies / Integrated Science
4. Remaining secondary electives

---

## Extension Notes (Future Phases)

Easy to extend without breaking existing codes:
- Add new subjects by appending rows to `taxonomy.json` + new word files
- Add teacher-assigned groups (Phase 2) without changing `group_code`
- Add browse-all mode without changing strict filter defaults
- Add zh-Hans labels alongside zh-Hant when needed

---

## Quick Reference Counts

| Segment | Groups |
| --- | ---: |
| Primary P1–P3 | 9 |
| Primary P4–P6 | 12 |
| Secondary S1–S3 | 18 |
| Secondary S4–S6 | 27 |
| Fallback | 1 |
| **Total** | **67** |
