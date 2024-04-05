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

from streamlit.constants import ON_SELECTION_IGNORE, ON_SELECTION_RERUN
from streamlit.errors import StreamlitAPIException


def check_on_select_str(on_select: str, command: str):
    if on_select != ON_SELECTION_IGNORE and on_select != ON_SELECTION_RERUN:
        raise StreamlitAPIException(
            f"You have passed {on_select}. `st.{command}` only accepts '{ON_SELECTION_IGNORE}' or '{ON_SELECTION_RERUN}'."
        )
