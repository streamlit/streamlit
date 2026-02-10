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

if TYPE_CHECKING:
    from streamlit.elements.widgets.text_widgets import TextWidgetsMixin

    text_input = TextWidgetsMixin().text_input

    # =====================================================================
    # st.text_input return type tests
    # =====================================================================

    # Default value (str) -> str
    assert_type(text_input("Enter text"), str)
    assert_type(text_input("Enter text", value="hello"), str)
    assert_type(text_input("Enter text", value=""), str)

    # value=None -> str | None
    assert_type(text_input("Enter text", value=None), str | None)

    # Key parameter
    assert_type(text_input("Enter text", key="my_input"), str)
    assert_type(text_input("Enter text", key=123), str)

    # Type parameter
    assert_type(text_input("Enter text", type="default"), str)
    assert_type(text_input("Enter text", type="password"), str)

    # max_chars parameter
    assert_type(text_input("Enter text", max_chars=100), str)
    assert_type(text_input("Enter text", max_chars=None), str)

    # Help parameter
    assert_type(text_input("Enter text", help="Help text"), str)
    assert_type(text_input("Enter text", help=None), str)

    # Disabled parameter
    assert_type(text_input("Enter text", disabled=True), str)
    assert_type(text_input("Enter text", disabled=False), str)

    # Label visibility
    assert_type(text_input("Enter text", label_visibility="visible"), str)
    assert_type(text_input("Enter text", label_visibility="hidden"), str)
    assert_type(text_input("Enter text", label_visibility="collapsed"), str)

    # Width parameter
    assert_type(text_input("Enter text", width="stretch"), str)
    assert_type(text_input("Enter text", width=200), str)

    # Placeholder parameter
    assert_type(text_input("Enter text", placeholder="Type here..."), str)
    assert_type(text_input("Enter text", placeholder=None), str)

    # Icon parameter
    assert_type(text_input("Enter text", icon=":material/search:"), str)
    assert_type(text_input("Enter text", icon=None), str)

    # Bind parameter
    assert_type(text_input("Enter text", bind="query-params"), str)
    assert_type(text_input("Enter text", bind=None), str)

    # Callbacks
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(text_input("Enter text", on_change=my_callback), str)
    assert_type(
        text_input("Enter text", on_change=callback_with_args, args=(1, "a")), str
    )
    assert_type(
        text_input(
            "Enter text", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        str,
    )
    assert_type(text_input("Enter text", on_change=None), str)

    # Full text_input with all parameters
    assert_type(
        text_input(
            "Full text input",
            value="hello",
            max_chars=100,
            key="full_text_input",
            type="default",
            help="Full help",
            autocomplete="name",
            on_change=my_callback,
            args=None,
            kwargs=None,
            placeholder="Type here...",
            disabled=False,
            label_visibility="visible",
            icon=":material/search:",
            width="stretch",
            bind="query-params",
        ),
        str,
    )
