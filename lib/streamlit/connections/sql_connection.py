# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

# NOTE: We ignore all mypy import-not-found errors as top-level since
# this module is optional and the SQLAlchemy dependency is not installed
# by default.
# mypy: disable-error-code="import-not-found, redundant-cast"

from __future__ import annotations

from collections import ChainMap
from copy import deepcopy
from typing import TYPE_CHECKING, Any, cast

from streamlit.connections import BaseConnection
from streamlit.connections.util import extract_from_dict
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from datetime import timedelta

    from pandas import DataFrame
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
    "query",
}
_REQUIRED_CONNECTION_PARAMS = {"dialect", "username", "host"}


class SQLConnection(BaseConnection["Engine"]):
    """A connection to a SQL database using a SQLAlchemy Engine.

    Initialize this connection object using ``st.connection("sql")`` or
    ``st.connection("<name>", type="sql")``. Connection parameters for a
    SQLConnection can be specified using ``secrets.toml`` and/or ``**kwargs``.
    Possible connection parameters include:

    - ``url`` or keyword arguments for |sqlalchemy.engine.URL.create()|_, except
      ``drivername``. Use ``dialect`` and ``driver`` instead of ``drivername``.
    - Keyword arguments for |sqlalchemy.create_engine()|_, including custom
      ``connect()`` arguments used by your specific ``dialect`` or ``driver``.
    - ``autocommit``. If this is ``False`` (default), the connection operates
      in manual commit (transactional) mode. If this is ``True``, the
      connection operates in autocommit (non-transactional) mode.

    If ``url`` exists as a connection parameter, Streamlit will pass it to
    ``sqlalchemy.engine.make_url()``. Otherwise, Streamlit requires (at a
    minimum) ``dialect``, ``username``, and ``host``. Streamlit will use
    ``dialect`` and ``driver`` (if defined) to derive ``drivername``, then pass
    the relevant connection parameters to ``sqlalchemy.engine.URL.create()``.

    In addition to the default keyword arguments for ``sqlalchemy.create_engine()``,
    your dialect may accept additional keyword arguments. For example, if you
    use ``dialect="snowflake"`` with `Snowflake SQLAlchemy
    <https://github.com/snowflakedb/snowflake-sqlalchemy#key-pair-authentication-support>`_,
    you can pass a value for ``private_key`` to use key-pair authentication. If
    you use ``dialect="bigquery"`` with `Google BigQuery
    <https://github.com/googleapis/python-bigquery-sqlalchemy#authentication>`_,
    you can pass a value for ``location``.

    SQLConnection provides the ``.query()`` convenience method, which can be
    used to run simple, read-only queries with both caching and simple error
    handling/retries. More complex database interactions can be performed by
    using the ``.session`` property to receive a regular SQLAlchemy Session.

    .. Important::
        `SQLAlchemy <https://pypi.org/project/SQLAlchemy/>`_ must be installed
        in your environment to use this connection. You must also install your
        driver, such as ``pyodbc`` or ``psycopg2``.

    .. |sqlalchemy.engine.URL.create()| replace:: ``sqlalchemy.engine.URL.create()``
    .. _sqlalchemy.engine.URL.create(): https://docs.sqlalchemy.org/en/20/core/engines.html#sqlalchemy.engine.URL.create
    .. |sqlalchemy.engine.make_url()| replace:: ``sqlalchemy.engine.make_url()``
    .. _sqlalchemy.engine.make_url(): https://docs.sqlalchemy.org/en/20/core/engines.html#sqlalchemy.engine.make_url
    .. |sqlalchemy.create_engine()| replace:: ``sqlalchemy.create_engine()``
    .. _sqlalchemy.create_engine(): https://docs.sqlalchemy.org/en/20/core/engines.html#sqlalchemy.create_engine

    Examples
    --------
    **Example 1: Configuration with URL**

    You can configure your SQL connection using Streamlit's
    `Secrets management <https://docs.streamlit.io/develop/concepts/connections/secrets-management>`_.
    The following example specifies a SQL connection URL.

    ``.streamlit/secrets.toml``:

    >>> [connections.sql]
    >>> url = "xxx+xxx://xxx:xxx@xxx:xxx/xxx"

    Your app code:

    >>> import streamlit as st
    >>>
    >>> conn = st.connection("sql")
    >>> df = conn.query("SELECT * FROM pet_owners")
    >>> st.dataframe(df)

    **Example 2: Configuration with dialect, host, and username**

    If you do not specify ``url``, you must at least specify ``dialect``,
    ``host``, and ``username`` instead. The following example also includes
    ``password``.

    ``.streamlit/secrets.toml``:

    >>> [connections.sql]
    >>> dialect = "xxx"
    >>> host = "xxx"
    >>> username = "xxx"
    >>> password = "xxx"

    Your app code:

    >>> import streamlit as st
    >>>
    >>> conn = st.connection("sql")
    >>> df = conn.query("SELECT * FROM pet_owners")
    >>> st.dataframe(df)

    **Example 3: Configuration with keyword arguments**

    You can configure your SQL connection with keyword arguments (with or
    without ``secrets.toml``). For example, if you use Microsoft Entra ID with
    a Microsoft Azure SQL server, you can quickly set up a local connection for
    development using `interactive authentication
    <https://learn.microsoft.com/en-us/sql/connect/odbc/using-azure-active-directory?view=sql-server-ver16#new-andor-modified-dsn-and-connection-string-keywords>`_.

    This example requires the `Microsoft ODBC Driver for SQL Server
    <https://learn.microsoft.com/en-us/sql/connect/odbc/microsoft-odbc-driver-for-sql-server?view=sql-server-ver16>`_
    for *Windows* in addition to the ``sqlalchemy`` and ``pyodbc`` packages for
    Python.

    >>> import streamlit as st
    >>>
    >>> conn = st.connection(
    ...     "sql",
    ...     dialect="mssql",
    ...     driver="pyodbc",
    ...     host="xxx.database.windows.net",
    ...     database="xxx",
    ...     username="xxx",
    ...     query={
    ...         "driver": "ODBC Driver 18 for SQL Server",
    ...         "authentication": "ActiveDirectoryInteractive",
    ...         "encrypt": "yes",
    ...     },
    ... )
    >>>
    >>> df = conn.query("SELECT * FROM pet_owners")
    >>> st.dataframe(df)

    """

    def _connect(self, autocommit: bool = False, **kwargs: Any) -> Engine:
        import sqlalchemy
        from sqlalchemy.engine import URL, make_url

        kwargs = deepcopy(kwargs)
        conn_param_kwargs = extract_from_dict(_ALL_CONNECTION_PARAMS, kwargs)
        conn_params = ChainMap(conn_param_kwargs, self._secrets.to_dict())

        if not len(conn_params):
            raise StreamlitAPIException(
                "Missing SQL DB connection configuration. "
                "Did you forget to set this in `secrets.toml` or as kwargs to `st.connection`?"
            )

        if "url" in conn_params:
            url = make_url(conn_params["url"])
        else:
            for p in _REQUIRED_CONNECTION_PARAMS:
                if p not in conn_params:
                    raise StreamlitAPIException(f"Missing SQL DB connection param: {p}")

            drivername = conn_params["dialect"] + (
                f"+{conn_params['driver']}" if "driver" in conn_params else ""
            )

            url = URL.create(
                drivername=drivername,
                username=conn_params["username"],
                password=conn_params.get("password"),
                host=conn_params["host"],
                port=int(conn_params["port"]) if "port" in conn_params else None,
                database=conn_params.get("database"),
                query=conn_params.get("query", {}),
            )

        create_engine_kwargs = ChainMap(
            kwargs, self._secrets.get("create_engine_kwargs", {})
        )
        eng = sqlalchemy.create_engine(url, **create_engine_kwargs)

        if autocommit:
            return cast("Engine", eng.execution_options(isolation_level="AUTOCOMMIT"))
        return cast("Engine", eng)

    def query(
        self,
        sql: str,
        *,  # keyword-only arguments:
        show_spinner: bool | str = "Running `sql.query(...)`.",
        ttl: float | int | timedelta | None = None,
        index_col: str | list[str] | None = None,
        chunksize: int | None = None,
        params: Any | None = None,
        **kwargs: Any,
    ) -> DataFrame:
        """Run a read-only query.

        This method implements query result caching and simple error
        handling/retries. The caching behavior is identical to that of using
        ``@st.cache_data``.

        .. note::
            Queries that are run without a specified ttl are cached indefinitely.

        All keyword arguments passed to this function are passed down to
        |pandas.read_sql|_, except ``ttl``.

        .. |pandas.read_sql| replace:: ``pandas.read_sql``
        .. _pandas.read_sql: https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html

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
            Additional keyword arguments are passed to |pandas.read_sql|_.

            .. |pandas.read_sql| replace:: ``pandas.read_sql``
            .. _pandas.read_sql: https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html

        Returns
        -------
        pandas.DataFrame
            The result of running the query, formatted as a pandas DataFrame.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.connection("sql")
        >>> df = conn.query(
        ...     "SELECT * FROM pet_owners WHERE owner = :owner",
        ...     ttl=3600,
        ...     params={"owner": "barbara"},
        ... )
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
        def _query(
            sql: str,
            index_col: str | list[str] | None = None,
            chunksize: int | None = None,
            params: Any | None = None,
            **kwargs: Any,
        ) -> DataFrame:
            import pandas as pd

            instance = self._instance.connect()
            return cast(
                "DataFrame",
                pd.read_sql(
                    text(sql),
                    instance,
                    index_col=index_col,
                    chunksize=chunksize,
                    params=params,
                    **kwargs,
                ),
            )

        # We modify our helper function's `__qualname__` here to work around default
        # `@st.cache_data` behavior. Otherwise, `.query()` being called with different
        # `ttl` values will reset the cache with each call, and the query caches won't
        # be scoped by connection.
        ttl_str = str(  # Avoid adding extra `.` characters to `__qualname__`
            ttl
        ).replace(".", "_")
        _query.__qualname__ = f"{_query.__qualname__}_{self._connection_name}_{ttl_str}"
        _query = cache_data(
            show_spinner=show_spinner,
            ttl=ttl,
        )(_query)

        return _query(
            sql,
            index_col=index_col,
            chunksize=chunksize,
            params=params,
            **kwargs,
        )

    def connect(self) -> SQLAlchemyConnection:
        """Call ``.connect()`` on the underlying SQLAlchemy Engine, returning a new\
        connection object.

        Calling this method is equivalent to calling ``self._instance.connect()``.

        NOTE: This method should not be confused with the internal ``_connect`` method used
        to implement a Streamlit Connection.

        Returns
        -------
        sqlalchemy.engine.Connection
            A new SQLAlchemy connection object.
        """
        return self._instance.connect()

    @property
    def engine(self) -> Engine:
        """The underlying SQLAlchemy Engine.

        This is equivalent to accessing ``self._instance``.

        Returns
        -------
        sqlalchemy.engine.base.Engine
            The underlying SQLAlchemy Engine.
        """
        return self._instance

    @property
    def driver(self) -> str:
        """The name of the driver used by the underlying SQLAlchemy Engine.

        This is equivalent to accessing ``self._instance.driver``.

        Returns
        -------
        str
            The name of the driver. For example, ``"pyodbc"`` or ``"psycopg2"``.
        """
        return cast("str", self._instance.driver)

    @property
    def session(self) -> Session:
        """Return a SQLAlchemy Session.

        Users of this connection should use the contextmanager pattern for writes,
        transactions, and anything more complex than simple read queries.

        See the usage example below, which assumes we have a table ``numbers`` with a
        single integer column ``val``. The `SQLAlchemy
        <https://docs.sqlalchemy.org/en/20/orm/session_basics.html>`_ docs also contain
        much more information on the usage of sessions.

        Returns
        -------
        sqlalchemy.orm.Session
            A SQLAlchemy Session.

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
