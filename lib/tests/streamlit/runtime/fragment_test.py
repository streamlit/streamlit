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

from __future__ import annotations

import unittest
from typing import Callable, Tuple
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import context_dg_stack
from streamlit.errors import (
    FragmentHandledException,
    FragmentStorageKeyError,
    StreamlitFragmentWidgetsNotAllowedOutsideError,
)
from streamlit.runtime.fragment import (
    MemoryFragmentStorage,
    _fragment,
    experimental_fragment,
    fragment,
)
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.exceptions import RerunException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.element_mocks import (
    ELEMENT_PRODUCER,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)


class MemoryFragmentStorageTest(unittest.TestCase):
    """Sanity checks for MemoryFragmentStorage.

    These tests may be a bit excessive given that MemoryFragmentStorage is currently
    just a wrapper around a Python dict, but we include them for completeness.
    """

    def setUp(self):
        self._storage = MemoryFragmentStorage()
        self._storage._fragments["some_key"] = "some_fragment"

    def test_get(self):
        assert self._storage.get("some_key") == "some_fragment"

    def test_get_FragmentStorageKeyError(self):
        with pytest.raises(FragmentStorageKeyError):
            self._storage.get("nonexistent_key")

    def test_set(self):
        self._storage.set("some_key", "new_fragment")
        self._storage.set("some_other_key", "some_other_fragment")

        assert self._storage.get("some_key") == "new_fragment"
        assert self._storage.get("some_other_key") == "some_other_fragment"

    def test_delete(self):
        self._storage.delete("some_key")
        with pytest.raises(FragmentStorageKeyError):
            self._storage.get("nonexistent_key")

    def test_del_FragmentStorageKeyError(self):
        with pytest.raises(FragmentStorageKeyError):
            self._storage.delete("nonexistent_key")

    def test_clear(self):
        self._storage._fragments["some_other_key"] = "some_other_fragment"
        assert len(self._storage._fragments) == 2

        self._storage.clear()
        assert len(self._storage._fragments) == 0

    def test_clear_with_new_fragment_ids(self):
        self._storage._fragments["some_other_key"] = "some_other_fragment"
        assert len(self._storage._fragments) == 2

        self._storage.clear(new_fragment_ids={"some_key"})
        assert len(self._storage._fragments) == 1
        assert self._storage._fragments["some_key"] == "some_fragment"

    def test_contains(self):
        assert self._storage.contains("some_key")
        assert not self._storage.contains("some_other_key")


class FragmentTest(unittest.TestCase):
    def setUp(self):
        self.original_dg_stack = context_dg_stack.get()
        root_container = MagicMock()
        context_dg_stack.set(
            (
                DeltaGenerator(
                    root_container=root_container,
                    cursor=MagicMock(root_container=root_container),
                ),
            )
        )

    def tearDown(self):
        context_dg_stack.set(self.original_dg_stack)

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    def test_wrapped_fragment_calls_original_function(self):
        called = False

        dg_stack_len = len(context_dg_stack.get())

        @fragment
        def my_fragment():
            nonlocal called
            called = True

            # Verify that a new container gets created for the contents of this
            # fragment to be written to.
            assert len(context_dg_stack.get()) == dg_stack_len + 1

        my_fragment()
        assert called

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_current_fragment_id_on_success(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            assert ctx.current_fragment_id != "my_fragment_id"

        ctx.current_fragment_id = "my_fragment_id"
        my_fragment()
        assert ctx.current_fragment_id == "my_fragment_id"

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_current_fragment_id_on_exception(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        exception_message = "oh no"

        @fragment
        def my_exploding_fragment():
            assert ctx.current_fragment_id != "my_fragment_id"
            raise Exception(exception_message)

        ctx.current_fragment_id = "my_fragment_id"
        with pytest.raises(Exception) as ex:
            my_exploding_fragment()

        assert str(ex.value) == exception_message

        assert ctx.current_fragment_id == "my_fragment_id"

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_wrapped_fragment_not_saved_in_FragmentStorage(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        ctx.fragment_storage.set = MagicMock(wraps=ctx.fragment_storage.set)

        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            pass

        # Call the fragment-decorated function twice, and verify that we only save the
        # fragment a single time.
        my_fragment()
        my_fragment()
        assert ctx.fragment_storage.set.call_count == 2

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_dg_stack_and_cursor_to_snapshots_if_fragment_ids_this_run(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = ["my_fragment_id"]
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        dg = MagicMock()
        dg.my_random_field = 7
        context_dg_stack.set((dg,))
        ctx.cursors = MagicMock()
        ctx.cursors.my_other_random_field = 8

        call_count = 0

        @fragment
        def my_fragment():
            nonlocal call_count

            assert ctx.current_fragment_id is not None

            curr_dg_stack = context_dg_stack.get()
            # Verify that mutations made in previous runs of my_fragment aren't
            # persisted.
            assert curr_dg_stack[0].my_random_field == 7
            assert ctx.cursors.my_other_random_field == 8

            # Attempt to mutate cursors and the dg_stack.
            curr_dg_stack[0].my_random_field += 1
            ctx.cursors.my_other_random_field += 1

            call_count += 1

        my_fragment()

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = list(ctx.fragment_storage._fragments.values())[0]

        # Verify that we can't mutate our dg_stack from within my_fragment. If a
        # mutation is persisted between fragment runs, the assert on `my_random_field`
        # will fail.
        saved_fragment()
        saved_fragment()

        # Called once when calling my_fragment and three times calling the saved
        # fragment.
        assert call_count == 3

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_current_fragment_id_in_full_script_runs(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = []
        ctx.new_fragment_ids = set()
        ctx.current_fragment_id = None
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        dg = MagicMock()
        dg.my_random_field = 0
        context_dg_stack.set((dg,))

        @fragment
        def my_fragment():
            assert ctx.current_fragment_id is not None

            curr_dg_stack = context_dg_stack.get()
            curr_dg_stack[0].my_random_field += 1

        assert len(ctx.new_fragment_ids) == 0
        my_fragment()

        # Verify that `my_fragment`'s id was added to the `new_fragment_id`s set.
        assert len(ctx.new_fragment_ids) == 1

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = list(ctx.fragment_storage._fragments.values())[0]
        saved_fragment()
        saved_fragment()

        # This time, dg should have been mutated since we don't restore it from a
        # snapshot in a regular script run.
        assert dg.my_random_field == 3
        assert ctx.current_fragment_id is None

    @parameterized.expand(
        [
            (None, None),
            (3, 3.0),
            (5.0, 5.0),
            ("1 minute", 60.0),
        ]
    )
    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_run_every_arg_handling(
        self,
        run_every,
        expected_interval,
        patched_get_script_run_ctx,
    ):
        called = False

        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        @fragment(run_every=run_every)
        def my_fragment():
            nonlocal called

            called = True

        my_fragment()

        assert called

        if expected_interval is not None:
            [(args, _)] = ctx.enqueue.call_args_list
            msg = args[0]
            assert msg.auto_rerun.interval == expected_interval
            assert (
                isinstance(msg.auto_rerun.fragment_id, str)
                and msg.auto_rerun.fragment_id != ""
            )
        else:
            ctx.enqueue.assert_not_called()

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_active_script_hash_if_needed(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        ctx.pages_manager = PagesManager("")
        ctx.pages_manager.set_pages({})  # Migrate to MPAv2
        ctx.pages_manager.set_active_script_hash("some_hash")
        ctx.active_script_hash = ctx.pages_manager.get_active_script_hash()
        patched_get_script_run_ctx.return_value = ctx

        with patch.object(
            ctx.pages_manager, "run_with_active_hash"
        ) as patched_run_with_active_hash:

            @fragment
            def my_fragment():
                pass

            my_fragment()

            # Reach inside our MemoryFragmentStorage internals to pull out our saved
            # fragment.
            saved_fragment = list(ctx.fragment_storage._fragments.values())[0]

            # set the hash to something different for subsequent calls
            ctx.pages_manager.set_active_script_hash("a_different_hash")
            ctx.active_script_hash = ctx.pages_manager.get_active_script_hash()

            # Verify subsequent calls will run with the original active script hash
            saved_fragment()
            patched_run_with_active_hash.assert_called_with("some_hash")
            patched_run_with_active_hash.reset_mock()
            saved_fragment()
            patched_run_with_active_hash.assert_called_with("some_hash")

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_code_returns_value(
        self,
        patched_get_script_run_ctx,
    ):
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            return 42

        assert my_fragment() == 42

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_raises_rerun_exception_in_main_execution_context(
        self, patched_get_script_run_ctx
    ):
        """Ensure that a rerun exception raised in a fragment when executed in the main
        execution context (meaning first execution in the app flow, not via a
        fragment-only rerun) is raised in the main execution context.
        """
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            raise RerunException(rerun_data=None)

        with pytest.raises(RerunException):
            my_fragment()

    @parameterized.expand([(ValueError), (TypeError), (RuntimeError), (Exception)])
    def test_fragment_raises_FragmentHandledException_in_full_app_run(
        self, exception_type: type[Exception]
    ):
        """Ensures that during full-app run the exceptions are raised."""
        with patch(
            "streamlit.runtime.fragment.get_script_run_ctx"
        ) as patched_get_script_run_ctx:
            ctx = MagicMock()
            ctx.fragment_storage = MemoryFragmentStorage()
            patched_get_script_run_ctx.return_value = ctx

            @fragment
            def my_fragment():
                raise exception_type()

            with pytest.raises(FragmentHandledException):
                my_fragment()

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_additional_hash_info_param_used_for_generating_id(
        self, patched_get_script_run_ctx
    ):
        """Test that the internal function can be called with an
        additional hash info parameter."""
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        def my_function():
            return ctx.current_fragment_id

        fragment_id1 = _fragment(my_function)()
        fragment_id2 = _fragment(my_function, additional_hash_info="some_hash_info")()
        assert fragment_id1 != fragment_id2

        # countercheck
        fragment_id2 = _fragment(my_function, additional_hash_info="")()
        assert fragment_id1 == fragment_id2

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    @patch("streamlit.runtime.fragment.show_deprecation_warning")
    def test_calling_experimental_fragment_shows_warning(
        self, patched_show_deprecation_warning
    ):
        @experimental_fragment
        def my_fragment():
            pass

        my_fragment()

        patched_show_deprecation_warning.assert_called_once()

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    @patch("streamlit.runtime.fragment.show_deprecation_warning")
    def test_calling_fragment_does_not_show_warning(
        self, patched_show_deprecation_warning
    ):
        @fragment
        def my_fragment():
            pass

        my_fragment()

        patched_show_deprecation_warning.assert_not_called()


# TESTS FOR WRITING TO CONTAINERS OUTSIDE AND INSIDE OF FRAGMENT

APP_FUNCTION = Callable[[ELEMENT_PRODUCER], None]


def _run_fragment_writes_to_outside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container outside of fragment."""

    outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app2(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment writing from nested container."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container:
            with st.container():
                element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app3(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment writing from nested container."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        with st.container():
            # this is forbidden
            with outside_container:
                element_producer()

    _some_method()


def _run_fragment_writes_to_inside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container inside of fragment."""

    @fragment
    def _some_method():
        inside_container = st.container()

        st.write("Hello")
        with inside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_inside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container inside of fragment."""

    @fragment
    def _some_method():
        inside_container = st.container()

        st.write("Hello")
        with st.container():
            with inside_container:
                element_producer()

    _some_method()


outside_container_writing_apps: list[APP_FUNCTION] = [
    _run_fragment_writes_to_outside_container_app,
    _run_fragment_writes_to_nested_outside_container_app,
    _run_fragment_writes_to_nested_outside_container_app2,
    _run_fragment_writes_to_nested_outside_container_app3,
]

inside_container_writing_apps: list[APP_FUNCTION] = [
    _run_fragment_writes_to_inside_container_app,
    _run_fragment_writes_to_nested_inside_container_app,
]

TEST_TUPLE = Tuple[str, APP_FUNCTION, ELEMENT_PRODUCER]


def get_test_tuples(
    app_functions: list[APP_FUNCTION],
    elements: list[tuple[str, Callable[[], DeltaGenerator]]],
) -> list[TEST_TUPLE]:
    """Create a tuple of (name, app-to-run, element-producer), so that each passed app runs with every passed element.

    Parameters
    ----------
    app_functions : list[APP_FUNCTION]
        Functions that run Streamlit elements like they are an app.
    elements : list[tuple[str, Callable[[], DeltaGenerator]]]
        Tuples of (name, element-producer) where name describes the produced element and element_producer is a function that executes a Streamlit element.
    """
    return [
        (_element_producer[0], _app, _element_producer[1])
        for _app in app_functions
        for _element_producer in elements
    ]


class FragmentCannotWriteToOutsidePathTest(DeltaGeneratorTestCase):
    @parameterized.expand(
        get_test_tuples(outside_container_writing_apps, WIDGET_ELEMENTS)
    )
    def test_write_element_outside_container_raises_exception_for_widgets(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        _element_producer: ELEMENT_PRODUCER,
    ):
        with pytest.raises(FragmentHandledException) as ex:
            _app(_element_producer)

        inner_exception = ex.value.__cause__ or ex.value.__context__

        assert isinstance(
            inner_exception, StreamlitFragmentWidgetsNotAllowedOutsideError
        )

    @parameterized.expand(
        get_test_tuples(outside_container_writing_apps, NON_WIDGET_ELEMENTS)
    )
    def test_write_element_outside_container_succeeds_for_nonwidgets(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        element_producer: ELEMENT_PRODUCER,
    ):
        _app(element_producer)

    @parameterized.expand(
        get_test_tuples(
            inside_container_writing_apps, WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS
        )
    )
    def test_write_elements_inside_container_succeeds_for_all(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        element_producer: ELEMENT_PRODUCER,
    ):
        _app(element_producer)
