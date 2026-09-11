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

"""Prototype of the agent API: drive a Streamlit app over HTTP without a browser.

An agent posts widget values to ``/_stcore/agent/v1/interact`` and gets back a
typed snapshot of the finished app, named after the public ``st.*`` API. The
whole surface is off unless ``server.enableAgentApi`` is set, and it is only
served to loopback callers.
"""
