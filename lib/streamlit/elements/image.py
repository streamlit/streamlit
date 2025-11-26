# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Some casts in this file are only occasionally necessary depending on the
# user's Python version, and mypy doesn't have a good way of toggling this
# specific config option at a per-line level.
# mypy: no-warn-unused-ignores

"""Image marshalling."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, TypeAlias, cast

from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.elements.lib.image_utils import (
    Channels,
    ImageFormatOrAuto,
    ImageOrImageList,
    marshall_images,
)
from streamlit.elements.lib.layout_utils import LayoutConfig, Width, validate_width
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

UseColumnWith: TypeAlias = Literal["auto", "always", "never"] | bool | None


class ImageMixin:
    @gather_metrics("image")
    def image(
        self,
        image: ImageOrImageList,
        # TODO: Narrow type of caption, dependent on type of image,
        #  by way of overload
        caption: str | list[str] | None = None,
        width: Width = "content",
        use_column_width: UseColumnWith = None,
        clamp: bool = False,
        channels: Channels = "RGB",
        output_format: ImageFormatOrAuto = "auto",
        *,
        use_container_width: bool | None = None,
    ) -> DeltaGenerator:
        """Display an image or list of images.

        Parameters
        ----------
        image : numpy.ndarray, BytesIO, str, Path, or list of these
            The image to display. This can be one of the following:

            - A URL (string) for a hosted image.
            - A path to a local image file. The path can be a ``str``
              or ``Path`` object. Paths can be absolute or relative to the
              working directory (where you execute ``streamlit run``).
            - An SVG string like ``<svg xmlns=...</svg>``.
            - A byte array defining an image. This includes monochrome images of
              shape (w,h) or (w,h,1), color images of shape (w,h,3), or RGBA
              images of shape (w,h,4), where w and h are the image width and
              height, respectively.
            - A list of any of the above. Streamlit displays the list as a
              row of images that overflow to additional rows as needed.
        caption : str or list of str
            Image caption(s). If this is ``None`` (default), no caption is
            displayed. If ``image`` is a list of multiple images, ``caption``
            must be a list of captions (one caption for each image) or
            ``None``.

            Captions can optionally contain GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown
        width : "content", "stretch", or int
            The width of the image element. This can be one of the following:

            - ``"content"`` (default): The width of the element matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the element matches the width of the
              parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

            When using an SVG image without a default width, use ``"stretch"``
            or an integer.
        use_column_width : "auto", "always", "never", or bool
            If "auto", set the image's width to its natural size,
            but do not exceed the width of the column.
            If "always" or True, set the image's width to the column width.
            If "never" or False, set the image's width to its natural size.
            Note: if set, `use_column_width` takes precedence over the `width` parameter.

            .. deprecated::
                ``use_column_width`` is deprecated and will be removed in a future
                release. Please use the ``width`` parameter instead.

        clamp : bool
            Whether to clamp image pixel values to a valid range (0-255 per
            channel). This is only used for byte array images; the parameter is
            ignored for image URLs and files. If this is ``False`` (default)
            and an image has an out-of-range value, a ``RuntimeError`` will be
            raised.
        channels : "RGB" or "BGR"
            The color format when ``image`` is an ``nd.array``. This is ignored
            for other image types. If this is ``"RGB"`` (default),
            ``image[:, :, 0]`` is the red channel, ``image[:, :, 1]`` is the
            green channel, and ``image[:, :, 2]`` is the blue channel. For
            images coming from libraries like OpenCV, you should set this to
            ``"BGR"`` instead.
        output_format : "JPEG", "PNG", or "auto"
            The output format to use when transferring the image data. If this
            is ``"auto"`` (default), Streamlit identifies the compression type
            based on the type and format of the image. Photos should use the
            ``"JPEG"`` format for lossy compression while diagrams should use
            the ``"PNG"`` format for lossless compression.

        use_container_width : bool
            Whether to override ``width`` with the width of the parent
            container. If ``use_container_width`` is ``False`` (default),
            Streamlit sets the image's width according to ``width``. If
            ``use_container_width`` is ``True``, Streamlit sets the width of
            the image to match the width of the parent container.

            .. deprecated::
                ``use_container_width`` is deprecated and will be removed in a
                future release. For ``use_container_width=True``, use
                ``width="stretch"``. For ``use_container_width=False``, use
                ``width="content"``.

        Example
        -------
        >>> import streamlit as st
        >>> st.image("sunrise.jpg", caption="Sunrise by the mountains")

        .. output::
           https://doc-image.streamlit.app/
           height: 710px

        """

        if use_column_width is not None:
            if use_container_width is not None:
                raise StreamlitAPIException(
                    "`use_container_width` and `use_column_width` cannot be set at the same time.",
                    "Please utilize `use_container_width` since `use_column_width` is deprecated.",
                )

            show_deprecation_warning(
                "The `use_column_width` parameter has been deprecated and will be removed "
                "in a future release. Please utilize the `use_container_width` parameter instead."
            )
            if use_column_width in {"auto", "never"} or use_column_width is False:
                width = "content"
            elif use_column_width == "always" or use_column_width is True:
                width = "stretch"

        if use_container_width is not None:
            show_deprecation_warning(
                make_deprecated_name_warning(
                    "use_container_width",
                    "width",
                    "2025-12-31",
                    "For `use_container_width=True`, use `width='stretch'`. "
                    "For `use_container_width=False`, use `width='content'`.",
                    include_st_prefix=False,
                ),
                show_in_browser=False,
            )
            if use_container_width is True:
                width = "stretch"
            elif isinstance(width, int):
                # Preserve the existing behavior with respect to use_container_width=False
                # and width=int.
                pass
            else:
                width = "content"

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        image_list_proto = ImageListProto()
        marshall_images(
            self.dg._get_delta_path_str(),
            image,
            caption,
            layout_config,
            image_list_proto,
            clamp,
            channels,
            output_format,
        )
        return self.dg._enqueue("imgs", image_list_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
