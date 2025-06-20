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
    """This is dummy DataFrame class, which imitates dask.dataframe.core.DataFrame class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a Dask DataFrame.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "dask.dataframe.core"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def head(self, n: int, compute: bool) -> pd.DataFrame:
        """Returns the top n element of a mock version of Dask DataFrame."""
        return self._data.head(n)


class Series:
    """This is dummy Series class, which imitates dask.dataframe.core.Series class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a Dask Series.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "dask.dataframe.core"

    def __init__(self, data: pd.Series):
        self._data: pd.Series = data

    def head(self, n: int, compute: bool) -> pd.Series:
        """Returns the top n element of a mock version of Dask Series."""
        return self._data.head(n)


class Index:
    """This is dummy Index class, which imitates dask.dataframe.core.Index class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a Dask Index.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "dask.dataframe.core"

    def __init__(self, data: pd.Index):
        self._data: pd.Index = data

    def head(self, n: int, compute: bool) -> pd.Index:
        """Returns the top n element of a mock version of Dask Index."""
        return self._data[:n]
