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

"""streamlit.runtime.credentials unit test."""
import os
import textwrap
import unittest
from pathlib import Path
from unittest.mock import MagicMock, call, mock_open, patch

import pytest
import requests_mock
from testfixtures import tempdir

from streamlit import file_util
from streamlit.runtime.credentials import (
    Credentials,
    _Activation,
    _verify_email,
    email_prompt,
)

PROMPT = "streamlit.runtime.credentials.click.prompt"

MOCK_PATH = "/mock/home/folder/.streamlit/credentials.toml"

mock_get_path = MagicMock(return_value=MOCK_PATH)


class CredentialsClassTest(unittest.TestCase):
    """Credentials Class Unittest class."""

    def setUp(self):
        """Setup."""
        # Credentials._singleton should be None here, but a mis-behaving
        # test may have left it intact.
        Credentials._singleton = None

    def tearDown(self) -> None:
        Credentials._singleton = None

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_constructor(self):
        """Test Credentials constructor."""
        c = Credentials()

        self.assertEqual(c._conf_file, MOCK_PATH)
        self.assertEqual(c.activation, None)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_get_current(self):
        """Test Credentials.get_current."""

        Credentials._singleton = None
        c = Credentials.get_current()

        self.assertEqual(Credentials._singleton, c)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_constructor_runs_twice(self):
        """Test Credentials constructor runs twice."""
        Credentials._singleton = None
        Credentials()
        with pytest.raises(RuntimeError) as e:
            Credentials()
        self.assertEqual(
            str(e.value), "Credentials already initialized. Use .get_current() instead"
        )

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_load(self):
        """Test Credentials.load()."""
        data = textwrap.dedent(
            """
            [general]
            email = "user@domain.com"
        """
        ).strip()
        m = mock_open(read_data=data)
        with patch("streamlit.runtime.credentials.open", m, create=True):
            c = Credentials.get_current()
            c.load()
            self.assertEqual("user@domain.com", c.activation.email)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_load_empty(self):
        """Test Credentials.load() with empty email"""
        data = textwrap.dedent(
            """
            [general]
            email = ""
        """
        ).strip()
        m = mock_open(read_data=data)
        with patch("streamlit.runtime.credentials.open", m, create=True):
            c = Credentials.get_current()
            c.load()
            self.assertEqual("", c.activation.email)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_load_twice(self):
        """Test Credentials.load() called twice."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.runtime.credentials.LOGGER") as p:
            c.load()
            p.error.assert_called_once_with(
                "Credentials already loaded. Not rereading file."
            )

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_load_file_not_found(self):
        """Test Credentials.load() with FileNotFoundError."""
        with patch("streamlit.runtime.credentials.open") as m:
            m.side_effect = FileNotFoundError()
            c = Credentials.get_current()
            c.activation = None
            with pytest.raises(RuntimeError) as e:
                c.load()
            self.assertEqual(
                str(e.value), 'Credentials not found. Please run "streamlit activate".'
            )

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_load_permission_denied(self):
        """Test Credentials.load() with Perission denied."""
        with patch("streamlit.runtime.credentials.open") as m:
            m.side_effect = PermissionError(
                "[Errno 13] Permission denied: ~/.streamlit/credentials.toml"
            )
            c = Credentials.get_current()
            c.activation = None
            with pytest.raises(Exception) as e:
                c.load()
            self.assertEqual(
                str(e.value).split(":")[0],
                "\nUnable to load credentials from "
                f"{MOCK_PATH}.\n"
                'Run "streamlit reset" and try again.\n',
            )

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_check_activated_already_loaded(self):
        """Test Credentials.check_activated() already loaded."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.runtime.credentials._exit") as p:
            c._check_activated(auto_resolve=False)
            p.assert_not_called()

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_check_activated_false(self):
        """Test Credentials.check_activated() not activated."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", False)
        with patch("streamlit.runtime.credentials._exit") as p:
            c._check_activated(auto_resolve=False)
            p.assert_called_once_with("Activation email not valid.")

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_check_activated_error(self):
        """Test Credentials.check_activated() has an error."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch.object(c, "load", side_effect=Exception("Some error")), patch(
            "streamlit.runtime.credentials._exit"
        ) as p:
            c._check_activated(auto_resolve=False)
            p.assert_called_once_with("Some error")

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_save(self):
        """Test Credentials.save()."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        truth = textwrap.dedent(
            """
            [general]
            email = "some_email"
        """
        ).lstrip()

        streamlit_root_path = os.path.join(
            "/mock/home/folder", file_util.CONFIG_FOLDER_NAME
        )

        # patch streamlit.*.os.makedirs instead of os.makedirs for py35 compat
        with patch(
            "streamlit.runtime.credentials.open", mock_open(), create=True
        ) as open, patch("streamlit.runtime.credentials.os.makedirs") as make_dirs:
            c.save()

            make_dirs.assert_called_once_with(streamlit_root_path, exist_ok=True)
            open.return_value.write.assert_called_once_with(truth)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_activate_already_activated(self):
        """Test Credentials.activate() already activated."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.runtime.credentials.LOGGER") as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(p.error.call_args_list[1], call("Already activated"))

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_activate_already_activated_not_valid(self):
        """Test Credentials.activate() already activated but not valid."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", False)
        with patch("streamlit.runtime.credentials.LOGGER") as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(
                str(p.error.call_args_list[1])[0:27], "call('Activation not valid."
            )

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_activate(self):
        """Test Credentials.activate()"""
        c = Credentials.get_current()
        c.activation = None

        with patch.object(
            c, "load", side_effect=RuntimeError("Some error")
        ), patch.object(c, "save") as patched_save, patch(PROMPT) as patched_prompt:
            patched_prompt.side_effect = ["user@domain.com"]
            c.activate()
            patched_save.assert_called_once()

            self.assertEqual(c.activation.email, "user@domain.com")
            self.assertEqual(c.activation.is_valid, True)

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_reset(self):
        """Test Credentials.reset()."""
        c = Credentials.get_current()

        with patch("streamlit.runtime.credentials.os.remove") as p:
            Credentials.reset()
            p.assert_called_once_with(MOCK_PATH)

        self.assertEqual(c, Credentials.get_current())

    @patch(
        "streamlit.runtime.credentials.file_util.get_streamlit_file_path", mock_get_path
    )
    def test_Credentials_reset_error(self):
        """Test Credentials.reset() with error."""
        with patch(
            "streamlit.runtime.credentials.os.remove", side_effect=OSError("some error")
        ), patch("streamlit.runtime.credentials.LOGGER") as p:
            Credentials.reset()
            p.error.assert_called_once_with(
                "Error removing credentials file: some error"
            )

    @tempdir()
    def test_email_send(self, temp_dir):
        """Test that saving a new Credential sends an email"""

        with requests_mock.mock() as m:
            m.post("https://api.segment.io/v1/t", status_code=200)
            creds: Credentials = Credentials.get_current()  # type: ignore
            creds._conf_file = str(Path(temp_dir.path) / "config.toml")
            creds.activation = _verify_email("email@test.com")
            creds.save()
            last_request = m.request_history[-1]
            assert last_request.method == "POST"
            assert last_request.url == "https://api.segment.io/v1/t"
            assert '"userId": "email@test.com"' in last_request.text

    @tempdir()
    def test_email_not_send(self, temp_dir):
        """
        Test that saving a new Credential does not send an email if the email is invalid
        """

        with requests_mock.mock() as m:
            m.post("https://api.segment.io/v1/t", status_code=200)
            creds: Credentials = Credentials.get_current()  # type: ignore
            creds._conf_file = str(Path(temp_dir.path) / "config.toml")
            creds.activation = _verify_email("some_email")
            creds.save()
            assert len(m.request_history) == 0

    @tempdir()
    def test_email_send_exception_handling(self, temp_dir):
        """
        Test that saving a new Credential catches and logs failures from the segment
        endpoint
        """
        with requests_mock.mock() as m:
            m.post("https://api.segment.io/v1/t", status_code=403)
            creds: Credentials = Credentials.get_current()  # type: ignore
            creds._conf_file = str(Path(temp_dir.path) / "config.toml")
            creds.activation = _verify_email("email@test.com")
            with self.assertLogs(
                "streamlit.runtime.credentials", level="ERROR"
            ) as mock_logger:
                creds.save()
                assert len(mock_logger.output) == 1
                assert "Error saving email: 403" in mock_logger.output[0]


class CredentialsModulesTest(unittest.TestCase):
    """Credentials Module Unittest class."""

    def test_verify_email(self):
        """Test _verify_email."""
        self.assertTrue(_verify_email("user@domain.com").is_valid)
        self.assertTrue(_verify_email("").is_valid)
        self.assertFalse(_verify_email("missing_at_sign").is_valid)

    def test_show_emojis(self):
        self.assertIn("👋", email_prompt())

    @patch("streamlit.runtime.credentials.env_util.IS_WINDOWS", new=True)
    def test_show_emojis_windows(self):
        self.assertNotIn("👋", email_prompt())
