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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from enum import Enum

    from streamlit.elements.widgets.menu_button import MenuButtonMixin

    menu_button = MenuButtonMixin().menu_button

    class Action(Enum):
        EXPORT = "export"
        IMPORT = "import"
        DELETE = "delete"

    # =====================================================================
    # st.menu_button return type tests
    # =====================================================================

    # Basic menu button - returns selected option type or None
    assert_type(menu_button("Actions", ["CSV", "JSON", "PDF"]), str | None)
    assert_type(menu_button("Numbers", [1, 2, 3]), int | None)
    assert_type(menu_button("Floats", [1.0, 2.0, 3.0]), float | None)
    assert_type(menu_button("Mixed", [1.0, 2, 3.0]), float | None)

    # Menu button with Enum options
    assert_type(menu_button("Action", Action), Action | None)
    assert_type(menu_button("Action", [Action.EXPORT, Action.IMPORT]), Action | None)

    # Menu button with mixed types
    assert_type(menu_button("Mixed", [1, "two", Action.DELETE]), object)

    # Menu button with key parameter (str or int)
    assert_type(menu_button("Actions", ["a", "b"], key="my_menu"), str | None)
    assert_type(menu_button("Actions", ["a", "b"], key=123), str | None)
    assert_type(menu_button("Actions", ["a", "b"], key=None), str | None)

    # Menu button with help parameter
    assert_type(menu_button("Actions", ["a", "b"], help="Select an action"), str | None)
    assert_type(menu_button("Actions", ["a", "b"], help=None), str | None)

    # Menu button with type parameter - Literal["primary", "secondary", "tertiary"]
    assert_type(menu_button("Actions", ["a"], type="primary"), str | None)
    assert_type(menu_button("Actions", ["a"], type="secondary"), str | None)
    assert_type(menu_button("Actions", ["a"], type="tertiary"), str | None)

    # Menu button with icon parameter
    assert_type(menu_button("Actions", ["a"], icon="🚨"), str | None)
    assert_type(menu_button("Actions", ["a"], icon=":material/menu:"), str | None)
    assert_type(menu_button("Actions", ["a"], icon=None), str | None)

    # Menu button with disabled parameter
    assert_type(menu_button("Actions", ["a"], disabled=True), str | None)
    assert_type(menu_button("Actions", ["a"], disabled=False), str | None)

    # Menu button with width parameter - "content", "stretch", or int
    assert_type(menu_button("Actions", ["a"], width="content"), str | None)
    assert_type(menu_button("Actions", ["a"], width="stretch"), str | None)
    assert_type(menu_button("Actions", ["a"], width=200), str | None)

    # Menu button with on_click callback
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(menu_button("Actions", ["a"], on_click=my_callback), str | None)
    assert_type(
        menu_button("Actions", ["a"], on_click=callback_with_args, args=(1, "a")),
        str | None,
    )
    assert_type(
        menu_button(
            "Actions", ["a"], on_click=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        str | None,
    )
    assert_type(menu_button("Actions", ["a"], on_click=None), str | None)

    # Menu button with format_func
    def my_format(x: str) -> str:
        return x.upper()

    assert_type(menu_button("Actions", ["a", "b"], format_func=my_format), str | None)
    assert_type(menu_button("Actions", ["a", "b"], format_func=str), str | None)

    # Menu button with all parameters combined
    assert_type(
        menu_button(
            "Full menu",
            ["Option A", "Option B"],
            key="full_menu",
            help="Full help text",
            on_click=my_callback,
            args=None,
            kwargs=None,
            type="primary",
            icon="🚀",
            disabled=False,
            width="stretch",
            format_func=str,
        ),
        str | None,
    )
