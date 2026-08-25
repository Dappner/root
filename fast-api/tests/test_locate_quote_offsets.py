"""Unit tests for locate_quote_offsets — the deterministic quote-within-utterance
offset locator that makes the stored citation char offsets bracket the exact
quote (the SoT the transcript view highlights against)."""

from app.services.suggestion_service import locate_quote_offsets


def _utts(*texts: str) -> list[dict[str, object]]:
    return [{"text": t} for t in texts]


def test_single_utterance_mid_phrase():
    """The common case: a short quote inside one long utterance. Offsets must
    bracket exactly the quote, not the whole utterance (the original bug)."""
    full = (
        "Intro filler. What this is is X AI SpaceX, Grok basically saying, "
        "we're not going to be a leading edge model contender. Then rambling continues."
    )
    quote = (
        "What this is is X AI SpaceX, Grok basically saying, "
        "we're not going to be a leading edge model contender."
    )
    offsets = locate_quote_offsets(
        utterances=_utts(full),
        utterance_start_idx=0,
        utterance_end_idx=0,
        quote_text=quote,
    )
    assert offsets is not None
    start, end = offsets
    assert full[start:end] == quote


def test_quote_at_utterance_start():
    full = "Intro filler. Then more."
    offsets = locate_quote_offsets(
        utterances=_utts(full),
        utterance_start_idx=0,
        utterance_end_idx=0,
        quote_text="Intro filler.",
    )
    assert offsets == (0, len("Intro filler."))


def test_multi_utterance_span():
    """A quote spanning two utterances: start offset into utt0, end into utt1."""
    utts = _utts("alpha beta gamma", "delta epsilon zeta")
    offsets = locate_quote_offsets(
        utterances=utts,
        utterance_start_idx=0,
        utterance_end_idx=1,
        quote_text="gamma delta",
    )
    assert offsets is not None
    start, end = offsets
    assert utts[0]["text"][start:] == "gamma"
    assert utts[1]["text"][:end] == "delta"


def test_normalized_fallback_smart_quotes():
    """Smart quotes in the LLM text still locate against straight quotes."""
    full = "He said don't worry about it now."
    offsets = locate_quote_offsets(
        utterances=_utts(full),
        utterance_start_idx=0,
        utterance_end_idx=0,
        quote_text="don’t worry",  # curly apostrophe
    )
    assert offsets is not None
    start, end = offsets
    assert full[start:end] == "don't worry"


def test_not_found_returns_none():
    """Unlocatable text returns None so the caller falls back to whole-utterance
    offsets rather than emitting a wrong span."""
    offsets = locate_quote_offsets(
        utterances=_utts("Some unrelated transcript line."),
        utterance_start_idx=0,
        utterance_end_idx=0,
        quote_text="a phrase that does not appear",
    )
    assert offsets is None


def test_empty_quote_returns_none():
    assert (
        locate_quote_offsets(
            utterances=_utts("anything"),
            utterance_start_idx=0,
            utterance_end_idx=0,
            quote_text="",
        )
        is None
    )
