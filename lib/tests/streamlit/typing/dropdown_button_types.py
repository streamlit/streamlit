# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.elements.widgets.dropdown_button import DropdownButtonMixin

    dropdown_button = DropdownButtonMixin().dropdown_button

    # Basic dropdown button type tests
    assert_type(dropdown_button("label", ["option1", "option2"]), Union[str, None])
    assert_type(dropdown_button("label", []), Union[str, None])

    # Test with different option types (should all be converted to strings)
    assert_type(dropdown_button("label", ["a", "b", "c"]), Union[str, None])
    assert_type(dropdown_button("label", ["option1"]), Union[str, None])

    # Test with all parameters
    assert_type(
        dropdown_button(
            "label",
            ["option1", "option2"],
            key="test_key",
            help="Help text",
            on_click=lambda: None,
            args=(),
            kwargs={},
            type="primary",
            icon="🔥",
            disabled=False,
            use_container_width=True,
            placeholder="Select option",
        ),
        Union[str, None],
    )

    # Test with different button types
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], type="primary"), Union[str, None]
    )
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], type="secondary"), Union[str, None]
    )
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], type="tertiary"), Union[str, None]
    )

    # Test with boolean parameters
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], disabled=True), Union[str, None]
    )
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], use_container_width=True),
        Union[str, None],
    )

    # Test with icon parameter
    assert_type(dropdown_button("label", ["opt1", "opt2"], icon="⭐"), Union[str, None])
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], icon=":material/star:"),
        Union[str, None],
    )

    # Test with placeholder parameter
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], placeholder="Choose one"),
        Union[str, None],
    )
    assert_type(
        dropdown_button("label", ["opt1", "opt2"], placeholder=None), Union[str, None]
    )

    # Test with callback parameters
    def callback_func():
        pass

    assert_type(
        dropdown_button("label", ["opt1", "opt2"], on_click=callback_func),
        Union[str, None],
    )

    def callback_with_args(x: int, y: str):
        pass

    assert_type(
        dropdown_button(
            "label",
            ["opt1", "opt2"],
            on_click=callback_with_args,
            args=(1,),
            kwargs={"y": "test"},
        ),
        Union[str, None],
    )
