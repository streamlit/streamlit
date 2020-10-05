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

import json
from streamlit.proto.DeckGlJsonChart_pb2 import DeckGlJsonChart as PydeckProto


class PydeckMixin:
    def pydeck_chart(dg, pydeck_obj=None, use_container_width=False):
        """Draw a chart using the PyDeck library.

        This supports 3D maps, point clouds, and more! More info about PyDeck
        at https://deckgl.readthedocs.io/en/latest/.

        These docs are also quite useful:

        - DeckGL docs: https://github.com/uber/deck.gl/tree/master/docs
        - DeckGL JSON docs: https://github.com/uber/deck.gl/tree/master/modules/json

        When using this command, we advise all users to use a personal Mapbox
        token. This ensures the map tiles used in this chart are more
        robust. You can do this with the mapbox.token config option.

        To get a token for yourself, create an account at
        https://mapbox.com. It's free! (for moderate usage levels) See
        https://docs.streamlit.io/en/latest/cli.html#view-all-config-options for more
        info on how to set config options.

        Parameters
        ----------
        spec: pydeck.Deck or None
            Object specifying the PyDeck chart to draw.

        Example
        -------
        Here's a chart using a HexagonLayer and a ScatterplotLayer on top of
        the light map style:

        >>> df = pd.DataFrame(
        ...    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...    columns=['lat', 'lon'])
        >>>
        >>> st.pydeck_chart(pdk.Deck(
        ...     map_style='mapbox://styles/mapbox/light-v9',
        ...     initial_view_state=pdk.ViewState(
        ...         latitude=37.76,
        ...         longitude=-122.4,
        ...         zoom=11,
        ...         pitch=50,
        ...     ),
        ...     layers=[
        ...         pdk.Layer(
        ...            'HexagonLayer',
        ...            data=df,
        ...            get_position='[lon, lat]',
        ...            radius=200,
        ...            elevation_scale=4,
        ...            elevation_range=[0, 1000],
        ...            pickable=True,
        ...            extruded=True,
        ...         ),
        ...         pdk.Layer(
        ...             'ScatterplotLayer',
        ...             data=df,
        ...             get_position='[lon, lat]',
        ...             get_color='[200, 30, 0, 160]',
        ...             get_radius=200,
        ...         ),
        ...     ],
        ... ))

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=ASTdExBpJ1WxbGceneKN1i
           height: 530px

        """
        pydeck_proto = PydeckProto()
        marshall(pydeck_proto, pydeck_obj, use_container_width)
        return dg._enqueue("deck_gl_json_chart", pydeck_proto)  # type: ignore


# Map used when no data is passed.
EMPTY_MAP = {"initialViewState": {"latitude": 0, "longitude": 0, "pitch": 0, "zoom": 1}}


def marshall(pydeck_proto, pydeck_obj, use_container_width):
    if pydeck_obj is None:
        spec = json.dumps(EMPTY_MAP)
    else:
        spec = pydeck_obj.to_json()

    pydeck_proto.json = spec
    pydeck_proto.use_container_width = use_container_width

    if pydeck_obj is not None and isinstance(pydeck_obj.deck_widget.tooltip, dict):
        pydeck_proto.tooltip = json.dumps(pydeck_obj.deck_widget.tooltip)
