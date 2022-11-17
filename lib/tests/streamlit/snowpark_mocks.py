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


import random
from typing import List

import numpy as np
import pandas as pd


class _SnowparkDataLikeBaseClass:
    def __init__(
        self, is_map: bool = False, num_of_rows: int = 50000, num_of_cols: int = 4
    ):
        self._data = None
        self._is_map = is_map
        self._num_of_rows = num_of_rows
        self._num_of_cols = num_of_cols

    def count(self) -> int:
        return self._num_of_rows

    def take(self, n: int):
        """Returns n element of fake Data like, which imitates take of snowflake.snowpark.dataframe.DataFrame"""
        self._lazy_evaluation()
        if n > self._num_of_rows:
            n = self._num_of_rows
        return self._data[:n]

    def collect(self) -> List[List[int]]:
        """Returns fake Data like, which imitates collection of snowflake.snowpark.dataframe.DataFrame"""
        self._lazy_evaluation()
        return self._data

    def _lazy_evaluation(self):
        """Sometimes we don't need data inside Data like class, so we populate it once and only when necessary"""
        if self._data is None:
            if self._is_map:
                self._data = pd.DataFrame(
                    (
                        np.random.randn(self._num_of_rows, 2) / [50, 50]
                        + [37.76, -122.4]
                    ),
                    columns=["lat", "lon"],
                )
            else:
                random.seed(0)
                self._data = self._random_data()

    def _random_data(self) -> List[List[int]]:
        data: List[List[int]] = []
        for _ in range(0, self._num_of_rows):
            data.append(self._random_row())
        return data

    def _random_row(self) -> List[int]:
        row: List[int] = []
        for _ in range(0, self._num_of_cols):
            row.append(random.randint(1, 1000000))
        return row


class DataFrame(_SnowparkDataLikeBaseClass):
    """This is dummy DataFrame class,
    which imitates snowflake.snowpark.dataframe.DataFrame class
    for testing purposes."""

    __module__ = "snowflake.snowpark.dataframe"

    def __init__(
        self, is_map: bool = False, num_of_rows: int = 50000, num_of_cols: int = 4
    ):
        super().__init__(
            is_map=is_map, num_of_rows=num_of_rows, num_of_cols=num_of_cols
        )


class Table(_SnowparkDataLikeBaseClass):
    """This is dummy Table class,
    which imitates snowflake.snowpark.dataframe.DataFrame class
    for testing purposes."""

    __module__ = "snowflake.snowpark.table"

    def __init__(
        self, is_map: bool = False, num_of_rows: int = 50000, num_of_cols: int = 4
    ):
        super().__init__(
            is_map=is_map, num_of_rows=num_of_rows, num_of_cols=num_of_cols
        )


class Row:
    """This is dummy Row class,
    which imitates snowflake.snowpark.row.Row class
    for testing purposes."""

    __module__ = "snowflake.snowpark.row"
