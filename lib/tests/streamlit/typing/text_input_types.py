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

# Perform type checking tests for st.text_input
# The return type depends on the value parameter:
# - value=str (or default "") -> returns str
# - value=None or SupportsStr|None -> returns str | None
if TYPE_CHECKING:
    from streamlit.elements.widgets.text_widgets import TextWidgetsMixin

    text_input = TextWidgetsMixin().text_input

    # =====================================================================
    # Basic return type tests based on value parameter
    # =====================================================================

    # Default value (empty string) returns str
    assert_type(text_input("Enter text"), str)
    assert_type(text_input("Enter text", "default value"), str)
    assert_type(text_input("Enter text", value="hello"), str)

    # value=None returns str | None
    assert_type(text_input("Enter text", None), str | None)
    assert_type(text_input("Enter text", value=None), str | None)

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(text_input("Enter text", key="my_input"), str)
    assert_type(text_input("Enter text", key=123), str)
    assert_type(text_input("Enter text", key=None), str)
    assert_type(text_input("Enter text", value=None, key="my_input"), str | None)

    # =====================================================================
    # Test type parameter ("default" or "password")
    # =====================================================================

    assert_type(text_input("Enter text", type="default"), str)
    assert_type(text_input("Enter text", type="password"), str)
    assert_type(text_input("Enter password", value=None, type="password"), str | None)

    # =====================================================================
    # Test max_chars parameter
    # =====================================================================

    assert_type(text_input("Enter text", max_chars=100), str)
    assert_type(text_input("Enter text", max_chars=None), str)
    assert_type(text_input("Enter text", value=None, max_chars=50), str | None)

    # =====================================================================
    # Test help parameter
    # =====================================================================

    assert_type(text_input("Enter text", help="Type something here"), str)
    assert_type(text_input("Enter text", help=None), str)
    assert_type(text_input("Enter text", value=None, help="Help text"), str | None)

    # =====================================================================
    # Test autocomplete parameter
    # =====================================================================

    assert_type(text_input("Enter text", autocomplete="off"), str)
    assert_type(text_input("Email", autocomplete="email"), str)
    assert_type(text_input("Enter text", autocomplete=None), str)
    assert_type(text_input("Enter text", value=None, autocomplete="name"), str | None)

    # =====================================================================
    # Test placeholder parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Enter text", placeholder="Type here..."), str)
    assert_type(text_input("Enter text", placeholder=None), str)
    assert_type(
        text_input("Enter text", value=None, placeholder="Placeholder"), str | None
    )

    # =====================================================================
    # Test disabled parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Enter text", disabled=True), str)
    assert_type(text_input("Enter text", disabled=False), str)
    assert_type(text_input("Enter text", value=None, disabled=True), str | None)

    # =====================================================================
    # Test label_visibility parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Enter text", label_visibility="visible"), str)
    assert_type(text_input("Enter text", label_visibility="hidden"), str)
    assert_type(text_input("Enter text", label_visibility="collapsed"), str)
    assert_type(
        text_input("Enter text", value=None, label_visibility="hidden"), str | None
    )

    # =====================================================================
    # Test icon parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Search", icon=":material/search:"), str)
    assert_type(text_input("Search", icon=None), str)
    assert_type(text_input("Search", value=None, icon=":material/search:"), str | None)

    # =====================================================================
    # Test width parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Enter text", width="stretch"), str)
    assert_type(text_input("Enter text", width=200), str)
    assert_type(text_input("Enter text", value=None, width=300), str | None)

    # =====================================================================
    # Test bind parameter (keyword-only)
    # =====================================================================

    assert_type(text_input("Enter text", bind="query-params"), str)
    assert_type(text_input("Enter text", bind=None), str)
    assert_type(text_input("Enter text", value=None, bind="query-params"), str | None)

    # =====================================================================
    # Test callback parameters (on_change, args, kwargs)
    # =====================================================================

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
    assert_type(text_input("Enter text", value=None, on_change=my_callback), str | None)
    assert_type(
        text_input(
            "Enter text", value=None, on_change=callback_with_args, args=(1, "test")
        ),
        str | None,
    )

    # =====================================================================
    # Test with all parameters combined (str value)
    # =====================================================================

    assert_type(
        text_input(
            "Full text input",
            value="initial",
            max_chars=100,
            key="full_input",
            type="default",
            help="Enter your text here",
            autocomplete="off",
            on_change=my_callback,
            args=None,
            kwargs=None,
            placeholder="Type something...",
            disabled=False,
            label_visibility="visible",
            icon=":material/edit:",
            width="stretch",
            bind="query-params",
        ),
        str,
    )

    # =====================================================================
    # Test with all parameters combined (None value)
    # =====================================================================

    assert_type(
        text_input(
            "Full text input",
            value=None,
            max_chars=50,
            key="nullable_input",
            type="password",
            help="Enter your password",
            autocomplete="new-password",
            on_change=my_callback,
            args=None,
            kwargs=None,
            placeholder="Password",
            disabled=False,
            label_visibility="visible",
            icon=":material/lock:",
            width=300,
            bind="query-params",
        ),
        str | None,
    )
