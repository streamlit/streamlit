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

"""A Python wrapper around DeckGl."""

import json
from typing import Any, List

from streamlit import case_converters
import streamlit.elements.lib.dicttools as dicttools
import streamlit.elements.data_frame_proto as data_frame_proto

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def marshall(proto, spec=None, use_container_width=False, **kwargs):
    """Marshall a proto with DeckGL chart info.

    See DeltaGenerator.deck_gl_chart for docs.
    """
    data = []  # type: List[Any]

    if spec is None:
        spec = dict()

    # Merge spec with unflattened kwargs, where kwargs take precedence.
    # This only works for string keys, but kwarg keys are strings anyways.
    spec = dict(spec, **dicttools.unflatten(kwargs))

    if "layers" not in spec:
        spec["layers"] = []

        # Syntax sugar: if no layers defined and data is passed at the top
        # level, create a scatterplot layer with the top-level data by default.
        if data is not None:
            spec["layers"].append({"data": data, "type": "ScatterplotLayer"})

    for layer in spec["layers"]:
        # Don't add layers that have no data.
        if "data" not in layer:
            continue

        # Remove DataFrame because it's not JSON-serializable
        data = layer.pop("data")

        layer_proto = proto.layers.add()
        fixed_layer = case_converters.convert_dict_keys(
            case_converters.to_lower_camel_case, layer
        )
        layer_proto.spec = json.dumps(fixed_layer)
        # TODO: If several layers use the same data frame, the data gets resent
        # for each layer. Need to improve this.
        data_frame_proto.marshall_data_frame(data, layer_proto.data)

    del spec["layers"]

    # Dump JSON after removing DataFrames (see loop above), because DataFrames
    # are not JSON-serializable.
    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width
