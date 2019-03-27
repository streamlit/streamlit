import os
import re
import unittest

import numpy as np
import pandas as pd
import streamlit as st

from mock import call, patch

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

class StreamlitWriteTest(unittest.TestCase):
    """Test st.write.

    Unit tests for https://streamlit.io/secret/docs/api/text.html#streamlit.write

    Because we're going to test st.markdown, st.pyplot, st.altair_chart
    later on, we don't have to test it in st.write In st.write, all we're
    trying to check is that the right st.* method gets called
    """

    def test_string(self):
        """Test st.write with a string."""
        with patch('streamlit.markdown') as p:
            st.write('some string')

            p.assert_called_once()

        with patch('streamlit.markdown') as p:
            st.write('more', 'strings', 'to', 'pass')

            p.assert_called_once_with('more strings to pass')

    def test_dataframe(self):
        """Test st.write with dataframe."""
        data = {
            'DataFrame': pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c']),
            'Series': pd.Series(np.array(['a', 'b', 'c'])),
            'Index': pd.Index(list('abc')),
            'ndarray': np.array(['a', 'b', 'c']),
            'Styler': pd.DataFrame({'a': [1], 'b': [2]}).style.format('{:.2%}'),
        }

        # Make sure we have test cases for all _DATAFRAME_LIKE_TYPES
        self.assertEqual(sorted(data.keys()), sorted(st._DATAFRAME_LIKE_TYPES))

        for df in data.values():
            with patch('streamlit.dataframe') as p:
                st.write(df)

                p.assert_called_once()

    def test_exception_type(self):
        """Test st.write with exception."""
        with patch('streamlit.exception') as p:
            st.write(Exception('some exception'))

            p.assert_called_once()

    def test_help(self):
        """Test st.write with help types."""
        # Test module
        with patch('streamlit.help') as p:
            st.write(np)

            p.assert_called_once()

        # Test function
        with patch('streamlit.help') as p:
            st.write(st.set_option)

            p.assert_called_once()

    @patch('streamlit.util.is_type')
    def test_altair_chart(self, is_type):
        """Test st.write with altair_chart."""
        is_type.return_value = True

        class FakeChart(object):
            pass

        with patch('streamlit.altair_chart') as p:
            st.write(FakeChart())

            p.assert_called_once()

    @patch('streamlit.util.is_type')
    def test_pyplot(self, is_type):
        """Test st.write with matplotlib."""
        is_type.side_effect = [False, True]

        class FakePyplot(object):
            pass

        with patch('streamlit.pyplot') as p:
            st.write(FakePyplot())

            p.assert_called_once()

    def test_dict(self):
        """Test st.write with dict."""
        with patch('streamlit.json') as p:
            st.write({'a': 1, 'b': 2})

            p.assert_called_once()

    def test_default_object(self):
        """Test st.write with default clause ie some object."""
        class SomeObject(object):
            def __str__(self):
                return '1 * 2 - 3 = 4 !'

        with patch('streamlit.markdown') as p:
            st.write(SomeObject())

            p.assert_called_once_with(u'`1 \\* 2 \\- 3 \\= 4 \\!`')

    def test_exception(self):
        """Test st.write that raises an exception."""
        with patch('streamlit.markdown') as m, patch('streamlit.exception') as e:
            m.side_effect = Exception('some exception')
            st.write('some text')

            e.assert_called_once()
