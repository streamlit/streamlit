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

"""button unit test."""

from __future__ import annotations

from typing import Any, Callable

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


def get_button_command_matrix(
    test_params: list[Any] | None = None,
) -> list[tuple[Any, ...]]:
    """Return a test matrix for the different button commands and the passed arguments.

    This function creates a cartesian product of the button commands and the
    provided `test_params`.

    Parameters
    ----------
    test_params
        A list of test cases. Each item in the list will be treated as a set of
        arguments for a single test run. If an item is not a tuple, it will be
        wrapped in one.

    """
    # The callables are wrapped in a list of tuples with a name for better test
    # case naming.
    commands: list[tuple[str, Callable[..., Any]]] = [
        (
            "button",
            lambda label="test_label_button", **kwargs: st.button(label, **kwargs),
        ),
        (
            "download_button",
            lambda label="test_label_download_button", **kwargs: st.download_button(
                label, "data", **kwargs
            ),
        ),
        (
            "link_button",
            lambda label="test_label_link_button", **kwargs: st.link_button(
                label, "https://example.com", **kwargs
            ),
        ),
        (
            "page_link",
            lambda label="test_label_page_link", **kwargs: st.page_link(
                "https://example.com", label=label, **kwargs
            ),
        ),
    ]

    if not test_params:
        return commands

    matrix: list[tuple[Any, ...]] = []
    for command_tuple in commands:
        for args in test_params:
            # The arguments for a single test case are always wrapped in a tuple.
            args_tuple = args if isinstance(args, tuple) else (args,)
            matrix.append(command_tuple + args_tuple)
    return matrix


class ButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall button protos."""

    def test_button(self):
        """Test that it can be called."""
        st.button("the label")

        c = self.get_delta_from_queue().new_element.button
        assert c.label == "the label"
        assert not c.default
        assert c.form_id == ""
        assert c.type == "secondary"
        assert not c.is_form_submitter
        assert not c.disabled

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_type(self, type):
        """Test that it can be called with type param."""
        st.button("the label", type=type)

        c = self.get_delta_from_queue().new_element.button
        assert c.type == type

    def test_emoji_icon(self):
        """Test that it can be called with emoji icon."""
        st.button("the label", icon="⚡")

        c = self.get_delta_from_queue().new_element.button
        assert c.icon == "⚡"

    def test_material_icon(self):
        """Test that it can be called with material icon."""
        st.button("the label", icon=":material/thumb_up:")

        c = self.get_delta_from_queue().new_element.button
        assert c.icon == ":material/thumb_up:"

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.button("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.button
        assert c.disabled

    def test_use_container_width_true(self):
        """Test use_container_width=True is mapped to width='stretch'."""
        for button_type, button_func, width in get_button_command_matrix(
            test_params=["stretch", "content", 200]
        ):
            with self.subTest(button_type, width=width):
                button_func(
                    label=f"test_use_container_width_true {button_type} {width}",
                    use_container_width=True,
                    width=width,
                )
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_STRETCH.value
                )
                assert el.width_config.use_stretch is True

        with self.subTest("no width"):
            for button_type, button_func in get_button_command_matrix():
                with self.subTest(button_type):
                    button_func(use_container_width=True)
                    el = self.get_delta_from_queue().new_element
                    assert (
                        el.width_config.WhichOneof("width_spec")
                        == WidthConfigFields.USE_STRETCH.value
                    )
                    assert el.width_config.use_stretch is True

    def test_use_container_width_false(self):
        """Test use_container_width=False is mapped to width='content'."""
        for button_type, button_func, width in get_button_command_matrix(
            test_params=[
                "stretch",
                "content",
                200,
            ]
        ):
            with self.subTest(button_type, width=width):
                button_func(
                    label=f"test_use_container_width_false {button_type} {width}",
                    use_container_width=False,
                    width=width,
                )
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

        with self.subTest("no width"):
            for button_type, button_func in get_button_command_matrix():
                with self.subTest(button_type):
                    button_func(use_container_width=False)
                    el = self.get_delta_from_queue().new_element
                    assert (
                        el.width_config.WhichOneof("width_spec")
                        == WidthConfigFields.USE_CONTENT.value
                    )
                    assert el.width_config.use_content is True

    def test_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.button("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_button_width_content(self):
        """Test button elements with width set to content."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func(width="content")
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

    def test_button_width_stretch(self):
        """Test button elements with width set to stretch."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func(width="stretch")
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_STRETCH.value
                )
                assert el.width_config.use_stretch is True

    def test_button_width_pixels(self):
        """Test button elements with width set to pixels."""
        test_cases = get_button_command_matrix()
        for button_type, button_func in test_cases:
            with self.subTest(f"{button_type} with fixed width"):
                button_func(width=200)

                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.PIXEL_WIDTH.value
                )
                assert el.width_config.pixel_width == 200

    def test_button_width_default(self):
        """Test button elements use content width by default."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func()

                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

    def test_button_invalid_width(self):
        """Test button elements with invalid width values."""
        test_cases = get_button_command_matrix(
            test_params=["invalid", -100, 0, 100.5, None]
        )
        for button_type, button_func, width in test_cases:
            with self.subTest(f"{button_type} with width {width}"):
                with pytest.raises(StreamlitAPIException):
                    button_func(width=width)
