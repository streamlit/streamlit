import json
import os
import re
import time
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

    def test_st_altair_chart(self):
        """Test st.altair_chart."""
        import altair as alt

        df = pd.DataFrame(np.random.randn(3, 3), columns=['a', 'b', 'c'])

        c = (alt.Chart(df)
            .mark_circle()
            .encode(x='a', y='b', size='c', color='c')
            .interactive())
        dg = st.altair_chart(c)

        el = get_last_delta_element(dg)
        spec = json.loads(el.vega_lite_chart.spec)

        # Checking vega lite is a lot of work so rather than doing that, we
        # just checked to see if the spec data name matches the dataset.
        self.assertEqual(
            spec.get('data').get('name'),
            el.vega_lite_chart.datasets[0].name)

    def test_st_area_chart(self):
        """Test st.area_chart."""
        pass

    def test_st_audio(self):
        """Test st.audio."""
        pass

    def test_st_balloons(self):
        """Test st.balloons."""
        pass

    def test_st_bar_chart(self):
        """Test st.bar_chart."""
        pass

    def test_st_code(self):
        """Test st.code."""
        pass

    def test_st_dataframe(self):
        """Test st.dataframe."""
        pass

    def test_st_deck_gl_chart(self):
        """Test st.deck_gl_chart."""
        pass

    def test_st_empty(self):
        """Test st.empty."""
        pass

    def test_st_error(self):
        """Test st.error."""
        pass

    def test_st_exception(self):
        """Test st.exception."""
        pass

    def test_st_header(self):
        """Test st.header."""
        pass

    def test_st_help(self):
        """Test st.help."""
        pass

    def test_st_image(self):
        """Test st.image."""
        pass

    def test_st_info(self):
        """Test st.info."""
        pass

    def test_st_json(self):
        """Test st.json."""
        pass

    def test_st_line_chart(self):
        """Test st.line_chart."""
        pass

    def test_st_map(self):
        """Test st.map."""
        pass

    def test_st_markdown(self):
        """Test st.markdown."""
        pass

    def test_st_progress(self):
        """Test st.progress."""
        pass

    def test_st_pyplot(self):
        """Test st.pyplot."""
        pass

    def test_st_subheader(self):
        """Test st.subheader."""
        pass

    def test_st_success(self):
        """Test st.success."""
        pass

    def test_st_table(self):
        """Test st.table."""
        pass

    def test_st_text(self):
        """Test st.text."""
        pass

    def test_st_title(self):
        """Test st.title."""
        dg = st.title('some title')

        el = get_last_delta_element(dg)
        self.assertEqual(el.text.body, '# some title')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_vega_lite_chart(self):
        """Test st.vega_lite_chart."""
        pass

    def test_st_video(self):
        """Test st.video."""
        pass

    def test_st_warning(self):
        """Test st.warning."""
        pass

    def test_st_native_chart(self):
        """Test st._native_chart."""
        pass

    def test_st_text_exception(self):
        """Test st._text_exception."""
        pass


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

    def test_spinner(self):
        """Test st.spinner."""
        # TODO(armando): Test that the message is actually passed to
        # message.warning
        with patch('streamlit.empty') as e:
            with st.spinner('some message'):
                time.sleep(0.15)
            e.assert_called_once_with()
