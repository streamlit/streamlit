# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Config Util Unittest."""
import copy
import textwrap
import unittest

from streamlit import config_util
from streamlit import config

CONFIG_OPTIONS_TEMPLATE = config._config_options_template


def create_config_options(overrides):
    config_options = copy.deepcopy(CONFIG_OPTIONS_TEMPLATE)
    for opt_name, opt_val in overrides.items():
        config_options[opt_name].set_value(opt_val, "test")
    return config_options


class ConfigUtilTest(unittest.TestCase):
    def test_clean(self):
        result = config_util._clean(" clean    this         text  ")
        self.assertEqual("clean this text", result)

    def test_clean_paragraphs(self):
        # from https://www.lipsum.com/
        input = textwrap.dedent(
            """
            Lorem              ipsum dolor sit amet,
            consectetur adipiscing elit.

               Curabitur ac fermentum eros.

            Maecenas                   libero est,
                    ultricies
            eget ligula eget,    """
        )

        truth = [
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            "Curabitur ac fermentum eros.",
            "Maecenas libero est, ultricies eget ligula eget,",
        ]

        result = config_util._clean_paragraphs(input)
        self.assertEqual(truth, result)

    def test_server_option_changed_no_change(self):
        old_options = create_config_options(
            {
                "s3.secretAccessKey": "shhhhhhh",
                "server.address": "localhost",
            }
        )
        new_options = create_config_options(
            {
                "s3.secretAccessKey": "shhhhhhh",
                "server.address": "localhost",
            }
        )
        self.assertEqual(
            config_util.server_option_changed(old_options, new_options), False
        )

    def test_server_option_changed_no_server_change(self):
        old_options = create_config_options(
            {
                "s3.secretAccessKey": "shhhhhhh",
                "server.address": "localhost",
            }
        )
        new_options = create_config_options(
            {
                "s3.secretAccessKey": "SHHHHHHH!!!!!! >:(",
                "server.address": "localhost",
            }
        )
        self.assertEqual(
            config_util.server_option_changed(old_options, new_options), False
        )

    def test_server_option_changed_with_change(self):
        old_options = create_config_options(
            {
                "s3.secretAccessKey": "shhhhhhh",
                "server.address": "localhost",
            }
        )
        new_options = create_config_options(
            {
                "s3.secretAccessKey": "shhhhhhh",
                "server.address": "streamlit.io",
            }
        )
        self.assertEqual(
            config_util.server_option_changed(old_options, new_options), True
        )
