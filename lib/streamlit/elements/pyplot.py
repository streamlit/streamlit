# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Streamlit support for Matplotlib PyPlot charts."""

from __future__ import annotations

import io
from typing import TYPE_CHECKING, Any, Final, cast

from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.elements.lib.image_utils import marshall_images
from streamlit.elements.lib.layout_utils import create_layout_config
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from matplotlib.figure import Figure

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import LayoutConfig, Width

# Sensible Matplotlib savefig defaults for Streamlit display.
# - bbox_inches="tight": Crop excess whitespace (most common savefig override).
# - dpi=200: Sharper than Matplotlib's figure default (~100) on high-DPI screens.
# - format="png": Stable raster output for st.image marshalling.
_DEFAULT_SAVEFIG_OPTIONS: Final[dict[str, Any]] = {
    "bbox_inches": "tight",
    "dpi": 200,
    "format": "png",
}

_SAVEFIG_KWARGS_DEPRECATION: Final[str] = """
Passing Matplotlib `savefig` keyword arguments to `st.pyplot` is
deprecated and will be removed in a future version.

`st.pyplot` already uses `bbox_inches="tight"` and `dpi=200` by
default. For other `savefig` options (for example `transparent=True`
or a custom `dpi`), save the figure yourself and display it with
`st.image`:

```python
import io

buf = io.BytesIO()
fig.savefig(buf, format="png", transparent=True, dpi=300)
st.image(buf)
```
"""

_FIG_REQUIRED: Final[str] = """
`st.pyplot` requires a Matplotlib figure. Passing `None` is not supported
because Matplotlib's global figure object is not thread-safe.

Pass a figure explicitly:

```python
fig, ax = plt.subplots()
ax.scatter([1, 2, 3], [1, 2, 3])
# other plotting actions...
st.pyplot(fig)
```
"""


class PyplotMixin:
    @gather_metrics("pyplot")
    def pyplot(
        self,
        fig: Figure,
        clear_figure: bool = False,
        *,
        width: Width = "stretch",
        use_container_width: bool | None = None,
        **kwargs: Any,
    ) -> DeltaGenerator:
        """Display a matplotlib.pyplot figure.

        Streamlit renders the figure by calling Matplotlib's ``savefig`` with
        ``bbox_inches="tight"`` and ``dpi=200`` so charts look sharp and cropped
        by default.

        .. Important::
            You must install ``matplotlib>=3.0.0`` to use this command. You can
            install all charting dependencies as an extra with
            Streamlit:

            .. code-block:: shell

               pip install streamlit[charts]

        Parameters
        ----------
        fig : Matplotlib Figure
            The Matplotlib ``Figure`` object to render. See
            https://matplotlib.org/stable/gallery/index.html for examples.

        clear_figure : bool
            Whether to clear the figure after rendering it. If this is
            ``False`` (default), the figure is left as-is. If ``True``,
            Streamlit calls ``fig.clf()`` after the figure is displayed.

        width : "stretch", "content", or int
            The width of the chart element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``True``
            (default), Streamlit sets the width of the figure to match the
            width of the parent container. If ``use_container_width`` is
            ``False``, Streamlit sets the width of the chart to fit its
            contents according to the plotting library, up to the width of the
            parent container.

            .. deprecated::
                ``use_container_width`` is deprecated and will be removed in a
                future release. For ``use_container_width=True``, use
                ``width="stretch"``. For ``use_container_width=False``, use
                ``width="content"``.

        **kwargs : any
            Arguments to pass to Matplotlib's ``savefig`` function.

            .. deprecated::
                Passing ``savefig`` keyword arguments to ``st.pyplot`` is
                deprecated and will be removed in a future version.
                ``st.pyplot`` already uses ``bbox_inches="tight"`` and
                ``dpi=200`` by default. For other ``savefig`` options, save the
                figure yourself and display it with ``st.image``.

        Examples
        --------
        >>> import matplotlib.pyplot as plt
        >>> import streamlit as st
        >>> from numpy.random import default_rng as rng
        >>>
        >>> arr = rng(0).normal(1, 1, size=100)
        >>> fig, ax = plt.subplots()
        >>> ax.hist(arr, bins=20)
        >>>
        >>> st.pyplot(fig)

        .. output::
           https://doc-pyplot.streamlit.app/
           height: 630px

        Matplotlib supports several types of "backends". If you're getting an
        error using Matplotlib with Streamlit, try setting your backend to "TkAgg"::

            echo "backend: TkAgg" >> ~/.matplotlib/matplotlibrc

        For more information, see https://matplotlib.org/faq/usage_faq.html.

        """

        if fig is None:
            raise StreamlitAPIException(_FIG_REQUIRED)

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

            width = "stretch" if use_container_width else "content"

        if kwargs:
            show_deprecation_warning(
                _SAVEFIG_KWARGS_DEPRECATION,
                show_in_browser=True,
            )

        layout_config = create_layout_config(width=width, allow_content_width=True)

        image_list_proto = ImageListProto()
        marshall(
            self.dg._get_delta_path_str(),
            image_list_proto,
            layout_config,
            fig,
            clear_figure,
            **kwargs,
        )
        return self.dg._enqueue("imgs", image_list_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    coordinates: str,
    image_list_proto: ImageListProto,
    layout_config: LayoutConfig,
    fig: Figure,
    clear_figure: bool = False,
    **kwargs: Any,
) -> None:
    try:
        import matplotlib.pyplot as plt

        plt.ioff()
    except ImportError:  # pragma: no cover - optional dep
        raise ImportError("pyplot() command requires matplotlib")

    # Apply Streamlit defaults, then let deprecated kwargs override them.
    savefig_kwargs = {**_DEFAULT_SAVEFIG_OPTIONS, **kwargs}

    image = io.BytesIO()
    fig.savefig(image, **savefig_kwargs)

    # SVG is text, not raster bytes, so decode it to a string and let
    # image_to_url take its SVG path instead of the PNG/PIL path, which cannot
    # parse SVG and crashes.
    #
    # Sniff the buffer rather than reading kwargs["format"]: Matplotlib resolves
    # the format itself, so format=None with rcParams["savefig.format"] = "svg"
    # still produces SVG. No raster format collides with these prefixes (PNG
    # starts with b"\x89PNG", JPEG with b"\xff\xd8"). An `<?xml` prolog alone is
    # not enough because image_to_url also requires a `<svg` tag, and the search
    # is bounded since Matplotlib emits `<svg` within the first few hundred bytes.
    payload = image.getvalue()
    stripped = payload.lstrip()
    is_svg = stripped.startswith(b"<svg") or (
        stripped.startswith(b"<?xml") and b"<svg" in stripped[:2048]
    )
    image_for_proto: str | io.BytesIO = payload.decode("utf-8") if is_svg else image

    marshall_images(
        coordinates=coordinates,
        image=image_for_proto,
        caption=None,
        layout_config=layout_config,
        proto_imgs=image_list_proto,
        clamp=False,
        channels="RGB",
        output_format="PNG",
    )

    # Clear the figure after rendering so later draws on this figure start empty.
    if clear_figure:
        fig.clf()
