# Copyright 2018-2020 Streamlit Inc.
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

"""streamlit.credentials unit test."""
import os
import textwrap
import unittest
from parameterized import parameterized

import pytest
from mock import MagicMock
from mock import call
from mock import mock_open
from mock import patch

from streamlit import file_util
from streamlit import config
from streamlit.credentials import _Activation
from streamlit.credentials import Credentials
from streamlit.credentials import _verify_email

PROMPT = "streamlit.credentials.click.prompt"

mock_get_path = MagicMock(return_value="/mock/home/folder/.streamlit/credentials.toml")


class CredentialsClassTest(unittest.TestCase):
    """Credentials Class Unittest class."""

    def setUp(self):
        """Setup."""
        Credentials._singleton = None

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_constructor(self):
        """Test Credentials constructor."""
        c = Credentials()

        self.assertEqual(c._conf_file, "/mock/home/folder/.streamlit/credentials.toml")
        self.assertEqual(c.activation, None)

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_get_current(self):
        """Test Credentials.get_current."""

        Credentials._singleton = None
        c = Credentials.get_current()

        self.assertEqual(Credentials._singleton, c)

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_constructor_runs_twice(self):
        """Test Credentials constructor runs twice."""
        Credentials._singleton = None
        Credentials()
        with pytest.raises(RuntimeError) as e:
            Credentials()
        self.assertEqual(
            str(e.value), "Credentials already initialized. Use .get_current() instead"
        )

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_load(self):
        """Test Credentials.load()."""
        data = textwrap.dedent(
            """
            [general]
            email = "user@domain.com"
        """
        ).strip()
        m = mock_open(read_data=data)
        with patch("streamlit.credentials.open", m, create=True):
            c = Credentials.get_current()
            c.load()
            self.assertEqual("user@domain.com", c.activation.email)

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_load_empty(self):
        """Test Credentials.load() with empty email"""
        data = textwrap.dedent(
            """
            [general]
            email = ""
        """
        ).strip()
        m = mock_open(read_data=data)
        with patch("streamlit.credentials.open", m, create=True):
            c = Credentials.get_current()
            c.load()
            self.assertEqual("", c.activation.email)

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_load_twice(self):
        """Test Credentials.load() called twice."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.credentials.LOGGER") as p:
            c.load()
            p.error.assert_called_once_with(
                "Credentials already loaded. Not rereading file."
            )

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_load_file_not_found(self):
        """Test Credentials.load() with FileNotFoundError."""
        with patch("streamlit.credentials.open") as m:
            m.side_effect = FileNotFoundError()
            c = Credentials.get_current()
            c.activation = None
            with pytest.raises(RuntimeError) as e:
                c.load()
            self.assertEqual(
                str(e.value), 'Credentials not found. Please run "streamlit activate".'
            )

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_load_permission_denied(self):
        """Test Credentials.load() with Perission denied."""
        with patch("streamlit.credentials.open") as m:
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
                "/mock/home/folder/.streamlit/credentials.toml.\n"
                'Run "streamlit reset" and try again.\n',
            )

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_check_activated_already_loaded(self):
        """Test Credentials.check_activated() already loaded."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.credentials._exit") as p:
            c._check_activated(auto_resolve=False)
            p.assert_not_called()

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_check_activated_false(self):
        """Test Credentials.check_activated() not activated."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", False)
        with patch("streamlit.credentials._exit") as p:
            c._check_activated(auto_resolve=False)
            p.assert_called_once_with("Activation email not valid.")

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_check_activated_error(self):
        """Test Credentials.check_activated() has an error."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch.object(c, "load", side_effect=Exception("Some error")), patch(
            "streamlit.credentials._exit"
        ) as p:
            c._check_activated(auto_resolve=False)
            p.assert_called_once_with("Some error")

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
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
            "streamlit.credentials.open", mock_open(), create=True
        ) as open, patch("streamlit.credentials.os.makedirs") as make_dirs:

            c.save()

            make_dirs.assert_called_once_with(streamlit_root_path, exist_ok=True)
            open.return_value.write.assert_called_once_with(truth)

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_activate_already_activated(self):
        """Test Credentials.activate() already activated."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", True)
        with patch("streamlit.credentials.LOGGER") as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(p.error.call_args_list[1], call("Already activated"))

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_activate_already_activated_not_valid(self):
        """Test Credentials.activate() already activated but not valid."""
        c = Credentials.get_current()
        c.activation = _Activation("some_email", False)
        with patch("streamlit.credentials.LOGGER") as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(
                str(p.error.call_args_list[1])[0:27], "call('Activation not valid."
            )

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
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

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_reset(self):
        """Test Credentials.reset()."""
        c = Credentials.get_current()

        with patch("streamlit.credentials.os.remove") as p:
            Credentials.reset()
            p.assert_called_once_with("/mock/home/folder/.streamlit/credentials.toml")

        self.assertEqual(c, Credentials.get_current())

    @patch("streamlit.credentials.file_util.get_streamlit_file_path", mock_get_path)
    def test_Credentials_reset_error(self):
        """Test Credentials.reset() with error."""
        with patch(
            "streamlit.credentials.os.remove", side_effect=OSError("some error")
        ), patch("streamlit.credentials.LOGGER") as p:

            Credentials.reset()
            p.error.assert_called_once_with(
                "Error removing credentials file: some error"
            )


class CredentialsModulesTest(unittest.TestCase):
    """Credentials Module Unittest class."""

    def test_verify_email(self):
        """Test _verify_email."""
        self.assertTrue(_verify_email("user@domain.com").is_valid)
        self.assertTrue(_verify_email("").is_valid)
        self.assertFalse(_verify_email("missing_at_sign").is_valid)
