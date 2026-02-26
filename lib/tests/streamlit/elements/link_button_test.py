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

"""link_button unit tests."""

from collections.abc import Callable
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonLikeIconPosition_pb2 import (
    ButtonLikeIconPosition as ProtoButtonLikeIconPosition,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def _test_callback() -> None:
    pass


class LinkButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall link_button protos."""

    def test_just_label(self):
        """Test that it can be called with label and string or bytes data."""
        st.link_button("the label", url="https://streamlit.io")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.label == "the label"
        assert c.type == "secondary"
        assert not c.disabled
        assert c.ignore_rerun

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.link_button("the label", url="https://streamlit.io", disabled=True)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.disabled

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.link_button("the label", url="https://streamlit.io")

        c = self.get_delta_from_queue().new_element.link_button
        assert "https://streamlit.io" in c.url

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_type(self, type):
        """Test that it can be called with type param."""
        st.link_button("the label", url="https://streamlit.io", type=type)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.type == type

    def test_emoji_icon(self):
        """Test that it can be called with an emoji icon."""
        st.link_button("the label", url="https://streamlit.io", icon="🎈")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.icon == "🎈"

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.link_button("the label", url="https://streamlit.io", icon=":material/bolt:")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.icon == ":material/bolt:"

    def test_icon_position(self):
        """Test that icon_position is serialized for link buttons."""
        st.link_button("the label", url="https://streamlit.io", icon_position="right")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.icon_position == ProtoButtonLikeIconPosition.RIGHT

    def test_key_sets_id_in_ignore_mode(self):
        """Test that key is applied even when on_click is ignored."""
        st.link_button("the label", url="https://streamlit.io", key="my_link_key")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.id != ""
        assert c.ignore_rerun

    @parameterized.expand(
        [
            ("empty", "", r"`key` argument must be non-empty"),
            ("reserved", "$$ID-reserved", r"Keys beginning with \$\$ID are reserved"),
        ]
    )
    def test_invalid_key_raises_in_ignore_mode(
        self, _name: str, key: str, match: str
    ) -> None:
        """Test that invalid keys are rejected in default ignore mode."""
        with pytest.raises(StreamlitAPIException, match=match):
            st.link_button("the label", url="https://streamlit.io", key=key)

    @parameterized.expand(
        [
            ("rerun", "rerun"),
            ("callback", _test_callback),
        ]
    )
    def test_on_click_enables_rerun(
        self, _name: str, on_click: str | Callable[[], None]
    ) -> None:
        """Test that rerun and callback modes enable click-triggered reruns."""
        st.link_button("the label", url="https://streamlit.io", on_click=on_click)

        c = self.get_delta_from_queue().new_element.link_button
        assert not c.ignore_rerun
        assert c.id != ""

    def test_on_click_ignore_returns_delta_generator(self) -> None:
        """Test that ignore mode keeps returning a DeltaGenerator."""
        result = st.link_button(
            "the label",
            url="https://streamlit.io",
            key="ignore_return_value_link",
            on_click="ignore",
        )
        assert isinstance(result, DeltaGenerator)

    @parameterized.expand(
        [
            ("rerun", "rerun", None, "rerun_return_value_link"),
            ("callback", _test_callback, _test_callback, "callback_return_value_link"),
        ]
    )
    def test_on_click_non_ignore_returns_bool(
        self,
        _name: str,
        on_click: str | Callable[[], None],
        expected_handler: Callable[[], None] | None,
        key: str,
    ) -> None:
        """Test that non-ignore on_click modes return bool and register callbacks."""
        first_value = st.link_button(
            "the label",
            url="https://streamlit.io",
            key=key,
            on_click=on_click,
        )
        assert first_value is False

        self.script_run_ctx.reset()

        with patch(
            "streamlit.elements.widgets.button.register_widget",
            return_value=MagicMock(value=True),
        ) as mock_register_widget:
            second_value = st.link_button(
                "the label",
                url="https://streamlit.io",
                key=key,
                on_click=on_click,
            )
            assert (
                mock_register_widget.call_args.kwargs["on_change_handler"]
                is expected_handler
            )
        assert second_value is True

    def test_invalid_icon(self):
        """Test that an error is raised if an invalid icon is provided."""
        with pytest.raises(StreamlitAPIException) as e:
            st.link_button("the label", url="https://streamlit.io", icon="invalid")
        assert str(e.value) == (
            'The value "invalid" is not a valid emoji. '
            "Shortcodes are not allowed, please use a single character instead."
        )
