-- Voice suggestions can now produce multiple citations and captures per
-- suggestion (a long ramble may touch several distinct moments). The matcher
-- emits a single 'create_entities' action with arrays of citations and
-- captures, replacing the old single-shot create_citation /
-- create_citation_with_capture / create_capture actions.

ALTER TYPE suggestion_action_enum ADD VALUE IF NOT EXISTS 'create_entities';
