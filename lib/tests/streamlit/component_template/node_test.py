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
from unittest.mock import patch

from packaging import version

from streamlit.component_template.node_version import (
    _get_installed_node_version,
    check_node_requirements,
    is_node_installed,
)


class NodeRequirementsTests(unittest.TestCase):
    @patch("streamlit.component_template.node_version._get_installed_node_version")
    def test_check_node_requirements_below_min_version(
        self, mock_get_installed_node_version
    ):
        # Mock the return values
        mock_get_installed_node_version.return_value = version.Version("12.0.0")

        template_config = {
            "__requirements__": {
                "node": {
                    "min": "14.0.0",
                }
            }
        }

        with self.assertRaises(Exception) as cm:
            check_node_requirements(template_config)

        self.assertEqual(
            str(cm.exception),
            "Node version too old. Current version: 12.0.0. Max supported version: 14.0.0.",
        )

    @patch("streamlit.component_template.node_version._get_installed_node_version")
    def test_check_node_requirements_above_max_version(
        self, mock_get_installed_node_version
    ):
        # Mock the return values
        mock_get_installed_node_version.return_value = version.Version("16.0.0")

        template_config = {
            "__requirements__": {
                "node": {
                    "max": "14.0.0",
                }
            }
        }

        with self.assertRaises(Exception) as cm:
            check_node_requirements(template_config)

        self.assertEqual(
            str(cm.exception),
            "Node version too newer. Current version: 16.0.0. Max supported version: 14.0.0.",
        )

    @patch("streamlit.component_template.node_version._get_installed_node_version")
    def test_check_node_requirements_supported_version(
        self, mock_get_installed_node_version
    ):
        # Mock the return values
        mock_get_installed_node_version.return_value = version.Version("15.0.0")

        template_config = {
            "__requirements__": {
                "node": {
                    "min": "14.0.0",
                    "max": "16.0.0",
                }
            }
        }

        check_node_requirements(template_config)


class NodeVersionTests(unittest.TestCase):
    @patch("subprocess.check_output")
    def test_get_installed_node_version(self, mock_check_output):
        # Mock the output of subprocess.check_output
        mock_check_output.return_value = b"v14.15.1\n"

        expected_version = version.Version("14.15.1")
        result = _get_installed_node_version()

        self.assertEqual(result, expected_version)
        mock_check_output.assert_called_once_with(["node", "--version"])


class NodeInstallationTests(unittest.TestCase):
    def test_node_installed(self):
        # Patch the shutil.which function to return a non-empty string
        with patch("shutil.which", return_value="/path/to/node"):
            self.assertFalse(is_node_installed())

    def test_node_not_installed(self):
        # Patch the shutil.which function to return None
        with patch("shutil.which", return_value=None):
            self.assertTrue(is_node_installed())
