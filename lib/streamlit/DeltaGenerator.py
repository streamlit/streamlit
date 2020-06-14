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

"""Allows us to create and absorb changes (aka Deltas) to elements."""

import functools
import json
import random
import textwrap
import numbers
import re
from datetime import datetime
from datetime import date
from datetime import time

from streamlit import caching
from streamlit import config
from streamlit import cursor
from streamlit import type_util
from streamlit.ReportThread import get_report_ctx
from streamlit.errors import DuplicateWidgetID
from streamlit.errors import StreamlitAPIException
from streamlit.errors import NoSessionContext
from streamlit.file_util import get_encoded_file_data
from streamlit.js_number import JSNumber
from streamlit.js_number import JSNumberBoundsException
from streamlit.proto import Alert_pb2
from streamlit.proto import Balloons_pb2
from streamlit.proto import BlockPath_pb2
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto.NumberInput_pb2 import NumberInput
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.logger import get_logger
from streamlit.type_util import is_type

LOGGER = get_logger(__name__)

# Save the type built-in for when we override the name "type".
_type = type

MAX_DELTA_BYTES = 14 * 1024 * 1024  # 14MB

# List of Streamlit commands that perform a Pandas "melt" operation on
# input dataframes.
DELTAS_TYPES_THAT_MELT_DATAFRAMES = ("line_chart", "area_chart", "bar_chart")


def _wraps_with_cleaned_sig(wrapped, num_args_to_remove):
    """Simplify the function signature by removing arguments from it.

    Removes the first N arguments from function signature (where N is
    num_args_to_remove). This is useful since function signatures are visible
    in our user-facing docs, and many methods in DeltaGenerator have arguments
    that users have no access to.

    Note that "self" is ignored by default. So to remove both "self" and the
    next argument you'd pass num_args_to_remove=1.
    """
    # By passing (None, ...), we're removing (arg1, ...) from *args
    args_to_remove = (None,) * num_args_to_remove
    fake_wrapped = functools.partial(wrapped, *args_to_remove)
    fake_wrapped.__doc__ = wrapped.__doc__
    fake_wrapped.__name__ = wrapped.__name__  # type: ignore[attr-defined]
    fake_wrapped.__module__ = wrapped.__module__

    return functools.wraps(fake_wrapped)


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

    @_wraps_with_cleaned_sig(method, 1)  # Remove self and element from sig.
    def wrapped_method(dg, *args, **kwargs):
        # Warn if we're called from within an @st.cache function
        caching.maybe_show_cached_st_function_warning(dg, method.__name__)

        delta_type = method.__name__
        last_index = None

        if delta_type in DELTAS_TYPES_THAT_MELT_DATAFRAMES and len(args) > 0:
            data = args[0]
            if type_util.is_dataframe_compatible(data):
                data = type_util.convert_anything_to_df(data)

                if data.index.size > 0:
                    last_index = data.index[-1]
                else:
                    last_index = None

        def marshall_element(element):
            return method(dg, element, *args, **kwargs)

        return dg._enqueue_new_element_delta(marshall_element, delta_type, last_index)

    return wrapped_method


def _build_duplicate_widget_message(widget_type, user_key=None):
    if user_key is not None:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with
            `key='{user_key}'`.

            To fix this, please make sure that the `key` argument is unique for
            each `st.{widget_type}` you create.
            """
        )
    else:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with the
            same generated key.

            (When a widget is created, it's assigned an internal key based on
            its structure. Multiple widgets with an identical structure will
            result in the same internal key, which causes this error.)

            To fix this, please pass a unique `key` argument to
            `st.{widget_type}`.
            """
        )

    return message.strip("\n").format(widget_type=widget_type, user_key=user_key)


def _set_widget_id(widget_type, element, user_key=None):
    """Set the widget id.

    Parameters
    ----------
    widget_type : str
        The type of the widget as stored in proto.
    element : proto
        The proto of the element
    user_key : str
        Optional user-specified key to use for the widget ID.
        If this is None, we'll generate an ID by hashing the element.

    """
    element_hash = hash(element.SerializeToString())
    if user_key is not None:
        widget_id = "%s-%s" % (user_key, element_hash)
    else:
        widget_id = "%s" % element_hash

    ctx = get_report_ctx()
    if ctx is not None:
        added = ctx.widget_ids_this_run.add(widget_id)
        if not added:
            raise DuplicateWidgetID(
                _build_duplicate_widget_message(widget_type, user_key)
            )
    el = getattr(element, widget_type)
    el.id = widget_id


def _get_widget_ui_value(widget_type, element, user_key=None):
    """Get the widget ui_value from the report context.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    widget_type : str
        The type of the widget as stored in proto.
    element : proto
        The proto of the element
    user_key : str
        Optional user-specified string to use as the widget ID.
        If this is None, we'll generate an ID by hashing the element.

    Returns
    -------
    ui_value : any
        The value of the widget set by the client or
        the default value passed. If the report context
        doesn't exist, None will be returned.

    """
    _set_widget_id(widget_type, element, user_key)
    el = getattr(element, widget_type)
    ctx = get_report_ctx()
    ui_value = ctx.widgets.get_widget_value(el.id) if ctx else None
    return ui_value


def _get_pandas_index_attr(data, attr):
    return getattr(data.index, attr, None)


class NoValue(object):
    """Return this from DeltaGenerator.foo_widget() when you want the st.foo_widget()
    call to return None. This is needed because `_enqueue_new_element_delta`
    replaces `None` with a `DeltaGenerator` (for use in non-widget elements).
    """

    pass


class DeltaGenerator(object):
    """Creator of Delta protobuf messages.

    Parameters
    ----------
    container: BlockPath_pb2.BlockPath or None
      The root container for this DeltaGenerator. If None, this is a null
      DeltaGenerator which doesn't print to the app at all (useful for
      testing).

    cursor: cursor.AbstractCursor or None
    """

    # The pydoc below is for user consumption, so it doesn't talk about
    # DeltaGenerator constructor parameters (which users should never use). For
    # those, see above.
    def __init__(self, container=BlockPath_pb2.BlockPath.MAIN, cursor=None):
        """Inserts or updates elements in Streamlit apps.

        As a user, you should never initialize this object by hand. Instead,
        DeltaGenerator objects are initialized for you in two places:

        1) When you call `dg = st.foo()` for some method "foo", sometimes `dg`
        is a DeltaGenerator object. You can call methods on the `dg` object to
        update the element `foo` that appears in the Streamlit app.

        2) This is an internal detail, but `st.sidebar` itself is a
        DeltaGenerator. That's why you can call `st.sidebar.foo()` to place
        an element `foo` inside the sidebar.

        """
        self._container = container

        # This is either:
        # - None: if this is the running DeltaGenerator for a top-level
        #   container.
        # - RunningCursor: if this is the running DeltaGenerator for a
        #   non-top-level container (created with dg._block())
        # - LockedCursor: if this is a locked DeltaGenerator returned by some
        #   other DeltaGenerator method. E.g. the dg returned in dg =
        #   st.text("foo").
        #
        # You should never use this! Instead use self._cursor, which is a
        # computed property that fetches the right cursor.
        #
        self._provided_cursor = cursor

    def __getattr__(self, name):
        import streamlit as st

        streamlit_methods = [
            method_name for method_name in dir(st) if callable(getattr(st, method_name))
        ]

        def wrapper(*args, **kwargs):
            if name in streamlit_methods:
                if self._container == BlockPath_pb2.BlockPath.SIDEBAR:
                    message = (
                        "Method `%(name)s()` does not exist for "
                        "`st.sidebar`. Did you mean `st.%(name)s()`?" % {"name": name}
                    )
                else:
                    message = (
                        "Method `%(name)s()` does not exist for "
                        "`DeltaGenerator` objects. Did you mean "
                        "`st.%(name)s()`?" % {"name": name}
                    )
            else:
                message = "`%(name)s()` is not a valid Streamlit command." % {
                    "name": name
                }

            raise StreamlitAPIException(message)

        return wrapper

    @property
    def _cursor(self):
        if self._provided_cursor is None:
            return cursor.get_container_cursor(self._container)
        else:
            return self._provided_cursor

    def _get_coordinates(self):
        """Returns the element's 4-component location as string like "M.(1,2).3".

        This function uniquely identifies the element's position in the front-end,
        which allows (among other potential uses) the MediaFileManager to maintain
        session-specific maps of MediaFile objects placed with their "coordinates".

        This way, users can (say) use st.image with a stream of different images,
        and Streamlit will expire the older images and replace them in place.
        """
        container = self._container  # Proto index of container (e.g. MAIN=1)

        if self._cursor:
            path = (
                self._cursor.path
            )  # [uint, uint] - "breadcrumbs" w/ ancestor positions
            index = self._cursor.index  # index - element's own position
        else:
            # Case in which we have started up in headless mode.
            path = "(,)"
            index = ""

        return "{}.{}.{}".format(container, path, index)

    def _enqueue_new_element_delta(
        self,
        marshall_element,
        delta_type,
        last_index=None,
        element_width=None,
        element_height=None,
    ):
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        marshall_element : callable
            Function which sets the fields for a NewElement protobuf.
        element_width : int or None
            Desired width for the element
        element_height : int or None
            Desired height for the element

        Returns
        -------
        DeltaGenerator
            A DeltaGenerator that can be used to modify the newly-created
            element.

        """
        rv = None

        # Always call marshall_element() so users can run their script without
        # Streamlit.
        msg = ForwardMsg_pb2.ForwardMsg()
        rv = marshall_element(msg.delta.new_element)

        msg_was_enqueued = False

        # Only enqueue message if there's a container.

        if self._container and self._cursor:
            msg.metadata.parent_block.container = self._container
            msg.metadata.parent_block.path[:] = self._cursor.path
            msg.metadata.delta_id = self._cursor.index

            if element_width is not None:
                msg.metadata.element_dimension_spec.width = element_width
            if element_height is not None:
                msg.metadata.element_dimension_spec.height = element_height

            _enqueue_message(msg)
            msg_was_enqueued = True

        if msg_was_enqueued:
            # Get a DeltaGenerator that is locked to the current element
            # position.
            output_dg = DeltaGenerator(
                container=self._container,
                cursor=self._cursor.get_locked_cursor(
                    delta_type=delta_type, last_index=last_index
                ),
            )
        else:
            # If the message was not enqueued, just return self since it's a
            # no-op from the point of view of the app.
            output_dg = self

        return _value_or_dg(rv, output_dg)

    def _block(self):
        if self._container is None or self._cursor is None:
            return self

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.delta.new_block = True
        msg.metadata.parent_block.container = self._container
        msg.metadata.parent_block.path[:] = self._cursor.path
        msg.metadata.delta_id = self._cursor.index

        # Normally we'd return a new DeltaGenerator that uses the locked cursor
        # below. But in this case we want to return a DeltaGenerator that uses
        # a brand new cursor for this new block we're creating.
        block_cursor = cursor.RunningCursor(
            path=self._cursor.path + (self._cursor.index,)
        )
        block_dg = DeltaGenerator(container=self._container, cursor=block_cursor)

        # Must be called to increment this cursor's index.
        self._cursor.get_locked_cursor(None)

        _enqueue_message(msg)

        return block_dg

    @_with_element
    def balloons(self, element):
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your app and get ready for a celebration!

        """
        element.balloons.type = Balloons_pb2.Balloons.DEFAULT
        element.balloons.execution_id = random.randrange(0xFFFFFFFF)

    @_with_element
    def text(self, element, body):
        """Write fixed-width and preformatted text.

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

    @_with_element
    def markdown(self, element, body, unsafe_allow_html=False):
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as `:+1:`  and `:sunglasses:`.
              For a list of all supported codes,
              see https://raw.githubusercontent.com/omnidan/node-emoji/master/lib/emoji.json.

            * LaTeX expressions, by just wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

        unsafe_allow_html : bool
            By default, any HTML tags found in the body will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, we *strongly advise against it*. It is hard to write
            secure HTML, so by using this argument you may be compromising your
            users' security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

            *Also note that `unsafe_allow_html` is a temporary measure and may
            be removed from Streamlit at any time.*

            If you decide to turn on HTML anyway, we ask you to please tell us
            your exact use case here:

            https://discuss.streamlit.io/t/96

            This will help us come up with safe APIs that allow you to do what
            you want.

        Example
        -------
        >>> st.markdown('Streamlit is **_really_ cool**.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PXz9xgY8aB88eziDVEZLyS
           height: 50px

        """
        element.markdown.body = _clean_text(body)
        element.markdown.allow_html = unsafe_allow_html

    @_with_element
    def latex(self, element, body):
        # This docstring needs to be "raw" because of the backslashes in the
        # example below.
        r"""Display mathematical expressions formatted as LaTeX.

        Supported LaTeX functions are listed at
        https://katex.org/docs/supported.html.

        Parameters
        ----------
        body : str or SymPy expression
            The string or SymPy expression to display as LaTeX. If str, it's
            a good idea to use raw Python strings since LaTeX uses backslashes
            a lot.


        Example
        -------
        >>> st.latex(r'''
        ...     a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
        ...     \sum_{k=0}^{n-1} ar^k =
        ...     a \left(\frac{1-r^{n}}{1-r}\right)
        ...     ''')

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=NJFsy6NbGTsH2RF9W6ioQ4
           height: 75px

        """
        if type_util.is_sympy_expession(body):
            import sympy

            body = sympy.latex(body)

        element.markdown.body = "$$\n%s\n$$" % _clean_text(body)

    @_with_element
    def code(self, element, body, language="python"):
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
        markdown = "```%(language)s\n%(body)s\n```" % {
            "language": language or "",
            "body": body,
        }
        element.markdown.body = _clean_text(markdown)

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
        import streamlit as st

        if not isinstance(body, str):
            try:
                body = json.dumps(body, default=lambda o: str(type(o)))
            except TypeError as err:
                st.warning(
                    "Warning: this data structure was not fully serializable as "
                    "JSON due to one or more unexpected keys.  (Error was: %s)" % err
                )
                body = json.dumps(body, skipkeys=True, default=lambda o: str(type(o)))

        element.json.body = body

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
        element.markdown.body = "# %s" % _clean_text(body)

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
        element.markdown.body = "## %s" % _clean_text(body)

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
        element.markdown.body = "### %s" % _clean_text(body)

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
        element.alert.body = _clean_text(body)
        element.alert.format = Alert_pb2.Alert.ERROR

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
        element.alert.body = _clean_text(body)
        element.alert.format = Alert_pb2.Alert.WARNING

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
        element.alert.body = _clean_text(body)
        element.alert.format = Alert_pb2.Alert.INFO

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
        element.alert.body = _clean_text(body)
        element.alert.format = Alert_pb2.Alert.SUCCESS

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
    def exception(self, element, exception):
        """Display an exception.

        Parameters
        ----------
        exception : Exception
            The exception to display.

        Example
        -------
        >>> e = RuntimeError('This is an exception of type RuntimeError')
        >>> st.exception(e)

        """
        import streamlit.elements.exception_proto as exception_proto

        exception_proto.marshall(element.exception, exception)

    def dataframe(self, data=None, width=None, height=None):
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
        width : int or None
            Desired width of the UI element expressed in pixels. If None, a
            default width based on the page width is used.
        height : int or None
            Desired height of the UI element expressed in pixels. If None, a
            default height is used.

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

        >>> st.dataframe(df, 200, 100)

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

        return self._enqueue_new_element_delta(
            set_data_frame, "dataframe", element_width=width, element_height=height
        )

    @_with_element
    def line_chart(
        self, element, data=None, width=0, height=0, use_container_width=True
    ):
        """Display a line chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict
            or None
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart width in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.line_chart(chart_data)

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=BdxXG3MmrVBfJyqS2R2ki8
           height: 220px

        """

        import streamlit.elements.altair as altair

        chart = altair.generate_chart("line", data, width, height)
        altair.marshall(element.vega_lite_chart, chart, use_container_width)

    @_with_element
    def area_chart(
        self, element, data=None, width=0, height=0, use_container_width=True
    ):
        """Display a area chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart width in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(20, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> st.area_chart(chart_data)

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=Pp65STuFj65cJRDfhGh4Jt
           height: 220px

        """
        import streamlit.elements.altair as altair

        chart = altair.generate_chart("area", data, width, height)
        altair.marshall(element.vega_lite_chart, chart, use_container_width)

    @_with_element
    def bar_chart(
        self, element, data=None, width=0, height=0, use_container_width=True
    ):
        """Display a bar chart.

        This is just syntax-sugar around st.altair_chart. The main difference
        is this command uses the data's own column and indices to figure out
        the chart's spec. As a result this is easier to use for many "just plot
        this" scenarios, while being less customizable.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, or dict
            Data to be plotted.

        width : int
            The chart width in pixels. If 0, selects the width automatically.

        height : int
            The chart width in pixels. If 0, selects the height automatically.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.

        Example
        -------
        >>> chart_data = pd.DataFrame(
        ...     np.random.randn(50, 3),
        ...     columns=["a", "b", "c"])
        ...
        >>> st.bar_chart(chart_data)

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=5U5bjR2b3jFwnJdDfSvuRk
           height: 220px

        """
        import streamlit.elements.altair as altair

        chart = altair.generate_chart("bar", data, width, height)
        altair.marshall(element.vega_lite_chart, chart, use_container_width)

    @_with_element
    def vega_lite_chart(
        self,
        element,
        data=None,
        spec=None,
        width=0,
        use_container_width=False,
        **kwargs
    ):
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

        width : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the width directly in the Vega-Lite
            spec. Please refer to the Vega-Lite documentation for details.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Vega-Lite's native `width` value.

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
        ...     'mark': {'type': 'circle', 'tooltip': True},
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

        if width != 0:
            import streamlit as st

            st.warning(
                "The `width` argument in `st.vega_lite_chart` is deprecated and will be removed on 2020-03-04. To set the width, you should instead use Vega-Lite's native `width` argument as described at https://vega.github.io/vega-lite/docs/size.html"
            )

        vega_lite.marshall(
            element.vega_lite_chart,
            data,
            spec,
            use_container_width=use_container_width,
            **kwargs,
        )

    @_with_element
    def altair_chart(self, element, altair_chart, width=0, use_container_width=False):
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.vegalite.v2.api.Chart
            The Altair chart object to display.

        width : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the width directly in the Altair
            spec. Please refer to the Altair documentation for details.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Altair's native `width` value.

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
        ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
        >>>
        >>> st.altair_chart(c, use_container_width=True)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        import streamlit.elements.altair as altair

        if width != 0:
            import streamlit as st

            st.warning(
                "The `width` argument in `st.vega_lite_chart` is deprecated and will be removed on 2020-03-04. To set the width, you should instead use altair's native `width` argument as described at https://altair-viz.github.io/user_guide/generated/toplevel/altair.Chart.html"
            )

        altair.marshall(
            element.vega_lite_chart,
            altair_chart,
            use_container_width=use_container_width,
        )

    @_with_element
    def graphviz_chart(
        self, element, figure_or_dot, width=0, height=0, use_container_width=False
    ):
        """Display a graph using the dagre-d3 library.

        Parameters
        ----------
        figure_or_dot : graphviz.dot.Graph, graphviz.dot.Digraph, str
            The Graphlib graph object or dot string to display

        width : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the width directly in the Graphviz
            spec. Please refer to the Graphviz documentation for details.

        height : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the height directly in the Graphviz
            spec. Please refer to the Graphviz documentation for details.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        Example
        -------

        >>> import streamlit as st
        >>> import graphviz as graphviz
        >>>
        >>> # Create a graphlib graph object
        >>> graph = graphviz.Digraph()
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
           https://share.streamlit.io/0.56.0-xTAd/index.html?id=GBn3GXZie5K1kXuBKe4yQL
           height: 400px

        """
        import streamlit.elements.graphviz_chart as graphviz_chart

        if width != 0 and height != 0:
            import streamlit as st

            st.warning(
                "The `width` and `height` arguments in `st.graphviz` are deprecated and will be removed on 2020-03-04"
            )
        elif width != 0:
            import streamlit as st

            st.warning(
                "The `width` argument in `st.graphviz` is deprecated and will be removed on 2020-03-04"
            )
        elif height != 0:
            import streamlit as st

            st.warning(
                "The `height` argument in `st.graphviz` is deprecated and will be removed on 2020-03-04"
            )

        graphviz_chart.marshall(
            element.graphviz_chart, figure_or_dot, use_container_width
        )

    @_with_element
    def plotly_chart(
        self,
        element,
        figure_or_data,
        width=0,
        height=0,
        use_container_width=False,
        sharing="streamlit",
        **kwargs
    ):
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
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the width directly in the figure.
            Please refer to the Plotly documentation for details.

        height : int
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the height directly in the figure.
            Please refer to the Plotly documentation for details.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        sharing : {'streamlit', 'private', 'secret', 'public'}
            Use 'streamlit' to insert the plot and all its dependencies
            directly in the Streamlit app, which means it works offline too.
            This is the default.
            Use any other sharing mode to send the app to Plotly's servers,
            and embed the result into the Streamlit app. See
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
        >>> st.plotly_chart(fig, use_container_width=True)

        .. output::
           https://share.streamlit.io/0.56.0-xTAd/index.html?id=TuP96xX8JnsoQeUGAPjkGQ
           height: 400px

        """
        # NOTE: "figure_or_data" is the name used in Plotly's .plot() method
        # for their main parameter. I don't like the name, but it's best to
        # keep it in sync with what Plotly calls it.
        import streamlit.elements.plotly_chart as plotly_chart

        if width != 0 and height != 0:
            import streamlit as st

            st.warning(
                "The `width` and `height` arguments in `st.plotly_chart` are deprecated and will be removed on 2020-03-04. To set these values, you should instead use Plotly's native arguments as described at https://plot.ly/python/setting-graph-size/"
            )
        elif width != 0:
            import streamlit as st

            st.warning(
                "The `width` argument in `st.plotly_chart` is deprecated and will be removed on 2020-03-04. To set the width, you should instead use Plotly's native `width` argument as described at https://plot.ly/python/setting-graph-size/"
            )
        elif height != 0:
            import streamlit as st

            st.warning(
                "The `height` argument in `st.plotly_chart` is deprecated and will be removed on 2020-03-04. To set the height, you should instead use Plotly's native `height` argument as described at https://plot.ly/python/setting-graph-size/"
            )

        plotly_chart.marshall(
            element.plotly_chart, figure_or_data, use_container_width, sharing, **kwargs
        )

    @_with_element
    def pyplot(self, element, fig=None, clear_figure=None, **kwargs):
        """Display a matplotlib.pyplot figure.

        Parameters
        ----------
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, which is
            the usual case, this function will render the global plot.

        clear_figure : bool
            If True, the figure will be cleared after being rendered.
            If False, the figure will not be cleared after being rendered.
            If left unspecified, we pick a default based on the value of `fig`.

            * If `fig` is set, defaults to `False`.

            * If `fig` is not set, defaults to `True`. This simulates Jupyter's
              approach to matplotlib rendering.

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
        import streamlit.elements.pyplot as pyplot

        pyplot.marshall(self._get_coordinates, element, fig, clear_figure, **kwargs)

    @_with_element
    def bokeh_chart(self, element, figure, use_container_width=False):
        """Display an interactive Bokeh chart.

        Bokeh is a charting library for Python. The arguments to this function
        closely follow the ones for Bokeh's `show` function. You can find
        more about Bokeh at https://bokeh.pydata.org.

        Parameters
        ----------
        figure : bokeh.plotting.figure.Figure
            A Bokeh figure to plot.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Bokeh's native `width` value.

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
        >>> st.bokeh_chart(p, use_container_width=True)

        .. output::
           https://share.streamlit.io/0.56.0-xTAd/index.html?id=Fdhg51uMbGMLRRxXV6ubzp
           height: 600px

        """
        import streamlit.elements.bokeh_chart as bokeh_chart

        bokeh_chart.marshall(element.bokeh_chart, figure, use_container_width)

    @_with_element
    def image(
        self,
        element,
        image,
        caption=None,
        width=None,
        use_column_width=False,
        clamp=False,
        channels="RGB",
        format="JPEG",
    ):
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
            If True, set the image width to the column width. This takes
            precedence over the `width` parameter.
        clamp : bool
            Clamp image pixel values to a valid range ([0-255] per channel).
            This is only meaningful for byte array images; the parameter is
            ignored for image URLs. If this is not set, and an image has an
            out-of-range value, an error will be thrown.
        channels : 'RGB' or 'BGR'
            If image is an nd.array, this parameter denotes the format used to
            represent color information. Defaults to 'RGB', meaning
            `image[:, :, 0]` is the red channel, `image[:, :, 1]` is green, and
            `image[:, :, 2]` is blue. For images coming from libraries like
            OpenCV you should set this to 'BGR', instead.
        format : 'JPEG' or 'PNG'
            This parameter specifies the image format to use when transferring
            the image data. Defaults to 'JPEG'.

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
        from .elements import image_proto

        if use_column_width:
            width = -2
        elif width is None:
            width = -1
        elif width <= 0:
            raise StreamlitAPIException("Image width must be positive.")

        image_proto.marshall_images(
            self._get_coordinates(),
            image,
            caption,
            width,
            element.imgs,
            clamp,
            channels,
            format,
        )

    @_with_element
    def audio(self, element, data, format="audio/wav", start_time=0):
        """Display an audio player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Raw audio data, filename, or a URL pointing to the file to load.
            Numpy arrays and raw data formats must include all necessary file
            headers to match specified file format.
        start_time: int
            The time from which this element should start playing.
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
        from .elements import media_proto

        media_proto.marshall_audio(
            self._get_coordinates(), element.audio, data, format, start_time
        )

    @_with_element
    def video(self, element, data, format="video/mp4", start_time=0):
        """Display a video player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Raw video data, filename, or URL pointing to a video to load.
            Includes support for YouTube URLs.
            Numpy arrays and raw data formats must include all necessary file
            headers to match specified file format.
        format : str
            The mime type for the video file. Defaults to 'video/mp4'.
            See https://tools.ietf.org/html/rfc4281 for more info.
        start_time: int
            The time from which this element should start playing.

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
        from .elements import media_proto

        media_proto.marshall_video(
            self._get_coordinates(), element.video, data, format, start_time
        )

    @_with_element
    def button(self, element, label, key=None):
        """Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        bool
            If the button was clicked on the last run of the app.

        Example
        -------
        >>> if st.button('Say hello'):
        ...     st.write('Why hello there')
        ... else:
        ...     st.write('Goodbye')

        """
        element.button.label = label
        element.button.default = False

        ui_value = _get_widget_ui_value("button", element, user_key=key)
        current_value = ui_value if ui_value is not None else False
        return current_value

    @_with_element
    def checkbox(self, element, label, value=False, key=None):
        """Display a checkbox widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this checkbox is for.
        value : bool
            Preselect the checkbox when it first renders. This will be
            cast to bool internally.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        bool
            Whether or not the checkbox is checked.

        Example
        -------
        >>> agree = st.checkbox('I agree')
        >>>
        >>> if agree:
        ...     st.write('Great!')

        """
        element.checkbox.label = label
        element.checkbox.default = bool(value)

        ui_value = _get_widget_ui_value("checkbox", element, user_key=key)
        current_value = ui_value if ui_value is not None else value
        return bool(current_value)

    @_with_element
    def multiselect(
        self, element, label, options, default=None, format_func=str, key=None
    ):
        """Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : list, tuple, numpy.ndarray, or pandas.Series
            Labels for the select options. This will be cast to str internally
            by default.
        default: [str] or None
            List of default values.
        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the selectbox.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        [str]
            A list with the selected options

        Example
        -------
        >>> options = st.multiselect(
        ...     'What are your favorite colors',
        ...     ['Green', 'Yellow', 'Red', 'Blue'],
        ...     ['Yellow', 'Red'])
        >>>
        >>> st.write('You selected:', options)

        """

        # Perform validation checks and return indices base on the default values.
        def _check_and_convert_to_indices(options, default_values):
            if default_values is None and None not in options:
                return None

            if not isinstance(default_values, list):
                # This if is done before others because calling if not x (done
                # right below) when x is of type pd.Series() or np.array() throws a
                # ValueError exception.
                if is_type(default_values, "numpy.ndarray") or is_type(
                    default_values, "pandas.core.series.Series"
                ):
                    default_values = list(default_values)
                elif not default_values:
                    default_values = [default_values]
                else:
                    default_values = list(default_values)

            for value in default_values:
                if value not in options:
                    raise StreamlitAPIException(
                        "Every Multiselect default value must exist in options"
                    )

            return [options.index(value) for value in default_values]

        indices = _check_and_convert_to_indices(options, default)
        element.multiselect.label = label
        default_value = [] if indices is None else indices
        element.multiselect.default[:] = default_value
        element.multiselect.options[:] = [
            str(format_func(option)) for option in options
        ]

        ui_value = _get_widget_ui_value("multiselect", element, user_key=key)
        current_value = ui_value.value if ui_value is not None else default_value
        return [options[i] for i in current_value]

    @_with_element
    def radio(self, element, label, options, index=0, format_func=str, key=None):
        """Display a radio button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this radio group is for.
        options : list, tuple, numpy.ndarray, or pandas.Series
            Labels for the radio options. This will be cast to str internally
            by default.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of radio options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the radio.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        any
            The selected option.

        Example
        -------
        >>> genre = st.radio(
        ...     "What\'s your favorite movie genre",
        ...     ('Comedy', 'Drama', 'Documentary'))
        >>>
        >>> if genre == 'Comedy':
        ...     st.write('You selected comedy.')
        ... else:
        ...     st.write("You didn\'t select comedy.")

        """
        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Radio Value has invalid type: %s" % type(index).__name__
            )

        if len(options) > 0 and not 0 <= index < len(options):
            raise StreamlitAPIException(
                "Radio index must be between 0 and length of options"
            )

        element.radio.label = label
        element.radio.default = index
        element.radio.options[:] = [str(format_func(option)) for option in options]

        ui_value = _get_widget_ui_value("radio", element, user_key=key)
        current_value = ui_value if ui_value is not None else index

        return (
            options[current_value]
            if len(options) > 0 and options[current_value] is not None
            else NoValue
        )

    @_with_element
    def selectbox(self, element, label, options, index=0, format_func=str, key=None):
        """Display a select widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : list, tuple, numpy.ndarray, or pandas.Series
            Labels for the select options. This will be cast to str internally
            by default.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of the labels. It receives the option
            as an argument and its output will be cast to str.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        any
            The selected option

        Example
        -------
        >>> option = st.selectbox(
        ...     'How would you like to be contacted?',
        ...     ('Email', 'Home phone', 'Mobile phone'))
        >>>
        >>> st.write('You selected:', option)

        """
        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Selectbox Value has invalid type: %s" % type(index).__name__
            )

        if len(options) > 0 and not 0 <= index < len(options):
            raise StreamlitAPIException(
                "Selectbox index must be between 0 and length of options"
            )

        element.selectbox.label = label
        element.selectbox.default = index
        element.selectbox.options[:] = [str(format_func(option)) for option in options]

        ui_value = _get_widget_ui_value("selectbox", element, user_key=key)
        current_value = ui_value if ui_value is not None else index

        return (
            options[current_value]
            if len(options) > 0 and options[current_value] is not None
            else NoValue
        )

    @_with_element
    def slider(
        self,
        element,
        label,
        min_value=None,
        max_value=None,
        value=None,
        step=None,
        format=None,
        key=None,
    ):
        """Display a slider widget.

        This also allows you to render a range slider by passing a two-element tuple or list as the `value`.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this slider is for.
        min_value : int/float or None
            The minimum permitted value.
            Defaults to 0 if the value is an int, 0.0 otherwise.
        max_value : int/float or None
            The maximum permitted value.
            Defaults 100 if the value is an int, 1.0 otherwise.
        value : int/float or a tuple/list of int/float or None
            The value of the slider when it first renders. If a tuple/list
            of two values is passed here, then a range slider with those lower
            and upper bounds is rendered. For example, if set to `(1, 10)` the
            slider will have a selectable range between 1 and 10.
            Defaults to min_value.
        step : int/float or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 otherwise.
        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. This does not impact the return value.
            Valid formatters: %d %e %f %g %i
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        int/float or tuple of int/float
            The current value of the slider widget. The return type will match
            the data type of the value parameter.

        Examples
        --------
        >>> age = st.slider('How old are you?', 0, 130, 25)
        >>> st.write("I'm ", age, 'years old')

        And here's an example of a range slider:

        >>> values = st.slider(
        ...     'Select a range of values',
        ...     0.0, 100.0, (25.0, 75.0))
        >>> st.write('Values:', values)

        """

        # Set value default.
        if value is None:
            value = min_value if min_value is not None else 0

        # Ensure that the value is either a single value or a range of values.
        single_value = isinstance(value, (int, float))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "Slider value should either be an int/float or a list/tuple of "
                "0 to 2 ints/floats"
            )

        # Ensure that the value is either an int/float or a list/tuple of ints/floats.
        if single_value:
            int_value = isinstance(value, int)
            float_value = isinstance(value, float)
        else:
            int_value = all(map(lambda v: isinstance(v, int), value))
            float_value = all(map(lambda v: isinstance(v, float), value))

        if not int_value and not float_value:
            raise StreamlitAPIException(
                "Slider tuple/list components must be of the same type."
            )

        # Set corresponding defaults.
        if min_value is None:
            min_value = 0 if int_value else 0.0
        if max_value is None:
            max_value = 100 if int_value else 1.0
        if step is None:
            step = 1 if int_value else 0.01

        # Ensure that all arguments are of the same type.
        args = [min_value, max_value, step]
        int_args = all(map(lambda a: isinstance(a, int), args))
        float_args = all(map(lambda a: isinstance(a, float), args))
        if not int_args and not float_args:
            raise StreamlitAPIException(
                "Slider value arguments must be of the same type."
                "\n`value` has %(value_type)s type."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                % {
                    "value_type": type(value).__name__,
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                }
            )

        # Ensure that the value matches arguments' types.
        all_ints = int_value and int_args
        all_floats = float_value and float_args
        if not all_ints and not all_floats:
            raise StreamlitAPIException(
                "Both value and arguments must be of the same type."
                "\n`value` has %(value_type)s type."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                % {
                    "value_type": type(value).__name__,
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                }
            )

        # Ensure that min <= value <= max.
        if single_value:
            if not min_value <= value <= max_value:
                raise StreamlitAPIException(
                    "The default `value` of %(value)s "
                    "must lie between the `min_value` of %(min)s "
                    "and the `max_value` of %(max)s, inclusively."
                    % {"value": value, "min": min_value, "max": max_value}
                )
        elif len(value) == 2:
            start, end = value
            if not min_value <= start <= end <= max_value:
                raise StreamlitAPIException(
                    "The value and/or arguments are out of range."
                )
        else:
            value = [min_value, max_value]

        # Bounds checks. JSNumber produces human-readable exceptions that
        # we simply re-package as StreamlitAPIExceptions.
        # (We check `min_value` and `max_value` here; `value` and `step` are
        # already known to be in the [min_value, max_value] range.)
        try:
            if all_ints:
                JSNumber.validate_int_bounds(min_value, "`min_value`")
                JSNumber.validate_int_bounds(max_value, "`max_value`")
            else:
                JSNumber.validate_float_bounds(min_value, "`min_value`")
                JSNumber.validate_float_bounds(max_value, "`max_value`")
        except JSNumberBoundsException as e:
            raise StreamlitAPIException(str(e))

        # Set format default.
        if format is None:
            if all_ints:
                format = "%d"
            else:
                format = "%0.2f"

        # It would be great if we could guess the number of decimal places from
        # the `step` argument, but this would only be meaningful if step were a
        # decimal. As a possible improvement we could make this function accept
        # decimals and/or use some heuristics for floats.

        element.slider.label = label
        element.slider.format = format
        element.slider.default[:] = [value] if single_value else value
        element.slider.min = min_value
        element.slider.max = max_value
        element.slider.step = step

        ui_value = _get_widget_ui_value("slider", element, user_key=key)
        # Convert the current value to the appropriate type.
        current_value = ui_value if ui_value is not None else value
        # Cast ui_value to the same type as the input arguments
        if ui_value is not None:
            current_value = getattr(ui_value, "value")
            # Convert float array into int array if the rest of the arguments
            # are ints
            if all_ints:
                current_value = list(map(int, current_value))
            # If there is only one value in the array destructure it into a
            # single variable
            current_value = current_value[0] if single_value else current_value
        return current_value if single_value else tuple(current_value)

    @_with_element
    def file_uploader(
        self, element, label, type=None, encoding="auto", key=None,
    ):
        """Display a file uploader widget.

        By default, uploaded files are limited to 200MB. You can configure
        this using the `server.maxUploadSize` config option.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this file uploader is for.
        type : str or list of str or None
            Array of allowed extensions. ['png', 'jpg']
            By default, all extensions are allowed.
        encoding : str or None
            The encoding to use when opening textual files (i.e. non-binary).
            For example: 'utf-8'. If set to 'auto', will try to guess the
            encoding. If None, will assume the file is binary.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        BytesIO or StringIO or or list of BytesIO/StringIO or None
            If no file has been uploaded, returns None. Otherwise, returns
            the data for the uploaded file(s):
            - If the file is in a well-known textual format (or if the encoding
            parameter is set), the file data is a StringIO.
            - Otherwise the file data is BytesIO.
            - If multiple_files is True, a list of file data will be returned.

            Note that BytesIO/StringIO are "file-like", which means you can
            pass them anywhere where a file is expected!

        Examples
        --------
        >>> uploaded_file = st.file_uploader("Choose a CSV file", type="csv")
        >>> if uploaded_file is not None:
        ...     data = pd.read_csv(uploaded_file)
        ...     st.write(data)

        """
        # Don't release this just yet. (When ready to release, turn test back
        # on at file_uploader_test.py)
        accept_multiple_files = False

        if isinstance(type, str):
            type = [type]

        element.file_uploader.label = label
        element.file_uploader.type[:] = type if type is not None else []
        element.file_uploader.max_upload_size_mb = config.get_option(
            "server.maxUploadSize"
        )
        element.file_uploader.multiple_files = accept_multiple_files
        _set_widget_id("file_uploader", element, user_key=key)

        files = None
        ctx = get_report_ctx()
        if ctx is not None:
            files = ctx.uploaded_file_mgr.get_files(
                session_id=ctx.session_id, widget_id=element.file_uploader.id
            )

        if files is None:
            return NoValue

        file_datas = [get_encoded_file_data(file.data, encoding) for file in files]
        return file_datas if accept_multiple_files else file_datas[0]

    @_with_element
    def beta_color_picker(self, element, label, value=None, key=None):
        """Display a color picker widget.

        Note: This is a beta feature. See
        https://docs.streamlit.io/en/latest/pre_release_features.html for more
        information.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : str or None
            The hex value of this widget when it first renders. If None,
            defaults to black.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        str
            The selected color as a hex string.

        Example
        -------
        >>> color = st.beta_color_picker('Pick A Color', '#00f900')
        >>> st.write('The current color is', color)

        """
        # set value default
        if value is None:
            value = "#000000"

        # make sure the value is a string
        if not isinstance(value, str):
            raise StreamlitAPIException(
                """
                Color Picker Value has invalid type: %s. Expects a hex string
                like '#00FFAA' or '#000'.
                """
                % type(value).__name__
            )

        # validate the value and expects a hex string
        match = re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", value)

        if not match:
            raise StreamlitAPIException(
                """
                '%s' is not a valid hex code for colors. Valid ones are like
                '#00FFAA' or '#000'.
                """
                % value
            )

        element.color_picker.label = label
        element.color_picker.default = str(value)

        ui_value = _get_widget_ui_value("color_picker", element, user_key=key)
        current_value = ui_value if ui_value is not None else value

        return str(current_value)

    @_with_element
    def text_input(
        self, element, label, value="", max_chars=None, key=None, type="default"
    ):
        """Display a single-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : any
            The text value of this widget when it first renders. This will be
            cast to str internally.
        max_chars : int or None
            Max number of characters allowed in text input.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        type : str
            The type of the text input. This can be either "default" (for
            a regular text input), or "password" (for a text input that
            masks the user's typed value). Defaults to "default".

        Returns
        -------
        str
            The current value of the text input widget.

        Example
        -------
        >>> title = st.text_input('Movie title', 'Life of Brian')
        >>> st.write('The current movie title is', title)

        """
        element.text_input.label = label
        element.text_input.default = str(value)

        if max_chars is not None:
            element.text_input.max_chars = max_chars

        if type == "default":
            element.text_input.type = TextInput.DEFAULT
        elif type == "password":
            element.text_input.type = TextInput.PASSWORD
        else:
            raise StreamlitAPIException(
                "'%s' is not a valid text_input type. Valid types are 'default' and 'password'."
                % type
            )

        ui_value = _get_widget_ui_value("text_input", element, user_key=key)
        current_value = ui_value if ui_value is not None else value
        return str(current_value)

    @_with_element
    def text_area(
        self, element, label, value="", height=None, max_chars=None, key=None
    ):
        """Display a multi-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : any
            The text value of this widget when it first renders. This will be
            cast to str internally.
        height : int or None
            Desired height of the UI element expressed in pixels. If None, a
            default height is used.
        max_chars : int or None
            Maximum number of characters allowed in text area.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        str
            The current value of the text input widget.

        Example
        -------
        >>> txt = st.text_area('Text to analyze', '''
        ...     It was the best of times, it was the worst of times, it was
        ...     the age of wisdom, it was the age of foolishness, it was
        ...     the epoch of belief, it was the epoch of incredulity, it
        ...     was the season of Light, it was the season of Darkness, it
        ...     was the spring of hope, it was the winter of despair, (...)
        ...     ''')
        >>> st.write('Sentiment:', run_sentiment_analysis(txt))

        """
        element.text_area.label = label
        element.text_area.default = str(value)

        if height is not None:
            element.text_area.height = height

        if max_chars is not None:
            element.text_area.max_chars = max_chars

        ui_value = _get_widget_ui_value("text_area", element, user_key=key)
        current_value = ui_value if ui_value is not None else value
        return str(current_value)

    @_with_element
    def time_input(self, element, label, value=None, key=None):
        """Display a time input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this time input is for.
        value : datetime.time/datetime.datetime
            The value of this widget when it first renders. This will be
            cast to str internally. Defaults to the current time.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        datetime.time
            The current value of the time input widget.

        Example
        -------
        >>> t = st.time_input('Set an alarm for', datetime.time(8, 45))
        >>> st.write('Alarm is set for', t)

        """
        # Set value default.
        if value is None:
            value = datetime.now().time()

        # Ensure that the value is either datetime/time
        if not isinstance(value, datetime) and not isinstance(value, time):
            raise StreamlitAPIException(
                "The type of the value should be either datetime or time."
            )

        # Convert datetime to time
        if isinstance(value, datetime):
            value = value.time()

        element.time_input.label = label
        element.time_input.default = time.strftime(value, "%H:%M")

        ui_value = _get_widget_ui_value("time_input", element, user_key=key)
        current_value = (
            datetime.strptime(ui_value, "%H:%M").time()
            if ui_value is not None
            else value
        )
        return current_value

    @_with_element
    def date_input(
        self,
        element,
        label,
        value=None,
        min_value=datetime.min,
        max_value=None,
        key=None,
    ):
        """Display a date input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this date input is for.
        value : datetime.date or datetime.datetime or list/tuple of datetime.date or datetime.datetime or None
            The value of this widget when it first renders. If a list/tuple with
            0 to 2 date/datetime values is provided, the datepicker will allow
            users to provide a range. Defaults to today as a single-date picker.
        min_value : datetime.date or datetime.datetime
            The minimum selectable date. Defaults to datetime.min.
        max_value : datetime.date or datetime.datetime
            The maximum selectable date. Defaults to today+10y.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        datetime.date
            The current value of the date input widget.

        Example
        -------
        >>> d = st.date_input(
        ...     "When\'s your birthday",
        ...     datetime.date(2019, 7, 6))
        >>> st.write('Your birthday is:', d)

        """
        # Set value default.
        if value is None:
            value = datetime.now().date()

        single_value = isinstance(value, (date, datetime))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "DateInput value should either be an date/datetime or a list/tuple of "
                "0 - 2 date/datetime values"
            )

        if single_value:
            value = [value]

        element.date_input.is_range = range_value

        value = [v.date() if isinstance(v, datetime) else v for v in value]

        element.date_input.label = label
        element.date_input.default[:] = [date.strftime(v, "%Y/%m/%d") for v in value]

        if isinstance(min_value, datetime):
            min_value = min_value.date()

        element.date_input.min = date.strftime(min_value, "%Y/%m/%d")

        if max_value is None:
            today = date.today()
            max_value = date(today.year + 10, today.month, today.day)

        if isinstance(max_value, datetime):
            max_value = max_value.date()

        element.date_input.max = date.strftime(max_value, "%Y/%m/%d")

        ui_value = _get_widget_ui_value("date_input", element, user_key=key)

        if ui_value is not None:
            value = getattr(ui_value, "data")
            value = [datetime.strptime(v, "%Y/%m/%d").date() for v in value]

        if single_value:
            return value[0]
        else:
            return tuple(value)

    @_with_element
    def number_input(
        self,
        element,
        label,
        min_value=None,
        max_value=None,
        value=NoValue(),
        step=None,
        format=None,
        key=None,
    ):
        """Display a numeric input widget.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this input is for.
        min_value : int or float or None
            The minimum permitted value.
            If None, there will be no minimum.
        max_value : int or float or None
            The maximum permitted value.
            If None, there will be no maximum.
        value : int or float or None
            The value of this widget when it first renders.
            Defaults to min_value, or 0.0 if min_value is None
        step : int or float or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 otherwise.
            If the value is not specified, the format parameter will be used.
        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. Output must be purely numeric. This does not impact
            the return value. Valid formatters: %d %e %f %g %i
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        int or float
            The current value of the numeric input widget. The return type
            will match the data type of the value parameter.

        Example
        -------
        >>> number = st.number_input('Insert a number')
        >>> st.write('The current number is ', number)
        """

        if isinstance(value, NoValue):
            if min_value:
                value = min_value
            else:
                value = 0.0  # We set a float as default

        int_value = isinstance(value, numbers.Integral)
        float_value = isinstance(value, float)

        if value is None:
            raise StreamlitAPIException(
                "Default value for number_input should be an int or a float."
            )
        else:
            if format is None:
                format = "%d" if int_value else "%0.2f"

            if format in ["%d", "%u", "%i"] and float_value:
                # Warn user to check if displaying float as int was really intended.
                import streamlit as st

                st.warning(
                    "Warning: NumberInput value below is float, but format {} displays as integer.".format(
                        format
                    )
                )

            if step is None:
                step = 1 if int_value else 0.01

        try:
            float(format % 2)
        except (TypeError, ValueError):
            raise StreamlitAPIException(
                "Format string for st.number_input contains invalid characters: %s"
                % format
            )

        # Ensure that all arguments are of the same type.
        args = [min_value, max_value, step]

        int_args = all(
            map(
                lambda a: (
                    isinstance(a, numbers.Integral) or isinstance(a, type(None))
                ),
                args,
            )
        )
        float_args = all(
            map(lambda a: (isinstance(a, float) or isinstance(a, type(None))), args)
        )

        if not int_args and not float_args:
            raise StreamlitAPIException(
                "All arguments must be of the same type."
                "\n`value` has %(value_type)s type."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                % {
                    "value_type": type(value).__name__,
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                }
            )

        # Ensure that the value matches arguments' types.
        all_ints = int_value and int_args
        all_floats = float_value and float_args

        if not all_ints and not all_floats:
            raise StreamlitAPIException(
                "All numerical arguments must be of the same type."
                "\n`value` has %(value_type)s type."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                "\n`step` has %(step_type)s type."
                % {
                    "value_type": type(value).__name__,
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                    "step_type": type(step).__name__,
                }
            )

        if (min_value and min_value > value) or (max_value and max_value < value):
            raise StreamlitAPIException(
                "The default `value` of %(value)s "
                "must lie between the `min_value` of %(min)s "
                "and the `max_value` of %(max)s, inclusively."
                % {"value": value, "min": min_value, "max": max_value}
            )

        # Bounds checks. JSNumber produces human-readable exceptions that
        # we simply re-package as StreamlitAPIExceptions.
        try:
            if all_ints:
                if min_value is not None:
                    JSNumber.validate_int_bounds(min_value, "`min_value`")
                if max_value is not None:
                    JSNumber.validate_int_bounds(max_value, "`max_value`")
                if step is not None:
                    JSNumber.validate_int_bounds(step, "`step`")
                JSNumber.validate_int_bounds(value, "`value`")
            else:
                if min_value is not None:
                    JSNumber.validate_float_bounds(min_value, "`min_value`")
                if max_value is not None:
                    JSNumber.validate_float_bounds(max_value, "`max_value`")
                if step is not None:
                    JSNumber.validate_float_bounds(step, "`step`")
                JSNumber.validate_float_bounds(value, "`value`")
        except JSNumberBoundsException as e:
            raise StreamlitAPIException(str(e))

        number_input = element.number_input
        number_input.data_type = NumberInput.INT if all_ints else NumberInput.FLOAT
        number_input.label = label
        number_input.default = value

        if min_value is not None:
            number_input.min = min_value
            number_input.has_min = True

        if max_value is not None:
            number_input.max = max_value
            number_input.has_max = True

        if step is not None:
            number_input.step = step

        if format is not None:
            number_input.format = format

        ui_value = _get_widget_ui_value("number_input", element, user_key=key)

        return ui_value if ui_value is not None else value

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
        ...     time.sleep(0.1)
        ...     my_bar.progress(percent_complete + 1)

        """

        # TODO: standardize numerical type checking across st.* functions.

        if isinstance(value, float):
            if 0.0 <= value <= 1.0:
                element.progress.value = int(value * 100)
            else:
                raise StreamlitAPIException(
                    "Progress Value has invalid value [0.0, 1.0]: %f" % value
                )

        elif isinstance(value, int):
            if 0 <= value <= 100:
                element.progress.value = value
            else:
                raise StreamlitAPIException(
                    "Progress Value has invalid value [0, 100]: %d" % value
                )
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid type: %s" % type(value).__name__
            )

    @_with_element
    def empty(self, element):
        """Add a placeholder to the app.

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
    def map(self, element, data=None, zoom=None, use_container_width=True):
        """Display a map with points on it.

        This is a wrapper around st.pydeck_chart to quickly create scatterplot
        charts on top of a map, with auto-centering and auto-zoom.

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The data to be plotted. Must have columns called 'lat', 'lon',
            'latitude', or 'longitude'.
        zoom : int
            Zoom level as specified in
            https://wiki.openstreetmap.org/wiki/Zoom_levels

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
           https://share.streamlit.io/0.53.0-SULT/index.html?id=9gTiomqPEbvHY2huTLoQtH
           height: 600px

        """
        import streamlit.elements.map as streamlit_map

        element.deck_gl_json_chart.json = streamlit_map.to_deckgl_json(data, zoom)
        element.deck_gl_json_chart.use_container_width = use_container_width

    @_with_element
    def deck_gl_chart(self, element, spec=None, use_container_width=False, **kwargs):
        """Draw a map chart using the Deck.GL library.

        This API closely follows Deck.GL's JavaScript API
        (https://deck.gl/#/documentation), with a few small adaptations and
        some syntax sugar.

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------

        spec : dict
            Keys in this dict can be:

            - Anything accepted by Deck.GL's top level element, such as
              "viewport", "height", "width".

            - "layers": a list of dicts containing information to build a new
              Deck.GL layer in the map. Each layer accepts the following keys:

                - "data" : DataFrame
                  The data for the current layer.

                - "type" : str
                  One of the Deck.GL layer types that are currently supported
                  by Streamlit: ArcLayer, GridLayer, HexagonLayer, LineLayer,
                  PointCloudLayer, ScatterplotLayer, ScreenGridLayer,
                  TextLayer.

                - Plus anything accepted by that layer type. The exact keys that
                  are accepted depend on the "type" field, above. For example, for
                  ScatterplotLayer you can set fields like "opacity", "filled",
                  "stroked", and so on.

                  In addition, Deck.GL"s documentation for ScatterplotLayer
                  shows you can use a "getRadius" field to individually set
                  the radius of each circle in the plot. So here you would
                  set "getRadius": "my_column" where "my_column" is the name
                  of the column containing the radius data.

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

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        Example
        -------
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
           https://share.streamlit.io/0.50.0-td2L/index.html?id=3GfRygWqxuqB5UitZLjz9i
           height: 530px

        """

        suppress_deprecation_warning = config.get_option(
            "global.suppressDeprecationWarnings"
        )
        if not suppress_deprecation_warning:
            import streamlit as st

            st.warning(
                """
                The `deck_gl_chart` widget is deprecated and will be removed on
                2020-05-01. To render a map, you should use `st.pydeck_chart` widget.
            """
            )

        import streamlit.elements.deck_gl as deck_gl

        deck_gl.marshall(element.deck_gl_chart, spec, use_container_width, **kwargs)

    @_with_element
    def pydeck_chart(self, element, pydeck_obj=None, use_container_width=False):
        """Draw a chart using the PyDeck library.

        This supports 3D maps, point clouds, and more! More info about PyDeck
        at https://deckgl.readthedocs.io/en/latest/.

        These docs are also quite useful:

        - DeckGL docs: https://github.com/uber/deck.gl/tree/master/docs
        - DeckGL JSON docs: https://github.com/uber/deck.gl/tree/master/modules/json

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------
        spec: pydeck.Deck or None
            Object specifying the PyDeck chart to draw.

        Example
        -------
        Here's a chart using a HexagonLayer and a ScatterplotLayer on top of
        the light map style:

        >>> df = pd.DataFrame(
        ...    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...    columns=['lat', 'lon'])
        >>>
        >>> st.pydeck_chart(pdk.Deck(
        ...     map_style='mapbox://styles/mapbox/light-v9',
        ...     initial_view_state=pdk.ViewState(
        ...         latitude=37.76,
        ...         longitude=-122.4,
        ...         zoom=11,
        ...         pitch=50,
        ...     ),
        ...     layers=[
        ...         pdk.Layer(
        ...            'HexagonLayer',
        ...            data=df,
        ...            get_position='[lon, lat]',
        ...            radius=200,
        ...            elevation_scale=4,
        ...            elevation_range=[0, 1000],
        ...            pickable=True,
        ...            extruded=True,
        ...         ),
        ...         pdk.Layer(
        ...             'ScatterplotLayer',
        ...             data=df,
        ...             get_position='[lon, lat]',
        ...             get_color='[200, 30, 0, 160]',
        ...             get_radius=200,
        ...         ),
        ...     ],
        ... ))

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=ASTdExBpJ1WxbGceneKN1i
           height: 530px

        """
        import streamlit.elements.deck_gl_json_chart as deck_gl_json_chart

        deck_gl_json_chart.marshall(element, pydeck_obj, use_container_width)

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
        >>> # Now the table shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit app contains the data for
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
        if self._container is None or self._cursor is None:
            return self

        if not self._cursor.is_locked:
            raise StreamlitAPIException("Only existing elements can `add_rows`.")

        # Accept syntax st.add_rows(df).
        if data is not None and len(kwargs) == 0:
            name = ""
        # Accept syntax st.add_rows(foo=df).
        elif len(kwargs) == 1:
            name, data = kwargs.popitem()
        # Raise error otherwise.
        else:
            raise StreamlitAPIException(
                "Wrong number of arguments to add_rows()."
                "Command requires exactly one dataset"
            )

        # When doing add_rows on an element that does not already have data
        # (for example, st.line_chart() without any args), call the original
        # st.foo() element with new data instead of doing an add_rows().
        if (
            self._cursor.props["delta_type"] in DELTAS_TYPES_THAT_MELT_DATAFRAMES
            and self._cursor.props["last_index"] is None
        ):
            # IMPORTANT: This assumes delta types and st method names always
            # match!
            st_method_name = self._cursor.props["delta_type"]
            st_method = getattr(self, st_method_name)
            st_method(data, **kwargs)
            return

        data, self._cursor.props["last_index"] = _maybe_melt_data_for_add_rows(
            data, self._cursor.props["delta_type"], self._cursor.props["last_index"]
        )

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.metadata.parent_block.container = self._container
        msg.metadata.parent_block.path[:] = self._cursor.path
        msg.metadata.delta_id = self._cursor.index

        import streamlit.elements.data_frame_proto as data_frame_proto

        data_frame_proto.marshall_data_frame(data, msg.delta.add_rows.data)

        if name:
            msg.delta.add_rows.name = name
            msg.delta.add_rows.has_name = True

        _enqueue_message(msg)

        return self


def _maybe_melt_data_for_add_rows(data, delta_type, last_index):
    import pandas as pd
    import streamlit.elements.data_frame_proto as data_frame_proto

    # For some delta types we have to reshape the data structure
    # otherwise the input data and the actual data used
    # by vega_lite will be different and it will throw an error.
    if delta_type in DELTAS_TYPES_THAT_MELT_DATAFRAMES:
        if not isinstance(data, pd.DataFrame):
            data = type_util.convert_anything_to_df(data)

        if type(data.index) is pd.RangeIndex:
            old_step = _get_pandas_index_attr(data, "step")

            # We have to drop the predefined index
            data = data.reset_index(drop=True)

            old_stop = _get_pandas_index_attr(data, "stop")

            if old_step is None or old_stop is None:
                raise StreamlitAPIException(
                    "'RangeIndex' object has no attribute 'step'"
                )

            start = last_index + old_step
            stop = last_index + old_step + old_stop

            data.index = pd.RangeIndex(start=start, stop=stop, step=old_step)
            last_index = stop - 1

        index_name = data.index.name
        if index_name is None:
            index_name = "index"

        data = pd.melt(data.reset_index(), id_vars=[index_name])

    return data, last_index


def _clean_text(text):
    return textwrap.dedent(str(text)).strip()


def _value_or_dg(value, dg):
    """Return either value, or None, or dg.

    This is needed because Widgets have meaningful return values. This is
    unlike other elements, which always return None. Then we internally replace
    that None with a DeltaGenerator instance.

    However, sometimes a widget may want to return None, and in this case it
    should not be replaced by a DeltaGenerator. So we have a special NoValue
    object that gets replaced by None.

    """
    if value is NoValue:
        return None
    if value is None:
        return dg
    return value


def _enqueue_message(msg):
    """Enqueues a ForwardMsg proto to send to the app."""
    ctx = get_report_ctx()

    if ctx is None:
        raise NoSessionContext()

    ctx.enqueue(msg)
