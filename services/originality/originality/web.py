"""Web comparison. Off for now: the scorer runs against Forge's own data only.

To add a provider later, implement `WebProvider.coverage` (search a handful of
distinctive sentences per file, return the share found verbatim on the web)
and return it from `get_provider` when its API key is set.
"""

from __future__ import annotations

from typing import Protocol


class WebProvider(Protocol):
    name: str

    def coverage(self, sentences: list[str]) -> float | None:
        """Share (0..1) of the given sentences found verbatim on the web."""
        ...


def get_provider() -> WebProvider | None:
    return None
