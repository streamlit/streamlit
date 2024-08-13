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

import unittest

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import (
    bottom_dg,
    context_dg_stack,
    create_dialog,
    create_status_container,
    event_dg,
    get_default_dg_stack,
    get_last_dg_added_to_context_stack,
    main_dg,
    sidebar_dg,
)
from streamlit.proto.RootContainer_pb2 import RootContainer


class DeltaGeneratorSingletonsTest(unittest.TestCase):
    def test_get_last_dg_added_to_context_stack(self):
        last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
        self.assertIsNone(last_dg_added_to_context_stack)

        sidebar = st.sidebar
        with sidebar:
            last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
            self.assertEqual(sidebar, last_dg_added_to_context_stack)
        last_dg_added_to_context_stack = get_last_dg_added_to_context_stack()
        self.assertNotEqual(sidebar, last_dg_added_to_context_stack)

    def test_context_dg_stack(self):
        dg_stack = context_dg_stack.get()
        self.assertEqual(get_default_dg_stack(), dg_stack)
        self.assertEqual(len(dg_stack), 1)

        new_dg = DeltaGenerator(root_container=RootContainer.MAIN, parent=main_dg)
        token = context_dg_stack.set(context_dg_stack.get() + (new_dg,))

        # get the updated dg_stack for current context
        dg_stack = context_dg_stack.get()
        self.assertEqual(len(dg_stack), 2)

        # reset for the other tests
        context_dg_stack.reset(token)
        dg_stack = context_dg_stack.get()
        self.assertEqual(len(dg_stack), 1)


class DeltaGeneratorSingletonsVariablesAreInitializedTest(unittest.TestCase):
    """dg variables are initialized by Streamlit.__init__.py"""

    def test_main_dg_is_initialized(self):
        self.assertIsNotNone(main_dg)

    def test_sidebar_dg_is_initialized(self):
        self.assertIsNotNone(sidebar_dg)

    def test_event_dg_is_initialized(self):
        self.assertIsNotNone(event_dg)

    def test_bottom_dg_is_initialized(self):
        self.assertIsNotNone(bottom_dg)

    def test_create_status_container_is_initialized(self):
        self.assertIsNotNone(create_status_container)

    def test_create_dialog_is_initialized(self):
        self.assertIsNotNone(create_dialog)
