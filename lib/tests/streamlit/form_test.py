# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from unittest.mock import MagicMock, patch

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.session_state import RegisterWidgetResult
from tests import testutil

NO_FORM_ID = ""


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class FormAssociationTest(testutil.DeltaGeneratorTestCase):
    """Tests for every flavor of form/deltagenerator association."""

    def _get_last_checkbox_form_id(self) -> str:
        """Return the form ID for the last checkbox delta that was enqueued."""
        last_delta = self.get_delta_from_queue()
        self.assertIsNotNone(last_delta)
        self.assertEqual("new_element", last_delta.WhichOneof("type"))
        self.assertEqual("checkbox", last_delta.new_element.WhichOneof("type"))
        return last_delta.new_element.checkbox.form_id

    def test_no_form(self):
        """By default, an element doesn't belong to a form."""
        st.checkbox("widget")
        self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

    def test_implicit_form_parent(self):
        """Within a `with form` statement, any `st.foo` element becomes
        part of that form."""
        with st.form("form"):
            st.checkbox("widget")
        self.assertEqual("form", self._get_last_checkbox_form_id())

        # The sidebar, and any other DG parent created outside
        # the form, does not create children inside the form.
        with st.form("form2"):
            st.sidebar.checkbox("widget2")
        self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

    def test_deep_implicit_form_parent(self):
        """Within a `with form` statement, any `st.foo` element becomes
        part of that form, regardless of how deeply nested the element is."""
        with st.form("form"):
            cols1 = st.columns(2)
            with cols1[0]:
                with st.container():
                    st.checkbox("widget")
        self.assertEqual("form", self._get_last_checkbox_form_id())

        # The sidebar, and any other DG parent created outside
        # the form, does not create children inside the form.
        with st.form("form2"):
            cols1 = st.columns(2)
            with cols1[0]:
                with st.container():
                    st.sidebar.checkbox("widget2")
        self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

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
                    self.assertEqual("form", self._get_last_checkbox_form_id())

                    form_col.checkbox("widget2")
                    self.assertEqual("form", self._get_last_checkbox_form_id())

        form_col.checkbox("widget3")
        self.assertEqual("form", self._get_last_checkbox_form_id())

    def test_parent_created_outside_form(self):
        """If our parent was created outside a form, any children of
        that parent have no form, regardless of where they're created."""
        no_form_col = st.columns(2)[0]
        no_form_col.checkbox("widget1")
        self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

        with st.form("form"):
            no_form_col.checkbox("widget2")
            self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

            with no_form_col:
                st.checkbox("widget3")
                self.assertEqual(NO_FORM_ID, self._get_last_checkbox_form_id())

    def test_widget_created_directly_on_form_block(self):
        """Test that a widget can be created directly on a form block."""

        form = st.form("form")
        form.checkbox("widget")

        self.assertEqual("form", self._get_last_checkbox_form_id())

    def test_form_inside_columns(self):
        """Test that a form was successfully created inside a column."""

        col, _ = st.columns(2)

        with col:
            with st.form("form"):
                st.checkbox("widget")

        self.assertEqual("form", self._get_last_checkbox_form_id())

    def test_form_in_sidebar(self):
        """Test that a form was successfully created in the sidebar."""

        with st.sidebar.form("form"):
            st.checkbox("widget")

        self.assertEqual("form", self._get_last_checkbox_form_id())

    def test_dg_outside_form_but_element_inside(self):
        """Test that a widget doesn't belong to a form if its DG was created outside it."""

        empty = st.empty()
        with st.form("form"):
            empty.checkbox("widget")

        first_delta = self.get_delta_from_queue(0)
        self.assertEqual(NO_FORM_ID, first_delta.new_element.checkbox.form_id)

    def test_dg_inside_form_but_element_outside(self):
        """Test that a widget belongs to a form if its DG was created inside it."""

        with st.form("form"):
            empty = st.empty()
        empty.checkbox("widget")

        self.assertEqual("form", self._get_last_checkbox_form_id())

    def test_dg_and_element_inside_form(self):
        """Test that a widget belongs to a form if its DG was created inside it and then replaced."""

        with st.form("form"):
            empty = st.empty()
            empty.checkbox("widget")

        self.assertEqual("form", self._get_last_checkbox_form_id())


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class FormMarshallingTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall form protos."""

    def test_marshall_form(self):
        """Creating a form should result in the expected protobuf data."""

        # Test with clear_on_submit=True
        with st.form(key="foo", clear_on_submit=True):
            pass

        self.assertEqual(len(self.get_all_deltas_from_queue()), 1)
        form_proto = self.get_delta_from_queue(0).add_block
        self.assertEqual("foo", form_proto.form.form_id)
        self.assertEqual(True, form_proto.form.clear_on_submit)

        self.clear_queue()

        # Test with clear_on_submit=False
        with st.form(key="bar", clear_on_submit=False):
            pass

        self.assertEqual(len(self.get_all_deltas_from_queue()), 1)
        form_proto = self.get_delta_from_queue(0).add_block
        self.assertEqual("bar", form_proto.form.form_id)
        self.assertEqual(False, form_proto.form.clear_on_submit)

    def test_multiple_forms_same_key(self):
        """Multiple forms with the same key are not allowed."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.form(key="foo")
            st.form(key="foo")

        self.assertIn(
            "There are multiple identical forms with `key='foo'`", str(ctx.exception)
        )

    def test_multiple_forms_same_labels_different_keys(self):
        """Multiple forms with different keys are allowed."""

        try:
            st.form(key="foo")
            st.form(key="bar")

        except Exception:
            self.fail("Forms with same labels and different keys failed to create.")

    def test_form_in_form(self):
        """Test that forms cannot be nested in other forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.form("foo"):
                with st.form("bar"):
                    pass

        self.assertEqual(str(ctx.exception), "Forms cannot be nested in other forms.")

    def test_button_in_form(self):
        """Test that buttons are not allowed in forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.form("foo"):
                st.button("foo")

        self.assertIn(
            "`st.button()` can't be used in an `st.form()`", str(ctx.exception)
        )

    def test_form_block_data(self):
        """Test that a form creates a block element with correct data."""

        form_data = st.form(key="bar")._form_data
        self.assertEqual("bar", form_data.form_id)


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class FormSubmitButtonTest(testutil.DeltaGeneratorTestCase):
    """Test form submit button."""

    def test_submit_button_outside_form(self):
        """Test that a submit button is not allowed outside a form."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.form_submit_button()

        self.assertIn(
            "`st.form_submit_button()` must be used inside an `st.form()`",
            str(ctx.exception),
        )

    def test_submit_button_inside_form(self):
        """Test that a submit button is allowed inside a form."""

        with st.form("foo"):
            st.form_submit_button()

        last_delta = self.get_delta_from_queue()
        self.assertEqual("foo", last_delta.new_element.button.form_id)

    def test_submit_button_called_directly_on_form_block(self):
        """Test that a submit button can be called directly on a form block."""

        form = st.form("foo")
        form.form_submit_button()

        last_delta = self.get_delta_from_queue()
        self.assertEqual("foo", last_delta.new_element.button.form_id)

    def test_return_false_when_not_submitted(self):
        with st.form("form1"):
            submitted = st.form_submit_button("Submit")
            self.assertEqual(submitted, False)

    @patch(
        "streamlit.elements.button.register_widget",
        new=MagicMock(return_value=RegisterWidgetResult(True, False)),
    )
    def test_return_true_when_submitted(self):
        with st.form("form"):
            submitted = st.form_submit_button("Submit")
            self.assertEqual(submitted, True)


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class FormStateInteractionTest(testutil.DeltaGeneratorTestCase):
    def test_exception_for_callbacks_on_widgets(self):
        with self.assertRaises(StreamlitAPIException):
            with st.form("form"):
                st.radio("radio", ["a", "b", "c"], 0, on_change=lambda x: x)
                st.form_submit_button()

    def test_no_exception_for_callbacks_on_submit_button(self):
        with st.form("form"):
            st.radio("radio", ["a", "b", "c"], 0)
            st.form_submit_button(on_click=lambda x: x)
