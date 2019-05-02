"""streamlit.credentials unit test.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import unittest

import pytest

from streamlit.credentials import Credentials, generate_code, verify_code


class CredentialsTest(unittest.TestCase):
    """Credentials Unittest class."""

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
