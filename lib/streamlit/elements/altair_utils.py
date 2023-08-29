# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Useful classes for our native Altair-based charts.

These classes are used in both Arrow-based and legacy-based charting code to pass some
important info to add_rows.
"""

from dataclasses import dataclass
from typing import Hashable, List, Optional, TypedDict


class PrepDataColumns(TypedDict):
    """Columns used for the prep_data step in Altair Arrow charts."""

    x_column: Optional[str]
    y_column_list: List[str]
    color_column: Optional[str]


@dataclass
class AddRowsMetadata:
    """Metadata needed by add_rows on native charts."""

    last_index: Optional[Hashable]
    columns: PrepDataColumns
