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

import unittest
from unittest import mock

from parameterized import parameterized

from streamlit.component_template.template_config import prepare_config


class ComponentConfigTest(unittest.TestCase):
    def test_should_use_default_value_in_non_interactive_mode(self):
        template_config = prepare_config(
            {"first_name": "John", "list_option": ["first", "second"]}, False
        )
        self.assertEqual(
            template_config, {"first_name": "John", "list_option": "first"}
        )

    def test_should_render_default_value_in_non_interactive_mode(self):
        template_config = prepare_config(
            {
                "project_name": "Streamlit Component X",
                "package_name": "{{ cookiecutter.project_name.lower().replace(' ', '-') }}",
                "import_name": "{{ cookiecutter.package_name.lower().replace('-', '_') }}",
            },
            False,
        )
        self.assertEqual(
            template_config,
            {
                "import_name": "streamlit_component_x",
                "package_name": "streamlit-component-x",
                "project_name": "Streamlit Component X",
            },
        )

    @parameterized.expand(
        [
            (True,),
            (False,),
        ]
    )
    def test_should_raise_exception_for_invalid_type(self, interactive):
        with self.assertRaisesRegex(
            RuntimeError,
            "Unsupported config type. Config key=dict_option, Config type name=dict",
        ):
            prepare_config({"dict_option": {"key": "value"}}, interactive)

    @parameterized.expand(
        [
            (True,),
            (False,),
        ]
    )
    def test_should_raise_exception_when_list_option_is_empty(self, interactive):
        with self.assertRaisesRegex(
            RuntimeError, "Missing value for template config field: list_option"
        ):
            prepare_config({"list_option": []}, interactive)

    @mock.patch("streamlit.component_template.template_config.click")
    def test_should_ask_for_input_value_using_default_prompt(self, mock_click):
        mock_click.prompt.side_effect = ["Paul", "1"]

        template_config = prepare_config(
            {"first_name": "John", "list_option": ["first", "second"]}, True
        )

        self.assertEqual(
            template_config, {"first_name": "Paul", "list_option": "first"}
        )
        mock_click.prompt.assert_has_calls(
            [
                mock.call("Input first_name", default="John"),
                mock.call(
                    "Input list_option\n1. first\n2. second\nSelect from 1-2",
                    type=mock_click.Choice.return_value,
                    default="1",
                    show_choices=False,
                ),
            ],
            any_order=True,
        )

    @mock.patch("streamlit.component_template.template_config.click")
    def test_should_ask_for_input_value_using_custom_prompt(self, mock_click):
        mock_click.prompt.side_effect = ["Paul", "1"]

        template_config = prepare_config(
            {
                "first_name": "John",
                "animals": ["cat", "camel"],
                "__prompts__": {
                    "first_name": "How's your first name?",
                    "animals": "What is the cutest animal in the world?",
                },
            },
            True,
        )

        self.assertEqual(template_config, {"animals": "cat", "first_name": "Paul"})
        mock_click.prompt.assert_has_calls(
            [
                mock.call("How's your first name?", default="John"),
                mock.call(
                    "What is the cutest animal in the world?\n1. cat\n2. camel\nSelect from 1-2",
                    type=mock_click.Choice.return_value,
                    default="1",
                    show_choices=False,
                ),
            ],
            any_order=True,
        )
