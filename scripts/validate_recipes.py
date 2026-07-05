#!/usr/bin/env python3
"""Validate recipes.json for the Spillmann recipe collection.

No third-party dependencies. Intended as the fast check for recipe-only edits,
so adding a recipe does not require launching a browser.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "id": str,
    "title": str,
    "description": str,
    "cuisine": str,
    "diet": str,
    "course": str,
    "effort": str,
    "time": str,
    "servings": int,
    "tags": list,
    "ingredients": list,
    "steps": list,
}

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_EFFORTS = {"einfach", "mittel", "aufwendig"}
COMMON_COURSES = {
    "Vorspeise",
    "Hauptspeise",
    "Nachspeise",
    "Snack",
    "Frühstück",
    "Beilage",
    "Getränk",
}
COMMON_DIETS = {"vegetarisch", "vegan", "Fleisch", "Fisch"}
OPTIONAL_FIELDS = {
    "source": str,
}


def is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_string_list(recipe: dict[str, Any], field: str, errors: list[str]) -> None:
    value = recipe.get(field)
    recipe_id = recipe.get("id", "<unknown>")
    if not isinstance(value, list):
        errors.append(f"{recipe_id}: {field} must be a list")
        return
    if not value:
        errors.append(f"{recipe_id}: {field} must not be empty")
        return
    for index, item in enumerate(value, start=1):
        if not is_non_empty_string(item):
            errors.append(f"{recipe_id}: {field}[{index}] must be a non-empty string")


def validate_recipe(recipe: Any, index: int, seen_ids: set[str], errors: list[str], warnings: list[str]) -> None:
    prefix = f"recipe[{index}]"
    if not isinstance(recipe, dict):
        errors.append(f"{prefix}: must be an object")
        return

    recipe_id = recipe.get("id", prefix)
    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in recipe:
            errors.append(f"{recipe_id}: missing required field '{field}'")
            continue
        value = recipe[field]
        if expected_type is int:
            if not isinstance(value, int) or isinstance(value, bool):
                errors.append(f"{recipe_id}: field '{field}' must be an integer")
        elif not isinstance(value, expected_type):
            errors.append(f"{recipe_id}: field '{field}' must be {expected_type.__name__}")

    if not isinstance(recipe_id, str) or not SLUG_RE.fullmatch(recipe_id):
        errors.append(f"{prefix}: id must be a lowercase kebab-case slug")
    elif recipe_id in seen_ids:
        errors.append(f"{recipe_id}: duplicate id")
    else:
        seen_ids.add(recipe_id)

    for field in ["title", "description", "cuisine", "diet", "course", "effort", "time"]:
        if field in recipe and not is_non_empty_string(recipe[field]):
            errors.append(f"{recipe_id}: field '{field}' must be a non-empty string")

    if isinstance(recipe.get("servings"), int) and recipe["servings"] <= 0:
        errors.append(f"{recipe_id}: servings must be > 0")

    for field, expected_type in OPTIONAL_FIELDS.items():
        if field in recipe and not isinstance(recipe[field], expected_type):
            errors.append(f"{recipe_id}: optional field '{field}' must be {expected_type.__name__}")
        elif field in recipe and expected_type is str and not is_non_empty_string(recipe[field]):
            errors.append(f"{recipe_id}: optional field '{field}' must be a non-empty string")

    validate_string_list(recipe, "tags", errors)
    validate_string_list(recipe, "ingredients", errors)
    validate_string_list(recipe, "steps", errors)

    effort = recipe.get("effort")
    if isinstance(effort, str) and effort not in ALLOWED_EFFORTS:
        warnings.append(f"{recipe_id}: uncommon effort '{effort}' (expected one of {sorted(ALLOWED_EFFORTS)})")

    course = recipe.get("course")
    if isinstance(course, str) and course not in COMMON_COURSES:
        warnings.append(f"{recipe_id}: uncommon course '{course}'")

    diet = recipe.get("diet")
    if isinstance(diet, str) and diet not in COMMON_DIETS:
        warnings.append(f"{recipe_id}: uncommon diet '{diet}'")

    allowed = set(REQUIRED_FIELDS) | set(OPTIONAL_FIELDS)
    extra = sorted(set(recipe) - allowed)
    if extra:
        warnings.append(f"{recipe_id}: extra fields ignored by current app: {', '.join(extra)}")


def validate(path: Path) -> tuple[list[str], list[str], int]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"invalid JSON: {exc}"], [], 0

    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, list):
        return ["top-level value must be a list of recipe objects"], [], 0
    if not data:
        warnings.append("recipe list is empty")

    seen_ids: set[str] = set()
    for index, recipe in enumerate(data, start=1):
        validate_recipe(recipe, index, seen_ids, errors, warnings)
    return errors, warnings, len(data)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate recipes.json")
    parser.add_argument("path", nargs="?", default="recipes.json", type=Path)
    parser.add_argument("--strict-warnings", action="store_true", help="treat warnings as failures")
    args = parser.parse_args()

    errors, warnings, count = validate(args.path)
    for warning in warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)

    if errors or (args.strict_warnings and warnings):
        print(f"recipes validation failed: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1

    print(f"recipes validation ok: {count} recipe(s), {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
