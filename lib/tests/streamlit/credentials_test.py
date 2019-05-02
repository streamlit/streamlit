"""streamlit.credentials unit test.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import textwrap
import unittest

import pytest

from mock import call, mock_open, patch

from streamlit.credentials import Activation, Credentials, generate_code, verify_code


class CredentialsTest(unittest.TestCase):
    """Credentials Unittest class."""

    def setUp(self):
        """Setup."""
        Credentials._singleton = None

    def test_Credentials_constructor(self):
        """Test Credentials constructor."""
        c = Credentials()

        self.assertEqual(c._conf_file,
                         '/does/not/exist/.streamlit/credentials.toml')
        self.assertEqual(c.activation, None)

    def test_Credentials_get_current(self):
        """Test Credentials.get_current."""

        Credentials._singleton = None
        c = Credentials.get_current()

        self.assertEqual(Credentials._singleton, c)

    def test_Credentials_constructor_runs_twice(self):
        """Test Credentials constructor runs twice."""
        Credentials._singleton = None
        Credentials()
        with pytest.raises(RuntimeError) as e:
            Credentials()
        self.assertEqual(
            str(e.value),
            'Credentials already initialized. Use .get_current() instead')

    def test_Credentials_load(self):
        """Test Credentials.load()."""
        data = textwrap.dedent('''
            [general]
            code = "ARzVsqhSB5i"
            email = "user@domain.com"
        ''').strip()
        m = mock_open(read_data=data)
        with patch('streamlit.credentials.open', m, create=True) as m:
            c = Credentials.get_current()
            c.load()
            self.assertEqual(c.activation.email, 'user@domain.com')
            self.assertEqual(c.activation.code, 'ARzVsqhSB5i')

    def test_Credentials_load_twice(self):
        """Test Credentials.load() called twice."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', True)
        with patch('streamlit.credentials.LOGGER') as p:
            c.load()
            p.error.assert_called_once_with(
                'Credentials already loaded. Not rereading file.')

    def test_Credentials_load_file_not_found(self):
        """Test Credentials.load() with FileNotFoundError."""
        with patch('streamlit.credentials.open') as m:
            m.side_effect = FileNotFoundError()
            c = Credentials.get_current()
            c.activation = None
            with pytest.raises(RuntimeError) as e:
                c.load()
            self.assertEqual(
                str(e.value),
                'Credentials file not found. Please run `streamlit activate`')

    def test_Credentials_load_permission_denied(self):
        """Test Credentials.load() with Perission denied."""
        with patch('streamlit.credentials.open') as m:
            m.side_effect = PermissionError(
                '[Errno 13] Permission kdenied: ~/.streamlit/credentials.toml')
            c = Credentials.get_current()
            c.activation = None
            with pytest.raises(Exception) as e:
                c.load()
            self.assertEqual(
                str(e.value).split(':')[0],
                'Unable to load credentials from /does/not/exist/.streamlit/credentials.toml'
            )

    def test_Credentials_check_activated_already_loaded(self):
        """Test Credentials.check_activated() already loaded."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', True)
        with patch('streamlit.credentials._exit') as p:
            c.check_activated()
            p.assert_not_called()

    def test_Credentials_check_activated_false(self):
        """Test Credentials.check_activated() not activated."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', False)
        with patch('streamlit.credentials._exit') as p:
            c.check_activated()
            p.assert_called_once_with('Activation code/email not valid.')

    def test_Credentials_check_activated_error(self):
        """Test Credentials.check_activated() has an error."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', True)
        with patch.object(c, 'load', side_effect=Exception(
                'Some error')), patch('streamlit.credentials._exit') as p:
            c.check_activated()
            p.assert_called_once_with('Some error')

    def test_Credentials_activate_already_activated(self):
        """Test Credentials.activate() already activated."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', True)
        with patch('streamlit.credentials.LOGGER') as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(p.error.call_args_list[1],
                             call('Already activated'))

    def test_Credentials_activate_already_activated_not_valid(self):
        """Test Credentials.activate() already activated but not valid."""
        c = Credentials.get_current()
        c.activation = Activation('some_email', 'some_code', False)
        with patch('streamlit.credentials.LOGGER') as p:
            with pytest.raises(SystemExit):
                c.activate()
            self.assertEqual(p.error.call_count, 2)
            self.assertEqual(
                str(p.error.call_args_list[1])[0:27],
                'call(\'Activation not valid.')

    def test_Credentials_activate(self):
        """Test Credentials.activate()"""
        c = Credentials.get_current()
        c.activation = None
        with patch.object(c, 'load', side_effect=RuntimeError('Some error')):
            c.activate()

    def test_Credentials_reset(self):
        """Test Credentials.reset()."""
        with patch('streamlit.credentials.os.remove') as p:
            Credentials.reset()
            p.assert_called_once_with(
                '/does/not/exist/.streamlit/credentials.toml')

    def test_Credentials_reset_error(self):
        """Test Credentials.reset() with error."""
        with patch('streamlit.credentials.os.remove',
                   side_effect=OSError('some error')), patch(
                       'streamlit.credentials.LOGGER') as p:
            Credentials.reset()
            p.error.assert_called_once_with(
                'Error removing credentials file: some error')


class CredentialsModulesTest(unittest.TestCase):
    """Credentials Module Unittest class."""

    def test_generate_code(self):
        """Test generate_code."""
        code = generate_code('testing', 'user@domain.com')
        self.assertEqual('ARzVsqhSB5i', code)

    def test_verify_code(self):
        """Test generate_code."""
        ret = verify_code('user@domain.com', 'ARzVsqhSB5i')
        self.assertTrue(ret.valid)

    def test_verify_code_wrong_code(self):
        """Test credentials.verify_code with code from another user."""
        ret = verify_code('user@domain.com', 'ARxJtdP43GU')
        self.assertFalse(ret.valid)

    def test_verify_code_bad_code(self):
        """Test credentials.verify_code with invalid base58 code."""
        ret = verify_code('user@domain.com', '****')
        self.assertFalse(ret.valid)
