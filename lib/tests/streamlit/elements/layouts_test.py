# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ColumnsTest(DeltaGeneratorTestCase):
    """Test columns."""

    def test_equal_width_columns(self):
        """Test that it works correctly when spec is int"""
        columns = st.columns(3)

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:4]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)

        # Check the defaults have been applied correctly for the first column
        self.assertEqual(
            columns_blocks[0].add_block.column.vertical_alignment,
            BlockProto.Column.VerticalAlignment.TOP,
        )
        self.assertEqual(columns_blocks[0].add_block.column.gap, "small")

        # Check the weights are correct
        self.assertEqual(columns_blocks[0].add_block.column.weight, 1.0 / 3)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 1.0 / 3)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 1.0 / 3)

    @parameterized.expand(
        [
            ("bottom", BlockProto.Column.VerticalAlignment.BOTTOM),
            ("top", BlockProto.Column.VerticalAlignment.TOP),
            ("center", BlockProto.Column.VerticalAlignment.CENTER),
        ]
    )
    def test_columns_with_vertical_alignment(
        self, vertical_alignment: str, expected_alignment
    ):
        """Test that it works correctly with vertical_alignment argument"""

        st.columns(3, vertical_alignment=vertical_alignment)

        all_deltas = self.get_all_deltas_from_queue()

        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        columns_blocks = all_deltas[1:4]

        # Check that the vertical alignment is correct for all columns
        assert (
            columns_blocks[0].add_block.column.vertical_alignment == expected_alignment
        )
        assert (
            columns_blocks[1].add_block.column.vertical_alignment == expected_alignment
        )
        assert (
            columns_blocks[2].add_block.column.vertical_alignment == expected_alignment
        )

    def test_columns_with_invalid_vertical_alignment(self):
        """Test that it throws an error on invalid vertical_alignment argument"""
        with self.assertRaises(StreamlitAPIException):
            st.columns(3, vertical_alignment="invalid")

    def test_not_equal_width_int_columns(self):
        """Test that it works correctly when spec is list of ints"""
        weights = [3, 2, 1]
        sum_weights = sum(weights)
        columns = st.columns(weights)

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:4]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 3.0 / sum_weights)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.0 / sum_weights)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 1.0 / sum_weights)

    def test_not_equal_width_float_columns(self):
        """Test that it works correctly when spec is list of floats or ints"""
        weights = [7.5, 2.5, 5]
        sum_weights = sum(weights)
        columns = st.columns(weights)

        for column in columns:
            with column:
                pass

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:]
        # 4 elements will be created: 1 horizontal block, 3 columns
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(len(columns_blocks), 3)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 7.5 / sum_weights)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.5 / sum_weights)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 5.0 / sum_weights)

    def test_columns_with_default_small_gap(self):
        """Test that it works correctly with no gap argument (gap size is default of small)"""

        st.columns(3)

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "small" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "small")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "small")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "small")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "small")

    def test_columns_with_medium_gap(self):
        """Test that it works correctly with "medium" gap argument"""

        st.columns(3, gap="medium")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "medium" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "medium")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "medium")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "medium")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "medium")

    def test_columns_with_large_gap(self):
        """Test that it works correctly with "large" gap argument"""

        st.columns(3, gap="LARGE")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "large" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "large")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "large")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "large")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "large")


class ExpanderTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.expander()

    def test_just_label(self):
        """Test that it can be called with no params"""
        expander = st.expander("label")

        with expander:
            pass

        expander_block = self.get_delta_from_queue()
        self.assertEqual(expander_block.add_block.expandable.label, "label")
        self.assertEqual(expander_block.add_block.expandable.expanded, False)

    def test_valid_emoji_icon(self):
        """Test that it can be called with an emoji icon"""
        expander = st.expander("label", icon="🦄")

        with expander:
            pass

        expander_block = self.get_delta_from_queue()
        self.assertEqual(expander_block.add_block.expandable.label, "label")
        self.assertEqual(expander_block.add_block.expandable.icon, "🦄")

    def test_valid_material_icon(self):
        """Test that it can be called with a material icon"""
        expander = st.expander("label", icon=":material/download:")

        with expander:
            pass

        expander_block = self.get_delta_from_queue()
        self.assertEqual(expander_block.add_block.expandable.label, "label")
        self.assertEqual(
            expander_block.add_block.expandable.icon, ":material/download:"
        )

    def test_invalid_emoji_icon(self):
        """Test that it throws an error on invalid emoji icon"""
        with self.assertRaises(StreamlitAPIException) as e:
            st.expander("label", icon="invalid")
        self.assertEqual(
            str(e.exception),
            'The value "invalid" is not a valid emoji. Shortcodes are not allowed, please use a single character instead.',
        )

    def test_invalid_material_icon(self):
        """Test that it throws an error on invalid material icon"""
        icon = ":material/invalid:"
        with self.assertRaises(StreamlitAPIException) as e:
            st.expander("label", icon=icon)
        self.assertEqual(
            str(e.exception),
            f'The value `"{icon}"` is not a valid Material icon.'
            f" Please use a Material icon shortcode like **`:material/thumb_up:`**. ",
        )


class ContainerTest(DeltaGeneratorTestCase):
    def test_border_parameter(self):
        """Test that it can be called with border parameter"""
        st.container(border=True)
        container_block = self.get_delta_from_queue()
        self.assertEqual(container_block.add_block.vertical.border, True)

    def test_without_parameters(self):
        """Test that it can be called without any parameters."""
        st.container()
        container_block = self.get_delta_from_queue()
        self.assertEqual(container_block.add_block.vertical.border, False)
        self.assertEqual(container_block.add_block.allow_empty, False)

    def test_height_parameter(self):
        """Test that it can be called with height parameter"""
        st.container(height=100)

        container_block = self.get_delta_from_queue()
        self.assertEqual(container_block.add_block.vertical.height, 100)
        # Should allow empty and have a border as default:
        self.assertEqual(container_block.add_block.vertical.border, True)
        self.assertEqual(container_block.add_block.allow_empty, True)


class PopoverContainerTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.popover()

    def test_just_label(self):
        """Test that it correctly applies label param."""
        popover = st.popover("label")
        with popover:
            pass

        popover_block = self.get_delta_from_queue()
        self.assertEqual(popover_block.add_block.popover.label, "label")
        self.assertEqual(popover_block.add_block.popover.use_container_width, False)
        self.assertEqual(popover_block.add_block.popover.disabled, False)
        self.assertEqual(popover_block.add_block.popover.help, "")
        self.assertEqual(popover_block.add_block.allow_empty, True)

    def test_use_container_width(self):
        """Test that it correctly applies use_container_width param."""
        popover = st.popover("label", use_container_width=True)
        with popover:
            pass

        popover_block = self.get_delta_from_queue()
        self.assertEqual(popover_block.add_block.popover.label, "label")
        self.assertEqual(popover_block.add_block.popover.use_container_width, True)

    def test_disabled(self):
        """Test that it correctly applies disabled param."""
        popover = st.popover("label", disabled=True)
        with popover:
            pass

        popover_block = self.get_delta_from_queue()
        self.assertEqual(popover_block.add_block.popover.label, "label")
        self.assertEqual(popover_block.add_block.popover.disabled, True)

    def test_help(self):
        """Test that it correctly applies help param."""
        popover = st.popover("label", help="help text")
        with popover:
            pass

        popover_block = self.get_delta_from_queue()
        self.assertEqual(popover_block.add_block.popover.label, "label")
        self.assertEqual(popover_block.add_block.popover.help, "help text")


class StatusContainerTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.status()

    def test_throws_error_on_wrong_state(self):
        """Test that it throws an error on unknown state."""
        with self.assertRaises(StreamlitAPIException):
            st.status("label", state="unknown")

    def test_just_label(self):
        """Test that it correctly applies label param."""
        st.status("label")
        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, "spinner")

    def test_expanded_param(self):
        """Test that it correctly applies expanded param."""
        st.status("label", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, "spinner")

    def test_state_param_complete(self):
        """Test that it correctly applies state param with `complete`."""
        st.status("label", state="complete")

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, ":material/check:")

    def test_state_param_error(self):
        """Test that it correctly applies state param with `error`."""
        st.status("label", state="error")

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, ":material/error:")

    def test_usage_with_context_manager(self):
        """Test that it correctly switches to complete state when used as context manager."""
        status = st.status("label")

        with status:
            pass

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, ":material/check:")

    def test_mutation_via_update(self):
        """Test that update can be used to change the label, state and expand."""
        status = st.status("label", expanded=False)
        status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "new label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, ":material/error:")

    def test_mutation_via_update_in_cm(self):
        """Test that update can be used in context manager to change the label, state and expand."""
        with st.status("label", expanded=False) as status:
            status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "new label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, ":material/error:")


class TabsTest(DeltaGeneratorTestCase):
    def test_tab_required(self):
        """Test that at least one tab is required."""
        with self.assertRaises(TypeError):
            st.tabs()

        with self.assertRaises(StreamlitAPIException):
            st.tabs([])

    def test_only_label_strings_allowed(self):
        """Test that only strings are allowed as tab labels."""
        with self.assertRaises(StreamlitAPIException):
            st.tabs(["tab1", True])

        with self.assertRaises(StreamlitAPIException):
            st.tabs(["tab1", 10])

    def test_returns_all_expected_tabs(self):
        """Test that all labels are added in correct order."""
        tabs = st.tabs([f"tab {i}" for i in range(5)])

        self.assertEqual(len(tabs), 5)

        for tab in tabs:
            with tab:
                pass

        all_deltas = self.get_all_deltas_from_queue()

        tabs_block = all_deltas[1:]
        # 6 elements will be created: 1 horizontal block, 5 tabs
        self.assertEqual(len(all_deltas), 6)
        self.assertEqual(len(tabs_block), 5)
        for index, tabs_block in enumerate(tabs_block):
            self.assertEqual(tabs_block.add_block.tab.label, f"tab {index}")


class DialogTest(DeltaGeneratorTestCase):
    """Run unit tests for the non-public delta-generator dialog and also the dialog decorator."""

    title = "Test Dialog"

    def test_dialog_deltagenerator_usage_with_context_manager(self):
        """Test that the delta-generator dialog works as a context manager"""

        dialog = st._main._dialog(DialogTest.title)

        with dialog:
            """No content so that 'get_delta_from_queue' returns the dialog."""
            pass

        dialog_block = self.get_delta_from_queue()
        self.assertEqual(dialog_block.add_block.dialog.title, DialogTest.title)
        self.assertFalse(dialog_block.add_block.dialog.is_open)
        self.assertTrue(dialog_block.add_block.dialog.dismissible)

    def test_dialog_deltagenerator_opens_and_closes(self):
        """Test that dialog opens and closes"""
        dialog = st._main._dialog(DialogTest.title)

        self.assertIsNotNone(dialog)
        dialog_block = self.get_delta_from_queue()
        self.assertFalse(dialog_block.add_block.dialog.is_open)

        dialog.open()
        dialog_block = self.get_delta_from_queue()
        self.assertTrue(dialog_block.add_block.dialog.is_open)

        dialog.close()
        dialog_block = self.get_delta_from_queue()
        self.assertFalse(dialog_block.add_block.dialog.is_open)

    def test_dialog_deltagenerator_only_call_open_once(self):
        """Test that only a single dialog can be opened"""
        dialog = st._main._dialog(DialogTest.title)

        self.assertIsNotNone(dialog)

        # Open first time
        dialog.open()
        with self.assertRaises(StreamlitAPIException):
            # Cannot call open while the dialog is already open
            dialog.open()
        dialog.close()
        with self.assertRaises(StreamlitAPIException):
            # Close does not reset the dialog-flag as this is handled per script-run context
            dialog.open()

    def test_dialog_decorator_with_title_opens(self):
        """Test that the dialog decorator having a title does not throw an error"""

        @st.experimental_dialog("example title")
        def dialog():
            return None

        dialog()

    def test_dialog_decorator_title_required(self):
        """Test that the title is required in decorator"""
        with self.assertRaises(TypeError) as e:

            @st.experimental_dialog()
            def dialog():
                return None

            dialog()

        self.assertTrue(
            e.exception.args[0].startswith(
                "dialog_decorator() missing 1 required positional argument: 'title'"
            )
        )

        with self.assertRaises(TypeError) as e:

            @st.experimental_dialog()
            def dialog_with_arguments(a, b):
                return None

            dialog_with_arguments("", "")

        self.assertTrue(
            e.exception.args[0].startswith(
                "dialog_decorator() missing 1 required positional argument: 'title'"
            )
        )

        with self.assertRaises(StreamlitAPIException) as e:

            @st.experimental_dialog("")
            def dialog():
                return None

            dialog()

        self.assertTrue(e.exception.args[0].startswith("A non-empty `title`"))

    def test_dialog_decorator_must_be_called_like_a_function_with_a_title(self):
        """Test that the decorator must be called like a function."""
        with self.assertRaises(StreamlitAPIException):

            @st.experimental_dialog
            def dialog():
                return None

            dialog()

        with self.assertRaises(StreamlitAPIException):

            @st.experimental_dialog
            def dialog_with_arg(a):
                return None

            dialog_with_arg("a")

        with self.assertRaises(StreamlitAPIException):

            @st.experimental_dialog
            def dialog_with_args(a, b):
                return None

            dialog_with_args("a", "b")

    def test_nested_dialog_raises_error(self):
        """Test that dialogs cannot be called nested."""

        @st.experimental_dialog("Level2 dialog")
        def level2_dialog():
            st.empty()

        @st.experimental_dialog("Level1 dialog")
        def level1_dialog():
            level2_dialog()

        with patch("streamlit.exception") as mock_st_exception:
            level1_dialog()
            mock_st_exception.assert_called_once()
            assert (
                str(mock_st_exception.call_args[0][0])
                == "Dialogs may not be nested inside other dialogs."
            )

    def test_only_one_dialog_can_be_opened_at_same_time(self):
        @st.experimental_dialog("Dialog1")
        def dialog1():
            st.empty()

        @st.experimental_dialog("Dialog2")
        def dialog2():
            st.empty()

        with self.assertRaises(StreamlitAPIException) as e:
            dialog1()
            dialog2()

        self.assertTrue(
            e.exception.args[0].startswith(
                "Only one dialog is allowed to be opened at the same time."
            )
        )
