# Copyright 2018-2021 Streamlit Inc.
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
from typing import Optional, Iterable

import streamlit as st
from streamlit import caching
from streamlit import cursor
from streamlit import type_util
from streamlit import util
from streamlit.cursor import Cursor
from streamlit.report_thread import get_report_ctx
from streamlit.errors import StreamlitAPIException
from streamlit.errors import NoSessionContext
from streamlit.proto import Block_pb2
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.logger import get_logger

from streamlit.elements.balloons import BalloonsMixin
from streamlit.elements.button import ButtonMixin
from streamlit.elements.markdown import MarkdownMixin
from streamlit.elements.text import TextMixin
from streamlit.elements.alert import AlertMixin
from streamlit.elements.json import JsonMixin
from streamlit.elements.doc_string import HelpMixin
from streamlit.elements.exception import ExceptionMixin
from streamlit.elements.bokeh_chart import BokehMixin
from streamlit.elements.graphviz_chart import GraphvizMixin
from streamlit.elements.plotly_chart import PlotlyMixin
from streamlit.elements.deck_gl_json_chart import PydeckMixin
from streamlit.elements.map import MapMixin
from streamlit.elements.iframe import IframeMixin
from streamlit.elements.media import MediaMixin
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
from streamlit.elements.image import ImageMixin
from streamlit.elements.pyplot import PyplotMixin
from streamlit.elements.write import WriteMixin
from streamlit.elements.layouts import LayoutsMixin
from streamlit.elements.form import FormMixin, FormData, current_form_id
from streamlit.state.widgets import NoValue

# DataFrame elements come in two flavors: "Legacy" and "Arrow".
# We select between them with the DataFrameElementSelectorMixin.
from streamlit.elements.arrow import ArrowMixin
from streamlit.elements.arrow_altair import ArrowAltairMixin
from streamlit.elements.arrow_vega_lite import ArrowVegaLiteMixin
from streamlit.elements.legacy_data_frame import LegacyDataFrameMixin
from streamlit.elements.legacy_altair import LegacyAltairMixin
from streamlit.elements.legacy_vega_lite import LegacyVegaLiteMixin
from streamlit.elements.dataframe_selector import DataFrameSelectorMixin

LOGGER = get_logger(__name__)

# Save the type built-in for when we override the name "type".
_type = type

MAX_DELTA_BYTES = 14 * 1024 * 1024  # 14MB

# List of Streamlit commands that perform a Pandas "melt" operation on
# input dataframes.
DELTA_TYPES_THAT_MELT_DATAFRAMES = ("line_chart", "area_chart", "bar_chart")
ARROW_DELTA_TYPES_THAT_MELT_DATAFRAMES = (
    "arrow_line_chart",
    "arrow_area_chart",
    "arrow_bar_chart",
)


class DeltaGenerator(
    AlertMixin,
    BalloonsMixin,
    BokehMixin,
    ButtonMixin,
    CheckboxMixin,
    ColorPickerMixin,
    EmptyMixin,
    ExceptionMixin,
    FileUploaderMixin,
    FormMixin,
    GraphvizMixin,
    HelpMixin,
    IframeMixin,
    ImageMixin,
    LayoutsMixin,
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
    WriteMixin,
    ArrowMixin,
    ArrowAltairMixin,
    ArrowVegaLiteMixin,
    LegacyDataFrameMixin,
    LegacyAltairMixin,
    LegacyVegaLiteMixin,
    DataFrameSelectorMixin,
):
    """Creator of Delta protobuf messages.

    Parameters
    ----------
    root_container: BlockPath_pb2.BlockPath.ContainerValue or None
      The root container for this DeltaGenerator. If None, this is a null
      DeltaGenerator which doesn't print to the app at all (useful for
      testing).

    cursor: cursor.Cursor or None
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
        root_container: Optional[int] = RootContainer.MAIN,
        cursor: Optional[Cursor] = None,
        parent: Optional["DeltaGenerator"] = None,
        block_type: Optional[str] = None,
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
        # Sanity check our Container + Cursor, to ensure that our Cursor
        # is using the same Container that we are.
        if (
            root_container is not None
            and cursor is not None
            and root_container != cursor.root_container
        ):
            raise RuntimeError(
                "DeltaGenerator root_container and cursor.root_container must be the same"
            )

        # Whether this DeltaGenerator is nested in the main area or sidebar.
        # No relation to `st.beta_container()`.
        self._root_container = root_container

        # NOTE: You should never use this directly! Instead, use self._cursor,
        # which is a computed property that fetches the right cursor.
        self._provided_cursor = cursor

        self._parent = parent
        self._block_type = block_type

        # If this an `st.form` block, this will get filled in.
        self._form_data: Optional[FormData] = None

        # Change the module of all mixin'ed functions to be st.delta_generator,
        # instead of the original module (e.g. st.elements.markdown)
        for mixin in self.__class__.__bases__:
            for (name, func) in mixin.__dict__.items():
                if callable(func):
                    func.__module__ = self.__module__

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self):
        # with block started
        ctx = get_report_ctx()
        if ctx:
            ctx.dg_stack.append(self)

    def __exit__(self, type, value, traceback):
        # with block ended
        ctx = get_report_ctx()
        if ctx is not None:
            ctx.dg_stack.pop()

        # Re-raise any exceptions
        return False

    @property
    def _active_dg(self) -> "DeltaGenerator":
        """Return the DeltaGenerator that's currently 'active'.
        If we are the main DeltaGenerator, and are inside a `with` block that
        creates a container, our active_dg is that container. Otherwise,
        our active_dg is self.
        """
        if self == self._main_dg:
            # We're being invoked via an `st.foo` pattern - use the current
            # `with` dg (aka the top of the stack).
            ctx = get_report_ctx()
            if ctx and len(ctx.dg_stack) > 0:
                return ctx.dg_stack[-1]

        # We're being invoked via an `st.sidebar.foo` pattern - ignore the
        # current `with` dg.
        return self

    @property
    def _main_dg(self) -> "DeltaGenerator":
        """Return this DeltaGenerator's root - that is, the top-level ancestor
        DeltaGenerator that we belong to (this generally means the st._main
        DeltaGenerator).
        """
        return self._parent._main_dg if self._parent else self

    def __getattr__(self, name):
        import streamlit as st

        streamlit_methods = [
            method_name for method_name in dir(st) if callable(getattr(st, method_name))
        ]

        def wrapper(*args, **kwargs):
            if name in streamlit_methods:
                if self._root_container == RootContainer.SIDEBAR:
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
    def _parent_block_types(self) -> Iterable[str]:
        """Iterate all the block types used by this DeltaGenerator and all
        its ancestor DeltaGenerators.
        """
        current_dg: Optional[DeltaGenerator] = self
        while current_dg is not None:
            if current_dg._block_type is not None:
                yield current_dg._block_type
            current_dg = current_dg._parent

    @property
    def _cursor(self) -> Optional[Cursor]:
        """Return our Cursor. This will be None if we're not running in a
        ReportThread - e.g., if we're running a "bare" script outside of
        Streamlit.
        """
        if self._provided_cursor is None:
            return cursor.get_container_cursor(self._root_container)
        else:
            return self._provided_cursor

    @property
    def _is_top_level(self) -> bool:
        return self._provided_cursor is None

    def _get_delta_path_str(self) -> str:
        """Returns the element's delta path as a string like "[0, 2, 3, 1]".

        This uniquely identifies the element's position in the front-end,
        which allows (among other potential uses) the MediaFileManager to maintain
        session-specific maps of MediaFile objects placed with their "coordinates".

        This way, users can (say) use st.image with a stream of different images,
        and Streamlit will expire the older images and replace them in place.
        """
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg
        return str(dg._cursor.delta_path) if dg._cursor is not None else "[]"

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
        DeltaGenerator or any
            If this element is NOT an interactive widget, return a
            DeltaGenerator that can be used to modify the newly-created
            element. Otherwise, if the element IS a widget, return the
            `return_value` parameter.

        """
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg
        # Warn if we're called from within an @st.cache function
        caching.maybe_show_cached_st_function_warning(dg, delta_type)

        # Warn if an element is being changed but the user isn't running the streamlit server.
        st._maybe_print_use_warning()

        # Some elements have a method.__name__ != delta_type in proto.
        # This really matters for line_chart, bar_chart & area_chart,
        # since add_rows() relies on method.__name__ == delta_type
        # TODO: Fix for all elements (or the cache warning above will be wrong)
        proto_type = delta_type
        if proto_type in DELTA_TYPES_THAT_MELT_DATAFRAMES:
            proto_type = "vega_lite_chart"

        # Mirror the logic for beta_ elements.
        if proto_type in ARROW_DELTA_TYPES_THAT_MELT_DATAFRAMES:
            proto_type = "arrow_vega_lite_chart"

        # Copy the marshalled proto into the overall msg proto
        msg = ForwardMsg_pb2.ForwardMsg()
        msg_el_proto = getattr(msg.delta.new_element, proto_type)
        msg_el_proto.CopyFrom(element_proto)

        # Only enqueue message and fill in metadata if there's a container.
        msg_was_enqueued = False
        if dg._root_container is not None and dg._cursor is not None:
            msg.metadata.delta_path[:] = dg._cursor.delta_path

            if element_width is not None:
                msg.metadata.element_dimension_spec.width = element_width
            if element_height is not None:
                msg.metadata.element_dimension_spec.height = element_height

            _enqueue_message(msg)
            msg_was_enqueued = True

        if msg_was_enqueued:
            # Get a DeltaGenerator that is locked to the current element
            # position.
            new_cursor = (
                dg._cursor.get_locked_cursor(
                    delta_type=delta_type, last_index=last_index
                )
                if dg._cursor is not None
                else None
            )

            output_dg = DeltaGenerator(
                root_container=dg._root_container,
                cursor=new_cursor,
                parent=dg,
            )
        else:
            # If the message was not enqueued, just return self since it's a
            # no-op from the point of view of the app.
            output_dg = dg

        return _value_or_dg(return_value, output_dg)

    def _block(self, block_proto=Block_pb2.Block()) -> "DeltaGenerator":
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg

        # Prevent nested columns & expanders by checking all parents.
        block_type = block_proto.WhichOneof("type")
        # Convert the generator to a list, so we can use it multiple times.
        parent_block_types = frozenset(dg._parent_block_types)
        if block_type == "column" and block_type in parent_block_types:
            raise StreamlitAPIException(
                "Columns may not be nested inside other columns."
            )
        if block_type == "expandable" and block_type in parent_block_types:
            raise StreamlitAPIException(
                "Expanders may not be nested inside other expanders."
            )

        if dg._root_container is None or dg._cursor is None:
            return dg

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.metadata.delta_path[:] = dg._cursor.delta_path
        msg.delta.add_block.CopyFrom(block_proto)

        # Normally we'd return a new DeltaGenerator that uses the locked cursor
        # below. But in this case we want to return a DeltaGenerator that uses
        # a brand new cursor for this new block we're creating.
        block_cursor = cursor.RunningCursor(
            root_container=dg._root_container,
            parent_path=dg._cursor.parent_path + (dg._cursor.index,),
        )
        block_dg = DeltaGenerator(
            root_container=dg._root_container,
            cursor=block_cursor,
            parent=dg,
            block_type=block_type,
        )
        # Blocks inherit their parent form ids.
        # NOTE: Container form ids aren't set in proto.
        block_dg._form_data = FormData(current_form_id(dg))

        # Must be called to increment this cursor's index.
        dg._cursor.get_locked_cursor(last_index=None)
        _enqueue_message(msg)

        return block_dg

    def legacy_add_rows(self, data=None, **kwargs):
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
        if self._root_container is None or self._cursor is None:
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
            self._cursor.props["delta_type"] in DELTA_TYPES_THAT_MELT_DATAFRAMES
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
        msg.metadata.delta_path[:] = self._cursor.delta_path

        import streamlit.elements.legacy_data_frame as data_frame

        data_frame.marshall_data_frame(data, msg.delta.add_rows.data)

        if name:
            msg.delta.add_rows.name = name
            msg.delta.add_rows.has_name = True

        _enqueue_message(msg)

        return self

    def arrow_add_rows(self, data=None, **kwargs):
        if self._root_container is None or self._cursor is None:
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

        # When doing arrow_add_rows on an element that does not already have data
        # (for example, st._arrow_line_chart() without any args), call the original
        # st.foo() element with new data instead of doing a arrow_add_rows().
        if (
            self._cursor.props["delta_type"] in ARROW_DELTA_TYPES_THAT_MELT_DATAFRAMES
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
        msg.metadata.delta_path[:] = self._cursor.delta_path

        import streamlit.elements.arrow as arrow_proto

        default_uuid = str(hash(self._get_delta_path_str()))
        arrow_proto.marshall(msg.delta.arrow_add_rows.data, data, default_uuid)

        if name:
            msg.delta.arrow_add_rows.name = name
            msg.delta.arrow_add_rows.has_name = True

        _enqueue_message(msg)

        return self


def _maybe_melt_data_for_add_rows(data, delta_type, last_index):
    import pandas as pd

    # For some delta types we have to reshape the data structure
    # otherwise the input data and the actual data used
    # by vega_lite will be different and it will throw an error.
    if (
        delta_type in DELTA_TYPES_THAT_MELT_DATAFRAMES
        or delta_type in ARROW_DELTA_TYPES_THAT_MELT_DATAFRAMES
    ):
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
