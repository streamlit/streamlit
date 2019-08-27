# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, \
    absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import pandas as pd
from math import sqrt

from streamlit.logger import get_logger
import streamlit.elements.deck_gl as deck_gl

LOGGER = get_logger(__name__)

ZOOM_LEVELS = [
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
    0.0005
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
        The zoom level, from 0 to 29.

    """

    for i, v in enumerate(ZOOM_LEVELS):
        if ZOOM_LEVELS[i] > distance > ZOOM_LEVELS[i + 1]:
            return i - 1


def marshall(element, data, zoom=None):
    """Marshall a proto with DeckGL chart info.

    This is a shorthand for DeltaGenerator.deck_gl_chart,
    which will auto center and auto zoom the chart.
    If it is needed you can specify the zoom param.

    See DeltaGenerator.deck_gl_chart for docs.

    """
    LAT_LON = ['lat', 'lon']

    if 'lat' in data:
        lat = 'lat'
    elif 'latitude' in data:
        lat = 'latitude'
    else:
        raise Exception(
            'Map data must contain a column called "latitude" or "lat".')

    if 'lon' in data:
        lon = 'lon'
    elif 'longitude' in data:
        lon = 'longitude'
    else:
        raise Exception(
            'Map data must contain a column called "longitude" or "lon".')

    if data[lon].isnull().values.any() or data[lat].isnull().values.any():
        raise Exception('Latitude and longitude data must be numeric.')

    data = pd.DataFrame(data)

    if zoom is None:
        min_lat = data[lat].min()
        max_lat = data[lat].max()
        min_lon = data[lon].min()
        max_lon = data[lon].max()

        center_lat = (max_lat + min_lat) / 2
        center_lon = (max_lon + min_lon) / 2

        range_lon = abs(max_lon - min_lon)
        range_lat = abs(max_lat - min_lat)

        if range_lon > range_lat:
            longitude_distance = range_lon
        else:
            longitude_distance = range_lat

        zoom = _get_zoom_level(longitude_distance)

    deck_gl.marshall(element.deck_gl_chart,
                     viewport={
                         'latitude': center_lat,
                         'longitude': center_lon,
                         'zoom': zoom,
                         'pitch': 0,
                     },
                     layers=[{
                         'type': 'ScatterplotLayer',
                         'data': data,
                     }])
