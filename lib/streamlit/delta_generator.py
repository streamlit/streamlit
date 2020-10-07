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

from streamlit import caching
from streamlit import cursor
from streamlit import type_util
from streamlit.report_thread import get_report_ctx
from streamlit.errors import StreamlitAPIException, StreamlitDeprecationWarning
from streamlit.errors import NoSessionContext
from streamlit.proto import Block_pb2
from streamlit.proto import BlockPath_pb2
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto.Element_pb2 import Element
from streamlit.proto.Delta_pb2 import Delta as DeltaProto
from streamlit.logger import get_logger

from streamlit.elements.utils import NoValue
from streamlit.elements.balloons import BalloonsMixin
from streamlit.elements.button import ButtonMixin
from streamlit.elements.markdown import MarkdownMixin
from streamlit.elements.text import TextMixin
from streamlit.elements.alert import AlertMixin
from streamlit.elements.json import JsonMixin
from streamlit.elements.doc_string import HelpMixin
from streamlit.elements.exception_proto import ExceptionMixin
from streamlit.elements.data_frame_proto import DataFrameMixin
from streamlit.elements.altair import AltairMixin
from streamlit.elements.bokeh_chart import BokehMixin
from streamlit.elements.graphviz_chart import GraphvizMixin
from streamlit.elements.plotly_chart import PlotlyMixin
from streamlit.elements.vega_lite import VegaLiteMixin
from streamlit.elements.deck_gl_json_chart import PydeckMixin
from streamlit.elements.map import MapMixin
from streamlit.elements.iframe_proto import IframeMixin
from streamlit.elements.media_proto import MediaMixin
from streamlit.elements.checkbox import CheckboxMixin
from streamlit.elements.multiselect import MultiSelectMixin
from streamlit.elements.radio import RadioMixin
from streamlit.elements.selectbox import SelectboxMixin
from streamlit.elements.text_widgets import TextWidgetsMixin
from streamlit.elements.time_widgets import TimeWidgetsMixin
from streamlit.elements.progress import ProgressMixin
from streamlit.elements.empty import EmptyMixin
from streamlit.elements.number_input import NumberInputMixin
from streamlit.elements.color_picker import ColorPickerMixin
from streamlit.elements.file_uploader import FileUploaderMixin
from streamlit.elements.select_slider import SelectSliderMixin
from streamlit.elements.slider import SliderMixin
from streamlit.elements.image_proto import ImageMixin
from streamlit.elements.pyplot import PyplotMixin
from streamlit.elements.write import WriteMixin

LOGGER = get_logger(__name__)

# Save the type built-in for when we override the name "type".
_type = type

MAX_DELTA_BYTES = 14 * 1024 * 1024  # 14MB

# List of Streamlit commands that perform a Pandas "melt" operation on
# input dataframes.
DELTAS_TYPES_THAT_MELT_DATAFRAMES = ("line_chart", "area_chart", "bar_chart")


class DeltaGenerator(
    AlertMixin,
    AltairMixin,
    BalloonsMixin,
    BokehMixin,
    ButtonMixin,
    CheckboxMixin,
    ColorPickerMixin,
    DataFrameMixin,
    EmptyMixin,
    ExceptionMixin,
    FileUploaderMixin,
    GraphvizMixin,
    HelpMixin,
    IframeMixin,
    ImageMixin,
    MarkdownMixin,
    MapMixin,
    MediaMixin,
    MultiSelectMixin,
    NumberInputMixin,
    PlotlyMixin,
    ProgressMixin,
    PydeckMixin,
    PyplotMixin,
    RadioMixin,
    SelectboxMixin,
    SelectSliderMixin,
    SliderMixin,
    JsonMixin,
    TextMixin,
    TextWidgetsMixin,
    TimeWidgetsMixin,
    VegaLiteMixin,
    WriteMixin,
):
    """Creator of Delta protobuf messages.

    Parameters
    ----------
    container: BlockPath_pb2.BlockPath or None
      The root container for this DeltaGenerator. If None, this is a null
      DeltaGenerator which doesn't print to the app at all (useful for
      testing).

    cursor: cursor.AbstractCursor or None
      This is either:
      - None: if this is the running DeltaGenerator for a top-level
        container (MAIN or SIDEBAR)
      - RunningCursor: if this is the running DeltaGenerator for a
        non-top-level container (created with dg.container())
      - LockedCursor: if this is a locked DeltaGenerator returned by some
        other DeltaGenerator method. E.g. the dg returned in dg =
        st.text("foo").

    parent: DeltaGenerator
      To support the `with dg` notation, DGs are arranged as a tree. Each DG
      remembers its own parent, and the root of the tree is the main DG.

    block_type: None or "vertical" or "horizontal" or "column" or "expandable"
      If this is a block DG, we track its type to prevent nested columns/expanders

    """

    # The pydoc below is for user consumption, so it doesn't talk about
    # DeltaGenerator constructor parameters (which users should never use). For
    # those, see above.
    def __init__(
        self,
        container=BlockPath_pb2.BlockPath.MAIN,
        cursor=None,
        parent=None,
        block_type=None,
    ):
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
        # Whether this DeltaGenerator is nested in the main area or sidebar.
        # No relation to `st.beta_container()`.
        self._container = container

        # NOTE: You should never use this! Instead use self._cursor, which is a
        # computed property that fetches the right cursor.
        self._provided_cursor = cursor

        self._parent = parent
        self._block_type = block_type

        # Stack of DGs used for the `with` block. The current one is at the end.
        # NOTE: Only the main DG should ever reference this.
        # You should use the computed property _active_dg instead.
        self._with_dg_stack = [self]

        # Change the module of all mixin'ed functions to be st.delta_generator,
        # instead of the original module (e.g. st.elements.markdown)
        for mixin in self.__class__.__bases__:
            for (name, func) in mixin.__dict__.items():
                if callable(func):
                    func.__module__ = self.__module__

    def __enter__(self):
        # with block started
        self._main_dg._with_dg_stack.append(self)

    def __exit__(self, type, value, traceback):
        # with block ended
        self._main_dg._with_dg_stack.pop()
        # Re-raise any exceptions
        return False

    @property
    def _active_dg(self):
        if self == self._main_dg:
            # `st.button`: Use the current `with` dg (aka the top of the stack)
            return self._with_dg_stack[-1]
        else:
            # `st.sidebar.button`: Ignore the `with` dg
            return self

    @property
    def _main_dg(self):
        # Recursively traverse up the tree to find the main DG (parent = None)
        return self._parent._main_dg if self._parent else self

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
    def _parent_block_types(self):
        current_dg = self
        while current_dg:
            yield current_dg._block_type
            current_dg = current_dg._parent

    @property
    def _cursor(self):
        if self._provided_cursor is None:
            return cursor.get_container_cursor(self._container)
        else:
            return self._provided_cursor

    @property
    def _is_top_level(self):
        return self._provided_cursor is None

    def _get_coordinates(self):
        """Returns the element's 4-component location as string like "M.(1,2).3".

        This function uniquely identifies the element's position in the front-end,
        which allows (among other potential uses) the MediaFileManager to maintain
        session-specific maps of MediaFile objects placed with their "coordinates".

        This way, users can (say) use st.image with a stream of different images,
        and Streamlit will expire the older images and replace them in place.
        """
        # Switch to the active DeltaGenerator, in case we're in a `with` block.
        self = self._active_dg
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

    def _enqueue(
        self,
        delta_type,
        element_proto,
        return_value=None,
        last_index=None,
        element_width=None,
        element_height=None,
    ):
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        delta_type: string
            The name of the streamlit method being called
        element_proto: proto
            The actual proto in the NewElement type e.g. Alert/Button/Slider
        return_value: any or None
            The value to return to the calling script (for widgets)
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
        # Switch to the active DeltaGenerator, in case we're in a `with` block.
        self = self._active_dg
        # Warn if we're called from within an @st.cache function
        caching.maybe_show_cached_st_function_warning(self, delta_type)

        # Some elements have a method.__name__ != delta_type in proto.
        # This really matters for line_chart, bar_chart & area_chart,
        # since add_rows() relies on method.__name__ == delta_type
        # TODO: Fix for all elements (or the cache warning above will be wrong)
        proto_type = delta_type
        if proto_type in DELTAS_TYPES_THAT_MELT_DATAFRAMES:
            proto_type = "vega_lite_chart"

        # Copy the marshalled proto into the overall msg proto
        msg = ForwardMsg_pb2.ForwardMsg()
        msg_el_proto = getattr(msg.delta.new_element, proto_type)
        msg_el_proto.CopyFrom(element_proto)

        # Only enqueue message and fill in metadata if there's a container.
        msg_was_enqueued = False
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
                parent=self,
            )
        else:
            # If the message was not enqueued, just return self since it's a
            # no-op from the point of view of the app.
            output_dg = self

        return _value_or_dg(return_value, output_dg)

    def beta_container(self):
        """Insert a multi-element container.

        Inserts an invisible container into your app that can be used to hold
        multiple elements. This allows you to, for example, insert multiple
        elements into your app out of order.

        To add elements to the returned container, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        Examples
        --------

        Inserting elements using "with" notation:

        >>> with st.beta_container():
        ...    st.write("This is inside the container")
        ...
        ...    # You can call any Streamlit command, including custom components:
        ...    st.bar_chart(np.random.randn(50, 3))
        ...
        >>> st.write("This is outside the container")

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=Qj8PY3v3L8dgVjjQCreHux
            height: 420px

        Inserting elements out of order:

        >>> container = st.beta_container()
        >>> container.write("This is inside the container")
        >>> st.write("This is outside the container")
        >>>
        >>> # Now insert some more in the container
        >>> container.write("This is inside too")

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=GsFVF5QYT3Ljr6jQjErPqL
        """
        return self._block()

    # TODO: Enforce that columns are not nested or in Sidebar
    def beta_columns(self, spec):
        """Insert containers laid out as side-by-side columns.

        Inserts a number of multi-element containers laid out side-by-side and
        returns a list of container objects.

        To add elements to the returned containers, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            Currently, you may not put columns inside another column.

        Parameters
        ----------
        spec : int or list of numbers
            If an int
                Specifies the number of columns to insert, and all columns
                have equal width.

            If a list of numbers
                Creates a column for each number, and each
                column's width is proportional to the number provided. Numbers can
                be ints or floats, but they must be positive.

                For example, `st.beta_columns([3, 1, 2])` creates 3 columns where
                the first column is 3 times the width of the second, and the last
                column is 2 times that width.

        Returns
        -------
        list of containers
            A list of container objects.

        Examples
        --------

        You can use `with` notation to insert any element into a column:

        >>> col1, col2, col3 = st.beta_columns(3)
        >>>
        >>> with col1:
        ...    st.header("A cat")
        ...    st.image("https://static.streamlit.io/examples/cat.jpg", use_column_width=True)
        ...
        >>> with col2:
        ...    st.header("A dog")
        ...    st.image("https://static.streamlit.io/examples/dog.jpg", use_column_width=True)
        ...
        >>> with col3:
        ...    st.header("An owl")
        ...    st.image("https://static.streamlit.io/examples/owl.jpg", use_column_width=True)

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=VW45Va5XmSKed2ayzf7vYa
            height: 550px

        Or you can just call methods directly in the returned objects:

        >>> col1, col2 = st.beta_columns([3, 1])
        >>> data = np.random.randn(10, 1)
        >>>
        >>> col1.subheader("A wide column with a chart")
        >>> col1.line_chart(data)
        >>>
        >>> col2.subheader("A narrow column with the data")
        >>> col2.write(data)

        .. output ::
            https://static.streamlit.io/0.66.0-Wnid/index.html?id=XSQ6VkonfGcT2AyNYMZN83
            height: 400px

        """
        weights = spec
        weights_exception = StreamlitAPIException(
            "The input argument to st.beta_columns must be either a "
            + "positive integer or a list of positive numeric weights. "
            + "See [documentation](https://docs.streamlit.io/en/stable/api.html#streamlit.beta_columns) "
            + "for more information."
        )

        if isinstance(weights, int):
            # If the user provided a single number, expand into equal weights.
            # E.g. (1,) * 3 => (1, 1, 1)
            # NOTE: A negative/zero spec will expand into an empty tuple.
            weights = (1,) * weights

        if len(weights) == 0 or any(weight <= 0 for weight in weights):
            raise weights_exception

        def column_proto(weight):
            col_proto = Block_pb2.Block()
            col_proto.column.weight = weight
            col_proto.allow_empty = True
            return col_proto

        horiz_proto = Block_pb2.Block()
        horiz_proto.horizontal.total_weight = sum(weights)
        row = self._block(horiz_proto)
        return [row._block(column_proto(w)) for w in weights]

    # Internal block element, to hide the 'layout' param from our users.
    def _block(self, block_proto=Block_pb2.Block()):
        # Switch to the active DeltaGenerator, in case we're in a `with` block.
        self = self._active_dg

        # Prevent nested columns & expanders by checking all parents.
        block_type = block_proto.WhichOneof("type")
        # Convert the generator to a list, so we can use it multiple times.
        parent_block_types = [t for t in self._parent_block_types]
        if block_type == "column" and block_type in parent_block_types:
            raise StreamlitAPIException(
                "Columns may not be nested inside other columns."
            )
        if block_type == "expandable" and block_type in parent_block_types:
            raise StreamlitAPIException(
                "Expanders may not be nested inside other expanders."
            )

        if self._container is None or self._cursor is None:
            return self

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.metadata.parent_block.container = self._container
        msg.metadata.parent_block.path[:] = self._cursor.path
        msg.metadata.delta_id = self._cursor.index
        msg.delta.add_block.CopyFrom(block_proto)

        # Normally we'd return a new DeltaGenerator that uses the locked cursor
        # below. But in this case we want to return a DeltaGenerator that uses
        # a brand new cursor for this new block we're creating.
        block_cursor = cursor.RunningCursor(
            path=self._cursor.path + (self._cursor.index,)
        )
        block_dg = DeltaGenerator(
            container=self._container,
            cursor=block_cursor,
            parent=self,
            block_type=block_type,
        )

        # Must be called to increment this cursor's index.
        self._cursor.get_locked_cursor(last_index=None)
        _enqueue_message(msg)

        return block_dg

    def beta_expander(self, label=None, expanded=False):
        """Insert a multi-element container that can be expanded/collapsed.

        Inserts a container into your app that can be used to hold multiple elements
        and can be expanded or collapsed by the user. When collapsed, all that is
        visible is the provided label.

        To add elements to the returned container, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
        examples below.

        .. warning::
            Currently, you may not put expanders inside another expander.

        Parameters
        ----------
        label : str
            A string to use as the header for the expander.
        expanded : bool
            If True, initializes the expander in "expanded" state. Defaults to
            False (collapsed).

        Examples
        --------
        >>> st.line_chart({"data": [1, 5, 2, 6, 2, 1]})
        >>>
        >>> with st.beta_expander("See explanation"):
        ...     st.write(\"\"\"
        ...         The chart above shows some numbers I picked for you.
        ...         I rolled actual dice for these, so they're *guaranteed* to
        ...         be random.
        ...     \"\"\").
        ...     st.image("https://static.streamlit.io/examples/dice.jpg")

        .. output ::
            https://static.streamlit.io/0.66.0-2BLtg/index.html?id=LzfUAiT1eM9Xy8EDMRkWyF
            height: 750px

        """
        if label is None:
            raise StreamlitAPIException("A label is required for an expander")

        expandable_proto = Block_pb2.Block.Expandable()
        expandable_proto.expanded = expanded
        expandable_proto.label = label

        block_proto = Block_pb2.Block()
        block_proto.allow_empty = True
        block_proto.expandable.CopyFrom(expandable_proto)

        return self._block(block_proto=block_proto)

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


def _get_pandas_index_attr(data, attr):
    return getattr(data.index, attr, None)


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
