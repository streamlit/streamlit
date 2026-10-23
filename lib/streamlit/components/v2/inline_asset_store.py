# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Content-addressed storage for inline component JavaScript.

Inline JavaScript passed to ``st.components.v2.component`` is served from
``/_stcore/bidi-components/__inline__/<sha256>.js`` instead of being
embedded in every mount message. The URL depends only on the content, so
identical modules share one ES module instance. The browser fetches each
distinct module once and caches it, and the page needs no ``blob:`` script
source.
"""

from __future__ import annotations

import hashlib
import threading
from collections import OrderedDict
from typing import Final

INLINE_ASSET_URL_PREFIX: Final = "__inline__/"

# Bounds memory when apps generate JavaScript that is no longer referenced by
# a registered component. Content that a definition still points at is pinned
# and is not evicted. The browser fetches a module right after receiving its
# mount message, so the newest unpinned entry is also kept even if it alone
# exceeds the bound.
_DEFAULT_MAX_CHARS: Final = 64 * 1024 * 1024


def inline_js_url(content: str) -> str:
    """Return the content-addressed URL for inline JavaScript.

    Parameters
    ----------
    content : str
        The JavaScript module source.

    Returns
    -------
    str
        A path like ``"__inline__/<sha256>.js"``. The same content always
        maps to the same path.
    """
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return f"{INLINE_ASSET_URL_PREFIX}{digest}.js"


class InlineAssetStore:
    """A thread-safe, size-bounded LRU of inline JavaScript keyed by URL.

    Entries referenced by a registered component definition are pinned and
    skipped during eviction, so a mounted component or a newly opened session
    does not receive a URL that 404s while that definition still exists.
    """

    def __init__(self, max_chars: int = _DEFAULT_MAX_CHARS) -> None:
        self._max_chars = max_chars
        self._lock = threading.Lock()
        self._content_by_url: OrderedDict[str, str] = OrderedDict()
        self._url_by_content: dict[str, str] = {}
        self._pin_counts: dict[str, int] = {}
        self._total_chars = 0

    def add_js(self, content: str) -> str:
        """Store inline JavaScript and return its URL relative to the component root.

        Parameters
        ----------
        content : str
            The JavaScript module source.

        Returns
        -------
        str
            A path like ``"__inline__/<sha256>.js"``. The same content always
            maps to the same path.
        """
        with self._lock:
            url = self._url_by_content.get(content)
            if url is not None:
                self._content_by_url.move_to_end(url)
                return url

        url = inline_js_url(content)

        with self._lock:
            if url not in self._content_by_url:
                self._content_by_url[url] = content
                self._url_by_content[content] = url
                self._total_chars += len(content)
            self._content_by_url.move_to_end(url)
            self._evict_unpinned_over_bound()
        return url

    def pin(self, url: str) -> None:
        """Keep ``url`` in the store while a registered definition references it."""
        with self._lock:
            if url not in self._content_by_url:
                return
            self._pin_counts[url] = self._pin_counts.get(url, 0) + 1

    def unpin(self, url: str) -> None:
        """Release one registered-definition reference to ``url``."""
        with self._lock:
            count = self._pin_counts.get(url, 0)
            if count <= 1:
                self._pin_counts.pop(url, None)
            else:
                self._pin_counts[url] = count - 1

    def clear_pins(self) -> None:
        """Drop every registered-definition pin.

        Stored content remains until a later ``add_js`` evicts it.
        """
        with self._lock:
            self._pin_counts.clear()

    def get(self, url: str) -> str | None:
        """Return the content stored under ``url``, or ``None`` if unknown."""
        with self._lock:
            return self._content_by_url.get(url)

    def _evict_unpinned_over_bound(self) -> None:
        """Drop unpinned, least-recent entries until under the size bound.

        The newest entry is never evicted, even if it alone exceeds the bound,
        so a just-mounted module remains fetchable. Pinned URLs stay until
        every registered definition that uses them is gone.
        """
        while self._total_chars > self._max_chars and len(self._content_by_url) > 1:
            newest_url = next(reversed(self._content_by_url))
            evicted_url: str | None = None
            evicted_content: str | None = None
            for url, content in self._content_by_url.items():
                if url == newest_url:
                    continue
                if self._pin_counts.get(url, 0) > 0:
                    continue
                evicted_url = url
                evicted_content = content
                break
            if evicted_url is None or evicted_content is None:
                return
            del self._content_by_url[evicted_url]
            self._url_by_content.pop(evicted_content, None)
            self._pin_counts.pop(evicted_url, None)
            self._total_chars -= len(evicted_content)
