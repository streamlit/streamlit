import os
import re
import unittest

import streamlit as st

from streamlit import __version__


def get_version():
    """Get version by parsing out setup.py."""
    dirname = os.path.dirname(__file__)
    base_dir = os.path.abspath(os.path.join(dirname, '../..'))
    pattern = re.compile(
        r'(?:.*version=\')(?P<version>.*)(?:\',  # PEP-440$)')
    for line in open(os.path.join(base_dir, 'setup.py')).readlines():
        m = pattern.match(line)
        if m:
            return m.group('version')


class StreamlitTest(unittest.TestCase):
    """Test Streamlit.__init__.py."""

    def test_streamlit_version(self):
        """Test streamlit.__version__."""
        self.assertEqual(__version__, get_version())

    def test_get_option(self):
        """Test streamlit.get_option."""
        # This is set in lib/tests/conftest.py to False
        self.assertEqual(False, st.get_option('browser.gatherUsageStats'))

    def test_set_option(self):
        """Test streamlit.set_option."""
        # This is set in lib/tests/conftest.py to off
        self.assertEqual('off', st.get_option('global.sharingMode'))

        st.set_option('global.sharingMode', 'streamlit-public')
        self.assertEqual(
            'streamlit-public',
            st.get_option('global.sharingMode')
        )
