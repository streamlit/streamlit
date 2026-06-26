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

from __future__ import annotations

from typing import TYPE_CHECKING

# Verify that all valid InitialSideBarState literals are accepted by mypy.
if TYPE_CHECKING:
    from streamlit.commands.page_config import set_page_config

    set_page_config(initial_sidebar_state="auto")
    set_page_config(initial_sidebar_state="expanded")
    set_page_config(initial_sidebar_state="collapsed")
    set_page_config(initial_sidebar_state="locked")
    set_page_config(initial_sidebar_state=300)
    set_page_config(initial_sidebar_state=None)
