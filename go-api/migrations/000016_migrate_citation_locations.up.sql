UPDATE citations
SET location = CASE
  WHEN location IS NULL THEN NULL

  -- book + pdf_position => derived/pdf_v1
  WHEN location->>'type' = 'book' AND (location ? 'pdf_position') THEN jsonb_build_object(
    'mode', 'derived',
    'type', 'pdf_v1',
    'pdf', jsonb_build_object(
      'position', location->'pdf_position'
    )
  )

  -- book => manual/book_v1
  WHEN location->>'type' = 'book' THEN jsonb_build_object(
    'mode', 'manual',
    'type', 'book_v1',
    'book', jsonb_build_object(
      'pageStart', location->'pageStart',
      'pageEnd', location->'pageEnd'
    )
  )

  -- av => manual/av_v1
  WHEN location->>'type' = 'av' THEN jsonb_build_object(
    'mode', 'manual',
    'type', 'av_v1',
    'av', jsonb_build_object(
      'tStartSec', location->'tStartSec',
      'tEndSec', location->'tEndSec'
    )
  )

  -- other => manual/other_v1
  WHEN location->>'type' = 'other' THEN jsonb_build_object(
    'mode', 'manual',
    'type', 'other_v1',
    'other', jsonb_build_object(
      'fallbackLabel', location->'fallbackLabel'
    )
  )

  -- transcript => derived/transcript_v1
  WHEN location->>'type' = 'transcript' THEN jsonb_build_object(
    'mode', 'derived',
    'type', 'transcript_v1',
    'transcript', jsonb_build_object(
      'utteranceStartIdx', location->'utteranceStartIdx',
      'utteranceEndIdx', location->'utteranceEndIdx',
      'charOffsetStart', location->'charOffsetStart',
      'charOffsetEnd', location->'charOffsetEnd',
      'tStartSec', location->'tStartSec',
      'tEndSec', location->'tEndSec'
    )
  )

  -- article => null (no location payload)
  WHEN location->>'type' = 'article' THEN NULL

  ELSE location
END;
