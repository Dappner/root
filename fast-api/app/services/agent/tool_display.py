"""Display helpers for streamed agent tool events."""

from typing import Any


def _truncate(value: str, max_len: int = 96) -> str:
    value = " ".join(value.split())
    if len(value) <= max_len:
        return value
    return value[: max_len - 1].rstrip() + "..."


def _content_label(entity_types: list[str] | None) -> str:
    if not entity_types:
        return "everything"

    labels = {
        "capture": "notes",
        "citation": "highlights",
        "takeaway": "takeaways",
        "source_section_summary": "sections",
    }
    return ", ".join(labels.get(entity_type, entity_type) for entity_type in entity_types)


def _normalize_tool_name(name: str) -> str:
    normalized = name.removesuffix("Schema")
    mapping = {
        "Search": "search",
        "ListSources": "list_user_sources",
        "ListUserSources": "list_user_sources",
        "SuggestUncapturedCitations": "suggest_uncaptured_citations",
        "SuggestCreateCapture": "suggest_create_capture",
        "SuggestUpdateSectionSummary": "suggest_update_section_summary",
        "GetSourceContext": "get_source_context",
    }
    return mapping.get(normalized, normalized)


def build_tool_display(
    name: str,
    args: dict[str, Any],
    *,
    summary: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a stable, UI-ready display payload for an agent tool event."""
    tool_name = _normalize_tool_name(name)

    if tool_name == "search":
        query = str(args.get("query") or "").strip()
        entity_types = args.get("entity_types")
        source_ids = args.get("source_ids")
        source_types = args.get("source_types")

        scope_parts: list[str] = []
        if source_ids:
            scope_parts.append(f"source {', '.join(str(sid) for sid in source_ids)}")
        if source_types:
            scope_parts.append(", ".join(str(source_type) for source_type in source_types))

        detail_parts = [_content_label(entity_types if isinstance(entity_types, list) else None)]
        if scope_parts:
            detail_parts.append("in " + "; ".join(scope_parts))

        display: dict[str, Any] = {
            "label": "Search",
            "title": f'Searching for "{_truncate(query, 64)}"' if query else "Searching library",
            "detail": " ".join(detail_parts),
        }
        stats = (metadata or {}).get("stats") or {}
        if summary:
            display["summary"] = summary
        if stats:
            total = stats.get("total", 0)
            display["result"] = f"{total} result{'s' if total != 1 else ''}"
        return display

    if tool_name == "list_user_sources":
        limit = args.get("limit")
        return {
            "label": "Sources",
            "title": "Listing sources",
            "detail": f"up to {limit} sources" if limit else "saved library sources",
            "summary": summary,
        }

    if tool_name == "suggest_uncaptured_citations":
        return {
            "label": "Highlights",
            "title": "Finding unnoted highlights",
            "detail": f"source {args.get('source_id')}" if args.get("source_id") else None,
            "summary": summary,
        }

    if tool_name == "get_source_context":
        include = args.get("include")
        if isinstance(include, list) and include:
            detail = ", ".join(str(item) for item in include)
        else:
            detail = "highlights, notes, takeaways, and sections"
        return {
            "label": "Context",
            "title": "Loading source context",
            "detail": f"{detail} from source {args.get('source_id')}",
            "summary": summary,
        }

    if tool_name == "suggest_create_capture":
        return {
            "label": "Create note",
            "title": "Suggesting a note",
            "detail": f"source {args.get('source_id')}",
            "summary": summary,
        }

    if tool_name == "suggest_update_section_summary":
        return {
            "label": "Update summary",
            "title": "Suggesting a section summary",
            "detail": f"section {args.get('section_id')}",
            "summary": summary,
        }

    return {
        "label": tool_name.replace("_", " ").title(),
        "title": tool_name.replace("_", " ").title(),
        "summary": summary,
    }
