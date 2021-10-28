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

"""st.secrets unit tests."""

import os
import unittest
from unittest.mock import MagicMock, mock_open, patch

from toml import TomlDecodeError

from streamlit.secrets import SECRETS_FILE_LOC, Secrets

MOCK_TOML = """
# Everything in this section will be available as an environment variable
db_username="Jane"
db_password="12345qwerty"

# Sub-sections are not loaded into os.environ
[subsection]
email="eng@streamlit.io"
"""

MOCK_SECRETS_FILE_LOC = "/mock/secrets.toml"


class SecretsTest(unittest.TestCase):
    def setUp(self) -> None:
        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)
        # Run tests on our own Secrets instance to reduce global state
        # mutations.
        self.secrets = Secrets(MOCK_SECRETS_FILE_LOC)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._prev_environ)

    @patch("streamlit.watcher.file_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_access_secrets(self, *mocks):
        self.assertEqual(self.secrets["db_username"], "Jane")
        self.assertEqual(self.secrets["subsection"]["email"], "eng@streamlit.io")
        self.assertEqual(self.secrets["subsection"].email, "eng@streamlit.io")

    @patch("streamlit.watcher.file_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_access_secrets_via_attribute(self, *mocks):
        self.assertEqual(self.secrets.db_username, "Jane")
        self.assertEqual(self.secrets.subsection["email"], "eng@streamlit.io")
        self.assertEqual(self.secrets.subsection.email, "eng@streamlit.io")

    def test_secrets_file_location(self):
        """Verify that we're looking for secrets.toml in the right place."""
        self.assertEqual(os.path.abspath("./.streamlit/secrets.toml"), SECRETS_FILE_LOC)

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_os_environ(self, _):
        """os.environ gets patched when we load our secrets.toml"""
        # We haven't loaded secrets yet
        self.assertEqual(os.environ.get("db_username"), None)

        self.secrets.load_if_toml_exists()
        self.assertEqual(os.environ["db_username"], "Jane")
        self.assertEqual(os.environ["db_password"], "12345qwerty")

        # Subsections do not get loaded into os.environ
        self.assertEqual(os.environ.get("subsection"), None)

    @patch("streamlit.error")
    def test_missing_toml_error(self, mock_st_error):
        """Secrets access raises an error, and calls st.error, if
        secrets.toml is missing.
        """
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.side_effect = FileNotFoundError()

            with self.assertRaises(OSError):
                self.secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with(
            f"Secrets file not found. Expected at: {MOCK_SECRETS_FILE_LOC}"
        )

    @patch("builtins.open", new_callable=mock_open, read_data="invalid_toml")
    @patch("streamlit.error")
    def test_malformed_toml_error(self, mock_st_error, _):
        """Secrets access raises an error, and calls st.error, if
        secrets.toml is malformed.
        """
        with self.assertRaises(TomlDecodeError):
            self.secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with("Error parsing Secrets file.")

    @patch("streamlit.watcher.file_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_getattr_nonexistent(self, *mocks):
        """Verify that access to missing attribute raises  AttributeError."""
        with self.assertRaises(AttributeError):
            self.secrets.nonexistent_secret

        with self.assertRaises(AttributeError):
            self.secrets.subsection.nonexistent_secret

    @patch("streamlit.watcher.file_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_getitem_nonexistent(self, *mocks):
        """Verify that access to missing key via dict notation raises KeyError."""
        with self.assertRaises(KeyError):
            self.secrets["nonexistent_secret"]

        with self.assertRaises(KeyError):
            self.secrets["subsection"]["nonexistent_secret"]

    @patch("streamlit.watcher.file_watcher.watch_file")
    def test_reload_secrets_when_file_changes(self, mock_watch_file):
        """When secrets.toml is loaded, the secrets file gets watched."""
        with patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML):
            self.assertEqual("Jane", self.secrets["db_username"])
            self.assertEqual("12345qwerty", self.secrets["db_password"])
            self.assertEqual("Jane", os.environ["db_username"])
            self.assertEqual("12345qwerty", os.environ["db_password"])

        # watch_file should have been called on the "secrets.toml" file with
        # the "poll" watcher_type. ("poll" is used here - rather than whatever
        # is set in config - because Streamlit Cloud loads secrets.toml from
        # a virtual filesystem that watchdog is unable to fire events for.)
        mock_watch_file.assert_called_once_with(
            MOCK_SECRETS_FILE_LOC,
            self.secrets._on_secrets_file_changed,
            watcher_type="poll",
        )

        # Mock the `send` method to later verify that it has been called.
        self.secrets._file_change_listener.send = MagicMock()

        # Change the text that will be loaded on the next call to `open`
        new_mock_toml = "db_username='Joan'"
        with patch("builtins.open", new_callable=mock_open, read_data=new_mock_toml):
            # Trigger a secrets file reload, ensure the secrets dict
            # gets repopulated as expected, and ensure that os.environ is
            # also updated properly.
            self.secrets._on_secrets_file_changed(MOCK_SECRETS_FILE_LOC)

            # A change in `secrets.toml` should emit a signal.
            self.secrets._file_change_listener.send.assert_called_once()

            self.assertEqual("Joan", self.secrets["db_username"])
            self.assertIsNone(self.secrets.get("db_password"))
            self.assertEqual("Joan", os.environ["db_username"])
            self.assertIsNone(os.environ.get("db_password"))
