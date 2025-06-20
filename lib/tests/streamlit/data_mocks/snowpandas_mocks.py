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
    """This is dummy DataFrame class, which imitates
    snowflake.snowpark.modin.pandas.dataframe.DataFrame class for testing purposes.
    We use this to make sure that our code does a special handling
    if it detects a Snowpark Pandas Dataframe.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "snowflake.snowpark.modin.pandas.dataframe"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def to_pandas(self) -> pd.DataFrame:
        return self._data

    def head(self, n: int) -> DataFrame:
        """Returns the top n element of a mock version of Snowpark Pandas DataFrame"""
        return DataFrame(self[:n])

    def __getitem__(self, key: slice | int) -> DataFrame:
        # Allow slicing and integer indexing
        return DataFrame(self._data[key])


class Series:
    """This is dummy Series class, which imitates
    snowflake.snowpark.modin.pandas.series.Series class for testing purposes.
    We use this to make sure that our code does a special handling
    if it detects a Snowpark Pandas Series.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "snowflake.snowpark.modin.pandas.series"

    def __init__(self, data: pd.Series):
        self._data: pd.Series = data

    def to_pandas(self) -> pd.Series:
        return self._data

    def head(self, n: int) -> Series:
        """Returns the top n element of a mock version of Snowpark Pandas Series"""
        return Series(self[:n])

    def __getitem__(self, key: slice | int) -> Series:
        # Allow slicing and integer indexing
        return Series(self._data[key])


class Index:
    """This is dummy Index class, which imitates
    snowflake.snowpark.modin.plugin.extensions.index.Index class for testing purposes.
    We use this to make sure that our code does a special handling
    if it detects a Snowpark Pandas Index.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "snowflake.snowpark.modin.plugin.extensions.index"

    def __init__(self, data: pd.Index):
        self._data: pd.Index = data

    def to_pandas(self) -> pd.Index:
        return self._data

    def head(self, n: int) -> Index:
        """Returns the top n element of a mock version of Snowpark Pandas Series"""
        return Index(self[:n])

    def __getitem__(self, key: slice | int) -> Index:
        # Allow slicing and integer indexing
        return Index(self._data[key])
