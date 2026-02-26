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
    from streamlit.elements.widgets.checkbox import CheckboxMixin

    checkbox = CheckboxMixin().checkbox
    toggle = CheckboxMixin().toggle

    # =====================================================================
    # st.checkbox return type tests
    # =====================================================================

    assert_type(checkbox("Accept terms"), bool)
    assert_type(checkbox("Accept terms", key="my_checkbox"), bool)
    assert_type(checkbox("Accept terms", key=123), bool)

    assert_type(checkbox("Accept terms", value=True), bool)
    assert_type(checkbox("Accept terms", value=False), bool)

    assert_type(checkbox("Accept terms", help="Check to accept"), bool)
    assert_type(checkbox("Accept terms", help=None), bool)

    assert_type(checkbox("Accept terms", disabled=True), bool)
    assert_type(checkbox("Accept terms", disabled=False), bool)

    assert_type(checkbox("Accept terms", label_visibility="visible"), bool)
    assert_type(checkbox("Accept terms", label_visibility="hidden"), bool)
    assert_type(checkbox("Accept terms", label_visibility="collapsed"), bool)

    assert_type(checkbox("Accept terms", width="content"), bool)
    assert_type(checkbox("Accept terms", width="stretch"), bool)
    assert_type(checkbox("Accept terms", width=200), bool)
    assert_type(
        checkbox("Accept terms", key="bind_checkbox", bind="query-params"), bool
    )

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(checkbox("Accept terms", on_change=my_callback), bool)
    assert_type(
        checkbox("Accept terms", on_change=callback_with_args, args=(1, "a")), bool
    )
    assert_type(
        checkbox(
            "Accept terms", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        bool,
    )
    assert_type(checkbox("Accept terms", on_change=None), bool)

    assert_type(
        checkbox(
            "Full checkbox",
            value=True,
            key="full_checkbox",
            help="Full help",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        bool,
    )

    # =====================================================================
    # st.toggle return type tests
    # =====================================================================

    assert_type(toggle("Enable feature"), bool)
    assert_type(toggle("Enable feature", key="my_toggle"), bool)
    assert_type(toggle("Enable feature", key=456), bool)

    assert_type(toggle("Enable feature", value=True), bool)
    assert_type(toggle("Enable feature", value=False), bool)

    assert_type(toggle("Enable feature", help="Toggle to enable"), bool)
    assert_type(toggle("Enable feature", help=None), bool)

    assert_type(toggle("Enable feature", disabled=True), bool)
    assert_type(toggle("Enable feature", disabled=False), bool)

    assert_type(toggle("Enable feature", label_visibility="visible"), bool)
    assert_type(toggle("Enable feature", label_visibility="hidden"), bool)
    assert_type(toggle("Enable feature", label_visibility="collapsed"), bool)

    assert_type(toggle("Enable feature", width="content"), bool)
    assert_type(toggle("Enable feature", width="stretch"), bool)
    assert_type(toggle("Enable feature", width=150), bool)
    assert_type(toggle("Enable feature", key="bind_toggle", bind="query-params"), bool)

    assert_type(toggle("Enable feature", on_change=my_callback), bool)
    assert_type(
        toggle("Enable feature", on_change=callback_with_args, args=(1, "a")), bool
    )
    assert_type(
        toggle(
            "Enable feature", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        bool,
    )
    assert_type(toggle("Enable feature", on_change=None), bool)

    assert_type(
        toggle(
            "Full toggle",
            value=True,
            key="full_toggle",
            help="Full help",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        bool,
    )
