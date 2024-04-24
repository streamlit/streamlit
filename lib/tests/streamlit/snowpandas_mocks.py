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

import numpy as np
import pandas as pd


class DataFrame:
    __module__ = "snowflake.snowpark.modin.pandas.dataframe"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def to_pandas(self) -> pd.DataFrame:
        return self._data

    def head(self, n: int) -> "DataFrame":
        """Returns the top n element of a mock version of snowflake.snowpark.modin.pandas.dataframe.DataFrame"""
        return DataFrame(self._data.head(n))


class Series:
    __module__ = "snowflake.snowpark.modin.pandas.series"

    def __init__(self, data: pd.Series):
        self._data: pd.Series = data

    def to_pandas(self) -> pd.Series:
        return self._data

    def head(self, n: int) -> "Series":
        """Returns the top n element of a mock version of snowflake.snowpark.modin.pandas.series.Series"""
        return Series(self._data.head(n))


def get_random_dataframe(num_of_rows: int = 50000, num_of_cols: int = 4) -> DataFrame:
    """Returns a random Snowpark Pandas DataFrame with the specified number of rows and columns."""
    return DataFrame(pd.DataFrame(np.random.randn(num_of_rows, num_of_cols)))


def get_random_series(num_of_rows: int = 50000) -> Series:
    """Returns a random Snowpark Pandas Series with the specified number of rows."""
    return Series(pd.Series(np.random.randn(num_of_rows)))
