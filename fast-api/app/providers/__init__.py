"""Provider seams: the interfaces services depend on instead of vendor SDKs.

Each module defines a Protocol, an in-repo deterministic fake, and a factory
that picks the real integration (``app/integrations/``) or the fake from
settings. Services type-hint against the Protocol only.
"""
