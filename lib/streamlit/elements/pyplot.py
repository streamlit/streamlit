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

"""Streamlit support for Matplotlib PyPlot charts."""

from __future__ import annotations

import io
from typing import TYPE_CHECKING, Any, cast

from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
from streamlit.elements.lib.image_utils import marshall_images
from streamlit.elements.lib.layout_utils import LayoutConfig, Width, validate_width
from streamlit.proto.Image_pb2 import ImageList as ImageListProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from matplotlib.figure import Figure

    from streamlit.delta_generator import DeltaGenerator


class PyplotMixin:
    @gather_metrics("pyplot")
    def pyplot(
        self,
        fig: Figure | None = None,
        clear_figure: bool | None = None,
        *,
        width: Width = "stretch",
        use_container_width: bool | None = None,
        **kwargs: Any,
    ) -> DeltaGenerator:
        """Display a matplotlib.pyplot figure.

        .. Important::
            You must install ``matplotlib>=3.0.0`` to use this command. You can
            install all charting dependencies (except Bokeh) as an extra with
            Streamlit:

            .. code-block:: shell

               pip install streamlit[charts]

        Parameters
        ----------
        fig : Matplotlib Figure
            The Matplotlib ``Figure`` object to render. See
            https://matplotlib.org/stable/gallery/index.html for examples.

            .. note::
                When this argument isn't specified, this function will render the global
                Matplotlib figure object. However, this feature is deprecated and
                will be removed in a later version.

        clear_figure : bool
            If True, the figure will be cleared after being rendered.
            If False, the figure will not be cleared after being rendered.
            If left unspecified, we pick a default based on the value of ``fig``.

            - If ``fig`` is set, defaults to ``False``.

            - If ``fig`` is not set, defaults to ``True``. This simulates Jupyter's
              approach to matplotlib rendering.

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
            Arguments to pass to Matplotlib's savefig function.

        Example
        -------
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

        if not fig:
            show_deprecation_warning("""
Calling `st.pyplot()` without providing a figure argument has been deprecated
and will be removed in a later version as it requires the use of Matplotlib's
global figure object, which is not thread-safe.

To future-proof this code, you should pass in a figure as shown below:

```python
fig, ax = plt.subplots()
ax.scatter([1, 2, 3], [1, 2, 3])
# other plotting actions...
st.pyplot(fig)
```

If you have a specific use case that requires this functionality, please let us
know via [issue on Github](https://github.com/streamlit/streamlit/issues).
""")

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

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
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    coordinates: str,
    image_list_proto: ImageListProto,
    layout_config: LayoutConfig,
    fig: Figure | None = None,
    clear_figure: bool | None = True,
    **kwargs: Any,
) -> None:
    try:
        import matplotlib.pyplot as plt

        plt.ioff()
    except ImportError:
        raise ImportError("pyplot() command requires matplotlib")

    # You can call .savefig() on a Figure object or directly on the pyplot
    # module, in which case you're doing it to the latest Figure.
    if not fig:
        if clear_figure is None:
            clear_figure = True

        fig = cast("Figure", plt)

    # Normally, dpi is set to 'figure', and the figure's dpi is set to 100.
    # So here we pick double of that to make things look good in a high
    # DPI display.
    options = {"bbox_inches": "tight", "dpi": 200, "format": "png"}

    # If some options are passed in from kwargs then replace the values in
    # options with the ones from kwargs
    options = {a: kwargs.get(a, b) for a, b in options.items()}
    # Merge options back into kwargs.
    kwargs.update(options)

    image = io.BytesIO()
    fig.savefig(image, **kwargs)
    marshall_images(
        coordinates=coordinates,
        image=image,
        caption=None,
        layout_config=layout_config,
        proto_imgs=image_list_proto,
        clamp=False,
        channels="RGB",
        output_format="PNG",
    )

    # Clear the figure after rendering it. This means that subsequent
    # plt calls will be starting fresh.
    if clear_figure:
        fig.clf()
