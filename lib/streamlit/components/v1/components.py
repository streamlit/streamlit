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

# The components.py file exists because existing custom components have started
# to rely on internals of the components package. For example, streamlit-option-menu accesses
# [register_widget](https://github.com/victoryhb/streamlit-option-menu/blob/master/streamlit_option_menu/streamlit_callback.py#L28),
# which is only a transitive import through `streamlit.components.v1.custom_component`.
# Since we do not know what other internals are used out in the wild, let's try to
# model the old behavior and not to break things.

from streamlit.components.v1.component_registry import (
    declare_component as declare_component,
)
from streamlit.components.v1.custom_component import *  # noqa: F403
