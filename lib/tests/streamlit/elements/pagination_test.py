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
from streamlit.errors import StreamlitAPIException, StreamlitInvalidBindValueError
from streamlit.runtime.state.session_state import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TestPaginationSerde:
    """Tests for PaginationSerde serializer/deserializer."""

    def test_serialize_value(self):
        """Test that int value is serialized correctly."""
        serde = PaginationSerde(default=1, num_pages=10)
        assert serde.serialize(5) == 5

    def test_deserialize_valid_value(self):
        """Test that valid value is deserialized correctly."""
        serde = PaginationSerde(default=1, num_pages=10)
        assert serde.deserialize(5) == 5

    def test_deserialize_none_returns_default(self):
        """Test that None returns default value."""
        serde = PaginationSerde(default=3, num_pages=10)
        assert serde.deserialize(None) == 3

    @pytest.mark.parametrize(
        "ui_value",
        [0, -1, 11, 100],
        ids=["zero", "negative", "exceeds_max", "far_exceeds_max"],
    )
    def test_deserialize_out_of_range_returns_default(self, ui_value: int):
        """Test that out-of-range values return default."""
        serde = PaginationSerde(default=1, num_pages=10)
        assert serde.deserialize(ui_value) == 1


class TestPaginationCommand(DeltaGeneratorTestCase):
    """Tests for the st.pagination command."""

    def test_basic_pagination(self):
        """Test basic pagination with num_pages."""
        val = st.pagination(10)
        assert val == 1

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.num_pages == 10
        assert delta.default == 1

    def test_custom_default(self):
        """Test pagination with custom default."""
        val = st.pagination(10, default=5)
        assert val == 5

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.default == 5

    def test_max_visible_pages(self):
        """Test pagination with max_visible_pages."""
        st.pagination(10, max_visible_pages=5)

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.max_visible_pages == 5

    def test_max_visible_pages_none(self):
        """Test pagination with max_visible_pages=None (no limit)."""
        st.pagination(10, max_visible_pages=None)

        delta = self.get_delta_from_queue().new_element.pagination
        assert not delta.HasField("max_visible_pages")

    def test_max_visible_pages_zero(self):
        """Test pagination with max_visible_pages=0 (arrows only)."""
        st.pagination(10, max_visible_pages=0)

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.max_visible_pages == 0

    def test_disabled_state(self):
        """Test that disabled state is set correctly."""
        st.pagination(10, disabled=True)

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.disabled is True

    def test_enabled_state(self):
        """Test that enabled state is the default."""
        st.pagination(10)

        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.disabled is False


class TestPaginationValidation(DeltaGeneratorTestCase):
    """Tests for st.pagination input validation."""

    def test_num_pages_must_be_positive(self):
        """Test that num_pages must be >= 1."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(0)
        assert "`num_pages` must be an integer of at least 1" in str(e.value)

        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(-5)
        assert "`num_pages` must be an integer of at least 1" in str(e.value)

    def test_default_must_be_in_range(self):
        """Test that default must be between 1 and num_pages."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(10, default=0)
        assert "`default` must be between 1 and `num_pages`" in str(e.value)

        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(10, default=11)
        assert "`default` must be between 1 and `num_pages`" in str(e.value)

    def test_max_visible_pages_negative(self):
        """Test that negative max_visible_pages raises exception."""
        with pytest.raises(StreamlitAPIException) as e:
            st.pagination(10, max_visible_pages=-1)
        assert "`max_visible_pages` must be a non-negative integer or None" in str(
            e.value
        )


class TestPaginationWidthConfig(DeltaGeneratorTestCase):
    """Tests for st.pagination width configuration."""

    def test_default_width_is_content(self):
        """Test that default width is content."""
        st.pagination(10)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_stretch_width(self):
        """Test that stretch width is set correctly."""
        st.pagination(10, width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_pixel_width(self):
        """Test that pixel width is set correctly."""
        st.pagination(10, width=200)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 200


class TestPaginationSessionState(DeltaGeneratorTestCase):
    """Tests for st.pagination session state integration."""

    def test_widget_state_via_session_state(self):
        """Test that widget state can be set via session_state."""
        st.session_state.pagination_key = 5
        val = st.pagination(10, key="pagination_key")
        assert val == 5

    def test_key_types(self):
        """Test that different key types are handled correctly."""
        st.pagination(10, key="string_key")
        delta = self.get_delta_from_queue().new_element.pagination
        assert delta.id.endswith("-string_key")

    def test_on_change_callback_registered(self):
        """Test that on_change callback is registered."""
        st.pagination(10, on_change=lambda: None)

        ctx = get_script_run_ctx()
        assert ctx is not None
        session_state = ctx.session_state._state
        widget_id = session_state.get_widget_states()[0].id
        metadata = session_state._new_widget_state.widget_metadata.get(widget_id)
        assert metadata is not None
        assert metadata.callback is not None


class TestPaginationFormIntegration(DeltaGeneratorTestCase):
    """Tests for st.pagination form integration."""

    def test_outside_form(self):
        """Test that form_id is empty outside of a form."""
        st.pagination(10)

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form_id is set correctly inside of a form."""
        with st.form("form"):
            st.pagination(10)

        # 2 elements: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.pagination
        assert proto.form_id == form_proto.form.form_id


class TestPaginationStableId(DeltaGeneratorTestCase):
    """Tests for st.pagination widget ID stability."""

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render
            st.pagination(
                10,
                key="pagination_key",
                default=1,
                max_visible_pages=7,
                width="content",
                disabled=False,
            )
            proto1 = self.get_delta_from_queue().new_element.pagination
            id1 = proto1.id

            # Second render with different non-key params including num_pages
            # Since key_as_main_identity=True, num_pages should not affect the ID
            st.pagination(
                20,
                key="pagination_key",
                default=5,
                max_visible_pages=5,
                width="stretch",
                disabled=True,
            )
            proto2 = self.get_delta_from_queue().new_element.pagination
            id2 = proto2.id
            assert id1 == id2


class TestPaginationDuplicateId(DeltaGeneratorTestCase):
    """Tests for st.pagination duplicate ID error messages."""

    def test_duplicate_element_id_error_message(self):
        """Test that duplicate widget ID produces helpful error message."""
        with pytest.raises(StreamlitAPIException) as exception:
            st.pagination(10)
            st.pagination(10)

        # Make sure the correct name is used in the error message
        assert "pagination" in str(exception.value)


class TestPaginationBindQueryParams(DeltaGeneratorTestCase):
    """Tests for st.pagination bind='query-params' functionality."""

    def test_bind_query_params_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.pagination(10, key="my_key", bind="query-params")

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.query_param_key == "my_key"

    def test_bind_query_params_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.pagination(10, bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind parameter, query_param_key is not set."""
        st.pagination(10, key="my_key")

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.query_param_key == ""

    def test_invalid_bind_value_raises_exception(self):
        """Test that an invalid bind value raises StreamlitInvalidBindValueError."""
        with pytest.raises(StreamlitInvalidBindValueError, match=r"invalid-value"):
            st.pagination(10, key="my_key", bind="invalid-value")

    def test_bind_with_custom_default(self):
        """Test that bind works with custom default page."""
        st.pagination(10, default=5, key="my_key", bind="query-params")

        proto = self.get_delta_from_queue().new_element.pagination
        assert proto.query_param_key == "my_key"
        assert proto.default == 5
