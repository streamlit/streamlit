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

from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cached_message_replay
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class StMarkdownAPITest(DeltaGeneratorTestCase):
    """Test st.markdown API."""

    def test_st_markdown(self):
        """Test st.markdown."""
        st.markdown("    some markdown  ")

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "some markdown"

        # test the unsafe_allow_html keyword
        st.markdown("    some markdown  ", unsafe_allow_html=True)

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "some markdown"
        assert el.markdown.allow_html

        # test the help keyword
        st.markdown("    some markdown  ", help="help text")
        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "some markdown"
        assert el.markdown.help == "help text"

    def test_st_markdown_with_width(self):
        """Test st.markdown with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                st.markdown("some markdown", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.markdown.body == "some markdown"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_st_markdown_with_invalid_width(self):
        """Test st.markdown with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.markdown("some markdown", width=width_value)

                assert expected_error_message in str(exc.value)

    def test_st_markdown_default_width(self):
        """Test that st.markdown defaults to stretch width."""
        st.markdown("some markdown")

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "some markdown"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_works_with_element_replay(self):
        """Test that element replay works for a markdown element."""

        @st.cache_data(show_spinner=False)
        def cache_element():
            st.markdown("some markdown")

        with patch(
            "streamlit.runtime.caching.cache_utils.replay_cached_messages",
            wraps=cached_message_replay.replay_cached_messages,
        ) as replay_cached_messages_mock:
            cache_element()
            el = self.get_delta_from_queue().new_element.markdown
            assert el.body == "some markdown"
            # The first time the cached function is called, the replay function is not called
            replay_cached_messages_mock.assert_not_called()

            cache_element()
            el = self.get_delta_from_queue().new_element.markdown
            assert el.body == "some markdown"
            # The second time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called_once()

            cache_element()
            el = self.get_delta_from_queue().new_element.markdown
            assert el.body == "some markdown"
            # The third time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called()


class StCaptionAPITest(DeltaGeneratorTestCase):
    """Test st.caption APIs."""

    def test_st_caption_with_help(self):
        """Test st.caption with help."""
        st.caption("some caption", help="help text")
        el = self.get_delta_from_queue().new_element
        assert el.markdown.help == "help text"

    def test_st_caption_with_width(self):
        """Test st.caption with different width types."""
        test_cases = [
            (400, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 400),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                st.caption("some caption", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.markdown.body == "some caption"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_st_caption_with_invalid_width(self):
        """Test st.caption with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -50,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                75.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.caption("some caption", width=width_value)

                assert expected_error_message in str(exc.value)

    def test_st_caption_default_width(self):
        """Test that st.caption defaults to stretch width."""
        st.caption("some caption")

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "some caption"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True


class StLatexAPITest(DeltaGeneratorTestCase):
    """Test st.latex APIs."""

    def test_st_latex_with_help(self):
        """Test st.latex with help."""
        st.latex(
            r"""
            a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
            \sum_{k=0}^{n-1} ar^k =
            a \left(\frac{1-r^{n}}{1-r}\right)
            """,
            help="help text",
        )
        el = self.get_delta_from_queue().new_element
        assert el.markdown.help == "help text"


class StBadgeAPITest(DeltaGeneratorTestCase):
    """Test st.badge API."""

    def test_st_badge(self):
        """Test st.badge with all parameters."""
        # Test with all parameters
        st.badge(
            "Badge with all params",
            icon=":material/warning:",
            color="red",
        )

        el = self.get_delta_from_queue().new_element
        assert (
            el.markdown.body == ":red-badge[:material/warning: Badge with all params]"
        )
        assert not el.markdown.allow_html

        # Test with default parameters
        st.badge("Simple badge")
        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == ":blue-badge[Simple badge]"

    def test_st_badge_with_width(self):
        """Test st.badge with different width types."""
        test_cases = [
            (200, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 200),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                st.badge("test badge", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.markdown.body == ":blue-badge[test badge]"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_st_badge_with_invalid_width(self):
        """Test st.badge with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -25,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                50.7,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.badge("test badge", width=width_value)

                assert expected_error_message in str(exc.value)

    def test_st_badge_default_width(self):
        """Test that st.badge defaults to content width."""
        st.badge("test badge")

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == ":blue-badge[test badge]"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_st_badge_with_help(self):
        """Test st.badge with help parameter."""
        st.badge("Badge with help", help="Tooltip text")
        el = self.get_delta_from_queue().new_element

        assert el.markdown.body == ":blue-badge[Badge with help]"
        assert el.markdown.help == "Tooltip text"

    def test_st_badge_help_not_set_when_none(self):
        """Test that st.badge does not set help when help is None."""
        st.badge("Badge without help")
        el = self.get_delta_from_queue().new_element

        assert el.markdown.body == ":blue-badge[Badge without help]"
        assert not getattr(el.markdown, "help", None)


class StMarkdownTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.markdown text_alignment parameter."""

    @parameterized.expand(
        [
            ("left", 1),
            ("center", 2),
            ("right", 3),
            ("justify", 4),
            (None, 1),  # Default case
        ]
    )
    def test_st_markdown_text_alignment(
        self, text_alignment: str | None, expected_alignment: int
    ):
        """Test st.markdown with various text_alignment values.

        Parameters
        ----------
        text_alignment : str | None
            The text alignment value to test, or None for default behavior.
        expected_alignment : int
            The expected protobuf alignment enum value (1=LEFT, 2=CENTER, 3=RIGHT, 4=JUSTIFY).
        """
        if text_alignment is None:
            st.markdown("Test")
        else:
            st.markdown("Test", text_alignment=text_alignment)

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "Test"
        assert el.text_alignment_config.alignment == expected_alignment

    def test_st_markdown_text_alignment_invalid(self):
        """Test st.markdown with invalid text_alignment raises error."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.markdown("Test", text_alignment="invalid")

        assert 'Invalid text_alignment value: "invalid"' in str(exc.value)
        assert "left" in str(exc.value)
        assert "center" in str(exc.value)
        assert "right" in str(exc.value)
        assert "justify" in str(exc.value)


class StCaptionTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.caption text_alignment parameter."""

    @parameterized.expand(
        [
            ("left", 1),
            ("center", 2),
            ("right", 3),
            ("justify", 4),
            (None, 1),  # Default case
        ]
    )
    def test_st_caption_text_alignment(
        self, text_alignment: str | None, expected_alignment: int
    ):
        """Test st.caption with various text_alignment values.

        Parameters
        ----------
        text_alignment : str | None
            The text alignment value to test, or None for default behavior.
        expected_alignment : int
            The expected protobuf alignment enum value.
        """
        if text_alignment is None:
            st.caption("Caption text")
        else:
            st.caption("Caption text", text_alignment=text_alignment)

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "Caption text"
        assert el.markdown.is_caption is True
        assert el.text_alignment_config.alignment == expected_alignment

    def test_st_caption_text_alignment_invalid(self):
        """Test st.caption with invalid text_alignment raises error."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.caption("Caption text", text_alignment="top")

        assert 'Invalid text_alignment value: "top"' in str(exc.value)
        assert "left" in str(exc.value)
        assert "center" in str(exc.value)
        assert "right" in str(exc.value)
        assert "justify" in str(exc.value)
