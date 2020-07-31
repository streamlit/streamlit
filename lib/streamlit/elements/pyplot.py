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

"""Streamlit support for Matplotlib PyPlot charts."""

import io

try:
    import matplotlib  # noqa: F401
    import matplotlib.pyplot as plt

    plt.ioff()
except ImportError:
    raise ImportError("pyplot() command requires matplotlib")

import streamlit.elements.image_proto as image_proto

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def marshall(coordinates, new_element_proto, fig=None, clear_figure=True, **kwargs):
    """Construct a matplotlib.pyplot figure.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    # You can call .savefig() on a Figure object or directly on the pyplot
    # module, in which case you're doing it to the latest Figure.
    if not fig:
        if clear_figure is None:
            clear_figure = True
        fig = plt

    # Normally, dpi is set to 'figure', and the figure's dpi is set to 100.
    # So here we pick double of that to make things look good in a high
    # DPI display.
    options = {"bbox_inches": "tight", "dpi": 200, "format": "png"}

    # If some of the options are passed in from kwargs then replace
    # the values in options with the ones from kwargs
    options = {a: kwargs.get(a, b) for a, b in options.items()}
    # Merge options back into kwargs.
    kwargs.update(options)

    image = io.BytesIO()
    fig.savefig(image, **kwargs)
    image_proto.marshall_images(
        coordinates,
        image,
        None,
        -2,
        new_element_proto.imgs,
        False,
        channels="RGB",
        output_format="PNG",
    )

    # Clear the figure after rendering it. This means that subsequent
    # plt calls will be starting fresh.
    if clear_figure:
        fig.clf()
