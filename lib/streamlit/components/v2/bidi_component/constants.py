# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from typing import Final

INTERNAL_COMPONENT_NAME: Final[str] = "bidi_component"

# Shared constant that delimits the base widget id from the event suffix.
# This value **must** stay in sync with its TypeScript counterpart defined in
# `frontend/lib/src/components/widgets/BidiComponent/constants.ts`.
EVENT_DELIM: Final[str] = "__"

# Shared constant that is used to identify ArrowReference objects in the data structure.
# This value **must** stay in sync with its TypeScript counterpart defined in
# `frontend/lib/src/components/widgets/BidiComponent/constants.ts`.
ARROW_REF_KEY: Final[str] = "__streamlit_arrow_ref__"
