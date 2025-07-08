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

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd


class DataFrame:
    """This is dummy DataFrame class, which imitates modin.pandas.dataframe.DataFrame class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a modin dataframe.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "modin.pandas.dataframe"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def _to_pandas(self) -> pd.DataFrame:
        return self._data

    def head(self, n: int) -> DataFrame:
        """Returns the top n element of a mock version of Modin DataFrame."""
        return DataFrame(self._data.head(n))


class Series:
    """This is dummy Series class, which imitates modin.pandas.series.Series class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a modin Series.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "modin.pandas.series"

    def __init__(self, data: pd.Series):
        self._data: pd.Series = data

    def _to_pandas(self) -> pd.Series:
        return self._data

    def head(self, n: int) -> Series:
        """Returns the top n element of a mock version of Modin Series."""
        return Series(self._data.head(n))
