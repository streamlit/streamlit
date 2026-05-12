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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform type checking tests for st.text_area
# The return type depends on the value parameter:
# - value=str (or default "") -> returns str
# - value=None or SupportsStr|None -> returns str | None
if TYPE_CHECKING:
    from streamlit.elements.widgets.text_widgets import TextWidgetsMixin

    text_area = TextWidgetsMixin().text_area

    # =====================================================================
    # Basic return type tests based on value parameter
    # =====================================================================

    # Default value (empty string) returns str
    assert_type(text_area("Enter text"), str)
    assert_type(text_area("Enter text", "default value"), str)
    assert_type(text_area("Enter text", value="hello world"), str)

    # value=None returns str | None
    assert_type(text_area("Enter text", None), str | None)
    assert_type(text_area("Enter text", value=None), str | None)

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(text_area("Enter text", key="my_area"), str)
    assert_type(text_area("Enter text", key=123), str)
    assert_type(text_area("Enter text", key=None), str)
    assert_type(text_area("Enter text", value=None, key="my_area"), str | None)

    # =====================================================================
    # Test height parameter (int, None, "content", or "stretch")
    # =====================================================================

    assert_type(text_area("Enter text", height=200), str)
    assert_type(text_area("Enter text", height=None), str)
    assert_type(text_area("Enter text", height="content"), str)
    assert_type(text_area("Enter text", height="stretch"), str)
    assert_type(text_area("Enter text", value=None, height=300), str | None)
    assert_type(text_area("Enter text", value=None, height="content"), str | None)
    assert_type(text_area("Enter text", value=None, height="stretch"), str | None)

    # =====================================================================
    # Test max_chars parameter
    # =====================================================================

    assert_type(text_area("Enter text", max_chars=500), str)
    assert_type(text_area("Enter text", max_chars=None), str)
    assert_type(text_area("Enter text", value=None, max_chars=1000), str | None)

    # =====================================================================
    # Test help parameter
    # =====================================================================

    assert_type(text_area("Enter text", help="Type your text here"), str)
    assert_type(text_area("Enter text", help=None), str)
    assert_type(text_area("Enter text", value=None, help="Help text"), str | None)

    # =====================================================================
    # Test placeholder parameter (keyword-only)
    # =====================================================================

    assert_type(text_area("Enter text", placeholder="Type here..."), str)
    assert_type(text_area("Enter text", placeholder=None), str)
    assert_type(
        text_area("Enter text", value=None, placeholder="Placeholder"), str | None
    )

    # =====================================================================
    # Test disabled parameter (keyword-only)
    # =====================================================================

    assert_type(text_area("Enter text", disabled=True), str)
    assert_type(text_area("Enter text", disabled=False), str)
    assert_type(text_area("Enter text", value=None, disabled=True), str | None)

    # =====================================================================
    # Test label_visibility parameter (keyword-only)
    # =====================================================================

    assert_type(text_area("Enter text", label_visibility="visible"), str)
    assert_type(text_area("Enter text", label_visibility="hidden"), str)
    assert_type(text_area("Enter text", label_visibility="collapsed"), str)
    assert_type(
        text_area("Enter text", value=None, label_visibility="hidden"), str | None
    )

    # =====================================================================
    # Test width parameter (keyword-only)
    # =====================================================================

    assert_type(text_area("Enter text", width="stretch"), str)
    assert_type(text_area("Enter text", width=400), str)
    assert_type(text_area("Enter text", value=None, width=500), str | None)

    # =====================================================================
    # Test bind parameter (keyword-only)
    # =====================================================================

    assert_type(text_area("Enter text", bind="query-params"), str)
    assert_type(text_area("Enter text", bind=None), str)
    assert_type(text_area("Enter text", value=None, bind="query-params"), str | None)

    # =====================================================================
    # Test callback parameters (on_change, args, kwargs)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(text_area("Enter text", on_change=my_callback), str)
    assert_type(
        text_area("Enter text", on_change=callback_with_args, args=(1, "a")), str
    )
    assert_type(
        text_area(
            "Enter text", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        str,
    )
    assert_type(text_area("Enter text", on_change=None), str)
    assert_type(text_area("Enter text", value=None, on_change=my_callback), str | None)
    assert_type(
        text_area(
            "Enter text", value=None, on_change=callback_with_args, args=(1, "test")
        ),
        str | None,
    )

    # =====================================================================
    # Test with all parameters combined (str value)
    # =====================================================================

    assert_type(
        text_area(
            "Full text area",
            value="initial text",
            height=300,
            max_chars=1000,
            key="full_area",
            help="Enter your text here",
            on_change=my_callback,
            args=None,
            kwargs=None,
            placeholder="Type something...",
            disabled=False,
            label_visibility="visible",
            width="stretch",
            bind="query-params",
        ),
        str,
    )

    # =====================================================================
    # Test with all parameters combined (None value)
    # =====================================================================

    assert_type(
        text_area(
            "Full text area",
            value=None,
            height="content",
            max_chars=500,
            key="nullable_area",
            help="Enter your description",
            on_change=my_callback,
            args=None,
            kwargs=None,
            placeholder="Description",
            disabled=False,
            label_visibility="visible",
            width=400,
            bind="query-params",
        ),
        str | None,
    )

    # =====================================================================
    # Test height variants with value combinations
    # =====================================================================

    # Integer height
    assert_type(text_area("Notes", value="Some notes", height=150), str)
    assert_type(text_area("Notes", value=None, height=150), str | None)

    # "content" height - auto-sizes to content
    assert_type(text_area("Description", value="Text", height="content"), str)
    assert_type(text_area("Description", value=None, height="content"), str | None)

    # "stretch" height - fills available space
    assert_type(text_area("Full content", value="Content", height="stretch"), str)
    assert_type(text_area("Full content", value=None, height="stretch"), str | None)

    # None height - uses default (approximately three lines)
    assert_type(text_area("Default height", value="Text", height=None), str)
    assert_type(text_area("Default height", value=None, height=None), str | None)
