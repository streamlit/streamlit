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

from __future__ import annotations

EMBED_QUERY_PARAM = "embed"
EMBED_OPTIONS_QUERY_PARAM = "embed_options"
EMBED_QUERY_PARAMS_KEYS = [EMBED_QUERY_PARAM, EMBED_OPTIONS_QUERY_PARAM]
ON_SELECTION_IGNORE = "ignore"
ON_SELECTION_RERUN = "rerun"
NO_SELECTION_OBJECTS_ERROR_VEGA_LITE = "In order to make VegaLite work, one needs to have a selection enabled through parameters. Please check out this documentation to add some: https://vega.github.io/vega-lite/docs/selection.html"
NO_SELECTION_OBJECTS_ERROR_ALTAIR = "In order to make Altair work, one needs to have a selection enabled through add_params. Please check out this documentation to add some: https://altair-viz.github.io/user_guide/interactions.html#selections-capturing-chart-interactions"
