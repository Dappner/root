"""Shared formatting utilities for agent actions."""

from app.schemas.rag import RetrievalHit


def format_source_metadata(hit: RetrievalHit) -> str:
    """Build source metadata string from hit.

    Returns: String like "Title (type)" or empty string if no metadata.
    """
    source_parts = []
    if hit.source_title:
        source_parts.append(hit.source_title)
    if hit.source_type:
        source_parts.append(f"({hit.source_type})")
    if hit.source_author:
        source_parts.append(f"by {hit.source_author}")
    if hit.source_label:
        source_parts.append(f"[{hit.source_label}]")
    if hit.source_status:
        source_parts.append(f"status: {hit.source_status}")

    return " ".join(source_parts)


def format_citation_reference(hit: RetrievalHit) -> str | None:
    """Format citation reference for a capture.

    Returns: Formatted citation string or None if no citation attached.
    """
    if hit.kind != "capture" or not hit.citation_text:
        return None

    citation_parts = []
    if hit.citation_speaker:
        citation_parts.append(f"Speaker: {hit.citation_speaker}")
    if hit.citation_context:
        citation_parts.append(f"Context: {hit.citation_context}")
    citation_parts.append(f"Quote: {hit.citation_text}")

    return " | ".join(citation_parts)


def format_hit_for_llm(hit: RetrievalHit, citation_number: int) -> str:
    """Format a single hit for LLM consumption with citation number.

    Args:
        hit: The retrieval hit to format
        citation_number: The citation reference number (e.g., 1 for <1>)

    Returns:
        Formatted string with source metadata, content, and optional citation reference.
        Returns empty string if hit has no meaningful content.
    """
    # Safety check: ensure hit has text content
    if not hit.text or not hit.text.strip():
        return ""

    # Build source metadata
    source_metadata = format_source_metadata(hit)
    source_info = f" [from: {source_metadata}]" if source_metadata else ""

    # Add citation number prominently at the start
    citation_tag = f"<{citation_number}>"

    # Format based on hit kind
    if hit.kind == "transcript_chunk":
        speakers = ", ".join(hit.chunk_speakers) if hit.chunk_speakers else "Unknown"
        start = f"{hit.chunk_start:.0f}s" if hit.chunk_start is not None else "?"
        end = f"{hit.chunk_end:.0f}s" if hit.chunk_end is not None else "?"
        formatted = (
            f"{citation_tag} [transcript_chunk:{hit.chunk_index}]{source_info} "
            f"[{speakers} • {start}–{end}]\n{hit.text}"
        )
    elif hit.kind == "takeaway":
        # Takeaways get special formatting with title and body
        title_part = f"**{hit.takeaway_title}**" if hit.takeaway_title else "Takeaway"
        formatted = (
            f"{citation_tag} [{hit.kind}:{hit.entity_id}]{source_info} {title_part}\n"
            f"{hit.takeaway_body}"
        )
    elif hit.kind == "source_section_summary":
        # Source sections show section title and summary
        section_title = hit.section_title or "Untitled Section"
        section_label = (
            f"{section_title}: {hit.section_subtitle}" if hit.section_subtitle else section_title
        )
        summary = hit.section_summary or ""
        formatted = (
            f"{citation_tag} [source_section:{hit.entity_id}]{source_info} "
            f'Section: "{section_label}" - {summary}'
        )
    else:
        # Start with the main content (citation or capture)
        formatted = f"{citation_tag} [{hit.kind}:{hit.entity_id}]{source_info} {hit.text}"

    # If this is a capture with an attached citation, include it for context
    citation_ref = format_citation_reference(hit)
    if citation_ref:
        formatted += f"\n  └─ Referenced citation: {citation_ref}"

    return formatted


def format_hits_for_llm(hits_with_ids: list[tuple[RetrievalHit, int]]) -> str:
    """Format multiple hits for LLM consumption using provided citation IDs.

    Args:
        hits_with_ids: List of (hit, citation_id) tuples

    Returns:
        Formatted string with all hits, or "No results found." if empty.
    """
    if not hits_with_ids:
        return "No results found."

    parts: list[str] = []

    for hit, cid in hits_with_ids:
        formatted = format_hit_for_llm(hit, cid)
        # Only include hits with meaningful content
        if formatted:
            parts.append(formatted)

    if not parts:
        return "No results found."

    return "\n\n".join(parts)
