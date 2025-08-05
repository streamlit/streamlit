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

"""Form unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.session_state import RegisterWidgetResult
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields

NO_FORM_ID = ""


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class FormAssociationTest(DeltaGeneratorTestCase):
    """Tests for every flavor of form/deltagenerator association."""

    def _get_last_checkbox_form_id(self) -> str:
        """Return the form ID for the last checkbox delta that was enqueued."""
        last_delta = self.get_delta_from_queue()
        assert last_delta is not None
        assert last_delta.WhichOneof("type") == "new_element"
        assert last_delta.new_element.WhichOneof("type") == "checkbox"
        return last_delta.new_element.checkbox.form_id

    def test_no_form(self):
        """By default, an element doesn't belong to a form."""
        st.checkbox("widget")
        assert self._get_last_checkbox_form_id() == NO_FORM_ID

    def test_implicit_form_parent(self):
        """Within a `with form` statement, any `st.foo` element becomes
        part of that form."""
        with st.form("form"):
            st.checkbox("widget")
        assert self._get_last_checkbox_form_id() == "form"

        # The sidebar, and any other DG parent created outside
        # the form, does not create children inside the form.
        with st.form("form2"):
            st.sidebar.checkbox("widget2")
        assert self._get_last_checkbox_form_id() == NO_FORM_ID

    def test_deep_implicit_form_parent(self):
        """Within a `with form` statement, any `st.foo` element becomes
        part of that form, regardless of how deeply nested the element is."""
        with st.form("form"):
            cols1 = st.columns(2)
            with cols1[0]:
                with st.container():
                    st.checkbox("widget")
        assert self._get_last_checkbox_form_id() == "form"

        # The sidebar, and any other DG parent created outside
        # the form, does not create children inside the form.
        with st.form("form2"):
            cols1 = st.columns(2)
            with cols1[0]:
                with st.container():
                    st.sidebar.checkbox("widget2")
        assert self._get_last_checkbox_form_id() == NO_FORM_ID

    def test_parent_created_inside_form(self):
        """If a parent DG is created inside a form, any children of
        that parent belong to the form."""
        with st.form("form"):
            with st.container():
                # Create a (deeply nested) column inside the form
                form_col = st.columns(2)[0]

                # Attach children to the column in various ways.
                # They'll all belong to the form.
                with form_col:
                    st.checkbox("widget1")
                    assert self._get_last_checkbox_form_id() == "form"

                    form_col.checkbox("widget2")
                    assert self._get_last_checkbox_form_id() == "form"

        form_col.checkbox("widget3")
        assert self._get_last_checkbox_form_id() == "form"

    def test_parent_created_outside_form(self):
        """If our parent was created outside a form, any children of
        that parent have no form, regardless of where they're created."""
        no_form_col = st.columns(2)[0]
        no_form_col.checkbox("widget1")
        assert self._get_last_checkbox_form_id() == NO_FORM_ID

        with st.form("form"):
            no_form_col.checkbox("widget2")
            assert self._get_last_checkbox_form_id() == NO_FORM_ID

            with no_form_col:
                st.checkbox("widget3")
                assert self._get_last_checkbox_form_id() == NO_FORM_ID

    def test_widget_created_directly_on_form_block(self):
        """Test that a widget can be created directly on a form block."""

        form = st.form("form")
        form.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_form_inside_columns(self):
        """Test that a form was successfully created inside a column."""

        col, _ = st.columns(2)

        with col:
            with st.form("form"):
                st.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_form_in_sidebar(self):
        """Test that a form was successfully created in the sidebar."""

        with st.sidebar.form("form"):
            st.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_dg_outside_form_but_element_inside(self):
        """Test that a widget doesn't belong to a form if its DG was created outside it."""

        empty = st.empty()
        with st.form("form"):
            empty.checkbox("widget")

        first_delta = self.get_delta_from_queue(0)
        assert first_delta.new_element.checkbox.form_id == NO_FORM_ID

    def test_dg_inside_form_but_element_outside(self):
        """Test that a widget belongs to a form if its DG was created inside it."""

        with st.form("form"):
            empty = st.empty()
        empty.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_dg_and_element_inside_form(self):
        """Test that a widget belongs to a form if its DG was created inside it and then replaced."""

        with st.form("form"):
            empty = st.empty()
            empty.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_widget_inside_dg_outside_form_it_was_created_in(self):
        """Test that a widget belongs to a form if its DG was created inside a DG that was created inside a form."""

        with st.form("form"):
            empty = st.empty()

        with empty:
            st.checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"

    def test_widget_parent_parent_created_on_form(self):
        """Test that a widget belongs to a form if its parent's parent was created inside a form."""

        with st.form("form"):
            e = st.empty()
        e.empty().checkbox("widget")

        assert self._get_last_checkbox_form_id() == "form"


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class FormMarshallingTest(DeltaGeneratorTestCase):
    """Test ability to marshall form protos."""

    def test_marshall_form(self):
        """Creating a form should result in the expected protobuf data."""

        # Test with clear_on_submit=True
        with st.form(key="foo", clear_on_submit=True):
            pass

        assert len(self.get_all_deltas_from_queue()) == 1
        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "foo"
        assert form_proto.form.clear_on_submit
        assert form_proto.form.enter_to_submit
        assert form_proto.form.border
        self.clear_queue()

        # Test with clear_on_submit=False
        with st.form(key="bar", clear_on_submit=False):
            pass

        assert len(self.get_all_deltas_from_queue()) == 1
        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "bar"
        assert not form_proto.form.clear_on_submit

    def test_form_enter_to_submit(self):
        """Test that a form can be created with enter_to_submit=False."""

        # Test with enter_to_submit=False
        with st.form(key="foo", enter_to_submit=False):
            pass

        assert len(self.get_all_deltas_from_queue()) == 1
        form_proto = self.get_delta_from_queue(0).add_block
        assert not form_proto.form.enter_to_submit

    def test_form_without_border(self):
        """Test that a form can be created without a border."""

        # Test with clear_on_submit=True
        with st.form(key="foo", clear_on_submit=True, border=False):
            pass

        assert len(self.get_all_deltas_from_queue()) == 1
        form_proto = self.get_delta_from_queue(0).add_block
        assert not form_proto.form.border

    def test_multiple_forms_same_key(self):
        """Multiple forms with the same key are not allowed."""

        with pytest.raises(StreamlitAPIException) as ctx:
            st.form(key="foo")
            st.form(key="foo")

        assert "There are multiple identical forms with `key='foo'`" in str(ctx.value)

    def test_multiple_forms_same_labels_different_keys(self):
        """Multiple forms with different keys are allowed."""

        try:
            st.form(key="foo")
            st.form(key="bar")

        except Exception:
            self.fail("Forms with same labels and different keys failed to create.")

    def test_form_in_form(self):
        """Test that forms cannot be nested in other forms."""

        with pytest.raises(StreamlitAPIException) as ctx:
            with st.form("foo"):
                with st.form("bar"):
                    pass

        assert str(ctx.value) == "Forms cannot be nested in other forms."

    def test_button_in_form(self):
        """Test that buttons are not allowed in forms."""

        with pytest.raises(StreamlitAPIException) as ctx:
            with st.form("foo"):
                st.button("foo")

        assert "`st.button()` can't be used in an `st.form()`" in str(ctx.value)

    def test_form_block_data(self):
        """Test that a form creates a block element with correct data."""

        form_data = st.form(key="bar")._form_data
        assert form_data.form_id == "bar"


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class FormSubmitButtonTest(DeltaGeneratorTestCase):
    """Test form submit button."""

    def test_disabled_submit_button(self):
        """Test that a submit button can be disabled."""

        with st.form("foo"):
            st.form_submit_button(disabled=True)

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.disabled

    def test_submit_button_outside_form(self):
        """Test that a submit button is not allowed outside a form."""

        with pytest.raises(StreamlitAPIException) as ctx:
            st.form_submit_button()

        assert "`st.form_submit_button()` must be used inside an `st.form()`" in str(
            ctx.value
        )

    def test_submit_button_inside_form(self):
        """Test that a submit button is allowed inside a form."""

        with st.form("foo"):
            st.form_submit_button()

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.form_id == "foo"

    def test_submit_button_called_directly_on_form_block(self):
        """Test that a submit button can be called directly on a form block."""

        form = st.form("foo")
        form.form_submit_button()

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.form_id == "foo"

    def test_submit_button_default_type(self):
        """Test that a submit button with no explicit type has default of "secondary"."""

        form = st.form("foo")
        form.form_submit_button()

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.type == "secondary"

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_submit_button_types(self, type):
        """Test that a submit button can be called with different types."""

        form = st.form("foo")
        form.form_submit_button(type=type)

        last_delta = self.get_delta_from_queue()
        assert type == last_delta.new_element.button.type

    def test_submit_button_emoji_icon(self):
        """Test that a submit button can be called with an emoji icon."""

        form = st.form("foo")
        form.form_submit_button(icon="⚡")

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.icon == "⚡"

    def test_submit_button_material_icon(self):
        """Test that a submit button can be called with a Material icon."""

        form = st.form("foo")
        form.form_submit_button(icon=":material/thumb_up:")

        last_delta = self.get_delta_from_queue()
        assert last_delta.new_element.button.icon == ":material/thumb_up:"

    def test_submit_button_does_not_use_container_width_by_default(self):
        """Test that a submit button does not use_use_container width by default."""

        form = st.form("foo")
        form.form_submit_button(type="primary")

        last_delta = self.get_delta_from_queue()
        assert not last_delta.new_element.button.use_container_width

    def test_return_false_when_not_submitted(self):
        with st.form("form1"):
            submitted = st.form_submit_button("Submit")
            assert not submitted

    @patch(
        "streamlit.elements.widgets.button.register_widget",
        MagicMock(return_value=RegisterWidgetResult(True, False)),
    )
    def test_return_true_when_submitted(self):
        with st.form("form"):
            submitted = st.form_submit_button("Submit")
            assert submitted

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""

        @st.cache_data
        def cached_function():
            with st.form("form"):
                st.form_submit_button("Submit")

        cached_function()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_use_container_width_true(self):
        """Test use_container_width=True is mapped to width='stretch'."""
        for width in ["stretch", "content", 200]:
            with self.subTest(f"width={width}"):
                with st.form(f"test_form {width} use_container_width = true"):
                    st.form_submit_button(
                        "Submit use_container_width=true",
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
            with st.form("test_form no width and use_container_width = true"):
                st.form_submit_button(
                    "Submit no width but use_container_width=true",
                    use_container_width=True,
                )
            el = self.get_delta_from_queue().new_element
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )
            assert el.width_config.use_stretch is True

    def test_use_container_width_false(self):
        """Test use_container_width=False is mapped to width='content'."""
        for width in ["stretch", "content", 200]:
            with self.subTest(f"width={width}"):
                with st.form(f"test_form {width} use_container_width = false"):
                    st.form_submit_button(
                        "Submit use_container_width = false",
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
            with st.form("test_form no width and use_container_width = false"):
                st.form_submit_button(
                    "Submit no width and use_container_width = false",
                    use_container_width=False,
                )
            el = self.get_delta_from_queue().new_element
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_CONTENT.value
            )
            assert el.width_config.use_content is True


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class FormStateInteractionTest(DeltaGeneratorTestCase):
    def test_exception_for_callbacks_on_widgets(self):
        with pytest.raises(StreamlitAPIException):
            with st.form("form"):
                st.radio("radio", ["a", "b", "c"], 0, on_change=lambda x: x)
                st.form_submit_button()

    def test_no_exception_for_callbacks_on_submit_button(self):
        with st.form("form"):
            st.radio("radio", ["a", "b", "c"], 0)
            st.form_submit_button(on_click=lambda x: x)


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class FormDimensionsTest(DeltaGeneratorTestCase):
    """Test form width and height."""

    def test_form_with_stretch_width(self):
        """Test form with width='stretch'."""
        with st.form("form_with_stretch", width="stretch"):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_stretch"
        assert form_proto.width_config.use_stretch

    def test_form_with_content_width(self):
        """Test form with width='content'."""
        with st.form("form_with_content", width="content"):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_content"
        assert form_proto.width_config.use_content

    def test_form_with_pixel_width(self):
        """Test form with pixel width."""
        with st.form("form_with_pixel", width=100):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_pixel"
        assert form_proto.width_config.pixel_width == 100

    def test_form_with_pixel_height(self):
        """Test form with pixel height."""
        with st.form("form_with_pixel", height=100):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_pixel"
        assert form_proto.height_config.pixel_height == 100

    def test_form_with_content_height(self):
        """Test form with content height."""
        with st.form("form_with_content", height="content"):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_content"
        assert form_proto.height_config.use_content

    def test_form_with_stretch_height(self):
        """Test form with stretch height."""
        with st.form("form_with_stretch", height="stretch"):
            st.text_input("Input")
            st.form_submit_button("Submit")

        form_proto = self.get_delta_from_queue(0).add_block
        assert form_proto.form.form_id == "form_with_stretch"
        assert form_proto.height_config.use_stretch

    @parameterized.expand(
        [
            ("invalid", "invalid"),
            ("negative", -100),
            ("zero", 0),
            ("none", None),
            ("empty_string", ""),
        ]
    )
    def test_form_with_invalid_width_and_height(self, name, value):
        """Test form with invalid width values."""
        with pytest.raises(StreamlitAPIException):
            with st.form(f"form_with_invalid_{name}", width=value):
                st.text_input("Input")
                st.form_submit_button("Submit")

        with pytest.raises(StreamlitAPIException):
            with st.form(f"form_with_invalid_{name}", height=value):
                st.text_input("Input")
                st.form_submit_button("Submit")

    # Tests for st.form_submit_button width
    def test_form_submit_button_with_content_width(self):
        """Test st.form_submit_button with width='content'."""
        with st.form("test_form"):
            st.form_submit_button("Submit", width="content")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_form_submit_button_with_stretch_width(self):
        """Test st.form_submit_button with width='stretch'."""
        with st.form("test_form"):
            st.form_submit_button("Submit", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_form_submit_button_with_pixel_width(self):
        """Test st.form_submit_button with pixel width."""
        with st.form("test_form"):
            st.form_submit_button("Submit", width=250)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 250

    def test_form_submit_button_with_default_width(self):
        """Test st.form_submit_button uses content width by default."""
        with st.form("test_form"):
            st.form_submit_button("Submit")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_form_submit_button_with_invalid_width(self, value):
        """Test st.form_submit_button with invalid width values."""
        with pytest.raises(StreamlitAPIException):
            with st.form("test_form"):
                st.form_submit_button("Submit", width=value)
