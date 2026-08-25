"""Database models for RAG service."""

from datetime import datetime
from decimal import Decimal
from typing import List, Literal

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    """User model (minimal - just for relationships)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    citations: Mapped[List["Citation"]] = relationship("Citation", back_populates="user")
    captures: Mapped[List["Capture"]] = relationship("Capture", back_populates="user")
    sources: Mapped[List["Source"]] = relationship("Source", back_populates="user")
    takeaways: Mapped[List["SourceTakeaway"]] = relationship(
        "SourceTakeaway", back_populates="user"
    )
    suggestions: Mapped[List["Suggestion"]] = relationship("Suggestion", back_populates="user")


class Source(Base):
    """Source model for books, articles, etc."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="todo")
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    summary_short: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_long: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reflecting_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    episode_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("podcast_episodes.id"), nullable=True
    )
    video_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("videos.id"), nullable=True)
    pdf_object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sources")
    citations: Mapped[List["Citation"]] = relationship("Citation", back_populates="source")
    captures: Mapped[List["Capture"]] = relationship("Capture", back_populates="source")
    takeaways: Mapped[List["SourceTakeaway"]] = relationship(
        "SourceTakeaway", back_populates="source"
    )
    suggestions: Mapped[List["Suggestion"]] = relationship("Suggestion", back_populates="source")


class Citation(Base):
    """Citation model for quotes/highlights from sources."""

    __tablename__ = "citations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    info_type: Mapped[Literal["quote", "stat", "fact", "paraphrase"]] = mapped_column(
        Enum(
            "quote",
            "stat",
            "fact",
            "paraphrase",
            name="info_type",
            create_type=False,
        ),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sources.id"), nullable=True)
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("source_sections.id"), nullable=True
    )
    location: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    text_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    speaker: Mapped[str | None] = mapped_column(Text, nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggestion_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("suggestions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # Relationships
    source: Mapped["Source"] = relationship("Source", back_populates="citations")
    user: Mapped["User"] = relationship("User", back_populates="citations")
    captures: Mapped[List["Capture"]] = relationship("Capture", back_populates="citation")


class Capture(Base):
    """Capture model for user's own thoughts/notes."""

    __tablename__ = "captures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    citation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("citations.id"), nullable=True
    )
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sources.id"), nullable=True)
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("source_sections.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suggestion_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("suggestions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    citation: Mapped["Citation | None"] = relationship("Citation", back_populates="captures")
    source: Mapped["Source"] = relationship("Source", back_populates="captures")
    user: Mapped["User"] = relationship("User", back_populates="captures")


class SourceTakeaway(Base):
    """Source takeaway model for key insights from sources."""

    __tablename__ = "source_takeaways"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    body_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="takeaways")
    source: Mapped["Source"] = relationship("Source", back_populates="takeaways")


class SourceTakeawayCitation(Base):
    """Join table linking takeaways to citations."""

    __tablename__ = "source_takeaway_citations"

    takeaway_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_takeaways.id"), primary_key=True
    )
    citation_id: Mapped[int] = mapped_column(Integer, ForeignKey("citations.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SourceTakeawayCapture(Base):
    """Join table linking takeaways to captures."""

    __tablename__ = "source_takeaway_captures"

    takeaway_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_takeaways.id"), primary_key=True
    )
    capture_id: Mapped[int] = mapped_column(Integer, ForeignKey("captures.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Note(Base):
    """Cross-source note with a TipTap JSON body."""

    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sources.id"), nullable=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    plain_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class NoteCitation(Base):
    """Join table linking notes to citations."""

    __tablename__ = "note_citations"

    note_id: Mapped[int] = mapped_column(Integer, ForeignKey("notes.id"), primary_key=True)
    citation_id: Mapped[int] = mapped_column(Integer, ForeignKey("citations.id"), primary_key=True)


class Tag(Base):
    """User-scoped tag, applied to sources via source_tags."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SourceTag(Base):
    """Join table associating sources with tags."""

    __tablename__ = "source_tags"

    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SourceSection(Base):
    """Source section model for chapters/sections within a source."""

    __tablename__ = "source_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_sha256: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    range_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    range_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generated_by: Mapped[str] = mapped_column(String, nullable=False, server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    source: Mapped["Source"] = relationship("Source")


class RagEmbedding(Base):
    """Embedding model for vector search."""

    __tablename__ = "rag_embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    citation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("citations.id"), nullable=True
    )
    capture_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("captures.id"), nullable=True
    )
    takeaway_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("source_takeaways.id"), nullable=True
    )
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("source_sections.id"), nullable=True
    )
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sources.id"), nullable=True)
    chunk_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding: Mapped[Vector] = mapped_column(Vector, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class PodcastEpisode(Base):
    """Podcast episode model for transcript generation."""

    __tablename__ = "podcast_episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    show_id: Mapped[int] = mapped_column(Integer, nullable=False)
    episode_guid: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    season: Mapped[int | None] = mapped_column(Integer, nullable=True)
    episode_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enclosure_url: Mapped[str | None] = mapped_column(String, nullable=True)
    r2_audio_key: Mapped[str | None] = mapped_column(String, nullable=True)

    # Transcript fields
    transcript_status: Mapped[Literal["none", "pending", "transcribed", "embedded", "failed"]] = (
        mapped_column(
            Enum(
                "none",
                "pending",
                "transcribed",
                "embedded",
                "failed",
                name="transcript_status",
                create_type=False,
            ),
            nullable=False,
            default="none",
        )
    )
    transcript_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source: Mapped[str | None] = mapped_column(String, nullable=True)

    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # attribute name `metadata` is reserved by SQLAlchemy Declarative; store column as "metadata"
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    suggestions: Mapped[List["Suggestion"]] = relationship("Suggestion", back_populates="episode")


class Suggestion(Base):
    """Pending/processed user suggestions, initially from mobile voice notes."""

    __tablename__ = "suggestions"
    __table_args__ = (
        Index("idx_suggestions_user_source_status", "user_id", "source_id", "status", "created_at"),
        Index("idx_suggestions_user_status", "user_id", "status", "created_at"),
        Index("idx_suggestions_source_created", "source_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), nullable=False)
    episode_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("podcast_episodes.id"), nullable=True
    )

    origin: Mapped[Literal["mobile_voice"]] = mapped_column(
        Enum("mobile_voice", name="suggestion_origin_enum", create_type=False),
        nullable=False,
        default="mobile_voice",
    )
    status: Mapped[
        Literal["uploaded", "processing", "ready", "failed", "approved", "dismissed"]
    ] = mapped_column(
        Enum(
            "uploaded",
            "processing",
            "ready",
            "failed",
            "approved",
            "dismissed",
            name="suggestion_processing_status",
            create_type=False,
        ),
        nullable=False,
        default="uploaded",
    )
    suggested_action: Mapped[
        Literal[
            "create_citation",
            "create_capture",
            "create_citation_with_capture",
            "create_entities",
            "uncertain",
        ]
        | None
    ] = mapped_column(
        Enum(
            "create_citation",
            "create_capture",
            "create_citation_with_capture",
            "create_entities",
            "uncertain",
            name="suggestion_action_enum",
            create_type=False,
        ),
        nullable=True,
    )

    playback_position_seconds: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    audio_r2_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    suggested_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    processing_metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="suggestions")
    source: Mapped["Source"] = relationship("Source", back_populates="suggestions")
    episode: Mapped["PodcastEpisode | None"] = relationship(
        "PodcastEpisode", back_populates="suggestions"
    )


class Show(Base):
    """Podcast show (syndicated). Shared across users."""

    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    rss_feed_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(Text, nullable=True)
    explicit: Mapped[bool | None] = mapped_column(nullable=True)
    categories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Channel(Base):
    """Video channel (e.g., YouTube channel). Shared across users."""

    __tablename__ = "channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    platform_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscriber_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    custom_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Video(Base):
    """Video model for video transcript generation."""

    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)  # 'youtube', 'vimeo'
    platform_id: Mapped[str] = mapped_column(String, nullable=False)  # YouTube video ID
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    view_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    embed_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Transcript fields
    transcript_status: Mapped[Literal["none", "pending", "transcribed", "embedded", "failed"]] = (
        mapped_column(
            Enum(
                "none",
                "pending",
                "transcribed",
                "embedded",
                "failed",
                name="transcript_status",
                create_type=False,
            ),
            nullable=False,
            default="none",
        )
    )
    transcript_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source: Mapped[str | None] = mapped_column(String, nullable=True)

    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Collection(Base):
    """Group of sources curated by a user. Sources can belong to many
    collections; collections do not own their sources (deleting a collection
    leaves the sources intact)."""

    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CollectionSource(Base):
    """Join row between a collection and a source. Both sides are ON DELETE
    CASCADE in the schema, so this row goes away when either parent does."""

    __tablename__ = "collection_sources"

    collection_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
