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

"""A Python wrapper around Vega-Lite."""

import json

import streamlit.elements.lib.dicttools as dicttools
import streamlit.elements.data_frame_proto as data_frame_proto

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def marshall(proto, data=None, spec=None, use_container_width=False, **kwargs):
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

    # Pull data out of spec dict when it's in a 'dataset' key:
    #   marshall(proto, {datasets: {foo: df1, bar: df2}, ...})
    if "datasets" in spec:
        for k, v in spec["datasets"].items():
            dataset = proto.datasets.add()
            dataset.name = str(k)
            dataset.has_name = True
            data_frame_proto.marshall_data_frame(v, dataset.data)
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
                del data_spec["values"]
        else:
            data = data_spec
            del spec["data"]

    proto.spec = json.dumps(spec)
    proto.use_container_width = use_container_width

    if data is not None:
        data_frame_proto.marshall_data_frame(data, proto.data)


# See https://vega.github.io/vega-lite/docs/encoding.html
_CHANNELS = set(
    [
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
    ]
)
