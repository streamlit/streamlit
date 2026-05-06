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

from typing import TYPE_CHECKING, Any

from typing_extensions import assert_type

# Perform type checking tests for st.json_editor
# The return type depends on the value parameter:
# - value=dict -> returns dict[str, Any]
# - value=list -> returns list[Any]
# - value=str -> returns str
if TYPE_CHECKING:
    from streamlit.elements.widgets.json_editor import JsonEditorMixin

    json_editor = JsonEditorMixin().json_editor

    # =====================================================================
    # Basic return type tests based on value parameter type
    # =====================================================================

    # dict input returns dict[str, Any]
    assert_type(json_editor({"key": "value"}), dict[str, Any])
    assert_type(json_editor({"nested": {"a": 1}}), dict[str, Any])
    assert_type(json_editor({}), dict[str, Any])

    # list input returns list[Any]
    assert_type(json_editor([1, 2, 3]), list[Any])
    assert_type(json_editor(["a", "b"]), list[Any])
    assert_type(json_editor([]), list[Any])

    # str input returns str
    assert_type(json_editor('{"json": "string"}'), str)
    assert_type(json_editor("[]"), str)

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(json_editor({"key": "value"}, key="my_editor"), dict[str, Any])
    assert_type(json_editor([1, 2], key=123), list[Any])
    assert_type(json_editor('{"a": 1}', key=None), str)

    # =====================================================================
    # Test height parameter
    # =====================================================================

    assert_type(json_editor({"key": "value"}, height=200), dict[str, Any])
    assert_type(json_editor([1, 2], height=None), list[Any])
    assert_type(json_editor('{"a": 1}', height=300), str)

    # =====================================================================
    # Test disabled parameter
    # =====================================================================

    assert_type(json_editor({"key": "value"}, disabled=True), dict[str, Any])
    assert_type(json_editor([1, 2], disabled=False), list[Any])
    assert_type(json_editor('{"a": 1}', disabled=True), str)

    # =====================================================================
    # Test callback parameters (on_change, args, kwargs)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(json_editor({"key": "value"}, on_change=my_callback), dict[str, Any])
    assert_type(
        json_editor([1, 2], on_change=callback_with_args, args=(1, "a")), list[Any]
    )
    assert_type(
        json_editor(
            '{"a": 1}', on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        str,
    )

    # =====================================================================
    # Test with all parameters combined (dict value)
    # =====================================================================

    assert_type(
        json_editor(
            {"config": True},
            key="full_editor",
            height=400,
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
        ),
        dict[str, Any],
    )

    # =====================================================================
    # Test with all parameters combined (list value)
    # =====================================================================

    assert_type(
        json_editor(
            [1, 2, 3],
            key="list_editor",
            height=300,
            on_change=my_callback,
            disabled=True,
        ),
        list[Any],
    )

    # =====================================================================
    # Test with all parameters combined (str value)
    # =====================================================================

    assert_type(
        json_editor(
            '{"raw": "json"}',
            key="string_editor",
            height=200,
            on_change=my_callback,
            disabled=False,
        ),
        str,
    )
