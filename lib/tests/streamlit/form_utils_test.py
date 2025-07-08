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

import unittest

from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import (
    context_dg_stack,
    get_default_dg_stack_value,
)
from streamlit.elements.lib.form_utils import FormData, is_in_form
from streamlit.runtime import Runtime, RuntimeConfig


class FormUtilsTest(unittest.TestCase):
    def tearDown(self) -> None:
        super().tearDown()

        # reset context_dg_stack to clean state for other tests
        # that are executed in the same thread
        context_dg_stack.set(get_default_dg_stack_value())

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        config = RuntimeConfig(
            script_path="",
            command_line=None,
            media_file_storage=None,
            uploaded_file_manager=None,
        )
        # init runtime
        Runtime(config)

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        Runtime._instance = None

    def test_is_in_form_true_when_dg_has_formdata(self):
        dg = DeltaGenerator()
        dg._form_data = FormData("form_id")

        assert is_in_form(dg) is True

    def test_is_in_form_false_when_dg_has_no_formdata(self):
        dg = DeltaGenerator()

        assert is_in_form(dg) is False

    def test_is_in_form_true_when_dg_stack_has_form(self):
        form_dg = DeltaGenerator()
        form_dg._form_data = FormData("form_id")
        dg = DeltaGenerator()
        context_dg_stack.set((form_dg, dg))

        assert is_in_form(dg) is True

    def test_is_in_form_false_when_dg_stack_has_no_form(self):
        form_dg = DeltaGenerator()
        dg = DeltaGenerator()
        context_dg_stack.set((form_dg, dg))

        assert is_in_form(dg) is False

    def test_is_in_form_true_when_dg_has_form_parent(self):
        parent_dg = DeltaGenerator()
        parent_dg._form_data = FormData("form_id")
        dg = DeltaGenerator(parent=parent_dg)

        assert is_in_form(dg) is True

    def test_is_in_form_false_when_dg_has_no_form_parent(self):
        parent_dg = DeltaGenerator()
        dg = DeltaGenerator(parent=parent_dg)

        assert is_in_form(dg) is False
