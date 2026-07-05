"""Blueprint display-name → internalName resolution for Log Watcher dumpers."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, TypedDict

_LOOKUP_PATH = Path(__file__).resolve().parent / "lookup.json"
_cached: dict[str, Any] | None = None

_BP_CRAFT_SCITEM = re.compile(r"bp_craft_([^/]+?)_scitem\.json$", re.I)
_BP_CRAFT_SIMPLE = re.compile(r"bp_craft_([^/]+?)\.json$", re.I)


class ResolveResult(TypedDict, total=False):
    ok: bool
    internal_name: str
    blueprint_name: str
    error: str
    display_name: str


def _load_lookup() -> dict[str, Any]:
    global _cached
    if _cached is None:
        with _LOOKUP_PATH.open(encoding="utf-8") as f:
            _cached = json.load(f)
    return _cached


def _normalize_display_key(value: str) -> str:
    return value.strip().lower()


def normalize_internal_key(raw_input: str) -> str:
    normalized = raw_input.replace("\\", "/").strip().lower()
    m = _BP_CRAFT_SCITEM.search(normalized)
    if m:
        return m.group(1)
    m = _BP_CRAFT_SIMPLE.search(normalized)
    if m:
        return m.group(1)
    return normalized


def resolve_blueprint_input(raw_input: str, contract_definition_id: str | None = None) -> ResolveResult:
    """
    1. Match catalog internalName (client may send internalName directly).
    2. Else map Game.log display text.
    3. Else contract-based disambiguation for ambiguous display names.
    """
    data = _load_lookup()
    text = raw_input.strip()
    if not text:
        return {"ok": False, "error": "unknown_blueprint"}

    internal_key = normalize_internal_key(text)
    by_internal = data.get("byInternalName", {})
    if internal_key in by_internal:
        entry = by_internal[internal_key]
        return {
            "ok": True,
            "internal_name": internal_key,
            "blueprint_name": entry.get("blueprintName", internal_key),
        }

    display_entry = data.get("byDisplayName", {}).get(_normalize_display_key(text))
    if not display_entry:
        return {"ok": False, "error": "unknown_blueprint", "display_name": text}

    if not display_entry.get("ambiguous"):
        return {
            "ok": True,
            "internal_name": display_entry["internalName"],
            "blueprint_name": display_entry.get("blueprintName", text),
        }

    candidates = list(display_entry.get("candidates") or [])
    contract_key = (contract_definition_id or "").strip().lower()
    if contract_key:
        pool_ids = set(data.get("byContractDefinitionId", {}).get(contract_key, []))
        if pool_ids:
            filtered = [c for c in candidates if c.get("internalName") in pool_ids]
            if filtered:
                candidates = filtered

    if len(candidates) == 1:
        c = candidates[0]
        return {
            "ok": True,
            "internal_name": c["internalName"],
            "blueprint_name": c.get("blueprintName", text),
        }

    display_name = display_entry.get("displayName") or text
    return {
        "ok": False,
        "error": "ambiguous_blueprint",
        "display_name": display_name,
    }


def cache_key_for_input(raw_input: str) -> str:
    result = resolve_blueprint_input(raw_input)
    if result.get("ok"):
        return result["internal_name"]
    return normalize_internal_key(raw_input)
