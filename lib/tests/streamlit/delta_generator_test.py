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

"""DeltaGenerator Unittest."""

from __future__ import annotations

import asyncio
import functools
import inspect
import json
import logging
import re
import threading
import unittest
from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
import streamlit.runtime.state.widgets as w
from streamlit import delta_generator
from streamlit.cursor import LockedCursor, RunningCursor, make_delta_path
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitDuplicateElementId,
    StreamlitDuplicateElementKey,
)
from streamlit.logger import get_logger
from streamlit.proto import Block_pb2
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.outside_container_wrapper import OutsideContainerWrapper
from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    FragmentThreadState,
    ThreadState,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.streamlit_test import ELEMENT_COMMANDS


def identity(x):
    return x


register_widget = functools.partial(
    w.register_widget, deserializer=lambda x, s: x, serializer=identity
)


class RunWarningTest(unittest.TestCase):
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=False))
    def test_run_warning_presence(self):
        """Using Streamlit without `streamlit run` produces a warning."""
        with self.assertLogs("streamlit", level=logging.WARNING) as logs:
            delta_generator._use_warning_has_been_displayed = False
            st.write("Using delta generator")
            output = "".join(logs.output)
            # Warning produced exactly once
            assert len(re.findall(r"streamlit run", output)) == 1

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_run_warning_absence(self):
        """Using Streamlit through the CLI results in a Runtime being instantiated,
        so it produces no usage warning."""
        with self.assertLogs("streamlit", level=logging.WARNING) as logs:
            delta_generator._use_warning_has_been_displayed = False
            st.write("Using delta generator")
            # assertLogs is being used as a context manager, but it also checks
            # that some log output was captured, so we have to let it capture something
            get_logger("root").warning("irrelevant warning so assertLogs passes")
            assert r"streamlit run" not in "".join(logs.output)

    def test_public_api(self):
        """Test that we don't accidentally remove (or add) symbols
        to the public `DeltaGenerator` API.
        """
        api = {
            name
            for name, _ in inspect.getmembers(DeltaGenerator)
            if not name.startswith("_")
        }
        expected_api = ELEMENT_COMMANDS.copy()

        # Remove commands that are only exposed in the top-level namespace (st.*)
        # and cannot be called on a DeltaGenerator object.
        expected_api -= {
            "dialog",
            "echo",
            "logo",
            "login",
            "logout",
        }

        # Add public commands that only exist in the delta generator:
        expected_api = expected_api.union({"dg"})

        assert api == expected_api


class DeltaGeneratorTest(DeltaGeneratorTestCase):
    """Test streamlit.delta_generator methods."""

    def test_nonexistent_method(self):
        with pytest.raises(StreamlitAPIException):
            st.sidebar.non_existing()

    def test_sidebar_nonexistent_method(self):
        with pytest.raises(
            StreamlitAPIException,
            match="Method `echo\\(\\)` does not exist for `st\\.sidebar`\\. Did you mean `st\\.echo\\(\\)`\\?",
        ):
            st.sidebar.echo()

    def set_widget_requires_args(self):
        st.text_input()
        c = self.get_delta_from_queue().new_element.exception
        assert c.type == "TypeError"

    def test_duplicate_widget_id_error(self):
        """Multiple widgets with the same generated key should report an error."""
        widgets = {
            "button": lambda key=None: st.button("", key=key),
            "button_group": lambda key=None: st.feedback("thumbs", key=key),
            "checkbox": lambda key=None: st.checkbox("", key=key),
            "multiselect": lambda key=None: st.multiselect("", options=[1, 2], key=key),
            "radio": lambda key=None: st.radio("", options=[1, 2], key=key),
            "selectbox": lambda key=None: st.selectbox("", options=[1, 2], key=key),
            "slider": lambda key=None: st.slider("", key=key),
            "text_area": lambda key=None: st.text_area("", key=key),
            "text_input": lambda key=None: st.text_input("", key=key),
            "time_input": lambda key=None: st.time_input("", key=key),
            "date_input": lambda key=None: st.date_input("", key=key),
            "datetime_input": lambda key=None: st.datetime_input("", key=key),
            "number_input": lambda key=None: st.number_input("", key=key),
        }

        for _, create_widget in widgets.items():
            create_widget()
            with pytest.raises(StreamlitDuplicateElementId):
                # Test creating a widget with a duplicate c
                # raises an exception.
                create_widget()

        for widget_type, create_widget in widgets.items():
            # widgets with keys are distinct from the unkeyed ones created above
            create_widget(widget_type)
            with pytest.raises(StreamlitDuplicateElementKey):
                # Test creating a widget with a duplicate key
                # raises an exception.
                create_widget(widget_type)

    def test_duplicate_widget_id_error_when_user_key_specified(self):
        """Multiple widgets with the different generated key, but same user specified
        key should report an error.
        """

        widgets = {
            "button": lambda key=None, label="": st.button(label=label, key=key),
            "checkbox": lambda key=None, label="": st.checkbox(label=label, key=key),
            "feedback": lambda key=None, label="": st.feedback(
                options="thumbs", key=key
            ),
            "multiselect": lambda key=None, label="": st.multiselect(
                label=label, options=[1, 2], key=key
            ),
            "radio": lambda key=None, label="": st.radio(
                label=label, options=[1, 2], key=key
            ),
            "selectbox": lambda key=None, label="": st.selectbox(
                label=label, options=[1, 2], key=key
            ),
            "slider": lambda key=None, label="": st.slider(label=label, key=key),
            "text_area": lambda key=None, label="": st.text_area(label=label, key=key),
            "text_input": lambda key=None, label="": st.text_input(
                label=label, key=key
            ),
            "time_input": lambda key=None, label="": st.time_input(
                label=label, key=key
            ),
            "date_input": lambda key=None, label="": st.date_input(
                label=label, key=key
            ),
            "number_input": lambda key=None, label="": st.number_input(
                label=label, key=key
            ),
        }

        for widget_type, create_widget in widgets.items():
            user_key = widget_type
            create_widget(label="LABEL_A", key=user_key)
            with pytest.raises(StreamlitDuplicateElementKey):
                # We specify different labels for widgets, so auto-generated keys
                # (widget_ids) will be different.
                # Test creating a widget with a different auto-generated key but same
                # user specified key raises an exception.
                create_widget(label="LABEL_B", key=user_key)


class DeltaGeneratorClassTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Class."""

    def test_constructor(self):
        """Test default DeltaGenerator()."""
        dg = DeltaGenerator()
        assert not dg._cursor.is_locked
        assert dg._cursor.index == 0

    def test_constructor_with_id(self):
        """Test DeltaGenerator() with an id."""
        cursor = LockedCursor(root_container=RootContainer.MAIN, index=1234)
        dg = DeltaGenerator(root_container=RootContainer.MAIN, cursor=cursor)
        assert dg._cursor.is_locked
        assert dg._cursor.index == 1234

    def test_can_deepcopy_delta_generators(self):
        cursor = LockedCursor(root_container=RootContainer.MAIN, index=1234)
        dg1 = DeltaGenerator(root_container=RootContainer.MAIN, cursor=cursor)
        dg2 = deepcopy(dg1)

        assert dg1._root_container == dg2._root_container
        assert dg1._parent is None
        assert dg2._parent is None
        assert dg1._block_type == dg2._block_type

        # Check that the internals of the Cursors look the same. Note the cursors
        # themselves will be different objects so won't compare equal.
        c1 = dg1._cursor
        c2 = dg2._cursor
        assert isinstance(c1, LockedCursor)
        assert isinstance(c2, LockedCursor)
        assert c1._root_container == c2._root_container
        assert c1._index == c2._index
        assert c1._parent_path == c2._parent_path

    def test_enqueue_null(self):
        # Test "Null" Delta generators
        dg = DeltaGenerator(root_container=None)
        new_dg = dg._enqueue("empty", EmptyProto())
        assert dg == new_dg

    @parameterized.expand([(RootContainer.MAIN,), (RootContainer.SIDEBAR,)])
    def test_enqueue(self, container):
        dg = DeltaGenerator(root_container=container)
        assert dg._cursor.index == 0
        assert container == dg._root_container

        test_data = "some test data"
        text_proto = TextProto()
        text_proto.body = test_data
        new_dg = dg._enqueue("text", text_proto)

        assert dg != new_dg
        assert dg._cursor.index == 1
        assert container == new_dg._root_container

        delta = self.get_delta_from_queue()
        element = delta.new_element
        assert delta.fragment_id == ""
        assert element.text.body == test_data

    def test_enqueue_same_id(self):
        cursor = LockedCursor(root_container=RootContainer.MAIN, index=123)
        dg = DeltaGenerator(root_container=RootContainer.MAIN, cursor=cursor)
        assert dg._cursor.index == 123

        test_data = "some test data"
        text_proto = TextProto()
        text_proto.body = test_data
        new_dg = dg._enqueue("text", text_proto)

        assert dg._cursor == new_dg._cursor

        msg = self.get_message_from_queue()
        # The last element in delta_path is the delta's index in its container.
        assert make_delta_path(RootContainer.MAIN, (), 123) == msg.metadata.delta_path
        assert msg.delta.new_element.text.body == test_data

    def test_enqueue_adds_fragment_id_to_delta_if_set(self):
        ThreadState.update(fragment_id="my_fragment_id")

        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        dg._enqueue("text", TextProto())

        delta = self.get_delta_from_queue()
        assert delta.fragment_id == "my_fragment_id"

    def test_fragment_sidebar_write_is_redirected_to_wrapper(self):
        ctx = get_script_run_ctx()
        ThreadState.update(fragment_id="my_fragment_id", delta_path=(0, 1, 2))
        self.addCleanup(lambda: ThreadState.update(fragment_id=None, delta_path=None))

        get_dg_singleton_instance().sidebar_dg._enqueue("text", TextProto())

        wrappers = ctx.fragment_storage.outside_wrappers_for("my_fragment_id")
        assert len(wrappers) == 1

    def test_parallel_worker_writing_directly_to_sidebar_raises(self):
        ThreadState.update(
            fragment_id="my_fragment_id",
            delta_path=(0, 1, 2),
            is_parallel_worker=True,
        )
        self.addCleanup(
            lambda: ThreadState.update(
                fragment_id=None, delta_path=None, is_parallel_worker=False
            )
        )

        with pytest.raises(StreamlitAPIException, match="parallel"):
            get_dg_singleton_instance().sidebar_dg._enqueue("text", TextProto())

    def test_enqueue_can_write_to_container_in_sidebar(self):
        ctx = get_script_run_ctx()
        ThreadState.update(fragment_id="my_fragment_id")
        ctx.fragment_ids_this_run = ["my_fragment_id"]

        get_dg_singleton_instance().sidebar_dg.container().write("Hello world")

        deltas = self.get_all_deltas_from_queue()
        assert [d.fragment_id for d in deltas] == ["my_fragment_id", "my_fragment_id"]


class DeltaGeneratorContainerTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Container."""

    def test_container(self):
        container = st.container()

        assert isinstance(container, DeltaGenerator)
        assert not container._cursor.is_locked

    def test_container_paths(self):
        level3 = st.container().container().container()
        level3.markdown("hi")
        level3.markdown("bye")

        msg = self.get_message_from_queue()
        assert (
            make_delta_path(RootContainer.MAIN, (0, 0, 0), 1) == msg.metadata.delta_path
        )


class DeltaGeneratorColumnsTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Columns."""

    def test_equal_columns(self):
        for column in st.columns(4):
            assert isinstance(column, DeltaGenerator)
            assert not column._cursor.is_locked

    def test_variable_columns(self):
        weights = [3, 1, 4, 1, 5, 9]
        sum_weights = sum(weights)
        st.columns(weights)

        for idx, weight in enumerate(weights):
            # Pull the delta from the back of the queue, using negative index
            delta = self.get_delta_from_queue(idx - len(weights))
            assert delta.add_block.column.weight == weight / sum_weights

    def test_bad_columns_negative_int(self):
        with pytest.raises(StreamlitAPIException):
            st.columns(-1337)

    def test_bad_columns_single_float(self):
        with pytest.raises(TypeError):
            st.columns(6.28)

    def test_bad_columns_list_negative_value(self):
        with pytest.raises(StreamlitAPIException):
            st.columns([5, 6, -1.2])

    def test_bad_columns_list_int_zero_value(self):
        with pytest.raises(StreamlitAPIException):
            st.columns([5, 0, 1])

    def test_bad_columns_list_float_zero_value(self):
        with pytest.raises(StreamlitAPIException):
            st.columns([5.0, 0.0, 1.0])

    def test_two_levels_of_columns_does_not_raise_any_exception(self):
        level1, _ = st.columns(2)
        try:
            _, _ = level1.columns(2)
        except StreamlitAPIException:
            self.fail("Error, one level of nested columns should be allowed!")

    def test_three_levels_of_columns_does_not_raise_any_exception(self):
        try:
            level1, _ = _ = st.columns(2)
            level2, _ = level1.columns(2)
            _, _ = level2.columns(2)
        except StreamlitAPIException:
            self.fail("Error, one level of nested columns should be allowed!")

    def test_one_level_of_columns_is_allowed_in_the_sidebar(self):
        try:
            with st.sidebar:
                _, _ = st.columns(2)
        except StreamlitAPIException:
            self.fail("Error, 1 level column should be allowed in the sidebar!")

    def test_two_levels_of_columns_is_allowed_in_the_sidebar(self):
        try:
            with st.sidebar:
                col1, _ = st.columns(2)
                _, _ = col1.columns(2)
        except StreamlitAPIException:
            self.fail("Error, 1 level column should be allowed in the sidebar!")


class DeltaGeneratorExpanderTest(DeltaGeneratorTestCase):
    def test_nested_expanders_allowed(self):
        level1 = st.expander("level 1")
        level1.expander("level 2")


class DeltaGeneratorWithTest(DeltaGeneratorTestCase):
    """Test the `with DG` feature"""

    def test_with(self):
        # Same as test_container_paths, but using `with` syntax
        level3 = st.container().container().container()
        with level3:
            st.markdown("hi")
            st.markdown("bye")

        msg = self.get_message_from_queue()
        assert (
            make_delta_path(RootContainer.MAIN, (0, 0, 0), 1) == msg.metadata.delta_path
        )

        # Now we're out of the `with` block, commands should use the main dg
        st.markdown("outside")

        msg = self.get_message_from_queue()
        assert make_delta_path(RootContainer.MAIN, (), 1) == msg.metadata.delta_path

    def test_nested_with(self):
        with st.container():
            with st.container():
                st.markdown("Level 2 with")
                msg = self.get_message_from_queue()
                assert (
                    make_delta_path(RootContainer.MAIN, (0, 0), 0)
                    == msg.metadata.delta_path
                )

            st.markdown("Level 1 with")
            msg = self.get_message_from_queue()
            assert (
                make_delta_path(RootContainer.MAIN, (0,), 1) == msg.metadata.delta_path
            )

    def test_threads_with(self):
        """
        Tests that with statements work correctly when multiple threads are involved.

        The test sequence is as follows:

              Main Thread       |       Worker Thread
        -----------------------------------------------------
        with container1:        |
                                | with container2:
        st.markdown("Object 1") |
                                | st.markdown("Object 2")


        We check that Object1 is created in container1 and object2 is created in container2.
        """
        container1 = st.container()
        container2 = st.container()

        with_1 = threading.Event()
        with_2 = threading.Event()
        object_1 = threading.Event()

        def thread():
            with_1.wait()
            with container2:
                with_2.set()
                object_1.wait()

                st.markdown("Object 2")
                msg = self.get_message_from_queue()
                assert (
                    make_delta_path(RootContainer.MAIN, (1,), 0)
                    == msg.metadata.delta_path
                )

        worker_thread = threading.Thread(target=thread)
        add_script_run_ctx(worker_thread)
        worker_thread.start()

        with container1:
            with_1.set()
            with_2.wait()

            st.markdown("Object in container 1")
            msg = self.get_message_from_queue()
            assert (
                make_delta_path(RootContainer.MAIN, (0,), 0) == msg.metadata.delta_path
            )

            object_1.set()
            worker_thread.join()

    def test_asyncio_with(self):
        """
        Tests that with statements work correctly when multiple async tasks are involved.

        The test sequence is as follows:

              Task 1             |       Task 2
        -----------------------------------------------------
        with container1:
        asyncio.create_task()   ->
                                 | st.markdown("Object 1a")
                                 | with container2:
        st.markdown("Object 1b") |
                                 | st.markdown("Object 2")

        In this scenario, Task 2 should inherit the container1 context from Task 1
        when it is created, so Objects 1a and 1b will both go in container 1,
        and object 2 will go in container 2.
        """
        container1 = st.container()
        container2 = st.container()

        async def runner():
            with_2 = asyncio.Event()
            object_1 = asyncio.Event()

            async def task2():
                st.markdown("Object 1a")
                msg = self.get_message_from_queue()
                assert (
                    make_delta_path(RootContainer.MAIN, (0,), 0)
                    == msg.metadata.delta_path
                )

                with container2:
                    with_2.set()
                    st.markdown("Object 2")
                    msg = self.get_message_from_queue()
                    assert (
                        make_delta_path(RootContainer.MAIN, (1,), 0)
                        == msg.metadata.delta_path
                    )

                    await object_1.wait()

            async def task1():
                with container1:
                    task = asyncio.create_task(task2())

                    await with_2.wait()

                    st.markdown("Object 1b")
                    msg = self.get_message_from_queue()
                    assert (
                        make_delta_path(RootContainer.MAIN, (0,), 1)
                        == msg.metadata.delta_path
                    )

                    object_1.set()
                    await task

            await task1()

        asyncio.run(runner())


class DeltaGeneratorWriteTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Text, Alert, Json, and Markdown Classes."""

    def test_json_list(self):
        """Test Text.JSON list."""
        json_data = [5, 6, 7, 8]

        st.json(json_data)

        json_string = json.dumps(json_data)

        element = self.get_delta_from_queue().new_element
        assert json_string == element.json.body

    def test_json_tuple(self):
        """Test Text.JSON tuple."""
        json_data = (5, 6, 7, 8)

        st.json(json_data)

        json_string = json.dumps(json_data)

        element = self.get_delta_from_queue().new_element
        assert json_string == element.json.body

    def test_json_object(self):
        """Test Text.JSON object."""
        json_data = {"key": "value"}

        # Testing python object
        st.json(json_data)

        json_string = json.dumps(json_data)

        element = self.get_delta_from_queue().new_element
        assert json_string == element.json.body
        assert element.json.expanded

    def test_json_string(self):
        """Test Text.JSON string."""
        json_string = '{"key": "value"}'

        # Testing JSON string
        st.json(json_string)

        element = self.get_delta_from_queue().new_element
        assert json_string == element.json.body

    def test_json_unserializable(self):
        """Test Text.JSON with unserializable object."""
        obj = json  # Modules aren't serializable.

        # Testing unserializable object.
        st.json(obj)

        element = self.get_delta_from_queue().new_element

        # validate a substring since repr for a module may contain an installation-specific path
        assert element.json.body.startswith("\"<module 'json'")

    def test_json_not_expanded_arg(self):
        """Test st.json expanded arg."""
        json_data = {"key": "value"}

        # Testing python object
        st.json(json_data, expanded=False)

        json_string = json.dumps(json_data)

        element = self.get_delta_from_queue().new_element
        assert json_string == element.json.body
        assert not element.json.expanded

    def test_json_not_mutates_data_containing_sets(self):
        """Test st.json do not mutate data containing sets,
        pass a dict-containing-a-set to st.json; ensure that it's not mutated
        """
        json_data = {"some_set": {"a", "b"}}
        assert isinstance(json_data["some_set"], set)

        st.json(json_data)
        assert isinstance(json_data["some_set"], set)

    def test_st_json_set_is_serialized_as_list(self):
        """Test st.json serializes set as list"""
        json_data = {"a", "b", "c", "d"}
        st.json(json_data)
        element = self.get_delta_from_queue().new_element
        parsed_element = json.loads(element.json.body)
        assert isinstance(parsed_element, list)
        for el in json_data:
            assert el in parsed_element

    def test_st_json_serializes_sets_inside_iterables_as_lists(self):
        """Test st.json serializes sets inside iterables as lists"""
        json_data = {"some_set": {"a", "b"}}
        st.json(json_data)
        element = self.get_delta_from_queue().new_element
        parsed_element = json.loads(element.json.body)
        set_as_list = parsed_element.get("some_set")
        assert isinstance(set_as_list, list)
        assert json_data["some_set"] == set(set_as_list)

    def test_st_json_generator_is_serialized_as_string(self):
        """Test st.json serializes generator as string"""
        json_data = (c for c in "foo")
        st.json(json_data)
        element = self.get_delta_from_queue().new_element
        parsed_element = json.loads(element.json.body)
        assert isinstance(parsed_element, str)
        assert "generator" in parsed_element

    def test_markdown(self):
        """Test Markdown element."""
        test_string = "    data         "

        st.markdown(test_string)

        element = self.get_delta_from_queue().new_element
        assert element.markdown.body == "data"

        test_string = "    <a#data>data</a>   "
        st.markdown(test_string)
        element = self.get_delta_from_queue().new_element

        assert element.markdown.body.startswith("<a#data>")

    def test_empty(self):
        """Test Empty."""
        st.empty()

        element = self.get_delta_from_queue().new_element
        assert element.empty == EmptyProto()


class AutogeneratedWidgetIdTests(DeltaGeneratorTestCase):
    def test_ids_are_equal_when_inputs_are_equal(self):
        with pytest.raises(StreamlitDuplicateElementId):
            compute_and_register_element_id(
                "text_input",
                label="Label #1",
                default="Value #1",
                user_key=None,
                key_as_main_identity=False,
                dg=None,
            )

            compute_and_register_element_id(
                "text_input",
                label="Label #1",
                default="Value #1",
                user_key=None,
                key_as_main_identity=False,
                dg=None,
            )

    def test_duplicated_key_is_raised(self):
        with pytest.raises(StreamlitDuplicateElementKey):
            compute_and_register_element_id(
                "text_input",
                label="Label #1",
                default="Value #1",
                user_key="some_key1",
                key_as_main_identity=False,
                dg=None,
            )

            compute_and_register_element_id(
                "text_input",
                label="Label #2",
                default="Value #1",
                user_key="some_key1",
                key_as_main_identity=False,
                dg=None,
            )

    def test_ids_are_diff_when_labels_are_diff(self):
        id1 = compute_and_register_element_id(
            "text_input",
            label="Label #1",
            default="Value #1",
            user_key=None,
            key_as_main_identity=False,
            dg=None,
        )
        id2 = compute_and_register_element_id(
            "text_input",
            label="Label #2",
            default="Value #1",
            user_key=None,
            key_as_main_identity=False,
            dg=None,
        )

        assert id1 != id2

    def test_ids_are_diff_when_types_are_diff(self):
        id1 = compute_and_register_element_id(
            "text_input",
            label="Label #1",
            default="Value #1",
            user_key=None,
            key_as_main_identity=False,
            dg=None,
        )
        id2 = compute_and_register_element_id(
            "text_area",
            label="Label #1",
            default="Value #1",
            user_key=None,
            key_as_main_identity=False,
            dg=None,
        )
        assert id1 != id2


class KeyWidgetIdTests(DeltaGeneratorTestCase):
    def test_ids_are_diff_when_keys_are_diff(self):
        id1 = compute_and_register_element_id(
            "text_input",
            user_key="some_key1",
            label="Label #1",
            default="Value #1",
            key_as_main_identity=False,
            dg=None,
        )

        id2 = compute_and_register_element_id(
            "text_input",
            user_key="some_key2",
            label="Label #1",
            default="Value #1",
            key_as_main_identity=False,
            dg=None,
        )

        assert id1 != id2


class KeyAsMainIdentityTests(DeltaGeneratorTestCase):
    """Test key_as_main_identity parameter in compute_and_register_element_id."""

    @parameterized.expand(
        [
            # test_name, key_as_main_identity, user_key, expect_same_id, description
            (
                "with_key_true",
                True,
                "test_key",
                True,
                "key_as_main_identity=True with user_key should ignore kwargs",
            ),
            (
                "without_key_true",
                True,
                None,
                False,
                "key_as_main_identity=True without user_key should use kwargs",
            ),
            (
                "with_key_false",
                False,
                "test_key2",
                False,
                "key_as_main_identity=False should always use kwargs",
            ),
        ]
    )
    def test_key_as_main_identity_behavior(
        self, _name, key_as_main_identity, user_key, expect_same_id, description
    ):
        """Test key_as_main_identity parameter behavior with various configurations."""
        # Prepare kwargs for compute_and_register_element_id
        kwargs = {
            "element_type": "text_input",
            "user_key": user_key,
            "label": "Label #1",
            "default": "Value #1",
            "dg": None,
            "key_as_main_identity": key_as_main_identity,
        }

        # Create first element
        id1 = compute_and_register_element_id(**kwargs)

        # Clear the widget registry to allow reusing the same key
        ctx = get_script_run_ctx()
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()

        # Create second element with different kwargs
        kwargs["label"] = "Different Label"
        kwargs["default"] = "Different Value"
        id2 = compute_and_register_element_id(**kwargs)

        # Assert based on expected behavior
        if expect_same_id:
            assert id1 == id2, f"IDs should be equal: {description}"
        else:
            assert id1 != id2, f"IDs should be different: {description}"

    def test_key_as_main_identity_different_element_types(self):
        """When key_as_main_identity=True with same user_key,
        different element types should still produce different IDs."""
        # Create text_input with key_as_main_identity=True
        id1 = compute_and_register_element_id(
            "text_input",
            user_key="shared_key",
            key_as_main_identity=True,
            label="Label #1",
            default="Value #1",
            dg=None,
        )

        # Clear the widget registry to allow reusing the same key
        ctx = get_script_run_ctx()
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()

        # Create text_area with same key - different element type
        id2 = compute_and_register_element_id(
            "text_area",
            user_key="shared_key",
            key_as_main_identity=True,
            label="Label #1",
            default="Value #1",
            dg=None,
        )

        assert id1 != id2, (
            "IDs should be different for different element types even with same key"
        )

    @parameterized.expand(
        [
            ("set_empty_ignores_dg_context", set(), True),
            ("set_with_label_ignores_dg_context", {"label"}, True),
            ("bool_true_ignores_dg_context", True, True),
            ("bool_false_includes_dg_context", False, False),
        ]
    )
    def test_key_as_main_identity_dg_context_effect(
        self, _name: str, key_as_main_identity, expect_same_id: bool
    ) -> None:
        """When user_key is provided, sets (even empty) and True should ignore
        DG context (form/sidebar) in ID computation; False should include it.
        """
        sidebar_dg = get_dg_singleton_instance().sidebar_dg
        main_dg = DeltaGenerator(root_container=RootContainer.MAIN)

        base_kwargs: dict[str, object] = {
            "element_type": "text_input",
            "user_key": "dg_ctx_key",
            "label": "Label #1",
            "default": "Value #1",
            "key_as_main_identity": key_as_main_identity,
        }

        # Compute with sidebar DG context
        id1 = compute_and_register_element_id(dg=sidebar_dg, **base_kwargs)

        # Clear registry, then compute with main DG context
        ctx = get_script_run_ctx()
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()

        id2 = compute_and_register_element_id(dg=main_dg, **base_kwargs)

        if expect_same_id:
            assert id1 == id2
        else:
            assert id1 != id2

    @parameterized.expand(
        [
            (
                "whitelist_label_change_default",
                {"label"},
                "default",
                True,
                "With user_key and whitelist={'label'}, changing default should not affect ID",
            ),
            (
                "whitelist_label_change_label",
                {"label"},
                "label",
                False,
                "With user_key and whitelist={'label'}, changing label should affect ID",
            ),
            (
                "whitelist_label_default_change_default",
                {"label", "default"},
                "default",
                False,
                "With user_key and whitelist contains 'default', changing default should affect ID",
            ),
            (
                "empty_whitelist_change_label",
                set(),
                "label",
                True,
                "With user_key and empty whitelist, changing label should not affect ID",
            ),
            (
                "empty_whitelist_change_default",
                set(),
                "default",
                True,
                "With user_key and empty whitelist, changing default should not affect ID",
            ),
        ]
    )
    def test_key_as_main_identity_whitelist_with_user_key(
        self,
        _name: str,
        whitelist: set[str],
        changed_kwarg: str,
        expect_same_id: bool,
        _description: str,
    ) -> None:
        """When user_key is provided and a whitelist set is used, only whitelisted
        kwargs should influence the element ID.
        """
        # Base kwargs
        kwargs: dict[str, object] = {
            "element_type": "text_input",
            "user_key": "whitelist_key",
            "label": "Label #1",
            "default": "Value #1",
            "dg": None,
            "key_as_main_identity": whitelist,
        }

        id1 = compute_and_register_element_id(**kwargs)

        # Clear the widget registry to allow reusing the same key/ids
        ctx = get_script_run_ctx()
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()

        # Change the selected kwarg
        if changed_kwarg == "label":
            kwargs["label"] = "Different Label"
        else:
            kwargs["default"] = "Different Value"

        id2 = compute_and_register_element_id(**kwargs)

        if expect_same_id:
            assert id1 == id2
        else:
            assert id1 != id2

    def test_key_as_main_identity_whitelist_without_user_key(self) -> None:
        """When no user_key is provided, a set whitelist should have no effect;
        all kwargs are included in the ID computation.
        """
        # Base with no user_key
        base_kwargs: dict[str, object] = {
            "element_type": "text_input",
            "user_key": None,
            "label": "Label #1",
            "default": "Value #1",
            "dg": None,
            "key_as_main_identity": {"label"},
        }

        id1 = compute_and_register_element_id(**base_kwargs)

        # Clear registry before next computation
        ctx = get_script_run_ctx()
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()

        # Changing a non-whitelisted kwarg should still change the ID when no user_key
        kwargs_changed_default = dict(base_kwargs)
        kwargs_changed_default["default"] = "Different Value"
        id2 = compute_and_register_element_id(**kwargs_changed_default)
        assert id1 != id2

        # Clear again and change a whitelisted kwarg
        ctx.shared.widget_ids_this_run.clear()
        ctx.shared.widget_user_keys_this_run.clear()
        kwargs_changed_label = dict(base_kwargs)
        kwargs_changed_label["label"] = "Different Label"
        id3 = compute_and_register_element_id(**kwargs_changed_label)
        assert id1 != id3


class DeltaGeneratorImageTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Images"""

    def test_image_from_url(self):
        """Tests dg.image with single and multiple image URLs"""

        url = "https://streamlit.io/an_image.png"
        caption = "ahoy!"

        # single URL
        st.image(url, caption=caption, width=200)
        element = self.get_delta_from_queue().new_element
        assert element.width_config.pixel_width == 200
        assert len(element.imgs.imgs) == 1
        assert element.imgs.imgs[0].url == url
        assert element.imgs.imgs[0].caption == caption

        # multiple URLs
        st.image([url] * 5, caption=[caption] * 5, width=200)
        element = self.get_delta_from_queue().new_element
        assert len(element.imgs.imgs) == 5
        assert element.imgs.imgs[4].url == url
        assert element.imgs.imgs[4].caption == caption

    def test_unequal_images_and_captions_error(self):
        """Tests that the number of images and captions must match, or
        an exception is generated"""

        url = "https://streamlit.io/an_image.png"
        caption = "ahoy!"

        with pytest.raises(
            StreamlitAPIException, match=r"Cannot pair 2 captions with 5 images."
        ):
            st.image([url] * 5, caption=[caption] * 2)

    def test_transient_creation(self):
        """Test that _transient creates a transient element."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        element = ElementProto()
        element.text.body = "transient text"

        create_cb, _ = dg._transient(element)
        msg = create_cb()

        assert msg.delta.new_transient.elements[0].text.body == "transient text"
        assert msg.metadata.delta_path == make_delta_path(RootContainer.MAIN, (), 0)

    def test_transient_deletion(self):
        """Test that _transient deletion works."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        element = ElementProto()
        element.text.body = "transient text"

        create_cb, clear_cb = dg._transient(element)
        create_cb()
        msg = clear_cb()

        assert len(msg.delta.new_transient.elements) == 0
        assert msg.metadata.delta_path == make_delta_path(RootContainer.MAIN, (), 0)

    def test_multiple_transient_elements(self):
        """Test multiple transient elements at the same cursor."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)

        element1 = ElementProto()
        element1.text.body = "text1"
        create_cb1, clear_cb1 = dg._transient(element1)

        element2 = ElementProto()
        element2.text.body = "text2"
        create_cb2, _clear_cb2 = dg._transient(element2)

        msg1 = create_cb1()
        assert len(msg1.delta.new_transient.elements) == 1
        assert msg1.delta.new_transient.elements[0].text.body == "text1"

        msg2 = create_cb2()
        assert len(msg2.delta.new_transient.elements) == 2
        assert msg2.delta.new_transient.elements[0].text.body == "text1"
        assert msg2.delta.new_transient.elements[1].text.body == "text2"

        msg3 = clear_cb1()
        assert len(msg3.delta.new_transient.elements) == 1
        assert msg3.delta.new_transient.elements[0].text.body == "text2"

    def test_transient_layout_config(self):
        """Test that _transient handles layout config."""
        from streamlit.elements.lib.layout_utils import LayoutConfig

        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        element = ElementProto()
        element.text.body = "transient text"
        layout = LayoutConfig(width=100, height=200)

        create_cb, _ = dg._transient(element, layout_config=layout)
        msg = create_cb()

        transient_element = msg.delta.new_transient.elements[0]
        assert transient_element.width_config.pixel_width == 100
        assert transient_element.height_config.pixel_height == 200


# _is_inside_fragment_path tests


@pytest.mark.parametrize(
    ("cursor_path", "fragment_path", "expected"),
    [
        # Equal paths → True
        ((0, 1, 2), (0, 1, 2), True),
        # Cursor path is a child of fragment path (longer, matching prefix) → True
        ((0, 1, 2, 3), (0, 1, 2), True),
        ((0, 1, 2, 3, 4, 5), (0, 1), True),
        # Cursor path is shorter than fragment path → False
        ((0, 1), (0, 1, 2), False),
        ((0,), (0, 1, 2), False),
        # Non-matching prefix of same length → False
        ((0, 1, 3), (0, 1, 2), False),
        ((1, 1, 2), (0, 1, 2), False),
        # Non-matching prefix of greater length → False
        ((0, 1, 3, 4), (0, 1, 2), False),
        ((1, 2, 3, 4, 5), (0, 1, 2), False),
        # Empty fragment path → True (any path is "inside" empty prefix)
        ((0, 1, 2), (), True),
        ((0,), (), True),
        # Empty cursor path with non-empty fragment path → False
        ((), (0, 1, 2), False),
        ((), (0,), False),
        # Both empty → True
        ((), (), True),
    ],
)
def test_is_inside_fragment_path(
    cursor_path: tuple[int, ...],
    fragment_path: tuple[int, ...],
    expected: bool,
) -> None:
    """_is_inside_fragment_path returns whether cursor_path is within fragment_path."""
    from streamlit.delta_generator import _is_inside_fragment_path

    assert _is_inside_fragment_path(cursor_path, fragment_path) == expected


# Parallel worker external container write restriction tests


class ParallelWorkerExternalContainerWriteTest(DeltaGeneratorTestCase):
    """Tests for external container write restriction in parallel workers."""

    def test_parallel_worker_write_outside_fragment_raises_exception(self) -> None:
        """Enqueue raises StreamlitAPIException when writing outside fragment path.

        The fragment_path and cursor delta_path both include the root container.
        RootContainer.MAIN = 0, so fragment_path (0, 1, 2) means the fragment is
        at MAIN container, parent_path (1,), index 2. A cursor outside this path
        (e.g., at parent_path (1,), index 3) will have delta_path (0, 1, 3).
        """
        # Fragment at MAIN (0), parent_path (1,), index 2 → delta_path = (0, 1, 2)
        fragment_path = (0, 1, 2)
        ThreadState.update(is_parallel_worker=True, delta_path=fragment_path)

        try:
            # Cursor at MAIN (0), parent_path (1,), index 3 → delta_path = (0, 1, 3)
            # This path is NOT inside (0, 1, 2) because they diverge at index 2 vs 3
            outside_cursor = LockedCursor(
                root_container=RootContainer.MAIN,
                parent_path=(1,),
                index=3,
            )
            outside_dg = DeltaGenerator(
                root_container=RootContainer.MAIN,
                cursor=outside_cursor,
            )

            with pytest.raises(StreamlitAPIException) as exc_info:
                outside_dg._enqueue("text", TextProto())

            assert "outside a parallel fragment" in str(exc_info.value)
        finally:
            ThreadState.update(is_parallel_worker=False, delta_path=())

    def test_parallel_worker_write_inside_fragment_succeeds(self) -> None:
        """Enqueue succeeds when writing inside the fragment path.

        A cursor path (0, 1, 2, 3) is inside fragment path (0, 1, 2) because
        the cursor path starts with the fragment path prefix.
        """
        # Fragment at MAIN (0), parent_path (1,), index 2 → delta_path = (0, 1, 2)
        fragment_path = (0, 1, 2)
        ThreadState.update(is_parallel_worker=True, delta_path=fragment_path)

        try:
            # Cursor at MAIN (0), parent_path (1, 2), index 3 → delta_path = (0, 1, 2, 3)
            # This path IS inside (0, 1, 2) because it starts with the fragment path
            inside_cursor = LockedCursor(
                root_container=RootContainer.MAIN,
                parent_path=(1, 2),
                index=3,
            )
            inside_dg = DeltaGenerator(
                root_container=RootContainer.MAIN,
                cursor=inside_cursor,
            )

            # Should not raise
            text_proto = TextProto()
            text_proto.body = "test content"
            result = inside_dg._enqueue("text", text_proto)

            # Verify we got a valid result (not an exception)
            assert result is not None
        finally:
            ThreadState.update(is_parallel_worker=False, delta_path=())

    def test_parallel_worker_write_at_fragment_path_succeeds(self) -> None:
        """Enqueue succeeds when writing exactly at fragment path.

        A cursor path equal to fragment path (0, 1, 2) is considered "inside"
        because _is_inside_fragment_path returns True for equal paths.
        """
        # Fragment at MAIN (0), parent_path (1,), index 2 → delta_path = (0, 1, 2)
        fragment_path = (0, 1, 2)
        ThreadState.update(is_parallel_worker=True, delta_path=fragment_path)

        try:
            # Cursor at MAIN (0), parent_path (1,), index 2 → delta_path = (0, 1, 2)
            # This path IS equal to fragment path
            at_cursor = LockedCursor(
                root_container=RootContainer.MAIN,
                parent_path=(1,),
                index=2,
            )
            at_dg = DeltaGenerator(
                root_container=RootContainer.MAIN,
                cursor=at_cursor,
            )

            # Should not raise
            text_proto = TextProto()
            text_proto.body = "test content"
            result = at_dg._enqueue("text", text_proto)

            assert result is not None
        finally:
            ThreadState.update(is_parallel_worker=False, delta_path=())

    def test_delta_path_encodes_root_container(self) -> None:
        """delta_path encodes the root container as its first element.

        This is the invariant that keeps the parallel-worker guard correct across
        root containers: a MAIN fragment_path and a sidebar/bottom write share
        their parent_path/index but differ in delta_path[0], so
        _is_inside_fragment_path can never prefix-match across containers. Tested
        directly here (rather than through _enqueue) because it's a property of
        make_delta_path; combined with test_is_inside_fragment_path and
        test_parallel_worker_write_outside_fragment_raises_exception it covers the
        cross-container case compositionally. If the root prefix were ever dropped
        from make_delta_path, this assertion fails.
        """
        main = LockedCursor(
            root_container=RootContainer.MAIN, parent_path=(1,), index=2
        )
        sidebar = LockedCursor(
            root_container=RootContainer.SIDEBAR, parent_path=(1,), index=2
        )
        bottom = LockedCursor(
            root_container=RootContainer.BOTTOM, parent_path=(1,), index=2
        )

        assert main.delta_path == [RootContainer.MAIN, 1, 2]
        assert sidebar.delta_path == [RootContainer.SIDEBAR, 1, 2]
        assert bottom.delta_path == [RootContainer.BOTTOM, 1, 2]
        # The only thing distinguishing identical paths in different containers is
        # the leading root-container element.
        assert sidebar.delta_path[0] != main.delta_path[0]
        assert bottom.delta_path[0] != main.delta_path[0]


# Outside container writes: detection, wrapper creation, and redirection.


def _message_queue(test_case: DeltaGeneratorTestCase) -> list:
    """Return the queued ForwardMsg protos that carry a delta."""
    return [msg for msg in test_case.forward_msg_queue._queue if msg.HasField("delta")]


class BlockCreationDeltaPathTest(DeltaGeneratorTestCase):
    """Tests that _block emits add_block messages at the correct delta path."""

    def test_container_add_block_uses_correct_delta_path(self) -> None:
        """A container at a non-zero index emits its add_block at its own slot,
        not at the next slot (which would happen if delta_path were read after
        the cursor was advanced).
        """
        st.text("first")
        st.container()

        msg = self.get_message_from_queue()
        assert msg.delta.WhichOneof("type") == "add_block"
        assert msg.metadata.delta_path == make_delta_path(RootContainer.MAIN, (), 1)

    def test_nested_container_delta_paths(self) -> None:
        """Nested containers emit at paths reflecting their nesting depth."""
        level3 = st.container().container().container()
        level3.markdown("hi")

        msg = self.get_message_from_queue()
        assert msg.metadata.delta_path == make_delta_path(
            RootContainer.MAIN, (0, 0, 0), 0
        )


class NeedsOutsideWrapperTest(DeltaGeneratorTestCase):
    """Tests for detecting when a fragment writes to a container declared outside its scope."""

    def setUp(self) -> None:
        super().setUp()
        self.fragment_storage = MemoryFragmentStorage()
        self.ts = FragmentThreadState(fragment_id="frag", delta_path=(0, 3))

    def _check(self, dg: DeltaGenerator) -> bool:
        return delta_generator._needs_outside_wrapper(
            dg, self.ts, self.fragment_storage
        )

    def test_no_fragment_id_returns_false(self) -> None:
        """A write outside any fragment never needs a wrapper."""
        ts = FragmentThreadState(fragment_id=None, delta_path=(0, 3))
        dg = DeltaGenerator(root_container=RootContainer.SIDEBAR)
        assert (
            delta_generator._needs_outside_wrapper(dg, ts, self.fragment_storage)
            is False
        )

    def test_no_delta_path_returns_false(self) -> None:
        """Returns False when delta_path is None (fragment hasn't established its
        position yet, so detection is not active).
        """
        ts = FragmentThreadState(fragment_id="frag", delta_path=None)
        dg = DeltaGenerator(root_container=RootContainer.SIDEBAR)
        assert (
            delta_generator._needs_outside_wrapper(dg, ts, self.fragment_storage)
            is False
        )

    def test_sidebar_root_returns_true(self) -> None:
        """A fragment writing directly to the sidebar root needs a wrapper."""
        dg = DeltaGenerator(root_container=RootContainer.SIDEBAR)
        assert self._check(dg) is True

    def test_bottom_root_returns_true(self) -> None:
        """A fragment writing directly to the bottom root needs a wrapper."""
        dg = DeltaGenerator(root_container=RootContainer.BOTTOM)
        assert self._check(dg) is True

    def test_main_root_returns_false(self) -> None:
        """The main root is reached via the fragment path, not a wrapper."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        assert self._check(dg) is False

    def test_event_root_returns_false(self) -> None:
        """The event root needs no positional isolation."""
        dg = DeltaGenerator(root_container=RootContainer.EVENT)
        assert self._check(dg) is False

    def test_write_within_own_fragment_container_returns_false(self) -> None:
        """A write to a container within the fragment's own scope is not an outside write."""
        inside_cursor = LockedCursor(
            root_container=RootContainer.MAIN, parent_path=(3,), index=0
        )
        dg = DeltaGenerator(root_container=RootContainer.MAIN, cursor=inside_cursor)
        assert self._check(dg) is False

    def test_dg_already_inside_wrapper_returns_false(self) -> None:
        """A nested container created inside an existing wrapper doesn't need a second wrapper."""
        wrapper_dg = DeltaGenerator(
            root_container=RootContainer.MAIN,
            cursor=RunningCursor(root_container=RootContainer.MAIN, parent_path=(0,)),
            block_type="transparent",
        )
        self.fragment_storage.register_outside_wrapper(
            "frag",
            "container-id",
            OutsideContainerWrapper(
                wrapper_dg, [0, 0], Block_pb2.Block(), creating_fragment_id=None
            ),
        )
        nested_cursor = LockedCursor(
            root_container=RootContainer.MAIN, parent_path=(9,), index=0
        )
        nested_dg = DeltaGenerator(
            root_container=RootContainer.MAIN,
            cursor=nested_cursor,
            parent=wrapper_dg,
        )
        assert self._check(nested_dg) is False

    def test_write_to_container_outside_fragment_scope_returns_true(self) -> None:
        """A write to a container outside the fragment's scope needs a wrapper."""
        outside_cursor = LockedCursor(
            root_container=RootContainer.MAIN, parent_path=(9,), index=0
        )
        dg = DeltaGenerator(root_container=RootContainer.MAIN, cursor=outside_cursor)
        assert self._check(dg) is True


class OutsideWrapperCreationTest(DeltaGeneratorTestCase):
    """Tests for wrapper creation and redirection through the public write path."""

    def _enter_fragment(
        self, fragment_id: str = "frag", delta_path: tuple[int, ...] = (0, 99)
    ) -> None:
        ThreadState.update(fragment_id=fragment_id, delta_path=delta_path)
        self.addCleanup(lambda: ThreadState.update(fragment_id=None, delta_path=None))

    def test_outside_write_emits_transparent_block_then_nested_element(self) -> None:
        """An outside write inserts a transparent wrapper, then nests the element."""
        outside = st.container()
        outside_path = list(outside._cursor.delta_path)
        self.clear_queue()

        self._enter_fragment()
        outside.markdown("hi")

        msgs = _message_queue(self)
        block_msg, element_msg = msgs[0], msgs[1]
        assert block_msg.delta.add_block.WhichOneof("type") == "transparent"
        assert list(block_msg.metadata.delta_path) == outside_path
        assert list(element_msg.metadata.delta_path) == [*outside_path, 0]

    def test_outside_write_registers_single_wrapper(self) -> None:
        """Repeated writes to the same outside container reuse one wrapper."""
        outside = st.container()
        self._enter_fragment()

        outside.markdown("one")
        outside.markdown("two")

        wrappers = self.script_run_ctx.fragment_storage.outside_wrappers_for("frag")
        assert len(wrappers) == 1

    def test_nested_container_produces_single_wrapper(self) -> None:
        """Creating a nested container inside an outside container only allocates one wrapper."""
        outside = st.container()
        self._enter_fragment()

        nested = outside.container()
        nested.markdown("deep")

        wrappers = self.script_run_ctx.fragment_storage.outside_wrappers_for("frag")
        assert len(wrappers) == 1

    def test_two_fragments_get_distinct_wrappers(self) -> None:
        """Two fragments writing to one container get two wrappers at two slots."""
        outside = st.container()
        storage = self.script_run_ctx.fragment_storage

        ThreadState.update(fragment_id="frag_a", delta_path=(0, 99))
        outside.markdown("a")
        ThreadState.update(fragment_id="frag_b", delta_path=(0, 99))
        outside.markdown("b")
        ThreadState.update(fragment_id=None, delta_path=None)

        wrapper_a = storage.get_outside_wrapper("frag_a", outside._id)
        wrapper_b = storage.get_outside_wrapper("frag_b", outside._id)
        assert wrapper_a is not None
        assert wrapper_b is not None
        assert wrapper_a.creation_delta_path != wrapper_b.creation_delta_path

    def test_fragment_only_rerun_without_prior_write_raises(self) -> None:
        """If the outside container was never written to during a full app run, a
        fragment-only rerun raises.
        """
        outside = st.container()
        self.script_run_ctx.fragment_ids_this_run = ["frag"]
        self._enter_fragment()

        with pytest.raises(StreamlitAPIException) as exc_info:
            outside.markdown("hi")
        assert "could not reserve a stable position" in str(exc_info.value)

    def test_fragment_rerun_allows_wrapper_for_container_created_by_running_fragment(
        self,
    ) -> None:
        """During a fragment rerun, if the target container was created by one
        of the running fragments (e.g. a parent), a new wrapper is allowed.
        This supports nested fragments writing into parent-owned containers.
        """
        self._enter_fragment(fragment_id="parent_frag")
        inside_container = st.container()
        ThreadState.update(fragment_id=None, delta_path=None)

        self.script_run_ctx.fragment_ids_this_run = ["parent_frag"]
        self._enter_fragment(fragment_id="child_frag")

        inside_container.markdown("child write")

        wrapper = self.script_run_ctx.fragment_storage.get_outside_wrapper(
            "child_frag", inside_container._id
        )
        assert wrapper is not None

    def test_empty_outside_container_produces_locked_wrapper(self) -> None:
        """An st.empty() outside container produces a locked wrapper cursor."""
        outside = st.empty()
        self._enter_fragment()

        outside.markdown("hi")

        wrapper = self.script_run_ctx.fragment_storage.get_outside_wrapper(
            "frag", outside._id
        )
        assert wrapper is not None
        assert wrapper.delta_generator._cursor.is_locked is True

    def test_bottom_root_wrapper_records_no_creating_fragment(self) -> None:
        """Root containers like bottom aren't created by any fragment, so the wrapper records None."""
        bottom_dg = get_dg_singleton_instance().bottom_dg
        self._enter_fragment()

        bottom_dg.markdown("hi")

        wrappers = self.script_run_ctx.fragment_storage.outside_wrappers_for("frag")
        assert len(wrappers) == 1
        assert wrappers[0].creating_fragment_id is None

    def test_parallel_worker_needs_no_wrapper(self) -> None:
        """A parallel worker's write never needs an outside wrapper."""
        outside = st.container()
        ts = FragmentThreadState(
            fragment_id="frag", delta_path=(0, 99), is_parallel_worker=True
        )

        assert (
            delta_generator._needs_outside_wrapper(
                outside, ts, self.script_run_ctx.fragment_storage
            )
            is False
        )


class ContainerCreatingFragmentIdTest(DeltaGeneratorTestCase):
    """Tests for the _creating_fragment_id attribute set on containers."""

    def test_main_script_container_stamped_none(self) -> None:
        """A container created outside any fragment carries no creating fragment."""
        container = st.container()
        assert container._creating_fragment_id is None

    def test_container_stamped_with_active_fragment(self) -> None:
        """A container created inside a fragment is stamped with that fragment id."""
        ThreadState.update(fragment_id="parent_frag", delta_path=(0, 1))
        try:
            container = st.container()
        finally:
            ThreadState.update(fragment_id=None, delta_path=None)
        assert container._creating_fragment_id == "parent_frag"

    def test_wrapper_records_container_creating_fragment(self) -> None:
        """When writer_frag writes to a container created by parent_frag, the
        wrapper records parent_frag as the creator.
        """
        ThreadState.update(fragment_id="parent_frag", delta_path=(0, 1))
        container = st.container()
        ThreadState.update(fragment_id="writer_frag", delta_path=(0, 99))
        try:
            container.markdown("hi")
        finally:
            ThreadState.update(fragment_id=None, delta_path=None)

        wrapper = self.script_run_ctx.fragment_storage.get_outside_wrapper(
            "writer_frag", container._id
        )
        assert wrapper is not None
        assert wrapper.creating_fragment_id == "parent_frag"


class CreatingFragmentIdDeepCopyTest(DeltaGeneratorTestCase):
    """Deepcopy must preserve fragment-origin metadata so cached wrappers
    can evict correctly after a container is copied during fragment reruns."""

    def test_creating_fragment_id_survives_deepcopy(self) -> None:
        """A container with _creating_fragment_id set keeps it through deepcopy."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)
        dg._creating_fragment_id = "my_fragment"

        copied = deepcopy(dg)

        assert copied._creating_fragment_id == "my_fragment"

    def test_unset_creating_fragment_id_stays_none_through_deepcopy(self) -> None:
        """A container with no creating fragment stays None through deepcopy."""
        dg = DeltaGenerator(root_container=RootContainer.MAIN)

        copied = deepcopy(dg)

        assert copied._creating_fragment_id is None


class NonFragmentBlockPathWrapperFreeTest(DeltaGeneratorTestCase):
    """Block commands (st.container, st.columns) must not trigger outside-write
    redirection when no fragment is active."""

    def test_container_outside_fragment_has_no_wrappers(self) -> None:
        """The outside-write detection in _block must be a no-op when no
        fragment is running.
        """
        container = st.container()
        container.markdown("inside container")

        storage = self.script_run_ctx.fragment_storage
        wrappers = storage.outside_wrappers_for("")
        assert wrappers == []

        msg = self.get_message_from_queue()
        assert msg.metadata.delta_path == make_delta_path(RootContainer.MAIN, (0,), 0)

    def test_columns_outside_fragment_has_no_wrappers(self) -> None:
        """The outside-write detection in _block must be a no-op for
        st.columns when no fragment is running.
        """
        col1, col2 = st.columns(2)
        col1.markdown("left")
        col2.markdown("right")

        storage = self.script_run_ctx.fragment_storage
        assert storage.outside_wrappers_for("") == []

        left_msg = self.get_message_from_queue(-2)
        right_msg = self.get_message_from_queue(-1)
        # columns() creates a horizontal block at (0,), then column blocks
        # at (0,0) and (0,1) inside it.
        assert left_msg.metadata.delta_path == make_delta_path(
            RootContainer.MAIN, (0, 0), 0
        )
        assert right_msg.metadata.delta_path == make_delta_path(
            RootContainer.MAIN, (0, 1), 0
        )
