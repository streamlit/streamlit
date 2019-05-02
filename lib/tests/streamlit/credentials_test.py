"""streamlit.credentials unit test.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import unittest

import pytest

from streamlit.credentials import Credentials


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
