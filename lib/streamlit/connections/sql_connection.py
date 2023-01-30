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

from contextlib import contextmanager
from datetime import timedelta
from typing import Iterator, Optional, Union

import pandas as pd
import sqlalchemy
from sqlalchemy.engine.base import Engine
from sqlalchemy.orm import Session

from streamlit.connections import BaseConnection
from streamlit.runtime.caching import cache_data


class SQL(BaseConnection[Engine]):
    _default_connection_name = "sql"

    def connect(self, **kwargs) -> Engine:
        self._closed = False

        secrets = self.get_secrets()
        # TODO(vdonato): Allow developers to alternatively specify connection parameters
        #                individually rather than via a single connection string.
        return sqlalchemy.create_engine(
            sqlalchemy.engine.make_url(secrets["url"]), **kwargs
        )

    def disconnect(self) -> None:
        self.instance.dispose()
        self._closed = True

    def is_connected(self) -> bool:
        # SQLAlchemy implements connection pooling for us, so we don't have to worry
        # about whether connections are alive for the most part.
        #
        # Users that *really* care about ensuring that connections returned by the
        # SQLAlchemy connection pool aren't stale can initialize the connection with the
        # pool_pre_ping option set to True.
        return not self._closed

    @staticmethod
    def _read_sql(sql: str, _instance, **kwargs) -> pd.DataFrame:
        return pd.read_sql(sql, _instance, **kwargs)

    def read_sql(
        self,
        sql: str,
        ttl: Optional[Union[float, int, timedelta]] = None,
        **kwargs,
    ) -> pd.DataFrame:
        instance = self.instance.connect()

        # TODO(vdonato): Fix the type error below.
        return cache_data(self._read_sql, ttl=ttl)(  # type: ignore
            sql, instance, **kwargs
        )

    @contextmanager
    def session(self) -> Iterator[Session]:
        """A simple wrapper around SQLAlchemy Session context management.

        This allows us to write
            `with conn.session() as session:`
        instead of importing the Session object and writing
            `with Session(conn.instance) as session:`
        """
        with Session(self.instance) as s:
            yield s
