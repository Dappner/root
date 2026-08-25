from pydantic import BaseModel


class AudioTranscribeResponse(BaseModel):
    transcript: str
    provider: str = "assemblyai"
    confidence: float | None = None
    duration_seconds: float | None = None
