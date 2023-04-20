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

from collections import ChainMap
from contextlib import contextmanager
from copy import deepcopy
from datetime import timedelta
from typing import TYPE_CHECKING, Iterator, List, Optional, Union, cast

import pandas as pd

from streamlit.connections import ExperimentalBaseConnection
from streamlit.connections.util import extract_from_dict
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from sqlalchemy.engine.base import Engine
    from sqlalchemy.orm import Session


_ALL_CONNECTION_PARAMS = {
    "url",
    "driver",
    "dialect",
    "username",
    "password",
    "host",
    "port",
    "database",
}
_REQUIRED_CONNECTION_PARAMS = {"dialect", "username", "host"}


class SQLConnection(ExperimentalBaseConnection["Engine"]):
    """A thin wrapper around SQLALchemy that makes it play nicely with
    st.experimental_connection.

    The SQLConnection connection also provides the `query` convenience method, which can be used to
    run simple read-only queries with both caching and simple error handling/retries.

    More complex DB interactions can be performed by using the .session() contextmanager
    pattern to receive a regular SQLAlchemy Session.
    """

    def _connect(self, autocommit: bool = False, **kwargs) -> "Engine":
        import sqlalchemy

        kwargs = deepcopy(kwargs)
        conn_param_kwargs = extract_from_dict(_ALL_CONNECTION_PARAMS, kwargs)
        conn_params = ChainMap(conn_param_kwargs, self._secrets.to_dict())

        if not len(conn_params):
            raise StreamlitAPIException(
                "Missing SQL DB connection configuration. "
                "Did you forget to set this in `secrets.toml` or as kwargs to `st.experimental_connection`?"
            )

        if "url" in conn_params:
            url = sqlalchemy.engine.make_url(conn_params["url"])
        else:
            for p in _REQUIRED_CONNECTION_PARAMS:
                if p not in conn_params:
                    raise StreamlitAPIException(f"Missing SQL DB connection param: {p}")

            drivername = conn_params["dialect"] + (
                f"+{conn_params['driver']}" if "driver" in conn_params else ""
            )

            url = sqlalchemy.engine.URL.create(
                drivername=drivername,
                username=conn_params["username"],
                password=conn_params.get("password"),
                host=conn_params["host"],
                port=int(conn_params["port"]) if "port" in conn_params else None,
                database=conn_params.get("database"),
            )

        create_engine_kwargs = ChainMap(
            kwargs, self._secrets.get("create_engine_kwargs", {})
        )
        eng = sqlalchemy.create_engine(url, **create_engine_kwargs)

        if autocommit:
            return cast("Engine", eng.execution_options(isolation_level="AUTOCOMMIT"))
        else:
            return cast("Engine", eng)

    def query(
        self,
        sql: str,
        *,  # keyword-only arguments:
        ttl: Optional[Union[float, int, timedelta]] = None,
        index_col: Optional[Union[str, List[str]]] = None,
        chunksize: Optional[int] = None,
        params=None,
        **kwargs,
    ) -> pd.DataFrame:
        """Run a read-only query.

        This method implements both query result caching (with caching behavior
        identical to that of using @st.cache_data) as well as simple error handling/retries.
        Note that queries that are run without a specified ttl are cached indefinitely.

        Aside from the `ttl` kwarg, all kwargs passed to this function are passed down
        to [pd.read_sql](https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html).
        and have the behavior described in the pandas documentation.

        Returns
        -------
        pd.DataFrame
            The result of running the query, formatted as a pandas DataFrame.
        """

        from sqlalchemy import text
        from sqlalchemy.exc import DatabaseError, InternalError, OperationalError
        from tenacity import (
            retry,
            retry_if_exception_type,
            stop_after_attempt,
            wait_fixed,
        )

        @retry(
            after=lambda _: self.reset(),
            stop=stop_after_attempt(3),
            reraise=True,
            retry=retry_if_exception_type(
                (DatabaseError, InternalError, OperationalError)
            ),
            wait=wait_fixed(1),
        )
        @cache_data(
            show_spinner="Running `sql.query(...)`.",
            ttl=ttl,
        )
        def _query(
            sql: str,
            index_col=None,
            chunksize=None,
            params=None,
            **kwargs,
        ) -> pd.DataFrame:
            instance = self._instance.connect()
            return pd.read_sql(
                text(sql),
                instance,
                index_col=index_col,
                chunksize=chunksize,
                params=params,
                **kwargs,
            )

        return _query(
            sql,
            index_col=index_col,
            chunksize=chunksize,
            params=params,
            **kwargs,
        )

    @contextmanager
    def session(self) -> Iterator["Session"]:
        """A thin wrapper around SQLAlchemy Session context management.

        This allows us to write
            `with conn.session() as session:`
        instead of importing the sqlalchemy.orm.Session object and writing
            `with Session(conn._instance) as session:`

        Users of this connection should use the contextmanager pattern for writes,
        transactions, and anything more complex than simple read queries.

        See the usage example below, which assumes we have a table `numbers` with a
        single integer column `val`. The [SQLAlchemy](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
        docs also contain much more information on the usage of sessions.

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

    # NOTE: This more or less duplicates the default implementation in
    # ExperimentalBaseConnection so that we can add another bullet point between the
    # "Configured from" and "Learn more" items :/
    def _repr_html_(self) -> str:
        module_name = getattr(self, "__module__", None)
        class_name = type(self).__name__

        cfg = (
            f"- Configured from `[connections.{self._connection_name}]`"
            if len(self._secrets)
            else ""
        )

        with self.session() as s:
            dialect = s.bind.dialect.name if s.bind is not None else "unknown"

        return f"""
---
**st.connection {self._connection_name} built from `{module_name}.{class_name}`**
{cfg}
- Dialect: `{dialect}`
- Learn more using `st.help()`
---
"""
