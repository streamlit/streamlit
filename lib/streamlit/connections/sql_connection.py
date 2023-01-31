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
from typing import TYPE_CHECKING, Iterator, Optional, Union, cast

import pandas as pd

from streamlit.connections import BaseConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from sqlalchemy.engine.base import Engine
    from sqlalchemy.orm import Session


REQUIRED_CONNECTION_PARAMS = {"dialect", "username", "host", "port"}


class SQL(BaseConnection["Engine"]):
    _default_connection_name = "sql"

    def connect(self, autocommit: bool = False, **kwargs) -> "Engine":
        import sqlalchemy

        self._closed = False

        secrets = self.get_secrets()

        if "url" in secrets:
            url = secrets["url"]
        else:
            for p in REQUIRED_CONNECTION_PARAMS:
                if p not in secrets:
                    raise StreamlitAPIException(f"Missing SQL DB connection param: {p}")

            driver = f"+{secrets['driver']}" if "driver" in secrets else ""
            password = f":{secrets['password']}" if "password" in secrets else ""
            database = f"/{secrets['database']}" if "database" in secrets else ""

            url = "".join(
                [
                    secrets["dialect"],
                    driver,
                    "://",
                    secrets["username"],
                    password,
                    "@",
                    secrets["host"],
                    ":",
                    secrets["port"],
                    database,
                ]
            )

        eng = sqlalchemy.create_engine(sqlalchemy.engine.make_url(url), **kwargs)

        if autocommit:
            return cast("Engine", eng.execution_options(isolation_level="AUTOCOMMIT"))
        else:
            return cast("Engine", eng)

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
    def session(self) -> Iterator["Session"]:
        """A simple wrapper around SQLAlchemy Session context management.

        This allows us to write
            `with conn.session() as session:`
        instead of importing the Session object and writing
            `with Session(conn.instance) as session:`

        See the usage example below, which assumes we have a table `numbers` with a
        single integer column `val`.

        Example
        -------
        >>> n = st.slider("Pick a number")
        >>> if st.button("Add the number!"):
        ...     with conn.session() as session:
        ...         session.execute("INSERT INTO numbers (val) VALUES (:n);", {"n": n})
        ...         session.commit()
        """
        from sqlalchemy.orm import Session

        with Session(self.instance) as s:
            yield s
