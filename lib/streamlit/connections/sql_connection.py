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
from __future__ import annotations

from collections import ChainMap
from copy import deepcopy
from datetime import timedelta
from typing import TYPE_CHECKING, List, Optional, Union, cast

import pandas as pd

from streamlit.connections import BaseConnection
from streamlit.connections.util import extract_from_dict
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection as SQLAlchemyConnection
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


class SQLConnection(BaseConnection["Engine"]):
    """A connection to a SQL database using a SQLAlchemy Engine. Initialize using ``st.connection("<name>", type="sql")``.

    SQLConnection provides the ``query()`` convenience method, which can be used to
    run simple read-only queries with both caching and simple error handling/retries.
    More complex DB interactions can be performed by using the ``.session`` property
    to receive a regular SQLAlchemy Session.

    SQLConnections should always be created using ``st.connection()``, **not**
    initialized directly. Connection parameters for a SQLConnection can be specified
    using either ``st.secrets`` or ``**kwargs``. Some frequently used parameters include:

    - **url** or arguments for `sqlalchemy.engine.URL.create()
      <https://docs.sqlalchemy.org/en/20/core/engines.html#sqlalchemy.engine.URL.create>`_.
      Most commonly it includes a dialect, host, database, username and password.

    - **create_engine_kwargs** can be passed via ``st.secrets``, such as for
      `snowflake-sqlalchemy <https://github.com/snowflakedb/snowflake-sqlalchemy#key-pair-authentication-support>`_
      or `Google BigQuery <https://github.com/googleapis/python-bigquery-sqlalchemy#authentication>`_.
      These can also be passed directly as ``**kwargs`` to connection().

    - **autocommit=True** to run with isolation level ``AUTOCOMMIT``. Default is False.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> conn = st.connection("sql")
    >>> df = conn.query("select * from pet_owners")
    >>> st.dataframe(df)
    """

    def _connect(self, autocommit: bool = False, **kwargs) -> "Engine":
        import sqlalchemy

        kwargs = deepcopy(kwargs)
        conn_param_kwargs = extract_from_dict(_ALL_CONNECTION_PARAMS, kwargs)
        conn_params = ChainMap(conn_param_kwargs, self._secrets.to_dict())

        if not len(conn_params):
            raise StreamlitAPIException(
                "Missing SQL DB connection configuration. "
                "Did you forget to set this in `secrets.toml` or as kwargs to `st.connection`?"
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
        show_spinner: bool | str = "Running `sql.query(...)`.",
        ttl: Optional[Union[float, int, timedelta]] = None,
        index_col: Optional[Union[str, List[str]]] = None,
        chunksize: Optional[int] = None,
        params=None,
        **kwargs,
    ) -> pd.DataFrame:
        """Run a read-only query.

        This method implements both query result caching (with caching behavior
        identical to that of using @st.cache_data) as well as simple error handling/retries.

        .. note::
            Queries that are run without a specified ttl are cached indefinitely.

        Aside from the ``ttl`` kwarg, all kwargs passed to this function are passed down
        to `pd.read_sql <https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html>`_
        and have the behavior described in the pandas documentation.

        Parameters
        ----------
        sql : str
            The read-only SQL query to execute.
        show_spinner : boolean or string
            Enable the spinner. The default is to show a spinner when there is a
            "cache miss" and the cached resource is being created. If a string, the value
            of the show_spinner param will be used for the spinner text.
        ttl : float, int, timedelta or None
            The maximum number of seconds to keep results in the cache, or
            None if cached results should not expire. The default is None.
        index_col : str, list of str, or None
            Column(s) to set as index(MultiIndex). Default is None.
        chunksize : int or None
            If specified, return an iterator where chunksize is the number of
            rows to include in each chunk. Default is None.
        params : list, tuple, dict or None
            List of parameters to pass to the execute method. The syntax used to pass
            parameters is database driver dependent. Check your database driver
            documentation for which of the five syntax styles, described in `PEP 249
            paramstyle <https://peps.python.org/pep-0249/#paramstyle>`_, is supported.
            Default is None.
        **kwargs: dict
            Additional keyword arguments are passed to `pd.read_sql
            <https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html>`_.

        Returns
        -------
        pd.DataFrame
            The result of running the query, formatted as a pandas DataFrame.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.connection("sql")
        >>> df = conn.query("select * from pet_owners where owner = :owner", ttl=3600, params={"owner":"barbara"})
        >>> st.dataframe(df)
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
            show_spinner=show_spinner,
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

    def connect(self) -> "SQLAlchemyConnection":
        """Call ``.connect()`` on the underlying SQLAlchemy Engine, returning a new
        sqlalchemy.engine.Connection object.

        Calling this method is equivalent to calling ``self._instance.connect()``.

        NOTE: This method should not be confused with the internal _connect method used
        to implement a Streamlit Connection.
        """
        return self._instance.connect()

    @property
    def engine(self) -> "Engine":
        """The underlying SQLAlchemy Engine.

        This is equivalent to accessing ``self._instance``.
        """
        return self._instance

    @property
    def driver(self) -> str:
        """The name of the driver used by the underlying SQLAlchemy Engine.

        This is equivalent to accessing ``self._instance.driver``.
        """
        return self._instance.driver

    @property
    def session(self) -> "Session":
        """Return a SQLAlchemy Session.

        Users of this connection should use the contextmanager pattern for writes,
        transactions, and anything more complex than simple read queries.

        See the usage example below, which assumes we have a table ``numbers`` with a
        single integer column ``val``. The `SQLAlchemy
        <https://docs.sqlalchemy.org/en/20/orm/session_basics.html>`_ docs also contain
        much more information on the usage of sessions.

        Example
        -------
        >>> import streamlit as st
        >>> conn = st.connection("sql")
        >>> n = st.slider("Pick a number")
        >>> if st.button("Add the number!"):
        ...     with conn.session as session:
        ...         session.execute("INSERT INTO numbers (val) VALUES (:n);", {"n": n})
        ...         session.commit()
        """
        from sqlalchemy.orm import Session

        return Session(self._instance)

    # NOTE: This more or less duplicates the default implementation in
    # BaseConnection so that we can add another bullet point between the
    # "Configured from" and "Learn more" items :/
    def _repr_html_(self) -> str:
        module_name = getattr(self, "__module__", None)
        class_name = type(self).__name__

        cfg = (
            f"- Configured from `[connections.{self._connection_name}]`"
            if len(self._secrets)
            else ""
        )

        with self.session as s:
            dialect = s.bind.dialect.name if s.bind is not None else "unknown"

        return f"""
---
**st.connection {self._connection_name} built from `{module_name}.{class_name}`**
{cfg}
- Dialect: `{dialect}`
- Learn more using `st.help()`
---
"""
