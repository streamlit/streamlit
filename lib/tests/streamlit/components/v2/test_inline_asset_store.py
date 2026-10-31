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

from __future__ import annotations

import hashlib

from streamlit.components.v2.inline_asset_store import InlineAssetStore, inline_js_url


def test_add_js_returns_content_addressed_url() -> None:
    """The URL is the SHA-256 of the content, and the content is retrievable."""
    store = InlineAssetStore()
    js = "export default function() {}"

    url = store.add_js(js)

    assert url == f"__inline__/{hashlib.sha256(js.encode()).hexdigest()}.js"
    assert url == inline_js_url(js)
    assert store.get(url) == js


def test_equal_content_shares_a_url_and_different_content_does_not() -> None:
    """Equal strings map to one entry; any change produces a new URL."""
    store = InlineAssetStore()
    prefix = "export default () => "
    first = store.add_js("export default () => 1")
    # Build an equal string at runtime so it is a different object.
    same = store.add_js(prefix + str(1))
    other = store.add_js("export default () => 2")

    assert first == same
    assert other != first
    assert store.get(first) == "export default () => 1"
    assert store.get(other) == "export default () => 2"


def test_unknown_url_returns_none() -> None:
    """A URL that was never stored, or isn't inline, is not found."""
    store = InlineAssetStore()
    store.add_js("export default () => 1")

    assert store.get("__inline__/" + "0" * 64 + ".js") is None
    assert store.get("index.js") is None


def test_evicts_least_recently_mounted_unpinned_content_over_the_bound() -> None:
    """Exceeding the size bound drops the unpinned entry mounted least recently."""
    store = InlineAssetStore(max_chars=10)
    a = store.add_js("aaaa")
    b = store.add_js("bbbb")
    # Mounting `a` again makes `b` the least recently used entry.
    assert store.add_js("aaaa") == a

    c = store.add_js("cccc")

    assert store.get(b) is None
    assert store.get(a) == "aaaa"
    assert store.get(c) == "cccc"
    # An evicted entry is stored again under the same URL when remounted.
    assert store.add_js("bbbb") == b
    assert store.get(b) == "bbbb"


def test_keeps_newest_entry_even_when_it_exceeds_the_bound() -> None:
    """A single module larger than the bound stays available to its mount."""
    store = InlineAssetStore(max_chars=4)
    small = store.add_js("ab")

    big = store.add_js("x" * 100)

    assert store.get(big) == "x" * 100
    assert store.get(small) is None


def test_does_not_evict_pinned_content() -> None:
    """A registered definition's JS stays fetchable while it is pinned."""
    store = InlineAssetStore(max_chars=10)
    pinned = store.add_js("aaaa")
    store.pin(pinned)

    newest = store.add_js("bbbbbbbbbb")

    assert store.get(pinned) == "aaaa"
    assert store.get(newest) == "bbbbbbbbbb"


def test_unpinned_content_is_eligible_for_eviction() -> None:
    """Releasing the last pin lets a later mount evict that entry."""
    store = InlineAssetStore(max_chars=6)
    pinned = store.add_js("aaa")
    store.pin(pinned)
    store.add_js("bbb")
    store.unpin(pinned)

    newest = store.add_js("ccc")

    assert store.get(pinned) is None
    assert store.get(newest) == "ccc"


def test_pin_is_refcounted_across_shared_content() -> None:
    """Two definitions can share one URL; one unpin does not drop the other."""
    store = InlineAssetStore(max_chars=4)
    url = store.add_js("aa")
    store.pin(url)
    store.pin(url)
    store.unpin(url)

    store.add_js("bbbb")

    assert store.get(url) == "aa"


def test_clear_pins_makes_entries_evictable() -> None:
    """Clearing pins does not drop content until a later over-bound mount."""
    store = InlineAssetStore(max_chars=4)
    url = store.add_js("aa")
    store.pin(url)
    store.clear_pins()

    assert store.get(url) == "aa"

    store.add_js("bbbb")

    assert store.get(url) is None
