from pydantic import BaseModel, Field


class PlaybackProgressRequest(BaseModel):
    position_seconds: float = Field(ge=0)
    duration_seconds: float | None = Field(default=None, ge=0)
    is_playing: bool = True


class PlaybackProgressResponse(BaseModel):
    source_id: int
    position_seconds: float
    duration_seconds: float | None = None
