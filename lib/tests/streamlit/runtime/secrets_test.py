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

"""st.secrets unit tests."""

# ruff: noqa: SIM112

from __future__ import annotations

import contextlib
import os
import tempfile
import threading
import unittest
from collections.abc import Mapping, MutableMapping
from collections.abc import Mapping as MappingABC
from collections.abc import MutableMapping as MutableMappingABC
from unittest.mock import MagicMock, mock_open, patch

from blinker import Signal
from parameterized import parameterized

import streamlit as st
from streamlit import config
from streamlit.errors import StreamlitSecretNotFoundError
from streamlit.runtime.secrets import (
    AttrDict,
    SecretErrorMessages,
    Secrets,
)
from tests import testutil
from tests.delta_generator_test_case import DeltaGeneratorTestCase
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

    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_missing_toml_error(self, _):
        """Secrets access raises an error if secrets.toml is missing."""
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.side_effect = FileNotFoundError()

            with self.assertRaises(StreamlitSecretNotFoundError):
                self.secrets.get("no_such_secret", None)

    @patch("builtins.open", new_callable=mock_open, read_data="invalid_toml")
    @patch("streamlit.config.get_option", return_value=[MOCK_SECRETS_FILE_LOC])
    def test_malformed_toml_error(self, mock_get_option, _):
        """Secrets access raises an error if secrets.toml is malformed."""
        with self.assertRaises(StreamlitSecretNotFoundError):
            self.secrets.get("no_such_secret", None)

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

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_internal_attribute_assignment_allowed(self, *mocks):
        """Verify that internal attribute assignment is allowed."""
        # Test setting each allowed internal attribute
        self.secrets._secrets = {}
        self.assertEqual(self.secrets._secrets, {})

        # Create and test RLock
        lock = threading.RLock()
        self.secrets._lock = lock
        self.assertEqual(self.secrets._lock, lock)
        # Verify it's actually a lock by trying to acquire it
        self.assertTrue(self.secrets._lock.acquire(blocking=False))
        self.secrets._lock.release()

        self.secrets._file_watchers_installed = True
        self.assertTrue(self.secrets._file_watchers_installed)

        self.secrets._suppress_print_error_on_exception = True
        self.assertTrue(self.secrets._suppress_print_error_on_exception)

        self.secrets.file_change_listener = Signal()
        self.assertIsInstance(self.secrets.file_change_listener, Signal)

        # Test that load_if_toml_exists can be assigned
        original_method = self.secrets.load_if_toml_exists
        self.secrets.load_if_toml_exists = lambda: True
        self.assertNotEqual(self.secrets.load_if_toml_exists, original_method)

    @patch("streamlit.watcher.path_watcher.watch_file")
    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_attribute_assignment_raises_type_error(self, *mocks):
        """Verify that attribute assignment raises TypeError."""
        with self.assertRaises(TypeError) as cm:
            self.secrets.new_secret = "123"
        self.assertEqual(
            str(cm.exception), "Secrets does not support attribute assignment."
        )


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
            with contextlib.suppress(OSError):
                os.close(fd)

        os.remove(self._path1)
        os.remove(self._path2)

    def test_no_secrets_files_explodes(self):
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

            with self.assertRaises(StreamlitSecretNotFoundError):
                secrets.get("no_such_secret", None)

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


class SecretsFallbackTest(DeltaGeneratorTestCase):
    """Test that secrets falls back gracefully in various error scenarios."""

    def setUp(self) -> None:
        super().setUp()
        self._orig_environ = dict(os.environ)
        st.secrets._reset()

        # Keep track of the original config
        self._orig_secrets_files = config.get_option("secrets.files")

        # Define mock paths we'll use
        self.mock_path = "/mock/path/secrets.toml"

    def tearDown(self) -> None:
        super().tearDown()
        os.environ.clear()
        os.environ.update(self._orig_environ)
        st.secrets._reset()

        # Restore the original config
        config._set_option("secrets.files", self._orig_secrets_files, "test")

    def test_nonexistent_file_fallback_no_error(self):
        """Test fallback when no secrets file exists."""
        # Point to a non-existent path
        config._set_option(
            "secrets.files", ["/definitely/not/a/real/path/secrets.toml"], "test"
        )

        # Test the fallback pattern
        self._run_token_fallback_test()

    @patch("os.path.exists", return_value=True)  # Make it think the file exists
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data="""
        # This TOML file has secrets but not the one we're looking for
        db_username = "Jane"
        db_password = "12345qwerty"

        [subsection]
        email = "eng@streamlit.io"
        """,
    )
    def test_missing_key_fallback_no_error(self, mock_open, mock_exists):
        """Test fallback when the secrets file exists but doesn't have the target key."""
        # Point to our mock path
        config._set_option("secrets.files", [self.mock_path], "test")

        # Test the fallback pattern
        self._run_token_fallback_test()

    @patch("os.path.exists", return_value=True)  # Make it think the file exists
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data="This is not valid TOML syntax",
    )
    def test_invalid_toml_fallback_no_error(self, mock_open, mock_exists):
        """Test fallback when the secrets file has invalid TOML syntax."""
        # Point to our mock path
        config._set_option("secrets.files", [self.mock_path], "test")

        # Test the fallback pattern
        self._run_token_fallback_test()

    def _run_token_fallback_test(self):
        """Helper that runs the token fallback pattern and verifies UI behavior."""
        # The key we'll try to access that doesn't exist
        TARGET_KEY = "TOKEN"

        # Run the pattern from the example
        token = None

        try:
            if TARGET_KEY in st.secrets:
                token = st.secrets[TARGET_KEY]
        except StreamlitSecretNotFoundError:
            pass

        if not token:
            token = st.text_input("Pass in your token!", type="password")

        # Check that a text_input was created (this confirms the fallback worked)
        text_input_proto = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(text_input_proto.label, "Pass in your token!")

        # In the protocol buffer, password type is represented by enum value 1
        self.assertEqual(text_input_proto.type, 1)  # 1 corresponds to "password" type

        # Verify no error messages were sent to the UI
        deltas = self.get_all_deltas_from_queue()

        # Check for error messages in a way that's compatible with the Delta structure
        for delta in deltas:
            # Check if this is an error message delta
            if delta.HasField("new_element"):
                element = delta.new_element
                # Check if the element has an exception field
                self.assertFalse(element.HasField("exception"))
                # Also check for markdown elements that might contain error messages
                if element.HasField("markdown"):
                    markdown_text = element.markdown.body
                    self.assertFalse(
                        "Error" in markdown_text or "error" in markdown_text
                    )
