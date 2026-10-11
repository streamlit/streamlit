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

"""Type tests for st.query_params."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# Perform type checking tests for st.query_params. These are checked by mypy
# and ty, never executed at runtime.
if TYPE_CHECKING:
    from collections.abc import ItemsView, Iterator, KeysView, ValuesView

    import streamlit as st
    from streamlit.runtime.state.query_params_proxy import QueryParamsProxy

    # NOTE: st.query_params is a module-level attribute, not a Mixin method,
    # so we must import streamlit as st here rather than importing from a
    # Mixin class directly.
    assert_type(st.query_params, QueryParamsProxy)

    # =====================================================================
    # Reads: attribute and bracket notation, plus mapping methods
    # =====================================================================

    assert_type(st.query_params["foo"], str)
    assert_type(st.query_params.foo, str)

    def _dynamic_param() -> str:
        return "foo"

    assert_type(st.query_params[_dynamic_param()], str)

    assert_type(st.query_params.get("foo"), str | None)
    assert_type(st.query_params.get("foo", None), str | None)
    assert_type(st.query_params.get("foo", "default"), str)
    assert_type(st.query_params.get_all("foo"), list[str])
    assert_type(st.query_params.get_all(key="foo"), list[str])
    assert_type(st.query_params.to_dict(), dict[str, str])
    assert_type(len(st.query_params), int)
    assert_type(str(st.query_params), str)
    assert_type(iter(st.query_params), Iterator[str])
    assert_type("foo" in st.query_params, bool)
    assert_type(st.query_params.keys(), KeysView[str])
    assert_type(st.query_params.values(), ValuesView[str])
    assert_type(st.query_params.items(), ItemsView[str, str])
    assert_type(st.query_params.pop("foo"), str)
    assert_type(st.query_params.pop("foo", "default"), str)
    assert_type(st.query_params.setdefault("foo", "bar"), str)
    assert_type(st.query_params.popitem(), tuple[str, str])

    for _param_key in st.query_params:
        assert_type(_param_key, str)

    # =====================================================================
    # Writes: strings, and iterables of strings for repeated keys
    # =====================================================================

    st.query_params["foo"] = "bar"
    st.query_params.foo = "bar"
    st.query_params["stream"] = ["lit", "rocks"]
    st.query_params.stream = ["lit", "rocks"]
    st.query_params["letters"] = ("a", "b")

    single: str = "bar"
    repeated: list[str] = ["lit", "rocks"]
    st.query_params["foo"] = single
    st.query_params.foo = repeated

    del st.query_params["foo"]
    del st.query_params.foo

    # =====================================================================
    # clear, from_dict, and update
    # =====================================================================

    assert_type(st.query_params.clear(), None)

    assert_type(st.query_params.from_dict({"foo": "bar"}), None)
    assert_type(st.query_params.from_dict({"foo": "bar", "baz": ["one", "two"]}), None)
    assert_type(
        st.query_params.from_dict([("foo", "bar"), ("stream", ["lit", "rocks"])]),
        None,
    )
    assert_type(
        st.query_params.from_dict((("foo", "bar"), ("stream", ("lit", "rocks")))),
        None,
    )

    mixed_values: dict[str, str | list[str]] = {
        "foo": "bar",
        "baz": ["one", "two"],
    }
    assert_type(st.query_params.from_dict(mixed_values), None)

    assert_type(st.query_params.update(), None)
    assert_type(st.query_params.update({"foo": "bar"}), None)
    assert_type(st.query_params.update({"foo": ["bar", "baz"]}), None)
    assert_type(
        st.query_params.update([("foo", "bar"), ("stream", ["lit", "rocks"])]),
        None,
    )
    assert_type(st.query_params.update(foo="bar", stream=["lit", "rocks"]), None)
    # Keyword values can be repeated keys when a mapping is also passed.
    assert_type(st.query_params.update({"foo": "bar"}, extra="x"), None)
    assert_type(
        st.query_params.update({"foo": "bar"}, stream=["lit", "rocks"]),
        None,
    )
    assert_type(
        st.query_params.update(
            {"foo": "bar", "baz": ["one", "two"]},
            stream=["lit", "rocks"],
            extra="x",
        ),
        None,
    )
    assert_type(st.query_params.update(mixed_values, extra=["x", "y"]), None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # These values are outside the public contract: strings, or iterables of
    # strings for repeated keys. The runtime still stringifies some of them.
    st.query_params.get_all(1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    st.query_params["count"] = 1  # type: ignore[assignment]  # ty: ignore[invalid-assignment]
    st.query_params.count = 1  # type: ignore[assignment]  # ty: ignore[invalid-assignment]
    st.query_params["n"] = [1]  # type: ignore[list-item]  # ty: ignore[invalid-assignment]
    st.query_params["empty"] = None  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    st.query_params.from_dict(123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.query_params.from_dict({"n": 1})  # type: ignore[dict-item]  # ty: ignore[no-matching-overload]
    st.query_params.from_dict()  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    st.query_params.update(123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.query_params.update({"a": "b"}, n=1)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    st.query_params.clear("nope")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    st.query_params.to_dict("nope")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
