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

"""st.secrets unit tests."""

from __future__ import annotations

import os
import tempfile
import unittest
from collections.abc import Mapping as MappingABC
from collections.abc import MutableMapping as MutableMappingABC
from typing import Mapping, MutableMapping
from unittest.mock import MagicMock, mock_open, patch

from parameterized import parameterized
from toml import TomlDecodeError

from streamlit.runtime.secrets import (
    AttrDict,
    SecretErrorMessages,
    Secrets,
)
from tests import testutil
from tests.exception_capturing_thread import call_on_threads

MOCK_TOML = """
# Everything in this section will be available as an environment variable
db_username="Jane"
db_password="12345qwerty"

# Sub-sections are not loaded into os.environ
[subsection]
email="eng@streamlit.io"
"""

MOCK_SECRETS_FILE_LOC = "/mock/secrets.toml"


class TestSecretErrorMessages(unittest.TestCase):
    def test_changing_message(self):
        messages = SecretErrorMessages()
        self.assertEqual(
            messages.get_missing_attr_message("attr"),
            'st.secrets has no attribute "attr". Did you forget to add it to secrets.toml, mount it to secret directory, or the app settings on Streamlit Cloud? More info: https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management',
        )

        messages.set_missing_attr_message(
            lambda attr: "Missing attribute message",
        )

        self.assertEqual(
            messages.get_missing_attr_message([""]),
            "Missing attribute message",
        )


class SecretsTest(unittest.TestCase):
    """Tests for st.secrets with a single secrets.toml file"""

    def setUp(self) -> None:
        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)
        # Run tests on our own Secrets instance to reduce global state
        # mutations.
        self.secrets = Secrets()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._prev_environ)

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_access_secrets(self, *mocks):
        self.assertEqual(self.secrets["db_username"], "Jane")
        self.assertEqual(self.secrets["subsection"]["email"], "eng@streamlit.io")
        self.assertEqual(self.secrets["subsection"].email, "eng@streamlit.io")

    @parameterized.expand(
        [
            [
                False,
                "Secrets",
            ],
            [
                True,
                (
                    "{'db_username': 'Jane', 'db_password': '12345qwerty', "
                    "'subsection': {'email': 'eng@streamlit.io'}}"
                ),
            ],
        ]
    )
    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_repr_secrets(self, runtime_exists, secrets_repr, *mocks):
        with patch("streamlit.runtime.exists", return_value=runtime_exists):
            self.assertEqual(repr(self.secrets), secrets_repr)

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_access_secrets_via_attribute(self, *mocks):
        self.assertEqual(self.secrets.db_username, "Jane")
        self.assertEqual(self.secrets.subsection["email"], "eng@streamlit.io")
        self.assertEqual(self.secrets.subsection.email, "eng@streamlit.io")

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

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_load_if_toml_exists_returns_true_if_parse_succeeds(self, _):
        self.assertTrue(self.secrets.load_if_toml_exists())

    def test_load_if_toml_exists_returns_false_if_parse_fails(self):
        self.assertFalse(self.secrets.load_if_toml_exists())

    @patch("streamlit.error")
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_missing_toml_error(self, _, mock_st_error):
        """Secrets access raises an error, and calls st.error, if
        secrets.toml is missing.
        """
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.side_effect = FileNotFoundError()

            with self.assertRaises(FileNotFoundError):
                self.secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with(
            f"No secrets found. Valid paths for a secrets.toml file or secret directories are: {MOCK_SECRETS_FILE_LOC}"
        )

    @patch("streamlit.error")
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_missing_toml_error_with_suppressed_error(self, _, mock_st_error):
        """Secrets access raises an error, and does not calls st.error, if
        secrets.toml is missing because printing errors have been suppressed.
        """

        self.secrets.set_suppress_print_error_on_exception(True)

        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.side_effect = FileNotFoundError()

            with self.assertRaises(FileNotFoundError):
                self.secrets.get("no_such_secret", None)

        mock_st_error.assert_not_called()

    @patch("builtins.open", new_callable=mock_open, read_data="invalid_toml")
    @patch("streamlit.error")
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_malformed_toml_error(self, mock_get_option, mock_st_error, _):
        """Secrets access raises an error, and calls st.error, if
        secrets.toml is malformed.
        """
        with self.assertRaises(TomlDecodeError):
            self.secrets.get("no_such_secret", None)

        mock_st_error.assert_called_once_with(
            "Error parsing secrets file at /mock/secrets.toml: Key name found without value. Reached end of file. (line 1 column 13 char 12)"
        )

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_getattr_nonexistent(self, *mocks):
        """Verify that access to missing attribute raises  AttributeError."""
        with self.assertRaises(AttributeError):
            self.secrets.nonexistent_secret  # noqa: B018

        with self.assertRaises(AttributeError):
            self.secrets.subsection.nonexistent_secret  # noqa: B018

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_getattr_raises_exception_on_attr_dict(self, *mocks):
        """Verify that assignment to nested secrets raises TypeError."""
        with self.assertRaises(TypeError):
            self.secrets.subsection["new_secret"] = "123"

        with self.assertRaises(TypeError):
            self.secrets.subsection.new_secret = "123"

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_getitem_nonexistent(self, *mocks):
        """Verify that access to missing key via dict notation raises KeyError."""
        with self.assertRaises(KeyError):
            self.secrets["nonexistent_secret"]

        with self.assertRaises(KeyError):
            self.secrets["subsection"]["nonexistent_secret"]

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_reload_secrets_when_file_changes(self, mock_get_option, mock_watch_file):
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
            self.secrets._on_secrets_changed,
            watcher_type="poll",
        )

        # Mock the `send` method to later verify that it has been called.
        self.secrets.file_change_listener.send = MagicMock()

        # Change the text that will be loaded on the next call to `open`
        new_mock_toml = "db_username='Joan'"
        with patch("builtins.open", new_callable=mock_open, read_data=new_mock_toml):
            # Trigger a secrets file reload, ensure the secrets dict
            # gets repopulated as expected, and ensure that os.environ is
            # also updated properly.
            self.secrets._on_secrets_changed(MOCK_SECRETS_FILE_LOC)

            # A change in `secrets.toml` should emit a signal.
            self.secrets.file_change_listener.send.assert_called_once()

            self.assertEqual("Joan", self.secrets["db_username"])
            self.assertIsNone(self.secrets.get("db_password"))
            self.assertEqual("Joan", os.environ["db_username"])
            self.assertIsNone(os.environ.get("db_password"))


class MultipleSecretsFilesTest(unittest.TestCase):
    """Tests for st.secrets with multiple secrets.toml files."""

    def setUp(self) -> None:
        self._fd1, self._path1 = tempfile.mkstemp(".toml")
        self._fd2, self._path2 = tempfile.mkstemp(".toml")

        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._prev_environ)

        # close the file descriptors (which is required on windows before removing the file)
        for fd in (self._fd1, self._fd2):
            try:
                os.close(fd)
            except OSError:
                pass

        os.remove(self._path1)
        os.remove(self._path2)

    @patch("streamlit.error")
    def test_no_secrets_files_explodes(self, mock_st_error):
        """Validate that an error is thrown if none of the given secrets.toml files exist."""

        secrets_file_locations = [
            "/mock1/secrets.toml",
            "/mock2/secrets.toml",
        ]
        mock_get_option = testutil.build_mock_config_get_option(
            {"secrets.files": secrets_file_locations}
        )

        with patch("streamlit.config.get_option", new=mock_get_option):
            secrets = Secrets()

            with self.assertRaises(FileNotFoundError):
                secrets.get("no_such_secret", None)

            mock_st_error.assert_called_once_with(
                "No secrets found. Valid paths for a secrets.toml file or secret directories are: /mock1/secrets.toml, /mock2/secrets.toml"
            )

    @patch("streamlit.runtime.secrets._LOGGER")
    def test_only_one_secrets_file_fine(self, patched_logger):
        with os.fdopen(self._fd1, "w") as tmp:
            tmp.write(MOCK_TOML)

        secrets_file_locations = [
            self._path1,
            "/mock2/secrets.toml",
        ]
        mock_get_option = testutil.build_mock_config_get_option(
            {"secrets.files": secrets_file_locations}
        )

        with patch("streamlit.config.get_option", new=mock_get_option):
            secrets = Secrets()

            self.assertEqual(secrets.db_username, "Jane")
            patched_logger.info.assert_not_called()

    @patch("streamlit.runtime.secrets._LOGGER")
    def test_secret_overwriting(self, patched_logger):
        """Test that if both global and project-level secrets.toml files exist, secrets
        from both are present in st.secrets, and secrets from the project-level file
        "win" when secrets have conflicting names.
        """
        with os.fdopen(self._fd1, "w") as tmp:
            tmp.write(MOCK_TOML)

        with os.fdopen(self._fd2, "w") as tmp:
            tmp.write(
                """
db_password="54321dvorak"
hi="I'm new"

[subsection]
email2="eng2@streamlit.io"
"""
            )

        secrets_file_locations = [
            self._path1,
            self._path2,
        ]
        mock_get_option = testutil.build_mock_config_get_option(
            {"secrets.files": secrets_file_locations}
        )

        with patch("streamlit.config.get_option", new=mock_get_option):
            secrets = Secrets()

            # secrets.db_username is only defined in the first secrets.toml file, so it
            # remains unchanged.
            self.assertEqual(secrets.db_username, "Jane")

            # secrets.db_password should be overwritten because it's set to a different
            # value in our second secrets.toml file.
            self.assertEqual(secrets.db_password, "54321dvorak")

            # secrets.hi only appears in our second secrets.toml file.
            self.assertEqual(secrets.hi, "I'm new")

            # Secrets subsections are overwritten entirely rather than being merged.
            self.assertEqual(secrets.subsection, {"email2": "eng2@streamlit.io"})


class SecretsThreadingTests(unittest.TestCase):
    # The number of threads to run our tests on
    NUM_THREADS = 50

    def setUp(self) -> None:
        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)
        self.secrets = Secrets()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._prev_environ)

    @patch("streamlit.watcher.path_watcher.watch_file", MagicMock())
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_access_secrets(self, _):
        """Accessing secrets is thread-safe."""

        def access_secrets(_: int) -> None:
            self.assertEqual(self.secrets["db_username"], "Jane")
            self.assertEqual(self.secrets["subsection"]["email"], "eng@streamlit.io")
            self.assertEqual(self.secrets["subsection"].email, "eng@streamlit.io")

        call_on_threads(access_secrets, num_threads=self.NUM_THREADS)

    @patch("streamlit.watcher.path_watcher.watch_file", MagicMock())
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_reload_secrets(self, _):
        """Re-parsing the secrets file is thread-safe."""

        def reload_secrets(_: int) -> None:
            # Reset secrets, and then access a secret to reparse.
            self.secrets._reset()
            self.assertEqual(self.secrets["db_username"], "Jane")

        call_on_threads(reload_secrets, num_threads=self.NUM_THREADS)


class SecretsDirectoryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_dir_path = self.temp_dir.name
        os.makedirs(os.path.join(self.temp_dir_path, "example_login"))
        with open(
            os.path.join(self.temp_dir_path, "example_login", "username"), "w"
        ) as f:
            f.write("example_username")
        with open(
            os.path.join(self.temp_dir_path, "example_login", "password"), "w"
        ) as f:
            f.write("example_password")
        os.makedirs(os.path.join(self.temp_dir_path, "example_token"))
        with open(os.path.join(self.temp_dir_path, "example_token", "token"), "w") as f:
            f.write("token123")

        self.secrets = Secrets()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    @patch("streamlit.watcher.path_watcher.watch_dir")
    def test_access_secrets(self, mock_watch_dir):
        mock_get_option = testutil.build_mock_config_get_option(
            {"secrets.files": [self.temp_dir_path]}
        )

        with patch("streamlit.config.get_option", new=mock_get_option):
            self.assertEqual(
                self.secrets["example_login"]["username"], "example_username"
            )
            self.assertEqual(
                self.secrets["example_login"]["password"], "example_password"
            )
            self.assertEqual(self.secrets["example_token"], "token123")

            mock_watch_dir.assert_called_once_with(
                self.temp_dir_path,
                self.secrets._on_secrets_changed,
                watcher_type="poll",
            )

    @patch("streamlit.watcher.path_watcher.watch_dir", MagicMock())
    def test_secrets_reload(self):
        with open(
            os.path.join(self.temp_dir_path, "example_login", "password"), "w"
        ) as f:
            f.write("example_password2")

        mock_get_option = testutil.build_mock_config_get_option(
            {"secrets.files": [self.temp_dir_path]}
        )

        with patch("streamlit.config.get_option", new=mock_get_option):
            self.secrets._on_secrets_changed(self.temp_dir_path)
            self.assertEqual(
                self.secrets["example_login"]["username"], "example_username"
            )
            self.assertEqual(
                self.secrets["example_login"]["password"], "example_password2"
            )
            self.assertEqual(self.secrets["example_token"], "token123")


class AttrDictTest(unittest.TestCase):
    def test_attr_dict_is_mapping_but_not_built_in_dict(self):
        """Verify that AttrDict implements Mapping, but not built-in Dict"""
        attr_dict = AttrDict({"x": {"y": "z"}})
        self.assertIsInstance(attr_dict.x, Mapping)
        self.assertIsInstance(attr_dict.x, MappingABC)
        self.assertNotIsInstance(attr_dict.x, MutableMapping)
        self.assertNotIsInstance(attr_dict.x, MutableMappingABC)
        self.assertNotIsInstance(attr_dict.x, dict)

    def test_attr_dict_to_dict(self):
        d = {"x": {"y": "z"}}
        attr_dict = AttrDict(d)

        assert attr_dict.to_dict() == d

        # Also check that mutation on the return value of to_dict() does not
        # touch attr_dict or the original object.
        attr_dict.to_dict()["x"]["y"] = "zed"
        assert attr_dict.x.y == "z"
        assert d["x"]["y"] == "z"
