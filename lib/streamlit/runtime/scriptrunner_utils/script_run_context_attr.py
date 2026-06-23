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

"""The thread attribute name under which the active ScriptRunContext is stored.

This is a dependency-free leaf module so that both ``script_run_context`` and
``parallel_coordinator`` can share the constant without importing each other.
"""

from __future__ import annotations

from typing import Final

SCRIPT_RUN_CONTEXT_ATTR_NAME: Final = "streamlit_script_run_ctx"
