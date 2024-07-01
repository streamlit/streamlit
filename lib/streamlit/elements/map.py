# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

import copy
import hashlib
import json
from typing import TYPE_CHECKING, Any, Collection, Dict, Final, Iterable, Union, cast

from typing_extensions import TypeAlias

import streamlit.elements.deck_gl_json_chart as deck_gl_json_chart
from streamlit import config, type_util
from streamlit.color_util import Color, IntColorTuple, is_color_like, to_int_color_tuple
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as DeckGlJsonChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.util import HASHLIB_KWARGS

if TYPE_CHECKING:
    from pandas import DataFrame
    from pandas.io.formats.style import Styler

    from streamlit.delta_generator import DeltaGenerator


Data: TypeAlias = Union[
    "DataFrame",
    "Styler",
    Iterable[Any],
    Dict[Any, Any],
    None,
]

# Map used as the basis for st.map.
_DEFAULT_MAP: Final[dict[str, Any]] = dict(deck_gl_json_chart.EMPTY_MAP)

# Other default parameters for st.map.
_DEFAULT_LAT_COL_NAMES: Final = {"lat", "latitude", "LAT", "LATITUDE"}
_DEFAULT_LON_COL_NAMES: Final = {"lon", "longitude", "LON", "LONGITUDE"}
_DEFAULT_COLOR: Final = (200, 30, 0, 160)
_DEFAULT_SIZE: Final = 100
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
        latitude: str | None = None,
        longitude: str | None = None,
        color: None | str | Color = None,
        size: None | str | float = None,
        zoom: int | None = None,
        use_container_width: bool = True,
    ) -> DeltaGenerator:
        """Display a map with a scatterplot overlaid onto it.

        This is a wrapper around ``st.pydeck_chart`` to quickly create
        scatterplot charts on top of a map, with auto-centering and auto-zoom.

        When using this command, Mapbox provides the map tiles to render map
        content. Note that Mapbox is a third-party product and Streamlit accepts
        no responsibility or liability of any kind for Mapbox or for any content
        or information made available by Mapbox.

        Mapbox requires users to register and provide a token before users can
        request map tiles. Currently, Streamlit provides this token for you, but
        this could change at any time. We strongly recommend all users create and
        use their own personal Mapbox token to avoid any disruptions to their
        experience. You can do this with the ``mapbox.token`` config option. The
        use of Mapbox is governed by Mapbox's Terms of Use.

        To get a token for yourself, create an account at https://mapbox.com.
        For more info on how to set config options, see
        https://docs.streamlit.io/develop/api-reference/configuration/config.toml.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, pyarrow.Table, pyspark.sql.DataFrame,\
            snowflake.snowpark.dataframe.DataFrame, snowflake.snowpark.table.Table,\
            Iterable, dict, or None

            The data to be plotted.

        latitude : str or None
            The name of the column containing the latitude coordinates of
            the datapoints in the chart.

            If None, the latitude data will come from any column named 'lat',
            'latitude', 'LAT', or 'LATITUDE'.

        longitude : str or None
            The name of the column containing the longitude coordinates of
            the datapoints in the chart.

            If None, the longitude data will come from any column named 'lon',
            'longitude', 'LON', or 'LONGITUDE'.

        color : str or tuple or None
            The color of the circles representing each datapoint.

            Can be:

            * None, to use the default color.
            * A hex string like "#ffaa00" or "#ffaa0088".
            * An RGB or RGBA tuple with the red, green, blue, and alpha
              components specified as ints from 0 to 255 or floats from 0.0 to
              1.0.
            * The name of the column to use for the color. Cells in this column
              should contain colors represented as a hex string or color tuple,
              as described above.

        size : str or float or None
            The size of the circles representing each point, in meters.

            This can be:

            * None, to use the default size.
            * A number like 100, to specify a single size to use for all
              datapoints.
            * The name of the column to use for the size. This allows each
              datapoint to be represented by a circle of a different size.

        zoom : int
            Zoom level as specified in
            https://wiki.openstreetmap.org/wiki/Zoom_levels.

        use_container_width : bool
            Whether to override the map's native width with the width of
            the parent container. If ``use_container_width`` is ``True``
            (default), Streamlit sets the width of the map to match the width
            of the parent container. If ``use_container_width`` is ``False``,
            Streamlit sets the width of the chart to fit its contents according
            to the plotting library, up to the width of the parent container.

        Examples
        --------
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
           height: 600px

        You can also customize the size and color of the datapoints:

        >>> st.map(df, size=20, color='#0044ff')

        And finally, you can choose different columns to use for the latitude
        and longitude components, as well as set size and color of each
        datapoint dynamically based on other columns:

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame({
        ...     "col1": np.random.randn(1000) / 50 + 37.76,
        ...     "col2": np.random.randn(1000) / 50 + -122.4,
        ...     "col3": np.random.randn(1000) * 100,
        ...     "col4": np.random.rand(1000, 4).tolist(),
        ... })
        >>>
        >>> st.map(df,
        ...     latitude='col1',
        ...     longitude='col2',
        ...     size='col3',
        ...     color='col4')

        .. output::
           https://doc-map-color.streamlit.app/
           height: 600px

        """
        # This feature was turned off while we investigate why different
        # map styles cause DeckGL to crash.
        #
        # For reference, this was the docstring for map_style:
        #
        #   map_style : str or None
        #       One of Mapbox's map style URLs. A full list can be found here:
        #       https://docs.mapbox.com/api/maps/styles/#mapbox-styles
        #
        #       This feature requires a Mapbox token. See the top of these docs
        #       for information on how to get one and set it up in Streamlit.
        #
        map_style = None
        map_proto = DeckGlJsonChartProto()
        deck_gl_json = to_deckgl_json(
            data, latitude, longitude, size, color, map_style, zoom
        )
        marshall(map_proto, deck_gl_json, use_container_width)
        return self.dg._enqueue("deck_gl_json_chart", map_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def to_deckgl_json(
    data: Data,
    lat: str | None,
    lon: str | None,
    size: None | str | float,
    color: None | str | Collection[float],
    map_style: str | None,
    zoom: int | None,
) -> str:
    if data is None:
        return json.dumps(_DEFAULT_MAP)

    # TODO(harahu): iterables don't have the empty attribute. This is either
    # a bug, or the documented data type is too broad. One or the other
    # should be addressed
    if hasattr(data, "empty") and data.empty:
        return json.dumps(_DEFAULT_MAP)

    df = type_util.convert_anything_to_df(data)

    lat_col_name = _get_lat_or_lon_col_name(df, "latitude", lat, _DEFAULT_LAT_COL_NAMES)
    lon_col_name = _get_lat_or_lon_col_name(
        df, "longitude", lon, _DEFAULT_LON_COL_NAMES
    )
    size_arg, size_col_name = _get_value_and_col_name(df, size, _DEFAULT_SIZE)
    color_arg, color_col_name = _get_value_and_col_name(df, color, _DEFAULT_COLOR)

    # Drop columns we're not using.
    # (Sort for tests)
    used_columns = sorted(
        [
            c
            for c in {lat_col_name, lon_col_name, size_col_name, color_col_name}
            if c is not None
        ]
    )
    df = df[used_columns]

    color_arg = _convert_color_arg_or_column(df, color_arg, color_col_name)

    zoom, center_lat, center_lon = _get_viewport_details(
        df, lat_col_name, lon_col_name, zoom
    )

    default = copy.deepcopy(_DEFAULT_MAP)
    default["initialViewState"]["latitude"] = center_lat
    default["initialViewState"]["longitude"] = center_lon
    default["initialViewState"]["zoom"] = zoom
    default["layers"] = [
        {
            "@@type": "ScatterplotLayer",
            "getPosition": f"@@=[{lon_col_name}, {lat_col_name}]",
            "getRadius": size_arg,
            "radiusMinPixels": 3,
            "radiusUnits": "meters",
            "getFillColor": color_arg,
            "data": df.to_dict("records"),
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
    data: DataFrame,
    human_readable_name: str,
    col_name_from_user: str | None,
    default_col_names: set[str],
) -> str:
    """Returns the column name to be used for latitude or longitude."""

    if isinstance(col_name_from_user, str) and col_name_from_user in data.columns:
        col_name = col_name_from_user

    else:
        # Try one of the default col_names:
        candidate_col_name = None

        for c in default_col_names:
            if c in data.columns:
                candidate_col_name = c
                break

        if candidate_col_name is None:
            formatted_allowed_col_name = ", ".join(map(repr, sorted(default_col_names)))
            formmated_col_names = ", ".join(map(repr, list(data.columns)))

            raise StreamlitAPIException(
                f"Map data must contain a {human_readable_name} column named: "
                f"{formatted_allowed_col_name}. Existing columns: {formmated_col_names}"
            )
        else:
            col_name = candidate_col_name

    # Check that the column is well-formed.
    # IMPLEMENTATION NOTE: We can't use isnull().values.any() because .values can return
    # ExtensionArrays, which don't have a .any() method.
    # (Read about ExtensionArrays here: # https://pandas.pydata.org/community/blog/extension-arrays.html)
    # However, after a performance test I found the solution below runs basically as
    # fast as .values.any().
    if any(data[col_name].isnull().array):
        raise StreamlitAPIException(
            f"Column {col_name} is not allowed to contain null values, such "
            "as NaN, NaT, or None."
        )

    return col_name


def _get_value_and_col_name(
    data: DataFrame,
    value_or_name: Any,
    default_value: Any,
) -> tuple[Any, str | None]:
    """Take a value_or_name passed in by the Streamlit developer and return a PyDeck
    argument and column name for that property.

    This is used for the size and color properties of the chart.

    Example:
    - If the user passes size=None, this returns the default size value and no column.
    - If the user passes size=42, this returns 42 and no column.
    - If the user passes size="my_col_123", this returns "@@=my_col_123" and "my_col_123".
    """

    pydeck_arg: str | float

    if isinstance(value_or_name, str) and value_or_name in data.columns:
        col_name = value_or_name
        pydeck_arg = f"@@={col_name}"
    else:
        col_name = None

        if value_or_name is None:
            pydeck_arg = default_value
        else:
            pydeck_arg = value_or_name

    return pydeck_arg, col_name


def _convert_color_arg_or_column(
    data: DataFrame,
    color_arg: str | Color,
    color_col_name: str | None,
) -> None | str | IntColorTuple:
    """Converts color to a format accepted by PyDeck.

    For example:
    - If color_arg is "#fff", then returns (255, 255, 255, 255).
    - If color_col_name is "my_col_123", then it converts everything in column my_col_123 to
      an accepted color format such as (0, 100, 200, 255).

    NOTE: This function mutates the data argument.
    """

    color_arg_out: None | str | IntColorTuple = None

    if color_col_name is not None:
        # Convert color column to the right format.
        if len(data[color_col_name]) > 0 and is_color_like(data[color_col_name].iat[0]):
            # Use .loc[] to avoid a SettingWithCopyWarning in some cases.
            data.loc[:, color_col_name] = data.loc[:, color_col_name].map(
                to_int_color_tuple
            )
        else:
            raise StreamlitAPIException(
                f'Column "{color_col_name}" does not appear to contain valid colors.'
            )

        # This is guaranteed to be a str because of _get_value_and_col_name
        assert isinstance(color_arg, str)
        color_arg_out = color_arg

    elif color_arg is not None:
        color_arg_out = to_int_color_tuple(color_arg)

    return color_arg_out


def _get_viewport_details(
    data: DataFrame, lat_col_name: str, lon_col_name: str, zoom: int | None
) -> tuple[int, float, float]:
    """Auto-set viewport when not fully specified by user."""
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


def marshall(
    pydeck_proto: DeckGlJsonChartProto,
    pydeck_json: str,
    use_container_width: bool,
) -> None:
    json_bytes = pydeck_json.encode("utf-8")
    id = hashlib.md5(json_bytes, **HASHLIB_KWARGS).hexdigest()

    pydeck_proto.json = pydeck_json
    pydeck_proto.use_container_width = use_container_width

    pydeck_proto.id = id
