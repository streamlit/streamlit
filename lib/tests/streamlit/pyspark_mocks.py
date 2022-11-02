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
import numpy as np
import pandas as pd
from pyspark.sql.dataframe import DataFrame as PySparkDataFrame
from pyspark.sql.session import SparkSession
from pyspark.sql.types import (
    FloatType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

MAP_DATA = [
    (55.22, 22.21),
    (47.21, 33.16),
    (22.56, 33.16),
    (58.19, 23.31),
    (57.21, 19.22),
]
PERSONAL_DATA = [
    ("Tomek", "NO", "XYZ", "1234", "M", 10),
    ("Paulina", "ANY", "XYZ", "5678", "F", 20),
]


class DataFrame:
    """This is dummy DataFrame class,
    which imitates pyspark.sql.dataframe.DataFrame class
    for testing purposes."""

    __module__ = "pyspark.sql.dataframe"

    def __init__(
        self, is_map: bool = False, is_numpy_arr: bool = False, num_of_rows: int = 50000
    ):
        self._data = None
        self._is_map: bool = is_map
        self._num_of_rows: int = num_of_rows
        self._is_numpy_arr: bool = is_numpy_arr
        self._limit: int = 0

    def _lazy_evaluation(self):
        if self._data is not None:
            return
        if self._is_map:
            self._data = pd.DataFrame(MAP_DATA, columns=["lat", "lon"])
            return
        if self._is_numpy_arr:
            self._data = pd.DataFrame(
                np.random.randn(self._num_of_rows, 4), columns=["A", "B", "C", "D"]
            )
            return
        self._data = pd.DataFrame(
            PERSONAL_DATA,
        )

    def limit(self, n: int):
        self._limit = n
        return self

    def toPandas(self):
        self._lazy_evaluation()
        if self._limit > 0:
            return self._data.head(self._limit)
        return self._data


def create_pyspark_dataframe_with_mocked_personal_data() -> PySparkDataFrame:
    """Returns PySpark DataFrame with mocked personal data."""
    spark = SparkSession.builder.appName("snowflake.com").getOrCreate()
    schema = StructType(
        [
            StructField("firstname", StringType(), True),
            StructField("middlename", StringType(), True),
            StructField("lastname", StringType(), True),
            StructField("id", StringType(), True),
            StructField("gender", StringType(), True),
            StructField("salary", IntegerType(), True),
        ]
    )
    return spark.createDataFrame(data=PERSONAL_DATA, schema=schema)


def create_pyspark_dataframe_with_mocked_map_data() -> PySparkDataFrame:
    """Returns PySpark DataFrame with mocked map data."""
    spark = SparkSession.builder.appName("snowflake.com").getOrCreate()
    map_schema = StructType(
        [StructField("lat", FloatType(), True), StructField("lon", FloatType(), True)]
    )
    return spark.createDataFrame(data=MAP_DATA, schema=map_schema)
