"""Server-side TipTap document utilities.

Mirrors the editor's plain-text representation closely enough for embedding
documents and SHA-256 staleness comparisons. The node names walked here must
stay in sync with the frontend TipTap extensions.
"""

from __future__ import annotations

from typing import Any

_BLOCK_TYPES = frozenset(
    {
        "paragraph",
        "heading",
        "listItem",
        "blockquote",
        "codeBlock",
    }
)


def tiptap_to_plain_text(doc: dict | None) -> str:
    """Flatten a TipTap document to plain text.

    Walks the node tree, joining text within blocks and separating blocks with
    two newlines. Output approximates ``editor.getText()`` from the client so
    the server-derived ``body`` lines up with what users see.

    Custom node parity (must mirror the frontend):
    - ``citation`` — defined in
      frontend/src/features/notes/extensions/citation-node/index.ts (name: "citation").
      Cited text lives in ``node.content`` (inline children), not in attrs.
    If the editor renames or splits these nodes, mirror the change here or
    embeddings will silently drop the inline content.
    """
    if not doc:
        return ""

    out: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            out.append("".join(current).strip())
            current.clear()

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return
        node_type = node.get("type")
        if node_type == "text":
            text_value = node.get("text")
            if isinstance(text_value, str):
                current.append(text_value)
            return
        if node_type == "hardBreak":
            current.append("\n")
            return

        children = node.get("content") or []
        for child in children:
            walk(child)
        if node_type in _BLOCK_TYPES:
            flush()

    walk(doc)
    flush()

    return "\n\n".join(part for part in out if part)
