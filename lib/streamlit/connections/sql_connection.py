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

from streamlit.connections import ExperimentalBaseConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from sqlalchemy.engine.base import Engine
    from sqlalchemy.orm import Session


_REQUIRED_CONNECTION_PARAMS = {"dialect", "username", "host"}


class SQL(ExperimentalBaseConnection["Engine"]):
    def _connect(self, autocommit: bool = False, **kwargs) -> "Engine":
        import sqlalchemy

        secrets = self._secrets

        if "url" in secrets:
            url = sqlalchemy.engine.make_url(secrets["url"])
        else:
            for p in _REQUIRED_CONNECTION_PARAMS:
                if p not in secrets:
                    raise StreamlitAPIException(f"Missing SQL DB connection param: {p}")

            drivername = secrets["dialect"] + (
                f"+{secrets['driver']}" if "driver" in secrets else ""
            )

            url = sqlalchemy.engine.URL.create(
                drivername=drivername,
                username=secrets["username"],
                password=secrets.get("password"),
                host=secrets["host"],
                port=int(secrets["port"]) if "port" in secrets else None,
                database=secrets.get("database"),
            )

        eng = sqlalchemy.create_engine(url, **kwargs)

        if autocommit:
            return cast("Engine", eng.execution_options(isolation_level="AUTOCOMMIT"))
        else:
            return cast("Engine", eng)

    def read_sql(
        self,
        sql: str,
        ttl: Optional[Union[float, int, timedelta]] = None,
        **kwargs,
    ) -> pd.DataFrame:
        from sqlalchemy import text

        @cache_data(ttl=ttl)
        def _read_sql(sql: str, **kwargs) -> pd.DataFrame:
            instance = self._instance.connect()
            return pd.read_sql(text(sql), instance, **kwargs)

        return _read_sql(sql, **kwargs)

    @contextmanager
    def session(self) -> Iterator["Session"]:
        """A simple wrapper around SQLAlchemy Session context management.

        This allows us to write
            `with conn.session() as session:`
        instead of importing the sqlalchemy.orm.Session object and writing
            `with Session(conn._instance) as session:`

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

        with Session(self._instance) as s:
            yield s
