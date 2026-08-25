from __future__ import annotations

from typing import Any

from app.schemas.citations import UpdateCitationRequest


def update_kwargs_from_request(req: UpdateCitationRequest) -> dict[str, Any]:
    """Translate a PATCH payload into kwargs for CitationService.update.

    Distinguishes omitted from explicit-null:
      - omitted (not in model_fields_set): preserve
      - explicit None on a nullable field: clear (sets clear_<field>=True)
      - explicit value: assign
    """
    set_fields = req.model_fields_set
    kwargs: dict[str, Any] = {}

    if "info_type" in set_fields and req.info_type is not None:
        kwargs["info_type"] = req.info_type
    if "text" in set_fields and req.text is not None:
        kwargs["text"] = req.text
    if "summary" in set_fields:
        if req.summary is None:
            kwargs["clear_summary"] = True
        else:
            kwargs["summary"] = req.summary
    if "source_id" in set_fields and req.source_id is not None:
        kwargs["source_id"] = req.source_id
    if "section_id" in set_fields:
        if req.section_id is None:
            kwargs["clear_section"] = True
        else:
            kwargs["section_id"] = req.section_id
    if "location" in set_fields and req.location is not None:
        # Pydantic discriminated union instance; service serializes to JSON.
        kwargs["location"] = req.location
    if "speaker" in set_fields:
        if req.speaker is None:
            kwargs["clear_speaker"] = True
        else:
            kwargs["speaker"] = req.speaker
    if "context" in set_fields:
        if req.context is None:
            kwargs["clear_context"] = True
        else:
            kwargs["context"] = req.context
    return kwargs
