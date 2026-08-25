The user was listening at $playback_position_seconds seconds.

Spoken note:
$voice_transcript

Candidate podcast transcript:
$transcript_lines

Return the best suggestion:
- Use `create_entities` with one or more citations and/or captures.
- Use `uncertain` if the note cannot be matched confidently.

A rambling note that touches multiple distinct moments should produce multiple
citations (one per moment) and multiple captures (one per distinct thought).
Each capture may set `citation_idx` to tie it to a specific citation in this
suggestion, or leave it null for a standalone thought.
