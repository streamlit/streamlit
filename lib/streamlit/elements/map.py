# Copyright 2018 Streamlit Inc. All rights reserved.

""" MAP element which uses deck_gl under the hood."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())


import pandas as pd
from math import sqrt

from streamlit.logger import get_logger
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


def _get_bounding_rectangle(geolocations):
    """
    Gets the maximum and minimum latitudes and longitude for a given array of
    locations

    param geolocations: array of lat and lon
    """
    maxLat = -85
    minLat = 85
    maxLon = -180
    minLon = 180

    for location in geolocations:
        lat = location[0]
        lon = location[1]

        if lat>maxLat:
            maxLat = lat
        if lat<minLat:
            minLat = lat
        if lon>maxLon:
            maxLon = lon
        if lon<minLon:
            minLon = lon

    return {'min': (minLat, minLon), 'max': (maxLat, maxLon)}


def _calculateDistance(x1, y1, x2, y2):
    """
        Calculate distance between two locations
    """

    dist = sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    return dist


def marshall(element, data, zoom = None):
        """
            Marshall a proto with DeckGL chart info.

            This is a shorthand for DeltaGenerator.deck_gl_chart,
            which will auto center and auto zoom the chart.
            If it is needed you can specify the zoom param.

            See DeltaGenerator.deck_gl_chart for docs.
        """

        LAT_LON = ['lat', 'lon']
        if not set(data.columns) >= set(LAT_LON):
            raise Exception('Map data must contain "lat" and "lon" columns.')
        if (data['lon'].isnull().values.any() or
            data['lat'].isnull().values.any()):
            raise Exception('Map data must be numeric.')

        if isinstance(data, pd.DataFrame):
            bounding = _get_bounding_rectangle(data[LAT_LON].values)
        else:
            bounding = _get_bounding_rectangle(data)

        center_viewport = [
            (bounding['max'][0] + bounding['min'][0])/2,
            (bounding['max'][1] + bounding['min'][1])/2,
        ]

        width = bounding['min'][1] + bounding['max'][1]
        height = bounding['min'][0] + bounding['max'][0]

        if width > height:
            longitudeDistance = _calculateDistance(center_viewport[0],
                                                  center_viewport[1],
                                                  center_viewport[0],
                                                  bounding['max'][1])
        else:
            longitudeDistance = _calculateDistance(center_viewport[0],
                                                  center_viewport[1],
                                                  bounding['max'][0],
                                                  center_viewport[1])

        if zoom is None:
            zoom = _get_zoom_level(longitudeDistance)

        import streamlit.elements.deck_gl as deck_gl
        deck_gl.marshall(element.deck_gl_chart,
                         viewport={
                             'latitude': center_viewport[0],
                             'longitude': center_viewport[1],
                             'zoom': zoom,
                             'pitch': 50,
                         },
                         layers=[{
                             'type': 'HexagonLayer',
                             'data': data,
                             'radius': 200,
                             'elevationScale': 4,
                             'elevationRange': [0, 1000],
                             'pickable': True,
                             'extruded': True,
                         }, {
                             'type': 'ScatterplotLayer',
                             'data': data,
                         }])
