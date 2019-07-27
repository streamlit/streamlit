"""Streamlit Unittest."""
__copyright__ = 'Copyright 2019 Streamlit Inc. All rights reserved.'
from mock import call, patch, Mock
import json
import os
import re
import sys
import textwrap
import time
import unittest

from google.protobuf import json_format
import PIL.Image as Image
import numpy as np
import pandas as pd

from streamlit import __version__
from streamlit import protobuf
from streamlit.elements.Chart import Chart
from tests import testutil
import streamlit as st


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


class StreamlitAPITest(testutil.DeltaGeneratorTestCase):
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
        st.altair_chart(c)

        el = self.get_delta_from_queue().new_element
        spec = json.loads(el.vega_lite_chart.spec)

        # Checking Vega-Lite is a lot of work so rather than doing that, we
        # just checked to see if the spec data name matches the dataset.
        self.assertEqual(
            spec.get('data').get('name'),
            el.vega_lite_chart.datasets[0].name)

    def test_st_area_chart(self):
        """Test st.area_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=['a', 'b', 'c'])
        dg = st.area_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.chart.type, 'AreaChart')
        self.assertEqual(el.chart.width, 640)
        self.assertEqual(el.chart.height, 480)
        self.assertEqual(
            el.chart.data.columns.plain_index.data.strings.data,
            ['a', 'b', 'c']
        )
        data = json.loads(json_format.MessageToJson(el.chart.data.data))
        result = [x['int64s']['data'][0] for x in data['cols']]
        self.assertEqual(result, ['10', '20', '30'])

    def test_st_audio(self):
        """Test st.audio."""
        # TODO(armando): generate real audio data
        # For now it doesnt matter cause browser is the one that uses it.
        fake_audio_data = '\x11\x22\x33\x44\x55\x66'.encode('utf-8')

        dg = st.audio(fake_audio_data)

        el = self.get_delta_from_queue().new_element
        # Manually base64 encoded payload above via
        # base64.b64encode(bytes('\x11\x22\x33\x44\x55\x66'.encode('utf-8')))
        self.assertEqual(el.audio.data, 'ESIzRFVm')
        self.assertEqual(el.audio.format, 'audio/wav')

    def test_st_balloons(self):
        """Test st.balloons."""
        with patch('random.randrange') as p:
            p.return_value = 0xDEADBEEF
            dg = st.balloons()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.balloons.type, protobuf.Balloons.DEFAULT)
        self.assertEqual(el.balloons.execution_id, 0xDEADBEEF)

    def test_st_bar_chart(self):
        """Test st.bar_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=['a', 'b', 'c'])
        dg = st.bar_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.chart.type, 'BarChart')
        self.assertEqual(el.chart.width, 640)
        self.assertEqual(el.chart.height, 480)
        self.assertEqual(
            el.chart.data.columns.plain_index.data.strings.data,
            ['a', 'b', 'c']
        )
        data = json.loads(json_format.MessageToJson(el.chart.data.data))
        result = [x['int64s']['data'][0] for x in data['cols']]
        self.assertEqual(result, ['10', '20', '30'])

    def test_st_code(self):
        """Test st.code."""
        dg = st.code('print(\'My string = %d\' % my_value)',
                     language='python')
        expected = textwrap.dedent('''
            ```python
            print('My string = %d' % my_value)
            ```
        ''')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, expected.strip())
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_dataframe(self):
        """Test st.dataframe."""
        df = pd.DataFrame({
            'one': [1, 2],
            'two': [11, 22],
        })
        dg = st.dataframe(df)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.data_frame.data.cols[0].int64s.data, [1, 2])
        self.assertEqual(el.data_frame.columns.plain_index.data.strings.data, ['one', 'two'])

    def test_st_deck_gl_chart(self):
        """Test st.deck_gl_chart."""
        df = pd.DataFrame({
            'lat': [1, 2, 3, 4],
            'lon': [11, 22, 33, 44],
        })
        dg = st.deck_gl_chart(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.deck_gl_chart.HasField('data'), False)
        self.assertEqual(json.loads(el.deck_gl_chart.spec), {})

        data = el.deck_gl_chart.layers[0].data
        self.assertEqual(
            json.loads(json_format.MessageToJson(data.data.cols[0].int64s)),
            {
                'data': ['1', '2', '3', '4']
            }
        )
        self.assertEqual(
            json.loads(json_format.MessageToJson(data.data.cols[1].int64s)),
            {
                'data': ['11', '22', '33', '44']
            }
        )

        self.assertEqual(
            json.loads(json_format.MessageToJson(data.columns.plain_index.data.strings)),
            {
                'data': ['lat', 'lon']
            }
        )

        # Default layer
        self.assertEqual(
            json.loads(el.deck_gl_chart.layers[0].spec),
            {'type': 'ScatterplotLayer'}
        )

    def test_st_empty(self):
        """Test st.empty."""
        dg = st.empty()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.empty.unused, True)

    def test_st_error(self):
        """Test st.error."""
        dg = st.error('some error')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some error')
        self.assertEqual(el.text.format, protobuf.Text.ERROR)

    def test_st_exception(self):
        """Test st.exception."""
        e = RuntimeError('Test Exception')
        dg = st.exception(e)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.exception.type, 'RuntimeError')
        self.assertEqual(el.exception.message, 'Test Exception')
        # We will test stack_trace when testing
        # streamlit.elements.exception_element
        if sys.version_info >= (3, 0):
            self.assertEqual(el.exception.stack_trace, [])
        else:
            self.assertEqual(
                el.exception.stack_trace,
                [u'Cannot extract the stack trace for this exception. Try '
                 u'calling exception() within the `catch` block.'])

    def test_st_header(self):
        """Test st.header."""
        dg = st.header('some header')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, '## some header')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_help(self):
        """Test st.help."""
        dg = st.help(st.header)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.doc_string.name, 'header')
        self.assertEqual(el.doc_string.module, 'streamlit')
        self.assertTrue(
            el.doc_string.doc_string.startswith('Display text in header formatting.'))
        if sys.version_info >= (3, 0):
            self.assertEqual(el.doc_string.type, '<class \'function\'>')
        else:
            self.assertEqual(el.doc_string.type, u'<type \'function\'>')
        self.assertEqual(el.doc_string.signature, '(body)')

    def test_st_image_PIL_image(self):
        """Test st.image with PIL image."""
        img = Image.new('RGB', (64, 64), color = 'red')

        # Manually calculated by letting the test fail and copying and
        # pasting the result.
        checksum = 'gNaA9oFUoUBf3Xr7AgAAAAASUVORK5CYII='

        dg = st.image(
            img,
            caption='some caption',
            width=100)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 100)
        self.assertEqual(el.imgs.imgs[0].caption, 'some caption')
        self.assertTrue(el.imgs.imgs[0].data.base64.endswith(checksum))

    def test_st_image_PIL_array(self):
        """Test st.image with a PIL array."""
        imgs = [
            Image.new('RGB', (64, 64), color = 'red'),
            Image.new('RGB', (64, 64), color = 'blue'),
            Image.new('RGB', (64, 64), color = 'green'),
        ]
        # Manually calculated by letting the test fail and copying and
        # pasting the result.
        imgs_b64 = [
            'A1oDWgNaA9oFUoUBf3Xr7AgAAAAASUVORK5CYII=',
            'WgNaA1oDWgPaBVCHAX/y3CvgAAAAAElFTkSuQmCC',
            'NaA1oDWgNaBdYVwBALVjUB8AAAAASUVORK5CYII=',
        ]
        dg = st.image(
            imgs,
            caption=['some caption'] * 3,
            width=200,
            use_column_width=True,
            clamp=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, -2)
        for idx, checksum in enumerate(imgs_b64):
            self.assertEqual(el.imgs.imgs[idx].caption, 'some caption')
            self.assertTrue(el.imgs.imgs[idx].data.base64.endswith(checksum))

    def test_st_image_with_single_url(self):
        """Test st.image with single url."""
        url = 'http://server/fake0.jpg'

        dg = st.image(
            url,
            caption='some caption',
            width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        self.assertEqual(el.imgs.imgs[0].caption, 'some caption')
        self.assertEqual(el.imgs.imgs[0].url, url)

    def test_st_image_with_list_of_urls(self):
        """Test st.image with list of urls."""
        urls = [
            'http://server/fake0.jpg',
            'http://server/fake1.jpg',
            'http://server/fake2.jpg',
        ]
        dg = st.image(
            urls,
            caption=['some caption'] * 3,
            width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        for idx, url in enumerate(urls):
            self.assertEqual(el.imgs.imgs[idx].caption, 'some caption')
            self.assertEqual(el.imgs.imgs[idx].url, url)

    def test_st_image_bad_width(self):
        """Test st.image with bad width."""
        st.image('does/not/exist', width=-1234)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.exception.type, 'RuntimeError')
        self.assertEqual(
            el.exception.message,
            'Image width must be positive.')
        self.assertTrue(
            'RuntimeError(\'Image width must be positive.\')'
                in ''.join(el.exception.stack_trace))

    def test_st_info(self):
        """Test st.info."""
        dg = st.info('some info')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some info')
        self.assertEqual(el.text.format, protobuf.Text.INFO)

    def test_st_json(self):
        """Test st.json."""
        dg = st.json('{"some": "json"}')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, '{"some": "json"}')
        self.assertEqual(el.text.format, protobuf.Text.JSON)

    def test_st_line_chart(self):
        """Test st.line_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=['a', 'b', 'c'])
        dg = st.line_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.chart.type, 'LineChart')
        self.assertEqual(el.chart.width, 640)
        self.assertEqual(el.chart.height, 480)
        self.assertEqual(
            el.chart.data.columns.plain_index.data.strings.data,
            ['a', 'b', 'c']
        )
        data = json.loads(json_format.MessageToJson(el.chart.data.data))
        result = [x['int64s']['data'][0] for x in data['cols']]
        self.assertEqual(result, ['10', '20', '30'])

    def test_st_map(self):
        """Test st.map."""
        df = pd.DataFrame({'lat': [1.0, 2.0, 3.0], 'lon': [11.0, 12.0, 13.0]})
        dg = st.map(df)

        el = self.get_delta_from_queue().new_element
        data = json.loads(json_format.MessageToJson(el.map.points.data))
        self.assertEqual(
            data['cols'][0]['doubles']['data'],
            [1.0, 2.0, 3.0])
        self.assertEqual(
            data['cols'][1]['doubles']['data'],
            [11.0, 12.0, 13.0])

    def test_st_map_missing_column(self):
        """Test st.map with wrong column label."""
        df = pd.DataFrame({'notlat': [1, 2, 3], 'lon': [11, 12, 13]})
        st.map(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.exception.type, 'Exception')
        self.assertEqual(
            el.exception.message,
            'Map data must contain "lat" and "lon" columns.')
        self.assertTrue(
            'Exception(\'Map data must contain "lat" and "lon" columns.\')'
                in ''.join(el.exception.stack_trace))

    def test_st_map_nan_exception(self):
        """Test st.map with NaN in data."""
        df = pd.DataFrame({'lat': [1, 2, np.nan], 'lon': [11, 12, 13]})
        st.map(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.exception.type, 'Exception')
        self.assertEqual(el.exception.message, 'Map data must be numeric.')
        self.assertTrue(
            'raise Exception(\'Map data must be numeric.\')'
                in ''.join(el.exception.stack_trace))

    def test_st_markdown(self):
        """Test st.markdown."""
        dg = st.markdown('    some markdown  ')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some markdown')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_progress(self):
        """Test st.progress."""
        dg = st.progress(51)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.progress.value, 51)

    def test_st_pyplot(self):
        """Test st.pyplot.

        Need to test:
        * Failed import of matplotlib.
        * Passing in a figure.
        """
        # Matplotlib backend AGG only seems to work with python3
        # TODO(armando): Make this test work with python2.7
        if sys.version_info <= (3, 0):
            return

        import matplotlib
        matplotlib.use('AGG')
        import matplotlib.pyplot as plt

        # Make this deterministic
        np.random.seed(19680801)
        data = np.random.randn(2, 20)

        # Manually calculated by letting the test fail and copying and
        # pasting the result.
        checksum = 'DTuIkOADCFAAEAmPL/AFE92BIZHj8WAAAAAElFTkSuQmCC'

        # Generate a 2 inch x 2 inch figure
        plt.figure(figsize=(2, 2))
        # Add 20 random points to scatter plot.
        plt.scatter(data[0], data[1])
        dg = st.pyplot()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, -2)
        self.assertEqual(el.imgs.imgs[0].caption, '')
        self.assertTrue(el.imgs.imgs[0].data.base64.endswith(checksum))

    def test_st_plotly_chart_simple(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(
            x=[1, 2, 3, 4],
            y=[10, 15, 13, 17]
        )

        data = [trace0]
        dg = st.plotly_chart(data)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField('url'), False)
        self.assertNotEqual(el.plotly_chart.figure.spec, '')
        self.assertNotEqual(el.plotly_chart.figure.config, '')
        self.assertEqual(el.plotly_chart.width, 0)
        self.assertEqual(el.plotly_chart.height, 0)

    def test_st_plotly_chart_dimensions(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(
            x=[1, 2, 3, 4],
            y=[10, 15, 13, 17]
        )

        data = [trace0]
        dg = st.plotly_chart(data, width=100, height=200)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField('url'), False)
        self.assertNotEqual(el.plotly_chart.figure.spec, '')
        self.assertNotEqual(el.plotly_chart.figure.config, '')
        self.assertEqual(el.plotly_chart.width, 100)
        self.assertEqual(el.plotly_chart.height, 200)

    def test_st_plotly_chart_mpl(self):
        """Test st.plotly_chart can handle Matplotlib figures."""
        # Matplotlib backend AGG only seems to work with python3
        # TODO(armando): Make this test work with python2.7
        if sys.version_info <= (3, 0):
            return

        import matplotlib
        matplotlib.use('AGG')
        import matplotlib.pyplot as plt

        fig = plt.figure()
        plt.plot([10, 20, 30])
        dg = st.plotly_chart(fig)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField('url'), False)
        self.assertNotEqual(el.plotly_chart.figure.spec, '')
        self.assertNotEqual(el.plotly_chart.figure.config, '')
        self.assertEqual(el.plotly_chart.width, 0)
        self.assertEqual(el.plotly_chart.height, 0)

    def test_st_plotly_chart_sharing(self):
        """Test st.plotly_chart when sending data to Plotly's service."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(
            x=[1, 2, 3, 4],
            y=[10, 15, 13, 17]
        )

        data = [trace0]

        with patch('streamlit.elements.plotly_chart.ply.plot') as plot_patch:
            plot_patch.return_value = 'the_url'
            st.plotly_chart(data, sharing='public')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField('figure'), False)
        self.assertNotEqual(el.plotly_chart.url, 'the_url')
        self.assertEqual(el.plotly_chart.width, 0)
        self.assertEqual(el.plotly_chart.height, 0)

    def test_st_subheader(self):
        """Test st.subheader."""
        dg = st.subheader('some subheader')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, '### some subheader')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_success(self):
        """Test st.success."""
        dg = st.success('some success')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some success')
        self.assertEqual(el.text.format, protobuf.Text.SUCCESS)

    def test_st_table(self):
        """Test st.table."""
        df = pd.DataFrame(
            [[1, 2], [3, 4]],
            columns=['col1', 'col2'])
        dg = st.table(df)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.table.data.cols[0].int64s.data, [1, 3])
        self.assertEqual(el.table.data.cols[1].int64s.data, [2, 4])
        self.assertEqual(el.table.columns.plain_index.data.strings.data, ['col1', 'col2'])

    def test_st_text(self):
        """Test st.text."""
        dg = st.text('some text')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some text')
        self.assertEqual(el.text.format, protobuf.Text.PLAIN)

    def test_st_title(self):
        """Test st.title."""
        dg = st.title('some title')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, '# some title')
        self.assertEqual(el.text.format, protobuf.Text.MARKDOWN)

    def test_st_vega_lite_chart(self):
        """Test st.vega_lite_chart."""
        pass

    def test_st_video(self):
        """Test st.video."""
        # TODO(armando): generate real video data
        # For now it doesnt matter cause browser is the one that uses it.
        fake_video_data = '\x11\x22\x33\x44\x55\x66'.encode('utf-8')

        dg = st.video(fake_video_data)

        el = self.get_delta_from_queue().new_element
        # Manually base64 encoded payload above via
        # base64.b64encode(bytes('\x11\x22\x33\x44\x55\x66'.encode('utf-8')))
        self.assertEqual(el.video.data, 'ESIzRFVm')
        self.assertEqual(el.video.format, 'video/mp4')

    def test_st_warning(self):
        """Test st.warning."""
        dg = st.warning('some warning')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, 'some warning')
        self.assertEqual(el.text.format, protobuf.Text.WARNING)

    def test_st_native_chart(self):
        """Test st._native_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=['a', 'b', 'c'])
        chart = Chart(df, 'line_chart', width=640, height=480)
        dg = st._native_chart(chart)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.chart.type, 'LineChart')
        self.assertEqual(el.chart.width, 640)
        self.assertEqual(el.chart.height, 480)
        self.assertEqual(
            el.chart.data.columns.plain_index.data.strings.data,
            ['a', 'b', 'c']
        )
        data = json.loads(json_format.MessageToJson(el.chart.data.data))
        result = [x['int64s']['data'][0] for x in data['cols']]
        self.assertEqual(result, ['10', '20', '30'])

    def test_st_text_exception(self):
        """Test st._text_exception."""
        data ={
            'type': 'ModuleNotFoundError',
            'message': 'No module named \'numpy\'',
            'stack_trace': [
                'Traceback (most recent call last):',
                '  File "<stdin>", line 1, in <module>',
                'ModuleNotFoundError: No module named \'numpy\'',
            ]
        }

        dg = st._text_exception(
            data.get('type'),
            data.get('message'),
            data.get('stack_trace'),
        )

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.exception.type, data.get('type'))
        self.assertEqual(el.exception.message, data.get('message'))
        self.assertEqual(el.exception.stack_trace, data.get('stack_trace'))



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

    def test_plotly(self):
        import plotly.graph_objs as go

        """Test st.write with plotly object."""
        with patch('streamlit.plotly_chart') as p:
            st.write([go.Scatter(x=[1, 2], y=[10, 20])])

            p.assert_called_once()

    def test_dict(self):
        """Test st.write with dict."""
        with patch('streamlit.json') as p:
            st.write({'a': 1, 'b': 2})

            p.assert_called_once()

    @patch('streamlit.markdown')
    @patch('streamlit.json')
    def test_dict_and_string(self, mock_json, mock_markdown):
        """Test st.write with dict."""
        manager = Mock()
        manager.attach_mock(mock_json, 'json')
        manager.attach_mock(mock_markdown, 'markdown')

        st.write('here is a dict', {'a': 1, 'b': 2}, ' and that is all')

        expected_calls = [
            call.markdown('here is a dict'),
            call.json({'a': 1, 'b': 2}),
            call.markdown(' and that is all'),
        ]
        self.assertEqual(manager.mock_calls, expected_calls)

    def test_default_object(self):
        """Test st.write with default clause ie some object."""
        class SomeObject(object):
            def __str__(self):
                return '1 * 2 - 3 = 4 `ok` !'

        with patch('streamlit.markdown') as p:
            st.write(SomeObject())

            p.assert_called_once_with(u'`1 * 2 - 3 = 4 \\`ok\\` !`')

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
