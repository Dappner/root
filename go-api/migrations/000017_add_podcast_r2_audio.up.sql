-- Add R2 audio key column to store the R2 object key for the archived audio file.
-- When a transcript is generated, the source MP3 is copied to R2
-- to ensure transcript timestamps remain accurate even if the original
-- enclosure URL changes (e.g. podcast ads are updated).
-- Storing the key (not a URL) avoids presigned URL expiry issues.
ALTER TABLE podcast_episodes ADD COLUMN r2_audio_key TEXT;
