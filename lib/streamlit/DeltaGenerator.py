# Copyright 2018 Streamlit Inc. All rights reserved.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import functools
import io
import json
import random
import sys
import textwrap
import traceback

from streamlit import protobuf

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


MAX_DELTA_BYTES = 14 * 1024 * 1024  # 14MB


def _wraps_with_cleaned_sig(wrapped):
    """Simplify the function signature by removing "self" and "element".

    Removes "self" and "element" from function signature, since signatures are
    visible in our user-facing docs and these elements make no sense to the
    user.
    """
    # By passing (None, None), we're removing (self, element) from *args
    fake_wrapped = functools.partial(wrapped, None, None)
    fake_wrapped.__doc__ = wrapped.__doc__

    # These fields are used by wraps(), but in Python 2 partial() does not
    # produce them.
    fake_wrapped.__module__ = wrapped.__module__
    fake_wrapped.__name__ = wrapped.__name__

    return functools.wraps(fake_wrapped)


def _clean_up_sig(method):
    """Cleanup function signature.

    This passes 'None' into the `element` argument of the wrapped function.

    The reason this function exists is to allow us to use
    `@_wraps_with_cleaned_sig` in functions like `st.dataframe`, which do not
    take an element as input.

    Contrast this with the `_with_element()` function, below, which creates an
    actual Element proto, passes it into the function, and takes care of
    enqueueing the element later.

    So if you have some function
        @_clean_up_sig
        def some_function(self, unused_element_argument, stuff):
    then the wrapped version of `some_function` can be called like this by
    the user:
        dg.some_function(stuff)

    and its signature (introspected in st.help or IPython's `?` magic command)
    will correctly reflect the above.  Meanwhile, when the user calls the
    function as above, the wrapped function will be called this way:
        dg.some_function(None, stuff)
    """
    @_wraps_with_cleaned_sig(method)
    def wrapped_method(self, *args, **kwargs):
        return method(self, None, *args, **kwargs)
    return wrapped_method


def _with_element(method):
    """Wrap function and pass a NewElement proto to be filled.

    This is a function decorator.

    Converts a method of the with arguments (self, element, ...) into a method
    with arguments (self, ...). Thus, the instantiation of the element proto
    object and creation of the element are handled automatically.

    Parameters
    ----------
    method : callable
        A DeltaGenerator method with arguments (self, element, ...)

    Returns
    -------
    callable
        A new DeltaGenerator method with arguments (self, ...)

    """
    @_wraps_with_cleaned_sig(method)
    def wrapped_method(self, *args, **kwargs):
        try:
            def marshall_element(element):
                method(self, element, *args, **kwargs)
            return self._enqueue_new_element_delta(marshall_element)
        except Exception as e:
            # First, write the delta to stderr.
            import sys
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, file=sys.stderr)

            # Now write the delta to the report. (To avoid infinite recursion,
            # we make sure that the exception didn't occur *within* st.exception
            # itself!)
            if method.__name__ != 'exception':
                self.exception(e)

    return wrapped_method


class DeltaGenerator(object):
    """Creator of Delta protobuf messages."""

    def __init__(self, enqueue, id=0, is_root=True):
        """Constructor.

        Parameters
        ----------
        enqueue : callable
            Function that (maybe) enqueues ForwardMsg's and returns True if
            enqueued or False if not.
        id : int
            ID for deltas, or None to create the root DeltaGenerator (which
            produces DeltaGenerators with incremeting IDs)

        """
        self._enqueue = enqueue
        self._id = id
        self._is_root = is_root

    # Protected (should be used only by Streamlit, not by users).
    def _reset(self):
        """Reset delta generator so it starts from index 0."""
        assert self._is_root
        self._id = 0

    def _enqueue_new_element_delta(self, marshall_element):
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        marshall_element : callable
            Function which sets the fields for a protobuf.Delta.

        Returns
        -------
        DeltaGenerator
            A DeltaGenerator that can be used to modify the newly-created
            element.

        """
        # "Null" delta generators (those without queues), don't send anything.
        if self._enqueue is None:
            return self

        msg = protobuf.ForwardMsg()
        marshall_element(msg.delta.new_element)
        msg.delta.id = self._id

        # Figure out if we need to create a new ID for this element.
        if self._is_root:
            output_dg = DeltaGenerator(
                self._enqueue, msg.delta.id, is_root=False)
        else:
            output_dg = self

        msg_was_enqueued = self._enqueue(msg)

        if not msg_was_enqueued:
            return self

        if self._is_root:
            self._id += 1

        return output_dg

    @_with_element
    def balloons(self, element):
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your report and get ready for a celebration!

        """
        element.balloons.type = protobuf.Balloons.DEFAULT
        element.balloons.execution_id = random.randrange(0xFFFFFFFF)

    @_with_element
    def text(self, element, body):
        """Write fixed-width text.

        Parameters
        ----------
        body : str
            The string to display.

        Example
        -------
        >>> st.text('This is some text.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PYxU1kee5ubuhGR11NsnT1
           height: 50px

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.PLAIN

    @_with_element
    def markdown(self, element, body):
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

        Example
        -------
        >>> st.markdown('Streamlit is **_really_ cool**.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PXz9xgY8aB88eziDVEZLyS
           height: 50px

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.MARKDOWN

    @_with_element
    def code(self, element, body, language='python'):
        """Display a code block with optional syntax highlighting.

        (This is a convenience wrapper around `st.markdown()`)

        Parameters
        ----------
        body : str
            The string to display as code.

        language : str
            The language that the code is written in, for syntax highlighting.
            If omitted, the code will be unstyled.

        Example
        -------
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language='python')

        .. output::
           https://share.streamlit.io/0.27.0-kBtt/index.html?id=VDRnaCEZWSBCNUd5gNQZv2
           height: 100px

        """
        markdown = '```%(language)s\n%(body)s\n```' % \
                   {'language': language or '', 'body': body}
        element.text.body = _clean_text(markdown)
        element.text.format = protobuf.Text.MARKDOWN

    @_with_element
    def json(self, element, body):
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : Object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        Example
        -------
        >>> st.json({
        ...     'foo': 'bar',
        ...     'baz': 'boz',
        ...     'stuff': [
        ...         'stuff 1',
        ...         'stuff 2',
        ...         'stuff 3',
        ...         'stuff 5',
        ...     ],
        ... })

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=CTFkMQd89hw3yZbZ4AUymS
           height: 280px

        """
        element.text.body = (
            body if isinstance(body, string_types)  # noqa: F821
            else json.dumps(body, default=lambda o: str(type(o))))
        element.text.format = protobuf.Text.JSON

    @_with_element
    def title(self, element, body):
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.title('This is a title')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=SFcBGANWd8kWXF28XnaEZj
           height: 100px

        """
        element.text.body = '# %s' % _clean_text(body)
        element.text.format = protobuf.Text.MARKDOWN

    @_with_element
    def header(self, element, body):
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.header('This is a header')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=AnfQVFgSCQtGv6yMUMUYjj
           height: 100px

        """
        element.text.body = '## %s' % _clean_text(body)
        element.text.format = protobuf.Text.MARKDOWN

    @_with_element
    def subheader(self, element, body):
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.subheader('This is a subheader')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=LBKJTfFUwudrbWENSHV6cJ
           height: 100px

        """
        element.text.body = '### %s' % _clean_text(body)
        element.text.format = protobuf.Text.MARKDOWN

    @_with_element
    def error(self, element, body):
        """Display error message.

        Parameters
        ----------
        body : str
            The error text to display.

        Example
        -------
        >>> st.error('This is an error')

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.ERROR

    @_with_element
    def warning(self, element, body):
        """Display warning message.

        Parameters
        ----------
        body : str
            The warning text to display.

        Example
        -------
        >>> st.warning('This is a warning')

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.WARNING

    @_with_element
    def info(self, element, body):
        """Display an informational message.

        Parameters
        ----------
        body : str
            The info text to display.

        Example
        -------
        >>> st.info('This is a purely informational message')

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.INFO

    @_with_element
    def success(self, element, body):
        """Display a success message.

        Parameters
        ----------
        body : str
            The success text to display.

        Example
        -------
        >>> st.success('This is a success message!')

        """
        element.text.body = _clean_text(body)
        element.text.format = protobuf.Text.SUCCESS

    @_with_element
    def help(self, element, obj):
        """Display object's doc string, nicely formatted.

        Displays the doc string for this object.

        Parameters
        ----------
        obj : Object
            The object whose docstring should be displayed.

        Example
        -------

        Don't remember how to initialize a dataframe? Try this:

        >>> st.help(pandas.DataFrame)

        Want to quickly check what datatype is output by a certain function?
        Try:

        >>> x = my_poorly_documented_function()
        >>> st.help(x)

        """
        import streamlit.elements.doc_string as doc_string
        doc_string.marshall(element, obj)

    @_with_element
    def exception(self, element, exception, exception_traceback=None):
        """Display an exception.

        Parameters
        ----------
        exception : Exception
            The exception to display.
        exception_traceback : Exception Traceback or None
            If None or False, does not show display the trace. If True,
            tries to capture a trace automatically. If a Traceback object,
            displays the given traceback.

        Example
        -------
        >>> e = RuntimeError('This is an exception of type RuntimeError')
        >>> st.exception(e)

        """
        import streamlit.elements.exception_proto as exception_proto
        exception_proto.marshall(
            element.exception, exception, exception_traceback)

    @_with_element
    def _text_exception(self, element, exception_type, message, stack_trace):
        """Display an exception.

        Parameters
        ----------
        exception_type : str
        message : str
        stack_trace : list of str

        """
        element.exception.type = exception_type
        element.exception.message = message
        element.exception.stack_trace.extend(stack_trace)

    @_clean_up_sig
    def dataframe(self, _, data=None):
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The data to display.

            If 'data' is a pandas.Styler, it will be used to style its
            underyling DataFrame. Streamlit supports custom cell
            values and colors. (It does not support some of the more exotic
            pandas styling features, like bar charts, hovering, and captions.)
            Styler support is experimental!

        Examples
        --------
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df)  # Same as st.write(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=165mJbzWdAC8Duf8a4tjyQ
           height: 330px

        You can also pass a Pandas Styler object to change the style of
        the rendered DataFrame:

        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df.style.highlight_max(axis=0))

        .. output::
           https://share.streamlit.io/0.29.0-dV1Y/index.html?id=Hb6UymSNuZDzojUNybzPby
           height: 285px

        """
        import streamlit.elements.data_frame_proto as data_frame_proto

        def set_data_frame(delta):
            data_frame_proto.marshall_data_frame(data, delta.data_frame)
        return self._enqueue_new_element_delta(set_data_frame)

    # TODO: Either remove this or make it public. This is only used in the
    # mnist demo right now.
    @_with_element
    def _native_chart(self, element, chart):
        """Display a chart."""
        chart.marshall(element.chart)

    @_with_element
    def line_chart(self, element, data, width=0, height=0):
        """Display a line chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict
            or None
            Data to be plotted.

        width : int
            The chart width in pixels, or 0 for full width.

        height : int
            The chart width in pixels, or 0 for default height.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.line_chart(chart_data)

        .. output::
            https://share.streamlit.io/0.26.1-2LpAr/index.html?id=FjPACu1ham1Jx96YD1o7Pg
            height: 200px

        """
        from streamlit.elements.Chart import Chart
        chart = Chart(data, type='line_chart', width=width, height=height)
        chart.marshall(element.chart)

    @_with_element
    def area_chart(self, element, data, width=0, height=0):
        """Display a area chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels, or 0 for full width.

        height : int
            The chart width in pixels, or 0 for default height.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.area_chart(chart_data)

        .. output::
            https://share.streamlit.io/0.26.1-2LpAr/index.html?id=BYLQrnN1tHonosFUj3Q4xm
            height: 200px

        """
        from streamlit.elements.Chart import Chart
        chart = Chart(data, type='area_chart', width=width, height=height)
        chart.marshall(element.chart)

    @_with_element
    def bar_chart(self, element, data, width=0, height=0):
        """Display a bar chart.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels, or 0 for full width.

        height : int
            The chart width in pixels, or 0 for default height.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     [[20, 30, 50]],
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.bar_chart(chart_data)

        .. output::
            https://share.streamlit.io/0.26.1-2LpAr/index.html?id=B8pQsaSjGyo1372MTnX9rk
            height: 200px

        """
        from streamlit.elements.Chart import Chart
        chart = Chart(data, type='bar_chart', width=width, height=height)
        chart.marshall(element.chart)

    @_with_element
    def vega_lite_chart(self, element, data=None, spec=None, **kwargs):
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).

        spec : dict or None
            The Vega-Lite spec for the chart. If the spec was already passed in
            the previous argument, this must be set to None. See
            https://vega.github.io/vega-lite/docs/ for more info.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        >>>
        >>> st.vega_lite_chart(df, {
        ...     'mark': 'circle',
        ...     'encoding': {
        ...         'x': {'field': 'a', 'type': 'quantitative'},
        ...         'y': {'field': 'b', 'type': 'quantitative'},
        ...         'size': {'field': 'c', 'type': 'quantitative'},
        ...         'color': {'field': 'c', 'type': 'quantitative'},
        ...     },
        ... })

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        import streamlit.elements.vega_lite as vega_lite
        vega_lite.marshall(
            element.vega_lite_chart, data, spec, **kwargs)

    @_with_element
    def altair_chart(self, element, altair_chart):
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.vegalite.v2.api.Chart
            The Altair chart object to display.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(df).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c')
        >>>
        >>> st.altair_chart(c)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        import streamlit.elements.vega_lite as vega_lite
        vega_lite.marshall(element.vega_lite_chart, altair_chart.to_dict())

    @_with_element
    def graphviz_chart(self, element, figure_or_dot, width=0, height=0):
        """Display a graph using the dagre-d3 library.

        Parameters
        ----------
        figure_or_dot : graphviz.dot.Graph, graphviz.dot.Digraph, str
            The Graphlib graph object or dot string to display
        width : type
            The chart width in pixels, or 0 for full width.
        height : type
            The chart height in pixels, or 0 for default height.

        Example
        -------

        >>> import streamlit as st
        >>> import graphviz as graphviz
        >>>
        >>> # Create a graphlib graph object
        >>> graph = graphviz.DiGraph()
        >>> graph.edge('run', 'intr')
        >>> graph.edge('intr', 'runbl')
        >>> graph.edge('runbl', 'run')
        >>> graph.edge('run', 'kernel')
        >>> graph.edge('kernel', 'zombie')
        >>> graph.edge('kernel', 'sleep')
        >>> graph.edge('kernel', 'runmem')
        >>> graph.edge('sleep', 'swap')
        >>> graph.edge('swap', 'runswap')
        >>> graph.edge('runswap', 'new')
        >>> graph.edge('runswap', 'runmem')
        >>> graph.edge('new', 'runmem')
        >>> graph.edge('sleep', 'runmem')
        >>>
        >>> st.graphviz_chart(graph)

        Or you can render the chart from the graph using GraphViz's Dot
        language:

        >>> st.graphviz_chart('''
            digraph {
                run -> intr
                intr -> runbl
                runbl -> run
                run -> kernel
                kernel -> zombie
                kernel -> sleep
                kernel -> runmem
                sleep -> swap
                swap -> runswap
                runswap -> new
                runswap -> runmem
                new -> runmem
                sleep -> runmem
            }
        ''')

        .. output::
           https://share.streamlit.io/0.37.0-2PGsB/index.html?id=QFXRFT19mzA3brW8XCAcK8
           height: 400px

        """
        import streamlit.elements.graphviz_chart as graphviz_chart
        graphviz_chart.marshall(element.graphviz_chart, figure_or_dot,
                                width=width, height=height)

    @_with_element
    def plotly_chart(
            self, element, figure_or_data, width=0, height=0,
            sharing='streamlit', **kwargs):
        """Display an interactive Plotly chart.

        Plotly is a charting library for Python. The arguments to this function
        closely follow the ones for Plotly's `plot()` function. You can find
        more about Plotly at https://plot.ly/python.

        Parameters
        ----------
        figure_or_data : plotly.graph_objs.Figure, plotly.graph_objs.Data,
            dict/list of plotly.graph_objs.Figure/Data, or
            matplotlib.figure.Figure

            See https://plot.ly/python/ for examples of graph descriptions.

            If a Matplotlib Figure, converts it to a Plotly figure and displays
            it.

        width : int
            The chart width in pixels, or 0 for full width.

        height : int
            The chart height in pixels, or 0 for default height.

        sharing : {'streamlit', 'private', 'secret', 'public'}
            Use 'streamlit' to insert the plot and all its dependencies
            directly in the Streamlit report, which means it works offline too.
            This is the default.
            Use any other sharing mode to send the report to Plotly's servers,
            and embed the result into the Streamlit report. See
            https://plot.ly/python/privacy/ for more. Note that these sharing
            modes require a Plotly account.

        **kwargs
            Any argument accepted by Plotly's `plot()` function.


        To show Plotly charts in Streamlit, just call `st.plotly_chart`
        wherever you would call Plotly's `py.plot` or `py.iplot`.

        Example
        -------

        The example below comes straight from the examples at
        https://plot.ly/python:

        >>> import streamlit as st
        >>> import plotly.plotly as py
        >>> import plotly.figure_factory as ff
        >>> import numpy as np
        >>>
        >>> # Add histogram data
        >>> x1 = np.random.randn(200) - 2
        >>> x2 = np.random.randn(200)
        >>> x3 = np.random.randn(200) + 2
        >>>
        >>> # Group data together
        >>> hist_data = [x1, x2, x3]
        >>>
        >>> group_labels = ['Group 1', 'Group 2', 'Group 3']
        >>>
        >>> # Create distplot with custom bin_size
        >>> fig = ff.create_distplot(
        ...         hist_data, group_labels, bin_size=[.1, .25, .5])
        >>>
        >>> # Plot!
        >>> st.plotly_chart(fig)

        .. output::
           https://share.streamlit.io/0.32.0-2KznC/index.html?id=NbyKJnNQ2XcrpWTno643uD
           height: 400px

        """
        # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
        # for their main parameter. I don't like the name, but its best to keep
        # it in sync with what Plotly calls it.
        import streamlit.elements.plotly_chart as plotly_chart
        plotly_chart.marshall(
            element.plotly_chart, figure_or_data, width, height, sharing,
            **kwargs)

    @_with_element
    def pyplot(self, element, fig=None, **kwargs):
        """Display a matplotlib.pyplot figure.

        Parameters
        ----------
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, which is
            the usual case, this function will render the global plot.

        **kwargs : any
            Arguments to pass to Matplotlib's savefig function.

        Example
        -------
        >>> import matplotlib.pyplot as plt
        >>> import numpy as np
        >>>
        >>> arr = np.random.normal(1, 1, size=100)
        >>> plt.hist(arr, bins=20)
        >>>
        >>> st.pyplot()

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PwzFN7oLZsvb6HDdwdjkRB
           height: 530px

        Notes
        -----
        Matplotlib support several different types of "backends". If you're
        getting an error using Matplotlib with Streamlit, try setting your
        backend to "TkAgg"::

            echo "backend: TkAgg" >> ~/.matplotlib/matplotlibrc

        For more information, see https://matplotlib.org/faq/usage_faq.html.

        """
        import streamlit.elements.image_proto as image_proto
        try:
            import matplotlib  # noqa: F401
            import matplotlib.pyplot as plt
            plt.ioff()
        except ImportError:
            raise ImportError('pyplot() command requires matplotlib')

        # You can call .savefig() on a Figure object or directly on the pyplot
        # module, in which case you're doing it to the latest Figure.
        if not fig:
            fig = plt

        # Normally, dpi is set to 'figure', and the figure's dpi is set to 100.
        # So here we pick double of that to make things look good in a high
        # DPI display.
        options = {
            'dpi': 200,
            'format': 'png',
        }
        # If some of the options are passed in from kwargs then replace
        # the values in options with the ones from kwargs
        options = {a: kwargs.get(a, b) for a, b in options.items()}
        # Merge options back into kwargs.
        kwargs.update(options)

        image = io.BytesIO()
        fig.savefig(image, **kwargs)
        image_proto.marshall_images(
            image, None, -2, element.imgs, False)

    @_with_element
    def bokeh_chart(self, element, figure):
        """Display an interactive Bokeh chart.

        Bokeh is a charting library for Python. The arguments to this function
        closely follow the ones for Bokeh's `show` function. You can find
        more about Bokeh at https://bokeh.pydata.org.

        Parameters
        ----------
        figure : bokeh.plotting.figure.Figure
            A Bokeh figure to plot.


        To show Bokeh charts in Streamlit, just call `st.bokeh_chart`
        wherever you would call Bokeh's `show`.

        Example
        -------
        >>> import streamlit as st
        >>> from bokeh.plotting import figure
        >>>
        >>> x = [1, 2, 3, 4, 5]
        >>> y = [6, 7, 2, 4, 5]
        >>>
        >>> p = figure(
        ...     title='simple line example',
        ...     x_axis_label='x',
        ...     y_axis_label='y')
        ...
        >>> p.line(x, y, legend='Trend', line_width=2)
        >>>
        >>> st.bokeh_chart(p)

        .. output::
           https://share.streamlit.io/0.34.0-2Ezo2/index.html?id=kWNtYxGUFpA3PRXt3uVff
           height: 600px

        """
        import streamlit.elements.bokeh_chart as bokeh_chart
        bokeh_chart.marshall(element.bokeh_chart, figure)

    # TODO: Make this accept files and strings/bytes as input.
    @_with_element
    def image(
            self, element, image, caption=None, width=None,
            use_column_width=False, clamp=False):
        """Display an image or list of images.

        Parameters
        ----------
        image : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a URL to fetch the image from
            OR a list of one of the above, to display multiple images.
        caption : str or list of str
            Image caption. If displaying multiple images, caption should be a
            list of captions (one for each image).
        width : int or None
            Image width. None means use the image width.
        use_column_width : bool
            If True, set the image width to the column width. This overrides
            the `width` parameter.
        clamp : bool
            Clamp image pixel values to a valid range ([0-255] per channel).
            This is only meaningful for byte array images; the parameter is
            ignored for image URLs. If this is not set, and an image has an
            out-of-range value, an error will be thrown.

        Example
        -------
        >>> from PIL import Image
        >>> image = Image.open('sunrise.jpg')
        >>>
        >>> st.image(image, caption='Sunrise by the mountains',
        ...          use_column_width=True)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=YCFaqPgmgpEz7jwE4tHAzY
           height: 630px

        """
        import streamlit.elements.image_proto as image_proto
        if use_column_width:
            width = -2
        elif width is None:
            width = -1
        elif width <= 0:
            raise RuntimeError('Image width must be positive.')
        image_proto.marshall_images(
            image, caption, width, element.imgs, clamp)

    @_with_element
    def audio(self, element, data, format='audio/wav'):
        """Display an audio player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            The audio data. Must include headers and any other bytes required
            in the actual file.
        format : str
            The mime type for the audio file. Defaults to 'audio/wav'.
            See https://tools.ietf.org/html/rfc4281 for more info.

        Example
        -------
        >>> audio_file = open('myaudio.ogg', 'rb')
        >>> audio_bytes = audio_file.read()
        >>>
        >>> st.audio(audio_bytes, format='audio/ogg')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=Dv3M9sA7Cg8gwusgnVNTHb
           height: 400px

        """
        # TODO: Provide API to convert raw NumPy arrays to audio file (with
        # proper headers, etc)?
        import streamlit.elements.generic_binary_proto as generic_binary_proto
        generic_binary_proto.marshall(element.audio, data)
        element.audio.format = format

    @_with_element
    def video(self, element, data, format='video/mp4'):
        """Display a video player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Must include headers and any other bytes required in the actual
            file.
        format : str
            The mime type for the video file. Defaults to 'video/mp4'.
            See https://tools.ietf.org/html/rfc4281 for more info.

        Example
        -------
        >>> video_file = open('myvideo.mp4', 'rb')
        >>> video_bytes = video_file.read()
        >>>
        >>> st.video(video_bytes)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=Wba9sZELKfKwXH4nDCCbMv
           height: 600px

        """
        # TODO: Provide API to convert raw NumPy arrays to video file (with
        # proper headers, etc)?
        import streamlit.elements.generic_binary_proto as generic_binary_proto
        generic_binary_proto.marshall(element.video, data)
        element.video.format = format

    @_with_element
    def progress(self, element, value):
        """Display a progress bar.

        Parameters
        ----------
        value : int
            The percentage complete: 0 <= value <= 100

        Example
        -------
        Here is an example of a progress bar increasing over time:

        >>> import time
        >>>
        >>> my_bar = st.progress(0)
        >>>
        >>> for percent_complete in range(100):
        ...     my_bar.progress(percent_complete + 1)

        """
        # Needed for python 2/3 compatibility
        value_type = type(value).__name__
        if value_type == 'float':
            if 0.0 <= value <= 1.0:
                element.progress.value = int(value * 100)
            else:
                raise ValueError('Progress Value has invalid value [0.0, 1.0]: %f' % value)
        elif value_type == 'int':
            if 0 <= value <= 100:
                element.progress.value = value
            else:
                raise ValueError('Progress Value has invalid value [0, 100]: %d' % value)
        else:
            raise TypeError('Progress Value has invalid type: %s' % value_type)

    @_with_element
    def empty(self, element):
        """Add a placeholder to the report.

        The placeholder can be filled any time by calling methods on the return
        value.

        Example
        -------
        >>> my_placeholder = st.empty()
        >>>
        >>> # Now replace the placeholder with some text:
        >>> my_placeholder.text("Hello world!")
        >>>
        >>> # And replace the text with an image:
        >>> my_placeholder.image(my_image_bytes)

        """
        # The protobuf needs something to be set
        element.empty.unused = True

    @_with_element
    def map(self, element, data):
        """Display a map with points on it.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The data to be plotted. Must have 'lat' and 'lon' columns.

        Example
        -------
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...     columns=['lat', 'lon'])
        >>>
        >>> st.map(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=7Sr8jMkKDc6E6Y5y2v2MNk
           height: 600px

        """
        import streamlit.elements.data_frame_proto as data_frame_proto
        LAT_LON = ['lat', 'lon']
        if not set(data.columns) >= set(LAT_LON):
            raise Exception('Map data must contain "lat" and "lon" columns.')
        if data['lon'].isnull().values.any() or data['lat'].isnull().values.any():
            raise Exception('Map data must be numeric.')
        data_frame_proto.marshall_data_frame(
            data[LAT_LON], element.map.points)

    @_with_element
    def deck_gl_chart(self, element, data=None, spec=None, **kwargs):
        """Draw a map chart using the Deck.GL library.

        This API closely follows Deck.GL's JavaScript API
        (https://deck.gl/#/documentation), with a few small adaptations and
        some syntax sugar.

        Parameters
        ----------

        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            Data to be plotted, if no layer specified.

        spec : dict
            Keys in this dict can be:

            - Anything accepted by Deck.GL's top level element, such as
              "viewport", "height", "width".

            - "layers": a list of dicts containing information to build a new
              Deck.GL layer in the map. Each layer accepts the following keys:

                - "data" : DataFrame
                  The data for the current layer.

                - "type" : str
                  A layer type accepted by Deck.GL, such as "HexagonLayer",
                  "ScatterplotLayer", "TextLayer"

                - "encoding" : dict
                  A mapping connecting specific fields in the dataset to
                  properties of the chart. The exact keys that are accepted
                  depend on the "type" field, above.

                  For example, Deck.GL"s documentation for ScatterplotLayer
                  shows you can use a "getRadius" field to individually set
                  the radius of each circle in the plot. So here you would
                  set "encoding": {"getRadius": "my_column"} where
                  "my_column" is the name of the column containing the radius
                  data.

                  For things like "getPosition", which expect an array rather
                  than a scalar value, we provide alternates that make the
                  API simpler to use with dataframes:

                  - Instead of "getPosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getSourcePosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getTargetPosition" : use "getTargetLatitude"
                    and "getTargetLongitude".
                  - Instead of "getColor" : use "getColorR", "getColorG",
                    "getColorB", and (optionally) "getColorA", for red,
                    green, blue and alpha.
                  - Instead of "getSourceColor" : use the same as above.
                  - Instead of "getTargetColor" : use "getTargetColorR", etc.

                - Plus anything accepted by that layer type. For example, for
                  ScatterplotLayer you can set fields like "opacity", "filled",
                  "stroked", and so on.

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        Example
        -------
        For convenience, if you pass in a dataframe and no spec, you get a
        scatter plot:

        >>> df = pd.DataFrame(
        ...    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...    columns=['lat', 'lon'])
        ...
        >>> st.deck_gl_chart(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=AhGZBy2qjzmWwPxMatHoB9
           height: 530px

        The dataframe must have columns called 'lat'/'latitude' or
        'lon'/'longitude'.

        If you want to do something more interesting, pass in a spec with its
        own data, and no top-level dataframe. For instance:

        >>> st.deck_gl_chart(
        ...     viewport={
        ...         'latitude': 37.76,
        ...         'longitude': -122.4,
        ...         'zoom': 11,
        ...         'pitch': 50,
        ...     },
        ...     layers=[{
        ...         'type': 'HexagonLayer',
        ...         'data': df,
        ...         'radius': 200,
        ...         'elevationScale': 4,
        ...         'elevationRange': [0, 1000],
        ...         'pickable': True,
        ...         'extruded': True,
        ...     }, {
        ...         'type': 'ScatterplotLayer',
        ...         'data': df,
        ...     }])
        ...

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=ASTdExBpJ1WxbGceneKN1i
           height: 530px

        """
        import streamlit.elements.deck_gl as deck_gl
        deck_gl.marshall(element.deck_gl_chart, data, spec, **kwargs)

    @_with_element
    def table(self, element, data=None):
        """Display a static table.

        This differs from `st.dataframe` in that the table in this case is
        static: its entire contents are just laid out directly on the page.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The table data.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=('col %d' % i for i in range(5)))
        ...
        >>> st.table(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=KfZvDMprL4JFKXbpjD3fpq
           height: 480px

        """
        import streamlit.elements.data_frame_proto as data_frame_proto
        data_frame_proto.marshall_data_frame(data, element.table)

    def add_rows(self, data=None, **kwargs):
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
        or None
            Table to concat. Optional.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
        >>> df1 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table = st.table(df1)
        >>>
        >>> df2 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table.add_rows(df2)
        >>> # Now the table shown in the Streamlit report contains the data for
        >>> # df1 followed by the data for df2.

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit report contains the data for
        >>> # df1 followed by the data for df2.

        And for plots whose datasets are named, you can pass the data with a
        keyword argument where the key is the name:

        >>> my_chart = st.vega_lite_chart({
        ...     'mark': 'line',
        ...     'encoding': {'x': 'a', 'y': 'b'},
        ...     'datasets': {
        ...       'some_fancy_name': df1,  # <-- named dataset
        ...      },
        ...     'data': {'name': 'some_fancy_name'},
        ... }),
        >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

        """
        if self._enqueue is None:
            return self

        assert not self._is_root, \
            'Only existing elements can add_rows.'

        import streamlit.elements.data_frame_proto as data_frame_proto

        # Accept syntax st.add_rows(df).
        if data is not None and len(kwargs) == 0:
            name = ''
        # Accept syntax st.add_rows(foo=df).
        elif len(kwargs) == 1:
            name, data = kwargs.popitem()
        # Raise error otherwise.
        else:
            raise RuntimeError(
                'Wrong number of arguments to add_rows().'
                'Method requires exactly one dataset')

        msg = protobuf.ForwardMsg()
        msg.delta.id = self._id

        data_frame_proto.marshall_data_frame(data, msg.delta.add_rows.data)

        if name:
            msg.delta.add_rows.name = name
            msg.delta.add_rows.has_name = True

        self._enqueue(msg)

        return self


def _clean_text(text):
    return textwrap.dedent(str(text)).strip()
