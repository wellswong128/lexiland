#!/usr/bin/env python3
"""Validate HK word group taxonomy and frozen data contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TAXONOMY_PATH = PROJECT_ROOT / "data/hk_word_groups/taxonomy.json"
CONTRACT_PATH = PROJECT_ROOT / "data/hk_word_groups/DATA_CONTRACT.json"

GROUP_CODE_RE = re.compile(r"^hk-(primary|secondary)-(p[1-6]|s[1-6])-[a-z0-9-]+$")


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_taxonomy(tax: dict) -> list[str]:
    errors: list[str] = []

    subject_slugs = {item["slug"] for item in tax["subjects"]}
    grade_to_level: dict[str, str] = {}
    for level in tax["levels"]:
        for grade in level["grades"]:
            grade_to_level[grade] = level["id"]

    for grade, subjects in tax["grade_subject_matrix"].items():
        if grade not in grade_to_level:
            errors.append(f"matrix grade unknown: {grade}")
            continue
        for subject in subjects:
            if subject not in subject_slugs:
                errors.append(f"matrix subject unknown for {grade}: {subject}")

    seen_codes: set[str] = set()
    for group in tax["groups"]:
        code = group["group_code"]
        if code in seen_codes:
            errors.append(f"duplicate group_code: {code}")
        seen_codes.add(code)

        if not GROUP_CODE_RE.match(code):
            errors.append(f"invalid group_code pattern: {code}")

        grade = group["grade"]
        subject = group["subject"]
        allowed = tax["grade_subject_matrix"].get(grade, [])
        if subject not in allowed:
            errors.append(f"group {code} subject not allowed for grade {grade}")

        expected_level = grade_to_level.get(grade)
        if group["level"] != expected_level:
            errors.append(
                f"group {code} level mismatch: {group['level']} vs {expected_level}"
            )

        expected_code = f"hk-{expected_level}-{grade.lower()}-{subject}"
        if code != expected_code:
            errors.append(f"group {code} code mismatch expected {expected_code}")

    for grade, subjects in tax["grade_subject_matrix"].items():
        level = grade_to_level[grade]
        for subject in subjects:
            expected_code = f"hk-{level}-{grade.lower()}-{subject}"
            if expected_code not in seen_codes:
                errors.append(f"missing group for matrix entry: {expected_code}")

    fallback_codes = {item["group_code"] for item in tax.get("fallback_groups", [])}
    if "hk-personal-ungrouped" not in fallback_codes:
        errors.append("missing fallback group hk-personal-ungrouped")

    return errors


def validate_contract(contract: dict, tax: dict) -> list[str]:
    errors: list[str] = []

    if contract.get("status") != "frozen":
        errors.append("DATA_CONTRACT status is not frozen")

    expected_curriculum = len(tax["groups"])
    if contract["counts"]["curriculum_groups"] != expected_curriculum:
        errors.append(
            "contract curriculum_groups count mismatch: "
            f"{contract['counts']['curriculum_groups']} vs {expected_curriculum}"
        )

    fallback_count = len(tax.get("fallback_groups", []))
    if contract["counts"]["fallback_groups"] != fallback_count:
        errors.append(
            "contract fallback_groups count mismatch: "
            f"{contract['counts']['fallback_groups']} vs {fallback_count}"
        )

    return errors


def main() -> int:
    if not TAXONOMY_PATH.exists():
        print(f"Missing taxonomy file: {TAXONOMY_PATH}", file=sys.stderr)
        return 1
    if not CONTRACT_PATH.exists():
        print(f"Missing contract file: {CONTRACT_PATH}", file=sys.stderr)
        return 1

    tax = load_json(TAXONOMY_PATH)
    contract = load_json(CONTRACT_PATH)

    errors = validate_taxonomy(tax) + validate_contract(contract, tax)
    if errors:
        print("Validation failed:")
        for error in errors:
            print(f" - {error}")
        return 1

    print("HK word group taxonomy validation passed.")
    print(f"  taxonomy version: {tax.get('version')}")
    print(f"  contract version: {contract.get('contract_version')}")
    print(f"  curriculum groups: {len(tax['groups'])}")
    print(f"  fallback groups: {len(tax.get('fallback_groups', []))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
