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
from streamlit.proto import BlockPath_pb2
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto.Element_pb2 import Element
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
from streamlit.elements.deck_gl import DeckGlMixin
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
    DeckGlMixin,
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
        #   container (MAIN or SIDEBAR)
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

        # Change the module of all mixin'ed functions to be st.delta_generator,
        # instead of the original module (e.g. st.elements.markdown)
        for mixin in self.__class__.__bases__:
            for (name, func) in mixin.__dict__.items():
                if callable(func):
                    func.__module__ = self.__module__

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
            )
        else:
            # If the message was not enqueued, just return self since it's a
            # no-op from the point of view of the app.
            output_dg = self

        return _value_or_dg(return_value, output_dg)

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

    def favicon(
        self, element, image, clamp=False, channels="RGB", format="JPEG",
    ):
        """Set the page favicon to the specified image.

        This supports the same parameters as `st.image`.

        Note: This is a beta feature. See
        https://docs.streamlit.io/en/latest/pre_release_features.html for more
        information.

        Parameters
        ----------
        image : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a URL to fetch the image from
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
        >>> st.beta_set_favicon(image)

        """
        from .elements import image_proto

        width = -1  # Always use full width for favicons
        element.favicon.url = image_proto.image_to_url(
            image, width, clamp, channels, format, image_id="favicon", allow_emoji=True
        )

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
