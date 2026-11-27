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

"""Unit tests for ``st.card``."""

from __future__ import annotations

from typing import Any

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.card import _LOGGER
from streamlit.elements.lib.card_container import CardContainer
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidHeightError,
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidWidthError,
    StreamlitMissingRequiredParameterError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class CardTest(DeltaGeneratorTestCase):
    """Tests for the block that ``st.card`` sends."""

    def _card_block(self) -> BlockProto:
        """Return the card block, which is the first message of a lone card."""
        return self.get_delta_from_queue(0).add_block

    def test_returns_card_container(self) -> None:
        """The card is its own body, returned as a ``CardContainer``."""
        card = st.card("Revenue")

        assert isinstance(card, CardContainer)

    def test_with_returns_the_card(self) -> None:
        """``with st.card(...) as card`` binds the same container."""
        card = st.card("Revenue")
        with card as entered:
            pass

        assert entered is card

    def test_card_proto_fields(self) -> None:
        """Every parameter reaches the proto."""
        st.card(
            "Revenue",
            icon=":material/payments:",
            caption="Last 12 months",
            help="Monthly recurring revenue",
            border=False,
            background=True,
            width=400,
            height=300,
        )
        block = self._card_block()

        assert block.card.label == "Revenue"
        assert block.card.icon == ":material/payments:"
        assert block.card.caption == "Last 12 months"
        assert block.card.help == "Monthly recurring revenue"
        assert block.card.border is False
        assert block.card.background is True
        assert block.width_config.pixel_width == 400
        assert block.height_config.pixel_height == 300
        assert block.allow_empty is True

    def test_defaults(self) -> None:
        """A card is outlined, unfilled, full width, and fills its row."""
        st.card("Revenue")
        block = self._card_block()

        assert block.card.border is True
        assert block.card.background is False
        assert block.card.icon == ""
        assert block.card.caption == ""
        assert block.card.help == ""
        assert block.width_config.use_stretch is True
        assert block.height_config.use_stretch is True

    def test_content_width_and_height(self) -> None:
        """``"content"`` sizes are sent as content configs."""
        st.card("Revenue", width="content", height="content")
        block = self._card_block()

        assert block.width_config.use_content is True
        assert block.height_config.use_content is True

    def test_children_are_two_slots_then_body(self) -> None:
        """A card has three children in a fixed order, even if unused."""
        st.card("Revenue")
        messages = [m for m in self.forward_msg_queue._queue if m.HasField("delta")]

        assert [list(m.metadata.delta_path) for m in messages] == [
            [0, 0],
            [0, 0, 0],
            [0, 0, 1],
            [0, 0, 2],
        ]
        extras, actions, body = (m.delta.add_block for m in messages[1:])
        for slot in (extras, actions):
            assert slot.flex_container.direction == (
                BlockProto.FlexContainer.Direction.HORIZONTAL
            )
            assert slot.width_config.use_content is True
            assert slot.allow_empty is False
        assert (
            extras.flex_container.justify
            == BlockProto.FlexContainer.Justify.JUSTIFY_START
        )
        assert (
            actions.flex_container.justify
            == BlockProto.FlexContainer.Justify.JUSTIFY_END
        )
        assert body.flex_container.direction == (
            BlockProto.FlexContainer.Direction.VERTICAL
        )
        assert body.height_config.use_stretch is True
        assert body.width_config.use_stretch is True
        assert body.allow_empty is False

    def test_elements_are_written_to_the_body(self) -> None:
        """Both ``with`` and direct calls write below the header slots."""
        card = st.card("Revenue")
        with card:
            st.text("in with")
        card.text("direct")
        paths = [
            list(m.metadata.delta_path)
            for m in self.forward_msg_queue._queue
            if m.delta.WhichOneof("type") == "new_element"
        ]

        assert paths == [[0, 0, 2, 0], [0, 0, 2, 1]]

    def test_header_slots_keep_their_position(self) -> None:
        """Writing to a slot doesn't move the body."""
        card = st.card("Revenue")
        assert card._actions is not None
        assert card._header_extras is not None
        card._actions.text("action")
        card._header_extras.text("extra")
        card.text("body")
        paths = {
            m.delta.new_element.text.body: list(m.metadata.delta_path)
            for m in self.forward_msg_queue._queue
            if m.delta.WhichOneof("type") == "new_element"
        }

        assert paths == {
            "action": [0, 0, 1, 0],
            "extra": [0, 0, 0, 0],
            "body": [0, 0, 2, 0],
        }

    def test_two_cards_do_not_share_slots(self) -> None:
        """Each card owns its own slot containers."""
        first = st.card("One")
        second = st.card("Two")

        assert first._actions is not second._actions
        assert first._header_extras is not second._header_extras

    def test_key_sets_block_id_without_widget_state(self) -> None:
        """``key`` gives the block an id for the CSS class and no session state."""
        st.card("Revenue", key="revenue_card")
        block = self._card_block()

        assert "revenue_card" in block.id
        assert "revenue_card" not in st.session_state

    def test_no_key_leaves_id_unset(self) -> None:
        """Without ``key`` the block id stays empty."""
        st.card("Revenue")

        assert self._card_block().id == ""

    def test_icon_whitespace_is_unset(self) -> None:
        """A whitespace-only icon counts as no icon."""
        st.card("Revenue", icon="   ")

        assert self._card_block().card.icon == ""

    def test_caption_and_help_whitespace_are_unset(self) -> None:
        """Whitespace-only text counts as not set."""
        st.card("Revenue", caption="  \n ", help="   ")
        block = self._card_block()

        assert block.card.caption == ""
        assert block.card.help == ""

    def test_none_label_raises(self) -> None:
        """A missing label is an error, as in ``st.expander``."""
        with pytest.raises(StreamlitMissingRequiredParameterError):
            st.card(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    @parameterized.expand([("empty", ""), ("whitespace", "   ")])
    def test_blank_label_logs_card_warning(self, _name: str, label: str) -> None:
        """A blank label warns about accessibility without mentioning visibility."""
        with self.assertLogs(_LOGGER) as logs:
            st.card(label)

        message = logs.records[0].getMessage()
        assert "accessible name" in message
        assert "label_visibility" not in message
        assert logs.records[0].stack_info is not None

    def test_non_empty_label_does_not_warn(self) -> None:
        """A normal label logs nothing."""
        with self.assertNoLogs(_LOGGER):
            st.card("Revenue")

    def test_spinner_icon_raises(self) -> None:
        """The spinner icon is reserved for header updates."""
        with pytest.raises(StreamlitAPIException, match="spinner"):
            st.card("Revenue", icon="spinner")

    def test_invalid_icon_raises(self) -> None:
        """Icons are validated like other commands."""
        with pytest.raises(StreamlitAPIException):
            st.card("Revenue", icon="not an icon")

    @parameterized.expand(
        [
            ("border", {"border": "yes"}),
            ("background", {"background": None}),
        ]
    )
    def test_non_bool_surface_raises(self, _name: str, kwargs: dict[str, Any]) -> None:
        """Surface flags must be booleans."""
        with pytest.raises(StreamlitInvalidParameterTypeError):
            st.card("Revenue", **kwargs)

    def test_invalid_width_raises(self) -> None:
        """Width follows ``st.container``."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.card("Revenue", width="wide")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def test_invalid_height_raises(self) -> None:
        """Height follows ``st.container``."""
        with pytest.raises(StreamlitInvalidHeightError):
            st.card("Revenue", height=-10)

    def test_card_in_columns_and_sidebar(self) -> None:
        """Cards work from any container."""
        left, _right = st.columns(2)
        left_card = left.card("Left")
        sidebar_card = st.sidebar.card("Side")

        assert isinstance(left_card, CardContainer)
        assert isinstance(sidebar_card, CardContainer)

    def test_nested_cards(self) -> None:
        """A card can hold another card."""
        with st.card("Outer"):
            inner = st.card("Inner", border=False)

        assert isinstance(inner, CardContainer)

    def test_card_replays_from_cache(self) -> None:
        """A cached function that draws a card replays its blocks and body."""

        @st.cache_data
        def draw() -> None:
            with st.card("Cached"):
                st.text("body")

        draw()
        self.clear_queue()
        draw()
        messages = [m for m in self.forward_msg_queue._queue if m.HasField("delta")]

        # The first call already placed a card at [0, 0], so the replay is the
        # second card of the page.
        assert [list(m.metadata.delta_path) for m in messages] == [
            [0, 1],
            [0, 1, 0],
            [0, 1, 1],
            [0, 1, 2],
            [0, 1, 2, 0],
        ]
        assert messages[0].delta.add_block.card.label == "Cached"
