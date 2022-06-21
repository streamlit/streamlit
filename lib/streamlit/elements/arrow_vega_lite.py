# Copyright 2018-2022 Streamlit Inc.
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

"""A Python wrapper around Vega-Lite."""

import json
from typing import Any, Dict, Optional, cast, TYPE_CHECKING
from typing_extensions import Final, Literal

import streamlit.elements.lib.dicttools as dicttools
from streamlit.logger import get_logger
from streamlit.proto.ArrowVegaLiteChart_pb2 import (
    ArrowVegaLiteChart as ArrowVegaLiteChartProto,
)

from . import arrow
from .arrow import Data

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


LOGGER: Final = get_logger(__name__)


ST_COLOR_PALETTE = {
    "red": {
        "100": "#7d353b",
        "90": "#bd4043",
        "80": "#ff2b2b",
        "70": "#ff4b4b",
        "60": "#ff6c6c",
        "50": "#ff8c8c",
        "40": "#ffabab",
        "30": "#ffc7c7",
        "20": "#ffdede",
        "10": "#fff0f0",
    },
    "orange": {
        "100": "#d95a00",
        "90": "#ed6f13",
        "80": "#ff8700",
        "70": "#ffa421",
        "60": "#ffbd45",
        "50": "#ffd16a",
        "40": "#ffe08e",
        "30": "#ffecb0",
        "20": "#fff6d0",
        "10": "#fffae8",
    },
    "yellow": {
        "100": "#dea816",
        "90": "#edbb16",
        "80": "#faca2b",
        "70": "#ffe312",
        "60": "#fff835",
        "50": "#ffff59",
        "40": "#ffff7d",
        "30": "#ffffa0",
        "20": "#ffffc2",
        "10": "#ffffe1",
    },
    "green": {
        "100": "#177233",
        "90": "#158237",
        "80": "#09ab3b",
        "70": "#21c354",
        "60": "#3dd56d",
        "50": "#5ce488",
        "40": "#7defa1",
        "30": "#9ef6bb",
        "20": "#c0fcd3",
        "10": "#dffde9",
    },
    "teal": {
        "100": "#246e69",
        "90": "#2c867c",
        "80": "#29b09d",
        "70": "#00d4b1",
        "60": "#20e7c5",
        "50": "#45f4d5",
        "40": "#6bfde3",
        "30": "#93ffee",
        "20": "#bafff7",
        "10": "#dcfffb",
    },
    "cyan": {
        "100": "#15799e",
        "90": "#0d8cb5",
        "80": "#00a4d4",
        "70": "#00c0f2",
        "60": "#24d4ff",
        "50": "#4be4ff",
        "40": "#73efff",
        "30": "#9af8ff",
        "20": "#bffdff",
        "10": "#e0feff",
    },
    "blue": {
        "100": "#004280",
        "90": "#0054a3",
        "80": "#0068c9",
        "70": "#1c83e1",
        "60": "#3d9df3",
        "50": "#60b4ff",
        "40": "#83c9ff",
        "30": "#a6dcff",
        "20": "#c7ebff",
        "10": "#e4f5ff",
    },
    "violet": {
        "100": "#3f3163",
        "90": "#583f84",
        "80": "#6d3fc0",
        "70": "#803df5",
        "60": "#9a5dff",
        "50": "#b27eff",
        "40": "#c89dff",
        "30": "#dbbbff",
        "20": "#ebd6ff",
        "10": "#f5ebff",
    },
    "gray": {
        "100": "#0e1117",
        "90": "#262730",
        "80": "#555867",
        "70": "#808495",
        "60": "#a3a8b8",
        "50": "#bfc5d3",
        "40": "#d5dae5",
        "30": "#e6eaf1",
        "20": "#f0f2f6",
        "10": "#fafafa",
    },
}


def get_color(name):
    """Returns a color from the streamlit color palette, e.g. red-100, as hex."""
    hue, intensity = name.rsplit("-", 1)
    return ST_COLOR_PALETTE[hue][intensity]


default_color = get_color("blue-70")

streamlit_color_scheme = [
    get_color("blue-70"),
    get_color("orange-70"),
    get_color("green-70"),
    get_color("red-70"),
    get_color("violet-70"),
    get_color("teal-70"),
    get_color("yellow-70"),
    get_color("cyan-70"),
]


def _streamlit_theme(grid: str = "horizontal") -> dict:
    """Returns a config dict for Vega-Lite."""
    config = dict(
        axis=dict(
            labelColor=get_color("gray-70"),
            tickColor=get_color("gray-30"),
            gridColor=get_color("gray-30"),
            domainColor=get_color("gray-30"),
            titleFontWeight=600,
            titlePadding=10,
            labelPadding=5,
        ),
        view=dict(strokeWidth=0),
        arc=dict(fill=default_color),
        area=dict(fill=default_color),
        line=dict(stroke=default_color),
        path=dict(stroke=default_color),
        rect=dict(fill=default_color),
        shape=dict(stroke=default_color),
        symbol=dict(fill=default_color),
        bar=dict(fill=default_color),
        tick=dict(fill=default_color),
        circle=dict(fill=default_color),
        range=dict(
            category=streamlit_color_scheme,
            # TODO: Define continuous color schemes using a function as in
            #   https://vega.github.io/vega/docs/schemes/
            # ordinal=_(scheme="greens"),
            # ramp=_(scheme="greens"),
        ),
    )

    if grid == "horizontal":
        config["axisX"] = dict(grid=False, domain=True, ticks=True)
        config["axisY"] = dict(grid=True, domain=False, ticks=True)
    elif grid == "vertical":
        config["axisX"] = dict(grid=True, domain=False, ticks=True)
        config["axisY"] = dict(grid=False, domain=True, ticks=True)
    elif grid == "both":
        config["axisX"] = dict(grid=True, domain=True, ticks=True)
        config["axisY"] = dict(grid=True, domain=True, ticks=True)
    elif grid == "none":
        config["axisX"] = dict(grid=False, domain=True, ticks=True)
        config["axisY"] = dict(grid=False, domain=True, ticks=True)
    else:
        raise ValueError(
            "grid must be one of 'horizontal', 'vertical', 'both', or 'none'"
        )

    return config


class ArrowVegaLiteMixin:
    def _arrow_vega_lite_chart(
        self,
        data: Data = None,
        spec: Optional[Dict[str, Any]] = None,
        use_container_width: bool = False,
        *,  # keyword-only arguments:
        theme: Optional[Literal["streamlit"]] = None,
        **kwargs: Any,
    ) -> "DeltaGenerator":
        """Display a chart using the Vega-Lite library.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray, Iterable, dict, or None
            Either the data to be plotted or a Vega-Lite spec containing the
            data (which more closely follows the Vega-Lite API).

        spec : dict or None
            The Vega-Lite spec for the chart. If the spec was already passed in
            the previous argument, this must be set to None. See
            https://vega.github.io/vega-lite/docs/ for more info.

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
        >>> st._arrow_vega_lite_chart(df, {
        ...     'mark': {'type': 'circle', 'tooltip': True},
        ...     'encoding': {
        ...         'x': {'field': 'a', 'type': 'quantitative'},
        ...         'y': {'field': 'b', 'type': 'quantitative'},
        ...         'size': {'field': 'c', 'type': 'quantitative'},
        ...         'color': {'field': 'c', 'type': 'quantitative'},
        ...     },
        ... })

        Examples of Vega-Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        proto = ArrowVegaLiteChartProto()
        marshall(
            proto,
            data,
            spec,
            use_container_width=use_container_width,
            theme=theme,
            **kwargs,
        )
        return self.dg._enqueue("arrow_vega_lite_chart", proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    proto: ArrowVegaLiteChartProto,
    data: Data = None,
    spec: Optional[Dict[str, Any]] = None,
    use_container_width: bool = False,
    theme: Optional[Literal["streamlit"]] = None,
    **kwargs,
):
    """Construct a Vega-Lite chart object.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    # Support passing data inside spec['datasets'] and spec['data'].
    # (The data gets pulled out of the spec dict later on.)
    if isinstance(data, dict) and spec is None:
        spec = data
        data = None

    # Support passing no spec arg, but filling it with kwargs.
    # Example:
    #   marshall(proto, baz='boz')
    if spec is None:
        spec = dict()
    else:
        # Clone the spec dict, since we may be mutating it.
        spec = dict(spec)

    # Support passing in kwargs. Example:
    #   marshall(proto, {foo: 'bar'}, baz='boz')
    if len(kwargs):
        # Merge spec with unflattened kwargs, where kwargs take precedence.
        # This only works for string keys, but kwarg keys are strings anyways.
        spec = dict(spec, **dicttools.unflatten(kwargs, _CHANNELS))

    if len(spec) == 0:
        raise ValueError("Vega-Lite charts require a non-empty spec dict.")

    if "autosize" not in spec:
        spec["autosize"] = {"type": "fit", "contains": "padding"}

    # Pull data out of spec dict when it's in a 'datasets' key:
    #   marshall(proto, {datasets: {foo: df1, bar: df2}, ...})
    if "datasets" in spec:
        for k, v in spec["datasets"].items():
            dataset = proto.datasets.add()
            dataset.name = str(k)
            dataset.has_name = True
            arrow.marshall(dataset.data, v)
        del spec["datasets"]

    # Pull data out of spec dict when it's in a top-level 'data' key:
    #   marshall(proto, {data: df})
    #   marshall(proto, {data: {values: df, ...}})
    #   marshall(proto, {data: {url: 'url'}})
    #   marshall(proto, {data: {name: 'foo'}})
    if "data" in spec:
        data_spec = spec["data"]

        if isinstance(data_spec, dict):
            if "values" in data_spec:
                data = data_spec["values"]
                del spec["data"]
        else:
            data = data_spec
            del spec["data"]

    if theme is not None:
        # Apply streamlit theme
        spec["config"] = _streamlit_theme()

    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width

    if data is not None:
        arrow.marshall(proto.data, data)


# See https://vega.github.io/vega-lite/docs/encoding.html
_CHANNELS = {
    "x",
    "y",
    "x2",
    "y2",
    "xError",
    "yError2",
    "xError",
    "yError2",
    "longitude",
    "latitude",
    "color",
    "opacity",
    "fillOpacity",
    "strokeOpacity",
    "strokeWidth",
    "size",
    "shape",
    "text",
    "tooltip",
    "href",
    "key",
    "order",
    "detail",
    "facet",
    "row",
    "column",
}
