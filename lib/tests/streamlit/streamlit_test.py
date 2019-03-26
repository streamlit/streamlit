import os
import re
import unittest

import streamlit as st

from streamlit import __version__
from streamlit import protobuf


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


def get_last_delta_element(dg):
    return dg._queue.get_deltas()[-1].new_element


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


class StreamlitAPITest(unittest.TestCase):
    """Test Public Streamlit Public APIs.

    Unit tests for https://streamlit.io/secret/docs/#api
    """

    def test_st_title(self):
        """Test st.title."""
        dg = st.title('some title')

        el = get_last_delta_element(dg)
        self.assertEqual(el.text.body, '# some title')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)
