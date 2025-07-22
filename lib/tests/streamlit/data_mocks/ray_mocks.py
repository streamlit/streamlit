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


class Dataset:
    """This is dummy Dataset class, which imitates ray.data.dataset.Dataset class
    for testing purposes. We use this to make sure that our code does a special handling
    if it detects a Ray Datasets.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "ray.data.dataset"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def to_pandas(self) -> pd.DataFrame:
        return self._data

    def limit(self, n: int) -> Dataset:
        """Returns the top n element of a mock version of Ray Dataset."""
        return Dataset(self._data.head(n))


class MaterializedDataset:
    """This is dummy MaterializedDataset class, which imitates
    ray.data.dataset.MaterializedDataset class for testing purposes. We use this to
    make sure that our code does a special handling if it detects a
    Ray MaterializedDataset.

    This allows testing of the functionality without having the library installed,
    but it won't capture changes in the API of the library. This requires
    integration tests.
    """

    __module__ = "ray.data.dataset"

    def __init__(self, data: pd.DataFrame):
        self._data: pd.DataFrame = data

    def to_pandas(self) -> pd.DataFrame:
        return self._data

    def limit(self, n: int) -> MaterializedDataset:
        """Returns the top n element of a mock version of Ray MaterializedDataset."""
        return MaterializedDataset(self._data.head(n))
