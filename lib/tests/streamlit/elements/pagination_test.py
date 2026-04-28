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

"""st.pagination unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.elements.widgets.pagination import PaginationSerde
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.session_state import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


def test_pagination_serde_returns_default_without_ui_value() -> None:
    """Test that the serde uses the default before UI interaction."""
    serde = PaginationSerde(default=3, num_pages=10)

    assert serde.deserialize(None) == 3


def test_pagination_serde_rejects_out_of_range_ui_value() -> None:
    """Test that the serde resets invalid UI values to the default."""
    serde = PaginationSerde(default=2, num_pages=5)

    assert serde.deserialize(8) == 2


class TestPaginationCommand(DeltaGeneratorTestCase):
    """Tests for the st.pagination command."""

    def test_page_count_is_set(self) -> None:
        """Test that num_pages is set on the proto."""
        value = st.pagination(10)

        proto = self.get_delta_from_queue().new_element.pagination
        assert value == 1
        assert proto.num_pages == 10
        assert proto.default == 1

    def test_default_value_is_set(self) -> None:
        """Test that the default value is returned and set on the proto."""
        value = st.pagination(10, default=4)

        proto = self.get_delta_from_queue().new_element.pagination
        assert value == 4
        assert proto.default == 4

    def test_max_visible_pages_is_set(self) -> None:
        """Test that max_visible_pages is set when provided."""
        st.pagination(10, max_visible_pages=5)

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.max_visible_pages == 5

    def test_max_visible_pages_can_be_none(self) -> None:
        """Test that max_visible_pages can be omitted from the proto."""
        st.pagination(10, max_visible_pages=None)

        proto = self.get_delta_from_queue().new_element.pagination
        assert not proto.HasField("max_visible_pages")

    def test_invalid_num_pages(self) -> None:
        """Test that invalid num_pages values raise an exception."""
        for num_pages in [0, -1, True]:
            with self.subTest(num_pages=num_pages):
                with pytest.raises(StreamlitAPIException) as e:
                    st.pagination(num_pages)

                assert "`num_pages` must be an integer greater than 0." in str(e.value)

    def test_invalid_default(self) -> None:
        """Test that invalid default values raise an exception."""
        for default in [0, -1, True]:
            with self.subTest(default=default):
                with pytest.raises(StreamlitAPIException) as e:
                    st.pagination(10, default=default)

                assert "`default` must be an integer greater than 0." in str(e.value)

    def test_default_above_num_pages(self) -> None:
        """Test that default cannot exceed num_pages."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(3, default=4)

        assert "`default` must be between 1 and `num_pages`, inclusive." in str(e.value)

    def test_invalid_max_visible_pages(self) -> None:
        """Test that invalid max_visible_pages values raise an exception."""
        for max_visible_pages in [-1, True]:
            with self.subTest(max_visible_pages=max_visible_pages):
                with pytest.raises(StreamlitAPIException) as e:
                    st.pagination(10, max_visible_pages=max_visible_pages)

                assert (
                    "`max_visible_pages` must be a non-negative integer or None."
                    in str(e.value)
                )

    def test_disabled_state(self) -> None:
        """Test that disabled state is set correctly."""
        st.pagination(10, disabled=True)

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.disabled is True

    def test_widget_state_changed_via_session_state(self) -> None:
        """Test that widget state can be set via session_state."""
        st.session_state.page = 4

        value = st.pagination(10, key="page")

        assert value == 4

    def test_page_resets_when_num_pages_decreases(self) -> None:
        """Test that out-of-range state resets to the default page."""
        st.session_state.page = 8

        value = st.pagination(5, key="page", default=2)

        proto = self.get_delta_from_queue().new_element.pagination
        assert value == 2
        assert st.session_state.page == 2
        assert proto.value == 2
        assert proto.set_value is True

    def test_on_change_callback_registered(self) -> None:
        """Test that on_change callback is registered."""
        st.pagination(10, on_change=lambda: None)

        ctx = get_script_run_ctx()
        assert ctx is not None
        session_state = ctx.session_state._state
        widget_id = session_state.get_widget_states()[0].id
        metadata = session_state._new_widget_state.widget_metadata.get(widget_id)
        assert metadata is not None
        assert metadata.callback is not None

    def test_outside_form(self) -> None:
        """Test that form_id is empty outside of a form."""
        st.pagination(10)

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self) -> None:
        """Test that form_id is set correctly inside of a form."""
        with st.form("form"):
            st.pagination(10)

        assert len(self.get_all_deltas_from_queue()) == 2
        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.pagination
        assert proto.form_id == form_proto.form.form_id

    def test_stable_id_with_key(self) -> None:
        """Test that a user key keeps the widget ID stable across parameter changes."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.pagination(
                10,
                key="pagination_key",
                default=1,
                max_visible_pages=7,
                disabled=False,
                width="content",
            )
            id1 = self.get_delta_from_queue().new_element.pagination.id

            st.pagination(
                5,
                key="pagination_key",
                default=2,
                max_visible_pages=3,
                disabled=True,
                width="stretch",
            )
            id2 = self.get_delta_from_queue().new_element.pagination.id

        assert id1 == id2

    def test_duplicate_element_id_error_message(self) -> None:
        """Test that duplicate widget ID produces a helpful error message."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(10)
            st.pagination(10)

        assert "pagination" in str(e.value)


class TestPaginationWidthConfig(DeltaGeneratorTestCase):
    """Tests for st.pagination width configuration."""

    def test_default_width_is_content(self) -> None:
        """Test that default width is content."""
        st.pagination(10)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )

    def test_stretch_width(self) -> None:
        """Test that stretch width is set correctly."""
        st.pagination(10, width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )

    def test_pixel_width(self) -> None:
        """Test that pixel width is set correctly."""
        st.pagination(10, width=300)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 300


def test_apptest_pagination_value_updates() -> None:
    """Test that AppTest can update pagination values."""
    from streamlit.testing.v1 import AppTest

    def script() -> None:
        import streamlit as st

        page = st.pagination(10, key="page")
        st.write(f"Page: {page}")

    at = AppTest.from_function(script).run()
    assert at.pagination[0].value == 1

    at = at.pagination[0].set_value(4).run()
    assert at.pagination[0].value == 4
    assert at.markdown[0].value == "Page: 4"


def test_apptest_pagination_resets_when_ui_value_exceeds_num_pages() -> None:
    """Test that shrinking num_pages resets stale UI state on the frontend."""
    from streamlit.testing.v1 import AppTest

    script = """
import streamlit as st

if "num_pages" not in st.session_state:
    st.session_state.num_pages = 10

page = st.pagination(st.session_state.num_pages, key="page", default=2)
st.write(f"Page: {page}")
"""

    at = AppTest.from_string(script).run()
    at = at.pagination[0].set_value(8).run()
    assert at.pagination[0].value == 8

    at.session_state.num_pages = 5
    at = at.run()
    assert at.pagination[0].value == 2
    assert at.pagination[0].proto.set_value is True
    assert at.pagination[0].proto.value == 2
    assert at.markdown[0].value == "Page: 2"
