"""URL normalization for consistent source-metadata matching.

Strip query/fragment, lowercase the host, drop default ports (80/443), trim
trailing slashes, and require a scheme + host. Used on source create to
canonicalize article/video/podcast URLs so duplicate detection is stable.
"""

from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

from app.core.exceptions import ValidationError


def normalize_url(raw: str) -> str:
    """Return a canonicalized URL or raise ValidationError on a bad input.

    - require a scheme and host (else ValidationError)
    - drop fragment and query
    - lowercase the hostname
    - drop the port when it's the scheme default (http:80, https:443)
    - trim trailing slashes; empty path becomes "/"
    """
    parts = urlsplit(raw.strip())

    scheme = parts.scheme
    hostname = parts.hostname
    if not scheme or not hostname:
        raise ValidationError("invalid url: missing scheme or host")

    hostname = hostname.lower()
    port = parts.port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        port = None

    netloc = f"{hostname}:{port}" if port is not None else hostname

    path = parts.path.rstrip("/")
    if path == "":
        path = "/"

    # query and fragment intentionally dropped
    return urlunsplit((scheme, netloc, path, "", ""))
