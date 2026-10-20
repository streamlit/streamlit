# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Helpers for describing a Streamlit app to an agent.

``json_encoding`` is the JSON form of values in those descriptions. Which
sessions record a description is decided in ``elements.lib.agent_spec``.
``snapshot`` turns a run's messages into the document an agent reads.
``tree`` merges that run's deltas, and ``widget_values`` reports each widget
value in the form a request can send back. ``errors`` lists the codes the API
answers a refused request with.
"""
