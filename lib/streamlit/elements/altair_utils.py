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

"""Useful classes for our native Altair-based charts.

These classes are used to pass some important info to add_rows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Hashable, TypedDict


class PrepDataColumns(TypedDict):
    """Columns used for the prep_data step in Altair Arrow charts."""

    x_column: str | None
    y_column_list: list[str]
    color_column: str | None
    size_column: str | None


@dataclass
class AddRowsMetadata:
    """Metadata needed by add_rows on native charts."""

    last_index: Hashable | None
    columns: PrepDataColumns
