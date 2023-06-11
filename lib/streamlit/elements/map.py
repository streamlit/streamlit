# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""A wrapper for simple PyDeck scatter charts."""

import copy
import json
from typing import TYPE_CHECKING, Any, Dict, Iterable, Optional, Union, cast

import pandas as pd
from typing_extensions import Final, TypeAlias

import streamlit.elements.deck_gl_json_chart as deck_gl_json_chart
from streamlit import config, type_util
from streamlit.color_util import Color, is_color_like, to_int_color_tuple
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as DeckGlJsonChartProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from pandas.io.formats.style import Styler

    from streamlit.delta_generator import DeltaGenerator


Data: TypeAlias = Union[
    pd.DataFrame,
    "Styler",
    Iterable[Any],
    Dict[Any, Any],
    None,
]

# Map used as the basis for st.map.
_DEFAULT_MAP: Final[Dict[str, Any]] = dict(deck_gl_json_chart.EMPTY_MAP)

# Other default parameters for st.map.
_DEFAULT_ZOOM_LEVEL: Final = 12
_ZOOM_LEVELS: Final = [
    360,
    180,
    90,
    45,
    22.5,
    11.25,
    5.625,
    2.813,
    1.406,
    0.703,
    0.352,
    0.176,
    0.088,
    0.044,
    0.022,
    0.011,
    0.005,
    0.003,
    0.001,
    0.0005,
    0.00025,
]


class MapMixin:
    @gather_metrics("map")
    def map(
        self,
        data: Data = None,
        *,
        latitude: Optional[str] = None,
        longitude: Optional[str] = None,
        color: Union[str, Color] = (200, 30, 0, 160),
        size: Union[str, float] = 10,
        zoom: Optional[int] = None,
        map_style: Optional[str] = None,
        use_container_width: bool = True,
    ) -> "DeltaGenerator":
        """Display a map with a scatterpoint overlayed onto it.

        This is a wrapper around ``st.pydeck_chart`` to quickly create
        scatterplot charts on top of a map, with auto-centering and auto-zoom.

        When using this command, Mapbox provides the map tiles to render map
        content. Note that Mapbox is a third-party product, the use of which is
        governed by Mapbox's Terms of Use.

        Mapbox requires users to register and provide a token before users can
        request map tiles. Currently, Streamlit provides this token for you, but
        this could change at any time. We strongly recommend all users create and
        use their own personal Mapbox token to avoid any disruptions to their
        experience. You can do this with the ``mapbox.token`` config option.

        To get a token for yourself, create an account at https://mapbox.com.
        For more info on how to set config options, see
        https://docs.streamlit.io/library/advanced-features/configuration

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, numpy.ndarray,
            pyspark.sql.DataFrame, snowflake.snowpark.dataframe.DataFrame,
            snowflake.snowpark.table.Table, Iterable, dict, or None
            The data to be plotted.

        latitude : str or None
            The name of the column containing the latitude coordinates of
            the datapoints in the chart. This argument can only be supplied
            by keyword.

            If None, the latitude data will come from any column named 'lat',
            'latitude', 'LAT', or 'LATITUDE'.

        longitude : str or None
            The name of the column containing the latitude coordinates of
            the datapoints in the chart. This argument can only be supplied
            by keyword.

            If None, the latitude data will come from any column named 'lon',
            'longitude', 'LON', or 'LONGITUDE'.

        color : str or tuple
            The color of the circles representing each datapoint. This argument
            can only be supplied by keyword.

            Can be:
            - None, to use the default color.
            - A hex string like "#ffaa00" or "#ffaa0088".
            - An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.
            - The name of the column to use for the color. Cells in this column
              should contain colors represented as a hex string or color tuple,
              as described above.

            If passing in a str, the Matplotlib library must be installed.

        size : str, float, or None
            The size of the circles representing each point. This argument can
            only be supplied by keyword.

            This can be:

            - A number like 100, to specify a single size to use for all
              datapoints.
            - The name of the column to use for the size. This allows each
              datapoint to be represented by a circle of a different size.

        zoom : int
            Zoom level as specified in
            https://wiki.openstreetmap.org/wiki/Zoom_levels.
            This argument can only be supplied by keyword.

        map_style : str or None
            One of Mapbox's map style URLs. A full list can be found here:
            https://docs.mapbox.com/api/maps/styles/#mapbox-styles

            This feature requires a Mapbox token. See above for information on
            how to get one and set it up in Streamlit.

        use_container_width: bool
            If True, set the chart width to the column width. This takes
            precedence over the width argument.
            This argument can only be supplied by keyword.

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...     columns=['lat', 'lon'])
        ...
        >>> st.map(df)

        .. output::
           https://doc-map.streamlit.app/
           height: 650px

        You can also customize the size and color of the datapoints:

        >>> st.map(df, size=200, color='#0044ff')

        And, finally, you can also choose different columns to use for the
        latitude and longitude components, as well as set size and color of
        each datapoint dynamically based on other columns:

        >>> df = pd.DataFrame(
        ...     np.random.randn(1000, 3) / [50, 50] + [37.76, -122.4],
        ...     columns=['col1', 'col2', 'col3'])
        ...
        >>> df[col4] = np.arange[0, 1000]
        >>>
        >>> st.map(df,
        ...     latitude='col1',
        ...     longitude='col2',
        ...     size='col3',
        ...     color='col4')

        """
        map_proto = DeckGlJsonChartProto()
        map_proto.json = to_deckgl_json(
            data, latitude, longitude, size, color, map_style, zoom
        )
        map_proto.use_container_width = use_container_width
        return self.dg._enqueue("deck_gl_json_chart", map_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _get_zoom_level(distance: float) -> int:
    """Get the zoom level for a given distance in degrees.

    See https://wiki.openstreetmap.org/wiki/Zoom_levels for reference.

    Parameters
    ----------
    distance : float
        How many degrees of longitude should fit in the map.

    Returns
    -------
    int
        The zoom level, from 0 to 20.

    """
    for i in range(len(_ZOOM_LEVELS) - 1):
        if _ZOOM_LEVELS[i + 1] < distance <= _ZOOM_LEVELS[i]:
            return i

    # For small number of points the default zoom level will be used.
    return _DEFAULT_ZOOM_LEVEL


def to_deckgl_json(
    data: Data,
    lat: Optional[str],
    lon: Optional[str],
    size: Union[str, float],
    color: Union[str, Iterable[float]],
    map_style: Optional[str],
    zoom: Optional[int],
) -> str:
    if data is None:
        return json.dumps(_DEFAULT_MAP)

    # TODO(harahu): iterables don't have the empty attribute. This is either
    # a bug, or the documented data type is too broad. One or the other
    # should be addressed
    if hasattr(data, "empty") and data.empty:
        return json.dumps(_DEFAULT_MAP)

    data = type_util.convert_anything_to_df(data)

    lat_col_name = _get_lat_or_lon_col_name(
        data, "latitude", lat, {"lat", "latitude", "LAT", "LATITUDE"}
    )
    lon_col_name = _get_lat_or_lon_col_name(
        data, "longitude", lon, {"lon", "longitude", "LON", "LONGITUDE"}
    )
    size, size_col_name = _get_size_arg_and_col_name(data, size)
    color, color_col_name, data = _get_color_arg_and_calc_color_col(
        data, color, lat_col_name, lon_col_name, size_col_name
    )

    zoom, center_lat, center_lon = _get_viewport_details(
        data, lat_col_name, lon_col_name, zoom
    )

    # Drop columns we're not using.
    # (Sort for tests)
    used_columns = sorted(
        [
            c
            for c in {lat_col_name, lon_col_name, size_col_name, color_col_name}
            if c is not None
        ]
    )
    data = data[used_columns]

    default = copy.deepcopy(_DEFAULT_MAP)
    default["initialViewState"]["latitude"] = center_lat
    default["initialViewState"]["longitude"] = center_lon
    default["initialViewState"]["zoom"] = zoom
    default["layers"] = [
        {
            "@@type": "ScatterplotLayer",
            "getPosition": f"@@=[{lon_col_name}, {lat_col_name}]",
            "getRadius": size,
            "radiusScale": 10,
            "radiusMinPixels": 3,
            "getFillColor": color,
            "data": data.to_dict("records"),
        }
    ]

    if map_style:
        if not config.get_option("mapbox.token"):
            raise StreamlitAPIException(
                "You need a Mapbox token in order to select a map type. "
                "Refer to the docs for st.map for more information."
            )
        default["mapStyle"] = map_style

    return json.dumps(default)


def _get_lat_or_lon_col_name(
    data: pd.DataFrame,
    human_readable_name: str,
    col_name_from_user: Optional[str],
    default_col_names: set[str],
) -> str:

    if col_name_from_user in data.columns:
        col_name = col_name_from_user

    else:
        # Try one of the default col_names:
        col_name = next((d for d in default_col_names if d in data.columns), None)

        if col_name is None:
            formatted_allowed_col_name = ", ".join(map(repr, sorted(default_col_names)))
            formmated_col_names = ", ".join(map(repr, list(data.columns)))

            raise StreamlitAPIException(
                f"Map data must contain a {human_readable_name} column named: "
                f"{formatted_allowed_col_name}. Existing columns: {formmated_col_names}"
            )

    if data[col_name].isnull().values.any():
        raise StreamlitAPIException(
            f"Column {col_name} is not allowed to contain null values, such "
            "as NaN, NaT, or None."
        )

    return col_name


def _get_size_arg_and_col_name(
    data: pd.DataFrame,
    size: Optional[str],
) -> [str, str]:

    if size in data.columns:
        col_name = size
        size_arg = f"@@={col_name}"
    else:
        col_name = None
        size_arg = size

    return size_arg, col_name


def _get_color_arg_and_calc_color_col(
    data: pd.DataFrame,
    color: str,
    lat_col_name: str,
    lon_col_name: str,
    size_col_name: str,
) -> [str, pd.DataFrame]:
    if color in data.columns:
        col_name = color
        color_arg = f"@@={col_name}"

        # Convert colors to the right format.
        if len(data[col_name]) > 0 and is_color_like(data[col_name][0]):
            parsed_color = data[col_name].apply(to_int_color_tuple)

            # Clone data to avoid transforming the original dataframe.
            new_data = data[[lat_col_name, lon_col_name]].copy()

            if size_col_name:
                new_data[size_col_name] = data[size_col_name]

            new_data[col_name] = parsed_color
            data = new_data
        else:
            raise StreamlitAPIException(
                f'Column "{col_name}" does not appear to contain valid colors.'
            )
    else:
        color_arg = to_int_color_tuple(color)
        col_name = None

    return color_arg, col_name, data


def _get_viewport_details(data, lat_col_name, lon_col_name, zoom):
    min_lat = data[lat_col_name].min()
    max_lat = data[lat_col_name].max()
    min_lon = data[lon_col_name].min()
    max_lon = data[lon_col_name].max()
    center_lat = (max_lat + min_lat) / 2.0
    center_lon = (max_lon + min_lon) / 2.0
    range_lon = abs(max_lon - min_lon)
    range_lat = abs(max_lat - min_lat)

    if zoom is None:
        if range_lon > range_lat:
            longitude_distance = range_lon
        else:
            longitude_distance = range_lat
        zoom = _get_zoom_level(longitude_distance)

    return zoom, center_lat, center_lon
