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

"""A wrapper for simple PyDeck scatter charts."""

import copy
import json
from typing import Any, Dict

import pandas as pd

from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as DeckGlJsonChartProto
import streamlit.elements.deck_gl_json_chart as deck_gl_json_chart
from streamlit.errors import StreamlitAPIException


class MapMixin:
    def map(dg, data=None, zoom=None, use_container_width=True):
        """Display a map with points on it.

        This is a wrapper around st.pydeck_chart to quickly create scatterplot
        charts on top of a map, with auto-centering and auto-zoom.

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict,
            or None
            The data to be plotted. Must have columns called 'lat', 'lon',
            'latitude', or 'longitude'.
        zoom : int
            Zoom level as specified in
            https://wiki.openstreetmap.org/wiki/Zoom_levels

        Example
        -------
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...     columns=['lat', 'lon'])
        >>>
        >>> st.map(df)

        .. output::
           https://static.streamlit.io/0.53.0-SULT/index.html?id=9gTiomqPEbvHY2huTLoQtH
           height: 600px

        """
        map_proto = DeckGlJsonChartProto()
        map_proto.json = to_deckgl_json(data, zoom)
        map_proto.use_container_width = use_container_width
        return dg._enqueue("deck_gl_json_chart", map_proto)  # type: ignore


# Map used as the basis for st.map.
_DEFAULT_MAP = dict(deck_gl_json_chart.EMPTY_MAP)  # type: Dict[str, Any]
_DEFAULT_MAP["mapStyle"] = "mapbox://styles/mapbox/light-v10"

# Other default parameters for st.map.
_DEFAULT_COLOR = [200, 30, 0, 160]
_DEFAULT_ZOOM_LEVEL = 12
_ZOOM_LEVELS = [
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


def _get_zoom_level(distance):
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

    # For small number of points the default zoom level will be used.
    if distance < _ZOOM_LEVELS[-1]:
        return _DEFAULT_ZOOM_LEVEL

    for i in range(len(_ZOOM_LEVELS) - 1):
        if _ZOOM_LEVELS[i + 1] < distance <= _ZOOM_LEVELS[i]:
            return i


def to_deckgl_json(data, zoom):

    if data is None or data.empty:
        return json.dumps(_DEFAULT_MAP)

    if "lat" in data:
        lat = "lat"
    elif "latitude" in data:
        lat = "latitude"
    else:
        raise StreamlitAPIException(
            'Map data must contain a column named "latitude" or "lat".'
        )

    if "lon" in data:
        lon = "lon"
    elif "longitude" in data:
        lon = "longitude"
    else:
        raise StreamlitAPIException(
            'Map data must contain a column called "longitude" or "lon".'
        )

    if data[lon].isnull().values.any() or data[lat].isnull().values.any():
        raise StreamlitAPIException("Latitude and longitude data must be numeric.")

    data = pd.DataFrame(data)

    min_lat = data[lat].min()
    max_lat = data[lat].max()
    min_lon = data[lon].min()
    max_lon = data[lon].max()
    center_lat = (max_lat + min_lat) / 2.0
    center_lon = (max_lon + min_lon) / 2.0
    range_lon = abs(max_lon - min_lon)
    range_lat = abs(max_lat - min_lat)

    if zoom == None:
        if range_lon > range_lat:
            longitude_distance = range_lon
        else:
            longitude_distance = range_lat
        zoom = _get_zoom_level(longitude_distance)

    # "+1" because itertuples includes the row index.
    lon_col_index = data.columns.get_loc(lon) + 1
    lat_col_index = data.columns.get_loc(lat) + 1
    final_data = []
    for row in data.itertuples():
        final_data.append(
            {"lon": float(row[lon_col_index]), "lat": float(row[lat_col_index])}
        )

    default = copy.deepcopy(_DEFAULT_MAP)
    default["initialViewState"]["latitude"] = center_lat
    default["initialViewState"]["longitude"] = center_lon
    default["initialViewState"]["zoom"] = zoom
    default["layers"] = [
        {
            "@@type": "ScatterplotLayer",
            "getPosition": "@@=[lon, lat]",
            "getRadius": 10,
            "radiusScale": 10,
            "radiusMinPixels": 3,
            "getFillColor": _DEFAULT_COLOR,
            "data": final_data,
        }
    ]
    return json.dumps(default)
