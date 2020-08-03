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
import textwrap
import numbers
import re
from datetime import datetime
from datetime import date
from datetime import time
from datetime import timedelta
from datetime import timezone

from streamlit import caching
from streamlit import config
from streamlit import cursor
from streamlit import type_util
from streamlit.report_thread import get_report_ctx
from streamlit.errors import StreamlitAPIException, StreamlitDeprecationWarning
from streamlit.errors import NoSessionContext
from streamlit.file_util import get_encoded_file_data
from streamlit.js_number import JSNumber
from streamlit.js_number import JSNumberBoundsException
from streamlit.proto import BlockPath_pb2
from streamlit.proto import ForwardMsg_pb2
from streamlit.proto.Element_pb2 import Element
from streamlit.proto.NumberInput_pb2 import NumberInput
from streamlit.proto.Slider_pb2 import Slider
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.logger import get_logger
from streamlit.type_util import is_type, ensure_iterable

from streamlit.elements.utils import _get_widget_ui_value, _set_widget_id
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


def _get_pandas_index_attr(data, attr):
    return getattr(data.index, attr, None)


class NoValue(object):
    """Return this from DeltaGenerator.foo_widget() when you want the st.foo_widget()
    call to return None. This is needed because `_enqueue_new_element_delta`
    replaces `None` with a `DeltaGenerator` (for use in non-widget elements).
    """

    pass


class FileUploaderEncodingWarning(StreamlitDeprecationWarning):
    def __init__(self):
        msg = self._get_message()
        config_option = "deprecation.showfileUploaderEncoding"
        super(FileUploaderEncodingWarning, self).__init__(
            msg=msg, config_option=config_option
        )

    def _get_message(self):
        return """
The behavior of `st.file_uploader` will soon change to no longer autodetect
the file's encoding. This means that _all files_ will be returned as binary buffers.

This change will go in effect after August 15, 2020.

If you are expecting a text buffer, you can future-proof your code now by
wrapping the returned buffer in a [`TextIOWrapper`](https://docs.python.org/3/library/io.html#io.TextIOWrapper),
as shown below:

```
import io

file_buffer = st.file_uploader(...)
text_io = io.TextIOWrapper(file_buffer)
```
            """


class ImageFormatWarning(StreamlitDeprecationWarning):
    def __init__(self, format):
        self.format = format

        super(ImageFormatWarning, self).__init__(
            msg=self._get_message(), config_option="deprecation.showImageFormat"
        )

    def _get_message(self):
        return f"""
The `format` parameter for `st.image` has been deprecated and will be removed
or repurposed in the future. We recommend changing to the new `output_format`
parameter to future-proof your code. For the parameter,
`format="{self.format}"`, please use `output_format="{self.format}"` instead.

See [https://github.com/streamlit/streamlit/issues/1137](https://github.com/streamlit/streamlit/issues/1137)
for more information.
            """


class DeltaGenerator(
    AlertMixin,
    AltairMixin,
    BalloonsMixin,
    BokehMixin,
    ButtonMixin,
    DataFrameMixin,
    DeckGlMixin,
    ExceptionMixin,
    GraphvizMixin,
    HelpMixin,
    MarkdownMixin,
    MapMixin,
    PlotlyMixin,
    PydeckMixin,
    JsonMixin,
    TextMixin,
    VegaLiteMixin,
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

    # NOTE: DEPRECATED. Will soon be replaced by _enqueue
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
    def image(
        self,
        element,
        image,
        caption=None,
        width=None,
        use_column_width=False,
        clamp=False,
        channels="RGB",
        output_format="auto",
        **kwargs,
    ):
        """Display an image or list of images.

        Parameters
        ----------
        image : numpy.ndarray, [numpy.ndarray], BytesIO, str, or [str]
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a URL to fetch the image from
            OR an SVG XML string like `<svg xmlns=...</svg>`
            OR a list of one of the above, to display multiple images.
        caption : str or list of str
            Image caption. If displaying multiple images, caption should be a
            list of captions (one for each image).
        width : int or None
            Image width. None means use the image width.
            Should be set for SVG images, as they have no default image width.
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
        output_format : 'JPEG', 'PNG', or 'auto'
            This parameter specifies the format to use when transferring the
            image data. Photos should use the JPEG format for lossy compression
            while diagrams should use the PNG format for lossless compression.
            Defaults to 'auto' which identifies the compression type based
            on the type and format of the image argument.

        Example
        -------
        >>> from PIL import Image
        >>> image = Image.open('sunrise.jpg')
        >>>
        >>> st.image(image, caption='Sunrise by the mountains',
        ...          use_column_width=True)

        .. output::
           https://share.streamlit.io/0.61.0-yRE1/index.html?id=Sn228UQxBfKoE5C7A7Y2Qk
           height: 630px

        """
        from .elements import image_proto

        format = kwargs.get("format")
        if format != None:
            # override output compression type if specified
            output_format = format

            if config.get_option("deprecation.showImageFormat"):
                self.exception(ImageFormatWarning(format))

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
            output_format,
        )

    @_with_element
    def _iframe(
        self, element, src, width=None, height=None, scrolling=False,
    ):
        """Load a remote URL in an iframe.

        Parameters
        ----------
        src : str
            The URL of the page to embed.
        width : int
            The width of the frame in CSS pixels. Defaults to the report's
            default element width.
        height : int
            The height of the frame in CSS pixels. Defaults to 150.
        scrolling : bool
            If True, show a scrollbar when the content is larger than the iframe.
            Otherwise, do not show a scrollbar. Defaults to False.

        """
        from .elements import iframe_proto

        iframe_proto.marshall(
            element.iframe, src=src, width=width, height=height, scrolling=scrolling,
        )

    @_with_element
    def _html(
        self, element, html, width=None, height=None, scrolling=False,
    ):
        """Display an HTML string in an iframe.

        Parameters
        ----------
        html : str
            The HTML string to embed in the iframe.
        width : int
            The width of the frame in CSS pixels. Defaults to the report's
            default element width.
        height : int
            The height of the frame in CSS pixels. Defaults to 150.
        scrolling : bool
            If True, show a scrollbar when the content is larger than the iframe.
            Otherwise, do not show a scrollbar. Defaults to False.

        """
        from .elements import iframe_proto

        iframe_proto.marshall(
            element.iframe,
            srcdoc=html,
            width=width,
            height=height,
            scrolling=scrolling,
        )

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
           https://share.streamlit.io/0.61.0-yRE1/index.html?id=LZLtVFFTf1s41yfPExzRu8
           height: 600px

        .. note::
           Some videos may not display if they are encoded using MP4V (which is an export option in OpenCV), as this codec is
           not widely supported by browsers. Converting your video to H.264 will allow the video to be displayed in Streamlit.
           See this `StackOverflow post <https://stackoverflow.com/a/49535220/2394542>`_ or this
           `Streamlit forum post <https://discuss.streamlit.io/t/st-video-doesnt-show-opencv-generated-mp4/3193/2>`_
           for more information.

        """
        from .elements import media_proto

        media_proto.marshall_video(
            self._get_coordinates(), element.video, data, format, start_time
        )

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

        ui_value = _get_widget_ui_value("checkbox", element.checkbox, user_key=key)
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
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
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

        .. note::
           User experience can be degraded for large lists of `options` (100+), as this widget
           is not designed to handle arbitrary text search efficiently. See this
           `thread <https://discuss.streamlit.io/t/streamlit-loading-column-data-takes-too-much-time/1791>`_
           on the Streamlit community forum for more information and
           `GitHub issue #1059 <https://github.com/streamlit/streamlit/issues/1059>`_ for updates on the issue.

        """
        options = ensure_iterable(options)

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

        ui_value = _get_widget_ui_value(
            "multiselect", element.multiselect, user_key=key
        )
        current_value = ui_value.value if ui_value is not None else default_value
        return [options[i] for i in current_value]

    @_with_element
    def radio(self, element, label, options, index=0, format_func=str, key=None):
        """Display a radio button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this radio group is for.
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the radio options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
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
        options = ensure_iterable(options)

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

        ui_value = _get_widget_ui_value("radio", element.radio, user_key=key)
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
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
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
        options = ensure_iterable(options)

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

        ui_value = _get_widget_ui_value("selectbox", element.selectbox, user_key=key)
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

        This supports int, float, date, time, and datetime types.

        This also allows you to render a range slider by passing a two-element tuple or list as the `value`.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this slider is for.
        min_value : a supported type or None
            The minimum permitted value.
            Defaults to 0 if the value is an int, 0.0 if a float,
            value - timedelta(days=14) if a date/datetime, time.min if a time
        max_value : a supported type or None
            The maximum permitted value.
            Defaults to 100 if the value is an int, 1.0 if a float,
            value + timedelta(days=14) if a date/datetime, time.max if a time
        value : a supported type or a tuple/list of supported types or None
            The value of the slider when it first renders. If a tuple/list
            of two values is passed here, then a range slider with those lower
            and upper bounds is rendered. For example, if set to `(1, 10)` the
            slider will have a selectable range between 1 and 10.
            Defaults to min_value.
        step : int/float/timedelta or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 if a float,
            timedelta(days=1) if a date/datetime, timedelta(minutes=15) if a time
            (or if max_value - min_value < 1 day)
        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. This does not impact the return value.
            Formatter for int/float supports: %d %e %f %g %i
            Formatter for date/time/datetime uses Moment.js notation:
            https://momentjs.com/docs/#/displaying/format/
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        int/float/date/time/datetime or tuple of int/float/date/time/datetime
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

        This is a range time slider:

        >>> from datetime import time
        >>> appointment = st.slider(
        ...     "Schedule your appointment:",
        ...     value=(time(11, 30), time(12, 45)))
        >>> st.write("You're scheduled for:", appointment)

        Finally, a datetime slider:

        >>> from datetime import datetime
        >>> start_time = st.slider(
        ...     "When do you start?",
        ...     value=datetime(2020, 1, 1, 9, 30),
        ...     format="MM/DD/YY - hh:mm")
        >>> st.write("Start time:", start_time)

        """

        # Set value default.
        if value is None:
            value = min_value if min_value is not None else 0

        SUPPORTED_TYPES = {
            int: Slider.INT,
            float: Slider.FLOAT,
            datetime: Slider.DATETIME,
            date: Slider.DATE,
            time: Slider.TIME,
        }
        TIMELIKE_TYPES = (Slider.DATETIME, Slider.TIME, Slider.DATE)

        # Ensure that the value is either a single value or a range of values.
        single_value = isinstance(value, tuple(SUPPORTED_TYPES.keys()))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "Slider value should either be an int/float/datetime or a list/tuple of "
                "0 to 2 ints/floats/datetimes"
            )

        # Simplify future logic by always making value a list
        if single_value:
            value = [value]

        def all_same_type(items):
            return len(set(map(type, items))) < 2

        if not all_same_type(value):
            raise StreamlitAPIException(
                "Slider tuple/list components must be of the same type.\n"
                f"But were: {list(map(type, value))}"
            )

        if len(value) == 0:
            data_type = Slider.INT
        else:
            data_type = SUPPORTED_TYPES[type(value[0])]

        datetime_min = time.min
        datetime_max = time.max
        if data_type == Slider.TIME:
            datetime_min = time.min.replace(tzinfo=value[0].tzinfo)
            datetime_max = time.max.replace(tzinfo=value[0].tzinfo)
        if data_type in (Slider.DATETIME, Slider.DATE):
            datetime_min = value[0] - timedelta(days=14)
            datetime_max = value[0] + timedelta(days=14)

        DEFAULTS = {
            Slider.INT: {"min_value": 0, "max_value": 100, "step": 1, "format": "%d"},
            Slider.FLOAT: {
                "min_value": 0.0,
                "max_value": 1.0,
                "step": 0.01,
                "format": "%0.2f",
            },
            Slider.DATETIME: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(days=1),
                "format": "YYYY-MM-DD",
            },
            Slider.DATE: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(days=1),
                "format": "YYYY-MM-DD",
            },
            Slider.TIME: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(minutes=15),
                "format": "HH:mm",
            },
        }

        if min_value is None:
            min_value = DEFAULTS[data_type]["min_value"]
        if max_value is None:
            max_value = DEFAULTS[data_type]["max_value"]
        if step is None:
            step = DEFAULTS[data_type]["step"]
            if data_type in (
                Slider.DATETIME,
                Slider.DATE,
            ) and max_value - min_value < timedelta(days=1):
                step = timedelta(minutes=15)
        if format is None:
            format = DEFAULTS[data_type]["format"]

        # Ensure that all arguments are of the same type.
        args = [min_value, max_value, step]
        int_args = all(map(lambda a: isinstance(a, int), args))
        float_args = all(map(lambda a: isinstance(a, float), args))
        # When min and max_value are the same timelike, step should be a timedelta
        timelike_args = (
            data_type in TIMELIKE_TYPES
            and isinstance(step, timedelta)
            and type(min_value) == type(max_value)
        )

        if not int_args and not float_args and not timelike_args:
            raise StreamlitAPIException(
                "Slider value arguments must be of matching types."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                "\n`step` has %(step)s type."
                % {
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                    "step": type(step).__name__,
                }
            )

        # Ensure that the value matches arguments' types.
        all_ints = data_type == Slider.INT and int_args
        all_floats = data_type == Slider.FLOAT and float_args
        all_timelikes = data_type in TIMELIKE_TYPES and timelike_args

        if not all_ints and not all_floats and not all_timelikes:
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

        # Ensure that min <= value(s) <= max, adjusting the bounds as necessary.
        min_value = min(min_value, max_value)
        max_value = max(min_value, max_value)
        if len(value) == 1:
            min_value = min(value[0], min_value)
            max_value = max(value[0], max_value)
        elif len(value) == 2:
            start, end = value
            if start > end:
                # Swap start and end, since they seem reversed
                start, end = end, start
                value = start, end
            min_value = min(start, min_value)
            max_value = max(end, max_value)
        else:
            # Empty list, so let's just use the outer bounds
            value = [min_value, max_value]

        # Bounds checks. JSNumber produces human-readable exceptions that
        # we simply re-package as StreamlitAPIExceptions.
        # (We check `min_value` and `max_value` here; `value` and `step` are
        # already known to be in the [min_value, max_value] range.)
        try:
            if all_ints:
                JSNumber.validate_int_bounds(min_value, "`min_value`")
                JSNumber.validate_int_bounds(max_value, "`max_value`")
            elif all_floats:
                JSNumber.validate_float_bounds(min_value, "`min_value`")
                JSNumber.validate_float_bounds(max_value, "`max_value`")
            elif all_timelikes:
                # No validation yet. TODO: check between 0001-01-01 to 9999-12-31
                pass
        except JSNumberBoundsException as e:
            raise StreamlitAPIException(str(e))

        # Convert dates or times into datetimes
        if data_type == Slider.TIME:

            def _time_to_datetime(time):
                # Note, here we pick an arbitrary date well after Unix epoch.
                # This prevents pre-epoch timezone issues (https://bugs.python.org/issue36759)
                # We're dropping the date from datetime laters, anyways.
                return datetime.combine(date(2000, 1, 1), time)

            value = list(map(_time_to_datetime, value))
            min_value = _time_to_datetime(min_value)
            max_value = _time_to_datetime(max_value)

        if data_type == Slider.DATE:

            def _date_to_datetime(date):
                return datetime.combine(date, time())

            value = list(map(_date_to_datetime, value))
            min_value = _date_to_datetime(min_value)
            max_value = _date_to_datetime(max_value)

        # Now, convert to microseconds (so we can serialize datetime to a long)
        if data_type in TIMELIKE_TYPES:
            SECONDS_TO_MICROS = 1000 * 1000
            DAYS_TO_MICROS = 24 * 60 * 60 * SECONDS_TO_MICROS

            def _delta_to_micros(delta):
                return (
                    delta.microseconds
                    + delta.seconds * SECONDS_TO_MICROS
                    + delta.days * DAYS_TO_MICROS
                )

            UTC_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

            def _datetime_to_micros(dt):
                # If dt is naive, Python converts from local time
                utc_dt = dt.astimezone(timezone.utc)
                return _delta_to_micros(utc_dt - UTC_EPOCH)

            # Restore times/datetimes to original timezone (dates are always naive)
            orig_tz = (
                value[0].tzinfo if data_type in (Slider.TIME, Slider.DATETIME) else None
            )

            def _micros_to_datetime(micros):
                utc_dt = UTC_EPOCH + timedelta(microseconds=micros)
                # Convert from utc back to original time (local time if naive)
                return utc_dt.astimezone(orig_tz).replace(tzinfo=orig_tz)

            value = list(map(_datetime_to_micros, value))
            min_value = _datetime_to_micros(min_value)
            max_value = _datetime_to_micros(max_value)
            step = _delta_to_micros(step)

        # It would be great if we could guess the number of decimal places from
        # the `step` argument, but this would only be meaningful if step were a
        # decimal. As a possible improvement we could make this function accept
        # decimals and/or use some heuristics for floats.

        element.slider.label = label
        element.slider.format = format
        element.slider.default[:] = value
        element.slider.min = min_value
        element.slider.max = max_value
        element.slider.step = step
        element.slider.data_type = data_type

        ui_value = _get_widget_ui_value("slider", element.slider, user_key=key)
        if ui_value:
            current_value = getattr(ui_value, "value")
        else:
            # Widget has not been used; fallback to the original value,
            current_value = value
        # The widget always returns a float array, so fix the return type if necessary
        if data_type == Slider.INT:
            current_value = list(map(int, current_value))
        if data_type == Slider.DATETIME:
            current_value = [_micros_to_datetime(int(v)) for v in current_value]
        if data_type == Slider.DATE:
            current_value = [_micros_to_datetime(int(v)).date() for v in current_value]
        if data_type == Slider.TIME:
            current_value = [
                _micros_to_datetime(int(v)).time().replace(tzinfo=orig_tz)
                for v in current_value
            ]
        # If the original value was a list/tuple, so will be the output (and vice versa)
        return current_value[0] if single_value else tuple(current_value)

    @_with_element
    def file_uploader(self, element, label, type=None, key=None, **kwargs):
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

        encoding = kwargs.get("encoding")
        has_encoding = "encoding" in kwargs
        show_deprecation_warning = config.get_option(
            "deprecation.showfileUploaderEncoding"
        )

        if show_deprecation_warning and (
            (has_encoding and encoding is not None) or not has_encoding
        ):
            self.exception(FileUploaderEncodingWarning())

        if not has_encoding:
            encoding = "auto"

        element.file_uploader.label = label
        element.file_uploader.type[:] = type if type is not None else []
        element.file_uploader.max_upload_size_mb = config.get_option(
            "server.maxUploadSize"
        )
        element.file_uploader.multiple_files = accept_multiple_files
        _set_widget_id("file_uploader", element.file_uploader, user_key=key)

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

        ui_value = _get_widget_ui_value(
            "color_picker", element.color_picker, user_key=key
        )
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

        ui_value = _get_widget_ui_value("text_input", element.text_input, user_key=key)
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

        ui_value = _get_widget_ui_value("text_area", element.text_area, user_key=key)
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

        ui_value = _get_widget_ui_value("time_input", element.time_input, user_key=key)
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

        ui_value = _get_widget_ui_value("date_input", element.date_input, user_key=key)

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

        ui_value = _get_widget_ui_value(
            "number_input", element.number_input, user_key=key
        )

        return ui_value if ui_value is not None else value

    @_with_element
    def progress(self, element, value):
        """Display a progress bar.

        Parameters
        ----------
        value : int or float
            0 <= value <= 100 for int

            0.0 <= value <= 1.0 for float

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
