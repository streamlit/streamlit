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
    from streamlit.elements.widgets.color_picker import ColorPickerMixin

    color_picker = ColorPickerMixin().color_picker

    # =====================================================================
    # st.color_picker return type tests
    # =====================================================================

    # Basic usage
    assert_type(color_picker("Pick a color"), str)
    assert_type(color_picker("Pick a color", key="my_color"), str)
    assert_type(color_picker("Pick a color", key=123), str)

    # Value parameter
    assert_type(color_picker("Pick a color", value="#FF0000"), str)
    assert_type(color_picker("Pick a color", value="#FFF"), str)
    assert_type(color_picker("Pick a color", value=None), str)

    # Help parameter
    assert_type(color_picker("Pick a color", help="Choose a color"), str)
    assert_type(color_picker("Pick a color", help=None), str)

    # Disabled parameter
    assert_type(color_picker("Pick a color", disabled=True), str)
    assert_type(color_picker("Pick a color", disabled=False), str)

    # Label visibility parameter
    assert_type(color_picker("Pick a color", label_visibility="visible"), str)
    assert_type(color_picker("Pick a color", label_visibility="hidden"), str)
    assert_type(color_picker("Pick a color", label_visibility="collapsed"), str)

    # Width parameter
    assert_type(color_picker("Pick a color", width="content"), str)
    assert_type(color_picker("Pick a color", width="stretch"), str)
    assert_type(color_picker("Pick a color", width=200), str)

    # Bind parameter
    assert_type(
        color_picker("Pick a color", key="bind_color", bind="query-params"), str
    )
    assert_type(color_picker("Pick a color", bind=None), str)

    # Callback parameters
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(color_picker("Pick a color", on_change=my_callback), str)
    assert_type(
        color_picker("Pick a color", on_change=callback_with_args, args=(1, "a")), str
    )
    assert_type(
        color_picker(
            "Pick a color", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        str,
    )
    assert_type(color_picker("Pick a color", on_change=None), str)

    # Full combination of parameters
    assert_type(
        color_picker(
            "Full color picker",
            value="#00FF00",
            key="full_color",
            help="Full help text",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
            width="stretch",
            bind=None,
        ),
        str,
    )
