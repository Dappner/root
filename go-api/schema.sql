--
-- PostgreSQL database dump
--

\restrict quTnHPLaDA5PDglOAI0dSAeBIDXtvhFsmcRIOSGWxOknYyQ6x4x5vzuD5LSLa4L

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg12+1)
-- Dumped by pg_dump version 17.7 (Debian 17.7-3.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: paradedb; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA paradedb;


--
-- Name: pg_search; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_search WITH SCHEMA paradedb;


--
-- Name: EXTENSION pg_search; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_search IS 'pg_search: Full text search for PostgreSQL using BM25';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: user_role; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.user_role AS ENUM (
    'user',
    'admin'
);


--
-- Name: channel_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_platform AS ENUM (
    'youtube',
    'vimeo'
);


--
-- Name: info_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.info_type AS ENUM (
    'quote',
    'stat',
    'fact',
    'paraphrase'
);


--
-- Name: item_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.item_type_enum AS ENUM (
    'takeaway',
    'citation',
    'idea'
);


--
-- Name: review_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_outcome AS ENUM (
    'forgot',
    'hard',
    'good',
    'easy'
);


--
-- Name: review_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_state AS ENUM (
    'new',
    'learning',
    'review',
    'suspended'
);


--
-- Name: review_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_type_enum AS ENUM (
    'qa',
    'quote_recall'
);


--
-- Name: suggestion_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_action_enum AS ENUM (
    'create_citation',
    'create_capture',
    'create_citation_with_capture',
    'uncertain',
    'create_entities'
);


--
-- Name: suggestion_origin_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_origin_enum AS ENUM (
    'mobile_voice'
);


--
-- Name: suggestion_processing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_processing_status AS ENUM (
    'uploaded',
    'processing',
    'ready',
    'failed',
    'approved',
    'dismissed'
);


--
-- Name: suggestion_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suggestion_status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


--
-- Name: transcript_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transcript_status AS ENUM (
    'none',
    'pending',
    'transcribed',
    'failed',
    'embedded'
);


--
-- Name: prevent_source_type_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_source_type_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.type IS DISTINCT FROM OLD.type THEN
        RAISE EXCEPTION 'source type cannot be changed';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validate_polymorphic_reference_v1(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_polymorphic_reference_v1() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    found_source_id INTEGER;
BEGIN
    -- 1. Validate reference exists and belongs to user
    IF NEW.item_type = 'takeaway' THEN
        SELECT source_id INTO found_source_id
        FROM source_takeaways
        WHERE id = NEW.item_id AND user_id = NEW.user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid takeaway reference or user mismatch';
        END IF;

        NEW.source_id := found_source_id;

    ELSIF NEW.item_type = 'citation' THEN
        SELECT source_id INTO found_source_id
        FROM citations
        WHERE id = NEW.item_id AND user_id = NEW.user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid citation reference or user mismatch';
        END IF;

        NEW.source_id := found_source_id;

    ELSIF NEW.item_type = 'idea' THEN
        -- Future: validate against ideas table
        RAISE EXCEPTION 'Idea item type not yet supported';

    ELSE
        RAISE EXCEPTION 'Invalid item_type: %', NEW.item_type;
    END IF;

    -- 2. Auto-set source_id from referenced item (prevents drift)
    -- Already done in SELECT above

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.account (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp without time zone,
    refresh_token_expires_at timestamp without time zone,
    scope text,
    password text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.jwks (
    id text NOT NULL,
    public_key text NOT NULL,
    private_key text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.session (
    id text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL,
    impersonated_by text
);


--
-- Name: user; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    role auth.user_role DEFAULT 'user'::auth.user_role NOT NULL,
    banned boolean DEFAULT false,
    ban_reason text,
    ban_expires timestamp without time zone,
    image text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: verification; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: captures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captures (
    id integer NOT NULL,
    user_id text NOT NULL,
    citation_id integer,
    source_id integer,
    section_id integer,
    content text NOT NULL,
    summary text,
    content_sha256 character(64),
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    suggestion_id integer
);


--
-- Name: captures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.captures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: captures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.captures_id_seq OWNED BY public.captures.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id integer NOT NULL,
    platform public.channel_platform NOT NULL,
    platform_id text NOT NULL,
    name text NOT NULL,
    description text,
    thumbnail_url text,
    subscriber_count integer,
    video_count integer,
    custom_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citations (
    id integer NOT NULL,
    user_id text NOT NULL,
    info_type public.info_type NOT NULL,
    text text NOT NULL,
    summary text,
    source_id integer,
    location jsonb,
    text_sha256 character(64),
    section_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    speaker text,
    context text,
    suggestion_id integer
);


--
-- Name: citations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citations_id_seq OWNED BY public.citations.id;


--
-- Name: collection_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_sources (
    collection_id integer NOT NULL,
    source_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    user_id text NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: note_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_citations (
    note_id integer NOT NULL,
    citation_id integer NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    user_id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    body jsonb DEFAULT '{}'::jsonb NOT NULL,
    plain_text text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'note'::text NOT NULL,
    source_id integer,
    CONSTRAINT notes_kind_check CHECK ((kind = ANY (ARRAY['note'::text, 'insight'::text])))
);


--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: podcast_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.podcast_episodes (
    id integer NOT NULL,
    show_id integer NOT NULL,
    episode_guid text NOT NULL,
    title text NOT NULL,
    description text,
    season integer,
    episode_number integer,
    duration integer,
    enclosure_url text,
    transcript_status public.transcript_status DEFAULT 'none'::public.transcript_status NOT NULL,
    transcript_error text,
    image_url text,
    published_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    transcript_source text DEFAULT 'assemblyai'::text,
    r2_audio_key text
);


--
-- Name: podcast_episodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.podcast_episodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: podcast_episodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.podcast_episodes_id_seq OWNED BY public.podcast_episodes.id;


--
-- Name: rag_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_embeddings (
    id integer NOT NULL,
    content_sha256 character(64) NOT NULL,
    embedding public.vector(1024) NOT NULL,
    model character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    citation_id integer,
    capture_id integer,
    takeaway_id integer,
    section_id integer,
    source_id integer,
    chunk_index integer,
    CONSTRAINT chk_rag_embeddings_exactly_one_fk CHECK ((((((((citation_id IS NOT NULL))::integer + ((capture_id IS NOT NULL))::integer) + ((takeaway_id IS NOT NULL))::integer) + ((section_id IS NOT NULL))::integer) + ((source_id IS NOT NULL))::integer) = 1))
);


--
-- Name: rag_embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_embeddings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_embeddings_id_seq OWNED BY public.rag_embeddings.id;


--
-- Name: review_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_items (
    id integer NOT NULL,
    user_id text NOT NULL,
    item_type public.item_type_enum NOT NULL,
    item_id integer NOT NULL,
    prompt text NOT NULL,
    prompt_sha256 character(64) NOT NULL,
    answer text,
    answer_sha256 character(64),
    review_type public.review_type_enum NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_id integer,
    idea_id integer,
    state public.review_state DEFAULT 'new'::public.review_state NOT NULL,
    introduced_at timestamp with time zone,
    due_at timestamp with time zone DEFAULT (now() + '1 day'::interval) NOT NULL,
    ease_factor real DEFAULT 2.5 NOT NULL,
    interval_days integer DEFAULT 0 NOT NULL,
    repetitions integer DEFAULT 0 NOT NULL,
    last_reviewed_at timestamp with time zone,
    suspended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_items_id_seq OWNED BY public.review_items.id;


--
-- Name: review_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_suggestions (
    id integer NOT NULL,
    user_id text NOT NULL,
    source_id integer NOT NULL,
    item_type public.item_type_enum NOT NULL,
    item_id integer NOT NULL,
    prompt text NOT NULL,
    prompt_sha256 character(64) NOT NULL,
    answer text,
    answer_sha256 character(64),
    review_type public.review_type_enum NOT NULL,
    reasoning text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public.suggestion_status DEFAULT 'pending'::public.suggestion_status NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_suggestions_id_seq OWNED BY public.review_suggestions.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    user_id text NOT NULL,
    review_item_id integer NOT NULL,
    outcome public.review_outcome NOT NULL,
    time_taken_ms integer,
    reviewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


--
-- Name: shows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shows (
    id integer NOT NULL,
    slug text NOT NULL,
    rss_feed_url text NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    language text,
    explicit boolean,
    categories jsonb,
    author text,
    link text,
    last_synced_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shows_id_seq OWNED BY public.shows.id;


--
-- Name: source_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_sections (
    id integer NOT NULL,
    source_id integer NOT NULL,
    title text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    range_start integer,
    range_end integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    summary text,
    summary_sha256 character(64),
    subtitle text,
    generated_by text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT chk_section_summary_length CHECK (((summary IS NULL) OR (length(summary) <= 1024))),
    CONSTRAINT source_sections_generated_by_check CHECK ((generated_by = ANY (ARRAY['user'::text, 'auto'::text])))
);


--
-- Name: source_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.source_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.source_sections_id_seq OWNED BY public.source_sections.id;


--
-- Name: source_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_tags (
    source_id integer NOT NULL,
    tag_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: source_takeaway_captures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_takeaway_captures (
    takeaway_id integer NOT NULL,
    capture_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: source_takeaway_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_takeaway_citations (
    takeaway_id integer NOT NULL,
    citation_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: source_takeaways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_takeaways (
    id integer NOT NULL,
    user_id text NOT NULL,
    source_id integer NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    content_sha256 character(64),
    body_json jsonb
);


--
-- Name: source_takeaways_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.source_takeaways_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_takeaways_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.source_takeaways_id_seq OWNED BY public.source_takeaways.id;


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id integer NOT NULL,
    user_id text NOT NULL,
    title character varying(500),
    type character varying(50) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary_short text,
    summary_long text,
    last_active_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    label character varying(100),
    author character varying(255),
    published_at timestamp without time zone,
    episode_id integer,
    video_id integer,
    status text DEFAULT 'todo'::text NOT NULL,
    pdf_object_key text,
    started_at timestamp without time zone,
    reflecting_at timestamp without time zone,
    CONSTRAINT sources_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'reflecting'::text, 'done'::text])))
);


--
-- Name: sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sources_id_seq OWNED BY public.sources.id;


--
-- Name: suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestions (
    id integer NOT NULL,
    client_id text,
    user_id text NOT NULL,
    source_id integer NOT NULL,
    episode_id integer,
    origin public.suggestion_origin_enum DEFAULT 'mobile_voice'::public.suggestion_origin_enum NOT NULL,
    status public.suggestion_processing_status DEFAULT 'uploaded'::public.suggestion_processing_status NOT NULL,
    suggested_action public.suggestion_action_enum,
    playback_position_seconds numeric,
    recorded_at timestamp with time zone,
    audio_r2_key text,
    voice_transcript text,
    suggested_payload jsonb,
    processing_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone
);


--
-- Name: suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suggestions_id_seq OWNED BY public.suggestions.id;


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    user_id text NOT NULL,
    slug character varying(64) NOT NULL,
    label character varying(128) NOT NULL,
    color character varying(16),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    id integer NOT NULL,
    channel_id integer,
    platform public.channel_platform NOT NULL,
    platform_id text NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    duration integer,
    view_count bigint,
    embed_url text,
    transcript_status public.transcript_status DEFAULT 'none'::public.transcript_status NOT NULL,
    transcript_error text,
    transcript_source text,
    published_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: videos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.videos_id_seq OWNED BY public.videos.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: captures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures ALTER COLUMN id SET DEFAULT nextval('public.captures_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: citations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations ALTER COLUMN id SET DEFAULT nextval('public.citations_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: podcast_episodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podcast_episodes ALTER COLUMN id SET DEFAULT nextval('public.podcast_episodes_id_seq'::regclass);


--
-- Name: rag_embeddings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings ALTER COLUMN id SET DEFAULT nextval('public.rag_embeddings_id_seq'::regclass);


--
-- Name: review_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_items ALTER COLUMN id SET DEFAULT nextval('public.review_items_id_seq'::regclass);


--
-- Name: review_suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_suggestions ALTER COLUMN id SET DEFAULT nextval('public.review_suggestions_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: shows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows ALTER COLUMN id SET DEFAULT nextval('public.shows_id_seq'::regclass);


--
-- Name: source_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_sections ALTER COLUMN id SET DEFAULT nextval('public.source_sections_id_seq'::regclass);


--
-- Name: source_takeaways id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaways ALTER COLUMN id SET DEFAULT nextval('public.source_takeaways_id_seq'::regclass);


--
-- Name: sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources ALTER COLUMN id SET DEFAULT nextval('public.sources_id_seq'::regclass);


--
-- Name: suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions ALTER COLUMN id SET DEFAULT nextval('public.suggestions_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: videos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos ALTER COLUMN id SET DEFAULT nextval('public.videos_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: captures captures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: channels channels_platform_platform_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_platform_platform_id_key UNIQUE (platform, platform_id);


--
-- Name: citations citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_pkey PRIMARY KEY (id);


--
-- Name: collection_sources collection_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_pkey PRIMARY KEY (collection_id, source_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: note_citations note_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_citations
    ADD CONSTRAINT note_citations_pkey PRIMARY KEY (note_id, citation_id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: podcast_episodes podcast_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podcast_episodes
    ADD CONSTRAINT podcast_episodes_pkey PRIMARY KEY (id);


--
-- Name: podcast_episodes podcast_episodes_show_id_episode_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podcast_episodes
    ADD CONSTRAINT podcast_episodes_show_id_episode_guid_key UNIQUE (show_id, episode_guid);


--
-- Name: rag_embeddings rag_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_pkey PRIMARY KEY (id);


--
-- Name: review_items review_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_items
    ADD CONSTRAINT review_items_pkey PRIMARY KEY (id);


--
-- Name: review_items review_items_user_id_item_type_item_id_prompt_sha256_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_items
    ADD CONSTRAINT review_items_user_id_item_type_item_id_prompt_sha256_key UNIQUE (user_id, item_type, item_id, prompt_sha256);


--
-- Name: review_suggestions review_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_suggestions
    ADD CONSTRAINT review_suggestions_pkey PRIMARY KEY (id);


--
-- Name: review_suggestions review_suggestions_user_id_item_type_item_id_prompt_sha256_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_suggestions
    ADD CONSTRAINT review_suggestions_user_id_item_type_item_id_prompt_sha256_key UNIQUE (user_id, item_type, item_id, prompt_sha256);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: shows shows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_pkey PRIMARY KEY (id);


--
-- Name: shows shows_rss_feed_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_rss_feed_url_key UNIQUE (rss_feed_url);


--
-- Name: shows shows_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_slug_key UNIQUE (slug);


--
-- Name: source_sections source_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_sections
    ADD CONSTRAINT source_sections_pkey PRIMARY KEY (id);


--
-- Name: source_tags source_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_tags
    ADD CONSTRAINT source_tags_pkey PRIMARY KEY (source_id, tag_id);


--
-- Name: source_takeaway_captures source_takeaway_captures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_captures
    ADD CONSTRAINT source_takeaway_captures_pkey PRIMARY KEY (takeaway_id, capture_id);


--
-- Name: source_takeaway_citations source_takeaway_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_citations
    ADD CONSTRAINT source_takeaway_citations_pkey PRIMARY KEY (takeaway_id, citation_id);


--
-- Name: source_takeaways source_takeaways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaways
    ADD CONSTRAINT source_takeaways_pkey PRIMARY KEY (id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: suggestions suggestions_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_client_id_key UNIQUE (client_id);


--
-- Name: suggestions suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_user_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_user_id_slug_key UNIQUE (user_id, slug);


--
-- Name: rag_embeddings uq_rag_embeddings_capture; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT uq_rag_embeddings_capture UNIQUE (capture_id);


--
-- Name: rag_embeddings uq_rag_embeddings_citation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT uq_rag_embeddings_citation UNIQUE (citation_id);


--
-- Name: rag_embeddings uq_rag_embeddings_section; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT uq_rag_embeddings_section UNIQUE (section_id);


--
-- Name: rag_embeddings uq_rag_embeddings_source_chunk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT uq_rag_embeddings_source_chunk UNIQUE (source_id, chunk_index);


--
-- Name: rag_embeddings uq_rag_embeddings_takeaway; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT uq_rag_embeddings_takeaway UNIQUE (takeaway_id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: videos videos_platform_platform_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_platform_platform_id_key UNIQUE (platform, platform_id);


--
-- Name: idx_auth_account_provider_account; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX idx_auth_account_provider_account ON auth.account USING btree (provider_id, account_id);


--
-- Name: idx_auth_account_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_account_user_id ON auth.account USING btree (user_id);


--
-- Name: idx_auth_session_expires_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_session_expires_at ON auth.session USING btree (expires_at);


--
-- Name: idx_auth_session_token; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_session_token ON auth.session USING btree (token);


--
-- Name: idx_auth_session_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_session_user_id ON auth.session USING btree (user_id);


--
-- Name: idx_auth_user_banned; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_user_banned ON auth."user" USING btree (banned);


--
-- Name: idx_auth_user_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_user_email ON auth."user" USING btree (email);


--
-- Name: idx_auth_user_role; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_user_role ON auth."user" USING btree (role);


--
-- Name: idx_auth_verification_identifier; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_verification_identifier ON auth.verification USING btree (identifier);


--
-- Name: idx_auth_verification_value; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_verification_value ON auth.verification USING btree (value);


--
-- Name: idx_captures_citation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_citation_id ON public.captures USING btree (citation_id);


--
-- Name: idx_captures_content_bm25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_content_bm25 ON public.captures USING bm25 (id, content) WITH (key_field=id);


--
-- Name: idx_captures_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_content_search ON public.captures USING gin (to_tsvector('english'::regconfig, content));


--
-- Name: idx_captures_content_sha256; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_content_sha256 ON public.captures USING btree (content_sha256);


--
-- Name: idx_captures_section_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_section_id ON public.captures USING btree (section_id);


--
-- Name: idx_captures_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_source_id ON public.captures USING btree (source_id);


--
-- Name: idx_captures_suggestion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_suggestion_id ON public.captures USING btree (suggestion_id) WHERE (suggestion_id IS NOT NULL);


--
-- Name: idx_captures_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_user_created ON public.captures USING btree (user_id, created_at DESC);


--
-- Name: idx_captures_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_captures_user_id ON public.captures USING btree (user_id);


--
-- Name: idx_channels_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_name ON public.channels USING btree (name);


--
-- Name: idx_channels_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_platform ON public.channels USING btree (platform);


--
-- Name: idx_channels_platform_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_platform_id ON public.channels USING btree (platform, platform_id);


--
-- Name: idx_citations_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_source_id ON public.citations USING btree (source_id);


--
-- Name: idx_citations_suggestion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_suggestion_id ON public.citations USING btree (suggestion_id) WHERE (suggestion_id IS NOT NULL);


--
-- Name: idx_citations_text_bm25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_text_bm25 ON public.citations USING bm25 (id, text) WITH (key_field=id);


--
-- Name: idx_citations_text_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_text_search ON public.citations USING gin (to_tsvector('english'::regconfig, text));


--
-- Name: idx_citations_text_sha256; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_text_sha256 ON public.citations USING btree (user_id, text_sha256);


--
-- Name: idx_citations_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_user_created ON public.citations USING btree (user_id, created_at DESC);


--
-- Name: idx_citations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citations_user_id ON public.citations USING btree (user_id);


--
-- Name: idx_collection_sources_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_sources_source_id ON public.collection_sources USING btree (source_id);


--
-- Name: idx_collections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_user_id ON public.collections USING btree (user_id);


--
-- Name: idx_note_citations_citation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_citations_citation_id ON public.note_citations USING btree (citation_id);


--
-- Name: idx_notes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_user_id ON public.notes USING btree (user_id);


--
-- Name: idx_notes_user_id_source_id_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_user_id_source_id_updated_at ON public.notes USING btree (user_id, source_id, updated_at DESC);


--
-- Name: idx_podcast_episodes_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_podcast_episodes_guid ON public.podcast_episodes USING btree (episode_guid);


--
-- Name: idx_podcast_episodes_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_podcast_episodes_published ON public.podcast_episodes USING btree (published_at DESC);


--
-- Name: idx_podcast_episodes_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_podcast_episodes_show ON public.podcast_episodes USING btree (show_id);


--
-- Name: idx_podcast_episodes_transcript_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_podcast_episodes_transcript_status ON public.podcast_episodes USING btree (transcript_status) WHERE (transcript_status <> 'none'::public.transcript_status);


--
-- Name: idx_rag_embeddings_capture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_capture ON public.rag_embeddings USING btree (capture_id) WHERE (capture_id IS NOT NULL);


--
-- Name: idx_rag_embeddings_citation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_citation ON public.rag_embeddings USING btree (citation_id) WHERE (citation_id IS NOT NULL);


--
-- Name: idx_rag_embeddings_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_content_hash ON public.rag_embeddings USING btree (content_sha256);


--
-- Name: idx_rag_embeddings_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_section ON public.rag_embeddings USING btree (section_id) WHERE (section_id IS NOT NULL);


--
-- Name: idx_rag_embeddings_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_source ON public.rag_embeddings USING btree (source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_rag_embeddings_takeaway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_embeddings_takeaway ON public.rag_embeddings USING btree (takeaway_id) WHERE (takeaway_id IS NOT NULL);


--
-- Name: idx_review_items_idea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_items_idea ON public.review_items USING btree (idea_id) WHERE (idea_id IS NOT NULL);


--
-- Name: idx_review_items_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_items_source ON public.review_items USING btree (source_id) WHERE (source_id IS NOT NULL);


--
-- Name: idx_review_items_user_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_items_user_due ON public.review_items USING btree (user_id, due_at) WHERE (state <> 'suspended'::public.review_state);


--
-- Name: idx_review_items_user_new; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_items_user_new ON public.review_items USING btree (user_id, created_at) WHERE (state = 'new'::public.review_state);


--
-- Name: idx_review_suggestions_user_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_suggestions_user_pending ON public.review_suggestions USING btree (user_id, source_id) WHERE (status = 'pending'::public.suggestion_status);


--
-- Name: idx_reviews_item_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_item_time ON public.reviews USING btree (review_item_id, reviewed_at DESC);


--
-- Name: idx_reviews_user_reviewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user_reviewed ON public.reviews USING btree (user_id, reviewed_at DESC);


--
-- Name: idx_shows_last_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_last_synced ON public.shows USING btree (last_synced_at);


--
-- Name: idx_shows_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_slug ON public.shows USING btree (slug);


--
-- Name: idx_shows_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_title ON public.shows USING btree (title);


--
-- Name: idx_source_sections_source_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_sections_source_generated ON public.source_sections USING btree (source_id, generated_by);


--
-- Name: idx_source_sections_source_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_sections_source_order ON public.source_sections USING btree (source_id, order_index);


--
-- Name: idx_source_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_tags_tag_id ON public.source_tags USING btree (tag_id);


--
-- Name: idx_source_takeaways_bm25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_takeaways_bm25 ON public.source_takeaways USING bm25 (id, title, body) WITH (key_field=id);


--
-- Name: idx_source_takeaways_content_sha256; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_takeaways_content_sha256 ON public.source_takeaways USING btree (content_sha256);


--
-- Name: idx_source_takeaways_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_takeaways_fts ON public.source_takeaways USING gin (to_tsvector('english'::regconfig, (((title)::text || ' '::text) || body)));


--
-- Name: idx_source_takeaways_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_takeaways_source ON public.source_takeaways USING btree (source_id);


--
-- Name: idx_source_takeaways_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_takeaways_user ON public.source_takeaways USING btree (user_id);


--
-- Name: idx_sources_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_archived ON public.sources USING btree (user_id, completed_at DESC) WHERE (completed_at IS NOT NULL);


--
-- Name: idx_sources_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_episode ON public.sources USING btree (episode_id);


--
-- Name: idx_sources_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_label ON public.sources USING btree (label);


--
-- Name: idx_sources_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_last_active ON public.sources USING btree (user_id, last_active_at DESC NULLS LAST) WHERE (completed_at IS NULL);


--
-- Name: idx_sources_pdf_object_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_pdf_object_key ON public.sources USING btree (pdf_object_key) WHERE (pdf_object_key IS NOT NULL);


--
-- Name: idx_sources_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_user_id ON public.sources USING btree (user_id);


--
-- Name: idx_sources_user_id_status_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_user_id_status_updated_at ON public.sources USING btree (user_id, status, updated_at DESC);


--
-- Name: idx_sources_user_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_user_published_at ON public.sources USING btree (user_id, published_at DESC NULLS LAST);


--
-- Name: idx_sources_video; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sources_video ON public.sources USING btree (video_id);


--
-- Name: idx_suggestions_source_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_source_created ON public.suggestions USING btree (source_id, created_at DESC);


--
-- Name: idx_suggestions_user_source_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_user_source_status ON public.suggestions USING btree (user_id, source_id, status, created_at DESC);


--
-- Name: idx_suggestions_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_user_status ON public.suggestions USING btree (user_id, status, created_at DESC);


--
-- Name: idx_tags_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_user_id ON public.tags USING btree (user_id);


--
-- Name: idx_takeaway_captures_capture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_takeaway_captures_capture ON public.source_takeaway_captures USING btree (capture_id);


--
-- Name: idx_takeaway_captures_takeaway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_takeaway_captures_takeaway ON public.source_takeaway_captures USING btree (takeaway_id);


--
-- Name: idx_takeaway_citations_citation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_takeaway_citations_citation ON public.source_takeaway_citations USING btree (citation_id);


--
-- Name: idx_takeaway_citations_takeaway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_takeaway_citations_takeaway ON public.source_takeaway_citations USING btree (takeaway_id);


--
-- Name: idx_videos_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_channel ON public.videos USING btree (channel_id);


--
-- Name: idx_videos_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_platform ON public.videos USING btree (platform);


--
-- Name: idx_videos_platform_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_platform_id ON public.videos USING btree (platform, platform_id);


--
-- Name: idx_videos_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_published ON public.videos USING btree (published_at DESC);


--
-- Name: idx_videos_transcript_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_transcript_status ON public.videos USING btree (transcript_status) WHERE (transcript_status <> 'none'::public.transcript_status);


--
-- Name: sources trg_prevent_source_type_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_source_type_change BEFORE UPDATE OF type ON public.sources FOR EACH ROW EXECUTE FUNCTION public.prevent_source_type_change();


--
-- Name: review_items validate_review_item_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_review_item_reference BEFORE INSERT OR UPDATE ON public.review_items FOR EACH ROW EXECUTE FUNCTION public.validate_polymorphic_reference_v1();


--
-- Name: review_suggestions validate_review_suggestion_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_review_suggestion_reference BEFORE INSERT OR UPDATE ON public.review_suggestions FOR EACH ROW EXECUTE FUNCTION public.validate_polymorphic_reference_v1();


--
-- Name: account account_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.account
    ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_impersonated_by_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.session
    ADD CONSTRAINT session_impersonated_by_fkey FOREIGN KEY (impersonated_by) REFERENCES auth."user"(id);


--
-- Name: session session_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.session
    ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: captures captures_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.citations(id) ON DELETE SET NULL;


--
-- Name: captures captures_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.source_sections(id) ON DELETE SET NULL;


--
-- Name: captures captures_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE SET NULL;


--
-- Name: captures captures_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id) ON DELETE SET NULL;


--
-- Name: captures captures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captures
    ADD CONSTRAINT captures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: citations citations_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.source_sections(id) ON DELETE SET NULL;


--
-- Name: citations citations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE SET NULL;


--
-- Name: citations citations_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id) ON DELETE SET NULL;


--
-- Name: citations citations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citations
    ADD CONSTRAINT citations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: collection_sources collection_sources_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_sources collection_sources_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: collections collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: note_citations note_citations_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_citations
    ADD CONSTRAINT note_citations_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.citations(id) ON DELETE CASCADE;


--
-- Name: note_citations note_citations_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_citations
    ADD CONSTRAINT note_citations_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: notes notes_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: podcast_episodes podcast_episodes_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podcast_episodes
    ADD CONSTRAINT podcast_episodes_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: rag_embeddings rag_embeddings_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.captures(id) ON DELETE CASCADE;


--
-- Name: rag_embeddings rag_embeddings_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.citations(id) ON DELETE CASCADE;


--
-- Name: rag_embeddings rag_embeddings_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.source_sections(id) ON DELETE CASCADE;


--
-- Name: rag_embeddings rag_embeddings_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: rag_embeddings rag_embeddings_takeaway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_embeddings
    ADD CONSTRAINT rag_embeddings_takeaway_id_fkey FOREIGN KEY (takeaway_id) REFERENCES public.source_takeaways(id) ON DELETE CASCADE;


--
-- Name: review_items review_items_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_items
    ADD CONSTRAINT review_items_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE SET NULL;


--
-- Name: review_items review_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_items
    ADD CONSTRAINT review_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: review_suggestions review_suggestions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_suggestions
    ADD CONSTRAINT review_suggestions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: review_suggestions review_suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_suggestions
    ADD CONSTRAINT review_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_review_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_review_item_id_fkey FOREIGN KEY (review_item_id) REFERENCES public.review_items(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: source_sections source_sections_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_sections
    ADD CONSTRAINT source_sections_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: source_tags source_tags_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_tags
    ADD CONSTRAINT source_tags_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: source_tags source_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_tags
    ADD CONSTRAINT source_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: source_takeaway_captures source_takeaway_captures_capture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_captures
    ADD CONSTRAINT source_takeaway_captures_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES public.captures(id) ON DELETE CASCADE;


--
-- Name: source_takeaway_captures source_takeaway_captures_takeaway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_captures
    ADD CONSTRAINT source_takeaway_captures_takeaway_id_fkey FOREIGN KEY (takeaway_id) REFERENCES public.source_takeaways(id) ON DELETE CASCADE;


--
-- Name: source_takeaway_citations source_takeaway_citations_citation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_citations
    ADD CONSTRAINT source_takeaway_citations_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES public.citations(id) ON DELETE CASCADE;


--
-- Name: source_takeaway_citations source_takeaway_citations_takeaway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaway_citations
    ADD CONSTRAINT source_takeaway_citations_takeaway_id_fkey FOREIGN KEY (takeaway_id) REFERENCES public.source_takeaways(id) ON DELETE CASCADE;


--
-- Name: source_takeaways source_takeaways_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaways
    ADD CONSTRAINT source_takeaways_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: source_takeaways source_takeaways_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_takeaways
    ADD CONSTRAINT source_takeaways_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: sources sources_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.podcast_episodes(id) ON DELETE SET NULL;


--
-- Name: sources sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: sources sources_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;


--
-- Name: suggestions suggestions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.podcast_episodes(id) ON DELETE SET NULL;


--
-- Name: suggestions suggestions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: suggestions suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id) ON DELETE CASCADE;


--
-- Name: tags tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth."user"(id);


--
-- Name: videos videos_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict quTnHPLaDA5PDglOAI0dSAeBIDXtvhFsmcRIOSGWxOknYyQ6x4x5vzuD5LSLa4L
