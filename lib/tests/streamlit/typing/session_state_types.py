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

"""Type tests for st.session_state."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# Perform type checking tests for st.session_state. These are checked by mypy
# and ty, never executed at runtime.
if TYPE_CHECKING:
    from collections.abc import ItemsView, Iterator, KeysView, ValuesView
    from typing import Any

    # NOTE: st.session_state is a module-level attribute, not a Mixin method,
    # so we must import streamlit as st here rather than importing from a
    # Mixin class.
    import streamlit as st
    from streamlit.runtime.state.session_state_proxy import SessionStateProxy

    assert_type(st.session_state, SessionStateProxy)

    # =====================================================================
    # Reads and writes: attribute and bracket notation
    #
    # Values are Any. Bracket keys are str | int so integer widget keys
    # type-check. Attribute names are strings.
    # =====================================================================

    assert_type(st.session_state["count"], Any)
    assert_type(st.session_state.count, Any)
    assert_type(st.session_state[1], Any)

    def _dynamic_key() -> str:
        return "count"

    assert_type(st.session_state[_dynamic_key()], Any)

    widget_key: str | int = 1
    assert_type(st.session_state[widget_key], Any)

    # Bracket notation reads keys that collide with mapping methods.
    # Attribute notation returns the method instead.
    assert_type(st.session_state["get"], Any)
    assert_type(st.session_state["items"], Any)

    st.session_state["count"] = 0
    st.session_state.count = 1
    st.session_state[1] = "widget"
    st.session_state[widget_key] = "widget"
    st.session_state["name"] = "ada"
    st.session_state.name = "ada"
    st.session_state["ready"] = True
    st.session_state.ready = False
    st.session_state["optional"] = None
    st.session_state.optional = None
    st.session_state["tags"] = ["a", "b"]
    st.session_state["config"] = {"mode": "fast"}

    del st.session_state["count"]
    del st.session_state.count
    del st.session_state[1]
    del st.session_state[widget_key]

    # =====================================================================
    # get, setdefault, and pop
    # =====================================================================

    assert_type(st.session_state.get("count"), Any | None)
    assert_type(st.session_state.get("count", None), Any)
    assert_type(st.session_state.get("count", 0), Any)
    assert_type(st.session_state.get(1), Any | None)
    assert_type(st.session_state.get(1, "default"), Any)
    assert_type(st.session_state.get(widget_key), Any | None)
    assert_type(st.session_state.get(widget_key, None), Any)

    # Omitting the default, or passing None, selects the overload that
    # returns Any | None. A non-None default is Any.
    assert_type(st.session_state.setdefault("count"), Any | None)
    assert_type(st.session_state.setdefault("count", 0), Any)
    assert_type(st.session_state.setdefault(1, "widget"), Any)
    assert_type(st.session_state.setdefault(widget_key, None), Any | None)

    assert_type(st.session_state.pop("count"), Any)
    assert_type(st.session_state.pop("count", 0), Any)
    assert_type(st.session_state.pop("count", None), Any)
    assert_type(st.session_state.pop(1), Any)
    assert_type(st.session_state.pop(1, "default"), Any)
    assert_type(st.session_state.pop(widget_key, None), Any)

    # =====================================================================
    # Views, iteration, and to_dict
    #
    # Stored keys are strings, so iteration yields str. keys(), items(), and
    # popitem() follow the mapping key type str | int.
    # =====================================================================

    assert_type(st.session_state.popitem(), tuple[str | int, Any])
    session_keys = st.session_state.keys()
    assert_type(session_keys, KeysView[str | int])
    assert_type(st.session_state.items(), ItemsView[str | int, Any])
    assert_type(st.session_state.values(), ValuesView[Any])
    assert_type(st.session_state.to_dict(), dict[str, Any])
    assert_type(iter(st.session_state), Iterator[str])
    assert_type(len(st.session_state), int)
    assert_type(str(st.session_state), str)
    assert_type(repr(st.session_state), str)
    assert_type("count" in st.session_state, bool)
    assert_type(1 in st.session_state, bool)
    assert_type(widget_key in st.session_state, bool)

    for _key in st.session_state:
        assert_type(_key, str)

    for _view_key in session_keys:
        assert_type(_view_key, str | int)

    for _item_key, _item_value in st.session_state.items():
        assert_type(_item_key, str | int)
        assert_type(_item_value, Any)

    for _value in st.session_state.values():
        assert_type(_value, Any)

    # =====================================================================
    # clear and update
    # =====================================================================

    assert_type(st.session_state.clear(), None)

    assert_type(st.session_state.update(), None)
    assert_type(st.session_state.update({"count": 0}), None)
    assert_type(st.session_state.update({"count": 0, "name": "ada"}), None)
    assert_type(st.session_state.update({1: "widget"}), None)
    assert_type(st.session_state.update([("count", 1), ("name", "ada")]), None)
    assert_type(st.session_state.update((("count", 0), ("ready", True))), None)
    assert_type(st.session_state.update(count=1, name="ada"), None)
    assert_type(st.session_state.update(count=1, ready=None), None)
    assert_type(
        st.session_state.update(
            {"count": 0, "name": "ada"},
            ready=True,
            score=None,
        ),
        None,
    )

    pairs: list[tuple[str | int, Any]] = [("count", 1), (1, "widget")]
    assert_type(st.session_state.update(pairs), None)

    mixed: dict[str | int, Any] = {1: "widget", "count": 0, "optional": None}
    assert_type(st.session_state.update(mixed), None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    st.session_state[None]  # type: ignore[index]  # ty: ignore[invalid-argument-type]
    st.session_state[1.5]  # type: ignore[index]  # ty: ignore[invalid-argument-type]
    st.session_state[b"count"]  # type: ignore[index]  # ty: ignore[invalid-argument-type]
    st.session_state[None] = 1  # type: ignore[index]  # ty: ignore[invalid-assignment]
    st.session_state[1.5] = "nope"  # type: ignore[index]  # ty: ignore[invalid-assignment]
    del st.session_state[None]  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    del st.session_state[1.5]  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # ty types Mapping.get's key as object, so it does not reject these calls.
    st.session_state.get(None)  # type: ignore[call-overload]
    st.session_state.get(1.5)  # type: ignore[call-overload]
    st.session_state.pop(None)  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    st.session_state.pop()  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.session_state.setdefault(None, 1)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.session_state.setdefault()  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    st.session_state.update(123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.session_state.update({1.5: "nope"})  # type: ignore[dict-item]  # ty: ignore[no-matching-overload]
    st.session_state.update({None: 1})  # type: ignore[dict-item]  # ty: ignore[no-matching-overload]
    st.session_state.clear("nope")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    st.session_state.to_dict("nope")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
