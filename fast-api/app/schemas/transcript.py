from pydantic import BaseModel


class GenerateTranscriptRequest(BaseModel):
    """Request to generate a podcast transcript."""

    episode_id: int


class GenerateVideoTranscriptRequest(BaseModel):
    """Request to generate a video transcript."""

    video_id: int


class GenerateTranscriptResponse(BaseModel):
    status: str
    url: str | None = None


class BackfillSectionsRequest(BaseModel):
    force: bool = False


class BackfillSectionsResponse(BaseModel):
    queued: int
    skipped: int


class BackfillCitationSectionsResponse(BaseModel):
    citations_updated: int
    captures_updated: int


class TranscriptUtterance(BaseModel):
    """An utterance in the transcript (speaker-labeled segment).

    Note: confidence and speaker may be None for YouTube captions.
    """

    text: str
    start: float  # seconds
    end: float  # seconds
    confidence: float | None = None  # May be None for YouTube captions
    speaker: str | None = None  # May be None for YouTube captions


class TranscriptSpeaker(BaseModel):
    """Speaker metadata."""

    id: str
    utterance_count: int


class TranscriptMetadata(BaseModel):
    """Metadata about the transcript.

    Fields vary by source (AssemblyAI vs YouTube captions).
    """

    source: str | None = None  # 'assemblyai' or 'youtube_captions'
    id: str | None = None  # AssemblyAI transcript ID
    audio_duration: float | None = None
    confidence: float | None = None
    segment_count: int | None = None  # For YouTube captions


class TranscriptData(BaseModel):
    """Complete transcript data structure.

    Works for both podcast and video transcripts.
    """

    full_text: str
    utterances: list[TranscriptUtterance]
    speakers: dict[str, TranscriptSpeaker]
    metadata: TranscriptMetadata
