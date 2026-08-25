// Recognize YouTube watch / short / embed / shorts URLs (and bare 11-char IDs).
// Mirrors the backend `extract_video_id` patterns in
// fast-api/app/integrations/youtube_data.py so the client and server agree on
// what counts as an importable YouTube video.

const YOUTUBE_URL_PATTERNS: RegExp[] = [
  /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

/** True when `value` looks like a YouTube video URL we can import. */
export function isYouTubeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}
