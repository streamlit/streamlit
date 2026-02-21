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

"""Breadcrumbs unit tests."""

from __future__ import annotations

from typing import Any

import pytest

import streamlit as st
from streamlit.elements.widgets.breadcrumbs import _BreadcrumbsSerde
from streamlit.errors import StreamlitAPIException
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase

_SAMPLE_OPTIONS = ["Home", "Electronics", "Phones"]


class TestBreadcrumbsSerde:
    """Tests for the _BreadcrumbsSerde class."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("Home", "0"),
            ("Electronics", "1"),
            ("Phones", "2"),
            (None, ""),
            ("Unknown", ""),
        ],
        ids=["first", "middle", "last", "none", "unknown"],
    )
    def test_serialize(self, value: str | None, expected: str) -> None:
        """Test serialization of various values to index strings."""
        serde = _BreadcrumbsSerde[str](_SAMPLE_OPTIONS)
        assert serde.serialize(value) == expected

    @pytest.mark.parametrize(
        ("ui_value", "expected"),
        [
            ("0", "Home"),
            ("1", "Electronics"),
            ("2", "Phones"),
            (None, None),
            ("", None),
            ("999", None),
            ("invalid", None),
        ],
        ids=[
            "first",
            "middle",
            "last",
            "none",
            "empty",
            "out_of_bounds",
            "non_numeric",
        ],
    )
    def test_deserialize(self, ui_value: str | None, expected: str | None) -> None:
        """Test deserialization of various index strings to option values."""
        serde = _BreadcrumbsSerde[str](_SAMPLE_OPTIONS)
        assert serde.deserialize(ui_value) == expected

    def test_custom_objects(self) -> None:
        """Test serde roundtrip with custom dictionary objects."""
        pages: list[dict[str, Any]] = [
            {"id": "home", "title": "Home"},
            {"id": "users", "title": "Users"},
        ]
        serde = _BreadcrumbsSerde(pages)

        assert serde.serialize(pages[1]) == "1"
        assert serde.deserialize("1") == pages[1]


class TestBreadcrumbs(DeltaGeneratorTestCase):
    """Tests for the st.breadcrumbs widget."""

    def test_basic_breadcrumbs(self) -> None:
        """Test basic breadcrumbs rendering with multiple items."""
        st.breadcrumbs(["Home", "Section", "Page"])

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.id
        assert len(proto.items) == 3
        assert proto.items[0].content == "Home"
        assert proto.items[1].content == "Section"
        assert proto.items[2].content == "Page"
        assert not proto.disabled

    def test_breadcrumbs_with_icons(self) -> None:
        """Test that material icons are extracted from formatted strings."""
        st.breadcrumbs(
            ["home", "folder"],
            format_func=lambda x: f":material/{x}: {x.title()}",
        )

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.items[0].content == "Home"
        assert proto.items[0].content_icon == ":material/home:"
        assert proto.items[1].content == "Folder"
        assert proto.items[1].content_icon == ":material/folder:"

    def test_breadcrumbs_with_emoji_icons(self) -> None:
        """Test that emoji icons are extracted from formatted strings."""
        st.breadcrumbs(
            ["home", "docs"],
            format_func=lambda x: (
                f"🏠 {x.title()}" if x == "home" else f"📄 {x.title()}"
            ),
        )

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.items[0].content == "Home"
        assert proto.items[0].content_icon == "🏠"
        assert proto.items[1].content == "Docs"
        assert proto.items[1].content_icon == "📄"

    def test_breadcrumbs_disabled(self) -> None:
        """Test that disabled flag is set correctly."""
        st.breadcrumbs(["Home", "Page"], disabled=True)

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.disabled

    def test_breadcrumbs_with_help(self) -> None:
        """Test that help tooltip text is set correctly."""
        st.breadcrumbs(["Home", "Page"], help="Navigate to parent pages")

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.help == "Navigate to parent pages"

    def test_breadcrumbs_with_format_func(self) -> None:
        """Test that format_func transforms item display text."""
        pages = [
            {"id": "home", "title": "Home Page"},
            {"id": "detail", "title": "Detail Page"},
        ]
        st.breadcrumbs(pages, format_func=lambda p: p["title"])

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.items[0].content == "Home Page"
        assert proto.items[1].content == "Detail Page"

    def test_breadcrumbs_empty_raises_error(self) -> None:
        """Test that empty items sequence raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException):
            st.breadcrumbs([])

    def test_breadcrumbs_single_item(self) -> None:
        """Test that single item breadcrumbs render correctly."""
        st.breadcrumbs(["Home"])

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert len(proto.items) == 1
        assert proto.items[0].content == "Home"

    def test_breadcrumbs_with_key(self) -> None:
        """Test that breadcrumbs with custom key generates valid ID."""
        st.breadcrumbs(["Home", "Page"], key="my_breadcrumbs")

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.id

    def test_breadcrumbs_default_separator(self) -> None:
        """Test that default separator is set correctly."""
        st.breadcrumbs(["Home", "Page"])

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.separator == "/"

    def test_breadcrumbs_custom_separator(self) -> None:
        """Test that custom text separator is set correctly."""
        st.breadcrumbs(["Home", "Page"], separator=" > ")

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.separator == " > "

    def test_breadcrumbs_material_icon_separator(self) -> None:
        """Test that material icon separator is set correctly."""
        st.breadcrumbs(["Home", "Page"], separator=":material/chevron_right:")

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.separator == ":material/chevron_right:"

    def test_breadcrumbs_value_initially_empty(self) -> None:
        """Test that value is empty string initially (no selection)."""
        st.breadcrumbs(["Home", "Page"])

        proto = self.get_delta_from_queue().new_element.breadcrumbs
        assert proto.value == ""


class TestBreadcrumbsWithAppTest:
    """Test breadcrumbs with AppTest."""

    def test_initial_value_is_none(self) -> None:
        """Test that the initial return value is None before any click."""

        def script() -> None:
            import streamlit as st

            clicked = st.breadcrumbs(["Home", "Electronics", "Phones"])
            st.write(f"Clicked: {clicked}")

        at = AppTest.from_function(script).run()
        assert at.markdown[0].value == "Clicked: None"
