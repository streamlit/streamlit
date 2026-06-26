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

import unittest

import pytest

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import (
    ContextVarWithLazyDefault,
    DeltaGeneratorSingleton,
    context_dg_stack,
    get_default_dg_stack_value,
    get_dg_singleton_instance,
    get_last_dg_added_to_context_stack,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.RootContainer_pb2 import RootContainer


class DeltaGeneratorSingletonsTest(unittest.TestCase):
    def test_get_last_dg_added_to_context_stack(self):
        last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
        assert last_dg_added_to_context_stack is None

        sidebar = st.sidebar
        with sidebar:
            last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
            assert sidebar == last_dg_added_to_context_stack
        last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
        assert sidebar != last_dg_added_to_context_stack

    def test_context_dg_stack(self):
        dg_stack = context_dg_stack.get()
        assert get_default_dg_stack_value() == dg_stack
        assert len(dg_stack) == 1

        new_dg = DeltaGenerator(
            root_container=RootContainer.MAIN,
            parent=get_dg_singleton_instance().main_dg,
        )
        token = context_dg_stack.set((*context_dg_stack.get(), new_dg))

        # get the updated dg_stack for current context
        dg_stack = context_dg_stack.get()
        assert len(dg_stack) == 2

        # reset for the other tests
        context_dg_stack.reset(token)
        dg_stack = context_dg_stack.get()
        assert len(dg_stack) == 1


class DeltaGeneratorSingletonsVariablesAreInitializedTest(unittest.TestCase):
    """dg variables are initialized by Streamlit.__init__.py"""

    def test_main_dg_is_initialized(self):
        assert get_dg_singleton_instance().main_dg is not None

    def test_sidebar_dg_is_initialized(self):
        assert get_dg_singleton_instance().sidebar_dg is not None

    def test_event_dg_is_initialized(self):
        assert get_dg_singleton_instance().event_dg is not None

    def test_bottom_dg_is_initialized(self):
        assert get_dg_singleton_instance().bottom_dg is not None

    def test_create_status_container_is_initialized(self):
        assert get_dg_singleton_instance().status_container_cls is not None

    def test_create_dialog_is_initialized(self):
        assert get_dg_singleton_instance().dialog_container_cls is not None


class BottomContainerProxyTest(unittest.TestCase):
    """Tests for the st.bottom container proxy."""

    def test_bottom_exposes_delta_generator_methods(self):
        """Verify st.bottom exposes write, markdown, text methods."""
        assert hasattr(st.bottom, "write")
        assert hasattr(st.bottom, "markdown")
        assert hasattr(st.bottom, "text")
        assert callable(st.bottom.write)

    def test_bottom_works_as_context_manager(self):
        """Verify st.bottom can be used as a context manager."""
        with st.bottom:
            pass


@pytest.mark.parametrize(
    "use_context_manager",
    [False, True],
    ids=["direct_call", "context_manager"],
)
def test_bottom_raises_exception_inside_sidebar(use_context_manager: bool) -> None:
    """Verify st.bottom raises inside st.sidebar."""
    with st.sidebar:
        with pytest.raises(StreamlitAPIException, match=r"st\.sidebar"):
            if use_context_manager:
                with st.bottom:
                    pass
            else:
                st.bottom.write("test")


def test_bottom_raises_exception_inside_nested_sidebar() -> None:
    """Verify st.bottom raises in nested containers within sidebar."""
    with st.sidebar:
        with st.container():
            with pytest.raises(StreamlitAPIException, match=r"st\.sidebar"):
                st.bottom.markdown("test")


@pytest.mark.parametrize(
    "use_context_manager",
    [False, True],
    ids=["direct_call", "context_manager"],
)
def test_bottom_raises_exception_inside_dialog(use_context_manager: bool) -> None:
    """Verify st.bottom raises inside a dialog."""
    # Dialogs are created via event_dg._dialog(), so they have root_container=EVENT
    # with block_type="dialog". See dialog_decorator.py:83.
    dialog_dg = DeltaGenerator(
        root_container=RootContainer.EVENT,
        parent=get_dg_singleton_instance().event_dg,
        block_type="dialog",
    )
    token = context_dg_stack.set((*context_dg_stack.get(), dialog_dg))
    try:
        with pytest.raises(StreamlitAPIException, match=r"dialog"):
            if use_context_manager:
                with st.bottom:
                    pass
            else:
                st.bottom.write("test")
    finally:
        context_dg_stack.reset(token)


def test_bottom_raises_exception_inside_event_container() -> None:
    """Verify st.bottom raises inside event containers."""
    event_dg = DeltaGenerator(
        root_container=RootContainer.EVENT,
        parent=get_dg_singleton_instance().event_dg,
    )
    token = context_dg_stack.set((*context_dg_stack.get(), event_dg))
    try:
        with pytest.raises(StreamlitAPIException, match=r"event containers"):
            st.bottom.write("test")
    finally:
        context_dg_stack.reset(token)


def test_singleton_instance_raises_when_not_initialized() -> None:
    """``DeltaGeneratorSingleton.instance()`` raises if no instance has been created."""
    saved = DeltaGeneratorSingleton._instance
    DeltaGeneratorSingleton._instance = None
    try:
        with pytest.raises(RuntimeError, match=r"hasn't been created"):
            DeltaGeneratorSingleton.instance()
    finally:
        DeltaGeneratorSingleton._instance = saved


def test_singleton_init_raises_when_already_initialized() -> None:
    """Initializing ``DeltaGeneratorSingleton`` while one exists raises ``RuntimeError``."""
    # The streamlit import path always initializes the singleton, so calling
    # __init__ a second time should fail fast.
    with pytest.raises(RuntimeError, match=r"already exists"):
        DeltaGeneratorSingleton(
            delta_generator_cls=DeltaGenerator,
            status_container_cls=DeltaGenerator,
            dialog_container_cls=DeltaGenerator,
            expander_container_cls=DeltaGenerator,
            tab_container_cls=DeltaGenerator,
            popover_container_cls=DeltaGenerator,
        )


def test_context_var_with_lazy_default_eq_compares_identity() -> None:
    """``ContextVarWithLazyDefault.__eq__`` is identity-based and rejects non-wrappers."""
    var_a: ContextVarWithLazyDefault[int] = ContextVarWithLazyDefault(
        "a", default=lambda: 0
    )
    var_b: ContextVarWithLazyDefault[int] = ContextVarWithLazyDefault(
        "a", default=lambda: 0
    )

    assert var_a != var_b
    assert (var_a == "not a wrapper") is False


def test_context_var_with_lazy_default_is_hashable_and_stable() -> None:
    """``ContextVarWithLazyDefault`` is hashable, returns a stable hash, and can be
    used as a dict key.
    """
    var: ContextVarWithLazyDefault[int] = ContextVarWithLazyDefault(
        "lazy_hash_test", default=lambda: 0
    )

    # Cache the hash to verify stability across calls.
    h1 = hash(var)
    assert hash(var) == h1
    # Usable as a dict key without raising.
    container: dict[ContextVarWithLazyDefault[int], str] = {var: "ok"}
    assert container[var] == "ok"
