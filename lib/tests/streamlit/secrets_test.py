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

"""st.beta_secrets unit tests."""
import os
import unittest
from unittest.mock import patch, mock_open

from toml import TomlDecodeError

import streamlit as st
from streamlit.secrets import SECRETS_FILE_LOC
from tests.testutil import patch_config_options

MOCK_TOML = """
# Everything in this section will be available as an environment variable
db_username="Jane"
db_password="12345qwerty"

# Sub-sections are not loaded into os.environ
[subsection]
email="eng@streamlit.io"
"""


class SecretsTest(unittest.TestCase):
    def setUp(self) -> None:
        # st.beta_secrets modifies os.environ, so we save it here and
        # restore in tearDown
        self._prev_environ = dict(os.environ)

    def tearDown(self) -> None:
        st.beta_secrets._reset()
        os.environ.clear()
        os.environ.update(self._prev_environ)

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_access_secrets(self, _):
        self.assertEqual(st.beta_secrets["db_username"], "Jane")
        self.assertEqual(st.beta_secrets["subsection"]["email"], "eng@streamlit.io")

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_secrets_file_location(self, mock):
        """Verify that we're looking for secrets.toml in the right place."""
        _ = st.beta_secrets.get("db_username")
        expected_path = os.path.abspath("./.streamlit/secrets.toml")
        mock.assert_called_once_with(expected_path)

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_os_environ(self, _):
        """os.environ gets patched when we load our secrets.toml"""
        # We haven't loaded secrets yet
        self.assertEqual(os.environ.get("db_username"), None)

        # Load secrets
        _ = st.beta_secrets["db_username"]
        self.assertEqual(os.environ["db_username"], "Jane")
        self.assertEqual(os.environ["db_password"], "12345qwerty")

        # Subsections do not get loaded into os.environ
        self.assertEqual(os.environ.get("subsection"), None)

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_mutate_error(self, _):
        """Mutating st.beta_secrets is an error"""
        # Ensure we're loaded
        _ = st.beta_secrets["db_username"]

        with self.assertRaises(TypeError):
            st.beta_secrets["foo"] = "bar"
        with self.assertRaises(AttributeError):
            st.beta_secrets.pop("foo")
        with self.assertRaises(TypeError):
            del st.beta_secrets["db_username"]
        with self.assertRaises(AttributeError):
            st.beta_secrets.clear()

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("streamlit.error")
    def test_missing_toml_error(self, mock_st_error):
        """st.beta_secrets access raises an error, and calls st.error, if
        secrets.toml is missing.
        """
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.side_effect = FileNotFoundError()

            with self.assertRaises(OSError):
                st.beta_secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with(
            f"Secrets file not found. Expected at: {SECRETS_FILE_LOC}"
        )

    @patch_config_options({"server.fileWatcherType": "none"})
    @patch("builtins.open", new_callable=mock_open, read_data="invalid_toml")
    @patch("streamlit.error")
    def test_malformed_toml_error(self, mock_st_error, _):
        """st.beta_secrets access raises an error, and calls st.error, if
        secrets.toml is malformed.
        """
        with self.assertRaises(TomlDecodeError):
            st.beta_secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with("Error parsing Secrets file.")

    @patch("streamlit.secrets.watch_file")
    def test_reload_secrets_when_file_changes(self, mock_watch_file):
        """When secrets.toml is loaded, the secrets file gets watched."""
        with patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML):
            self.assertEqual("Jane", st.beta_secrets["db_username"])
            self.assertEqual("12345qwerty", st.beta_secrets["db_password"])

        # watch_file should have been called on the secrets.toml file
        mock_watch_file.assert_called_once_with(
            SECRETS_FILE_LOC, st.beta_secrets._on_secrets_file_changed
        )

        # Change the text that will be loaded on the next call to `open`
        new_mock_toml = "db_username='Joan'"
        with patch("builtins.open", new_callable=mock_open, read_data=new_mock_toml):
            # Trigger a secrets file reload, and ensure the secrets dict
            # gets repopulated as expected.
            st.beta_secrets._on_secrets_file_changed(SECRETS_FILE_LOC)
            self.assertEqual("Joan", st.beta_secrets["db_username"])
            self.assertIsNone(st.beta_secrets.get("db_password"))
