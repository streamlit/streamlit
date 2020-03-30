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


# Map used when no data is passed.
EMPTY_MAP = {"initialViewState": {"latitude": 0, "longitude": 0, "pitch": 0, "zoom": 1}}


def marshall(element, pydeck_obj, use_container_width):
    if pydeck_obj is None:
        spec = json.dumps(EMPTY_MAP)
    else:
        spec = pydeck_obj.to_json()

    element.deck_gl_json_chart.json = spec
    element.deck_gl_json_chart.use_container_width = use_container_width

    if pydeck_obj is not None and isinstance(pydeck_obj.deck_widget.tooltip, dict):
        element.deck_gl_json_chart.tooltip = json.dumps(pydeck_obj.deck_widget.tooltip)
