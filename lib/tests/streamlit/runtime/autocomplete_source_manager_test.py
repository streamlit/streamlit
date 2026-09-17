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

"""Unit tests for the session-scoped autocomplete source manager."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from streamlit.runtime.autocomplete_source_manager import (
    _AUTOCOMPLETE_ITEM_CEILING,
    _AUTOCOMPLETE_MAX_RESULTS,
    _AUTOCOMPLETE_TEXT_CEILING,
    AutocompleteSourceError,
    AutocompleteSourceManager,
    _get_fragment_id,
    _get_session_id,
    normalize_suggestions,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence


def _register(
    mgr: AutocompleteSourceManager,
    func: Callable[[str], Sequence[str]] | None = None,
    *,
    session_id: str = "s1",
    element_id: str = "el1",
    fragment_id: str | None = None,
    max_chars: int | None = None,
):
    """Register a source under a given session id (patches the active session)."""
    if func is None:

        def _suggest(text: str) -> list[str]:
            return [text] if text else []

        func = _suggest

    with (
        patch(
            "streamlit.runtime.autocomplete_source_manager._get_session_id",
            return_value=session_id,
        ),
        patch(
            "streamlit.runtime.autocomplete_source_manager._get_fragment_id",
            return_value=fragment_id,
        ),
    ):
        return mgr.register_source(func, element_id=element_id, max_chars=max_chars)


def test_register_source_returns_unique_ids_for_different_elements() -> None:
    """Each element id gets its own source id."""
    mgr = AutocompleteSourceManager()
    reg1 = _register(mgr, element_id="el1")
    reg2 = _register(mgr, element_id="el2")
    assert reg1.source_id != reg2.source_id
    assert mgr.get_source_count() == 2


def test_re_register_same_element_reuses_source_id() -> None:
    """Re-registering the same element keeps the source id and uses the new func."""
    mgr = AutocompleteSourceManager()

    def first(text: str) -> list[str]:
        return [f"old-{text}"]

    def second(text: str) -> list[str]:
        return [f"new-{text}"]

    reg1 = _register(mgr, first, element_id="el1")
    mgr.clear_session_refs("s1")
    reg2 = _register(mgr, second, element_id="el1")

    assert reg1.source_id == reg2.source_id
    assert mgr.get_suggestions(reg2.session_id, reg2.source_id, "ap") == ["new-ap"]


def test_get_suggestions_returns_normalized_list() -> None:
    """A valid lookup returns the source's strings after normalization."""
    mgr = AutocompleteSourceManager()

    def suggest(text: str) -> list[str]:
        return [f"{text}-a", f"{text}-b"]

    reg = _register(mgr, suggest)
    assert mgr.get_suggestions(reg.session_id, reg.source_id, "ap") == ["ap-a", "ap-b"]


def test_get_suggestions_unknown_source_returns_empty() -> None:
    """An unknown source id fails closed to an empty list without raising."""
    mgr = AutocompleteSourceManager()
    assert mgr.get_suggestions("s1", "missing", "ap") == []


def test_get_suggestions_wrong_session_raises() -> None:
    """A source registered for one session cannot be read by another."""
    mgr = AutocompleteSourceManager()
    reg = _register(mgr, session_id="s1")
    with pytest.raises(AutocompleteSourceError, match="does not belong"):
        mgr.get_suggestions("other", reg.source_id, "ap")


def test_oversized_inbound_text_is_rejected_without_calling_func() -> None:
    """Text longer than the ceiling is rejected; the callable is not invoked."""
    mgr = AutocompleteSourceManager()
    called = {"n": 0}

    def suggest(text: str) -> list[str]:
        called["n"] += 1
        return [text]

    reg = _register(mgr, suggest)
    oversized = "x" * (_AUTOCOMPLETE_TEXT_CEILING + 1)
    assert mgr.get_suggestions(reg.session_id, reg.source_id, oversized) == []
    assert called["n"] == 0


def test_max_chars_tightens_inbound_text_ceiling() -> None:
    """``max_chars`` can only tighten the inbound text ceiling."""
    mgr = AutocompleteSourceManager()
    called = {"n": 0}

    def suggest(text: str) -> list[str]:
        called["n"] += 1
        return [text]

    reg = _register(mgr, suggest, max_chars=3)
    assert mgr.get_suggestions(reg.session_id, reg.source_id, "abcd") == []
    assert called["n"] == 0
    assert mgr.get_suggestions(reg.session_id, reg.source_id, "abc") == ["abc"]
    assert called["n"] == 1


@pytest.mark.parametrize(
    "value",
    [None, 123, {"a": 1}, b"abc", "apple"],
    ids=["none", "int", "mapping", "bytes", "bare-str"],
)
def test_normalize_rejects_non_sequences(value: object) -> None:
    """Unexpected return types, including a bare string, fail closed to []."""
    assert normalize_suggestions(value) == []


def test_normalize_drops_non_str_items() -> None:
    """Non-string items (including ints from ``range``) are dropped."""
    assert normalize_suggestions(range(3)) == []
    assert normalize_suggestions(["ok", 1, None, b"x", "also"]) == ["ok", "also"]


def test_normalize_keeps_empty_strings() -> None:
    """Empty strings are legal field values and are kept if returned."""
    assert normalize_suggestions(["", "a"]) == ["", "a"]


def test_normalize_drops_over_long_items_without_shortening() -> None:
    """Items longer than the ceiling are dropped, not trimmed."""
    long_item = "x" * (_AUTOCOMPLETE_ITEM_CEILING + 1)
    assert normalize_suggestions(["ok", long_item, "also"]) == ["ok", "also"]
    assert normalize_suggestions(["abcd", "ab"], max_chars=3) == ["ab"]


def test_normalize_caps_count_without_materializing() -> None:
    """At most 50 items are kept and the generator is not exhausted."""
    exhausted = {"after_51": False}

    def endless():
        i = 0
        while True:
            if i == _AUTOCOMPLETE_MAX_RESULTS + 1:
                exhausted["after_51"] = True
            yield f"item{i}"
            i += 1

    result = normalize_suggestions(endless())
    assert len(result) == _AUTOCOMPLETE_MAX_RESULTS
    assert result[0] == "item0"
    assert result[-1] == f"item{_AUTOCOMPLETE_MAX_RESULTS - 1}"
    assert exhausted["after_51"] is False


def test_normalize_drops_trailing_items_when_payload_would_exceed_limit() -> None:
    """Encoded payload size is bounded; trailing items are dropped, never shortened."""
    with patch(
        "streamlit.runtime.autocomplete_source_manager.get_max_message_size_bytes",
        return_value=1,
    ):
        assert normalize_suggestions(["a", "b"]) == []


def test_clear_session_refs_then_prune_removes_sources() -> None:
    """Clearing a session's refs and pruning removes its sources."""
    mgr = AutocompleteSourceManager()
    reg = _register(mgr, session_id="s1")
    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_sources()
    assert mgr.get_source_count() == 0
    assert mgr.get_suggestions(reg.session_id, reg.source_id, "ap") == []


def test_clear_session_refs_only_affects_target_session() -> None:
    """Clearing one session's refs does not remove another session's sources."""
    mgr = AutocompleteSourceManager()
    reg_s1 = _register(mgr, session_id="s1", element_id="el1")
    reg_s2 = _register(mgr, session_id="s2", element_id="el1")

    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_sources()

    assert mgr.get_suggestions(reg_s1.session_id, reg_s1.source_id, "ap") == []
    assert mgr.get_suggestions(reg_s2.session_id, reg_s2.source_id, "ap") == ["ap"]


def test_clear_session_refs_only_affects_target_fragments() -> None:
    """Fragment reruns prune only refs owned by rerun fragments."""
    mgr = AutocompleteSourceManager()
    body = _register(mgr, element_id="body", fragment_id=None)
    frag_a = _register(mgr, element_id="frag-a", fragment_id="a")
    frag_b = _register(mgr, element_id="frag-b", fragment_id="b")

    mgr.clear_session_refs("s1", fragment_ids=["a"])
    mgr.remove_orphaned_sources()

    assert mgr.get_suggestions(frag_a.session_id, frag_a.source_id, "ap") == []
    assert mgr.get_suggestions(body.session_id, body.source_id, "ap") == ["ap"]
    assert mgr.get_suggestions(frag_b.session_id, frag_b.source_id, "ap") == ["ap"]


def test_clear_session_refs_fragment_empty_list_is_noop() -> None:
    """An empty fragment-id list leaves existing refs untouched."""
    mgr = AutocompleteSourceManager()
    reg = _register(mgr, element_id="frag-a", fragment_id="a")

    mgr.clear_session_refs("s1", fragment_ids=[])
    mgr.remove_orphaned_sources()

    assert mgr.get_suggestions(reg.session_id, reg.source_id, "ap") == ["ap"]


def test_clear_all_for_session() -> None:
    """``clear_all_for_session`` clears refs, stable ids, and sources."""
    mgr = AutocompleteSourceManager()
    reg = _register(mgr, session_id="s1")
    old_id = reg.source_id
    mgr.clear_all_for_session("s1")
    assert mgr.get_source_count() == 0

    new_reg = _register(mgr, session_id="s1")
    assert new_reg.source_id != old_id


def test_get_session_id_without_context_returns_dontcare() -> None:
    """_get_session_id returns "dontcare" when there is no script run context."""
    with patch(
        "streamlit.runtime.scriptrunner_utils.script_run_context.get_script_run_ctx",
        return_value=None,
    ):
        assert _get_session_id() == "dontcare"


def test_get_fragment_id_without_thread_state_returns_none() -> None:
    """_get_fragment_id returns None when ThreadState.get raises RuntimeError."""
    with patch(
        "streamlit.runtime.scriptrunner_utils.script_run_context.ThreadState.get",
        side_effect=RuntimeError("FragmentThreadState not initialized"),
    ):
        assert _get_fragment_id() is None


def test_clear_session_refs_fragment_ids_unknown_session_is_noop() -> None:
    """Passing fragment_ids for a session with no refs leaves other sources intact."""
    mgr = AutocompleteSourceManager()
    reg = _register(mgr, session_id="s1", element_id="frag-a", fragment_id="a")

    mgr.clear_session_refs("unknown", fragment_ids=["a"])

    assert mgr.get_source_count() == 1
    assert mgr.get_suggestions(reg.session_id, reg.source_id, "ap") == ["ap"]


def test_clear_session_refs_fragment_removes_emptied_session_entry() -> None:
    """Clearing a session's only fragment ref drops the session's ref map."""
    mgr = AutocompleteSourceManager()
    _register(mgr, session_id="s1", element_id="frag-a", fragment_id="a")

    mgr.clear_session_refs("s1", fragment_ids=["a"])

    assert "s1" not in mgr._refs_by_session_and_element
